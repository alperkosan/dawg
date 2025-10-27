/**
 * MaximizerEffect.js
 *
 * Loudness maximizer with limiter and saturation.
 * Perfect for mastering chain.
 *
 * Features:
 * - Input gain
 * - Soft saturation (analog warmth)
 * - Brick-wall limiter (prevent clipping)
 * - Output ceiling control
 */

import { Effect } from './Effect.js';

/**
 * MaximizerEffect class
 */
export class MaximizerEffect extends Effect {
  constructor(audioContext) {
    super(audioContext, 'maximizer');

    // Parameters
    this.inputGain = 0;      // dB (-12 to +12)
    this.saturation = 0.3;   // 0-1 (amount of harmonic saturation)
    this.ceiling = -0.1;     // dB (-6 to 0)
    this.release = 0.1;      // seconds (0.01 - 1.0)

    // Audio nodes
    this.inputGainNode = audioContext.createGain();
    this.saturator = audioContext.createWaveShaper();
    this.limiter = audioContext.createDynamicsCompressor();
    this.outputGainNode = audioContext.createGain();

    // Initialize
    this._initialize();
  }

  /**
   * Initialize effect chain
   */
  _initialize() {
    // Input gain
    this._updateInputGain();

    // Saturation (soft clipping for analog warmth)
    this._updateSaturation();

    // Limiter (brick-wall limiting)
    this.limiter.threshold.value = -0.1;  // Just below 0dB
    this.limiter.knee.value = 0;          // Hard knee (brick-wall)
    this.limiter.ratio.value = 20;        // Heavy limiting
    this.limiter.attack.value = 0.001;    // Fast attack
    this.limiter.release.value = 0.1;     // Medium release
    this._updateCeiling();

    // Output gain (compensate for ceiling)
    this._updateOutputGain();

    // Effect chain
    this.effectChain = [
      this.inputGainNode,
      this.saturator,
      this.limiter,
      this.outputGainNode,
    ];

    // Connect chain
    this._connectEffectChain();
  }

  /**
   * Create saturation curve
   * Soft clipping for analog warmth
   */
  _createSaturationCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;

      if (amount === 0) {
        // No saturation - linear
        curve[i] = x;
      } else {
        // Soft saturation using tanh
        // Amount controls how early saturation kicks in
        const drive = 1 + (amount * 4); // 1-5 range
        curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
      }
    }

    return curve;
  }

  /**
   * Update input gain
   */
  _updateInputGain() {
    // Convert dB to linear gain
    const gain = Math.pow(10, this.inputGain / 20);
    this.inputGainNode.gain.setValueAtTime(gain, this.audioContext.currentTime);
  }

  /**
   * Update saturation
   */
  _updateSaturation() {
    this.saturator.curve = this._createSaturationCurve(this.saturation);
    this.saturator.oversample = '2x'; // Reduce aliasing
  }

  /**
   * Update ceiling
   */
  _updateCeiling() {
    // Set limiter threshold
    this.limiter.threshold.setValueAtTime(this.ceiling, this.audioContext.currentTime);
  }

  /**
   * Update output gain
   */
  _updateOutputGain() {
    // Compensate for ceiling (bring output back to near 0dB)
    const gain = Math.pow(10, -this.ceiling / 20);
    this.outputGainNode.gain.setValueAtTime(gain, this.audioContext.currentTime);
  }

  /**
   * Set input gain (dB)
   */
  setInputGain(gain) {
    this.inputGain = Math.max(-12, Math.min(12, gain));
    this._updateInputGain();
  }

  /**
   * Set saturation amount (0-1)
   */
  setSaturation(saturation) {
    this.saturation = Math.max(0, Math.min(1, saturation));
    this._updateSaturation();
  }

  /**
   * Set ceiling (dB)
   */
  setCeiling(ceiling) {
    this.ceiling = Math.max(-6, Math.min(0, ceiling));
    this._updateCeiling();
    this._updateOutputGain();
  }

  /**
   * Set release time (seconds)
   */
  setRelease(release) {
    this.release = Math.max(0.01, Math.min(1, release));
    this.limiter.release.setValueAtTime(this.release, this.audioContext.currentTime);
  }

  /**
   * Set parameter
   */
  setParameter(paramName, value) {
    switch (paramName) {
      case 'inputGain':
        this.setInputGain(value);
        break;
      case 'saturation':
        this.setSaturation(value);
        break;
      case 'ceiling':
        this.setCeiling(value);
        break;
      case 'release':
        this.setRelease(value);
        break;
      default:
        super.setParameter(paramName, value);
    }
  }

  /**
   * Get parameter
   */
  getParameter(paramName) {
    switch (paramName) {
      case 'inputGain':
        return this.inputGain;
      case 'saturation':
        return this.saturation;
      case 'ceiling':
        return this.ceiling;
      case 'release':
        return this.release;
      default:
        return super.getParameter(paramName);
    }
  }

  /**
   * Get all parameters
   */
  getParameters() {
    return {
      ...super.getParameters(),
      inputGain: this.inputGain,
      saturation: this.saturation,
      ceiling: this.ceiling,
      release: this.release,
    };
  }

  /**
   * Get reduction amount (for metering)
   */
  getReduction() {
    return this.limiter.reduction;
  }
}

export default MaximizerEffect;
