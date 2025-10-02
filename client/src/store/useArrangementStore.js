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
 * ⚡ OPTIMIZED: Throttled orchestrator to prevent excessive heavy operations
 * Zustand store'ları arasında iletişimi sağlayan bir "orkestra şefi".
 */
const arrangementStoreOrchestrator = (config) => (set, get, api) => {
  const store = config(set, get, api);

  // Throttling for heavy operations
  let updateLoopLengthTimeout = null;
  let rescheduleTimeout = null;

  const throttledUpdateLoopLength = () => {
    if (updateLoopLengthTimeout) return; // Already scheduled
    updateLoopLengthTimeout = setTimeout(() => {
      usePlaybackStore.getState().updateLoopLength();
      updateLoopLengthTimeout = null;
    }, 50); // 50ms throttle
  };

  const throttledReschedule = () => {
    if (rescheduleTimeout) return; // Already scheduled
    rescheduleTimeout = setTimeout(() => {
      AudioContextService.reschedule();
      rescheduleTimeout = null;
    }, 100); // 100ms throttle
  };

  // Orijinal updatePatternNotes fonksiyonunu sarmala (wrap).
  const originalUpdatePatternNotes = store.updatePatternNotes;
  store.updatePatternNotes = (...args) => {
    originalUpdatePatternNotes(...args);
    // Throttled heavy operations
    throttledUpdateLoopLength();
    throttledReschedule();
  };

  const originalSetActivePatternId = store.setActivePatternId;
  store.setActivePatternId = (...args) => {
    originalSetActivePatternId(...args);
    // Immediate for pattern changes (more critical)
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

  // Loop regions for infinite canvas
  loopRegions: [],

  // --- EYLEMLER (ACTIONS) ---

  setActivePatternId: (patternId) => {
    if (get().activePatternId === patternId) return;
    set({ activePatternId: patternId });
    // Orkestratör bu eylemi yakalayıp gerekli diğer işlemleri yapacak.
  },

  updatePatternNotes: (patternId, instrumentId, newNotes) => {
    console.log('🔄 updatePatternNotes called:', { patternId, instrumentId, newNotesCount: newNotes.length });

    set(state => {
      const newPatterns = { ...state.patterns };
      const targetPattern = newPatterns[patternId];

      console.log('📋 Before update:', {
        patternExists: !!targetPattern,
        currentData: targetPattern?.data?.[instrumentId]?.length || 0
      });

      if (targetPattern) {
        const newData = { ...targetPattern.data, [instrumentId]: newNotes };
        newPatterns[patternId] = { ...targetPattern, data: newData };

        console.log('✅ After update:', {
          newDataCount: newData[instrumentId]?.length || 0,
          totalInstruments: Object.keys(newData).length
        });

        return { patterns: newPatterns };
      }

      console.warn('❌ Pattern not found:', patternId);
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

  // Loop region management
  addLoopRegion: (loopRegion) => {
    set(state => ({
      loopRegions: [...state.loopRegions, {
        id: loopRegion.id || `loop_${Date.now()}`,
        start: loopRegion.start,
        end: loopRegion.end,
        name: loopRegion.name || `Loop ${state.loopRegions.length + 1}`,
        color: loopRegion.color || '#4CAF50',
        ...loopRegion
      }]
    }));
  },

  updateLoopRegion: (loopId, updates) => {
    set(state => ({
      loopRegions: state.loopRegions.map(loop =>
        loop.id === loopId ? { ...loop, ...updates } : loop
      )
    }));
  },

  deleteLoopRegion: (loopId) => {
    set(state => ({
      loopRegions: state.loopRegions.filter(loop => loop.id !== loopId)
    }));
  },

  clearLoopRegions: () => set({ loopRegions: [] }),
})));
