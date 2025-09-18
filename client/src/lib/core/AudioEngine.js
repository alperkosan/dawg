import * as Tone from 'tone';
import { timeManager } from './UnifiedTimeManager';
import { InstrumentNode } from './nodes/InstrumentNode.js';
import { MixerStrip } from './nodes/MixerStrip.js';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { PlaybackAnimatorService } from './PlaybackAnimatorService';

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
    this.masterFader = new Tone.Volume(0).toDestination();
    this.instruments = new Map();
    this.mixerStrips = new Map();
    this.originalAudioBuffers = new Map(); // Yüklenen ham buffer'lar için önbellek
    this.scheduledEventIds = new Map(); 
    this.isReady = false;
    this.killSwitch = new Tone.Gain(1).toDestination();

    console.log("🔊 Atomik Ses Motoru v3.0 Başlatıldı.");
  }

  // Projenin tüm verilerini alıp ses motorunu kuran ana fonksiyon.
  async fullSync(instrumentData, mixerTrackData, arrangementData) {
    console.log("%c[SYNC BAŞLADI] Ses motoru kuruluyor...", "color: #818cf8; font-weight: bold;");
    
    await this.preloadSamples(instrumentData);

    mixerTrackData.forEach(track => this.createMixerStrip(track));
    
    this.rebuildAllSignalChains(mixerTrackData);

    instrumentData.forEach(instData => this.createInstrument(instData));
    
    this.isReady = true;
    console.log("%c[SYNC TAMAMLANDI] Motor hazır.", "color: #34d399; font-weight: bold;");
  }

  // Gerekli tüm ses dosyalarını önceden yükler.
  async preloadSamples(instrumentData) {
    const sampleLoadPromises = instrumentData
      .filter(inst => inst.type === 'sample' && inst.url && !this.originalAudioBuffers.has(inst.id))
      .map(inst => 
        new Promise((resolve) => {
          const buffer = new Tone.ToneAudioBuffer(inst.url, 
            () => {
              this.originalAudioBuffers.set(inst.id, buffer);
              resolve();
            },
            () => {
              console.error(`Buffer yüklenemedi: ${inst.name}`);
              resolve(); // Hata durumunda bile devam et
            }
          );
        })
      );
    await Promise.allSettled(sampleLoadPromises);
  }

  createMixerStrip(trackData) {
    if (this.mixerStrips.has(trackData.id)) this.mixerStrips.get(trackData.id).dispose();
    const strip = new MixerStrip(trackData);
    this.mixerStrips.set(trackData.id, strip);
  }

  // YENİ: Tek bir kanalın veya tüm kanalların sinyal zincirini yeniden kurar.
  rebuildSignalChain(trackId, trackData) {
      if (!trackData) {
        console.error(`[rebuildSignalChain] ${trackId} için veri bulunamadı.`);
        return;
      }
      const busInputs = this.prepareBusInputs();
      const strip = this.mixerStrips.get(trackId);
      if(strip) {
          strip.buildSignalChain(trackData, this.masterFader, busInputs);
      }
  }

  rebuildAllSignalChains(mixerTrackData) {
      const busInputs = this.prepareBusInputs();
      mixerTrackData.forEach(trackData => {
          const strip = this.mixerStrips.get(trackData.id);
          if (strip) {
              strip.buildSignalChain(trackData, this.masterFader, busInputs);
          }
      });
  }
  
  // Bus kanallarının girişlerini bir haritada toplar, yönlendirme için kullanılır.
  prepareBusInputs() {
    const busInputs = new Map();
    this.mixerStrips.forEach(strip => {
      if (strip.type === 'bus') {
        busInputs.set(strip.id, strip.inputGain);
      }
    });
    return busInputs;
  }

  createInstrument(instData) {
    if (this.instruments.has(instData.id)) this.instruments.get(instData.id).dispose();
    const preloadedBuffer = this.originalAudioBuffers.get(instData.id);
    const instrumentNode = new InstrumentNode(instData, preloadedBuffer);
    this.instruments.set(instData.id, instrumentNode);
    this.connectInstrumentToMixer(instData.id, instData.mixerTrackId);
  }
  
  connectInstrumentToMixer(instrumentId, mixerTrackId) {
    const instrumentNode = this.instruments.get(instrumentId);
    const targetStrip = this.mixerStrips.get(mixerTrackId);
    if (instrumentNode && targetStrip) {
      instrumentNode.output.disconnect();
      instrumentNode.output.connect(targetStrip.inputGain);
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
    const instrumentNode = this.instruments.get(instrumentId);
    if (!instrumentNode) {
      console.error(`❌ [requestInstrumentBuffer] Enstrüman bulunamadı: ${instrumentId}`);
      return null;
    }
    if (instrumentNode.type === 'synth') {
      return null; // Synth'lerin buffer'ı olmaz.
    }
  
    // --- YENİ MANTIK ---
    // İnternetten tekrar istemek yerine, doğrudan motorun kasasından veriyi al.
    // Bu, işlemi anlık yapar ve ağ hatalarını ortadan kaldırır.
    if (this.originalAudioBuffers.has(instrumentId)) {
        return this.originalAudioBuffers.get(instrumentId);
    }

    // Eğer bir şekilde buffer kasada yoksa (bu bir hata durumudur),
    // son bir deneme olarak yüklemeyi bekle.
    console.warn(`⚠️ [requestInstrumentBuffer] Buffer önbellekte bulunamadı, yeniden bekleniyor: ${instrumentId}`);
    await instrumentNode.readyPromise;
    return instrumentNode.node.buffer;
  }

  reconcileInstrument(instrumentId, updatedInstData) {
    const instrumentNode = this.instruments.get(instrumentId);

    // Sadece sample tabanlı enstrümanlar için çalıştır
    if (instrumentNode?.type !== 'sample') {
        console.warn(`[RECONCILE] ${instrumentId} bir sample olmadığı için işlem atlandı.`);
        return null;
    }
  
    console.log(`🔄 [RECONCILE] ${instrumentId} için buffer yeniden işleniyor...`, updatedInstData.precomputed);
    const originalBuffer = this.originalAudioBuffers.get(instrumentId);

    if (!originalBuffer) {
      console.error(`❌ [RECONCILE] Hata: Orijinal buffer bulunamadı: ${instrumentId}`);
      return null;
    }

    const newProcessedBuffer = memoizedProcessBuffer(originalBuffer, updatedInstData);
    instrumentNode.node.buffer = newProcessedBuffer;
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

  updateInstrumentParameters(instrumentId, updatedInstrumentData) {
    const node = this.instruments.get(instrumentId);
    if (node) {
      node.updateParameters(updatedInstrumentData);
    } else {
      console.warn(`[ENGINE] Parametre güncellemesi için enstrüman bulunamadı: ${instrumentId}`);
    }
  }

  setMuteState = (trackId, isMuted) => this.mixerStrips.get(trackId)?.setMute(isMuted);

  setSoloState = (soloedChannels) => {
    const isAnySoloActive = soloedChannels.size > 0;
    this.mixerStrips.forEach(strip => {
      strip.setSolo(soloedChannels.has(strip.id), isAnySoloActive);
    });
  }

  setInstrumentMute(instrumentId, isMuted) {
    const instrument = useInstrumentsStore.getState().instruments.find(inst => inst.id === instrumentId);
    if (instrument?.mixerTrackId) {
      this.mixerStrips.get(instrument.mixerTrackId)?.setMute(isMuted);
    }
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

  /* === YENİ FONKSİYON ===
   * Belirtilen bar numarasına atlama komutunu TimeManager'a iletir.
   * @param {number} barNumber - Hedef bar numarası.
   */
  jumpToBar(barNumber) {
    const timeInSeconds = Tone.Time(`${barNumber - 1}:0:0`).toSeconds();
    timeManager.jumpToBar(barNumber); // Bu, Tone.Transport.seconds'ı ayarlar.
    
    // Eğer çalma durdurulmuşsa, arayüzü manuel olarak güncellemek zorundayız.
    if (Tone.Transport.state !== 'started') {
        const step = timeInSeconds / Tone.Time('16n').toSeconds();
        const positionObject = timeManager._calculateBBTPosition(timeInSeconds);
        // Doğrudan formatlanmış metni ve step'i gönderiyoruz.
        this.callbacks.setTransportPosition?.(positionObject.formatted, step); 
        
        const loopEnd = timeManager.loopInfo.lengthInSeconds;
        if (loopEnd > 0) {
            PlaybackAnimatorService.publish(timeInSeconds / loopEnd);
        }
    }
  }

  jumpToStep(step) {
    const time = Tone.Time('16n').toSeconds() * step;
    Tone.Transport.seconds = time;
    if (Tone.Transport.state !== 'started') {
      const loopEnd = timeManager.loopInfo.lengthInSeconds;
      if (loopEnd > 0) PlaybackAnimatorService.publish(time / loopEnd);
      this.callbacks.setTransportPosition?.(timeManager._calculateBBTPosition(time), step);
    }
  }

  start() {
    if (Tone.context.state !== 'running') Tone.context.resume();
    if (Tone.Transport.state === 'started') return;
    // YENİ: Çalmaya başlamadan önce "Kill Switch"i aç.
    this.killSwitch.gain.cancelScheduledValues(Tone.now());
    this.killSwitch.gain.rampTo(1, 0.01); // 10ms'de sesi aç

    this.reschedule();
    timeManager.start(this.playbackMode, this.activePatternId, useArrangementStore.getState());
    Tone.Transport.start();
    this.callbacks.setPlaybackState?.('playing');
    this._startAnimationLoop();
  }
  
  resume() {
    if (Tone.Transport.state === 'paused') {
      this.killSwitch.gain.cancelScheduledValues(Tone.now());
      this.killSwitch.gain.rampTo(1, 0.01);

      Tone.Transport.start();
      timeManager.resume();
      this.callbacks.setPlaybackState?.('playing');
      this._startAnimationLoop();
    }
  }

  stop() {
    Tone.Transport.stop();
    timeManager.stop();
    this.callbacks.setPlaybackState?.('stopped');
    this._stopAnimationLoop();
    PlaybackAnimatorService.publish(0);

    // --- YENİ: ANINDA SUSTURMA (PANİK BUTONU) ---
    // releaseAll yerine, tüm seslerin geçtiği ana vanayı kapatıyoruz.
    // 50ms'lik çok kısa bir fade out, "klik" seslerini engeller.
    this.killSwitch.gain.cancelScheduledValues(Tone.now());
    this.killSwitch.gain.rampTo(0, 0.05);
  }

  pause() {
    Tone.Transport.pause();
    timeManager.pause();
    this.callbacks.setPlaybackState?.('paused');
    this._stopAnimationLoop();
  }
  
  setBpm(newBpm) {
    console.log(`🎵 [BPM] Yeni BPM: ${newBpm}`);
    Tone.Transport.bpm.value = newBpm;
    this.reschedule();
  }

  auditionNoteOn = (id, pitch, vel) => this.instruments.get(id)?.triggerAttack(pitch, Tone.now(), vel);
  auditionNoteOff = (id, pitch) => this.instruments.get(id)?.triggerRelease(pitch, Tone.now());


  _startAnimationLoop() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    const animate = () => {
      const loopEnd = timeManager.loopInfo.lengthInSeconds;
      if (loopEnd > 0 && Tone.Transport.state === 'started') {
        PlaybackAnimatorService.publish(Tone.Transport.seconds / loopEnd);
      }
      this.animationFrameId = requestAnimationFrame(animate);
    };
    this.animationFrameId = requestAnimationFrame(animate);
  }

  _stopAnimationLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
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