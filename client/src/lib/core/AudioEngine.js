import * as Tone from 'tone';
import { timeManager } from './UnifiedTimeManager';
import { InstrumentNode } from './nodes/InstrumentNode.js';
import { MixerStrip } from './nodes/MixerStrip.js';
import { sliceBuffer, normalizeBuffer, reverseBuffer, reversePolarity, removeDCOffset, cloneBuffer } from '../utils/audioUtils.js';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { memoize } from 'lodash';

// Buffer (ses dosyası) işleme operasyonlarını hafızada tutarak performansı artıran yardımcı fonksiyon.
// Bir ses dosyasına aynı efektler tekrar uygulandığında, hesaplamayı yeniden yapmak yerine
// hafızadaki sonucu kullanır.
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
 * @file AudioEngine.js - NİHAİ SÜRÜM
 * @description SoundForge projesinin merkezi ses motoru.
 *
 * MİMARİ PRENSİPLERİ:
 * 1.  **Tek Gerçeklik Kaynağı:** Bu motor, projenin sesle ilgili tüm durumunu yönetir. Arayüz (UI),
 * durumu doğrudan değiştirmek yerine bu motora "istek" gönderir.
 * 2.  **Senkronizasyon Odaklı:** Motorun ana görevi, `App.jsx` içindeki `useAudioEngineSync` kancasından
 * gelen en güncel verilerle kendini sürekli senkronize tutmaktır.
 * 3.  **Stateless (Durumsuz) Zamanlama:** Motor, pattern değiştirme gibi karmaşık işlemleri
 * kendi içinde durum tutarak yönetmez. Sadece en güncel `activePatternId`'yi alır ve
 * tüm notaları bu yeni duruma göre anında yeniden zamanlar (`reschedule`).
 * 4.  **Mutlak Zamanlama:** Nota zamanlaması, döngü uzunluğundan bağımsız olan ve yuvarlama
 * hatalarına karşı en dayanıklı yöntem olan "Bar:Beat:Sixteenth" (BBT) formatı ile yapılır.
 */
class AudioEngine {
  /**
   * AudioEngine'i ve temel bileşenlerini başlatır.
   * @param {object} callbacks - Motorun arayüzdeki store'ları güncellemek için kullanacağı fonksiyonlar.
   */
  constructor(callbacks) {
    this.callbacks = callbacks || {};
    this.masterFader = new Tone.Volume(0).toDestination();

    // Ses üreten ve işleyen birimlerin haritaları
    this.instruments = new Map();
    this.mixerStrips = new Map();

    // Ses dosyası yönetimi
    this.originalAudioBuffers = new Map();
    this.processedAudioBuffers = new Map();
    
    // Dosya tarayıcısı ve sample editor için yardımcı oynatıcı
    this.previewPlayer = null;

    // Proje verilerinin motor içindeki anlık kopyası
    this.scheduledEventIds = new Map();
    this.instrumentData = [];
    this.mixerTrackData = [];
    this.clips = [];
    this.patterns = {};
    this.arrangementTracks = [];
    this.playbackMode = 'pattern'; 
    this.activePatternId = null; 

    // Senkronizasyon kuyruğu, arayüzden gelen hızlı istekleri yöneterek "race condition"ları önler.
    this.syncQueue = [];
    this.syncInProgress = false;
    
    // Zamanlama ve arayüz güncellemesi için merkezi yöneticiyle bağlantı kurar.
    this.setupTimeManager();
    
    console.log("[AUDIO ENGINE] Başlatıldı v6.0 (Temiz Akış Mimarisi)");
  }

  /**
   * Projenin merkezi zaman yöneticisi olan `UnifiedTimeManager` ile
   * bu motor arasındaki iletişimi kurar. Bu, motorun arayüze veri göndermesini sağlar.
   */
  setupTimeManager() {
    timeManager.onPositionUpdate = (position) => {
      this.callbacks.setTransportPosition?.(position.formatted);
    };
    timeManager.onLoopInfoUpdate = (loopInfo) => {
      this.callbacks.setLoopLengthFromEngine?.(loopInfo.lengthInSteps);
    };
  }
  
