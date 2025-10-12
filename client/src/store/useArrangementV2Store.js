/**
 * 🎵 ARRANGEMENT V2 STORE
 *
 * Clean, modern state management for Arrangement Panel V2
 * - Tracks and clips management
 * - Selection and clipboard
 * - Playback state
 * - View and zoom
 * - History (undo/redo)
 */

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import TransportManagerSingleton from '@/lib/core/TransportManagerSingleton.js';
import { AudioContextService } from '@/lib/services/AudioContextService.js';
import { audioAssetManager } from '@/lib/audio/AudioAssetManager.js';

// ============================================================================
// HELPERS
// ============================================================================

const createTrack = (name, color, index) => ({
  id: `track-${nanoid(8)}`,
  name: name || `Track ${index + 1}`,
  color: color || '#8b5cf6',
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
  color: '#8b5cf6',
  muted: false,
  locked: false,

  // Shared editing system
  isUnique: false, // false = inherit from asset metadata, true = independent
  uniqueMetadata: null, // { mixerChannelId, precomputed } - only used if isUnique = true
  mixerChannelId: null // DEPRECATED: kept for backward compatibility, will be removed
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
  color: '#3b82f6',
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

// ============================================================================
// STORE
// ============================================================================

// Track colors palette
const TRACK_COLORS = [
  '#f43f5e', // Red
  '#8b5cf6', // Purple
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Green
  '#f59e0b', // Orange
  '#ec4899', // Pink
  '#6366f1', // Indigo
];

// Initialize tracks first so we can reference them for clips
const initialTracks = [
  createTrack('Track 1', TRACK_COLORS[0], 0),
  createTrack('Track 2', TRACK_COLORS[1], 1),
  createTrack('Track 3', TRACK_COLORS[2], 2),
  createTrack('Track 4', TRACK_COLORS[3], 3),
];

export const useArrangementV2Store = create((set, get) => ({
  // =================== TRACKS ===================

  tracks: initialTracks,

  addTrack: async (name, color) => {
    const tracks = get().tracks;
    // Auto-generate name if not provided: Track 5, Track 6, etc.
    const trackNumber = tracks.length + 1;
    const trackName = name || `Track ${trackNumber}`;
    // Auto-select color from palette if not provided
    const trackColor = color || TRACK_COLORS[tracks.length % TRACK_COLORS.length];

    const newTrack = createTrack(trackName, trackColor, tracks.length);
    set({ tracks: [...tracks, newTrack] });
    get().pushHistory({ type: 'ADD_TRACK', trackId: newTrack.id });

    // Sync to audio engine if initialized
    if (get()._audioEngine) {
      await get()._syncTracksToAudioEngine();
    }

    console.log(`➕ Added track: ${trackName} (${trackColor})`);
    return newTrack.id;
  },

  removeTrack: async (trackId) => {
    const tracks = get().tracks;
    const clips = get().clips;

    // Remove all clips in this track
    const updatedClips = clips.filter(c => c.trackId !== trackId);
    const removedTrack = tracks.find(t => t.id === trackId);

    set({
      tracks: tracks.filter(t => t.id !== trackId),
      clips: updatedClips
    });

    get().pushHistory({ type: 'REMOVE_TRACK', track: removedTrack, clips: clips.filter(c => c.trackId === trackId) });

    // Remove mixer channel from audio engine
    const audioEngine = get()._audioEngine;
    const trackChannelMap = get()._trackChannelMap;
    const channelId = trackChannelMap.get(trackId);

    if (audioEngine && channelId) {
      const channel = audioEngine.mixerChannels.get(channelId);
      if (channel) {
        channel.disconnect();
        audioEngine.mixerChannels.delete(channelId);
        console.log(`🗑️ Removed mixer channel ${channelId}`);
      }
      trackChannelMap.delete(trackId);
    }
  },

  updateTrack: async (trackId, updates) => {
    set({
      tracks: get().tracks.map(t =>
        t.id === trackId ? { ...t, ...updates } : t
      )
    });

    // Sync to audio engine if initialized
    const audioEngine = get()._audioEngine;
    const trackChannelMap = get()._trackChannelMap;
    const channelId = trackChannelMap.get(trackId);

    if (audioEngine && channelId) {
      const channel = audioEngine.mixerChannels.get(channelId);
      if (channel) {
        // Update channel parameters
        if (updates.volume !== undefined) channel.setVolume(updates.volume);
        if (updates.pan !== undefined) channel.setPan(updates.pan);
        if (updates.muted !== undefined) channel.setMute(updates.muted);
        if (updates.solo !== undefined) channel.setSolo(updates.solo);
        if (updates.name !== undefined) channel.name = updates.name;
      }
    }
  },

  reorderTracks: (fromIndex, toIndex) => {
    const tracks = [...get().tracks];
    const [movedTrack] = tracks.splice(fromIndex, 1);
    tracks.splice(toIndex, 0, movedTrack);
    set({ tracks });
    get().pushHistory({ type: 'REORDER_TRACKS', fromIndex, toIndex });
  },

  // =================== CLIPS ===================

  clips: [
    // Start with empty arrangement - clips will be added via drag & drop from FileBrowser
  ],

  // =================== MARKERS ===================

  markers: [],
  loopRegions: [],

  addClip: (clip) => {
    const newClip = { ...clip, id: clip.id || `clip-${nanoid(8)}` };

    // Increment asset reference count for audio clips
    if (newClip.type === 'audio' && newClip.assetId) {
      audioAssetManager.addAssetReference(newClip.assetId);
    }

    set({ clips: [...get().clips, newClip] });
    get().pushHistory({ type: 'ADD_CLIP', clipId: newClip.id });
    return newClip.id;
  },

  addAudioClip: (trackId, startTime, assetId, duration, name) => {
    const clip = createAudioClip(trackId, startTime, assetId, duration, name);
    return get().addClip(clip);
  },

  addPatternClip: (trackId, startTime, patternId, duration, instrumentId, name) => {
    const clip = createPatternClip(trackId, startTime, patternId, duration, instrumentId, name);
    return get().addClip(clip);
  },

  removeClip: (clipId) => {
    const clip = get().clips.find(c => c.id === clipId);

    // Decrement asset reference count for audio clips
    if (clip?.type === 'audio' && clip.assetId) {
      audioAssetManager.removeAssetReference(clip.assetId);
    }

    set({ clips: get().clips.filter(c => c.id !== clipId) });
    get().pushHistory({ type: 'REMOVE_CLIP', clip });
  },

  removeClips: (clipIds) => {
    const clips = get().clips.filter(c => clipIds.includes(c.id));

    // Decrement asset reference counts
    clips.forEach(clip => {
      if (clip.type === 'audio' && clip.assetId) {
        audioAssetManager.removeAssetReference(clip.assetId);
      }
    });

    set({ clips: get().clips.filter(c => !clipIds.includes(c.id)) });
    get().pushHistory({ type: 'REMOVE_CLIPS', clips });
  },

  updateClip: (clipId, updates) => {
    const oldClip = get().clips.find(c => c.id === clipId);
    set({
      clips: get().clips.map(c =>
        c.id === clipId ? { ...c, ...updates } : c
      )
    });
    get().pushHistory({ type: 'UPDATE_CLIP', clipId, oldState: oldClip, newState: updates });
  },

  duplicateClips: (clipIds, offsetBeats = 0) => {
    const clips = get().clips.filter(c => clipIds.includes(c.id));
    const newClips = clips.map(clip => ({
      ...clip,
      id: `clip-${nanoid(8)}`,
      startTime: clip.startTime + (offsetBeats || clip.duration)
    }));

    set({ clips: [...get().clips, ...newClips] });
    get().pushHistory({ type: 'DUPLICATE_CLIPS', clipIds, newClipIds: newClips.map(c => c.id) });

    return newClips.map(c => c.id);
  },

  splitClip: (clipId, splitPosition) => {
    const clip = get().clips.find(c => c.id === clipId);
    if (!clip) return null;

    const splitPoint = splitPosition - clip.startTime;
    if (splitPoint <= 0 || splitPoint >= clip.duration) return null;

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
      const secondsPerBeat = 60 / 140; // TODO: Use actual BPM
      rightClip.sampleOffset = clip.sampleOffset + (splitPoint * secondsPerBeat);
    }

    // Remove original, add two new clips
    set({
      clips: [
        ...get().clips.filter(c => c.id !== clipId),
        leftClip,
        rightClip
      ]
    });

    get().pushHistory({ type: 'SPLIT_CLIP', originalClip: clip, leftClipId: leftClip.id, rightClipId: rightClip.id });

    return [leftClip.id, rightClip.id];
  },

  // =================== MARKERS ===================

  addMarker: (time, label, color) => {
    const marker = createMarker(time, label, color);
    set({ markers: [...get().markers, marker].sort((a, b) => a.time - b.time) });
    get().pushHistory({ type: 'ADD_MARKER', markerId: marker.id });
    return marker.id;
  },

  removeMarker: (markerId) => {
    const marker = get().markers.find(m => m.id === markerId);
    set({ markers: get().markers.filter(m => m.id !== markerId) });
    get().pushHistory({ type: 'REMOVE_MARKER', marker });
  },

  updateMarker: (markerId, updates) => {
    const oldMarker = get().markers.find(m => m.id === markerId);
    set({
      markers: get().markers.map(m =>
        m.id === markerId ? { ...m, ...updates } : m
      ).sort((a, b) => a.time - b.time)
    });
    get().pushHistory({ type: 'UPDATE_MARKER', markerId, oldMarker, updates });
  },

  addLoopRegion: async (startTime, endTime, label, color) => {
    const region = createLoopRegion(startTime, endTime, label, color);
    set({ loopRegions: [...get().loopRegions, region].sort((a, b) => a.startTime - b.startTime) });
    get().pushHistory({ type: 'ADD_LOOP_REGION', regionId: region.id });

    // If this is the first loop region and loop is enabled, set it as active
    const loopRegions = get().loopRegions;
    if (loopRegions.length === 1 && get().loopEnabled) {
      await get().setLoopRegion(startTime, endTime);
    }

    return region.id;
  },

  removeLoopRegion: async (regionId) => {
    const region = get().loopRegions.find(r => r.id === regionId);
    set({ loopRegions: get().loopRegions.filter(r => r.id !== regionId) });
    get().pushHistory({ type: 'REMOVE_LOOP_REGION', region });

    // If we removed the active loop region, disable looping or use next region
    const loopRegions = get().loopRegions;
    const transportManager = get()._transportManager;

    if (transportManager && region) {
      const currentLoopStart = get().loopStart;
      const currentLoopEnd = get().loopEnd;

      // Check if this was the active loop
      if (Math.abs(currentLoopStart - region.startTime) < 0.01 &&
          Math.abs(currentLoopEnd - region.endTime) < 0.01) {

        // Use first remaining loop region, or disable looping
        if (loopRegions.length > 0) {
          await get().setLoopRegion(loopRegions[0].startTime, loopRegions[0].endTime);
        } else {
          await transportManager.setLoopEnabled(false);
        }
      }
    }
  },

  updateLoopRegion: async (regionId, updates) => {
    const oldRegion = get().loopRegions.find(r => r.id === regionId);
    set({
      loopRegions: get().loopRegions.map(r =>
        r.id === regionId ? { ...r, ...updates } : r
      ).sort((a, b) => a.startTime - b.startTime)
    });
    get().pushHistory({ type: 'UPDATE_LOOP_REGION', regionId, oldRegion, updates });

    // If this is the active loop region, update transport manager
    const transportManager = get()._transportManager;
    if (transportManager && oldRegion && get().loopEnabled) {
      const currentLoopStart = get().loopStart;
      const currentLoopEnd = get().loopEnd;

      // Check if this is the active loop
      if (Math.abs(currentLoopStart - oldRegion.startTime) < 0.01 &&
          Math.abs(currentLoopEnd - oldRegion.endTime) < 0.01) {

        const updatedRegion = get().loopRegions.find(r => r.id === regionId);
        if (updatedRegion) {
          await get().setLoopRegion(updatedRegion.startTime, updatedRegion.endTime);
        }
      }
    }
  },

  // Set active loop region (activate a specific loop region)
  setActiveLoopRegion: async (regionId) => {
    const region = get().loopRegions.find(r => r.id === regionId);
    if (region) {
      await get().setLoopRegion(region.startTime, region.endTime);
      if (!get().loopEnabled) {
        await get().toggleLoop();
      }
      console.log(`🔄 Activated loop region "${region.label}"`);
    }
  },

  // =================== SELECTION ===================

  selectedClipIds: [],

  setSelection: (clipIds) => {
    set({ selectedClipIds: Array.isArray(clipIds) ? clipIds : [clipIds] });
  },

  addToSelection: (clipIds) => {
    const toAdd = Array.isArray(clipIds) ? clipIds : [clipIds];
    set({ selectedClipIds: [...new Set([...get().selectedClipIds, ...toAdd])] });
  },

  removeFromSelection: (clipIds) => {
    const toRemove = Array.isArray(clipIds) ? clipIds : [clipIds];
    set({ selectedClipIds: get().selectedClipIds.filter(id => !toRemove.includes(id)) });
  },

  toggleSelection: (clipId) => {
    const selected = get().selectedClipIds;
    if (selected.includes(clipId)) {
      set({ selectedClipIds: selected.filter(id => id !== clipId) });
    } else {
      set({ selectedClipIds: [...selected, clipId] });
    }
  },

  clearSelection: () => {
    set({ selectedClipIds: [] });
  },

  selectAll: () => {
    set({ selectedClipIds: get().clips.map(c => c.id) });
  },

  // =================== CLIPBOARD ===================

  clipboard: null,

  copySelection: () => {
    const clips = get().clips.filter(c => get().selectedClipIds.includes(c.id));
    if (clips.length === 0) return;

    // Store clips with relative positions
    const minStartTime = Math.min(...clips.map(c => c.startTime));
    set({
      clipboard: clips.map(c => ({
        ...c,
        startTime: c.startTime - minStartTime // Store relative position
      }))
    });
  },

  cutSelection: () => {
    get().copySelection();
    get().removeClips(get().selectedClipIds);
    set({ selectedClipIds: [] });
  },

  paste: (cursorPosition) => {
    const clipboard = get().clipboard;
    if (!clipboard || clipboard.length === 0) return;

    const newClips = clipboard.map(clip => ({
      ...clip,
      id: `clip-${nanoid(8)}`,
      startTime: cursorPosition + clip.startTime
    }));

    set({ clips: [...get().clips, ...newClips] });
    set({ selectedClipIds: newClips.map(c => c.id) });

    get().pushHistory({ type: 'PASTE_CLIPS', clipIds: newClips.map(c => c.id) });
  },

  // =================== PLAYBACK ===================

  cursorPosition: 0,
  isPlaying: false,
  loopEnabled: false,
  loopStart: 0,
  loopEnd: 16,
  bpm: 140,

  // Transport manager reference (initialized on first use)
  _transportManager: null,
  _transportSubscription: null,
  _audioEngine: null,
  _trackChannelMap: new Map(), // Map track IDs to mixer channel IDs

  // Initialize transport manager connection
  initializeTransport: async () => {
    try {
      const transportManager = await TransportManagerSingleton.getInstance();
      const audioEngine = AudioContextService.getAudioEngine();

      if (!transportManager || !audioEngine) {
        console.error('❌ Failed to get transport manager or audio engine');
        return false;
      }

      // Subscribe to transport events
      const unsubscribe = transportManager.subscribe((event) => {
        if (event.type === 'position-update') {
          // Convert steps to beats (1 beat = 4 steps in 16th notes)
          const positionInBeats = event.position / 4;
          console.log('🎵 ArrangementV2 position update:', { steps: event.position, beats: positionInBeats });
          set({ cursorPosition: positionInBeats });
        } else if (event.type === 'state-change') {
          // Convert steps to beats
          const currentPositionInBeats = event.state.currentPosition / 4;
          const loopStartInBeats = event.state.loopStart / 4;
          const loopEndInBeats = event.state.loopEnd / 4;

          console.log('🎵 ArrangementV2 state change:', {
            isPlaying: event.state.isPlaying,
            currentPosition: currentPositionInBeats,
            bpm: event.state.bpm
          });

          set({
            isPlaying: event.state.isPlaying,
            cursorPosition: currentPositionInBeats,
            bpm: event.state.bpm,
            loopEnabled: event.state.loopEnabled,
            loopStart: loopStartInBeats,
            loopEnd: loopEndInBeats
          });
        }
      });

      set({
        _transportManager: transportManager,
        _transportSubscription: unsubscribe,
        _audioEngine: audioEngine
      });

      // Sync existing tracks to audio engine
      await get()._syncTracksToAudioEngine();

      console.log('✅ ArrangementV2 transport initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize transport:', error);
      return false;
    }
  },

  // Sync tracks to audio engine mixer channels
  _syncTracksToAudioEngine: async () => {
    const audioEngine = get()._audioEngine;
    const tracks = get().tracks;
    const trackChannelMap = get()._trackChannelMap;

    if (!audioEngine) return;

    console.log('🎛️ Syncing tracks to audio engine...');

    for (const track of tracks) {
      // Check if track already has a channel
      let channelId = trackChannelMap.get(track.id);

      if (!channelId) {
        // Create new mixer channel for this track
        channelId = `arr-${track.id}`;

        try {
          // Check if channel already exists in audio engine
          const existingChannel = audioEngine.mixerChannels.get(channelId);

          if (!existingChannel) {
            await audioEngine._createMixerChannel(channelId, track.name, { type: 'arrangement' });
            console.log(`✅ Created mixer channel for track "${track.name}" (${channelId})`);
          }

          trackChannelMap.set(track.id, channelId);
        } catch (error) {
          console.error(`❌ Failed to create channel for track ${track.name}:`, error);
          continue;
        }
      }

      // Update channel parameters to match track settings
      const channel = audioEngine.mixerChannels.get(channelId);
      if (channel) {
        channel.setVolume(track.volume);
        channel.setPan(track.pan);
        channel.setMute(track.muted);
        channel.setSolo(track.solo);
      }
    }

    set({ _trackChannelMap: trackChannelMap });
    console.log(`🎛️ Synced ${tracks.length} tracks to audio engine`);
  },

  // Cleanup transport connection
  cleanupTransport: () => {
    const subscription = get()._transportSubscription;
    if (subscription) {
      subscription();
      set({ _transportManager: null, _transportSubscription: null });
      console.log('🧹 ArrangementV2 transport cleaned up');
    }
  },

  setCursorPosition: (position) => {
    const transportManager = get()._transportManager;
    if (transportManager) {
      // Convert beats to steps (1 beat = 4 steps in 16th notes)
      const positionInSteps = Math.max(0, position) * 4;
      transportManager.jumpToPosition(positionInSteps);
    } else {
      set({ cursorPosition: Math.max(0, position) });
    }
  },

  play: async () => {
    const transportManager = get()._transportManager;
    if (!transportManager) {
      console.warn('⚠️ Transport not initialized, initializing now...');
      await get().initializeTransport();
    }

    const tm = get()._transportManager;
    if (tm) {
      await tm.play();
    } else {
      console.error('❌ Failed to play: Transport manager not available');
    }
  },

  pause: async () => {
    const transportManager = get()._transportManager;
    if (transportManager) {
      await transportManager.pause();
    } else {
      set({ isPlaying: false });
    }
  },

  stop: async () => {
    const transportManager = get()._transportManager;
    if (transportManager) {
      await transportManager.stop();
    } else {
      set({ isPlaying: false, cursorPosition: 0 });
    }
  },

  toggleLoop: async () => {
    const transportManager = get()._transportManager;
    const newLoopEnabled = !get().loopEnabled;

    if (transportManager) {
      await transportManager.setLoopEnabled(newLoopEnabled);
    } else {
      set({ loopEnabled: newLoopEnabled });
    }
  },

  setLoopRegion: async (start, end) => {
    const transportManager = get()._transportManager;

    if (transportManager) {
      // Convert beats to steps (1 beat = 4 steps)
      const startInSteps = start * 4;
      const endInSteps = end * 4;
      await transportManager.setLoopStart(startInSteps);
      await transportManager.setLoopEnd(endInSteps);
    } else {
      set({ loopStart: start, loopEnd: end });
    }
  },

  setBPM: async (bpm) => {
    const transportManager = get()._transportManager;

    if (transportManager) {
      await transportManager.setBPM(bpm);
    } else {
      set({ bpm });
    }
  },

  // =================== VIEW ===================

  viewportOffset: { x: 0, y: 0 },
  zoom: { x: 1, y: 1 },
  snapEnabled: true,
  snapSize: 0.25, // 1/16 note in beats

  setZoom: (axis, value) => {
    const clampedValue = Math.max(0.1, Math.min(10, value));
    set({
      zoom: {
        ...get().zoom,
        [axis]: clampedValue
      }
    });
  },

  setViewportOffset: (x, y) => {
    set({ viewportOffset: { x, y } });
  },

  setSnapEnabled: (enabled) => {
    set({ snapEnabled: enabled });
  },

  setSnapSize: (size) => {
    set({ snapSize: size });
  },

  // =================== HISTORY ===================

  history: {
    past: [],
    future: [],
    maxSize: 50
  },

  pushHistory: (action) => {
    const history = get().history;
    const past = [...history.past, action];

    // Limit history size
    if (past.length > history.maxSize) {
      past.shift();
    }

    set({
      history: {
        ...history,
        past,
        future: [] // Clear future on new action
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

  // =================== UTILITIES ===================

  getClipById: (clipId) => {
    return get().clips.find(c => c.id === clipId);
  },

  getClipsByTrack: (trackId) => {
    return get().clips.filter(c => c.trackId === trackId);
  },

  getSelectedClips: () => {
    return get().clips.filter(c => get().selectedClipIds.includes(c.id));
  },

  getTrackById: (trackId) => {
    return get().tracks.find(t => t.id === trackId);
  }
}));
