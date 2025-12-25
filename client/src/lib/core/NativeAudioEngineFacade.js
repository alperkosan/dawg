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
import { PlaybackManager } from './PlaybackManager.js';

// Services (extracted from this class)
import { InstrumentService } from './services/InstrumentService.js';
import { MixerService } from './services/MixerService.js';
import { TransportService } from './services/TransportService.js';
import { WorkletService } from './services/WorkletService.js';
import { EffectService } from './services/EffectService.js';
import { PerformanceService } from './services/PerformanceService.js';
import { WasmService } from './services/WasmService.js';

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
        this.playbackManager = null;
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

            // Initialize PlaybackManager (will be migrated to PlaybackService later)
            this.playbackManager = new PlaybackManager(this);
            this._setupPlaybackManagerCallbacks();

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
        // Create master bus nodes
        this.masterBusInput = this.audioContext.createGain();
        this.masterBusInput.gain.value = 1.0;

        this.masterBusGain = this.audioContext.createGain();
        this.masterBusGain.gain.value = 1.0;

        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.8;

        this.masterAnalyzer = this.audioContext.createAnalyser();
        this.masterAnalyzer.fftSize = 256;
        this.masterAnalyzer.smoothingTimeConstant = 0.8;

        // Routing
        this.masterBusInput.connect(this.masterBusGain);
        this.masterBusGain.connect(this.masterGain);
        this.masterGain.connect(this.masterAnalyzer);
        this.masterAnalyzer.connect(this.audioContext.destination);

        // Sync to MixerService
        this.mixerService.masterBusInput = this.masterBusInput;
        this.mixerService.masterBusGain = this.masterBusGain;
        this.mixerService.masterGain = this.masterGain;
        this.mixerService.masterAnalyzer = this.masterAnalyzer;

        logger.debug(NAMESPACES.AUDIO, 'Master audio chain ready');
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
            if (this.playbackManager?.positionTracker) {
                const position = this.playbackManager.positionTracker.getDisplayPosition();
                this.setTransportPosition(position.display, position.stepFloat);
            } else {
                const currentStep = data.step || this.transport.ticksToSteps(data.position);
                this.setTransportPosition(data.formatted, currentStep);
            }
        });
    }

    _setupPlaybackManagerCallbacks() {
        this.playbackManager.on('positionUpdate', (data) => {
            this.setTransportPosition(data.formatted, data.step);
        });

        this.playbackManager.on('patternChange', (data) => {
            this.onPatternChange(data);
        });
    }

    _processWasmLevels(levels) {
        if (this.onMixerLevels) {
            this.onMixerLevels(levels);
        }
    }

    // =================== PLAYBACK CONTROL (Delegated) ===================

    play(startStep = 0) {
        if (!this.isInitialized) return this;
        return this.playbackManager.play(startStep);
    }

    stop() {
        if (!this.isInitialized) return this;
        return this.playbackManager.stop();
    }

    pause() {
        if (!this.isInitialized) return this;
        return this.playbackManager.pause();
    }

    resume() {
        if (!this.isInitialized) return this;
        return this.playbackManager.resume();
    }

    setBPM(bpm) {
        if (this.transport) this.transport.setBPM(bpm);
        if (this.playbackManager) this.playbackManager._updateLoopSettings();
        this.instrumentService.updateBPM(bpm);
        return this;
    }

    setPlaybackMode(mode) {
        this.playbackManager?.setPlaybackMode(mode);
        return this;
    }

    getPlaybackMode() {
        return this.playbackManager?.getPlaybackMode() || 'pattern';
    }

    setLoopPoints(startStep, endStep) {
        this.playbackManager?.setLoopPoints(startStep, endStep);
        return this;
    }

    setLoopEnabled(enabled) {
        this.playbackManager?.setLoopEnabled(enabled);
        return this;
    }

    enableAutoLoop() {
        this.playbackManager?.enableAutoLoop();
        return this;
    }

    jumpToStep(step) {
        this.playbackManager?.jumpToStep(step);
        return this;
    }

    jumpToBar(bar) {
        this.playbackManager?.jumpToBar(bar);
        return this;
    }

    getCurrentPosition() {
        return this.playbackManager?.getCurrentPosition() || 0;
    }

    getLoopInfo() {
        return this.playbackManager?.getLoopInfo() || {
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

        if (this.playbackManager) {
            this.playbackManager.activePatternId = patternId;
            this.playbackManager._updateLoopSettings();
        }

        if (this.playbackManager?.isPlaying) {
            this.schedulePattern();
        }

        return this;
    }

    schedulePattern(patternData = null) {
        this.playbackManager?._scheduleContent(null, 'pattern-schedule', false);
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

        // Stop playback
        this.playbackManager?.stop();

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
