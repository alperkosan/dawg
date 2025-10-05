/**
 * PATTERN INTERACTION HOOK
 *
 * GarageBand-style pattern interactions:
 * - Snap ghost preview
 * - Drag to move with grid snap
 * - Right edge drag to loop/extend
 * - Split tool
 * - Duplicate
 */

import { useState, useCallback, useRef } from 'react';

const EDGE_RESIZE_THRESHOLD = 8; // pixels
const TRACK_HEADER_WIDTH = 150;
const TIMELINE_HEIGHT = 40;
const PIXELS_PER_BEAT = 32;

export function usePatternInteraction(engine, clips, tracks, gridSize, snapMode, editMode) {
  const [interactionState, setInteractionState] = useState({
    mode: null, // 'move', 'resize-left', 'resize-right', 'split', 'fade-in', 'fade-out', 'gain'
    clip: null,
    startX: 0,
    startY: 0,
    originalStartTime: 0,
    originalDuration: 0,
    currentStartTime: 0,
    currentDuration: 0,
    targetTrackId: null,
    targetTrackIndex: null,
    ghostPosition: null,
    splitPosition: null,
    isStretchMode: false, // Alt key pressed - time stretch instead of duration change
    originalFadeIn: 0, // For fade-in handle drag
    originalFadeOut: 0, // For fade-out handle drag
    originalGain: 0 // For gain handle drag
  });

  const mouseDownRef = useRef(null);

  const HANDLE_SIZE = 8; // Handle radius in pixels

  // Grid size to beat conversion
  const gridSizeMap = {
    '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125
  };

  // Snap value to grid
  const snapToGrid = useCallback((beatValue) => {
    if (snapMode !== 'grid') return beatValue;

    const gridInterval = gridSizeMap[gridSize] || 1;
    return Math.round(beatValue / gridInterval) * gridInterval;
  }, [snapMode, gridSize]);

  // Convert pixel to beat position
  const pixelToBeat = useCallback((px) => {
    return px / (PIXELS_PER_BEAT * engine.viewport.zoomX);
  }, [engine.viewport.zoomX]);

  // Convert beat to pixel position
  const beatToPixel = useCallback((beat) => {
    return beat * PIXELS_PER_BEAT * engine.viewport.zoomX;
  }, [engine.viewport.zoomX]);

  // Get clip bounds in pixels
  const getClipBounds = useCallback((clip) => {
    const track = tracks.find(t => t.id === clip.trackId);
    if (!track) return null;

    const trackIndex = tracks.indexOf(track);
    const clipY = trackIndex * engine.dimensions.trackHeight;
    const clipX = beatToPixel(clip.startTime);
    const clipWidth = beatToPixel(clip.duration);
    const clipHeight = engine.dimensions.trackHeight;

    return { x: clipX, y: clipY, width: clipWidth, height: clipHeight };
  }, [tracks, engine.dimensions.trackHeight, beatToPixel]);

  // Detect interaction type (move, resize-left, resize-right, fade handles, gain handle)
  const detectInteractionType = useCallback((clip, mouseX, mouseY) => {
    const bounds = getClipBounds(clip);
    if (!bounds) return null;

    const relativeX = mouseX - TRACK_HEADER_WIDTH;
    const relativeY = mouseY - TIMELINE_HEIGHT;

    // Check if inside clip vertically
    if (relativeY < bounds.y || relativeY > bounds.y + bounds.height) {
      return null;
    }

    // For audio clips, check for handle interactions first
    if (clip.type === 'audio') {
      // Calculate fade positions
      const fadeIn = clip.fadeIn || 0;
      const fadeOut = clip.fadeOut || 0;
      const fadeInWidth = fadeIn * PIXELS_PER_BEAT * engine.viewport.zoomX;
      const fadeOutWidth = fadeOut * PIXELS_PER_BEAT * engine.viewport.zoomX;

      // Fade-in handle - at fade endpoint (or start if no fade)
      const fadeInHandleX = fadeIn > 0 ? bounds.x + 2 + fadeInWidth : bounds.x + 8;
      const fadeInHandleY = bounds.y + 8;
      const distToFadeIn = Math.sqrt(
        Math.pow(relativeX - fadeInHandleX, 2) +
        Math.pow(relativeY - fadeInHandleY, 2)
      );
      if (distToFadeIn < HANDLE_SIZE) {
        return 'fade-in';
      }

      // Fade-out handle - at fade start point (or end if no fade)
      const fadeOutHandleX = fadeOut > 0 ? bounds.x + bounds.width - 2 - fadeOutWidth : bounds.x + bounds.width - 8;
      const fadeOutHandleY = bounds.y + 8;
      const distToFadeOut = Math.sqrt(
        Math.pow(relativeX - fadeOutHandleX, 2) +
        Math.pow(relativeY - fadeOutHandleY, 2)
      );
      if (distToFadeOut < HANDLE_SIZE) {
        return 'fade-out';
      }

      // Gain handle (bottom-center)
      const gainHandleX = bounds.x + bounds.width / 2;
      const gainHandleY = bounds.y + bounds.height - 8;
      const distToGain = Math.sqrt(
        Math.pow(relativeX - gainHandleX, 2) +
        Math.pow(relativeY - gainHandleY, 2)
      );
      if (distToGain < HANDLE_SIZE) {
        return 'gain';
      }
    }

    // Check horizontal position for resize/move
    const distFromLeft = Math.abs(relativeX - bounds.x);
    const distFromRight = Math.abs(relativeX - (bounds.x + bounds.width));

    if (distFromRight < EDGE_RESIZE_THRESHOLD) {
      return 'resize-right'; // Loop/extend from right
    } else if (distFromLeft < EDGE_RESIZE_THRESHOLD) {
      return 'resize-left'; // Trim from left
    } else if (relativeX >= bounds.x && relativeX <= bounds.x + bounds.width) {
      return 'move';
    }

    return null;
  }, [getClipBounds]);

  // Find clip at position
  const findClipAtPosition = useCallback((mouseX, mouseY) => {
    const relativeX = mouseX - TRACK_HEADER_WIDTH;
    const relativeY = mouseY - TIMELINE_HEIGHT;

    return clips.find(clip => {
      const bounds = getClipBounds(clip);
      if (!bounds) return false;

      return relativeX >= bounds.x &&
             relativeX <= bounds.x + bounds.width &&
             relativeY >= bounds.y &&
             relativeY <= bounds.y + bounds.height;
    });
  }, [clips, getClipBounds]);

  // Mouse down - start interaction
  const handleMouseDown = useCallback((e, canvasRect) => {
    const mouseX = e.clientX - canvasRect.left + engine.viewport.scrollX;
    const mouseY = e.clientY - canvasRect.top + engine.viewport.scrollY;

    // Split mode - just mark position
    if (editMode === 'split') {
      const clip = findClipAtPosition(mouseX, mouseY);
      if (clip) {
        const relativeX = mouseX - TRACK_HEADER_WIDTH;
        const splitBeat = pixelToBeat(relativeX);
        const snappedSplit = snapToGrid(splitBeat);

        setInteractionState({
          mode: 'split',
          clip,
          splitPosition: snappedSplit,
          ghostPosition: { beat: snappedSplit }
        });
      }
      return null;
    }

    // Select/Draw mode - pattern interaction
    const clip = findClipAtPosition(mouseX, mouseY);
    if (!clip) return null;

    const interactionType = detectInteractionType(clip, mouseX, mouseY);
    if (!interactionType) return null;

    mouseDownRef.current = { x: mouseX, y: mouseY };

    // Check if Alt key is pressed for time-stretch mode (audio clips only)
    const isStretchMode = e.altKey && clip.type === 'audio' &&
                          (interactionType === 'resize-right' || interactionType === 'resize-left');

    setInteractionState({
      mode: interactionType,
      clip,
      startX: mouseX,
      startY: mouseY,
      originalStartTime: clip.startTime,
      originalDuration: clip.duration,
      currentStartTime: clip.startTime,
      currentDuration: clip.duration,
      ghostPosition: null,
      isStretchMode,
      // Store original fade/gain values for handle interactions (all clip-specific)
      originalFadeIn: clip.fadeIn || 0,
      originalFadeOut: clip.fadeOut || 0,
      originalGain: clip.gain || 0
    });

    return { clip, type: interactionType };
  }, [editMode, engine.viewport, findClipAtPosition, detectInteractionType, pixelToBeat, snapToGrid]);

  // Mouse move - update interaction
  const handleMouseMove = useCallback((e, canvasRect) => {
    if (!interactionState.mode || !interactionState.clip) return null;

    const mouseX = e.clientX - canvasRect.left + engine.viewport.scrollX;
    const mouseY = e.clientY - canvasRect.top + engine.viewport.scrollY;

    const deltaX = mouseX - interactionState.startX;
    const deltaY = mouseY - interactionState.startY;
    const deltaBeat = pixelToBeat(deltaX);

    let updates = {};

    if (interactionState.mode === 'move') {
      // Move clip - both X (time) and Y (track)
      const newStartTime = Math.max(0, interactionState.originalStartTime + deltaBeat);
      const snappedStartTime = snapToGrid(newStartTime);

      // Calculate target track from Y position
      const relativeY = mouseY - TIMELINE_HEIGHT;
      const targetTrackIndex = Math.max(0, Math.floor(relativeY / engine.dimensions.trackHeight));

      // Get target track (create if needed)
      const targetTrack = tracks[targetTrackIndex];

      updates = {
        currentStartTime: snappedStartTime,
        targetTrackIndex,
        targetTrackId: targetTrack?.id,
        ghostPosition: { beat: snappedStartTime, type: 'move', trackIndex: targetTrackIndex }
      };
    } else if (interactionState.mode === 'resize-right') {
      // Loop/extend pattern OR time-stretch audio (Alt key)
      const gridSizeMap = {
        '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125
      };
      const minDuration = gridSizeMap[gridSize] || 1; // Min 1 grid step
      const newDuration = Math.max(minDuration, interactionState.originalDuration + deltaBeat);
      const snappedDuration = snapToGrid(newDuration);

      updates = {
        currentDuration: snappedDuration,
        ghostPosition: {
          beat: interactionState.originalStartTime + snappedDuration,
          type: 'resize-right'
        }
      };

      // If stretch mode, calculate playback rate
      if (interactionState.isStretchMode && interactionState.clip.type === 'audio') {
        const originalDur = interactionState.clip.originalDuration || interactionState.originalDuration;
        updates.playbackRate = originalDur / snappedDuration; // Faster if shorter, slower if longer
      }
    } else if (interactionState.mode === 'resize-left') {
      // Trim from left OR time-stretch from left (Alt key)
      const gridSizeMap = {
        '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125
      };
      const minDuration = gridSizeMap[gridSize] || 1; // Min 1 grid step
      const newStartTime = Math.max(0, interactionState.originalStartTime + deltaBeat);
      const newDuration = Math.max(minDuration, interactionState.originalDuration - deltaBeat);
      const snappedStartTime = snapToGrid(newStartTime);
      const actualDelta = snappedStartTime - interactionState.originalStartTime;

      updates = {
        currentStartTime: snappedStartTime,
        currentDuration: interactionState.originalDuration - actualDelta,
        ghostPosition: { beat: snappedStartTime, type: 'resize-left' }
      };

      // For audio clips, update sample offset when trimming from left
      if (interactionState.clip.type === 'audio') {
        if (interactionState.isStretchMode) {
          // Time stretch mode: adjust playback rate, keep offset
          const originalDur = interactionState.clip.originalDuration || interactionState.originalDuration;
          updates.playbackRate = originalDur / updates.currentDuration;
        } else {
          // Normal trim mode: adjust sample offset
          const currentOffset = interactionState.clip.sampleOffset || 0;
          updates.sampleOffset = currentOffset + actualDelta;
        }
      }
    } else if (interactionState.mode === 'fade-in') {
      // Fade-in handle drag (horizontal only)
      const newFadeIn = Math.max(0, Math.min(interactionState.originalFadeIn + deltaBeat, interactionState.clip.duration));
      const snappedFadeIn = snapToGrid(newFadeIn);

      updates = {
        fadeIn: snappedFadeIn,
        ghostPosition: { beat: interactionState.clip.startTime + snappedFadeIn, type: 'fade-in' }
      };
    } else if (interactionState.mode === 'fade-out') {
      // Fade-out handle drag (horizontal only, reversed)
      const newFadeOut = Math.max(0, Math.min(interactionState.originalFadeOut - deltaBeat, interactionState.clip.duration));
      const snappedFadeOut = snapToGrid(newFadeOut);

      updates = {
        fadeOut: snappedFadeOut,
        ghostPosition: { beat: interactionState.clip.startTime + interactionState.clip.duration - snappedFadeOut, type: 'fade-out' }
      };
    } else if (interactionState.mode === 'gain') {
      // Gain handle drag (vertical only)
      const deltaY = mouseY - interactionState.startY;
      // -1 pixel = +0.1 dB, +1 pixel = -0.1 dB
      const gainChange = -(deltaY / 10); // 10 pixels = 1 dB
      const newGain = Math.max(-48, Math.min(12, interactionState.originalGain + gainChange));

      updates = {
        gain: parseFloat(newGain.toFixed(1)) // Round to 1 decimal
      };
    }

    setInteractionState(prev => ({ ...prev, ...updates }));
    return updates;
  }, [interactionState, engine.viewport, pixelToBeat, snapToGrid]);

  // Mouse up - commit interaction
  const handleMouseUp = useCallback(() => {
    const result = {
      type: interactionState.mode,
      clip: interactionState.clip,
      updates: null
    };

    if (interactionState.mode === 'move' && interactionState.clip) {
      result.updates = {
        startTime: interactionState.currentStartTime
      };

      // ✅ Update track if changed
      if (interactionState.targetTrackId && interactionState.targetTrackId !== interactionState.clip.trackId) {
        result.updates.trackId = interactionState.targetTrackId;
      }
    } else if (interactionState.mode === 'resize-right' && interactionState.clip) {
      result.updates = {
        duration: interactionState.currentDuration
      };

      // Save playback rate if in stretch mode
      if (interactionState.isStretchMode && interactionState.playbackRate) {
        result.updates.playbackRate = interactionState.playbackRate;
        // Save original duration on first stretch
        if (!interactionState.clip.originalDuration) {
          result.updates.originalDuration = interactionState.originalDuration;
        }
      }
    } else if (interactionState.mode === 'resize-left' && interactionState.clip) {
      result.updates = {
        startTime: interactionState.currentStartTime,
        duration: interactionState.currentDuration
      };

      // Save playback rate if in stretch mode, or sample offset if trim mode
      if (interactionState.clip.type === 'audio') {
        if (interactionState.isStretchMode && interactionState.playbackRate) {
          result.updates.playbackRate = interactionState.playbackRate;
          // Save original duration on first stretch
          if (!interactionState.clip.originalDuration) {
            result.updates.originalDuration = interactionState.originalDuration;
          }
        } else if (interactionState.sampleOffset !== undefined) {
          // Normal trim: save sample offset
          result.updates.sampleOffset = interactionState.sampleOffset;
        }
      }
    } else if (interactionState.mode === 'fade-in' && interactionState.clip) {
      result.updates = {
        fadeIn: interactionState.fadeIn !== undefined ? interactionState.fadeIn : interactionState.originalFadeIn
      };
    } else if (interactionState.mode === 'fade-out' && interactionState.clip) {
      result.updates = {
        fadeOut: interactionState.fadeOut !== undefined ? interactionState.fadeOut : interactionState.originalFadeOut
      };
    } else if (interactionState.mode === 'gain' && interactionState.clip) {
      result.updates = {
        gain: interactionState.gain !== undefined ? interactionState.gain : interactionState.originalGain
      };
    } else if (interactionState.mode === 'split' && interactionState.clip) {
      result.splitAt = interactionState.splitPosition;
    }

    // Reset state
    setInteractionState({
      mode: null,
      clip: null,
      startX: 0,
      startY: 0,
      originalStartTime: 0,
      originalDuration: 0,
      currentStartTime: 0,
      currentDuration: 0,
      ghostPosition: null,
      splitPosition: null
    });

    mouseDownRef.current = null;

    return result;
  }, [interactionState]);

  // Get cursor style based on hover position
  const getCursorStyle = useCallback((mouseX, mouseY) => {
    if (editMode === 'split') return 'crosshair';

    const clip = findClipAtPosition(mouseX, mouseY);
    if (!clip) return 'default';

    const type = detectInteractionType(clip, mouseX, mouseY);

    if (type === 'resize-right') return 'ew-resize';
    if (type === 'resize-left') return 'ew-resize';
    if (type === 'fade-in') return 'ew-resize'; // Horizontal drag for fade
    if (type === 'fade-out') return 'ew-resize'; // Horizontal drag for fade
    if (type === 'gain') return 'ns-resize'; // Vertical drag for gain
    if (type === 'move') return 'grab';

    return 'default';
  }, [editMode, findClipAtPosition, detectInteractionType]);

  return {
    interactionState,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    getCursorStyle,
    snapToGrid,
    beatToPixel,
    pixelToBeat,
    getClipAtPosition: findClipAtPosition
  };
}
