/**
 * @file VirtualizedTimeline.jsx - FIXED VERSION
 * @description Timeline with proper scroll viewport handling
 */
import React, { memo, useMemo, useCallback } from 'react';
import { LOD_LEVELS } from '../store/usePianoRollV3Store';

const TimelineMarker = memo(({ x, type, label, isVisible, onClick }) => {
  if (!isVisible) return null;

  return (
    <div
      className={`piano-roll-v3__timeline-marker piano-roll-v3__timeline-marker--${type}`}
      style={{
        position: 'absolute',
        left: x,
        top: 0,
        height: '100%',
        pointerEvents: onClick ? 'auto' : 'none',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <div className="piano-roll-v3__timeline-line" />
      {label && (
        <div className="piano-roll-v3__timeline-label">
          {label}
        </div>
      )}
    </div>
  );
});

const VirtualizedTimeline = memo(({ engine, onSeek }) => {
  const { virtualGrid, performance, viewport, grid, coordUtils } = engine;

  // Timeline markers with FIXED positioning (no scroll offset subtraction!)
  const timelineMarkers = useMemo(() => {
    const { verticalLines } = virtualGrid;
    const lodLevel = performance.lodLevel;

    return verticalLines
      .filter(line => {
        // LOD-based filtering
        if (lodLevel === LOD_LEVELS.ULTRA_SIMPLIFIED) {
          return line.type === 'bar' && line.step % 256 === 0;
        }
        if (lodLevel === LOD_LEVELS.SIMPLIFIED) {
          return line.type === 'bar' && line.step % 64 === 0;
        }
        if (lodLevel === LOD_LEVELS.NORMAL) {
          return line.type === 'bar';
        }
        return line.type === 'bar' || line.type === 'beat';
      })
      .map(line => {
        // IMPORTANT: Don't subtract viewport.scrollX here!
        // The timeline content is already being transformed by useScrollSync
        const x = line.x;
        const isVisible = x >= viewport.scrollX - 50 && x <= viewport.scrollX + viewport.width + 50;

        let label = '';
        if (line.type === 'bar') {
          if (lodLevel === LOD_LEVELS.ULTRA_DETAILED || lodLevel === LOD_LEVELS.DETAILED) {
            label = `${line.bar}`;
          } else if (lodLevel !== LOD_LEVELS.ULTRA_SIMPLIFIED) {
            label = line.step % 256 === 0 ? `${line.bar}` : '';
          }
        }

        return {
          ...line,
          x,
          isVisible,
          label,
        };
      });
  }, [virtualGrid, performance.lodLevel, viewport.scrollX, viewport.width]);

  // Click handler for seeking
  const handleTimelineClick = useCallback((e) => {
    if (!onSeek) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    // Add viewport.scrollX to get absolute position
    const step = coordUtils.pxToStep(viewport.scrollX + clickX);

    onSeek(step);
  }, [onSeek, coordUtils, viewport.scrollX]);

  // Playhead position (absolute, not relative)
  const playheadPosition = useMemo(() => {
    const currentStep = 0; // This will come from playback store
    return coordUtils.stepToPx(currentStep);
  }, [coordUtils]);

  // Loop region (absolute positions)
  const loopRegion = useMemo(() => {
    const loopStart = 0;
    const loopEnd = 256;

    const startX = coordUtils.stepToPx(loopStart);
    const endX = coordUtils.stepToPx(loopEnd);

    return {
      startX,
      endX,
      width: endX - startX,
      isVisible: endX >= viewport.scrollX && startX <= viewport.scrollX + viewport.width,
    };
  }, [coordUtils, viewport.scrollX, viewport.width]);

  return (
    <div
      className="piano-roll-v3__timeline"
      onClick={handleTimelineClick}
      style={{
        position: 'relative',
        height: '32px',
        overflow: 'visible', // Allow content to be visible
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Background */}
      <div className="piano-roll-v3__timeline-bg" />

      {/* Loop region */}
      {loopRegion.isVisible && (
        <div
          className="piano-roll-v3__loop-region"
          style={{
            position: 'absolute',
            left: loopRegion.startX,
            top: 0,
            width: loopRegion.width,
            height: '100%',
            backgroundColor: 'rgba(0, 150, 255, 0.2)',
            border: '1px solid rgba(0, 150, 255, 0.5)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Timeline markers */}
      {timelineMarkers.filter(m => m.isVisible).map(marker => (
        <TimelineMarker
          key={`timeline-${marker.step}`}
          x={marker.x}
          type={marker.type}
          label={marker.label}
          isVisible={true}
        />
      ))}

      {/* Playhead */}
      {playheadPosition >= viewport.scrollX && playheadPosition <= viewport.scrollX + viewport.width && (
        <div
          className="piano-roll-v3__playhead"
          style={{
            position: 'absolute',
            left: playheadPosition,
            top: 0,
            width: '2px',
            height: '100%',
            backgroundColor: '#ff4444',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        />
      )}

      {/* Time display */}
      {(performance.lodLevel === LOD_LEVELS.DETAILED ||
        performance.lodLevel === LOD_LEVELS.ULTRA_DETAILED) && (
        <div
          className="piano-roll-v3__time-display"
          style={{
            position: 'fixed',
            right: 8,
            top: 4,
            fontSize: '11px',
            color: 'rgba(255,255,255,0.8)',
            background: 'rgba(0,0,0,0.7)',
            padding: '2px 6px',
            borderRadius: '3px',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {Math.floor(viewport.scrollX / (64 * grid.stepWidth)) + 1}:
          {Math.floor((viewport.scrollX % (64 * grid.stepWidth)) / (16 * grid.stepWidth)) + 1}
        </div>
      )}
    </div>
  );
});

VirtualizedTimeline.displayName = 'VirtualizedTimeline';

export default VirtualizedTimeline;