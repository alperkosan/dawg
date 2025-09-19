// Enhanced TimelineRuler.jsx - Interactive timeline with advanced features
import React, { useMemo, useCallback, useState } from 'react';

const TimelineRuler = ({ 
  viewport, 
  playbackState, 
  loopLength = 16,
  onTimeClick,
  onLoopRegionChange,
  className = ''
}) => {
  const [hoveredPosition, setHoveredPosition] = useState(null);
  const [isDraggingLoop, setIsDraggingLoop] = useState(false);

  // ✅ TIME MARKERS CALCULATION
  const timeMarkers = useMemo(() => {
    const markers = [];
    const barWidth = viewport.stepWidth * 16; // 16 steps per bar
    const beatWidth = viewport.stepWidth * 4;  // 4 steps per beat
    const totalBars = Math.ceil(viewport.gridWidth / barWidth);
    
    // Calculate visible range for performance
    const visibleStart = Math.max(0, Math.floor(viewport.visibleBounds?.left / barWidth) - 1);
    const visibleEnd = Math.min(totalBars, Math.ceil(viewport.visibleBounds?.right / barWidth) + 1);
    
    for (let bar = visibleStart; bar < visibleEnd; bar++) {
      const barX = bar * barWidth;
      
      // Bar markers
      markers.push({
        type: 'bar',
        x: barX,
        width: barWidth,
        label: (bar + 1).toString(),
        number: bar + 1,
        isDownbeat: bar % 4 === 0 // Every 4 bars
      });
      
      // Beat markers
      for (let beat = 1; beat < 4; beat++) {
        const beatX = barX + beat * beatWidth;
        markers.push({
          type: 'beat',
          x: beatX,
          beat: beat + 1,
          bar: bar + 1
        });
      }
      
      // Subdivision markers (if zoomed in enough)
      if (viewport.stepWidth > 12) {
        for (let step = 1; step < 16; step++) {
          if (step % 4 !== 0) { // Skip beat lines
            const stepX = barX + step * viewport.stepWidth;
            markers.push({
              type: 'subdivision',
              x: stepX,
              step: step + 1,
              bar: bar + 1,
              intensity: step % 2 === 0 ? 'strong' : 'weak'
            });
          }
        }
      }
    }
    
    return markers;
  }, [viewport.stepWidth, viewport.gridWidth, viewport.visibleBounds]);

  // ✅ LOOP REGION CALCULATION
  const loopRegion = useMemo(() => {
    if (!loopLength) return null;
    
    const startX = 0;
    const endX = loopLength * viewport.stepWidth * 16; // loopLength in bars
    const width = endX - startX;
    
    return { startX, endX, width };
  }, [loopLength, viewport.stepWidth]);

  // ✅ PLAYHEAD POSITION
  const playheadPosition = useMemo(() => {
    if (!playbackState?.isPlaying || !playbackState.position) return null;
    
    return viewport.timeToX ? viewport.timeToX(playbackState.position) : 0;
  }, [playbackState, viewport.timeToX]);

  // ✅ TIME SIGNATURE DISPLAY
  const timeSignature = useMemo(() => ({
    numerator: 4,
    denominator: 4,
    display: '4/4'
  }), []);

  // ✅ TEMPO CALCULATION
  const tempoInfo = useMemo(() => {
    // This would ideally come from your audio engine/transport
    const bpm = 120; // Default, should be dynamic
    const stepDuration = (60 / bpm) / 4; // Duration of 16th note in seconds
    
    return {
      bpm,
      stepDuration,
      display: `${bpm} BPM`
    };
  }, []);

  // ✅ MOUSE INTERACTION HANDLERS
  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = viewport.xToTime ? viewport.xToTime(x) : 0;
    const bar = Math.floor(time / 16) + 1;
    const beat = Math.floor((time % 16) / 4) + 1;
    const step = Math.floor(time % 4) + 1;
    
    setHoveredPosition({ x, time, bar, beat, step });
  }, [viewport.xToTime]);

  const handleMouseLeave = useCallback(() => {
    setHoveredPosition(null);
  }, []);

  const handleClick = useCallback((e) => {
    if (!hoveredPosition) return;
    
    onTimeClick?.(hoveredPosition.time);
  }, [hoveredPosition, onTimeClick]);

  // ✅ RENDER INDIVIDUAL MARKERS
  const renderMarkers = () => {
    return timeMarkers.map((marker, index) => {
      switch (marker.type) {
        case 'bar':
          return (
            <div
              key={`bar-${marker.number}`}
              className="absolute h-full flex items-start border-l-2 border-gray-400/80"
              style={{ left: marker.x, width: marker.width }}
            >
              <div className={`text-sm font-bold px-2 py-1 rounded-br ${
                marker.isDownbeat 
                  ? 'text-cyan-300 bg-cyan-900/30' 
                  : 'text-gray-300 bg-gray-800/60'
              }`}>
                {marker.label}
              </div>
            </div>
          );
          
        case 'beat':
          return (
            <div
              key={`beat-${marker.bar}-${marker.beat}`}
              className="absolute top-2 h-4 border-l border-gray-400/50"
              style={{ left: marker.x }}
              title={`Bar ${marker.bar}, Beat ${marker.beat}`}
            />
          );
          
        case 'subdivision':
          return (
            <div
              key={`sub-${marker.bar}-${marker.step}`}
              className={`absolute top-4 h-2 border-l ${
                marker.intensity === 'strong' 
                  ? 'border-gray-500/40' 
                  : 'border-gray-500/25'
              }`}
              style={{ left: marker.x }}
            />
          );
          
        default:
          return null;
      }
    });
  };

  // ✅ RENDER LOOP REGION
  const renderLoopRegion = () => {
    if (!loopRegion) return null;
    
    return (
      <div
        className="absolute top-0 bottom-0 bg-green-500/10 border-l-2 border-r-2 border-green-500/60"
        style={{
          left: loopRegion.startX,
          width: loopRegion.width
        }}
      >
        <div className="absolute top-1 left-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded">
          Loop: {loopLength} bars
        </div>
      </div>
    );
  };

  // ✅ RENDER PLAYHEAD
  const renderPlayhead = () => {
    if (playheadPosition === null) return null;
    
    return (
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 pointer-events-none z-20"
        style={{
          left: playheadPosition,
          filter: 'drop-shadow(0 0 4px rgba(0, 188, 212, 0.8))'
        }}
      >
        {/* Playhead triangle */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-6 border-transparent border-b-cyan-400" />
      </div>
    );
  };

  // ✅ RENDER HOVER TOOLTIP
  const renderHoverTooltip = () => {
    if (!hoveredPosition) return null;
    
    return (
      <div
        className="absolute top-full mt-2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg border border-gray-600 pointer-events-none z-30"
        style={{ 
          left: hoveredPosition.x,
          transform: 'translateX(-50%)'
        }}
      >
        <div className="font-mono">
          Bar {hoveredPosition.bar} • Beat {hoveredPosition.beat} • Step {hoveredPosition.step}
        </div>
        <div className="text-gray-400 mt-1">
          Time: {hoveredPosition.time.toFixed(2)}
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`relative h-10 bg-gray-800 border-b border-gray-700 overflow-hidden select-none ${className}`}
      style={{ width: viewport.gridWidth }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* BACKGROUND PATTERN */}
      <div className="absolute inset-0 opacity-20">
        <div 
          className="h-full bg-gradient-to-r from-gray-700 via-transparent to-gray-700"
          style={{ 
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 15px, rgba(255,255,255,0.05) 16px)',
            backgroundSize: `${viewport.stepWidth * 4}px 100%`
          }}
        />
      </div>
      
      {/* LOOP REGION */}
      {renderLoopRegion()}
      
      {/* TIME MARKERS */}
      {renderMarkers()}
      
      {/* PLAYHEAD */}
      {renderPlayhead()}
      
      {/* HOVER TOOLTIP */}
      {renderHoverTooltip()}
      
      {/* INFO PANEL */}
      <div className="absolute top-1 right-2 flex items-center gap-3 text-xs">
        {/* Time signature */}
        <div className="bg-gray-900/80 text-gray-300 px-2 py-1 rounded border border-gray-600">
          {timeSignature.display}
        </div>
        
        {/* Tempo */}
        <div className="bg-gray-900/80 text-cyan-300 px-2 py-1 rounded border border-cyan-600/50">
          {tempoInfo.display}
        </div>
        
        {/* Current playback time */}
        {playbackState?.isPlaying && (
          <div className="bg-cyan-900/80 text-cyan-100 px-2 py-1 rounded border border-cyan-500/50 font-mono">
            {Math.floor(playbackState.position / 16) + 1}:
            {Math.floor((playbackState.position % 16) / 4) + 1}:
            {Math.floor(playbackState.position % 4) + 1}
          </div>
        )}
      </div>
      
      {/* CLICK HINT */}
      {hoveredPosition && (
        <div className="absolute bottom-1 left-2 text-xs text-gray-400">
          Click to set playhead position
        </div>
      )}
    </div>
  );
};

export default TimelineRuler;