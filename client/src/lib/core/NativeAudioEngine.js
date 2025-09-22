// lib/core/NativeAudioEngine.js
// DAWG - Native Audio Engine - ToneJS'siz tam native implementasyon

import { NativeTransportSystem } from './NativeTransportSystem.js';
import { WorkletManager } from '../audio/WorkletManager.js';

export class NativeAudioEngine {
    constructor(callbacks = {}) {
        // Core systems
        this.audioContext = null;
        this.transport = null;
        this.workletManager = null;

        // Callback functions
        this.setPlaybackState = callbacks.setPlaybackState || (() => {});
        this.setTransportPosition = callbacks.setTransportPosition || (() => {});
        this.onPatternChange = callbacks.onPatternChange || (() => {});

        // Audio routing
        this.masterGain = null;
        this.compressor = null;
        this.analyzer = null;

        // Instruments ve mixing
        this.instruments = new Map(); // Native instruments
        this.mixerStrips = new Map(); // Native mixer strips
        this.effects = new Map(); // Global effects
        this.sends = new Map(); // Send effects (reverb, delay)

        // Pattern ve sequencing
        this.patterns = new Map();
        this.activePatternId = null;
        this.patternLength = 16; // Default pattern length in steps
        this.currentStep = 0;

        // Performance tracking
        this.metrics = {
            instrumentsCreated: 0,
            activeVoices: 0,
            cpuLoad: 0,
            audioLatency: 0,
            dropouts: 0
        };

        // State
        this.isInitialized = false;
        this.engineMode = 'native';

        console.log('🎵 NativeAudioEngine constructor completed');
    }

    // =================== INITIALIZATION ===================

    async initialize() {
        try {
            console.log('🔄 Initializing NativeAudioEngine...');

            // 1. Native AudioContext oluştur
            await this.initializeAudioContext();

            // 2. Transport system'ı initialize et
            this.transport = new NativeTransportSystem(this.audioContext);
            this.setupTransportCallbacks();

            // 3. WorkletManager'ı initialize et
            this.workletManager = new WorkletManager(this.audioContext);
            await this.loadRequiredWorklets();

            // 4. Master audio chain'i kur
            this.setupMasterAudioChain();

            // 5. Default mixer strips oluştur
            this.createDefaultMixerStrips();

            this.isInitialized = true;
            console.log('✅ NativeAudioEngine initialized successfully');

            return this;

        } catch (error) {
            console.error('❌ NativeAudioEngine initialization failed:', error);
            throw error;
        }
    }

    async initializeWithContext(existingContext) {
        try {
            console.log('🔄 Initializing NativeAudioEngine with existing context...');

            // Existing context'i kullan
            this.audioContext = existingContext;

            // Transport system'ı initialize et
            this.transport = new NativeTransportSystem(this.audioContext);
            this.setupTransportCallbacks();

            // WorkletManager'ı initialize et
            this.workletManager = new WorkletManager(this.audioContext);
            await this.loadRequiredWorklets();

            // Master audio chain'i kur
            this.setupMasterAudioChain();

            // Default mixer strips oluştur
            this.createDefaultMixerStrips();

            this.isInitialized = true;
            console.log('✅ NativeAudioEngine initialized with existing context');

            return this;

        } catch (error) {
            console.error('❌ NativeAudioEngine initialization with context failed:', error);
            throw error;
        }
    }

    async initializeAudioContext() {
        const ContextConstructor = window.AudioContext || window.webkitAudioContext;
        if (!ContextConstructor) {
            throw new Error('AudioContext not supported');
        }

        this.audioContext = new ContextConstructor({
            latencyHint: 'interactive', // Low latency için
            sampleRate: 48000 // Yüksek kalite için
        });

        // Context'i resume et (user gesture gerekebilir)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        console.log(`🎵 AudioContext initialized: ${this.audioContext.sampleRate}Hz, ${this.audioContext.state}`);
    }

