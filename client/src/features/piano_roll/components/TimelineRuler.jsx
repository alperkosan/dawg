import React, { memo, useMemo } from 'react';

const TimelineRuler = memo(({ viewport, loopLength }) => {

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
    <div className="timeline-ruler" style={{ width: viewport.gridWidth }}>
      {markers.map(marker => (
        <div key={marker.label} className="timeline-ruler__bar" style={{ left: marker.x }}>
          <span className="timeline-ruler__label">{marker.label}</span>
        </div>
      ))}
    </div>
  );
});

TimelineRuler.displayName = 'TimelineRuler';
export default TimelineRuler; // Varsayılan (default) export

