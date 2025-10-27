/**
 * ImagerEffect.js
 *
 * Stereo imaging effect with Mid/Side processing.
 * Control stereo width from mono to ultra-wide.
 *
 * Features:
 * - Width control (0 = mono, 1 = normal, 2 = ultra wide)
 * - Mid/Side balance
 * - Phase correlation safe
 */

import { Effect } from './Effect.js';

/**
 * ImagerEffect class
 */
export class ImagerEffect extends Effect {
  constructor(audioContext) {
    super(audioContext, 'imager');

    // Parameters
    this.width = 1.0;        // 0-2 (0=mono, 1=normal, 2=ultra wide)
    this.midGain = 1.0;      // 0-2 (mid signal level)
    this.sideGain = 1.0;     // 0-2 (side signal level)

    // Audio nodes
    // Mid/Side encoding
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);

    // Mid channel (L+R)
    this.midGainNode = audioContext.createGain();

    // Side channel (L-R)
    this.sideGainNode = audioContext.createGain();
    this.sideInverter = audioContext.createGain();

    // Output summers
    this.leftSum = audioContext.createGain();
    this.rightSum = audioContext.createGain();

    // Initialize
    this._initialize();
  }

  /**
   * Initialize effect chain
   */
  _initialize() {
    // Set initial gains
    this._updateWidth();

    // Phase inversion for side channel
    this.sideInverter.gain.value = -1;

    // Build Mid/Side matrix
    // Input -> Splitter (L, R)
    this.input.connect(this.splitter);

    // Mid channel: (L + R) / 2
    // L channel
    this.splitter.connect(this.midGainNode, 0);
    // R channel (summed into mid)
    this.splitter.connect(this.midGainNode, 1);

    // Side channel: (L - R) / 2
    // L channel
    this.splitter.connect(this.sideGainNode, 0);
    // R channel (inverted and summed into side)
    this.splitter.connect(this.sideInverter, 1);
    this.sideInverter.connect(this.sideGainNode);

    // Decode back to L/R
    // Left = Mid + Side
    this.midGainNode.connect(this.leftSum);
    this.sideGainNode.connect(this.leftSum);

    // Right = Mid - Side
    this.midGainNode.connect(this.rightSum);

    // Create a second inverter for right channel side
    this.rightSideInverter = this.audioContext.createGain();
    this.rightSideInverter.gain.value = -1;
    this.sideGainNode.connect(this.rightSideInverter);
    this.rightSideInverter.connect(this.rightSum);

    // Connect to merger
    this.leftSum.connect(this.merger, 0, 0);
    this.rightSum.connect(this.merger, 0, 1);

    // Merger to output
    this.merger.connect(this.wetGain);

    // Dry signal
    this.input.connect(this.dryGain);

    // Mix to output
    this.wetGain.connect(this.output);
    this.dryGain.connect(this.output);
  }

  /**
   * Update width control
   * Width formula:
   * - 0.0 = mono (no side signal)
   * - 1.0 = normal stereo
   * - 2.0 = ultra wide (enhanced side)
   */
  _updateWidth() {
    const now = this.audioContext.currentTime;

    if (this.width <= 1.0) {
      // Narrow to normal (0-1)
      // Reduce side signal
      this.midGainNode.gain.setValueAtTime(0.5, now);
      this.sideGainNode.gain.setValueAtTime(0.5 * this.width, now);
    } else {
      // Widen (1-2)
      // Enhance side signal
      const widthFactor = (this.width - 1.0); // 0-1 range
      this.midGainNode.gain.setValueAtTime(0.5 * (1 - widthFactor * 0.3), now); // Slightly reduce mid
      this.sideGainNode.gain.setValueAtTime(0.5 * (1 + widthFactor), now); // Boost side
    }
  }

  /**
   * Update mid/side balance
   */
  _updateMidSideBalance() {
    const now = this.audioContext.currentTime;

    // Apply manual mid/side adjustments on top of width
    const midMult = this.midGain;
    const sideMult = this.sideGain;

    const currentMid = this.midGainNode.gain.value;
    const currentSide = this.sideGainNode.gain.value;

    this.midGainNode.gain.setValueAtTime(currentMid * midMult, now);
    this.sideGainNode.gain.setValueAtTime(currentSide * sideMult, now);
  }

  /**
   * Set width (0-2)
   */
  setWidth(width) {
    this.width = Math.max(0, Math.min(2, width));
    this._updateWidth();
  }

  /**
   * Set mid gain (0-2)
   */
  setMidGain(gain) {
    this.midGain = Math.max(0, Math.min(2, gain));
    this._updateMidSideBalance();
  }

  /**
   * Set side gain (0-2)
   */
  setSideGain(gain) {
    this.sideGain = Math.max(0, Math.min(2, gain));
    this._updateMidSideBalance();
  }

  /**
   * Set parameter
   */
  setParameter(paramName, value) {
    switch (paramName) {
      case 'width':
        this.setWidth(value);
        break;
      case 'midGain':
        this.setMidGain(value);
        break;
      case 'sideGain':
        this.setSideGain(value);
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
      case 'width':
        return this.width;
      case 'midGain':
        return this.midGain;
      case 'sideGain':
        return this.sideGain;
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
      width: this.width,
      midGain: this.midGain,
      sideGain: this.sideGain,
    };
  }

  /**
   * Override dispose to clean up extra nodes
   */
  dispose() {
    super.dispose();

    if (this.splitter) this.splitter.disconnect();
    if (this.merger) this.merger.disconnect();
    if (this.midGainNode) this.midGainNode.disconnect();
    if (this.sideGainNode) this.sideGainNode.disconnect();
    if (this.sideInverter) this.sideInverter.disconnect();
    if (this.rightSideInverter) this.rightSideInverter.disconnect();
    if (this.leftSum) this.leftSum.disconnect();
    if (this.rightSum) this.rightSum.disconnect();
  }
}

export default ImagerEffect;
