/**
 * SATURATOR PROCESSOR
 *
 * Multi-stage tube saturation effect
 * Adds analog warmth and harmonic distortion
 */

class SaturatorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'distortion', defaultValue: 0.4, minValue: 0, maxValue: 1.5 },
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      // v2.0 parameters
      { name: 'autoGain', defaultValue: 1, minValue: 0, maxValue: 1 },
      { name: 'lowCutFreq', defaultValue: 0, minValue: 0, maxValue: 500 },
      { name: 'highCutFreq', defaultValue: 20000, minValue: 2000, maxValue: 20000 },
      { name: 'tone', defaultValue: 0, minValue: -12, maxValue: 12 },
      { name: 'headroom', defaultValue: 0, minValue: -12, maxValue: 12 }
    ];
  }

  constructor(options) {
    super();

    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'Saturator';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Per-channel state
    this.channelState = [
      {
        history: new Float32Array(4),
        dcBlocker: { x1: 0, y1: 0 }
      },
      {
        history: new Float32Array(4),
        dcBlocker: { x1: 0, y1: 0 }
      }
    ];

    this.oversample = 2;

    // v2.0 mode switches
    this.saturationMode = 'toasty'; // 'toasty' | 'crunchy' | 'distress'
    this.frequencyMode = 'wide'; // 'transformer' | 'wide' | 'tape'

    // Cached filter coefficients
    this.cachedLowCutCoeffs = null;
    this.cachedHighCutCoeffs = null;
    this.cachedTiltCoeffs = null;
    this.lastLowCutFreq = -1;
    this.lastHighCutFreq = -1;
    this.lastTone = 0;

    // Biquad filter state (per channel) - Direct Form II Transposed
    this.channelState.forEach(state => {
      state.lowCutFilter = { x1: 0, x2: 0 };
      state.highCutFilter = { x1: 0, x2: 0 };
      state.tiltFilter = { x1: 0, x2: 0 };
    });

    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  handleMessage(message) {
    const { type, data } = message;
    switch (type) {
      case 'updateSettings':
        this.settings = { ...this.settings, ...data };
        break;
      case 'bypass':
        this.bypassed = data.bypassed;
        break;
      case 'reset':
        this.resetState();
        break;
      case 'setSaturationMode':
        this.saturationMode = data.mode || 'toasty';
        break;
      case 'setFrequencyMode':
        this.frequencyMode = data.mode || 'wide';
        break;
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) return true;

    const blockSize = input[0].length;
    const channelCount = Math.min(input.length, output.length);

    const wetParam = this.getParam(parameters.wet, 0);
    const wet = wetParam !== undefined ? wetParam : (this.settings.wet !== undefined ? this.settings.wet : 1.0);

    if (this.bypassed) {
      for (let channel = 0; channel < channelCount; channel++) {
        output[channel].set(input[channel]);
      }
      return true;
    }

    for (let channel = 0; channel < channelCount; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      for (let i = 0; i < blockSize; i++) {
        const drySample = inputChannel[i];
        const wetSample = this.processEffect(drySample, channel, i, parameters);
        outputChannel[i] = drySample * (1 - wet) + wetSample * wet;
      }
    }

    return true;
  }

  processEffect(sample, channel, sampleIndex, parameters) {
    const distortion = this.getParam(parameters.distortion, sampleIndex) || 0.4;
    const autoGain = this.getParam(parameters.autoGain, sampleIndex) !== undefined
      ? this.getParam(parameters.autoGain, sampleIndex) : 1;
    const lowCutFreq = this.getParam(parameters.lowCutFreq, sampleIndex) || 0;
    const highCutFreq = this.getParam(parameters.highCutFreq, sampleIndex) || 20000;
    const tone = this.getParam(parameters.tone, sampleIndex) || 0;
    const headroom = this.getParam(parameters.headroom, sampleIndex) || 0;

    const drive = 1 + distortion * 9;
    const state = this.channelState[channel] || this.channelState[0];

    // Update filter coefficients only when parameters change
    if (lowCutFreq !== this.lastLowCutFreq) {
      this.cachedLowCutCoeffs = lowCutFreq > 20 ? this.calculateHighpass(lowCutFreq) : null;
      this.lastLowCutFreq = lowCutFreq;
    }
    if (highCutFreq !== this.lastHighCutFreq) {
      this.cachedHighCutCoeffs = highCutFreq < 19000 ? this.calculateLowpass(highCutFreq) : null;
      this.lastHighCutFreq = highCutFreq;
    }
    if (tone !== this.lastTone) {
      this.cachedTiltCoeffs = Math.abs(tone) > 0.1 ? this.calculateTilt(tone) : null;
      this.lastTone = tone;
    }

    let processed = sample;

    // Stage 1: Input filtering (using cached coefficients)
    if (this.cachedLowCutCoeffs) {
      processed = this.applyBiquadFilter(processed, state.lowCutFilter, this.cachedLowCutCoeffs);
    }
    if (this.cachedHighCutCoeffs) {
      processed = this.applyBiquadFilter(processed, state.highCutFilter, this.cachedHighCutCoeffs);
    }
    if (this.cachedTiltCoeffs) {
      processed = this.applyBiquadFilter(processed, state.tiltFilter, this.cachedTiltCoeffs);
    }

    // Stage 2: Pre-emphasis
    processed = processed + state.history[0] * 0.15;

    // Stage 3: Frequency-dependent saturation
    const saturationConfig = this.getSaturationConfig(this.saturationMode);

    // Stage 4: Multi-stage saturation with oversampling
    for (let i = 0; i < this.oversample; i++) {
      let driven = processed * drive * (1 + headroom / 12);

      // Apply saturation curve based on mode
      if (driven > saturationConfig.threshold) {
        driven = saturationConfig.threshold + (driven - saturationConfig.threshold) * saturationConfig.softness;
      } else if (driven < -saturationConfig.threshold * 0.9) {
        driven = -saturationConfig.threshold * 0.9 + (driven + saturationConfig.threshold * 0.9) * saturationConfig.softness * 1.1;
      }

      processed = this.tubeSaturate(driven, this.frequencyMode);
    }

    // Stage 5: Add harmonics based on saturation mode
    processed = this.addHarmonics(processed, drive, saturationConfig.harmonicType);

    // Stage 6: DC blocker
    processed = this.dcBlock(processed, state.dcBlocker);

    // Stage 7: Auto-compensated output level
    if (autoGain > 0.5) {
      const compensation = 0.7 / Math.sqrt(drive);
      processed *= compensation;
    } else {
      processed *= 0.7;
    }

    // Update history
    state.history[3] = state.history[2];
    state.history[2] = state.history[1];
    state.history[1] = state.history[0];
    state.history[0] = sample;

    return processed;
  }

  tubeSaturate(x, frequencyMode = 'wide') {
    const sign = Math.sign(x);
    const abs = Math.abs(x);

    // Frequency-dependent saturation curves
    let threshold1 = 0.33, threshold2 = 0.66;
    switch (frequencyMode) {
      case 'transformer': // More bass saturation
        threshold1 = 0.3;
        threshold2 = 0.6;
        break;
      case 'tape': // More high-end saturation
        threshold1 = 0.36;
        threshold2 = 0.7;
        break;
      default: // 'wide' - flat response
        threshold1 = 0.33;
        threshold2 = 0.66;
    }

    if (abs < threshold1) {
      return x;
    } else if (abs < threshold2) {
      return sign * (1 - Math.pow(2 - 3 * abs, 2) / 3);
    } else {
      return sign * 0.9;
    }
  }

  addHarmonics(sample, drive, harmonicType = 'even') {
    const harmonic2 = sample * sample * 0.1 * drive;
    const harmonic3 = sample * sample * sample * 0.05 * drive;

    switch (harmonicType) {
      case 'even': // Toasty - warm, musical
        return sample + harmonic2 * 1.2 + harmonic3 * 0.3;
      case 'odd': // Crunchy - aggressive
        return sample + harmonic2 * 0.5 + harmonic3 * 1.5;
      case 'mixed': // Distress - compressed
        return sample + harmonic2 * 0.8 + harmonic3 * 0.8;
      default:
        return sample + harmonic2 + harmonic3;
    }
  }

  getSaturationConfig(mode) {
    const configs = {
      toasty: {
        threshold: 0.7,
        softness: 0.3,
        harmonicType: 'even'
      },
      crunchy: {
        threshold: 0.5,
        softness: 0.15,
        harmonicType: 'odd'
      },
      distress: {
        threshold: 0.3,
        softness: 0.4,
        harmonicType: 'mixed'
      }
    };
    return configs[mode] || configs.toasty;
  }

  // Utility functions
  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  dcBlock(sample, state) {
    const R = 0.995;
    const output = sample - state.x1 + R * state.y1;
    state.x1 = sample;
    state.y1 = output;
    return output;
  }

  // Biquad filter calculations
  calculateHighpass(freq) {
    const omega = 2 * Math.PI * freq / this.sampleRate;
    const sn = Math.sin(omega);
    const cs = Math.cos(omega);
    const Q = 0.707; // Butterworth response
    const alpha = sn / (2 * Q);

    const b0 = (1 + cs) / 2;
    const b1 = -(1 + cs);
    const b2 = (1 + cs) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cs;
    const a2 = 1 - alpha;

    return { b0: b0/a0, b1: b1/a0, b2: b2/a0, a1: a1/a0, a2: a2/a0 };
  }

  calculateLowpass(freq) {
    const omega = 2 * Math.PI * freq / this.sampleRate;
    const sn = Math.sin(omega);
    const cs = Math.cos(omega);
    const Q = 0.707;
    const alpha = sn / (2 * Q);

    const b0 = (1 - cs) / 2;
    const b1 = 1 - cs;
    const b2 = (1 - cs) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cs;
    const a2 = 1 - alpha;

    return { b0: b0/a0, b1: b1/a0, b2: b2/a0, a1: a1/a0, a2: a2/a0 };
  }

  calculateTilt(gain) {
    // Tilt EQ: Pivots around 1kHz
    // Positive gain: boost highs, cut lows (brighten)
    // Negative gain: cut highs, boost lows (darken)

    const pivotFreq = 1000; // Pivot point at 1kHz
    const omega = 2 * Math.PI * pivotFreq / this.sampleRate;
    const sn = Math.sin(omega);
    const cs = Math.cos(omega);

    // Use low-shelf formula but invert for tilt behavior
    const A = Math.pow(10, Math.abs(gain) / 40);
    const Q = 0.707; // Butterworth Q
    const alpha = sn / (2 * Q);

    let b0, b1, b2, a0, a1, a2;

    if (gain >= 0) {
      // Positive: High-shelf boost (brighten)
      b0 = A * ((A + 1) + (A - 1) * cs + 2 * Math.sqrt(A) * alpha);
      b1 = -2 * A * ((A - 1) + (A + 1) * cs);
      b2 = A * ((A + 1) + (A - 1) * cs - 2 * Math.sqrt(A) * alpha);
      a0 = (A + 1) - (A - 1) * cs + 2 * Math.sqrt(A) * alpha;
      a1 = 2 * ((A - 1) - (A + 1) * cs);
      a2 = (A + 1) - (A - 1) * cs - 2 * Math.sqrt(A) * alpha;
    } else {
      // Negative: Low-shelf boost (darken)
      b0 = A * ((A + 1) - (A - 1) * cs + 2 * Math.sqrt(A) * alpha);
      b1 = 2 * A * ((A - 1) - (A + 1) * cs);
      b2 = A * ((A + 1) - (A - 1) * cs - 2 * Math.sqrt(A) * alpha);
      a0 = (A + 1) + (A - 1) * cs + 2 * Math.sqrt(A) * alpha;
      a1 = -2 * ((A - 1) + (A + 1) * cs);
      a2 = (A + 1) + (A - 1) * cs - 2 * Math.sqrt(A) * alpha;
    }

    return { b0: b0/a0, b1: b1/a0, b2: b2/a0, a1: a1/a0, a2: a2/a0 };
  }

  applyBiquadFilter(sample, filterState, coeffs) {
    // Direct Form II Transposed implementation
    const y = coeffs.b0 * sample + filterState.x1;

    filterState.x1 = coeffs.b1 * sample - coeffs.a1 * y + filterState.x2;
    filterState.x2 = coeffs.b2 * sample - coeffs.a2 * y;

    // Safety check for NaN/Infinity
    if (!isFinite(y)) {
      filterState.x1 = 0;
      filterState.x2 = 0;
      return sample;
    }

    return y;
  }

  resetState() {
    this.channelState.forEach(state => {
      state.history.fill(0);
      state.dcBlocker.x1 = 0;
      state.dcBlocker.y1 = 0;

      // Reset filters
      if (state.lowCutFilter) {
        state.lowCutFilter.x1 = state.lowCutFilter.x2 = 0;
      }
      if (state.highCutFilter) {
        state.highCutFilter.x1 = state.highCutFilter.x2 = 0;
      }
      if (state.tiltFilter) {
        state.tiltFilter.x1 = state.tiltFilter.x2 = 0;
      }
    });
  }
}

registerProcessor('saturator-processor', SaturatorProcessor);
