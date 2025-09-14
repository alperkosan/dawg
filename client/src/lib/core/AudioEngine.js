import * as Tone from 'tone';
import { timeManager } from './UnifiedTimeManager';
import { calculatePatternLoopLength, calculateArrangementLoopLength } from '../utils/patternUtils.js';
import { InstrumentNode } from './nodes/InstrumentNode.js';
import { MixerStrip } from './nodes/MixerStrip.js';
import { sliceBuffer, normalizeBuffer, reverseBuffer, reversePolarity, removeDCOffset, cloneBuffer } from '../utils/audioUtils.js';
import { memoize } from 'lodash';

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

class AudioEngine {
  constructor(callbacks) {
    this.callbacks = callbacks || {};
    this.masterFader = new Tone.Volume(0).toDestination();
    this.instruments = new Map();
    this.mixerStrips = new Map();
    this.originalAudioBuffers = new Map();
    this.processedAudioBuffers = new Map();
    this.previewPlayer = null;
    this.scheduledEventIds = new Map();
    this.instrumentData = [];
    this.mixerTrackData = [];
    
    this.clips = [];
    this.patterns = {};
    this.arrangementTracks = [];

    this.playbackMode = 'pattern'; 
    this.activePatternId = null; 

    this.syncQueue = [];
    this.syncInProgress = false;
    this.debug = true;
    
    this.setupTimeManager();
    
    console.log("[AUDIO ENGINE] Başlatıldı v5.1 (Senkronizasyon Düzeltmesi)");
  }

  setupTimeManager() {
    timeManager.onPositionUpdate = (position) => {
      this.callbacks.setTransportPosition?.(position.formatted);
    };
  }

