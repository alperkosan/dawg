/**
 * EFFECT FACTORY
 *
 * Centralized factory for creating and managing effects.
 * Handles effect instantiation, presets, and serialization.
 */

import { WaveshaperEffect } from './WaveshaperEffect.js';
import { DelayEffect } from './DelayEffect.js';
import { ReverbEffect } from './ReverbEffect.js';

export class EffectFactory {
  static effectTypes = {
    waveshaper: WaveshaperEffect,
    delay: DelayEffect,
    reverb: ReverbEffect
  };

  /**
   * Create effect instance by type
   */
  static createEffect(context, type, preset = null) {
    const EffectClass = this.effectTypes[type];

    if (!EffectClass) {
      console.error(`Unknown effect type: ${type}`);
      return null;
    }

    const effect = new EffectClass(context);

    // Apply preset if provided
    if (preset) {
      effect.setParametersState(preset);
    }

    console.log(`🎨 Factory created effect: ${effect.name} (${type})`);
    return effect;
  }

  /**
   * Get available effect types
   */
  static getAvailableEffects() {
    return Object.keys(this.effectTypes).map(type => ({
      type,
      name: this.effectTypes[type].name || type,
      description: this._getEffectDescription(type)
    }));
  }

  /**
   * Get effect description
   */
  static _getEffectDescription(type) {
    const descriptions = {
      waveshaper: 'Distortion and saturation for aggressive sound design',
      delay: 'Echo effect with feedback and ping-pong',
      reverb: 'Room and hall simulation for spatial depth'
    };
    return descriptions[type] || '';
  }

  /**
   * Get effect presets
   */
  static getPresets(type) {
    const EffectClass = this.effectTypes[type];
    if (!EffectClass) return [];

    const presets = [];

    // Check for static preset methods
    if (type === 'waveshaper') {
      presets.push(
        { name: 'Kick Boost', params: WaveshaperEffect.presetKickBoost() },
        { name: 'Warm Saturation', params: WaveshaperEffect.presetWarmSaturation() },
        { name: 'Hard Distortion', params: WaveshaperEffect.presetHardDistortion() }
      );
    } else if (type === 'delay') {
      presets.push(
        { name: 'Slapback', params: DelayEffect.presetSlapback() },
        { name: 'Rhythmic', params: DelayEffect.presetRhythmic() },
        { name: 'Janito Drop', params: DelayEffect.presetJanitoDrop() }
      );
    } else if (type === 'reverb') {
      presets.push(
        { name: 'Small Room', params: ReverbEffect.presetSmallRoom() },
        { name: 'Large Hall', params: ReverbEffect.presetLargeHall() },
        { name: 'Vocal', params: ReverbEffect.presetVocal() }
      );
    }

    return presets;
  }

  /**
   * Deserialize effect from saved state
   */
  static deserialize(data, context) {
    const effect = this.createEffect(context, data.type);
    if (!effect) return null;

    effect.id = data.id;
    effect.enabled = data.enabled ?? true;
    effect.setParametersState(data.parameters);

    return effect;
  }
}

/**
 * SOUNDGOODIZER PRESET
 *
 * FL Studio-style "one-knob enhancer" using effect chain.
 * Combines compression, saturation, and EQ for instant improvement.
 */
export class SoundGoodizerPreset {
  /**
   * Create Soundgoodizer effect chain
   * @param {AudioContext} context
   * @param {number} amount - 0 to 1 (0 = off, 1 = maximum)
   */
  static create(context, amount = 0.5) {
    const effects = [];

    // 1. Waveshaper for warmth and harmonics
    const saturation = EffectFactory.createEffect(context, 'waveshaper');
    saturation.setParametersState({
      drive: 1 + amount * 4, // 1 to 5
      mix: 0.3 + amount * 0.4, // 30% to 70%
      curve: 'tube',
      outputGain: 1.0
    });
    effects.push(saturation);

    // 2. Subtle reverb for space
    if (amount > 0.3) {
      const reverb = EffectFactory.createEffect(context, 'reverb');
      reverb.setParametersState({
        roomSize: 0.2 + amount * 0.3,
        damping: 0.6,
        mix: 0.1 + amount * 0.15,
        preDelay: 0.01
      });
      effects.push(reverb);
    }

    console.log(`🎛️ Created Soundgoodizer preset with amount ${amount}`);
    return effects;
  }
}
