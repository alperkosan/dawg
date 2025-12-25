/**
 * Audio Engine Facade
 * 
 * Defines the standard interface that both NativeAudioEngine and WasmAudioEngine must implement.
 * This ensures the UI and Services (AudioContextService, useMixerStore) can interact with 
 * either engine transparently.
 */
export class AudioEngineFacade {
    constructor() {
        if (this.constructor === AudioEngineFacade) {
            throw new Error("AudioEngineFacade is an abstract class and cannot be instantiated directly.");
        }
    }

    // =========================================================================
    // 1. LIFECYCLE & INITIALIZATION
    // =========================================================================

    /**
     * Initialize the engine with an AudioContext
     * @param {AudioContext} audioContext 
     */
    async initialize(audioContext) { throw new Error("Method 'initialize' must be implemented."); }

    /**
     * Dispose the engine and release resources
     */
    dispose() { throw new Error("Method 'dispose' must be implemented."); }


    // =========================================================================
    // 2. TRANSPORT CONTROL
    // =========================================================================

    play(startStep = 0) { throw new Error("Method 'play' must be implemented."); }
    stop() { throw new Error("Method 'stop' must be implemented."); }
    pause() { throw new Error("Method 'pause' must be implemented."); }
    resume() { throw new Error("Method 'resume' must be implemented."); }

    setBPM(bpm) { throw new Error("Method 'setBPM' must be implemented."); }
    setPlaybackMode(mode) { throw new Error("Method 'setPlaybackMode' must be implemented."); } // 'pattern' | 'song'

    // Loop Controls
    setLoopPoints(startStep, endStep) { throw new Error("Method 'setLoopPoints' must be implemented."); }
    setLoopEnabled(enabled) { throw new Error("Method 'setLoopEnabled' must be implemented."); }
    enableAutoLoop() { throw new Error("Method 'enableAutoLoop' must be implemented."); }

    // Navigation
    jumpToStep(step) { throw new Error("Method 'jumpToStep' must be implemented."); }
    getCurrentPosition() { throw new Error("Method 'getCurrentPosition' must be implemented."); } // returns { step, time }


    // =========================================================================
    // 3. INSTRUMENT MANAGEMENT
    // =========================================================================

    /**
     * Create a new instrument
     * @param {Object} instrumentData - Instrument configuration
     * @returns {Promise<string>} Instrument ID (AudioEngine ID)
     */
    async createInstrument(instrumentData) { throw new Error("Method 'createInstrument' must be implemented."); }

    /**
     * Update runtime parameters for an instrument
     * @param {string} instrumentId 
     * @param {Object} params 
     */
    updateInstrumentParameters(instrumentId, params) { throw new Error("Method 'updateInstrumentParameters' must be implemented."); }

    setInstrumentMute(instrumentId, isMuted) { throw new Error("Method 'setInstrumentMute' must be implemented."); }


    // =========================================================================
    // 4. MIXER & ROUTING (The "MixerInsert" System)
    // =========================================================================

    /**
     * Create a mixer track/insert
     * @param {string} trackId 
     * @param {string} label 
     */
    createMixerInsert(trackId, label) { throw new Error("Method 'createMixerInsert' must be implemented."); }
    removeMixerInsert(trackId) { throw new Error("Method 'removeMixerInsert' must be implemented."); }

    // Gain & Pan
    setInsertGain(trackId, gain) { throw new Error("Method 'setInsertGain' must be implemented."); } // linear gain 0-1+
    setInsertPan(trackId, pan) { throw new Error("Method 'setInsertPan' must be implemented."); }   // -1 to 1

    // Master Controls
    setMasterVolume(volume) { throw new Error("Method 'setMasterVolume' must be implemented."); }
    setMasterPan(pan) { throw new Error("Method 'setMasterPan' must be implemented."); }

    // Routing Logic
    routeInstrumentToInsert(instrumentId, trackId) { throw new Error("Method 'routeInstrumentToInsert' must be implemented."); }

    // Exclusive Routing (Submixes)
    routeInsertToBusExclusive(sourceTrackId, targetBusId) { throw new Error("Method 'routeInsertToBusExclusive' must be implemented."); }
    routeInsertToMaster(sourceTrackId) { throw new Error("Method 'routeInsertToMaster' must be implemented."); }


    // =========================================================================
    // 5. SEND SYSTEM (Parallel Routing)
    // =========================================================================

    /**
     * Create a send connection
     * @param {string} sourceId 
     * @param {string} targetId 
     * @param {number} level 
     * @param {boolean} preFader 
     */
    createSend(sourceId, targetId, level, preFader) { throw new Error("Method 'createSend' must be implemented."); }
    removeSend(sourceId, targetId) { throw new Error("Method 'removeSend' must be implemented."); }
    updateSendLevel(sourceId, targetId, level) { throw new Error("Method 'updateSendLevel' must be implemented."); }


    // =========================================================================
    // 6. EFFECTS SYSTEM
    // =========================================================================

    /**
     * Add effect to an insert chain
     * @param {string} trackId 
     * @param {string} effectType 
     * @param {Object} settings 
     * @returns {Promise<string>} Effect ID
     */
    async addEffectToInsert(trackId, effectType, settings) { throw new Error("Method 'addEffectToInsert' must be implemented."); }

    removeEffectFromInsert(trackId, effectId) { throw new Error("Method 'removeEffectFromInsert' must be implemented."); }
    updateInsertEffectParam(trackId, effectId, param, value) { throw new Error("Method 'updateInsertEffectParam' must be implemented."); }
    reorderInsertEffects(trackId, fromIndex, toIndex) { throw new Error("Method 'reorderInsertEffects' must be implemented."); }
    setEffectBypass(trackId, effectId, bypassed) { throw new Error("Method 'setEffectBypass' must be implemented."); }
}
