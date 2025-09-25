// src/features/piano_roll_v2/components/GridTile.jsx
import React, { useRef, useEffect, memo } from 'react';
// Store'dan LOD seviyelerini ve hook'u import ediyoruz
import { usePianoRollStoreV2, LOD_LEVELS } from '../store/usePianoRollStoreV2';

/**
 * Grid'in bir parçasını (tile) çizen ve LOD'a göre detay seviyesini ayarlayan bileşen.
 * @param {object} engine - Piano roll motoru verileri.
 * @param {number} lod - Mevcut detay seviyesi (Level of Detail).
 */
const drawTile = (ctx, engine, tileX, tileY, tileWidth, tileHeight, lod) => {
    // Tema renklerini CSS değişkenlerinden dinamik olarak alır.
    const themeColors = {
        background: getComputedStyle(document.documentElement).getPropertyValue('--color-surface-1').trim(),
        blackKeyRow: getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim(),
        gridBar: 'rgba(255, 255, 255, 0.15)',
        gridBeat: 'rgba(255, 255, 255, 0.1)',
        gridSubdivision: 'rgba(255, 255, 255, 0.05)',
    };

    const { stepWidth, keyHeight, totalKeys, gridWidth } = engine;

    ctx.fillStyle = themeColors.background;
    ctx.fillRect(0, 0, tileWidth, tileHeight);

    // En uzak zoom seviyesinde görsel karmaşayı azaltmak için siyah tuş sıralarını gizle.
    if (lod !== LOD_LEVELS.OVERVIEW) {
        ctx.translate(-tileX, -tileY);
        ctx.fillStyle = themeColors.blackKeyRow;
        const blackKeyIndexes = new Set([1, 3, 6, 8, 10]);
        for (let i = 0; i < totalKeys; i++) {
            const keyIndex = (totalKeys - 1 - i) % 12;
            if (blackKeyIndexes.has(keyIndex)) {
                const y = i * keyHeight;
                if (y + keyHeight >= tileY && y <= tileY + tileHeight) {
                    ctx.fillRect(tileX, y, tileWidth, keyHeight);
                }
            }
        }
        ctx.translate(tileX, tileY);
    }
    
    ctx.translate(-tileX, -tileY);
    
    // Dikey çizgiler (Zaman) LOD'a göre çizilir
    const barStep = 16;
    const beatStep = 4;
    
    for (let i = 0; i <= gridWidth / stepWidth; i += 0.5) { // 1/32'lik adımlar için 0.5
        const x = i * stepWidth;

        if (x >= tileX && x < tileX + tileWidth) {
            let shouldDraw = false;
            
            if (i % barStep === 0) {
                ctx.strokeStyle = themeColors.gridBar;
                ctx.lineWidth = 1;
                shouldDraw = true;
            } else if (lod !== LOD_LEVELS.OVERVIEW && i % beatStep === 0) {
                ctx.strokeStyle = themeColors.gridBeat;
                ctx.lineWidth = 0.75;
                shouldDraw = true;
            } else if (lod === LOD_LEVELS.NORMAL && i % 1 === 0) {
                ctx.strokeStyle = themeColors.gridSubdivision;
                ctx.lineWidth = 0.5;
                shouldDraw = true;
            } else if (lod === LOD_LEVELS.DETAILED && i % 0.5 === 0) {
                ctx.strokeStyle = themeColors.gridSubdivision;
                ctx.lineWidth = 0.25;
                shouldDraw = true;
            }
            
            if (shouldDraw) {
                ctx.beginPath();
                ctx.moveTo(x, tileY);
                ctx.lineTo(x, tileY + tileHeight);
                ctx.stroke();
            }
        }
    }

    ctx.translate(tileX, tileY);
};

export const GridTile = memo(({ engine, x, y, width, height }) => {
    const canvasRef = useRef(null);
    // Mevcut LOD seviyesini store'dan alıyoruz. Bu hook, bileşenin
    // zoom değiştikçe otomatik olarak yeniden render olmasını sağlar.
    const lod = usePianoRollStoreV2(state => state.getLODLevel());

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        // Çizim fonksiyonuna o anki LOD seviyesini iletiyoruz.
        drawTile(ctx, engine, x, y, width, height, lod);
        
    }, [engine, x, y, width, height, lod]); // lod'u bağımlılık dizisine ekledik.

    return (
        <canvas
            ref={canvasRef}
            className="prv2-grid-tile"
            style={{
                transform: `translate(${x}px, ${y}px)`,
                width: width,
                height: height,
                willChange: 'transform',
            }}
        />
    );
});
