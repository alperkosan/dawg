// components/PrecisionGrid.jsx
// Simple layered grid rendering system

import React, { useMemo, useCallback } from 'react';
import { usePlaybackStore } from '../../../store/usePlaybackStore';
import { usePianoRollStoreV2 } from '../store/usePianoRollStoreV2';

export const PrecisionGrid = ({
  engine,
  width,
  height,
  className = '',
  showBeatPattern = true
}) => {
  const { bpm } = usePlaybackStore();
  // Optimize state selectors - only listen to grid-related changes
  const gridSnapValue = usePianoRollStoreV2(state => state.gridSnapValue);
  const zoomX = usePianoRollStoreV2(state => state.zoomX);


  // ULTRA OPTIMIZED: Virtual viewport calculation with offset support
  const viewportInfo = useMemo(() => {
    // CRITICAL: Early return if engine is not ready
    if (!engine || !engine.scroll || !engine.size) {
      return {
        startX: 0, endX: 0, startY: 0, endY: 0,
        renderStartX: 0, renderEndX: 0,
        stepWidth: 40, keyHeight: 20,
        virtualOffsetX: 0, virtualScrollX: 0
      };
    }

    const { scroll } = engine;
    const stepWidth = engine?.dimensions?.stepWidth || engine?.stepWidth || 40;
    const keyHeight = engine?.dimensions?.keyHeight || engine?.keyHeight || 20;
    const virtualOffsetX = engine?.virtualOffsetX || 0;
    const safeWidth = width || 0;
    const safeHeight = height || 0;

    // Smart buffer based on zoom level and step size
    const bufferX = Math.max(stepWidth * 2, safeWidth * 0.1); // Adaptive buffer
    const bufferY = Math.max(keyHeight * 2, safeHeight * 0.1);

    // Virtual scroll position with offset compensation
    const virtualScrollX = (scroll?.x || 0) + virtualOffsetX;

    return {
      // Virtual horizontal viewport (absolute time coordinates)
      startX: virtualScrollX - bufferX,
      endX: virtualScrollX + safeWidth + bufferX,
      // Vertical viewport (pitch) - unchanged
      startY: (scroll?.y || 0) - bufferY,
      endY: (scroll?.y || 0) + safeHeight + bufferY,
      // Grid-relative coordinates for rendering
      renderStartX: -bufferX,
      renderEndX: safeWidth + bufferX,
      stepWidth,
      keyHeight,
      virtualOffsetX,
      virtualScrollX
    };
  }, [
    Math.floor(((engine?.scroll?.x || 0) + (engine?.virtualOffsetX || 0)) / (engine?.stepWidth * 4 || 160)), // 4-step precision
    Math.floor((engine?.scroll?.y || 0) / 80), // 4-key precision
    engine?.stepWidth,
    engine?.keyHeight,
    engine?.virtualOffsetX,
    width,
    height
  ]);

  // HYPER OPTIMIZED: Virtual coordinate grid lines
  const verticalLines = useMemo(() => {
    const { startX, endX, stepWidth, renderStartX, renderEndX } = viewportInfo;
    const lines = [];

    // Calculate which steps are visible in absolute coordinates
    const startStep = Math.floor(startX / stepWidth);
    const endStep = Math.ceil(endX / stepWidth);

    for (let step = startStep; step <= endStep; step++) {
      const absoluteX = step * stepWidth;

      // Convert to grid-relative coordinate
      const renderX = absoluteX - viewportInfo.virtualScrollX;

      // Only render if within visible bounds
      if (renderX >= renderStartX && renderX <= renderEndX) {
        // Determine line type based on musical divisions
        let type = 'sixteenths';
        let opacity = 0.4;
        let strokeWidth = 0.5;

        if (step % 64 === 0) { // Every 4 bars
          type = 'bars';
          opacity = 1.0;
          strokeWidth = 2.5;
        } else if (step % 16 === 0) { // Every bar
          type = 'bars';
          opacity = 0.8;
          strokeWidth = 2;
        } else if (step % 4 === 0) { // Every beat
          type = 'beats';
          opacity = 0.6;
          strokeWidth = 1.2;
        }

        lines.push({
          x: renderX, // Grid-relative coordinate for efficient rendering
          type,
          opacity,
          strokeWidth,
          step // For debugging/optimization
        });
      }
    }

    return lines;
  }, [viewportInfo]);

  // Generate only visible horizontal grid lines (pitch) - FIXED: Use absolute positioning
  const horizontalLines = useMemo(() => {
    const { startY, endY, keyHeight } = viewportInfo;
    const lines = [];

    // Calculate which keys are visible
    const startKey = Math.floor(startY / keyHeight);
    const endKey = Math.ceil(endY / keyHeight);

    for (let key = startKey; key <= endKey; key++) {
      const y = key * keyHeight;

      // Only add if actually in viewport
      if (y >= startY && y <= endY) {
        const isOctave = (key % 12) === 0;
        const isWhiteKey = ![1, 3, 6, 8, 10].includes(key % 12);

        lines.push({
          y: y - startY, // Viewport-relative positioning for SVG optimization
          isOctave,
          isWhiteKey,
          opacity: isOctave ? 0.8 : (isWhiteKey ? 0.5 : 0.3), // Increased visibility
          strokeWidth: isOctave ? 1.5 : 0.8 // Thicker lines
        });
      }
    }

    return lines;
  }, [viewportInfo]);

  // Render vertical grid lines (time)
  const renderVerticalLines = useCallback(() => {
    return verticalLines.map((line, index) => (
      <line
        key={`vertical-${index}`}
        x1={line.x}
        y1={0}
        x2={line.x}
        y2={height || 0}
        stroke={getVerticalLineColor(line.type)}
        strokeWidth={line.strokeWidth}
        opacity={line.opacity}
        className={`grid-line grid-line--${line.type}`}
      />
    ));
  }, [verticalLines, height]);

  // Render horizontal grid lines (pitch)
  const renderHorizontalLines = useCallback(() => {
    return horizontalLines.map((line, index) => (
      <line
        key={`horizontal-${index}`}
        x1={0}
        y1={line.y}
        x2={width || 0}
        y2={line.y}
        stroke={getHorizontalLineColor(line.isOctave, line.isWhiteKey)}
        strokeWidth={line.strokeWidth}
        opacity={line.opacity}
        className={`pitch-line ${line.isOctave ? 'pitch-line--octave' : ''} ${line.isWhiteKey ? 'pitch-line--white' : 'pitch-line--black'}`}
      />
    ));
  }, [horizontalLines, width]);

  // Helper functions for line colors - more visible grid
  const getVerticalLineColor = (type) => {
    switch (type) {
      case 'bars': return '#6b7280'; // More visible bars
      case 'beats': return '#4b5563'; // More visible beats
      default: return '#374151'; // More visible sixteenths
    }
  };

  const getHorizontalLineColor = (isOctave, isWhiteKey) => {
    if (isOctave) return '#6b7280'; // More visible octaves
    return isWhiteKey ? '#4b5563' : '#374151'; // More visible keys
  };


  // Removed old renderPitchLines - now using optimized renderHorizontalLines

  return (
    <svg
      className={`precision-grid ${className}`}
      width={width || 0}
      height={height || 0}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 1,
        // FIXED: Use simple positioning - container handles scroll transform
        willChange: 'transform',
        backfaceVisibility: 'hidden'
      }}
      viewBox={`0 0 ${width || 0} ${height || 0}`}
    >
      {/* Subtle background pattern for empty areas - FL Studio style */}
      <defs>
        <pattern id="pianorollBg" patternUnits="userSpaceOnUse" width={viewportInfo.stepWidth * 4} height={viewportInfo.keyHeight * 12}>
          <rect width={viewportInfo.stepWidth * 4} height={viewportInfo.keyHeight * 12} fill="rgba(45, 55, 72, 0.03)" />
          <rect x={0} y={viewportInfo.keyHeight * 1} width={viewportInfo.stepWidth * 4} height={viewportInfo.keyHeight} fill="rgba(26, 32, 44, 0.05)" />
          <rect x={0} y={viewportInfo.keyHeight * 3} width={viewportInfo.stepWidth * 4} height={viewportInfo.keyHeight} fill="rgba(26, 32, 44, 0.05)" />
          <rect x={0} y={viewportInfo.keyHeight * 6} width={viewportInfo.stepWidth * 4} height={viewportInfo.keyHeight} fill="rgba(26, 32, 44, 0.05)" />
          <rect x={0} y={viewportInfo.keyHeight * 8} width={viewportInfo.stepWidth * 4} height={viewportInfo.keyHeight} fill="rgba(26, 32, 44, 0.05)" />
          <rect x={0} y={viewportInfo.keyHeight * 10} width={viewportInfo.stepWidth * 4} height={viewportInfo.keyHeight} fill="rgba(26, 32, 44, 0.05)" />
        </pattern>
        <pattern id="beatPattern" patternUnits="userSpaceOnUse" width={viewportInfo.stepWidth * 16} height="100%">
          <rect width={viewportInfo.stepWidth * 16} height="100%" fill="rgba(74, 85, 104, 0.02)" />
          <line x1={0} y1={0} x2={0} y2="100%" stroke="rgba(74, 85, 104, 0.1)" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* Background layers for visual depth */}
      <rect
        width={width || 0}
        height={height || 0}
        fill="url(#pianorollBg)"
        opacity="0.6"
      />
      <rect
        width={width || 0}
        height={height || 0}
        fill="url(#beatPattern)"
        opacity="0.3"
      />

      {/* ULTRA PERFORMANT: No transforms - direct coordinate rendering */}
      <g>
        {/* Optimized Horizontal Lines (Pitch) - Y offset handled in line calculation */}
        <g className="horizontal-grid-lines">
          {renderHorizontalLines()}
        </g>

        {/* Optimized Vertical Lines (Time) - X offset handled in line calculation */}
        <g className="vertical-grid-lines">
          {renderVerticalLines()}
        </g>
      </g>


    </svg>
  );
};

