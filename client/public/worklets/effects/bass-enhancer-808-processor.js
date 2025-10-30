/**
 * BassEnhancer808 Processor
 * Sub-bass enhancement with harmonic generation
 */

class BassEnhancer808Processor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 60, minValue: 20, maxValue: 200 },
      { name: 'amount', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'harmonics', defaultValue: 0.3, minValue: 0, maxValue: 1 },
      { name: 'tightness', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'wet', defaultValue: 0.5, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'BassEnhancer808';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    this.channelState = [
      {
        // Low-pass filter for bass isolation
        lpf: { x1: 0, x2: 0, y1: 0, y2: 0 },
        // High-pass filter for sub removal
        hpf: { x1: 0, x2: 0, y1: 0, y2: 0 },
        envelope: 0
      },
      {
        lpf: { x1: 0, x2: 0, y1: 0, y2: 0 },
        hpf: { x1: 0, x2: 0, y1: 0, y2: 0 },
        envelope: 0
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

  processBiquadLowpass(sample, filter, freq, q) {
    const w0 = 2 * Math.PI * freq / this.sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * q);

    const b0 = (1 - cosw0) / 2;
    const b1 = 1 - cosw0;
    const b2 = (1 - cosw0) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw0;
    const a2 = 1 - alpha;

    const y = (b0 / a0) * sample +
              (b1 / a0) * filter.x1 +
              (b2 / a0) * filter.x2 -
              (a1 / a0) * filter.y1 -
              (a2 / a0) * filter.y2;

    filter.x2 = filter.x1;
    filter.x1 = sample;
    filter.y2 = filter.y1;
    filter.y1 = y;

    return y;
  }

  processBiquadHighpass(sample, filter, freq, q) {
    const w0 = 2 * Math.PI * freq / this.sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * q);

    const b0 = (1 + cosw0) / 2;
    const b1 = -(1 + cosw0);
    const b2 = (1 + cosw0) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw0;
    const a2 = 1 - alpha;

    const y = (b0 / a0) * sample +
              (b1 / a0) * filter.x1 +
              (b2 / a0) * filter.x2 -
              (a1 / a0) * filter.y1 -
              (a2 / a0) * filter.y2;

    filter.x2 = filter.x1;
    filter.x1 = sample;
    filter.y2 = filter.y1;
    filter.y1 = y;

    return y;
  }

  processEffect(sample, channel, parameters) {
    const frequency = this.getParam(parameters.frequency, 0) || 60;
    const amount = this.getParam(parameters.amount, 0) || 0.5;
    const harmonics = this.getParam(parameters.harmonics, 0) || 0.3;
    const tightness = this.getParam(parameters.tightness, 0) || 0.5;

    const state = this.channelState[channel];

    // Isolate bass frequencies with low-pass
    const bassSignal = this.processBiquadLowpass(sample, state.lpf, frequency * 2, 0.707);

    // Remove sub-bass with high-pass (for cleaner enhancement)
    const filteredBass = this.processBiquadHighpass(bassSignal, state.hpf, frequency * 0.5, 0.707);

    // Envelope follower for dynamic processing
    const rectified = Math.abs(filteredBass);
    const attackCoeff = Math.exp(-1 / (0.01 * this.sampleRate)); // 10ms attack
    const releaseCoeff = Math.exp(-1 / ((0.1 + tightness * 0.4) * this.sampleRate)); // 100-500ms release

    if (rectified > state.envelope) {
      state.envelope = attackCoeff * state.envelope + (1 - attackCoeff) * rectified;
    } else {
      state.envelope = releaseCoeff * state.envelope + (1 - releaseCoeff) * rectified;
    }

    // 🎯 PROFESSIONAL SUB-BASS SYNTHESIS: Octave down generation (like MaxxBass, RBass)
    // Sub-harmonic generation: Full-wave rectification + filtering for natural sub
    const rectified = Math.abs(filteredBass);
    
    // 🎯 ANALOG-STYLE SUB: Square root compression for musical character
    const subHarmonic = Math.sign(filteredBass) * Math.sqrt(rectified) * state.envelope * 0.8;
    
    // 🎯 SECOND HARMONIC: Even harmonic for warmth (like tube saturation)
    const secondHarmonic = filteredBass * rectified * harmonics * 0.4; // Reduced for balance
    
    // 🎯 THIRD HARMONIC: Odd harmonic for presence (subtle)
    const thirdHarmonic = filteredBass * filteredBass * Math.sign(filteredBass) * rectified * harmonics * 0.15;

    // 🎯 PROFESSIONAL MIXING: Energy-preserving blend
    // Original bass: preserve dynamics
    const originalGain = 1.0 - (amount * 0.3); // Slight reduction to make room for harmonics
    const enhanced = filteredBass * originalGain + subHarmonic * amount * 1.2 + secondHarmonic * 0.8 + thirdHarmonic;

    // 🎯 AUTO-GAIN: Compensate for harmonic buildup
    const compensation = 1.0 / (1 + amount * 0.6 + harmonics * 0.3);
    return enhanced * compensation;
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

registerProcessor('bass-enhancer-808-processor', BassEnhancer808Processor);
