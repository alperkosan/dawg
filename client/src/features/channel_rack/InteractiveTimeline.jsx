import React, { useState, useRef, useCallback } from 'react';
import { MapPin, Clock } from 'lucide-react';
import './InteractiveTimeline.css';

const InteractiveTimeline = ({ 
  loopLength, 
  currentPosition = 0, 
  onJumpToBar, 
  onJumpToPosition,
  theme 
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
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const step = Math.floor(x / STEP_WIDTH);
    if (step >= 0 && step < loopLength) {
      onJumpToPosition?.(step);
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const renderMarkers = () => {
    const markers = [];
    for (let i = 0; i < totalBars; i++) {
      const barX = i * (STEP_WIDTH * 16);
      markers.push(
        <div key={`bar-${i}`} className="timeline-marker bar-line" style={{ left: `${barX}px`, backgroundColor: theme.colors.muted }}>
          <span className="timeline-label" style={{ color: theme.colors.text }}>{i + 1}</span>
        </div>
      );
      for (let j = 1; j < 4; j++) {
        const beatX = barX + (j * STEP_WIDTH * 4);
        markers.push(<div key={`beat-${i}-${j}`} className="timeline-marker beat-line" style={{ left: `${beatX}px`, backgroundColor: theme.colors.border }} />);
      }
    }
    return markers;
  };

  const currentBar = Math.floor(currentPosition / 16) + 1;
  const currentBeat = Math.floor((currentPosition % 16) / 4) + 1;
  const currentTick = Math.floor(currentPosition % 4) + 1;

  return (
    <div className="interactive-timeline-container-v2">
      <div className="timeline-header-v2" style={{ color: theme.colors.text }}>
        <div className="position-display-v2">
          {hoverInfo ? (
            <span className="hover-position-v2" style={{ color: theme.colors.primary }}>
              <Clock size={14} /> {hoverInfo.position}
            </span>
          ) : (
            <span>{`${currentBar}:${currentBeat}:${currentTick}`}</span>
          )}
        </div>
      </div>
      <div
        ref={timelineRef}
        className="interactive-timeline-v2"
        style={{ backgroundColor: theme.colors.background }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        {renderMarkers()}
        {hoverInfo && (
          <div className="timeline-hover-indicator-v2" style={{ left: `${hoverInfo.x}px`, borderColor: theme.colors.primary }} />
        )}
      </div>
    </div>
  );
};

export default InteractiveTimeline;
