// ============================================================================
// BÜYÜK PROJE İÇİN ENTERPRİSE SES MOTORU
// ============================================================================

// 1. INSTRUMENT FACTORY - Dinamik instrument tipi seçimi
class InstrumentFactory {
  static create(instrumentData, buffer, config = {}) {
    const {
      maxPolyphony = 16,
      preferNative = true,
      enableVoiceSteal = true,
      optimizeForLatency = false
    } = config;

    // Instrument tipini otomatik belirle
    if (instrumentData.requiresPolyphony || maxPolyphony > 1) {
      return new EnterpriseMultiInstrument(instrumentData, buffer, {
        maxPolyphony,
        enableVoiceSteal,
        optimizeForLatency
      });
    } else if (preferNative || optimizeForLatency) {
      return new HighPerformanceNativeInstrument(instrumentData, buffer);
    } else {
      return new OptimizedToneInstrument(instrumentData, buffer);
    }
  }
}

// ============================================================================
// 2. HIGH-PERFORMANCE NATIVE INSTRUMENT
// ============================================================================
class HighPerformanceNativeInstrument {
  constructor(instrumentData, audioBuffer) {
    this.id = instrumentData.id;
    this.baseMidi = 60;
    this.audioBuffer = audioBuffer;
    this.context = Tone.context.rawContext;
    
    // Performance optimizations
    this.sourcePool = [];
    this.poolSize = 8;
    this.currentPoolIndex = 0;
    this.activeVoices = new Map();
    
    // Native Web Audio nodes
    this.masterGain = this.context.createGain();
    this.pannerNode = this.context.createStereoPanner();
    this.compressorNode = this.context.createDynamicsCompressor();
    this.filterNode = this.context.createBiquadFilter();
    
    // Tone.js bridge
    this.output = new Tone.Gain(0);
    
    // Audio chain: masterGain -> panner -> compressor -> filter -> output
    this.masterGain.connect(this.pannerNode);
    this.pannerNode.connect(this.compressorNode);
    this.compressorNode.connect(this.filterNode);
    this.filterNode.connect(this.output.input);
    
    // Initialize source pool
    this._initializeSourcePool();
    
    // Performance metrics
    this.metrics = {
      triggersPerSecond: 0,
      averageLatency: 0,
      voiceCount: 0,
      lastTriggerTime: 0
    };
    
    this.updateParameters(instrumentData);
  }

  _initializeSourcePool() {
    // Pre-allocate source nodes to avoid GC during performance
    for (let i = 0; i < this.poolSize; i++) {
      this.sourcePool.push({
        isActive: false,
        lastUsed: 0,
        noteId: null
      });
    }
  }

  /**
   * ULTRA-LOW LATENCY trigger - Direct Web Audio API
   */
  trigger(time, note, bufferDuration, cutItself, instrumentData) {
    const startTime = performance.now();
    
    try {
      // Performance tracking
      this._updatePerformanceMetrics();
      
      // Get available source from pool
      const sourceIndex = this._getAvailableSourceIndex();
      const sourceInfo = this.sourcePool[sourceIndex];
      
      // Create new source node (can't reuse AudioBufferSourceNode)
      const sourceNode = this.context.createBufferSourceNode();
      sourceNode.buffer = this.audioBuffer;
      
      // Pitch calculation
      const pitchToPlay = instrumentData.pianoRoll ? 
        noteToMidi(note.pitch) : this.baseMidi;
      const semitoneShift = pitchToPlay - this.baseMidi;
      sourceNode.playbackRate.value = semitonesToPlaybackRate(semitoneShift);
      
      // Voice gain for individual note control
      const voiceGain = this.context.createGain();
      const velocity = note.velocity ?? 1.0;
      
      // Connect: source -> voiceGain -> masterGain
      sourceNode.connect(voiceGain);
      voiceGain.connect(this.masterGain);
      
      // Advanced ADSR with exponential curves
      const audioTime = time || this.context.currentTime;
      const duration = note.duration ? Tone.Time(note.duration).toSeconds() : bufferDuration;
      
      this._applyAdvancedEnvelope(voiceGain.gain, audioTime, duration, velocity, instrumentData.envelope);
      
      // Start playback
      sourceNode.start(audioTime);
      sourceNode.stop(audioTime + duration);
      
      // Voice tracking
      const noteId = `${note.pitch}-${audioTime}-${Math.random().toString(36).substr(2, 9)}`;
      sourceInfo.isActive = true;
      sourceInfo.lastUsed = audioTime;
      sourceInfo.noteId = noteId;
      
      this.activeVoices.set(noteId, {
        sourceNode,
        voiceGain,
        startTime: audioTime,
        duration,
        sourceIndex
      });
      
      // Auto cleanup
      sourceNode.onended = () => {
        this._cleanupVoice(noteId);
      };
      
      // Performance measurement
      const latency = performance.now() - startTime;
      this.metrics.averageLatency = (this.metrics.averageLatency * 0.9) + (latency * 0.1);
      
    } catch (error) {
      console.error(`[NATIVE-INSTRUMENT] Trigger error ${this.id}:`, error);
    }
  }

