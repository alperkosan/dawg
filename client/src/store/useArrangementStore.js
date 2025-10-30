// src/store/useArrangementStore.js
// NativeAudioEngine entegrasyonu için modernize edildi.
import { create } from 'zustand';
import { initialPatterns, initialPatternOrder, initialClips, initialInstruments } from '@/config/initialData';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { storeManager } from './StoreManager';
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
      // ✅ PERFORMANCE: Use StoreManager for loop length updates
      storeManager.updateLoopLength();
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

  // ✅ CRITICAL FIX: Disable automatic reschedule on pattern note updates
  // Now using EventBus system (NOTE_ADDED, NOTE_REMOVED, NOTE_MODIFIED)
  // which handles smart incremental scheduling instead of full reschedule
  const originalUpdatePatternNotes = store.updatePatternNotes;
  store.updatePatternNotes = (...args) => {
    originalUpdatePatternNotes(...args);
    // Throttled heavy operations
    throttledUpdateLoopLength();
    // ❌ REMOVED: throttledReschedule() - causes stuck notes during playback
    // EventBus handles scheduling now
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
  activePatternId: 'pattern2',  // ✅ Boom Bap showcase pattern (16 bars)
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
    set(state => {
      const newPatterns = { ...state.patterns };
      const targetPattern = newPatterns[patternId];

      if (targetPattern) {
        const newData = { ...targetPattern.data, [instrumentId]: newNotes };
        newPatterns[patternId] = { ...targetPattern, data: newData };
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
  // === AUDIO CLIP INTEGRATION (FL Studio-style) ===
  // ========================================================

  /**
   * Add exported pattern as audio clip to arrangement
   */
  addAudioClip: (audioClipData) => {
    const { patternId, audioBuffer, instrumentId, startTime = 0, trackId } = audioClipData;

    const newClip = {
      id: `audio_clip_${Date.now()}`,
      type: 'audio',
      patternId,
      instrumentId, // Audio instrument created from exported pattern
      trackId: trackId || `track-${patternId}`,
      startTime,
      duration: audioBuffer.duration,
      audioBuffer,
      originalPattern: patternId,
      isFromExport: true,
      color: '#f5a623', // Orange color for exported audio clips
      name: `${patternId} (Audio)`,
      metadata: {
        exportedAt: Date.now(),
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels
      }
    };

    set(state => ({
      clips: [...state.clips, newClip]
    }));

    console.log(`🎵 Added audio clip from pattern ${patternId}:`, newClip);

    // Update song length if necessary
    usePlaybackStore.getState().updateLoopLength();

    return newClip.id;
  },

  /**
   * Replace pattern clips with audio clip (FL Studio freeze workflow)
   */
  replacePatternWithAudio: (patternId, audioClipData) => {
    console.log(`🧊 replacePatternWithAudio called with:`, { patternId, audioClipData });

    set(state => {
      // Remove all pattern-based clips for this pattern
      const filteredClips = state.clips.filter(clip =>
        !(clip.type === 'pattern' && clip.patternId === patternId)
      );

      // Add the new audio clip
      const audioClip = {
        id: `frozen_${patternId}_${Date.now()}`,
        type: 'audio',
        patternId,
        assetId: audioClipData.assetId,
        trackId: audioClipData.trackId || `track-${patternId}`,
        startTime: audioClipData.startTime || 0,
        duration: audioClipData.duration,
        originalPattern: patternId,
        isFromExport: true,
        isFrozen: true,
        color: audioClipData.color || '#4a90e2',
        name: audioClipData.name || `${patternId} (Frozen)`,
        metadata: {
          frozenAt: Date.now(),
          cpuSavings: audioClipData.cpuSavings
        }
      };

      console.log(`🧊 Created audioClip:`, audioClip);

      return { clips: [...filteredClips, audioClip] };
    });

    console.log(`🧊 Replaced pattern ${patternId} with frozen audio clip`);
    usePlaybackStore.getState().updateLoopLength();
  },

  /**
   * Create audio clips from batch exported patterns
   */
  addBatchAudioClips: (exportResults) => {
    const newClips = [];

    exportResults.forEach((result, index) => {
      if (result.success && result.result.exportFiles.length > 0) {
        const { patternId } = result;
        const exportFile = result.result.exportFiles[0];

        const audioClip = {
          id: `batch_audio_${patternId}_${Date.now()}`,
          type: 'audio',
          patternId,
          instrumentId: result.result.instrumentId,
          trackId: `track-${patternId}`,
          startTime: index * 8, // Spread clips across timeline
          duration: exportFile.duration || 4,
          audioBuffer: exportFile.buffer,
          originalPattern: patternId,
          isFromExport: true,
          isBatchExport: true,
          color: '#7ed321', // Green for batch exports
          name: `${patternId} (Batch)`,
          metadata: {
            batchExportedAt: Date.now(),
            cpuSavings: result.result.cpuSavings,
            batchIndex: index
          }
        };

        newClips.push(audioClip);
      }
    });

    if (newClips.length > 0) {
      set(state => ({
        clips: [...state.clips, ...newClips]
      }));

      console.log(`🎵 Added ${newClips.length} audio clips from batch export`);
      usePlaybackStore.getState().updateLoopLength();
    }

    return newClips.map(clip => clip.id);
  },

  /**
   * Get all audio clips created from pattern exports
   */
  getExportedAudioClips: () => {
    return get().clips.filter(clip =>
      clip.type === 'audio' && clip.isFromExport
    );
  },

  /**
   * Unfreeze pattern (restore original MIDI pattern, remove audio clip)
   */
  unfreezePattern: (patternId) => {
    set(state => ({
      clips: state.clips.filter(clip =>
        !(clip.type === 'audio' && clip.patternId === patternId && clip.isFrozen)
      )
    }));

    console.log(`🔥 Unfroze pattern ${patternId}`);
    usePlaybackStore.getState().updateLoopLength();
  },

  /**
   * Convert audio clip back to pattern (opposite of freeze)
   */
  convertAudioClipToPattern: (clipId) => {
    const clip = get().clips.find(c => c.id === clipId);
    if (!clip || clip.type !== 'audio' || !clip.originalPattern) {
      console.warn(`Cannot convert clip ${clipId} to pattern`);
      return;
    }

    // Remove audio clip
    set(state => ({
      clips: state.clips.filter(c => c.id !== clipId)
    }));

    // The original pattern should still exist in patterns store
    console.log(`🔄 Converted audio clip ${clipId} back to pattern ${clip.originalPattern}`);
    usePlaybackStore.getState().updateLoopLength();
  },

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
