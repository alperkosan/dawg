/**
 * DistortionEffect.js
 *
 * Distortion/Saturation effect with multiple modes.
 *
 * Modes:
 * - Overdrive: Soft tube-like saturation
 * - Fuzz: Hard clipping (transistor-like)
 * - Bitcrush: Bit depth + sample rate reduction
 */

import { Effect } from './Effect.js';

/**
 * Distortion types
 */
export const DistortionType = {
  OVERDRIVE: 'overdrive',
  FUZZ: 'fuzz',
  BITCRUSH: 'bitcrush',
};

/**
 * DistortionEffect class
 */
export class DistortionEffect extends Effect {
  constructor(audioContext) {
    super(audioContext, 'distortion');

    // Parameters
    this.distortionType = DistortionType.OVERDRIVE;
    this.drive = 5;           // 1-20 (amount of distortion)
    this.tone = 0.5;          // 0-1 (post-distortion tone control)
    this.bits = 16;           // 4-16 (bit depth for bitcrush)
    this.sampleRate = 44100;  // For bitcrush

    // Audio nodes
    this.preGain = audioContext.createGain();
    this.waveshaper = audioContext.createWaveShaper();
    this.toneFilter = audioContext.createBiquadFilter();
    this.postGain = audioContext.createGain();

    // Initialize
    this._initialize();
  }

  /**
   * Initialize effect chain
   */
  _initialize() {
    // Pre-gain (drive)
    this.preGain.gain.value = this.drive;

    // Waveshaper
    this._updateDistortionCurve();

    // Tone filter (lowpass for post-distortion tone)
    this.toneFilter.type = 'lowpass';
    this.toneFilter.frequency.value = 2000;
    this.toneFilter.Q.value = 0.5;
    this._updateTone();

    // Post-gain (compensate for drive)
    this.postGain.gain.value = 1 / Math.sqrt(this.drive);

    // Effect chain
    this.effectChain = [
      this.preGain,
      this.waveshaper,
      this.toneFilter,
      this.postGain,
    ];

    // Connect chain
    this._connectEffectChain();
  }

  /**
   * Create distortion curve
   */
  _createDistortionCurve(amount, type) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;

      switch (type) {
        case DistortionType.OVERDRIVE:
          // Soft clipping (tube-like)
          curve[i] = Math.tanh(x * amount);
          break;

        case DistortionType.FUZZ:
          // Hard clipping (transistor-like)
          curve[i] = Math.max(-1, Math.min(1, x * amount));
          break;

        case DistortionType.BITCRUSH:
          // Bit reduction (quantization)
          const steps = Math.pow(2, this.bits);
          const quantized = Math.round(x * amount * steps) / steps;
          curve[i] = Math.max(-1, Math.min(1, quantized));
          break;

        default:
          curve[i] = x;
      }
    }

    return curve;
  }

  /**
   * Update distortion curve
   */
  _updateDistortionCurve() {
    this.waveshaper.curve = this._createDistortionCurve(this.drive, this.distortionType);
    this.waveshaper.oversample = '4x'; // Reduce aliasing
  }

  /**
   * Update tone control
   */
  _updateTone() {
    // Map tone (0-1) to cutoff frequency (500-8000 Hz)
    const minFreq = 500;
    const maxFreq = 8000;
    const freq = minFreq + (this.tone * (maxFreq - minFreq));
    this.toneFilter.frequency.setValueAtTime(freq, this.audioContext.currentTime);
  }

  /**
   * Set distortion type
   */
  setDistortionType(type) {
    this.distortionType = type;
    this._updateDistortionCurve();
  }

  /**
   * Set drive amount
   */
  setDrive(drive) {
    this.drive = Math.max(1, Math.min(20, drive));
    this.preGain.gain.setValueAtTime(this.drive, this.audioContext.currentTime);
    this.postGain.gain.setValueAtTime(1 / Math.sqrt(this.drive), this.audioContext.currentTime);
    this._updateDistortionCurve();
  }

  /**
   * Set tone
   */
  setTone(tone) {
    this.tone = Math.max(0, Math.min(1, tone));
    this._updateTone();
  }

  /**
   * Set bit depth (for bitcrush)
   */
  setBits(bits) {
    this.bits = Math.max(4, Math.min(16, Math.round(bits)));
    if (this.distortionType === DistortionType.BITCRUSH) {
      this._updateDistortionCurve();
    }
  }

  /**
   * Set parameter
   */
  setParameter(paramName, value) {
    switch (paramName) {
      case 'type':
        this.setDistortionType(value);
        break;
      case 'drive':
        this.setDrive(value);
        break;
      case 'tone':
        this.setTone(value);
        break;
      case 'bits':
        this.setBits(value);
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
      case 'type':
        return this.distortionType;
      case 'drive':
        return this.drive;
      case 'tone':
        return this.tone;
      case 'bits':
        return this.bits;
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
      distortionType: this.distortionType,
      drive: this.drive,
      tone: this.tone,
      bits: this.bits,
    };
  }
}

export default DistortionEffect;
