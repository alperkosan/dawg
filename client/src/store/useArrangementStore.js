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

  // ========================================================
  // === PATTERN MANAGEMENT ===
  // ========================================================
  nextPatternNumber: 5, // For creating pattern-5, pattern-6, etc.

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

  // ========================================================
  // === PATTERN MANAGEMENT ACTIONS ===
  // ========================================================

  /**
   * Create a new empty pattern
   */
  createPattern: (name) => {
    const state = get();
    const newPatternId = `pattern-${state.nextPatternNumber}`;
    const patternName = name || newPatternId;

    // FL Studio Style: Patterns only contain note data
    const newPattern = {
      id: newPatternId,
      name: patternName,
      data: {}, // Empty pattern data (notes only)
      settings: {
        length: 64, // Default pattern length
        quantization: '16n'
      }
    };

    set(state => ({
      patterns: { ...state.patterns, [newPatternId]: newPattern },
      patternOrder: [...state.patternOrder, newPatternId],
      nextPatternNumber: state.nextPatternNumber + 1
    }));

    return newPatternId;
  },

  /**
   * Duplicate an existing pattern
   */
  duplicatePattern: (sourcePatternId, newName) => {
    const state = get();
    const sourcePattern = state.patterns[sourcePatternId];

    if (!sourcePattern) return null;

    const newPatternId = `pattern-${state.nextPatternNumber}`;
    const patternName = newName || `${sourcePattern.name} Copy`;

    // FL Studio Style: Only copy note data, not instrument ownership
    const newPattern = {
      id: newPatternId,
      name: patternName,
      data: JSON.parse(JSON.stringify(sourcePattern.data)), // Deep copy note data only
      settings: { ...sourcePattern.settings } // Copy pattern settings
    };

    set(state => ({
      patterns: { ...state.patterns, [newPatternId]: newPattern },
      patternOrder: [...state.patternOrder, newPatternId],
      nextPatternNumber: state.nextPatternNumber + 1
    }));

    return newPatternId;
  },

  /**
   * Delete a pattern
   */
  deletePattern: (patternId) => {
    const state = get();

    // Don't delete if it's the only pattern
    if (state.patternOrder.length <= 1) return false;

    // If deleting active pattern, switch to first available
    const newActivePattern = state.activePatternId === patternId
      ? state.patternOrder.find(id => id !== patternId)
      : state.activePatternId;

    set(state => {
      const newPatterns = { ...state.patterns };
      delete newPatterns[patternId];

      return {
        patterns: newPatterns,
        patternOrder: state.patternOrder.filter(id => id !== patternId),
        activePatternId: newActivePattern
      };
    });

    return true;
  },

  /**
   * Rename a pattern
   */
  renamePattern: (patternId, newName) => {
    set(state => ({
      patterns: {
        ...state.patterns,
        [patternId]: {
          ...state.patterns[patternId],
          name: newName
        }
      }
    }));
  },

  /**
   * Reorder patterns
   */
  reorderPatterns: (fromIndex, toIndex) => {
    set(state => {
      const newOrder = [...state.patternOrder];
      const [movedItem] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, movedItem);
      return { patternOrder: newOrder };
    });
  },

  /**
   * FL Studio Style: Patterns don't own instruments
   * This function is deprecated - all instruments are always visible
   */
  addInstrumentToPattern: (patternId, instrument) => {
    // FL Studio Logic: Do nothing, all instruments are always visible
    // Only initialize empty data for the instrument if it doesn't exist
    set(state => {
      const pattern = state.patterns[patternId];
      if (!pattern) return state;

      if (!pattern.data[instrument.id]) {
        const newPattern = {
          ...pattern,
          data: { ...pattern.data, [instrument.id]: [] }
        };

        return {
          patterns: { ...state.patterns, [patternId]: newPattern }
        };
      }

      return state;
    });
  },

  /**
   * FL Studio Style: Clear pattern data for an instrument
   * Instruments remain visible, just clear their notes in this pattern
   */
  clearInstrumentPatternData: (patternId, instrumentId) => {
    set(state => {
      const pattern = state.patterns[patternId];
      if (!pattern) return state;

      const newData = { ...pattern.data };
      newData[instrumentId] = []; // Clear notes but keep instrument visible

      const newPattern = {
        ...pattern,
        data: newData
      };

      return {
        patterns: { ...state.patterns, [patternId]: newPattern }
      };
    });
  },


})));
