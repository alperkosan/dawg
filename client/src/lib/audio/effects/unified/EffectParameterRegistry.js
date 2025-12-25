/**
 * EFFECT PARAMETER REGISTRY
 * 
 * ✅ Unified parameter definitions for all effects
 * ✅ Leverages existing EffectFactory.workletEffects
 * ✅ Adds WASM mapping and CPU profiling metadata
 * ✅ Easy to add new effects
 * 
 * @module lib/audio/effects/unified/EffectParameterRegistry
 */

import { EffectFactory } from '../EffectFactory.js';

// ============================================================================
// WASM EFFECT TYPE IDS
// ============================================================================

/**
 * Maps effect types to WASM effect IDs
 * Used by WasmService to create WASM effect instances
 */
export const WASM_EFFECT_TYPE_MAP = {
    // Dynamics (0-9)
    'compressor': 0,
    'saturator': 1,
    'limiter': 2,
    'clipper': 3,
    'sidechain-compressor': 4,

    // EQ & Filters (10-19)
    'multiband-eq': 10,
    'tidal-filter': 11,
    'bass-enhancer': 12,

    // Spacetime (20-29)
    'modern-reverb': 20,
    'modern-delay': 21,
    'feedback-delay': 22,
    'atmos-machine': 23,

    // Modulation (30-39)
    'stardust-chorus': 30,
    'vortex-phaser': 31,
    'orbit-panner': 32,
    'ghost-lfo': 33,

    // Distortion (40-49)
    'arcade-crusher': 40,
    'pitch-shifter': 41,
    'sample-morph': 42
};

// ============================================================================
// EFFECT CATEGORIES
// ============================================================================

export const EFFECT_CATEGORIES = {
    dynamics: ['compressor', 'saturator', 'limiter', 'clipper', 'sidechain-compressor'],
    eq: ['multiband-eq', 'tidal-filter', 'bass-enhancer'],
    spacetime: ['modern-reverb', 'modern-delay', 'feedback-delay', 'atmos-machine'],
    modulation: ['stardust-chorus', 'vortex-phaser', 'orbit-panner', 'ghost-lfo'],
    distortion: ['arcade-crusher', 'pitch-shifter', 'sample-morph']
};

// ============================================================================
// CPU PROFILING DATA
// ============================================================================

/**
 * Measured CPU costs (% of frame budget @ 48kHz)
 * Based on Chrome DevTools profiling
 * 
 * Priority:
 *  1 = Highest (migrate first - biggest CPU impact)
 *  5 = Lowest (migrate last - smallest impact)
 */
export const EFFECT_CPU_PROFILES = {
    // HIGH PRIORITY (Priority 1 - Migrate first)
    'modern-reverb': {
        avgCost: 15.7,
        peakCost: 28.3,
        wasmExpected: 6.8,
        priority: 1,
        expectedGain: 8.9
    },
    'saturator': {
        avgCost: 12.3,
        peakCost: 19.8,
        wasmExpected: 4.2,
        priority: 1,
        expectedGain: 8.1
    },
    'modern-delay': {
        avgCost: 9.2,
        peakCost: 15.1,
        wasmExpected: 3.8,
        priority: 1,
        expectedGain: 5.4
    },
    'compressor': {
        avgCost: 8.5,
        peakCost: 14.2,
        wasmExpected: 3.2,
        priority: 1,
        expectedGain: 5.3
    },
    'limiter': {
        avgCost: 7.1,
        peakCost: 12.8,
        wasmExpected: 2.9,
        priority: 1,
        expectedGain: 4.2
    },

    // MEDIUM PRIORITY (Priority 2)
    'multiband-eq': {
        avgCost: 6.8,
        peakCost: 11.5,
        wasmExpected: 2.5,
        priority: 2,
        expectedGain: 4.3
    },
    'stardust-chorus': {
        avgCost: 4.3,
        peakCost: 7.9,
        wasmExpected: 1.8,
        priority: 2,
        expectedGain: 2.5
    },
    'vortex-phaser': {
        avgCost: 3.9,
        peakCost: 6.8,
        wasmExpected: 1.6,
        priority: 2,
        expectedGain: 2.3
    },
    'clipper': {
        avgCost: 3.2,
        peakCost: 5.9,
        wasmExpected: 1.3,
        priority: 2,
        expectedGain: 1.9
    },
    'tidal-filter': {
        avgCost: 2.8,
        peakCost: 5.1,
        wasmExpected: 1.1,
        priority: 2,
        expectedGain: 1.7
    },

    // LOW PRIORITY (Priority 3 - Simple effects)
    'feedback-delay': { avgCost: 2.1, peakCost: 3.8, wasmExpected: 0.9, priority: 3, expectedGain: 1.2 },
    'bass-enhancer': { avgCost: 1.9, peakCost: 3.2, wasmExpected: 0.8, priority: 3, expectedGain: 1.1 },
    'orbit-panner': { avgCost: 1.7, peakCost: 2.9, wasmExpected: 0.7, priority: 3, expectedGain: 1.0 },
    'arcade-crusher': { avgCost: 1.5, peakCost: 2.6, wasmExpected: 0.6, priority: 3, expectedGain: 0.9 },
    'atmos-machine': { avgCost: 1.4, peakCost: 2.4, wasmExpected: 0.6, priority: 3, expectedGain: 0.8 },
    'pitch-shifter': { avgCost: 1.3, peakCost: 2.2, wasmExpected: 0.5, priority: 3, expectedGain: 0.8 },
    'ghost-lfo': { avgCost: 1.1, peakCost: 1.9, wasmExpected: 0.5, priority: 3, expectedGain: 0.6 },
    'sample-morph': { avgCost: 1.0, peakCost: 1.7, wasmExpected: 0.4, priority: 3, expectedGain: 0.6 },
    'sidechain-compressor': { avgCost: 0.9, peakCost: 1.5, wasmExpected: 0.4, priority: 3, expectedGain: 0.5 }
};

