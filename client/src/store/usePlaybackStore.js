import { create } from 'zustand';
import { useArrangementStore } from './useArrangementStore';
import { calculateAudioLoopLength, calculateUIRackLength, calculatePatternLoopLength } from '../lib/utils/patternUtils';
import { initialInstruments } from '../config/initialData';
import { AudioContextService } from '../lib/services/AudioContextService';
import { PLAYBACK_MODES, PLAYBACK_STATES } from '../config/constants';

const initialPatternData = initialInstruments.reduce((acc, inst) => {
  acc[inst.id] = inst.notes;
  return acc;
}, {});

const initialActivePattern = { id: 'pattern-1', name: 'Pattern 1', data: initialPatternData };

const initialAudioLoopLength = calculatePatternLoopLength(initialActivePattern);
const initialUiRackLength = calculateUIRackLength(initialAudioLoopLength);

export const usePlaybackStore = create((set, get) => ({
  playbackState: PLAYBACK_STATES.STOPPED, // GÜNCELLENDİ
  bpm: 60,
  masterVolume: 0,
  transportPosition: '1:1:00',
  playbackMode: PLAYBACK_MODES.PATTERN, // GÜNCELLENDİ
  loopLength: initialUiRackLength,
  audioLoopLength: initialAudioLoopLength,

  loopStartStep: 0,
  loopEndStep: initialAudioLoopLength, // Başlangıçta tüm pattern'ı kapsasın

  updateLoopLength: () => {
    const { playbackMode } = get();
    const { clips, patterns, activePatternId } = useArrangementStore.getState();

    // === HATA DÜZELTMESİ: Eksik parametreler eklendi ===
    const newAudioLoopLength = calculateAudioLoopLength(playbackMode, {
      patterns,
      activePatternId,
      clips,
    });
    
    const newUiRackLength = calculateUIRackLength(newAudioLoopLength);
    set({
      audioLoopLength: newAudioLoopLength,
      loopLength: newUiRackLength,
      loopStartStep: 0, // Aktif pattern değiştiğinde döngüyü başa al
      loopEndStep: newAudioLoopLength,
    });
    
    // Yeni toplam uzunluğu ses motoruna bildir
    AudioContextService.updateLoopRange(0, newAudioLoopLength);
    console.log(`[PlaybackStore] Döngü uzunlukları güncellendi: Audio(${newAudioLoopLength}), UI(${newUiRackLength})`);
  },

  // === YENİ: Döngü aralığını güncelleyen ve ses motorunu bilgilendiren aksiyon ===
  setLoopRange: (startStep, endStep) => {
    set({ loopStartStep: startStep, loopEndStep: endStep });
    AudioContextService.updateLoopRange(startStep, endStep);
  },
  
  setPlaybackState: (state) => set({ playbackState: state }),
  
  setTransportPosition: (position, step) => {
    let positionString = position;
    if (typeof position === 'object' && position !== null && position.hasOwnProperty('formatted')) {
      positionString = position.formatted;
    } else if (typeof position === 'object') {
      console.warn("setTransportPosition beklenmedik bir obje aldı:", position);
      positionString = 'HATA'; 
    }
    set({
      transportPosition: positionString,
      transportStep: step
    });
  },

  setPlaybackMode: (mode) => {
      const currentState = get();
      if (currentState.playbackMode === mode) return;

      set({ playbackMode: mode });
      get().updateLoopLength();
      
      const isPlaying = currentState.playbackState === PLAYBACK_STATES.PLAYING || currentState.playbackState === PLAYBACK_STATES.PAUSED; // GÜNCELLENDİ
      if (AudioContextService && isPlaying) {
        AudioContextService.reschedule();
      }
    },

  handleBpmChange: (newBpm) => {
    const clampedBpm = Math.max(40, Math.min(300, newBpm));
    set({ bpm: clampedBpm });
    AudioContextService?.setBpm(clampedBpm);
  },

  handleMasterVolumeChange: (newVolume) => {
    set({ masterVolume: newVolume });
    AudioContextService?.setMasterVolume(newVolume);
  },

  handlePlay: () => {
    if (!AudioContextService) return;
    
    // === GÜNCELLEME: Döngü başlangıç adımını alıyoruz ===
    const { playbackState, loopStartStep } = get();

    // Sadece durdurulmuş durumdayken baştan başlatma işlemini yap
    if (playbackState === PLAYBACK_STATES.STOPPED) {
        AudioContextService.start(loopStartStep);
    } else {
        // Duraklatılmışsa, sadece devam et
        AudioContextService.resume();
    }
  },

  handlePause: () => {
    // Bu fonksiyon artık sadece duraklatma işini yapıyor
    AudioContextService?.pause();
  },

  handleStop: () => {
    AudioContextService?.stop();
  },

  jumpToBar: (barNumber) => {
    AudioContextService?.jumpToBar(barNumber);
  },

  jumpToStep: (step) => {
    AudioContextService?.jumpToStep(step);
  },
}));
