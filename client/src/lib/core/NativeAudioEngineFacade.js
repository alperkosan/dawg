/**
 * NativeAudioEngineFacade - Thin Orchestrator for Audio Engine
 * 
 * This facade delegates all operations to specialized services while
 * maintaining backward compatibility with the existing NativeAudioEngine API.
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                  NativeAudioEngineFacade                         │
 * │                     (Thin Orchestrator)                          │
 * │  ┌──────────────┬──────────────┬──────────────┬───────────────┐ │
 * │  │ Instrument   │    Mixer     │   Transport  │    Effect     │ │
 * │  │   Service    │   Service    │   Service    │    Service    │ │
 * │  └──────────────┴──────────────┴──────────────┴───────────────┘ │
 * │  ┌──────────────┬──────────────┬──────────────┐                 │
 * │  │   Worklet    │ Performance  │   Playback   │                 │
 * │  │   Service    │   Service    │   Service    │                 │
 * │  └──────────────┴──────────────┴──────────────┘                 │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * Benefits:
 * - Reduced file size (2599 → ~400 lines)
 * - Better testability (isolated services)
 * - Faster hot reload (smaller modules)
 * - Lower memory pressure (tree-shakeable)
 * 
 * @module lib/core/NativeAudioEngineFacade
 */

// Core systems
import { NativeTransportSystem } from './NativeTransportSystem.js';
import { ImprovedWorkletManager } from '../audio/ImprovedWorkletManager.js';
// ✅ MIGRATION: Using PlaybackFacade instead of monolithic PlaybackManager
import { PlaybackFacade } from './PlaybackFacade.js';

// Services (extracted from this class)
import { InstrumentService } from './services/InstrumentService.js';
import { MixerService } from './services/MixerService.js';
import { TransportService } from './services/TransportService.js';
import { WorkletService } from './services/WorkletService.js';
import { EffectService } from './services/EffectService.js';
import { PerformanceService } from './services/PerformanceService.js';
import { WasmService } from './services/WasmService.js';
import { PlaybackService } from './services/PlaybackService.js';
import { SchedulerService } from './services/SchedulerService.js';

// WASM components
import { wasmAudioEngine } from './WasmAudioEngine.js';
import { UnifiedMixerNode } from './UnifiedMixerNode.js';

// Utils
import { setGlobalAudioContext } from '../utils/audioUtils.js';
import { logger, NAMESPACES } from '../utils/debugLogger.js';
import { mixerInsertManager } from './MixerInsertManager.js';
import { LatencyCompensator } from './utils/LatencyCompensator.js';

export class NativeAudioEngineFacade {
    constructor(callbacks = {}) {
        // =================== CORE AUDIO CONTEXT ===================
        this.audioContext = null;
        this.isInitialized = false;

        // =================== CALLBACKS ===================
        this.setPlaybackState = callbacks.setPlaybackState || (() => { });
        this.setTransportPosition = callbacks.setTransportPosition || (() => { });
        this.onPatternChange = callbacks.onPatternChange || (() => { });
        this.onMixerLevels = callbacks.onMixerLevels || (() => { });

        // =================== CORE SYSTEMS ===================
        this.transport = null;
        this.workletManager = null;
        // ✅ MIGRATION: PlaybackFacade replaces PlaybackManager
        this.playbackFacade = null;
        this.latencyCompensator = null;

        // =================== WASM MIXER ===================
        this.useWasmMixer = true;
        this.unifiedMixer = null;
        this.channelAllocator = new Map();
        this.nextChannelIdx = 0;

        // =================== SERVICES (Lazy initialized) ===================
        this._instrumentService = null;
        this._mixerService = null;
        this._transportService = null;
        this._workletService = null;
        this._effectService = null;
        this._performanceService = null;
        this._wasmService = null;
        this._playbackService = null;
        this._schedulerService = null;

        // =================== LEGACY COMPATIBILITY ===================
        // These Maps are accessed directly by some components
        // Services use these as their backing store
        this.instruments = new Map();
        this.mixerInserts = new Map();
        this.instrumentToInsert = new Map();
        this.patterns = new Map();
        this.sampleBuffers = new Map();
        this.sampleCache = new Map();

        // Pattern state
        this.activePatternId = null;
        this.patternLength = 64;
        this.currentStep = 0;

        // Master bus nodes
        this.masterBusInput = null;
        this.masterBusGain = null;
        this.masterGain = null;
        this.masterAnalyzer = null;

        // Settings
        this.settings = {
            bufferSize: 256,
            latencyHint: 'interactive',
            sampleRate: 48000,
            maxPolyphony: 32
        };

        // Metrics
        this.metrics = {
            instrumentsCreated: 0,
            channelsCreated: 0,
            effectsCreated: 0,
            activeVoices: 0,
            cpuUsage: 0,
            audioLatency: 0,
            dropouts: 0,
            lastUpdateTime: 0
        };
    }

