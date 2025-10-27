/**
 * ReverbEffect.js
 *
 * Algorithmic reverb effect using Freeverb-style approach.
 * Creates space and ambience.
 *
 * Features:
 * - Adjustable room size
 * - Decay/damping control
 * - Pre-delay
 * - Multi-tap comb filters
 */

import { Effect } from './Effect.js';

/**
 * ReverbEffect class
 */
export class ReverbEffect extends Effect {
  constructor(audioContext) {
    super(audioContext, 'reverb');

    // Parameters
    this.roomSize = 0.5;    // 0-1 (affects decay time)
    this.damping = 0.5;     // 0-1 (high frequency absorption)
    this.preDelay = 0.02;   // Pre-delay time (seconds)

    // Audio nodes
    this.preDelayNode = null;
    this.combFilters = [];
    this.allpassFilters = [];
    this.dampingFilter = null;
    this.reverbGain = null;

    // Initialize
    this._initialize();
  }

  /**
   * Initialize effect chain
   */
  _initialize() {
    // Pre-delay (early reflections delay)
    this.preDelayNode = this.audioContext.createDelay(0.2);
    this.preDelayNode.delayTime.value = this.preDelay;

    // Damping filter (absorbs high frequencies)
    this.dampingFilter = this.audioContext.createBiquadFilter();
    this.dampingFilter.type = 'lowpass';
    this._updateDamping();

    // Reverb gain
    this.reverbGain = this.audioContext.createGain();
    this.reverbGain.gain.value = 0.5;

    // Create comb filters (parallel)
    const combDelayTimes = [0.0297, 0.0371, 0.0411, 0.0437, 0.005, 0.0017, 0.0013, 0.00011];
    for (const delayTime of combDelayTimes) {
      const comb = this._createCombFilter(delayTime);
      this.combFilters.push(comb);
    }

    // Create allpass filters (series)
    const allpassDelayTimes = [0.005, 0.0017, 0.0013, 0.00011];
    for (const delayTime of allpassDelayTimes) {
      const allpass = this._createAllpassFilter(delayTime);
      this.allpassFilters.push(allpass);
    }

    // Connect reverb chain
    this._connectReverbChain();
  }

  /**
   * Create comb filter
   */
  _createCombFilter(delayTime) {
    const delay = this.audioContext.createDelay(1);
    const feedback = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    delay.delayTime.value = delayTime * (1 + this.roomSize);
    feedback.gain.value = 0.84 * this.roomSize;

    // Connect: Input → Delay → Feedback → Delay (loop)
    delay.connect(feedback);
    feedback.connect(delay);

    // Output
    delay.connect(output);

    return {
      input: delay,
      delay,
      feedback,
      output,
    };
  }

  /**
   * Create allpass filter
   */
  _createAllpassFilter(delayTime) {
    const delay = this.audioContext.createDelay(1);
    const feedback = this.audioContext.createGain();
    const feedforward = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    delay.delayTime.value = delayTime;
    feedback.gain.value = 0.5;
    feedforward.gain.value = -0.5;

    // Allpass structure
    // Input → Delay → Feedback → Delay (loop)
    delay.connect(feedback);
    feedback.connect(delay);

    // Output = Input + (-Delay)
    delay.connect(feedforward);
    feedforward.connect(output);

    return {
      input: delay,
      delay,
      feedback,
      feedforward,
      output,
    };
  }

  /**
   * Connect reverb chain
   */
  _connectReverbChain() {
    // Input → Pre-delay
    this.input.connect(this.preDelayNode);

    // Pre-delay → All comb filters (parallel)
    for (const comb of this.combFilters) {
      this.preDelayNode.connect(comb.input);
      // Also send input signal
      this.preDelayNode.connect(comb.input);
    }

    // Comb filters → Damping filter
    for (const comb of this.combFilters) {
      comb.output.connect(this.dampingFilter);
    }

    // Damping filter → Allpass filters (series)
    let currentNode = this.dampingFilter;
    for (const allpass of this.allpassFilters) {
      currentNode.connect(allpass.input);
      // Also send to input
      currentNode.connect(allpass.input);
      currentNode = allpass.output;
    }

    // Allpass chain → Reverb gain → Wet
    currentNode.connect(this.reverbGain);
    this.reverbGain.connect(this.wetGain);

    // Dry signal
    this.input.connect(this.dryGain);

    // Mix to output
    this.wetGain.connect(this.output);
    this.dryGain.connect(this.output);
  }

  /**
   * Update damping filter
   */
  _updateDamping() {
    // Map damping (0-1) to cutoff frequency
    const minFreq = 1000;
    const maxFreq = 18000;
    const freq = maxFreq - (this.damping * (maxFreq - minFreq));
    this.dampingFilter.frequency.setValueAtTime(freq, this.audioContext.currentTime);
  }

  /**
   * Update room size
   */
  _updateRoomSize() {
    // Update comb filter delay times and feedback
    const baseTimes = [0.0297, 0.0371, 0.0411, 0.0437, 0.005, 0.0017, 0.0013, 0.00011];

    for (let i = 0; i < this.combFilters.length; i++) {
      const comb = this.combFilters[i];
      const baseTime = baseTimes[i];

      comb.delay.delayTime.setValueAtTime(
        baseTime * (1 + this.roomSize),
        this.audioContext.currentTime
      );

      comb.feedback.gain.setValueAtTime(
        0.84 * this.roomSize,
        this.audioContext.currentTime
      );
    }
  }

  /**
   * Set room size
   */
  setRoomSize(roomSize) {
    this.roomSize = Math.max(0, Math.min(1, roomSize));
    this._updateRoomSize();
  }

  /**
   * Set damping
   */
  setDamping(damping) {
    this.damping = Math.max(0, Math.min(1, damping));
    this._updateDamping();
  }

  /**
   * Set pre-delay
   */
  setPreDelay(preDelay) {
    this.preDelay = Math.max(0, Math.min(0.2, preDelay));
    this.preDelayNode.delayTime.setValueAtTime(this.preDelay, this.audioContext.currentTime);
  }

  /**
   * Set parameter
   */
  setParameter(paramName, value) {
    switch (paramName) {
      case 'roomSize':
        this.setRoomSize(value);
        break;
      case 'damping':
        this.setDamping(value);
        break;
      case 'preDelay':
        this.setPreDelay(value);
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
      case 'roomSize':
        return this.roomSize;
      case 'damping':
        return this.damping;
      case 'preDelay':
        return this.preDelay;
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
      roomSize: this.roomSize,
      damping: this.damping,
      preDelay: this.preDelay,
    };
  }

  /**
   * Dispose
   */
  dispose() {
    // Disconnect comb filters
    for (const comb of this.combFilters) {
      comb.delay.disconnect();
      comb.feedback.disconnect();
      comb.output.disconnect();
    }

    // Disconnect allpass filters
    for (const allpass of this.allpassFilters) {
      allpass.delay.disconnect();
      allpass.feedback.disconnect();
      allpass.feedforward.disconnect();
      allpass.output.disconnect();
    }

    if (this.preDelayNode) this.preDelayNode.disconnect();
    if (this.dampingFilter) this.dampingFilter.disconnect();
    if (this.reverbGain) this.reverbGain.disconnect();

    super.dispose();
  }
}

export default ReverbEffect;
