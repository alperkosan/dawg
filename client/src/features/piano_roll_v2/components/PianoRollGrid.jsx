// src/features/piano_roll_v2/components/PianoRollGrid.jsx
import React, { useMemo } from 'react';
import { GridTile } from './GridTile';

const TILE_WIDTH = 512;
const TILE_HEIGHT = 512;
const TILE_BUFFER = 1;

export const PianoRollGrid = React.memo(({ engine, scroll, size }) => {
  const visibleTiles = useMemo(() => {
    const { gridWidth, gridHeight } = engine;
    if (size.width === 0 || gridWidth === 0) return [];

    const tiles = [];
    
    // FIXED: Use dynamic gridWidth instead of fixed values
    const maxCols = Math.ceil(gridWidth / TILE_WIDTH);
    const maxRows = Math.ceil(gridHeight / TILE_HEIGHT);
    
    const startCol = Math.max(0, Math.floor(scroll.x / TILE_WIDTH) - TILE_BUFFER);
    const endCol = Math.min(maxCols, Math.ceil((scroll.x + size.width) / TILE_WIDTH) + TILE_BUFFER);
    const startRow = Math.max(0, Math.floor(scroll.y / TILE_HEIGHT) - TILE_BUFFER);
    const endRow = Math.min(maxRows, Math.ceil((scroll.y + size.height) / TILE_HEIGHT) + TILE_BUFFER);


    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        // FIXED: Ensure tiles don't exceed grid boundaries
        const tileX = col * TILE_WIDTH;
        const tileY = row * TILE_HEIGHT;
        const tileWidth = Math.min(TILE_WIDTH, gridWidth - tileX);
        const tileHeight = Math.min(TILE_HEIGHT, gridHeight - tileY);
        
        if (tileWidth > 0 && tileHeight > 0) {
          tiles.push({
            key: `${row}-${col}`,
            x: tileX,
            y: tileY,
            width: tileWidth,
            height: tileHeight,
          });
        }
      }
    }
    
    return tiles;
  }, [scroll, size, engine.gridWidth, engine.gridHeight]);

  return (
    <div className="prv2-grid-area__content" style={{ 
      width: engine.gridWidth, 
      height: engine.gridHeight,
      position: 'relative' // Ensure proper positioning context
    }}>
      {visibleTiles.map(tile => (
        <GridTile
          key={tile.key}
          engine={engine}
          x={tile.x}
          y={tile.y}
          width={tile.width}
          height={tile.height}
        />
      ))}
    </div>
  );
});