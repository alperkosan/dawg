// src/features/piano_roll_v5/PianoRoll.jsx
import React, { useRef, useEffect } from 'react';
import { usePianoRollEngine } from './usePianoRollEngine';
import { drawPianoRoll } from './renderer';
import './PianoRoll_v5.css';

function PianoRoll() {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const engine = usePianoRollEngine(containerRef);

    // Çizim döngüsü
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;

        // Yüksek DPI ekranlar için ölçekleme
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        // Her motor güncellemesinde yeniden çiz
        const animationFrameId = requestAnimationFrame(() => {
            drawPianoRoll(ctx, engine);
        });

        return () => cancelAnimationFrame(animationFrameId);
    }, [engine]); // Engine state'i her değiştiğinde bu effect tekrar çalışır

    return (
        <div className="prv5-container">
            <div className="prv5-toolbar">
                {/* Buraya gelecekte araçlar eklenebilir */}
                <span>Piano Roll v5</span>
            </div>
            <div 
                ref={containerRef} 
                className="prv5-canvas-container"
                {...engine.eventHandlers} // Tüm olay yöneticilerini buraya bağlıyoruz
                style={{ cursor: 'grab' }}
            >
                <canvas ref={canvasRef} className="prv5-canvas" />
                
                {/* Debug Bilgileri */}
                <div className="prv5-debug-overlay">
                    <div>Scroll: {Math.round(engine.viewport.scrollX)}, {Math.round(engine.viewport.scrollY)}</div>
                    <div>Zoom: {engine.viewport.zoomX.toFixed(2)}x, {engine.viewport.zoomY.toFixed(2)}y</div>
                    <div>LOD: {engine.lod}</div>
                </div>
            </div>
        </div>
    );
}

export default PianoRoll;