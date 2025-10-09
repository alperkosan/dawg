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

    // Transient detection state
    this.envelope = 0;
    this.prevEnvelope = 0;
    this.envelopeDecay = 0.9995; // Very slow decay for better detection
    this.threshold = 0.001; // Very sensitive threshold

    // Smoothing state
    this.smoothedAttack = 1.0;
    this.smoothedSustain = 1.0;
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

      for (let i = 0; i < inputChannel.length; i++) {
        const sample = inputChannel[i];
        const absSample = Math.abs(sample);

        // Envelope follower (fast attack, slow release)
        this.prevEnvelope = this.envelope;
        if (absSample > this.envelope) {
          this.envelope = absSample; // Instant attack
        } else {
          this.envelope *= this.envelopeDecay; // Slow decay
        }

        // Transient detection: Check rate of change
        const envelopeRise = this.envelope - this.prevEnvelope;
        this.isTransient = envelopeRise > this.threshold;

        // Calculate target gain
        const targetGain = this.isTransient ? transientGain : sustainGain;

        // Smooth gain changes
        let smoothedGain;
        if (this.isTransient) {
          this.smoothedAttack += (targetGain - this.smoothedAttack) * (1 - this.smoothingCoeff);
          smoothedGain = this.smoothedAttack;
        } else {
          this.smoothedSustain += (targetGain - this.smoothedSustain) * (1 - this.smoothingCoeff);
          smoothedGain = this.smoothedSustain;
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
