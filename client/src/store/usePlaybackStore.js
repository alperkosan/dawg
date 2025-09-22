// src/store/usePlaybackStore.js
// NativeAudioEngine ve modern zamanlama yönetimi ile tamamen yeniden yapılandırıldı.
import { create } from 'zustand';
import { AudioContextService } from '../lib/services/AudioContextService';
import { useArrangementStore } from './useArrangementStore';
import { calculateAudioLoopLength } from '../lib/utils/patternUtils';
import { PLAYBACK_MODES, PLAYBACK_STATES } from '../config/constants';

export const usePlaybackStore = create((set, get) => ({
  // --- TEMEL DURUM (STATE) ---
  playbackState: PLAYBACK_STATES.STOPPED,
  playbackMode: PLAYBACK_MODES.PATTERN,
  bpm: 140,
  masterVolume: 0.8,
  
  // --- ZAMANLAMA BİLGİLERİ ---
  // Not: transportPosition ve transportStep artık doğrudan App.jsx içindeki
  // NativeAudioEngine'in callback'i tarafından güncelleniyor.
  // Bu, UI'ın ses thread'inden gelen en güncel bilgiyle beslenmesini sağlar.
  transportPosition: '1:1:00',
  transportStep: 0,

  // --- DÖNGÜ YÖNETİMİ ---
  loopEnabled: true,
  isAutoLoop: true, // Döngü noktalarını içeriğe göre otomatik hesapla
  // audioLoopLength, UI'da gösterilen döngü uzunluğudur (adımlarla).
  // Gerçek ses motoru döngüsü saniye cinsinden ayarlanır.
  audioLoopLength: 64,

  // ========================================================
  // === EYLEMLER (ACTIONS) ===
  // ========================================================

  // --- OYNATMA KONTROLLERİ ---
  togglePlayPause: () => {
    const { playbackState } = get();
    const engine = AudioContextService.getAudioEngine();
    if (!engine) return;

    if (playbackState === PLAYBACK_STATES.PLAYING) {
      engine.pause();
    } else {
      // Durmuş durumdaysa veya duraklatıldıysa oynatmayı başlat/devam ettir.
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
    get().updateLoopLength(); // Yeni moda göre döngü uzunluğunu yeniden hesapla
    
    // Ses motoruna da modu bildir.
    const engine = AudioContextService.getAudioEngine();
    engine?.setPlaybackMode(mode);
  },
  
  handleBpmChange: (newBpm) => {
    const clampedBpm = Math.max(60, Math.min(300, newBpm));
    set({ bpm: clampedBpm });
    AudioContextService.setBPM(clampedBpm);
  },

  setLoopEnabled: (enabled) => {
    set({ loopEnabled: enabled });
    AudioContextService.getAudioEngine()?.setLoopEnabled(enabled);
  },

  // --- ZAMAN ÇİZELGESİ ETKİLEŞİMİ ---
  jumpToStep: (step) => {
    AudioContextService.getAudioEngine()?.jumpToStep(step);
  },

  // --- DÖNGÜ UZUNLUĞU HESAPLAMA ---
  /**
   * Mevcut çalma moduna (Pattern/Song) göre döngü uzunluğunu hesaplar
   * ve hem bu store'u hem de ses motorunu günceller.
   */
  updateLoopLength: () => {
    const { playbackMode } = get();
    const arrangementState = useArrangementStore.getState();
    
    const newLength = calculateAudioLoopLength(playbackMode, arrangementState);
    
    set({ audioLoopLength: newLength });

    // Ses motorundaki döngü noktalarını da güncelle
    const engine = AudioContextService.getAudioEngine();
    if (engine && get().isAutoLoop) {
      engine.setLoopPoints(0, newLength);
    }
  },
  
  // Bu fonksiyonlar artık doğrudan App.jsx'teki engine callback'i tarafından çağrılır.
  // Bu sayede UI her zaman en güncel bilgiyi gösterir.
  setTransportPosition: (position, step) => set({ transportPosition: position, transportStep: step }),
  setPlaybackState: (state) => set({ playbackState: state }),
}));
