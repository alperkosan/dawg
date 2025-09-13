import * as Tone from 'tone';
import { calculateAudioLoopLength } from '../utils/patternUtils.js';
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
    
    // --- YENİ ve GELİŞMİŞ KUYRUK MEKANİZMASI ---
    this.syncQueue = [];          // Gelen istekleri sırayla tutan bir dizi.
    this.syncInProgress = false;  // Mevcut bir senkronizasyonun çalışıp çalışmadığını belirten bayrak.
    
    console.log("[AUDIO ENGINE] Kuyruk Tabanlı Motor v3.0 Başlatıldı.");
  }

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
  syncFromStores(instrumentData, mixerTrackData) {
    // Bu fonksiyon çağrıldığında, hemen bir "söz" (Promise) yaratır.
    return new Promise((resolve) => {
      // Gelen işi ve bu iş bittiğinde ne yapılacağını (resolve fonksiyonu) kuyruğa ekle.
      this.syncQueue.push({ instrumentData, mixerTrackData, onComplete: resolve });
      
      // Eğer hali hazırda çalışan bir senkronizasyon yoksa, kuyruğu işlemeye başla.
      if (!this.syncInProgress) {
        this._processSyncQueue();
      }
    });
  }

  async _processSyncQueue() {
    // Kuyrukta bekleyen bir iş yoksa dur.
    if (this.syncQueue.length === 0) {
      this.syncInProgress = false;
      return;
    }

    // Bir işe başladığımızı belirtiyoruz.
    this.syncInProgress = true;
    // Kuyruktaki en eski işi al (FIFO mantığı).
    const { instrumentData, mixerTrackData, onComplete } = this.syncQueue.shift();

    try {
      // Asıl senkronizasyon işlemini gerçekleştir ve bitmesini bekle.
      await this._performSync(instrumentData, mixerTrackData);
    } catch (error) {
      console.error("[AUDIO ENGINE] Senkronizasyon sırasında kritik hata:", error);
    }

    // İş bitti! Şimdi bu işi başlatan yere "sözümüzü tuttuk, iş bitti" diyoruz.
    onComplete();

    // Kuyrukta hala bekleyen başka işler varsa, döngüye devam et.
    if (this.syncQueue.length > 0) {
      this._processSyncQueue();
    } else {
      // Kuyruk boşaldı, bayrağı indirip yeni istekleri bekleyebiliriz.
      this.syncInProgress = false;
    }
  }

  async _performSync(instrumentData, mixerTrackData) {
    console.groupCollapsed("[Perform Sync] Motor senkronizasyon işlemi başladı.");
    this.instrumentData = instrumentData;
    this.mixerTrackData = mixerTrackData;

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
  
  start() {
    if (Tone.context.state !== 'running') Tone.context.resume();
    if (Tone.Transport.state === 'started') return;
    this.reschedule();
    Tone.Transport.start();
    this.callbacks.setPlaybackState?.('playing');
  }

  pause() { 
    Tone.Transport.pause(); 
    this.callbacks.setPlaybackState?.('paused');
  }

  stop() { 
    Tone.Transport.stop(); 
    this.callbacks.setPlaybackState?.('stopped');
  }
  
  reschedule() {
    this.clearAllScheduledNotes();
    const loopLength = calculateAudioLoopLength(this.instrumentData);
    Tone.Transport.loopEnd = Tone.Time('16n') * loopLength;
    Tone.Transport.loop = true;
    
    let totalNotesScheduled = 0;
    this.instrumentData.forEach(inst => {
      if (inst.isMuted || !inst.notes) return;
      const instrumentNode = this.instruments.get(inst.id);
      const buffer = this.processedAudioBuffers.get(inst.id);
      if (!instrumentNode || !buffer) return;

      inst.notes.forEach(note => {
        const startSec = Tone.Time('16n').toSeconds() * note.time;
        const eventId = Tone.Transport.schedule(time => {
          instrumentNode.trigger(time, note, buffer.duration, inst.cutItself);
        }, startSec);
        this.scheduledEventIds.set(`${inst.id}-${note.time}`, eventId);
        totalNotesScheduled++;
      });
    });
    console.log(`✅ Toplam ${totalNotesScheduled} nota başarıyla planlandı. Döngü uzunluğu: ${loopLength} adım.`);
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
    
    // Animation loop'u durdur
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Preview player temizle
    if (this.previewPlayer) {
      this.previewPlayer.dispose();
      this.previewPlayer = null;
    }
    
    // Tüm componentleri temizle
    this.instruments.forEach(inst => {
      try {
        inst.dispose();
      } catch (error) {
        console.warn("[AUDIO ENGINE] Instrument dispose hatası:", error);
      }
    });
    
    this.mixerStrips.forEach(strip => {
      try {
        strip.dispose();
      } catch (error) {
        console.warn("[AUDIO ENGINE] Strip dispose hatası:", error);
      }
    });
    
    this.originalAudioBuffers.forEach(buffer => {
      try {
        buffer.dispose();
      } catch (error) {
        console.warn("[AUDIO ENGINE] Buffer dispose hatası:", error);
      }
    });
    
    this.processedAudioBuffers.forEach(buffer => {
      try {
        buffer.dispose();
      } catch (error) {
        console.warn("[AUDIO ENGINE] Processed buffer dispose hatası:", error);
      }
    });
    
    // Maps'leri temizle
    this.instruments.clear();
    this.mixerStrips.clear();
    this.originalAudioBuffers.clear();
    this.processedAudioBuffers.clear();
    this.scheduledEventIds.clear();
    
    // Transport'u temizle
    try {
      Tone.Transport.cancel(0);
    } catch (error) {
      console.warn("[AUDIO ENGINE] Transport cancel hatası:", error);
    }
    
    // Sync state'i temizle
    this.syncInProgress = false;
    this.pendingSync = null;
    
    console.log("[AUDIO ENGINE] Tüm kaynaklar güvenli şekilde temizlendi.");
  }
}

export default AudioEngine;