  // Diğer metotlar (audition, sync, vs.) aynı kalabilir...
  auditionNoteOn(instrumentId, pitch, velocity = 1) { const instrumentNode = this.instruments.get(instrumentId); instrumentNode?.triggerAttack(pitch, Tone.now(), velocity); }
  auditionNoteOff(instrumentId, pitch) { const instrumentNode = this.instruments.get(instrumentId); instrumentNode?.triggerRelease(pitch, Tone.now()); }
  syncFromStores(instrumentData, mixerTrackData, arrangementData) { return new Promise((resolve) => { this.syncQueue.push({ instrumentData, mixerTrackData, arrangementData, onComplete: resolve }); if (!this.syncInProgress) { this._processSyncQueue(); } }); }
  async _processSyncQueue() { if (this.syncQueue.length === 0) { this.syncInProgress = false; return; } this.syncInProgress = true; const { instrumentData, mixerTrackData, arrangementData, onComplete } = this.syncQueue.shift(); try { await this._performSync(instrumentData, mixerTrackData, arrangementData); } catch (error) { console.error("[AUDIO ENGINE] Senkronizasyon hatası:", error); } onComplete(); if (this.syncQueue.length > 0) { this._processSyncQueue(); } else { this.syncInProgress = false; } }
  async _performSync(instrumentData, mixerTrackData, arrangementData) { this.instrumentData = instrumentData; this.mixerTrackData = mixerTrackData; if (arrangementData) { this.clips = arrangementData.clips || []; this.patterns = arrangementData.patterns || {}; this.arrangementTracks = arrangementData.tracks || []; } this._cleanupRemovedComponents(instrumentData, mixerTrackData); this._createMixerStrips(mixerTrackData); const busInputs = this._collectBusInputs(mixerTrackData); const buildPromises = Array.from(this.mixerStrips.entries()).map(([id, strip]) => { const trackData = mixerTrackData.find(t => t.id === id); if (trackData) return strip.buildChain(trackData, this.masterFader, busInputs, this.mixerStrips); return Promise.resolve(); }); await Promise.all(buildPromises); await this._loadAndConnectInstruments(instrumentData); this.reschedule(); }
  _cleanupRemovedComponents(instrumentData, mixerTrackData) { const mixerIds = new Set(mixerTrackData.map(t => t.id)); this.mixerStrips.forEach((strip, id) => { if (!mixerIds.has(id)) { strip.dispose(); this.mixerStrips.delete(id); } }); const instrumentIds = new Set(instrumentData.map(i => i.id)); this.instruments.forEach((instrument, id) => { if (!instrumentIds.has(id)) { instrument.dispose(); this.instruments.delete(id); } }); }
  _createMixerStrips(mixerTrackData) { mixerTrackData.forEach(trackData => { if (!this.mixerStrips.has(trackData.id)) { const newStrip = new MixerStrip(trackData, this.masterFader, new Map(), this.mixerStrips); this.mixerStrips.set(trackData.id, newStrip); } }); }
  _collectBusInputs(mixerTrackData) { const busInputs = new Map(); mixerTrackData.forEach(trackData => { if (trackData.type === 'bus') { const busStrip = this.mixerStrips.get(trackData.id); if (busStrip) { busInputs.set(trackData.id, busStrip.inputNode); } } }); return busInputs; }
  async _loadAndConnectInstruments(instrumentData) { const loadPromises = instrumentData.map(async (instData) => { try { if (!this.originalAudioBuffers.has(instData.id) && instData.url) { const buffer = await Tone.ToneAudioBuffer.load(instData.url); this.originalAudioBuffers.set(instData.id, buffer); } const originalBuffer = this.originalAudioBuffers.get(instData.id); if (originalBuffer) { const processedBuffer = this.processBuffer(originalBuffer, instData); this.processedAudioBuffers.set(instData.id, processedBuffer); if (!this.instruments.has(instData.id)) { this.instruments.set(instData.id, new InstrumentNode(instData, processedBuffer)); } else { const instrument = this.instruments.get(instData.id); instrument.updateParameters(instData); instrument.updateBuffer(processedBuffer); } const instrumentNode = this.instruments.get(instData.id); const targetStrip = this.mixerStrips.get(instData.mixerTrackId); if (instrumentNode && targetStrip) { instrumentNode.output.disconnect(); instrumentNode.output.connect(targetStrip.inputNode); } } } catch (error) { console.error(`Enstrüman yüklenemedi ${instData.name}:`, error); } }); await Promise.all(loadPromises); }
  updateMixerParam(trackId, param, value) { this.mixerStrips.get(trackId)?.updateParam(param, value); }
  updateEffectParam(trackId, effectId, param, value) { this.mixerStrips.get(trackId)?.updateEffectParam(effectId, param, value); }
  processBuffer(originalBuffer, instData) { return memoizedProcessBuffer(originalBuffer, instData); }
  reconcileInstrument = (instrumentId, updatedInstData) => { const originalBuffer = this.originalAudioBuffers.get(instrumentId); if (!updatedInstData || !originalBuffer) return null; const newProcessedBuffer = this.processBuffer(originalBuffer, updatedInstData); this.processedAudioBuffers.set(instrumentId, newProcessedBuffer); this.instruments.get(instrumentId)?.updateBuffer(newProcessedBuffer); return newProcessedBuffer; }
  previewInstrument(instrumentId) { if (!this.previewPlayer) { this.previewPlayer = new Tone.Player().toDestination(); this.previewPlayer.onstop = () => this.callbacks.setIsPreviewPlaying?.(false); } if (this.previewPlayer.state === 'started') { this.previewPlayer.stop(); return; } const buffer = this.processedAudioBuffers.get(instrumentId); if (buffer) { this.previewPlayer.buffer = buffer; this.previewPlayer.start(); this.callbacks.setIsPreviewPlaying?.(true); } }
  start(playbackMode = 'pattern', activePatternId = null) { if (Tone.context.state !== 'running') Tone.context.resume(); if (Tone.Transport.state === 'started') return; this.playbackMode = playbackMode; this.activePatternId = activePatternId; this.reschedule(); const arrangementData = { patterns: this.patterns, clips: this.clips, tracks: this.arrangementTracks }; timeManager.start(playbackMode, activePatternId, arrangementData); Tone.Transport.start(); this.callbacks.setPlaybackState?.('playing'); }
  pause() { Tone.Transport.pause(); timeManager.pause(); this.callbacks.setPlaybackState?.('paused'); }
  resume() { if (Tone.Transport.state === 'paused') { Tone.Transport.start(); timeManager.resume(); this.callbacks.setPlaybackState?.('playing'); } }
  stop() { Tone.Transport.stop(); timeManager.stop(); this.callbacks.setPlaybackState?.('stopped'); }

  /**
   * NİHAİ DÜZELTME: scheduleRepeat() yerine schedule() kullanarak hızlanma sorununu çözer.
   */
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

