/**
 * COMPRESSOR PROCESSOR
 *
 * Dynamic range compressor with attack, release, ratio, knee
 * Professional studio-quality compression
 */

class CompressorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -24, minValue: -60, maxValue: 0 },
      { name: 'ratio', defaultValue: 4, minValue: 1, maxValue: 20 },
      { name: 'attack', defaultValue: 0.003, minValue: 0.0001, maxValue: 1 },
      { name: 'release', defaultValue: 0.25, minValue: 0.001, maxValue: 3 },
      { name: 'knee', defaultValue: 30, minValue: 0, maxValue: 40 },
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();

    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'Compressor';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Per-channel state
    this.channelState = [
      {
        envelope: 0,  // Current envelope follower value
        gainReduction: 0  // Current gain reduction in dB
      },
      {
        envelope: 0,
        gainReduction: 0
      }
    ];


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
    const threshold = this.getParam(parameters.threshold, sampleIndex) || this.settings.threshold || -24;
    const ratio = this.getParam(parameters.ratio, sampleIndex) || this.settings.ratio || 4;
    const attack = this.getParam(parameters.attack, sampleIndex) || this.settings.attack || 0.003;
    const release = this.getParam(parameters.release, sampleIndex) || this.settings.release || 0.25;
    const knee = this.getParam(parameters.knee, sampleIndex) || this.settings.knee || 30;

    const state = this.channelState[channel] || this.channelState[0];

    // Convert to dB
    const inputLevel = this.gainToDb(Math.abs(sample));

    // Envelope follower
    const attackCoeff = Math.exp(-1 / (attack * this.sampleRate));
    const releaseCoeff = Math.exp(-1 / (release * this.sampleRate));

    if (inputLevel > state.envelope) {
      state.envelope = attackCoeff * state.envelope + (1 - attackCoeff) * inputLevel;
    } else {
      state.envelope = releaseCoeff * state.envelope + (1 - releaseCoeff) * inputLevel;
    }

    // Calculate gain reduction
    let gainReduction = 0;

    if (knee > 0 && state.envelope > (threshold - knee / 2) && state.envelope < (threshold + knee / 2)) {
      // Soft knee
      const kneeRange = state.envelope - threshold + knee / 2;
      gainReduction = (kneeRange * kneeRange) / (2 * knee) * (1 / ratio - 1);
    } else if (state.envelope > threshold) {
      // Above threshold
      gainReduction = (threshold - state.envelope) * (1 - 1 / ratio);
    }

    state.gainReduction = gainReduction;

    // Apply gain reduction
    const gain = this.dbToGain(gainReduction);
    return sample * gain;
  }

  // Utility functions
  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  gainToDb(gain) {
    return 20 * Math.log10(Math.max(gain, 0.00001));
  }

  dbToGain(db) {
    return Math.pow(10, db / 20);
  }

  resetState() {
    this.channelState.forEach(state => {
      state.envelope = 0;
      state.gainReduction = 0;
    });
  }
}

registerProcessor('compressor-processor', CompressorProcessor);