  /**
   * Advanced ADSR envelope with exponential curves
   */
  _applyAdvancedEnvelope(gainParam, startTime, duration, velocity, envelopeData) {
    const attack = envelopeData?.attack || 0.01;
    const decay = envelopeData?.decay || 0.1;
    const sustain = envelopeData?.sustain || 0.7;
    const release = envelopeData?.release || 0.3;
    
    gainParam.cancelScheduledValues(startTime);
    gainParam.setValueAtTime(0, startTime);
    
    // Attack phase
    gainParam.exponentialRampToValueAtTime(velocity, startTime + attack);
    
    // Decay phase
    gainParam.exponentialRampToValueAtTime(
      velocity * sustain, 
      startTime + attack + decay
    );
    
    // Sustain phase (constant)
    gainParam.setValueAtTime(
      velocity * sustain, 
      startTime + duration - release
    );
    
    // Release phase
    gainParam.exponentialRampToValueAtTime(
      0.001, 
      startTime + duration
    );
  }

  _getAvailableSourceIndex() {
    // Find inactive source
    for (let i = 0; i < this.poolSize; i++) {
      if (!this.sourcePool[i].isActive) {
        return i;
      }
    }
    
    // All busy, find oldest
    let oldestIndex = 0;
    let oldestTime = Infinity;
    
    for (let i = 0; i < this.poolSize; i++) {
      if (this.sourcePool[i].lastUsed < oldestTime) {
        oldestTime = this.sourcePool[i].lastUsed;
        oldestIndex = i;
      }
    }
    
    // Force stop oldest voice
    const oldestSource = this.sourcePool[oldestIndex];
    if (oldestSource.noteId && this.activeVoices.has(oldestSource.noteId)) {
      this._forceStopVoice(oldestSource.noteId);
    }
    
    return oldestIndex;
  }

  _cleanupVoice(noteId) {
    const voice = this.activeVoices.get(noteId);
    if (voice) {
      voice.sourceNode.disconnect();
      voice.voiceGain.disconnect();
      this.sourcePool[voice.sourceIndex].isActive = false;
      this.sourcePool[voice.sourceIndex].noteId = null;
      this.activeVoices.delete(noteId);
    }
  }

  _forceStopVoice(noteId) {
    const voice = this.activeVoices.get(noteId);
    if (voice && voice.sourceNode) {
      try {
        voice.sourceNode.stop();
      } catch (e) {
        // Already stopped
      }
      this._cleanupVoice(noteId);
    }
  }

  _updatePerformanceMetrics() {
    const now = performance.now();
    const timeSinceLastTrigger = now - this.metrics.lastTriggerTime;
    
    if (timeSinceLastTrigger < 1000) { // 1 second window
      this.metrics.triggersPerSecond++;
    } else {
      this.metrics.triggersPerSecond = 1;
    }
    
    this.metrics.voiceCount = this.activeVoices.size;
    this.metrics.lastTriggerTime = now;
  }

  updateParameters(instrumentData) {
    // Volume
    if (instrumentData.volume !== undefined) {
      this.masterGain.gain.value = Tone.dbToGain(instrumentData.volume);
    }
    
    // Pan
    if (instrumentData.pan !== undefined) {
      this.pannerNode.pan.value = Math.max(-1, Math.min(1, instrumentData.pan));
    }
    
    // Filter
    if (instrumentData.filter) {
      this.filterNode.frequency.value = instrumentData.filter.frequency || 20000;
      this.filterNode.Q.value = instrumentData.filter.resonance || 1;
      this.filterNode.type = instrumentData.filter.type || 'lowpass';
    }
    
    // Compressor
    if (instrumentData.compressor) {
      this.compressorNode.threshold.value = instrumentData.compressor.threshold || -24;
      this.compressorNode.knee.value = instrumentData.compressor.knee || 30;
      this.compressorNode.ratio.value = instrumentData.compressor.ratio || 12;
      this.compressorNode.attack.value = instrumentData.compressor.attack || 0.003;
      this.compressorNode.release.value = instrumentData.compressor.release || 0.25;
    }
  }

