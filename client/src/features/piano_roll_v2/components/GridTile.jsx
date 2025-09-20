// src/features/piano_roll_v2/components/GridTile.jsx
import React, { useRef, useEffect, memo } from 'react';

// Bu çizim fonksiyonu artık en ince ayrıntıyı bile hesaba katıyor.
const drawTile = (ctx, engine, tileX, tileY, tileWidth, tileHeight) => {
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
    ctx.translate(-tileX, -tileY);
    
    // Siyah tuş satırları
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

    // === SNAP UYUMLULUĞU İÇİN NİHAİ ÇİZİM MANTIĞI ===
    const barStep = 16;
    const beatStep = 4;
    const sixteenthStep = 1;
    const thirtySecondStep = 0.5; // En küçük birimimiz

    // Döngüyü en küçük birim olan 1/32'lik adımlarla (0.5) çalıştır
    for (let i = 0; i <= gridWidth / stepWidth; i += thirtySecondStep) {
        const x = i * stepWidth;

        // Sadece bu karonun alanına giren çizgilerle ilgilen
        if (x >= tileX && x < tileX + tileWidth) {
            ctx.beginPath();
            
            // Çizgi tipini ve kalınlığını belirle (en kalından en inceye doğru)
            if (i % barStep === 0) {
                ctx.strokeStyle = themeColors.gridBar;
                ctx.lineWidth = 1;
            } else if (i % beatStep === 0) {
                ctx.strokeStyle = themeColors.gridBeat;
                ctx.lineWidth = 0.75;
            } else if (i % sixteenthStep === 0 && stepWidth > 12) {
                ctx.strokeStyle = themeColors.gridSubdivision;
                ctx.lineWidth = 0.5;
            } else if (stepWidth > 30) { // 1/32'lik çizgiler
                ctx.strokeStyle = themeColors.gridSubdivision;
                ctx.lineWidth = 0.25;
            } else {
                continue; // Çizilecek bir şey yoksa döngünün sonraki adımına geç
            }
            
            ctx.moveTo(x, tileY);
            ctx.lineTo(x, tileY + tileHeight);
            ctx.stroke();
        }
    }

    // Yatay çizgiler (Pitch)
    ctx.strokeStyle = themeColors.gridBeat;
    ctx.lineWidth = 0.5;
    for (let i = 1; i < totalKeys; i++) {
        const y = i * keyHeight;
        if (y >= tileY && y <= tileY + tileHeight) {
            ctx.beginPath();
            ctx.moveTo(tileX, y);
            ctx.lineTo(tileX + tileWidth, y);
            ctx.stroke();
        }
    }
    
    ctx.translate(tileX, tileY);
};

export const GridTile = memo(({ engine, x, y, width, height }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        drawTile(ctx, engine, x, y, width, height);
        
    }, [engine, x, y, width, height]);

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