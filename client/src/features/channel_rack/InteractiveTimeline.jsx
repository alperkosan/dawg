import React, { useState, useRef, useCallback } from 'react';

const InteractiveTimeline = ({
  loopLength,
  currentPosition = 0,
  onJumpToPosition,
}) => {
  const [hoverInfo, setHoverInfo] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const timelineRef = useRef(null);

  const STEP_WIDTH = 16;
  const totalBars = Math.ceil(loopLength / 16);

  // === DÜZELTME 1: Tıklama ve sürükleme mantığını birleştiren tek bir fonksiyon ===
  const handleInteraction = useCallback((e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const step = Math.max(0, Math.min(loopLength - 1, Math.floor(x / STEP_WIDTH)));
    
    // Hem anlık tıklama hem de sürükleme sırasında pozisyonu güncelle
    onJumpToPosition?.(step);

    // Hover bilgisini de güncelle
    const bar = Math.floor(step / 16) + 1;
    const beat = Math.floor((step % 16) / 4) + 1;
    const tick = (step % 4) + 1;
    setHoverInfo({ x, step, bar, beat, tick, position: `${bar}:${beat}:${tick}` });
  }, [loopLength, onJumpToPosition]);

  const handleMouseLeave = () => {
    setHoverInfo(null);
    setIsDragging(false); // Sürükleme dışarıda biterse durumu sıfırla
  };

  // === DÜZELTME 2: Fare olay yöneticileri artık daha basit ve güvenilir ===
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    
    // Tıklama anında pozisyonu anında güncelle
    handleInteraction(e);

    const handleMouseMove = (moveEvent) => {
      // Sadece sürükleme aktifken pozisyonu güncelle
      handleInteraction(moveEvent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };
  
  // Hover efektini yöneten ayrı bir fonksiyon
   const handleMouseMoveForHover = useCallback((e) => {
    if (isDragging) return; // Sürükleme yapılıyorsa bu fonksiyon çalışmasın
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const step = Math.floor(x / STEP_WIDTH);
    const bar = Math.floor(step / 16) + 1;
    const beat = Math.floor((step % 16) / 4) + 1;
    const tick = (step % 4) + 1;

    if (step >= 0 && step < loopLength) {
      setHoverInfo({ x, step, bar, beat, tick, position: `${bar}:${beat}:${tick}` });
    } else {
      setHoverInfo(null);
    }
  }, [loopLength, isDragging]);


  const renderMarkers = () => {
    const markers = [];
    for (let i = 0; i < totalBars; i++) {
      const barX = i * (STEP_WIDTH * 16);
      markers.push(
        <div key={`bar-${i}`} className="timeline__marker timeline__marker--bar" style={{ left: `${barX}px` }}>
          <span className="timeline__marker-label">{i + 1}</span>
        </div>
      );
      for (let j = 1; j < 4; j++) {
        const beatX = barX + (j * STEP_WIDTH * 4);
        markers.push(<div key={`beat-${i}-${j}`} className="timeline__marker timeline__marker--beat" style={{ left: `${beatX}px` }} />);
      }
    }
    return markers;
  };

  // Safety check for invalid currentPosition
  const safeCurrentPosition = isNaN(currentPosition) || currentPosition === undefined ? 0 : currentPosition;

  return (
    <div className="timeline">
      <div
        ref={timelineRef}
        className="timeline__track"
        onMouseMove={handleMouseMoveForHover}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
      >
        {renderMarkers()}
        {hoverInfo && (
          <div className="timeline__hover-indicator" style={{ left: `${hoverInfo.x}px` }} />
        )}
      </div>
    </div>
  );
};

export default InteractiveTimeline;