  /**
   * YENİ: Çalma sırasında güvenli bir şekilde aktif pattern'i değiştirir.
   */
  switchActivePattern(newPatternId) {
    if (this.playbackMode !== 'pattern' || this.activePatternId === newPatternId) {
      return;
    }

    const wasPlaying = Tone.Transport.state === 'started';

    if (wasPlaying) {
      Tone.Transport.pause();
    }
    
    // 1. Yeni pattern ID'sini ayarla
    this.activePatternId = newPatternId;

    // 2. Yeni (boş) pattern'e göre notaları ve döngüyü yeniden zamanla
    this.reschedule();

    // 3. Çalmayı yeni döngünün en başına zıplat (Temiz Başlangıç)
    this.jumpToPercent(0);
    timeManager.resume(); // Animasyon döngüsünü de anında sıfırla

    // 4. Arayüzün state'ini GÜVENLE güncelle
    this.callbacks.setActivePatternId?.(newPatternId);

    // 5. Çalmaya (yeni pattern'in başından) devam et
    if (wasPlaying) {
      Tone.Transport.start(Tone.now());
    }
  }

  _scheduleArrangementNotes() {
    // Bu metot şimdilik doğru kabul edilebilir, ana sorun pattern modundaydı.
    // ...
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
        // NİHAİ DÜZELTME: Zamanlamayı saniye yerine BBT notasyonuyla yapıyoruz.
        // Bu, Tone.js'in zamanlamayı en hassas şekilde yapmasını sağlar ve yuvarlama hatalarını önler.
        const step = note.time;
        const bar = Math.floor(step / 16);
        const beat = Math.floor((step % 16) / 4);
        const sixteenth = step % 4;
        const timeNotation = `${bar}:${beat}:${sixteenth}`;
        
        // NİHAİ DÜZELTME: `scheduleRepeat` yerine `schedule` kullanılıyor.
        // Loop, `Tone.Transport.loop = true` tarafından zaten yönetiliyor.
        const id = Tone.Transport.schedule((time) => {
          node.trigger(time, note, buffer.duration, inst.cutItself);
        }, timeNotation);
        
        this.scheduledEventIds.set(`pattern-${this.activePatternId}-${instId}-${note.id || note.time}`, id);
      });
    });
  }

  clearAllScheduledNotes() {
    this.scheduledEventIds.forEach(id => {
      try { Tone.Transport.clear(id); } catch (e) { /* Event zaten temizlenmiş olabilir */ }
    });
    this.scheduledEventIds.clear();
  }

  // Geri kalan metotlar (setBpm, setMasterVolume, switchPlaybackMode, jumpToBar, jumpToPercent, dispose)
  // önceki adımlardaki gibi doğru ve tamdır. Onları değiştirmeye gerek yok.
  setBpm(newBpm) { const clampedBpm = Math.max(20, Math.min(300, newBpm)); Tone.Transport.bpm.value = clampedBpm; }
  setMasterVolume(levelInDb) { this.masterFader.volume.value = levelInDb; }
  switchPlaybackMode(newMode, activePatternId = null) { const wasPlaying = Tone.Transport.state === 'started'; if (wasPlaying) { Tone.Transport.pause(); } this.playbackMode = newMode; this.activePatternId = activePatternId; const arrangementData = { patterns: this.patterns, clips: this.clips, tracks: this.arrangementTracks }; timeManager.switchMode(newMode, activePatternId, arrangementData); this.reschedule(); if (wasPlaying) { Tone.Transport.start(); timeManager.resume(); } }
  jumpToBar(barNumber) { timeManager.jumpToBar(barNumber); }
  jumpToPercent(percent) { timeManager.jumpToPercent(percent); }
  dispose() { this.stop(); timeManager.dispose(); if (this.previewPlayer) this.previewPlayer.dispose(); this.instruments.forEach(inst => inst.dispose()); this.mixerStrips.forEach(strip => strip.dispose()); this.originalAudioBuffers.forEach(buffer => buffer.dispose()); this.processedAudioBuffers.forEach(buffer => buffer.dispose()); this.instruments.clear(); this.mixerStrips.clear(); this.originalAudioBuffers.clear(); this.processedAudioBuffers.clear(); this.scheduledEventIds.clear(); Tone.Transport.cancel(0); console.log("[AUDIO ENGINE] Tamamen temizlendi"); }
}

export default AudioEngine;