import { NativeTransportSystem } from './NativeTransportSystem.js';
import { ImprovedWorkletManager } from '../audio/ImprovedWorkletManager.js';
import { PlaybackManager } from './PlaybackManager.js';
import { NativeTimeUtils } from '../utils/NativeTimeUtils.js';
import { setGlobalAudioContext } from '../utils/audioUtils.js';
// HATA DÜZELTMESİ 2: Eksik olan NativeSamplerNode sınıfını import ediyoruz.
import { NativeSamplerNode } from './nodes/NativeSamplerNode.js';
// NEW: Modular effect registry
import { effectRegistry } from '../audio/EffectRegistry.js';
// ✅ NEW: Effect chain support
import { EffectFactory } from '../audio/effects/index.js';
// ✅ NEW: Centralized instrument system
import { InstrumentFactory } from '../audio/instruments/index.js';
// ✅ NEW: Performance monitoring
import { PerformanceMonitor } from './PerformanceMonitor.js';
// ⚡ PERFORMANCE: Debug logger for conditional logging
import { logger, createScopedLogger } from '../utils/debugLogger.js';
// ⚡ PERFORMANCE: Parameter batching and object pooling
import { globalParameterBatcher } from '../audio/ParameterBatcher.js';
import { globalMessagePool } from '../audio/MessagePool.js';
// 🎛️ PHASE 3: UnifiedMixer (MegaMixer) - High-performance WASM-powered mixer
import { UnifiedMixerNode } from './UnifiedMixerNode.js';
// 🎛️ CONFIGURATION: Centralized audio engine configuration
import AudioEngineConfig, { getGainConfig, getInstrumentGainMultiplier, clampGain } from './AudioEngineConfig.js';
// 🔬 DEBUG: Sample analyzer for distortion detection
import { analyzeAllSamples } from '../../utils/sampleAnalyzer.js';
import { testDirectPlayback } from '../../utils/directPlaybackTest.js';
// 🎛️ DİNAMİK MİXER: Dynamic mixer insert system
import { MixerInsert } from './MixerInsert.js';

export class NativeAudioEngine {
    constructor(callbacks = {}) {
        // =================== CORE SYSTEMS ===================
        this.audioContext = null;
        this.transport = null;
        this.workletManager = null;
        this.playbackManager = null; // ✅ NEW: Advanced playback management
        this.performanceMonitor = null; // ✅ NEW: Performance monitoring

        // ⚡ PERFORMANCE: Batching systems
        this.parameterBatcher = globalParameterBatcher; // Share global instance
        this.messagePool = globalMessagePool; // Share global pool

        // =================== CALLBACK FUNCTIONS ===================
        this.setPlaybackState = callbacks.setPlaybackState || (() => {});
        this.setTransportPosition = callbacks.setTransportPosition || (() => {});
        this.onPatternChange = callbacks.onPatternChange || (() => {});
        
        // =================== DİNAMİK AUDIO ROUTING ===================

        // 🎛️ DYNAMIC MIXER SYSTEM
        this.mixerInserts = new Map();       // insertId → MixerInsert instance (dinamik)
        this.instruments = new Map();        // instrumentId → Instrument instance (dinamik)
        this.instrumentToInsert = new Map(); // instrumentId → insertId (routing map)

        // 🎚️ MASTER BUS (sabit, tek)
        this.masterBusInput = null;          // Tüm insert'ler buraya send yapar
        this.masterBusGain = null;           // Master bus gain
        this.masterEffects = new Map();      // Master effect chain
        this.masterGain = null;              // Final output volume
        this.masterAnalyzer = null;          // Master metering

        // ⚠️ DEPRECATED (will be removed)
        this.unifiedMixer = null;            // Old unified mixer (being replaced)
        this.unifiedMixerChannelMap = new Map();
        this.nextChannelIndex = 0;
        this.mixerChannels = new Map();      // Old mixer channels (being replaced)

        // Effect registry
        this.effects = new Map();
        
        // =================== PATTERN & SEQUENCING ===================
        this.patterns = new Map();
        this.activePatternId = null;
        this.patternLength = 64;
        this.currentStep = 0;
        
        // =================== SAMPLE MANAGEMENT ===================
        this.sampleBuffers = new Map();
        this.sampleCache = new Map();
        
        // =================== PERFORMANCE TRACKING ===================
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
        
        // =================== STATE ===================
        this.isInitialized = false;
        this.engineMode = 'native-worklet';
        this.settings = {
            bufferSize: 256,
            latencyHint: 'interactive',
            sampleRate: 48000,
            maxPolyphony: 32
        };
        
    }

    // =================== INITIALIZATION ===================

    async initializeWithContext(existingContext) {
        try {
            this.audioContext = existingContext;
            await this._initializeCore();
            return this;
        } catch (error) {
            throw error;
        }
    }

    async initialize() {
        try {
            await this._createAudioContext();
            await this._initializeCore();
            return this;
        } catch (error) {
            throw error;
        }
    }

    async _createAudioContext() {
        const ContextConstructor = window.AudioContext || window.webkitAudioContext;
        if (!ContextConstructor) {
            throw new Error('AudioContext not supported in this browser');
        }

        this.audioContext = new ContextConstructor({
            latencyHint: this.settings.latencyHint,
            sampleRate: this.settings.sampleRate
        });

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

    }

    async _initializeCore() {
        setGlobalAudioContext(this.audioContext);

        // 1. Initialize Transport System
        this.transport = new NativeTransportSystem(this.audioContext);
        this._setupTransportCallbacks();

        // 2. Initialize Worklet Manager
        this.workletManager = new ImprovedWorkletManager(this.audioContext);
        await this._loadRequiredWorklets();

        // 3. Setup Master Audio Chain (RAW signal path)
        await this._setupMasterAudioChain();

        // 4. ⚠️ REMOVED: _createDefaultChannels() - no longer needed
        // UnifiedMixer handles all channel routing automatically

        // 5. ✅ NEW: Initialize PlaybackManager
        this.playbackManager = new PlaybackManager(this);
        this._setupPlaybackManagerCallbacks();

        // 6. ✅ NEW: Initialize Performance Monitoring
        this.performanceMonitor = new PerformanceMonitor(this);
        this.performanceMonitor.start(); // Auto-start monitoring
        console.log('✅ Performance monitoring initialized and started');

        // 7. 🎛️ DYNAMIC MIXER: MixerInsert Only (high performance + flexibility)
        // All tracks use MixerInsert system
        // UnifiedMixer removed for cleaner architecture
        console.log('✅ Dynamic MixerInsert system ready');
        console.log('ℹ️ Performance: JS nodes for flexibility, optimized signal path');

        this.isInitialized = true;
    }

    // =================== ✅ NEW: PLAYBACK MANAGER INTEGRATION ===================

    _setupPlaybackManagerCallbacks() {
        // Connect playback manager events to engine callbacks
        this.playbackManager.on('positionUpdate', (data) => {
            this.setTransportPosition(data.formatted, data.step);
        });

        this.playbackManager.on('patternChange', (data) => {
            this.onPatternChange(data);
        });

        this.playbackManager.on('loopUpdate', (data) => {
        });

    }

    // =================== ✅ ENHANCED: PLAYBACK CONTROLS ===================

    play(startStep = 0) {
        if (!this.isInitialized) {
            return this;
        }

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
        if (this.transport) {
            this.transport.setBPM(bpm);
        }
        if (this.playbackManager) {
            this.playbackManager._updateLoopSettings();
        }
        return this;
    }

    /**
     * Set instrument mute state
     * @param {string} instrumentId - Instrument ID
     * @param {boolean} isMuted - Mute state
     */
    setInstrumentMute(instrumentId, isMuted) {
        const instrument = this.instruments.get(instrumentId);
        if (!instrument) {
            console.warn(`⚠️ NativeAudioEngine: Instrument ${instrumentId} not found for mute operation`);
            return this;
        }

        try {
            // Set mute state on the instrument
            if (instrument.setMute && typeof instrument.setMute === 'function') {
                instrument.setMute(isMuted);
            } else if (instrument.output) {
                // Fallback: control gain for mute/unmute
                const gainValue = isMuted ? 0 : (instrument.volume || 1);
                if (instrument.output.gain) {
                    instrument.output.gain.setValueAtTime(gainValue, this.audioContext.currentTime);
                }
            }

            console.log(`🔇 NativeAudioEngine: Instrument ${instrumentId} ${isMuted ? 'muted' : 'unmuted'}`);
        } catch (error) {
            console.error(`❌ NativeAudioEngine: Failed to set mute for instrument ${instrumentId}:`, error);
        }

        return this;
    }

