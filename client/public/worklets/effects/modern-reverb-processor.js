/**
 * MODERN REVERB PROCESSOR
 *
 * Freeverb-style algorithmic reverb
 * - 8 comb filters (4 per channel with stereo spread)
 * - 4 allpass filters for diffusion
 * - Early reflections simulation
 * - Modulated delay for chorus effect
 */

// Import base processor if available
// importScripts('../base-effect-processor.js');

class ModernReverbProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'size', defaultValue: 0.7, minValue: 0, maxValue: 1 },
      { name: 'decay', defaultValue: 2.5, minValue: 0.1, maxValue: 15 },
      { name: 'damping', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'preDelay', defaultValue: 0.02, minValue: 0, maxValue: 0.2 },
      { name: 'wet', defaultValue: 0.35, minValue: 0, maxValue: 1 },
      { name: 'earlyLateMix', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'diffusion', defaultValue: 0.7, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();

    this.sampleRate = globalThis.sampleRate || 48000;
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Freeverb comb filter tunings (samples at 44.1kHz)
    const combTunings = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116];
    const allpassTunings = [225, 341, 441, 556];
    const stereoSpread = 23;

    // Scale tunings to current sample rate
    const scale = this.sampleRate / 44100;

    // Initialize comb filters (8 total - 4 per channel)
    // Store base sizes for size parameter scaling
    this.combFilters = [];
    this.baseCombSizes = [];
    for (let i = 0; i < 8; i++) {
      const isRight = i >= 4;
      const tuning = combTunings[i % 4];
      const spread = isRight ? stereoSpread : 0;
      const baseSize = Math.floor((tuning + spread) * scale);
      this.baseCombSizes.push(baseSize);

      this.combFilters.push({
        buffer: new Float32Array(baseSize),
        index: 0,
        size: baseSize,
        baseSize: baseSize, // Store for dynamic resizing
        filterState: 0,
        filterState2: 0, // Second pole for smoother damping
        channel: isRight ? 1 : 0
      });
    }

    // Initialize allpass filters (4 serial)
    this.allpassFilters = [];
    for (let i = 0; i < 4; i++) {
      const size = Math.floor(allpassTunings[i] * scale);
      this.allpassFilters.push({
        buffer: new Float32Array(size),
        index: 0,
        size: size
      });
    }

    // 🎯 PROFESSIONAL EARLY REFLECTIONS: Room-modeling delays with proper gain
    // More taps (12) for realistic room simulation (like Lexicon/Eventide)
    const earlyTimes = [5, 11, 17, 23, 31, 37, 43, 47, 53, 59, 67, 73]; // ms
    this.earlyReflections = earlyTimes.map((ms, idx) => {
      const samples = Math.floor((ms / 1000) * this.sampleRate);
      // Professional gain: distance-based attenuation + inverse square law
      const distanceAttenuation = Math.exp(-ms / 80); // -80ms = -60dB rule
      const tapGain = distanceAttenuation * (0.7 + Math.random() * 0.3); // Add variation
      return {
        buffer: new Float32Array(samples),
        index: 0,
        size: samples,
        gain: tapGain
      };
    });

    // Pre-delay buffer
    const maxPreDelay = Math.floor(0.2 * this.sampleRate);
    this.preDelayBuffer = new Float32Array(maxPreDelay);
    this.preDelayIndex = 0;

    this.port.onmessage = (event) => {
      const { type, data } = event.data;
      if (type === 'updateSettings') {
        this.settings = { ...this.settings, ...data };
      } else if (type === 'bypass') {
        this.bypassed = data.bypassed;
      } else if (type === 'reset' || type === 'flush') {
        // Clear all reverb buffers for clean stop
        this.combFilters.forEach(comb => {
          comb.buffer.fill(0);
          comb.filterState = 0;
          comb.filterState2 = 0; // Clear second pole
        });
        this.allpassFilters.forEach(ap => ap.buffer.fill(0));
        this.earlyReflections.forEach(er => er.buffer.fill(0));
        this.preDelayBuffer.fill(0);
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input?.[0] || !output?.[0]) return true;

    const blockSize = input[0].length;
    const channels = Math.min(input.length, output.length);

    // Get parameters
    const size = this.getParam(parameters.size, 0) ?? this.settings.size ?? 0.7;
    const decay = this.getParam(parameters.decay, 0) ?? this.settings.decay ?? 2.5;
    const damping = this.getParam(parameters.damping, 0) ?? this.settings.damping ?? 0.5;
    const preDelay = this.getParam(parameters.preDelay, 0) ?? this.settings.preDelay ?? 0.02;
    const wet = this.getParam(parameters.wet, 0) ?? this.settings.wet ?? 0.35;
    const earlyLateMix = this.getParam(parameters.earlyLateMix, 0) ?? this.settings.earlyLateMix ?? 0.5;
    const diffusion = this.getParam(parameters.diffusion, 0) ?? this.settings.diffusion ?? 0.7;

    if (this.bypassed) {
      for (let ch = 0; ch < channels; ch++) {
        output[ch].set(input[ch]);
      }
      return true;
    }

    // 🎯 PROFESSIONAL COEFFICIENT CALCULATIONS
    
    // RT60-based feedback calculation (industry standard)
    // RT60 = delayLength * ln(0.001) / ln(feedback)
    // Solving for feedback: feedback = 10^(-3 * delayLength / (RT60 * sampleRate))
    const avgCombDelay = Math.floor((1557 + 1617 + 1491 + 1422) / 4 * (this.sampleRate / 44100));
    const feedback = Math.min(0.999, Math.pow(10, -3 * avgCombDelay / (decay * this.sampleRate)));
    
    // Size parameter: Scale delay lengths (like Valhalla Room)
    const sizeScale = 0.5 + size * 1.5; // 0.5x to 2x
    
    // Professional damping: Two-pole lowpass for smoother high-frequency attenuation
    const dampFreq = 2000 + (1 - damping) * 18000;
    const omega = 2 * Math.PI * dampFreq / this.sampleRate;
    const dampCoeff = Math.exp(-omega); // One-pole coefficient (kept for compatibility)
    const dampCoeff2 = Math.exp(-omega * 1.5); // Second pole for smoother rolloff
    
    const preDelaySamples = Math.floor(preDelay * this.sampleRate);
    
    // Diffusion allpass feedback: 0.5-0.7 range (Freeverb standard)
    const allpassFeedback = 0.5 + diffusion * 0.2;

    for (let i = 0; i < blockSize; i++) {
      // Mix input channels to mono
      let monoInput = 0;
      for (let ch = 0; ch < channels; ch++) {
        monoInput += input[ch][i];
      }
      monoInput /= channels;

      // Pre-delay
      const preDelayedSample = this.preDelayBuffer[
        (this.preDelayIndex - preDelaySamples + this.preDelayBuffer.length) % this.preDelayBuffer.length
      ];
      this.preDelayBuffer[this.preDelayIndex] = monoInput;
      this.preDelayIndex = (this.preDelayIndex + 1) % this.preDelayBuffer.length;

      // Early reflections
      let earlySum = 0;
      this.earlyReflections.forEach(tap => {
        earlySum += tap.buffer[tap.index] * tap.gain;
        tap.buffer[tap.index] = preDelayedSample;
        tap.index = (tap.index + 1) % tap.size;
      });

      // 🎯 PROFESSIONAL COMB FILTERS: Size-scaled delays + two-pole damping
      let combSumLeft = 0;
      let combSumRight = 0;

      this.combFilters.forEach((comb, idx) => {
        // Size-scaled delay read position
        const scaledSize = Math.floor(comb.baseSize * sizeScale);
        const effectiveIndex = comb.index % scaledSize;
        const delayed = comb.buffer[effectiveIndex];

        // 🎯 TWO-POLE LOWPASS: Smoother high-frequency damping (like Lexicon)
        // First pole
        comb.filterState = delayed + dampCoeff * (comb.filterState - delayed);
        // Second pole (smoother)
        comb.filterState2 = comb.filterState + dampCoeff2 * (comb.filterState2 - comb.filterState);
        const filtered = comb.filterState2;

        // Write back with feedback
        comb.buffer[comb.index] = preDelayedSample + filtered * feedback;
        comb.index = (comb.index + 1) % comb.size;

        // Sum to appropriate channel
        if (comb.channel === 0) combSumLeft += delayed;
        else combSumRight += delayed;
      });

      combSumLeft /= 4;
      combSumRight /= 4;

      // Allpass filters (diffusion) - process both channels
      let lateLeft = combSumLeft;
      let lateRight = combSumRight;

      this.allpassFilters.forEach(allpass => {
        // Left channel
        const delayedL = allpass.buffer[allpass.index];
        allpass.buffer[allpass.index] = lateLeft + delayedL * allpassFeedback;
        lateLeft = delayedL - lateLeft * allpassFeedback;

        // Right channel (use separate index for stereo)
        const delayedR = allpass.buffer[(allpass.index + Math.floor(allpass.size / 2)) % allpass.size];
        lateRight = delayedR - lateRight * allpassFeedback;

        allpass.index = (allpass.index + 1) % allpass.size;
      });

      // Mix early and late
      const reverbLeft = earlySum * (1 - earlyLateMix) + lateLeft * earlyLateMix;
      const reverbRight = earlySum * (1 - earlyLateMix) + lateRight * earlyLateMix;

      // 🎯 PROFESSIONAL OUTPUT: Proper gain staging
      // Wet signal gain: Compensate for parallel comb filter summation
      const wetGain = 0.5; // Professional reverb output level
      output[0][i] = input[0][i] * (1 - wet) + reverbLeft * wet * wetGain;
      if (channels > 1) {
        output[1][i] = input[1][i] * (1 - wet) + reverbRight * wet * wetGain;
      }
    }

    return true;
  }

  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }
}

registerProcessor('modern-reverb-processor', ModernReverbProcessor);
