/**
 * UNIFIED EFFECT
 * 
 * Automatically selects best effect implementation:
 * 1. WASM (Priority 1) - If available and effect supports it
 * 2. AudioWorklet (Priority 2) - Current implementation
 * 3. Web Audio API (Priority 3) - Fallback for basic effects
 * 
 * Features:
 * ✅ Auto-selection based on availability
 * ✅ Performance tracking built-in
 * ✅ Unified API across all implementations
 * ✅ Graceful degradation
 * 
 * @module lib/audio/effects/unified/UnifiedEffect
 */

import { getEffectDefinition } from './EffectParameterRegistry.js';
import { WorkletEffect } from '../WorkletEffect.js';
import { logger, NAMESPACES } from '../../../utils/debugLogger.js';

/**
 * Main UnifiedEffect class
 * Chooses best implementation automatically
 */
export class UnifiedEffect {
    constructor(context, type) {
        this.context = context;
        this.type = type;
        this.definition = getEffectDefinition(type);

        if (!this.definition) {
            throw new Error(`Unknown effect type: ${type}`);
        }

        // Select best implementation
        this.impl = this._createImplementation();

        // Performance tracking
        this.perfStats = {
            implementation: this.impl.constructor.name,
            parameterUpdateCount: 0,
            avgUpdateTime: 0,
            peakUpdateTime: 0,
            totalUpdateTime: 0
        };

        logger.info(NAMESPACES.AUDIO,
            `✨ Created ${this.definition.displayName} using ${this.perfStats.implementation}`);
    }

    /**
     * Create the best available implementation
     * @private
     */
    _createImplementation() {
        const wasmService = this.context.__wasmService;

        // Priority 1: WASM (if available and effect supports it)
        if (wasmService?.isInitialized && this.definition.wasmEffectId !== undefined) {
            try {
                logger.info(NAMESPACES.AUDIO, `🚀 Attempting WASM implementation for ${this.type}`);
                return new WasmEffectImpl(this.context, this.definition, wasmService);
            } catch (error) {
                logger.warn(NAMESPACES.AUDIO, `⚠️ WASM failed for ${this.type}, falling back to Worklet:`, error);
            }
        }

        // Priority 2: AudioWorklet (current standard)
        if (this.definition.workletName) {
            logger.info(NAMESPACES.AUDIO, `🎧 Using Worklet implementation for ${this.type}`);
            return new WorkletEffectImpl(this.context, this.definition);
        }

        // Priority 3: Web Audio API (not yet implemented)
        throw new Error(`No implementation available for ${this.type}`);
    }

    // ============================================================================
    // PUBLIC API - Same across all implementations
    // ============================================================================

    /**
     * Set a single parameter value
     */
    setParameter(name, value) {
        const startTime = performance.now();

        const result = this.impl.setParameter(name, value);

        // Track performance
        const elapsed = performance.now() - startTime;
        this.perfStats.parameterUpdateCount++;
        this.perfStats.totalUpdateTime += elapsed;
        this.perfStats.avgUpdateTime = this.perfStats.totalUpdateTime / this.perfStats.parameterUpdateCount;
        this.perfStats.peakUpdateTime = Math.max(this.perfStats.peakUpdateTime, elapsed);

        return result;
    }

    /**
     * Get a single parameter value
     */
    getParameter(name) {
        return this.impl.getParameter(name);
    }

    /**
     * Get all parameters as object
     */
    getParametersState() {
        return this.impl.getParametersState();
    }

    /**
     * Set multiple parameters at once
     */
    setParametersState(state) {
        return this.impl.setParametersState(state);
    }

    /**
     * Connect effect to audio graph
     */
    connect(destination) {
        return this.impl.connect(destination);
    }

    /**
     * Disconnect effect from audio graph
     */
    disconnect() {
        return this.impl.disconnect();
    }

    /**
     * Enable/disable effect
     */
    setEnabled(enabled) {
        if (this.impl.setEnabled) {
            return this.impl.setEnabled(enabled);
        }
    }

    /**
     * Get performance statistics
     */
    getPerfStats() {
        return {
            ...this.perfStats,
            implStats: this.impl.getPerfStats?.() || {}
        };
    }

    /**
     * Serialize effect state
     */
    serialize() {
        return {
            id: this.impl.id || `${this.type}_${Date.now()}`,
            type: this.type,
            name: this.definition.displayName,
            enabled: this.impl.enabled ?? true,
            parameters: this.getParametersState(),
            implementation: this.perfStats.implementation
        };
    }

    /**
     * Dispose effect and cleanup resources
     */
    dispose() {
        this.impl.dispose();
        logger.info(NAMESPACES.AUDIO, `🗑️ Disposed ${this.definition.displayName}`);
    }

    /**
     * Get effect metadata
     */
    getMetadata() {
        return {
            type: this.type,
            displayName: this.definition.displayName,
            category: this.definition.category,
            implementation: this.perfStats.implementation,
            wasmSupported: this.definition.wasmEffectId !== undefined,
            cpuProfile: this.definition.cpuProfile
        };
    }
}

// ============================================================================
// WASM EFFECT IMPLEMENTATION
// ============================================================================

/**
 * WASM-based effect implementation
 * Routes through WasmService
 */
