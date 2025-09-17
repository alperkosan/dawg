import * as Tone from 'tone';
import { timeManager } from './UnifiedTimeManager';
import { InstrumentNode } from './nodes/InstrumentNode.js';
import { MixerStrip } from './nodes/MixerStrip.js';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
// YENİ: Buffer işleme yardımcı fonksiyonlarını import ediyoruz
import { cloneBuffer, normalizeBuffer, reverseBuffer, reversePolarity, removeDCOffset } from '../utils/audioUtils';
import { memoize } from 'lodash';

// YENİ: Buffer işleme işlemlerini hızlandırmak için memoization (önbellekleme) kullanıyoruz.
// Aynı orijinal buffer ve aynı ayarlarla tekrar işlem yapılmasını engeller.
const memoizedProcessBuffer = memoize(
  (originalBuffer, instData) => {
    if (!originalBuffer) return null;
    let processed = cloneBuffer(originalBuffer);
    if (!processed) return null;
    const effects = instData.precomputed || {};
    if (effects.removeDCOffset) processed = removeDCOffset(processed);
    if (effects.normalize) processed = normalizeBuffer(processed);
    if (effects.reverse) processed = reverseBuffer(processed);
    if (effects.reversePolarity) processed = reversePolarity(processed);
    return processed;
  },
  // Önbellek anahtarı: Orijinal buffer'ın URL'si ve efekt ayarlarının birleşimi.
  (originalBuffer, instData) => `${originalBuffer.url || 'buffer'}-${JSON.stringify(instData.precomputed)}`
);

/**
 * @file AudioEngine.js - v2.0 Olay Tabanlı (Event-Driven)
 * @description Bu ses motoru, "her şeyi yeniden senkronize et" mantığı yerine,
 * store'lardan gelen spesifik komutlarla (event'lerle) çalışan modern bir mimariye sahiptir.
 * 'syncFromStores' sadece ilk yüklemede kullanılır. Sonraki tüm değişiklikler
 * granüler metodlar aracılığıyla anlık olarak işlenir.
 */
class AudioEngine {
  constructor(callbacks) {
    this.callbacks = callbacks || {};
    this.masterFader = new Tone.Volume(0).toDestination();
    this.instruments = new Map();
    this.mixerStrips = new Map();
    this.scheduledEventIds = new Map(); // schedule edilen event'leri takip etmek için
    this.originalAudioBuffers = new Map();

    this.activePatternId = null;
    this.patterns = {};
    this.playbackMode = 'pattern';

    this.setupTimeManager();
    console.log("🔊 Olay Tabanlı Ses Motoru v2.0 Başlatıldı.");
  }

  setupTimeManager() {
    timeManager.onPositionUpdate = (position) => this.callbacks.setTransportPosition?.(position.formatted);
    timeManager.onLoopInfoUpdate = (loopInfo) => this.callbacks.setLoopLengthFromEngine?.(loopInfo.lengthInSteps);
  }

  // ============================================
  // === 1. İLK YÜKLEME: BÜYÜK SENKRONİZASYON ===
  // ============================================

  async syncFromStores(instrumentData, mixerTrackData, arrangementData) {
    console.log("%c[SYNC] Proje verileri ses motoruna yükleniyor...", "color: #818cf8; font-weight: bold;");
    
    // Aktif pattern ve mod bilgisini al
    this.patterns = arrangementData.patterns;
    this.activePatternId = arrangementData.activePatternId;
    this.playbackMode = usePlaybackStore.getState().playbackMode; // PlaybackStore'dan al

    // 1. Tüm mikser kanallarını oluştur
    for (const trackData of mixerTrackData) {
      this.createMixerStrip(trackData);
    }

    // 2. Tüm mikser kanallarının ses zincirini kur (send/bus bağlantıları için)
    this._buildAllSignalChains(mixerTrackData);

    // 3. Tüm enstrümanları oluştur ve miksere bağla
    for (const instData of instrumentData) {
      await this.createInstrument(instData);
    }
    
    // 4. Notaları zaman çizelgesine yerleştir
    this.reschedule();
    console.log("%c[SYNC] Yükleme tamamlandı. Motor hazır.", "color: #34d399; font-weight: bold;");
  }

  // ============================================
  // === 2. GRANÜLER KOMUTLAR (OLAYLAR)       ===
  // ============================================

  createMixerStrip(trackData) {
    if (this.mixerStrips.has(trackData.id)) return;
    const strip = new MixerStrip(trackData);
    this.mixerStrips.set(trackData.id, strip);
    console.log(`[AUDIO] Mixer kanalı oluşturuldu: ${trackData.name} (${trackData.id})`);
  }

