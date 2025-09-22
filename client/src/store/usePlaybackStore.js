// src/store/usePlaybackStore.js - Play Tuşu Düzeltmesi

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
  playbackState: PLAYBACK_STATES.STOPPED,
  bpm: 60,
  masterVolume: 0,
  transportPosition: '1:1:00',
  playbackMode: PLAYBACK_MODES.PATTERN,
  loopLength: initialUiRackLength,
  audioLoopLength: initialAudioLoopLength,
  loopStartStep: 0,
  loopEndStep: initialAudioLoopLength,

  updateLoopLength: () => {
    // ... (bu fonksiyon aynı kalıyor) ...
    const { playbackMode } = get();
    const { clips, patterns, activePatternId } = useArrangementStore.getState();
    const newAudioLoopLength = calculateAudioLoopLength(playbackMode, {
      patterns,
      activePatternId,
      clips,
    });
    const newUiRackLength = calculateUIRackLength(newAudioLoopLength);
    set({
      audioLoopLength: newAudioLoopLength,
      loopLength: newUiRackLength,
      loopStartStep: 0,
      loopEndStep: newAudioLoopLength,
    });
    AudioContextService.updateLoopRange(0, newAudioLoopLength);
  },

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
      positionString = 'HATA'; 
    }
    set({
      transportPosition: positionString,
      transportStep: step
    });
  },

  setPlaybackMode: (mode) => {
    // ... (bu fonksiyon aynı kalıyor) ...
    const currentState = get();
    if (currentState.playbackMode === mode) return;
    set({ playbackMode: mode });
    get().updateLoopLength();
    const isPlaying = currentState.playbackState === PLAYBACK_STATES.PLAYING || currentState.playbackState === PLAYBACK_STATES.PAUSED;
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

  // --- DÜZELTME BURADA ---
  handlePlay: () => {
    if (!AudioContextService) return;
    const { playbackState, transportStep } = get();
    
    // Hatalı `AudioContextService.start` çağrısını, doğru olan `AudioContextService.play` ile değiştiriyoruz.
    if (playbackState === PLAYBACK_STATES.STOPPED) {
        AudioContextService.play(transportStep);
    } else {
        AudioContextService.resume();
    }
  },
  // --- DÜZELTME SONU ---

  handlePause: () => {
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