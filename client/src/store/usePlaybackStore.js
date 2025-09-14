import { create } from 'zustand';
import { useArrangementStore } from './useArrangementStore';

/**
 * @file usePlaybackStore.js - NİHAİ SÜRÜM
 * @description Uygulamanın genel playback (çalma) durumunu, transport
 * kontrollerini ve zamanlama bilgilerini yönetir. Arayüz (UI) ile
 * AudioEngine arasındaki ana köprüdür.
 */
export const usePlaybackStore = create((set, get) => ({
  // --- STATE ---
  // Projenin anlık "fotoğrafını" tutan veriler.
  
  playbackState: 'stopped', // 'stopped', 'playing', 'paused'
  bpm: 120,
  masterVolume: 0,
  transportPosition: '1:1:00', // GÜNCELLENDİ: Her zaman BBT formatında
  playbackMode: 'pattern', // 'pattern' veya 'song'

  // --- ACTIONS ---
  // State'i güvenli ve tahmin edilebilir bir şekilde değiştiren fonksiyonlar.

  /**
   * AudioEngine'den gelen anlık çalma durumunu state'e yazar.
   */
  setPlaybackState: (state) => set({ playbackState: state }),
  
  /**
   * AudioEngine'den gelen anlık pozisyon bilgisini (BBT formatında) state'e yazar.
   */
  setTransportPosition: (position) => {
    set({ transportPosition: position });
  },

  /**
   * Çalma modunu değiştirir. Eğer çalma devam ediyorsa,
   * AudioEngine'e "kesintisiz geçiş" komutu gönderir.
   */
  setPlaybackMode: (mode, audioEngine) => {
    const currentState = get();
    // Mod zaten aynıysa bir şey yapma
    if (currentState.playbackMode === mode) return;

    const isPlaying = currentState.playbackState === 'playing' || currentState.playbackState === 'paused';
    
    // Eğer çalma devam ediyorsa, AudioEngine'deki akıllı metodu kullan
    if (audioEngine && isPlaying) {
      const activePatternId = useArrangementStore.getState().activePatternId;
      audioEngine.switchPlaybackMode(mode, activePatternId);
    }
    // Her durumda arayüzün state'ini anında güncelle
    set({ playbackMode: mode });
  },

  /**
   * BPM (tempo) değerini günceller ve AudioEngine'e bildirir.
   */
  handleBpmChange: (newBpm, audioEngine) => {
    const clampedBpm = Math.max(40, Math.min(300, newBpm));
    set({ bpm: clampedBpm });
    audioEngine?.setBpm(clampedBpm);
  },

  /**
   * Ana ses seviyesini günceller ve AudioEngine'e bildirir.
   */
  handleMasterVolumeChange: (newVolume, audioEngine) => {
    set({ masterVolume: newVolume });
    audioEngine?.setMasterVolume(newVolume);
  },

  /**
   * Çalmayı başlatma komutunu AudioEngine'e gönderir.
   */
  handlePlay: (audioEngine) => {
    if (!audioEngine) return;
    const { playbackMode } = get();
    const activePatternId = useArrangementStore.getState().activePatternId;
    audioEngine.start(playbackMode, activePatternId); 
  },

  /**
   * AKILLI TOGGLE: Çalma durumuna göre duraklatma veya devam etme
   * komutunu AudioEngine'e gönderir.
   */
  handlePause: (audioEngine) => {
    const { playbackState } = get();
    if (playbackState === 'playing') {
      audioEngine?.pause();
    } else if (playbackState === 'paused') {
      audioEngine?.resume();
    }
  },

  /**
   * Çalmayı durdurma ve başa sarma komutunu AudioEngine'e gönderir.
   */
  handleStop: (audioEngine) => {
    audioEngine?.stop();
  },
  
  /**
   * Timeline üzerinde belirli bir ölçüye atlama komutunu gönderir.
   */
  jumpToBar: (barNumber, audioEngine) => {
    audioEngine?.jumpToBar(barNumber);
  },
}));