  async createInstrument(instData) {
    if (this.instruments.has(instData.id)) return;
    
    const instrumentNode = new InstrumentNode(instData);
    this.instruments.set(instData.id, instrumentNode);
    
    // GÜNCELLEME: Artık burada await Tone.loaded() dememize gerek yok,
    // çünkü InstrumentNode kendi promise'ini yönetiyor.
    
    // Yükleme tamamlandığında orijinal buffer'ı sakla.
    instrumentNode.readyPromise.then(() => {
        if (instrumentNode.sampler.loaded) {
            this.originalAudioBuffers.set(instData.id, instrumentNode.sampler.buffer);
        }
    });

    this.connectInstrumentToMixer(instData.id, instData.mixerTrackId);
  }
  
  connectInstrumentToMixer(instrumentId, mixerTrackId) {
      const instrumentNode = this.instruments.get(instrumentId);
      const targetStrip = this.mixerStrips.get(mixerTrackId);

      if (instrumentNode && targetStrip) {
        instrumentNode.output.disconnect();
        instrumentNode.output.connect(targetStrip.inputGain);
        console.log(`[AUDIO] Bağlantı yapıldı: ${instrumentNode.id} -> ${targetStrip.id}`);
      } else {
        console.warn(`[AUDIO] Bağlantı hatası: Enstrüman (${instrumentId}) veya Mikser Kanalı (${mixerTrackId}) bulunamadı.`);
      }
  }

  // YENİ VE ASENKRON: UI, bu metodu çağırarak buffer'ın yüklenmesini bekleyecek.
  async requestInstrumentBuffer(instrumentId) {
      const node = this.instruments.get(instrumentId);
      if (!node) {
          console.error(`[requestInstrumentBuffer] Enstrüman bulunamadı: ${instrumentId}`);
          return null;
      }

      // 1. Enstrümanın hazır olmasını bekle (buffer'ın yüklenmesi dahil).
      await node.readyPromise;

      // 2. Hazır olduğunda, güncel buffer'ı güvenle döndür.
      return node.sampler.buffer;
  }

  // YENİ VE KRİTİK: Buffer'ı yeniden işleyen ve güncelleyen metod.
  reconcileInstrument(instrumentId, updatedInstData) {
      console.log(`[RECONCILE] ${instrumentId} için buffer yeniden işleniyor...`, updatedInstData.precomputed);
      const originalBuffer = this.originalAudioBuffers.get(instrumentId);
      const instrumentNode = this.instruments.get(instrumentId);

      if (!originalBuffer || !instrumentNode) {
          console.error(`[RECONCILE] Hata: Orijinal buffer veya enstrüman bulunamadı: ${instrumentId}`);
          return null;
      }

      // 1. Yeni ayarlarla buffer'ı yeniden işle (veya önbellekten al).
      const newProcessedBuffer = memoizedProcessBuffer(originalBuffer, updatedInstData);
      
      // 2. InstrumentNode içindeki sampler'ın buffer'ını anında yeni işlenmiş buffer ile değiştir.
      instrumentNode.sampler.buffer = newProcessedBuffer;

      console.log(`[RECONCILE] ${instrumentId} için buffer güncellendi.`);
      
      // 3. Yeni buffer'ı UI'da (SampleEditor) göstermek üzere geri döndür.
      return newProcessedBuffer;
  }
  
  addEffectToTrack(trackId, effectData) {
    // Bu metod, sadece bir kanalı yeniden yapılandırır, tüm motoru değil.
    this._rebuildSingleSignalChain(trackId);
  }

  removeEffectFromTrack(trackId, effectId) {
    this._rebuildSingleSignalChain(trackId);
  }
  
  updateMixerParam = (trackId, param, value) => {
    this.mixerStrips.get(trackId)?.updateParam(param, value);
  }

  updateEffectParam = (trackId, effectId, param, value) => {
    this.mixerStrips.get(trackId)?.updateEffectParam(effectId, param, value);
  }
  
  toggleSolo = (trackId, isSoloing) => {
      // Logic to handle soloing for all tracks
  }
  
  toggleMute = (trackId, isMuted) => {
      this.mixerStrips.get(trackId)?.setMute(isMuted);
  }


  // ============================================
  // === 3. YÖNLENDİRME VE ZİNCİR YÖNETİMİ    ===
  // ============================================
  
  _buildAllSignalChains(mixerTrackData) {
      const busInputs = new Map();
      mixerTrackData.forEach(track => {
          if (track.type === 'bus') {
              busInputs.set(track.id, this.mixerStrips.get(track.id)?.inputGain);
          }
      });

      for (const trackData of mixerTrackData) {
          this.mixerStrips.get(trackData.id)?.buildSignalChain(trackData, this.masterFader, busInputs);
      }
  }

  _rebuildSingleSignalChain(trackId) {
      const trackData = useMixerStore.getState().mixerTracks.find(t => t.id === trackId);
      if (!trackData) return;
      
      const allTracks = useMixerStore.getState().mixerTracks;
      const busInputs = new Map();
      allTracks.forEach(track => {
          if (track.type === 'bus') {
              busInputs.set(track.id, this.mixerStrips.get(track.id)?.inputGain);
          }
      });
      
      this.mixerStrips.get(trackId)?.buildSignalChain(trackData, this.masterFader, busInputs);
      console.log(`[AUDIO] Sinyal zinciri güncellendi: ${trackId}`);
  }

