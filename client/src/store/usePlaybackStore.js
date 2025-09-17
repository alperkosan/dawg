import { create } from 'zustand';
import { useArrangementStore } from './useArrangementStore';
import { calculateAudioLoopLength, calculateUIRackLength, calculatePatternLoopLength } from '../lib/utils/patternUtils';
import { initialInstruments } from '../config/initialData';

const initialPatternData = initialInstruments.reduce((acc, inst) => {
  acc[inst.id] = inst.notes;
  return acc;
}, {});

const initialActivePattern = { id: 'pattern-1', name: 'Pattern 1', data: initialPatternData };

// 2. Başlangıç uzunluklarını hesapla.
const initialAudioLoopLength = calculatePatternLoopLength(initialActivePattern);
const initialUiRackLength = calculateUIRackLength(initialAudioLoopLength);

/**
 * @file usePlaybackStore.js - NİHAİ SÜRÜM
 * @description Uygulamanın genel playback (çalma) durumunu, transport
 * kontrollerini ve zamanlama bilgilerini yönetir. Arayüz (UI) ile
 * AudioEngine arasındaki ana köprüdür.
 */
export const usePlaybackStore = create((set, get) => ({
  // --- STATE ---
  // Projenin anlık "fotoğrafını" tutan veriler.
  // 1. Başlangıç pattern'ini initialData'dan al.
  //    Bu yapı useArrangementStore'daki mantığın aynısıdır.
  playbackState: 'stopped', // 'stopped', 'playing', 'paused'
  bpm: 60,
  masterVolume: 0,
  transportPosition: '1:1:00', // GÜNCELLENDİ: Her zaman BBT formatında
  playbackMode: 'pattern', // 'pattern' veya 'song'
  loopLength: initialUiRackLength, // Başlangıçta UI için ekstra boşluklu
  audioLoopLength: initialAudioLoopLength,  // Ses motoru için gerçek döngü adım sayısı

  // --- ACTIONS ---

  /**
   * === MERKEZİ GÜNCELLEME FONKSİYONU ===
   * Projenin durumuna göre hem ses motoru hem de UI için
   * döngü uzunluklarını hesaplar ve state'i günceller.
   * Bu fonksiyon, nota eklendiğinde/silindiğinde, mod değiştiğinde
   * veya pattern değiştiğinde çağrılmalıdır.
   */
  updateLoopLength: () => {
    const { playbackMode } = get();
    const { clips, patterns, activePatternId } = useArrangementStore.getState();

    // 1. Ses motoru için gerçek uzunluğu hesapla
    const newAudioLoopLength = calculateAudioLoopLength(playbackMode, {
      patterns,
      activePatternId,
      clips,
    });
    
    // 2. Arayüz için +1 barlık (16 step) ekstra boşluklu uzunluğu hesapla
    const newUiRackLength = calculateUIRackLength(newAudioLoopLength);

    set({
      audioLoopLength: newAudioLoopLength,
      loopLength: newUiRackLength
    });
    
    console.log(`[PlaybackStore] Döngü uzunlukları güncellendi: Audio(${newAudioLoopLength}), UI(${newUiRackLength})`);
  },
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
      if (currentState.playbackMode === mode) return;

      set({ playbackMode: mode });
      // Mod değiştiğinde döngü uzunluğunu yeniden hesapla
      get().updateLoopLength();
      
      const isPlaying = currentState.playbackState === 'playing' || currentState.playbackState === 'paused';
      if (audioEngine && isPlaying) {
        audioEngine.reschedule();
      }
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
   * === YENİ FONKSİYON ===
   * Timeline üzerinde belirli bir ölçüye atlama komutunu gönderir.
   */
  jumpToBar: (barNumber, audioEngine) => {
    audioEngine?.jumpToBar(barNumber);
  },
}));