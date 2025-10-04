/**
 * 🎵 ARRANGEMENT WORKSPACE STORE
 *
 * Advanced multi-arrangement workspace system with:
 * - Multiple arrangement tabs/sheets
 * - Pattern library integration
 * - Audio file browser integration
 * - Advanced editing tools (duplicate, rename, etc.)
 * - Inspiring and free workspace design
 */

import { create } from 'zustand';
import { useArrangementStore } from './useArrangementStore';

const createInitialArrangement = (id, name) => ({
  id,
  name,
  created: Date.now(),
  modified: Date.now(),
  tracks: [
    { id: 'track-1', name: 'Track 1', color: '#00ff88', height: 60, muted: false, solo: false, locked: false, volume: 1.0, pan: 0 },
    { id: 'track-2', name: 'Track 2', color: '#ff6b6b', height: 60, muted: false, solo: false, locked: false, volume: 1.0, pan: 0 },
    { id: 'track-3', name: 'Track 3', color: '#4ecdc4', height: 60, muted: false, solo: false, locked: false, volume: 1.0, pan: 0 },
    { id: 'track-4', name: 'Track 4', color: '#45b7d1', height: 60, muted: false, solo: false, locked: false, volume: 1.0, pan: 0 },
    { id: 'track-5', name: 'Track 5', color: '#f7b731', height: 60, muted: false, solo: false, locked: false, volume: 1.0, pan: 0 },
    { id: 'track-6', name: 'Track 6', color: '#a55eea', height: 60, muted: false, solo: false, locked: false, volume: 1.0, pan: 0 },
    { id: 'track-7', name: 'Track 7', color: '#fc5c65', height: 60, muted: false, solo: false, locked: false, volume: 1.0, pan: 0 },
    { id: 'track-8', name: 'Track 8', color: '#26de81', height: 60, muted: false, solo: false, locked: false, volume: 1.0, pan: 0 },
  ],
  clips: [],
  tempo: 140,
  timeSignature: [4, 4],
  length: 128, // bars
  loopStart: 0,
  loopEnd: 32,
  color: '#00ff88',
  tags: [],
  metadata: {
    author: '',
    description: '',
    genre: '',
    key: 'C',
    version: '1.0'
  }
});

