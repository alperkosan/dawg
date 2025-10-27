/**
 * EffectChain.js
 *
 * Manages a chain of audio effects.
 * Supports up to 8 effects in series.
 *
 * Features:
 * - Add/remove effects
 * - Reorder effects
 * - Bypass individual effects
 * - Dry/wet mix per effect
 */

import { DistortionEffect } from './DistortionEffect.js';
import { ChorusEffect } from './ChorusEffect.js';
import { DelayEffect } from './DelayEffect.js';
import { ReverbEffect } from './ReverbEffect.js';
import { MaximizerEffect } from './MaximizerEffect.js';
import { ImagerEffect } from './ImagerEffect.js';

/**
 * EffectChain class
 */
export class EffectChain {
  constructor(audioContext, maxEffects = 8) {
    this.audioContext = audioContext;
    this.maxEffects = maxEffects;

    // Effect slots
    this.effects = [];

    // Input/Output nodes
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();

    // Connect input to output (default)
    this._updateChain();
  }

  /**
   * Add effect to chain
   */
  addEffect(effectType, options = {}) {
    if (this.effects.length >= this.maxEffects) {
      console.warn(`[EffectChain] Maximum effects (${this.maxEffects}) reached`);
      return null;
    }

    // Create effect
    const effect = this._createEffect(effectType, options);

    if (!effect) {
      console.warn(`[EffectChain] Unknown effect type: ${effectType}`);
      return null;
    }

    // Add to chain
    this.effects.push(effect);

    // Update routing
    this._updateChain();

    console.log(`[EffectChain] Added ${effectType} effect`);

    return effect;
  }

  /**
   * Create effect by type
   */
  _createEffect(effectType, options) {
    let effect = null;

    switch (effectType) {
      case 'distortion':
        effect = new DistortionEffect(this.audioContext);
        break;
      case 'chorus':
        effect = new ChorusEffect(this.audioContext);
        break;
      case 'delay':
        effect = new DelayEffect(this.audioContext);
        break;
      case 'reverb':
        effect = new ReverbEffect(this.audioContext);
        break;
      case 'maximizer':
        effect = new MaximizerEffect(this.audioContext);
        break;
      case 'imager':
        effect = new ImagerEffect(this.audioContext);
        break;
      default:
        return null;
    }

    // Apply options
    if (options && effect) {
      for (const [key, value] of Object.entries(options)) {
        effect.setParameter(key, value);
      }
    }

    return effect;
  }

  /**
   * Remove effect from chain
   */
  removeEffect(effectId) {
    const index = this.effects.findIndex(e => e.id === effectId);

    if (index === -1) {
      console.warn(`[EffectChain] Effect not found: ${effectId}`);
      return false;
    }

    // Get effect
    const effect = this.effects[index];

    // Dispose effect
    effect.dispose();

    // Remove from array
    this.effects.splice(index, 1);

    // Update routing
    this._updateChain();

    console.log(`[EffectChain] Removed effect: ${effectId}`);

    return true;
  }

  /**
   * Reorder effect
   */
  reorderEffect(effectId, newIndex) {
    const currentIndex = this.effects.findIndex(e => e.id === effectId);

    if (currentIndex === -1) {
      console.warn(`[EffectChain] Effect not found: ${effectId}`);
      return false;
    }

    // Clamp index
    newIndex = Math.max(0, Math.min(this.effects.length - 1, newIndex));

    if (currentIndex === newIndex) {
      return true; // No change
    }

    // Remove from current position
    const [effect] = this.effects.splice(currentIndex, 1);

    // Insert at new position
    this.effects.splice(newIndex, 0, effect);

    // Update routing
    this._updateChain();

    console.log(`[EffectChain] Reordered effect ${effectId}: ${currentIndex} → ${newIndex}`);

    return true;
  }

  /**
   * Update effect chain routing
   */
  _updateChain() {
    // Disconnect all
    this.input.disconnect();
    this.output.disconnect();

    for (const effect of this.effects) {
      effect.disconnect();
    }

    if (this.effects.length === 0) {
      // No effects - direct connection
      this.input.connect(this.output);
      return;
    }

    // Connect chain: Input → Effect1 → Effect2 → ... → Output
    let currentNode = this.input;

    for (const effect of this.effects) {
      currentNode.connect(effect.input);
      currentNode = effect.output;
    }

    // Connect last effect to output
    currentNode.connect(this.output);
  }

  /**
   * Get effect by ID
   */
  getEffect(effectId) {
    return this.effects.find(e => e.id === effectId);
  }

  /**
   * Get effect by index
   */
  getEffectAt(index) {
    return this.effects[index];
  }

  /**
   * Get all effects
   */
  getAllEffects() {
    return [...this.effects];
  }

  /**
   * Get effect count
   */
  getEffectCount() {
    return this.effects.length;
  }

  /**
   * Clear all effects
   */
  clearAll() {
    for (const effect of this.effects) {
      effect.dispose();
    }

    this.effects = [];
    this._updateChain();

    console.log('[EffectChain] All effects cleared');
  }

  /**
   * Bypass effect
   */
  bypassEffect(effectId, bypass) {
    const effect = this.getEffect(effectId);

    if (effect) {
      effect.setBypass(bypass);
    }
  }

  /**
   * Set effect parameter
   */
  setEffectParameter(effectId, paramName, value) {
    const effect = this.getEffect(effectId);

    if (effect) {
      effect.setParameter(paramName, value);
    }
  }

  /**
   * Get effect parameter
   */
  getEffectParameter(effectId, paramName) {
    const effect = this.getEffect(effectId);

    if (effect) {
      return effect.getParameter(paramName);
    }

    return null;
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
   * Get chain configuration
   */
  getConfiguration() {
    return {
      effects: this.effects.map(e => ({
        id: e.id,
        type: e.type,
        parameters: e.getParameters(),
      })),
    };
  }

  /**
   * Load configuration
   */
  loadConfiguration(config) {
    // Clear existing effects
    this.clearAll();

    // Add effects from config
    for (const effectConfig of config.effects) {
      const effect = this.addEffect(effectConfig.type);

      if (effect && effectConfig.parameters) {
        // Set parameters
        for (const [key, value] of Object.entries(effectConfig.parameters)) {
          effect.setParameter(key, value);
        }
      }
    }
  }

  /**
   * Dispose chain
   */
  dispose() {
    this.clearAll();
    this.input.disconnect();
    this.output.disconnect();
  }
}

export default EffectChain;
