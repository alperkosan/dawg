// components/EnhancedTimelineRuler.jsx
// Piano roll için gelişmiş timeline + pozisyon göstergesi

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { usePlaybackStore } from '../../../store/usePlaybackStore';
import { usePlayheadTracking } from '../../../hooks/useEngineState';

export const EnhancedTimelineRuler = ({ engine }) => {
  const rulerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(null);

  const { loopStartStep, loopEndStep, setLoopRange, audioLoopLength } = usePlaybackStore();
  const { currentStep, playbackState } = usePlayheadTracking();

  // Bar markers with viewport-based rendering for infinite scroll
  const markers = useMemo(() => {
    const result = [];
    const stepWidth = engine.dimensions?.stepWidth || engine.stepWidth || 40;
    const gridWidth = engine.dimensions?.gridWidth || engine.gridWidth || 1600;
    const barWidth = stepWidth * 16; // 16 steps per bar

    if (barWidth <= 0) return [];

    // Calculate viewport range with some buffer
    const scrollX = engine.viewport?.x || 0;
    const viewportWidth = window.innerWidth;
    const bufferBars = 10; // Extra bars on each side

    const startBar = Math.max(0, Math.floor((scrollX - bufferBars * barWidth) / barWidth));
    const endBar = Math.ceil((scrollX + viewportWidth + bufferBars * barWidth) / barWidth);
    const totalBarsToRender = Math.min(endBar - startBar, Math.ceil(gridWidth / barWidth) + 20);

    for (let i = 0; i < totalBarsToRender; i++) {
      const barIndex = startBar + i;
      const x = barIndex * barWidth;
      const barNumber = barIndex + 1;

      // Only include visible markers
      if (x >= scrollX - bufferBars * barWidth && x <= scrollX + viewportWidth + bufferBars * barWidth) {
        result.push({
          x,
          label: barNumber,
          isVisible: true
        });
      }
    }

    return result;
  }, [engine.dimensions?.stepWidth, engine.stepWidth, engine.dimensions?.gridWidth, engine.gridWidth, engine.viewport?.x]);

  // Beat subdivision markers (viewport-based)
  const beatMarkers = useMemo(() => {
    const result = [];
    const stepWidth = engine.dimensions?.stepWidth || engine.stepWidth || 40;
    const beatWidth = stepWidth * 4; // 4 steps per beat

    if (beatWidth < 20) return []; // Don't show if too small

    // Only render beats in viewport
    const scrollX = engine.viewport?.x || 0;
    const viewportWidth = window.innerWidth;
    const bufferBeats = 20;

    const startBeat = Math.max(0, Math.floor((scrollX - bufferBeats * beatWidth) / beatWidth));
    const endBeat = Math.ceil((scrollX + viewportWidth + bufferBeats * beatWidth) / beatWidth);

    for (let i = startBeat; i < endBeat; i++) {
      const x = i * beatWidth;
      const barNumber = Math.floor(i / 4) + 1;
      const beatNumber = (i % 4) + 1;

      // Skip if it's a bar line
      if (beatNumber === 1) continue;

      // Only include visible beats
      if (x >= scrollX - bufferBeats * beatWidth && x <= scrollX + viewportWidth + bufferBeats * beatWidth) {
        result.push({
          x,
          barNumber,
          beatNumber,
          isVisible: true
        });
      }
    }

    return result;
  }, [engine.dimensions?.stepWidth, engine.stepWidth, engine.viewport?.x]);

  // Convert pixel position to musical time
  const pixelToMusicalTime = useCallback((pixelX) => {
    const stepWidth = engine.dimensions?.stepWidth || engine.stepWidth || 40;
    const step = pixelX / stepWidth;
    const bar = Math.floor(step / 16) + 1;
    const beat = Math.floor((step % 16) / 4) + 1;
    const tick = Math.floor((step % 4) + 1);

    return { step, bar, beat, tick, formatted: `${bar}:${beat}:${tick}` };
  }, [engine.dimensions?.stepWidth, engine.stepWidth]);

  // Handle timeline interaction
  const handleInteraction = useCallback((e, isMouseDown = false) => {
    if (!rulerRef.current) return;

    const rect = rulerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const adjustedX = mouseX + engine.viewport?.x || 0;

    const musicalTime = pixelToMusicalTime(adjustedX);
    const currentStep = Math.round(musicalTime.step);

    if (isMouseDown) {
      setIsDragging(true);
      setDragStart(currentStep);
      setLoopRange(currentStep, currentStep + 1);
    } else if (isDragging && dragStart !== null) {
      const newStart = Math.min(dragStart, currentStep);
      const newEnd = Math.max(dragStart, currentStep);
      if (newEnd > newStart) {
        setLoopRange(newStart, newEnd);
      }
    }
  }, [engine.viewport?.x || 0, pixelToMusicalTime, setLoopRange, isDragging, dragStart]);

  // Mouse handlers
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    handleInteraction(e, true);

    const handleMouseMove = (moveEvent) => {
      handleInteraction(moveEvent, false);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragStart(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [handleInteraction]);

  // Hover position tracking
  const handleMouseMove = useCallback((e) => {
    if (!rulerRef.current || isDragging) return;

    const rect = rulerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const adjustedX = mouseX + engine.viewport?.x || 0;

    const musicalTime = pixelToMusicalTime(adjustedX);
    setHoverPosition(musicalTime);
  }, [engine.viewport?.x || 0, pixelToMusicalTime, isDragging]);

  const handleMouseLeave = useCallback(() => {
    setHoverPosition(null);
  }, []);

  // Double click to reset loop
  const handleDoubleClick = useCallback(() => {
    setLoopRange(0, audioLoopLength);
  }, [setLoopRange, audioLoopLength]);

  // Zoom functionality with mouse wheel
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();

      // Get mouse position relative to ruler
      const rect = rulerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const currentScrollX = engine.viewport?.x || 0;
      const worldMouseX = mouseX + currentScrollX;

      // Calculate zoom change
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const currentZoom = engine.viewport?.zoom || 1;
      const newZoom = Math.max(0.1, Math.min(5, currentZoom * zoomFactor));

      // Update engine zoom if method exists
      if (engine.setZoom) {
        engine.setZoom(newZoom);
      }

      // Calculate new scroll position to keep mouse position stable
      const newScrollX = worldMouseX - mouseX * (newZoom / currentZoom);
      if (engine.setViewport) {
        engine.setViewport({ x: newScrollX });
      }
    }
  }, [engine]);

  // Pan functionality with middle mouse button
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);

  const handlePanStart = useCallback((e) => {
    if (e.button === 1) { // Middle mouse button
      e.preventDefault();
      setIsPanning(true);
      setPanStart({
        x: e.clientX,
        scrollX: engine.viewport?.x || 0
      });
    }
  }, [engine.viewport?.x]);

  const handlePanMove = useCallback((e) => {
    if (isPanning && panStart) {
      e.preventDefault();
      const deltaX = e.clientX - panStart.x;
      const newScrollX = panStart.scrollX - deltaX;

      if (engine.setViewport) {
        engine.setViewport({ x: Math.max(0, newScrollX) });
      }
    }
  }, [isPanning, panStart, engine]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
  }, []);

  // Playhead position
  const playheadPosition = useMemo(() => {
    const stepWidth = engine.dimensions?.stepWidth || engine.stepWidth || 40;
    return currentStep * stepWidth;
  }, [currentStep, engine.dimensions?.stepWidth, engine.stepWidth]);

  // Dynamic timeline width for infinite scrolling
  const timelineWidth = useMemo(() => {
    const scrollX = engine.viewport?.x || 0;
    const viewportWidth = window.innerWidth;
    const stepWidth = engine.dimensions?.stepWidth || engine.stepWidth || 40;
    const barWidth = stepWidth * 16;

    // Calculate how many bars we need to show
    const visibleBars = Math.ceil(viewportWidth / barWidth);
    const scrolledBars = Math.ceil(scrollX / barWidth);
    const totalBarsNeeded = scrolledBars + visibleBars + 50; // Extra buffer

    return totalBarsNeeded * barWidth;
  }, [engine.viewport?.x, engine.dimensions?.stepWidth, engine.stepWidth]);

  return (
    <div className="enhanced-timeline-ruler">
      {/* Position display */}
      <div className="timeline-position-display">
        {hoverPosition ? (
          <span className="position-hover">
            📍 {hoverPosition.formatted} (Bar {hoverPosition.bar})
          </span>
        ) : playbackState === 'playing' ? (
          <span className="position-current">
            ▶️ {pixelToMusicalTime(playheadPosition).formatted}
          </span>
        ) : (
          <span className="position-default">
            🎼 Piano Roll Timeline
          </span>
        )}
      </div>

      {/* Main ruler area */}
      <div
        ref={rulerRef}
        className="timeline-ruler-content"
        style={{
          width: timelineWidth,
          cursor: isDragging ? 'ew-resize' : isPanning ? 'grabbing' : 'crosshair'
        }}
        onMouseDown={(e) => {
          handlePanStart(e);
          handleMouseDown(e);
        }}
        onMouseMove={(e) => {
          handlePanMove(e);
          handleMouseMove(e);
        }}
        onMouseUp={handlePanEnd}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      >
        {/* Bar markers */}
        {markers.map(marker => (
          <div
            key={`bar-${marker.label}`}
            className="timeline-bar-marker"
            style={{ left: marker.x }}
          >
            <div className="bar-line" />
            <span className="bar-label">{marker.label}</span>
          </div>
        ))}

        {/* Beat markers */}
        {beatMarkers.map((marker, index) => (
          <div
            key={`beat-${marker.barNumber}-${marker.beatNumber}`}
            className="timeline-beat-marker"
            style={{ left: marker.x }}
          >
            <div className="beat-line" />
            <span className="beat-label">{marker.beatNumber}</span>
          </div>
        ))}

        {/* Loop region */}
        <div
          className="timeline-loop-region"
          style={{
            left: loopStartStep * (engine.dimensions?.stepWidth || engine.stepWidth || 40),
            width: (loopEndStep - loopStartStep) * (engine.dimensions?.stepWidth || engine.stepWidth || 40)
          }}
        >
          <div className="loop-start-handle" />
          <div className="loop-end-handle" />
        </div>

        {/* Playhead indicator */}
        {playbackState === 'playing' && (
          <div
            className="timeline-playhead"
            style={{ left: playheadPosition }}
          />
        )}

        {/* Hover cursor */}
        {hoverPosition && !isDragging && (
          <div
            className="timeline-hover-cursor"
            style={{ left: hoverPosition.step * (engine.dimensions?.stepWidth || engine.stepWidth || 40) }}
          />
        )}
      </div>
    </div>
  );
};