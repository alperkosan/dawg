import { UnifiedMixerNode } from './UnifiedMixerNode';
import { AudioEngineFacade } from './AudioEngineFacade';

export class WasmAudioEngine extends AudioEngineFacade {
    constructor() {
        super();
        this.audioContext = null;
        this.wasmGraph = null;
        this.isInitialized = false;

        // Maps for state tracking (Parity with NativeEngine)
        this.instruments = new Map();
        this.mixerInserts = new Map();

        // Singleton instance
        if (WasmAudioEngine.instance) {
            return WasmAudioEngine.instance;
        }
        WasmAudioEngine.instance = this;
    }

    // =========================================================================
    // 1. LIFECYCLE & INITIALIZATION
    // =========================================================================

    async initialize(audioContext) {
        if (this.isInitialized) return;
        this.audioContext = audioContext;

        try {
            console.log('🚀 Initializing Wasm Audio Engine...');

            // Load Wasm Module
            // Note: We use the same path as WasmBackend.js for now, assuming the build output is there.
            const wasmModulePath = '/wasm/dawg_audio_dsp.js';
            const dynamicImport = new Function('path', 'return import(path)');
            const wasmModule = await dynamicImport(wasmModulePath);
            await wasmModule.default();

            // Initialize AudioGraph from Rust
            // AudioGraph is now exposed via lib.rs -> graph.rs
            this.wasmGraph = new wasmModule.AudioGraph(audioContext.sampleRate);

            this.isInitialized = true;
            console.log('✅ Wasm Audio Engine Initialized!');

            // Phase 1 Verification: Test Node Creation
            const nodeId = this.wasmGraph.add_test_node();
            console.log(`🧪 Verified: Created Test Node in Rust with ID: ${nodeId}`);

        } catch (error) {
            console.error('❌ Wasm Engine Initialization Failed:', error);
            throw error;
        }
    }

    getGraph() {
        if (!this.isInitialized) {
            console.warn('⚠️ WasmGraph requested before initialization');
        }
        return this.wasmGraph;
    }

    dispose() {
        console.log('🗑️ Disposing WasmAudioEngine');
        if (this.wasmGraph && this.wasmGraph.free) {
            this.wasmGraph.free();
        }
        this.isInitialized = false;
        this.wasmGraph = null;
    }


    // =========================================================================
    // 2. TRANSPORT CONTROL (STUBS)
    // =========================================================================

    play(startStep = 0) { console.warn('Wasm: play() not implemented'); }
    stop() { console.warn('Wasm: stop() not implemented'); }
    pause() { console.warn('Wasm: pause() not implemented'); }
    resume() { console.warn('Wasm: resume() not implemented'); }

    setBPM(bpm) { console.warn(`Wasm: setBPM(${bpm}) not implemented`); }
    setPlaybackMode(mode) { console.warn(`Wasm: setPlaybackMode(${mode}) not implemented`); } // 'pattern' | 'song'

    setLoopPoints(startStep, endStep) { console.warn('Wasm: setLoopPoints() not implemented'); }
    setLoopEnabled(enabled) { console.warn(`Wasm: setLoopEnabled(${enabled}) not implemented`); }
    enableAutoLoop() { console.warn('Wasm: enableAutoLoop() not implemented'); }

    jumpToStep(step) { console.warn(`Wasm: jumpToStep(${step}) not implemented`); }
    getCurrentPosition() { return { step: 0, time: 0 }; }


    // =========================================================================
    // 3. INSTRUMENT MANAGEMENT (STUBS)
    // =========================================================================

    async createInstrument(instrumentData) {
        console.warn('Wasm: createInstrument() not implemented, returning mock ID');
        return `wasm-inst-${Date.now()}`;
    }

    updateInstrumentParameters(instrumentId, params) {
        // console.warn(`Wasm: updateInstrumentParameters(${instrumentId}) not implemented`);
    }

    setInstrumentMute(instrumentId, isMuted) {
        console.warn(`Wasm: setInstrumentMute(${instrumentId}, ${isMuted}) not implemented`);
    }


    // =========================================================================
    // 4. MIXER & ROUTING (STUBS)
    // =========================================================================

    createMixerInsert(trackId, label) {
        console.log(`Wasm: createMixerInsert(${trackId}) called`);
        // Mock insert object to prevent crashes if consumed by UI
        const mockInsert = {
            id: trackId,
            label,
            effects: new Map(),
            instruments: new Set(),
            getAnalyzer: () => null
        };
        this.mixerInserts.set(trackId, mockInsert);
        return mockInsert;
    }

    removeMixerInsert(trackId) {
        this.mixerInserts.delete(trackId);
    }

    setInsertGain(trackId, gain) { }
    setInsertPan(trackId, pan) { }

    setMasterVolume(volume) { }
    setMasterPan(pan) { }

    routeInstrumentToInsert(instrumentId, trackId) {
        console.log(`Wasm: routeInstrumentToInsert(${instrumentId} -> ${trackId}) stub called`);
    }

    // Exclusive Routing (Submixes)
    routeInsertToBusExclusive(sourceTrackId, targetBusId) { }
    routeInsertToMaster(sourceTrackId) { }


    // =========================================================================
    // 5. SEND SYSTEM (STUBS)
    // =========================================================================

    createSend(sourceId, targetId, level, preFader) {
        console.log(`Wasm: createSend(${sourceId} -> ${targetId}) stub called`);
    }
    removeSend(sourceId, targetId) { }
    updateSendLevel(sourceId, targetId, level) { }


    // =========================================================================
    // 6. EFFECTS SYSTEM (STUBS)
    // =========================================================================

    async addEffectToInsert(trackId, effectType, settings) {
        console.warn(`Wasm: addEffectToInsert(${trackId}, ${effectType}) not implemented`);
        return `wasm-effect-${Date.now()}`;
    }

    removeEffectFromInsert(trackId, effectId) { }
    updateInsertEffectParam(trackId, effectId, param, value) { }
    reorderInsertEffects(trackId, fromIndex, toIndex) { }
    setEffectBypass(trackId, effectId, bypassed) { }
}

export const wasmAudioEngine = new WasmAudioEngine();
