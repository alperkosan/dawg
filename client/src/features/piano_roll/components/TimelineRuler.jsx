import React, { useMemo } from 'react';

const TimelineRuler = ({ 
  viewport, 
  zoom, 
  snapSettings, 
  playbackState 
}) => {
  const markers = useMemo(() => {
    const items = [];
    const barWidth = viewport.stepWidth * 16;
    const beatWidth = viewport.stepWidth * 4;
    const totalBars = Math.ceil(viewport.gridWidth / barWidth);
    
    for (let bar = 0; bar < totalBars; bar++) {
      // Bar markers
      items.push(
        <div
          key={`bar-${bar}`}
          className="absolute h-full flex items-center border-l border-gray-500/70"
          style={{ left: bar * barWidth, width: barWidth }}
        >
          <span className="text-sm font-bold text-gray-300 pl-2 bg-gray-800/80 px-1 rounded">
            {bar + 1}
          </span>
        </div>
      );
      
      // Beat markers
      for (let beat = 1; beat < 4; beat++) {
        items.push(
          <div
            key={`beat-${bar}-${beat}`}
            className="absolute top-1/2 h-1/2 border-l border-gray-500/40"
            style={{ left: bar * barWidth + beat * beatWidth }}
          />
        );
      }
      
      // Subdivision markers (if zoomed in enough)
      if (viewport.stepWidth > 15) {
        for (let step = 1; step < 16; step++) {
          if (step % 4 !== 0) {
            items.push(
              <div
                key={`step-${bar}-${step}`}
                className="absolute top-3/4 h-1/4 border-l border-gray-500/20"
                style={{ left: bar * barWidth + step * viewport.stepWidth }}
              />
            );
          }
        }
      }
    }
    
    return items;
  }, [viewport.stepWidth, viewport.gridWidth]);
  
  return (
    <div 
      className="relative h-10 bg-gray-800 border-b border-gray-700 overflow-hidden"
      style={{ width: viewport.gridWidth }}
    >
      {markers}
      
      {/* Playhead indicator */}
      {playbackState.isPlaying && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 pointer-events-none z-10"
          style={{
            left: viewport.timeToX(playbackState.position)
          }}
        />
      )}
      
      {/* Time signature indicator */}
      <div className="absolute top-0 right-2 h-full flex items-center">
        <span className="text-xs text-gray-400 bg-gray-900/80 px-2 py-1 rounded">
          4/4
        </span>
      </div>
    </div>
  );
};

export default TimelineRuler;
