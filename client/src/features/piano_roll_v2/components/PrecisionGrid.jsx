/**
 * @file PrecisionGrid.jsx
 * @description Piano Roll'un arka planındaki dikey (zaman) ve yatay (pitch) çizgilerini
 * SVG kullanarak yüksek performanslı bir şekilde çizer.
 * Artık kendi viewport hesaplaması yapmak yerine doğrudan motordan gelen verileri kullanır.
 */
import React, { useMemo } from 'react';
import { usePianoRollStoreV2 } from '../store/usePianoRollStoreV2';

export const PrecisionGrid = React.memo(({ engine }) => {
  const { gridWidth, gridHeight, keyHeight, stepWidth, scroll, size } = engine;
  
  // --- YENİ: Sadeleştirilmiş ve daha doğru Viewport Hesaplaması ---
  const visibleRange = useMemo(() => {
    // Görünür alanın dışına bir miktar tampon (buffer) ekleyerek,
    // hızlı kaydırmalarda çizgilerin kaybolmasını engelliyoruz.
    const bufferX = size.width * 0.2;
    const bufferY = size.height * 0.2;
    
    return {
      startX: scroll.x - bufferX,
      endX: scroll.x + size.width + bufferX,
      startY: scroll.y - bufferY,
      endY: scroll.y + size.height + bufferY,
    };
  }, [scroll.x, scroll.y, size.width, size.height]);
  
  // --- YENİ: Sadece görünür dikey çizgileri hesaplayan optimize edilmiş mantık ---
  const verticalLines = useMemo(() => {
    if (stepWidth <= 0) return [];
    
    const lines = [];
    const startStep = Math.floor(visibleRange.startX / stepWidth);
    const endStep = Math.ceil(visibleRange.endX / stepWidth);

    for (let step = startStep; step <= endStep; step++) {
      const x = step * stepWidth;
      let type = 'sixteenth';
      if (step % 16 === 0) type = 'bar';
      else if (step % 4 === 0) type = 'beat';
      lines.push({ x, type, key: `v-${step}` });
    }
    return lines;
  }, [visibleRange.startX, visibleRange.endX, stepWidth]);

  // --- YENİ: Sadece görünür yatay çizgileri hesaplayan optimize edilmiş mantık ---
  const horizontalLines = useMemo(() => {
    if (keyHeight <= 0) return [];

    const lines = [];
    const startKey = Math.floor(visibleRange.startY / keyHeight);
    const endKey = Math.ceil(visibleRange.endY / keyHeight);

    for (let key = startKey; key <= endKey; key++) {
        const y = key * keyHeight;
        const noteIndex = (engine.totalKeys - 1 - key) % 12;
        const isBlackKey = [1, 3, 6, 8, 10].includes(noteIndex);
        lines.push({ y, isBlackKey, key: `h-${key}` });
    }
    return lines;
  }, [visibleRange.startY, visibleRange.endY, keyHeight, engine.totalKeys]);

  return (
    <div
      className="prv2-precision-grid-container"
      style={{
        width: gridWidth,
        height: gridHeight,
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none'
      }}
    >
        {/* Arka Plan Renkleri (Siyah Tuşlar) */}
        {horizontalLines.map(line => line.isBlackKey && (
            <div key={line.key} className="prv2-grid-black-key-row" style={{
                transform: `translateY(${line.y}px)`,
                height: keyHeight,
                width: gridWidth,
            }}/>
        ))}

        {/* Dikey Çizgiler (Zaman) */}
        {verticalLines.map(line => (
            <div key={line.key} className={`prv2-grid-line-vertical prv2-grid-line--${line.type}`} style={{
                transform: `translateX(${line.x}px)`,
                height: gridHeight,
            }}/>
        ))}
        
        {/* Yatay Çizgiler (Pitch) */}
        {horizontalLines.map(line => (
            <div key={line.key} className="prv2-grid-line-horizontal" style={{
                transform: `translateY(${line.y}px)`,
                width: gridWidth,
            }}/>
        ))}
    </div>
  );
});
