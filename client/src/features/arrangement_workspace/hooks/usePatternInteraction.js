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
    mode: null, // 'move', 'resize-left', 'resize-right', 'split'
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

  const mouseDownRef = useRef(null);

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

  // Detect interaction type (move, resize-left, resize-right)
  const detectInteractionType = useCallback((clip, mouseX, mouseY) => {
    const bounds = getClipBounds(clip);
    if (!bounds) return null;

    const relativeX = mouseX - TRACK_HEADER_WIDTH;
    const relativeY = mouseY - TIMELINE_HEIGHT;

    // Check if inside clip vertically
    if (relativeY < bounds.y || relativeY > bounds.y + bounds.height) {
      return null;
    }

    // Check horizontal position
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

    setInteractionState({
      mode: interactionType,
      clip,
      startX: mouseX,
      startY: mouseY,
      originalStartTime: clip.startTime,
      originalDuration: clip.duration,
      currentStartTime: clip.startTime,
      currentDuration: clip.duration,
      ghostPosition: null
    });

    return { clip, type: interactionType };
  }, [editMode, engine.viewport, findClipAtPosition, detectInteractionType, pixelToBeat, snapToGrid]);

  // Mouse move - update interaction
  const handleMouseMove = useCallback((e, canvasRect) => {
    if (!interactionState.mode || !interactionState.clip) return null;

    const mouseX = e.clientX - canvasRect.left + engine.viewport.scrollX;
    const mouseY = e.clientY - canvasRect.top + engine.viewport.scrollY;

    const deltaX = mouseX - interactionState.startX;
    const deltaBeat = pixelToBeat(deltaX);

    let updates = {};

    if (interactionState.mode === 'move') {
      // Move clip
      const newStartTime = Math.max(0, interactionState.originalStartTime + deltaBeat);
      const snappedStartTime = snapToGrid(newStartTime);

      updates = {
        currentStartTime: snappedStartTime,
        ghostPosition: { beat: snappedStartTime, type: 'move' }
      };
    } else if (interactionState.mode === 'resize-right') {
      // Loop/extend pattern
      const newDuration = Math.max(0.25, interactionState.originalDuration + deltaBeat);
      const snappedDuration = snapToGrid(newDuration);

      updates = {
        currentDuration: snappedDuration,
        ghostPosition: {
          beat: interactionState.originalStartTime + snappedDuration,
          type: 'resize-right'
        }
      };
    } else if (interactionState.mode === 'resize-left') {
      // Trim from left
      const newStartTime = Math.max(0, interactionState.originalStartTime + deltaBeat);
      const newDuration = Math.max(0.25, interactionState.originalDuration - deltaBeat);
      const snappedStartTime = snapToGrid(newStartTime);

      updates = {
        currentStartTime: snappedStartTime,
        currentDuration: interactionState.originalDuration - (snappedStartTime - interactionState.originalStartTime),
        ghostPosition: { beat: snappedStartTime, type: 'resize-left' }
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
    } else if (interactionState.mode === 'resize-right' && interactionState.clip) {
      result.updates = {
        duration: interactionState.currentDuration
      };
    } else if (interactionState.mode === 'resize-left' && interactionState.clip) {
      result.updates = {
        startTime: interactionState.currentStartTime,
        duration: interactionState.currentDuration
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
    pixelToBeat
  };
}
