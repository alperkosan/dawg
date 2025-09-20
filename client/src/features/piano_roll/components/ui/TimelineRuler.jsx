// src/features/piano_roll/components/ui/TimelineRuler.jsx
import React, { useMemo } from 'react';
import '../../styles/components/TimelineRuler.css';

export const TimelineRuler = React.memo(({ viewport }) => {
  const markers = useMemo(() => {
    const result = [];
    const barWidth = viewport.stepWidth * 16;
    if (barWidth <= 0) return [];
    
    const totalBars = Math.ceil(viewport.gridWidth / barWidth);

    for (let i = 0; i < totalBars; i++) {
      result.push({
        x: i * barWidth,
        label: i + 1,
      });
    }
    return result;
  }, [viewport.gridWidth, viewport.stepWidth]);

  return (
    <div 
      className="timeline-ruler"
      style={{
        width: viewport.gridWidth,
        transform: `translateX(${-viewport.scrollX}px)`,
        willChange: 'transform'
      }}
    >
      {markers.map(marker => (
        <div key={marker.label} className="timeline-ruler__bar" style={{ left: marker.x }}>
          <span className="timeline-ruler__label">{marker.label}</span>
        </div>
      ))}
    </div>
  );
});
