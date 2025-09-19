import React, { useState, useRef, useCallback } from 'react';
import { Clock } from 'lucide-react';
// CSS import'u artık gerekli değil, stiller main.css üzerinden geliyor.

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

  const handleMouseMove = useCallback((e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const step = Math.floor(x / STEP_WIDTH);
    const bar = Math.floor(step / 16) + 1;
    const beat = Math.floor((step % 16) / 4) + 1;
    const tick = (step % 4) + 1;

    if (step >= 0 && step < loopLength) {
      setHoverInfo({ x, step, bar, beat, tick, position: `${bar}:${beat}:${tick}` });
      if (isDragging) {
        onJumpToPosition?.(step);
      }
    } else {
      setHoverInfo(null);
    }
  }, [loopLength, isDragging, onJumpToPosition]);

  const handleMouseLeave = () => {
    setHoverInfo(null);
    setIsDragging(false);
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    // MouseMove'u tetikleyerek anında atlama sağla
    handleMouseMove(e);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

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

  const currentBar = Math.floor(currentPosition / 16) + 1;
  const currentBeat = Math.floor((currentPosition % 16) / 4) + 1;
  const currentTick = Math.floor(currentPosition % 4) + 1;

  return (
    <div className="timeline">
      <div className="timeline__header">
        <div className="timeline__position-display">
          {hoverInfo ? (
            <span className="timeline__position-display--hover">
              <Clock size={14} /> {hoverInfo.position}
            </span>
          ) : (
            <span>{`${currentBar}:${currentBeat}:${currentTick}`}</span>
          )}
        </div>
      </div>
      <div
        ref={timelineRef}
        className="timeline__track"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
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
