import * as Tone from 'tone';
import { timeManager } from './UnifiedTimeManager';
import { InstrumentNode } from './nodes/InstrumentNode.js';
import { MixerStrip } from './nodes/MixerStrip.js';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { cloneBuffer, normalizeBuffer, reverseBuffer, reversePolarity, removeDCOffset } from '../utils/audioUtils';
import { memoize } from 'lodash';

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
  (originalBuffer, instData) => `${originalBuffer.url || 'buffer'}-${JSON.stringify(instData.precomputed)}`
);

class AudioEngine {
  constructor(callbacks) {
    this.callbacks = callbacks || {};
    
    // DEBUG: Master Fader kontrolü
    this.masterFader = new Tone.Volume(0).toDestination();
    console.log("🎛️ [AUDIO ENGINE] Master Fader oluşturuldu ve Destination'a bağlandı", {
      volume: this.masterFader.volume.value,
      connected: this.masterFader.numberOfOutputs > 0
    });
    
    this.instruments = new Map();
    this.mixerStrips = new Map();
    this.scheduledEventIds = new Map();
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

  async syncFromStores(instrumentData, mixerTrackData, arrangementData) {
    console.log("%c[SYNC] Proje verileri ses motoruna yükleniyor...", "color: #818cf8; font-weight: bold;");
    
    // DEBUG: Gelen verileri kontrol et
    console.log("📊 [SYNC DEBUG] Gelen veriler:", {
      instrumentCount: instrumentData.length,
      mixerTrackCount: mixerTrackData.length,
      patternCount: Object.keys(arrangementData.patterns).length,
      instruments: instrumentData.map(i => ({ id: i.id, name: i.name, mixerTrackId: i.mixerTrackId })),
      mixerTracks: mixerTrackData.map(t => ({ id: t.id, name: t.name, type: t.type }))
    });
    
    this.patterns = arrangementData.patterns;
    this.activePatternId = arrangementData.activePatternId;
    this.playbackMode = usePlaybackStore.getState().playbackMode;

    // 1. Tüm mikser kanallarını oluştur
    console.log("🎚️ [SYNC] Mikser kanalları oluşturuluyor...");
    for (const trackData of mixerTrackData) {
      this.createMixerStrip(trackData);
    }

    // 2. Tüm mikser kanallarının ses zincirini kur
    console.log("🔗 [SYNC] Mikser ses zincirleri kuruluyor...");
    await this._buildAllSignalChains(mixerTrackData);

    // 3. Tüm enstrümanları oluştur ve miksere bağla
    console.log("🎹 [SYNC] Enstrümanlar oluşturuluyor...");
    for (const instData of instrumentData) {
      await this.createInstrument(instData);
    }
    
    // DEBUG: Final durumu kontrol et
    console.log("🔍 [SYNC DEBUG] Final durum:", {
      instrumentsCreated: this.instruments.size,
      mixerStripsCreated: this.mixerStrips.size,
      masterFaderVolume: this.masterFader.volume.value
    });
    
    // 4. Notaları zaman çizelgesine yerleştir
    this.reschedule();
    console.log("%c[SYNC] Yükleme tamamlandı. Motor hazır.", "color: #34d399; font-weight: bold;");
  }

  createMixerStrip(trackData) {
    if (this.mixerStrips.has(trackData.id)) {
      console.log(`⚠️ [MIXER] Kanal zaten var, atlanıyor: ${trackData.id}`);
      return;
    }
    
    const strip = new MixerStrip(trackData);
    this.mixerStrips.set(trackData.id, strip);
    console.log(`✅ [AUDIO] Mixer kanalı oluşturuldu: ${trackData.name} (${trackData.id})`, {
      hasInputGain: !!strip.inputGain,
      hasOutputGain: !!strip.outputGain
    });
  }

  async createInstrument(instData) {
    if (this.instruments.has(instData.id)) {
      console.log(`⚠️ [INSTRUMENT] Enstrüman zaten var, atlanıyor: ${instData.id}`);
      return;
    }
    
    console.log(`🎵 [INSTRUMENT] Oluşturuluyor: ${instData.name} (${instData.id})`);
    
    const instrumentNode = new InstrumentNode(instData);
    this.instruments.set(instData.id, instrumentNode);
    
    // Yükleme tamamlanmasını bekle
    try {
      await instrumentNode.readyPromise;
      console.log(`✅ [INSTRUMENT] Yüklendi: ${instData.name}`);
      
      // Buffer'ı sakla
      if (instrumentNode.sampler.loaded) {
        this.originalAudioBuffers.set(instData.id, instrumentNode.sampler.buffer);
      }
      
      // Mixer'a bağla
      this.connectInstrumentToMixer(instData.id, instData.mixerTrackId);
      
    } catch (error) {
      console.error(`❌ [INSTRUMENT] Yükleme hatası: ${instData.name}`, error);
    }
  }
  
  connectInstrumentToMixer(instrumentId, mixerTrackId) {
    const instrumentNode = this.instruments.get(instrumentId);
    const targetStrip = this.mixerStrips.get(mixerTrackId);

    if (!instrumentNode) {
      console.error(`❌ [ROUTING] Enstrüman bulunamadı: ${instrumentId}`);
      return;
    }
    
    if (!targetStrip) {
      console.error(`❌ [ROUTING] Mixer kanalı bulunamadı: ${mixerTrackId}`);
      return;
    }

    try {
      instrumentNode.output.disconnect();
      instrumentNode.output.connect(targetStrip.inputGain);
      console.log(`🔗 [AUDIO] Bağlantı yapıldı: ${instrumentNode.id} -> ${targetStrip.id}`, {
        instrumentOutput: instrumentNode.output,
        stripInput: targetStrip.inputGain
      });
    } catch (error) {
      console.error(`❌ [ROUTING] Bağlantı hatası:`, error);
    }
  }

  _buildAllSignalChains(mixerTrackData) {
    const busInputs = new Map();
    
    // DEBUG: Bus inputs toplama
    console.log("🚌 [ROUTING] Bus inputları toplanıyor...");
    mixerTrackData.forEach(track => {
      if (track.type === 'bus') {
        const strip = this.mixerStrips.get(track.id);
        if (strip?.inputGain) {
          busInputs.set(track.id, strip.inputGain);
          console.log(`✅ [ROUTING] Bus input eklendi: ${track.id}`);
        }
      }
    });

    // DEBUG: Her kanal için signal chain kurulumu
    console.log("⛓️ [ROUTING] Signal chain'ler kuruluyor...");
    for (const trackData of mixerTrackData) {
      const strip = this.mixerStrips.get(trackData.id);
      if (strip) {
        console.log(`🔧 [ROUTING] Signal chain kuruluyor: ${trackData.id} (${trackData.type})`);
        strip.buildSignalChain(trackData, this.masterFader, busInputs);
      }
    }
  }

  async requestInstrumentBuffer(instrumentId) {
    const node = this.instruments.get(instrumentId);
    if (!node) {
      console.error(`❌ [requestInstrumentBuffer] Enstrüman bulunamadı: ${instrumentId}`);
      return null;
    }

    await node.readyPromise;
    return node.sampler.buffer;
  }

  reconcileInstrument(instrumentId, updatedInstData) {
    console.log(`🔄 [RECONCILE] ${instrumentId} için buffer yeniden işleniyor...`, updatedInstData.precomputed);
    const originalBuffer = this.originalAudioBuffers.get(instrumentId);
    const instrumentNode = this.instruments.get(instrumentId);

    if (!originalBuffer || !instrumentNode) {
      console.error(`❌ [RECONCILE] Hata: Orijinal buffer veya enstrüman bulunamadı: ${instrumentId}`);
      return null;
    }

    const newProcessedBuffer = memoizedProcessBuffer(originalBuffer, updatedInstData);
    instrumentNode.sampler.buffer = newProcessedBuffer;
    console.log(`✅ [RECONCILE] ${instrumentId} için buffer güncellendi.`);
    
    return newProcessedBuffer;
  }

  updateMixerParam = (trackId, param, value) => {
    const strip = this.mixerStrips.get(trackId);
    if (strip) {
      console.log(`🎛️ [MIXER] Parametre güncelleniyor: ${trackId}.${param} = ${value}`);
      strip.updateParam(param, value);
    }
  }

  updateEffectParam = (trackId, effectId, param, value) => {
    this.mixerStrips.get(trackId)?.updateEffectParam(effectId, param, value);
  }

  toggleMute = (trackId, isMuted) => {
    this.mixerStrips.get(trackId)?.setMute(isMuted);
  }

  reschedule() {
    console.log('%c[RESCHEDULE] Notalar yeniden zamanlanıyor...', 'color: orange; font-weight: bold;');
    
    // Önceki zamanlamaları temizle
    Tone.Transport.cancel(0);
    this.scheduledEventIds.clear();
    
    // Store'lardan güncel veriyi al
    this.patterns = useArrangementStore.getState().patterns;
    this.activePatternId = useArrangementStore.getState().activePatternId;
    this.playbackMode = usePlaybackStore.getState().playbackMode;
    const instruments = useInstrumentsStore.getState().instruments;

    console.log(`[RESCHEDULE] Mod: ${this.playbackMode}, Aktif Pattern ID: ${this.activePatternId}`);
    
    // DEBUG: Enstrüman durumu
    console.log("🎹 [RESCHEDULE DEBUG] Enstrüman durumu:", {
      storeInstruments: instruments.length,
      engineInstruments: this.instruments.size,
      instrumentIds: Array.from(this.instruments.keys())
    });

    // Time manager güncelleme
    const arrangementData = useArrangementStore.getState();
    timeManager.calculateLoopInfo(this.playbackMode, this.activePatternId, arrangementData);

    // Pattern kontrolü
    const activePattern = this.patterns?.[this.activePatternId];
    if (!activePattern) {
      console.warn('⚠️ [RESCHEDULE] Aktif pattern bulunamadı.');
      return;
    }
    if (this.playbackMode !== 'pattern') {
      console.log('ℹ️ [RESCHEDULE] Song modunda, pattern zamanlaması atlanıyor.');
      return;
    }
    
    console.log(`✅ [RESCHEDULE] Aktif Pattern: "${activePattern.name}"`);
    let totalScheduledNotes = 0;

    // Notaları zamanla
    Object.entries(activePattern.data).forEach(([instId, notes]) => {
      const inst = instruments.find(i => i.id === instId);
      if (!inst || inst.isMuted || !notes || notes.length === 0) {
        return;
      }
      
      const node = this.instruments.get(instId);
      if (!node) {
        console.warn(`⚠️ [RESCHEDULE] Enstrüman düğümü bulunamadı: ${instId}`);
        return;
      }
      
      // DEBUG: Node durumunu kontrol et
      console.log(`🎵 [RESCHEDULE] ${inst.name}: ${notes.length} nota zamanlanıyor`, {
        nodeReady: node.isReady,
        samplerLoaded: node.sampler?.loaded
      });
      
      let scheduledCountForInst = 0;

      notes.forEach(note => {
        const step = note.time;
        const timeNotation = `${Math.floor(step / 16)}:${Math.floor((step % 16) / 4)}:${step % 4}`;
        
        try {
          const eventId = Tone.Transport.schedule(time => {
            if (node && typeof node.trigger === 'function') {
              console.log(`🎶 [TRIGGER] ${inst.name} çalıyor: ${timeNotation}`);
              node.trigger(time, note, null, inst.cutItself);
            }
          }, timeNotation);
          this.scheduledEventIds.set(`${instId}-${note.id || note.time}`, eventId);
          scheduledCountForInst++;
        } catch (e) {
          console.error(`❌ [RESCHEDULE] Nota zamanlanamadı: ${inst.name}`, e);
        }
      });
      totalScheduledNotes += scheduledCountForInst;
    });
    
    console.log(`%c[RESCHEDULE] Tamamlandı. ${totalScheduledNotes} nota zamanlandı.`, 'color: lightgreen; font-weight: bold;');
  }

  start() {
    console.log("▶️ [TRANSPORT] Start komutu alındı");
    
    // AudioContext durumunu kontrol et
    if (Tone.context.state !== 'running') {
      console.log("🔊 [TRANSPORT] AudioContext başlatılıyor...");
      Tone.context.resume();
    }
    
    // Transport durumunu kontrol et
    console.log(`📊 [TRANSPORT DEBUG]`, {
      contextState: Tone.context.state,
      transportState: Tone.Transport.state,
      bpm: Tone.Transport.bpm.value,
      masterVolume: this.masterFader.volume.value
    });
    
    this.reschedule();
    timeManager.start(this.playbackMode, this.activePatternId, useArrangementStore.getState());
    Tone.Transport.start();
    this.callbacks.setPlaybackState?.('playing');
    
    console.log("✅ [TRANSPORT] Playback başladı");
  }

  stop() {
    console.log("⏹️ [TRANSPORT] Stop komutu alındı");
    Tone.Transport.stop();
    timeManager.stop();
    this.callbacks.setPlaybackState?.('stopped');
  }

  pause() {
    console.log("⏸️ [TRANSPORT] Pause komutu alındı");
    Tone.Transport.pause();
    timeManager.pause();
    this.callbacks.setPlaybackState?.('paused');
  }
  
  setBpm(newBpm) {
    console.log(`🎵 [BPM] Yeni BPM: ${newBpm}`);
    Tone.Transport.bpm.value = newBpm;
    this.reschedule();
  }

  dispose() {
    this.stop();
    timeManager.dispose();
    this.instruments.forEach(inst => inst.dispose());
    this.mixerStrips.forEach(strip => strip.dispose());
    console.log("🔥 Ses Motoru ve tüm bileşenleri temizlendi.");
  }
}

export default AudioEngine;