/**
 * SidechainCompressor Processor
 * Sidechain compression (ducking) effect
 */

class SidechainCompressorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -24, minValue: -60, maxValue: 0 },
      { name: 'ratio', defaultValue: 4, minValue: 1, maxValue: 20 },
      { name: 'attack', defaultValue: 0.003, minValue: 0.0001, maxValue: 1 },
      { name: 'release', defaultValue: 0.25, minValue: 0.001, maxValue: 3 },
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'SidechainCompressor';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    this.channelState = [
      { envelope: 0, gainReduction: 0 },
      { envelope: 0, gainReduction: 0 }
    ];

    // Sidechain signal generator (simulated kick drum pattern)
    this.sidechainPhase = 0;
    this.sidechainTrigger = 0;
    this.sidechainEnvelope = 0;
    this.tempo = 120; // BPM
    this.beatInterval = (60 / this.tempo) * this.sampleRate; // Samples per beat

    this.port.onmessage = (e) => {
      if (e.data.type === 'updateSettings') {
        Object.assign(this.settings, e.data.data);
      } else if (e.data.type === 'bypass') {
        this.bypassed = e.data.value;
      } else if (e.data.type === 'tempo') {
        this.tempo = e.data.value;
        this.beatInterval = (60 / this.tempo) * this.sampleRate;
      }
    };
  }

  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  gainToDb(gain) {
    return 20 * Math.log10(Math.max(gain, 0.00001));
  }

  dbToGain(db) {
    return Math.pow(10, db / 20);
  }

  processEffect(sample, channel, sampleIndex, parameters) {
    const threshold = this.getParam(parameters.threshold, sampleIndex) || -24;
    const ratio = this.getParam(parameters.ratio, sampleIndex) || 4;
    const attack = this.getParam(parameters.attack, sampleIndex) || 0.003;
    const release = this.getParam(parameters.release, sampleIndex) || 0.25;

    const state = this.channelState[channel];

    // Generate sidechain signal (simulated kick pattern)
    this.sidechainPhase++;
    if (this.sidechainPhase >= this.beatInterval) {
      this.sidechainPhase = 0;
      this.sidechainTrigger = 1.0;
    }

    // Sidechain envelope (fast attack, slow release)
    const scAttackCoeff = Math.exp(-1 / (0.001 * this.sampleRate)); // 1ms attack
    const scReleaseCoeff = Math.exp(-1 / (0.15 * this.sampleRate)); // 150ms release

    if (this.sidechainTrigger > this.sidechainEnvelope) {
      this.sidechainEnvelope = scAttackCoeff * this.sidechainEnvelope + (1 - scAttackCoeff) * this.sidechainTrigger;
    } else {
      this.sidechainEnvelope = scReleaseCoeff * this.sidechainEnvelope + (1 - scReleaseCoeff) * this.sidechainTrigger;
    }

    this.sidechainTrigger *= 0.99; // Decay trigger

    // Convert sidechain signal to dB
    const sidechainLevel = this.gainToDb(this.sidechainEnvelope);

    // Calculate compression based on sidechain
    let gainReduction = 0;
    if (sidechainLevel > threshold) {
      gainReduction = (threshold - sidechainLevel) * (1 - 1/ratio);
    }

    // Envelope follower for smooth gain reduction
    const attackCoeff = Math.exp(-1 / (attack * this.sampleRate));
    const releaseCoeff = Math.exp(-1 / (release * this.sampleRate));

    if (gainReduction < state.gainReduction) {
      state.gainReduction = attackCoeff * state.gainReduction + (1 - attackCoeff) * gainReduction;
    } else {
      state.gainReduction = releaseCoeff * state.gainReduction + (1 - releaseCoeff) * gainReduction;
    }

    // Apply gain reduction
    const gain = this.dbToGain(state.gainReduction);
    return sample * gain;
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

registerProcessor('sidechain-compressor-processor', SidechainCompressorProcessor);
