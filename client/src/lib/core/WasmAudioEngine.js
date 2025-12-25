/**
 * WasmAudioEngine - WASM-based Audio Processing Engine
 * 
 * Manages the WASM audio processing graph and provides high-level API for:
 * - WASM synth instruments
 * - WASM effects
 * - Audio buffer management
 * 
 * @module lib/core/WasmAudioEngine
 */

class WasmAudioEngine {
    constructor() {
        this.isInitialized = false;
        this.wasmGraph = null;
        this.wasmModule = null;
        this.audioContext = null;

        // Instrument tracking
        this.instruments = new Map();
        this.effects = new Map();
    }

    /**
     * Initialize WASM engine with audio context
     * @param {AudioContext} audioContext 
     * @returns {Promise<boolean>}
     */
    async initialize(audioContext) {
        if (this.isInitialized) {
            return true;
        }

        try {
            this.audioContext = audioContext;

            // Dynamic import WASM module
            const dynamicImport = new Function('path', 'return import(path)');
            const wasmModulePath = '/wasm/dawg_audio_dsp.js';

            this.wasmModule = await dynamicImport(wasmModulePath);
            await this.wasmModule.default();

            // Create audio graph
            this.wasmGraph = new this.wasmModule.AudioGraph(audioContext.sampleRate);

            // Test node creation
            const nodeId = this.wasmGraph.add_test_node();
            console.log(`✅ WASM Audio Engine initialized (test node: ${nodeId})`);

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.warn('⚠️ WASM Audio Engine initialization failed:', error);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Get the WASM audio graph
     * @returns {Object|null}
     */
    getGraph() {
        return this.wasmGraph;
    }

    /**
     * Dispose WASM engine
     */
    dispose() {
        if (this.wasmGraph && this.wasmGraph.free) {
            this.wasmGraph.free();
        }

        this.wasmGraph = null;
        this.wasmModule = null;
        this.audioContext = null;
        this.isInitialized = false;
        this.instruments.clear();
        this.effects.clear();

        console.log('🧹 WASM Audio Engine disposed');
    }

    // =================== INSTRUMENTS ===================

    /**
     * Create a WASM instrument
     * @param {Object} instrumentData 
     * @returns {string} Instrument ID
     */
    createInstrument(instrumentData) {
        if (!this.isInitialized || !this.wasmGraph) {
            console.warn('WASM engine not initialized');
            return null;
        }

        const id = `wasm-inst-${Date.now()}`;

        try {
            // Create synth or sampler based on type
            if (instrumentData.type === 'synth') {
                const synth = new this.wasmModule.WasmSynth(this.audioContext.sampleRate);
                this.instruments.set(id, { type: 'synth', instance: synth, data: instrumentData });
            } else if (instrumentData.type === 'sampler') {
                // Sampler creation would go here
                this.instruments.set(id, { type: 'sampler', instance: null, data: instrumentData });
            }

            console.log(`🎹 WASM Instrument created: ${id}`);
            return id;
        } catch (error) {
            console.error('Failed to create WASM instrument:', error);
            return null;
        }
    }

    /**
     * Remove a WASM instrument
     * @param {string} instrumentId 
     */
    removeInstrument(instrumentId) {
        const instrument = this.instruments.get(instrumentId);
        if (instrument?.instance?.free) {
            instrument.instance.free();
        }
        this.instruments.delete(instrumentId);
    }

    /**
     * Get instrument by ID
     * @param {string} instrumentId 
     * @returns {Object|null}
     */
    getInstrument(instrumentId) {
        return this.instruments.get(instrumentId) || null;
    }

    // =================== EFFECTS ===================

    /**
     * Create a WASM effect
     * @param {string} effectType 
     * @param {Object} settings 
     * @returns {string} Effect ID
     */
    createEffect(effectType, settings = {}) {
        if (!this.isInitialized || !this.wasmGraph) {
            console.warn('WASM engine not initialized');
            return null;
        }

        const id = `wasm-effect-${Date.now()}`;

        try {
            // Effect creation based on type
            let effect = null;

            switch (effectType) {
                case 'eq':
                case 'eq3band':
                    effect = new this.wasmModule.ThreeBandEQ(this.audioContext.sampleRate);
                    break;
                case 'compressor':
                    // Compressor is built into WasmAudioProcessor
                    effect = { type: 'compressor', bypass: false };
                    break;
                default:
                    console.warn(`Unknown WASM effect type: ${effectType}`);
                    return null;
            }

            this.effects.set(id, { type: effectType, instance: effect, settings });
            console.log(`✨ WASM Effect created: ${effectType} (${id})`);
            return id;
        } catch (error) {
            console.error('Failed to create WASM effect:', error);
            return null;
        }
    }

    /**
     * Remove a WASM effect
     * @param {string} effectId 
     */
    removeEffect(effectId) {
        const effect = this.effects.get(effectId);
        if (effect?.instance?.free) {
            effect.instance.free();
        }
        this.effects.delete(effectId);
    }

    // =================== STATS ===================

    /**
     * Get engine stats
     * @returns {Object}
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            instrumentCount: this.instruments.size,
            effectCount: this.effects.size,
            hasGraph: !!this.wasmGraph
        };
    }
}

// Singleton instance
export const wasmAudioEngine = new WasmAudioEngine();

// Also export class for testing
export { WasmAudioEngine };
