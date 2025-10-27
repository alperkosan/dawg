/**
 * ADSRPlusEnvelope.js
 *
 * Advanced ADSR+ Envelope Generator
 * ADSR with additional Delay and Hold stages
 *
 * Stages: Delay → Attack → Hold → Decay → Sustain → Release
 */

/**
 * Envelope curve types
 */
export const EnvelopeCurve = {
  LINEAR: 'linear',
  EXPONENTIAL: 'exponential',
  LOGARITHMIC: 'logarithmic',
};

/**
 * ADSR+ Envelope
 */
export class ADSRPlusEnvelope {
  constructor(audioContext) {
    this.audioContext = audioContext;

    // Envelope parameters
    this.delay = 0;
    this.attack = 0.01;
    this.hold = 0;
    this.decay = 0.1;
    this.sustain = 0.7;
    this.release = 0.3;

    // Velocity sensitivity (0-1)
    this.velocitySensitivity = 0.5;

    // Curve types per stage
    this.attackCurve = EnvelopeCurve.LINEAR;
    this.decayCurve = EnvelopeCurve.EXPONENTIAL;
    this.releaseCurve = EnvelopeCurve.EXPONENTIAL;

    // Minimum value (to avoid exponential ramp errors)
    this.minValue = 0.0001;
  }

  /**
   * Trigger envelope (note on)
   */
  trigger(audioParam, velocity = 1.0, time = null) {
    if (!audioParam) return;

    const startTime = time || this.audioContext.currentTime;

    // Cancel any pending automation
    audioParam.cancelScheduledValues(startTime);

    // Apply velocity to peak level
    const velocityFactor = 1.0 - this.velocitySensitivity + (this.velocitySensitivity * velocity);
    const peakLevel = velocityFactor;

    // Stage 1: Delay
    let currentTime = startTime;

    if (this.delay > 0) {
      audioParam.setValueAtTime(this.minValue, currentTime);
      currentTime += this.delay;
    }

    // Stage 2: Attack
    audioParam.setValueAtTime(this.minValue, currentTime);

    if (this.attack > 0) {
      this._rampToValue(audioParam, peakLevel, currentTime, this.attack, this.attackCurve);
      currentTime += this.attack;
    } else {
      audioParam.setValueAtTime(peakLevel, currentTime);
    }

    // Stage 3: Hold
    if (this.hold > 0) {
      audioParam.setValueAtTime(peakLevel, currentTime);
      currentTime += this.hold;
    }

    // Stage 4: Decay
    const sustainLevel = this.sustain * peakLevel;

    if (this.decay > 0 && sustainLevel < peakLevel) {
      this._rampToValue(audioParam, Math.max(sustainLevel, this.minValue), currentTime, this.decay, this.decayCurve);
      currentTime += this.decay;
    }

    // Stage 5: Sustain
    audioParam.setValueAtTime(Math.max(sustainLevel, this.minValue), currentTime);
  }

  /**
   * Release envelope (note off)
   */
  release(audioParam, time = null) {
    if (!audioParam) return;

    const releaseTime = time || this.audioContext.currentTime;

    // Cancel future scheduled values
    audioParam.cancelScheduledValues(releaseTime);

    // Get current value
    const currentValue = audioParam.value;

    // Stage 6: Release
    audioParam.setValueAtTime(currentValue, releaseTime);

    if (this.release > 0) {
      this._rampToValue(audioParam, this.minValue, releaseTime, this.release, this.releaseCurve);
    } else {
      audioParam.setValueAtTime(this.minValue, releaseTime);
    }
  }

  /**
   * Ramp to value with curve
   */
  _rampToValue(audioParam, targetValue, startTime, duration, curve) {
    const endTime = startTime + duration;

    switch (curve) {
      case EnvelopeCurve.EXPONENTIAL:
        // Exponential ramp (ensure target is not 0)
        const safeTarget = Math.max(targetValue, this.minValue);
        audioParam.exponentialRampToValueAtTime(safeTarget, endTime);
        break;

      case EnvelopeCurve.LOGARITHMIC:
        // Logarithmic ramp (use setValueCurveAtTime for custom curve)
        this._logarithmicRamp(audioParam, targetValue, startTime, duration);
        break;

      case EnvelopeCurve.LINEAR:
      default:
        audioParam.linearRampToValueAtTime(targetValue, endTime);
        break;
    }
  }

  /**
   * Logarithmic ramp using setValueCurveAtTime
   */
  _logarithmicRamp(audioParam, targetValue, startTime, duration) {
    const currentValue = audioParam.value;
    const sampleRate = this.audioContext.sampleRate;
    const numSamples = Math.floor(duration * sampleRate);

    if (numSamples <= 1) {
      audioParam.setValueAtTime(targetValue, startTime + duration);
      return;
    }

    const curve = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / (numSamples - 1);
      const logT = Math.log(1 + t * 9) / Math.log(10); // log curve (0 to 1)
      curve[i] = currentValue + (targetValue - currentValue) * logT;
    }

    audioParam.setValueCurveAtTime(curve, startTime, duration);
  }

  /**
   * Stop envelope immediately
   */
  stop(audioParam, time = null) {
    if (!audioParam) return;

    const stopTime = time || this.audioContext.currentTime;
    audioParam.cancelScheduledValues(stopTime);
    audioParam.setValueAtTime(this.minValue, stopTime);
  }

  /**
   * Set parameters
   */
  setParameters(params) {
    if (params.delay !== undefined) this.delay = params.delay;
    if (params.attack !== undefined) this.attack = params.attack;
    if (params.hold !== undefined) this.hold = params.hold;
    if (params.decay !== undefined) this.decay = params.decay;
    if (params.sustain !== undefined) this.sustain = params.sustain;
    if (params.release !== undefined) this.release = params.release;
    if (params.velocity !== undefined) this.velocitySensitivity = params.velocity;
    if (params.attackCurve !== undefined) this.attackCurve = params.attackCurve;
    if (params.decayCurve !== undefined) this.decayCurve = params.decayCurve;
    if (params.releaseCurve !== undefined) this.releaseCurve = params.releaseCurve;
  }

  /**
   * Get total envelope time (without sustain)
   */
  getTotalTime() {
    return this.delay + this.attack + this.hold + this.decay + this.release;
  }

  /**
   * Get attack time (delay + attack + hold)
   */
  getAttackTime() {
    return this.delay + this.attack + this.hold;
  }

  /**
   * Get release time
   */
  getReleaseTime() {
    return this.release;
  }
}

export default ADSRPlusEnvelope;
