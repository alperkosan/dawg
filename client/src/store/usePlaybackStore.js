import { create } from 'zustand';
import { useArrangementStore } from './useArrangementStore';

/**
 * @file Enhanced usePlaybackStore.js
 * @description TimeManager entegrasyonlu geliştirilmiş playback store
 */
export const usePlaybackStore = create((set, get) => ({
  // --- STATE ---
  playbackState: 'stopped',
  bpm: 60, // BPM'i daha ritmik bir başlangıç için 120 yapalım
  masterVolume: 0,
  transportPosition: '1:1:0', // DEĞİŞTİ: BBT formatında
  isPreviewPlaying: false,
  playbackMode: 'pattern',
  // YENİ: Loop bilgileri
  loopInfo: {
    currentBar: 1,
    totalBars: 4,
    progress: 0,
  },
  // YENİ: Debouncing için
  _lastActionTime: 0,
  _isProcessingAction: false,

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
    const now = Date.now();
    const { _lastActionTime, _isProcessingAction } = get();
    
    // 300ms içinde tekrar tıklamayı engelle
    if (_isProcessingAction || (now - _lastActionTime) < 300) {
      console.log('[Playback] Çok hızlı tıklama engellendi');
      return;
    }
    
    set({ _isProcessingAction: true, _lastActionTime: now });
    
    if (!audioEngine) {
      set({ _isProcessingAction: false });
      return;
    }
    
    try {
      const { playbackMode } = get();
      const activePatternId = useArrangementStore.getState().activePatternId;
      
      console.log('[Playback] Play başlatılıyor...');
      audioEngine.start(playbackMode, activePatternId);
      
      // 500ms sonra işlem bayrağını kaldır
      setTimeout(() => {
        set({ _isProcessingAction: false });
      }, 500);
      
    } catch (error) {
      console.error('[Playback] Play hatası:', error);
      set({ _isProcessingAction: false });
    }
  },

  // DÜZELTME: Debounced pause handler  
  handlePause: (audioEngine) => {
    const now = Date.now();
    const { _lastActionTime, _isProcessingAction, playbackState } = get();
    
    if (_isProcessingAction || (now - _lastActionTime) < 200) {
      console.log('[Playback] Çok hızlı tıklama engellendi');
      return;
    }
    
    set({ _isProcessingAction: true, _lastActionTime: now });
    
    try {
      if (playbackState === 'playing') {
        console.log('[Playback] Pause...');
        audioEngine?.pause();
      } else if (playbackState === 'paused') {
        console.log('[Playback] Resume...');
        audioEngine?.resume();
      }
      
      setTimeout(() => {
        set({ _isProcessingAction: false });
      }, 300);
      
    } catch (error) {
      console.error('[Playback] Pause/Resume hatası:', error);
      set({ _isProcessingAction: false });
    }
  },

  // DÜZELTME: Debounced stop handler
  handleStop: (audioEngine) => {
    const now = Date.now();
    const { _lastActionTime, _isProcessingAction } = get();
    
    if (_isProcessingAction || (now - _lastActionTime) < 200) {
      return;
    }
    
    set({ _isProcessingAction: true, _lastActionTime: now });
    
    try {
      console.log('[Playback] Stop...');
      audioEngine?.stop();
      
      setTimeout(() => {
        set({ _isProcessingAction: false });
      }, 300);
      
    } catch (error) {
      console.error('[Playback] Stop hatası:', error);
      set({ _isProcessingAction: false });
    }
  },
  
  // YENİ: Timeline navigasyon eylemi
  jumpToBar: (barNumber, audioEngine) => {
    audioEngine?.jumpToBar(barNumber);
  },

}));