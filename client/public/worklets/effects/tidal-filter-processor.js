/**
 * TidalFilter Processor
 * State-variable filter with resonance and filter type morphing
 */

class TidalFilterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'cutoff', defaultValue: 1000, minValue: 20, maxValue: 20000 },
      { name: 'resonance', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'filterType', defaultValue: 0, minValue: 0, maxValue: 1 }, // 0=lowpass, 0.5=bandpass, 1=highpass
      { name: 'drive', defaultValue: 1.0, minValue: 1, maxValue: 10 },
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'TidalFilter';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    this.channelState = [
      { low: 0, band: 0, high: 0, notch: 0 },
      { low: 0, band: 0, high: 0, notch: 0 }
    ];

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

  processEffect(sample, channel, sampleIndex, parameters) {
    const cutoff = this.getParam(parameters.cutoff, sampleIndex) || 1000;
    const resonance = this.getParam(parameters.resonance, sampleIndex) || 0.5;
    const filterType = this.getParam(parameters.filterType, sampleIndex) || 0;
    const drive = this.getParam(parameters.drive, sampleIndex) || 1.0;

    const state = this.channelState[channel];

    // Apply drive (soft saturation)
    let driven = sample * drive;
    if (Math.abs(driven) > 1) {
      driven = Math.sign(driven) * (1 - Math.exp(-Math.abs(driven)));
    }

    // State-variable filter
    const f = 2 * Math.sin(Math.PI * cutoff / this.sampleRate);
    const q = 1 - (resonance * 0.95); // Map resonance to Q (0.05 to 1)

    state.low += f * state.band;
    state.high = driven - state.low - q * state.band;
    state.band += f * state.high;
    state.notch = state.high + state.low;

    // Morphing between filter types
    let output;
    if (filterType <= 0.33) {
      // Lowpass to Bandpass morph
      const mix = filterType * 3;
      output = state.low * (1 - mix) + state.band * mix;
    } else if (filterType <= 0.66) {
      // Bandpass to Highpass morph
      const mix = (filterType - 0.33) * 3;
      output = state.band * (1 - mix) + state.high * mix;
    } else {
      // Highpass to Notch morph
      const mix = (filterType - 0.66) * 3;
      output = state.high * (1 - mix) + state.notch * mix;
    }

    return output * 0.5; // Compensate for resonance boost
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length || this.bypassed) {
      if (output && output.length) {
        for (let channel = 0; channel < output.length; channel++) {
          output[channel].set(input?.[channel] || new Float32Array(128));
        }
      }
      return true;
    }

    const wetParam = this.getParam(parameters.wet, 0);
    const wet = wetParam !== undefined ? wetParam :
                (this.settings.wet !== undefined ? this.settings.wet : 1.0);
    const dry = 1 - wet;

    for (let channel = 0; channel < output.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      for (let i = 0; i < inputChannel.length; i++) {
        const inputSample = inputChannel[i];
        const processedSample = this.processEffect(inputSample, channel, i, parameters);
        outputChannel[i] = dry * inputSample + wet * processedSample;
      }
    }

    return true;
  }
}

registerProcessor('tidal-filter-processor', TidalFilterProcessor);
