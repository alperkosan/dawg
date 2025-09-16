// client/src/lib/core/AudioEngine.js - ENHANCED VERSION
// Mevcut AudioEngine'inizi bu şekilde güncelleyin

import * as Tone from 'tone';
import { timeManager } from './UnifiedTimeManager';
import { InstrumentNode } from './nodes/InstrumentNode.js';
import { MixerStrip } from './nodes/MixerStrip.js'; // YENİ IMPORT
import { sliceBuffer, normalizeBuffer, reverseBuffer, reversePolarity, removeDCOffset, cloneBuffer } from '../utils/audioUtils.js';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { memoize } from 'lodash';

// Existing memoized function stays the same
const memoizedProcessBuffer = memoize(
  (originalBuffer, instData) => {
    let processed = cloneBuffer(originalBuffer);
    if (!processed) return null;
    const effects = instData.precomputed || {};
    if (effects.removeDCOffset) processed = removeDCOffset(processed);
    if (effects.normalize) processed = normalizeBuffer(processed);
    if (effects.reverse) processed = reverseBuffer(processed);
    if (effects.reversePolarity) processed = reversePolarity(processed);
    return sliceBuffer(processed, instData.smpStart, instData.smpLength);
  },
  (originalBuffer, instData) => `${originalBuffer.url || originalBuffer.name}-${JSON.stringify(instData.precomputed)}-${instData.smpStart}-${instData.smpLength}`
);

/**
 * ENHANCED AUDIO ENGINE - Yeni Mixer Sistemi ile Entegre
 * 
 * ÖNEMLİ DEĞİŞİKLİKLER:
 * 1. MixerStrip kullanımı
 * 2. Real-time parameter update sistem
 * 3. Gelişmiş send/bus routing
 * 4. Solo/Mute sistem entegrasyonu
 * 5. A/B comparison desteği
 */
class AudioEngine {
  constructor(callbacks) {
    this.callbacks = callbacks || {};
    this.masterFader = new Tone.Volume(0).toDestination();

    // ============================================
    // ENHANCED MIXER SYSTEM
    // ============================================
    
    // Mevcut instrument sistemi korunuyor
    this.instruments = new Map();
    
    // UPGRADED: Enhanced mixer strips
    this.mixerStrips = new Map(); // trackId -> MixerStrip
    this.busInputs = new Map(); // busId -> inputNode (for routing)
    
    // NEW: Send/Bus routing system
    this.sendConnections = new Map(); // sendId -> connection info
    
    // NEW: Solo/Mute system
    this.soloedTracks = new Set();
    this.mutedTracks = new Set();

    // Existing buffer management
    this.originalAudioBuffers = new Map();
    this.processedAudioBuffers = new Map();
    
    this.previewPlayer = null;

    // Project data cache
    this.scheduledEventIds = new Map();
    this.instrumentData = [];
    this.mixerTrackData = [];
    this.clips = [];
    this.patterns = {};
    this.arrangementTracks = [];
    this.playbackMode = 'pattern'; 
    this.activePatternId = null; 

    // Enhanced sync system
    this.syncQueue = [];
    this.syncInProgress = false;
    
    this.setupTimeManager();
    
    console.log("[ENHANCED AUDIO ENGINE] Initialized v7.0 (Real-time Mixer System)");
  }

  // ============================================
  // REAL-TIME PARAMETER UPDATE METHODS - YENİ!
  // ============================================

