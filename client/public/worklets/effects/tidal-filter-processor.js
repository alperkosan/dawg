/**
 * TidalFilter Processor v2.0
 * State-variable filter with smooth filter type morphing
 *
 * Features:
 * - Adjustable cutoff frequency (20Hz - 20kHz)
 * - Resonance control (0-100%)
 * - Morphing filter types (LP → BP → HP → Notch)
 * - Drive with soft saturation
 */

class TidalFilterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'cutoff', defaultValue: 1000, minValue: 20, maxValue: 20000 },
      { name: 'resonance', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'filterType', defaultValue: 0, minValue: 0, maxValue: 1 },
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

    // Per-channel state-variable filter state
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

  // Soft saturation for drive
  softSaturate(x) {
    if (Math.abs(x) < 1) return x;
    return Math.sign(x) * (1 - Math.exp(-Math.abs(x)));
  }

  processEffect(sample, channel, parameters) {
    const cutoff = this.getParam(parameters.cutoff, 0) || 1000;
    const resonance = this.getParam(parameters.resonance, 0) || 0.5;
    const filterType = this.getParam(parameters.filterType, 0) || 0;
    const drive = this.getParam(parameters.drive, 0) || 1.0;

    const state = this.channelState[channel];

    // Apply drive with soft saturation
    let driven = sample * drive;
    if (drive > 1.0) {
      driven = this.softSaturate(driven);
    }

    // State-variable filter coefficients
    const f = 2 * Math.sin(Math.PI * Math.min(cutoff, this.sampleRate / 2.2) / this.sampleRate);
    const q = 1 - (resonance * 0.95); // Map resonance to Q (0.05 to 1)

    // State-variable filter equations
    state.low += f * state.band;
    state.high = driven - state.low - q * state.band;
    state.band += f * state.high;
    state.notch = state.high + state.low;

    // Smooth morphing between filter types
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

    // Compensate for resonance boost
    return output * 0.5;
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
        const processedSample = this.processEffect(inputSample, channel, parameters);
        outputChannel[i] = dry * inputSample + wet * processedSample;
      }
    }

    return true;
  }
}

registerProcessor('tidal-filter-processor', TidalFilterProcessor);
