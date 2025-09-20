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
import { MIXER_TRACK_TYPES, PLAYBACK_MODES, PLAYBACK_STATES } from '../../config/constants'; // GÜNCELLENDİ

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
    this.masterStrip = null;
    this.instruments = new Map();
    this.mixerStrips = new Map();
    this.originalAudioBuffers = new Map();
    this.scheduledEventIds = new Map();
    this.isReady = false;
    console.log("🔊 Atomik Ses Motoru v4.0 (Yönlendirme Düzeltildi) Başlatıldı.");
  }

  async fullSync(instrumentData, mixerTrackData, arrangementData) {
    console.log("%c[SYNC BAŞLADI] Ses motoru kuruluyor...", "color: #818cf8; font-weight: bold;");
    
    await this.preloadSamples(instrumentData);

    mixerTrackData.forEach(track => this.createMixerStrip(track));

    const masterTrackData = mixerTrackData.find(t => t.type === MIXER_TRACK_TYPES.MASTER); // GÜNCELLENDİ
    if (masterTrackData) {
      this.masterStrip = this.mixerStrips.get(masterTrackData.id);
      this.masterStrip.outputGain.toDestination();
    } else {
      console.error("KRİTİK HATA: Master kanalı bulunamadı!");
      return;
    }
    
    this.rebuildAllSignalChains(mixerTrackData);

    instrumentData.forEach(instData => this.createInstrument(instData));
    
    this.isReady = true;
    console.log("%c[SYNC TAMAMLANDI] Motor hazır.", "color: #34d399; font-weight: bold;");
  }

  async preloadSamples(instrumentData) {
    const sampleLoadPromises = instrumentData
      .filter(inst => inst.type === 'sample' && inst.url && !this.originalAudioBuffers.has(inst.id))
      .map(inst => 
        new Promise((resolve) => {
          const buffer = new Tone.ToneAudioBuffer(inst.url, 
            () => { this.originalAudioBuffers.set(inst.id, buffer); resolve(); },
            () => { console.error(`Buffer yüklenemedi: ${inst.name}`); resolve(); }
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

  rebuildSignalChain(trackId, trackData) {
      if (!trackData) {
        console.error(`[rebuildSignalChain] ${trackId} için veri bulunamadı.`);
        return;
      }
      const busInputs = this.prepareBusInputs();
      const strip = this.mixerStrips.get(trackId);
      const masterInput = this.masterStrip?.inputGain;
      if(strip && masterInput) {
          strip.buildSignalChain(trackData, masterInput, busInputs);
      }
  }

  rebuildAllSignalChains(mixerTrackData) {
      const busInputs = this.prepareBusInputs();
      const masterInput = this.masterStrip?.inputGain;

      if (!masterInput) {
        console.error("Master girişi bulunamadığı için sinyal zincirleri kurulamadı.");
        return;
      }
      
      // Önce tüm kanalların kendi iç zincirlerini kur
      mixerTrackData.forEach(trackData => {
          const strip = this.mixerStrips.get(trackData.id);
          if (strip) {
              strip.buildSignalChain(trackData, masterInput, busInputs);
          }
      });
      
      // SONRA, kanallar arası bağlantıları (sidechain gibi) kur
      mixerTrackData.forEach(trackData => {
          const strip = this.mixerStrips.get(trackData.id);
          strip.effectNodes.forEach((fxNode, fxId) => {
              const fxData = trackData.insertEffects.find(fx => fx.id === fxId);
              if (fxData?.type === 'SidechainCompressor' && fxData.settings.sidechainSource) {
                  const sourceStrip = this.mixerStrips.get(fxData.settings.sidechainSource);
                  if (sourceStrip && fxNode.sidechainInput) {
                      console.log(`🔗 [SIDECHAIN] Yönlendiriliyor: ${sourceStrip.id} -> ${strip.id}`);
                      // Kaynak kanalın ÇIKIŞINI, hedef efektin sidechain GİRİŞİNE bağla
                      sourceStrip.outputGain.connect(fxNode.sidechainInput);
                  }
              }
          });
      });
  }
  
  prepareBusInputs() {
    const busInputs = new Map();
    this.mixerStrips.forEach(strip => {
      if (strip.type === MIXER_TRACK_TYPES.BUS) { // GÜNCELLENDİ
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

  async requestInstrumentBuffer(instrumentId) {
    const instrumentNode = this.instruments.get(instrumentId);
    if (!instrumentNode) {
      console.error(`❌ [requestInstrumentBuffer] Enstrüman bulunamadı: ${instrumentId}`);
      return null;
    }
    if (instrumentNode.type === 'synth') {
      return null;
    }
  
    if (this.originalAudioBuffers.has(instrumentId)) {
        return this.originalAudioBuffers.get(instrumentId);
    }

    console.warn(`⚠️ [requestInstrumentBuffer] Buffer önbellekte bulunamadı, yeniden bekleniyor: ${instrumentId}`);
    await instrumentNode.readyPromise;
    return instrumentNode.node.buffer;
  }

  reconcileInstrument(instrumentId, updatedInstData) {
    const instrumentNode = this.instruments.get(instrumentId);

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
    Tone.Transport.cancel(0);
    this.scheduledEventIds.clear();
    
    this.patterns = useArrangementStore.getState().patterns;
    this.activePatternId = useArrangementStore.getState().activePatternId;
    this.playbackMode = usePlaybackStore.getState().playbackMode;
    const instruments = useInstrumentsStore.getState().instruments;

    const arrangementData = useArrangementStore.getState();
    timeManager.calculateLoopInfo(this.playbackMode, this.activePatternId, arrangementData);

    const activePattern = this.patterns?.[this.activePatternId];
    if (!activePattern) {
      console.warn('⚠️ [RESCHEDULE] Aktif pattern bulunamadı.');
      return;
    }
    if (this.playbackMode !== PLAYBACK_MODES.PATTERN) { // GÜNCELLENDİ
      console.log('ℹ️ [RESCHEDULE] Song modunda, pattern zamanlaması atlanıyor.');
      return;
    }
    
    let totalScheduledNotes = 0;

    Object.entries(activePattern.data).forEach(([instId, notes]) => {
      const inst = instruments.find(i => i.id === instId);
      if (!inst || inst.isMuted || !notes || notes.length === 0) return;
      
      const node = this.instruments.get(instId);
      if (!node) return;
      
      notes.forEach(note => {
        const step = note.time;
        const timeNotation = `${Math.floor(step / 16)}:${Math.floor((step % 16) / 4)}:${step % 4}`;
        const eventId = Tone.Transport.schedule(time => {
            if (node && typeof node.trigger === 'function') {
              node.trigger(time, note, null, inst.cutItself);
            }
          }, timeNotation);
        this.scheduledEventIds.set(`${instId}-${note.id || note.time}`, eventId);
      });
      totalScheduledNotes += notes.length;
    });
    
    console.log(`%c[RESCHEDULE] Tamamlandı. ${totalScheduledNotes} nota zamanlandı.`, 'color: lightgreen; font-weight: bold;');
  }

  jumpToBar(barNumber) {
    const timeInSeconds = Tone.Time(`${barNumber - 1}:0:0`).toSeconds();
    timeManager.jumpToBar(barNumber);
    
    if (Tone.Transport.state !== PLAYBACK_STATES.PLAYING) { // GÜNCELLENDİ
        const step = timeInSeconds / Tone.Time('16n').toSeconds();
        const positionObject = timeManager._calculateBBTPosition(timeInSeconds);
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
    if (Tone.Transport.state !== PLAYBACK_STATES.PLAYING) { // GÜNCELLENDİ
      const loopEnd = timeManager.loopInfo.lengthInSeconds;
      if (loopEnd > 0) PlaybackAnimatorService.publish(time / loopEnd);
      this.callbacks.setTransportPosition?.(timeManager._calculateBBTPosition(time), step);
    }
  }

  // === YENİ: Döngü aralığını anlık olarak güncelleyen fonksiyon ===
  updateLoopRange(startStep, endStep) {
    if (!this.isReady) return;
    
    const sixteenthNoteDuration = Tone.Time('16n').toSeconds();
    const loopStartSeconds = sixteenthNoteDuration * startStep;
    const loopEndSeconds = sixteenthNoteDuration * endStep;

    Tone.Transport.loopStart = loopStartSeconds;
    Tone.Transport.loopEnd = loopEndSeconds;
    
    console.log(`[AudioEngine] Döngü aralığı güncellendi: ${startStep} -> ${endStep}`);
  }

  start(startStep = 0) {
    if (Tone.context.state !== 'running') Tone.context.resume();
    if (Tone.Transport.state === PLAYBACK_STATES.PLAYING) return;

    this.reschedule();

    // 1. Çalmayı başlatmadan ÖNCE transport'un pozisyonunu ayarla
    const startTimeSeconds = Tone.Time('16n').toSeconds() * startStep;
    Tone.Transport.seconds = startTimeSeconds;

    // 2. Zamanlayıcıyı ve çalmayı başlat
    timeManager.start(this.playbackMode, this.activePatternId, useArrangementStore.getState());
    Tone.Transport.start(); // Tone.js artık ayarlanan yerden başlayacak
    
    this.callbacks.setPlaybackState?.(PLAYBACK_STATES.PLAYING);
    this._startAnimationLoop();
    console.log(`[AudioEngine] Çalma ${startStep}. adımdan başlatıldı.`);
  }
  
  resume() {
    if (Tone.Transport.state === PLAYBACK_STATES.PAUSED) {
      Tone.Transport.start();
      timeManager.resume();
      this.callbacks.setPlaybackState?.(PLAYBACK_STATES.PLAYING);
      this._startAnimationLoop();
    }
  }

  stop() {
    Tone.Transport.stop();
    timeManager.stop();
    this.callbacks.setPlaybackState?.(PLAYBACK_STATES.STOPPED); // GÜNCELLENDİ
    this._stopAnimationLoop();
    PlaybackAnimatorService.publish(0);
  }

  pause() {
    Tone.Transport.pause();
    timeManager.pause();
    this.callbacks.setPlaybackState?.(PLAYBACK_STATES.PAUSED); // GÜNCELLENDİ
    this._stopAnimationLoop();
  }
  
  setBpm(newBpm) {
    Tone.Transport.bpm.value = newBpm;
    this.reschedule();
  }

  auditionNoteOn = (id, pitch, vel) => this.instruments.get(id)?.triggerAttack(pitch, Tone.now(), vel);
  auditionNoteOff = (id, pitch) => this.instruments.get(id)?.triggerRelease(pitch, Tone.now());

  _startAnimationLoop() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    const animate = () => {
      const loopEnd = timeManager.loopInfo.lengthInSeconds;
      if (loopEnd > 0 && Tone.Transport.state === PLAYBACK_STATES.PLAYING) { // GÜNCELLENDİ
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