export const useArrangementWorkspaceStore = create((set, get) => ({
  // =================== STATE ===================

  // Multi-arrangement system
  arrangements: {
    'arr-1': createInitialArrangement('arr-1', 'Main Arrangement'),
  },

  activeArrangementId: 'arr-1',
  nextArrangementNumber: 2,

  // Workspace layout
  leftPanelWidth: 300,
  rightPanelWidth: 350,
  trackHeight: 60,
  zoom: { x: 1, y: 1 },

  // Canvas settings
  snapMode: 'grid', // 'off', 'grid', 'events'
  gridSize: '1/4', // Grid subdivision: '1/1', '1/2', '1/4', '1/8', '1/16', '1/32'
  editMode: 'select', // 'select', 'draw', 'split'

  // Library and browser
  patternLibrary: {
    isOpen: true,
    selectedCategory: 'all', // all, drums, bass, lead, fx
    searchQuery: '',
    sortBy: 'name', // name, date, usage
  },

  audioFileBrowser: {
    isOpen: true,
    currentPath: '/',
    selectedFiles: [],
    uploadedFiles: [],
    collections: ['Drums', 'Bass', 'Vocals', 'FX', 'Loops'],
    activeCollection: 'all'
  },

  // Advanced editing
  clipboard: null,
  selection: {
    clips: [],
    tracks: [],
    timeRange: null
  },

  history: {
    past: [],
    future: [],
    maxHistory: 50
  },

  // =================== ARRANGEMENT MANAGEMENT ===================

  /**
   * Create new arrangement
   */
  createArrangement: (name) => {
    const id = `arr-${get().nextArrangementNumber}`;
    const newArrangement = createInitialArrangement(
      id,
      name || `Arrangement ${get().nextArrangementNumber}`
    );

    set(state => ({
      arrangements: { ...state.arrangements, [id]: newArrangement },
      activeArrangementId: id,
      nextArrangementNumber: state.nextArrangementNumber + 1
    }));

    console.log(`🎵 Created arrangement: ${newArrangement.name}`);
    return id;
  },

  /**
   * Duplicate arrangement
   */
  duplicateArrangement: (arrangementId) => {
    const original = get().arrangements[arrangementId];
    if (!original) return null;

    const id = `arr-${get().nextArrangementNumber}`;
    const duplicated = {
      ...original,
      id,
      name: `${original.name} (Copy)`,
      created: Date.now(),
      modified: Date.now(),
      // Deep clone tracks and clips
      tracks: original.tracks.map(track => ({ ...track, id: `${track.id}_copy` })),
      clips: original.clips.map(clip => ({ ...clip, id: `${clip.id}_copy` }))
    };

    set(state => ({
      arrangements: { ...state.arrangements, [id]: duplicated },
      activeArrangementId: id,
      nextArrangementNumber: state.nextArrangementNumber + 1
    }));

    console.log(`🎵 Duplicated arrangement: ${duplicated.name}`);
    return id;
  },

  /**
   * Rename arrangement
   */
  renameArrangement: (arrangementId, newName) => {
    set(state => ({
      arrangements: {
        ...state.arrangements,
        [arrangementId]: {
          ...state.arrangements[arrangementId],
          name: newName,
          modified: Date.now()
        }
      }
    }));

    console.log(`🎵 Renamed arrangement ${arrangementId} to: ${newName}`);
  },

  /**
   * Delete arrangement
   */
  deleteArrangement: (arrangementId) => {
    const arrangements = get().arrangements;
    const arrangementIds = Object.keys(arrangements);

    // Don't delete if it's the last arrangement
    if (arrangementIds.length <= 1) {
      console.warn('🎵 Cannot delete the last arrangement');
      return false;
    }

    delete arrangements[arrangementId];

    // Switch to another arrangement if deleting active one
    let newActiveId = get().activeArrangementId;
    if (arrangementId === get().activeArrangementId) {
      newActiveId = arrangementIds.find(id => id !== arrangementId);
    }

    set(state => ({
      arrangements: { ...arrangements },
      activeArrangementId: newActiveId
    }));

    console.log(`🎵 Deleted arrangement: ${arrangementId}`);
    return true;
  },

  /**
   * Switch active arrangement
   */
  setActiveArrangement: (arrangementId) => {
    if (!get().arrangements[arrangementId]) return false;

    set({ activeArrangementId: arrangementId });
    console.log(`🎵 Switched to arrangement: ${arrangementId}`);
    return true;
  },

  /**
   * Update arrangement metadata
   */
  updateArrangementMetadata: (arrangementId, metadata) => {
    set(state => ({
      arrangements: {
        ...state.arrangements,
        [arrangementId]: {
          ...state.arrangements[arrangementId],
          metadata: { ...state.arrangements[arrangementId].metadata, ...metadata },
          modified: Date.now()
        }
      }
    }));
  },

  // =================== TRACK MANAGEMENT ===================

  /**
   * Add new track to active arrangement
   */
  addTrack: (trackName) => {
    const activeArrangementId = get().activeArrangementId;
    const arrangement = get().arrangements[activeArrangementId];

    if (!arrangement) return null;

    // Color palette for tracks
    const trackColors = [
      '#00ff88', '#ff6b6b', '#4ecdc4', '#45b7d1',
      '#f7b731', '#a55eea', '#fc5c65', '#26de81',
      '#fd79a8', '#fdcb6e', '#6c5ce7', '#00b894'
    ];

    const trackNumber = arrangement.tracks.length + 1;
    const trackColor = trackColors[arrangement.tracks.length % trackColors.length];

    const newTrack = {
      id: `track-${Date.now()}`,
      name: trackName || `Track ${trackNumber}`,
      color: trackColor,
      height: 60,
      muted: false,
      solo: false,
      locked: false,
      volume: 1.0,
      pan: 0
    };

    set(state => ({
      arrangements: {
        ...state.arrangements,
        [activeArrangementId]: {
          ...state.arrangements[activeArrangementId],
          tracks: [...state.arrangements[activeArrangementId].tracks, newTrack],
          modified: Date.now()
        }
      }
    }));

    console.log(`🎵 Added track: ${newTrack.name}`);
    return newTrack.id;
  },

  /**
   * Ensure track exists at specific index (auto-create if virtual)
   */
  ensureTrackAtIndex: (trackIndex) => {
    const activeArrangementId = get().activeArrangementId;
    const arrangement = get().arrangements[activeArrangementId];

    if (!arrangement) return null;

    // Eğer track zaten varsa, onun ID'sini döndür
    if (arrangement.tracks[trackIndex]) {
      return arrangement.tracks[trackIndex].id;
    }

    // Virtual track - eksik track'leri doldur
    const trackColors = [
      '#00ff88', '#ff6b6b', '#4ecdc4', '#45b7d1',
      '#f7b731', '#a55eea', '#fc5c65', '#26de81',
      '#fd79a8', '#fdcb6e', '#6c5ce7', '#00b894'
    ];

    const newTracks = [...arrangement.tracks];
    const tracksToCreate = trackIndex - arrangement.tracks.length + 1;

    // Eksik track'leri oluştur
    for (let i = 0; i < tracksToCreate; i++) {
      const trackNumber = newTracks.length + 1;
      const trackColor = trackColors[newTracks.length % trackColors.length];

      const newTrack = {
        id: `track-${Date.now()}-${i}`,
        name: `Track ${trackNumber}`,
        color: trackColor,
        height: 60,
        muted: false,
        solo: false,
        locked: false,
        volume: 1.0,
        pan: 0
      };

      newTracks.push(newTrack);
    }

    set(state => ({
      arrangements: {
        ...state.arrangements,
        [activeArrangementId]: {
          ...state.arrangements[activeArrangementId],
          tracks: newTracks,
          modified: Date.now()
        }
      }
    }));

    console.log(`🎵 Auto-created ${tracksToCreate} tracks up to index ${trackIndex}`);
    return newTracks[trackIndex].id;
  },

  /**
   * Remove track from active arrangement
   */
  removeTrack: (trackId) => {
    const activeArrangementId = get().activeArrangementId;
    const arrangement = get().arrangements[activeArrangementId];

    if (!arrangement) return false;

    // Remove all clips on this track
    const updatedClips = arrangement.clips.filter(clip => clip.trackId !== trackId);
    const updatedTracks = arrangement.tracks.filter(track => track.id !== trackId);

    set(state => ({
      arrangements: {
        ...state.arrangements,
        [activeArrangementId]: {
          ...state.arrangements[activeArrangementId],
          tracks: updatedTracks,
          clips: updatedClips,
          modified: Date.now()
        }
      }
    }));

    console.log(`🎵 Removed track: ${trackId}`);
    return true;
  },

  /**
   * Update track properties
   */
  updateTrack: (trackId, updates) => {
    const activeArrangementId = get().activeArrangementId;

    set(state => ({
      arrangements: {
        ...state.arrangements,
        [activeArrangementId]: {
          ...state.arrangements[activeArrangementId],
          tracks: state.arrangements[activeArrangementId].tracks.map(track =>
            track.id === trackId ? { ...track, ...updates } : track
          ),
          modified: Date.now()
        }
      }
    }));
  },

  // =================== CLIP MANAGEMENT ===================

  /**
   * Add clip to arrangement
   */
  addClip: (clipData) => {
    const activeArrangementId = get().activeArrangementId;

    const newClip = {
      id: `clip-${Date.now()}`,
      type: clipData.type || 'pattern', // 'pattern' or 'audio'
      patternId: clipData.patternId,
      trackId: clipData.trackId,
      startTime: clipData.startTime || 0,
      duration: clipData.duration || 4,
      color: clipData.color || '#00ff88',
      name: clipData.name || 'Clip',
      ...clipData
    };

    set(state => ({
      arrangements: {
        ...state.arrangements,
        [activeArrangementId]: {
          ...state.arrangements[activeArrangementId],
          clips: [...state.arrangements[activeArrangementId].clips, newClip],
          modified: Date.now()
        }
      }
    }));

    console.log(`🎵 Added clip: ${newClip.name}`);
    return newClip.id;
  },

  /**
   * Update clip properties
   */
  updateClip: (clipId, updates) => {
    const activeArrangementId = get().activeArrangementId;

    set(state => ({
      arrangements: {
        ...state.arrangements,
        [activeArrangementId]: {
          ...state.arrangements[activeArrangementId],
          clips: state.arrangements[activeArrangementId].clips.map(clip =>
            clip.id === clipId ? { ...clip, ...updates } : clip
          ),
          modified: Date.now()
        }
      }
    }));
  },

  /**
   * Delete clip from arrangement
   */
  deleteClip: (clipId) => {
    const activeArrangementId = get().activeArrangementId;

    set(state => ({
      arrangements: {
        ...state.arrangements,
        [activeArrangementId]: {
          ...state.arrangements[activeArrangementId],
          clips: state.arrangements[activeArrangementId].clips.filter(
            clip => clip.id !== clipId
          ),
          modified: Date.now()
        }
      },
      selection: {
        ...state.selection,
        clips: state.selection.clips.filter(id => id !== clipId)
      }
    }));

    console.log(`🎵 Deleted clip: ${clipId}`);
  },

  /**
   * Delete selected clips
   */
  deleteSelectedClips: () => {
    const selectedClips = get().selection.clips;
    selectedClips.forEach(clipId => {
      get().deleteClip(clipId);
    });
    get().clearSelection();
  },

  // =================== WORKSPACE LAYOUT ===================

  /**
   * Adjust panel widths
   */
  setPanelWidth: (panel, width) => {
    const key = panel === 'left' ? 'leftPanelWidth' : 'rightPanelWidth';
    set({ [key]: Math.max(200, Math.min(500, width)) });
  },

  /**
   * Set zoom levels
   */
  setZoom: (zoomX, zoomY) => {
    set({
      zoom: {
        x: Math.max(0.1, Math.min(10, zoomX)),
        y: Math.max(0.5, Math.min(3, zoomY || zoomX))
      }
    });
  },

  /**
   * Set track height
   */
  setTrackHeight: (height) => {
    set({ trackHeight: Math.max(40, Math.min(120, height)) });
  },

  // =================== PATTERN LIBRARY ===================

  /**
   * Toggle pattern library
   */
  togglePatternLibrary: () => {
    set(state => ({
      patternLibrary: {
        ...state.patternLibrary,
        isOpen: !state.patternLibrary.isOpen
      }
    }));
  },

  /**
   * Set pattern library filter
   */
  setPatternLibraryFilter: (category, searchQuery) => {
    set(state => ({
      patternLibrary: {
        ...state.patternLibrary,
        selectedCategory: category || state.patternLibrary.selectedCategory,
        searchQuery: searchQuery !== undefined ? searchQuery : state.patternLibrary.searchQuery
      }
    }));
  },

  // =================== CANVAS SETTINGS ===================

  /**
   * Set snap mode
   */
  setSnapMode: (mode) => {
    set({ snapMode: mode });
  },

  /**
   * Set grid size
   */
  setGridSize: (size) => {
    set({ gridSize: size });
  },

  /**
   * Set edit mode
   */
  setEditMode: (mode) => {
    set({ editMode: mode });
  },

  // =================== AUDIO FILE BROWSER ===================

  /**
   * Toggle audio file browser
   */
  toggleAudioFileBrowser: () => {
    set(state => ({
      audioFileBrowser: {
        ...state.audioFileBrowser,
        isOpen: !state.audioFileBrowser.isOpen
      }
    }));
  },

  /**
   * Add uploaded files to browser
   */
  addUploadedFiles: (files) => {
    set(state => ({
      audioFileBrowser: {
        ...state.audioFileBrowser,
        uploadedFiles: [...state.audioFileBrowser.uploadedFiles, ...files]
      }
    }));
  },

  /**
   * Set audio file collection
   */
  setAudioFileCollection: (collection) => {
    set(state => ({
      audioFileBrowser: {
        ...state.audioFileBrowser,
        activeCollection: collection
      }
    }));
  },

  /**
   * Select audio files
   */
  selectAudioFiles: (fileIds, multiSelect = false) => {
    set(state => ({
      audioFileBrowser: {
        ...state.audioFileBrowser,
        selectedFiles: multiSelect
          ? [...new Set([...state.audioFileBrowser.selectedFiles, ...fileIds])]
          : fileIds
      }
    }));
  },

  // =================== ADVANCED EDITING ===================

  /**
   * Copy selection to clipboard
   */
  copySelection: () => {
    const selection = get().selection;
    const activeArrangement = get().arrangements[get().activeArrangementId];

    if (selection.clips.length > 0) {
      const copiedClips = selection.clips.map(clipId =>
        activeArrangement.clips.find(clip => clip.id === clipId)
      ).filter(Boolean);

      set({
        clipboard: {
          type: 'clips',
          data: copiedClips,
          timestamp: Date.now()
        }
      });

      console.log(`🎵 Copied ${copiedClips.length} clips to clipboard`);
    }
  },

  /**
   * Paste from clipboard
   */
  pasteFromClipboard: (targetTime = 0) => {
    const clipboard = get().clipboard;
    if (!clipboard || clipboard.type !== 'clips') return;

    const activeArrangementId = get().activeArrangementId;
    const newClips = clipboard.data.map(clip => ({
      ...clip,
      id: `${clip.id}_paste_${Date.now()}`,
      startTime: targetTime + (clip.startTime - clipboard.data[0].startTime)
    }));

    // Add clips to active arrangement
    set(state => ({
      arrangements: {
        ...state.arrangements,
        [activeArrangementId]: {
          ...state.arrangements[activeArrangementId],
          clips: [...state.arrangements[activeArrangementId].clips, ...newClips],
          modified: Date.now()
        }
      }
    }));

    console.log(`🎵 Pasted ${newClips.length} clips at time ${targetTime}`);
  },

  /**
   * Select clips
   */
  selectClips: (clipIds, multiSelect = false) => {
    set(state => ({
      selection: {
        ...state.selection,
        clips: multiSelect
          ? [...new Set([...state.selection.clips, ...clipIds])]
          : clipIds
      }
    }));
  },

  /**
   * Clear selection
   */
  clearSelection: () => {
    set(state => ({
      selection: {
        clips: [],
        tracks: [],
        timeRange: null
      }
    }));
  },

  // =================== UTILITY METHODS ===================

  /**
   * Get active arrangement
   */
  getActiveArrangement: () => {
    return get().arrangements[get().activeArrangementId];
  },

  /**
   * Get filtered patterns for library
   */
  getFilteredPatterns: () => {
    const { patternLibrary } = get();
    const allPatterns = useArrangementStore.getState().patterns;

    let filtered = Object.values(allPatterns);

    // Filter by category
    if (patternLibrary.selectedCategory !== 'all') {
      filtered = filtered.filter(pattern =>
        pattern.category === patternLibrary.selectedCategory ||
        pattern.tags?.includes(patternLibrary.selectedCategory)
      );
    }

    // Filter by search query
    if (patternLibrary.searchQuery) {
      const query = patternLibrary.searchQuery.toLowerCase();
      filtered = filtered.filter(pattern =>
        pattern.name.toLowerCase().includes(query) ||
        pattern.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (patternLibrary.sortBy) {
        case 'date':
          return (b.modified || 0) - (a.modified || 0);
        case 'usage':
          return (b.usageCount || 0) - (a.usageCount || 0);
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  },

  /**
   * Get filtered audio files for browser
   */
  getFilteredAudioFiles: () => {
    const { audioFileBrowser } = get();

    let filtered = audioFileBrowser.uploadedFiles;

    // Filter by collection
    if (audioFileBrowser.activeCollection !== 'all') {
      filtered = filtered.filter(file =>
        file.collection === audioFileBrowser.activeCollection ||
        file.tags?.includes(audioFileBrowser.activeCollection.toLowerCase())
      );
    }

    return filtered;
  }
}));

export default useArrangementWorkspaceStore;