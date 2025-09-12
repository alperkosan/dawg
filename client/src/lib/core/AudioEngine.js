import * as Tone from 'tone';
import { calculateAudioLoopLength } from '../utils/patternUtils.js';
import { InstrumentNode } from './nodes/InstrumentNode.js';
import { MixerStrip } from './nodes/MixerStrip.js';
import { sliceBuffer, normalizeBuffer, reverseBuffer, reversePolarity, removeDCOffset, cloneBuffer } from '../utils/audioUtils.js';
import { memoize } from 'lodash';

// --- Buffer İşleme Optimizasyonu ---
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
 * KARARLILIĞI ARTMIŞ AudioEngine v3.0
 * - Queue-based sync mekanizması
 * - Error isolation ile robustness
 * - Batch processing ile performans optimizasyonu
 * - Memory leak koruması
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
    this.animationFrameId = null;
    
    // Concurrency control
    this.syncInProgress = false;
    this.pendingSync = null;
    
    console.log("[AUDIO ENGINE] Orkestra şefi hazır - v3.0 (Stabilized)");
  }

  /**
   * QUEUE-BASED senkronizasyon - Overlapping sync isteklerini önler
   */
  syncFromStores(instrumentData, mixerTrackData) {
    this.pendingSync = { instrumentData, mixerTrackData };
    if (!this.syncInProgress) {
      this._processSyncQueue();
    }
  }

  async _processSyncQueue() {
    if (!this.pendingSync) {
      this.syncInProgress = false;
      return;
    }

    this.syncInProgress = true;
    const { instrumentData, mixerTrackData } = this.pendingSync;
    this.pendingSync = null;

    try {
      await this._performSync(instrumentData, mixerTrackData);
    } catch (error) {
      console.error("[AUDIO ENGINE] Kritik sync hatası:", error);
      // Hata durumunda bile sistemi stabil tut
      this._emergencyCleanup();
    }

    // Eğer sync sırasında yeni bir istek geldi ise, onu işle
    if (this.pendingSync) {
      setTimeout(() => this._processSyncQueue(), 10);
    } else {
      this.syncInProgress = false;
    }
  }

  /**
   * Acil durum temizlik işlemi
   */
  _emergencyCleanup() {
    try {
      this.clearAllScheduledNotes();
      console.warn("[AUDIO ENGINE] Acil durum temizliği gerçekleştirildi.");
    } catch (error) {
      console.error("[AUDIO ENGINE] Acil durum temizliği başarısız:", error);
    }
  }

  /**
   * Ana senkronizasyon işlemi - Error isolation ile güvenli
   */
  async _performSync(instrumentData, mixerTrackData) {
    this.instrumentData = instrumentData;
    this.mixerTrackData = mixerTrackData;

    // Adım 1: Cleanup
    await this._cleanupRemovedComponents(instrumentData, mixerTrackData);

    // Adım 2: Mixer strips oluştur
    await this._createMixerStrips(mixerTrackData);

    // Adım 3: Bus inputs topla
    const busInputs = this._collectBusInputs(mixerTrackData);

    // Adım 4: Mixer chains oluştur (paralel ve error-safe)
    await this._buildMixerChains(mixerTrackData, busInputs);

    // Adım 5: Instruments yükle (paralel ve error-safe)
    await this._loadAndConnectInstruments(instrumentData);

    // Adım 6: Schedule
    await this.reschedule();
  }

  /**
   * Kaldırılmış componentleri güvenli şekilde temizle
   */
  async _cleanupRemovedComponents(instrumentData, mixerTrackData) {
    const mixerIds = new Set(mixerTrackData.map(t => t.id));
    const mixerCleanupPromises = [];

    this.mixerStrips.forEach((strip, id) => {
      if (!mixerIds.has(id)) {
        mixerCleanupPromises.push(
          Promise.resolve(strip.dispose()).catch(error => {
            console.warn(`[AUDIO ENGINE] Mixer strip cleanup hatası ${id}:`, error);
          })
        );
        this.mixerStrips.delete(id);
      }
    });

    const instrumentIds = new Set(instrumentData.map(i => i.id));
    const instrumentCleanupPromises = [];

    this.instruments.forEach((instrument, id) => {
      if (!instrumentIds.has(id)) {
        instrumentCleanupPromises.push(
          Promise.resolve(instrument.dispose()).catch(error => {
            console.warn(`[AUDIO ENGINE] Instrument cleanup hatası ${id}:`, error);
          })
        );
        this.instruments.delete(id);
      }
    });

    await Promise.all([...mixerCleanupPromises, ...instrumentCleanupPromises]);
  }

  /**
   * Mixer strips oluştur (error isolation ile)
   */
  async _createMixerStrips(mixerTrackData) {
    const creationPromises = mixerTrackData.map(async (trackData) => {
      if (!this.mixerStrips.has(trackData.id)) {
        try {
          const newStrip = new MixerStrip(trackData, this.masterFader, new Map(), this.mixerStrips);
          this.mixerStrips.set(trackData.id, newStrip);
        } catch (error) {
          console.error(`[AUDIO ENGINE] Mixer strip oluşturma hatası ${trackData.id}:`, error);
        }
      }
    });

    await Promise.all(creationPromises);
  }

  /**
   * Bus inputs topla
   */
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

  /**
   * Mixer chains oluştur (error isolation ile)
   */
  async _buildMixerChains(mixerTrackData, busInputs) {
    const buildPromises = Array.from(this.mixerStrips.entries()).map(async ([id, strip]) => {
      const trackData = mixerTrackData.find(t => t.id === id);
      if (trackData) {
        try {
          await strip.buildChain(trackData, this.masterFader, busInputs, this.mixerStrips);
        } catch (error) {
          console.error(`[AUDIO ENGINE] Chain building hatası ${id}:`, error);
        }
      }
    });

    await Promise.all(buildPromises);
  }

  /**
   * Instruments yükle ve bağla (error isolation ile)
   */
  async _loadAndConnectInstruments(instrumentData) {
    const loadPromises = instrumentData.map(async (instData) => {
      try {
        // Buffer yükleme
        if (!this.originalAudioBuffers.has(instData.id)) {
          const buffer = await Tone.ToneAudioBuffer.load(instData.url);
          this.originalAudioBuffers.set(instData.id, buffer);
        }

        // Buffer işleme
        const originalBuffer = this.originalAudioBuffers.get(instData.id);
        if (originalBuffer) {
          const processedBuffer = this.processBuffer(originalBuffer, instData);
          this.processedAudioBuffers.set(instData.id, processedBuffer);

          // Instrument oluştur/güncelle
          if (!this.instruments.has(instData.id)) {
            const newInstrumentNode = new InstrumentNode(instData, processedBuffer);
            this.instruments.set(instData.id, newInstrumentNode);
          } else {
            const instrument = this.instruments.get(instData.id);
            instrument.updateParameters(instData);
            instrument.updateBuffer(processedBuffer);
          }

          // Mixer bağlantısı
          const instrumentNode = this.instruments.get(instData.id);
          const targetStrip = this.mixerStrips.get(instData.mixerTrackId);
          
          if (instrumentNode && targetStrip) {
            instrumentNode.output.disconnect();
            instrumentNode.output.connect(targetStrip.inputNode);
          }
        }
      } catch (error) {
        console.error(`[AUDIO ENGINE] Instrument yükleme hatası ${instData.name}:`, error);
      }
    });

    await Promise.all(loadPromises);
  }

  // --- Kısmi Güncelleme Fonksiyonları ---
  updateMixerParam(trackId, param, value) {
    this.mixerStrips.get(trackId)?.updateParam(param, value);
  }

  updateEffectParam(trackId, effectId, param, value) {
    this.mixerStrips.get(trackId)?.updateEffectParam(effectId, param, value);
  }

  // --- Buffer İşleme ve Hafıza Yönetimi ---
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
      try {
        oldBuffer.dispose();
      } catch (error) {
        console.warn(`[AUDIO ENGINE] Buffer dispose hatası:`, error);
      }
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
  
  // --- Playback ve Zamanlama ---
  start() {
    if (Tone.context.state !== 'running') Tone.context.resume();
    if (Tone.Transport.state === 'started') return;
    
    this.reschedule();
    Tone.Transport.start();
    this.callbacks.setPlaybackState?.('playing');
    
    if (!this.animationFrameId) {
      this.visualUpdateLoop();
    }
  }

  pause() { 
    Tone.Transport.pause(); 
    this.callbacks.setPlaybackState?.('paused');
  }

  stop() { 
    Tone.Transport.stop(); 
    this.callbacks.setPlaybackState?.('stopped');
  }

  /**
   * OPTIMIZE EDİLMİŞ reschedule - Batch processing ve error handling ile
   */
  async reschedule() {
    console.log("[AUDIO ENGINE] Optimized reschedule başlıyor...");
    
    this.clearAllScheduledNotes();

    const scheduleInstrument = async (inst) => {
      if (inst.isMuted || !inst.notes) return;
      
      const instrumentNode = this.instruments.get(inst.id);
      const buffer = this.processedAudioBuffers.get(inst.id);
      if (!instrumentNode || !buffer) return;

      // Notları küçük gruplar halinde işle (UI donmasını önle)
      const batchSize = 50;
      for (let i = 0; i < inst.notes.length; i += batchSize) {
        const noteBatch = inst.notes.slice(i, i + batchSize);
        
        // Micro-task ile UI'yu bloklamadan işle
        await new Promise(resolve => setTimeout(resolve, 0));
        
        noteBatch.forEach(note => {
          try {
            const startSec = Tone.Time('16n').toSeconds() * note.time;
            const eventId = Tone.Transport.schedule(time => {
              instrumentNode.trigger(time, note, buffer.duration, inst.cutItself, inst);
            }, startSec);
            this.scheduledEventIds.set(`${inst.id}-${note.time}`, eventId);
          } catch (error) {
            console.warn(`[AUDIO ENGINE] Note schedule hatası ${inst.name}:`, error);
          }
        });
      }
    };

    // Her enstrümanı error isolation ile schedule et
    const schedulePromises = this.instrumentData.map(async (inst) => {
      try {
        return await scheduleInstrument(inst);
      } catch (error) {
        console.error(`[AUDIO ENGINE] Schedule hatası ${inst.name}:`, error);
        return null; // Continue with other instruments
      }
    });

    await Promise.all(schedulePromises);

    const loopLength = calculateAudioLoopLength(this.instrumentData);
    Tone.Transport.loopEnd = Tone.Time('16n') * loopLength;
    Tone.Transport.loop = true;
    
    console.log("[AUDIO ENGINE] Reschedule tamamlandı.");
  }

  clearAllScheduledNotes() {
    this.scheduledEventIds.forEach(id => {
      try {
        Tone.Transport.clear(id);
      } catch (error) {
        console.warn("[AUDIO ENGINE] Event clear hatası:", error);
      }
    });
    this.scheduledEventIds.clear();
  }

  visualUpdateLoop() {
    if (Tone.Transport.state !== 'started') {
      this.animationFrameId = null;
      return;
    }
    
    try {
      const progress = Tone.Transport.progress;
      const position = Tone.Transport.position.toString().split('.')[0];
      
      this.callbacks.onProgressUpdate?.(progress);
      this.callbacks.setTransportPosition?.(position);
    } catch (error) {
      console.warn("[AUDIO ENGINE] Visual update hatası:", error);
    }

    this.animationFrameId = requestAnimationFrame(() => this.visualUpdateLoop());
  }

  // --- Diğer Ayarlar ---
  setBpm(newBpm) { 
    Tone.Transport.bpm.value = newBpm; 
  }

  setMasterVolume(levelInDb) { 
    this.masterFader.volume.value = levelInDb; 
  }

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