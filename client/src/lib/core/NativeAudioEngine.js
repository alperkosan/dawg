import { NativeTransportSystem } from './NativeTransportSystem.js';
import { ImprovedWorkletManager } from '../audio/ImprovedWorkletManager.js';
import { PlaybackManager } from './PlaybackManager.js';
import { NativeTimeUtils } from '../utils/NativeTimeUtils.js';
import { setGlobalAudioContext } from '../utils/audioUtils.js';
// HATA DÜZELTMESİ 2: Eksik olan NativeSamplerNode sınıfını import ediyoruz.
import { NativeSamplerNode } from './nodes/NativeSamplerNode.js';

export class NativeAudioEngine {
    constructor(callbacks = {}) {
        // =================== CORE SYSTEMS ===================
        this.audioContext = null;
        this.transport = null;
        this.workletManager = null;
        this.playbackManager = null; // ✅ NEW: Advanced playback management
        
        // =================== CALLBACK FUNCTIONS ===================
        this.setPlaybackState = callbacks.setPlaybackState || (() => {});
        this.setTransportPosition = callbacks.setTransportPosition || (() => {});
        this.onPatternChange = callbacks.onPatternChange || (() => {});
        
        // =================== AUDIO ROUTING ===================
        this.masterMixer = null;
        this.masterCompressor = null;
        this.masterAnalyzer = null;
        this.masterLimiter = null;
        
        // =================== INSTRUMENTS & CHANNELS ===================
        this.instruments = new Map();
        this.mixerChannels = new Map();
        this.effects = new Map();
        this.sends = new Map();
        
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

        // 3. Setup Master Audio Chain
        await this._setupMasterAudioChain();

        // 4. Create Default Channels
        this._createDefaultChannels();

        // 5. ✅ NEW: Initialize PlaybackManager
        this.playbackManager = new PlaybackManager(this);
        this._setupPlaybackManagerCallbacks();

        // 6. Initialize Performance Monitoring
        this._initializePerformanceMonitoring();

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
                { path: '/worklets/effects-processor.js', name: 'effects-processor' },
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

        // Master Mixer (Native Worklet)
        const { node: masterMixerNode } = await this.workletManager.createWorkletNode(
            'mixer-processor',
            {
                numberOfInputs: 8, // Multiple inputs for mixing
                numberOfOutputs: 1,
                outputChannelCount: [2],
                processorOptions: {
                    stripId: 'master',
                    stripName: 'Master Mix'
                }
            }
        );

        this.masterMixer = {
            node: masterMixerNode,
            input: masterMixerNode,
            parameters: new Map([
                ['gain', masterMixerNode.parameters.get('gain')],
                ['lowGain', masterMixerNode.parameters.get('lowGain')],
                ['midGain', masterMixerNode.parameters.get('midGain')],
                ['highGain', masterMixerNode.parameters.get('highGain')]
            ])
        };

        // Master Compressor
        this.masterCompressor = this.audioContext.createDynamicsCompressor();
        this.masterCompressor.threshold.value = -12;
        this.masterCompressor.knee.value = 30;
        this.masterCompressor.ratio.value = 8;
        this.masterCompressor.attack.value = 0.001;
        this.masterCompressor.release.value = 0.1;

        // Master Limiter (Simple Gain with Soft Clipping)
        this.masterLimiter = this.audioContext.createGain();
        this.masterLimiter.gain.value = 0.95;

        // Master Analyzer
        this.masterAnalyzer = this.audioContext.createAnalyser();
        this.masterAnalyzer.fftSize = 2048;
        this.masterAnalyzer.smoothingTimeConstant = 0.8;

        // Connect master chain
        this.masterMixer.node.connect(this.masterCompressor);
        this.masterCompressor.connect(this.masterLimiter);
        this.masterLimiter.connect(this.masterAnalyzer);
        this.masterAnalyzer.connect(this.audioContext.destination);

    }