    async loadRequiredWorklets() {
        try {
            console.log('📦 Loading required AudioWorklets...');

            const workletFiles = [
                { path: '/worklets/instrument-processor.js', name: 'instrument-processor' },
                { path: '/worklets/effects-processor.js', name: 'effects-processor' },
                { path: '/worklets/mixer-processor.js', name: 'mixer-processor' }
            ];

            for (const worklet of workletFiles) {
                try {
                    await this.workletManager.loadWorklet(worklet.path, worklet.name);
                    console.log(`✅ Worklet loaded: ${worklet.name}`);
                } catch (error) {
                    console.warn(`⚠️ Worklet load failed: ${worklet.name}`, error);
                }
            }

        } catch (error) {
            console.error('❌ Worklet loading failed:', error);
            throw error;
        }
    }

    // =================== MASTER AUDIO CHAIN ===================

    setupMasterAudioChain() {
        console.log('🔗 Setting up master audio chain...');

        // Master gain
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.8;

        // Compressor for output limiting
        this.compressor = this.audioContext.createDynamicsCompressor();
        this.compressor.threshold.value = -12;
        this.compressor.knee.value = 30;
        this.compressor.ratio.value = 8;
        this.compressor.attack.value = 0.001;
        this.compressor.release.value = 0.1;

        // Analyzer for monitoring
        this.analyzer = this.audioContext.createAnalyser();
        this.analyzer.fftSize = 2048;
        this.analyzer.smoothingTimeConstant = 0.85;

        // Chain connection: masterGain -> compressor -> analyzer -> destination
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.analyzer);
        this.analyzer.connect(this.audioContext.destination);

