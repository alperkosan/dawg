/**
 * ArcadeCrusher Processor
 * Bit crusher with sample rate reduction and quantization
 */

class ArcadeCrusherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bitDepth', defaultValue: 8, minValue: 1, maxValue: 16 },
      { name: 'sampleRateReduction', defaultValue: 1, minValue: 1, maxValue: 50 },
      { name: 'crush', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'ArcadeCrusher';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    this.channelState = [
      { holdSample: 0, phaseAccum: 0 },
      { holdSample: 0, phaseAccum: 0 }
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

  quantize(sample, bits) {
    const levels = Math.pow(2, bits);
    const step = 2 / levels;
    return Math.floor(sample / step) * step;
  }

  processEffect(sample, channel, parameters) {
    const bitDepth = Math.floor(this.getParam(parameters.bitDepth, 0) || 8);
    const sampleRateReduction = Math.floor(this.getParam(parameters.sampleRateReduction, 0) || 1);
    const crush = this.getParam(parameters.crush, 0) || 0.5;

    const state = this.channelState[channel];

    // Sample rate reduction (sample & hold)
    state.phaseAccum++;
    if (state.phaseAccum >= sampleRateReduction) {
      state.holdSample = sample;
      state.phaseAccum = 0;
    }

    let processed = state.holdSample;

    // Bit depth reduction
    processed = this.quantize(processed, bitDepth);

    // Additional crushing (distortion)
    if (crush > 0) {
      const crushAmount = crush * 5;
      processed = Math.sign(processed) * Math.pow(Math.abs(processed), 1 / (1 + crushAmount));
    }

    return processed;
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

registerProcessor('arcade-crusher-processor', ArcadeCrusherProcessor);
