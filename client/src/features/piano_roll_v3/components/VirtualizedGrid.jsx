/**
 * @file VirtualizedGrid.jsx
 * @description Infinite scroll + LOD destekli virtualized grid bileşeni
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

const VirtualizedGrid = memo(({ engine }) => {
  const { virtualGrid, performance, viewport, grid } = engine;

  // LOD bazlı grid çizgilerini filtrele ve optimize et
  const optimizedGridLines = useMemo(() => {
    const { verticalLines, horizontalLines, visibleBounds } = virtualGrid;
    const lodLevel = performance.lodLevel;

    // Vertical lines (time grid)
    const visibleVerticalLines = verticalLines.filter(line => {
      // LOD bazlı filtreleme
      if (lodLevel === LOD_LEVELS.ULTRA_SIMPLIFIED) {
        return line.type === 'bar'; // Sadece bar çizgileri
      }
      if (lodLevel === LOD_LEVELS.SIMPLIFIED) {
        return line.type === 'bar' || line.type === 'beat'; // Bar + beat
      }
      return true; // Tüm çizgiler
    }).map(line => ({
      ...line,
      x: line.x - viewport.scrollX,
      opacity: line.type === 'bar' ? 1 : line.type === 'beat' ? 0.7 : 0.3,
    }));

    // Horizontal lines (key grid)
    const visibleHorizontalLines = horizontalLines.filter(line => {
      // LOD bazlı filtreleme
      if (lodLevel === LOD_LEVELS.ULTRA_SIMPLIFIED) {
        return line.isOctaveLine; // Sadece C notaları
      }
      if (lodLevel === LOD_LEVELS.SIMPLIFIED) {
        return line.isOctaveLine || line.isC; // C notaları
      }
      return true; // Tüm çizgiler
    }).map(line => ({
      ...line,
      y: line.y - viewport.scrollY,
      opacity: line.isOctaveLine ? 1 : line.isBlack ? 0.2 : 0.4,
    }));

    return {
      vertical: visibleVerticalLines,
      horizontal: visibleHorizontalLines,
    };
  }, [virtualGrid, performance.lodLevel, viewport.scrollX, viewport.scrollY]);

  // Grid background pattern (for ultra-simplified LOD)
  const gridBackground = useMemo(() => {
    if (performance.lodLevel !== LOD_LEVELS.ULTRA_SIMPLIFIED) return null;

    const patternSize = {
      width: 64 * grid.stepWidth, // 4 bars
      height: 12 * grid.keyHeight, // 1 octave
    };

    return (
      <div
        className="piano-roll-v3__grid-pattern"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: `${patternSize.width}px ${patternSize.height}px`,
          pointerEvents: 'none',
        }}
      />
    );
  }, [performance.lodLevel, grid.stepWidth, grid.keyHeight]);

  return (
    <div className="piano-roll-v3__grid">
      {/* Background pattern for ultra-simplified mode */}
      {gridBackground}

      {/* Vertical grid lines */}
      <div className="piano-roll-v3__vertical-lines">
        {optimizedGridLines.vertical.map(line => (
          <GridLine
            key={`v-${line.step}`}
            x={line.x}
            y={0}
            width={1}
            height={viewport.height}
            type={line.type}
            opacity={line.opacity}
          />
        ))}
      </div>

      {/* Horizontal grid lines */}
      <div className="piano-roll-v3__horizontal-lines">
        {optimizedGridLines.horizontal.map(line => (
          <GridLine
            key={`h-${line.key}`}
            x={0}
            y={line.y}
            width={viewport.width}
            height={1}
            type={line.isOctaveLine ? 'octave' : line.isBlack ? 'black-key' : 'white-key'}
            opacity={line.opacity}
          />
        ))}
      </div>

      {/* Beat numbers (detailed modes) */}
      {(performance.lodLevel === LOD_LEVELS.DETAILED ||
        performance.lodLevel === LOD_LEVELS.ULTRA_DETAILED) && (
        <div className="piano-roll-v3__beat-numbers">
          {optimizedGridLines.vertical
            .filter(line => line.type === 'beat' && line.x > 10 && line.x < viewport.width - 50)
            .map(line => (
              <div
                key={`beat-${line.step}`}
                className="piano-roll-v3__beat-label"
                style={{
                  position: 'absolute',
                  left: line.x + 4,
                  top: 4,
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.6)',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {line.bar}.{line.beat}
              </div>
            ))
          }
        </div>
      )}

      {/* Note labels on keyboard (detailed modes) */}
      {(performance.lodLevel === LOD_LEVELS.DETAILED ||
        performance.lodLevel === LOD_LEVELS.ULTRA_DETAILED) && (
        <div className="piano-roll-v3__note-labels">
          {optimizedGridLines.horizontal
            .filter(line => line.isC && line.y > 10 && line.y < viewport.height - 20)
            .map(line => (
              <div
                key={`note-${line.key}`}
                className="piano-roll-v3__note-label"
                style={{
                  position: 'absolute',
                  right: 4,
                  top: line.y + 2,
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.8)',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  background: 'rgba(0,0,0,0.7)',
                  padding: '1px 3px',
                  borderRadius: '2px',
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