        console.log('✅ Master audio chain established');
    }

    // =================== TRANSPORT CALLBACKS ===================

    setupTransportCallbacks() {
        // Transport events'lerini UI'a forward et
        this.transport.on('start', () => {
            this.setPlaybackState(true);
            console.log('▶️ Playback started');
        });

        this.transport.on('stop', () => {
            this.setPlaybackState(false);
            console.log('⏹️ Playback stopped');
        });

        this.transport.on('tick', (data) => {
            this.setTransportPosition(data.formatted);
            this.handleTransportTick(data);
        });

        this.transport.on('bar', (data) => {
            this.handleBarChange(data);
        });

        this.transport.on('patternEvent', (data) => {
            this.handlePatternEvent(data);
        });
    }

    handleTransportTick(data) {
        // Her tick'te pattern'ları process et
        this.processActivePatterns(data.time, data.position);

        // Step indicator'ı güncelle
        const stepInPattern = Math.floor(data.position / (this.transport.ppq / 4)) % this.patternLength;
        if (stepInPattern !== this.currentStep) {
            this.currentStep = stepInPattern;
            this.onPatternChange({ currentStep: this.currentStep });
        }
    }

    handleBarChange(data) {
        console.log(`🎼 Bar ${data.bar}`);
        // Pattern loop'ları ve bar-based events buraya
    }

    handlePatternEvent(data) {
        // Pattern'dan gelen events'leri instrument'lara route et
        const { event } = data;

        if (event.type === 'note' && event.data.instrumentId) {
            this.playInstrumentNote(
                event.data.instrumentId,
                event.data.pitch,
                event.data.velocity || 1,
                data.time,
                event.data.duration
            );
        }
    }

    // =================== INSTRUMENT MANAGEMENT ===================

    async createInstrument(instrumentData) {
        try {
            console.log(`🎯 Creating native instrument: ${instrumentData.name}`);

            const instrument = new NativeInstrument(
                instrumentData,
                this.workletManager,
                this.audioContext
            );

            await instrument.initialize();

            this.instruments.set(instrumentData.id, instrument);

            // Instrument'ı mixer'a connect et
            this.connectInstrumentToMixer(
                instrumentData.id,
                instrumentData.mixerTrackId || 'master'
            );

            this.metrics.instrumentsCreated++;
            console.log(`✅ Native instrument created: ${instrumentData.name}`);

            return instrument;

        } catch (error) {
            console.error(`❌ Instrument creation failed: ${instrumentData.name}`, error);
            throw error;
        }
    }

    connectInstrumentToMixer(instrumentId, mixerTrackId) {
        const instrument = this.instruments.get(instrumentId);
        const mixerStrip = this.mixerStrips.get(mixerTrackId);

        if (instrument && mixerStrip) {
            try {
                // Instrument output'unu mixer strip'ine bağla
                instrument.connect(mixerStrip.input);
                console.log(`🔗 Instrument connected: ${instrumentId} -> ${mixerTrackId}`);
            } catch (error) {
                console.error(`❌ Instrument connection failed:`, error);
            }
        }
    }

    playInstrumentNote(instrumentId, pitch, velocity, time, duration) {
        const instrument = this.instruments.get(instrumentId);
        if (instrument) {
            instrument.triggerNote(pitch, velocity, time, duration);
        }
    }

    updateInstrumentParameters(instrumentId, updatedData) {
        const instrument = this.instruments.get(instrumentId);
        if (instrument && updatedData.synthParams) {
            instrument.updateParameters(updatedData.synthParams);
        }
    }

    // =================== MIXER SYSTEM ===================

    createDefaultMixerStrips() {
        // Master strip
        this.createMixerStrip('master', 'Master', { 
            isMaster: true,
            output: this.masterGain 
        });

        // Default instrument strips
        for (let i = 1; i <= 8; i++) {
            this.createMixerStrip(`track_${i}`, `Track ${i}`, {
                output: this.mixerStrips.get('master').input
            });
        }

        console.log(`✅ Created ${this.mixerStrips.size} mixer strips`);
    }

    createMixerStrip(id, name, options = {}) {
        const strip = new NativeMixerStrip(id, name, this.audioContext, options);
        this.mixerStrips.set(id, strip);
        return strip;
    }

    // =================== PATTERN MANAGEMENT ===================

    loadPattern(patternId, patternData) {
        this.patterns.set(patternId, {
            id: patternId,
            data: patternData,
            length: patternData.length || this.patternLength
        });

        console.log(`📋 Pattern loaded: ${patternId}`);
    }

    setActivePattern(patternId) {
        if (this.patterns.has(patternId)) {
            this.activePatternId = patternId;
            console.log(`🎯 Active pattern set: ${patternId}`);
        }
    }

    processActivePatterns(time, position) {
        if (!this.activePatternId) return;

        const pattern = this.patterns.get(this.activePatternId);
        if (!pattern) return;

        // Pattern içindeki her instrument için events'leri schedule et
        Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
            const instrument = this.instruments.get(instrumentId);
            if (instrument && Array.isArray(notes)) {
                this.schedulePatternNotes(instrument, notes, time, position);
            }
        });
    }

    schedulePatternNotes(instrument, notes, currentTime, position) {
        notes.forEach(note => {
            if (note && note.time !== undefined) {
                const noteTime = this.transport.parseTime(note.time);
                const scheduledTime = currentTime + noteTime;

                // Note'u schedule et
                instrument.triggerNote(
                    note.pitch || note.note,
                    note.velocity || 1,
                    scheduledTime,
                    note.duration
                );
            }
        });
    }

    // =================== PLAYBACK CONTROL ===================

    play() {
        if (!this.isInitialized) {
            console.warn('⚠️ Engine not initialized');
            return;
        }

        this.transport.start();
        return this;
    }

    stop() {
        if (!this.isInitialized) {
            console.warn('⚠️ Engine not initialized');
            return;
        }

        this.transport.stop();
        this.stopAllInstruments();
        return this;
    }

    pause() {
        if (!this.isInitialized) {
            console.warn('⚠️ Engine not initialized');
            return;
        }

        this.transport.pause();
        return this;
    }

    setBPM(bpm) {
        if (this.transport) {
            this.transport.setBPM(bpm);
        }
        return this;
    }

    stopAllInstruments() {
        this.instruments.forEach(instrument => {
            instrument.allNotesOff();
        });
    }

    // =================== AUDITION (Preview) ===================

    auditionNoteOn(instrumentId, pitch, velocity = 1) {
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

    // =================== EFFECTS SYSTEM ===================

    async addGlobalEffect(effectType, settings = {}) {
        try {
            const effectId = `global_${effectType}_${Date.now()}`;

            const { node, nodeId } = await this.workletManager.createWorkletNode(
                'effects-processor',
                {
                    processorOptions: {
                        effectType,
                        settings
                    }
                }
            );

            this.effects.set(effectId, {
                node,
                nodeId,
                type: effectType,
                settings
            });

            // Effect'i master chain'e ekle (master gain'den önce)
            this.masterGain.disconnect();
            this.masterGain.connect(node);
            node.connect(this.compressor);

            console.log(`🎚️ Global effect added: ${effectType}`);
            return effectId;

        } catch (error) {
            console.error(`❌ Failed to add global effect: ${effectType}`, error);
            throw error;
        }
    }

    // =================== PERFORMANCE & MONITORING ===================

    getPerformanceMetrics() {
        const contextMetrics = this.audioContext ? {
            state: this.audioContext.state,
            sampleRate: this.audioContext.sampleRate,
            currentTime: this.audioContext.currentTime.toFixed(3),
            baseLatency: this.audioContext.baseLatency?.toFixed(6) || 'unknown'
        } : {};

        return {
            ...this.metrics,
            transport: this.transport?.getStats(),
            audioContext: contextMetrics,
            instruments: this.instruments.size,
            mixerStrips: this.mixerStrips.size,
            effects: this.effects.size,
            workletManager: this.workletManager?.getStats()
        };
    }

    getAudioAnalysis() {
        if (!this.analyzer) return null;

        const bufferLength = this.analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyzer.getByteFrequencyData(dataArray);

        return {
            frequencyData: dataArray,
            bufferLength,
            sampleRate: this.audioContext.sampleRate
        };
    }

    // =================== CLEANUP ===================

    dispose() {
        console.log('🗑️ Disposing NativeAudioEngine...');

        // Stop playback
        if (this.transport) {
            this.transport.dispose();
        }

        // Dispose instruments
        this.instruments.forEach((instrument, id) => {
            try {
                instrument.dispose();
            } catch (error) {
                console.error(`❌ Error disposing instrument ${id}:`, error);
            }
        });
        this.instruments.clear();

        // Dispose mixer strips
        this.mixerStrips.forEach((strip, id) => {
            try {
                strip.dispose();
            } catch (error) {
                console.error(`❌ Error disposing mixer strip ${id}:`, error);
            }
        });
        this.mixerStrips.clear();

        // Dispose effects
        this.effects.forEach((effect, id) => {
            try {
                this.workletManager.disposeNode(effect.nodeId);
            } catch (error) {
                console.error(`❌ Error disposing effect ${id}:`, error);
            }
        });
        this.effects.clear();

        // Dispose worklet manager
        if (this.workletManager) {
            this.workletManager.disposeAllNodes();
        }

        // Close audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }

        console.log('✅ NativeAudioEngine disposed');
    }
}