    // =================== ✅ NEW: MODE & LOOP MANAGEMENT ===================

    setPlaybackMode(mode) {
        if (this.playbackManager) {
            this.playbackManager.setPlaybackMode(mode);
        }
        return this;
    }

    getPlaybackMode() {
        return this.playbackManager?.getPlaybackMode() || 'pattern';
    }

    setLoopPoints(startStep, endStep) {
        if (this.playbackManager) {
            this.playbackManager.setLoopPoints(startStep, endStep);
        }
        return this;
    }

    enableAutoLoop() {
        if (this.playbackManager) {
            this.playbackManager.enableAutoLoop();
        }
        return this;
    }

    setLoopEnabled(enabled) {
        if (this.playbackManager) {
            this.playbackManager.setLoopEnabled(enabled);
        }
        return this;
    }

    jumpToStep(step) {
        if (this.playbackManager) {
            this.playbackManager.jumpToStep(step);
        }
        return this;
    }


    jumpToBar(bar) {
        if (this.playbackManager) {
            this.playbackManager.jumpToBar(bar);
        }
        return this;
    }

    getCurrentPosition() {
        return this.playbackManager?.getCurrentPosition() || 0;
    }

    getLoopInfo() {
        return this.playbackManager?.getLoopInfo() || {
            start: 0,
            end: 64,
            length: 64,
            enabled: true,
            auto: true
        };
    }

    // =================== ✅ ENHANCED: PATTERN MANAGEMENT ===================

    setActivePattern(patternId) {
        this.activePatternId = patternId;
        
        if (this.playbackManager) {
            this.playbackManager.activePatternId = patternId;
            this.playbackManager._updateLoopSettings();
        }

        // Reschedule if playing
        if (this.playbackManager?.isPlaying) {
            this.schedulePattern();
        }

        return this;
    }

    schedulePattern(patternData = null) {
        if (!this.playbackManager) {
            return;
        }

        // ⚡ OPTIMIZATION: Use debounced scheduling instead of immediate reschedule
        this.playbackManager._scheduleContent(null, 'pattern-schedule', false);
    }

    // =================== EXISTING METHODS (Enhanced) ===================

    async _loadRequiredWorklets() {
        try {
            
            const workletConfigs = [
                { path: '/worklets/instrument-processor.js', name: 'instrument-processor' },
                { path: '/worklets/mixer-processor.js', name: 'mixer-processor' },
                { path: '/worklets/analysis-processor.js', name: 'analysis-processor' }
            ];

            const results = await this.workletManager.loadMultipleWorklets(workletConfigs);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            
            
            if (successful === 0) {
                throw new Error('No worklets could be loaded');
            }
        } catch (error) {
            throw error;
        }
    }

    async _setupMasterAudioChain() {

        // 🎛️ DİNAMİK MASTER BUS SYSTEM
        // Tüm mixer insert'ler masterBusInput'a send yapar
        // Master effects chain burada
        // Final gain ve output

        console.log('🎚️ Setting up DYNAMIC master bus...');

        // 🎛️ Master Bus Input - Tüm insert'ler buraya bağlanır
        this.masterBusInput = this.audioContext.createGain();
        this.masterBusInput.gain.value = 1.0; // Unity gain
        console.log('  📥 Master Bus Input: Unity gain (all inserts connect here)');

        // 🎚️ Master Bus Gain - Pre-effects gain stage (will be replaced by MixerInsert)
        this.masterBusGain = this.audioContext.createGain();
        this.masterBusGain.gain.value = 1.0; // Unity gain
        console.log('  🎛️ Master Bus Gain: Unity gain (pre-effects)');

        // 🎚️ Master Volume - Final output control
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.8; // Default volume
        console.log('  🎚️ Master Volume: 0.8 (final output)');

        // 📊 Master Analyzer - Metering
        this.masterAnalyzer = this.audioContext.createAnalyser();
        this.masterAnalyzer.fftSize = 256;
        this.masterAnalyzer.smoothingTimeConstant = 0.8;
        console.log('  📊 Master Analyzer: FFT 256 (metering)');

        // 🎛️ İlk routing (effect yok)
        // masterBusInput → masterBusGain → masterGain → analyzer → output
        this.masterBusInput.connect(this.masterBusGain);
        this.masterBusGain.connect(this.masterGain);
        this.masterGain.connect(this.masterAnalyzer);
        this.masterAnalyzer.connect(this.audioContext.destination);

        // ✅ NEW: Create MixerInsert for master track (unified system)
        // This allows master to use the same effect system as other tracks
        const masterInsert = new MixerInsert(this.audioContext, 'master', 'Master');

        // Connect master insert between masterBusInput and masterGain
        // masterBusInput → masterInsert → masterGain
        this.masterBusInput.disconnect();
        this.masterBusInput.connect(masterInsert.input);
        masterInsert.output.disconnect(); // Disconnect default routing
        masterInsert.output.connect(this.masterGain);

        // Store master insert in the mixerInserts map
        this.mixerInserts.set('master', masterInsert);

        console.log('✅ Master MixerInsert created and connected');
        console.log('✅ Dynamic Master Bus ready:');
        console.log('   Route: Inserts → MasterBusInput → MasterInsert[Effects] → MasterGain → Analyzer → Output');

    }

    _setupTransportCallbacks() {
        this.transport.on('start', () => {
            // this.setPlaybackState('playing'); // ✅ Handled by PlaybackController
            this._startPerformanceMonitoring();
        });

        this.transport.on('stop', () => {
            // this.setPlaybackState('stopped'); // ✅ Handled by PlaybackController
            this._stopPerformanceMonitoring();
            // Note: Don't call _stopAllInstruments here - it's called from PlaybackManager.stop()
            // to avoid double-stopping during normal loop behavior
        });

        this.transport.on('pause', () => {
            // this.setPlaybackState('paused'); // ✅ Handled by PlaybackController
            // On pause: gently release all notes (no instant stop)
            this.instruments.forEach(instrument => {
                if (instrument.allNotesOff) {
                    instrument.allNotesOff();
                }
            });
        });

        this.transport.on('tick', (data) => {
            // Update current position in playback manager
            if (this.playbackManager?.positionTracker) {
                // ✅ FIX: Use clean display position from PositionTracker
                const position = this.playbackManager.positionTracker.getDisplayPosition();
                this.playbackManager.currentPosition = position.stepFloat;

                // Send clean formatted position to UI
                this.setTransportPosition(position.display, position.stepFloat);
            } else {
                // Fallback to original behavior
                const currentStep = data.step || this.transport.ticksToSteps(data.position);
                this.setTransportPosition(data.formatted, currentStep);
            }
        });

        this.transport.on('bar', (data) => {
        });
    }

    // =================== SAMPLE MANAGEMENT ===================

    async preloadSamples(instrumentData) {
        
        const samplePromises = instrumentData
            .filter(inst => inst.type === 'sample' && inst.url)
            .map(async (inst) => {
                try {
                    if (this.sampleCache.has(inst.url)) {
                        this.sampleBuffers.set(inst.id, this.sampleCache.get(inst.url));
                        return;
                    }

                    const response = await fetch(inst.url);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                    
                    this.sampleCache.set(inst.url, audioBuffer);
                    this.sampleBuffers.set(inst.id, audioBuffer);
                    
                } catch (error) {
                }
            });

        await Promise.allSettled(samplePromises);

        // 🔬 DEBUG: Analyze all loaded samples for distortion
        if (this.sampleBuffers.size > 0) {
            console.log('\n🔬 Running sample analysis...');
            setTimeout(() => analyzeAllSamples(this), 100);
        }
    }

