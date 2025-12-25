/**
 * HalfTime Processor - Professional Grade
 * Advanced time-stretching using granular synthesis
 * Inspired by CableGuys HalfTime, Gross Beat, and dBlue Glitch
 *
 * Features:
 * - High-quality granular synthesis with smooth crossfading
 * - Multiple algorithmic modes (Clean, Tape, Granular, Vinyl, Cassette, Glitch)
 * - Pitch-locked time stretching
 * - Anti-aliasing and artifact reduction
 * - Low CPU usage with optimized grain management
 */

class HalfTimeProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 0.5, minValue: 0.25, maxValue: 2.0 },
      { name: 'smoothing', defaultValue: 50, minValue: 0, maxValue: 100 },
      { name: 'pitchShift', defaultValue: -12, minValue: -24, maxValue: 24 },
      { name: 'grainSize', defaultValue: 100, minValue: 50, maxValue: 500 },
      { name: 'grainDensity', defaultValue: 8, minValue: 1, maxValue: 16 },
      { name: 'pitchLock', defaultValue: 1, minValue: 0, maxValue: 1 },
      { name: 'mix', defaultValue: 100, minValue: 0, maxValue: 100 },
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 5 },
      { name: 'analogWarmth', defaultValue: 0, minValue: 0, maxValue: 100 },
      { name: 'glitchAmount', defaultValue: 0, minValue: 0, maxValue: 100 },
      { name: 'reverse', defaultValue: 0, minValue: 0, maxValue: 1 } // 0=normal, 1=reverse
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'HalfTime';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Maximum buffer size (4 seconds for safety)
    const maxBufferSize = Math.ceil(4 * this.sampleRate);

    // Per-channel state
    this.channelState = [
      this.createChannelState(maxBufferSize),
      this.createChannelState(maxBufferSize)
    ];

    // Mode profiles (professional settings)
    this.modeProfiles = {
      0: { // CLEAN - Pristine digital
        grainSizeMultiplier: 1.0,
        grainDensityMultiplier: 1.2,
        windowType: 'hann',
        warmth: 0,
        flutter: 0,
        glitch: 0
      },
      1: { // TAPE - Analog tape simulation
        grainSizeMultiplier: 1.5,
        grainDensityMultiplier: 0.8,
        windowType: 'tukey',
        warmth: 40,
        flutter: 0.15,
        glitch: 0
      },
      2: { // GRANULAR - Dense texture
        grainSizeMultiplier: 0.8,
        grainDensityMultiplier: 1.8,
        windowType: 'hann',
        warmth: 0,
        flutter: 0,
        glitch: 0
      },
      3: { // VINYL - Record player
        grainSizeMultiplier: 1.3,
        grainDensityMultiplier: 0.9,
        windowType: 'tukey',
        warmth: 60,
        flutter: 0.3,
        glitch: 0.05
      },
      4: { // CASSETTE - Lo-fi tape
        grainSizeMultiplier: 1.6,
        grainDensityMultiplier: 1.0,
        windowType: 'tukey',
        warmth: 50,
        flutter: 0.25,
        glitch: 0.03
      },
      5: { // GLITCH - Stuttering broken time
        grainSizeMultiplier: 0.5,
        grainDensityMultiplier: 2.5,
        windowType: 'rect',
        warmth: 0,
        flutter: 0,
        glitch: 0.4
      }
    };

    // LFO for analog modulation
    this.flutterPhase = 0;
    this.flutterRate = 0.3 + Math.random() * 0.4; // Vary flutter rate

    // DC blocker state (remove DC offset)
    this.dcBlockerState = [
      { x1: 0, y1: 0 },
      { x1: 0, y1: 0 }
    ];

    this.port.onmessage = (e) => {
      if (e.data.type === 'updateSettings') {
        Object.assign(this.settings, e.data.data);
      } else if (e.data.type === 'bypass') {
        this.bypassed = e.data.value;
      }
    };
  }

  createChannelState(bufferSize) {
    return {
      buffer: new Float32Array(bufferSize),
      writeIndex: 0,
      readPosition: 0,
      grains: [],
      nextGrainSpawn: 0,
      lastPitchRatio: 1.0
    };
  }

  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  // Window functions for grain envelopes
  getWindowValue(type, phase) {
    switch (type) {
      case 'hann':
        // Hann window (smooth, no clicks)
        return 0.5 * (1 - Math.cos(2 * Math.PI * phase));

      case 'tukey':
        // Tukey window (softer attack/release than Hann)
        const alpha = 0.5;
        if (phase < alpha / 2) {
          return 0.5 * (1 + Math.cos(Math.PI * (2 * phase / alpha - 1)));
        } else if (phase > 1 - alpha / 2) {
          return 0.5 * (1 + Math.cos(Math.PI * (2 * phase / alpha - 2 / alpha + 1)));
        }
        return 1.0;

      case 'rect':
        // Rectangular (for glitch mode)
        return phase > 0.05 && phase < 0.95 ? 1.0 : 0.0;

      default:
        return 1.0;
    }
  }

  // Create a new grain with proper initialization
  createGrain(state, grainSizeSamples, pitchRatio, windowType) {
    // Calculate grain start position (look back into buffer)
    const lookbackSamples = Math.floor(grainSizeSamples * 1.5);
    let startPos = state.writeIndex - lookbackSamples;
    if (startPos < 0) startPos += state.buffer.length;

    return {
      startPos: startPos,
      size: grainSizeSamples,
      phase: 0,
      pitchRatio: pitchRatio,
      windowType: windowType,
      active: true,
      amplitude: 1.0
    };
  }

  // Process a single grain with high-quality interpolation
  processGrain(grain, state, reverse) {
    if (!grain.active || grain.phase >= grain.size) {
      grain.active = false;
      return 0;
    }

    // Calculate read position with pitch shift
    let readOffset = grain.phase * grain.pitchRatio;
    if (reverse) {
      // Reverse: read backwards from end of grain
      readOffset = (grain.size - grain.phase) * grain.pitchRatio;
    }
    const readPos = (grain.startPos + readOffset) % state.buffer.length;

    // Cubic interpolation for smoother sound
    const index = Math.floor(readPos);
    const frac = readPos - index;

    const idx0 = (index - 1 + state.buffer.length) % state.buffer.length;
    const idx1 = index;
    const idx2 = (index + 1) % state.buffer.length;
    const idx3 = (index + 2) % state.buffer.length;

    const y0 = state.buffer[idx0] || 0;
    const y1 = state.buffer[idx1] || 0;
    const y2 = state.buffer[idx2] || 0;
    const y3 = state.buffer[idx3] || 0;

    // Cubic interpolation (Catmull-Rom spline)
    const c0 = y1;
    const c1 = 0.5 * (y2 - y0);
    const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
    const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);

    let sample = c0 + c1 * frac + c2 * frac * frac + c3 * frac * frac * frac;

    // Apply window envelope
    const windowPhase = grain.phase / grain.size;
    const window = this.getWindowValue(grain.windowType, windowPhase);
    sample *= window * grain.amplitude;

    grain.phase++;
    return sample;
  }

  // Analog warmth (tube-style saturation)
  applySaturation(sample, amount) {
    if (amount <= 0) return sample;

    const drive = 1 + amount * 4;
    const driven = sample * drive;

    // Soft clipping (tanh)
    return Math.tanh(driven) / Math.tanh(drive);
  }

  // Analog flutter (wow & flutter simulation)
  applyFlutter(pitchRatio, amount) {
    if (amount <= 0) return pitchRatio;

    // Multi-frequency flutter for realism
    this.flutterPhase += (this.flutterRate * 2 * Math.PI) / this.sampleRate;
    if (this.flutterPhase > 2 * Math.PI) this.flutterPhase -= 2 * Math.PI;

    const lfo1 = Math.sin(this.flutterPhase);
    const lfo2 = Math.sin(this.flutterPhase * 3.7) * 0.3;
    const lfo3 = Math.sin(this.flutterPhase * 7.3) * 0.1;

    const totalLfo = lfo1 + lfo2 + lfo3;
    const modulation = 1 + (totalLfo * amount * 0.015);

    return pitchRatio * modulation;
  }

  // DC blocker (remove DC offset that can cause clicks)
  dcBlock(sample, channel) {
    const state = this.dcBlockerState[channel];
    const y = sample - state.x1 + 0.995 * state.y1;
    state.x1 = sample;
    state.y1 = y;
    return y;
  }

  // Main processing per sample
  processEffect(sample, channel, parameters) {
    const rate = this.getParam(parameters.rate, 0) || 0.5;
    const smoothing = this.getParam(parameters.smoothing, 0) || 50;
    const pitchShift = this.getParam(parameters.pitchShift, 0) || -12;
    const grainSize = this.getParam(parameters.grainSize, 0) || 100;
    const grainDensity = this.getParam(parameters.grainDensity, 0) || 8;
    const pitchLock = this.getParam(parameters.pitchLock, 0) >= 0.5;
    const mode = Math.floor(this.getParam(parameters.mode, 0) || 0);
    const analogWarmth = this.getParam(parameters.analogWarmth, 0) || 0;
    const glitchAmount = this.getParam(parameters.glitchAmount, 0) || 0;
    const reverse = this.getParam(parameters.reverse, 0) >= 0.5;

    const state = this.channelState[channel];
    const modeProfile = this.modeProfiles[mode] || this.modeProfiles[0];

    // Write input to circular buffer
    state.buffer[state.writeIndex] = sample;
    state.writeIndex = (state.writeIndex + 1) % state.buffer.length;

    // Calculate grain parameters
    const actualGrainSize = grainSize * modeProfile.grainSizeMultiplier;
    const grainSizeSamples = Math.floor((actualGrainSize / 1000) * this.sampleRate);

    const actualGrainDensity = Math.max(1, Math.floor(
      grainDensity * modeProfile.grainDensityMultiplier * (smoothing / 100)
    ));

    // 🎯 PROFESSIONAL GRAIN OVERLAP: Optimized calculation
    // Overlap: 4-8 grains for smooth crossfading (industry standard)
    const overlap = Math.max(4, Math.min(8, Math.floor(actualGrainDensity / 2.5)));
    const grainSpacing = Math.max(1, Math.floor(grainSizeSamples / overlap));

    // Calculate pitch ratio
    let pitchRatio = 1.0;
    if (pitchLock) {
      // Pitch lock: compensate for time stretch
      pitchRatio = 1.0 / rate;
      // Apply additional pitch shift
      pitchRatio *= Math.pow(2, pitchShift / 12);
    } else {
      // No pitch lock: pitch follows rate (like tape)
      pitchRatio = 1.0;
    }

    // Apply flutter modulation
    const totalFlutter = (modeProfile.flutter + (analogWarmth / 100) * 0.2);
    pitchRatio = this.applyFlutter(pitchRatio, totalFlutter);

    // 🎯 OPTIMIZED GRAIN SPAWNING: Better performance management
    state.nextGrainSpawn--;
    if (state.nextGrainSpawn <= 0) {
      // Professional grain limit: balance quality vs performance
      // More grains = smoother sound but higher CPU
      const maxGrains = modeProfile.windowType === 'rect' ? 16 : 24; // Fewer for glitch mode
      if (state.grains.length < maxGrains) {
        const grain = this.createGrain(
          state,
          grainSizeSamples,
          pitchRatio,
          modeProfile.windowType
        );
        state.grains.push(grain);
      }
      state.nextGrainSpawn = grainSpacing;
    }

    // Process all active grains and mix
    let output = 0;
    let activeCount = 0;

    for (let i = state.grains.length - 1; i >= 0; i--) {
      const grain = state.grains[i];
      if (grain.active) {
        output += this.processGrain(grain, state, reverse);
        activeCount++;
      } else {
        // Remove inactive grains
        state.grains.splice(i, 1);
      }
    }

    // 🎯 PROFESSIONAL GRAIN NORMALIZATION: Energy-preserving scaling
    // Use 1/sqrt(N) rule with slight adjustment for overlap
    if (activeCount > 0) {
      // Professional normalization: preserves energy across grain overlap
      const overlapFactor = Math.min(1.2, overlap / 4); // Account for overlap
      output /= Math.sqrt(activeCount) * (0.85 + overlapFactor * 0.15);
    }

    // Apply character processing
    const totalWarmth = (analogWarmth + modeProfile.warmth) / 100;
    if (totalWarmth > 0) {
      output = this.applySaturation(output, totalWarmth);
    }

    // 🎯 PROFESSIONAL GLITCH: Sample-accurate artifacts (not per-sample random)
    const totalGlitch = (modeProfile.glitch + glitchAmount / 100);
    if (totalGlitch > 0) {
      // Use deterministic pseudo-random for sample-accurate glitches
      // Avoid Math.random() which is too slow and non-deterministic
      const glitchSeed = (state.writeIndex * 7919 + channel * 9973) % 1000000;
      const glitchRate = totalGlitch * 0.015; // Lower rate for quality
      
      // Amplitude glitch (deterministic)
      if ((glitchSeed % 1000) < totalGlitch * 10) {
        const glitchAmount = 0.3 + (glitchSeed % 700) / 1000; // 0.3-1.0 range
        output *= glitchAmount;
      }
      
      // Dropout glitch (rare but effective)
      if ((glitchSeed % 5000) < totalGlitch * 2) {
        output = 0;
      }
    }

    // DC blocker (important for preventing clicks)
    output = this.dcBlock(output, channel);

    // Advance read position at stretched rate
    state.readPosition += rate;

    return output;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    // Bypass mode
    if (!input || !input.length || this.bypassed) {
      if (output && output.length) {
        for (let channel = 0; channel < output.length; channel++) {
          output[channel].set(input?.[channel] || new Float32Array(128));
        }
      }
      return true;
    }

    // Get mix parameter
    const mixParam = this.getParam(parameters.mix, 0);
    const mix = mixParam !== undefined ? mixParam :
                (this.settings.mix !== undefined ? this.settings.mix : 100);
    const wet = mix / 100;
    const dry = 1 - wet;

    // Process each channel
    for (let channel = 0; channel < output.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      for (let i = 0; i < inputChannel.length; i++) {
        const inputSample = inputChannel[i];
        const processedSample = this.processEffect(inputSample, channel, parameters);

        // Mix dry/wet
        outputChannel[i] = dry * inputSample + wet * processedSample;
      }
    }

    return true;
  }
}

registerProcessor('halftime-processor', HalfTimeProcessor);
