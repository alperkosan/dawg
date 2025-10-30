/**
 * COMPRESSOR PROCESSOR
 *
 * Dynamic range compressor with attack, release, ratio, knee
 * Professional studio-quality compression
 */

class CompressorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -24, minValue: -60, maxValue: 0 },
      { name: 'ratio', defaultValue: 4, minValue: 1, maxValue: 20 },
      { name: 'attack', defaultValue: 0.003, minValue: 0.0001, maxValue: 1 },
      { name: 'release', defaultValue: 0.25, minValue: 0.001, maxValue: 3 },
      { name: 'knee', defaultValue: 30, minValue: 0, maxValue: 40 },
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      { name: 'upwardRatio', defaultValue: 2, minValue: 1, maxValue: 20 },
      { name: 'upwardDepth', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'autoMakeup', defaultValue: 0, minValue: 0, maxValue: 1 },
      // New: lookahead (ms) and stereo link (0..100)
      { name: 'lookahead', defaultValue: 3, minValue: 0, maxValue: 10 },
      { name: 'stereoLink', defaultValue: 100, minValue: 0, maxValue: 100 },
      // Sidechain parameters
      { name: 'scEnable', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'scGain', defaultValue: 0, minValue: -24, maxValue: 24 },
      { name: 'scFilterType', defaultValue: 1, minValue: 0, maxValue: 2 }, // 0:none 1:HPF 2:LPF
      { name: 'scFreq', defaultValue: 150, minValue: 20, maxValue: 2000 },
      { name: 'scListen', defaultValue: 0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();

    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'Compressor';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Per-channel state
    this.channelState = [
      {
        envelope: 0,  // Current envelope follower value
        gainReduction: 0  // Current gain reduction in dB
      },
      {
        envelope: 0,
        gainReduction: 0
      }
    ];

    // Metering
    this.meteringCounter = 0;
    this.meteringInterval = 512; // Send GR updates every 512 samples

    // 3-band frequency analysis for visual metering
    // Low: 0-250Hz, Mid: 250Hz-2.5kHz, High: 2.5kHz+
    this.initBandFilters();
    this.bandLevels = { low: 0, mid: 0, high: 0 };

    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    // Lookahead delay per channel
    this.delayBuf = [new Float32Array(1), new Float32Array(1)];
    this.delayIdx = [0, 0];
    this.delaySamples = 0;

    // Sidechain filter state
    this.scState = [0, 0];
  }

  initBandFilters() {
    const sr = this.sampleRate;

    // Simple one-pole filters for band splitting (visual only)
    this.lowpassCoeff = Math.exp(-2 * Math.PI * 250 / sr);
    this.highpassCoeff = Math.exp(-2 * Math.PI * 2500 / sr);

    // Filter states per channel
    this.filterStates = [
      { lowState: 0, highState: 0 },
      { lowState: 0, highState: 0 }
    ];
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
    const scInput = inputs[1]; // optional sidechain

    if (!input || !input[0] || !output || !output[0]) return true;

    const blockSize = input[0].length;
    const channelCount = Math.min(input.length, output.length);

    const wetParam = this.getParam(parameters.wet, 0);
    const wet = wetParam !== undefined ? wetParam : (this.settings.wet !== undefined ? this.settings.wet : 1.0);
    // Sidechain config
    const scEnable = (this.getParam(parameters.scEnable, 0) ?? this.settings.scEnable ?? 0) >= 0.5;
    const scGainDb = this.getParam(parameters.scGain, 0) ?? (this.settings.scGain ?? 0);
    const scFilterType = Math.round(this.getParam(parameters.scFilterType, 0) ?? (this.settings.scFilterType ?? 1));
    const scFreq = this.getParam(parameters.scFreq, 0) ?? (this.settings.scFreq ?? 150);
    const scListen = (this.getParam(parameters.scListen, 0) ?? this.settings.scListen ?? 0) >= 0.5;
    const scGain = this.dbToGain(scGainDb);
    const omega = 2 * Math.PI * Math.max(20, Math.min(2000, scFreq)) / this.sampleRate;
    const coef = Math.exp(-omega);

    if (this.bypassed) {
      for (let channel = 0; channel < channelCount; channel++) {
        output[channel].set(input[channel]);
      }
      return true;
    }

    // Accumulate band levels for metering
    let lowLevel = 0, midLevel = 0, highLevel = 0;

    // Update lookahead buffer size once per block
    const lookaheadMs = this.getParam(parameters.lookahead, 0) ?? (this.settings.lookahead ?? 3);
    const targetDelay = Math.max(0, Math.round((lookaheadMs / 1000) * this.sampleRate));
    if (targetDelay !== this.delaySamples) {
      this.delaySamples = targetDelay;
      const size = Math.max(1, targetDelay + 8);
      this.delayBuf = [new Float32Array(size), new Float32Array(size)];
      this.delayIdx = [0, 0];
    }

    const stereoLink = (this.getParam(parameters.stereoLink, 0) ?? (this.settings.stereoLink ?? 100)) / 100;

    for (let channel = 0; channel < channelCount; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];
      const filterState = this.filterStates[channel] || this.filterStates[0];
      const dBuf = this.delayBuf[channel];
      const dSize = dBuf.length;
      let di = this.delayIdx[channel] | 0;

      for (let i = 0; i < blockSize; i++) {
        const drySample = inputChannel[i];

        // Sidechain detection sample
        let detect = drySample;
        if (scEnable && scInput && scInput[channel] && scInput[channel].length > i) {
          detect = scInput[channel][i] * scGain;
        }
        // Apply SC filter (HPF/LPF one-pole) to detection only
        if (scFilterType === 1) {
          // HPF: x - lp
          this.scState[channel] = coef * this.scState[channel] + (1 - coef) * detect;
          detect = detect - this.scState[channel];
        } else if (scFilterType === 2) {
          // LPF
          this.scState[channel] = coef * this.scState[channel] + (1 - coef) * detect;
          detect = this.scState[channel];
        }

        // Write to lookahead buffer and read delayed sample
        dBuf[di] = drySample;
        const readIndex = (di - this.delaySamples + dSize) % dSize;
        const delayedSample = dBuf[readIndex];
        di = (di + 1) % dSize;

        // If listening sidechain, route detection to output (debug)
        if (scListen) {
          outputChannel[i] = detect;
          continue;
        }

        const wetSample = this.processEffect(delayedSample, channel, i, parameters, stereoLink, detect);
        outputChannel[i] = drySample * (1 - wet) + wetSample * wet;

        // Frequency band analysis (visual only)
        const absSample = Math.abs(drySample);

        // Low band (0-250Hz) - one-pole lowpass
        filterState.lowState = this.lowpassCoeff * filterState.lowState + (1 - this.lowpassCoeff) * absSample;
        lowLevel += filterState.lowState;

        // High band (2.5kHz+) - one-pole highpass
        const highpassInput = absSample - filterState.highState;
        filterState.highState = this.highpassCoeff * filterState.highState + (1 - this.highpassCoeff) * absSample;
        highLevel += Math.abs(highpassInput);

        // Mid band (250Hz-2.5kHz) - difference
        midLevel += Math.max(0, absSample - filterState.lowState * 0.5 - Math.abs(highpassInput) * 0.5);
      }

      this.delayIdx[channel] = di;
    }

    // Average band levels
    const sampleCount = blockSize * channelCount;
    this.bandLevels.low = lowLevel / sampleCount;
    this.bandLevels.mid = midLevel / sampleCount;
    this.bandLevels.high = highLevel / sampleCount;

    // Send GR metering data periodically
    this.meteringCounter += blockSize;
    if (this.meteringCounter >= this.meteringInterval) {
      this.meteringCounter = 0;

      // Send average GR from both channels
      const avgGR = (this.channelState[0].gainReduction + (this.channelState[1]?.gainReduction || 0)) / channelCount;

      // Convert band levels to dB for display
      const lowDb = this.gainToDb(this.bandLevels.low);
      const midDb = this.gainToDb(this.bandLevels.mid);
      const highDb = this.gainToDb(this.bandLevels.high);

      // Calculate sidechain signal level for visualization
      let scLevelDb = -Infinity;
      if (scEnable && scInput && scInput[0] && scInput[0].length > 0) {
        let scSumSq = 0;
        const scChannel = scInput[0];
        for (let i = 0; i < Math.min(blockSize, scChannel.length); i++) {
          scSumSq += scChannel[i] * scChannel[i];
        }
        const scRms = Math.sqrt(scSumSq / blockSize);
        scLevelDb = scRms > 0 ? 20 * Math.log10(scRms * Math.pow(10, scGainDb / 20)) : -Infinity;
      }

      this.port.postMessage({
        type: 'metering',
        gr: Math.abs(avgGR), // Overall GR (positive value)
        scLevel: isFinite(scLevelDb) ? scLevelDb : null, // Sidechain signal level in dB
        bands: {
          low: Math.max(0, lowDb + 60), // Normalize to 0-60 range
          mid: Math.max(0, midDb + 60),
          high: Math.max(0, highDb + 60)
        }
      });
    }

    return true;
  }

  processEffect(sample, channel, parameters, stereoLink = 1, detectorSample = undefined) {
    const threshold = this.getParam(parameters.threshold, 0) || this.settings.threshold || -24;
    const ratio = this.getParam(parameters.ratio, 0) || this.settings.ratio || 4;
    const attack = this.getParam(parameters.attack, 0) || this.settings.attack || 0.003;
    const release = this.getParam(parameters.release, 0) || this.settings.release || 0.25;
    const knee = this.getParam(parameters.knee, 0) || this.settings.knee || 30;
    const upwardRatio = this.getParam(parameters.upwardRatio, 0) || this.settings.upwardRatio || 2;
    const upwardDepth = this.getParam(parameters.upwardDepth, 0) || this.settings.upwardDepth || 0;
    const autoMakeup = this.getParam(parameters.autoMakeup, 0) || this.settings.autoMakeup || 0;

    const state = this.channelState[channel] || this.channelState[0];

    // Convert to dB
    const levelSample = (detectorSample !== undefined) ? detectorSample : sample;
    const inputLevel = this.gainToDb(Math.abs(levelSample));

    // Envelope follower with program-dependent release
    const attackCoeff = Math.exp(-1 / (attack * this.sampleRate));
    // Two-release model: fast for transients, slow for sustained
    const fastRel = Math.max(0.02, release * 0.25);
    const slowRel = Math.max(0.05, release * 1.5);
    const fastCoeff = Math.exp(-1 / (fastRel * this.sampleRate));
    const slowCoeff = Math.exp(-1 / (slowRel * this.sampleRate));

    if (inputLevel > state.envelope) {
      state.envelope = attackCoeff * state.envelope + (1 - attackCoeff) * inputLevel;
    } else {
      // Blend fast/slow based on how far below envelope we are
      const delta = (state.envelope - inputLevel);
      const weight = Math.max(0, Math.min(1, delta / 20)); // 0..1 over ~20dB
      const relCoeff = slowCoeff * (1 - weight) + fastCoeff * weight;
      state.envelope = relCoeff * state.envelope + (1 - relCoeff) * inputLevel;
    }

    // Calculate gain changes (both up and down)
    let gainChange = 0;

    // DOWNWARD COMPRESSION (normal) - reduces signals ABOVE threshold
    if (knee > 0 && state.envelope > (threshold - knee / 2) && state.envelope < (threshold + knee / 2)) {
      // Soft knee
      const kneeRange = state.envelope - threshold + knee / 2;
      gainChange = (kneeRange * kneeRange) / (2 * knee) * (1 / ratio - 1);
    } else if (state.envelope > threshold) {
      // Above threshold - reduce
      gainChange = (threshold - state.envelope) * (1 - 1 / ratio);
    }

    // UPWARD COMPRESSION (OTT style) - boosts signals BELOW threshold
    if (upwardDepth > 0 && state.envelope < threshold) {
      const belowThreshold = threshold - state.envelope;
      const upwardGain = belowThreshold * (1 - 1 / upwardRatio) * upwardDepth;
      gainChange += upwardGain; // Add upward gain
    }

    // Stereo link (average GR across channels if enabled)
    let grDb = Math.abs(gainChange);
    if (stereoLink > 0 && this.channelState.length >= 2) {
      const other = this.channelState[(channel ^ 1)]?.gainReduction || grDb;
      grDb = grDb * stereoLink + other * (1 - stereoLink);
    }
    state.gainReduction = grDb; // For metering

    // Auto-makeup gain: compensate for average gain reduction
    // Simple formula: makeup = threshold / ratio (approximate)
    let makeupGain = 0;
    if (autoMakeup > 0) {
      makeupGain = Math.abs(threshold / ratio) * autoMakeup;
      gainChange += makeupGain;
    }

    // Apply total gain change
    const gain = this.dbToGain(gainChange - (grDb - Math.abs(gainChange))); // apply linked GR if any
    return sample * gain;
  }

  // Utility functions
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
      state.envelope = 0;
      state.gainReduction = 0;
    });
  }
}

registerProcessor('compressor-processor', CompressorProcessor);