    _setupTransportCallbacks() {
        this.transport.on('start', () => {
            // this.setPlaybackState('playing'); // ✅ Handled by PlaybackController
            this._startPerformanceMonitoring();
        });

        this.transport.on('stop', () => {
            // this.setPlaybackState('stopped'); // ✅ Handled by PlaybackController
            this._stopPerformanceMonitoring();
            this._stopAllInstruments();
        });

        this.transport.on('pause', () => {
            // this.setPlaybackState('paused'); // ✅ Handled by PlaybackController
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
    }

    // =================== INSTRUMENT MANAGEMENT ===================

    async createInstrument(instrumentData) {
        try {
    
            let instrument;
    
            if (instrumentData.type === 'sample') {
                // ✅ DÜZELTME: NativeSamplerNode artık doğru import edildi
                instrument = new NativeSamplerNode(
                    instrumentData,
                    this.sampleBuffers.get(instrumentData.id),
                    this.audioContext
                );
                
                
            } else if (instrumentData.type === 'synth') {
                // Synth için WorkletInstrument kullan
                instrument = new NativeSynthInstrument(
                    instrumentData,
                    this.workletManager,
                    this.audioContext
                );
    
                // Synth'lerin asenkron bir initialize metodu olabilir.
                if (typeof instrument.initialize === 'function') {
                    await instrument.initialize();
                }
                
                
            } else {
                throw new Error(`❌ Unknown instrument type: ${instrumentData.type}`);
            }
            
            this.instruments.set(instrumentData.id, instrument);
    
            // Connect to mixer channel
            const channelId = instrumentData.mixerTrackId || 'master';
            this._connectInstrumentToChannel(instrumentData.id, channelId);
    
            this.metrics.instrumentsCreated++;
    
            return instrument;
    
        } catch (error) {
            throw error;
        }
    }

    // =================== MIXER CHANNELS ===================

    _createDefaultChannels() {
        // Master channel
        this._createMixerChannel('master', 'Master', { isMaster: true });

        // Default bus channels
        this._createMixerChannel('bus-1', 'Reverb Bus', { type: 'bus' });
        this._createMixerChannel('bus-2', 'Delay Bus', { type: 'bus' });
        this._createMixerChannel('bus-3', 'Drum Bus', { type: 'bus' });


        // Default instrument channels
        for (let i = 1; i <= 16; i++) {
            this._createMixerChannel(`track-${i}`, `Track ${i}`, { type: 'track' });
        }

    }

    async _createMixerChannel(id, name, options = {}) {
        try {
            // 1. Mikser kanalı için AudioWorkletNode'u oluşturuyoruz.
            const { node: mixerNode } = await this.workletManager.createWorkletNode(
                'mixer-processor',
                {
                    processorOptions: {
                        stripId: id,
                        stripName: name
                    }
                }
            );

            // 2. Kendi NativeMixerChannel sınıfımızı kullanarak yeni bir kanal örneği oluşturuyoruz.
            //    Bu, ona worklet yöneticisini (workletManager) de ileterek efektlerin
            //    doğru şekilde oluşturulmasını sağlar.
            const channel = new NativeMixerChannel(
                id,
                name,
                mixerNode,
                this.audioContext,
                this.workletManager, // Efekt yönetimi için bu referans kritikti.
                options
            );

            // 3. Oluşturulan kanalı, motorun ana listesine ekliyoruz.
            this.mixerChannels.set(id, channel);

            // 4. ANA DÜZELTME: Eğer bu kanal Master'ın kendisi DEĞİLSE,
            //    çıkışını Master kanalının girişine bağlıyoruz. Bu, sesin duyulmasını sağlar.
            if (!options.isMaster && this.masterMixer?.input) {
                channel.connect(this.masterMixer.input);
            }

            this.metrics.channelsCreated++;
            return channel;

        } catch (error) {
            throw error;
        }
    }

    // =================== MIXER CONTROLS ===================

    setChannelVolume(channelId, volume) {
        const channel = this.mixerChannels.get(channelId);
        if (channel) {
            channel.setVolume(volume);
        }
    }

    setChannelPan(channelId, pan) {
        const channel = this.mixerChannels.get(channelId);
        if (channel) {
            channel.setPan(pan);
        }
    }

    setChannelMute(channelId, muted) {
        const channel = this.mixerChannels.get(channelId);
        if (channel) {
            channel.setMute(muted);
        }
    }

    setMasterVolume(volume) {
        if (this.masterLimiter) {
            this.masterLimiter.gain.setTargetAtTime(
                volume,
                this.audioContext.currentTime,
                0.02
            );
        }
    }

    // =================== AUDITION (PREVIEW) ===================

    auditionNoteOn(instrumentId, pitch, velocity = 0.8) {
        const instrument = this.instruments.get(instrumentId);
        if (instrument) {
            instrument.triggerNote(pitch, velocity);
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

    getChannelMeterData(channelId) {
        const channel = this.mixerChannels.get(channelId);
        if (!channel?.analyzer) return null;

        const bufferLength = channel.analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        channel.analyzer.getByteFrequencyData(dataArray);

        return {
            frequencyData: dataArray,
            rms: this._calculateRMS(dataArray),
            peak: Math.max(...dataArray),
            channelId
        };
    }

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
            mixerChannels: this.mixerChannels.size,
            workletManager: this.workletManager?.getDetailedStats(),
            transport: this.transport?.getStats(),
            playback: this.playbackManager?.getPlaybackStatus() // ✅ NEW: Playback status
        };
    }

    // =================== UTILITY METHODS ===================

    _connectInstrumentToChannel(instrumentId, channelId) {
        const instrument = this.instruments.get(instrumentId);
        const channel = this.mixerChannels.get(channelId);
    
        if (!instrument) {
            return false;
        }
        
        if (!channel) {
            return false;
        }
    
        // Instrument output kontrolü
        if (!instrument.output) {
            return false;
        }
    
        // Channel input kontrolü  
        if (!channel.input) {
            return false;
        }
    
        try {
            instrument.output.connect(channel.input);
            return true;
        } catch (error) {
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

        // Dispose mixer channels
        this.mixerChannels.forEach((channel, id) => {
            try {
                channel.dispose();
            } catch (error) {
            }
        });
        this.mixerChannels.clear();

        // Dispose worklet manager
        if (this.workletManager) {
            this.workletManager.dispose();
        }

        // Close audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }

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
        this.output = null;
        this.parameters = new Map();
        this.activeNotes = new Set();
    }

    async initialize() {
        const { node } = await this.workletManager.createWorkletNode(
            'instrument-processor',
            {
                processorOptions: {
                    instrumentId: this.id,
                    instrumentName: this.name,
                    synthParams: this.synthParams
                }
            }
        );

        this.workletNode = node;
        this.output = this.audioContext.createGain();
        this.output.gain.value = 0.8;

        this.workletNode.connect(this.output);

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
        const noteId = `${pitch}_${time}`;

        this.workletNode.port.postMessage({
            type: 'noteOn',
            data: { pitch: frequency, velocity, time, duration, noteId }
        });

        this.activeNotes.add(noteId);

        if (duration) {
            setTimeout(() => {
                this.releaseNote(pitch, time + duration);
            }, duration * 1000);
        }
    }

    releaseNote(pitch, time = null) {
        time = time || this.audioContext.currentTime;
        const frequency = this._pitchToFrequency(pitch);

        this.workletNode.port.postMessage({
            type: 'noteOff',
            data: { pitch: frequency, time }
        });

        const noteId = `${pitch}_${time}`;
        this.activeNotes.delete(noteId);
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
        if (this.output) {
            this.output.disconnect();
        }
    }
}

// =================== NATIVE MIXER CHANNEL CLASS ===================

class NativeMixerChannel {
    constructor(id, name, mixerNode, audioContext, workletManager, options = {}) {
        this.id = id;
        this.name = name;
        this.mixerNode = mixerNode;
        this.audioContext = audioContext;
        this.workletManager = workletManager; // EKLENDİ
        this.isMaster = options.isMaster || false;
        this.type = options.type || 'track';

        // Audio nodes
        this.input = this.mixerNode;
        this.output = this.audioContext.createGain();
        this.analyzer = this.audioContext.createAnalyser();

        // Parameters
        this.parameters = new Map([
            ['gain', this.mixerNode.parameters.get('gain')],
            ['pan', this.mixerNode.parameters.get('pan')],
            ['lowGain', this.mixerNode.parameters.get('lowGain')],
            ['midGain', this.mixerNode.parameters.get('midGain')],
            ['highGain', this.mixerNode.parameters.get('highGain')]
        ]);

        // Effects chain
        this.effects = new Map();
        this.sends = new Map();

        // State
        this.isMuted = false;
        this.isSoloed = false;
        this.volume = 0.8;
        this.pan = 0;

        this._setupAnalyzer();
        this._setupSignalChain();
    }

    _setupAnalyzer() {
        this.analyzer.fftSize = 1024;
        this.analyzer.smoothingTimeConstant = 0.8;
    }

    _setupSignalChain() {
        // Basic signal chain: mixerNode -> analyzer -> output
        this.mixerNode.connect(this.analyzer);
        this.analyzer.connect(this.output);
    }

    // =================== PARAMETER CONTROLS ===================

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(2, volume));
        const param = this.parameters.get('gain');
        if (param) {
            param.setTargetAtTime(this.volume, this.audioContext.currentTime, 0.02);
        }
    }

    setPan(pan) {
        this.pan = Math.max(-1, Math.min(1, pan));
        const param = this.parameters.get('pan');
        if (param) {
            param.setTargetAtTime(this.pan, this.audioContext.currentTime, 0.02);
        }
    }

    setMute(muted) {
        this.isMuted = muted;
        const gainValue = muted ? 0 : this.volume;
        const param = this.parameters.get('gain');
        if (param) {
            param.setTargetAtTime(gainValue, this.audioContext.currentTime, 0.02);
        }
    }

    setSolo(soloed, isAnySoloed) {
        this.isSoloed = soloed;
        const shouldMute = isAnySoloed && !soloed;
        this.setMute(shouldMute);
    }

    // =================== EQ CONTROLS ===================

    setEQBand(band, gain) {
        const paramName = `${band}Gain`;
        const param = this.parameters.get(paramName);
        if (param) {
            const dbGain = Math.max(-18, Math.min(18, gain));
            param.setTargetAtTime(dbGain, this.audioContext.currentTime, 0.02);
        }
    }

    // =================== EFFECTS MANAGEMENT ===================

    async addEffect(effectType, settings = {}) {
        try {
            const effectId = `${this.id}_effect_${Date.now()}`;
            
            // Create effect using worklet
            // HATA DÜZELTMESİ 1: Artık this.workletManager'a erişebiliyoruz.
            const workletResult = await this.workletManager?.createWorkletNode(
                'effects-processor',
                {
                    processorOptions: {
                        effectType,
                        settings
                    }
                }
            );

            if (!workletResult) {
                throw new Error("Worklet node could not be created.");
            }
            
            const { node } = workletResult;

            const effect = new NativeEffect(effectId, effectType, node, settings);
            this.effects.set(effectId, effect);

            // Rebuild signal chain with new effect
            this._rebuildEffectChain();

            return effectId;

        } catch (error) {
            throw error;
        }
    }

    removeEffect(effectId) {
        const effect = this.effects.get(effectId);
        if (effect) {
            effect.dispose();
            this.effects.delete(effectId);
            this._rebuildEffectChain();
        }
    }

    _rebuildEffectChain() {
        // Disconnect all current connections
        this.mixerNode.disconnect();
        this.effects.forEach(effect => effect.node.disconnect());

        // Rebuild chain: mixerNode -> effects -> analyzer -> output
        let currentNode = this.mixerNode;
        
        this.effects.forEach(effect => {
            currentNode.connect(effect.node);
            currentNode = effect.node;
        });

        currentNode.connect(this.analyzer);
        this.analyzer.connect(this.output);
    }

    // =================== ANALYSIS ===================

    getAnalysisData() {
        const bufferLength = this.analyzer.frequencyBinCount;
        const frequencyData = new Uint8Array(bufferLength);
        const timeDomainData = new Uint8Array(bufferLength);

        this.analyzer.getByteFrequencyData(frequencyData);
        this.analyzer.getByteTimeDomainData(timeDomainData);

        return {
            frequency: frequencyData,
            timeDomain: timeDomainData,
            bufferLength,
            sampleRate: this.audioContext.sampleRate
        };
    }

    getMeterData() {
        const analysisData = this.getAnalysisData();
        if (!analysisData) return { peak: 0, rms: 0 };

        const peak = Math.max(...analysisData.frequency) / 255;
        let sum = 0;
        for (let i = 0; i < analysisData.frequency.length; i++) {
            sum += Math.pow(analysisData.frequency[i] / 255, 2);
        }
        const rms = Math.sqrt(sum / analysisData.frequency.length);

        // Convert to dB
        const peakDb = 20 * Math.log10(Math.max(peak, 0.001));
        const rmsDb = 20 * Math.log10(Math.max(rms, 0.001));

        return { peak: peakDb, rms: rmsDb };
    }

    // =================== CONNECTION ===================

    connect(destination) {
        this.output.connect(destination);
    }

    disconnect() {
        this.output.disconnect();
    }

    dispose() {
        this.effects.forEach(effect => effect.dispose());
        this.effects.clear();
        
        if (this.mixerNode) {
            this.mixerNode.disconnect();
        }
        if (this.output) {
            this.output.disconnect();
        }
        if (this.analyzer) {
            this.analyzer.disconnect();
        }
        
    }
}

// =================== NATIVE EFFECT CLASS ===================

class NativeEffect {
    constructor(id, type, node, settings = {}) {
        this.id = id;
        this.type = type;
        this.node = node;
        this.settings = settings;
        this.bypass = false;

        // Setup parameters if available
        this.parameters = new Map();
        if (node.parameters) {
            ['drive', 'tone', 'level', 'delayTime', 'feedback', 'mix'].forEach(paramName => {
                const param = node.parameters.get(paramName);
                if (param) {
                    this.parameters.set(paramName, param);
                }
            });
        }
    }

    updateParameter(paramName, value) {
        const param = this.parameters.get(paramName);
        if (param) {
            param.setTargetAtTime(value, param.context.currentTime, 0.01);
        }

        // Also update internal settings
        this.settings[paramName] = value;

        // Send message to worklet if needed
        if (this.node.port) {
            this.node.port.postMessage({
                type: 'updateSettings',
                data: { [paramName]: value }
            });
        }
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

export { PlaybackManager, NativeSynthInstrument, NativeMixerChannel, NativeEffect, PatternData };
