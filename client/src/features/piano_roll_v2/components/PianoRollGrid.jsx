// src/features/piano_roll_v2/components/PianoRollGrid.jsx
import React, { useMemo } from 'react';
import { GridTile } from './GridTile';

const TILE_WIDTH = 512;
const TILE_HEIGHT = 512;
const TILE_BUFFER = 1; // === YENİ: Etrafta render edilecek ekstra karo sırası sayısı ===

export const PianoRollGrid = React.memo(({ engine, scroll, size }) => {
  const visibleTiles = useMemo(() => {
    const { gridWidth, gridHeight } = engine;
    if (size.width === 0 || gridWidth === 0) return [];

    const tiles = [];
    
    // === GÜNCELLEME: Hesaplamalara tampon bölgeyi ekliyoruz ===
    const startCol = Math.max(0, Math.floor(scroll.x / TILE_WIDTH) - TILE_BUFFER);
    const endCol = Math.min(Math.ceil(gridWidth / TILE_WIDTH), Math.ceil((scroll.x + size.width) / TILE_WIDTH) + TILE_BUFFER);
    const startRow = Math.max(0, Math.floor(scroll.y / TILE_HEIGHT) - TILE_BUFFER);
    const endRow = Math.min(Math.ceil(gridHeight / TILE_HEIGHT), Math.ceil((scroll.y + size.height) / TILE_HEIGHT) + TILE_BUFFER);

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        tiles.push({
          key: `${row}-${col}`,
          x: col * TILE_WIDTH,
          y: row * TILE_HEIGHT,
          width: TILE_WIDTH,
          height: TILE_HEIGHT,
        });
      }
    }
    return tiles;
  }, [scroll, size, engine]);

  return (
    <div className="prv2-grid-area__content" style={{ width: engine.gridWidth, height: engine.gridHeight }}>
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