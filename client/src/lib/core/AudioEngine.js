import * as Tone from 'tone';
import { calculateAudioLoopLength, calculatePatternLoopLength } from '../utils/patternUtils.js';
import { InstrumentNode } from './nodes/InstrumentNode.js';
import { MixerStrip } from './nodes/MixerStrip.js';
import { sliceBuffer, normalizeBuffer, reverseBuffer, reversePolarity, removeDCOffset, cloneBuffer } from '../utils/audioUtils.js';
import { memoize } from 'lodash';

// Buffer işleme optimizasyonu (Bu kısım doğru ve kalmalı)
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
 * GELİŞTİRİLMİŞ AudioEngine: Artık "kuyruk tabanlı" bir senkronizasyon
 * mekanizmasına sahip. Bu, arayüzden gelen hızlı ve çoklu isteklerin
 * motoru kararsız hale getirmesini (race condition) engeller.
 */
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
    // YENİ: Aranje verisini saklamak için bir özellik ekleyin.
    this.arrangementData = null; 

    this.clips = [];
    this.patterns = {};
    this.arrangementTracks = [];

    this.playbackMode = 'song'; // Engine içinde de modu saklayalım
    this.activePatternId = null; 

    this.animationFrameId = null;

    // --- YENİ ve GELİŞMİŞ KUYRUK MEKANİZMASI ---
    this.syncQueue = [];          // Gelen istekleri sırayla tutan bir dizi.
    this.syncInProgress = false;  // Mevcut bir senkronizasyonun çalışıp çalışmadığını belirten bayrak.
    
    console.log("[AUDIO ENGINE] Kuyruk Tabanlı Motor v3.0 Başlatıldı.");
  }

  // === YENİ: Playback pozisyonunu yayınlayan animasyon döngüsü ===
  _animationLoop = () => {
    const progress = Tone.Transport.progress;
    
    // === DÜZELTME BURADA ===
    // Zaman bilgisini alıp, '.' karakterinden bölerek milisaniye kısmını atıyoruz.
    const transportPos = Tone.Transport.position.split('.')[0];
    this.callbacks.setTransportPosition?.(transportPos);
    // ========================

    this.callbacks.onProgressUpdate?.(progress);
    this.animationFrameId = requestAnimationFrame(this._animationLoop);
  };

  // YENİ: Piano Roll'den gelen anlık nota çalma isteğini yönetir.
  auditionNoteOn(instrumentId, pitch, velocity = 1) {
    const instrumentNode = this.instruments.get(instrumentId);
    instrumentNode?.triggerAttack(pitch, Tone.now(), velocity);
  }

  // YENİ: Piano Roll'den gelen anlık nota susturma isteğini yönetir.
  auditionNoteOff(instrumentId, pitch) {
    const instrumentNode = this.instruments.get(instrumentId);
    instrumentNode?.triggerRelease(pitch, Tone.now());
  }

  /**
   * Artık bir Promise döndüren, AWAIT ile beklenebilir senkronizasyon fonksiyonu.
  */
  syncFromStores(instrumentData, mixerTrackData, arrangementData) {
    return new Promise((resolve) => {
      this.syncQueue.push({ instrumentData, mixerTrackData, arrangementData, onComplete: resolve });
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
    // GÜNCELLENDİ: arrangementData'yı kuyruktan al.
    const { instrumentData, mixerTrackData, arrangementData, onComplete } = this.syncQueue.shift();

    try {
      // GÜNCELLENDİ: arrangementData'yı ana senkronizasyon fonksiyonuna ilet.
      await this._performSync(instrumentData, mixerTrackData, arrangementData);
    } catch (error) {
      console.error("[AUDIO ENGINE] Senkronizasyon sırasında kritik hata:", error);
    }

    onComplete();

    if (this.syncQueue.length > 0) {
      this._processSyncQueue();
    } else {
      this.syncInProgress = false;
    }
  }

  async _performSync(instrumentData, mixerTrackData, arrangementData) {
    console.groupCollapsed("[Perform Sync] Motor senkronizasyon işlemi başladı.");
    this.instrumentData = instrumentData;
    this.mixerTrackData = mixerTrackData;
    if (arrangementData) {
        this.clips = arrangementData.clips || [];
        this.patterns = arrangementData.patterns || {};
        this.arrangementTracks = arrangementData.tracks || [];
    }
    
    console.log("Adım 1: Eski component'ler temizleniyor...");
    this._cleanupRemovedComponents(instrumentData, mixerTrackData);
    
    console.log("Adım 2: Mikser kanalları (strip) oluşturuluyor...");
    this._createMixerStrips(mixerTrackData);
    const busInputs = this._collectBusInputs(mixerTrackData);

    const buildPromises = Array.from(this.mixerStrips.entries()).map(([id, strip]) => {
      const trackData = mixerTrackData.find(t => t.id === id);
      if (trackData) return strip.buildChain(trackData, this.masterFader, busInputs, this.mixerStrips);
      return Promise.resolve();
    });
    await Promise.all(buildPromises);
    console.log(`✅ ${this.mixerStrips.size} mikser kanalı yapılandırıldı.`);
    
    console.log("Adım 3: Enstrümanlar yükleniyor ve bağlanıyor...");
    await this._loadAndConnectInstruments(instrumentData);
    
    console.log("Adım 4: Notalar transport'a planlanıyor (reschedule)...");
    this.reschedule();
    
    console.groupEnd();
  }

  _cleanupRemovedComponents(instrumentData, mixerTrackData) {
    const mixerIds = new Set(mixerTrackData.map(t => t.id));
    this.mixerStrips.forEach((strip, id) => {
      if (!mixerIds.has(id)) {
        strip.dispose();
        this.mixerStrips.delete(id);
      }
    });

    const instrumentIds = new Set(instrumentData.map(i => i.id));
    this.instruments.forEach((instrument, id) => {
      if (!instrumentIds.has(id)) {
        instrument.dispose();
        this.instruments.delete(id);
      }
    });
  }

  _createMixerStrips(mixerTrackData) {
    mixerTrackData.forEach(trackData => {
      if (!this.mixerStrips.has(trackData.id)) {
        const newStrip = new MixerStrip(trackData, this.masterFader, new Map(), this.mixerStrips);
        this.mixerStrips.set(trackData.id, newStrip);
      }
    });
  }

  _collectBusInputs(mixerTrackData) {
    const busInputs = new Map();
    mixerTrackData.forEach(trackData => {
      if (trackData.type === 'bus') {
        const busStrip = this.mixerStrips.get(trackData.id);
        if (busStrip) {
          busInputs.set(trackData.id, busStrip.inputNode);
        }
      }
    });
    return busInputs;
  }

  async _loadAndConnectInstruments(instrumentData) {
    const loadPromises = instrumentData.map(async (instData) => {
      try {
        if (!this.originalAudioBuffers.has(instData.id) && instData.url) {
          console.log(`  -> Buffer yükleniyor: ${instData.name} (${instData.url})`);
          const buffer = await Tone.ToneAudioBuffer.load(instData.url);
          this.originalAudioBuffers.set(instData.id, buffer);
        }

        const originalBuffer = this.originalAudioBuffers.get(instData.id);
        if (originalBuffer) {
          const processedBuffer = this.processBuffer(originalBuffer, instData);
          this.processedAudioBuffers.set(instData.id, processedBuffer);

          if (!this.instruments.has(instData.id)) {
            const newInstrumentNode = new InstrumentNode(instData, processedBuffer);
            this.instruments.set(instData.id, newInstrumentNode);
            console.log(`  ✅ Enstrüman oluşturuldu: ${instData.name}`);
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
        console.error(`  ❌ HATA: Enstrüman yüklenemedi ${instData.name}:`, error);
      }
    });
    await Promise.all(loadPromises);
    console.log(`✅ ${this.instruments.size} enstrüman başarıyla yüklendi/güncellendi.`);
  }

  // --- Kısmi Güncelleme ve Diğer Fonksiyonlar (Aynı Kalıyor) ---
  updateMixerParam(trackId, param, value) {
    this.mixerStrips.get(trackId)?.updateParam(param, value);
  }

  updateEffectParam(trackId, effectId, param, value) {
    this.mixerStrips.get(trackId)?.updateEffectParam(effectId, param, value);
  }
  
  processBuffer(originalBuffer, instData) {
    return memoizedProcessBuffer(originalBuffer, instData);
  }

  reconcileInstrument = (instrumentId, updatedInstData) => {
    const originalBuffer = this.originalAudioBuffers.get(instrumentId);
    if (!updatedInstData || !originalBuffer) return null;

    const oldBuffer = this.processedAudioBuffers.get(instrumentId);
    const newProcessedBuffer = this.processBuffer(originalBuffer, updatedInstData);
    this.processedAudioBuffers.set(instrumentId, newProcessedBuffer);
    
    if (oldBuffer && oldBuffer !== newProcessedBuffer) {
      try { oldBuffer.dispose(); } catch (e) {}
    }

    this.instruments.get(instrumentId)?.updateBuffer(newProcessedBuffer);
    return newProcessedBuffer;
  }
  
  /**
   * Preview fonksiyonu (Sample Editor için)
   */
  previewInstrument(instrumentId) {
    if (!this.previewPlayer) {
      this.previewPlayer = new Tone.Player().toDestination();
      this.previewPlayer.onstop = () => {
        this.callbacks.setIsPreviewPlaying?.(false);
      };
    }

    if (this.previewPlayer.state === 'started') {
      this.previewPlayer.stop();
      this.callbacks.setIsPreviewPlaying?.(false);
      return;
    }

    const processedBuffer = this.processedAudioBuffers.get(instrumentId);
    if (processedBuffer) {
      this.previewPlayer.buffer = processedBuffer;
      this.previewPlayer.start();
      this.callbacks.setIsPreviewPlaying?.(true);
    } else {
      console.warn(`[AUDIO ENGINE] Önizleme başarısız: ${instrumentId} için buffer bulunamadı.`);
    }
  }

  // GÜNCELLENDİ: start metodu artık activePatternId'yi de alıyor.
  start(playbackMode = 'pattern', activePatternId = null) {
    if (Tone.context.state !== 'running') Tone.context.resume();
    if (Tone.Transport.state === 'started') return;

    this.playbackMode = playbackMode;
    this.activePatternId = activePatternId;

    this.reschedule();
    Tone.Transport.start();
    this.callbacks.setPlaybackState?.('playing');

    // YENİ: Çalma başladığında animasyon döngüsünü de başlat
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this._animationLoop();
  }
  pause() {
    Tone.Transport.pause(); 
    this.callbacks.setPlaybackState?.('paused');
    // YENİ: Duraklatıldığında animasyon döngüsünü durdur
    if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
    }
  }

  stop() {
    Tone.Transport.stop(); 
    this.callbacks.setPlaybackState?.('stopped');
    // YENİ: Durdurulduğunda animasyon döngüsünü durdur ve playhead'i sıfırla
    if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
    }
    this.callbacks.onProgressUpdate?.(0); // Playhead'i başa al
    this.callbacks.setTransportPosition?.('0:0:0');
  }

  /**
   * === ANA DÜZELTME BURADA ===
   * reschedule metodu artık daha temiz ve mantıksal olarak doğru kontrollere sahip.
   */
  reschedule() {
    this.clearAllScheduledNotes();
    
    let totalNotesScheduled = 0;

    // --- SENARYO 1: SONG (ARANJE) MODU ---
    if (this.playbackMode === 'song') {
      const loopLength = calculateAudioLoopLength(this.instrumentData, this.clips);
      Tone.Transport.loopEnd = Tone.Time('16n') * loopLength;
      Tone.Transport.loop = true;

      const trackToInstrumentMap = new Map();
      this.arrangementTracks.forEach(track => track.instrumentId && trackToInstrumentMap.set(track.id, track.instrumentId));

      this.clips.forEach(clip => {
        const pattern = this.patterns ? this.patterns[clip.patternId] : null;
        if (!pattern) return;

        const clipStartInSteps = clip.startTime * 16;
        const clipDurationInSteps = clip.duration * 16;

        Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
          if (clip.trackId && trackToInstrumentMap.get(clip.trackId) !== instrumentId) return;
          const instrument = this.instrumentData.find(i => i.id === instrumentId);
          if (!instrument || instrument.isMuted) return;
          const instrumentNode = this.instruments.get(instrumentId);
          const buffer = this.processedAudioBuffers.get(instrumentId);
          if (!instrumentNode || !buffer || !notes) return;

          notes.forEach(note => {
            if (note.time >= clipDurationInSteps) return;
            const absoluteNoteTime = clipStartInSteps + note.time;
            const startSec = Tone.Time('16n').toSeconds() * absoluteNoteTime;
            const eventId = Tone.Transport.schedule(time => instrumentNode.trigger(time, note, buffer.duration, instrument.cutItself), startSec);
            this.scheduledEventIds.set(`${clip.id}-${instrumentId}-${note.id || note.time}`, eventId);
            totalNotesScheduled++;
          });
        });
      });
      console.log(`✅ [SONG Modu] Toplam ${totalNotesScheduled} nota planlandı. Döngü uzunluğu: ${loopLength} adım.`);

    // --- SENARYO 2: PATTERN MODU ---
    } else {
      // GÜNCELLENMİŞ KONTROL: Artık doğrudan this.patterns ve this.activePatternId'yi kontrol ediyoruz.
      // Bu, aranje verisinden tamamen bağımsızdır.
      const activePattern = this.patterns && this.activePatternId ? this.patterns[this.activePatternId] : null;

      if (!activePattern) {
        console.warn("Reschedule: Çalınacak aktif pattern bulunamadı.");
        Tone.Transport.loopEnd = '1m';
        Tone.Transport.loop = true;
        return;
      }
      
      const loopLength = calculatePatternLoopLength(activePattern);
      Tone.Transport.loopEnd = Tone.Time('16n') * loopLength;
      Tone.Transport.loop = true;

      Object.entries(activePattern.data).forEach(([instrumentId, notes]) => {
         const instrument = this.instrumentData.find(i => i.id === instrumentId);
         if (!instrument || instrument.isMuted || !notes) return;
         const instrumentNode = this.instruments.get(instrumentId);
         const buffer = this.processedAudioBuffers.get(instrumentId);
         if (!instrumentNode || !buffer) return;

         notes.forEach(note => {
            const startSec = Tone.Time('16n').toSeconds() * note.time;
            const eventId = Tone.Transport.schedule(time => instrumentNode.trigger(time, note, buffer.duration, instrument.cutItself), startSec);
            this.scheduledEventIds.set(`pattern-${this.activePatternId}-${instrumentId}-${note.id}`, eventId);
            totalNotesScheduled++;
         });
      });
      console.log(`✅ [PATTERN Modu] "${activePattern.name}" için ${totalNotesScheduled} nota planlandı. Döngü uzunluğu: ${loopLength} adım.`);
    }
  }

  clearAllScheduledNotes() {
    this.scheduledEventIds.forEach(id => Tone.Transport.clear(id));
    this.scheduledEventIds.clear();
  }

  setBpm(newBpm) { Tone.Transport.bpm.value = newBpm; }
  setMasterVolume(levelInDb) { this.masterFader.volume.value = levelInDb; }

  // --- Hafıza Temizliği ---
  dispose() {
    this.stop();
    
    // YENİ: Dispose edilirken animasyon döngüsünün kesin olarak durduğundan emin ol
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    if (this.previewPlayer) {
      this.previewPlayer.dispose();
      this.previewPlayer = null;
    }
    
    this.instruments.forEach(inst => {
      try { inst.dispose(); } catch (error) { console.warn("[AUDIO ENGINE] Instrument dispose hatası:", error); }
    });
    
    this.mixerStrips.forEach(strip => {
      try { strip.dispose(); } catch (error) { console.warn("[AUDIO ENGINE] Strip dispose hatası:", error); }
    });
    
    this.originalAudioBuffers.forEach(buffer => {
      try { buffer.dispose(); } catch (error) { console.warn("[AUDIO ENGINE] Buffer dispose hatası:", error); }
    });
    
    this.processedAudioBuffers.forEach(buffer => {
      try { buffer.dispose(); } catch (error) { console.warn("[AUDIO ENGINE] Processed buffer dispose hatası:", error); }
    });
    
    this.instruments.clear();
    this.mixerStrips.clear();
    this.originalAudioBuffers.clear();
    this.processedAudioBuffers.clear();
    this.scheduledEventIds.clear();
    
    try { Tone.Transport.cancel(0); } catch (error) { console.warn("[AUDIO ENGINE] Transport cancel hatası:", error); }
    
    this.syncInProgress = false;
    this.pendingSync = null;
    
    console.log("[AUDIO ENGINE] Tüm kaynaklar güvenli şekilde temizlendi.");
  }
}

export default AudioEngine;