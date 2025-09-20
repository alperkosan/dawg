import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import Note from './Note';
import { usePianoRollStore } from '../store/usePianoRollStore';

const PianoRollGrid = React.memo(({ notes, selectedNotes, viewport, interaction, onResizeStart }) => {
    const canvasRef = useRef(null);
    const { showScaleHighlighting, scale } = usePianoRollStore();

    const visibleNotes = useMemo(() => {
        return notes.filter(note => viewport.isNoteVisible(note));
    }, [notes, viewport]);

    const drawGrid = useCallback((ctx) => {
        const { gridWidth, gridHeight, stepWidth, keyHeight, totalKeys } = viewport;
        if (!canvasRef.current) return;

        // Renkleri doğrudan tema CSS değişkenlerinden alıyoruz
        const styles = getComputedStyle(canvasRef.current);
        const gridColors = {
            background: styles.getPropertyValue('--color-background-deep').trim(),
            bar: 'rgba(255, 255, 255, 0.12)',      // Daha belirgin
            beat: 'rgba(255, 255, 255, 0.08)',     // Orta belirginlikte
            subdivision: 'rgba(255, 255, 255, 0.04)', // En soluk
            scaleHighlight: styles.getPropertyValue('--color-accent-primary').trim() + '1A', // %10 alpha
        };

        ctx.fillStyle = gridColors.background;
        ctx.fillRect(0, 0, gridWidth, gridHeight);

        // Gam (Scale) Vurguları
        if (showScaleHighlighting) {
            const scaleNoteSet = scale?.getScaleNotes ? scale.getScaleNotes() : new Set();
            ctx.fillStyle = gridColors.scaleHighlight;
            for (let i = 0; i < totalKeys; i++) {
                const noteIndex = i % 12; // Hangi nota olduğunu bul (C, C#, D...)
                if (!scaleNoteSet.has(noteIndex)) {
                    // Nota gam içinde değilse, o satırı boya
                    const y = (totalKeys - 1 - i) * keyHeight;
                    ctx.fillRect(0, y, gridWidth, keyHeight);
                }
            }
        }
        
        // Dikey Çizgiler (Dinamik Görünürlük)
        for (let i = 0; i * stepWidth < gridWidth; i++) {
            const x = i * stepWidth;
            
            if (i % 16 === 0) { // Bar çizgisi (Her zaman görünür)
                ctx.strokeStyle = gridColors.bar;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, gridHeight);
                ctx.stroke();
            } else if (i % 4 === 0) { // Beat çizgisi (Her zaman görünür)
                ctx.strokeStyle = gridColors.beat;
                ctx.lineWidth = 0.75;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, gridHeight);
                ctx.stroke();
            } else if (viewport.stepWidth > 12) { // 1/16'lık adımlar (Sadece yakınlaşınca görünür)
                ctx.strokeStyle = gridColors.subdivision;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, gridHeight);
                ctx.stroke();
            }
        }

        // Yatay Çizgiler (Piyano Tuşları)
        ctx.strokeStyle = gridColors.beat; // Beat çizgisiyle aynı renkte
        ctx.lineWidth = 0.5;
        for (let i = 0; i * keyHeight < gridHeight; i++) {
            const y = i * keyHeight;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(gridWidth, y);
            ctx.stroke();
        }
    }, [viewport, showScaleHighlighting, scale]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.gridWidth * dpr;
        canvas.height = viewport.gridHeight * dpr;
        canvas.style.width = `${viewport.gridWidth}px`;
        canvas.style.height = `${viewport.gridHeight}px`;

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        drawGrid(ctx);
    }, [viewport.gridWidth, viewport.gridHeight, drawGrid]);

    return (
        <div className="piano-roll__grid">
            <canvas ref={canvasRef} className="piano-roll__grid-canvas" />
            <div className="piano-roll__notes-container">
                {visibleNotes.map(note => (
                    <Note 
                        key={note.id} 
                        note={note} 
                        isSelected={selectedNotes.has(note.id)} 
                        viewport={viewport} 
                        onResizeStart={onResizeStart}
                    />
                ))}
                {interaction?.previewNotes?.map(note => (
                    <Note key={`preview-${note.id}`} note={note} isPreview={true} viewport={viewport}/>
                ))}
            </div>
            {interaction?.type === 'marquee' && (
                <div 
                    className="piano-roll__marquee"
                    style={{
                        left: Math.min(interaction.startPos.x, interaction.currentPos.x),
                        top: Math.min(interaction.startPos.y, interaction.currentPos.y),
                        width: Math.abs(interaction.currentPos.x - interaction.startPos.x),
                        height: Math.abs(interaction.currentPos.y - interaction.startPos.y),
                    }}
                />
            )}
        </div>
    );
});
PianoRollGrid.displayName = "PianoRollGrid";
export default PianoRollGrid;