/**
 * Effect.js
 *
 * Base class for audio effects.
 * All effects inherit from this class.
 *
 * Features:
 * - Input/Output nodes
 * - Bypass
 * - Wet/Dry mix
 * - Enable/Disable
 */

/**
 * Effect base class
 */
export class Effect {
  constructor(audioContext, type) {
    this.audioContext = audioContext;
    this.type = type;
    this.id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Audio nodes
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();

    // Wet/Dry mix nodes
    this.wetGain = audioContext.createGain();
    this.dryGain = audioContext.createGain();

    // Effect processing chain (override in subclasses)
    this.effectChain = null;

    // State
    this.enabled = true;
    this.bypass = false;

    // Parameters
    this.mix = 0.5; // 0 = fully dry, 1 = fully wet

    // Set initial mix
    this._updateMix();
  }

  /**
   * Initialize effect chain (override in subclasses)
   */
  _initializeEffectChain() {
    // Override in subclasses to create effect nodes
    // Example:
    // this.effectChain = this.audioContext.createBiquadFilter();
  }

  /**
   * Connect effect chain
   */
  _connectEffectChain() {
    if (!this.effectChain) {
      // No effect chain - direct connection
      this.input.connect(this.wetGain);
    } else if (Array.isArray(this.effectChain)) {
      // Multiple nodes in chain
      this.input.connect(this.effectChain[0]);

      for (let i = 0; i < this.effectChain.length - 1; i++) {
        this.effectChain[i].connect(this.effectChain[i + 1]);
      }

      this.effectChain[this.effectChain.length - 1].connect(this.wetGain);
    } else {
      // Single node
      this.input.connect(this.effectChain);
      this.effectChain.connect(this.wetGain);
    }

    // Dry signal (bypass effect chain)
    this.input.connect(this.dryGain);

    // Mix to output
    this.wetGain.connect(this.output);
    this.dryGain.connect(this.output);
  }

  /**
   * Update wet/dry mix
   */
  _updateMix() {
    if (this.bypass) {
      // Full dry when bypassed
      this.wetGain.gain.value = 0;
      this.dryGain.gain.value = 1;
    } else {
      // Mix based on parameter
      this.wetGain.gain.value = this.mix;
      this.dryGain.gain.value = 1 - this.mix;
    }
  }

  /**
   * Set mix (0-1)
   */
  setMix(mix) {
    this.mix = Math.max(0, Math.min(1, mix));
    this._updateMix();
  }

  /**
   * Get mix
   */
  getMix() {
    return this.mix;
  }

  /**
   * Enable effect
   */
  enable() {
    this.enabled = true;
    this.bypass = false;
    this._updateMix();
  }

  /**
   * Disable effect
   */
  disable() {
    this.enabled = false;
    this.bypass = true;
    this._updateMix();
  }

  /**
   * Set bypass
   */
  setBypass(bypass) {
    this.bypass = bypass;
    this._updateMix();
  }

  /**
   * Get bypass state
   */
  isBypassed() {
    return this.bypass;
  }

  /**
   * Get enabled state
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Set parameter (override in subclasses)
   */
  setParameter(paramName, value) {
    if (paramName === 'mix') {
      this.setMix(value);
    } else if (paramName === 'bypass') {
      this.setBypass(value);
    }
    // Override in subclasses for effect-specific parameters
  }

  /**
   * Get parameter (override in subclasses)
   */
  getParameter(paramName) {
    if (paramName === 'mix') {
      return this.mix;
    } else if (paramName === 'bypass') {
      return this.bypass;
    }
    return null;
  }

  /**
   * Get all parameters (override in subclasses)
   */
  getParameters() {
    return {
      type: this.type,
      mix: this.mix,
      bypass: this.bypass,
      enabled: this.enabled,
    };
  }

  /**
   * Connect to destination
   */
  connect(destination) {
    this.output.connect(destination);
  }

  /**
   * Disconnect
   */
  disconnect() {
    this.output.disconnect();
  }

  /**
   * Connect from source
   */
  connectFrom(source) {
    source.connect(this.input);
  }

  /**
   * Dispose effect
   */
  dispose() {
    this.disconnect();

    if (this.input) this.input.disconnect();
    if (this.output) this.output.disconnect();
    if (this.wetGain) this.wetGain.disconnect();
    if (this.dryGain) this.dryGain.disconnect();

    if (this.effectChain) {
      if (Array.isArray(this.effectChain)) {
        this.effectChain.forEach(node => {
          if (node && node.disconnect) node.disconnect();
        });
      } else if (this.effectChain.disconnect) {
        this.effectChain.disconnect();
      }
    }

    this.effectChain = null;
  }
}

export default Effect;