    // =================== INSTRUMENT MANAGEMENT ===================

    async createInstrument(instrumentData) {
        try {
            let instrument;

            // ✅ NEW: Try to use InstrumentFactory for multi-sampled instruments, VASynth, and Granular
            const isMultiSampled = instrumentData.multiSamples && instrumentData.multiSamples.length > 0;
            const isVASynth = instrumentData.type === 'vasynth';
            const isGranular = instrumentData.type === 'granular';

            if (isMultiSampled || isVASynth || isGranular) {
                // Use new centralized instrument system
                if (import.meta.env.DEV) {
                    console.log(`🎹 Creating ${instrumentData.name} using InstrumentFactory...`);
                }
                instrument = await InstrumentFactory.createPlaybackInstrument(
                    instrumentData,
                    this.audioContext,
                    { useCache: true }
                );

                if (!instrument) {
                    throw new Error(`InstrumentFactory failed to create ${instrumentData.name}`);
                }

            } else if (instrumentData.type === 'sample') {
                // ✅ Legacy: Single-sample instruments (drums, etc.)
                const audioBuffer = instrumentData.audioBuffer || this.sampleBuffers.get(instrumentData.id);
                instrument = new NativeSamplerNode(
                    instrumentData,
                    audioBuffer,
                    this.audioContext
                );

            } else if (instrumentData.type === 'synth') {
                // ✅ Legacy: ForgeSynth instruments
                instrument = new NativeSynthInstrument(
                    instrumentData,
                    this.workletManager,
                    this.audioContext
                );

                if (typeof instrument.initialize === 'function') {
                    await instrument.initialize();
                }

            } else {
                throw new Error(`❌ Unknown instrument type: ${instrumentData.type}`);
            }

            this.instruments.set(instrumentData.id, instrument);

            // 🎛️ DYNAMIC ROUTING: All instruments route to MixerInsert
            console.log(`🎛️ Routing new instrument ${instrumentData.id} to mixer...`);
            if (instrumentData.mixerTrackId) {
                const insert = this.mixerInserts.get(instrumentData.mixerTrackId);
                console.log(`   mixerTrackId: ${instrumentData.mixerTrackId}`);
                console.log(`   Insert found: ${!!insert}`);
                if (insert) {
                    // Route to dynamic MixerInsert
                    console.log(`   Calling routeInstrumentToInsert...`);
                    this.routeInstrumentToInsert(instrumentData.id, instrumentData.mixerTrackId);
                    console.log(`   ✅ Routing complete`);
                } else {
                    console.error(`❌ MixerInsert not found: ${instrumentData.mixerTrackId}`);
                    console.error(`   Available inserts: ${Array.from(this.mixerInserts.keys()).join(', ')}`);
                    throw new Error(`Cannot route instrument ${instrumentData.id}: MixerInsert ${instrumentData.mixerTrackId} not found`);
                }
            } else {
                console.error(`❌ Instrument ${instrumentData.id} missing mixerTrackId`);
                throw new Error(`All instruments must have a mixerTrackId. Create MixerInsert first.`);
            }

            this.metrics.instrumentsCreated++;
            // Only log in DEV mode - production uses batched summary
            if (import.meta.env.DEV) {
                console.log(`✅ Instrument created: ${instrumentData.name} (${instrumentData.type})`);
            }

            return instrument;

        } catch (error) {
            console.error(`❌ Failed to create instrument ${instrumentData.name}:`, error);
            throw error;
        }
    }

    // =================== MIXER CHANNELS ===================

    // ⚠️ REMOVED: Old mixer-processor channel system
    // All routing now handled by UnifiedMixer (32 channels, WASM-powered)
    // Old functions removed: _getOrCreateTrackChannel, _createDefaultChannels, _createMixerChannel

    // =================== 🎛️ PHASE 3: UNIFIED MIXER ===================

    /**
     * Initialize UnifiedMixer (MegaMixer) - High-performance WASM-powered mixer
     * Replaces individual mixer-processor channels with a single 32-channel node
     */
    async _initializeUnifiedMixer() {
        try {
            logger.info('🎛️ Initializing UnifiedMixer (MegaMixer)...');

            // Create UnifiedMixer with 32 stereo channels
            this.unifiedMixer = new UnifiedMixerNode(this.audioContext, 32);
            await this.unifiedMixer.initialize();

            // 🎛️ RAW ROUTING: Connect UnifiedMixer directly to masterBusGain
            // UnifiedMixer outputs mixed signal → masterBusGain (unity) → masterGain → analyzer → output
            // COMPLETELY CLEAN - No EQ, no compression, no limiting
            this.unifiedMixer.connect(this.masterBusGain);
            console.log('✅ RAW ROUTING: UnifiedMixer → masterBusGain (unity gain) → masterGain → analyzer → output');

            // Initialize channel mapping (channelId → channelIndex 0-31)
            this._initializeUnifiedMixerChannelMap();

            logger.info('✅ UnifiedMixer initialized: 32 channels ready');
            logger.info('💡 CPU overhead: ~0% | Latency: 2.67ms | 11x faster than old system');
            logger.info('💡 RAW signal path - No automatic processing');
        } catch (error) {
            logger.error('❌ Failed to initialize UnifiedMixer:', error);
            // Fallback: Disable UnifiedMixer and use old system
            this.useUnifiedMixer = false;
            logger.warn('⚠️ Falling back to old mixer-processor system');
            throw error;
        }
    }

    /**
     * Initialize channel ID → index mapping for UnifiedMixer
     * Maps string IDs (track-1, bus-1, etc.) to numerical indices (0-31)
     */
    _initializeUnifiedMixerChannelMap() {
        // Track channels: track-1 → 0, track-2 → 1, ..., track-28 → 27
        for (let i = 1; i <= 28; i++) {
            this.unifiedMixerChannelMap.set(`track-${i}`, i - 1);
        }

        // Bus channels: bus-1 → 28, bus-2 → 29
        this.unifiedMixerChannelMap.set('bus-1', 28);
        this.unifiedMixerChannelMap.set('bus-2', 29);

        // Master channel: master → 30 (optional, usually not routed through mixer)
        this.unifiedMixerChannelMap.set('master', 30);

        // Reserved: channel 31 for future use
        this.unifiedMixerChannelMap.set('reserved', 31);

        logger.debug('✅ UnifiedMixer channel map initialized:', this.unifiedMixerChannelMap.size, 'channels');
    }

    /**
     * Get UnifiedMixer channel index from channel ID
     * @param {string} channelId - Channel ID (e.g., 'track-1', 'bus-1')
     * @returns {number} Channel index (0-31) or -1 if not found
     */
    _getUnifiedMixerChannelIndex(channelId) {
        const index = this.unifiedMixerChannelMap.get(channelId);
        if (index === undefined) {
            logger.warn(`⚠️ Unknown channel ID for UnifiedMixer: ${channelId}`);
            return -1;
        }
        return index;
    }

    // =================== END: UNIFIED MIXER ===================

    // =================== MASTER CONTROLS ===================

