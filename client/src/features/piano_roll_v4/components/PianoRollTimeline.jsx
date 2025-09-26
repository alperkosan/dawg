import React, { useRef, useEffect } from 'react';
import { usePianoRollStore } from '../store/usePianoRollStore';
import { RENDER_CONFIG, MUSIC_CONFIG } from '../config';

class TimelineRenderer {
    constructor(canvas, viewport) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.viewport = viewport;
    }
    
    draw() {
        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const { start, end } = this.viewport.getVisibleTickRange();
        const step = MUSIC_CONFIG.TICKS_PER_QUARTER_NOTE * 4; // Ölçü çizgileri
        
        const firstLine = Math.floor(start / step) * step;

        for (let tick = firstLine; tick < end; tick += step) {
            const { x } = this.viewport.worldToScreen(tick, 0);
            const barNumber = Math.floor(tick / step) + 1;

            this.ctx.strokeStyle = RENDER_CONFIG.GRID_PRIMARY_COLOR;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();

            this.ctx.fillStyle = '#cccccc';
            this.ctx.fillText(barNumber, x + 5, 15);
        }
    }
}

export const PianoRollTimeline = () => {
    const canvasRef = useRef(null);
    const viewport = usePianoRollStore(state => state.viewport);

    useEffect(() => {
        if (!viewport || !canvasRef.current) return;
        const renderer = new TimelineRenderer(canvasRef.current, viewport);
        renderer.draw();
    }, [viewport]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }, []);

    return <canvas ref={canvasRef} />;
};