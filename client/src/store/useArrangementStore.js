// src/store/useArrangementStore.js
// ✅ UNIFIED ARRANGEMENT STORE
// NativeAudioEngine entegrasyonu için modernize edildi.
// Phase 1: Store Consolidation - Merged useArrangementV2Store functionality
import { create } from 'zustand';
import { nanoid } from 'nanoid';
// ✅ Empty project - no initial data
import { AudioContextService } from '@/lib/services/AudioContextService';
import { storeManager } from './StoreManager';
import { usePlaybackStore } from './usePlaybackStore';
import { audioAssetManager } from '@/lib/audio/AudioAssetManager.js';
import { getTimelineController } from '@/lib/core/TimelineControllerSingleton.js';

// ============================================================================
// HELPERS - Arrangement Tracks & Clips
// ============================================================================

// ✅ PHASE 2: Design Consistency - Remove color palette, use alternating dark-light Zenith theme
// Track colors are now determined by index (alternating dark-light)
// No color property needed - tracks use alternating background colors from Zenith theme

const createArrangementTrack = (name, index) => ({
  id: `track-${nanoid(8)}`,
  name: name || `Track ${index + 1}`,
  // Color removed - tracks use alternating dark-light backgrounds from Zenith theme
  height: 80,
  volume: 1.0,
  pan: 0,
  muted: false,
  solo: false,
  locked: false,
  collapsed: false
});

const createAudioClip = (trackId, startTime, assetId, duration, name) => ({
  id: `clip-${nanoid(8)}`,
  type: 'audio',
  trackId,
  startTime,
  duration,
  assetId,
  sampleOffset: 0,
  playbackRate: 1.0,
  fadeIn: 0,
  fadeOut: 0,
  gain: 0,
  name: name || 'Audio Clip',
  // ✅ PHASE 2: Color removed - audio clips use fixed Zenith cyan color (#4ECDC4)
  muted: false,
  locked: false,
  // Shared editing system
  isUnique: false,
  uniqueMetadata: null,
  mixerChannelId: null // DEPRECATED: kept for backward compatibility
});

const createPatternClip = (trackId, startTime, patternId, duration, instrumentId, name) => ({
  id: `clip-${nanoid(8)}`,
  type: 'pattern',
  trackId,
  startTime,
  duration,
  patternId,
  instrumentId,
  loopCount: 1,
  name: name || 'Pattern',
  // ✅ SPLIT SUPPORT: patternOffset for split clips (in steps, 16th notes)
  // 0 = start from beginning of pattern, >0 = skip steps from pattern start
  patternOffset: 0,
  // ✅ PHASE 2: Color removed - pattern clips use fixed Zenith purple color (#8b5cf6)
  muted: false,
  locked: false
});

const createMarker = (time, label, color) => ({
  id: `marker-${nanoid(8)}`,
  time,
  label: label || 'Marker',
  color: color || '#8b5cf6'
});

const createLoopRegion = (startTime, endTime, label, color) => ({
  id: `loop-${nanoid(8)}`,
  startTime,
  endTime,
  label: label || 'Loop',
  color: color || '#22c55e'
});

// ✅ Empty project - no initial tracks
const initialTracks = [];

// ✅ Empty project - start with no arrangement tracks
const initialArrangementTracks = [];

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
    AudioContextService.getAudioEngine()?.playbackManager?.reschedule('active-pattern-change');
  };

  return store;
};