    // =================== SERVICE GETTERS (Lazy Init) ===================

    get instrumentService() {
        if (!this._instrumentService) {
            this._instrumentService = new InstrumentService(this);
            // Sync with legacy map
            this._instrumentService.instruments = this.instruments;
            this._instrumentService.sampleBuffers = this.sampleBuffers;
            this._instrumentService.sampleCache = this.sampleCache;
        }
        return this._instrumentService;
    }

    get mixerService() {
        if (!this._mixerService) {
            this._mixerService = new MixerService(this);
            // Sync with legacy maps
            this._mixerService.mixerInserts = this.mixerInserts;
            this._mixerService.instrumentToInsert = this.instrumentToInsert;
            this._mixerService.channelAllocator = this.channelAllocator;
        }
        return this._mixerService;
    }

    get transportService() {
        if (!this._transportService) {
            this._transportService = new TransportService(this);
        }
        return this._transportService;
    }

    get workletService() {
        if (!this._workletService) {
            this._workletService = new WorkletService(this);
        }
        return this._workletService;
    }

    get effectService() {
        if (!this._effectService) {
            this._effectService = new EffectService(this);
        }
        return this._effectService;
    }

    get performanceService() {
        if (!this._performanceService) {
            this._performanceService = new PerformanceService(this);
        }
        return this._performanceService;
    }

    get wasmService() {
        if (!this._wasmService) {
            this._wasmService = new WasmService(this);
            // Sync with existing WASM state
            this._wasmService.unifiedMixer = this.unifiedMixer;
            this._wasmService.channelAllocator = this.channelAllocator;
            this._wasmService.useWasmMixer = this.useWasmMixer;
        }
        return this._wasmService;
    }

    get playbackService() {
        if (!this._playbackService) {
            this._playbackService = new PlaybackService(this);
        }
        return this._playbackService;
    }

    get schedulerService() {
        if (!this._schedulerService) {
            this._schedulerService = new SchedulerService(this);
        }
        return this._schedulerService;
    }

    // =================== INITIALIZATION ===================

