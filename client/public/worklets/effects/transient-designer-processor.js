/**
 * TransientDesigner AudioWorklet Processor
 * Advanced attack & sustain shaping with frequency targeting
 */

class TransientDesignerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'attack',
        defaultValue: 0,
        minValue: -12,
        maxValue: 12,
        automationRate: 'k-rate'
      },
      {
        name: 'sustain',
        defaultValue: 0,
        minValue: -12,
        maxValue: 12,
        automationRate: 'k-rate'
      },
      {
        name: 'mix',
        defaultValue: 1.0,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate'
      },
      // ✅ NEW: Frequency Targeting
      {
        name: 'frequencyTargeting',
        defaultValue: 0, // 0=Full, 1=Low, 2=Mid, 3=High
        minValue: 0,
        maxValue: 3,
        automationRate: 'k-rate'
      },
      {
        name: 'lowAttack',
        defaultValue: 0,
        minValue: -12,
        maxValue: 12,
        automationRate: 'k-rate'
      },
      {
        name: 'lowSustain',
        defaultValue: 0,
        minValue: -12,
        maxValue: 12,
        automationRate: 'k-rate'
      },
      {
        name: 'midAttack',
        defaultValue: 0,
        minValue: -12,
        maxValue: 12,
        automationRate: 'k-rate'
      },
      {
        name: 'midSustain',
        defaultValue: 0,
        minValue: -12,
        maxValue: 12,
        automationRate: 'k-rate'
      },
      {
        name: 'highAttack',
        defaultValue: 0,
        minValue: -12,
        maxValue: 12,
        automationRate: 'k-rate'
      },
      {
        name: 'highSustain',
        defaultValue: 0,
        minValue: -12,
        maxValue: 12,
        automationRate: 'k-rate'
      },
      {
        name: 'lowCrossover',
        defaultValue: 200, // Hz
        minValue: 50,
        maxValue: 1000,
        automationRate: 'k-rate'
      },
      {
        name: 'highCrossover',
        defaultValue: 5000, // Hz
        minValue: 2000,
        maxValue: 15000,
        automationRate: 'k-rate'
      }
    ];
  }

  constructor() {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;

    // ✅ Per-channel state for stereo independence
    this.channelState = [
      {
        envelope: 0,
        prevEnvelope: 0,
        smoothedAttack: 1.0,
        smoothedSustain: 1.0,
        // ✅ NEW: Frequency band states
        lowState: { envelope: 0, prevEnvelope: 0, smoothedAttack: 1.0, smoothedSustain: 1.0 },
        midState: { envelope: 0, prevEnvelope: 0, smoothedAttack: 1.0, smoothedSustain: 1.0 },
        highState: { envelope: 0, prevEnvelope: 0, smoothedAttack: 1.0, smoothedSustain: 1.0 },
        // ✅ NEW: Crossover filter states (one-pole filters)
        lowFilter: { low: 0, high: 0 },
        midFilter: { low: 0, high: 0 },
        highFilter: { low: 0, high: 0 }
      },
      {
        envelope: 0,
        prevEnvelope: 0,
        smoothedAttack: 1.0,
        smoothedSustain: 1.0,
        // ✅ NEW: Frequency band states
        lowState: { envelope: 0, prevEnvelope: 0, smoothedAttack: 1.0, smoothedSustain: 1.0 },
        midState: { envelope: 0, prevEnvelope: 0, smoothedAttack: 1.0, smoothedSustain: 1.0 },
        highState: { envelope: 0, prevEnvelope: 0, smoothedAttack: 1.0, smoothedSustain: 1.0 },
        // ✅ NEW: Crossover filter states
        lowFilter: { low: 0, high: 0 },
        midFilter: { low: 0, high: 0 },
        highFilter: { low: 0, high: 0 }
      }
    ];

    // Shared parameters
    this.envelopeDecay = 0.9995; // Very slow decay for better detection
    this.threshold = 0.001; // Very sensitive threshold
    const smoothingTime = 0.01; // 10ms
    this.smoothingCoeff = Math.exp(-1 / (this.sampleRate * smoothingTime));
  }

  // ✅ NEW: One-pole lowpass filter for crossover
  updateLowpassFilter(state, cutoff) {
    const normalizedFreq = Math.min(cutoff, this.sampleRate / 2.2) / this.sampleRate;
    const omega = 2 * Math.PI * normalizedFreq;
    const coeff = 2 * Math.sin(omega / 2);
    return coeff;
  }

  // ✅ NEW: Split signal into frequency bands
  splitBands(sample, channel, lowCrossover, highCrossover) {
    const state = this.channelState[channel];
    
    // Lowpass filter for low band
    const lowCoeff = this.updateLowpassFilter(state.lowFilter, lowCrossover);
    state.lowFilter.low += lowCoeff * (sample - state.lowFilter.low);
    const lowBand = state.lowFilter.low;

    // Highpass filter for high band
    const highCoeff = this.updateLowpassFilter(state.highFilter, highCrossover);
    state.highFilter.high = sample - state.highFilter.low;
    state.highFilter.low += highCoeff * state.highFilter.high;
    const highBand = state.highFilter.high;

    // Mid band = full - low - high
    const midBand = sample - lowBand - highBand;

    return { low: lowBand, mid: midBand, high: highBand };
  }

  // ✅ NEW: Process transient for a single band
  processBand(sample, bandState, attackDb, sustainDb) {
    const absSample = Math.abs(sample);
    
    // Envelope follower
    const attackCoeff = 0.98;
    const releaseCoeff = this.envelopeDecay;
    
    bandState.prevEnvelope = bandState.envelope;
    if (absSample > bandState.envelope) {
      bandState.envelope = absSample * (1 - attackCoeff) + bandState.envelope * attackCoeff;
    } else {
      bandState.envelope *= releaseCoeff;
    }

    // Transient detection
    const envelopeRise = bandState.envelope - bandState.prevEnvelope;
    const riseRate = envelopeRise > 0 ? envelopeRise / Math.max(0.001, bandState.prevEnvelope) : 0;
    const adaptiveThreshold = this.threshold * (1 + bandState.envelope * 2);
    const isTransient = envelopeRise > adaptiveThreshold || riseRate > 0.3;

    // Calculate target gain
    const transientGain = Math.pow(10, attackDb / 20);
    const sustainGain = Math.pow(10, sustainDb / 20);
    const targetGain = isTransient ? transientGain : sustainGain;

    // Gain smoothing
    const attackSmoothing = 1 - Math.exp(-1 / (this.sampleRate * 0.002));
    const releaseSmoothing = 1 - Math.exp(-1 / (this.sampleRate * 0.020));

    let smoothedGain;
    if (isTransient) {
      bandState.smoothedAttack += (targetGain - bandState.smoothedAttack) * attackSmoothing;
      smoothedGain = bandState.smoothedAttack;
    } else {
      bandState.smoothedSustain += (targetGain - bandState.smoothedSustain) * releaseSmoothing;
      smoothedGain = bandState.smoothedSustain;
    }

    return sample * smoothedGain;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0]) {
      return true;
    }

    // Read AudioParam values
    const attackParam = parameters.attack;
    const sustainParam = parameters.sustain;
    const mixParam = parameters.mix;
    const frequencyTargeting = parameters.frequencyTargeting;
    const lowAttack = parameters.lowAttack;
    const lowSustain = parameters.lowSustain;
    const midAttack = parameters.midAttack;
    const midSustain = parameters.midSustain;
    const highAttack = parameters.highAttack;
    const highSustain = parameters.highSustain;
    const lowCrossover = parameters.lowCrossover;
    const highCrossover = parameters.highCrossover;

    // Get the value (if array, use first sample; if single value, use it directly)
    const getValue = (param) => param.length > 1 ? param[0] : (param[0] || 0);
    
    const attackDb = getValue(attackParam);
    const sustainDb = getValue(sustainParam);
    const mixValue = getValue(mixParam);
    const freqTargeting = Math.floor(getValue(frequencyTargeting));
    const lowAttackDb = getValue(lowAttack);
    const lowSustainDb = getValue(lowSustain);
    const midAttackDb = getValue(midAttack);
    const midSustainDb = getValue(midSustain);
    const highAttackDb = getValue(highAttack);
    const highSustainDb = getValue(highSustain);
    const lowCrossoverHz = getValue(lowCrossover);
    const highCrossoverHz = getValue(highCrossover);

    const mix = Math.max(0, Math.min(1, mixValue));

    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];
      const state = this.channelState[channel] || this.channelState[0];

      for (let i = 0; i < inputChannel.length; i++) {
        const sample = inputChannel[i];
        let processed;

        // ✅ NEW: Frequency Targeting Mode
        if (freqTargeting > 0) {
          // Split into frequency bands
          const bands = this.splitBands(sample, channel, lowCrossoverHz, highCrossoverHz);
          
          // Process each band separately
          let lowProcessed = 0, midProcessed = 0, highProcessed = 0;
          
          if (freqTargeting === 1 || freqTargeting === 0) {
            // Low band
            lowProcessed = this.processBand(bands.low, state.lowState, lowAttackDb, lowSustainDb);
          } else {
            lowProcessed = bands.low;
          }
          
          if (freqTargeting === 2 || freqTargeting === 0) {
            // Mid band
            midProcessed = this.processBand(bands.mid, state.midState, midAttackDb, midSustainDb);
          } else {
            midProcessed = bands.mid;
          }
          
          if (freqTargeting === 3 || freqTargeting === 0) {
            // High band
            highProcessed = this.processBand(bands.high, state.highState, highAttackDb, highSustainDb);
          } else {
            highProcessed = bands.high;
          }
          
          // Combine bands
          processed = lowProcessed + midProcessed + highProcessed;
        } else {
          // Original full-band processing (backward compatibility)
          const absSample = Math.abs(sample);
          const attackCoeff = 0.98;
          const releaseCoeff = this.envelopeDecay;

          state.prevEnvelope = state.envelope;
          if (absSample > state.envelope) {
            state.envelope = absSample * (1 - attackCoeff) + state.envelope * attackCoeff;
          } else {
            state.envelope *= releaseCoeff;
          }

          const envelopeRise = state.envelope - state.prevEnvelope;
          const riseRate = envelopeRise > 0 ? envelopeRise / Math.max(0.001, state.prevEnvelope) : 0;
          const adaptiveThreshold = this.threshold * (1 + state.envelope * 2);
          const isTransient = envelopeRise > adaptiveThreshold || riseRate > 0.3;

          const transientGain = Math.pow(10, attackDb / 20);
          const sustainGain = Math.pow(10, sustainDb / 20);
          const targetGain = isTransient ? transientGain : sustainGain;

          const attackSmoothing = 1 - Math.exp(-1 / (this.sampleRate * 0.002));
          const releaseSmoothing = 1 - Math.exp(-1 / (this.sampleRate * 0.020));

          let smoothedGain;
          if (isTransient) {
            state.smoothedAttack += (targetGain - state.smoothedAttack) * attackSmoothing;
            smoothedGain = state.smoothedAttack;
          } else {
            state.smoothedSustain += (targetGain - state.smoothedSustain) * releaseSmoothing;
            smoothedGain = state.smoothedSustain;
          }

          processed = sample * smoothedGain;
        }

        // Mix dry/wet
        outputChannel[i] = sample * (1 - mix) + processed * mix;
      }
    }

    return true;
  }
}

registerProcessor('transient-designer-processor', TransientDesignerProcessor);