export const useArrangementStore = create(arrangementStoreOrchestrator((set, get) => ({
  // ========================================================
  // === PATTERN MANAGEMENT (Existing) ===
  // ========================================================
  patterns: {}, // ✅ Empty project - start with no patterns
  patternOrder: [], // ✅ Empty project - start with no pattern order
  tracks: [], // ✅ Empty project - start with no tracks
  clips: [], // ✅ Empty project - start with no clips
  activePatternId: null, // ✅ Start with no active pattern (will be set by deserializer)
  songLength: 128, // bar cinsinden
  zoomX: 1,
  nextPatternNumber: 5,

  // ========================================================
  // === ARRANGEMENT PANEL STATE (New - from useArrangementV2Store) ===
  // ========================================================

  // Arrangement tracks (separate from pattern tracks)
  arrangementTracks: [], // ✅ Empty project - start with no arrangement tracks

  // Arrangement clips (separate from pattern clips)
  arrangementClips: [],

  // Selection
  selectedClipIds: [],

  // Clipboard
  clipboard: null,

  // Markers
  arrangementMarkers: [],

  // Loop regions (arrangement-specific, separate from pattern loop regions)
  arrangementLoopRegions: [],

  // Viewport
  viewportOffset: { x: 0, y: 0 },
  zoom: { x: 1, y: 1 },
  snapEnabled: true,
  snapSize: 0.25, // 1/16 note in beats

  // History
  history: {
    past: [],
    future: [],
    maxSize: 50
  },

  // Audio engine integration
  _audioEngine: null,
  _trackChannelMap: new Map(), // Map track IDs to mixer channel IDs

  // Loop regions for infinite canvas (legacy - pattern loop regions)
  loopRegions: [],

  // ========================================================
  // === PATTERN MANAGEMENT ===
  // ========================================================
  nextPatternNumber: 1, // For creating pattern-1, pattern-2, etc.

  // --- EYLEMLER (ACTIONS) ---

  setActivePatternId: (patternId) => {
    const state = get();

    // ✅ FIX: Ensure pattern exists, if not, select first available pattern
    if (!state.patterns[patternId]) {
      const availablePatterns = state.patternOrder.filter(id => state.patterns[id]);
      if (availablePatterns.length > 0) {
        const firstPattern = availablePatterns[0];
        console.warn(`⚠️ Pattern ${patternId} not found, switching to first available: ${firstPattern}`);
        set({ activePatternId: firstPattern });
        return;
      } else {
        console.error('❌ No patterns available to select');
        return;
      }
    }

    if (state.activePatternId === patternId) return;
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

  // ✅ PHASE 2: Update CC lanes for a pattern
  updatePatternCCLanes: (patternId, ccLanesData) => {
    set(state => {
      const newPatterns = { ...state.patterns };
      const targetPattern = newPatterns[patternId];

      if (targetPattern) {
        newPatterns[patternId] = { ...targetPattern, ccLanes: ccLanesData };
        return { patterns: newPatterns };
      }

      console.warn('❌ Pattern not found for CC lanes update:', patternId);
      return state;
    });
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

  setPatternLength: (patternId, newLength) => {
    if (!patternId || typeof newLength !== 'number') return;

    const normalizeLength = (length) => {
      const clamped = Math.max(16, Math.min(8192, length));
      return Math.ceil(clamped / 16) * 16;
    };

    const nextLength = normalizeLength(newLength);

    set(state => {
      const pattern = state.patterns[patternId];
      if (!pattern) {
        console.warn('❌ Pattern not found for length update:', patternId);
        return state;
      }

      if (pattern.length === nextLength) {
        return state;
      }

      const updatedPattern = {
        ...pattern,
        length: nextLength,
        settings: {
          ...(pattern.settings || {}),
          length: nextLength
        }
      };

      return {
        patterns: {
          ...state.patterns,
          [patternId]: updatedPattern
        }
      };
    });

    // Ensure transport + timeline pick up new loop length
    usePlaybackStore.getState().updateLoopLength();
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

    // Find next available pattern number to avoid collisions
    let nextNumber = state.nextPatternNumber;
    // Find next available pattern number to avoid collisions
    while (state.patterns[`pattern-${nextNumber}`]) {
      nextNumber++;
    }

    // Ensure the pattern ID doesn't already exist (double-check)
    let newPatternId = `pattern-${nextNumber}`;

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
      // ✅ FIX: Update nextPatternNumber to be at least nextNumber + 1
      nextPatternNumber: Math.max(state.nextPatternNumber, nextNumber + 1)
    }));

    console.log(`✅ Created pattern: ${newPatternId} (nextPatternNumber: ${Math.max(state.nextPatternNumber, nextNumber + 1)})`);
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

    // ✅ FIX: Don't delete if it's the only pattern - always keep at least 1 pattern
    const availablePatterns = state.patternOrder.filter(id => state.patterns[id]);
    if (availablePatterns.length <= 1) {
      console.warn('⚠️ Cannot delete the last pattern. At least one pattern must exist.');
      return false;
    }

    // If deleting active pattern, switch to first available
    const remainingPatterns = state.patternOrder.filter(id => id !== patternId);
    const newActivePattern = state.activePatternId === patternId
      ? remainingPatterns[0] // Switch to first remaining pattern
      : state.activePatternId;

    set(state => {
      const newPatterns = { ...state.patterns };
      delete newPatterns[patternId];

      return {
        patterns: newPatterns,
        patternOrder: remainingPatterns,
        activePatternId: newActivePattern
      };
    });

    console.log(`✅ Deleted pattern ${patternId}, switched to ${newActivePattern}`);
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

  // ========================================================
  // === ARRANGEMENT PANEL ACTIONS (New - from useArrangementV2Store) ===
  // ========================================================

  // =================== TRACKS ===================

  addArrangementTrack: async (name) => {
    const tracks = get().arrangementTracks;
    const trackNumber = tracks.length + 1;
    const trackName = name || `Track ${trackNumber}`;

    // ✅ PHASE 2: No color parameter - tracks use alternating dark-light backgrounds
    const newTrack = createArrangementTrack(trackName, tracks.length);
    set({ arrangementTracks: [...tracks, newTrack] });
    get().pushHistory({ type: 'ADD_ARRANGEMENT_TRACK', trackId: newTrack.id });

    // Sync to audio engine if initialized
    const audioEngine = get()._audioEngine || AudioContextService.getAudioEngine();
    if (audioEngine) {
      await get()._syncArrangementTracksToAudioEngine();
    }

    console.log(`➕ Added arrangement track: ${trackName} (${trackColor})`);
    return newTrack.id;
  },

  removeArrangementTrack: async (trackId) => {
    const tracks = get().arrangementTracks;
    const clips = get().arrangementClips;
    const removedTrack = tracks.find(t => t.id === trackId);

    // Remove all clips in this track
    const updatedClips = clips.filter(c => c.trackId !== trackId);

    set({
      arrangementTracks: tracks.filter(t => t.id !== trackId),
      arrangementClips: updatedClips
    });

    get().pushHistory({
      type: 'REMOVE_ARRANGEMENT_TRACK',
      track: removedTrack,
      clips: clips.filter(c => c.trackId === trackId)
    });

    // Remove mixer insert from audio engine
    const audioEngine = get()._audioEngine || AudioContextService.getAudioEngine();
    const trackChannelMap = get()._trackChannelMap;
    const insertId = trackChannelMap.get(trackId);

    if (audioEngine && insertId) {
      audioEngine.removeMixerInsert(insertId);
      console.log(`🗑️ Removed mixer insert ${insertId}`);
      trackChannelMap.delete(trackId);
    }
  },

  updateArrangementTrack: async (trackId, updates) => {
    set({
      arrangementTracks: get().arrangementTracks.map(t =>
        t.id === trackId ? { ...t, ...updates } : t
      )
    });

    // Sync to audio engine if initialized
    const audioEngine = get()._audioEngine || AudioContextService.getAudioEngine();
    const trackChannelMap = get()._trackChannelMap;
    const insertId = trackChannelMap.get(trackId);

    if (audioEngine && insertId) {
      const insert = audioEngine.mixerInserts?.get(insertId);
      if (insert) {
        if (updates.volume !== undefined) {
          const linearGain = Math.pow(10, updates.volume / 20);
          insert.setGain(linearGain);
        }
        if (updates.pan !== undefined) {
          insert.setPan(updates.pan);
        }
        if (updates.name !== undefined) {
          insert.label = updates.name;
        }
      }
    }
  },

  reorderArrangementTracks: (fromIndex, toIndex) => {
    const tracks = [...get().arrangementTracks];
    const [movedTrack] = tracks.splice(fromIndex, 1);
    tracks.splice(toIndex, 0, movedTrack);
    set({ arrangementTracks: tracks });
    get().pushHistory({ type: 'REORDER_ARRANGEMENT_TRACKS', fromIndex, toIndex });
  },

  // =================== CLIPS ===================

  addArrangementClip: (clip) => {
    const newClip = { ...clip, id: clip.id || `clip-${nanoid(8)}` };

    // Increment asset reference count for audio clips
    if (newClip.type === 'audio' && newClip.assetId) {
      audioAssetManager.addAssetReference(newClip.assetId);
    }

    set({ arrangementClips: [...get().arrangementClips, newClip] });
    get().pushHistory({ type: 'ADD_ARRANGEMENT_CLIP', clipId: newClip.id });
    return newClip.id;
  },

  addArrangementAudioClip: (trackId, startTime, assetId, duration, name) => {
    const clip = createAudioClip(trackId, startTime, assetId, duration, name);
    return get().addArrangementClip(clip);
  },

  addArrangementPatternClip: (trackId, startTime, patternId, duration, instrumentId, name) => {
    const clip = createPatternClip(trackId, startTime, patternId, duration, instrumentId, name);
    return get().addArrangementClip(clip);
  },

  removeArrangementClip: (clipId) => {
    const clip = get().arrangementClips.find(c => c.id === clipId);

    // Decrement asset reference count for audio clips
    if (clip?.type === 'audio' && clip.assetId) {
      audioAssetManager.removeAssetReference(clip.assetId);
    }

    set({ arrangementClips: get().arrangementClips.filter(c => c.id !== clipId) });
    get().pushHistory({ type: 'REMOVE_ARRANGEMENT_CLIP', clip });
  },

  removeArrangementClips: (clipIds) => {
    const clips = get().arrangementClips.filter(c => clipIds.includes(c.id));

    // Decrement asset reference counts
    clips.forEach(clip => {
      if (clip.type === 'audio' && clip.assetId) {
        audioAssetManager.removeAssetReference(clip.assetId);
      }
    });

    set({ arrangementClips: get().arrangementClips.filter(c => !clipIds.includes(c.id)) });
    get().pushHistory({ type: 'REMOVE_ARRANGEMENT_CLIPS', clips });
  },

  updateArrangementClip: (clipId, updates) => {
    const oldClip = get().arrangementClips.find(c => c.id === clipId);
    let updatedClip = null;

    set({
      arrangementClips: get().arrangementClips.map(c => {
        if (c.id === clipId) {
          updatedClip = { ...c, ...updates };
          return updatedClip;
        }
        return c;
      })
    });

    get().pushHistory({ type: 'UPDATE_ARRANGEMENT_CLIP', clipId, oldState: oldClip, newState: updates });

    // Reschedule only the updated clip
    const audioEngine = get()._audioEngine || AudioContextService.getAudioEngine();
    if (audioEngine?.playbackManager && updatedClip) {
      audioEngine.playbackManager.rescheduleClipEvents(updatedClip);
    }
  },

  duplicateArrangementClips: (clipIds, offsetBeats = 0) => {
    const clips = get().arrangementClips.filter(c => clipIds.includes(c.id));
    const newClips = clips.map(clip => ({
      ...clip,
      id: `clip-${nanoid(8)}`,
      startTime: clip.startTime + (offsetBeats || clip.duration)
    }));

    set({ arrangementClips: [...get().arrangementClips, ...newClips] });
    get().pushHistory({ type: 'DUPLICATE_ARRANGEMENT_CLIPS', clipIds, newClipIds: newClips.map(c => c.id) });

    return newClips.map(c => c.id);
  },

  splitArrangementClip: (clipId, splitPosition) => {
    const clip = get().arrangementClips.find(c => c.id === clipId);
    if (!clip) return null;

    const splitPoint = splitPosition - clip.startTime;
    if (splitPoint <= 0 || splitPoint >= clip.duration) return null;

    // Get current BPM from TimelineController
    let currentBPM = 140;
    try {
      const timelineController = getTimelineController();
      currentBPM = timelineController.state?.bpm || 140;
    } catch (e) {
      // TimelineController not initialized, use default
    }

    // Create two new clips
    const leftClip = {
      ...clip,
      id: `clip-${nanoid(8)}`,
      duration: splitPoint
    };

    const rightClip = {
      ...clip,
      id: `clip-${nanoid(8)}`,
      startTime: clip.startTime + splitPoint,
      duration: clip.duration - splitPoint
    };

    // For audio clips, adjust sample offset for right clip
    if (clip.type === 'audio') {
      const secondsPerBeat = 60 / currentBPM;
      const splitTimeInSeconds = splitPoint * secondsPerBeat;
      rightClip.sampleOffset = (clip.sampleOffset || 0) + splitTimeInSeconds;

      if (clip.assetId) {
        audioAssetManager.addAssetReference(clip.assetId); // For leftClip
        audioAssetManager.addAssetReference(clip.assetId); // For rightClip
      }
    }

    // ✅ FIX: For pattern clips, adjust pattern offset for right clip
    // This ensures notes in the right clip start from the split point, not from the beginning
    if (clip.type === 'pattern') {
      // Convert split point from beats to steps (16th notes)
      // 1 beat = 4 sixteenth notes
      const splitPointSteps = Math.floor(splitPoint * 4);
      const currentPatternOffset = clip.patternOffset || 0;
      rightClip.patternOffset = currentPatternOffset + splitPointSteps;

      // ✅ DEBUG: Log pattern offset calculation for debugging
      console.log(`✂️ Split pattern clip: ${clip.id}`, {
        splitPointBeats: splitPoint,
        splitPointSteps,
        currentPatternOffset,
        newRightClipPatternOffset: rightClip.patternOffset,
        leftClipPatternOffset: leftClip.patternOffset || 0,
        leftClipDuration: leftClip.duration,
        rightClipDuration: rightClip.duration
      });
    }

    // Remove original clip
    get().removeArrangementClip(clipId);

    // Add two new clips
    set({
      arrangementClips: [...get().arrangementClips, leftClip, rightClip]
    });

    get().pushHistory({
      type: 'SPLIT_ARRANGEMENT_CLIP',
      originalClip: clip,
      leftClipId: leftClip.id,
      rightClipId: rightClip.id
    });

    return [leftClip.id, rightClip.id];
  },

  // =================== SELECTION ===================

  setArrangementSelection: (clipIds) => {
    set({ selectedClipIds: Array.isArray(clipIds) ? clipIds : [clipIds] });
  },

  addToArrangementSelection: (clipIds) => {
    const toAdd = Array.isArray(clipIds) ? clipIds : [clipIds];
    set({ selectedClipIds: [...new Set([...get().selectedClipIds, ...toAdd])] });
  },

  removeFromArrangementSelection: (clipIds) => {
    const toRemove = Array.isArray(clipIds) ? clipIds : [clipIds];
    set({ selectedClipIds: get().selectedClipIds.filter(id => !toRemove.includes(id)) });
  },

  toggleArrangementSelection: (clipId) => {
    const selected = get().selectedClipIds;
    if (selected.includes(clipId)) {
      set({ selectedClipIds: selected.filter(id => id !== clipId) });
    } else {
      set({ selectedClipIds: [...selected, clipId] });
    }
  },

  clearArrangementSelection: () => {
    set({ selectedClipIds: [] });
  },

  selectAllArrangementClips: () => {
    set({ selectedClipIds: get().arrangementClips.map(c => c.id) });
  },

  // =================== CLIPBOARD ===================

  copyArrangementSelection: () => {
    const clips = get().arrangementClips.filter(c => get().selectedClipIds.includes(c.id));
    if (clips.length === 0) return;

    const minStartTime = Math.min(...clips.map(c => c.startTime));
    set({
      clipboard: clips.map(c => ({
        ...c,
        startTime: c.startTime - minStartTime
      }))
    });
  },

  cutArrangementSelection: () => {
    get().copyArrangementSelection();
    get().removeArrangementClips(get().selectedClipIds);
    set({ selectedClipIds: [] });
  },

  pasteArrangementClips: (cursorPosition) => {
    const clipboard = get().clipboard;
    if (!clipboard || clipboard.length === 0) return;

    const newClips = clipboard.map(clip => ({
      ...clip,
      id: `clip-${nanoid(8)}`,
      startTime: cursorPosition + clip.startTime
    }));

    set({ arrangementClips: [...get().arrangementClips, ...newClips] });
    set({ selectedClipIds: newClips.map(c => c.id) });

    get().pushHistory({ type: 'PASTE_ARRANGEMENT_CLIPS', clipIds: newClips.map(c => c.id) });
  },

  // =================== MARKERS ===================

  addArrangementMarker: (time, label, color) => {
    const marker = createMarker(time, label, color);
    set({
      arrangementMarkers: [...get().arrangementMarkers, marker].sort((a, b) => a.time - b.time)
    });
    get().pushHistory({ type: 'ADD_ARRANGEMENT_MARKER', markerId: marker.id });
    return marker.id;
  },

  removeArrangementMarker: (markerId) => {
    const marker = get().arrangementMarkers.find(m => m.id === markerId);
    set({ arrangementMarkers: get().arrangementMarkers.filter(m => m.id !== markerId) });
    get().pushHistory({ type: 'REMOVE_ARRANGEMENT_MARKER', marker });
  },

  updateArrangementMarker: (markerId, updates) => {
    const oldMarker = get().arrangementMarkers.find(m => m.id === markerId);
    set({
      arrangementMarkers: get().arrangementMarkers.map(m =>
        m.id === markerId ? { ...m, ...updates } : m
      ).sort((a, b) => a.time - b.time)
    });
    get().pushHistory({ type: 'UPDATE_ARRANGEMENT_MARKER', markerId, oldMarker, updates });
  },

  // =================== LOOP REGIONS ===================

  addArrangementLoopRegion: async (startTime, endTime, label, color) => {
    const region = createLoopRegion(startTime, endTime, label, color);
    set({
      arrangementLoopRegions: [...get().arrangementLoopRegions, region].sort((a, b) => a.startTime - b.startTime)
    });
    get().pushHistory({ type: 'ADD_ARRANGEMENT_LOOP_REGION', regionId: region.id });

    // Sync with TimelineController if available
    try {
      const timelineController = getTimelineController();
      if (timelineController) {
        // Convert beats to steps (1 beat = 4 steps)
        const startInSteps = startTime * 4;
        const endInSteps = endTime * 4;
        await timelineController.setLoopRange(startInSteps, endInSteps);
        if (!timelineController.state.loopEnabled) {
          await timelineController.setLoopEnabled(true);
        }
      }
    } catch (e) {
      // TimelineController not initialized
    }

    return region.id;
  },

  removeArrangementLoopRegion: async (regionId) => {
    const region = get().arrangementLoopRegions.find(r => r.id === regionId);
    set({ arrangementLoopRegions: get().arrangementLoopRegions.filter(r => r.id !== regionId) });
    get().pushHistory({ type: 'REMOVE_ARRANGEMENT_LOOP_REGION', region });
  },

  updateArrangementLoopRegion: async (regionId, updates) => {
    const oldRegion = get().arrangementLoopRegions.find(r => r.id === regionId);
    set({
      arrangementLoopRegions: get().arrangementLoopRegions.map(r =>
        r.id === regionId ? { ...r, ...updates } : r
      ).sort((a, b) => a.startTime - b.startTime)
    });
    get().pushHistory({ type: 'UPDATE_ARRANGEMENT_LOOP_REGION', regionId, oldRegion, updates });

    // Sync with TimelineController if this is active loop
    try {
      const timelineController = getTimelineController();
      if (timelineController && timelineController.state.loopEnabled) {
        const updatedRegion = get().arrangementLoopRegions.find(r => r.id === regionId);
        if (updatedRegion) {
          const startInSteps = updatedRegion.startTime * 4;
          const endInSteps = updatedRegion.endTime * 4;
          await timelineController.setLoopRange(startInSteps, endInSteps);
        }
      }
    } catch (e) {
      // TimelineController not initialized
    }
  },

  // =================== VIEWPORT ===================

  setArrangementZoom: (axis, value) => {
    const clampedValue = Math.max(0.1, Math.min(10, value));
    set({
      zoom: {
        ...get().zoom,
        [axis]: clampedValue
      }
    });
  },

  setArrangementViewportOffset: (x, y) => {
    set({ viewportOffset: { x, y } });
  },

  setArrangementSnapEnabled: (enabled) => {
    set({ snapEnabled: enabled });
  },

  setArrangementSnapSize: (size) => {
    set({ snapSize: size });
  },

  // =================== HISTORY ===================

  pushHistory: (action) => {
    const history = get().history;
    const past = [...history.past, action];

    if (past.length > history.maxSize) {
      past.shift();
    }

    set({
      history: {
        ...history,
        past,
        future: []
      }
    });
  },

  undo: () => {
    const history = get().history;
    if (history.past.length === 0) return;

    const action = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, -1);

    // TODO: Implement undo logic for each action type
    console.log('Undo:', action);

    set({
      history: {
        ...history,
        past: newPast,
        future: [action, ...history.future]
      }
    });
  },

  redo: () => {
    const history = get().history;
    if (history.future.length === 0) return;

    const action = history.future[0];
    const newFuture = history.future.slice(1);

    // TODO: Implement redo logic for each action type
    console.log('Redo:', action);

    set({
      history: {
        ...history,
        past: [...history.past, action],
        future: newFuture
      }
    });
  },

  // =================== AUDIO ENGINE INTEGRATION ===================

  _syncArrangementTracksToAudioEngine: async () => {
    const audioEngine = get()._audioEngine || AudioContextService.getAudioEngine();
    const tracks = get().arrangementTracks;
    const trackChannelMap = get()._trackChannelMap;

    if (!audioEngine) {
      set({ _audioEngine: audioEngine });
      return;
    }

    console.log('🎛️ Syncing arrangement tracks to audio engine...');

    for (const track of tracks) {
      let insertId = trackChannelMap.get(track.id);

      if (!insertId) {
        insertId = `arr-${track.id}`;

        try {
          const existingInsert = audioEngine.mixerInserts?.get(insertId);

          if (!existingInsert) {
            audioEngine.createMixerInsert(insertId, track.name);
            console.log(`✅ Created mixer insert for track "${track.name}" (${insertId})`);
          }

          trackChannelMap.set(track.id, insertId);
        } catch (error) {
          console.error(`❌ Failed to create mixer insert for track ${track.name}:`, error);
          continue;
        }
      }

      const insert = audioEngine.mixerInserts?.get(insertId);
      if (insert) {
        const linearGain = Math.pow(10, track.volume / 20);
        insert.setGain(linearGain);
        insert.setPan(track.pan);
      }
    }

    set({ _trackChannelMap: trackChannelMap, _audioEngine: audioEngine });
    console.log(`🎛️ Synced ${tracks.length} arrangement tracks to audio engine`);
  },

  // =================== UTILITIES ===================

  getArrangementClipById: (clipId) => {
    return get().arrangementClips.find(c => c.id === clipId);
  },

  getArrangementClipsByTrack: (trackId) => {
    return get().arrangementClips.filter(c => c.trackId === trackId);
  },

  getSelectedArrangementClips: () => {
    return get().arrangementClips.filter(c => get().selectedClipIds.includes(c.id));
  },

  getArrangementTrackById: (trackId) => {
    return get().arrangementTracks.find(t => t.id === trackId);
  }

})));
