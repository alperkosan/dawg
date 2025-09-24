// src/store/usePlaybackStore.js
import { create } from 'zustand';
import { AudioContextService } from '../lib/services/AudioContextService';
import { useArrangementStore } from './useArrangementStore';
import { calculateAudioLoopLength } from '../lib/utils/patternUtils';
import { PLAYBACK_MODES, PLAYBACK_STATES } from '../config/constants';

export const usePlaybackStore = create((set, get) => ({
  // --- STATE (Değişiklik yok) ---
  playbackState: PLAYBACK_STATES.STOPPED,
  playbackMode: PLAYBACK_MODES.PATTERN,
  bpm: 140,
  masterVolume: 0.8,
  transportPosition: '1:1:00',
  transportStep: 0,
  loopEnabled: true,
  audioLoopLength: 64,

  // ============================================
  // === ACTIONS (MOTOR BAĞLANTILARI BURADA) ===
  // ============================================

  // --- OYNATMA KONTROLLERİ ---
  togglePlayPause: () => {
    const { playbackState } = get();
    const engine = AudioContextService.getAudioEngine();
    if (!engine) return;

    // Duruma göre motorun ilgili fonksiyonunu çağır
    if (playbackState === PLAYBACK_STATES.PLAYING) {
      engine.pause();
    } else if (playbackState === PLAYBACK_STATES.PAUSED) {
      // ✅ FIX: Use resume() for paused state
      engine.resume();
    } else {
      // Only for stopped state, use play()
      engine.play();
    }
  },

  handleStop: () => {
    const engine = AudioContextService.getAudioEngine();
    engine?.stop();
  },

  // --- MOD VE AYAR YÖNETİMİ ---
  setPlaybackMode: (mode) => {
    if (get().playbackMode === mode) return;
    
    set({ playbackMode: mode });
    get().updateLoopLength();
    
    // Motorun çalma modunu güncelle
    AudioContextService.getAudioEngine()?.setPlaybackMode(mode);
  },
  
  handleBpmChange: (newBpm) => {
    const clampedBpm = Math.max(60, Math.min(300, newBpm));
    set({ bpm: clampedBpm });
    // Motorun BPM'ini güncelle
    AudioContextService.getAudioEngine()?.setBPM(clampedBpm);
  },

  setLoopEnabled: (enabled) => {
    set({ loopEnabled: enabled });
    AudioContextService.getAudioEngine()?.setLoopEnabled(enabled);
  },

  // --- ZAMAN ÇİZELGESİ ETKİLEŞİMİ ---
  jumpToStep: (step) => {
    AudioContextService.getAudioEngine()?.jumpToStep(step);
  },

  // --- DÖNGÜ UZUNLUĞU HESAPLAMA (Değişiklik yok) ---
  updateLoopLength: () => {
    const { playbackMode } = get();
    // DİKKAT: Artık arrangement verisini doğrudan alıyoruz
    const arrangementState = useArrangementStore.getState();
    const activePattern = arrangementState.patterns[arrangementState.activePatternId];
    
    // calculateAudioLoopLength fonksiyonuna doğru veriyi gönderiyoruz
    const newLength = calculateAudioLoopLength(
        playbackMode, 
        { pattern: activePattern, clips: arrangementState.clips },
        get().bpm
    );
    
    set({ audioLoopLength: newLength });
    
    // ⚡ OPTIMIZATION: Use PlaybackManager's debounced loop update instead of direct call
    const engine = AudioContextService.getAudioEngine();
    if (engine?.playbackManager) {
      // Trigger debounced loop recalculation through PlaybackManager
      engine.playbackManager._updateLoopSettings();
    } else {
      // Fallback to direct call if PlaybackManager not available
      engine?.setLoopPoints(0, newLength);
    }
  },
  
  // Bu fonksiyonlar App.jsx'teki callback'ler tarafından çağrıldığı için dokunmuyoruz.
  setTransportPosition: (position, step) => {
    console.log('🎯 Store setTransportPosition called:', { position, step });
    set({ transportPosition: position, transportStep: step });
  },
  setPlaybackState: (state) => set({ playbackState: state }),

  // YENİ: Master Volume için eylem
  handleMasterVolumeChange: (volume) => {
    set({ masterVolume: volume });
    AudioContextService.getAudioEngine()?.setMasterVolume(volume);
  }
}));