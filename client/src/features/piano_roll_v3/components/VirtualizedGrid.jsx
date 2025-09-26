/**
 * @file VirtualizedGrid.jsx
 * @description Fixed grid with proper line visibility
 */
import React, { memo, useMemo } from 'react';
import { LOD_LEVELS } from '../store/usePianoRollV3Store';

const GridLine = memo(({ x, y, width, height, type, opacity = 1 }) => (
  <div
    className={`piano-roll-v3__grid-line piano-roll-v3__grid-line--${type}`}
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width,
      height,
      opacity,
      pointerEvents: 'none',
    }}
  />
));

GridLine.displayName = 'GridLine';

const VirtualizedGrid = memo(({ engine }) => {
  const { virtualGrid, performance, viewport, grid } = engine;

  // Optimized grid lines based on LOD
  const gridLines = useMemo(() => {
    const { verticalLines, horizontalLines } = virtualGrid;
    const lodLevel = performance.lodLevel;

    // Vertical lines (time grid) - FIXED positioning
    const visibleVerticalLines = verticalLines.filter(line => {
      // LOD-based filtering
      if (lodLevel === LOD_LEVELS.ULTRA_SIMPLIFIED) {
        return line.type === 'bar'; // Only bar lines
      }
      if (lodLevel === LOD_LEVELS.SIMPLIFIED) {
        return line.type === 'bar' || (line.type === 'beat' && line.step % 32 === 0);
      }
      return true; // All lines for normal and above
    }).map(line => ({
      ...line,
      x: line.x - viewport.scrollX,
      opacity: line.type === 'bar' ? 0.6 : 
               line.type === 'beat' ? 0.3 : 0.15,
    }));

    // Horizontal lines (key grid) - FIXED positioning
    const visibleHorizontalLines = horizontalLines.filter(line => {
      // LOD-based filtering
      if (lodLevel === LOD_LEVELS.ULTRA_SIMPLIFIED) {
        return line.isOctaveLine; // Only octave lines
      }
      if (lodLevel === LOD_LEVELS.SIMPLIFIED) {
        return line.isC; // All C notes
      }
      return true; // All lines
    }).map(line => ({
      ...line,
      y: line.y - viewport.scrollY,
      opacity: line.isOctaveLine ? 0.4 : 
               line.isBlack ? 0.1 : 0.2,
    }));

    return {
      vertical: visibleVerticalLines,
      horizontal: visibleHorizontalLines,
    };
  }, [virtualGrid, performance.lodLevel, viewport.scrollX, viewport.scrollY]);

  // Grid pattern background for ultra-simplified mode
  const showPattern = performance.lodLevel === LOD_LEVELS.ULTRA_SIMPLIFIED;

  return (
    <div className="piano-roll-v3__grid">
      {/* Background pattern */}
      {showPattern && (
        <div
          className="piano-roll-v3__grid-pattern"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage: `
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: `${64 * grid.stepWidth}px ${12 * grid.keyHeight}px`,
            backgroundPosition: `${-viewport.scrollX % (64 * grid.stepWidth)}px ${-viewport.scrollY % (12 * grid.keyHeight)}px`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Vertical grid lines (time) */}
      <div className="piano-roll-v3__vertical-lines">
        {gridLines.vertical.map((line, index) => (
          <GridLine
            key={`v-${line.step}-${index}`}
            x={line.x}
            y={0}
            width={1}
            height={viewport.height}
            type={line.type}
            opacity={line.opacity}
          />
        ))}
      </div>

      {/* Horizontal grid lines (keys) */}
      <div className="piano-roll-v3__horizontal-lines">
        {gridLines.horizontal.map((line, index) => (
          <GridLine
            key={`h-${line.key}-${index}`}
            x={0}
            y={line.y}
            width={viewport.width}
            height={1}
            type={line.isOctaveLine ? 'octave' : line.isBlack ? 'black-key' : 'white-key'}
            opacity={line.opacity}
          />
        ))}
      </div>

      {/* Bar numbers (normal mode and above) */}
      {(performance.lodLevel === LOD_LEVELS.NORMAL ||
        performance.lodLevel === LOD_LEVELS.DETAILED ||
        performance.lodLevel === LOD_LEVELS.ULTRA_DETAILED) && (
        <div className="piano-roll-v3__bar-numbers">
          {gridLines.vertical
            .filter(line => line.type === 'bar' && line.x > 0 && line.x < viewport.width)
            .map(line => (
              <div
                key={`bar-label-${line.bar}`}
                className="piano-roll-v3__bar-label"
                style={{
                  position: 'absolute',
                  left: line.x + 4,
                  top: 4,
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.5)',
                  fontWeight: 'bold',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {line.bar}
              </div>
            ))
          }
        </div>
      )}

      {/* Octave labels (detailed modes) */}
      {(performance.lodLevel === LOD_LEVELS.DETAILED ||
        performance.lodLevel === LOD_LEVELS.ULTRA_DETAILED) && (
        <div className="piano-roll-v3__octave-labels">
          {gridLines.horizontal
            .filter(line => line.isOctaveLine && line.y > 0 && line.y < viewport.height)
            .map(line => (
              <div
                key={`octave-label-${line.key}`}
                className="piano-roll-v3__octave-label"
                style={{
                  position: 'absolute',
                  left: 4,
                  top: line.y - 10,
                  fontSize: '9px',
                  color: 'rgba(255,255,255,0.4)',
                  background: 'rgba(0,0,0,0.6)',
                  padding: '1px 3px',
                  borderRadius: '2px',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {line.pitch}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
});

VirtualizedGrid.displayName = 'VirtualizedGrid';

export default VirtualizedGrid;