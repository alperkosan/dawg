/**
 * ⏱️ TIMELINE RULER
 *
 * Displays bar/beat numbers and allows timeline interaction
 * - Bar and beat markers
 * - Click to jump to position
 * - Shows current cursor position
 * - Zenith theme styling
 */

import React, { useRef, useEffect } from 'react';
import './TimelineRuler.css';

const PIXELS_PER_BEAT = 48;
const BEATS_PER_BAR = 4;

/**
 * TimelineRuler component
 */
export function TimelineRuler({
  viewport,
  cursorPosition,
  isPlaying = false,
  onSeek,
  height = 40,
  markers = [],
  loopRegions = [],
  onAddMarker,
  onRemoveMarker,
  onAddLoopRegion,
  onUpdateLoopRegion,
  onRemoveLoopRegion,
  snapEnabled = false,
  snapSize = 1
}) {
  const canvasRef = useRef(null);
  const [dragState, setDragState] = React.useState(null); // { type, regionId, startX, startTime, endTime }
  const [hoveredRegion, setHoveredRegion] = React.useState(null); // { regionId, handle: 'start'|'end'|'body' }

  // Draw timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Setup canvas
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    // Clear canvas
    ctx.fillStyle = 'rgba(15, 15, 20, 0.95)';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Calculate visible beat range
    const pixelsPerBeat = PIXELS_PER_BEAT * viewport.zoomX;
    const startBeat = Math.floor(viewport.scrollX / pixelsPerBeat);
    const endBeat = Math.ceil((viewport.scrollX + rect.width) / pixelsPerBeat) + 1;

    // Draw markers
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (let beat = startBeat; beat < endBeat; beat++) {
      const x = beat * pixelsPerBeat - viewport.scrollX;

      if (x < -50 || x > rect.width + 50) continue;

      const isBar = beat % BEATS_PER_BAR === 0;

      // Draw tick
      ctx.beginPath();
      ctx.moveTo(x, isBar ? 0 : height - 12);
      ctx.lineTo(x, height);
      ctx.strokeStyle = isBar ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = isBar ? 2 : 1;
      ctx.stroke();

      // Draw bar number
      if (isBar) {
        const barNumber = Math.floor(beat / BEATS_PER_BAR) + 1;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(barNumber.toString(), x + 4, 6);
      }
    }

    // Draw loop regions
    loopRegions.forEach(region => {
      // ✅ FIX: Calculate positions with zoom correctly
      const startX = region.startTime * pixelsPerBeat - viewport.scrollX;
      const endX = region.endTime * pixelsPerBeat - viewport.scrollX;
      const isHovered = hoveredRegion?.regionId === region.id;

      // ✅ FIX: Only draw if region is visible in viewport
      if (endX >= 0 && startX <= rect.width) {
        // ✅ FIX: Calculate visible width correctly (clip to viewport bounds)
        const visibleStartX = Math.max(0, startX);
        const visibleEndX = Math.min(rect.width, endX);
        const visibleWidth = visibleEndX - visibleStartX;
        
        // Background
        const bgOpacity = isHovered ? 0.25 : 0.15;
        ctx.fillStyle = region.color ? `${region.color}${Math.floor(bgOpacity * 255).toString(16).padStart(2, '0')}` : `rgba(34, 197, 94, ${bgOpacity})`;
        ctx.fillRect(visibleStartX, 0, visibleWidth, height);

        // Borders
        ctx.strokeStyle = region.color || '#22c55e';
        ctx.lineWidth = isHovered ? 3 : 2;

        // Start line
        if (startX >= 0 && startX <= rect.width) {
          ctx.beginPath();
          ctx.moveTo(startX, 0);
          ctx.lineTo(startX, height);
          ctx.stroke();

          // Resize handle - start
          if (isHovered && hoveredRegion?.handle === 'start') {
            ctx.fillStyle = region.color || '#22c55e';
            ctx.fillRect(startX - 3, height / 2 - 10, 6, 20);
          }
        }

        // End line
        if (endX >= 0 && endX <= rect.width) {
          ctx.beginPath();
          ctx.moveTo(endX, 0);
          ctx.lineTo(endX, height);
          ctx.stroke();

          // Resize handle - end
          if (isHovered && hoveredRegion?.handle === 'end') {
            ctx.fillStyle = region.color || '#22c55e';
            ctx.fillRect(endX - 3, height / 2 - 10, 6, 20);
          }
        }

        // Label
        const labelX = Math.max(4, startX + 4);
        if (labelX < rect.width - 50) {
          ctx.fillStyle = region.color || '#22c55e';
          ctx.font = isHovered ? 'bold 11px Inter, system-ui, sans-serif' : 'bold 10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(region.label, labelX, height / 2 - 5);
        }

        // Duration display when hovered
        if (isHovered) {
          const duration = region.endTime - region.startTime;
          const durationText = `${duration.toFixed(2)} beats`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = '9px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(durationText, (startX + endX) / 2, height - 6);
        }
      }
    });

    // Draw markers
    markers.forEach(marker => {
      const x = marker.time * pixelsPerBeat - viewport.scrollX;

      if (x >= 0 && x <= rect.width) {
        // Marker line
        ctx.strokeStyle = marker.color || '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Marker flag
        ctx.fillStyle = marker.color || '#8b5cf6';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 12, 5);
        ctx.lineTo(x + 12, 15);
        ctx.lineTo(x, 10);
        ctx.closePath();
        ctx.fill();

        // Marker label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = 'bold 9px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(marker.label, x + 14, 8);
      }
    });

    // ❌ REMOVED: Playhead is now rendered only in main canvas for unified timeline
    // Timeline ruler only shows bars/beats/markers/loops

    // Draw drag ghost preview
    if (dragState) {
      let ghostStartX, ghostEndX, ghostColor = '#22c55e';

      if (dragState.type === 'create' && dragState.previewStart !== undefined && dragState.previewEnd !== undefined) {
        // Creating new loop
        ghostStartX = dragState.previewStart * pixelsPerBeat - viewport.scrollX;
        ghostEndX = dragState.previewEnd * pixelsPerBeat - viewport.scrollX;
      } else if (dragState.type === 'resize-start' && dragState.newStartTime !== undefined) {
        // Resizing start
        const region = loopRegions.find(r => r.id === dragState.regionId);
        if (region) {
          ghostStartX = dragState.newStartTime * pixelsPerBeat - viewport.scrollX;
          ghostEndX = region.endTime * pixelsPerBeat - viewport.scrollX;
          ghostColor = region.color || '#22c55e';
        }
      } else if (dragState.type === 'resize-end' && dragState.newEndTime !== undefined) {
        // Resizing end
        const region = loopRegions.find(r => r.id === dragState.regionId);
        if (region) {
          ghostStartX = region.startTime * pixelsPerBeat - viewport.scrollX;
          ghostEndX = dragState.newEndTime * pixelsPerBeat - viewport.scrollX;
          ghostColor = region.color || '#22c55e';
        }
      } else if (dragState.type === 'move' && dragState.delta !== undefined) {
        // Moving loop
        const newStart = dragState.originalStart + dragState.delta;
        const newEnd = dragState.originalEnd + dragState.delta;
        ghostStartX = newStart * pixelsPerBeat - viewport.scrollX;
        ghostEndX = newEnd * pixelsPerBeat - viewport.scrollX;
        const region = loopRegions.find(r => r.id === dragState.regionId);
        if (region) ghostColor = region.color || '#22c55e';
      }

      if (ghostStartX !== undefined && ghostEndX !== undefined) {
        const ghostWidth = ghostEndX - ghostStartX;

        // Ghost background
        ctx.fillStyle = `${ghostColor}40`; // More opaque for visibility
        ctx.fillRect(Math.max(0, ghostStartX), 0, ghostWidth, height);

        // Ghost borders (dashed)
        ctx.strokeStyle = ghostColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.moveTo(ghostStartX, 0);
        ctx.lineTo(ghostStartX, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(ghostEndX, 0);
        ctx.lineTo(ghostEndX, height);
        ctx.stroke();

        ctx.setLineDash([]);

        // Ghost duration
        const duration = Math.abs(ghostEndX - ghostStartX) / pixelsPerBeat;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${duration.toFixed(2)} beats`, (ghostStartX + ghostEndX) / 2, height / 2);
      }
    }

    // Draw bottom border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(rect.width, height - 0.5);
    ctx.stroke();
  }, [viewport, cursorPosition, height, markers, loopRegions, hoveredRegion, dragState]);

  // Handle click to seek
  const handleClick = (e) => {
    if (!onSeek) return;

    // ✅ FIX: Don't seek during playback!
    if (isPlaying) {
      console.log('⚠️ Timeline click ignored during playback');
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pixelsPerBeat = PIXELS_PER_BEAT * viewport.zoomX;
    const beat = (viewport.scrollX + x) / pixelsPerBeat;

    onSeek(beat);
  };

  // Handle right-click to add marker or delete loop
  const handleContextMenu = (e) => {
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pixelsPerBeat = PIXELS_PER_BEAT * viewport.zoomX;
    const beat = (viewport.scrollX + x) / pixelsPerBeat;

    // Check if right-clicking on loop region (to delete)
    for (const region of loopRegions) {
      const startX = region.startTime * pixelsPerBeat - viewport.scrollX;
      const endX = region.endTime * pixelsPerBeat - viewport.scrollX;

      if (x >= startX && x <= endX) {
        if (onRemoveLoopRegion && confirm(`Delete loop region "${region.label}"?`)) {
          onRemoveLoopRegion(region.id);
        }
        return;
      }
    }

    if (!onAddMarker) return;

    // Check if clicking on existing marker (to delete)
    const pixelThreshold = 10;
    const clickedMarker = markers.find(m => {
      const markerX = m.time * pixelsPerBeat - viewport.scrollX;
      return Math.abs(markerX - x) < pixelThreshold;
    });

    if (clickedMarker && onRemoveMarker) {
      if (confirm(`Delete marker "${clickedMarker.label}"?`)) {
        onRemoveMarker(clickedMarker.id);
      }
    } else {
      onAddMarker(beat);
    }
  };

  // Mouse move - hover detection and drag preview
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pixelsPerBeat = PIXELS_PER_BEAT * viewport.zoomX;

    // Handle dragging
    if (dragState) {
      const currentBeat = (viewport.scrollX + x) / pixelsPerBeat;
      const snappedBeat = snapEnabled ? Math.round(currentBeat / snapSize) * snapSize : currentBeat;

      if (dragState.type === 'create') {
        // Update preview for loop creation
        const startTime = Math.min(dragState.startTime, snappedBeat);
        const endTime = Math.max(dragState.startTime, snappedBeat);
        setDragState({ ...dragState, endTime: snappedBeat, previewStart: startTime, previewEnd: endTime });
      } else if (dragState.type === 'resize-start') {
        // Resize start handle
        const region = loopRegions.find(r => r.id === dragState.regionId);
        if (region && snappedBeat < region.endTime) {
          setDragState({ ...dragState, newStartTime: snappedBeat });
        }
      } else if (dragState.type === 'resize-end') {
        // Resize end handle
        const region = loopRegions.find(r => r.id === dragState.regionId);
        if (region && snappedBeat > region.startTime) {
          setDragState({ ...dragState, newEndTime: snappedBeat });
        }
      } else if (dragState.type === 'move') {
        // Move entire region
        const delta = snappedBeat - dragState.startBeat;
        setDragState({ ...dragState, delta });
      }
      return;
    }

    // Hover detection for loop regions
    let foundHover = null;
    for (const region of loopRegions) {
      const startX = region.startTime * pixelsPerBeat - viewport.scrollX;
      const endX = region.endTime * pixelsPerBeat - viewport.scrollX;

      // Check start handle
      if (Math.abs(x - startX) < 8) {
        foundHover = { regionId: region.id, handle: 'start' };
        break;
      }
      // Check end handle
      if (Math.abs(x - endX) < 8) {
        foundHover = { regionId: region.id, handle: 'end' };
        break;
      }
      // Check body
      if (x >= startX && x <= endX) {
        foundHover = { regionId: region.id, handle: 'body' };
      }
    }

    setHoveredRegion(foundHover);
  };

  // Mouse down - start drag operation
  const handleMouseDown = (e) => {
    // Only handle left mouse button
    if (e.button !== 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pixelsPerBeat = PIXELS_PER_BEAT * viewport.zoomX;
    const beat = (viewport.scrollX + x) / pixelsPerBeat;
    const snappedBeat = snapEnabled ? Math.round(beat / snapSize) * snapSize : beat;

    // Check if clicking on loop region handle or body
    if (hoveredRegion && onUpdateLoopRegion) {
      const region = loopRegions.find(r => r.id === hoveredRegion.regionId);
      if (region) {
        if (hoveredRegion.handle === 'start') {
          setDragState({ type: 'resize-start', regionId: region.id, startX: x, originalStart: region.startTime });
        } else if (hoveredRegion.handle === 'end') {
          setDragState({ type: 'resize-end', regionId: region.id, startX: x, originalEnd: region.endTime });
        } else if (hoveredRegion.handle === 'body') {
          setDragState({ type: 'move', regionId: region.id, startBeat: snappedBeat, originalStart: region.startTime, originalEnd: region.endTime });
        }
        e.stopPropagation();
        return;
      }
    }

    // Alt+Click to start creating loop region
    if (e.altKey && onAddLoopRegion) {
      setDragState({ type: 'create', startTime: snappedBeat, startX: x });
      e.stopPropagation();
    }
  };

  // Mouse up - finalize drag operation
  const handleMouseUp = (e) => {
    if (!dragState) return;

    if (dragState.type === 'create' && dragState.previewEnd) {
      // Create new loop region
      const startTime = Math.min(dragState.startTime, dragState.previewEnd);
      const endTime = Math.max(dragState.startTime, dragState.previewEnd);
      if (endTime - startTime >= 0.25) { // Minimum duration
        onAddLoopRegion(startTime, endTime);
      }
    } else if (dragState.type === 'resize-start' && dragState.newStartTime !== undefined) {
      // Update start time
      onUpdateLoopRegion(dragState.regionId, { startTime: dragState.newStartTime });
    } else if (dragState.type === 'resize-end' && dragState.newEndTime !== undefined) {
      // Update end time
      onUpdateLoopRegion(dragState.regionId, { endTime: dragState.newEndTime });
    } else if (dragState.type === 'move' && dragState.delta !== undefined) {
      // Move region
      const newStart = dragState.originalStart + dragState.delta;
      const newEnd = dragState.originalEnd + dragState.delta;
      if (newStart >= 0) { // Don't allow moving before 0
        onUpdateLoopRegion(dragState.regionId, { startTime: newStart, endTime: newEnd });
      }
    }

    setDragState(null);
  };

  // Cursor style based on hover state
  const getCursor = () => {
    if (dragState) return 'grabbing';
    if (hoveredRegion) {
      if (hoveredRegion.handle === 'start' || hoveredRegion.handle === 'end') return 'ew-resize';
      if (hoveredRegion.handle === 'body') return 'grab';
    }
    return onSeek ? 'pointer' : 'default';
  };

  return (
    <div className="arr-v2-timeline-ruler" style={{ height: `${height}px` }}>
      <canvas
        ref={canvasRef}
        className="arr-v2-timeline-canvas"
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setHoveredRegion(null);
          if (dragState) setDragState(null);
        }}
        style={{ cursor: getCursor() }}
      />
    </div>
  );
}

export default TimelineRuler;
