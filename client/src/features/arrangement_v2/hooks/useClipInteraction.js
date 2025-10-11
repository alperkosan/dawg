/**
 * 🎯 CLIP INTERACTION HOOK
 *
 * Handles all clip interactions in ArrangementV2 with proper hierarchy:
 *
 * INTERACTION PRIORITY (high → low):
 * 1. Resize handles (not yet implemented)
 * 2. Fade handles (not yet implemented)
 * 3. Clip body drag (move clips)
 * 4. Empty space (marquee selection)
 * 5. Pan (middle mouse - handled by viewport)
 *
 * FEATURES:
 * - Click selection (single, multi with shift/ctrl)
 * - Drag & drop clips (move between tracks/time)
 * - Marquee selection (drag empty area)
 * - Snap to grid
 * - Multi-clip drag (selected clips move together)
 * - Hover detection
 */

import { useState, useCallback, useRef } from 'react';
import { useArrangementV2Store } from '@/store/useArrangementV2Store';
import { snapToGrid } from '../renderers/gridRenderer';

// ============================================================================
// CONSTANTS
// ============================================================================

const MARQUEE_MIN_SIZE = 5; // Minimum pixels to trigger marquee selection
const DRAG_THRESHOLD = 3; // Pixels moved before starting drag
const RESIZE_HANDLE_WIDTH = 8; // Pixels for resize handle hit area
const MIN_CLIP_DURATION = 0.25; // Minimum clip duration in beats (1/16 note)
const FADE_HANDLE_SIZE = 30; // Pixels for fade handle hit area (triangular corner) - increased for easier grab
const GAIN_HANDLE_BASE_RADIUS = 10; // Base radius for gain handle at 1x zoom
const GAIN_HANDLE_MIN_RADIUS = 6; // Minimum radius when zoomed out
const MIN_GAIN_DB = -12; // Minimum gain in dB
const MAX_GAIN_DB = 12; // Maximum gain in dB

// ============================================================================
// HOOK
// ============================================================================

/**
 * Custom hook for clip interactions
 */