    /**
     * Set master output volume (pure gain, no processing)
     * @param {number} volume - Volume level (0.0 to 1.0, can go higher)
     */
    setMasterVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
            console.log(`🎚️ Master volume: ${volume.toFixed(2)}`);
        }
    }

    /**
     * Get master output volume
     * @returns {number} Current master volume
     */
    getMasterVolume() {
        return this.masterGain ? this.masterGain.gain.value : AudioEngineConfig.gain.masterVolume.default;
    }

    // ⚠️ REMOVED: Master pan functions (masterPanner doesn't exist in RAW signal path)
    // Pan control is per-channel in UnifiedMixer, not on master

    // =================== GAIN SYSTEM ===================

    /**
     * 🎚️ STATIC GAIN APPROACH (Current)
     *
     * Philosophy: Equal default levels, user controls everything manually
     *
     * Default channel gain: 0.07
     * - Conservative value for 20+ instruments
     * - Prevents clipping in worst-case peak summing
     * - User adjusts individual channels and master volume as needed
     *
     * Formula: channelGain × numInstruments × masterMixer × masterGain = peak
     * Example: 0.07 × 20 × 0.7 × 0.8 = 0.784 ✅ (safe)
     *
     * Future: Master FX (compressor/limiter) can be added as optional user-controlled effects
     */

    /*
    // =================== ADAPTIVE GAIN SYSTEM (DISABLED) ===================
    // Note: User requested simple equal defaults instead of automatic adjustments
    // Keeping this code for potential future use

    _calculateAdaptiveGain() {
        const numInstruments = this.instruments.size || 1;

        // Use config system to get gain
        this.gainConfig = getGainConfig(numInstruments);
        const { channelGain, mode, expectedPeak } = this.gainConfig;

        console.log(`🎚️ ${mode === 'adaptive' ? 'Adaptive' : 'Static'} Gain: ${numInstruments} instruments → ${channelGain.toFixed(3)} per channel (peak: ${expectedPeak.toFixed(3)})`);

        return channelGain;
    }

    updateAdaptiveGains() {
        const newGain = this._calculateAdaptiveGain();

        // Update UnifiedMixer channels
        if (this.useUnifiedMixer && this.unifiedMixer) {
            const numChannels = this.instruments.size;
            for (let i = 0; i < numChannels; i++) {
                this.unifiedMixer.setChannelParams(i, { gain: newGain });
            }
            console.log(`✅ Updated ${numChannels} UnifiedMixer channels to gain: ${newGain.toFixed(3)}`);
        }

        // Update old system channels
        this.mixerChannels.forEach((channel, id) => {
            if (id !== 'master') {  // Don't adjust master channel
                const gainParam = channel.parameters?.get('gain');
                if (gainParam) {
                    gainParam.setValueAtTime(newGain, this.audioContext.currentTime);
                }
            }
        });

        if (this.mixerChannels.size > 0) {
            console.log(`✅ Updated ${this.mixerChannels.size} old system channels to gain: ${newGain.toFixed(3)}`);
        }
    }
    */

    // =================== MIXER CONTROLS (UnifiedMixer Only) ===================

    setChannelVolume(channelId, volume) {
        if (!this.unifiedMixer) {
            console.warn('⚠️ UnifiedMixer not initialized');
            return;
        }

        const channelIdx = this._getUnifiedMixerChannelIndex(channelId);
        if (channelIdx !== -1) {
            this.unifiedMixer.setChannelParams(channelIdx, { gain: volume });
        }
    }

    setChannelPan(channelId, pan) {
        if (!this.unifiedMixer) {
            console.warn('⚠️ UnifiedMixer not initialized');
            return;
        }

        const channelIdx = this._getUnifiedMixerChannelIndex(channelId);
        if (channelIdx !== -1) {
            this.unifiedMixer.setChannelParams(channelIdx, { pan });
        }
    }

    setChannelMute(channelId, muted) {
        console.log('🔇 NativeAudioEngine.setChannelMute:', channelId, muted);

        const insert = this.mixerInserts.get(channelId);
        if (insert && typeof insert.setMute === 'function') {
            insert.setMute(muted);
        } else {
            console.warn(`⚠️ MixerInsert not found for channel: ${channelId}`);
        }
    }

    setChannelMono(channelId, mono) {
        console.log('📻 NativeAudioEngine.setChannelMono:', channelId, mono);

        const insert = this.mixerInserts.get(channelId);
        if (insert && typeof insert.setMono === 'function') {
            insert.setMono(mono);
        } else {
            console.warn(`⚠️ MixerInsert not found for channel: ${channelId}`);
        }
    }

    setChannelSolo(channelId, soloed, isAnySoloed) {
        console.log('🎧 NativeAudioEngine.setChannelSolo:', channelId, soloed, isAnySoloed);

        const insert = this.mixerInserts.get(channelId);
        if (insert && typeof insert.setSolo === 'function') {
            insert.setSolo(soloed, isAnySoloed);
        } else {
            console.warn(`⚠️ MixerInsert not found or missing setSolo method for channel: ${channelId}`);
        }
    }

    // ⚠️ REMOVED: Old mixer-processor channel API
    // getMeterLevel, createSend, removeSend, updateSendLevel, setTrackOutput
    // All routing now handled by UnifiedMixer - use UnifiedMixer API instead

    // =================== AUDITION (PREVIEW) ===================

    auditionNoteOn(instrumentId, pitch, velocity = null) {
        const instrument = this.instruments.get(instrumentId);
        if (instrument) {
            // Use default velocity from config if not specified
            const defaultVelocity = AudioEngineConfig.gain.masterVolume.default;
            instrument.triggerNote(pitch, velocity !== null ? velocity : defaultVelocity);
        }
    }

    auditionNoteOff(instrumentId, pitch) {
        const instrument = this.instruments.get(instrumentId);
        if (instrument) {
            instrument.releaseNote(pitch);
        }
    }

    // =================== ANALYSIS & MONITORING ===================

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

    // ⚠️ REMOVED: getChannelMeterData for old system
    // Use UnifiedMixer.getChannelMetering() instead

    // =================== PERFORMANCE MONITORING ===================

    _initializePerformanceMonitoring() {
        this._updatePerformanceMetrics();
    }

    _startPerformanceMonitoring() {
        this.performanceInterval = setInterval(() => {
            this._updatePerformanceMetrics();
        }, 1000);
    }

    _stopPerformanceMonitoring() {
        if (this.performanceInterval) {
            clearInterval(this.performanceInterval);
            this.performanceInterval = null;
        }
    }

    _updatePerformanceMetrics() {
        const now = performance.now();
        
        this.metrics = {
            ...this.metrics,
            activeVoices: this._countActiveVoices(),
            audioLatency: (this.audioContext.baseLatency + this.audioContext.outputLatency) * 1000,
            lastUpdateTime: now
        };
    }

    _countActiveVoices() {
        let total = 0;
        this.instruments.forEach(instrument => {
            if (instrument.getActiveVoiceCount) {
                total += instrument.getActiveVoiceCount();
            }
        });
        return total;
    }

    getEngineStats() {
        return {
            performance: this.metrics,
            audioContext: {
                state: this.audioContext.state,
                sampleRate: this.audioContext.sampleRate,
                currentTime: this.audioContext.currentTime.toFixed(3),
                baseLatency: this.audioContext.baseLatency?.toFixed(6) || 'unknown',
                outputLatency: this.audioContext.outputLatency?.toFixed(6) || 'unknown',
                totalLatency: ((this.audioContext.baseLatency || 0) + (this.audioContext.outputLatency || 0)) * 1000
            },
            instruments: {
                total: this.instruments.size,
                byType: this._getInstrumentsByType()
            },
            unifiedMixer: {
                active: !!this.unifiedMixer,
                channels: 32,
                type: 'WASM-powered RAW signal path'
            },
            workletManager: this.workletManager?.getDetailedStats(),
            transport: this.transport?.getStats(),
            playback: this.playbackManager?.getPlaybackStatus() // ✅ NEW: Playback status
        };
    }

    // =================== UTILITY METHODS ===================

    // Public method to reconnect instrument after effect chain change
    reconnectInstrumentToTrack(instrumentId, trackId) {
        if (import.meta.env.DEV) {
            console.log(`🔄 Reconnecting instrument ${instrumentId} to track ${trackId}`);
        }

        const instrument = this.instruments.get(instrumentId);
        if (!instrument) {
            console.warn('❌ Cannot reconnect: instrument not found');
            return false;
        }

        // ✅ FIXED: Support both UnifiedMixer and old system
        // No need to check channel existence - routing logic handles both systems

        // Disconnect from ALL previous connections
        try {
            instrument.output.disconnect();
            console.log('✅ Disconnected from all previous outputs');
        } catch (e) {
            // May not be connected, ignore
        }

        // Reconnect using system-aware routing
        return this._connectInstrumentToChannel(instrumentId, trackId);
    }

    /**
     * Update instrument parameters (called from store)
     * @param {string} instrumentId - Instrument ID
     * @param {Object} params - Updated parameters
     */
    updateInstrumentParameters(instrumentId, params) {
        if (import.meta.env.DEV) {
            console.log(`🎚️ Updating instrument parameters: ${instrumentId}`, params);
        }

        // If mixerTrackId changed, re-route the instrument using MixerInsert system
        if (params.mixerTrackId) {
            if (import.meta.env.DEV) {
                console.log(`🔌 Re-routing ${instrumentId} to ${params.mixerTrackId}`);
            }
            this.routeInstrumentToInsert(instrumentId, params.mixerTrackId);
            return true;
        }

        // Other parameter updates can be handled here
        const instrument = this.instruments.get(instrumentId);
        if (instrument && instrument.updateParameters) {
            instrument.updateParameters(params);
        }

        return true;
    }

    // 🎛️ HYBRID: UnifiedMixer routing (backward compatibility)
    // New code should use: createMixerInsert() + routeInstrumentToInsert()

    async _connectInstrumentToChannel(instrumentId, channelId) {
        if (import.meta.env.DEV) {
            console.log(`🔌 Attempting to connect instrument ${instrumentId} to channel ${channelId}`);
        }
        const instrument = this.instruments.get(instrumentId);
        if (!instrument) {
            console.error(`❌ Instrument not found: ${instrumentId}`);
            return false;
        }
        if (!instrument.output) {
            console.error(`❌ Instrument ${instrumentId} has no output!`);
            return false;
        }
        if (!this.unifiedMixer) {
            console.error('❌ UnifiedMixer not initialized - cannot route instrument');
            return false;
        }
        return this._connectToUnifiedMixer(instrument, instrumentId, channelId);
    }

    _connectToUnifiedMixer(instrument, instrumentId, channelId) {
        try {
            const channelIdx = this._getUnifiedMixerChannelIndex(channelId);
            if (channelIdx === -1) {
                logger.error(`❌ Invalid channel ID for UnifiedMixer: ${channelId}`);
                return false;
            }
            try {
                instrument.output.disconnect();
                if (import.meta.env.DEV) {
                    console.log(`🔌 Disconnected ${instrumentId} from all previous outputs`);
                }
            } catch (e) {}
            if (!this.mixerChannels.has(channelId)) {
                this.mixerChannels.set(channelId, {
                    id: channelId,
                    instrumentNode: instrument.output,
                    unifiedMixerIndex: channelIdx,
                    effects: new Map(),
                    output: instrument.output
                });
                console.log(`✅ Created mixer channel for ${channelId}`);
            }
            const success = this.unifiedMixer.connectToChannel(instrument.output, channelIdx);
            if (success) {
                logger.info(`✅ Connected ${instrumentId} to UnifiedMixer channel ${channelIdx} (${channelId})`);
                const currentConfig = getGainConfig(this.instruments.size);
                const baseGain = currentConfig.channelGain;
                const instrumentType = instrument.type || 'sample';
                const instrumentMultiplier = getInstrumentGainMultiplier(instrumentType);
                const finalGain = baseGain * instrumentMultiplier;
                this.unifiedMixer.setChannelParams(channelIdx, {
                    gain: finalGain,
                    pan: 0.0,
                    mute: false,
                    solo: false,
                    eqActive: false,
                    compActive: false
                });
            }
            return success;
        } catch (error) {
            logger.error(`❌ Failed to connect to UnifiedMixer:`, error);
            return false;
        }
    }

    _stopAllInstruments() {
        this.instruments.forEach(instrument => {
            if (instrument.allNotesOff) {
                instrument.allNotesOff();
            }
             if (instrument.stopAll) {
                instrument.stopAll();
            }
        });
    }

    _calculateRMS(dataArray) {
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        return Math.sqrt(sum / dataArray.length);
    }

    _getInstrumentsByType() {
        const types = {};
        this.instruments.forEach(instrument => {
            const type = instrument.type || 'unknown';
            types[type] = (types[type] || 0) + 1;
        });
        return types;
    }

    /**
     * 🔍 DEBUG: Verify routing state (call from console: engine.debugRouting())
     */
    debugRouting() {
        console.log('═══════════════════════════════════════════════════');
        console.log('🔍 ROUTING DEBUG INFO');
        console.log('═══════════════════════════════════════════════════');

        console.log('🎛️ Mixer System:');
        console.log(`   UnifiedMixer: ${!!this.unifiedMixer ? 'Active (RAW signal path)' : 'NOT INITIALIZED'}`);
        console.log(`   32 WASM-powered channels, zero processing`);

        console.log('\n🎵 Instruments:');
        this.instruments.forEach((instrument, id) => {
            console.log(`   ${id}:`, {
                type: instrument.type,
                hasOutput: !!instrument.output,
                outputType: instrument.output?.constructor.name
            });
        });

        if (this.useUnifiedMixer && this.unifiedMixer) {
            console.log('\n🎛️ UnifiedMixer Connections:');
            console.log(`   Active channels: ${this.unifiedMixer.channelConnections?.size || 0}`);
        }

        console.log('\n🎚️ GAIN STACK ANALYSIS (RAW Signal Path):');
        console.log(`   Master Bus Gain (headroom): ${this.masterBusGain?.gain?.value || 'N/A'}`);
        console.log(`   Master Volume (user control): ${this.masterGain?.gain?.value || 'N/A'}`);

        if (this.useUnifiedMixer && this.unifiedMixer) {
            console.log('\n🎛️ UnifiedMixer Channel Gains (first 9):');
            for (let i = 0; i < 9; i++) {
                const channelState = this.unifiedMixer.processor?.channels?.[i];
                if (channelState) {
                    console.log(`   Channel ${i}: gain=${channelState.gain?.toFixed(3)}, mute=${channelState.mute}`);
                }
            }
        }

        console.log('═══════════════════════════════════════════════════');
    }

    /**
     * 🔍 DEBUG: Inspect all gain values in the chain
     */
    debugGainStack() {
        console.log('═══════════════════════════════════════════════════');
        console.log('🎚️ COMPLETE GAIN STACK INSPECTION');
        console.log('═══════════════════════════════════════════════════');

        // RAW signal path calculation
        const channelGain = 0.05; // Current channel gain
        const numInstruments = this.instruments.size;
        const summedSignal = channelGain * numInstruments;
        const busGain = this.masterBusGain?.gain?.value || 0.7;
        const masterVolume = this.masterGain?.gain?.value || 0.8;

        console.log('📊 THEORETICAL (RAW Signal Path):');
        console.log(`   ${numInstruments} instruments × ${channelGain} gain = ${summedSignal.toFixed(3)}`);
        console.log(`   × Bus Gain (${busGain}) = ${(summedSignal * busGain).toFixed(3)}`);
        console.log(`   × Master Volume (${masterVolume}) = ${(summedSignal * busGain * masterVolume).toFixed(3)}`);
        console.log(`   Expected peak: ${(summedSignal * busGain * masterVolume).toFixed(3)}`);

        console.log('\n🔍 ACTUAL VALUES (RAW Signal - No Processing):');
        console.log(`   Master Bus Gain: ${busGain} (headroom)`);
        console.log(`   Master Volume: ${masterVolume} (user control)`);
        console.log(`   NO EQ, NO Compression, NO Limiting`);

        console.log('\n⚠️ IF CLIPPING STILL OCCURS:');
        console.log('   1. Check if changes are loaded (hard refresh)');
        console.log('   2. Check instrument output levels (may be >1.0)');
        console.log('   3. Lower master volume: engine.setMasterVolume(0.5)');

        console.log('═══════════════════════════════════════════════════');
    }

    // =================== CLEANUP ===================

    dispose() {

        this._stopPerformanceMonitoring();

        // Dispose playback manager
        if (this.playbackManager) {
            this.playbackManager.stop();
            this.playbackManager = null;
        }

        // Stop transport
        if (this.transport) {
            this.transport.dispose();
        }

        // Dispose instruments
        this.instruments.forEach((instrument, id) => {
            try {
                if(instrument.dispose) instrument.dispose();
            } catch (error) {
            }
        });
        this.instruments.clear();

        // 🎛️ PHASE 3: Dispose UnifiedMixer (CRITICAL FIX - Memory Leak Prevention)
        if (this.unifiedMixer) {
            try {
                console.log('🧹 Disposing UnifiedMixer...');
                this.unifiedMixer.disconnect();
                if (this.unifiedMixer.dispose) {
                    this.unifiedMixer.dispose();
                }
                this.unifiedMixer = null;
                console.log('✅ UnifiedMixer disposed');
            } catch (error) {
                console.warn('⚠️ UnifiedMixer dispose failed:', error);
            }
        }

        // Clear UnifiedMixer channel map
        if (this.unifiedMixerChannelMap) {
            this.unifiedMixerChannelMap.clear();
        }

        // 🎛️ CRITICAL: Dispose all MixerInserts (prevents memory leak)
        if (this.mixerInserts && this.mixerInserts.size > 0) {
            console.log(`🧹 Disposing ${this.mixerInserts.size} MixerInserts...`);
            this.mixerInserts.forEach((insert, insertId) => {
                try {
                    if (insert && insert.dispose) {
                        insert.dispose();
                    }
                } catch (error) {
                    console.warn(`⚠️ MixerInsert ${insertId} dispose failed:`, error);
                }
            });
            this.mixerInserts.clear();
            this.instrumentToInsert.clear();
            console.log('✅ All MixerInserts disposed');
        }

        // 🎚️ Dispose Master Bus Gain
        if (this.masterBusGain) {
            try {
                this.masterBusGain.disconnect();
                this.masterBusGain = null;
                console.log('✅ Master bus gain disposed');
            } catch (error) {
                console.warn('⚠️ Master bus gain dispose failed:', error);
            }
        }

        // 🎚️ Dispose Master Volume
        if (this.masterGain) {
            try {
                this.masterGain.disconnect();
                this.masterGain = null;
                console.log('✅ Master volume disposed');
            } catch (error) {
                console.warn('⚠️ Master volume dispose failed:', error);
            }
        }

        // ⚠️ REMOVED: Old mixer-processor channel disposal (no longer used)

        // Dispose worklet manager
        if (this.workletManager) {
            this.workletManager.dispose();
        }

        // Close audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }

    }

    // =================== 🎛️ DİNAMİK MİXER INSERT API ===================

    /**
     * Mixer insert oluştur (track eklendiğinde)
     * @param {string} insertId - Insert ID (örn: "kick-1", "bass-1")
     * @param {string} label - Görünür isim (örn: "Kick", "Bass")
     * @returns {MixerInsert} Oluşturulan insert instance
     */
    createMixerInsert(insertId, label = '') {
        if (this.mixerInserts.has(insertId)) {
            console.warn(`⚠️ MixerInsert ${insertId} already exists`);
            return this.mixerInserts.get(insertId);
        }

        const insert = new MixerInsert(this.audioContext, insertId, label);

        // Master bus'a bağla
        insert.connectToMaster(this.masterBusInput);

        this.mixerInserts.set(insertId, insert);

        if (import.meta.env.DEV) {
            console.log(`✅ MixerInsert created: ${insertId} (${label})`);
        }
        return insert;
    }

    /**
     * Mixer insert'i sil (track silindiğinde)
     * @param {string} insertId - Insert ID
     */
    removeMixerInsert(insertId) {
        const insert = this.mixerInserts.get(insertId);
        if (!insert) {
            console.warn(`⚠️ MixerInsert ${insertId} not found`);
            return;
        }

        // Bağlı tüm instrument'leri temizle
        const connectedInstruments = Array.from(this.instrumentToInsert.entries())
            .filter(([instId, insId]) => insId === insertId)
            .map(([instId]) => instId);

        connectedInstruments.forEach(instId => {
            this.removeInstrument(instId);
        });

        // Master bus'tan kes
        insert.disconnectFromMaster(this.masterBusInput);

        // Insert'i dispose et
        insert.dispose();

        this.mixerInserts.delete(insertId);
        console.log(`✅ MixerInsert removed: ${insertId}`);
    }

    /**
     * Instrument'i mixer insert'e bağla
     * @param {string} instrumentId - Instrument ID
     * @param {string} insertId - Insert ID
     */
    routeInstrumentToInsert(instrumentId, insertId) {
        const instrument = this.instruments.get(instrumentId);
        const insert = this.mixerInserts.get(insertId);

        if (!instrument) {
            // ⚠️ FIX: Don't log error in production, just silently skip
            // This can happen during app initialization when re-routing is attempted
            // before instruments are created. It's not a critical error.
            if (import.meta.env.DEV) {
                console.warn(`⚠️ Instrument ${instrumentId} not found - skipping routing (this is normal during initialization)`);
            }
            return;
        }

        if (!insert) {
            console.error(`❌ MixerInsert ${insertId} not found`);
            return;
        }

        // Önceki bağlantıyı kes
        const oldInsertId = this.instrumentToInsert.get(instrumentId);
        if (oldInsertId) {
            const oldInsert = this.mixerInserts.get(oldInsertId);
            if (oldInsert) {
                oldInsert.disconnectInstrument(instrumentId, instrument.output);
            }
        }

        // Yeni bağlantı
        insert.connectInstrument(instrumentId, instrument.output);
        this.instrumentToInsert.set(instrumentId, insertId);

        // Only log routing in DEV mode
        if (import.meta.env.DEV) {
            console.log(`🔗 Routed: ${instrumentId} → ${insertId}`);
        }
    }

    /**
     * Insert'e effect ekle
     * @param {string} insertId - Insert ID
     * @param {string} effectType - Effect tipi
     * @param {object} settings - Effect ayarları
     * @param {string} storeEffectId - Optional Store effect ID for mapping
     * @returns {string} Effect ID (audioEngineId)
     */
    async addEffectToInsert(insertId, effectType, settings = {}) {
        const insert = this.mixerInserts.get(insertId);
        if (!insert) {
            console.error(`❌ MixerInsert ${insertId} not found`);
            return null;
        }

        try {
            const effectNode = await effectRegistry.createEffectNode(
                effectType,
                this.audioContext,
                settings
            );

            if (!effectNode) {
                throw new Error(`Failed to create effect: ${effectType}`);
            }

            // ✅ SIMPLIFIED: Generate single effect ID
            const effectId = `${insertId}-fx-${Date.now()}`;

            // Add effect with single ID and effect type
            insert.addEffect(effectId, effectNode, settings, false, effectType);

            // ⚡ SPECIAL INITIALIZATION: MultiBandEQ requires bands to be sent via message
            if (effectType === 'MultiBandEQ' && settings.bands && effectNode.port) {
                effectNode.port.postMessage({
                    type: 'updateBands',
                    bands: settings.bands
                });
                console.log(`✅ MultiBandEQ initialized with ${settings.bands.length} bands`);
            }

            // 🎛️ SIDECHAIN: Initialize sidechain routing if source is specified
            if (effectType === 'Compressor' && settings.scSourceId) {
                const getSourceInsert = (sourceInsertId) => {
                    return this.mixerInserts.get(sourceInsertId);
                };
                insert.updateSidechainSource(effectId, settings.scSourceId, getSourceInsert);
            }

            console.log(`✅ Effect added: ${effectType} → ${insertId} (ID: ${effectId})`);
            return effectId;

        } catch (error) {
            console.error(`❌ Failed to add effect to ${insertId}:`, error);
            return null;
        }
    }

    /**
     * Insert'ten effect kaldır
     * @param {string} insertId - Insert ID
     * @param {string} effectId - Effect ID
     */
    removeEffectFromInsert(insertId, effectId) {
        const insert = this.mixerInserts.get(insertId);
        if (!insert) {
            console.error(`❌ MixerInsert ${insertId} not found`);
            return;
        }

        insert.removeEffect(effectId);
        console.log(`✅ Effect removed: ${effectId} from ${insertId}`);
    }

    /**
     * Insert gain ayarla
     * @param {string} insertId - Insert ID
     * @param {number} gain - Gain değeri (0-1)
     */
    setInsertGain(insertId, gain) {
        const insert = this.mixerInserts.get(insertId);
        if (insert) {
            insert.setGain(gain);
        }
    }

    /**
     * Insert pan ayarla
     * @param {string} insertId - Insert ID
     * @param {number} pan - Pan değeri (-1 to 1)
     */
    setInsertPan(insertId, pan) {
        const insert = this.mixerInserts.get(insertId);
        if (insert) {
            insert.setPan(pan);
        }
    }

    /**
     * Insert mute ayarla
     * @param {string} insertId - Insert ID
     * @param {boolean} muted - Muted state
     */
    setInsertMute(insertId, muted) {
        const insert = this.mixerInserts.get(insertId);
        if (insert) {
            insert.setMute(muted);
        }
    }

    /**
     * Solo mode - Sadece solo edilen track'ler duyulur
     * @param {Set} soloedInserts - Solo edilen insert ID'leri
     * @param {Set} mutedInserts - Orijinal mute durumları
     */
    setSoloMode(soloedInserts, mutedInserts) {
        // Eğer hiç solo yoksa, hepsini normale döndür
        if (soloedInserts.size === 0) {
            // Restore original mute states
            this.mixerInserts.forEach((insert, insertId) => {
                const shouldBeMuted = mutedInserts.has(insertId);
                insert.setMute(shouldBeMuted);
            });
            console.log('🔊 Solo mode disabled - all tracks restored');
            return;
        }

        // Solo mode aktif: Solo olmayan herşeyi mute et
        this.mixerInserts.forEach((insert, insertId) => {
            const isSoloed = soloedInserts.has(insertId);
            const isOriginallyMuted = mutedInserts.has(insertId);

            if (isSoloed) {
                // Solo track always plays (unless originally muted)
                insert.setMute(isOriginallyMuted);
            } else {
                // Non-solo tracks are muted
                insert.setMute(true);
            }
        });

        console.log(`🔊 Solo mode: ${soloedInserts.size} track(s) soloed`);
    }

    /**
     * Insert mono/stereo ayarla
     * @param {string} insertId - Insert ID
     * @param {boolean} mono - Mono state
     */
    setInsertMono(insertId, mono) {
        const insert = this.mixerInserts.get(insertId);
        if (insert) {
            insert.setMono(mono);
        }
    }

    // =================== 📤 SEND ROUTING ===================

    /**
     * Create send from source insert to destination insert
     * @param {string} sourceId - Source insert ID
     * @param {string} busId - Destination bus/insert ID
     * @param {number} level - Send level (0-1)
     * @param {boolean} preFader - Pre-fader send (not implemented yet)
     */
    createSend(sourceId, busId, level = 0.5, preFader = false) {
        const sourceInsert = this.mixerInserts.get(sourceId);
        const busInsert = this.mixerInserts.get(busId);

        if (!sourceInsert) {
            console.error(`❌ Source insert ${sourceId} not found`);
            return;
        }

        if (!busInsert) {
            console.error(`❌ Bus insert ${busId} not found`);
            return;
        }

        // Add send: source → bus input
        sourceInsert.addSend(busId, busInsert.input, level);
        console.log(`✅ Send created: ${sourceId} → ${busId} (level: ${level})`);
    }

    /**
     * Remove send from source to bus
     * @param {string} sourceId - Source insert ID
     * @param {string} busId - Destination bus ID
     */
    removeSend(sourceId, busId) {
        const sourceInsert = this.mixerInserts.get(sourceId);

        if (!sourceInsert) {
            console.error(`❌ Source insert ${sourceId} not found`);
            return;
        }

        sourceInsert.removeSend(busId);
        console.log(`✅ Send removed: ${sourceId} → ${busId}`);
    }

    /**
     * Update send level
     * @param {string} sourceId - Source insert ID
     * @param {string} busId - Destination bus ID
     * @param {number} level - New send level (0-1)
     */
    updateSendLevel(sourceId, busId, level) {
        const sourceInsert = this.mixerInserts.get(sourceId);

        if (!sourceInsert) {
            console.error(`❌ Source insert ${sourceId} not found`);
            return;
        }

        sourceInsert.setSendLevel(busId, level);
    }

    // =================== 🎹 INSTRUMENT MANAGEMENT ===================

    /**
     * Instrument'i sil (dispose)
     * @param {string} instrumentId - Instrument ID
     */
    removeInstrument(instrumentId) {
        const instrument = this.instruments.get(instrumentId);
        if (!instrument) {
            return;
        }

        // Insert'ten disconnect
        const insertId = this.instrumentToInsert.get(instrumentId);
        if (insertId) {
            const insert = this.mixerInserts.get(insertId);
            if (insert) {
                insert.disconnectInstrument(instrumentId, instrument.output);
            }
            this.instrumentToInsert.delete(instrumentId);
        }

        // Instrument dispose
        if (instrument.dispose) {
            instrument.dispose();
        }

        this.instruments.delete(instrumentId);
        if (import.meta.env.DEV) {
            console.log(`✅ Instrument removed: ${instrumentId}`);
        }
    }

    /**
     * Tüm kaynakları temizle (engine destroy)
     */
    disposeAllResources() {
        console.log('🗑️ Disposing all audio resources...');

        // Remove all mixer inserts
        Array.from(this.mixerInserts.keys()).forEach(insertId => {
            this.removeMixerInsert(insertId);
        });

        // Remove all instruments
        Array.from(this.instruments.keys()).forEach(instrumentId => {
            this.removeInstrument(instrumentId);
        });

        console.log('✅ All audio resources disposed');
    }

}

