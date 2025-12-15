/**
 * 🎵 ARRANGEMENT PANEL V2
 *
 * Complete rewrite using canvas-based rendering (Piano Roll v7 pattern)
 * - Multi-layer canvas: grid, clips, handles
 * - React overlays: track headers, timeline ruler
 * - 60fps smooth rendering with viewport culling
 * - Zenith theme styling
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useArrangementCanvas, useClipInteraction } from './hooks';
// ✅ PHASE 1: Store Consolidation - Use unified store
import { useArrangementStore } from '@/store/useArrangementStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { usePanelsStore } from '@/store/usePanelsStore';
import { useProjectAudioStore } from '@/store/useProjectAudioStore';
import { getTimelineController } from '@/lib/core/TimelineControllerSingleton'; // ✅ Unified transport system
import { AudioContextService } from '@/lib/services/AudioContextService'; // ✅ For audio engine sync
import { AudioEngineGlobal } from '@/lib/core/AudioEngineGlobal';
// ✅ PHASE 2: Design Consistency - Using component library
import { Button } from '@/components/controls/base/Button';
import { drawGrid, renderAudioClip, renderPatternClip } from './renderers';
import { TimelineRuler } from './components/TimelineRuler';
import { TrackHeader } from './components/TrackHeader';
import { ClipContextMenu } from './components/ClipContextMenu';
import { ArrangementToolbar } from './components/ArrangementToolbar';
import { PatternBrowser } from './components/PatternBrowser';
import { AutomationLanes } from './components/AutomationLanes';
import { audioAssetManager } from '@/lib/audio/AudioAssetManager.js';
import { uiUpdateManager, UPDATE_PRIORITIES, UPDATE_FREQUENCIES } from '@/lib/core/UIUpdateManager';
import { getAudioClipDurationBeats } from '@/lib/utils/audioDuration';
import { StyleCache } from '@/lib/rendering/StyleCache';
import './ArrangementPanelV2.css';

/**
 * Convert pitch string (e.g., "C4", "F#5") or MIDI number to MIDI note number
 */
function pitchToMIDI(pitch) {
  // If pitch is already a number (MIDI note), return it directly
  if (typeof pitch === 'number') {
    return Math.round(pitch);
  }

  // If pitch is not a string, return default
  if (typeof pitch !== 'string') {
    return 60; // Default to C4
  }

  const noteMap = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
  const match = pitch.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 60; // Default to C4

  const [, noteName, octave] = match;
  const midiNote = (parseInt(octave) + 1) * 12 + noteMap[noteName];
  return midiNote;
}

/**
 * Convert Tone.js duration (e.g., "4n", "8n", "16n") to beats
 */
function durationToBeats(duration) {
  if (typeof duration === 'number') return duration;

  const durationMap = {
    '1n': 4,    // Whole note = 4 beats
    '2n': 2,    // Half note = 2 beats
    '4n': 1,    // Quarter note = 1 beat
    '8n': 0.5,  // Eighth note = 0.5 beats
    '16n': 0.25 // Sixteenth note = 0.25 beats
  };

  return durationMap[duration] || 0.25;
}

/**
 * Convert pattern data format to notes array for rendering
 * Pattern data is stored as { channel: [notes] }, we need flat array
 * Pattern notes use: { time: stepNumber, pitch: "C4", velocity, duration: "4n" }
 * Renderer expects: { note: midiNumber, time: beats, duration: beats, velocity }
 */
function convertPatternDataToNotes(pattern) {
  if (!pattern || !pattern.data) {
    return [];
  }

  const notes = [];
  Object.values(pattern.data).forEach((channelNotes) => {
    if (Array.isArray(channelNotes)) {
      channelNotes.forEach(noteData => {
        const midiNote = pitchToMIDI(noteData.pitch);
        // noteData.time is in steps (16th note index: 0-63 for 4 bars)
        // 1 beat = 4 steps (quarter note = 4 sixteenth notes)
        const timeInBeats = noteData.time / 4; // Convert steps to beats
        const durationInBeats = durationToBeats(noteData.duration);

        notes.push({
          note: midiNote,
          time: timeInBeats,
          duration: durationInBeats,
          velocity: (noteData.velocity || 1.0) * 127 // Convert 0-1 to 0-127
        });
      });
    }
  });

  return notes;
}

/**
 * Main ArrangementPanelV2 component
 */
