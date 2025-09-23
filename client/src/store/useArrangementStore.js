// src/store/useArrangementStore.js
// NativeAudioEngine entegrasyonu için modernize edildi.
import { create } from 'zustand';
import { initialPatterns, initialPatternOrder, initialClips, initialInstruments } from '../config/initialData';
import { AudioContextService } from '../lib/services/AudioContextService';
import { usePlaybackStore } from './usePlaybackStore';

// Başlangıç verisinden dinamik olarak track'leri oluştur.
const initialTracks = initialInstruments.map(inst => ({
  id: `track-${inst.id}`,
  instrumentId: inst.id,
  name: inst.name,
  height: 60,
}));

/**
 * Zustand store'ları arasında iletişimi sağlayan bir "orkestra şefi".
 * Bir store'daki değişiklik başka bir store'u veya ses motorunu tetikleyecekse,
 * bu mantık burada merkezi olarak yönetilir.
 */
const arrangementStoreOrchestrator = (config) => (set, get, api) => {
  const store = config(set, get, api);

  // Orijinal updatePatternNotes fonksiyonunu sarmala (wrap).
  const originalUpdatePatternNotes = store.updatePatternNotes;
  store.updatePatternNotes = (...args) => {
    originalUpdatePatternNotes(...args);
    // Notalar değiştiğinde, çalma döngüsünün uzunluğu da değişmiş olabilir.
    usePlaybackStore.getState().updateLoopLength();
    // Ses motorunu yeni notalarla yeniden zamanla.
    AudioContextService.reschedule();
  };

  const originalSetActivePatternId = store.setActivePatternId;
  store.setActivePatternId = (...args) => {
    originalSetActivePatternId(...args);
    usePlaybackStore.getState().updateLoopLength();
    AudioContextService.reschedule();
  };

  return store;
};

export const useArrangementStore = create(arrangementStoreOrchestrator((set, get) => ({
  patterns: initialPatterns,
  patternOrder: initialPatternOrder,
  tracks: initialTracks,
  clips: initialClips,
  activePatternId: 'pattern-1',
  songLength: 128, // bar cinsinden
  zoomX: 1,

  // --- EYLEMLER (ACTIONS) ---

  setActivePatternId: (patternId) => {
    if (get().activePatternId === patternId) return;
    set({ activePatternId: patternId });
    // Orkestratör bu eylemi yakalayıp gerekli diğer işlemleri yapacak.
  },

  updatePatternNotes: (patternId, instrumentId, newNotes) => {
    set(state => {
      const newPatterns = { ...state.patterns };
      const targetPattern = newPatterns[patternId];
      if (targetPattern) {
        const newData = { ...targetPattern.data, [instrumentId]: newNotes };
        newPatterns[patternId] = { ...targetPattern, data: newData };
        return { patterns: newPatterns };
      }
      return state;
    });
     // Orkestratör bu eylemi de yakalayacak.
  },
  
  renameActivePattern: (newName) => {
    const { activePatternId } = get();
    if (newName && activePatternId) {
        set(state => {
            const newPatterns = { ...state.patterns };
            if (newPatterns[activePatternId]) {
                newPatterns[activePatternId].name = newName;
            }
            return { patterns: newPatterns };
        });
    }
  },

  updateClip: (clipId, newParams) => {
    set(state => ({
      clips: state.clips.map(clip => 
        clip.id === clipId ? { ...clip, ...newParams } : clip
      )
    }));
    // Klip değişikliği şarkı uzunluğunu etkileyebilir.
    usePlaybackStore.getState().updateLoopLength();
  },
  
  setZoomX: (newZoom) => set({ zoomX: Math.max(0.1, Math.min(5, newZoom)) }),
})));
