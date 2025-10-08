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
    this.combFilters = [];
    for (let i = 0; i < 8; i++) {
      const isRight = i >= 4;
      const tuning = combTunings[i % 4];
      const spread = isRight ? stereoSpread : 0;
      const size = Math.floor((tuning + spread) * scale);

      this.combFilters.push({
        buffer: new Float32Array(size),
        index: 0,
        size: size,
        filterState: 0,
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

    // Early reflections (8 taps)
    const earlyTimes = [17, 23, 31, 43, 47, 59, 67, 73]; // ms
    this.earlyReflections = earlyTimes.map(ms => {
      const samples = Math.floor((ms / 1000) * this.sampleRate);
      return {
        buffer: new Float32Array(samples),
        index: 0,
        size: samples,
        gain: Math.exp(-ms / 100) // Exponential decay
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

    // Calculate coefficients
    const feedback = Math.min(0.98, 1 - (1 / (decay * 10)));
    const dampFreq = 2000 + (1 - damping) * 18000;
    const dampCoeff = Math.exp(-2 * Math.PI * dampFreq / this.sampleRate);
    const preDelaySamples = Math.floor(preDelay * this.sampleRate);
    const allpassFeedback = 0.3 + diffusion * 0.4;

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

      // Comb filters (late reverb)
      let combSumLeft = 0;
      let combSumRight = 0;

      this.combFilters.forEach(comb => {
        const delayed = comb.buffer[comb.index];

        // One-pole lowpass (damping)
        comb.filterState = delayed + dampCoeff * (comb.filterState - delayed);
        const filtered = comb.filterState;

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

      // Output with wet/dry mix
      output[0][i] = input[0][i] * (1 - wet) + reverbLeft * wet * 0.6;
      if (channels > 1) {
        output[1][i] = input[1][i] * (1 - wet) + reverbRight * wet * 0.6;
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