  getPerformanceMetrics() {
    return {
      ...this.metrics,
      poolUtilization: (this.activeVoices.size / this.poolSize) * 100
    };
  }

  dispose() {
    // Stop all active voices
    for (const [noteId, voice] of this.activeVoices) {
      this._forceStopVoice(noteId);
    }
    
    this.activeVoices.clear();
    this.sourcePool = [];
    this.output.dispose();
  }
}

// ============================================================================
// 3. ENTERPRISE MULTI-INSTRUMENT (ÇOK SESLİLİK)
// ============================================================================
class EnterpriseMultiInstrument {
  constructor(instrumentData, buffers, config = {}) {
    this.id = instrumentData.id;
    this.baseMidi = 60;
    this.config = {
      maxPolyphony: 16,
      enableVoiceSteal: true,
      optimizeForLatency: false,
      ...config
    };
    
    // Voice management
    this.voices = new Map();
    this.voicePool = [];
    this.lruVoices = []; // Least Recently Used tracking
    
    // Audio nodes
    this.output = new Tone.Channel(0, 0);
    this.masterVolume = new Tone.Volume(0);
    this.masterPanner = new Tone.Panner(0);
    this.masterCompressor = new Tone.Compressor({
      threshold: -20,
      ratio: 8,
      attack: 0.01,
      release: 0.1
    });
    
    // Multiple Tone.Players for polyphony
    this.playerPool = [];
    for (let i = 0; i < this.config.maxPolyphony; i++) {
      const player = new Tone.Player(buffers);
      player.connect(this.masterVolume);
      this.playerPool.push({
        player,
        isActive: false,
        noteId: null,
        lastUsed: 0
      });
    }
    
    // Audio chain
    this.masterVolume.connect(this.masterPanner);
    this.masterPanner.connect(this.masterCompressor);
    this.masterCompressor.connect(this.output);
    
    // Performance monitoring
    this.performanceMonitor = {
      maxConcurrentVoices: 0,
      voiceStealCount: 0,
      averageVoiceTime: 0,
      lastCleanup: Date.now()
    };
    
    this.updateParameters(instrumentData);
  }

  /**
   * POLYPHONIC trigger with voice stealing
   */
  trigger(time, note, bufferDuration, cutItself, instrumentData) {
    try {
      const noteId = this._generateNoteId(note, time);
      
      // Voice stealing if needed
      if (this.voices.size >= this.config.maxPolyphony) {
        if (this.config.enableVoiceSteal) {
          this._stealOldestVoice();
        } else {
          console.warn(`[MULTI-INSTRUMENT] Max polyphony reached: ${this.id}`);
          return;
        }
      }
      
      // Get available player
      const playerInfo = this._getAvailablePlayer();
      if (!playerInfo) {
        console.warn(`[MULTI-INSTRUMENT] No available player: ${this.id}`);
        return;
      }
      
      const { player } = playerInfo;
      
      // Pitch calculation
      const pitchToPlay = instrumentData.pianoRoll ? 
        noteToMidi(note.pitch) : this.baseMidi;
      const semitoneShift = pitchToPlay - this.baseMidi;
      player.playbackRate = semitonesToPlaybackRate(semitoneShift);
      
      // Individual voice envelope
      const voiceEnvelope = new Tone.AmplitudeEnvelope({
        attack: instrumentData.envelope?.attack || 0.01,
        decay: instrumentData.envelope?.decay || 0.1,
        sustain: instrumentData.envelope?.sustain || 0.7,
        release: instrumentData.envelope?.release || 0.3
      });
      
      // Voice-specific volume
      const voiceVolume = new Tone.Volume(Tone.gainToDb(note.velocity || 1.0));
      
      // Connect voice chain: player -> voiceVolume -> voiceEnvelope -> master
      player.disconnect();
      player.connect(voiceVolume);
      voiceVolume.connect(voiceEnvelope);
      voiceEnvelope.connect(this.masterVolume);
      
      // Start playback
      const startTime = time || Tone.now();
      const duration = note.duration ? Tone.Time(note.duration).toSeconds() : bufferDuration;
      
      player.start(startTime);
      voiceEnvelope.triggerAttackRelease(duration, startTime);
      
      // Voice tracking
      const voiceData = {
        player,
        playerInfo,
        voiceEnvelope,
        voiceVolume,
        startTime,
        duration,
        noteId,
        pitch: note.pitch
      };
      
      this.voices.set(noteId, voiceData);
      playerInfo.isActive = true;
      playerInfo.noteId = noteId;
      playerInfo.lastUsed = startTime;
      
      // LRU tracking
      this.lruVoices.push(noteId);
      
      // Auto cleanup
      Tone.Transport.scheduleOnce(() => {
        this._cleanupVoice(noteId);
      }, startTime + duration);
      
      // Performance tracking
      this.performanceMonitor.maxConcurrentVoices = Math.max(
        this.performanceMonitor.maxConcurrentVoices,
        this.voices.size
      );
      
    } catch (error) {
      console.error(`[MULTI-INSTRUMENT] Trigger error ${this.id}:`, error);
    }
  }