export function ArrangementPanelV2() {
  const containerRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const gridCanvasRef = useRef(null);
  const clipsCanvasRef = useRef(null);
  const handlesCanvasRef = useRef(null);

  // ✅ PHASE 1: Store Consolidation - Use unified store
  // Arrangement state (from unified store)
  const tracks = useArrangementStore(state => state.arrangementTracks);
  const clips = useArrangementStore(state => state.arrangementClips);
  const selectedClipIds = useArrangementStore(state => state.selectedClipIds);
  const clipboard = useArrangementStore(state => state.clipboard);
  const snapEnabled = useArrangementStore(state => state.snapEnabled);
  const snapSize = useArrangementStore(state => state.snapSize);
  const markers = useArrangementStore(state => state.arrangementMarkers);
  const loopRegions = useArrangementStore(state => state.arrangementLoopRegions);

  // Pattern store (for pattern clip rendering)
  const patterns = useArrangementStore(state => state.patterns);

  // Arrangement actions (from unified store)
  const updateTrack = useArrangementStore(state => state.updateArrangementTrack);
  const setSnapEnabled = useArrangementStore(state => state.setArrangementSnapEnabled);
  const setSnapSize = useArrangementStore(state => state.setArrangementSnapSize);
  const copySelection = useArrangementStore(state => state.copyArrangementSelection);
  const cutSelection = useArrangementStore(state => state.cutArrangementSelection);
  const paste = useArrangementStore(state => state.pasteArrangementClips);
  const duplicateClips = useArrangementStore(state => state.duplicateArrangementClips);
  const removeClips = useArrangementStore(state => state.removeArrangementClips);
  const splitClip = useArrangementStore(state => state.splitArrangementClip);
  const addPatternClip = useArrangementStore(state => state.addArrangementPatternClip);
  const updateClip = useArrangementStore(state => state.updateArrangementClip);
  const addMarker = useArrangementStore(state => state.addArrangementMarker);
  const removeMarker = useArrangementStore(state => state.removeArrangementMarker);
  const addLoopRegion = useArrangementStore(state => state.addArrangementLoopRegion);
  const removeLoopRegion = useArrangementStore(state => state.removeArrangementLoopRegion);
  const updateLoopRegion = useArrangementStore(state => state.updateArrangementLoopRegion);

  // ✅ PHASE 1: Transport System Unification - Use TimelineController (same as Piano Roll)
  // Playback state (read-only from usePlaybackStore)
  const currentStep = usePlaybackStore(state => state.currentStep);
  const playbackMode = usePlaybackStore(state => state.playbackMode);
  const isPlaying = usePlaybackStore(state => state.isPlaying);
  const followPlayheadMode = usePlaybackStore(state => state.followPlayheadMode);
  const bpm = usePlaybackStore(state => state.bpm || 140);

  // Transport control via TimelineController
  const setCursorPosition = useCallback((position) => {
    try {
      const timelineController = getTimelineController();
      // Convert beats to steps (1 beat = 4 steps in 16th notes)
      const positionInSteps = Math.max(0, position) * 4;
      timelineController.jumpToPosition(positionInSteps);
    } catch (e) {
      console.warn('TimelineController not initialized:', e);
    }
  }, []);

  // Canvas engine
  const engine = useArrangementCanvas(containerRef, tracks);
  const { viewport, dimensions, lod, eventHandlers, setupCanvas, constants } = engine;

  // Layout constants
  const TOOLBAR_HEIGHT = 48;
  const PATTERN_BROWSER_WIDTH = 250;
  const LEFT_OFFSET = PATTERN_BROWSER_WIDTH + constants.TRACK_HEADER_WIDTH; // Total left sidebar width

  // Sample editor state
  const [sampleEditorOpen, setSampleEditorOpen] = useState(false);

  // ✅ NEW: Automation lanes visibility per track
  const [automationExpandedTracks, setAutomationExpandedTracks] = useState(new Set());

  // ✅ THEME-AWARE: Track theme version to trigger re-renders on theme change
  const [themeVersion, setThemeVersion] = useState(0);

  // ✅ PHASE 1: Transport System Unification - Playback state already defined above
  // Convert steps to beats for cursor position (1 beat = 4 steps in 16th notes)
  // Arrangement panel always uses the current step regardless of playback mode
  // ✅ FIX: Only show playhead in song mode (not in pattern mode)
  // Pattern mode playhead should only appear in Piano Roll and Channel Rack
  const effectiveCurrentStep = playbackMode === 'song' ? currentStep / 4 : null;

  // ✅ PHASE 1: Follow Playhead Mode - Auto-scroll during playback
  const userInteractionRef = useRef(false); // Track if user is manually scrolling

  // ✅ FIX: Store updateViewport in ref to avoid dependency issues
  const updateViewportRef = useRef(eventHandlers?.updateViewport);
  useEffect(() => {
    updateViewportRef.current = eventHandlers?.updateViewport;
  }, [eventHandlers?.updateViewport]);

  useEffect(() => {
    // Early exits - don't follow if not playing, mode is OFF, user is scrolling, or viewport not ready
    // ✅ FIX: Don't follow playhead in pattern mode (only in song mode)
    if (!isPlaying || followPlayheadMode === 'OFF' || playbackMode !== 'song') return;
    if (userInteractionRef.current) return;
    if (!viewport || !dimensions || !updateViewportRef.current) return;
    if (effectiveCurrentStep === null || effectiveCurrentStep === undefined) return;

    const playheadX = effectiveCurrentStep * dimensions.pixelsPerBeat;
    const threshold = viewport.width * 0.8;

    if (followPlayheadMode === 'CONTINUOUS') {
      // Keep playhead centered in viewport
      const targetScrollX = playheadX - (viewport.width / 2);
      const diff = Math.abs(viewport.scrollX - targetScrollX);

      if (diff > 5) { // Threshold to prevent jitter
        const newScrollX = Math.max(0, targetScrollX);
        updateViewportRef.current({ scrollX: newScrollX });
      }
    } else if (followPlayheadMode === 'PAGE') {
      // Jump to next page when playhead reaches 80% of viewport width
      if (playheadX > viewport.scrollX + threshold) {
        const newScrollX = viewport.scrollX + viewport.width;
        updateViewportRef.current({ scrollX: newScrollX });
      }
    }
    // ✅ FIX: Only depend on specific viewport properties, not the whole object
    // Use primitive values to avoid infinite loops
  }, [effectiveCurrentStep, isPlaying, followPlayheadMode, playbackMode, viewport.scrollX, viewport.width, dimensions?.pixelsPerBeat]);

  // Track user interaction to pause follow mode temporarily
  useEffect(() => {
    const handleUserScroll = () => {
      userInteractionRef.current = true;
      // Resume follow on next play
      const resumeFollow = () => {
        userInteractionRef.current = false;
      };
      // Reset flag after 2 seconds of no interaction
      const timer = setTimeout(resumeFollow, 2000);
      return () => clearTimeout(timer);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleUserScroll);
      container.addEventListener('mousedown', handleUserScroll);
      return () => {
        container.removeEventListener('wheel', handleUserScroll);
        container.removeEventListener('mousedown', handleUserScroll);
      };
    }
  }, []);

  // Clip double-click handler for sample editor
  const handleClipDoubleClick = useCallback(async (clip) => {
    console.log('🎵 handleClipDoubleClick CALLED!', { clipType: clip.type, clipName: clip.name });

    // Only open sample editor for audio clips
    if (clip.type === 'audio') {
      console.log('🎵 Opening sample editor for clip:', clip.name);

      // Load the audio buffer
      if (clip.assetId) {
        const asset = audioAssetManager.assets.get(clip.assetId);
        if (asset?.buffer) {
          // Convert ToneAudioBuffer to Web Audio API AudioBuffer
          const webAudioBuffer = asset.buffer.get ? asset.buffer.get() : asset.buffer;

          console.log('🎵 Audio buffer type:', asset.buffer.constructor.name);
          console.log('🎵 Converted buffer:', webAudioBuffer);

          // Set buffer and clip data in panels store for SampleEditorV3
          usePanelsStore.getState().setEditorBuffer(webAudioBuffer);
          usePanelsStore.getState().setEditorClipData({
            type: 'audio-clip',
            name: clip.name || 'Audio Clip',
            assetId: clip.assetId,
            clipId: clip.id,
            trackId: clip.trackId,
            mixerChannelId: clip.mixerChannelId // Include mixer routing info
          });

          // Open sample editor panel and bring to front
          const panelsState = usePanelsStore.getState();
          const sampleEditorPanel = panelsState.panels['sample-editor'];

          console.log('🔍 Panel state before:', {
            isOpen: sampleEditorPanel?.isOpen,
            panelStack: panelsState.panelStack
          });

          if (!sampleEditorPanel?.isOpen) {
            console.log('📂 Opening sample editor panel...');
            panelsState.togglePanel('sample-editor');
            // Wait for next tick to bring to front after toggle completes
            setTimeout(() => {
              panelsState.bringPanelToFront('sample-editor');
              console.log('📂 Brought to front (after toggle)');
            }, 0);
          } else {
            // Already open, bring to front immediately
            console.log('📂 Bringing to front (already open)...');
            panelsState.bringPanelToFront('sample-editor');
          }

          setSampleEditorOpen(true);
        } else {
          console.warn('⚠️ Audio buffer not found for assetId:', clip.assetId);
        }
      }
    }
  }, []);

  // Clip interaction
  const clipInteraction = useClipInteraction(viewport, tracks, clips, constants, dimensions, TOOLBAR_HEIGHT, LEFT_OFFSET, handleClipDoubleClick);
  const {
    marqueeBox,
    hoveredClipId,
    hoveredHandle,
    dragGhosts,
    resizeGhosts,
    fadeGhosts,
    gainGhosts,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    cancelDrag,
    cancelResize,
    cancelFade,
    cancelGain
  } = clipInteraction;

  // Local state
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, clipIds }
  const [activeTool, setActiveTool] = useState('select'); // 'select' | 'delete' | 'split' | 'draw'
  const [deletionMode, setDeletionMode] = useState(false);
  const deletionTimerRef = useRef(null);
  const [splitPreview, setSplitPreview] = useState(null); // { x, y, clips } - preview line position and affected clips
  const [splitStart, setSplitStart] = useState(null); // { x, screenX } - first point when shift+click
  const [splitRange, setSplitRange] = useState(null); // { startX, endX, clips } - range between two points
  const [drawGhost, setDrawGhost] = useState(null); // { trackId, startTime, endTime, x, y, width, height } - preview of clip being drawn
  const [drawStart, setDrawStart] = useState(null); // { x, y, trackId, startTime } - where drawing started

  // Pattern drag state
  const [patternDragPreview, setPatternDragPreview] = useState(null); // { patternId, trackId, startTime, x, y, width, height } - pattern being dragged

  // Loop region interaction state
  const [loopDragStart, setLoopDragStart] = useState(null); // { regionId, startTime, initialX } - for creating/dragging loops
  const [loopDragMode, setLoopDragMode] = useState(null); // 'create' | 'move' | 'resize-start' | 'resize-end'
  const [hoveredLoop, setHoveredLoop] = useState(null); // { regionId, handle } - for hover feedback

  // Drag & Drop State for generic file nodes
  const [isDragOver, setIsDragOver] = useState(false);

  // ✅ PHASE 1: Transport System Unification
  // TimelineController is initialized globally, no need for local initialization
  // Audio engine sync on mount
  useEffect(() => {
    console.log('🎵 ArrangementV2 mounting, syncing tracks to audio engine...');
    const syncTracks = async () => {
      try {
        const audioEngine = AudioEngineGlobal.get();
        if (audioEngine) {
          // Sync arrangement tracks to audio engine
          await useArrangementStore.getState()._syncArrangementTracksToAudioEngine();
        }
      } catch (e) {
        console.warn('Failed to sync tracks to audio engine:', e);
      }
    };
    syncTracks();
  }, []);

  // ✅ REMOVED: Empty useEffect that was causing excessive re-render logs
  // TimelineController is disabled for ArrangementV2 (uses own clip interaction system)
  // Playhead position comes directly from PlaybackStore (Single Source of Truth)

  // Sync deletion mode with active tool
  useEffect(() => {
    if (activeTool === 'delete') {
      setDeletionMode(true);
    } else {
      setDeletionMode(false);
    }
  }, [activeTool]);

  // ============================================================================
  // CANVAS RENDERING
  // ============================================================================

  // Grid canvas (background) - static render
  useEffect(() => {
    const canvas = gridCanvasRef.current;
    const ctx = setupCanvas(canvas);
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    // ✅ THEME-AWARE: Draw grid with StyleCache for dynamic theme colors
    drawGrid(
      ctx,
      viewport.width - constants.TRACK_HEADER_WIDTH,
      viewport.height - constants.TIMELINE_HEIGHT,
      {
        offsetX: viewport.scrollX,
        offsetY: viewport.scrollY,
        zoomX: viewport.zoomX,
        zoomY: viewport.zoomY
      },
      tracks,
      snapSize,
      styleCacheRef.current // Pass StyleCache for theme-aware colors
    );
    // ✅ FIX: Only depend on specific viewport properties to avoid infinite loops
    // Use primitive values instead of optional chaining to ensure stable dependencies
  }, [viewport.width, viewport.height, viewport.scrollX, viewport.scrollY, viewport.zoomX, viewport.zoomY, tracks.length, snapSize, dimensions?.trackHeight, lod, themeVersion]);

  // Clips canvas (middle layer) - render clips
  useEffect(() => {
    const canvas = clipsCanvasRef.current;
    const ctx = setupCanvas(canvas);
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    // Canvas is already positioned after headers (see HTML structure)
    // No clipping needed - just draw directly
    ctx.save();

    // Draw clips with viewport culling
    const { start: startBeat, end: endBeat } = viewport.visibleBeats;
    const { start: startTrack, end: endTrack } = viewport.visibleTracks;

    clips.forEach(async (clip) => {
      const track = tracks.find(t => t.id === clip.trackId);
      if (!track) {
        console.warn('Clip has invalid trackId:', clip.name, clip.trackId);
        return;
      }

      const trackIndex = tracks.indexOf(track);

      if (trackIndex < startTrack || trackIndex >= endTrack) return;

      const clipEndBeat = clip.startTime + clip.duration;
      if (clipEndBeat < startBeat || clip.startTime > endBeat) return;

      // Calculate clip dimensions in world space
      const worldX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
      const worldY = trackIndex * dimensions.trackHeight;
      const width = clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
      const height = dimensions.trackHeight;

      // Convert to canvas space (canvas already positioned after headers, like grid)
      // Canvas (0,0) = content area start (after headers)
      // But clipping rect is in canvas coordinates at (TRACK_HEADER_WIDTH, TIMELINE_HEIGHT)
      // So we need to account for that offset
      const x = worldX - viewport.scrollX;
      const y = worldY - viewport.scrollY + 4; // +4 for top padding
      const clipHeight = height - 8; // -8 for top/bottom padding

      const isSelected = selectedClipIds.includes(clip.id);

      // Render based on clip type
      if (clip.type === 'audio') {
        // Load audio buffer if not already loaded
        let audioBuffer = null;
        if (clip.assetId) {
          try {
            // Try to get from cache - don't await to keep rendering synchronous
            const asset = audioAssetManager.assets.get(clip.assetId);
            audioBuffer = asset?.buffer || null;
          } catch (error) {
            console.warn('Failed to load audio buffer for clip', clip.id, error);
          }
        }

        renderAudioClip(ctx, audioBuffer, clip, x, y, width, clipHeight, isSelected, bpm, lod, constants.PIXELS_PER_BEAT, viewport.zoomX, track);
      } else if (clip.type === 'pattern') {
        // Load pattern data from pattern store
        const pattern = patterns[clip.patternId] || null;

        // Convert pattern data to expected format (data -> notes)
        const patternData = pattern ? {
          ...pattern,
          notes: convertPatternDataToNotes(pattern)
        } : null;

        renderPatternClip(ctx, patternData, clip, x, y, width, clipHeight, isSelected, lod, track);
      }
    });

    ctx.restore();
    // ✅ FIX: Include clips array in dependencies to trigger re-render when clip positions change
    // Zustand store returns new array reference when clips are updated, so this is safe
  }, [viewport.width, viewport.height, viewport.scrollX, viewport.scrollY, viewport.zoomX, viewport.visibleBeats, viewport.visibleTracks, clips, tracks, selectedClipIds, dimensions?.trackHeight, lod, patterns, bpm]);

  // ✅ THEME-AWARE: Create StyleCache instance for dynamic theme color reading
  const styleCacheRef = useRef(null);
  if (!styleCacheRef.current) {
    styleCacheRef.current = new StyleCache();
  }

  // ✅ THEME-AWARE: Listen to theme changes and trigger re-render
  useEffect(() => {
    const handleThemeChange = () => {
      console.log('🎨 ArrangementPanel: Theme changed, invalidating StyleCache and re-rendering');
      if (styleCacheRef.current) {
        styleCacheRef.current.invalidate();
      }
      // Trigger re-render by updating theme version
      setThemeVersion(prev => prev + 1);
    };

    window.addEventListener('themeChanged', handleThemeChange);
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
    };
  }, []);

  // Handles canvas (top layer) - interaction overlays
  useEffect(() => {
    const canvas = handlesCanvasRef.current;
    const ctx = setupCanvas(canvas);
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    // Canvas is already positioned after headers (see HTML structure)
    ctx.save();

    // Draw marquee selection box (marqueeBox is already in world space)
    if (marqueeBox) {
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
      ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      // Convert marquee from world space to canvas space
      const x = marqueeBox.x - viewport.scrollX;
      const y = marqueeBox.y - viewport.scrollY;

      ctx.fillRect(x, y, marqueeBox.width, marqueeBox.height);
      ctx.strokeRect(x, y, marqueeBox.width, marqueeBox.height);

      ctx.setLineDash([]);
    }

    // Draw drag ghost clips
    if (dragGhosts && dragGhosts.length > 0) {
      dragGhosts.forEach(ghost => {
        // Convert to canvas space
        const x = ghost.x - viewport.scrollX;
        const y = ghost.y - viewport.scrollY + 4;
        const width = ghost.width;
        const height = ghost.height - 8;

        // Draw semi-transparent ghost
        ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
        ctx.fillRect(x, y, width, height);

        // Draw dashed border
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);

        // Draw clip name
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(ghost.clip.name, x + 8, y + 6);
      });
    }

    // Draw resize ghosts
    if (resizeGhosts && resizeGhosts.length > 0) {
      resizeGhosts.forEach(ghost => {
        // Convert to canvas space
        const x = ghost.x - viewport.scrollX;
        const y = ghost.y - viewport.scrollY + 4;
        const width = ghost.width;
        const height = ghost.height - 8;

        // Draw semi-transparent ghost
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; // Blue tint for resize
        ctx.fillRect(x, y, width, height);

        // Draw dashed border
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);

        // Draw duration label
        const durationBeats = ghost.newDuration.toFixed(2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${durationBeats} beats`, x + width / 2, y + height / 2);
      });
    }

    // Draw fade ghosts (with gradient overlay)
    if (fadeGhosts && fadeGhosts.length > 0) {
      fadeGhosts.forEach(ghost => {
        // Convert to canvas space
        const x = ghost.x - viewport.scrollX;
        const y = ghost.y - viewport.scrollY + 4;
        const width = ghost.width;
        const height = ghost.height - 8;

        // Draw semi-transparent ghost overlay
        ctx.fillStyle = 'rgba(236, 72, 153, 0.2)'; // Pink tint for fade
        ctx.fillRect(x, y, width, height);

        // Draw fade in gradient (if > 0)
        if (ghost.newFadeIn > 0) {
          const fadeInWidth = (ghost.newFadeIn / ghost.clip.duration) * width;
          const gradient = ctx.createLinearGradient(x, y, x + fadeInWidth, y);
          gradient.addColorStop(0, 'rgba(236, 72, 153, 0.6)');
          gradient.addColorStop(1, 'rgba(236, 72, 153, 0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, fadeInWidth, height);

          // Draw fade in label
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = 'bold 10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(`In: ${ghost.newFadeIn.toFixed(2)}`, x + 4, y + 4);
        }

        // Draw fade out gradient (if > 0)
        if (ghost.newFadeOut > 0) {
          const fadeOutWidth = (ghost.newFadeOut / ghost.clip.duration) * width;
          const gradient = ctx.createLinearGradient(x + width - fadeOutWidth, y, x + width, y);
          gradient.addColorStop(0, 'rgba(236, 72, 153, 0)');
          gradient.addColorStop(1, 'rgba(236, 72, 153, 0.6)');
          ctx.fillStyle = gradient;
          ctx.fillRect(x + width - fadeOutWidth, y, fadeOutWidth, height);

          // Draw fade out label
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = 'bold 10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'top';
          ctx.fillText(`Out: ${ghost.newFadeOut.toFixed(2)}`, x + width - 4, y + 4);
        }

        // Draw dashed border
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
      });
    }

    // Draw gain ghosts (with gain indicator)
    if (gainGhosts && gainGhosts.length > 0) {
      gainGhosts.forEach(ghost => {
        // Convert to canvas space
        const x = ghost.x - viewport.scrollX;
        const y = ghost.y - viewport.scrollY + 4;
        const width = ghost.width;
        const height = ghost.height - 8;

        // Draw semi-transparent ghost overlay
        ctx.fillStyle = 'rgba(168, 85, 247, 0.2)'; // Purple tint for gain
        ctx.fillRect(x, y, width, height);

        // Draw gain indicator bar (vertical bar showing gain level)
        const gainBarWidth = 4;
        const gainBarX = x + width - gainBarWidth - 8;
        const gainBarY = y + 4;
        const gainBarHeight = height - 8;

        // Normalize gain to 0-1 (from -12 to +12)
        const normalizedGain = (ghost.newGain + 12) / 24;

        // Draw background bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(gainBarX, gainBarY, gainBarWidth, gainBarHeight);

        // Draw gain level indicator
        const gainIndicatorHeight = gainBarHeight * normalizedGain;
        const gainIndicatorY = gainBarY + (gainBarHeight - gainIndicatorHeight);

        // Color based on gain (green = normal, yellow = boost, red = high boost)
        let gainColor;
        if (ghost.newGain < 0) {
          gainColor = 'rgba(34, 197, 94, 0.8)'; // Green for attenuation
        } else if (ghost.newGain < 6) {
          gainColor = 'rgba(168, 85, 247, 0.8)'; // Purple for moderate boost
        } else {
          gainColor = 'rgba(239, 68, 68, 0.8)'; // Red for high boost
        }

        ctx.fillStyle = gainColor;
        ctx.fillRect(gainBarX, gainIndicatorY, gainBarWidth, gainIndicatorHeight);

        // Draw gain label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        const gainText = ghost.newGain >= 0 ? `+${ghost.newGain.toFixed(1)} dB` : `${ghost.newGain.toFixed(1)} dB`;
        ctx.fillText(gainText, x + width - 16, y + height - 4);

        // Draw dashed border
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
      });
    }

    // Draw handle highlights (resize, fade, or gain)
    if (hoveredHandle && !dragGhosts && !resizeGhosts && !fadeGhosts && !gainGhosts) {
      const clip = clips.find(c => c.id === hoveredHandle.clipId);
      if (clip) {
        const track = tracks.find(t => t.id === clip.trackId);
        const trackIndex = tracks.indexOf(track);

        if (trackIndex >= 0) {
          // Calculate in world space
          const worldX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const worldY = trackIndex * dimensions.trackHeight;
          const width = clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const height = dimensions.trackHeight;

          // Convert to canvas space
          const x = worldX - viewport.scrollX;
          const y = worldY - viewport.scrollY + 4;
          const clipHeight = height - 8;

          if (hoveredHandle.handle === 'left' || hoveredHandle.handle === 'right') {
            // Resize handle highlight (rectangular)
            const handleWidth = 8;
            const handleX = hoveredHandle.handle === 'left' ? x : x + width - handleWidth;

            ctx.fillStyle = 'rgba(59, 130, 246, 0.4)'; // Blue highlight
            ctx.fillRect(handleX, y, handleWidth, clipHeight);

            ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(handleX, y, handleWidth, clipHeight);
          } else if (hoveredHandle.handle === 'fadeIn') {
            // Fade in handle highlight (larger triangular - top-left corner)
            const handleSize = 30; // Larger for better visibility
            ctx.fillStyle = 'rgba(236, 72, 153, 0.5)'; // Brighter pink highlight
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + handleSize, y);
            ctx.lineTo(x, y + handleSize);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = 'rgba(236, 72, 153, 1.0)'; // Solid pink border
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (hoveredHandle.handle === 'fadeOut') {
            // Fade out handle highlight (larger triangular - top-right corner)
            const handleSize = 30; // Larger for better visibility
            ctx.fillStyle = 'rgba(236, 72, 153, 0.5)'; // Brighter pink highlight
            ctx.beginPath();
            ctx.moveTo(x + width, y);
            ctx.lineTo(x + width - handleSize, y);
            ctx.lineTo(x + width, y + handleSize);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = 'rgba(236, 72, 153, 1.0)'; // Solid pink border
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (hoveredHandle.handle === 'gain') {
            // Gain handle highlight (circular - center-bottom of clip)
            // Scale with zoom (smaller when zoomed out)
            const baseRadius = 10;
            const minRadius = 6;
            const handleRadius = Math.max(minRadius, baseRadius * Math.sqrt(viewport.zoomX));
            const handleX = x + width / 2;
            const handleY = y + clipHeight * 0.75; // 75% down from top

            // Draw glow circle
            ctx.fillStyle = 'rgba(168, 85, 247, 0.3)'; // Purple glow
            ctx.beginPath();
            ctx.arc(handleX, handleY, handleRadius + 4, 0, Math.PI * 2);
            ctx.fill();

            // Draw handle circle
            ctx.fillStyle = 'rgba(168, 85, 247, 0.6)'; // Purple highlight
            ctx.beginPath();
            ctx.arc(handleX, handleY, handleRadius, 0, Math.PI * 2);
            ctx.fill();

            // Draw border
            ctx.strokeStyle = 'rgba(168, 85, 247, 1.0)'; // Solid purple border
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw icon (vertical lines for gain) - scale with handle size
            const iconScale = handleRadius / baseRadius;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 1.5 * iconScale;
            for (let i = -1; i <= 1; i++) {
              const barHeight = (4 + Math.abs(i) * 2) * iconScale;
              ctx.beginPath();
              ctx.moveTo(handleX + i * 3 * iconScale, handleY - barHeight / 2);
              ctx.lineTo(handleX + i * 3 * iconScale, handleY + barHeight / 2);
              ctx.stroke();
            }
          }
        }
      }
    }

    // Draw hover highlight
    if (hoveredClipId && !selectedClipIds.includes(hoveredClipId) && !dragGhosts) {
      const clip = clips.find(c => c.id === hoveredClipId);
      if (clip) {
        const track = tracks.find(t => t.id === clip.trackId);
        const trackIndex = tracks.indexOf(track);

        if (trackIndex >= 0) {
          // Calculate in world space
          const worldX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const worldY = trackIndex * dimensions.trackHeight;
          const width = clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const height = dimensions.trackHeight;

          // Convert to canvas space (canvas already after headers)
          const x = worldX - viewport.scrollX;
          const y = worldY - viewport.scrollY + 4;
          const clipHeight = height - 8;

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, clipHeight);
        }
      }
    }

    // Draw split preview line
    if (splitPreview && splitPreview.clips.length > 0) {
      const x = splitPreview.screenX;

      // Draw vertical split line
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.9)'; // Purple
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewport.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw thicker highlight line at cursor
      ctx.strokeStyle = 'rgba(168, 85, 247, 1.0)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewport.height);
      ctx.stroke();

      // Highlight affected clips
      splitPreview.clips.forEach(clip => {
        const track = tracks.find(t => t.id === clip.trackId);
        const trackIndex = tracks.indexOf(track);

        if (trackIndex >= 0) {
          const worldX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const worldY = trackIndex * dimensions.trackHeight;
          const width = clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const height = dimensions.trackHeight;

          const clipX = worldX - viewport.scrollX;
          const clipY = worldY - viewport.scrollY + 4;
          const clipHeight = height - 8;

          // Semi-transparent purple overlay on affected clips
          ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
          ctx.fillRect(clipX, clipY, width, clipHeight);

          // Purple border
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
          ctx.lineWidth = 2;
          ctx.strokeRect(clipX, clipY, width, clipHeight);
        }
      });

      // Draw split icon at cursor
      const iconSize = 24;
      const iconY = 10;

      // Icon background
      ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
      ctx.beginPath();
      ctx.arc(x, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // Scissors icon (simplified)
      ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      // Left blade
      ctx.beginPath();
      ctx.moveTo(x - 6, iconY + 8);
      ctx.lineTo(x - 2, iconY + 12);
      ctx.stroke();

      // Right blade
      ctx.beginPath();
      ctx.moveTo(x + 6, iconY + 8);
      ctx.lineTo(x + 2, iconY + 12);
      ctx.stroke();

      // Center pivot
      ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
      ctx.beginPath();
      ctx.arc(x, iconY + 10, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw split range (rectangular area between two vertical lines)
    if (splitRange && splitRange.clips.length > 0) {
      const startX = splitRange.startScreenX;
      const endX = splitRange.endScreenX;
      const width = endX - startX;

      // Draw filled rectangle
      ctx.fillStyle = 'rgba(168, 85, 247, 0.2)'; // Purple semi-transparent
      ctx.fillRect(startX, 0, width, viewport.height);

      // Draw vertical lines at boundaries
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);

      // Start line
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, viewport.height);
      ctx.stroke();

      // End line
      ctx.beginPath();
      ctx.moveTo(endX, 0);
      ctx.lineTo(endX, viewport.height);
      ctx.stroke();

      ctx.setLineDash([]);

      // Draw solid lines
      ctx.strokeStyle = 'rgba(168, 85, 247, 1.0)';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, viewport.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(endX, 0);
      ctx.lineTo(endX, viewport.height);
      ctx.stroke();

      // Highlight affected clips
      splitRange.clips.forEach(clip => {
        const track = tracks.find(t => t.id === clip.trackId);
        const trackIndex = tracks.indexOf(track);

        if (trackIndex >= 0) {
          const worldX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const worldY = trackIndex * dimensions.trackHeight;
          const clipWidth = clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const height = dimensions.trackHeight;

          const clipX = worldX - viewport.scrollX;
          const clipY = worldY - viewport.scrollY + 4;
          const clipHeight = height - 8;

          // Purple border on affected clips
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)';
          ctx.lineWidth = 2;
          ctx.strokeRect(clipX, clipY, clipWidth, clipHeight);
        }
      });

      // Draw scissors icons at both boundaries
      const iconSize = 24;
      const positions = [
        { x: startX, label: 'START' },
        { x: endX, label: 'END' }
      ];

      positions.forEach(pos => {
        const iconY = 10;

        // Icon background
        ctx.fillStyle = 'rgba(168, 85, 247, 0.95)';
        ctx.beginPath();
        ctx.arc(pos.x, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
        ctx.fill();

        // Scissors icon
        ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(pos.x - 6, iconY + 8);
        ctx.lineTo(pos.x - 2, iconY + 12);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(pos.x + 6, iconY + 8);
        ctx.lineTo(pos.x + 2, iconY + 12);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
        ctx.beginPath();
        ctx.arc(pos.x, iconY + 10, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw range info label
      const labelY = 50;
      const labelX = (startX + endX) / 2;
      const labelText = `${splitRange.clips.length} clip${splitRange.clips.length > 1 ? 's' : ''}`;

      ctx.fillStyle = 'rgba(168, 85, 247, 0.95)';
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      const labelWidth = ctx.measureText(labelText).width + 16;
      const labelHeight = 24;

      ctx.fillRect(labelX - labelWidth / 2, labelY, labelWidth, labelHeight);

      ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, labelX, labelY + labelHeight / 2);
    }

    // Draw ghost clip (being drawn)
    if (drawGhost) {
      const x = drawGhost.x - viewport.scrollX;
      const y = drawGhost.y - viewport.scrollY + 4;
      const width = drawGhost.width;
      const height = drawGhost.height - 8;

      // Draw semi-transparent ghost with green tint
      ctx.fillStyle = 'rgba(34, 197, 94, 0.3)'; // Green for new clip
      ctx.fillRect(x, y, width, height);

      // Draw dashed border
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);

      // Draw duration label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const durationText = `${drawGhost.duration.toFixed(2)} beats`;
      ctx.fillText(durationText, x + width / 2, y + height / 2);

      // Draw pencil icon at start
      const iconX = x + 8;
      const iconY = y + 8;
      ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
      ctx.font = '16px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('✏️', iconX, iconY);
    }

    // Draw pattern drag preview
    if (patternDragPreview) {
      const x = patternDragPreview.x - viewport.scrollX;
      const y = patternDragPreview.y - viewport.scrollY + 4;
      const width = patternDragPreview.width;
      const height = patternDragPreview.height - 8;

      // Draw semi-transparent ghost with cyan/blue tint
      ctx.fillStyle = 'rgba(34, 211, 238, 0.3)'; // Cyan for pattern
      ctx.fillRect(x, y, width, height);

      // Draw dashed border
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);

      // Draw pattern icon and label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = `🎹 Pattern ${patternDragPreview.patternId}`;
      ctx.fillText(label, x + width / 2, y + height / 2);

      // Draw time label at top
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${patternDragPreview.startTime.toFixed(2)} beats`, x + 8, y + 4);
    }

    // Draw playhead (unified timeline - Single Source of Truth from PlaybackStore)
    // ✅ PHASE 1: effectiveCurrentStep is already in beats (converted above)
    // ✅ FIX: Only draw playhead in song mode (not in pattern mode)
    if (effectiveCurrentStep !== null && effectiveCurrentStep !== undefined && playbackMode === 'song') {
      const playheadX = (effectiveCurrentStep * constants.PIXELS_PER_BEAT * viewport.zoomX) - viewport.scrollX;

      // Only draw if playhead is visible on screen
      if (playheadX >= 0 && playheadX <= viewport.width) {
        // Playhead line
        ctx.strokeStyle = isPlaying ? 'rgba(239, 68, 68, 0.9)' : 'rgba(139, 92, 246, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, viewport.height);
        ctx.stroke();

        // Playhead triangle at top
        ctx.fillStyle = isPlaying ? 'rgba(239, 68, 68, 0.9)' : 'rgba(139, 92, 246, 0.7)';
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX - 6, 12);
        ctx.lineTo(playheadX + 6, 12);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Ghost position disabled (was part of TimelineController scrubbing system)
    // if (ghostPosition !== null && ghostPosition !== undefined) {
    //   const ghostX = (ghostPosition * constants.PIXELS_PER_BEAT * viewport.zoomX) - viewport.scrollX;
    //   // ... ghost rendering code
    // }

    ctx.restore();
  }, [viewport, setupCanvas, marqueeBox, hoveredClipId, hoveredHandle, dragGhosts, resizeGhosts, fadeGhosts, gainGhosts, clips, tracks, selectedClipIds, constants, dimensions, splitPreview, splitRange, drawGhost, patternDragPreview, effectiveCurrentStep, isPlaying, playbackMode]);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input/textarea
      if (e.target.matches('input, textarea')) return;

      // Escape - cancel operations or close context menu or exit deletion mode or cancel split range
      if (e.key === 'Escape') {
        cancelDrag();
        cancelResize();
        cancelFade();
        cancelGain();
        setContextMenu(null);

        // Cancel draw mode
        if (drawStart || drawGhost) {
          setDrawStart(null);
          setDrawGhost(null);
          console.log('✅ Draw cancelled');
          return;
        }

        // Cancel split range selection
        if (splitStart || splitRange) {
          setSplitStart(null);
          setSplitRange(null);
          console.log('✅ Split range cancelled');
          return;
        }

        // Exit deletion mode
        if (deletionMode) {
          setDeletionMode(false);
          setActiveTool('select');
          console.log('✅ Deletion mode deactivated');
        }

        return;
      }

      // Copy - Ctrl+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedClipIds.length > 0) {
          e.preventDefault();
          copySelection();
          console.log(`Copied ${selectedClipIds.length} clip(s)`);
        }
        return;
      }

      // Cut - Ctrl+X
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        if (selectedClipIds.length > 0) {
          e.preventDefault();
          cutSelection();
          console.log(`Cut ${selectedClipIds.length} clip(s)`);
        }
        return;
      }

      // Paste - Ctrl+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboard && clipboard.length > 0) {
          e.preventDefault();
          // Get cursor position from effectiveCurrentStep (already in beats)
          paste(effectiveCurrentStep || 0);
          console.log(`Pasted ${clipboard.length} clip(s)`);
        }
        return;
      }

      // Duplicate - Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        if (selectedClipIds.length > 0) {
          e.preventDefault();
          const newClipIds = duplicateClips(selectedClipIds);
          useArrangementStore.getState().setArrangementSelection(newClipIds);
          console.log(`Duplicated ${selectedClipIds.length} clip(s)`);
        }
        return;
      }

      // Select All - Ctrl+A
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        useArrangementStore.getState().selectAllArrangementClips();
        return;
      }

      // Space - toggle play/pause
      if (e.code === 'Space') {
        e.preventDefault();
        usePlaybackStore.getState().togglePlayPause();
        return;
      }

      // Delete - remove selected clips
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipIds.length > 0) {
          e.preventDefault();
          removeClips(selectedClipIds);
        }
        return;
      }

      // Tool shortcuts
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setActiveTool('select');
        console.log('✋ Select tool activated');
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        if (!(e.ctrlKey || e.metaKey)) { // Avoid conflict with Ctrl+D (duplicate)
          e.preventDefault();
          setActiveTool('delete');
          console.log('🗑️ Delete tool activated');
          return;
        }
      }

      if (e.key === 's' || e.key === 'S') {
        if (!(e.ctrlKey || e.metaKey)) { // Avoid conflict with Ctrl+S (save)
          e.preventDefault();
          setActiveTool('split');
          console.log('✂️ Split tool activated');
          return;
        }
      }

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setActiveTool('draw');
        console.log('✏️ Draw tool activated');
        return;
      }

      // Zoom shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const newZoomX = Math.min(4, viewport.zoomX * 1.25);
        eventHandlers.onZoom(newZoomX, viewport.zoomY);
        console.log(`🔍 Zoom in: ${newZoomX.toFixed(2)}x`);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        const newZoomX = Math.max(0.25, viewport.zoomX * 0.8);
        eventHandlers.onZoom(newZoomX, viewport.zoomY);
        console.log(`🔍 Zoom out: ${newZoomX.toFixed(2)}x`);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        eventHandlers.onZoom(1.0, 1.0);
        console.log('🔍 Reset zoom');
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        if (!(e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          // Fit to view - same logic as toolbar button
          if (clips.length === 0) {
            eventHandlers.onZoom(1.0, 1.0);
            return;
          }

          let minTime = Infinity;
          let maxTime = -Infinity;

          clips.forEach(clip => {
            minTime = Math.min(minTime, clip.startTime);
            maxTime = Math.max(maxTime, clip.startTime + clip.duration);
          });

          const totalBeats = maxTime - minTime;
          const availableWidth = viewport.width - constants.TRACK_HEADER_WIDTH;
          const pixelsPerBeat = availableWidth / totalBeats;
          const newZoomX = Math.max(0.25, Math.min(4, pixelsPerBeat / constants.PIXELS_PER_BEAT));

          eventHandlers.onZoom(newZoomX, 1.0);
          console.log(`🔍 Fit to view: ${totalBeats.toFixed(1)} beats, zoom ${newZoomX.toFixed(2)}x`);
          return;
        }
      }

      // Marker shortcuts
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const label = prompt('Marker name:', 'Marker');
        if (label) {
          // Get cursor position from effectiveCurrentStep (already in beats)
          addMarker(effectiveCurrentStep || 0, label);
          console.log(`📍 Added marker "${label}" at ${(effectiveCurrentStep || 0).toFixed(2)} beats`);
        }
        return;
      }

      if (e.key === 'l' || e.key === 'L') {
        if (!(e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          const label = prompt('Loop region name:', 'Loop');
          if (label) {
            const start = effectiveCurrentStep || 0;
            const end = start + 8; // Default 8 beats
            addLoopRegion(start, end, label);
            console.log(`🔄 Added loop region "${label}" from ${start.toFixed(2)} to ${end.toFixed(2)} beats`);
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipIds, clipboard, effectiveCurrentStep, cancelDrag, cancelResize, cancelFade, cancelGain, copySelection, cutSelection, paste, duplicateClips, removeClips, setActiveTool, viewport, eventHandlers, clips, constants, deletionMode, setDeletionMode, drawStart, drawGhost, setDrawStart, setDrawGhost, splitStart, splitRange, setSplitStart, setSplitRange, addMarker, addLoopRegion]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleTrackUpdate = (trackId, updates) => {
    updateTrack(trackId, updates);
  };

  const handleTrackClick = (trackIndex) => {
    setSelectedTrackIndex(trackIndex);
  };

  const handleTimelineSeek = (beat) => {
    // ✅ FIX: Don't seek during playback! Only allow seeking when stopped
    if (isPlaying) {
      console.log('⚠️ Timeline seek ignored during playback');
      return;
    }

    setCursorPosition(beat);
    // TODO: Connect to playback system (seek transport when stopped)
    console.log('Seek to beat:', beat);
  };

  // Context menu handlers
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // ✅ NEW: Disable context menu during delete mode (right-click is for deleting)
    if (deletionMode) {
      return;
    }

    // Get mouse position in canvas coordinates
    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Skip if over toolbar, timeline or left sidebars (pattern browser + track headers)
    const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
    if (screenX < LEFT_OFFSET || screenY < totalHeaderHeight) {
      return;
    }

    // Find clip at position using clip interaction helper
    const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;
    const canvasY = screenY - totalHeaderHeight + viewport.scrollY;
    const { findClipAtPosition } = clipInteraction;
    const clip = findClipAtPosition(canvasX, canvasY);

    if (clip) {
      // Determine which clips to show in menu
      let menuClipIds;

      if (selectedClipIds.includes(clip.id)) {
        // Right-clicking on a selected clip - show menu for all selected clips
        menuClipIds = selectedClipIds;
      } else {
        // Right-clicking on unselected clip - select only this clip
        useArrangementStore.getState().setArrangementSelection([clip.id]);
        menuClipIds = [clip.id];
      }

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        clipIds: menuClipIds
      });
    } else {
      // Right-click on empty space - start deletion mode timer
      setContextMenu(null);

      // Clear any existing timer
      if (deletionTimerRef.current) {
        clearTimeout(deletionTimerRef.current);
      }

      // Start deletion mode after 500ms hold
      deletionTimerRef.current = setTimeout(() => {
        setDeletionMode(true);
        setActiveTool('delete');
        console.log('🗑️ Deletion mode activated - Click clips to delete them');
      }, 500);
    }
  };

  const handleRenameClip = () => {
    if (contextMenu && contextMenu.clipIds.length === 1) {
      const clipId = contextMenu.clipIds[0];
      const clip = clips.find(c => c.id === clipId);
      if (clip) {
        const newName = prompt('Rename clip:', clip.name);
        if (newName) {
          useArrangementStore.getState().updateArrangementClip(clipId, { name: newName });
        }
      }
    }
  };

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;

    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Combined mouse handlers (viewport + clip interaction)
  const handleCombinedMouseDown = (e) => {
    console.log('🔵 handleCombinedMouseDown CALLED - button:', e.button, 'target:', e.target.className);

    // Close context menu on any click
    setContextMenu(null);

    // ✅ NEW: Right-click hold activates delete mode
    if (e.button === 2) { // Right mouse button
      e.preventDefault(); // Prevent context menu
      setDeletionMode(true);
      console.log('🗑️ Delete mode activated (right-click hold)');
      return; // Don't process other interactions
    }

    // Cancel deletion mode timer if clicking
    if (deletionTimerRef.current) {
      clearTimeout(deletionTimerRef.current);
      deletionTimerRef.current = null;
    }

    // ✅ FIX: Call handleMouseDown FIRST for double-click detection (before other tool checks)
    // Double-click detection must happen before other interactions (deletion, split, draw)
    // This ensures audio clip double-click opens Sample Editor even when other tools are active
    if (e.button === 0 && activeTool !== 'draw') {
      console.log('🖱️ handleCombinedMouseDown: Calling clipInteraction.handleMouseDown');
      // Call handleMouseDown which will detect double-click and call onClipDoubleClick
      // handleMouseDown will set doubleClickHandledRef if double-click is detected
      handleMouseDown(e);

      // ✅ FIX: Check if double-click was handled and skip other interactions
      const wasDouble = clipInteraction.wasDoubleClick();
      console.log('🖱️ wasDoubleClick check result:', wasDouble);
      if (wasDouble) {
        console.log('🎵 Double-click detected in handleCombinedMouseDown, skipping other interactions');
        return; // Skip deletion, split, draw, etc.
      }
    }

    // If in deletion mode and left-clicking a clip, delete it
    if (deletionMode && e.button === 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
      if (screenX >= LEFT_OFFSET && screenY >= totalHeaderHeight) {
        const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;
        const canvasY = screenY - totalHeaderHeight + viewport.scrollY;
        const { findClipAtPosition } = clipInteraction;
        const clip = findClipAtPosition(canvasX, canvasY);

        if (clip) {
          removeClips([clip.id]);
          console.log(`🗑️ Deleted clip: ${clip.name}`);
          return; // Don't process other interactions
        }
      }
    }

    // If in split mode and clicking
    if (activeTool === 'split' && e.button === 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
      if (screenX >= LEFT_OFFSET && screenY >= totalHeaderHeight) {
        const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;

        // Shift+Click: Single line split (all clips at once)
        if (e.shiftKey) {
          if (splitPreview && splitPreview.clips.length > 0) {
            // ✅ FIX: Calculate split time from canvasX (world coordinates)
            // Apply snap if enabled for consistent splitting
            let splitTime = splitPreview.x / (constants.PIXELS_PER_BEAT * viewport.zoomX);
            if (snapEnabled) {
              splitTime = Math.round(splitTime / snapSize) * snapSize;
            }

            let successCount = 0;
            let failCount = 0;

            splitPreview.clips.forEach(clip => {
              // ✅ FIX: Validate split point is within clip bounds (strict check)
              // splitTime must be strictly between clip start and end (not at boundaries)
              if (splitTime > clip.startTime && splitTime < clip.startTime + clip.duration) {
                const result = splitClip(clip.id, splitTime);
                if (result) {
                  successCount++;
                } else {
                  failCount++;
                  console.warn(`⚠️ Failed to split clip ${clip.id} at ${splitTime.toFixed(2)} beats`);
                }
              } else {
                failCount++;
                console.warn(`⚠️ Split time ${splitTime.toFixed(2)} is outside clip bounds [${clip.startTime.toFixed(2)}, ${(clip.startTime + clip.duration).toFixed(2)})`);
              }
            });

            if (successCount > 0) {
              console.log(`✂️ Split ${successCount} clip${successCount > 1 ? 's' : ''} at ${splitTime.toFixed(2)} beats`);
            }
            if (failCount > 0) {
              console.warn(`⚠️ ${failCount} clip${failCount > 1 ? 's' : ''} could not be split`);
            }

            setSplitPreview(null);
            return;
          }
        } else {
          // Regular click (no shift): Range split
          if (!splitStart) {
            // First click: Set start point
            setSplitStart({
              x: canvasX,
              screenX: screenX - LEFT_OFFSET
            });
            console.log('📍 Split range start point set');
            return;
          } else if (splitRange && splitRange.clips.length > 0) {
            // Second click: Execute range split
            // ✅ FIX: Calculate split times from world coordinates (canvasX)
            let startTime = splitRange.startX / (constants.PIXELS_PER_BEAT * viewport.zoomX);
            let endTime = splitRange.endX / (constants.PIXELS_PER_BEAT * viewport.zoomX);

            // ✅ FIX: Ensure endTime > startTime
            if (endTime <= startTime) {
              console.warn('⚠️ Range split: endTime must be greater than startTime');
              setSplitStart(null);
              setSplitRange(null);
              return;
            }

            // ✅ SNAP: Apply snap if enabled
            if (snapEnabled) {
              startTime = Math.round(startTime / snapSize) * snapSize;
              endTime = Math.round(endTime / snapSize) * snapSize;
              // Re-check after snap
              if (endTime <= startTime) {
                console.warn('⚠️ Range split: endTime <= startTime after snap, aborting');
                setSplitStart(null);
                setSplitRange(null);
                return;
              }
            }

            let successCount = 0;
            let failCount = 0;

            // Split each affected clip at both boundaries
            splitRange.clips.forEach(clip => {
              const clipStart = clip.startTime;
              const clipEnd = clip.startTime + clip.duration;

              // ✅ FIX: Collect split points within this clip (strict bounds check)
              const splitPoints = [];
              if (startTime > clipStart && startTime < clipEnd) {
                splitPoints.push(startTime);
              }
              if (endTime > clipStart && endTime < clipEnd && endTime !== startTime) {
                splitPoints.push(endTime);
              }

              // ✅ FIX: Sort split points (ascending)
              splitPoints.sort((a, b) => a - b);

              // ✅ FIX: Execute splits from right to left (to maintain clip IDs)
              // Reverse order prevents clip ID changes affecting subsequent splits
              splitPoints.reverse().forEach(splitTime => {
                const result = splitClip(clip.id, splitTime);
                if (result) {
                  successCount++;
                } else {
                  failCount++;
                  console.warn(`⚠️ Failed to split clip ${clip.id} at ${splitTime.toFixed(2)} beats`);
                }
              });
            });

            if (successCount > 0) {
              console.log(`✂️ Range split: ${successCount} cut${successCount > 1 ? 's' : ''} made between ${startTime.toFixed(2)} and ${endTime.toFixed(2)} beats`);
            }
            if (failCount > 0) {
              console.warn(`⚠️ ${failCount} cut${failCount > 1 ? 's' : ''} could not be made`);
            }

            // Clear range split state
            setSplitStart(null);
            setSplitRange(null);
            return;
          }
        }
      }
    }

    // If in draw mode and clicking on empty space, start drawing
    if (activeTool === 'draw' && e.button === 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
      if (screenX >= LEFT_OFFSET && screenY >= totalHeaderHeight) {
        const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;
        const canvasY = screenY - totalHeaderHeight + viewport.scrollY;

        // Find which track we're drawing on
        const trackIndex = Math.floor(canvasY / dimensions.trackHeight);
        if (trackIndex >= 0 && trackIndex < tracks.length) {
          const track = tracks[trackIndex];

          // Calculate start time (with snap if enabled)
          let startTime = canvasX / (constants.PIXELS_PER_BEAT * viewport.zoomX);
          if (snapEnabled) {
            startTime = Math.round(startTime / snapSize) * snapSize;
          }

          // Check if clicking on empty space (no existing clip)
          const { findClipAtPosition } = clipInteraction;
          const existingClip = findClipAtPosition(canvasX, canvasY);

          if (!existingClip) {
            setDrawStart({
              x: canvasX,
              y: canvasY,
              trackId: track.id,
              trackIndex,
              startTime
            });
            console.log(`✏️ Started drawing clip on ${track.name} at ${startTime.toFixed(2)} beats`);
            return;
          }
        }
      }
    }

    // Clip interaction takes priority for left mouse button
    if (e.button === 0 && activeTool !== 'draw') {
      handleMouseDown(e);
    }
    // Viewport panning for middle mouse button
    eventHandlers.onMouseDown(e);
  };

  const handleCombinedMouseMove = (e) => {
    // ✅ NEW: Delete clips on drag while in delete mode (right-click held)
    if (deletionMode && e.buttons === 2) { // Right button held while moving
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
      if (screenX >= LEFT_OFFSET && screenY >= totalHeaderHeight) {
        const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;
        const canvasY = screenY - totalHeaderHeight + viewport.scrollY;
        const { findClipAtPosition } = clipInteraction;
        const clip = findClipAtPosition(canvasX, canvasY);

        if (clip) {
          removeClips([clip.id]);
          console.log(`🗑️ Deleted clip while dragging: ${clip.name}`);
        }
      }
    }

    handleMouseMove(e);
    eventHandlers.onMouseMove(e);

    // Split preview logic - show where split will occur
    if (activeTool === 'split') {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;

      // Check if mouse is in valid canvas area
      if (screenX >= LEFT_OFFSET && screenY >= totalHeaderHeight) {
        const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;

        // If we have a split start point, show range preview
        if (splitStart) {
          const startX = Math.min(splitStart.x, canvasX);
          const endX = Math.max(splitStart.x, canvasX);

          // ✅ FIX: Find all clips that intersect with the range
          const affectedClips = clips.filter(clip => {
            const track = tracks.find(t => t.id === clip.trackId);
            if (!track) return false;

            // Calculate clip boundaries in world coordinates (canvasX space)
            const clipStartX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
            const clipEndX = clipStartX + (clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX);

            // ✅ FIX: Check if range overlaps with clip (intersection detection)
            // Range overlaps if: endX > clipStartX && startX < clipEndX
            // This ensures at least one split point can be within the clip
            return endX > clipStartX && startX < clipEndX;
          });

          setSplitRange({
            startX,
            endX,
            startScreenX: Math.min(splitStart.screenX, screenX - LEFT_OFFSET),
            endScreenX: Math.max(splitStart.screenX, screenX - LEFT_OFFSET),
            clips: affectedClips
          });
          setSplitPreview(null);
        } else {
          // Single line preview mode
          // ✅ FIX: Find clips that intersect with the split line
          const affectedClips = clips.filter(clip => {
            const track = tracks.find(t => t.id === clip.trackId);
            if (!track) return false;

            // Calculate clip boundaries in world coordinates (canvasX space)
            const clipStartX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
            const clipEndX = clipStartX + (clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX);

            // ✅ FIX: Check if split line intersects clip (strict bounds: not at boundaries)
            // canvasX must be strictly inside clip bounds for valid split (matches split execution logic)
            return canvasX > clipStartX && canvasX < clipEndX;
          });

          if (affectedClips.length > 0) {
            setSplitPreview({
              x: canvasX,
              screenX: screenX - LEFT_OFFSET,
              clips: affectedClips
            });
          } else {
            setSplitPreview(null);
          }
          setSplitRange(null);
        }
      } else {
        setSplitPreview(null);
        setSplitRange(null);
      }
    } else {
      // Clear preview if not in split mode
      if (splitPreview) setSplitPreview(null);
      if (splitRange) setSplitRange(null);
      if (splitStart) setSplitStart(null);
    }

    // Draw mode - show ghost preview while dragging
    if (activeTool === 'draw' && drawStart) {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
      if (screenX >= LEFT_OFFSET && screenY >= totalHeaderHeight) {
        const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;

        // Calculate end time (with snap if enabled)
        let endTime = canvasX / (constants.PIXELS_PER_BEAT * viewport.zoomX);
        if (snapEnabled) {
          endTime = Math.round(endTime / snapSize) * snapSize;
        }

        // Ensure end time is after start time
        if (endTime > drawStart.startTime) {
          const duration = endTime - drawStart.startTime;
          const worldX = drawStart.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const worldY = drawStart.trackIndex * dimensions.trackHeight;
          const width = duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const height = dimensions.trackHeight;

          setDrawGhost({
            trackId: drawStart.trackId,
            startTime: drawStart.startTime,
            endTime,
            duration,
            x: worldX,
            y: worldY,
            width,
            height
          });
        } else {
          setDrawGhost(null);
        }
      }
    } else if (drawGhost) {
      setDrawGhost(null);
    }
  };

  const handleCombinedMouseUp = (e) => {
    // ✅ NEW: Exit delete mode when right-click is released
    if (e.button === 2 && deletionMode) {
      setDeletionMode(false);
      console.log('✅ Delete mode deactivated (right-click released)');
      return;
    }

    // Draw mode - create clip on mouse up
    if (activeTool === 'draw' && drawStart && drawGhost) {
      const duration = drawGhost.duration;

      // Minimum duration check (at least 0.25 beats)
      if (duration >= 0.25) {
        // Create a pattern clip (for now, we'll use a default pattern)
        addPatternClip(
          drawStart.trackId,
          drawStart.startTime,
          'default-pattern', // TODO: Allow pattern selection
          duration,
          'default-instrument', // TODO: Allow instrument selection
          `Clip ${drawStart.startTime.toFixed(1)}`
        );
        console.log(`✏️ Created clip with duration ${duration.toFixed(2)} beats`);
      } else {
        console.warn('⚠️ Clip too small (minimum 0.25 beats)');
      }

      // Clear draw state
      setDrawStart(null);
      setDrawGhost(null);
      return;
    }

    handleMouseUp(e);
    eventHandlers.onMouseUp(e);
  };

  const handleCombinedMouseLeave = (e) => {
    handleMouseLeave(e);
    eventHandlers.onMouseLeave(e);
  };

  // Helper: Get container rectangle for drop calculations
  const getContainerRect = useCallback((event) => {
    const container = event.currentTarget === document ? containerRef.current : event.currentTarget;
    if (!container) return null;
    return container.getBoundingClientRect();
  }, []);

  // Handle pattern drop from pattern browser
  const handlePatternDrop = useCallback((e, patternId) => {
    // Clear preview
    setPatternDragPreview(null);

    // Calculate drop position
    const rect = getContainerRect(e);
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Skip if over toolbar, timeline or left sidebars
    const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
    if (screenX < LEFT_OFFSET || screenY < totalHeaderHeight) {
      return;
    }

    // Convert to canvas coordinates
    const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;
    const canvasY = screenY - totalHeaderHeight + viewport.scrollY;

    // Find track
    const trackIndex = Math.floor(canvasY / dimensions.trackHeight);
    if (trackIndex < 0 || trackIndex >= tracks.length) return;

    const track = tracks[trackIndex];
    if (!track) return;

    // Calculate start time
    const zoomX = isFinite(viewport.zoomX) && viewport.zoomX > 0 ? viewport.zoomX : 1;
    let startTime = canvasX / (constants.PIXELS_PER_BEAT * zoomX);

    // Snap to grid if enabled
    if (snapEnabled) {
      startTime = Math.round(startTime / snapSize) * snapSize;
    }

    // Get pattern duration from pattern data (default 4 bars = 16 beats if not found)
    // Pattern length is stored in steps (16th notes), convert to beats
    const pattern = patterns[patternId];
    // ✅ FIX: Check settings.length first, then top-level length, then default
    const patternLengthInSteps = pattern?.settings?.length || pattern?.length || 64;
    const duration = patternLengthInSteps / 4; // Convert steps to beats (1 beat = 4 steps)

    // Add pattern clip
    addPatternClip(
      track.id,
      startTime,
      patternId,
      duration,
      'default-instrument',
      patterns[patternId]?.name || `Pattern ${patternId}`
    );

    console.log(`🎹 Added pattern "${patterns[patternId]?.name}" at ${startTime.toFixed(2)} beats on track ${track.name}`);
  }, [viewport, tracks, dimensions.trackHeight, snapEnabled, snapSize, addPatternClip, patterns, getContainerRect, constants]);

  // Handle project audio drop (from Audio tab - frozen patterns, stems, etc.)
  const handleProjectAudioDrop = useCallback((e, audioAssetId) => {
    // Calculate drop position
    const rect = getContainerRect(e);
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Skip if over toolbar, timeline or left sidebars
    const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
    if (screenX < LEFT_OFFSET || screenY < totalHeaderHeight) {
      return;
    }

    // Convert to canvas coordinates
    const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;
    const canvasY = screenY - totalHeaderHeight + viewport.scrollY;

    // Find track
    const trackIndex = Math.floor(canvasY / dimensions.trackHeight);
    if (trackIndex < 0 || trackIndex >= tracks.length) return;

    const track = tracks[trackIndex];
    if (!track) return;

    // Calculate start time
    const zoomX = isFinite(viewport.zoomX) && viewport.zoomX > 0 ? viewport.zoomX : 1;
    let startTime = canvasX / (constants.PIXELS_PER_BEAT * zoomX);

    // Snap to grid if enabled
    if (snapEnabled) {
      startTime = Math.round(startTime / snapSize) * snapSize;
    }

    // Get sample info from ProjectAudioStore
    const audioSamples = useProjectAudioStore.getState().samples;
    const sample = audioSamples.find(s => s.assetId === audioAssetId);

    if (!sample) {
      console.error(`❌ Audio sample not found: ${audioAssetId}`);
      return;
    }

    // Use pre-calculated duration from sample metadata
    const duration = sample.durationBeats || 16; // Default 4 bars if not available
    const name = sample.name || 'Audio Clip';

    // Add audio clip
    const addAudioClip = useArrangementStore.getState().addArrangementAudioClip;
    addAudioClip(track.id, startTime, audioAssetId, duration, name);

    console.log(`🔊 Added audio clip "${name}" at ${startTime.toFixed(2)} beats on track ${track.name} (${duration.toFixed(2)} beats)`);
  }, [viewport, tracks, dimensions.trackHeight, snapEnabled, snapSize, getContainerRect, constants]);

  // Handle audio file and pattern drop
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling to parent panels
    setIsDragOver(false); // Clear drag overlay
    console.log('🎯 ArrangementPanel handleDrop called');

    try {
      // Check for pattern drop first
      const patternId = e.dataTransfer.getData('application/x-dawg-pattern');
      if (patternId) {
        console.log('✅ Pattern drop detected:', patternId);
        handlePatternDrop(e, patternId);
        return;
      }

      // Check for project audio drop (from Audio tab)
      const audioAssetId = e.dataTransfer.getData('application/x-dawg-audio');
      if (audioAssetId) {
        handleProjectAudioDrop(e, audioAssetId);
        return;
      }

      // Handle generic file node drop (e.g., from FileBrowser)
      const fileNodeData = e.dataTransfer.getData('application/x-dawg-file-node');
      if (fileNodeData) {
        const fileNode = JSON.parse(fileNodeData);

        if (!fileNode.url && !fileNode.assetId) {
          console.warn('❌ Dropped file has no URL or Asset ID');
          return;
        }

        // Calculate drop position
        const rect = getContainerRect(e);
        if (!rect) return;

        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // Skip if over toolbar, timeline or left sidebars
        const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
        if (screenX < LEFT_OFFSET || screenY < totalHeaderHeight) {
          return;
        }

        // Convert to canvas coordinates
        const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;
        const canvasY = screenY - totalHeaderHeight + viewport.scrollY;

        // Convert X to Beats
        const zoomX = isFinite(viewport.zoomX) && viewport.zoomX > 0 ? viewport.zoomX : 1;
        const positionInBeats = Math.max(0, canvasX / (constants.PIXELS_PER_BEAT * zoomX));

        // Quantize to snap size if enabled
        const snapEnabledState = useArrangementStore.getState().snapEnabled;
        const snapSizeState = useArrangementStore.getState().snapSize;
        const startTime = snapEnabledState
          ? Math.round(positionInBeats / snapSizeState) * snapSizeState
          : positionInBeats;

        // Convert Y to Track Index
        const trackIndex = Math.floor(canvasY / dimensions.trackHeight);

        // Get target track or create new
        const currentTracks = useArrangementStore.getState().arrangementTracks;
        let targetTrackId;

        if (trackIndex < currentTracks.length && trackIndex >= 0) {
          targetTrackId = currentTracks[trackIndex].id;
        } else {
          // Create new track(s) if dropped below
          // Automatically expand tracks
          const newTrackId = await useArrangementStore.getState().addArrangementTrack(`Audio Track ${currentTracks.length + 1}`);
          targetTrackId = newTrackId;
        }

        // Load Asset
        const assetManager = audioAssetManager;

        console.log(`Loading ${fileNode.name}...`);

        try {
          const buffer = await assetManager.loadAsset(fileNode.url, {
            name: fileNode.name,
            source: 'drag-drop'
          });

          if (buffer) {
            // Use centralized duration calculation
            const assetId = assetManager.generateAssetId(fileNode.url);
            const asset = assetManager.assets.get(assetId);
            const currentBPM = usePlaybackStore.getState().bpm || 120;
            const duration = getAudioClipDurationBeats(buffer, asset?.metadata, currentBPM);

            // Add to ProjectAudioStore when first used in project
            const projectAudioStore = useProjectAudioStore.getState();
            const existingSample = projectAudioStore.samples.find(s => s.assetId === assetId);

            if (!existingSample) {
              projectAudioStore.addSample({
                id: assetId,
                name: fileNode.name,
                assetId: assetId,
                url: fileNode.url,
                durationBeats: duration,
                durationSeconds: buffer.duration,
                type: 'used-in-project', // Mark as actively used in project
                createdAt: Date.now(),
                metadata: {
                  url: fileNode.url,
                  source: 'drag-drop',
                  bpm: currentBPM
                }
              });
              console.log(`📦 Added to project audio library: ${fileNode.name}`);
            }

            // Add Clip
            useArrangementStore.getState().addArrangementAudioClip(
              targetTrackId,
              startTime,
              assetId, // Ensure ID consistency
              duration,
              fileNode.name
            );
            console.log(`✅ Imported ${fileNode.name}`);
          }
        } catch (err) {
          console.error('Failed to load dropped audio:', err);
          console.error(`❌ Failed to load audio: ${err.message}`);
        }
        return;
      }

      // Otherwise, handle audio file drop (from FileBrowser, legacy text/plain)
      const data = e.dataTransfer.getData('text/plain');
      if (!data) return;

      const fileData = JSON.parse(data);
      const { name, url } = fileData;

      // Calculate drop position
      const rect = getContainerRect(e);
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Skip if over toolbar, timeline or left sidebars
      const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
      if (screenX < LEFT_OFFSET || screenY < totalHeaderHeight) {
        return;
      }

      // Convert to canvas coordinates
      const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;
      const canvasY = screenY - totalHeaderHeight + viewport.scrollY;

      // Find track
      const trackIndex = Math.floor(canvasY / dimensions.trackHeight);
      if (trackIndex < 0 || trackIndex >= tracks.length) return;

      const track = tracks[trackIndex];
      if (!track) return;

      // Calculate start time
      const zoomX = isFinite(viewport.zoomX) && viewport.zoomX > 0 ? viewport.zoomX : 1;
      let startTime = canvasX / (constants.PIXELS_PER_BEAT * zoomX);

      // Snap to grid if enabled
      if (snapEnabled) {
        startTime = Math.round(startTime / snapSize) * snapSize;
      }

      // Load audio buffer to get duration
      audioAssetManager.loadAsset(url, { name, source: 'file-browser' }).then((buffer) => {
        // Generate asset ID for storage
        const assetId = audioAssetManager.generateAssetId(url);

        // ✅ Use centralized duration calculation
        const asset = audioAssetManager.assets.get(assetId);
        const currentBPM = usePlaybackStore.getState().bpm || 120;
        const duration = getAudioClipDurationBeats(buffer, asset?.metadata, currentBPM);

        // ✅ NEW: Add to ProjectAudioStore when first used in project
        // This tracks which audio files are actually part of this project
        const projectAudioStore = useProjectAudioStore.getState();
        const existingSample = projectAudioStore.samples.find(s => s.assetId === assetId);

        if (!existingSample) {
          projectAudioStore.addSample({
            id: assetId,
            name: name,
            assetId: assetId,
            url,
            durationBeats: duration,
            durationSeconds: buffer.duration,
            type: 'used-in-project', // Mark as actively used in project
            createdAt: Date.now(),
            metadata: {
              url: url,
              source: 'file-browser',
              bpm: currentBPM
            }
          });
          console.log(`📦 Added to project audio library: ${name}`);
        }

        // Add audio clip
        const addAudioClip = useArrangementStore.getState().addArrangementAudioClip;
        addAudioClip(track.id, startTime, assetId, duration, name);

        console.log(`✅ Added audio clip: ${name} at ${startTime} beats on track ${track.name} (${duration.toFixed(2)} beats)`);
      }).catch(err => {
        console.error('Failed to load audio:', err);
      });

    } catch (err) {
      console.error('Failed to handle drop:', err);
    }
  }, [handlePatternDrop, handleProjectAudioDrop, viewport, tracks, dimensions.trackHeight, snapEnabled, snapSize, getContainerRect, constants]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling to parent panels
    e.dataTransfer.dropEffect = 'copy';

    // Check if dragging a pattern or audio or generic file node
    const types = e.dataTransfer.types;
    const isDraggingPattern = types.includes('application/x-dawg-pattern');
    const isDraggingAudio = types.includes('application/x-dawg-audio');
    const isDraggingFileNode = types.includes('application/x-dawg-file-node');
    const isDraggingLegacyAudioFile = types.includes('text/plain'); // For legacy FileBrowser drops

    if (!isDraggingPattern && !isDraggingAudio && !isDraggingFileNode && !isDraggingLegacyAudioFile) {
      setPatternDragPreview(null);
      setIsDragOver(false);
      return;
    }

    // Set general drag over state for visual feedback
    setIsDragOver(true);

    // Only show pattern preview for patterns (audio doesn't need preview)
    if (!isDraggingPattern) {
      setPatternDragPreview(null);
      return;
    }

    // Calculate drag position for pattern preview
    const rect = getContainerRect(e);
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;

    // Only show preview if over valid canvas area
    if (screenX >= LEFT_OFFSET && screenY >= totalHeaderHeight) {
      const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;
      const canvasY = screenY - totalHeaderHeight + viewport.scrollY;

      // Find track
      const trackIndex = Math.floor(canvasY / dimensions.trackHeight);
      if (trackIndex >= 0 && trackIndex < tracks.length) {
        const track = tracks[trackIndex];

        // Calculate start time
        const zoomX = isFinite(viewport.zoomX) && viewport.zoomX > 0 ? viewport.zoomX : 1;
        let startTime = canvasX / (constants.PIXELS_PER_BEAT * zoomX);

        // Snap to grid if enabled
        if (snapEnabled) {
          startTime = Math.round(startTime / snapSize) * snapSize;
        }

        // Get pattern duration from pattern data (default 4 bars = 16 beats if not found)
        // Pattern length is stored in steps (16th notes), convert to beats
        const patternData = e.dataTransfer.getData('application/x-dawg-pattern');
        const pattern = patterns[patternData];
        // ✅ FIX: Check settings.length first, then top-level length, then default
        const patternLengthInSteps = pattern?.settings?.length || pattern?.length || 64;
        const duration = patternLengthInSteps / 4; // Convert steps to beats (1 beat = 4 steps)

        // Calculate preview dimensions in world space
        const worldX = startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
        const worldY = trackIndex * dimensions.trackHeight;
        const width = duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
        const height = dimensions.trackHeight;

        setPatternDragPreview({
          patternId: 'preview',
          trackId: track.id,
          startTime,
          x: worldX,
          y: worldY,
          width,
          height
        });
      } else {
        setPatternDragPreview(null);
      }
    } else {
      setPatternDragPreview(null);
    }
  }, [viewport, tracks, dimensions.trackHeight, snapEnabled, snapSize, patterns, getContainerRect, constants]);

  const handleDragLeave = useCallback((e) => {
    // Clear preview when leaving the drop zone
    setPatternDragPreview(null);
    // Only clear isDragOver if leaving the container entirely
    if (!containerRef.current?.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  // Fix passive event listener warning - we need { passive: false } for preventDefault
  useEffect(() => {
    const container = containerRef.current;
    const canvasContainer = canvasContainerRef.current;
    if (!container) return;

    // Main container wheel handler (for scrolling)
    const wheelHandler = (e) => {
      eventHandlers.onWheel(e);
    };

    // Canvas container wheel handler (for zooming with Ctrl+Wheel)
    const canvasWheelHandler = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        const zoomFactor = 1 + delta;

        if (e.shiftKey) {
          // Shift+Ctrl+Wheel: Vertical zoom
          const newZoomY = Math.max(0.5, Math.min(2, viewport.zoomY * zoomFactor));
          eventHandlers.onZoom(viewport.zoomX, newZoomY);
        } else {
          // Ctrl+Wheel: Horizontal zoom
          const newZoomX = Math.max(0.25, Math.min(4, viewport.zoomX * zoomFactor));
          eventHandlers.onZoom(newZoomX, viewport.zoomY);
        }
      }
    };

    container.addEventListener('wheel', wheelHandler, { passive: false });
    if (canvasContainer) {
      canvasContainer.addEventListener('wheel', canvasWheelHandler, { passive: false });
    }

    return () => {
      container.removeEventListener('wheel', wheelHandler);
      if (canvasContainer) {
        canvasContainer.removeEventListener('wheel', canvasWheelHandler);
      }
    };
  }, [eventHandlers, viewport.zoomX, viewport.zoomY]);

  // Global drag & drop handlers to catch pattern/audio drops anywhere on the page
  // This ensures drops work even when dragging over other elements (toolbars, etc.)
  useEffect(() => {
    const globalDragOver = (e) => {
      const types = e.dataTransfer?.types;
      if (!types) return;

      const isDraggingPattern = types.includes('application/x-dawg-pattern');
      const isDraggingAudio = types.includes('application/x-dawg-audio');
      const isDraggingFileNode = types.includes('application/x-dawg-file-node');
      const isDraggingLegacyAudioFile = types.includes('text/plain');

      if (!isDraggingPattern && !isDraggingAudio && !isDraggingFileNode && !isDraggingLegacyAudioFile) return;

      // Only handle if NOT already inside our container (avoid duplicate handling)
      const container = containerRef.current;
      if (container && !container.contains(e.target)) {
        handleDragOver(e);
      }
    };

    const globalDrop = (e) => {
      const types = e.dataTransfer?.types;
      if (!types) return;

      const isDraggingPattern = types.includes('application/x-dawg-pattern');
      const isDraggingAudio = types.includes('application/x-dawg-audio');
      const isDraggingFileNode = types.includes('application/x-dawg-file-node');
      const isDraggingLegacyAudioFile = types.includes('text/plain');

      if (!isDraggingPattern && !isDraggingAudio && !isDraggingFileNode && !isDraggingLegacyAudioFile) return;

      // Only handle if NOT already inside our container (avoid duplicate handling)
      const container = containerRef.current;
      if (container && !container.contains(e.target)) {
        handleDrop(e);
      }
    };

    document.addEventListener('dragover', globalDragOver);
    document.addEventListener('drop', globalDrop);

    return () => {
      document.removeEventListener('dragover', globalDragOver);
      document.removeEventListener('drop', globalDrop);
    };
  }, [handleDragOver, handleDrop]);

  return (
    <div
      ref={containerRef}
      className="arr-v2-container"
      onMouseDown={handleCombinedMouseDown}
      onMouseMove={handleCombinedMouseMove}
      onMouseUp={handleCombinedMouseUp}
      onMouseLeave={handleCombinedMouseLeave}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Toolbar */}
      <ArrangementToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        snapEnabled={snapEnabled}
        snapSize={snapSize}
        onSnapToggle={() => setSnapEnabled(!snapEnabled)}
        onSnapSizeChange={setSnapSize}
        zoomX={viewport.zoomX}
        zoomY={viewport.zoomY}
        onZoomChange={(zoomX, zoomY) => {
          eventHandlers.onZoom(zoomX, zoomY);
        }}
        onFitToView={() => {
          // Calculate zoom to fit all clips
          if (clips.length === 0) {
            eventHandlers.onZoom(1.0, 1.0);
            return;
          }

          // Find bounds of all clips
          let minTime = Infinity;
          let maxTime = -Infinity;

          clips.forEach(clip => {
            minTime = Math.min(minTime, clip.startTime);
            maxTime = Math.max(maxTime, clip.startTime + clip.duration);
          });

          const totalBeats = maxTime - minTime;
          const availableWidth = viewport.width - constants.TRACK_HEADER_WIDTH;
          const pixelsPerBeat = availableWidth / totalBeats;
          const newZoomX = Math.max(0.25, Math.min(4, pixelsPerBeat / constants.PIXELS_PER_BEAT));

          eventHandlers.onZoom(newZoomX, 1.0);
          console.log(`🔍 Fit to view: ${totalBeats.toFixed(1)} beats, zoom ${newZoomX.toFixed(2)}x`);
        }}
      />

      {/* Timeline Ruler (top overlay) */}
      <div
        className="arr-v2-timeline-container"
        style={{
          height: `${constants.TIMELINE_HEIGHT}px`,
          marginLeft: `${LEFT_OFFSET}px`
        }}
      >
        <TimelineRuler
          viewport={viewport}
          cursorPosition={effectiveCurrentStep}
          isPlaying={isPlaying}
          onSeek={handleTimelineSeek}
          height={constants.TIMELINE_HEIGHT}
          markers={markers}
          loopRegions={loopRegions}
          onAddMarker={(time) => {
            const label = prompt('Marker name:', 'Marker');
            if (label) {
              addMarker(time, label);
              console.log(`📍 Added marker "${label}" at ${time.toFixed(2)} beats`);
            }
          }}
          onRemoveMarker={removeMarker}
          onAddLoopRegion={(startTime, endTime) => {
            const label = prompt('Loop region name:', 'Loop');
            if (label) {
              addLoopRegion(startTime, endTime, label);
              console.log(`🔄 Added loop region "${label}" from ${startTime.toFixed(2)} to ${endTime.toFixed(2)} beats`);
            }
          }}
          onUpdateLoopRegion={updateLoopRegion}
          onRemoveLoopRegion={removeLoopRegion}
          snapEnabled={snapEnabled}
          snapSize={snapSize}
        />
      </div>

      {/* Main content area */}
      <div className="arr-v2-main-content">
        {/* Pattern Browser (left sidebar) */}
        <PatternBrowser />

        {/* Track Headers (left overlay) */}
        <div
          className="arr-v2-track-headers"
          style={{
            width: `${constants.TRACK_HEADER_WIDTH}px`,
            transform: `translateY(${-viewport.scrollY}px)`
          }}
        >
          {tracks.map((track, index) => (
            <React.Fragment key={track.id}>
              <TrackHeader
                track={track}
                index={index}
                height={dimensions.trackHeight}
                onUpdate={(updates) => handleTrackUpdate(track.id, updates)}
                onDoubleClick={() => handleTrackClick(index)}
                isSelected={selectedTrackIndex === index}
                showAutomation={automationExpandedTracks.has(track.id)}
                onToggleAutomation={() => {
                  setAutomationExpandedTracks(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(track.id)) {
                      newSet.delete(track.id);
                    } else {
                      newSet.add(track.id);
                    }
                    return newSet;
                  });
                }}
              />
              {/* ✅ NEW: Automation lanes for this track */}
              {automationExpandedTracks.has(track.id) && (
                <AutomationLanes
                  trackId={track.id}
                  trackIndex={index}
                  viewport={viewport}
                  dimensions={dimensions}
                  snapValue={snapSize}
                  activeTool={activeTool}
                  onScroll={(deltaX, deltaY) => {
                    // Handle scroll for automation lanes
                    eventHandlers.onScroll(deltaX, deltaY);
                  }}
                />
              )}
            </React.Fragment>
          ))}

          {/* Add Track Button - ✅ PHASE 2: Using Button component from library */}
          <Button
            onClick={() => {
              const addTrack = useArrangementStore.getState().addArrangementTrack;
              addTrack();
            }}
            variant="default"
            size="sm"
            className="arr-v2-add-track-btn"
            title="Add new track"
          >
            <span className="arr-v2-add-track-icon">+</span>
            <span className="arr-v2-add-track-label">Add Track</span>
          </Button>
        </div>

        {/* Canvas layers */}
        <div
          ref={canvasContainerRef}
          className="arr-v2-canvas-container"
          style={{
            cursor:
              deletionMode ? 'not-allowed' :
                activeTool === 'split' ? 'col-resize' :
                  activeTool === 'draw' ? 'crosshair' :
                    hoveredHandle?.handle === 'fadeIn' || hoveredHandle?.handle === 'fadeOut' ? 'nw-resize' :
                      hoveredHandle?.handle === 'gain' ? 'ns-resize' :
                        hoveredHandle ? 'ew-resize' :
                          dragGhosts ? 'grabbing' :
                            resizeGhosts ? 'ew-resize' :
                              fadeGhosts ? 'nw-resize' :
                                gainGhosts ? 'ns-resize' :
                                  'default'
          }}
          onContextMenu={handleContextMenu}
        >
          <canvas ref={gridCanvasRef} className="arr-v2-canvas arr-v2-canvas-grid" />
          <canvas ref={clipsCanvasRef} className="arr-v2-canvas arr-v2-canvas-clips" />
          <canvas ref={handlesCanvasRef} className="arr-v2-canvas arr-v2-canvas-handles" />
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ClipContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          clipIds={contextMenu.clipIds}
          hasClipboard={clipboard && clipboard.length > 0}
          onCopy={copySelection}
          onCut={cutSelection}
          onPaste={() => paste(effectiveCurrentStep || 0)}
          onDelete={() => removeClips(contextMenu.clipIds)}
          onDuplicate={() => {
            const newClipIds = duplicateClips(contextMenu.clipIds);
            useArrangementStore.getState().setArrangementSelection(newClipIds);
          }}
          onRename={handleRenameClip}
          onColorChange={(color) => {
            // Apply color to all selected clips
            contextMenu.clipIds.forEach(clipId => {
              updateClip(clipId, { color });
            });
            console.log(`🎨 Changed color for ${contextMenu.clipIds.length} clip${contextMenu.clipIds.length > 1 ? 's' : ''} to ${color}`);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Deletion Mode Indicator */}
      {deletionMode && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(239, 68, 68, 0.95)',
            color: 'white',
            padding: '16px 32px',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: 'bold',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}
        >
          🗑️ DELETION MODE - Click clips to delete (ESC to exit)
        </div>
      )}

      {/* Split Mode Indicator */}
      {activeTool === 'split' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(139, 92, 246, 0.95)',
            color: 'white',
            padding: '16px 32px',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: 'bold',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}
        >
          ✂️ SPLIT MODE - {splitRange ? `Click to cut ${splitRange.clips.length} clip${splitRange.clips.length > 1 ? 's' : ''}` : splitStart ? 'Move and Click for second point' : splitPreview ? `Shift+Click to split ${splitPreview.clips.length} clip${splitPreview.clips.length > 1 ? 's' : ''} | Click for range` : 'Click for range split'} (ESC to exit)
        </div>
      )}

      {/* Draw Mode Indicator */}
      {activeTool === 'draw' && (
        <div
          style={{
            position: 'fixed',
            top: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(34, 197, 94, 0.95)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}
        >
          ✏️ DRAW MODE - {drawGhost ? `Drawing ${drawGhost.duration.toFixed(2)} beats` : 'Click and drag to create clip'} (ESC to exit)
        </div>
      )}

      {/* Debug overlay */}
      <div className="arr-v2-debug-overlay">
        <div>Zoom: {viewport.zoomX.toFixed(2)}x, {viewport.zoomY.toFixed(2)}y</div>
        <div>Scroll: {Math.round(viewport.scrollX)}, {Math.round(viewport.scrollY)}</div>
        <div>LOD: {lod}</div>
        <div>Tracks: {tracks.length} | Clips: {clips.length}</div>
        <div>Snap: {snapEnabled ? `${snapSize} beats` : 'Off'}</div>
        <div>Tool: {activeTool.toUpperCase()}</div>
        {deletionMode && <div style={{ color: '#ef4444', fontWeight: 'bold' }}>🗑️ DELETION MODE</div>}
        {activeTool === 'split' && <div style={{ color: '#8b5cf6', fontWeight: 'bold' }}>✂️ SPLIT MODE</div>}
        {activeTool === 'draw' && <div style={{ color: '#22c55e', fontWeight: 'bold' }}>✏️ DRAW MODE</div>}
      </div>
    </div>
  );
}

export default ArrangementPanelV2;
