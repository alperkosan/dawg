import { create } from 'zustand';
import { useArrangementStore } from './useArrangementStore';
import { calculateAudioLoopLength, calculateUIRackLength, calculatePatternLoopLength } from '../lib/utils/patternUtils';
import { initialInstruments } from '../config/initialData';
import { AudioContextService } from '../lib/services/AudioContextService';

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

  // ONARIM: Gelen pozisyon verisinin bir obje olması durumunda bile hatayı engelleyen
  // ve doğru formatı kullanan "savunmacı" bir fonksiyon.
  setTransportPosition: (position, step) => {
    let positionString = position;
    // Eğer gelen 'position' bir obje ise ve içinde 'formatted' anahtarı varsa, onu kullan.
    if (typeof position === 'object' && position !== null && position.hasOwnProperty('formatted')) {
      positionString = position.formatted;
    } else if (typeof position === 'object') {
      // Beklenmedik bir obje gelirse, hatayı konsola yaz ve arayüzü çökertme.
      console.warn("setTransportPosition beklenmedik bir obje aldı:", position);
      positionString = 'HATA'; 
    }
    set({
      transportPosition: positionString,
      transportStep: step
    });
  },

  /**
   * Çalma modunu değiştirir. Eğer çalma devam ediyorsa,
   * AudioEngine'e "kesintisiz geçiş" komutu gönderir.
   */
  setPlaybackMode: (mode) => {
      const currentState = get();
      if (currentState.playbackMode === mode) return;

      set({ playbackMode: mode });
      // Mod değiştiğinde döngü uzunluğunu yeniden hesapla
      get().updateLoopLength();
      
      const isPlaying = currentState.playbackState === 'playing' || currentState.playbackState === 'paused';
      if (AudioContextService && isPlaying) {
        AudioContextService.reschedule();
      }
    },
  /**
   * BPM (tempo) değerini günceller ve AudioEngine'e bildirir.
   */
  handleBpmChange: (newBpm) => {
    const clampedBpm = Math.max(40, Math.min(300, newBpm));
    set({ bpm: clampedBpm });
    AudioContextService?.setBpm(clampedBpm);
  },

  /**
   * Ana ses seviyesini günceller ve AudioEngine'e bildirir.
   */
  handleMasterVolumeChange: (newVolume) => {
    set({ masterVolume: newVolume });
    AudioContextService?.setMasterVolume(newVolume);
  },

  /**
   * Çalmayı başlatma komutunu AudioEngine'e gönderir.
   */
  handlePlay: () => {
    if (!AudioContextService) return;
    const { playbackMode } = get();
    const activePatternId = useArrangementStore.getState().activePatternId;
    AudioContextService.start(playbackMode, activePatternId); 
  },

  /**
   * AKILLI TOGGLE: Çalma durumuna göre duraklatma veya devam etme
   * komutunu AudioEngine'e gönderir.
   */
  handlePause: () => {
    const { playbackState } = get();
    if (playbackState === 'playing') {
      AudioContextService?.pause(); // Eğer çalıyorsa, DURAKLAT
    } else if (playbackState === 'paused') {
      AudioContextService?.resume(); // Eğer duraklatılmışsa, DEVAM ETTİR
    }
  },

  /**
   * Çalmayı durdurma ve başa sarma komutunu AudioEngine'e gönderir.
   */
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