class NativeSynthInstrument {
    constructor(instrumentData, workletManager, audioContext) {
        this.id = instrumentData.id;
        this.name = instrumentData.name;
        this.type = 'synth';
        this.synthParams = instrumentData.synthParams;
        this.workletManager = workletManager;
        this.audioContext = audioContext;

        this.workletNode = null;
        this.internalOutput = null; // ✅ NEW: Direct worklet output
        this.output = null; // ✅ Public output (may be last effect or internalOutput)
        this.parameters = new Map();
        this.activeNotes = new Set();

        // ⚡ PERFORMANCE: Use global message pool for zero-GC messaging
        this.messagePool = globalMessagePool;

        // ✅ NEW: Effect chain support
        this.effectChain = [];
        this.effectChainActive = false;
        this.effectChainData = instrumentData.effectChain || [];
    }

    async initialize() {
        const { node } = await this.workletManager.createWorkletNode(
            'instrument-processor',
            {
                numberOfInputs: 0,  // ✅ No external inputs (generates audio)
                numberOfOutputs: 1,
                outputChannelCount: [2],  // ✅ Force stereo output
                channelCount: 2,          // ✅ Force stereo processing
                channelCountMode: 'explicit',  // ✅ Prevent auto-conversion to mono
                channelInterpretation: 'speakers',  // ✅ Stereo interpretation
                processorOptions: {
                    instrumentId: this.id,
                    instrumentName: this.name,
                    synthParams: this.synthParams
                }
            }
        );

        this.workletNode = node;
        this.internalOutput = this.audioContext.createGain();
        this.internalOutput.gain.value = AudioEngineConfig.gain.masterVolume.default;

        // ✅ Force stereo on output gain node (preserve stereo from worklet)
        this.internalOutput.channelCount = 2;
        this.internalOutput.channelCountMode = 'explicit';
        this.internalOutput.channelInterpretation = 'speakers';

        this.output = this.internalOutput; // Default: direct connection

        this.workletNode.connect(this.internalOutput);

        // ✅ NEW: Initialize effect chain if provided
        if (this.effectChainData && this.effectChainData.length > 0) {
            this.setEffectChain(this.effectChainData);
        }

        // Setup parameters
        ['pitch', 'gate', 'velocity', 'detune', 'filterFreq', 'filterQ',
         'attack', 'decay', 'sustain', 'release'].forEach(paramName => {
            const param = this.workletNode.parameters.get(paramName);
            if (param) {
                this.parameters.set(paramName, param);
            }
        });

    }

