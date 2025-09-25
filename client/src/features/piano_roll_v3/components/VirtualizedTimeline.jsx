/**
 * @file VirtualizedTimeline.jsx
 * @description Infinite scroll destekli virtualized timeline ruler
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

  // Timeline markers'ı LOD bazlı olarak optimize et
  const timelineMarkers = useMemo(() => {
    const { verticalLines } = virtualGrid;
    const lodLevel = performance.lodLevel;

    return verticalLines
      .filter(line => {
        // LOD bazlı filtreleme
        if (lodLevel === LOD_LEVELS.ULTRA_SIMPLIFIED) {
          return line.type === 'bar' && line.step % 256 === 0; // Her 16 bar'da bir
        }
        if (lodLevel === LOD_LEVELS.SIMPLIFIED) {
          return line.type === 'bar' && line.step % 64 === 0; // Her 4 bar'da bir
        }
        if (lodLevel === LOD_LEVELS.NORMAL) {
          return line.type === 'bar'; // Her bar
        }
        return line.type === 'bar' || line.type === 'beat'; // Bar + beat
      })
      .map(line => {
        const x = line.x - viewport.scrollX;
        const isVisible = x > -50 && x < viewport.width + 50;

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
    const step = coordUtils.pxToStep(viewport.scrollX + clickX);

    onSeek(step);
  }, [onSeek, coordUtils, viewport.scrollX]);

  // Playhead position
  const playheadPosition = useMemo(() => {
    // Bu gerçek playback store'dan gelecek
    const currentStep = 0; // usePlaybackStore(state => state.currentStep);
    return coordUtils.stepToPx(currentStep) - viewport.scrollX;
  }, [coordUtils, viewport.scrollX]);

  // Loop region
  const loopRegion = useMemo(() => {
    // Bu gerçek playback store'dan gelecek
    const loopStart = 0;   // usePlaybackStore(state => state.loopStart);
    const loopEnd = 256;   // usePlaybackStore(state => state.loopEnd);

    const startX = coordUtils.stepToPx(loopStart) - viewport.scrollX;
    const endX = coordUtils.stepToPx(loopEnd) - viewport.scrollX;

    return {
      startX,
      endX,
      width: endX - startX,
      isVisible: startX < viewport.width && endX > 0,
    };
  }, [coordUtils, viewport.scrollX, viewport.width]);

  return (
    <div
      className="piano-roll-v3__timeline"
      onClick={handleTimelineClick}
      style={{
        position: 'relative',
        height: '32px',
        overflow: 'hidden',
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
      {timelineMarkers.map(marker => (
        <TimelineMarker
          key={`timeline-${marker.step}`}
          x={marker.x}
          type={marker.type}
          label={marker.label}
          isVisible={marker.isVisible}
        />
      ))}

      {/* Playhead */}
      {playheadPosition > -2 && playheadPosition < viewport.width + 2 && (
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

      {/* Time display (detailed modes) */}
      {(performance.lodLevel === LOD_LEVELS.DETAILED ||
        performance.lodLevel === LOD_LEVELS.ULTRA_DETAILED) && (
        <div
          className="piano-roll-v3__time-display"
          style={{
            position: 'absolute',
            right: 8,
            top: 4,
            fontSize: '11px',
            color: 'rgba(255,255,255,0.8)',
            background: 'rgba(0,0,0,0.7)',
            padding: '2px 6px',
            borderRadius: '3px',
            pointerEvents: 'none',
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