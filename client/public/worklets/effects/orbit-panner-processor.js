/**
 * OrbitPanner Processor v2.0
 * Professional auto-panning with multiple waveform shapes
 *
 * Features:
 * - Adjustable LFO rate (0.1-20 Hz)
 * - Morphing waveform shapes (sine → triangle → square)
 * - Stereo width control
 * - Equal power panning law
 * - Tempo sync (note divisions)
 */

class OrbitPannerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 1.0, minValue: 0.01, maxValue: 20 },
      { name: 'depth', defaultValue: 0.8, minValue: 0, maxValue: 1 },
      { name: 'shape', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'stereoWidth', defaultValue: 1.0, minValue: 0, maxValue: 2 },
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      // ✅ NEW: Tempo sync
      { name: 'tempoSync', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'noteDivision', defaultValue: 3, minValue: 0, maxValue: 9 }, // Same as ModernDelay
      { name: 'bpm', defaultValue: 120, minValue: 60, maxValue: 200 }
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

  // ✅ NEW: Convert note division to seconds (same as ModernDelay and TidalFilter)
  noteValueToSeconds(noteDivision, bpm) {
    const noteValues = [
      1/32, 1/16, 1/8, 1/4, 1/2, 1/1,  // 0-5: standard
      1/8 * 1.5, 1/4 * 1.5,              // 6-7: dotted
      1/8 * 2/3, 1/4 * 2/3                // 8-9: triplet
    ];
    const noteValue = noteValues[Math.floor(noteDivision)] || 1/4;
    return (60 / bpm) * noteValue;
  }

  // ✅ NEW: Calculate LFO rate (Hz or tempo sync)
  calculateLFORate(rate, tempoSync, noteDivision, bpm) {
    if (tempoSync > 0.5) {
      // Tempo sync: convert note division to Hz
      const noteSeconds = this.noteValueToSeconds(noteDivision, bpm);
      return 1 / noteSeconds; // Convert to Hz
    } else {
      // Free rate in Hz
      return rate;
    }
  }

  // Generate LFO with morphing waveform shapes
  generateLFO(phase, shape) {
    // Sine wave (shape: 0 to 0.33)
    if (shape <= 0.33) {
      return Math.sin(phase);
    }
    // Triangle wave (shape: 0.33 to 0.66)
    else if (shape <= 0.66) {
      const mix = (shape - 0.33) * 3; // 0 to 1
      const sine = Math.sin(phase);
      const triangle = (2 / Math.PI) * Math.asin(Math.sin(phase));
      return sine * (1 - mix) + triangle * mix;
    }
    // Square wave (shape: 0.66 to 1.0)
    else {
      const mix = (shape - 0.66) * 3; // 0 to 1
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
    // ✅ NEW: Tempo sync
    const tempoSync = this.getParam(parameters.tempoSync, 0) || 0;
    const noteDivision = this.getParam(parameters.noteDivision, 0) || 3;
    const bpm = this.getParam(parameters.bpm, 0) || 120;

    // ✅ NEW: Calculate effective rate (Hz or tempo sync)
    const effectiveRate = this.calculateLFORate(rate, tempoSync, noteDivision, bpm);
    const lfoIncrement = (effectiveRate / this.sampleRate) * 2 * Math.PI;

    for (let i = 0; i < input[0].length; i++) {
      // Generate LFO value (-1 to 1)
      const lfoValue = this.generateLFO(this.lfoPhase, shape) * depth;

      // Calculate pan position (-1 = full left, 1 = full right)
      const pan = lfoValue * stereoWidth;

      // Equal power panning law
      const panAngle = (pan + 1) * Math.PI / 4; // 0 to PI/2
      const leftGain = Math.cos(panAngle);
      const rightGain = Math.sin(panAngle);

      // ✅ Stereo preservation: Process L/R independently, apply auto-pan to combined signal
      const inputLeft = input[0] ? input[0][i] : 0;
      const inputRight = input[1] ? input[1][i] : inputLeft;

      // Create auto-panned stereo image from input
      const monoSum = (inputLeft + inputRight) * 0.5; // Combine for panning
      const wetLeft = monoSum * leftGain;
      const wetRight = monoSum * rightGain;

      // Mix dry (original stereo) with wet (auto-panned)
      if (output.length >= 1) {
        output[0][i] = dry * inputLeft + wet * wetLeft;
      }

      if (output.length >= 2) {
        output[1][i] = dry * inputRight + wet * wetRight;
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