  /**
   * Arayüzden (Zustand store'ları) gelen en güncel proje verisiyle motorun
   * tüm durumunu senkronize eden ana metot.
   */
  syncFromStores(instrumentData, mixerTrackData, arrangementData) {
    return new Promise((resolve) => {
      this.syncQueue.push({ instrumentData, mixerTrackData, arrangementData, onComplete: resolve });
      if (!this.syncInProgress) {
        this._processSyncQueue();
      }
    });
  }

  /**
   * Senkronizasyon kuyruğunu işleyen özel metot.
   */
  async _processSyncQueue() {
    if (this.syncQueue.length === 0) {
      this.syncInProgress = false;
      return;
    }
    this.syncInProgress = true;
    const { instrumentData, mixerTrackData, arrangementData, onComplete } = this.syncQueue.shift();
    try {
      await this._performSync(instrumentData, mixerTrackData, arrangementData);
    } catch (error) {
      console.error("[AUDIO ENGINE] Senkronizasyon hatası:", error);
    }
    onComplete();
    if (this.syncQueue.length > 0) {
      this._processSyncQueue();
    } else {
      this.syncInProgress = false;
    }
  }

  /**
   * Senkronizasyon işleminin tüm adımlarını yürüten çekirdek metot.
   */
  async _performSync(instrumentData, mixerTrackData, arrangementData) {
    this.instrumentData = instrumentData;
    this.mixerTrackData = mixerTrackData;
    if (arrangementData) {
        this.clips = arrangementData.clips || [];
        this.patterns = arrangementData.patterns || {};
        this.arrangementTracks = arrangementData.tracks || [];
        this.activePatternId = arrangementData.activePatternId;
        this.playbackMode = usePlaybackStore.getState().playbackMode;
    }
    
    this._cleanupRemovedComponents(instrumentData, mixerTrackData);
    this._createMixerStrips(mixerTrackData);
    const busInputs = this._collectBusInputs(mixerTrackData);
    const buildPromises = Array.from(this.mixerStrips.entries()).map(([id, strip]) => { 
        const trackData = mixerTrackData.find(t => t.id === id); 
        if (trackData) return strip.buildChain(trackData, this.masterFader, busInputs, this.mixerStrips); 
        return Promise.resolve(); 
    });
    await Promise.all(buildPromises);
    await this._loadAndConnectInstruments(instrumentData);
    this.reschedule();
  }

  /**
   * Notaları, projenin o anki moduna (`pattern` veya `song`) ve
   * aktif pattern'ine göre yeniden zamanlar. Bu, motorun en kritik fonksiyonudur.
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
   * Pattern modundayken notaları zamanlar.
   */
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
  
  /**
   * Song modundayken notaları zamanlar.
   */
  _scheduleArrangementNotes() {
    // TODO: Song modu için de BBT tabanlı, hassas zamanlama eklenecek.
  }

  // === TEMEL KONTROL FONKSİYONLARI ===

  /**
   * Çalmayı başlatır.
   */
  start() {
    if (Tone.context.state !== 'running') Tone.context.resume();
    if (Tone.Transport.state === 'started') return;
    
    const arrangementData = { patterns: this.patterns, clips: this.clips };
    timeManager.start(this.playbackMode, this.activePatternId, arrangementData);
    
    Tone.Transport.start();
    this.callbacks.setPlaybackState?.('playing');
  }

  /**
   * Çalmayı duraklatır.
   */
  pause() {
    Tone.Transport.pause(); 
    timeManager.pause();
    this.callbacks.setPlaybackState?.('paused');
  }

  /**
   * Duraklatılmış çalmaya devam eder.
   */
  resume() {
    if (Tone.Transport.state === 'paused') {
      Tone.Transport.start();
      timeManager.resume();
      this.callbacks.setPlaybackState?.('playing');
    }
  }

  /**
   * Çalmayı durdurur ve pozisyonu başa sarar.
   */
  stop() {
    Tone.Transport.stop(); 
    timeManager.stop();
    this.callbacks.setPlaybackState?.('stopped');
  }

  // === YARDIMCI VE DİĞER FONKSİYONLARI ===
  
