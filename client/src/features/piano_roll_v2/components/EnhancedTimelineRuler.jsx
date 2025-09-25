// components/EnhancedTimelineRuler.jsx
// Piano roll için gelişmiş timeline + pozisyon göstergesi - Dinamik LOD ve Zoom Mantığı
import React, { useMemo, useCallback, useRef } from 'react';
import { usePlaybackStore } from '../../../store/usePlaybackStore';
import { useGlobalPlayhead } from '../../../hooks/useGlobalPlayhead';
import { usePianoRollStoreV2, LOD_LEVELS } from '../store/usePianoRollStoreV2';

export const EnhancedTimelineRuler = ({ engine }) => {
  const rulerRef = useRef(null);
  const { loopStartStep, loopEndStep, setLoopRange } = usePlaybackStore();
  const { currentStep, playbackState } = useGlobalPlayhead();
  const zoomX = usePianoRollStoreV2(state => state.zoomX);
  const lod = usePianoRollStoreV2(state => state.getLODLevel());
  
  // --- YENİ VE GELİŞMİŞ MARKER HESAPLAMA MANTIĞI ---
  const markers = useMemo(() => {
    if (!engine || !engine.scroll || !engine.size || engine.stepWidth <= 0) {
      return { bars: [], beats: [] };
    }

    const { stepWidth, gridWidth, scroll, size } = engine;
    const barWidth = stepWidth * 16;
    const beatWidth = stepWidth * 4;
    
    const visibleStartPx = scroll.x;
    const visibleEndPx = scroll.x + size.width;

    // LOD'a göre ne kadar sıklıkla bir etiket gösterileceğini hesapla
    // Örneğin, 100 pikselde birden fazla etiket olmasın.
    const minPxPerLabel = 80; 
    let barIncrement = Math.max(1, Math.ceil(minPxPerLabel / barWidth));

    // Üstel artış: Çok uzaklaştıkça artış hızlansın
    if (barIncrement > 1) {
        barIncrement = Math.pow(2, Math.floor(Math.log2(barIncrement)));
    }

    const startBar = Math.floor(visibleStartPx / barWidth);
    const endBar = Math.ceil(visibleEndPx / barWidth);

    const bars = [];
    for (let i = startBar; i <= endBar; i++) {
        if (i % barIncrement === 0) {
            bars.push({ x: i * barWidth, label: i + 1 });
        }
    }
    
    const beats = [];
    // Beat'leri sadece yakın ve normal zoom seviyelerinde göster
    if (lod === LOD_LEVELS.DETAILED || lod === LOD_LEVELS.NORMAL) {
        const startBeat = Math.floor(visibleStartPx / beatWidth);
        const endBeat = Math.ceil(visibleEndPx / beatWidth);

        for (let i = startBeat; i <= endBeat; i++) {
            if (i % 4 !== 0) { // Bar başlangıçlarını atla
                beats.push({ x: i * beatWidth });
            }
        }
    }

    return { bars, beats };
  }, [engine, lod]);

  const playheadPosition = useMemo(() => {
    return currentStep * engine.stepWidth;
  }, [currentStep, engine.stepWidth]);

  // Sürükleme ile loop aralığı belirleme (değişiklik yok)
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
      <div
        className="timeline-ruler-content"
        style={{
          width: engine.gridWidth,
          transform: `translateX(-${engine.scroll.x}px)` // Yatay kaydırmayı uygula
        }}
      >
        {/* Loop Bölgesi */}
        <div
          className="timeline-loop-region"
          style={{
            left: loopStartStep * engine.stepWidth,
            width: (loopEndStep - loopStartStep) * engine.stepWidth
          }}
        />

        {/* Bar Çizgileri ve Numaraları */}
        {markers.bars.map(marker => (
          <div
            key={`bar-${marker.label}`}
            className="timeline-bar-marker"
            style={{ transform: `translateX(${marker.x}px)` }}
          >
            <div className="bar-line" />
            <span className="bar-label">{marker.label}</span>
          </div>
        ))}
        
        {/* Beat Çizgileri */}
        {markers.beats.map(marker => (
           <div
            key={`beat-${marker.x}`}
            className="timeline-beat-marker"
            style={{ transform: `translateX(${marker.x}px)` }}
          >
            <div className="beat-line" />
          </div>
        ))}

        {/* Playhead */}
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
};