  // ============================================
  // === 4. ZAMANLAMA VE ÇALMA                ===
  // ============================================

  reschedule() {
    console.log('%c[RESCHEDULE] Notalar yeniden zamanlanıyor...', 'color: orange; font-weight: bold;');
    
    // 1. Önceki tüm zamanlanmış olayları temizle
    Tone.Transport.cancel(0);
    this.scheduledEventIds.clear();
    
    // 2. Gerekli en güncel veriyi store'lardan çek
    this.patterns = useArrangementStore.getState().patterns;
    this.activePatternId = useArrangementStore.getState().activePatternId;
    this.playbackMode = usePlaybackStore.getState().playbackMode;
    const instruments = useInstrumentsStore.getState().instruments;

    console.log(`[RESCHEDULE] Mod: ${this.playbackMode}, Aktif Pattern ID: ${this.activePatternId}`);

    // 3. Zaman yöneticisini yeni duruma göre güncelle
    const arrangementData = useArrangementStore.getState();
    timeManager.calculateLoopInfo(this.playbackMode, this.activePatternId, arrangementData);

    // 4. Pattern modunda mıyız ve geçerli bir pattern var mı diye kontrol et
    const activePattern = this.patterns?.[this.activePatternId];
    if (!activePattern) {
        console.warn('[RESCHEDULE] Aktif pattern bulunamadı. Zamanlama atlanıyor.');
        return;
    }
    if (this.playbackMode !== 'pattern') {
        console.log('[RESCHEDULE] Song modunda. Pattern zamanlaması atlanıyor.');
        return;
    }
    
    console.log(`[RESCHEDULE] Aktif Pattern bulundu: "${activePattern.name}". Notalar işleniyor...`);
    let totalScheduledNotes = 0;

    // 5. Notaları zamanla
    Object.entries(activePattern.data).forEach(([instId, notes]) => {
      const inst = instruments.find(i => i.id === instId);
      if (!inst || inst.isMuted || !notes || notes.length === 0) {
        return; // Sessiz, notası olmayan veya bulunamayan enstrümanları atla
      }
      
      const node = this.instruments.get(instId);
      if (!node) {
        console.warn(`[RESCHEDULE] Zamanlama için enstrüman düğümü bulunamadı: ${instId}`);
        return;
      }
      
      console.log(`%c  -> ${inst.name}: ${notes.length} nota zamanlanıyor...`, 'color: cyan;');
      let scheduledCountForInst = 0;

      notes.forEach(note => {
        const step = note.time;
        const timeNotation = `${Math.floor(step / 16)}:${Math.floor((step % 16) / 4)}:${step % 4}`;
        
        try {
            const eventId = Tone.Transport.schedule(time => {
              if (node && typeof node.trigger === 'function') {
                node.trigger(time, note, null, inst.cutItself);
              }
            }, timeNotation);
            this.scheduledEventIds.set(`${instId}-${note.id || note.time}`, eventId);
            scheduledCountForInst++;
        } catch (e) {
            console.error(`[RESCHEDULE] Hata: ${inst.name} için nota zamanlanamadı. Time: ${timeNotation}`, e);
        }
      });
      totalScheduledNotes += scheduledCountForInst;
    });
    
    console.log(`%c[RESCHEDULE] Tamamlandı. Toplam ${totalScheduledNotes} nota zaman çizelgesine eklendi.`, 'color: lightgreen; font-weight: bold;');
  }

  start() {
    if (Tone.context.state !== 'running') Tone.context.resume();
    // Play'e basıldığında her zaman en güncel veriyi yeniden zamanla
    this.reschedule(); 
    timeManager.start(this.playbackMode, this.activePatternId, useArrangementStore.getState());
    Tone.Transport.start();
    this.callbacks.setPlaybackState?.('playing');
  }

  stop() {
    Tone.Transport.stop();
    timeManager.stop();
    this.callbacks.setPlaybackState?.('stopped');
  }

  pause() {
      Tone.Transport.pause();
      timeManager.pause();
      this.callbacks.setPlaybackState?.('paused');
  }
  
  setBpm(newBpm) {
      Tone.Transport.bpm.value = newBpm;
      // BPM değiştiğinde döngü süresini ve notaları yeniden hesapla
      this.reschedule();
  }

  // ... Diğer transport fonksiyonları (resume, jumpToBar vb.) ...

  // ============================================
  // === 5. YARDIMCI METODLAR VE TEMİZLİK     ===
  // ============================================

  dispose() {
    this.stop();
    timeManager.dispose();
    this.instruments.forEach(inst => inst.dispose());
    this.mixerStrips.forEach(strip => strip.dispose());
    console.log("🔥 Ses Motoru ve tüm bileşenleri temizlendi.");
  }
}

export default AudioEngine;