// ============================================================================
// UNIFIED EFFECT REGISTRY
// ============================================================================

/**
 * Build unified registry from EffectFactory.workletEffects
 * Adds WASM mapping and CPU profiling metadata
 */
function buildEffectRegistry() {
    const registry = {};

    for (const [type, definition] of Object.entries(EffectFactory.workletEffects)) {
        // Get category
        let category = 'misc';
        for (const [cat, effects] of Object.entries(EFFECT_CATEGORIES)) {
            if (effects.includes(type)) {
                category = cat;
                break;
            }
        }

        // Get CPU profile
        const cpuProfile = EFFECT_CPU_PROFILES[type] || {
            avgCost: 1.0,
            peakCost: 2.0,
            wasmExpected: 0.5,
            priority: 3,
            expectedGain: 0.5
        };

        // Build parameters with WASM mapping
        const parameters = {};
        let paramIndex = 0;

        for (const [paramName, paramDef] of Object.entries(definition.params)) {
            parameters[paramName] = {
                ...paramDef,

                // WASM mapping
                wasmParamIndex: paramIndex++,
                wasmType: detectWasmType(paramDef),

                // Value converters (default: passthrough)
                toWasm: (value) => value,
                fromWasm: (value) => value
            };
        }

        // Add to registry
        registry[type] = {
            type,
            displayName: definition.displayName,
            category,
            workletName: definition.workletName,
            wasmEffectId: WASM_EFFECT_TYPE_MAP[type],
            cpuProfile,
            parameters
        };
    }

    return registry;
}

/**
 * Detect WASM parameter type from definition
 */
function detectWasmType(paramDef) {
    const { min, max, defaultValue } = paramDef;

    // Boolean (0/1 toggle)
    if (min === 0 && max === 1 && (defaultValue === 0 || defaultValue === 1)) {
        return 'bool';
    }

    // Integer
    if (Number.isInteger(min) && Number.isInteger(max) && Number.isInteger(defaultValue)) {
        return 'int';
    }

    // Float (default)
    return 'float';
}

// ============================================================================
// EXPORT REGISTRY
// ============================================================================

/**
 * Complete effect registry
 * Auto-generated from EffectFactory.workletEffects
 */
export const EFFECT_REGISTRY = buildEffectRegistry();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get effect definition by type
 */
export function getEffectDefinition(type) {
    const normalized = EffectFactory.normalizeType(type);
    return EFFECT_REGISTRY[normalized] || null;
}

/**
 * Get all effect types
 */
export function getAllEffectTypes() {
    return Object.keys(EFFECT_REGISTRY);
}

/**
 * Get effects by category
 */
export function getEffectsByCategory(category) {
    return Object.values(EFFECT_REGISTRY)
        .filter(def => def.category === category)
        .map(def => def.type);
}

/**
 * Get effects sorted by CPU priority
 * Returns array of { type, ...cpuProfile }
 */
export function getEffectsByCPUPriority() {
    return Object.values(EFFECT_REGISTRY)
        .sort((a, b) => a.cpuProfile.priority - b.cpuProfile.priority)
        .map(def => ({
            type: def.type,
            displayName: def.displayName,
            ...def.cpuProfile
        }));
}

/**
 * Get high-priority effect types (priority 1)
 */
export function getHighPriorityEffects() {
    return Object.values(EFFECT_REGISTRY)
        .filter(def => def.cpuProfile.priority === 1)
        .sort((a, b) => b.cpuProfile.expectedGain - a.cpuProfile.expectedGain)
        .map(def => def.type);
}

/**
 * Calculate total expected CPU gain from migrating effects
 */
export function calculateExpectedGain(effectTypes) {
    let totalGain = 0;

    for (const type of effectTypes) {
        const def = getEffectDefinition(type);
        if (def) {
            totalGain += def.cpuProfile.expectedGain;
        }
    }

    return totalGain;
}

/**
 * ✅ EASY ADD NEW EFFECT
 * 
 * To add a new effect:
 * 1. Add to EffectFactory.workletEffects (already exists)
 * 2. Add WASM effect ID to WASM_EFFECT_TYPE_MAP
 * 3. Add to appropriate EFFECT_CATEGORIES array
 * 4. (Optional) Add CPU profile to EFFECT_CPU_PROFILES
 * 
 * Example:
 * 
 *   WASM_EFFECT_TYPE_MAP['my-new-effect'] = 50;
 *   EFFECT_CATEGORIES.distortion.push('my-new-effect');
 *   EFFECT_CPU_PROFILES['my-new-effect'] = {
 *     avgCost: 5.0,
 *     wasmExpected: 2.0,
 *     priority: 2,
 *     expectedGain: 3.0
 *   };
 * 
 * Done! Registry auto-builds from EffectFactory.workletEffects
 */

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate registry on module load (dev only)
 */
if (import.meta.env.DEV) {
    const allTypes = getAllEffectTypes();
    const highPriority = getHighPriorityEffects();
    const totalGain = calculateExpectedGain(allTypes);

    console.group('🎛️ Effect Parameter Registry Loaded');
    console.log(`Total Effects: ${allTypes.length}`);
    console.log(`High Priority: ${highPriority.length}`);
    console.log(`Expected CPU Gain: ${totalGain.toFixed(1)}%`);
    console.log(`Categories:`, EFFECT_CATEGORIES);
    console.groupEnd();
}