// =================== NATIVE INSTRUMENT CLASS ===================

class NativeInstrument {
    constructor(instrumentData, workletManager, audioContext) {
        this.id = instrumentData.id;
        this.name = instrumentData.name;
        this.type = instrumentData.type;
        this.workletManager = workletManager;
        this.audioContext = audioContext;

        // Audio nodes
        this.workletNode = null;
        this.workletNodeId = null;
        this.outputGain = null;

        // Parameters
        this.parameters = new Map();

        // State
        this.isReady = false;
    }

    async initialize() {
        try {
            // Create worklet node
            const { node, nodeId } = await this.workletManager.createWorkletNode(
                'instrument-processor',
                {
                    numberOfInputs: 0,
                    numberOfOutputs: 1,
                    outputChannelCount: [2],
                    processorOptions: {
                        instrumentId: this.id,
                        instrumentName: this.name,
                        instrumentType: this.type
                    }
                }
            );

            this.workletNode = node;
            this.workletNodeId = nodeId;

            // Create output gain
            this.outputGain = this.audioContext.createGain();
            this.outputGain.gain.value = 0.8;

            // Connect
            this.workletNode.connect(this.outputGain);

            // Setup parameters
            this.setupParameters();

            this.isReady = true;
            console.log(`✅ Native instrument initialized: ${this.name}`);

        } catch (error) {
            console.error(`❌ Native instrument initialization failed: ${this.name}`, error);
            throw error;
        }
    }

