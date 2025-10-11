/**
 * VortexPhaser Processor v2.0
 * Professional phaser with multiple all-pass stages
 *
 * Features:
 * - Adjustable stage count (2-12 stages)
 * - Stereo phase offset for wide imaging
 * - Smooth LFO modulation
 * - Feedback control for resonance
 */

class VortexPhaserProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 0.5, minValue: 0.01, maxValue: 10 },
      { name: 'depth', defaultValue: 0.7, minValue: 0, maxValue: 1 },
      { name: 'stages', defaultValue: 4, minValue: 2, maxValue: 12 },
      { name: 'feedback', defaultValue: 0.5, minValue: 0, maxValue: 0.95 },
      { name: 'stereoPhase', defaultValue: 90, minValue: 0, maxValue: 180 },
      { name: 'wet', defaultValue: 0.5, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'VortexPhaser';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Per-channel state
    this.channelState = [
      {
        lfoPhase: 0,
        allpassStates: Array(12).fill(0).map(() => ({ x1: 0, y1: 0 })),
        feedbackSample: 0
      },
      {
        lfoPhase: Math.PI / 2, // 90 degree offset for stereo
        allpassStates: Array(12).fill(0).map(() => ({ x1: 0, y1: 0 })),
        feedbackSample: 0
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

  // First-order all-pass filter
  processAllpass(sample, state, coefficient) {
    const y = -sample + state.x1 + coefficient * state.y1;
    state.x1 = sample;
    state.y1 = y;
    return y;
  }

  processEffect(sample, channel, sampleIndex, parameters) {
    const rate = this.getParam(parameters.rate, sampleIndex) || 0.5;
    const depth = this.getParam(parameters.depth, sampleIndex) || 0.7;
    const stages = Math.floor(this.getParam(parameters.stages, sampleIndex) || 4);
    const feedback = this.getParam(parameters.feedback, sampleIndex) || 0.5;
    const stereoPhase = this.getParam(parameters.stereoPhase, sampleIndex) || 90;

    const state = this.channelState[channel];

    // Apply stereo phase offset
    const phaseOffset = channel === 1 ? (stereoPhase / 180) * Math.PI : 0;

    // Update LFO
    const lfoIncrement = (rate / this.sampleRate) * 2 * Math.PI;
    state.lfoPhase += lfoIncrement;
    if (state.lfoPhase > 2 * Math.PI) {
      state.lfoPhase -= 2 * Math.PI;
    }

    // Calculate modulated frequency (200 Hz to 2000 Hz)
    const lfoValue = (Math.sin(state.lfoPhase + phaseOffset) + 1) / 2; // 0 to 1
    const minFreq = 200;
    const maxFreq = 2000;
    const modulatedFreq = minFreq + (maxFreq - minFreq) * lfoValue * depth;

    // Calculate all-pass coefficient
    const wc = 2 * Math.PI * modulatedFreq / this.sampleRate;
    const tanHalfWc = Math.tan(wc / 2);
    const apCoeff = (tanHalfWc - 1) / (tanHalfWc + 1);

    // Add feedback
    let processed = sample + state.feedbackSample * feedback;

    // Process through all-pass stages
    for (let i = 0; i < Math.min(stages, 12); i++) {
      processed = this.processAllpass(processed, state.allpassStates[i], apCoeff);
    }

    // Store for feedback
    state.feedbackSample = processed;

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

registerProcessor('vortex-phaser-processor', VortexPhaserProcessor);