class WasmEffectImpl {
    constructor(context, definition, wasmService) {
        this.context = context;
        this.definition = definition;
        this.wasmService = wasmService;
        this.id = `${definition.type}_wasm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.enabled = true;

        // Allocate WASM effect instance
        this.wasmEffectId = this.wasmService.createEffect?.(definition.wasmEffectId);

        if (this.wasmEffectId === undefined || this.wasmEffectId === -1) {
            throw new Error(`Failed to create WASM effect: ${definition.displayName}`);
        }

        // Initialize parameters to defaults
        this._initializeParameters();

        logger.info(NAMESPACES.AUDIO,
            `✅ WASM effect created: ${definition.displayName} (WASM ID: ${this.wasmEffectId})`);
    }

    _initializeParameters() {
        for (const [name, paramDef] of Object.entries(this.definition.parameters)) {
            const wasmValue = paramDef.toWasm(paramDef.defaultValue);
            this.wasmService.setEffectParameter?.(
                this.wasmEffectId,
                paramDef.wasmParamIndex,
                wasmValue
            );
        }
    }

    setParameter(name, value) {
        const paramDef = this.definition.parameters[name];
        if (!paramDef) {
            logger.warn(NAMESPACES.AUDIO, `Unknown parameter: ${name} for ${this.definition.type}`);
            return false;
        }

        // Convert JS value to WASM value
        const wasmValue = paramDef.toWasm(value);

        // Send to WASM
        if (this.wasmService.setEffectParameter) {
            this.wasmService.setEffectParameter(
                this.wasmEffectId,
                paramDef.wasmParamIndex,
                wasmValue
            );
            return true;
        }

        return false;
    }

    getParameter(name) {
        const paramDef = this.definition.parameters[name];
        if (!paramDef) return null;

        if (this.wasmService.getEffectParameter) {
            const wasmValue = this.wasmService.getEffectParameter(
                this.wasmEffectId,
                paramDef.wasmParamIndex
            );
            return paramDef.fromWasm(wasmValue);
        }

        return paramDef.defaultValue;
    }

    getParametersState() {
        const state = {};
        for (const name of Object.keys(this.definition.parameters)) {
            state[name] = this.getParameter(name);
        }
        return state;
    }

    setParametersState(state) {
        for (const [name, value] of Object.entries(state)) {
            this.setParameter(name, value);
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        // TODO: Send to WASM
    }

    connect(destination) {
        // WASM effects are routed through UnifiedMixer
        // Connection handled by WasmService
        return this;
    }

    disconnect() {
        // Handled by WasmService
    }

    getPerfStats() {
        return this.wasmService.getEffectStats?.(this.wasmEffectId) || {};
    }

    dispose() {
        if (this.wasmService.destroyEffect) {
            this.wasmService.destroyEffect(this.wasmEffectId);
        }
        logger.info(NAMESPACES.AUDIO, `Disposed WASM effect ID: ${this.wasmEffectId}`);
    }
}

// ============================================================================
// WORKLET EFFECT IMPLEMENTATION
// ============================================================================

/**
 * AudioWorklet-based effect implementation
 * Uses existing WorkletEffect class
 */
class WorkletEffectImpl {
    constructor(context, definition) {
        this.context = context;
        this.definition = definition;

        // Create WorkletEffect with converted parameters
        this.workletEffect = new WorkletEffect(
            context,
            definition.type,
            definition.workletName,
            definition.displayName,
            this._convertParamsToWorkletFormat()
        );

        // Expose properties
        this.id = this.workletEffect.id;
        this.enabled = this.workletEffect.enabled;
    }

    _convertParamsToWorkletFormat() {
        const workletParams = {};
        for (const [name, def] of Object.entries(this.definition.parameters)) {
            workletParams[name] = {
                label: def.label,
                defaultValue: def.defaultValue,
                min: def.min,
                max: def.max,
                unit: def.unit
            };
        }
        return workletParams;
    }

    setParameter(name, value) {
        return this.workletEffect.setParameter(name, value);
    }

    getParameter(name) {
        return this.workletEffect.getParameter(name);
    }

    getParametersState() {
        return this.workletEffect.getParametersState();
    }

    setParametersState(state) {
        return this.workletEffect.setParametersState(state);
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        return this.workletEffect.setEnabled(enabled);
    }

    connect(destination) {
        return this.workletEffect.connect(destination);
    }

    disconnect() {
        return this.workletEffect.disconnect();
    }

    getPerfStats() {
        // WorkletEffect doesn't have perf stats yet
        return {};
    }

    dispose() {
        return this.workletEffect.dispose();
    }
}

// ============================================================================
// STATIC FACTORY METHOD
// ============================================================================

/**
 * Create effect with automatic implementation selection
 * 
 * @param {AudioContext} context - Audio context
 * @param {string} type - Effect type (e.g., 'compressor')
 * @param {object} preset - Optional preset parameters
 * @returns {UnifiedEffect}
 */
UnifiedEffect.create = function (context, type, preset = null) {
    const effect = new UnifiedEffect(context, type);

    if (preset) {
        effect.setParametersState(preset);
    }

    return effect;
};

/**
 * Check if effect type is supported
 */
UnifiedEffect.isSupported = function (type) {
    return getEffectDefinition(type) !== null;
};

/**
 * Get effect metadata without creating instance
 */
UnifiedEffect.getMetadata = function (type) {
    const definition = getEffectDefinition(type);
    if (!definition) return null;

    return {
        type: definition.type,
        displayName: definition.displayName,
        category: definition.category,
        wasmSupported: definition.wasmEffectId !== undefined,
        workletName: definition.workletName,
        parameterCount: Object.keys(definition.parameters).length,
        cpuProfile: definition.cpuProfile
    };
};
