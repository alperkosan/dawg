/**
 * @file usePlaybackStore.js
 * @description Uygulamanın genel playback (çalma) durumunu ve transport
 * kontrollerini (play, pause, stop, BPM, master volume) yönetir.
 * Arayüzden gelen komutları alır ve AudioEngine'e iletir.
 */
import { create } from 'zustand';

export const usePlaybackStore = create((set, get) => ({
  // --- STATE ---
  playbackState: 'stopped',
  bpm: 130,
  masterVolume: 0,
  transportPosition: '0:0:0',
  isPreviewPlaying: false, // YENİ STATE

  // --- ACTIONS ---
  setPlaybackState: (state) => set({ playbackState: state }),
  setTransportPosition: (pos) => set({ transportPosition: pos }),
  setIsPreviewPlaying: (isPlaying) => set({ isPreviewPlaying: isPlaying }), // YENİ EYLEM

  handleBpmChange: (newBpm, audioEngine) => {
    const clampedBpm = Math.max(40, Math.min(300, newBpm));
    set({ bpm: clampedBpm });
    audioEngine?.setBpm(clampedBpm);
  },

  handleMasterVolumeChange: (newVolume, audioEngine) => {
    set({ masterVolume: newVolume });
    audioEngine?.setMasterVolume(newVolume);
  },

  handlePlay: (audioEngine) => {
    if (!audioEngine) return;
    audioEngine.start();
  },

  handlePause: (audioEngine) => {
    audioEngine?.pause();
  },

  handleStop: (audioEngine) => {
    audioEngine?.stop();
  },
}));

