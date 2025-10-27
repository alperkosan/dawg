/**
 * DelayEffect.js
 *
 * Stereo ping-pong delay effect.
 *
 * Features:
 * - Adjustable delay time
 * - Feedback control
 * - Ping-pong stereo mode
 * - Tempo sync (optional)
 */

import { Effect } from './Effect.js';

/**
 * DelayEffect class
 */
export class DelayEffect extends Effect {
  constructor(audioContext) {
    super(audioContext, 'delay');

    // Parameters
    this.time = 0.5;        // Delay time (seconds)
    this.feedback = 0.3;    // Feedback amount (0-1)
    this.pingPong = true;   // Ping-pong mode
    this.filter = 0.8;      // Feedback filter (0-1, controls dampening)

    // Audio nodes
    this.delayLeft = audioContext.createDelay(5);
    this.delayRight = audioContext.createDelay(5);
    this.feedbackLeft = audioContext.createGain();
    this.feedbackRight = audioContext.createGain();
    this.feedbackFilter = audioContext.createBiquadFilter();
    this.merger = audioContext.createChannelMerger(2);
    this.splitter = audioContext.createChannelSplitter(2);

    // Initialize
    this._initialize();
  }

  /**
   * Initialize effect chain
   */
  _initialize() {
    // Delay times
    this.delayLeft.delayTime.value = this.time;
    this.delayRight.delayTime.value = this.time;

    // Feedback gains
    this.feedbackLeft.gain.value = this.feedback;
    this.feedbackRight.gain.value = this.feedback;

    // Feedback filter (lowpass to simulate tape delay dampening)
    this.feedbackFilter.type = 'lowpass';
    this.feedbackFilter.frequency.value = 8000;
    this.feedbackFilter.Q.value = 0.5;
    this._updateFilter();

    // Connect ping-pong delay
    this._connectPingPong();

    // Effect chain (output from merger)
    this.effectChain = null;

    // Custom connection
    this._connectDelayChain();
  }

  /**
   * Connect ping-pong delay routing
   */
  _connectPingPong() {
    if (this.pingPong) {
      // Ping-pong mode: L → R → L → R...
      // Input → Splitter
      this.input.connect(this.splitter);

      // Left channel: Splitter[0] → DelayLeft → FeedbackLeft → Filter → DelayRight
      this.splitter.connect(this.delayLeft, 0);
      this.delayLeft.connect(this.feedbackLeft);
      this.feedbackLeft.connect(this.feedbackFilter);
      this.feedbackFilter.connect(this.delayRight);

      // Right channel: Splitter[1] → DelayRight → FeedbackRight → DelayLeft
      this.splitter.connect(this.delayRight, 1);
      this.delayRight.connect(this.feedbackRight);
      this.feedbackRight.connect(this.delayLeft);

      // Output: Delays → Merger
      this.delayLeft.connect(this.merger, 0, 0);
      this.delayRight.connect(this.merger, 0, 1);
    } else {
      // Normal stereo delay: L → L, R → R
      this.input.connect(this.splitter);

      // Left feedback loop
      this.splitter.connect(this.delayLeft, 0);
      this.delayLeft.connect(this.feedbackLeft);
      this.feedbackLeft.connect(this.feedbackFilter);
      this.feedbackFilter.connect(this.delayLeft);

      // Right feedback loop
      this.splitter.connect(this.delayRight, 1);
      this.delayRight.connect(this.feedbackRight);
      this.feedbackRight.connect(this.delayRight);

      // Output
      this.delayLeft.connect(this.merger, 0, 0);
      this.delayRight.connect(this.merger, 0, 1);
    }
  }

  /**
   * Connect delay chain
   */
  _connectDelayChain() {
    // Merger → Wet
    this.merger.connect(this.wetGain);

    // Dry signal
    this.input.connect(this.dryGain);

    // Mix to output
    this.wetGain.connect(this.output);
    this.dryGain.connect(this.output);
  }

  /**
   * Update feedback filter
   */
  _updateFilter() {
    // Map filter parameter (0-1) to cutoff frequency
    const minFreq = 1000;
    const maxFreq = 18000;
    const freq = minFreq + (this.filter * (maxFreq - minFreq));
    this.feedbackFilter.frequency.setValueAtTime(freq, this.audioContext.currentTime);
  }

  /**
   * Set delay time
   */
  setTime(time) {
    this.time = Math.max(0.01, Math.min(5, time));
    this.delayLeft.delayTime.setValueAtTime(this.time, this.audioContext.currentTime);
    this.delayRight.delayTime.setValueAtTime(this.time, this.audioContext.currentTime);
  }

  /**
   * Set feedback amount
   */
  setFeedback(feedback) {
    this.feedback = Math.max(0, Math.min(0.95, feedback));
    this.feedbackLeft.gain.setValueAtTime(this.feedback, this.audioContext.currentTime);
    this.feedbackRight.gain.setValueAtTime(this.feedback, this.audioContext.currentTime);
  }

  /**
   * Set ping-pong mode
   */
  setPingPong(pingPong) {
    if (this.pingPong === pingPong) return;

    this.pingPong = pingPong;

    // Disconnect all
    this._disconnectPingPong();

    // Reconnect with new mode
    this._connectPingPong();
  }

  /**
   * Disconnect ping-pong routing
   */
  _disconnectPingPong() {
    this.input.disconnect(this.splitter);
    this.splitter.disconnect();
    this.delayLeft.disconnect();
    this.delayRight.disconnect();
    this.feedbackLeft.disconnect();
    this.feedbackRight.disconnect();
    this.feedbackFilter.disconnect();
    this.merger.disconnect();
  }

  /**
   * Set filter
   */
  setFilter(filter) {
    this.filter = Math.max(0, Math.min(1, filter));
    this._updateFilter();
  }

  /**
   * Set parameter
   */
  setParameter(paramName, value) {
    switch (paramName) {
      case 'time':
        this.setTime(value);
        break;
      case 'feedback':
        this.setFeedback(value);
        break;
      case 'pingPong':
        this.setPingPong(value);
        break;
      case 'filter':
        this.setFilter(value);
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
      case 'time':
        return this.time;
      case 'feedback':
        return this.feedback;
      case 'pingPong':
        return this.pingPong;
      case 'filter':
        return this.filter;
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
      time: this.time,
      feedback: this.feedback,
      pingPong: this.pingPong,
      filter: this.filter,
    };
  }

  /**
   * Dispose
   */
  dispose() {
    this._disconnectPingPong();
    super.dispose();
  }
}

export default DelayEffect;
