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

        // ✅ PHASE 1: SharedArrayBuffer for direct position access
        // Zero-latency UI updates via direct memory read
        this.sharedBuffer = null;
        this.OFFSETS = {
            POSITION_STEP: 0,  // Current step position
            POSITION_BBT: 1,   // Packed BBT (bar*1000 + beat*100 + tick)
            IS_PLAYING: 2,     // 0 = stopped, 1 = playing
            BPM: 3,            // Current BPM
            LOOP_START: 4,     // Loop start position (steps)
            LOOP_END: 5,       // Loop end position (steps)
            LOOP_ENABLED: 6,   // 0 = disabled, 1 = enabled
        };

        this._initSharedBuffer();
    }

    /**
     * Initialize SharedArrayBuffer for zero-latency position updates
     * @private
     */
    _initSharedBuffer() {
        try {
            // Allocate 64 bytes (16 int32 values)
            const sab = new SharedArrayBuffer(64);
            this.sharedBuffer = new Int32Array(sab);

            // Initialize with defaults
            this.sharedBuffer[this.OFFSETS.POSITION_STEP] = 0;
            this.sharedBuffer[this.OFFSETS.POSITION_BBT] = 0; // 1.1.00
            this.sharedBuffer[this.OFFSETS.IS_PLAYING] = 0;
            this.sharedBuffer[this.OFFSETS.BPM] = 140;
            this.sharedBuffer[this.OFFSETS.LOOP_START] = 0;
            this.sharedBuffer[this.OFFSETS.LOOP_END] = 64;
            this.sharedBuffer[this.OFFSETS.LOOP_ENABLED] = 1;

            console.log('✅ SharedArrayBuffer initialized (64 bytes)');
        } catch (error) {
            console.warn('⚠️ SharedArrayBuffer not available:', error);
            // Fallback: use regular array (not shared, but still works)
            this.sharedBuffer = new Int32Array(16);
        }
    }

    /**
     * Get SharedArrayBuffer for direct position access
     * Used by useWasmPosition hook for zero-latency updates
     * @returns {Int32Array}
     */
    getSharedBuffer() {
        return this.sharedBuffer;
    }

    /**
     * Update position in shared buffer (called from transport/WASM)
     * @param {number} step - Current step position
     * @param {number} bar - Current bar (0-indexed)
     * @param {number} beat - Current beat (0-indexed)
     * @param {number} tick - Current tick (0-99)
     * @param {boolean} isPlaying - Is transport playing
     * @param {number} bpm - Current BPM
     */
    updatePositionBuffer(step, bar, beat, tick, isPlaying, bpm) {
        if (!this.sharedBuffer) return;

        this.sharedBuffer[this.OFFSETS.POSITION_STEP] = step;
        this.sharedBuffer[this.OFFSETS.POSITION_BBT] = bar * 1000 + beat * 100 + tick;
        this.sharedBuffer[this.OFFSETS.IS_PLAYING] = isPlaying ? 1 : 0;
        this.sharedBuffer[this.OFFSETS.BPM] = bpm;
    }

    /**
     * Update loop settings in shared buffer
     * @param {number} start - Loop start (steps)
     * @param {number} end - Loop end (steps)
     * @param {boolean} enabled - Is loop enabled
     */
    updateLoopBuffer(start, end, enabled) {
        if (!this.sharedBuffer) return;

        this.sharedBuffer[this.OFFSETS.LOOP_START] = start;
        this.sharedBuffer[this.OFFSETS.LOOP_END] = end;
        this.sharedBuffer[this.OFFSETS.LOOP_ENABLED] = enabled ? 1 : 0;
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
            // ✅ FIX: Use absolute URL for import to work in all environments (Vercel/Vite/Dev)
            // This prevents issues with relative paths in dynamic imports
            const dynamicImport = new Function('path', 'return import(path)');

            // Determine base URL
            const baseUrl = window.location.origin;
            const wasmModulePath = `${baseUrl}/wasm/dawg_audio_dsp.js`;

            console.log(`🚀 Loading WASM module from: ${wasmModulePath}`);

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