  _generateNoteId(note, time) {
    return `${note.pitch}-${time}-${Math.random().toString(36).substr(2, 9)}`;
  }

  _getAvailablePlayer() {
    // Find inactive player
    for (const playerInfo of this.playerPool) {
      if (!playerInfo.isActive) {
        return playerInfo;
      }
    }
    return null;
  }

  _stealOldestVoice() {
    if (this.lruVoices.length === 0) return;
    
    const oldestNoteId = this.lruVoices.shift();
    const voice = this.voices.get(oldestNoteId);
    
    if (voice) {
      // Graceful stop with quick fade
      voice.voiceEnvelope.triggerRelease();
      voice.player.stop(Tone.now() + 0.05);
      
      this._cleanupVoice(oldestNoteId);
      this.performanceMonitor.voiceStealCount++;
    }
  }

  _cleanupVoice(noteId) {
    const voice = this.voices.get(noteId);
    if (voice) {
      // Cleanup audio nodes
      voice.player.disconnect();
      voice.voiceVolume.dispose();
      voice.voiceEnvelope.dispose();
      
      // Reset player info
      voice.playerInfo.isActive = false;
      voice.playerInfo.noteId = null;
      
      // Remove from tracking
      this.voices.delete(noteId);
      
      // Remove from LRU
      const lruIndex = this.lruVoices.indexOf(noteId);
      if (lruIndex > -1) {
        this.lruVoices.splice(lruIndex, 1);
      }
    }
  }

  /**
   * Real-time voice count and performance
   */
  getVoiceCount() {
    return this.voices.size;
  }

  getPerformanceStats() {
    return {
      activeVoices: this.voices.size,
      maxPolyphony: this.config.maxPolyphony,
      ...this.performanceMonitor
    };
  }

  /**
   * Force stop all voices (panic button)
   */
  stopAllVoices() {
    console.log(`[MULTI-INSTRUMENT] Stopping all voices: ${this.id}`);
    
    for (const [noteId, voice] of this.voices) {
      voice.player.stop();
      this._cleanupVoice(noteId);
    }
    
    this.voices.clear();
    this.lruVoices = [];
  }

  updateParameters(instrumentData) {
    // Master volume
    if (instrumentData.volume !== undefined) {
      this.masterVolume.volume.value = instrumentData.volume;
    }
    
    // Master pan
    if (instrumentData.pan !== undefined) {
      this.masterPanner.pan.value = instrumentData.pan;
    }
    
    // Compressor settings
    if (instrumentData.compressor) {
      const comp = instrumentData.compressor;
      this.masterCompressor.threshold.value = comp.threshold || -20;
      this.masterCompressor.ratio.value = comp.ratio || 8;
      this.masterCompressor.attack.value = comp.attack || 0.01;
      this.masterCompressor.release.value = comp.release || 0.1;
    }
  }

  dispose() {
    this.stopAllVoices();
    
    this.playerPool.forEach(playerInfo => {
      playerInfo.player.dispose();
    });
    
    this.masterVolume.dispose();
    this.masterPanner.dispose();
    this.masterCompressor.dispose();
    this.output.dispose();
    
    this.playerPool = [];
    this.voicePool = [];
  }
}

