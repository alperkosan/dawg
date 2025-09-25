import React, { useMemo, useCallback, useRef } from 'react';
import { usePlaybackStore } from '../../../store/usePlaybackStore';
import { useGlobalPlayhead } from '../../../hooks/useGlobalPlayhead';
import { usePianoRollStoreV2, LOD_LEVELS } from '../store/usePianoRollStoreV2';

// --- YENİ: Artık contentRef'i prop olarak alıyor ---
export const EnhancedTimelineRuler = React.memo(({ engine, contentRef }) => {
  const rulerRef = useRef(null);
  const { loopStartStep, loopEndStep, setLoopRange } = usePlaybackStore();
  const { currentStep, playbackState } = useGlobalPlayhead();
  const lod = usePianoRollStoreV2(state => state.getLODLevel());

  const markers = useMemo(() => {
    if (!engine || !engine.size || engine.stepWidth <= 0) {
      return { bars: [], beats: [] };
    }
    const { stepWidth, scroll, size } = engine;
    const barWidth = stepWidth * 16;
    const beatWidth = stepWidth * 4;
    const visibleStartPx = scroll.x;
    const visibleEndPx = scroll.x + size.width;

    const minPxPerLabel = 80; 
    let barIncrement = Math.max(1, Math.ceil(minPxPerLabel / barWidth));
    if (barIncrement > 1) {
        barIncrement = Math.pow(2, Math.floor(Math.log2(barIncrement)));
    }

    const startBar = Math.floor(visibleStartPx / barWidth);
    const endBar = Math.ceil(visibleEndPx / barWidth);
    const bars = [];
    for (let i = startBar; i <= endBar; i++) {
        if (i >= 0 && i % barIncrement === 0) {
            bars.push({ x: i * barWidth, label: i + 1 });
        }
    }
    
    const beats = [];
    if ((lod === LOD_LEVELS.DETAILED || lod === LOD_LEVELS.NORMAL) && beatWidth > 15) {
        const startBeat = Math.floor(visibleStartPx / beatWidth);
        const endBeat = Math.ceil(visibleEndPx / beatWidth);
        for (let i = startBeat; i <= endBeat; i++) {
            if (i >= 0 && i % 4 !== 0) {
                beats.push({ x: i * beatWidth });
            }
        }
    }
    return { bars, beats };
  }, [engine.scroll.x, engine.size.width, engine.stepWidth, lod]);

  const playheadPosition = useMemo(() => currentStep * engine.stepWidth, [currentStep, engine.stepWidth]);

  const handleRulerInteraction = useCallback((e) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left + engine.scroll.x;
    const newStep = Math.round(newX / engine.stepWidth);
    
    const handleMouseMove = (moveEvent) => {
      const moveX = moveEvent.clientX - rect.left + engine.scroll.x;
      const endStep = Math.round(moveX / engine.stepWidth);
      setLoopRange(Math.min(newStep, endStep), Math.max(newStep, endStep));
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [engine.stepWidth, engine.scroll.x, setLoopRange]);

  return (
    <div
      ref={rulerRef}
      className="enhanced-timeline-ruler"
      onMouseDown={handleRulerInteraction}
    >
      {/* --- YENİ: Kaydırılabilir içerik artık bu ref'i kullanıyor --- */}
      <div
        ref={contentRef}
        className="timeline-ruler-content"
        style={{ width: engine.gridWidth }}
      >
        <div
          className="timeline-loop-region"
          style={{
            left: loopStartStep * engine.stepWidth,
            width: (loopEndStep - loopStartStep) * engine.stepWidth
          }}
        />

        {markers.bars.map(marker => (
          <div key={`bar-${marker.label}`} className="timeline-bar-marker" style={{ transform: `translateX(${marker.x}px)` }}>
            <div className="bar-line" />
            <span className="bar-label">{marker.label}</span>
          </div>
        ))}
        
        {markers.beats.map(marker => (
           <div key={`beat-${marker.x}`} className="timeline-beat-marker" style={{ transform: `translateX(${marker.x}px)` }}>
            <div className="beat-line" />
          </div>
        ))}

        {playbackState === 'playing' && (
             <div
                className="timeline-playhead"
                style={{
                    height: '100%',
                    transform: `translateX(${playheadPosition}px)`
                }}
             />
        )}
      </div>
    </div>
  );
});
