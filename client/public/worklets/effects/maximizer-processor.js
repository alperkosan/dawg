/**
 * Maximizer Processor
 *
 * Loudness maximizer with:
 * - Input gain
 * - Soft saturation (analog warmth)
 * - Brick-wall limiter
 * - Output ceiling control
 */

class MaximizerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'inputGain', defaultValue: 0, minValue: -12, maxValue: 12 },      // dB
      { name: 'saturation', defaultValue: 0.3, minValue: 0, maxValue: 1 },
      { name: 'ceiling', defaultValue: -0.1, minValue: -6, maxValue: 0 },       // dB
      { name: 'release', defaultValue: 0.1, minValue: 0.01, maxValue: 1 },      // seconds
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor() {
    super();
    this.gainReduction = 0;
    this.envelope = 0;
  }

  /**
   * Convert dB to linear gain
   */
  dbToGain(db) {
    return Math.pow(10, db / 20);
  }

  /**
   * Soft saturation using tanh
   */
  saturate(sample, amount) {
    if (amount === 0) return sample;

    const drive = 1 + (amount * 4); // 1-5 range
    return Math.tanh(sample * drive) / Math.tanh(drive);
  }

  /**
   * Brick-wall limiter
   */
  limit(sample, threshold, release, sampleRate) {
    const attack = 0.001; // 1ms attack (brick-wall)

    // Envelope follower
    const absInput = Math.abs(sample);

    if (absInput > this.envelope) {
      // Attack
      this.envelope = absInput;
    } else {
      // Release
      const releaseCoeff = Math.exp(-1 / (release * sampleRate));
      this.envelope = releaseCoeff * this.envelope + (1 - releaseCoeff) * absInput;
    }

    // Calculate gain reduction
    if (this.envelope > threshold) {
      this.gainReduction = threshold / this.envelope;
    } else {
      this.gainReduction = 1.0;
    }

    return sample * this.gainReduction;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length) {
      return true;
    }

    const inputGainParam = parameters.inputGain;
    const saturationParam = parameters.saturation;
    const ceilingParam = parameters.ceiling;
    const releaseParam = parameters.release;
    const wetParam = parameters.wet;

    const numChannels = Math.min(input.length, output.length);

    for (let channel = 0; channel < numChannels; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      for (let i = 0; i < inputChannel.length; i++) {
        const inputGainDb = inputGainParam.length > 1 ? inputGainParam[i] : inputGainParam[0];
        const saturation = saturationParam.length > 1 ? saturationParam[i] : saturationParam[0];
        const ceilingDb = ceilingParam.length > 1 ? ceilingParam[i] : ceilingParam[0];
        const release = releaseParam.length > 1 ? releaseParam[i] : releaseParam[0];
        const wet = wetParam.length > 1 ? wetParam[i] : wetParam[0];

        // Dry signal
        const dry = inputChannel[i];

        // 1. Input gain
        const inputGain = this.dbToGain(inputGainDb);
        let wet_signal = dry * inputGain;

        // 2. Saturation
        wet_signal = this.saturate(wet_signal, saturation);

        // 3. Limiter
        const ceilingLinear = this.dbToGain(ceilingDb);
        wet_signal = this.limit(wet_signal, ceilingLinear, release, sampleRate);

        // 4. Output gain compensation (bring back to near 0dB)
        const outputGain = this.dbToGain(-ceilingDb);
        wet_signal = wet_signal * outputGain;

        // Mix
        outputChannel[i] = dry * (1 - wet) + wet_signal * wet;
      }
    }

    return true;
  }
}

registerProcessor('maximizer-processor', MaximizerProcessor);
