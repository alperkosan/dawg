import React, { useMemo } from 'react';

const TimelineRuler = ({ loopLength, zoomX, stepWidth }) => {
  const totalBars = Math.ceil(loopLength / 16);
  const barWidth = stepWidth * 16;
  const beatWidth = stepWidth * 4;

  const markers = useMemo(() => {
    const items = [];
    for (let bar = 0; bar < totalBars; bar++) {
      items.push(
        <div
          key={`bar-${bar}`}
          className="absolute h-full flex items-center border-l border-gray-500/70"
          style={{ left: bar * barWidth, width: barWidth }}
        >
          <span className="text-sm font-bold text-gray-300 pl-2">{bar + 1}</span>
        </div>
      );
      for (let beat = 1; beat < 4; beat++) {
        items.push(
          <div
            key={`beat-${bar}-${beat}`}
            className="absolute top-1/2 h-1/2 border-l border-gray-500/40"
            style={{ left: (bar * barWidth) + (beat * beatWidth) }}
          />
        );
      }
    }
    return items;
  }, [totalBars, barWidth, beatWidth]);

  return (
    <div
      className="relative h-8 shrink-0 bg-gray-800"
      style={{ width: loopLength * stepWidth }}
    >
      {markers}
    </div>
  );
};

export default React.memo(TimelineRuler);