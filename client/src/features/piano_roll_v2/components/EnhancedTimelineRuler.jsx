// components/EnhancedTimelineRuler.jsx
// Piano roll için gelişmiş timeline + pozisyon göstergesi - Dynamic Width Fix

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { usePlaybackStore } from '../../../store/usePlaybackStore';
import { useGlobalPlayhead } from '../../../hooks/useGlobalPlayhead';
import { useArrangementStore } from '../../../store/useArrangementStore';
import { createTimelineZoomHandler } from '../../../lib/utils/zoomHandler';

export const EnhancedTimelineRuler = ({ engine, instrument }) => {
  const rulerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  const { loopStartStep, loopEndStep, setLoopRange, audioLoopLength } = usePlaybackStore();
  const { currentStep, playbackState } = useGlobalPlayhead();

  // ULTRA OPTIMIZED: Fixed viewport width - no dynamic calculations during playback
  const timelineWidth = useMemo(() => {
    const viewportWidth = engine.size?.width || 1200;
    // Always use viewport width - no expansion during playback for performance
    return viewportWidth;
  }, [
    engine.size?.width
    // REMOVED scroll dependencies for playback performance
  ]);

  // PERFORMANCE CRITICAL: Reduce marker rendering during playback
  const markers = useMemo(() => {
    // SMARTER: Only skip markers if there would be too many during playback
    const result = [];
    const stepWidth = engine.dimensions?.stepWidth || engine.stepWidth || 40;
    const barWidth = stepWidth * 16; // 16 steps per bar

    if (barWidth <= 0) return [];

    // Calculate viewport range with minimal buffer
    const scrollX = engine.scroll?.x || 0;
    const viewportWidth = engine.size?.width || 1200;

    const startBar = Math.max(0, Math.floor(scrollX / barWidth));
    const endBar = Math.ceil((scrollX + viewportWidth) / barWidth);
    const totalBarsToRender = endBar - startBar + 1;

    // SMART: Skip markers only if too many would be rendered during playback
    if (playbackState === 'playing' && totalBarsToRender > 10) {
      return []; // Only hide if more than 10 bars would be rendered
    }

    const bufferBars = 3; // Reduced buffer for performance
    const maxBarsToRender = Math.min(totalBarsToRender, 20); // Max 20 markers

    for (let i = 0; i < maxBarsToRender; i++) {
      const barIndex = startBar + i;
      const x = barIndex * barWidth;
      const barNumber = barIndex + 1;

      // Only include visible markers
      if (x >= scrollX - bufferBars * barWidth &&
          x <= scrollX + viewportWidth + bufferBars * barWidth) {
        result.push({
          x,
          label: barNumber,
          isVisible: true
        });
      }
    }

    return result;
  }, [
    engine.dimensions?.stepWidth,
    engine.stepWidth,
    engine.scroll?.x,
    engine.size?.width,
    playbackState // Add playback state to disable during play
  ]);

  // PERFORMANCE CRITICAL: Disable beat markers during playback
  const beatMarkers = useMemo(() => {
    const result = [];
    const stepWidth = engine.dimensions?.stepWidth || engine.stepWidth || 40;
    const beatWidth = stepWidth * 4; // 4 steps per beat

    if (beatWidth < 30) return []; // Higher threshold to show fewer markers

    // Only render beats in viewport with minimal buffer
    const scrollX = engine.scroll?.x || 0;
    const viewportWidth = engine.size?.width || 1200;

    const startBeat = Math.max(0, Math.floor(scrollX / beatWidth));
    const endBeat = Math.ceil((scrollX + viewportWidth) / beatWidth);
    const totalBeatsToRender = endBeat - startBeat + 1;

    // SMART: Disable beat markers during playback only if too many would be rendered
    if (playbackState === 'playing' && totalBeatsToRender > 20) {
      return []; // Only hide if more than 20 beats would be rendered
    }

    const maxBeatsToRender = Math.min(totalBeatsToRender, 50); // Max 50 beat markers

    for (let i = 0; i < maxBeatsToRender; i++) {
      const beatIndex = startBeat + i;
      const x = beatIndex * beatWidth;
      const barNumber = Math.floor(beatIndex / 4) + 1;
      const beatNumber = (beatIndex % 4) + 1;

      // Skip if it's a bar line
      if (beatNumber === 1) continue;

      // Only include visible beats
      if (x >= scrollX && x <= scrollX + viewportWidth) {
        result.push({
          x,
          barNumber,
          beatNumber,
          isVisible: true
        });
      }
    }

    return result;
  }, [
    engine.dimensions?.stepWidth,
    engine.stepWidth,
    engine.scroll?.x,
    engine.size?.width,
    playbackState // Add playback state to disable during play
  ]);

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
    const adjustedX = mouseX + (engine.scroll?.x || 0);

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
  }, [engine.scroll?.x, pixelToMusicalTime, setLoopRange, isDragging, dragStart]);

  // Mouse handlers - fixed drag interaction
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // Only left mouse button

    e.preventDefault();
    e.stopPropagation();

    // Start drag immediately
    handleInteraction(e, true);

    const handleMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      handleInteraction(moveEvent, false);
    };

    const handleMouseUp = (upEvent) => {
      upEvent.preventDefault();
      setIsDragging(false);
      setDragStart(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    // Use document instead of window for better compatibility
    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp, { passive: false });
  }, [handleInteraction]);

  // Mouse leave handler for cleanup
  const handleMouseLeave = useCallback(() => {
    // Cleanup any drag state if needed
  }, []);

  // Get arrangement store for accessing notes
  const { patterns, activePatternId } = useArrangementStore();

  // Double click to set loop range from first note to last note
  const handleDoubleClick = useCallback(() => {
    if (!instrument?.id || !activePatternId) {
      // Fallback - reset to full loop
      setLoopRange(0, audioLoopLength);
      return;
    }

    const notes = patterns[activePatternId]?.data[instrument.id] || [];

    if (notes.length === 0) {
      // No notes - reset to full loop
      setLoopRange(0, audioLoopLength);
      return;
    }

    // Find the earliest start time and latest end time
    let earliestStart = Infinity;
    let latestEnd = -Infinity;

    notes.forEach(note => {
      const startTime = note.time || 0;
      const duration = note.duration || 1;
      const endTime = startTime + duration;

      earliestStart = Math.min(earliestStart, startTime);
      latestEnd = Math.max(latestEnd, endTime);
    });

    // Convert to steps and set loop range
    const startStep = Math.floor(earliestStart);
    const endStep = Math.ceil(latestEnd);


    setLoopRange(startStep, endStep);
  }, [setLoopRange, audioLoopLength, instrument?.id, activePatternId, patterns]);

  // Create timeline-specific zoom handler
  const handleZoom = createTimelineZoomHandler(
    rulerRef,
    (zoom) => engine.setZoom && engine.setZoom(zoom),
    (scrollX) => engine.setViewport && engine.setViewport({ x: scrollX }),
    0.1,
    5
  );

  // Zoom functionality with mouse wheel
  const handleWheel = useCallback((e) => {
    const currentZoom = engine.viewport?.zoom || 1;
    handleZoom(e, currentZoom);
  }, [engine, handleZoom]);

  // Pan functionality with middle mouse button
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);

  const handlePanStart = useCallback((e) => {
    if (e.button === 1) { // Middle mouse button
      e.preventDefault();
      setIsPanning(true);
      setPanStart({
        x: e.clientX,
        scrollX: engine.scroll?.x || 0
      });
    }
  }, [engine.scroll?.x]);

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


  return (
    <div className="enhanced-timeline-ruler">

      {/* Main ruler area - OPTIMIZED: Fixed viewport width with transform */}
      <div
        ref={rulerRef}
        className="timeline-ruler-content"
        style={{
          width: '100%', // Fixed to viewport width - NO MORE 20k+ px!
          minWidth: '100%',
          position: 'relative',
          overflow: 'hidden', // Hide content outside viewport
          cursor: isDragging ? 'ew-resize' : isPanning ? 'grabbing' : 'crosshair'
        }}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      >
        {/* Bar markers - OPTIMIZED: Positioned relative to scroll */}
        {markers.map(marker => (
          <div
            key={`bar-${marker.label}`}
            className="timeline-bar-marker"
            style={{
              left: marker.x - (engine.scroll?.x || 0), // Offset by scroll position
              position: 'absolute'
            }}
          >
            <div className="bar-line" />
            <span className="bar-label">{marker.label}</span>
          </div>
        ))}

        {/* Beat markers - OPTIMIZED: Positioned relative to scroll */}
        {beatMarkers.map((marker) => (
          <div
            key={`beat-${marker.barNumber}-${marker.beatNumber}`}
            className="timeline-beat-marker"
            style={{
              left: marker.x - (engine.scroll?.x || 0), // Offset by scroll position
              position: 'absolute'
            }}
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

        {/* Playhead indicator - DISABLED during playback to prevent double rendering with PlayheadOptimized */}
        {playbackState !== 'playing' && (
          <div
            className="timeline-playhead"
            style={{
              left: playheadPosition - (engine.scroll?.x || 0), // Offset by scroll position
              position: 'absolute'
            }}
          />
        )}

        {/* Loop range visualization - OPTIMIZED: Positioned relative to scroll */}
        {loopStartStep !== null && loopEndStep !== null && loopEndStep > loopStartStep && (
          <div
            className="timeline-loop-range"
            style={{
              left: loopStartStep * (engine.dimensions?.stepWidth || engine.stepWidth || 40) - (engine.scroll?.x || 0),
              width: (loopEndStep - loopStartStep) * (engine.dimensions?.stepWidth || engine.stepWidth || 40),
              background: 'rgba(74, 222, 128, 0.2)',
              border: '1px solid rgba(74, 222, 128, 0.5)',
              height: '100%',
              position: 'absolute',
              top: 0,
              pointerEvents: 'none'
            }}
          />
        )}

        {/* Hover cursor removed - BBT display moved to top toolbar */}
      </div>
    </div>
  );
};