  /**
   * Piano Roll'da veya klavyede bir notaya basıldığında anlık ses çalmak için kullanılır.
   * @param {string} instrumentId - Çalınacak enstrümanın ID'si.
   * @param {string} pitch - Nota (örn: "C4").
   * @param {number} velocity - Vuruş hızı (0-1).
   */
  auditionNoteOn(instrumentId, pitch, velocity = 1) { 
    const instrumentNode = this.instruments.get(instrumentId); 
    instrumentNode?.triggerAttack(pitch, Tone.now(), velocity); 
  }

  /**
   * `auditionNoteOn` ile çalınan notayı susturur.
   */
  auditionNoteOff(instrumentId, pitch) { 
    const instrumentNode = this.instruments.get(instrumentId); 
    instrumentNode?.triggerRelease(pitch, Tone.now()); 
  }

  /**
   * Projeden silinmiş olan enstrümanları ve mikser kanallarını motordan temizler.
   */
  _cleanupRemovedComponents(instrumentData, mixerTrackData) { 
    const mixerIds = new Set(mixerTrackData.map(t => t.id)); 
    this.mixerStrips.forEach((strip, id) => { if (!mixerIds.has(id)) { strip.dispose(); this.mixerStrips.delete(id); } }); 
    const instrumentIds = new Set(instrumentData.map(i => i.id)); 
    this.instruments.forEach((instrument, id) => { if (!instrumentIds.has(id)) { instrument.dispose(); this.instruments.delete(id); } }); 
  }

  /**
   * Gelen verilere göre mikser kanallarını (MixerStrip) oluşturur.
   */
  _createMixerStrips(mixerTrackData) { 
    mixerTrackData.forEach(trackData => { if (!this.mixerStrips.has(trackData.id)) { this.mixerStrips.set(trackData.id, new MixerStrip(trackData, this.masterFader, new Map(), this.mixerStrips)); } }); 
  }

  /**
   * Send/Bus yönlendirmeleri için tüm "bus" tipi kanalların girişlerini toplar.
   */
  _collectBusInputs(mixerTrackData) { 
    const busInputs = new Map(); 
    mixerTrackData.forEach(trackData => { if (trackData.type === 'bus') { const busStrip = this.mixerStrips.get(trackData.id); if (busStrip) { busInputs.set(trackData.id, busStrip.inputNode); } } }); 
    return busInputs; 
  }

