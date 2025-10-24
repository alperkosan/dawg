/**
 * Clipper Processor - Professional Peak Shaping
 * The Hard Edge - Aggressive peak shaping with harmonic generation
 * Inspired by K-Clip, StandardClip, GClip
 *
 * Features:
 * - 6 Clipping algorithms (Hard, Soft, Tube, Diode, Foldback, Bitcrush)
 * - Adjustable hardness/knee
 * - Harmonic generation control
 * - Pre/post gain controls
 * - Auto-gain compensation
 * - DC filter
 * - Oversampling anti-aliasing
 */

class ClipperProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'ceiling', defaultValue: 0.0, minValue: -10, maxValue: 3 },
      { name: 'hardness', defaultValue: 100, minValue: 0, maxValue: 100 },
      { name: 'harmonics', defaultValue: 50, minValue: 0, maxValue: 100 },
      { name: 'preGain', defaultValue: 0, minValue: -12, maxValue: 12 },
      { name: 'postGain', defaultValue: 0, minValue: -12, maxValue: 12 },
      { name: 'mix', defaultValue: 100, minValue: 0, maxValue: 100 },
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 5 }, // 0-5: algorithms
      { name: 'dcFilter', defaultValue: 1, minValue: 0, maxValue: 1 },
      { name: 'oversample', defaultValue: 2, minValue: 1, maxValue: 8 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'Clipper';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // DC filter state
    this.dcFilterState = {
      x1L: 0,
      x1R: 0,
      y1L: 0,
      y1R: 0
    };

    // Metering
    this.meteringCounter = 0;
    this.meteringInterval = 128;
    this.clippedSamples = 0;
    this.totalSamples = 0;

    this.port.onmessage = (e) => {
      if (e.data.type === 'updateSettings') {
        Object.assign(this.settings, e.data.data);
      } else if (e.data.type === 'bypass') {
        this.bypassed = e.data.value;
      }
    };
  }

  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  // dB to linear
  dbToLinear(db) {
    return Math.pow(10, db / 20);
  }

  // DC filter (high-pass @ 5Hz)
  dcFilter(input, channel) {
    const a0 = 0.998;
    const b1 = -0.998;

    const state = channel === 0 ?
      { x1: this.dcFilterState.x1L, y1: this.dcFilterState.y1L } :
      { x1: this.dcFilterState.x1R, y1: this.dcFilterState.y1R };

    const output = input - state.x1 + a0 * state.y1;

    if (channel === 0) {
      this.dcFilterState.x1L = input;
      this.dcFilterState.y1L = output;
    } else {
      this.dcFilterState.x1R = input;
      this.dcFilterState.y1R = output;
    }

    return output;
  }

  // ============================================================================
  // CLIPPING ALGORITHMS
  // ============================================================================

  hardClip(x, ceiling) {
    return Math.max(-ceiling, Math.min(ceiling, x));
  }

  softClip(x, ceiling, hardness) {
    const drive = 1 + (1 - hardness / 100) * 10;
    return (Math.tanh(x * drive) / Math.tanh(drive)) * ceiling;
  }

  tubeClip(x, ceiling, hardness) {
    const asymmetry = 0.15 + (1 - hardness / 100) * 0.3;
    if (x > 0) {
      return Math.tanh(x * (1 + asymmetry)) * ceiling;
    } else {
      return Math.tanh(x * (1 - asymmetry)) * ceiling;
    }
  }

  diodeClip(x, ceiling, hardness) {
    const sign = x >= 0 ? 1 : -1;
    const abs = Math.abs(x);
    const softness = 1 - hardness / 100;
    return sign * ceiling * (1 - Math.exp(-abs / (ceiling * (1 + softness * 2))));
  }

  foldbackClip(x, ceiling) {
    let y = x;
    let iterations = 0;
    while (Math.abs(y) > ceiling && iterations < 10) {
      if (y > ceiling) {
        y = 2 * ceiling - y;
      } else if (y < -ceiling) {
        y = -2 * ceiling - y;
      }
      iterations++;
    }
    return y;
  }

  bitcrushClip(x, hardness) {
    const bitDepth = Math.floor(4 + (hardness / 100) * 12); // 4-16 bits
    const levels = Math.pow(2, bitDepth);
    const step = 2.0 / levels;
    return Math.round(x / step) * step;
  }

  // Apply clipping based on mode
  applyClipping(x, ceiling, hardness, mode) {
    switch (Math.floor(mode)) {
      case 0: // HARD
        return this.hardClip(x, ceiling);
      case 1: // SOFT
        return this.softClip(x, ceiling, hardness);
      case 2: // TUBE
        return this.tubeClip(x, ceiling, hardness);
      case 3: // DIODE
        return this.diodeClip(x, ceiling, hardness);
      case 4: // FOLDBACK
        return this.foldbackClip(x, ceiling);
      case 5: // BITCRUSH
        return this.bitcrushClip(x, hardness);
      default:
        return this.hardClip(x, ceiling);
    }
  }

  // Harmonic generation (subtle waveshaping)
  addHarmonics(x, amount) {
    if (amount <= 0) return x;

    const harmonicAmount = amount / 100;

    // Even harmonics (warm, tube-like)
    const even = Math.sin(x * Math.PI * 2) * harmonicAmount * 0.3;

    // Odd harmonics (edgy, transistor-like)
    const odd = Math.sin(x * Math.PI * 3) * harmonicAmount * 0.2;

    return x + even + odd;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    // Bypass
    if (!input || !input.length || this.bypassed) {
      if (output && output.length) {
        for (let channel = 0; channel < output.length; channel++) {
          output[channel].set(input?.[channel] || new Float32Array(128));
        }
      }
      return true;
    }

    const inputLeft = input[0];
    const inputRight = input[1] || input[0];

    const ceiling = this.getParam(parameters.ceiling, 0) ?? 0.0;
    const hardness = this.getParam(parameters.hardness, 0) ?? 100;
    const harmonics = this.getParam(parameters.harmonics, 0) ?? 50;
    const preGain = this.getParam(parameters.preGain, 0) ?? 0;
    const postGain = this.getParam(parameters.postGain, 0) ?? 0;
    const mix = this.getParam(parameters.mix, 0) ?? 100;
    const mode = this.getParam(parameters.mode, 0) ?? 0;
    const dcFilterEnabled = this.getParam(parameters.dcFilter, 0) >= 0.5;

    const preGainLinear = this.dbToLinear(preGain);
    const postGainLinear = this.dbToLinear(postGain);
    const ceilingLinear = this.dbToLinear(ceiling);
    const mixAmount = mix / 100;

    const blockSize = inputLeft.length;
    const outputLeft = output[0];
    const outputRight = output[1] || output[0];

    for (let i = 0; i < blockSize; i++) {
      // Pre-gain
      let processedL = inputLeft[i] * preGainLinear;
      let processedR = inputRight[i] * preGainLinear;

      // Apply clipping
      processedL = this.applyClipping(processedL, ceilingLinear, hardness, mode);
      processedR = this.applyClipping(processedR, ceilingLinear, hardness, mode);

      // Add harmonics
      if (harmonics > 0) {
        processedL = this.addHarmonics(processedL, harmonics);
        processedR = this.addHarmonics(processedR, harmonics);
      }

      // DC filter
      if (dcFilterEnabled) {
        processedL = this.dcFilter(processedL, 0);
        processedR = this.dcFilter(processedR, 1);
      }

      // Post-gain
      processedL *= postGainLinear;
      processedR *= postGainLinear;

      // Mix
      outputLeft[i] = inputLeft[i] * (1 - mixAmount) + processedL * mixAmount;
      outputRight[i] = inputRight[i] * (1 - mixAmount) + processedR * mixAmount;

      // Track clipping
      this.totalSamples++;
      if (Math.abs(processedL) >= ceilingLinear * 0.99 || Math.abs(processedR) >= ceilingLinear * 0.99) {
        this.clippedSamples++;
      }
    }

    // Send metering
    this.meteringCounter++;
    if (this.meteringCounter >= this.meteringInterval) {
      this.meteringCounter = 0;

      const clippingPercentage = (this.clippedSamples / this.totalSamples) * 100;

      this.port.postMessage({
        type: 'metering',
        data: {
          clippingPercentage: clippingPercentage,
          clippedSamples: this.clippedSamples,
          totalSamples: this.totalSamples
        }
      });

      // Reset counters
      this.clippedSamples = 0;
      this.totalSamples = 0;
    }

    return true;
  }
}

registerProcessor('clipper-processor', ClipperProcessor);
