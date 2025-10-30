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
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      // New: lookahead (ms) and true-peak detection toggle
      { name: 'lookahead', defaultValue: 3, minValue: 0, maxValue: 10 },        // milliseconds
      { name: 'truePeak', defaultValue: 1, minValue: 0, maxValue: 1 }
    ];
  }

  constructor() {
    super();
    this.gainReduction = 0;
    this.envelope = 0;
    this.prevSampleL = 0;
    this.prevSampleR = 0;

    // Delay buffers for look-ahead (per channel)
    this.delayBuffers = [
      new Float32Array(1),
      new Float32Array(1)
    ];
    this.delayIndex = [0, 0];
    this.delaySamples = 0; // dynamic based on param

    // Metering
    this.blockCounter = 0;
    this.blockGR = 0; // max GR in block
    this.blockOut = 0; // max output peak in block
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

  /**
   * Simple 2x true-peak estimate using linear interpolation between prev and current sample
   */
  truePeak2x(prev, current) {
    const mid = prev + 0.5 * (current - prev); // linear interp @ 0.5
    return Math.max(Math.abs(prev), Math.abs(mid), Math.abs(current));
  }

  updateDelay(linearLookaheadMs, sampleRate) {
    const targetSamples = Math.max(0, Math.round((linearLookaheadMs / 1000) * sampleRate));
    if (targetSamples === this.delaySamples) return;
    this.delaySamples = targetSamples;
    const size = Math.max(1, targetSamples + 8); // small headroom
    this.delayBuffers = [new Float32Array(size), new Float32Array(size)];
    this.delayIndex = [0, 0];
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
    const lookParam = parameters.lookahead;
    const truePeakParam = parameters.truePeak;

    const numChannels = Math.min(input.length, output.length);

    const releaseBlock = (releaseParam.length > 1 ? releaseParam[0] : releaseParam[0]);
    const lookaheadMs = (lookParam && lookParam.length ? lookParam[0] : (lookParam || [3])[0] || 3);
    const truePeakOn = (truePeakParam && truePeakParam.length ? truePeakParam[0] : 1) >= 0.5;
    this.updateDelay(lookaheadMs, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      const delayBuf = this.delayBuffers[channel];
      const delaySize = delayBuf.length;
      let di = this.delayIndex[channel] | 0;
      let prev = channel === 0 ? this.prevSampleL : this.prevSampleR;

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

        // Write to lookahead buffer
        delayBuf[di] = wet_signal;
        const readIndex = (di - this.delaySamples + delaySize) % delaySize;
        const delayed = delayBuf[readIndex];
        di = (di + 1) % delaySize;

        // 3. Limiter with optional true-peak detection on envelope
        const ceilingLinear = this.dbToGain(ceilingDb);
        // Peak estimate from current sample (preLimiter)
        const peak = truePeakOn ? this.truePeak2x(prev, wet_signal) : Math.abs(wet_signal);
        prev = wet_signal;

        // Update envelope using same logic as limit(), but with custom peak
        if (peak > this.envelope) {
          this.envelope = peak;
        } else {
          const releaseCoeff = Math.exp(-1 / (release * sampleRate));
          this.envelope = releaseCoeff * this.envelope + (1 - releaseCoeff) * peak;
        }

        const gr = this.envelope > ceilingLinear ? (ceilingLinear / this.envelope) : 1.0;
        this.gainReduction = gr;
        let limited = delayed * gr;

        // 4. Output gain compensation (bring back to near 0dB)
        const outputGain = this.dbToGain(-ceilingDb);
        wet_signal = limited * outputGain;

        // Mix
        outputChannel[i] = dry * (1 - wet) + wet_signal * wet;

        // Meters
        if (1 - gr > this.blockGR) this.blockGR = 1 - gr;
        const absOut = Math.abs(outputChannel[i]);
        if (absOut > this.blockOut) this.blockOut = absOut;
      }

      // Persist prev sample per channel
      if (channel === 0) this.prevSampleL = prev; else this.prevSampleR = prev;
      this.delayIndex[channel] = di;
    }

    // Emit meters at ~60fps
    this.blockCounter++;
    if (this.blockCounter >= 3) { // 128 sample block ~ 3 blocks ≈ ~8ms @48k
      this.port.postMessage({ type: 'meters', gr: this.blockGR, out: this.blockOut });
      this.blockCounter = 0;
      this.blockGR = 0;
      this.blockOut = 0;
    }

    return true;
  }
}

registerProcessor('maximizer-processor', MaximizerProcessor);