  /**
   * Enstrümanların ses dosyalarını (buffer) yükler, ön-efektleri uygular ve
   * ilgili mikser kanalına bağlar.
   */
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
          const instrumentNode = this.instruments.get(instData.id); 
          const targetStrip = this.mixerStrips.get(instData.mixerTrackId); 
          if (instrumentNode && targetStrip) { 
            instrumentNode.output.disconnect(); 
            instrumentNode.output.connect(targetStrip.inputNode); 
          } 
        } 
      } catch (error) { 
        console.error(`Enstrüman yüklenemedi ${instData.name}:`, error); 
      } 
    }); 
    await Promise.all(loadPromises); 
  }

  /**
   * Bir mikser kanalının ana parametresini (volume, pan) günceller.
   */
  updateMixerParam(trackId, param, value) { 
    this.mixerStrips.get(trackId)?.updateParam(param, value); 
  }

  /**
   * Bir mikser kanalındaki bir efektin parametresini günceller.
   */
  updateEffectParam(trackId, effectId, param, value) { 
    this.mixerStrips.get(trackId)?.updateEffectParam(effectId, param, value); 
  }

  /**
   * `memoizedProcessBuffer`'ı çağıran aracı metot.
   */
  processBuffer(originalBuffer, instData) { 
    return memoizedProcessBuffer(originalBuffer, instData); 
  }

  /**
   * Sample Editor'daki bir değişiklik sonrası (örn: trim), sadece o enstrümanın
   * ses dosyasını yeniden işler ve günceller.
   */
  reconcileInstrument = (instrumentId, updatedInstData) => { 
    const originalBuffer = this.originalAudioBuffers.get(instrumentId); 
    if (!updatedInstData || !originalBuffer) return null; 
    const newProcessedBuffer = this.processBuffer(originalBuffer, updatedInstData); 
    this.processedAudioBuffers.set(instrumentId, newProcessedBuffer); 
    this.instruments.get(instrumentId)?.updateBuffer(newProcessedBuffer); 
    return newProcessedBuffer; 
  }
  
  /**
   * Dosya tarayıcısında veya Sample Editor'da bir sesi önizlemek için kullanılır.
   */
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

  /**
   * `reschedule` yapmadan önce tüm mevcut zamanlanmış notaları temizler.
   */
  clearAllScheduledNotes() { 
    this.scheduledEventIds.forEach(id => { 
      try { Tone.Transport.clear(id); } catch (e) { /* Event zaten temizlenmiş veya geçersiz olabilir */ } 
    }); 
    this.scheduledEventIds.clear(); 
  }

  /**
   * Projenin BPM'ini (temposunu) ayarlar.
   */
  setBpm(newBpm) { 
    const clampedBpm = Math.max(20, Math.min(300, newBpm)); 
    Tone.Transport.bpm.value = clampedBpm; 
  }

  /**
   * Projenin ana ses seviyesini (master fader) ayarlar.
   */
  setMasterVolume(levelInDb) { 
    this.masterFader.volume.value = levelInDb; 
  }

  /**
   * Timeline'da belirli bir ölçüye atlar.
   */
  jumpToBar(barNumber) { 
    timeManager.jumpToBar(barNumber); 
  }

  /**
   * Timeline'da belirli bir yüzdesel konuma atlar.
   */
  jumpToPercent(percent) { 
    timeManager.jumpToPercent(percent); 
  }

  // ========================================================================
  // === YENİ EKLENEN FONKSİYONLAR (Piyano Rulosu için) ===
  // ========================================================================

  /**
   * Bir notanın önizlemesini başlatır veya durdurur.
   * Velocity 0 ise notayı susturur, değilse çalar.
   * @param {string} instrumentId - Enstrüman ID'si.
   * @param {string} pitch - Çalınacak notanın perdesi (örn: "C4").
   * @param {number} velocity - Nota hızı (0 ile 1 arasında). 0 ise nota susturulur.
   */
  auditionNote(instrumentId, pitch, velocity) {
    if (velocity > 0) {
      this.auditionNoteOn(instrumentId, pitch, velocity);
    } else {
      this.auditionNoteOff(instrumentId, pitch);
    }
  }
  
  /**
   * Bir notanın önizlemesini başlatır (sesi açar).
   * @param {string} instrumentId - Enstrüman ID'si.
   * @param {string} pitch - Çalınacak notanın perdesi (örn: "C4").
   * @param {number} [velocity=1] - Nota hızı.
   */
  auditionNoteOn(instrumentId, pitch, velocity = 1) {
    const instrumentNode = this.instruments.get(instrumentId);
    instrumentNode?.triggerAttack(pitch, Tone.now(), velocity);
  }

  /**
   * Bir notanın önizlemesini durdurur (sesi kapatır).
   * @param {string} instrumentId - Enstrüman ID'si.
   * @param {string} pitch - Susturulacak notanın perdesi.
   */
  auditionNoteOff(instrumentId, pitch) {
    const instrumentNode = this.instruments.get(instrumentId);
    instrumentNode?.triggerRelease(pitch, Tone.now());
  }
  
  // ========================================================================
  // === MEVCUT FONKSİYONLAR (Değişiklik yok) ===
  // ========================================================================


  /**
   * Uygulama kapatıldığında veya motor yeniden başlatıldığında,
   * tüm ses kaynaklarını ve olayları temizleyerek hafıza sızıntılarını önler.
   */
  dispose() { 
    this.stop(); 
    timeManager.dispose(); 
    if (this.previewPlayer) this.previewPlayer.dispose(); 
    this.instruments.forEach(inst => inst.dispose()); 
    this.mixerStrips.forEach(strip => strip.dispose()); 
    this.originalAudioBuffers.forEach(buffer => buffer.dispose()); 
    this.processedAudioBuffers.forEach(buffer => buffer.dispose()); 
    this.instruments.clear(); 
    this.mixerStrips.clear(); 
    this.originalAudioBuffers.clear(); 
    this.processedAudioBuffers.clear(); 
    this.scheduledEventIds.clear(); 
    Tone.Transport.cancel(0); 
    console.log("[AUDIO ENGINE] Tamamen temizlendi"); 
  }
}

export default AudioEngine;