/**
 * UNIFIED EFFECTS - BARREL EXPORT
 * 
 * Central export point for unified effect system
 */

export {
    EFFECT_REGISTRY,
    WASM_EFFECT_TYPE_MAP,
    EFFECT_CATEGORIES,
    EFFECT_CPU_PROFILES,
    getEffectDefinition,
    getAllEffectTypes,
    getEffectsByCategory,
    getHighPriorityEffects,
    getEffectsByCPUPriority,
    calculateExpectedGain
} from './EffectParameterRegistry.js';

export {
    UnifiedEffect
} from './UnifiedEffect.js';