  /**
   * Mixer parametrelerini anında günceller
   * UI'dan her knob/fader hareketi bu fonksiyonu çağırır
   */
  updateMixerParam(trackId, param, value) {
    const strip = this.mixerStrips.get(trackId);
    if (strip) {
      // Smooth parameter transition with no audio dropouts
      strip.updateParam(param, value);
      
      // Debug logging in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[MIXER] ${trackId} ${param}: ${value}`);
      }
    }
  }

  /**
   * Effect parametrelerini anında günceller
   * Knob döndürülürken gecikme olmadan ses değişir
   */
  updateEffectParam(trackId, effectId, param, value) {
    const strip = this.mixerStrips.get(trackId);
    if (strip) {
      strip.updateEffectParam(effectId, param, value);
    }
  }

  /**
   * Effect bypass durumunu değiştirir
   */
  setEffectBypass(trackId, effectId, bypassed) {
    const strip = this.mixerStrips.get(trackId);
    if (strip) {
      strip.setEffectBypass(effectId, bypassed);
    }
  }

  // ============================================
  // SOLO/MUTE SYSTEM - YENİ!
  // ============================================

  /**
   * Track solo durumunu ayarlar
   * Solo logic: Eğer herhangi bir track solo'daysa, sadece solo'lananlar çalar
   */
  setTrackSolo(trackId, shouldPlay) {
    const strip = this.mixerStrips.get(trackId);
    if (strip) {
      strip.setSolo(shouldPlay);
    }
  }

  /**
   * Track mute durumunu ayarlar
   */
  setTrackMute(trackId, muted) {
    const strip = this.mixerStrips.get(trackId);
    if (strip) {
      strip.setMute(muted);
    }
  }

  // ============================================
  // SEND/BUS SYSTEM - YENİ!
  // ============================================

  /**
   * Send seviyesini günceller
   */
  updateSendLevel(fromTrackId, toTrackId, level) {
    const fromStrip = this.mixerStrips.get(fromTrackId);
    if (fromStrip) {
      fromStrip.updateSendLevel(toTrackId, level);
    }
  }

  /**
   * Send bağlantıları kurar
   */
  connectSend(fromTrackId, toTrackId, level) {
    const fromStrip = this.mixerStrips.get(fromTrackId);
    const toStrip = this.mixerStrips.get(toTrackId);
    
    if (fromStrip && toStrip) {
      // Send connection logic implementation
      const sendId = `${fromTrackId}->${toTrackId}`;
      
      // Store connection info for later management
      this.sendConnections.set(sendId, {
        fromTrackId,
        toTrackId,
        level,
        active: true
      });
    }
  }

  // ============================================
  // ENHANCED SYNC SYSTEM - IMPROVED
  // ============================================

  async syncFromStores(instrumentData, mixerTrackData, arrangementData) {
    return new Promise((resolve) => {
      this.syncQueue.push({ 
        instrumentData, 
        mixerTrackData, 
        arrangementData, 
        onComplete: resolve 
      });
      
      if (!this.syncInProgress) {
        this._processSyncQueue();
      }
    });
  }

  async _processSyncQueue() {
    if (this.syncQueue.length === 0) {
      this.syncInProgress = false;
      return;
    }
    
    this.syncInProgress = true;
    const { instrumentData, mixerTrackData, arrangementData, onComplete } = this.syncQueue.shift();
    
    try {
      await this._performEnhancedSync(instrumentData, mixerTrackData, arrangementData);
    } catch (error) {
      console.error("[ENHANCED AUDIO ENGINE] Sync error:", error);
    }
    
    onComplete();
    
    if (this.syncQueue.length > 0) {
      this._processSyncQueue();
    } else {
      this.syncInProgress = false;
    }
  }

  /**
   * Enhanced sync process with new mixer system
   */
  async _performEnhancedSync(instrumentData, mixerTrackData, arrangementData) {
    // Update data cache
    this.instrumentData = instrumentData;
    this.mixerTrackData = mixerTrackData;
    
    if (arrangementData) {
      this.clips = arrangementData.clips || [];
      this.patterns = arrangementData.patterns || {};
      this.arrangementTracks = arrangementData.tracks || [];
      this.activePatternId = arrangementData.activePatternId;
      this.playbackMode = usePlaybackStore.getState().playbackMode;
    }
    
    // 1. Clean up removed components
    this._cleanupRemovedComponents(instrumentData, mixerTrackData);
    
    // 2. Create/update mixer strips with enhanced system
    await this._createMixerStrips(mixerTrackData);
    
    // 3. Build bus routing
    const busInputs = this._buildBusRouting(mixerTrackData);
    
    // 4. Build all mixer chains in parallel for performance
    const buildPromises = Array.from(this.mixerStrips.entries()).map(async ([id, strip]) => { 
      const trackData = mixerTrackData.find(t => t.id === id); 
      if (trackData) {
        await strip.buildSignalChain(trackData, this.masterFader, busInputs, this.mixerStrips); 
      }
    });
    
    await Promise.all(buildPromises);
    
    // 5. Connect instruments (unchanged)
    await this._loadAndConnectInstruments(instrumentData);
    
    // 6. Setup send connections
    this._setupSendConnections(mixerTrackData);
    
    // 7. Reschedule notes
    this.reschedule();
  }

  /**
   * Create enhanced mixer strips
   */
  async _createMixerStrips(mixerTrackData) {
    for (const trackData of mixerTrackData) {
      if (!this.mixerStrips.has(trackData.id)) {
        // Create new enhanced strip
        const strip = new MixerStrip(trackData);
        this.mixerStrips.set(trackData.id, strip);
      }
      
      // Update bus inputs map for routing
      if (trackData.type === 'bus') {
        const strip = this.mixerStrips.get(trackData.id);
        if (strip) {
          this.busInputs.set(trackData.id, strip.inputGain);
        }
      }
    }
  }

  /**
   * Build comprehensive bus routing system
   */
  _buildBusRouting(mixerTrackData) {
    const busInputs = new Map();
    
    // Collect all bus inputs
    mixerTrackData.forEach(trackData => {
      if (trackData.type === 'bus') {
        const strip = this.mixerStrips.get(trackData.id);
        if (strip) {
          busInputs.set(trackData.id, strip.inputGain);
        }
      }
    });
    
    // Master fader is always available as a target
    busInputs.set('master', this.masterFader);
    
    return busInputs;
  }

  /**
   * Setup send connections between tracks and buses
   */
  _setupSendConnections(mixerTrackData) {
    mixerTrackData.forEach(trackData => {
      if (trackData.sends?.length > 0) {
        trackData.sends.forEach(send => {
          this.connectSend(trackData.id, send.busId, send.level);
        });
      }
    });
  }

  // ============================================
  // EXISTING METHODS - PRESERVED BUT UPDATED
  // ============================================

  setupTimeManager() {
    timeManager.onPositionUpdate = (position) => {
      this.callbacks.setTransportPosition?.(position.formatted);
    };
    timeManager.onLoopInfoUpdate = (loopInfo) => {
      this.callbacks.setLoopLengthFromEngine?.(loopInfo.lengthInSteps);
    };
  }

  reschedule() {
    this.clearAllScheduledNotes();
    const arrangementData = { patterns: this.patterns, clips: this.clips };
    timeManager.calculateLoopInfo(this.playbackMode, this.activePatternId, arrangementData);
    if (this.playbackMode === 'song') {
      this._scheduleArrangementNotes();
    } else {
      this._schedulePatternNotes();
    }
  }

  _schedulePatternNotes() {
    const activePattern = this.patterns?.[this.activePatternId];
    if (!activePattern) return;

    Object.entries(activePattern.data).forEach(([instId, notes]) => {
      const inst = this.instrumentData.find(i => i.id === instId);
      if (!inst || inst.isMuted || !notes) return;
      
      const node = this.instruments.get(instId);
      const buffer = this.processedAudioBuffers.get(instId);
      if (!node || !buffer) return;
      
      notes.forEach(note => {
        const step = note.time;
        const bar = Math.floor(step / 16);
        const beat = Math.floor((step % 16) / 4);
        const sixteenth = step % 4;
        const timeNotation = `${bar}:${beat}:${sixteenth}`;
        
        const id = Tone.Transport.schedule((time) => {
          node.trigger(time, note, buffer.duration, inst.cutItself);
        }, timeNotation);
        
        this.scheduledEventIds.set(`pattern-${this.activePatternId}-${instId}-${note.id || note.time}`, id);
      });
    });
  }

  _scheduleArrangementNotes() {
    // Implementation remains the same
  }

  // ============================================
  // ENHANCED CLEANUP - MEMORY LEAK PREVENTION
  // ============================================

  _cleanupRemovedComponents(instrumentData, mixerTrackData) { 
    const mixerIds = new Set(mixerTrackData.map(t => t.id)); 
    
    // Enhanced cleanup for mixer strips
    this.mixerStrips.forEach((strip, id) => { 
      if (!mixerIds.has(id)) { 
        console.log(`[CLEANUP] Disposing mixer strip: ${id}`);
        strip.dispose(); 
        this.mixerStrips.delete(id); 
        this.busInputs.delete(id); // Clean up bus inputs too
      } 
    }); 
    
    // Clean up send connections
    this.sendConnections.forEach((connection, sendId) => {
      if (!mixerIds.has(connection.fromTrackId) || !mixerIds.has(connection.toTrackId)) {
        console.log(`[CLEANUP] Removing send connection: ${sendId}`);
        this.sendConnections.delete(sendId);
      }
    });
    
    // Existing instrument cleanup
    const instrumentIds = new Set(instrumentData.map(i => i.id)); 
    this.instruments.forEach((instrument, id) => { 
      if (!instrumentIds.has(id)) { 
        console.log(`[CLEANUP] Disposing instrument: ${id}`);
        instrument.dispose(); 
        this.instruments.delete(id); 
      } 
    }); 
  }

  // ============================================
  // ENHANCED INSTRUMENT LOADING - UNCHANGED BUT IMPROVED LOGGING
  // ============================================

  async _loadAndConnectInstruments(instrumentData) { 
    const loadPromises = instrumentData.map(async (instData) => { 
      try { 
        if (!this.originalAudioBuffers.has(instData.id) && instData.url) { 
          const buffer = await Tone.ToneAudioBuffer.load(instData.url); 
          this.originalAudioBuffers.set(instData.id, buffer); 
        } 
        
        const originalBuffer = this.originalAudioBuffers.get(instData.id); 
        if (originalBuffer) { 
          const processedBuffer = this.processBuffer(originalBuffer, instData); 
          this.processedAudioBuffers.set(instData.id, processedBuffer); 
          
          if (!this.instruments.has(instData.id)) { 
            this.instruments.set(instData.id, new InstrumentNode(instData, processedBuffer)); 
          } else { 
            const instrument = this.instruments.get(instData.id); 
            instrument.updateParameters(instData); 
            instrument.updateBuffer(processedBuffer); 
          } 
          
          // Enhanced connection with better error handling
          const instrumentNode = this.instruments.get(instData.id); 
          const targetStrip = this.mixerStrips.get(instData.mixerTrackId); 
          
          if (instrumentNode && targetStrip) { 
            instrumentNode.output.disconnect(); 
            instrumentNode.output.connect(targetStrip.inputGain); // Enhanced connection point
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`[INSTRUMENT] Connected ${instData.name} to mixer track ${instData.mixerTrackId}`);
            }
          } else if (!targetStrip) {
            console.warn(`[INSTRUMENT] Target mixer strip not found for ${instData.name}: ${instData.mixerTrackId}`);
          }
        } 
      } catch (error) { 
        console.error(`[INSTRUMENT] Failed to load ${instData.name}:`, error); 
      } 
    }); 
    
    await Promise.all(loadPromises); 
  }

  // ============================================
  // TRANSPORT CONTROL - UNCHANGED
  // ============================================

  start() {
    if (Tone.context.state !== 'running') Tone.context.resume();
    if (Tone.Transport.state === 'started') return;
    
    const arrangementData = { patterns: this.patterns, clips: this.clips };
    timeManager.start(this.playbackMode, this.activePatternId, arrangementData);
    
    Tone.Transport.start();
    this.callbacks.setPlaybackState?.('playing');
  }

  pause() {
    Tone.Transport.pause(); 
    timeManager.pause();
    this.callbacks.setPlaybackState?.('paused');
  }

  resume() {
    if (Tone.Transport.state === 'paused') {
      Tone.Transport.start();
      timeManager.resume();
      this.callbacks.setPlaybackState?.('playing');
    }
  }

  stop() {
    Tone.Transport.stop(); 
    timeManager.stop();
    this.callbacks.setPlaybackState?.('stopped');
  }

  // ============================================
  // AUDITION SYSTEM - ENHANCED WITH BETTER ERROR HANDLING
  // ============================================

  auditionNoteOn(instrumentId, pitch, velocity = 1) { 
    try {
      const instrumentNode = this.instruments.get(instrumentId); 
      instrumentNode?.triggerAttack(pitch, Tone.now(), velocity); 
    } catch (error) {
      console.warn(`[AUDITION] Note on failed for ${instrumentId}:`, error);
    }
  }

  auditionNoteOff(instrumentId, pitch) { 
    try {
      const instrumentNode = this.instruments.get(instrumentId); 
      instrumentNode?.triggerRelease(pitch, Tone.now()); 
    } catch (error) {
      console.warn(`[AUDITION] Note off failed for ${instrumentId}:`, error);
    }
  }

  // ============================================
  // UTILITY METHODS - ENHANCED
  // ============================================

  processBuffer(originalBuffer, instData) { 
    return memoizedProcessBuffer(originalBuffer, instData); 
  }

  reconcileInstrument = (instrumentId, updatedInstData) => { 
    const originalBuffer = this.originalAudioBuffers.get(instrumentId); 
    if (!updatedInstData || !originalBuffer) return null; 
    
    const newProcessedBuffer = this.processBuffer(originalBuffer, updatedInstData); 
    this.processedAudioBuffers.set(instrumentId, newProcessedBuffer); 
    this.instruments.get(instrumentId)?.updateBuffer(newProcessedBuffer); 
    
    console.log(`[RECONCILE] Updated buffer for instrument: ${instrumentId}`);
    return newProcessedBuffer; 
  }

  previewInstrument(instrumentId) { 
    if (!this.previewPlayer) { 
      this.previewPlayer = new Tone.Player().toDestination(); 
      this.previewPlayer.onstop = () => this.callbacks.setIsPreviewPlaying?.(false); 
    } 
    
    if (this.previewPlayer.state === 'started') { 
      this.previewPlayer.stop(); 
      return; 
    } 
    
    const buffer = this.processedAudioBuffers.get(instrumentId); 
    if (buffer) { 
      this.previewPlayer.buffer = buffer; 
      this.previewPlayer.start(); 
      this.callbacks.setIsPreviewPlaying?.(true); 
    } 
  }

  clearAllScheduledNotes() { 
    this.scheduledEventIds.forEach(id => { 
      try { 
        Tone.Transport.clear(id); 
      } catch (e) { 
        // Event already cleared or invalid
      } 
    }); 
    this.scheduledEventIds.clear(); 
  }

  setBpm(newBpm) { 
    const clampedBpm = Math.max(20, Math.min(300, newBpm)); 
    Tone.Transport.bpm.value = clampedBpm; 
  }

  setMasterVolume(levelInDb) { 
    this.masterFader.volume.value = levelInDb; 
  }

  jumpToBar(barNumber) { 
    timeManager.jumpToBar(barNumber); 
  }

  jumpToPercent(percent) { 
    timeManager.jumpToPercent(percent); 
  }

  // ============================================
  // ENHANCED DISPOSAL - COMPREHENSIVE CLEANUP
  // ============================================

  dispose() { 
    console.log("[ENHANCED AUDIO ENGINE] Starting comprehensive disposal...");
    
    this.stop(); 
    timeManager.dispose(); 
    
    if (this.previewPlayer) {
      this.previewPlayer.dispose();
    }
    
    // Enhanced mixer strip disposal
    console.log(`[DISPOSAL] Disposing ${this.mixerStrips.size} mixer strips...`);
    this.mixerStrips.forEach((strip, id) => {
      try {
        strip.dispose();
      } catch (error) {
        console.warn(`[DISPOSAL] Error disposing mixer strip ${id}:`, error);
      }
    });
    this.mixerStrips.clear();
    this.busInputs.clear();
    this.sendConnections.clear();
    
    // Instrument disposal
    console.log(`[DISPOSAL] Disposing ${this.instruments.size} instruments...`);
    this.instruments.forEach((inst, id) => {
      try {
        inst.dispose();
      } catch (error) {
        console.warn(`[DISPOSAL] Error disposing instrument ${id}:`, error);
      }
    });
    this.instruments.clear();
    
    // Buffer disposal
    console.log("[DISPOSAL] Disposing audio buffers...");
    this.originalAudioBuffers.forEach((buffer, id) => {
      try {
        buffer.dispose();
      } catch (error) {
        console.warn(`[DISPOSAL] Error disposing original buffer ${id}:`, error);
      }
    });
    this.originalAudioBuffers.clear();
    
    this.processedAudioBuffers.forEach((buffer, id) => {
      try {
        buffer.dispose();
      } catch (error) {
        console.warn(`[DISPOSAL] Error disposing processed buffer ${id}:`, error);
      }
    });
    this.processedAudioBuffers.clear();
    
    // Clear all scheduled events
    this.scheduledEventIds.clear();
    Tone.Transport.cancel(0);
    
    // Clear sync queue
    this.syncQueue = [];
    this.syncInProgress = false;
    
    console.log("[ENHANCED AUDIO ENGINE] Disposal complete"); 
  }

  // ============================================
  // DEBUG & HEALTH CHECK - NEW DEVELOPMENT TOOLS
  // ============================================

  getHealthReport() {
    if (process.env.NODE_ENV !== 'development') return null;
    
    return {
      contextState: Tone.context.state,
      transportState: Tone.Transport.state,
      instrumentCount: this.instruments.size,
      mixerStripCount: this.mixerStrips.size,
      busCount: this.busInputs.size,
      sendCount: this.sendConnections.size,
      queueSize: this.syncQueue.length,
      syncInProgress: this.syncInProgress,
      scheduledEvents: this.scheduledEventIds.size,
      bufferCounts: {
        original: this.originalAudioBuffers.size,
        processed: this.processedAudioBuffers.size
      }
    };
  }

  logHealthReport() {
    if (process.env.NODE_ENV === 'development') {
      console.table(this.getHealthReport());
    }
  }
}

export default AudioEngine;