/**
 * @file usePlaybackStore.js
 * @description Uygulamanın genel playback (çalma) durumunu ve transport
 * kontrollerini (play, pause, stop, BPM, master volume) yönetir.
 * Arayüzden gelen komutları alır ve AudioEngine'e iletir.
 */
import { create } from 'zustand';
import { useArrangementStore } from './useArrangementStore';

export const usePlaybackStore = create((set, get) => ({
  // --- STATE ---
  playbackState: 'stopped',
  bpm: 60,
  masterVolume: 0,
  transportPosition: '0:0:0',
  isPreviewPlaying: false, // YENİ STATE
  playbackMode: 'pattern',

  // --- ACTIONS ---
  setPlaybackState: (state) => set({ playbackState: state }),
  setTransportPosition: (pos) => set({ transportPosition: pos }),
  setIsPreviewPlaying: (isPlaying) => set({ isPreviewPlaying: isPlaying }), // YENİ EYLEM
  setPlaybackMode: (mode) => {
    // Çalma sırasında mod değiştirilirse, karışıklığı önlemek için çalmayı durdur.
    if (get().playbackState !== 'stopped') {
      get().handleStop(null, true); // Engine'e göndermeden sadece state'i güncelle
    }
    set({ playbackMode: mode });
    console.log(`Playback modu: ${mode}`);
  },

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
    const { playbackMode } = get();
    // O an aktif olan pattern'in ID'sini Arrangement store'dan alıyoruz.
    const activePatternId = useArrangementStore.getState().activePatternId;
    
    // Gerekli tüm güncel bilgileri engine'in start metoduna gönderiyoruz.
    audioEngine.start(playbackMode, activePatternId); 
  },

  handlePause: (audioEngine) => {
    audioEngine?.pause();
  },

  handleStop: (audioEngine, internalCall = false) => {
    if (internalCall) {
      set({ playbackState: 'stopped', transportPosition: '0:0:0' });
    } else {
      audioEngine?.stop();
    }
  },
}));

