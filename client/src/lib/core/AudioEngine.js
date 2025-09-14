import * as Tone from 'tone';
// YENİ: timeManager'ı import ediyoruz
import { timeManager } from './UnifiedTimeManager';
import { calculateAudioLoopLength, calculatePatternLoopLength } from '../utils/patternUtils.js';
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
    
    // YENİ: TimeManager'ı kuruyoruz
    this.setupTimeManager();
    
    console.log("[AUDIO ENGINE] Entegre Zaman Yöneticili Motor v4.0 Başlatıldı.");
  }

  // YENİ: TimeManager ile AudioEngine arasındaki bağlantıyı kuran metot
  setupTimeManager() {
    timeManager.onPositionUpdate = (position) => {
      this.callbacks.setTransportPosition?.(position.formatted);
    };
    timeManager.onProgressUpdate = (progress) => {
      // Bu callback doğrudan PlaybackAnimatorService tarafından kullanıldığı için
      // bir değişiklik yapmaya gerek yok, sadece bağlantıyı kuruyoruz.
    };
  }

  // KALDIRILDI: Eski _animationLoop metodu artık timeManager tarafından yönetiliyor.

  auditionNoteOn(instrumentId, pitch, velocity = 1) {
    const instrumentNode = this.instruments.get(instrumentId);
    instrumentNode?.triggerAttack(pitch, Tone.now(), velocity);
  }

  auditionNoteOff(instrumentId, pitch) {
    const instrumentNode = this.instruments.get(instrumentId);
    instrumentNode?.triggerRelease(pitch, Tone.now());
  }
  
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
    const { instrumentData, mixerTrackData, arrangementData, onComplete } = this.syncQueue.shift();

    try {
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
    this.instrumentData = instrumentData;
    this.mixerTrackData = mixerTrackData;
    if (arrangementData) {
        this.clips = arrangementData.clips || [];
        this.patterns = arrangementData.patterns || {};
        this.arrangementTracks = arrangementData.tracks || [];
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
    const newProcessedBuffer = this.processBuffer(originalBuffer, updatedInstData);
    this.processedAudioBuffers.set(instrumentId, newProcessedBuffer);
    this.instruments.get(instrumentId)?.updateBuffer(newProcessedBuffer);
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

  // GÜNCELLENDİ: Artık TimeManager'ı başlatıyor
  start(playbackMode = 'pattern', activePatternId = null) {
    if (Tone.context.state !== 'running') Tone.context.resume();
    if (Tone.Transport.state === 'started') return;

    this.playbackMode = playbackMode;
    this.activePatternId = activePatternId;
    this.reschedule();
    
    const arrangementData = { patterns: this.patterns, clips: this.clips, tracks: this.arrangementTracks };
    timeManager.start(playbackMode, activePatternId, arrangementData);
    
    Tone.Transport.start();
    this.callbacks.setPlaybackState?.('playing');
  }

  // GÜNCELLENDİ: Artık TimeManager'ı duraklatıyor
  pause() {
    Tone.Transport.pause(); 
    timeManager.pause();
    this.callbacks.setPlaybackState?.('paused');
  }

  // YENİ: Pause'dan devam etmek için
  resume() {
      if (Tone.Transport.state === 'paused') {
          Tone.Transport.start();
          timeManager.resume();
          this.callbacks.setPlaybackState?.('playing');
      }
  }

  // GÜNCELLENDİ: Artık TimeManager'ı durduruyor
  stop() {
    Tone.Transport.stop(); 
    timeManager.stop();
    this.callbacks.setPlaybackState?.('stopped');
  }

  reschedule() {
      // Bu metodun iç mantığı aynı kalıyor...
      this.clearAllScheduledNotes();
      if (this.playbackMode === 'song') {
          const trackToInstrumentMap = new Map();
          this.arrangementTracks.forEach(track => track.instrumentId && trackToInstrumentMap.set(track.id, track.instrumentId));
          this.clips.forEach(clip => {
              const pattern = this.patterns?.[clip.patternId];
              if (!pattern) return;
              const clipStartInSteps = clip.startTime * 16;
              const clipDurationInSteps = clip.duration * 16;
              Object.entries(pattern.data).forEach(([instId, notes]) => {
                  if (clip.trackId && trackToInstrumentMap.get(clip.trackId) !== instId) return;
                  const inst = this.instrumentData.find(i => i.id === instId);
                  if (!inst || inst.isMuted) return;
                  const node = this.instruments.get(instId);
                  const buffer = this.processedAudioBuffers.get(instId);
                  if (!node || !buffer || !notes) return;
                  notes.forEach(note => {
                      if (note.time >= clipDurationInSteps) return;
                      const time = Tone.Time('16n').toSeconds() * (clipStartInSteps + note.time);
                      const id = Tone.Transport.schedule(t => node.trigger(t, note, buffer.duration, inst.cutItself), time);
                      this.scheduledEventIds.set(`${clip.id}-${instId}-${note.id || note.time}`, id);
                  });
              });
          });
      } else {
          const activePattern = this.patterns?.[this.activePatternId];
          if (!activePattern) return;
          Object.entries(activePattern.data).forEach(([instId, notes]) => {
              const inst = this.instrumentData.find(i => i.id === instId);
              if (!inst || inst.isMuted || !notes) return;
              const node = this.instruments.get(instId);
              const buffer = this.processedAudioBuffers.get(instId);
              if (!node || !buffer) return;
              notes.forEach(note => {
                  const time = Tone.Time('16n').toSeconds() * note.time;
                  const id = Tone.Transport.schedule(t => node.trigger(t, note, buffer.duration, inst.cutItself), time);
                  this.scheduledEventIds.set(`p-${this.activePatternId}-${instId}-${note.id}`, id);
              });
          });
      }
  }

  clearAllScheduledNotes() {
    this.scheduledEventIds.forEach(id => Tone.Transport.clear(id));
    this.scheduledEventIds.clear();
  }

  setBpm(newBpm) { Tone.Transport.bpm.value = newBpm; }
  setMasterVolume(levelInDb) { this.masterFader.volume.value = levelInDb; }

  // YENİ: Çalma sırasında güvenli mod değiştirme
  switchPlaybackMode(newMode, activePatternId = null) {
      const wasPlaying = Tone.Transport.state === 'started';
      if (wasPlaying) {
          Tone.Transport.pause();
      }
      this.playbackMode = newMode;
      this.activePatternId = activePatternId;
      const arrangementData = { patterns: this.patterns, clips: this.clips, tracks: this.arrangementTracks };
      timeManager.switchMode(newMode, activePatternId, arrangementData);
      this.reschedule();
      if (wasPlaying) {
          Tone.Transport.start();
          timeManager.resume();
      }
  }

  // YENİ: Timeline'da gezinme
  jumpToBar(barNumber) {
      timeManager.jumpToBar(barNumber);
  }

  jumpToPercent(percent) {
      timeManager.jumpToPercent(percent);
  }

  dispose() {
    this.stop();
    timeManager.dispose(); // TimeManager'ı da temizle
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
    console.log("[AUDIO ENGINE] Tüm kaynaklar güvenli şekilde temizlendi.");
  }
}

export default AudioEngine;