/**
 * PitchShifter Processor
 * Real-time pitch shifting using time-domain technique
 */

class PitchShifterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'pitch', defaultValue: 0, minValue: -12, maxValue: 12 }, // semitones
      { name: 'windowSize', defaultValue: 0.1, minValue: 0.01, maxValue: 0.4 },
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'PitchShifter';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    const maxWindowSize = 0.4; // 400ms
    const bufferSize = Math.ceil(maxWindowSize * this.sampleRate);

    this.channelState = [
      {
        buffer: new Float32Array(bufferSize),
        writeIndex: 0,
        readIndex: 0,
        crossfadeBuffer: new Float32Array(bufferSize),
        crossfadeIndex: 0,
        grainPhase: 0
      },
      {
        buffer: new Float32Array(bufferSize),
        writeIndex: 0,
        readIndex: 0,
        crossfadeBuffer: new Float32Array(bufferSize),
        crossfadeIndex: 0,
        grainPhase: 0
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
    const pitch = this.getParam(parameters.pitch, 0) || 0;
    const windowSize = this.getParam(parameters.windowSize, 0) || 0.1;

    const state = this.channelState[channel];
    const buffer = state.buffer;
    const bufferLength = buffer.length;

    // Write input to circular buffer
    buffer[state.writeIndex] = sample;
    state.writeIndex = (state.writeIndex + 1) % bufferLength;

    // Calculate pitch ratio (2^(semitones/12))
    const pitchRatio = Math.pow(2, pitch / 12);

    // Window size in samples
    const windowSamples = Math.floor(windowSize * this.sampleRate);
    const halfWindow = Math.floor(windowSamples / 2);

    // Grain-based pitch shifting
    state.grainPhase += pitchRatio;

    if (state.grainPhase >= windowSamples) {
      state.grainPhase = 0;
      state.readIndex = (state.writeIndex - windowSamples + bufferLength) % bufferLength;
    }

    // Read from buffer with pitch ratio
    const readPos = (state.readIndex + state.grainPhase) % bufferLength;
    const readIndex1 = Math.floor(readPos);
    const readIndex2 = (readIndex1 + 1) % bufferLength;
    const frac = readPos - readIndex1;

    const sample1 = buffer[readIndex1];
    const sample2 = buffer[readIndex2];
    let shiftedSample = sample1 + (sample2 - sample1) * frac;

    // Apply Hann window for smooth grains
    const windowPos = state.grainPhase / windowSamples;
    const windowGain = 0.5 * (1 - Math.cos(2 * Math.PI * windowPos));
    shiftedSample *= windowGain;

    return shiftedSample;
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

registerProcessor('pitch-shifter-processor', PitchShifterProcessor);
