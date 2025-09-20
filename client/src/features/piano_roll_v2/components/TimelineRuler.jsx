// src/features/piano_roll_v2/components/TimelineRuler.jsx
import React, { useMemo, useState, useCallback, useRef } from 'react';
import { usePlaybackStore } from '../../../store/usePlaybackStore';

export const TimelineRuler = ({ engine }) => {
  const rulerRef = useRef(null);
  const startStepRef = useRef(0); // Sürüklemenin başlangıç noktasını saklamak için ref

  const { loopStartStep, loopEndStep, setLoopRange, audioLoopLength } = usePlaybackStore();

  const markers = useMemo(() => {
    const result = [];
    const barWidth = engine.stepWidth * 16;
    if (barWidth <= 0) return [];
    const totalBars = Math.ceil(engine.gridWidth / barWidth);
    for (let i = 0; i < totalBars; i++) {
      result.push({ x: i * barWidth, label: i + 1 });
    }
    return result;
  }, [engine.gridWidth, engine.stepWidth]);

  const handleInteraction = useCallback((e, isMouseDown = false) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const currentStep = Math.round(engine.xToTime(mouseX));

    if (isMouseDown) {
      startStepRef.current = currentStep;
      // Tek tıklamada minimum 1 adımlık bir döngü başlat
      setLoopRange(currentStep, currentStep + 1);
    } else {
      const newStart = Math.min(startStepRef.current, currentStep);
      const newEnd = Math.max(startStepRef.current, currentStep);
      if (newEnd > newStart) {
        setLoopRange(newStart, newEnd);
      }
    }
  }, [engine, setLoopRange]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    handleInteraction(e, true);

    const handleMouseMove = (moveEvent) => handleInteraction(moveEvent, false);
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [handleInteraction]);

  // === YENİ: Çift Tıklama ile Döngüyü Sıfırlama ===
  const handleDoubleClick = useCallback(() => {
    setLoopRange(0, audioLoopLength);
  }, [setLoopRange, audioLoopLength]);

  return (
    <div
      ref={rulerRef}
      className="prv2-ruler__content"
      style={{ width: engine.gridWidth, cursor: 'text' }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick} // Olay yöneticisini ekliyoruz
    >
      {markers.map(marker => (
        <div key={marker.label} className="prv2-ruler__marker" style={{ left: marker.x }}>
          <span className="prv2-ruler__label">{marker.label}</span>
        </div>
      ))}

      <div
        className="prv2-ruler__loop-region"
        style={{
          left: engine.timeToX(loopStartStep),
          width: engine.timeToX(loopEndStep - loopStartStep),
          cursor: 'ew-resize' // Döngü alanı üzerindeyken imleci değiştir
        }}
      />
    </div>
  );
};