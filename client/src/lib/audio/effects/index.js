/**
 * AUDIO EFFECTS - Main Export
 *
 * Central export point for all audio effects.
 */

export { BaseEffect } from './BaseEffect.js';
export { WaveshaperEffect } from './WaveshaperEffect.js';
export { DelayEffect } from './DelayEffect.js';
export { ReverbEffect } from './ReverbEffect.js';
export { WorkletEffect } from './WorkletEffect.js';
export { EffectFactory, SoundGoodizerPreset } from './EffectFactory.js';

// Modern effects (✅ integrated with EffectFactory)
export { ModernReverbEffect } from './ModernReverbEffect.js';
export { ModernDelayEffect } from './ModernDelayEffect.js';
