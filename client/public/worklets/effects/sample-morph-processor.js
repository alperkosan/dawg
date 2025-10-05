/**
 * SampleMorph Processor
 * Granular sample manipulation and morphing
 */

class SampleMorphProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'grainSize', defaultValue: 0.2, minValue: 0.01, maxValue: 1 },
      { name: 'overlap', defaultValue: 0.1, minValue: 0, maxValue: 1 },
      { name: 'randomness', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'retrigger', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'SampleMorph';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    const bufferSize = this.sampleRate * 2; // 2 second buffer

    this.channelState = [
      {
        buffer: new Float32Array(bufferSize),
        writeIndex: 0,
        grainPosition: 0,
        grainPhase: 0,
        activeGrains: []
      },
      {
        buffer: new Float32Array(bufferSize),
        writeIndex: 0,
        grainPosition: 0,
        grainPhase: 0,
        activeGrains: []
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

  processEffect(sample, channel, sampleIndex, parameters) {
    const grainSize = this.getParam(parameters.grainSize, sampleIndex) || 0.2;
    const overlap = this.getParam(parameters.overlap, sampleIndex) || 0.1;
    const randomness = this.getParam(parameters.randomness, sampleIndex) || 0;
    const retrigger = this.getParam(parameters.retrigger, sampleIndex) || 0;

    const state = this.channelState[channel];
    const buffer = state.buffer;
    const bufferLength = buffer.length;

    // Write input to buffer
    buffer[state.writeIndex] = sample;
    state.writeIndex = (state.writeIndex + 1) % bufferLength;

    // Calculate grain parameters
    const grainSizeSamples = Math.floor(grainSize * this.sampleRate);
    const hopSize = Math.floor(grainSizeSamples * (1 - overlap));

    // Trigger new grain
    if (state.grainPhase >= hopSize) {
      state.grainPhase = 0;

      // Calculate grain start position with randomness
      let grainStart = state.grainPosition;
      if (randomness > 0) {
        const randomOffset = (Math.random() * 2 - 1) * randomness * grainSizeSamples;
        grainStart = (grainStart + randomOffset + bufferLength) % bufferLength;
      }

      // Retrigger: jump to recent audio
      if (retrigger > Math.random()) {
        grainStart = (state.writeIndex - Math.floor(0.1 * this.sampleRate) + bufferLength) % bufferLength;
      }

      state.activeGrains.push({
        startPos: grainStart,
        phase: 0,
        size: grainSizeSamples
      });

      state.grainPosition = (state.grainPosition + hopSize) % bufferLength;
    }

    state.grainPhase++;

    // Process active grains
    let output = 0;
    const maxGrains = 8;

    // Remove completed grains
    state.activeGrains = state.activeGrains.filter(grain => grain.phase < grain.size);

    // Limit number of active grains
    if (state.activeGrains.length > maxGrains) {
      state.activeGrains = state.activeGrains.slice(-maxGrains);
    }

    state.activeGrains.forEach(grain => {
      // Read sample from buffer
      const readPos = (grain.startPos + grain.phase) % bufferLength;
      const grainSample = buffer[readPos];

      // Apply Hann window envelope
      const envPos = grain.phase / grain.size;
      const envelope = 0.5 * (1 - Math.cos(2 * Math.PI * envPos));

      output += grainSample * envelope;
      grain.phase++;
    });

    // Normalize by number of grains
    if (state.activeGrains.length > 0) {
      output /= Math.sqrt(state.activeGrains.length);
    }

    return output * 0.7;
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

registerProcessor('sample-morph-processor', SampleMorphProcessor);
