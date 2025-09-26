import React, { useRef, useEffect, useCallback } from 'react';
import { usePianoRollStore } from '../store/usePianoRollStore';
import { RENDER_CONFIG } from '../config';

// Basit bir Renderer Sınıfı
class KeyboardRenderer {
    constructor(canvas, viewport) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.viewport = viewport;
    }

    drawVerticalGrid() {
        // Keyboard genişliği boyunca eşit aralıklarla dikey çizgiler
        const gridSpacing = 20; // Her 20px'de bir çizgi
        this.ctx.strokeStyle = RENDER_CONFIG.GRID_SECONDARY_COLOR;
        this.ctx.lineWidth = RENDER_CONFIG.GRID_LINE_WIDTH_SECONDARY;

        for (let x = 0; x < this.canvas.width; x += gridSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
    }

    draw(highlightedMidi = null) {
        this.ctx.fillStyle = RENDER_CONFIG.BACKGROUND_COLOR;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Dikey grid çizgileri (zaman tick'leri) - keyboard'da görsellik için
        this.drawVerticalGrid();

        const { start, end } = this.viewport.getVisibleMidiRange();
        for (let midi = Math.floor(start); midi < end; midi++) {
            // Excel tarzı infinite scroll - sınır kontrolü yok

            const { y } = this.viewport.worldToScreen(0, midi);

            // Excel tarzı - sadece highlight var, piano key background yok
            if (midi === highlightedMidi) {
                this.ctx.fillStyle = '#4a9eff'; // Vurgu rengi
                this.ctx.fillRect(0, y, this.canvas.width, this.viewport.zoomY);
            }

            // Yatay grid çizgileri (MIDI notaları arası)
            this.ctx.strokeStyle = RENDER_CONFIG.GRID_PRIMARY_COLOR;
            this.ctx.lineWidth = RENDER_CONFIG.GRID_LINE_WIDTH_PRIMARY;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();

            // Excel tarzı - nota isimleri yok
        }
    }
}

export const PianoRollKeyboard = () => {
    const canvasRef = useRef(null);
    const viewport = usePianoRollStore(state => state.viewport);

    // Ana render döngüsü, store'daki viewport her değiştiğinde tetiklenir
    useEffect(() => {
        if (!viewport || !canvasRef.current || viewport.canvasWidth <= 0 || viewport.canvasHeight <= 0) return;
        const canvas = canvasRef.current;
        const renderer = new KeyboardRenderer(canvas, viewport);
        renderer.draw();
    }, [viewport]); // Sadece viewport değiştiğinde yeniden çiz!

    // Canvas boyutunu ayarla
    useEffect(() => {
        const canvas = canvasRef.current;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }, []);

    return <canvas ref={canvasRef} />;
};