    setupParameters() {
        // Map AudioWorkletProcessor parameters
        if (this.workletNode.parameters) {
            ['pitch', 'gate', 'velocity', 'detune', 'filterFreq', 'filterQ',
             'attack', 'decay', 'sustain', 'release'].forEach(paramName => {
                const param = this.workletNode.parameters.get(paramName);
                if (param) {
                    this.parameters.set(paramName, param);
                }
            });
        }
    }

    triggerNote(pitch, velocity = 1, time = null, duration = null) {
        if (!this.isReady) return;

        time = time || this.audioContext.currentTime;

        this.workletNode.port.postMessage({
            type: 'noteOn',
            data: { pitch, velocity, time, duration }
        });
    }

    releaseNote(pitch, time = null) {
        if (!this.isReady) return;

        time = time || this.audioContext.currentTime;

        this.workletNode.port.postMessage({
            type: 'noteOff',
            data: { pitch, time }
        });
    }

    allNotesOff() {
        if (!this.isReady) return;

        this.workletNode.port.postMessage({
            type: 'allNotesOff',
            data: { time: this.audioContext.currentTime }
        });
    }

    updateParameters(params) {
        Object.entries(params).forEach(([paramName, value]) => {
            const param = this.parameters.get(paramName);
            if (param) {
                param.setTargetAtTime(value, this.audioContext.currentTime, 0.01);
            }
        });
    }

    connect(destination) {
        this.outputGain.connect(destination);
    }

    disconnect() {
        this.outputGain.disconnect();
    }

    dispose() {
        if (this.workletNode) {
            this.workletNode.disconnect();
        }
        if (this.outputGain) {
            this.outputGain.disconnect();
        }
        if (this.workletNodeId) {
            this.workletManager.disposeNode(this.workletNodeId);
        }
    }
}

// =================== NATIVE MIXER STRIP CLASS ===================

class NativeMixerStrip {
    constructor(id, name, audioContext, options = {}) {
        this.id = id;
        this.name = name;
        this.audioContext = audioContext;
        this.isMaster = options.isMaster || false;

        // Audio nodes
        this.input = audioContext.createGain();
        this.gain = audioContext.createGain();
        this.eq = this.createEQ();
        this.output = options.output || null;

        // Default settings
        this.gain.gain.value = 0.8;

        // Setup signal chain
        this.setupSignalChain();
    }

    createEQ() {
        // Simple 3-band EQ
        const lowShelf = this.audioContext.createBiquadFilter();
        const mid = this.audioContext.createBiquadFilter();
        const highShelf = this.audioContext.createBiquadFilter();

        lowShelf.type = 'lowshelf';
        lowShelf.frequency.value = 200;

        mid.type = 'peaking';
        mid.frequency.value = 1000;
        mid.Q.value = 0.5;

        highShelf.type = 'highshelf';
        highShelf.frequency.value = 3000;

        // Chain EQ
        lowShelf.connect(mid);
        mid.connect(highShelf);

        return { 
            input: lowShelf, 
            output: highShelf,
            low: lowShelf,
            mid: mid,
            high: highShelf
        };
    }

    setupSignalChain() {
        // Signal chain: input -> gain -> eq -> output
        this.input.connect(this.gain);
        this.gain.connect(this.eq.input);

        if (this.output) {
            this.eq.output.connect(this.output);
        }
    }

    setGain(value) {
        this.gain.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.01);
    }

    dispose() {
        this.input.disconnect();
        this.gain.disconnect();
        this.eq.input.disconnect();
        this.eq.output.disconnect();
    }
}
