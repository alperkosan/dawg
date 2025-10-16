/**
 * StardustChorus Processor
 * Lush chorus effect with multiple modulated delay lines
 */

class StardustChorusProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 1.5, minValue: 0.1, maxValue: 10 },
      { name: 'depth', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'voices', defaultValue: 3, minValue: 1, maxValue: 5 },
      { name: 'stereoWidth', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'wet', defaultValue: 0.5, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'StardustChorus';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    const maxDelayMs = 50;
    const bufferSize = Math.ceil((maxDelayMs / 1000) * this.sampleRate);

    this.channelState = [
      {
        buffer: new Float32Array(bufferSize),
        writeIndex: 0,
        lfoPhases: [0, 0.2, 0.4, 0.6, 0.8] // Offset phases for 5 voices
      },
      {
        buffer: new Float32Array(bufferSize),
        writeIndex: 0,
        lfoPhases: [0.1, 0.3, 0.5, 0.7, 0.9] // Different offsets for stereo width
      }
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

  processEffect(sample, channel, parameters) {
    const rate = this.getParam(parameters.rate, 0) || 1.5;
    const depth = this.getParam(parameters.depth, 0) || 0.5;
    const voices = Math.floor(this.getParam(parameters.voices, 0) || 3);
    const stereoWidth = this.getParam(parameters.stereoWidth, 0) || 0.5;

    const state = this.channelState[channel];
    const buffer = state.buffer;
    const bufferLength = buffer.length;

    // Write input to delay buffer
    buffer[state.writeIndex] = sample;
    state.writeIndex = (state.writeIndex + 1) % bufferLength;

    // Sum multiple chorus voices
    let chorusSum = 0;
    const baseDelayMs = 20; // Base delay time
    const modulationMs = 15; // Max modulation depth

    for (let v = 0; v < voices; v++) {
      // Update LFO phase
      const lfoIncrement = (rate / this.sampleRate) * 2 * Math.PI;
      state.lfoPhases[v] += lfoIncrement;
      if (state.lfoPhases[v] > 2 * Math.PI) {
        state.lfoPhases[v] -= 2 * Math.PI;
      }

      // Calculate modulated delay time
      const lfoValue = Math.sin(state.lfoPhases[v]);
      const delayMs = baseDelayMs + (lfoValue * modulationMs * depth);
      const delaySamples = (delayMs / 1000) * this.sampleRate;

      // Read from delay buffer with interpolation
      const readPos = state.writeIndex - delaySamples;
      const readIndex1 = Math.floor(readPos);
      const readIndex2 = readIndex1 + 1;
      const frac = readPos - readIndex1;

      const idx1 = (readIndex1 + bufferLength) % bufferLength;
      const idx2 = (readIndex2 + bufferLength) % bufferLength;

      const sample1 = buffer[idx1];
      const sample2 = buffer[idx2];
      const delayedSample = sample1 + (sample2 - sample1) * frac;

      // Pan voices for stereo width
      const pan = (v / Math.max(voices - 1, 1)) - 0.5; // -0.5 to 0.5
      const channelGain = channel === 0 ?
        1 - (pan * stereoWidth) :
        1 + (pan * stereoWidth);

      chorusSum += delayedSample * channelGain;
    }

    return chorusSum / voices;
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
                (this.settings.wet !== undefined ? this.settings.wet : 0.5);
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

registerProcessor('stardust-chorus-processor', StardustChorusProcessor);
