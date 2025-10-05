/**
 * SATURATOR PROCESSOR
 *
 * Multi-stage tube saturation effect
 * Adds analog warmth and harmonic distortion
 */

class SaturatorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'distortion', defaultValue: 0.4, minValue: 0, maxValue: 1.5 },  // Maps to UI's distortion param
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
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
    // Map distortion (0-1) to drive (1-10) for internal processing
    const distortion = this.getParam(parameters.distortion, sampleIndex) || 0.4;
    const drive = 1 + distortion * 9;  // 0.0 → 1.0, 1.0 → 10.0

    const state = this.channelState[channel] || this.channelState[0];

    // Stage 1: Pre-emphasis
    let processed = sample + state.history[0] * 0.15;

    // Stage 2: Multi-stage saturation
    for (let i = 0; i < this.oversample; i++) {
      let driven = processed * drive;

      // Soft-knee saturation (asymmetric)
      if (driven > 0.7) {
        driven = 0.7 + (driven - 0.7) * 0.3;
      } else if (driven < -0.6) {
        driven = -0.6 + (driven + 0.6) * 0.35;
      }

      processed = this.tubeSaturate(driven);
    }

    // Stage 3: Add harmonics
    processed = this.addHarmonics(processed, drive);

    // Stage 4: DC blocker
    processed = this.dcBlock(processed, state.dcBlocker);

    // Stage 5: Output level compensation
    processed *= 0.7 / Math.sqrt(drive);

    // Update history
    state.history[3] = state.history[2];
    state.history[2] = state.history[1];
    state.history[1] = state.history[0];
    state.history[0] = sample;

    return processed;
  }

  tubeSaturate(x) {
    const sign = Math.sign(x);
    const abs = Math.abs(x);

    if (abs < 0.33) {
      return x;
    } else if (abs < 0.66) {
      return sign * (1 - Math.pow(2 - 3 * abs, 2) / 3);
    } else {
      return sign * 0.9;
    }
  }

  addHarmonics(sample, drive) {
    const harmonic2 = sample * sample * 0.1 * drive;
    const harmonic3 = sample * sample * sample * 0.05 * drive;
    return sample + harmonic2 + harmonic3;
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

  resetState() {
    this.channelState.forEach(state => {
      state.history.fill(0);
      state.dcBlocker.x1 = 0;
      state.dcBlocker.y1 = 0;
    });
  }
}

registerProcessor('saturator-processor', SaturatorProcessor);