// ============================================================================
// 4. ENTERPRISE AUDIO ENGINE
// ============================================================================
class EnterpriseAudioEngine {
  constructor(callbacks) {
    this.callbacks = callbacks || {};
    this.masterFader = new Tone.Volume(0).toDestination();
    this.instruments = new Map();
    this.mixerStrips = new Map();
    this.originalAudioBuffers = new Map();
    this.processedAudioBuffers = new Map();
    
    // Enterprise features
    this.performanceMonitor = new EnterprisePerformanceMonitor();
    this.resourceManager = new AudioResourceManager();
    this.voiceManager = new GlobalVoiceManager();
    
    // Configuration
    this.config = {
      maxTotalVoices: 128,
      preferNativeAudio: true,
      enableVoiceSteal: true,
      optimizeForLatency: false,
      enablePerformanceMonitoring: true
    };
    
    console.log("[ENTERPRISE AUDIO] Hazır - Ultra-high performance mode");
  }

  /**
   * Auto-optimized instrument creation
   */
  async createInstrument(instrumentData, buffer) {
    const config = {
      maxPolyphony: instrumentData.maxPolyphony || 8,
      preferNative: this.config.preferNativeAudio,
      enableVoiceSteal: this.config.enableVoiceSteal,
      optimizeForLatency: this.config.optimizeForLatency
    };
    
    // Performance-based instrument selection
    const systemLoad = this.performanceMonitor.getSystemLoad();
    if (systemLoad > 0.8) {
      config.preferNative = true;
      config.maxPolyphony = Math.min(config.maxPolyphony, 4);
    }
    
    const instrument = InstrumentFactory.create(instrumentData, buffer, config);
    this.instruments.set(instrumentData.id, instrument);
    
    // Register with voice manager
    this.voiceManager.registerInstrument(instrumentData.id, instrument);
    
    return instrument;
  }

  /**
   * Global voice management
   */
  getTotalActiveVoices() {
    let total = 0;
    for (const instrument of this.instruments.values()) {
      if (instrument.getVoiceCount) {
        total += instrument.getVoiceCount();
      } else {
        total += instrument.isPlaying ? 1 : 0;
      }
    }
    return total;
  }

  /**
   * Emergency voice management
   */
  performEmergencyCleanup() {
    const totalVoices = this.getTotalActiveVoices();
    
    if (totalVoices > this.config.maxTotalVoices) {
      console.warn(`[ENTERPRISE AUDIO] Emergency cleanup: ${totalVoices} voices`);
      
      // Stop least important instruments first
      const instrumentsByPriority = Array.from(this.instruments.entries())
        .sort(([,a], [,b]) => (a.priority || 0) - (b.priority || 0));
      
      for (const [id, instrument] of instrumentsByPriority) {
        if (instrument.stopAllVoices) {
          instrument.stopAllVoices();
        }
        
        if (this.getTotalActiveVoices() <= this.config.maxTotalVoices * 0.8) {
          break;
        }
      }
    }
  }

  getSystemPerformanceReport() {
    return {
      totalVoices: this.getTotalActiveVoices(),
      maxVoices: this.config.maxTotalVoices,
      instrumentCount: this.instruments.size,
      systemLoad: this.performanceMonitor.getSystemLoad(),
      memoryUsage: this.resourceManager.getMemoryStats(),
      performanceMetrics: this.performanceMonitor.getMetrics()
    };
  }
}

// ============================================================================
// 5. PERFORMANCE MONITORING
// ============================================================================
class EnterprisePerformanceMonitor {
  constructor() {
    this.metrics = {
      frameRate: 60,
      audioDropouts: 0,
      memoryLeaks: 0,
      systemLoad: 0
    };
    
    this.startMonitoring();
  }

  startMonitoring() {
    // Frame rate monitoring
    this.frameMonitor = new FrameRateMonitor();
    
    // Audio dropout detection
    this.dropoutDetector = new AudioDropoutDetector();
    
    // Memory leak detection
    this.memoryMonitor = new MemoryLeakDetector();
  }

  getSystemLoad() {
    return this.metrics.systemLoad;
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

class GlobalVoiceManager {
  constructor() {
    this.instruments = new Map();
    this.totalVoiceLimit = 128;
  }

  registerInstrument(id, instrument) {
    this.instruments.set(id, instrument);
  }

  getTotalVoices() {
    let total = 0;
    for (const instrument of this.instruments.values()) {
      if (instrument.getVoiceCount) {
        total += instrument.getVoiceCount();
      }
    }
    return total;
  }
}

class AudioResourceManager {
  getMemoryStats() {
    if (performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        percentage: (performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize) * 100
      };
    }
    return null;
  }
}

export {
  EnterpriseAudioEngine,
  InstrumentFactory,
  HighPerformanceNativeInstrument,
  EnterpriseMultiInstrument
};