/**
 * OrbitPanner Processor
 * Auto-panning effect with multiple waveform shapes
 */

class OrbitPannerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 1.0, minValue: 0.01, maxValue: 20 },
      { name: 'depth', defaultValue: 0.8, minValue: 0, maxValue: 1 },
      { name: 'shape', defaultValue: 0, minValue: 0, maxValue: 1 }, // 0=sine, 0.5=triangle, 1=square
      { name: 'stereoWidth', defaultValue: 1.0, minValue: 0, maxValue: 2 },
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'OrbitPanner';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    this.lfoPhase = 0;

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

  generateLFO(phase, shape) {
    // Sine wave
    if (shape <= 0.33) {
      return Math.sin(phase);
    }
    // Triangle wave (morphing from sine)
    else if (shape <= 0.66) {
      const mix = (shape - 0.33) * 3;
      const sine = Math.sin(phase);
      const triangle = (2 / Math.PI) * Math.asin(Math.sin(phase));
      return sine * (1 - mix) + triangle * mix;
    }
    // Square wave (morphing from triangle)
    else {
      const mix = (shape - 0.66) * 3;
      const triangle = (2 / Math.PI) * Math.asin(Math.sin(phase));
      const square = phase % (2 * Math.PI) < Math.PI ? 1 : -1;
      return triangle * (1 - mix) + square * mix;
    }
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

    const rate = this.getParam(parameters.rate, 0) || 1.0;
    const depth = this.getParam(parameters.depth, 0) || 0.8;
    const shape = this.getParam(parameters.shape, 0) || 0;
    const stereoWidth = this.getParam(parameters.stereoWidth, 0) || 1.0;

    const lfoIncrement = (rate / this.sampleRate) * 2 * Math.PI;

    // Ensure we have at least 2 channels for panning
    const numChannels = Math.max(output.length, 2);

    for (let i = 0; i < input[0].length; i++) {
      // Generate LFO value (-1 to 1)
      const lfoValue = this.generateLFO(this.lfoPhase, shape) * depth;

      // Calculate pan position (-1 = full left, 1 = full right)
      const pan = lfoValue * stereoWidth;

      // Equal power panning law
      const panAngle = (pan + 1) * Math.PI / 4; // 0 to PI/2
      const leftGain = Math.cos(panAngle);
      const rightGain = Math.sin(panAngle);

      // Get mono input (mix if stereo)
      let monoInput = 0;
      for (let ch = 0; ch < input.length; ch++) {
        monoInput += input[ch][i];
      }
      monoInput /= input.length;

      // Apply panning
      if (output.length >= 1) {
        const wetLeft = monoInput * leftGain;
        const dryLeft = input[0] ? input[0][i] : 0;
        output[0][i] = dry * dryLeft + wet * wetLeft;
      }

      if (output.length >= 2) {
        const wetRight = monoInput * rightGain;
        const dryRight = input[1] ? input[1][i] : (input[0] ? input[0][i] : 0);
        output[1][i] = dry * dryRight + wet * wetRight;
      }

      // Update LFO phase
      this.lfoPhase += lfoIncrement;
      if (this.lfoPhase > 2 * Math.PI) {
        this.lfoPhase -= 2 * Math.PI;
      }
    }

    return true;
  }
}

registerProcessor('orbit-panner-processor', OrbitPannerProcessor);