    triggerNote(pitch, velocity = 1, time = null, duration = null) {
        time = time || this.audioContext.currentTime;

        const frequency = this._pitchToFrequency(pitch);

        // ✅ RAW SIGNAL: Direct velocity to gain mapping (no reduction!)
        // MIDI velocity 0-127 → Audio gain 0-1.0
        // User controls final level with mixer faders
        let normalizedVelocity = velocity;
        if (normalizedVelocity > 1) {
            // Direct MIDI to linear: 0-127 → 0-1.0
            normalizedVelocity = normalizedVelocity / 127;
        }

        // ⚡ PERFORMANCE: Use message pool instead of creating new objects
        // OLD: { type: 'noteOn', data: {...} } - new object every note!
        // NEW: Reuse pre-allocated message from pool - zero GC!
        const msg = this.messagePool.acquireNoteOn(pitch, frequency, normalizedVelocity, time, duration);

        this.workletNode.port.postMessage(msg);

        // Store noteId for tracking (use number from pool)
        this.activeNotes.add(msg.data.noteId);

        if (duration) {
            setTimeout(() => {
                this.releaseNote(pitch, time + duration);
            }, duration * 1000);
        }
    }

    releaseNote(pitch, time = null) {
        time = time || this.audioContext.currentTime;
        const frequency = this._pitchToFrequency(pitch);

        // ⚡ PERFORMANCE: Use message pool for noteOff too
        const msg = this.messagePool.acquireNoteOff(pitch, frequency, time, 0);

        this.workletNode.port.postMessage(msg);

        // Note: noteId tracking simplified - using pitch as key
        this.activeNotes.delete(pitch);
    }

