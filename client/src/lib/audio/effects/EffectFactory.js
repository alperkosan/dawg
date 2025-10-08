/**
 * EFFECT FACTORY
 *
 * Centralized factory for creating and managing effects.
 * Handles effect instantiation, presets, and serialization.
 */

import { WaveshaperEffect } from './WaveshaperEffect.js';
import { DelayEffect } from './DelayEffect.js';
import { ReverbEffect } from './ReverbEffect.js';
import { WorkletEffect } from './WorkletEffect.js';
import { ModernReverbEffect } from './ModernReverbEffect.js';
import { ModernDelayEffect } from './ModernDelayEffect.js';

export class EffectFactory {
  // Worklet-based effects parameter definitions
  static workletEffects = {
    'compressor': {
      workletName: 'compressor-processor',
      displayName: 'Compressor',
      params: {
        threshold: { label: 'Threshold', defaultValue: -24, min: -60, max: 0, unit: ' dB' },
        ratio: { label: 'Ratio', defaultValue: 4, min: 1, max: 20, unit: ':1' },
        attack: { label: 'Attack', defaultValue: 0.003, min: 0.0001, max: 1, unit: 's' },
        release: { label: 'Release', defaultValue: 0.25, min: 0.001, max: 3, unit: 's' },
        knee: { label: 'Knee', defaultValue: 30, min: 0, max: 40, unit: ' dB' },
        wet: { label: 'Mix', defaultValue: 1.0, min: 0, max: 1, unit: '' }
      }
    },
    'saturator': {
      workletName: 'saturator-processor',
      displayName: 'Saturator',
      params: {
        drive: { label: 'Drive', defaultValue: 5, min: 1, max: 20, unit: '' },
        tone: { label: 'Tone', defaultValue: 0.5, min: 0, max: 1, unit: '' },
        wet: { label: 'Mix', defaultValue: 0.5, min: 0, max: 1, unit: '' }
      }
    },
    'multiband-eq': {
      workletName: 'multiband-eq-processor',
      displayName: 'Multiband EQ',
      params: {
        lowGain: { label: 'Low', defaultValue: 0, min: -24, max: 24, unit: ' dB' },
        midGain: { label: 'Mid', defaultValue: 0, min: -24, max: 24, unit: ' dB' },
        highGain: { label: 'High', defaultValue: 0, min: -24, max: 24, unit: ' dB' },
        lowFreq: { label: 'Low Freq', defaultValue: 250, min: 20, max: 1000, unit: ' Hz' },
        highFreq: { label: 'High Freq', defaultValue: 4000, min: 1000, max: 16000, unit: ' Hz' }
      }
    },
    'bass-enhancer': {
      workletName: 'bass-enhancer-808-processor',
      displayName: 'Bass Enhancer 808',
      params: {
        subGain: { label: 'Sub', defaultValue: 0, min: -12, max: 12, unit: ' dB' },
        harmonic: { label: 'Harmonic', defaultValue: 0.3, min: 0, max: 1, unit: '' },
        saturation: { label: 'Saturation', defaultValue: 0.2, min: 0, max: 1, unit: '' }
      }
    },
    'feedback-delay': {
      workletName: 'feedback-delay-processor',
      displayName: 'Feedback Delay',
      params: {
        delayTime: { label: 'Time', defaultValue: 0.25, min: 0.001, max: 2, unit: 's' },
        feedback: { label: 'Feedback', defaultValue: 0.5, min: 0, max: 0.95, unit: '' },
        filterFreq: { label: 'Filter', defaultValue: 2000, min: 200, max: 8000, unit: ' Hz' },
        wet: { label: 'Mix', defaultValue: 0.3, min: 0, max: 1, unit: '' }
      }
    },
    'atmos-machine': {
      workletName: 'atmos-machine-processor',
      displayName: 'Atmos Machine',
      params: {
        depth: { label: 'Depth', defaultValue: 0.5, min: 0, max: 1, unit: '' },
        shimmer: { label: 'Shimmer', defaultValue: 0.3, min: 0, max: 1, unit: '' },
        diffusion: { label: 'Diffusion', defaultValue: 0.7, min: 0, max: 1, unit: '' },
        wet: { label: 'Mix', defaultValue: 0.4, min: 0, max: 1, unit: '' }
      }
    },
    'stardust-chorus': {
      workletName: 'stardust-chorus-processor',
      displayName: 'Stardust Chorus',
      params: {
        rate: { label: 'Rate', defaultValue: 0.5, min: 0.1, max: 5, unit: ' Hz' },
        depth: { label: 'Depth', defaultValue: 0.5, min: 0, max: 1, unit: '' },
        feedback: { label: 'Feedback', defaultValue: 0.3, min: 0, max: 0.9, unit: '' },
        wet: { label: 'Mix', defaultValue: 0.5, min: 0, max: 1, unit: '' }
      }
    },
    'vortex-phaser': {
      workletName: 'vortex-phaser-processor',
      displayName: 'Vortex Phaser',
      params: {
        rate: { label: 'Rate', defaultValue: 0.3, min: 0.05, max: 10, unit: ' Hz' },
        depth: { label: 'Depth', defaultValue: 0.6, min: 0, max: 1, unit: '' },
        feedback: { label: 'Feedback', defaultValue: 0.7, min: 0, max: 0.95, unit: '' },
        wet: { label: 'Mix', defaultValue: 0.5, min: 0, max: 1, unit: '' }
      }
    },
    'tidal-filter': {
      workletName: 'tidal-filter-processor',
      displayName: 'Tidal Filter',
      params: {
        cutoff: { label: 'Cutoff', defaultValue: 1000, min: 100, max: 10000, unit: ' Hz' },
        resonance: { label: 'Resonance', defaultValue: 5, min: 0.1, max: 20, unit: '' },
        modRate: { label: 'Mod Rate', defaultValue: 0.25, min: 0.05, max: 5, unit: ' Hz' },
        modDepth: { label: 'Mod Depth', defaultValue: 0.5, min: 0, max: 1, unit: '' }
      }
    },
    'ghost-lfo': {
      workletName: 'ghost-lfo-processor',
      displayName: 'Ghost LFO',
      params: {
        rate: { label: 'Rate', defaultValue: 1, min: 0.1, max: 20, unit: ' Hz' },
        amount: { label: 'Amount', defaultValue: 0.5, min: 0, max: 1, unit: '' },
        waveform: { label: 'Waveform', defaultValue: 0, min: 0, max: 3, unit: '' }
      }
    },
    'orbit-panner': {
      workletName: 'orbit-panner-processor',
      displayName: 'Orbit Panner',
      params: {
        rate: { label: 'Rate', defaultValue: 0.5, min: 0.05, max: 10, unit: ' Hz' },
        depth: { label: 'Depth', defaultValue: 0.8, min: 0, max: 1, unit: '' },
        shape: { label: 'Shape', defaultValue: 0, min: 0, max: 3, unit: '' }
      }
    },
    'arcade-crusher': {
      workletName: 'arcade-crusher-processor',
      displayName: 'Arcade Crusher',
      params: {
        bits: { label: 'Bits', defaultValue: 8, min: 1, max: 16, unit: '' },
        sampleRate: { label: 'Sample Rate', defaultValue: 8000, min: 500, max: 44100, unit: ' Hz' },
        wet: { label: 'Mix', defaultValue: 0.5, min: 0, max: 1, unit: '' }
      }
    },
    'pitch-shifter': {
      workletName: 'pitch-shifter-processor',
      displayName: 'Pitch Shifter',
      params: {
        pitch: { label: 'Pitch', defaultValue: 0, min: -24, max: 24, unit: ' st' },
        wet: { label: 'Mix', defaultValue: 0.5, min: 0, max: 1, unit: '' }
      }
    },
    'sample-morph': {
      workletName: 'sample-morph-processor',
      displayName: 'Sample Morph',
      params: {
        morph: { label: 'Morph', defaultValue: 0.5, min: 0, max: 1, unit: '' },
        grain: { label: 'Grain Size', defaultValue: 0.05, min: 0.01, max: 0.2, unit: 's' }
      }
    },
    'sidechain-compressor': {
      workletName: 'sidechain-compressor-processor',
      displayName: 'Sidechain Compressor',
      params: {
        threshold: { label: 'Threshold', defaultValue: -20, min: -60, max: 0, unit: ' dB' },
        ratio: { label: 'Ratio', defaultValue: 4, min: 1, max: 20, unit: ':1' },
        attack: { label: 'Attack', defaultValue: 0.001, min: 0.0001, max: 0.1, unit: 's' },
        release: { label: 'Release', defaultValue: 0.1, min: 0.01, max: 1, unit: 's' }
      }
    }
  };

