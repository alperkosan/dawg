/**
 * MULTIBAND COMPRESSOR PROCESSOR (OTT-Style)
 *
 * 3-band multiband compressor with upward & downward compression
 * Inspired by Xfer OTT
 */

class MultibandCompressorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      // Global
      { name: 'depth', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'time', defaultValue: 0.5, minValue: 0, maxValue: 10 },

      // Low band (0-250Hz)
      { name: 'lowUpRatio', defaultValue: 3, minValue: 1, maxValue: 20 },
      { name: 'lowDownRatio', defaultValue: 3, minValue: 1, maxValue: 20 },
      { name: 'lowGain', defaultValue: 0, minValue: -24, maxValue: 24 },

      // Mid band (250Hz-2.5kHz)
      { name: 'midUpRatio', defaultValue: 3, minValue: 1, maxValue: 20 },
      { name: 'midDownRatio', defaultValue: 3, minValue: 1, maxValue: 20 },
      { name: 'midGain', defaultValue: 0, minValue: -24, maxValue: 24 },

      // High band (2.5kHz+)
      { name: 'highUpRatio', defaultValue: 3, minValue: 1, maxValue: 20 },
      { name: 'highDownRatio', defaultValue: 3, minValue: 1, maxValue: 20 },
      { name: 'highGain', defaultValue: 0, minValue: -24, maxValue: 24 },

      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();

    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'MultibandCompressor';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Crossover frequencies
    this.lowMidCrossover = 250;
    this.midHighCrossover = 2500;

    // Per-channel, per-band state
    this.channelState = [
      this.createChannelState(),
      this.createChannelState()
    ];

    // Metering
    this.meteringCounter = 0;
    this.meteringInterval = 512;

    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  createChannelState() {
    return {
      // Crossover filter states (Linkwitz-Riley 2nd order)
      lowpassLow: { x1: 0, x2: 0, y1: 0, y2: 0 },
      lowpassMid: { x1: 0, x2: 0, y1: 0, y2: 0 },
      highpassLow: { x1: 0, x2: 0, y1: 0, y2: 0 },
      highpassHigh: { x1: 0, x2: 0, y1: 0, y2: 0 },

      // Per-band compression state
      bands: {
        low: { envelope: 0, gainReduction: 0 },
        mid: { envelope: 0, gainReduction: 0 },
        high: { envelope: 0, gainReduction: 0 }
      }
    };
  }

  handleMessage(message) {
    const { type, data } = message;
    switch (type) {
      case 'updateSettings':
        this.settings = { ...this.settings, ...data };
        break;
      case 'bypass':
        this.bypassed = data.bypassed;
        break;
      case 'reset':
        this.resetState();
        break;
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) return true;

    const blockSize = input[0].length;
    const channelCount = Math.min(input.length, output.length);

    const wetParam = this.getParam(parameters.wet, 0);
    const wet = wetParam !== undefined ? wetParam : (this.settings.wet !== undefined ? this.settings.wet : 1.0);

    if (this.bypassed) {
      for (let channel = 0; channel < channelCount; channel++) {
        output[channel].set(input[channel]);
      }
      return true;
    }

    // Get parameters
    const depth = this.getParam(parameters.depth, 0) || this.settings.depth || 0.5;
    const time = this.getParam(parameters.time, 0) || this.settings.time || 0.5;

    const lowUpRatio = this.getParam(parameters.lowUpRatio, 0) || 3;
    const lowDownRatio = this.getParam(parameters.lowDownRatio, 0) || 3;
    const lowGain = this.getParam(parameters.lowGain, 0) || 0;

    const midUpRatio = this.getParam(parameters.midUpRatio, 0) || 3;
    const midDownRatio = this.getParam(parameters.midDownRatio, 0) || 3;
    const midGain = this.getParam(parameters.midGain, 0) || 0;

    const highUpRatio = this.getParam(parameters.highUpRatio, 0) || 3;
    const highDownRatio = this.getParam(parameters.highDownRatio, 0) || 3;
    const highGain = this.getParam(parameters.highGain, 0) || 0;

    // Calculate attack/release based on time parameter (OTT style)
    const attack = 0.001 + (time * 0.1); // 1ms to 100ms
    const release = 0.01 + (time * 0.5); // 10ms to 500ms

    // Accumulate band levels for metering
    let lowLevel = 0, midLevel = 0, highLevel = 0;

    for (let channel = 0; channel < channelCount; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];
      const state = this.channelState[channel] || this.channelState[0];

      for (let i = 0; i < blockSize; i++) {
        const sample = inputChannel[i];

        // Split into 3 bands using crossover filters
        const bands = this.splitBands(sample, state);

        // Compress each band independently
        const lowCompressed = this.compressBand(
          bands.low, state.bands.low, attack, release,
          -18, lowUpRatio, lowDownRatio, depth
        );

        const midCompressed = this.compressBand(
          bands.mid, state.bands.mid, attack, release,
          -18, midUpRatio, midDownRatio, depth
        );

        const highCompressed = this.compressBand(
          bands.high, state.bands.high, attack, release,
          -18, highUpRatio, highDownRatio, depth
        );

        // Apply per-band gain
        const lowGained = lowCompressed * this.dbToGain(lowGain);
        const midGained = midCompressed * this.dbToGain(midGain);
        const highGained = highCompressed * this.dbToGain(highGain);

        // Sum bands
        const wetSample = lowGained + midGained + highGained;

        // Mix dry/wet
        outputChannel[i] = sample * (1 - wet) + wetSample * wet;

        // Accumulate for metering
        lowLevel += Math.abs(lowCompressed);
        midLevel += Math.abs(midCompressed);
        highLevel += Math.abs(highCompressed);
      }
    }

    // Send metering data
    this.meteringCounter += blockSize;
    if (this.meteringCounter >= this.meteringInterval) {
      this.meteringCounter = 0;

      const sampleCount = blockSize * channelCount;
      const avgGR = (
        this.channelState[0].bands.low.gainReduction +
        this.channelState[0].bands.mid.gainReduction +
        this.channelState[0].bands.high.gainReduction
      ) / 3;

      const lowDb = this.gainToDb(lowLevel / sampleCount);
      const midDb = this.gainToDb(midLevel / sampleCount);
      const highDb = this.gainToDb(highLevel / sampleCount);

      this.port.postMessage({
        type: 'metering',
        gr: Math.abs(avgGR),
        bands: {
          low: Math.max(0, lowDb + 60),
          mid: Math.max(0, midDb + 60),
          high: Math.max(0, highDb + 60)
        }
      });
    }

    return true;
  }

  // Linkwitz-Riley 2nd order crossover filters
  splitBands(sample, state) {
    // Low band: 0-250Hz (lowpass)
    const low = this.biquadLowpass(sample, state.lowpassLow, this.lowMidCrossover);

    // High band: 2.5kHz+ (highpass)
    const high = this.biquadHighpass(sample, state.highpassHigh, this.midHighCrossover);

    // Mid band: 250Hz-2.5kHz (difference)
    const highMid = this.biquadHighpass(sample, state.highpassLow, this.lowMidCrossover);
    const mid = this.biquadLowpass(highMid, state.lowpassMid, this.midHighCrossover);

    return { low, mid, high };
  }

  biquadLowpass(input, state, cutoff) {
    const omega = 2 * Math.PI * cutoff / this.sampleRate;
    const cosOmega = Math.cos(omega);
    const alpha = Math.sin(omega) / (2 * 0.707); // Q = 0.707 for Butterworth

    const b0 = (1 - cosOmega) / 2;
    const b1 = 1 - cosOmega;
    const b2 = (1 - cosOmega) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosOmega;
    const a2 = 1 - alpha;

    const output = (b0 / a0) * input + (b1 / a0) * state.x1 + (b2 / a0) * state.x2
                   - (a1 / a0) * state.y1 - (a2 / a0) * state.y2;

    state.x2 = state.x1;
    state.x1 = input;
    state.y2 = state.y1;
    state.y1 = output;

    return output;
  }

  biquadHighpass(input, state, cutoff) {
    const omega = 2 * Math.PI * cutoff / this.sampleRate;
    const cosOmega = Math.cos(omega);
    const alpha = Math.sin(omega) / (2 * 0.707);

    const b0 = (1 + cosOmega) / 2;
    const b1 = -(1 + cosOmega);
    const b2 = (1 + cosOmega) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosOmega;
    const a2 = 1 - alpha;

    const output = (b0 / a0) * input + (b1 / a0) * state.x1 + (b2 / a0) * state.x2
                   - (a1 / a0) * state.y1 - (a2 / a0) * state.y2;

    state.x2 = state.x1;
    state.x1 = input;
    state.y2 = state.y1;
    state.y1 = output;

    return output;
  }

  compressBand(sample, bandState, attack, release, threshold, upRatio, downRatio, depth) {
    const inputLevel = this.gainToDb(Math.abs(sample));

    // Envelope follower
    const attackCoeff = Math.exp(-1 / (attack * this.sampleRate));
    const releaseCoeff = Math.exp(-1 / (release * this.sampleRate));

    if (inputLevel > bandState.envelope) {
      bandState.envelope = attackCoeff * bandState.envelope + (1 - attackCoeff) * inputLevel;
    } else {
      bandState.envelope = releaseCoeff * bandState.envelope + (1 - releaseCoeff) * inputLevel;
    }

    let gainChange = 0;

    // DOWNWARD compression (above threshold)
    if (bandState.envelope > threshold) {
      const aboveThreshold = bandState.envelope - threshold;
      gainChange = -aboveThreshold * (1 - 1 / downRatio) * depth;
    }

    // UPWARD compression (below threshold)
    if (bandState.envelope < threshold) {
      const belowThreshold = threshold - bandState.envelope;
      gainChange += belowThreshold * (1 - 1 / upRatio) * depth;
    }

    bandState.gainReduction = Math.abs(gainChange);

    const gain = this.dbToGain(gainChange);
    return sample * gain;
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

  resetState() {
    this.channelState.forEach(state => {
      state.lowpassLow = { x1: 0, x2: 0, y1: 0, y2: 0 };
      state.lowpassMid = { x1: 0, x2: 0, y1: 0, y2: 0 };
      state.highpassLow = { x1: 0, x2: 0, y1: 0, y2: 0 };
      state.highpassHigh = { x1: 0, x2: 0, y1: 0, y2: 0 };
      Object.values(state.bands).forEach(band => {
        band.envelope = 0;
        band.gainReduction = 0;
      });
    });
  }
}

registerProcessor('multiband-compressor-processor', MultibandCompressorProcessor);
