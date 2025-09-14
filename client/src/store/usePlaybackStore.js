import { create } from 'zustand';
import { useArrangementStore } from './useArrangementStore';

/**
 * @file Enhanced usePlaybackStore.js
 * @description TimeManager entegrasyonlu geliştirilmiş playback store
 */
export const usePlaybackStore = create((set, get) => ({
  // --- STATE ---
  playbackState: 'stopped',
  bpm: 120, // BPM'i daha ritmik bir başlangıç için 120 yapalım
  masterVolume: 0,
  transportPosition: '1:1:00', // DEĞİŞTİ: BBT formatında
  isPreviewPlaying: false,
  playbackMode: 'pattern',
  // YENİ: Loop bilgileri
  loopInfo: {
    currentBar: 1,
    totalBars: 4,
    progress: 0,
  },

  // --- ACTIONS ---
  setPlaybackState: (state) => set({ playbackState: state }),
  
  // GÜNCELLENDİ: Pozisyonu set ederken mevcut bar'ı da ayrıştırıyor
  setTransportPosition: (position) => {
    set({ transportPosition: position });
    const parts = position.split(':');
    if (parts.length >= 2) {
      const currentBar = parseInt(parts[0], 10) || 1;
      set(state => ({
        loopInfo: { ...state.loopInfo, currentBar }
      }));
    }
  },

  setIsPreviewPlaying: (isPlaying) => set({ isPreviewPlaying: isPlaying }),

  // GÜNCELLENDİ: Çalma sırasında kesintisiz mod değişimi
  setPlaybackMode: (mode) => {
    const { playbackState } = get();
    const isPlaying = playbackState === 'playing' || playbackState === 'paused';
    
    // window.audioEngineRef global'de olmayabilir, bu yüzden bu mantığı doğrudan
    // UI bileşeninden gelen audioEngineRef üzerinden yapacağız. Bu eylem sadece state'i değiştirmeli.
    // AudioEngine'e komut, UI'dan (örn: TopToolbar) gönderilecek.
    set({ playbackMode: mode });
    console.log(`Playback modu: ${mode}`);
    // Not: Gerçek switchPlaybackMode çağrısını UI'da yapacağız.
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
    const activePatternId = useArrangementStore.getState().activePatternId;
    audioEngine.start(playbackMode, activePatternId); 
  },

  // GÜNCELLENDİ: Artık hem pause hem de resume işlevi görüyor
  handlePause: (audioEngine) => {
    const { playbackState } = get();
    if (playbackState === 'playing') {
        audioEngine?.pause();
    } else if (playbackState === 'paused') {
        audioEngine?.resume();
    }
  },

  handleStop: (audioEngine) => {
    audioEngine?.stop();
  },
  
  // YENİ: Timeline navigasyon eylemi
  jumpToBar: (barNumber, audioEngine) => {
    audioEngine?.jumpToBar(barNumber);
  },

}));