  static effectTypes = {
    waveshaper: WaveshaperEffect,
    delay: DelayEffect,
    reverb: ReverbEffect,
    'modern-reverb': ModernReverbEffect,
    'modern-delay': ModernDelayEffect
  };

  /**
   * Create effect instance by type
   */
  static createEffect(context, type, preset = null) {
    // Check if it's a worklet effect
    const workletDef = this.workletEffects[type];
    if (workletDef) {
      const effect = new WorkletEffect(
        context,
        workletDef.workletName,
        workletDef.displayName,
        workletDef.params
      );

      // Apply preset if provided
      if (preset) {
        effect.setParametersState(preset);
      }

      console.log(`🎨 Factory created worklet effect: ${effect.name} (${type})`);
      return effect;
    }

    // Check if it's a legacy effect
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
      reverb: 'Room and hall simulation for spatial depth',
      'modern-reverb': 'Professional algorithmic reverb with Freeverb engine and early reflections',
      'modern-delay': 'Multi-tap stereo delay with ping-pong, filtering, and modulation'
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
    } else if (type === 'modern-reverb') {
      presets.push(
        { name: 'Small Room', params: ModernReverbEffect.presetSmallRoom() },
        { name: 'Medium Hall', params: ModernReverbEffect.presetMediumHall() },
        { name: 'Large Cathedral', params: ModernReverbEffect.presetLargeCathedral() },
        { name: 'Plate', params: ModernReverbEffect.presetPlate() },
        { name: 'Vocal', params: ModernReverbEffect.presetVocal() },
        { name: 'Drum', params: ModernReverbEffect.presetDrum() },
        { name: 'Ambient', params: ModernReverbEffect.presetAmbient() }
      );
    } else if (type === 'modern-delay') {
      presets.push(
        { name: 'Slapback', params: ModernDelayEffect.presetSlapback() },
        { name: 'Ping Pong', params: ModernDelayEffect.presetPingPong() },
        { name: 'Dub Echo', params: ModernDelayEffect.presetDubEcho() },
        { name: 'Ambient', params: ModernDelayEffect.presetAmbient() },
        { name: 'Tape Echo', params: ModernDelayEffect.presetTapeEcho() }
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
