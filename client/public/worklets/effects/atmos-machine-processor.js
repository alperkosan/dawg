/**
 * AtmosMachine Processor
 * Atmospheric texture generator with granular processing
 */

class AtmosMachineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'size', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'movement', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'character', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'stereoWidth', defaultValue: 0.7, minValue: 0, maxValue: 1 },
      { name: 'wet', defaultValue: 0.5, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'AtmosMachine';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    const bufferSize = this.sampleRate * 2; // 2 second buffer

    this.channelState = [
      {
        buffer: new Float32Array(bufferSize),
        writeIndex: 0,
        grains: this.createGrains(4),
        reverb: this.createReverbState()
      },
      {
        buffer: new Float32Array(bufferSize),
        writeIndex: 0,
        grains: this.createGrains(4),
        reverb: this.createReverbState()
      }
    ];

    this.lfoPhase = 0;

    this.port.onmessage = (e) => {
      if (e.data.type === 'updateSettings') {
        Object.assign(this.settings, e.data.data);
      } else if (e.data.type === 'bypass') {
        this.bypassed = e.data.value;
      }
    };
  }

  createGrains(count) {
    const grains = [];
    for (let i = 0; i < count; i++) {
      grains.push({
        position: Math.random(),
        phase: 0,
        active: false,
        duration: 0,
        pan: Math.random() * 2 - 1
      });
    }
    return grains;
  }

  createReverbState() {
    return {
      combFilters: [
        { buffer: new Float32Array(1557), index: 0 },
        { buffer: new Float32Array(1617), index: 0 },
        { buffer: new Float32Array(1491), index: 0 },
        { buffer: new Float32Array(1422), index: 0 }
      ],
      dampingState: 0
    };
  }

  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  processEffect(sample, channel, sampleIndex, parameters) {
    const size = this.getParam(parameters.size, sampleIndex) || 0.5;
    const movement = this.getParam(parameters.movement, sampleIndex) || 0.5;
    const character = this.getParam(parameters.character, sampleIndex) || 0.5;
    const stereoWidth = this.getParam(parameters.stereoWidth, sampleIndex) || 0.7;

    const state = this.channelState[channel];
    const buffer = state.buffer;
    const bufferLength = buffer.length;

    // Write to buffer
    buffer[state.writeIndex] = sample;
    state.writeIndex = (state.writeIndex + 1) % bufferLength;

    // Update LFO for movement
    this.lfoPhase += (movement * 0.001 + 0.0001);
    if (this.lfoPhase > 2 * Math.PI) this.lfoPhase -= 2 * Math.PI;

    // Granular synthesis
    let grainOutput = 0;
    const grainDuration = Math.floor((size * 0.4 + 0.05) * this.sampleRate); // 50-450ms

    state.grains.forEach((grain, i) => {
      if (!grain.active) {
        // Trigger new grain randomly based on density
        if (Math.random() < 0.02) {
          grain.active = true;
          grain.phase = 0;
          grain.position = Math.random();
          grain.duration = grainDuration;
          grain.pan = (Math.random() * 2 - 1) * stereoWidth;
        }
      }

      if (grain.active) {
        // Calculate read position with LFO modulation
        const lfoMod = Math.sin(this.lfoPhase + i * Math.PI / 2) * movement * 0.1;
        const readOffset = Math.floor((grain.position + lfoMod) * bufferLength);
        const readPos = (state.writeIndex - readOffset + bufferLength) % bufferLength;

        // Read sample
        let grainSample = buffer[readPos];

        // Apply grain envelope (Hann window)
        const envPos = grain.phase / grain.duration;
        const envelope = 0.5 * (1 - Math.cos(2 * Math.PI * envPos));
        grainSample *= envelope;

        // Apply character (filtering)
        if (character < 0.5) {
          // Low-pass for dark character
          grainSample = grainSample * (character * 2);
        } else {
          // High-pass for bright character
          const hpAmount = (character - 0.5) * 2;
          grainSample = grainSample * (1 - hpAmount * 0.5);
        }

        // Apply stereo pan
        const channelGain = channel === 0 ?
          (1 - grain.pan) * 0.5 :
          (1 + grain.pan) * 0.5;
        grainOutput += grainSample * channelGain;

        grain.phase++;
        if (grain.phase >= grain.duration) {
          grain.active = false;
        }
      }
    });

    // Add subtle reverb
    const reverbState = state.reverb;
    let reverbOut = 0;
    const feedback = 0.7;

    reverbState.combFilters.forEach(comb => {
      const delayed = comb.buffer[comb.index];
      reverbState.dampingState = 0.3 * reverbState.dampingState + 0.7 * delayed;
      comb.buffer[comb.index] = grainOutput + reverbState.dampingState * feedback;
      comb.index = (comb.index + 1) % comb.buffer.length;
      reverbOut += delayed;
    });

    return (grainOutput * 0.5 + reverbOut * 0.15) * 0.7;
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
        const processedSample = this.processEffect(inputSample, channel, i, parameters);
        outputChannel[i] = dry * inputSample + wet * processedSample;
      }
    }

    return true;
  }
}

registerProcessor('atmos-machine-processor', AtmosMachineProcessor);