    async initialize() {
        if (this.isInitialized) return this;

        try {
            logger.info(NAMESPACES.AUDIO, '🚀 Initializing NativeAudioEngineFacade...');

            // Create AudioContext
            const ContextConstructor = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new ContextConstructor({
                latencyHint: this.settings.latencyHint,
                sampleRate: this.settings.sampleRate
            });

            setGlobalAudioContext(this.audioContext);

            // Initialize latency compensator
            this.latencyCompensator = new LatencyCompensator(this.audioContext);

            // Initialize Wasm Engine
            await wasmAudioEngine.initialize(this.audioContext);

            // Initialize Transport
            this.transport = new NativeTransportSystem(this.audioContext);
            this._setupTransportCallbacks();

            // Initialize Worklet Manager
            this.workletManager = new ImprovedWorkletManager(this.audioContext);
            await this.workletService.loadRequiredWorklets();

            // Setup Master Bus via MixerService
            await this._setupMasterAudioChain();

            // Initialize WASM Mixer
            if (this.useWasmMixer) {
                await this._initializeWasmMixer();
            }

            // ✅ MIGRATION: Initialize PlaybackFacade instead of monolithic PlaybackManager
            // This delegates to PlaybackService (503 lines) + SchedulerService (387 lines)
            // Replaces PlaybackManager (3,282 lines)
            this.playbackFacade = new PlaybackFacade(this);
            this._setupPlaybackFacadeCallbacks();

            // Start performance monitoring
            this.performanceService.start();

            // Start mixer insert manager
            mixerInsertManager.setAudioEngine(this);
            mixerInsertManager.startGlobalMonitor();

            this.isInitialized = true;
            logger.info(NAMESPACES.AUDIO, '✅ NativeAudioEngineFacade initialized');

            return this;
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, '❌ Initialization failed:', error);
            throw error;
        }
    }

    async initializeWithContext(existingContext) {
        this.audioContext = existingContext;
        return this.initialize();
    }

    async resumeAudioContext() {
        if (this.audioContext?.state === 'suspended') {
            await this.audioContext.resume();
            logger.info(NAMESPACES.AUDIO, 'AudioContext resumed');
        }
    }

    // =================== PRIVATE INITIALIZATION ===================

    async _setupMasterAudioChain() {
        // ✅ DELEGATION: Let MixerService handle master bus creation to ensure consistency
        // This ensures MixerInsert('master') is created and registered correctly
        await this.mixerService.initializeMasterBus();

        // Sync local references from MixerService
        this.masterBusInput = this.mixerService.masterBusInput;
        this.masterBusGain = this.mixerService.masterBusGain;
        this.masterGain = this.mixerService.masterGain;
        this.masterAnalyzer = this.mixerService.masterAnalyzer;

        logger.info(NAMESPACES.AUDIO, 'Master audio chain setup delegated to MixerService');
    }

    async _initializeWasmMixer() {
        logger.info(NAMESPACES.AUDIO, '🚀 Initializing UnifiedMixerNode...');

        this.unifiedMixer = new UnifiedMixerNode(this.audioContext, 32);
        await this.unifiedMixer.initialize();

        // Connect to master bus
        this.unifiedMixer.connect(this.masterBusInput);

        // Level metering callback
        this.unifiedMixer.onLevelsUpdate = (levels) => this._processWasmLevels(levels);

        // Link transport
        if (this.transport) {
            this.transport.linkAudioEngine(this);
        }

        logger.info(NAMESPACES.AUDIO, '✅ UnifiedMixerNode ready');
    }

    _setupTransportCallbacks() {
        this.transport.on('start', () => this.performanceService.start());
        this.transport.on('stop', () => this.performanceService.stop());

        this.transport.on('pause', () => {
            this.instruments.forEach(instrument => {
                if (instrument.allNotesOff) instrument.allNotesOff();
            });
        });

        this.transport.on('tick', (data) => {
            // ✅ MIGRATION: Use PlaybackFacade for position tracking
            const playbackService = this.playbackFacade?.getPlaybackService();
            if (playbackService?.positionTracker) {
                const position = playbackService.positionTracker.getDisplayPosition();
                this.setTransportPosition(position.display, position.stepFloat);
            } else {
                const currentStep = data.step || this.transport.ticksToSteps(data.position);
                this.setTransportPosition(data.formatted, currentStep);
            }
        });
    }

    _setupPlaybackFacadeCallbacks() {
        // ✅ MIGRATION: Setup callbacks for PlaybackFacade
        this.playbackFacade.on('positionUpdate', (data) => {
            this.setTransportPosition(data.formatted, data.step);
        });

        this.playbackFacade.on('patternChange', (data) => {
            this.onPatternChange(data);
        });
    }

    _processWasmLevels(levels) {
        if (this.onMixerLevels) {
            this.onMixerLevels(levels);
        }
    }

    // =================== PLAYBACK CONTROL (Delegated to PlaybackFacade) ===================

    play(startStep = 0) {
        if (!this.isInitialized) return this;
        // ✅ MIGRATION: Delegate to PlaybackFacade
        return this.playbackFacade.play(startStep);
    }

    stop() {
        if (!this.isInitialized) return this;
        // ✅ MIGRATION: Delegate to PlaybackFacade
        return this.playbackFacade.stop();
    }

    pause() {
        if (!this.isInitialized) return this;
        // ✅ MIGRATION: Delegate to PlaybackFacade
        return this.playbackFacade.pause();
    }

    resume() {
        if (!this.isInitialized) return this;
        // ✅ MIGRATION: Delegate to PlaybackFacade
        return this.playbackFacade.resume();
    }

    setBPM(bpm) {
        if (this.transport) this.transport.setBPM(bpm);
        // ✅ MIGRATION: PlaybackFacade handles loop settings updates
        if (this.playbackFacade) {
            const playbackService = this.playbackFacade.getPlaybackService();
            playbackService?._updateLoopSettings?.();
        }
        this.instrumentService.updateBPM(bpm);
        return this;
    }

    setPlaybackMode(mode) {
        // ✅ MIGRATION: Delegate to PlaybackFacade
        this.playbackFacade?.setPlaybackMode(mode);
        return this;
    }

    getPlaybackMode() {
        // ✅ MIGRATION: Delegate to PlaybackFacade
        return this.playbackFacade?.getPlaybackMode() || 'pattern';
    }

    setLoopPoints(startStep, endStep) {
        // ✅ MIGRATION: Delegate to PlaybackFacade
        this.playbackFacade?.setLoopPoints(startStep, endStep);
        return this;
    }

    setLoopEnabled(enabled) {
        // ✅ MIGRATION: Delegate to PlaybackFacade
        this.playbackFacade?.setLoopEnabled(enabled);
        return this;
    }

    enableAutoLoop() {
        // ✅ MIGRATION: Delegate to PlaybackFacade
        this.playbackFacade?.enableAutoLoop();
        return this;
    }

    jumpToStep(step) {
        // ✅ MIGRATION: Delegate to PlaybackFacade
        this.playbackFacade?.jumpToStep(step);
        return this;
    }

    jumpToBar(bar) {
        // ✅ MIGRATION: Delegate to PlaybackFacade
        this.playbackFacade?.jumpToBar(bar);
        return this;
    }

    getCurrentPosition() {
        // ✅ MIGRATION: Delegate to PlaybackFacade
        return this.playbackFacade?.getCurrentPosition() || 0;
    }

    getLoopInfo() {
        // ✅ MIGRATION: Delegate to PlaybackFacade
        return this.playbackFacade?.getLoopInfo() || {
            start: 0, end: 64, length: 64, enabled: true, auto: true
        };
    }

    // =================== INSTRUMENT MANAGEMENT (Delegated) ===================

    async createInstrument(instrumentData) {
        const instrument = await this.instrumentService.createInstrument(instrumentData);

        // Handle routing
        if (instrumentData.mixerTrackId) {
            this.routeInstrumentToInsert(instrumentData.id, instrumentData.mixerTrackId);
        }

        return instrument;
    }

    removeInstrument(instrumentId) {
        return this.instrumentService.removeInstrument(instrumentId);
    }

    setInstrumentMute(instrumentId, isMuted) {
        return this.instrumentService.setInstrumentMute(instrumentId, isMuted);
    }

    async preloadSamples(instrumentData) {
        return this.instrumentService.preloadSamples(instrumentData);
    }

    cleanUnusedBuffers(activeIds) {
        return this.instrumentService.cleanUnusedBuffers(activeIds);
    }

    // =================== MIXER CONTROL (Delegated) ===================

    createMixerInsert(insertId, label = '') {
        return this.mixerService.createMixerInsert(insertId, label);
    }

    removeMixerInsert(insertId) {
        return this.mixerService.removeMixerInsert(insertId);
    }

    createSend(trackId, busId, level = 0.5, preFader = false) {
        return this.mixerService.createSend(trackId, busId, level, preFader);
    }

    routeInstrumentToInsert(instrumentId, insertId) {
        return this.mixerService.routeInstrumentToInsert(instrumentId, insertId);
    }

    setChannelVolume(channelId, volume) {
        return this.mixerService.setChannelVolume(channelId, volume);
    }

    setChannelPan(channelId, pan) {
        return this.mixerService.setChannelPan(channelId, pan);
    }

    setChannelMute(channelId, muted) {
        return this.mixerService.setChannelMute(channelId, muted);
    }

    setChannelMono(channelId, mono) {
        return this.mixerService.setChannelMono(channelId, mono);
    }

    setMasterVolume(volume) {
        return this.mixerService.setMasterVolume(volume);
    }

    getMasterVolume() {
        return this.mixerService.getMasterVolume();
    }

    // =================== EFFECT MANAGEMENT (Delegated) ===================

    addEffectToInsert(insertId, effectType, settings = {}, storeEffectId = null) {
        return this.effectService.addEffect(insertId, effectType, settings, storeEffectId);
    }

    removeEffectFromInsert(insertId, effectId) {
        return this.effectService.removeEffect(insertId, effectId);
    }

    toggleEffectOnInsert(insertId, effectId) {
        return this.effectService.toggleEffect(insertId, effectId);
    }

    updateEffectParameter(insertId, effectId, param, value) {
        return this.effectService.updateEffect(insertId, effectId, param, value);
    }

    reorderEffect(insertId, sourceIndex, destIndex) {
        return this.effectService.reorderEffect(insertId, sourceIndex, destIndex);
    }

    // =================== PATTERN MANAGEMENT ===================

    setActivePattern(patternId) {
        this.activePatternId = patternId;

        // ✅ MIGRATION: Use PlaybackFacade
        if (this.playbackFacade) {
            this.playbackFacade.activePatternId = patternId;
            const playbackService = this.playbackFacade.getPlaybackService();
            playbackService?._updateLoopSettings?.();
        }

        if (this.playbackFacade?.isPlaying) {
            this.schedulePattern();
        }

        return this;
    }

    schedulePattern(patternData = null) {
        // ✅ MIGRATION: Delegate to SchedulerService via PlaybackFacade
        if (this.playbackFacade) {
            const schedulerService = this.playbackFacade.getSchedulerService();
            schedulerService?._scheduleContent?.(null, 'pattern-schedule', false);
        }
    }

    // =================== AUDIO QUALITY SETTINGS ===================

    /**
     * Apply audio quality settings from the Audio Quality Settings panel
     * Delegates to transport and instruments for timing/polyphony updates
     * @param {Object} settings - Settings from AudioQualityManager
     * @returns {Object} Result with success flag
     */
    applyQualitySettings(settings) {
        if (!this.isInitialized) {
            logger.warn(NAMESPACES.AUDIO, 'Cannot apply quality settings: engine not initialized');
            return { success: false, error: 'Engine not initialized' };
        }

        logger.info(NAMESPACES.AUDIO, '🎛️ Applying audio quality settings:', settings);

        try {
            // ✅ Apply PPQ to transport
            if (settings.ppq && this.transport) {
                this.transport.ppq = settings.ppq;
                this.transport.ticksPerStep = settings.ppq / 4;
                this.transport.ticksPerBar = settings.ppq * this.transport.timeSignature[0];
                logger.info(NAMESPACES.AUDIO, `PPQ updated to ${settings.ppq}`);
            }

            // ✅ Apply Lookahead Time
            if (settings.lookaheadTime && this.transport) {
                this.transport.lookAhead = settings.lookaheadTime * 1000;
                logger.info(NAMESPACES.AUDIO, `Lookahead updated to ${settings.lookaheadTime * 1000}ms`);
            }

            // ✅ Apply Schedule Ahead Time
            if (settings.scheduleAheadTime && this.transport) {
                this.transport.scheduleAheadTime = settings.scheduleAheadTime;
                logger.info(NAMESPACES.AUDIO, `Schedule ahead time updated to ${settings.scheduleAheadTime * 1000}ms`);
            }

            // ✅ Apply Sync Interval
            if (settings.syncInterval) {
                this._qualitySyncInterval = settings.syncInterval;
                logger.info(NAMESPACES.AUDIO, `Sync interval set to ${settings.syncInterval}ms`);
            }

            // ✅ Apply Max Polyphony
            if (settings.maxPolyphony) {
                this.settings.maxPolyphony = settings.maxPolyphony;
                this.instruments.forEach((instrument) => {
                    if (typeof instrument.setMaxPolyphony === 'function') {
                        instrument.setMaxPolyphony(settings.maxPolyphony);
                    }
                });
                logger.info(NAMESPACES.AUDIO, `Max polyphony set to ${settings.maxPolyphony}`);
            }

            // Store current settings
            this._currentQualitySettings = { ...settings };

            logger.info(NAMESPACES.AUDIO, '✅ Audio quality settings applied successfully');
            return { success: true };

        } catch (error) {
            logger.error(NAMESPACES.AUDIO, 'Failed to apply quality settings:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current quality settings
     * @returns {Object} Current quality settings
     */
    getQualitySettings() {
        if (this._currentQualitySettings) {
            return { ...this._currentQualitySettings };
        }

        return {
            ppq: this.transport?.ppq || 96,
            lookaheadTime: (this.transport?.lookAhead || 120) / 1000,
            scheduleAheadTime: this.transport?.scheduleAheadTime || 0.15,
            maxPolyphony: this.settings?.maxPolyphony || 32
        };
    }

    // =================== PERFORMANCE & STATS ===================

    getEngineStats() {
        return this.performanceService.getEngineStats();
    }

    getAnalysisData(nodeId = 'master-spectrum') {
        if (!this.masterAnalyzer) return null;

        const bufferLength = this.masterAnalyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.masterAnalyzer.getByteFrequencyData(dataArray);

        return {
            frequencyData: dataArray,
            bufferLength,
            sampleRate: this.audioContext.sampleRate,
            nodeId
        };
    }

    // =================== AUDITION ===================

    auditionNoteOn(instrumentId, pitch, velocity = 0.8) {
        const instrument = this.instruments.get(instrumentId);
        if (instrument?.triggerNote) {
            instrument.triggerNote(pitch, velocity);
        }
    }

    auditionNoteOff(instrumentId, pitch) {
        const instrument = this.instruments.get(instrumentId);
        if (instrument?.releaseNote) {
            instrument.releaseNote(pitch);
        }
    }

    // =================== CLEANUP ===================

    dispose() {
        logger.info(NAMESPACES.AUDIO, '🧹 Disposing NativeAudioEngineFacade...');

        // Stop services
        this.performanceService.dispose();
        mixerInsertManager.stopGlobalMonitor();

        // ✅ MIGRATION: Stop playback via facade
        this.playbackFacade?.stop();
        this.playbackFacade?.dispose();

        // Dispose transport
        this.transport?.dispose();

        // Dispose instruments
        this.instrumentService.dispose();

        // Dispose WASM mixer
        if (this.unifiedMixer) {
            this.unifiedMixer.dispose?.();
            this.unifiedMixer = null;
        }

        // Dispose mixer inserts
        this.mixerInserts.forEach(insert => {
            insert.dispose?.();
        });
        this.mixerInserts.clear();

        // Disconnect master nodes
        this.masterBusInput?.disconnect();
        this.masterBusGain?.disconnect();
        this.masterGain?.disconnect();

        // Close AudioContext
        if (this.audioContext?.state !== 'closed') {
            this.audioContext.close();
        }

        this.isInitialized = false;
        logger.info(NAMESPACES.AUDIO, '✅ NativeAudioEngineFacade disposed');
    }
}

// Factory function for backward compatibility
export function createAudioEngine(callbacks = {}) {
    return new NativeAudioEngineFacade(callbacks);
}