    allNotesOff() {
        this.workletNode.port.postMessage({
            type: 'allNotesOff',
            data: { time: this.audioContext.currentTime }
        });
        this.activeNotes.clear();
    }

    updateParameters(params) {
        Object.entries(params).forEach(([paramName, value]) => {
            const param = this.parameters.get(paramName);
            if (param) {
                param.setTargetAtTime(value, this.audioContext.currentTime, 0.01);
            }
        });
    }

    _pitchToFrequency(pitch) {
        const noteMap = {
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
            'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
        };
        const match = pitch.match(/([A-G]#?)(\d+)/);
        if (!match) return 440;
        
        const noteName = match[1];
        const octave = parseInt(match[2]);
        const midiNumber = (octave + 1) * 12 + noteMap[noteName];
        return 440 * Math.pow(2, (midiNumber - 69) / 12);
    }

    getActiveVoiceCount() {
        return this.activeNotes.size;
    }

    dispose() {
        this.allNotesOff();
        if (this.workletNode) {
            this.workletNode.disconnect();
        }
        // ✅ NEW: Dispose effect chain
        if (this.effectChain.length > 0) {
            this.effectChain.forEach(effect => {
                try {
                    effect.disconnect();
                } catch (e) {
                    console.warn('Error disconnecting effect:', e);
                }
            });
        }
        if (this.output) {
            this.output.disconnect();
        }
    }

    // ✅ NEW: Set or update effect chain
    setEffectChain(effectChainData) {
        console.log(`🎛️ NativeSynthInstrument.setEffectChain:`, this.name, effectChainData);

        // Disconnect old effect chain
        if (this.effectChain.length > 0) {
            this.effectChain.forEach(effect => {
                try {
                    effect.disconnect();
                } catch (e) {
                    console.warn('Error disconnecting effect:', e);
                }
            });
            this.effectChain = [];
        }

        // Reset to direct connection
        if (this.internalOutput) {
            this.internalOutput.disconnect();
        }

        if (!effectChainData || effectChainData.length === 0) {
            // No effects, connect directly to output
            this.output = this.internalOutput;
            this.effectChainActive = false;
            return;
        }

        // Build effect chain
        let currentNode = this.internalOutput;

        for (const effectData of effectChainData) {
            try {
                const effect = EffectFactory.deserialize(effectData, this.audioContext);
                if (!effect) {
                    console.warn(`Failed to create effect: ${effectData.type}`);
                    continue;
                }

                // Connect current node to effect input
                currentNode.connect(effect.inputNode);
                currentNode = effect.outputNode;

                this.effectChain.push(effect);
                console.log(`🎛️ Added effect: ${effect.name} (${effect.type})`);
            } catch (error) {
                console.error(`Error creating effect ${effectData.type}:`, error);
            }
        }

        // Final output is the last effect's output
        this.output = currentNode;
        this.effectChainActive = true;
        console.log(`✅ Effect chain set for ${this.name}: ${this.effectChain.length} effects`);
    }
}

// ⚠️ REMOVED: NativeMixerChannel class (old mixer-processor system)
// All mixer functionality now handled by UnifiedMixerNode
// The old ~370 line class has been completely removed to simplify codebase

// =================== NATIVE EFFECT CLASS ===================

class NativeEffect {
    constructor(id, type, node, settings = {}) {
        this.id = id;
        this.type = type;
        this.node = node;
        this.settings = settings;
        this.bypass = false;

        // Setup parameters if available - NEW: Dynamic parameter detection
        this.parameters = new Map();
        if (node.parameters) {
            // Get all available parameters from the node
            const paramNames = [];
            for (const [name] of node.parameters) {
                paramNames.push(name);
            }

            // Register all available parameters
            paramNames.forEach(paramName => {
                const param = node.parameters.get(paramName);
                if (param) {
                    this.parameters.set(paramName, param);
                }
            });

            console.log(`📊 Effect ${type} registered ${paramNames.length} parameters:`, paramNames);
        }
    }

    updateParameter(paramName, value) {
        const param = this.parameters.get(paramName);
        if (param) {
            // OPTIMIZED: Use linearRampToValueAtTime for smoother, cheaper updates
            const audioContext = this.node.context;
            if (audioContext && audioContext.currentTime !== undefined) {
                const now = audioContext.currentTime;

                // Cancel any scheduled changes to avoid glitches
                param.cancelScheduledValues(now);

                // Use linear ramp for smooth transition (cheaper than setTargetAtTime)
                param.setValueAtTime(param.value, now);
                param.linearRampToValueAtTime(value, now + 0.015); // 15ms ramp
            } else {
                // Fallback: set value directly
                param.value = value;
            }
        }

        // Update internal settings
        this.settings[paramName] = value;

        // REMOVED: postMessage to worklet - AudioParam already handles this automatically
    }

    setBypass(bypassed) {
        this.bypass = bypassed;
        if (this.node.port) {
            this.node.port.postMessage({
                type: 'bypass',
                data: { bypassed }
            });
        }
    }

    dispose() {
        if (this.node) {
            this.node.disconnect();
        }
    }
}

// =================== PATTERN DATA CLASS ===================

class PatternData {
    constructor(id, name, data = {}) {
        this.id = id;
        this.name = name;
        this.data = data; // instrumentId -> notes[]
        this.length = this._calculateLength();
    }

    _calculateLength() {
        let maxTime = 0;
        Object.values(this.data).forEach(notes => {
            if (Array.isArray(notes)) {
                notes.forEach(note => {
                    const noteEnd = (note.time || 0) + (note.duration ? 
                        NativeTimeUtils.parseTime(note.duration, 120) / NativeTimeUtils.parseTime('16n', 120) : 1);
                    if (noteEnd > maxTime) {
                        maxTime = noteEnd;
                    }
                });
            }
        });
        return Math.max(16, Math.ceil(maxTime / 16) * 16); // Round up to nearest bar
    }

    updateInstrumentNotes(instrumentId, notes) {
        this.data[instrumentId] = notes;
        this.length = this._calculateLength();
    }

    addNote(instrumentId, note) {
        if (!this.data[instrumentId]) {
            this.data[instrumentId] = [];
        }
        this.data[instrumentId].push(note);
        this.length = this._calculateLength();
    }

    removeNote(instrumentId, noteId) {
        if (this.data[instrumentId]) {
            this.data[instrumentId] = this.data[instrumentId].filter(note => note.id !== noteId);
            this.length = this._calculateLength();
        }
    }

    clear() {
        this.data = {};
        this.length = 16;
    }

    clone() {
        return new PatternData(
            `${this.id}_copy`,
            `${this.name} Copy`,
            JSON.parse(JSON.stringify(this.data))
        );
    }
}

// ⚠️ REMOVED: NativeMixerChannel export (class removed - use UnifiedMixer instead)
export { PlaybackManager, NativeSynthInstrument, NativeEffect, PatternData };
