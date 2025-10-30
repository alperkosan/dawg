/**
 * TransientDesigner AudioWorklet Processor
 * Advanced attack & sustain shaping
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
      }
    ];
  }

  constructor() {
    super();

    // ✅ Per-channel state for stereo independence
    this.channelState = [
      {
        envelope: 0,
        prevEnvelope: 0,
        smoothedAttack: 1.0,
        smoothedSustain: 1.0
      },
      {
        envelope: 0,
        prevEnvelope: 0,
        smoothedAttack: 1.0,
        smoothedSustain: 1.0
      }
    ];

    // Shared parameters
    this.envelopeDecay = 0.9995; // Very slow decay for better detection
    this.threshold = 0.001; // Very sensitive threshold
    const smoothingTime = 0.01; // 10ms
    this.smoothingCoeff = Math.exp(-1 / (sampleRate * smoothingTime));
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0]) {
      return true;
    }

    // Read AudioParam values (they're arrays with 128 samples or single value)
    const attackParam = parameters.attack;
    const sustainParam = parameters.sustain;
    const mixParam = parameters.mix;

    // Get the value (if array, use first sample; if single value, use it directly)
    const attackDb = attackParam.length > 1 ? attackParam[0] : (attackParam[0] || 0);
    const sustainDb = sustainParam.length > 1 ? sustainParam[0] : (sustainParam[0] || 0);
    const mixValue = mixParam.length > 1 ? mixParam[0] : (mixParam[0] || 1);

    // Convert dB to linear gain
    const transientGain = Math.pow(10, attackDb / 20);
    const sustainGain = Math.pow(10, sustainDb / 20);
    const mix = Math.max(0, Math.min(1, mixValue));

    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      // ✅ Get state for this channel (stereo independence)
      const state = this.channelState[channel] || this.channelState[0];

      for (let i = 0; i < inputChannel.length; i++) {
        const sample = inputChannel[i];
        const absSample = Math.abs(sample);

        // 🎯 PROFESSIONAL ENVELOPE FOLLOWER: Dual-stage (like SPL Transient Designer)
        // Fast attack for transient detection, slower release for sustain tracking
        const attackCoeff = 0.98; // Fast attack (2ms equivalent)
        const releaseCoeff = this.envelopeDecay; // Slow release (already set)
        
        state.prevEnvelope = state.envelope;
        if (absSample > state.envelope) {
          // Attack: Fast response to transients
          state.envelope = absSample * (1 - attackCoeff) + state.envelope * attackCoeff;
        } else {
          // Release: Slow decay for sustain detection
          state.envelope *= releaseCoeff;
        }

        // 🎯 PROFESSIONAL TRANSIENT DETECTION: Rate-of-change + adaptive threshold
        const envelopeRise = state.envelope - state.prevEnvelope;
        const riseRate = envelopeRise > 0 ? envelopeRise / Math.max(0.001, state.prevEnvelope) : 0;
        
        // Adaptive threshold based on envelope level (more sensitive at low levels)
        const adaptiveThreshold = this.threshold * (1 + state.envelope * 2);
        const isTransient = envelopeRise > adaptiveThreshold || riseRate > 0.3;

        // Calculate target gain
        const targetGain = isTransient ? transientGain : sustainGain;

        // 🎯 PROFESSIONAL GAIN SMOOTHING: Different attack/release for natural response
        const attackSmoothing = 1 - Math.exp(-1 / (this.sampleRate * 0.002)); // 2ms attack
        const releaseSmoothing = 1 - Math.exp(-1 / (this.sampleRate * 0.020)); // 20ms release
        
        let smoothedGain;
        if (isTransient) {
          // Fast attack smoothing for transients
          state.smoothedAttack += (targetGain - state.smoothedAttack) * attackSmoothing;
          smoothedGain = state.smoothedAttack;
        } else {
          // Slower release smoothing for sustain
          state.smoothedSustain += (targetGain - state.smoothedSustain) * releaseSmoothing;
          smoothedGain = state.smoothedSustain;
        }

        // Apply processing
        const processed = sample * smoothedGain;

        // Mix dry/wet
        outputChannel[i] = sample * (1 - mix) + processed * mix;
      }
    }

    return true;
  }
}

registerProcessor('transient-designer-processor', TransientDesignerProcessor);
