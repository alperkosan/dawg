// src/store/usePlaybackStore.js
// ✅ MIGRATION: Re-export new unified system
export { usePlaybackStore } from './usePlaybackStoreV2';

/*
// DEPRECATED - Old implementation moved to usePlaybackStoreV2.js
// This file now serves as a migration bridge

import { create } from 'zustand';
import { AudioContextService } from '../lib/services/AudioContextService';
import { useArrangementStore } from './useArrangementStore';
import { calculateAudioLoopLength } from '../lib/utils/patternUtils';
import { PLAYBACK_MODES, PLAYBACK_STATES } from '../config/constants';

*/

// LEGACY CODE - COMMENTED OUT
/*
export const usePlaybackStore = create((set, get) => ({
  // --- STATE (Değişiklik yok) ---
  isPlaying: false,
  playbackState: PLAYBACK_STATES.STOPPED,
  playbackMode: PLAYBACK_MODES.PATTERN,
  bpm: 140,
  masterVolume: 0.8,
  transportPosition: '1:1:00',
  transportStep: 0,
  loopEnabled: true,
  audioLoopLength: 64,
  currentStep: 0,     // Oynatma çubuğunun mevcut konumu (step cinsinden)
  startPosition: 0,   // Stop halinde playhead'in göstereceği başlangıç pozisyonu
  pausePosition: 0,   // Pause yapıldığında playhead'in durduğu pozisyon
  stopPosition: 0,    // Stop yapıldığında motor'un durduğu pozisyon
  lastStopTime: 0,    // Son stop butonuna basılma zamanı (double-stop detection için)
  loopStartStep: 64, // Döngünün başlangıcı (varsayılan olarak 5. bar)
  loopEndStep: 128,   // Döngünün bitişi (varsayılan olarak 9. bar)

  // ============================================
  // === ACTIONS (MOTOR BAĞLANTILARI BURADA) ===
  // ============================================

  // --- EYLEMLER (ACTIONS) ---
  togglePlay: () => set(state => ({ isPlaying: !state.isPlaying })),
  
  setCurrentStep: (step) => {
    const { playbackState } = get();
    // Playing halinde her currentStep update'inde, bu pozisyonu potansiyel pause pozisyonu olarak kaydet
    if (playbackState === PLAYBACK_STATES.PLAYING) {
      set({ currentStep: step, pausePosition: step });
    } else {
      set({ currentStep: step });
    }
  },

  setStartPosition: (step) => set({ startPosition: step }),

  setPausePosition: (step) => set({ pausePosition: step }),
  
  setLoopRegion: (startStep, endStep) => {
    // Başlangıcın sondan büyük olmamasını sağla
    const newStart = Math.min(startStep, endStep);
    const newEnd = Math.max(startStep, endStep);
    set({ loopStartStep: newStart, loopEndStep: newEnd });
  },

  // --- OYNATMA KONTROLLERİ ---
  togglePlayPause: () => {
    const { playbackState, startPosition, pausePosition } = get();
    const engine = AudioContextService.getAudioEngine();
    if (!engine) return;

    // Duruma göre motorun ilgili fonksiyonunu çağır
    if (playbackState === PLAYBACK_STATES.PLAYING) {
      engine.pause();
    } else if (playbackState === PLAYBACK_STATES.PAUSED) {
      // ✅ FIX: Pause halinde pausePosition'dan devam et
      // Eğer pause halinde manual pozisyon değişikliği yapıldıysa
      if (pausePosition !== undefined && pausePosition !== null) {
        engine.play(pausePosition); // Pause pozisyonundan başla
      } else {
        engine.resume(); // Normal resume
      }
    } else {
      // ✅ FIX: Stop halinde startPosition'dan başlat
      // Stop halinde UI playhead ile motor position senkronizasyonu
      console.log('togglePlayPause from stopped state:', { startPosition, pausePosition });
      if (startPosition !== undefined && startPosition !== null) {
        console.log('Playing from startPosition:', startPosition);
        engine.play(startPosition); // Explicit start position
      } else {
        console.log('Playing from default position (0)');
        engine.play(); // Default start
      }
    }
  },

  handleStop: () => {
    const { lastStopTime, loopStartStep } = get();
    const now = Date.now();
    const timeSinceLastStop = now - lastStopTime;

    // Double-stop detection: 500ms içinde iki kere stop basılırsa
    if (timeSinceLastStop < 500 && lastStopTime > 0) {
      // Loop varsa loop başına, yoksa 0'a git
      const resetPosition = loopStartStep > 0 ? loopStartStep : 0;
      set({ startPosition: resetPosition, lastStopTime: now });
    } else {
      // İlk stop: loop başına git (eğer loop varsa)
      if (loopStartStep > 0) {
        set({ startPosition: loopStartStep, lastStopTime: now });
      } else {
        set({ lastStopTime: now });
      }
    }

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
    const { playbackState } = get();

    // Stop halinde start pozisyonunu güncelle
    if (playbackState === PLAYBACK_STATES.STOPPED) {
      console.log('jumpToStep in stopped state: setting startPosition to', step);
      set({ startPosition: step });
    }

    // Pause halinde pause pozisyonunu güncelle
    if (playbackState === PLAYBACK_STATES.PAUSED) {
      set({ pausePosition: step });
    }

    AudioContextService.getAudioEngine()?.jumpToStep(step);
  },

  // ✅ NEW: Motor'un gerçek pozisyonunu al
  getCurrentMotorPosition: () => {
    const engine = AudioContextService.getAudioEngine();
    if (!engine?.playbackManager) {
      console.log('getCurrentMotorPosition: No playbackManager');
      return 0;
    }

    try {
      const position = engine.playbackManager.getCurrentPosition();
      console.log('getCurrentMotorPosition:', { position, isPlaying: engine.playbackManager.isPlaying });
      return position;
    } catch (error) {
      console.warn('Error getting motor position:', error);
      return 0;
    }
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
    set({ transportPosition: position, transportStep: step });
  },
  setPlaybackState: (state) => {
    const { currentStep, playbackState: prevState } = get();

    // Pause'a geçiliyorsa currentStep'i pause position olarak kaydet
    if (state === PLAYBACK_STATES.PAUSED && prevState === PLAYBACK_STATES.PLAYING) {
      // Audio engine'den direkt pozisyonu al
      const engine = AudioContextService.getAudioEngine();
      const actualPosition = engine?.transport?.ticksToSteps?.(engine.transport.currentTick) || currentStep;
      set({ pausePosition: actualPosition });
    }

    // Stop'a geçiliyorsa currentStep'i stop position olarak kaydet
    if (state === PLAYBACK_STATES.STOPPED && (prevState === PLAYBACK_STATES.PLAYING || prevState === PLAYBACK_STATES.PAUSED)) {
      const engine = AudioContextService.getAudioEngine();
      const actualPosition = engine?.transport?.ticksToSteps?.(engine.transport.currentTick) || currentStep;
      console.log('Setting stop position:', actualPosition);
      set({ stopPosition: actualPosition });
    }

    set({ playbackState: state });
  },

  // Loop Range Controls
  setLoopRange: (startStep, endStep) => {
    set({
      loopStartStep: Math.max(0, startStep),
      loopEndStep: Math.max(startStep + 1, endStep)
    });

    // Audio engine'e loop noktalarını gönder
    const engine = AudioContextService.getAudioEngine();
    if (engine) {
      engine.setLoopPoints(startStep, endStep);
    }
  },

  // YENİ: Master Volume için eylem
  handleMasterVolumeChange: (volume) => {
    set({ masterVolume: volume });
    AudioContextService.getAudioEngine()?.setMasterVolume(volume);
  }
}));
*/