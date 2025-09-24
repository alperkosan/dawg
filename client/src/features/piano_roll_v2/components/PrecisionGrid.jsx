// components/PrecisionGrid.jsx
// Motor hassasiyetli layered grid rendering sistemi

import React, { useMemo, useCallback } from 'react';
import { PrecisionGrid as PrecisionGridEngine } from '../utils/precisionGrid';
import { usePlaybackStore } from '../../../store/usePlaybackStore';

export const PrecisionGrid = ({
  engine,
  width,
  height,
  className = '',
  showMotorPrecision = false
}) => {
  const { bpm } = usePlaybackStore();

  // Precision grid engine instance
  const precisionGrid = useMemo(() => {
    return new PrecisionGridEngine(bpm);
  }, [bpm]);

  // Optimized viewport calculation - only render visible area
  const viewportInfo = useMemo(() => {
    const { scroll } = engine || { scroll: { x: 0, y: 0 } };
    const stepWidth = engine?.dimensions?.stepWidth || engine?.stepWidth || 40;
    const keyHeight = engine?.dimensions?.keyHeight || engine?.keyHeight || 20;
    const safeWidth = width || 0;
    const safeHeight = height || 0;

    // Minimal buffer to avoid pop-in, but keep it small for performance
    const bufferX = stepWidth * 2; // Only 2 steps buffer
    const bufferY = keyHeight * 2; // Only 2 keys buffer

    return {
      // Horizontal viewport (time)
      startX: (scroll?.x || 0) - bufferX,
      endX: (scroll?.x || 0) + safeWidth + bufferX,
      // Vertical viewport (pitch)
      startY: (scroll?.y || 0) - bufferY,
      endY: (scroll?.y || 0) + safeHeight + bufferY,
      stepWidth,
      keyHeight
    };
  }, [
    Math.floor((engine?.scroll?.x || 0) / 50), // Less aggressive throttling
    Math.floor((engine?.scroll?.y || 0) / 50),
    engine?.dimensions?.stepWidth,
    engine?.stepWidth,
    engine?.dimensions?.keyHeight,
    engine?.keyHeight,
    width,
    height
  ]);

  // Generate only visible vertical grid lines (time) - FIXED: Use absolute positioning like timeline
  const verticalLines = useMemo(() => {
    const { startX, endX, stepWidth } = viewportInfo;
    const lines = [];

    // Calculate which steps are visible
    const startStep = Math.floor(startX / stepWidth);
    const endStep = Math.ceil(endX / stepWidth);

    for (let step = startStep; step <= endStep; step++) {
      const x = step * stepWidth;

      // Only add if actually in viewport
      if (x >= startX && x <= endX) {
        // Determine line type based on musical divisions - more visible
        let type = 'sixteenths';
        let opacity = 0.4; // Increased from 0.2
        let strokeWidth = 0.5;

        if (step % 64 === 0) { // Every 4 bars
          type = 'bars';
          opacity = 1.0; // Increased from 0.8
          strokeWidth = 2.5; // Increased from 2
        } else if (step % 16 === 0) { // Every bar
          type = 'bars';
          opacity = 0.8; // Increased from 0.6
          strokeWidth = 2; // Increased from 1.5
        } else if (step % 4 === 0) { // Every beat
          type = 'beats';
          opacity = 0.6; // Increased from 0.4
          strokeWidth = 1.2; // Increased from 1
        }

        lines.push({
          x: x - startX, // Viewport-relative positioning for SVG optimization
          type,
          opacity,
          strokeWidth
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

  // Simplified motor precision (if needed)
  const renderMotorLines = useCallback(() => {
    if (!showMotorPrecision) return null;
    // Simplified version - only render if user specifically requests motor precision
    return null; // Disable for performance
  }, [showMotorPrecision]);

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

      {/* Grid container with proper positioning - SYNCHRONIZED */}
      <g transform={`translate(${viewportInfo.startX}, ${viewportInfo.startY})`}>
        {/* Optimized Horizontal Lines (Pitch) */}
        <g className="horizontal-grid-lines">
          {renderHorizontalLines()}
        </g>

        {/* Optimized Vertical Lines (Time) */}
        <g className="vertical-grid-lines">
          {renderVerticalLines()}
        </g>
      </g>

      {/* Motor precision lines (debug mode - disabled for performance) */}
      {showMotorPrecision && (
        <g className="motor-precision-lines">
          {renderMotorLines()}
        </g>
      )}

      {/* Grid info overlay (for debugging) */}
      {showMotorPrecision && (
        <text
          x={10}
          y={20}
          fill="#ffffff"
          fontSize="12"
          fontFamily="monospace"
          opacity="0.7"
        >
          BPM: {bpm} | PPQ: {precisionGrid.ppq} | Zoom: {engine?.dimensions?.stepWidth || engine?.stepWidth || 40}px/step
        </text>
      )}
    </svg>
  );
};

// Grid info component for debugging
export const GridDebugInfo = ({ precisionGrid, engine }) => {
  const debugInfo = precisionGrid.getDebugInfo();

  return (
    <div className="grid-debug-info" style={{
      position: 'absolute',
      top: 10,
      right: 10,
      background: 'rgba(0,0,0,0.8)',
      color: '#ffffff',
      padding: '8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontFamily: 'monospace',
      zIndex: 1000
    }}>
      <div>BPM: {debugInfo.bpm}</div>
      <div>PPQ: {debugInfo.ppq}</div>
      <div>UI Precision: {debugInfo.uiPrecision}</div>
      <div>Ticks/Step: {debugInfo.ticksPerStep}</div>
      <div>Step Width: {engine?.dimensions?.stepWidth || engine?.stepWidth || 40}px</div>
      <div>Zoom: {((engine?.dimensions?.stepWidth || engine?.stepWidth || 40) / 40).toFixed(2)}x</div>
    </div>
  );
};