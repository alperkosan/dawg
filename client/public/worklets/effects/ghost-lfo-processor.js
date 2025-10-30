/**
 * GhostLFO Processor
 * Modulation effect with complex LFO patterns
 */

class GhostLFOProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 0.5, minValue: 0.01, maxValue: 20 },
      { name: 'stretch', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'atmosphere', defaultValue: 0.3, minValue: 0, maxValue: 1 },
      { name: 'glitch', defaultValue: 0.1, minValue: 0, maxValue: 1 },
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'GhostLFO';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    const maxDelay = 0.1; // 100ms
    const bufferSize = Math.ceil(maxDelay * this.sampleRate);

    this.channelState = [
      {
        buffer: new Float32Array(bufferSize),
        writeIndex: 0,
        lfoPhase: 0,
        lfo2Phase: 0,
        randomPhase: 0
      },
      {
        buffer: new Float32Array(bufferSize),
        writeIndex: 0,
        lfoPhase: Math.PI / 4, // Offset for stereo
        lfo2Phase: Math.PI / 3,
        randomPhase: 0
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

  // Perlin-like smooth noise
  smoothNoise(phase) {
    const i = Math.floor(phase);
    const f = phase - i;
    const u = f * f * (3 - 2 * f); // Smoothstep

    const hash = (n) => {
      n = (n << 13) ^ n;
      return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 2147483648.0;
    };

    return hash(i) * (1 - u) + hash(i + 1) * u;
  }

  processEffect(sample, channel, sampleIndex, parameters) {
    const rate = this.getParam(parameters.rate, sampleIndex) || 0.5;
    const stretch = this.getParam(parameters.stretch, sampleIndex) || 0.5;
    const atmosphere = this.getParam(parameters.atmosphere, sampleIndex) || 0.3;
    const glitch = this.getParam(parameters.glitch, sampleIndex) || 0.1;

    const state = this.channelState[channel];
    const buffer = state.buffer;
    const bufferLength = buffer.length;

    // Write input
    buffer[state.writeIndex] = sample;
    state.writeIndex = (state.writeIndex + 1) % bufferLength;

    // Primary LFO
    const lfoIncrement = (rate / this.sampleRate) * 2 * Math.PI;
    state.lfoPhase += lfoIncrement;
    if (state.lfoPhase > 2 * Math.PI) state.lfoPhase -= 2 * Math.PI;

    // Secondary LFO (slower, for modulation)
    const lfo2Rate = rate * (0.2 + stretch * 0.3);
    const lfo2Increment = (lfo2Rate / this.sampleRate) * 2 * Math.PI;
    state.lfo2Phase += lfo2Increment;
    if (state.lfo2Phase > 2 * Math.PI) state.lfo2Phase -= 2 * Math.PI;

    // Complex LFO shape with stretch parameter
    let lfo1 = Math.sin(state.lfoPhase);
    const lfo2 = Math.sin(state.lfo2Phase);

    // Stretch effect: modulate LFO1 with LFO2
    lfo1 = Math.sin(state.lfoPhase + lfo2 * stretch * Math.PI);

    // Add atmosphere (smooth random modulation)
    state.randomPhase += 0.001;
    const randomMod = this.smoothNoise(state.randomPhase * 100) * 2 - 1;
    const atmosphereMod = randomMod * atmosphere * 0.3;

    // 🎯 PROFESSIONAL GLITCH: Deterministic pseudo-random (sample-accurate)
    // Use deterministic random for reproducible, musical glitches
    const glitchSeed = (state.writeIndex * 7919 + channel * 9973) % 1000000;
    let glitchMod = 0;
    
    if ((glitchSeed % 1000) < glitch * 10) {
      // Deterministic glitch amount based on seed
      glitchMod = ((glitchSeed % 2000) / 1000 - 1) * 0.5;
    }

    // Combine modulations
    const totalMod = lfo1 * 0.5 + atmosphereMod + glitchMod;

    // Calculate modulated delay time (5-50ms)
    const baseDelay = 0.02; // 20ms
    const modulationRange = 0.03; // ±30ms
    const delayMs = baseDelay + totalMod * modulationRange;
    const delaySamples = Math.floor(delayMs * this.sampleRate);

    // Read from buffer with interpolation
    const readPos = state.writeIndex - delaySamples;
    const readIndex1 = (readPos + bufferLength) % bufferLength;
    const readIndex2 = (readIndex1 + 1) % bufferLength;

    const sample1 = buffer[readIndex1];
    const sample2 = buffer[readIndex2];
    const modulatedSample = sample1; // Simple read for now

    // Add feedback for atmosphere
    const feedback = atmosphere * 0.3;
    buffer[state.writeIndex] = sample + modulatedSample * feedback;

    return modulatedSample;
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

registerProcessor('ghost-lfo-processor', GhostLFOProcessor);