export function useClipInteraction(viewport, tracks, clips, constants, dimensions, toolbarHeight = 0, leftOffset = 200, onClipDoubleClick = null) {
  const [marqueeBox, setMarqueeBox] = useState(null); // { x, y, width, height }
  const [hoveredClipId, setHoveredClipId] = useState(null);
  const [hoveredHandle, setHoveredHandle] = useState(null); // { clipId, handle: 'left' | 'right' | 'fadeIn' | 'fadeOut' | 'gain' }
  const [dragGhosts, setDragGhosts] = useState(null); // Array of {clipId, x, y, width, height}
  const [resizeGhosts, setResizeGhosts] = useState(null); // Array of ghosts for multi-resize
  const [fadeGhosts, setFadeGhosts] = useState(null); // Array of ghosts for fade manipulation
  const [gainGhosts, setGainGhosts] = useState(null); // Array of ghosts for gain manipulation

  // Store actions
  const setSelection = useArrangementV2Store(state => state.setSelection);
  const addToSelection = useArrangementV2Store(state => state.addToSelection);
  const toggleSelection = useArrangementV2Store(state => state.toggleSelection);
  const clearSelection = useArrangementV2Store(state => state.clearSelection);
  const selectedClipIds = useArrangementV2Store(state => state.selectedClipIds);
  const updateClip = useArrangementV2Store(state => state.updateClip);
  const snapSize = useArrangementV2Store(state => state.snapSize);

  // Double-click detection
  const lastClickRef = useRef({ time: 0, clipId: null });

  // Interaction state machine
  const interactionStateRef = useRef({
    mode: 'idle', // 'idle' | 'dragging' | 'resizing' | 'fading' | 'gaining' | 'marquee'

    // Marquee state
    marqueeStartX: 0,
    marqueeStartY: 0,

    // Drag state
    draggedClipIds: [],
    dragStartCanvasX: 0,
    dragStartCanvasY: 0,
    dragStartScreenX: 0,
    dragStartScreenY: 0,
    originalClipStates: new Map(), // Map<clipId, {trackId, startTime, duration}>
    hasMoved: false, // Track if drag threshold exceeded

    // Resize state
    resizingClipIds: [], // Array of clip IDs being resized together
    resizeHandle: null, // 'left' | 'right'
    resizeStartCanvasX: 0,
    resizeStartScreenX: 0,
    originalClipStates: new Map(), // Map<clipId, {startTime, duration}> for resize

    // Fade state
    fadingClipIds: [], // Array of clip IDs being faded together
    fadeHandle: null, // 'fadeIn' | 'fadeOut'
    fadeStartCanvasX: 0,
    fadeStartScreenX: 0,
    originalFadeStates: new Map(), // Map<clipId, {fadeIn, fadeOut}>

    // Gain state
    gainingClipIds: [], // Array of clip IDs being gained together
    gainStartCanvasY: 0,
    gainStartScreenY: 0,
    originalGainStates: new Map(), // Map<clipId, {gain}>
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Convert screen coordinates to canvas coordinates
   */
  const screenToCanvas = useCallback((screenX, screenY) => {
    // Protect against NaN in viewport scroll values
    const scrollX = isFinite(viewport.scrollX) ? viewport.scrollX : 0;
    const scrollY = isFinite(viewport.scrollY) ? viewport.scrollY : 0;

    const canvasX = screenX - leftOffset + scrollX;
    const canvasY = screenY - constants.TIMELINE_HEIGHT + scrollY;

    return { x: canvasX, y: canvasY };
  }, [viewport, constants]);

  /**
   * Check if position is over a resize handle
   * Returns { clip, handle } or null
   */
  const findResizeHandleAtPosition = useCallback((canvasX, canvasY) => {
    // Find track first
    const trackIndex = Math.floor(canvasY / dimensions.trackHeight);
    if (trackIndex < 0 || trackIndex >= tracks.length) return null;

    const track = tracks[trackIndex];
    if (!track) return null;

    // Check if Y is within clip area
    const trackY = trackIndex * dimensions.trackHeight;
    const clipAreaY = trackY + 4;
    const clipAreaHeight = dimensions.trackHeight - 8;
    if (canvasY < clipAreaY || canvasY > clipAreaY + clipAreaHeight) return null;

    // Find clip in this track
    const zoomX = isFinite(viewport.zoomX) && viewport.zoomX > 0 ? viewport.zoomX : 1;
    const beatsX = canvasX / (constants.PIXELS_PER_BEAT * zoomX);

    for (const clip of clips) {
      if (clip.trackId !== track.id) continue;

      const clipStartX = clip.startTime * constants.PIXELS_PER_BEAT * zoomX;
      const clipWidth = clip.duration * constants.PIXELS_PER_BEAT * zoomX;
      const clipEndX = clipStartX + clipWidth;

      // Check left handle (first 8px)
      if (canvasX >= clipStartX && canvasX <= clipStartX + RESIZE_HANDLE_WIDTH) {
        return { clip, handle: 'left' };
      }

      // Check right handle (last 8px)
      if (canvasX >= clipEndX - RESIZE_HANDLE_WIDTH && canvasX <= clipEndX) {
        return { clip, handle: 'right' };
      }
    }

    return null;
  }, [tracks, clips, dimensions, constants, viewport]);

  /**
   * Find fade handle at position (for audio clips only)
   * Fade handles are in the corners: top-left (fadeIn) and top-right (fadeOut)
   * Returns { clip, handle } or null
   */
  const findFadeHandleAtPosition = useCallback((canvasX, canvasY) => {
    // Find track first
    const trackIndex = Math.floor(canvasY / dimensions.trackHeight);
    if (trackIndex < 0 || trackIndex >= tracks.length) return null;

    const track = tracks[trackIndex];
    if (!track) return null;

    // Check if Y is within clip area (expanded hit area for easier grab)
    const trackY = trackIndex * dimensions.trackHeight;
    const clipAreaY = trackY + 4;
    const clipAreaHeight = dimensions.trackHeight - 8;

    // Fade handles available in top half of clip for easier access
    const fadeHandleHeight = clipAreaHeight * 0.6; // 60% of clip height
    if (canvasY < clipAreaY || canvasY > clipAreaY + fadeHandleHeight) return null;

    // Find clip in this track
    const zoomX = isFinite(viewport.zoomX) && viewport.zoomX > 0 ? viewport.zoomX : 1;

    for (const clip of clips) {
      if (clip.trackId !== track.id) continue;
      if (clip.type !== 'audio') continue; // Fade only for audio clips

      const clipStartX = clip.startTime * constants.PIXELS_PER_BEAT * zoomX;
      const clipWidth = clip.duration * constants.PIXELS_PER_BEAT * zoomX;
      const clipEndX = clipStartX + clipWidth;

      // Check if within clip X bounds
      if (canvasX < clipStartX || canvasX > clipEndX) continue;

      // Expanded hit regions for easier grabbing
      const fadeHandleWidth = Math.min(FADE_HANDLE_SIZE, clipWidth / 3);

      // Check fade in handle (left region with generous hit area)
      const fadeInRegionX = clipStartX + fadeHandleWidth;
      if (canvasX >= clipStartX && canvasX <= fadeInRegionX) {
        // More forgiving triangular detection
        const relX = canvasX - clipStartX;
        const relY = canvasY - clipAreaY;
        // Expanded triangle: allow more vertical space
        const maxY = fadeHandleHeight * (1.2 - (relX / fadeHandleWidth) * 0.5);
        if (relY <= maxY) {
          return { clip, handle: 'fadeIn' };
        }
      }

      // Check fade out handle (right region with generous hit area)
      const fadeOutRegionX = clipEndX - fadeHandleWidth;
      if (canvasX >= fadeOutRegionX && canvasX <= clipEndX) {
        // More forgiving triangular detection
        const relX = clipEndX - canvasX;
        const relY = canvasY - clipAreaY;
        // Expanded triangle: allow more vertical space
        const maxY = fadeHandleHeight * (1.2 - (relX / fadeHandleWidth) * 0.5);
        if (relY <= maxY) {
          return { clip, handle: 'fadeOut' };
        }
      }
    }

    return null;
  }, [tracks, clips, dimensions, constants, viewport]);

  /**
   * Find gain handle at position (for audio clips only)
   * Gain handle is a circular control in bottom-right corner
   * Returns { clip, handle } or null
   */
  const findGainHandleAtPosition = useCallback((canvasX, canvasY) => {
    // Find track first
    const trackIndex = Math.floor(canvasY / dimensions.trackHeight);
    if (trackIndex < 0 || trackIndex >= tracks.length) return null;

    const track = tracks[trackIndex];
    if (!track) return null;

    // Check if Y is within clip area
    const trackY = trackIndex * dimensions.trackHeight;
    const clipAreaY = trackY + 4;
    const clipAreaHeight = dimensions.trackHeight - 8;

    // Find clip in this track
    const zoomX = isFinite(viewport.zoomX) && viewport.zoomX > 0 ? viewport.zoomX : 1;

    // Calculate handle radius based on zoom (smaller when zoomed out)
    const handleRadius = Math.max(GAIN_HANDLE_MIN_RADIUS, GAIN_HANDLE_BASE_RADIUS * Math.sqrt(zoomX));

    for (const clip of clips) {
      if (clip.trackId !== track.id) continue;
      if (clip.type !== 'audio') continue; // Gain only for audio clips

      const clipStartX = clip.startTime * constants.PIXELS_PER_BEAT * zoomX;
      const clipWidth = clip.duration * constants.PIXELS_PER_BEAT * zoomX;
      const clipEndX = clipStartX + clipWidth;

      // Check if within clip X bounds
      if (canvasX < clipStartX || canvasX > clipEndX) continue;

      // Gain handle is in the center-bottom of the clip
      const handleX = clipStartX + clipWidth / 2;
      const handleY = clipAreaY + clipAreaHeight * 0.75; // 75% down from top

      // Check if within circular region
      const dx = canvasX - handleX;
      const dy = canvasY - handleY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= handleRadius) {
        return { clip, handle: 'gain' };
      }
    }

    return null;
  }, [tracks, clips, dimensions, constants, viewport]);

  /**
   * Find clip at given canvas coordinates
   */
  const findClipAtPosition = useCallback((canvasX, canvasY) => {
    // Find track (accounting for the fact that clips are drawn with padding)
    const trackIndex = Math.floor(canvasY / dimensions.trackHeight);

    if (trackIndex < 0 || trackIndex >= tracks.length) {
      return null;
    }

    const track = tracks[trackIndex];
    if (!track) {
      return null;
    }

    // Calculate clip area within track (with 4px top/bottom padding)
    const trackY = trackIndex * dimensions.trackHeight;
    const clipAreaY = trackY + 4; // Top padding
    const clipAreaHeight = dimensions.trackHeight - 8; // 4px top + 4px bottom

    // Check if Y is within clip area
    if (canvasY < clipAreaY || canvasY > clipAreaY + clipAreaHeight) {
      return null;
    }

    // Find clip in this track by X position
    // Protect against NaN/invalid zoom
    const zoomX = isFinite(viewport.zoomX) && viewport.zoomX > 0 ? viewport.zoomX : 1;
    const beatsX = canvasX / (constants.PIXELS_PER_BEAT * zoomX);

    for (const clip of clips) {
      if (clip.trackId !== track.id) continue;

      const clipEndBeat = clip.startTime + clip.duration;

      if (beatsX >= clip.startTime && beatsX <= clipEndBeat) {
        return clip;
      }
    }

    return null;
  }, [tracks, clips, dimensions, constants, viewport]);

  /**
   * Get all clips inside marquee box
   */
  const getClipsInMarquee = useCallback((box) => {
    const clipsInBox = [];

    clips.forEach(clip => {
      const track = tracks.find(t => t.id === clip.trackId);
      if (!track) return;

      const trackIndex = tracks.indexOf(track);

      // Calculate clip bounds
      const clipX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
      const clipY = trackIndex * dimensions.trackHeight;
      const clipWidth = clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
      const clipHeight = dimensions.trackHeight;

      // Check intersection with marquee box
      if (
        clipX < box.x + box.width &&
        clipX + clipWidth > box.x &&
        clipY < box.y + box.height &&
        clipY + clipHeight > box.y
      ) {
        clipsInBox.push(clip.id);
      }
    });

    return clipsInBox;
  }, [clips, tracks, dimensions, constants, viewport]);

  /**
   * Start dragging clips
   * @param {string} clickedClipId - The clip that was clicked (will be included in drag)
   */
  const startDrag = useCallback((clickedClipId, canvasX, canvasY, screenX, screenY) => {
    const state = interactionStateRef.current;

    // Determine which clips to drag
    // If clicked clip is already selected, drag all selected clips
    // Otherwise, just drag the clicked clip
    let clipsToDrag;
    if (selectedClipIds.includes(clickedClipId)) {
      clipsToDrag = selectedClipIds;
    } else {
      // Clicked clip will be selected in next render, so include it
      clipsToDrag = [clickedClipId];
    }

    if (clipsToDrag.length === 0) return;

    // Store original positions
    const originalStates = new Map();
    clipsToDrag.forEach(clipId => {
      const clip = clips.find(c => c.id === clipId);
      if (clip) {
        originalStates.set(clipId, {
          trackId: clip.trackId,
          startTime: clip.startTime
        });
      }
    });

    // Update state
    state.mode = 'dragging';
    state.draggedClipIds = clipsToDrag;
    state.dragStartCanvasX = canvasX;
    state.dragStartCanvasY = canvasY;
    state.dragStartScreenX = screenX;
    state.dragStartScreenY = screenY;
    state.originalClipStates = originalStates;
    state.hasMoved = false;
  }, [selectedClipIds, clips]);

  /**
   * Update drag position
   */
  const updateDrag = useCallback((canvasX, canvasY, screenX, screenY) => {
    const state = interactionStateRef.current;
    if (state.mode !== 'dragging') return;

    // Check if drag threshold exceeded
    const dx = screenX - state.dragStartScreenX;
    const dy = screenY - state.dragStartScreenY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (!state.hasMoved && distance < DRAG_THRESHOLD) {
      return; // Don't start drag until threshold exceeded
    }

    state.hasMoved = true;

    // Calculate delta in canvas space
    const deltaCanvasX = canvasX - state.dragStartCanvasX;
    const deltaCanvasY = canvasY - state.dragStartCanvasY;

    // Convert delta to beats and tracks
    const zoomX = isFinite(viewport.zoomX) && viewport.zoomX > 0 ? viewport.zoomX : 1;
    const deltaBeats = deltaCanvasX / (constants.PIXELS_PER_BEAT * zoomX);
    const deltaTracks = Math.round(deltaCanvasY / dimensions.trackHeight);

    // Build ghost clips for visual feedback
    const ghosts = [];
    state.draggedClipIds.forEach(clipId => {
      const clip = clips.find(c => c.id === clipId);
      const originalState = state.originalClipStates.get(clipId);
      if (!clip || !originalState) return;

      // Calculate new position
      let newStartTime = originalState.startTime + deltaBeats;

      // Apply snap to grid
      newStartTime = snapToGrid(newStartTime, snapSize);

      // Clamp to non-negative
      newStartTime = Math.max(0, newStartTime);

      // Calculate new track
      const originalTrack = tracks.find(t => t.id === originalState.trackId);
      const originalTrackIndex = originalTrack ? tracks.indexOf(originalTrack) : 0;
      let newTrackIndex = originalTrackIndex + deltaTracks;
      newTrackIndex = Math.max(0, Math.min(tracks.length - 1, newTrackIndex));
      const newTrack = tracks[newTrackIndex];

      if (!newTrack) return;

      // Calculate visual position
      const x = newStartTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
      const y = newTrackIndex * dimensions.trackHeight;
      const width = clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
      const height = dimensions.trackHeight;

      ghosts.push({
        clipId,
        clip,
        newTrackId: newTrack.id,
        newStartTime,
        x,
        y,
        width,
        height
      });
    });

    setDragGhosts(ghosts);
  }, [clips, tracks, dimensions, constants, viewport, snapSize]);

  /**
   * Commit drag operation
   */
  const commitDrag = useCallback(() => {
    const state = interactionStateRef.current;
    if (state.mode !== 'dragging' || !state.hasMoved) {
      // If drag didn't exceed threshold, treat as click
      state.mode = 'idle';
      setDragGhosts(null);
      return;
    }

    // Apply changes from ghost clips
    if (dragGhosts) {
      dragGhosts.forEach(ghost => {
        updateClip(ghost.clipId, {
          trackId: ghost.newTrackId,
          startTime: ghost.newStartTime
        });
      });
    }

    // Reset state
    state.mode = 'idle';
    state.draggedClipIds = [];
    state.originalClipStates.clear();
    state.hasMoved = false;
    setDragGhosts(null);
  }, [dragGhosts, updateClip]);

  /**
   * Cancel drag operation
   */
  const cancelDrag = useCallback(() => {
    const state = interactionStateRef.current;
    state.mode = 'idle';
    state.draggedClipIds = [];
    state.originalClipStates.clear();
    state.hasMoved = false;
    setDragGhosts(null);
  }, []);

  /**
   * Start resizing clip(s)
   * If clicked clip is selected, resize all selected clips
   * Otherwise, resize only the clicked clip
   */
  const startResize = useCallback((clip, handle, canvasX, screenX) => {
    const state = interactionStateRef.current;

    // Determine which clips to resize
    let clipsToResize;
    if (selectedClipIds.includes(clip.id)) {
      // Resize all selected clips together
      clipsToResize = clips.filter(c => selectedClipIds.includes(c.id));
    } else {
      // Resize only clicked clip
      clipsToResize = [clip];
    }

    state.mode = 'resizing';
    state.resizingClipIds = clipsToResize.map(c => c.id);
    state.resizeHandle = handle;
    state.resizeStartCanvasX = canvasX;
    state.resizeStartScreenX = screenX;
    state.hasMoved = false;

    // Store original states for all clips being resized
    state.originalClipStates.clear();
    clipsToResize.forEach(c => {
      state.originalClipStates.set(c.id, {
        startTime: c.startTime,
        duration: c.duration
      });
    });

    console.log(`Started resizing ${handle} handle for ${clipsToResize.length} clip(s)`);
  }, [clips, selectedClipIds]);

  /**
   * Update resize position for all selected clips
   */
  const updateResize = useCallback((canvasX, screenX) => {
    const state = interactionStateRef.current;
    if (state.mode !== 'resizing') return;

    // Check if drag threshold exceeded
    const dx = screenX - state.resizeStartScreenX;
    if (!state.hasMoved && Math.abs(dx) < DRAG_THRESHOLD) {
      return;
    }

    state.hasMoved = true;

    // Calculate delta in beats
    const zoomX = isFinite(viewport.zoomX) && viewport.zoomX > 0 ? viewport.zoomX : 1;
    const deltaCanvasX = canvasX - state.resizeStartCanvasX;
    const deltaBeats = deltaCanvasX / (constants.PIXELS_PER_BEAT * zoomX);

    // Build ghosts for all clips being resized
    const ghosts = [];

    state.resizingClipIds.forEach(clipId => {
      const clip = clips.find(c => c.id === clipId);
      if (!clip) return;

      const track = tracks.find(t => t.id === clip.trackId);
      if (!track) return;

      const trackIndex = tracks.indexOf(track);
      const original = state.originalClipStates.get(clipId);
      if (!original) return;

      let newStartTime, newDuration;

      if (state.resizeHandle === 'left') {
        // Resizing from left: adjust startTime and duration
        newStartTime = original.startTime + deltaBeats;
        newDuration = original.duration - deltaBeats;

        // Apply snap to grid
        newStartTime = snapToGrid(newStartTime, snapSize);
        newDuration = original.startTime + original.duration - newStartTime;

        // Clamp: can't go before 0
        if (newStartTime < 0) {
          newStartTime = 0;
          newDuration = original.startTime + original.duration;
        }

        // Enforce minimum duration
        if (newDuration < MIN_CLIP_DURATION) {
          newDuration = MIN_CLIP_DURATION;
          newStartTime = original.startTime + original.duration - MIN_CLIP_DURATION;
        }
      } else {
        // Resizing from right: adjust duration only
        newStartTime = original.startTime;
        newDuration = original.duration + deltaBeats;

        // Apply snap to grid
        const endTime = snapToGrid(newStartTime + newDuration, snapSize);
        newDuration = endTime - newStartTime;

        // Enforce minimum duration
        if (newDuration < MIN_CLIP_DURATION) {
          newDuration = MIN_CLIP_DURATION;
        }
      }

      // Build ghost for this clip
      const worldX = newStartTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
      const worldY = trackIndex * dimensions.trackHeight;
      const width = newDuration * constants.PIXELS_PER_BEAT * viewport.zoomX;
      const height = dimensions.trackHeight;

      ghosts.push({
        clipId: clip.id,
        clip,
        newStartTime,
        newDuration,
        x: worldX,
        y: worldY,
        width,
        height
      });
    });

    setResizeGhosts(ghosts);
  }, [clips, tracks, dimensions, constants, viewport, snapSize]);

  /**
   * Commit resize operation for all resized clips
   */
  const commitResize = useCallback(() => {
    const state = interactionStateRef.current;
    if (state.mode !== 'resizing' || !state.hasMoved) {
      state.mode = 'idle';
      setResizeGhosts(null);
      return;
    }

    // Apply changes to all resized clips
    if (resizeGhosts && resizeGhosts.length > 0) {
      resizeGhosts.forEach(ghost => {
        updateClip(ghost.clipId, {
          startTime: ghost.newStartTime,
          duration: ghost.newDuration
        });
      });

      console.log(`Committed resize for ${resizeGhosts.length} clip(s)`);
    }

    // Reset state
    state.mode = 'idle';
    state.resizingClipIds = [];
    state.resizeHandle = null;
    state.originalClipStates.clear();
    state.hasMoved = false;
    setResizeGhosts(null);
  }, [resizeGhosts, updateClip]);

  /**
   * Cancel resize operation
   */
  const cancelResize = useCallback(() => {
    const state = interactionStateRef.current;
    state.mode = 'idle';
    state.resizingClipIds = [];
    state.resizeHandle = null;
    state.originalClipStates.clear();
    state.hasMoved = false;
    setResizeGhosts(null);
  }, []);

  /**
   * Start fading clip(s)
   * If clicked clip is selected, fade all selected audio clips
   * Otherwise, fade only the clicked clip
   */
  const startFade = useCallback((clip, handle, canvasX, screenX) => {
    const state = interactionStateRef.current;

    // Determine which clips to fade (only audio clips)
    let clipsToFade;
    if (selectedClipIds.includes(clip.id)) {
      // Fade all selected audio clips together
      clipsToFade = clips.filter(c => selectedClipIds.includes(c.id) && c.type === 'audio');
    } else {
      // Fade only clicked clip
      clipsToFade = [clip];
    }

    state.mode = 'fading';
    state.fadingClipIds = clipsToFade.map(c => c.id);
    state.fadeHandle = handle;
    state.fadeStartCanvasX = canvasX;
    state.fadeStartScreenX = screenX;
    state.hasMoved = false;

    // Store original fade states
    state.originalFadeStates.clear();
    clipsToFade.forEach(c => {
      state.originalFadeStates.set(c.id, {
        fadeIn: c.fadeIn || 0,
        fadeOut: c.fadeOut || 0
      });
    });

    console.log(`Started fading ${handle} for ${clipsToFade.length} clip(s)`);
  }, [clips, selectedClipIds]);

  /**
   * Update fade for all selected clips
   */
  const updateFade = useCallback((canvasX, screenX) => {
    const state = interactionStateRef.current;
    if (state.mode !== 'fading') return;

    // Check if drag threshold exceeded
    const dx = screenX - state.fadeStartScreenX;
    if (!state.hasMoved && Math.abs(dx) < DRAG_THRESHOLD) {
      return;
    }

    state.hasMoved = true;

    // Calculate delta in beats
    const zoomX = isFinite(viewport.zoomX) && viewport.zoomX > 0 ? viewport.zoomX : 1;
    const deltaCanvasX = canvasX - state.fadeStartCanvasX;
    const deltaBeats = deltaCanvasX / (constants.PIXELS_PER_BEAT * zoomX);

    // Build ghosts for all clips being faded
    const ghosts = [];

    state.fadingClipIds.forEach(clipId => {
      const clip = clips.find(c => c.id === clipId);
      if (!clip) return;

      const track = tracks.find(t => t.id === clip.trackId);
      if (!track) return;

      const trackIndex = tracks.indexOf(track);
      const original = state.originalFadeStates.get(clipId);
      if (!original) return;

      let newFadeIn = original.fadeIn;
      let newFadeOut = original.fadeOut;

      if (state.fadeHandle === 'fadeIn') {
        // Adjust fade in duration
        newFadeIn = original.fadeIn + deltaBeats;

        // Clamp: can't be negative, can't exceed clip duration
        newFadeIn = Math.max(0, Math.min(newFadeIn, clip.duration));
      } else {
        // Adjust fade out duration
        newFadeOut = original.fadeOut + deltaBeats;

        // Clamp: can't be negative, can't exceed clip duration
        newFadeOut = Math.max(0, Math.min(newFadeOut, clip.duration));
      }

      // Build ghost for this clip
      const worldX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
      const worldY = trackIndex * dimensions.trackHeight;
      const width = clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
      const height = dimensions.trackHeight;

      ghosts.push({
        clipId: clip.id,
        clip,
        newFadeIn,
        newFadeOut,
        x: worldX,
        y: worldY,
        width,
        height
      });
    });

    setFadeGhosts(ghosts);
  }, [clips, tracks, dimensions, constants, viewport]);

  /**
   * Commit fade operation for all faded clips
   */
  const commitFade = useCallback(() => {
    const state = interactionStateRef.current;
    if (state.mode !== 'fading' || !state.hasMoved) {
      state.mode = 'idle';
      setFadeGhosts(null);
      return;
    }

    // Apply changes to all faded clips
    if (fadeGhosts && fadeGhosts.length > 0) {
      fadeGhosts.forEach(ghost => {
        updateClip(ghost.clipId, {
          fadeIn: ghost.newFadeIn,
          fadeOut: ghost.newFadeOut
        });
      });

      console.log(`Committed fade for ${fadeGhosts.length} clip(s)`);
    }

    // Reset state
    state.mode = 'idle';
    state.fadingClipIds = [];
    state.fadeHandle = null;
    state.originalFadeStates.clear();
    state.hasMoved = false;
    setFadeGhosts(null);
  }, [fadeGhosts, updateClip]);

  /**
   * Cancel fade operation
   */
  const cancelFade = useCallback(() => {
    const state = interactionStateRef.current;
    state.mode = 'idle';
    state.fadingClipIds = [];
    state.fadeHandle = null;
    state.originalFadeStates.clear();
    state.hasMoved = false;
    setFadeGhosts(null);
  }, []);

  /**
   * Start adjusting gain for clip(s)
   */
  const startGain = useCallback((clip, canvasY, screenY) => {
    const state = interactionStateRef.current;

    // Determine which clips to adjust gain for
    let clipsToGain;
    if (selectedClipIds.includes(clip.id)) {
      clipsToGain = clips.filter(c => selectedClipIds.includes(c.id) && c.type === 'audio');
    } else {
      clipsToGain = [clip];
    }

    state.mode = 'gaining';
    state.gainingClipIds = clipsToGain.map(c => c.id);
    state.gainStartCanvasY = canvasY;
    state.gainStartScreenY = screenY;
    state.hasMoved = false;

    // Store original gain states
    state.originalGainStates.clear();
    clipsToGain.forEach(c => {
      state.originalGainStates.set(c.id, {
        gain: c.gain || 0
      });
    });

    console.log(`Started gain adjust for ${clipsToGain.length} clip(s)`);
  }, [clips, selectedClipIds]);

  /**
   * Update gain for all selected clips (vertical drag)
   */
  const updateGain = useCallback((canvasY, screenY) => {
    const state = interactionStateRef.current;
    if (state.mode !== 'gaining') return;

    // Check if drag threshold exceeded
    const dy = screenY - state.gainStartScreenY;
    if (!state.hasMoved && Math.abs(dy) < DRAG_THRESHOLD) {
      return;
    }

    state.hasMoved = true;

    // Calculate delta in dB (negative Y = increase gain)
    const deltaY = state.gainStartScreenY - screenY; // Inverted
    const deltaDB = (deltaY / 10) * 0.5; // 20px = 1dB

    // Build ghosts for all clips being gained
    const ghosts = [];

    state.gainingClipIds.forEach(clipId => {
      const clip = clips.find(c => c.id === clipId);
      if (!clip) return;

      const track = tracks.find(t => t.id === clip.trackId);
      if (!track) return;

      const trackIndex = tracks.indexOf(track);
      const original = state.originalGainStates.get(clipId);
      if (!original) return;

      let newGain = original.gain + deltaDB;

      // Clamp to min/max
      newGain = Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, newGain));

      // Build ghost
      const worldX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
      const worldY = trackIndex * dimensions.trackHeight;
      const width = clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
      const height = dimensions.trackHeight;

      ghosts.push({
        clipId: clip.id,
        clip,
        newGain,
        x: worldX,
        y: worldY,
        width,
        height
      });
    });

    setGainGhosts(ghosts);
  }, [clips, tracks, dimensions, constants, viewport]);

  /**
   * Commit gain operation
   */
  const commitGain = useCallback(() => {
    const state = interactionStateRef.current;
    if (state.mode !== 'gaining' || !state.hasMoved) {
      state.mode = 'idle';
      setGainGhosts(null);
      return;
    }

    // Apply changes
    if (gainGhosts && gainGhosts.length > 0) {
      gainGhosts.forEach(ghost => {
        updateClip(ghost.clipId, {
          gain: ghost.newGain
        });
      });

      console.log(`Committed gain for ${gainGhosts.length} clip(s)`);
    }

    // Reset state
    state.mode = 'idle';
    state.gainingClipIds = [];
    state.originalGainStates.clear();
    state.hasMoved = false;
    setGainGhosts(null);
  }, [gainGhosts, updateClip]);

  /**
   * Cancel gain operation
   */
  const cancelGain = useCallback(() => {
    const state = interactionStateRef.current;
    state.mode = 'idle';
    state.gainingClipIds = [];
    state.originalGainStates.clear();
    state.hasMoved = false;
    setGainGhosts(null);
  }, []);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Handle mouse down on canvas
   */
  const handleMouseDown = useCallback((e) => {
    // Only handle left mouse button
    if (e.button !== 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Skip if click is on toolbar, timeline or left sidebars
    const totalHeaderHeight = toolbarHeight + constants.TIMELINE_HEIGHT;
    if (screenX < leftOffset || screenY < totalHeaderHeight) {
      return;
    }

    // Convert to canvas coordinates (relative to content area, accounting for scroll)
    const canvasX = screenX - leftOffset + viewport.scrollX;
    const canvasY = screenY - totalHeaderHeight + viewport.scrollY;

    // PRIORITY 1: Check for resize handle (highest priority - small hit area)
    const resizeHandle = findResizeHandleAtPosition(canvasX, canvasY);
    if (resizeHandle) {
      // Start resize operation
      startResize(resizeHandle.clip, resizeHandle.handle, canvasX, screenX);
      return;
    }

    // PRIORITY 2: Check for fade handle (audio clips only, triangular corners)
    const fadeHandle = findFadeHandleAtPosition(canvasX, canvasY);
    if (fadeHandle) {
      // Start fade operation
      startFade(fadeHandle.clip, fadeHandle.handle, canvasX, screenX);
      return;
    }

    // PRIORITY 3: Check for gain handle (audio clips only, bottom-right circle)
    const gainHandle = findGainHandleAtPosition(canvasX, canvasY);
    if (gainHandle) {
      // Start gain operation
      startGain(gainHandle.clip, canvasY, screenY);
      return;
    }

    // PRIORITY 4: Check for clip body (larger hit area)
    const clickedClip = findClipAtPosition(canvasX, canvasY);
    if (clickedClip) {
      // Check for double-click (within 300ms and same clip)
      const now = Date.now();
      const timeSinceLastClick = now - lastClickRef.current.time;
      const isDoubleClick = timeSinceLastClick < 300 && lastClickRef.current.clipId === clickedClip.id;

      if (isDoubleClick && onClipDoubleClick) {
        // Double-click detected - trigger callback
        onClipDoubleClick(clickedClip);
        lastClickRef.current = { time: 0, clipId: null }; // Reset
        return;
      }

      // Update last click info
      lastClickRef.current = { time: now, clipId: clickedClip.id };

      // Clicked on a clip - handle selection then prepare for drag
      const isShiftHeld = e.shiftKey;
      const isCtrlHeld = e.ctrlKey || e.metaKey;

      if (isCtrlHeld) {
        // Ctrl+Click: Toggle selection
        toggleSelection(clickedClip.id);
        // Don't start drag on ctrl+click (used for multi-select)
        return;
      } else if (isShiftHeld) {
        // Shift+Click: Add to selection
        if (!selectedClipIds.includes(clickedClip.id)) {
          addToSelection(clickedClip.id);
        }
        // Don't start drag on shift+click (used for multi-select)
        return;
      } else {
        // Regular click: Select only this clip (unless already selected for drag)
        if (!selectedClipIds.includes(clickedClip.id)) {
          setSelection(clickedClip.id);
        }
      }

      // Start potential drag operation (will only activate if mouse moves beyond threshold)
      // Pass the clicked clip ID so we can determine drag set immediately
      startDrag(clickedClip.id, canvasX, canvasY, screenX, screenY);
    } else {
      // Clicked on empty area - start marquee selection
      interactionStateRef.current.mode = 'marquee';
      interactionStateRef.current.marqueeStartX = canvasX;
      interactionStateRef.current.marqueeStartY = canvasY;

      // Clear selection if no modifier key held
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        clearSelection();
      }

      setMarqueeBox({
        x: canvasX,
        y: canvasY,
        width: 0,
        height: 0
      });
    }
  }, [
    findClipAtPosition,
    selectedClipIds,
    toggleSelection,
    addToSelection,
    setSelection,
    clearSelection,
    startDrag,
    constants,
    viewport,
    toolbarHeight
  ]);

  /**
   * Handle mouse move on canvas
   */
  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Skip if over toolbar, timeline or left sidebars
    const totalHeaderHeight = toolbarHeight + constants.TIMELINE_HEIGHT;
    if (screenX < leftOffset || screenY < totalHeaderHeight) {
      setHoveredClipId(null);
      setHoveredHandle(null);
      return;
    }

    // Convert to canvas coordinates (relative to content area, accounting for scroll)
    const canvasX = screenX - leftOffset + viewport.scrollX;
    const canvasY = screenY - totalHeaderHeight + viewport.scrollY;

    const state = interactionStateRef.current;

    if (state.mode === 'gaining') {
      // Update gain position
      updateGain(canvasY, screenY);
    } else if (state.mode === 'fading') {
      // Update fade position
      updateFade(canvasX, screenX);
    } else if (state.mode === 'resizing') {
      // Update resize position
      updateResize(canvasX, screenX);
    } else if (state.mode === 'dragging') {
      // Update drag position
      updateDrag(canvasX, canvasY, screenX, screenY);
    } else if (state.mode === 'marquee') {
      // Update marquee
      const startX = state.marqueeStartX;
      const startY = state.marqueeStartY;

      const newBox = {
        x: Math.min(startX, canvasX),
        y: Math.min(startY, canvasY),
        width: Math.abs(canvasX - startX),
        height: Math.abs(canvasY - startY)
      };

      setMarqueeBox(newBox);

      // Select clips in marquee (if box is large enough)
      if (newBox.width > MARQUEE_MIN_SIZE || newBox.height > MARQUEE_MIN_SIZE) {
        const clipsInBox = getClipsInMarquee(newBox);

        if (e.shiftKey) {
          // Shift: Add to existing selection
          const combined = [...new Set([...selectedClipIds, ...clipsInBox])];
          setSelection(combined);
        } else {
          // Replace selection
          setSelection(clipsInBox);
        }
      }
    } else {
      // Update hover state - check handles in priority order
      const resizeHandle = findResizeHandleAtPosition(canvasX, canvasY);
      if (resizeHandle) {
        setHoveredHandle({
          clipId: resizeHandle.clip.id,
          handle: resizeHandle.handle
        });
        setHoveredClipId(null);
      } else {
        const fadeHandle = findFadeHandleAtPosition(canvasX, canvasY);
        if (fadeHandle) {
          setHoveredHandle({
            clipId: fadeHandle.clip.id,
            handle: fadeHandle.handle
          });
          setHoveredClipId(null);
        } else {
          const gainHandle = findGainHandleAtPosition(canvasX, canvasY);
          if (gainHandle) {
            setHoveredHandle({
              clipId: gainHandle.clip.id,
              handle: gainHandle.handle
            });
            setHoveredClipId(null);
          } else {
            setHoveredHandle(null);
            const hoveredClip = findClipAtPosition(canvasX, canvasY);
            setHoveredClipId(hoveredClip?.id || null);
          }
        }
      }
    }
  }, [
    findClipAtPosition,
    findResizeHandleAtPosition,
    findFadeHandleAtPosition,
    findGainHandleAtPosition,
    getClipsInMarquee,
    updateGain,
    updateFade,
    updateResize,
    updateDrag,
    selectedClipIds,
    setSelection,
    constants,
    viewport,
    toolbarHeight
  ]);

  /**
   * Handle mouse up on canvas
   */
  const handleMouseUp = useCallback((e) => {
    if (e.button !== 0) return;

    const state = interactionStateRef.current;

    if (state.mode === 'gaining') {
      // Commit gain
      commitGain();
    } else if (state.mode === 'fading') {
      // Commit fade
      commitFade();
    } else if (state.mode === 'resizing') {
      // Commit resize
      commitResize();
    } else if (state.mode === 'dragging') {
      // Commit or cancel drag
      commitDrag();
    } else if (state.mode === 'marquee') {
      // End marquee selection
      state.mode = 'idle';
      setMarqueeBox(null);
    }
  }, [commitGain, commitFade, commitResize, commitDrag]);

  /**
   * Handle mouse leave canvas
   */
  const handleMouseLeave = useCallback(() => {
    const state = interactionStateRef.current;

    if (state.mode === 'gaining') {
      // Cancel gain on mouse leave
      cancelGain();
    } else if (state.mode === 'fading') {
      // Cancel fade on mouse leave
      cancelFade();
    } else if (state.mode === 'resizing') {
      // Cancel resize on mouse leave
      cancelResize();
    } else if (state.mode === 'dragging') {
      // Cancel drag on mouse leave
      cancelDrag();
    } else if (state.mode === 'marquee') {
      // End marquee
      state.mode = 'idle';
      setMarqueeBox(null);
    }

    // Clear hover
    setHoveredClipId(null);
    setHoveredHandle(null);
  }, [cancelGain, cancelFade, cancelResize, cancelDrag]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    marqueeBox,
    hoveredClipId,
    hoveredHandle, // For cursor/visual feedback on handles ('left'|'right'|'fadeIn'|'fadeOut'|'gain')
    dragGhosts, // For rendering ghost clips during drag
    resizeGhosts, // For rendering ghost clips during multi-resize
    fadeGhosts, // For rendering fade visualization during manipulation
    gainGhosts, // For rendering gain visualization during manipulation

    // Event handlers
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,

    // Utilities
    findClipAtPosition,
    screenToCanvas,

    // Operations (for escape key handling)
    cancelDrag,
    cancelResize,
    cancelFade,
    cancelGain
  };
}
