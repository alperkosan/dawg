import React, { useEffect, useRef, useState, useLayoutEffect, useCallback, useMemo } from 'react';
import { EQCalculations } from '../../lib/audio/EQCalculations';

// --- YARDIMCI FONKSİYONLAR VE SABİTLER (DEĞİŞİKLİK YOK) ---
const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_DB = -18;
const MAX_DB = 18;
const NODE_HIT_RADIUS = 12;
const Q_SENSITIVITY = 0.005;
const SAMPLE_RATE = 44100;

const freqToX = (freq, width) => {
    if (width === 0) return 0;
    const logFreq = Math.log(freq);
    const logMin = Math.log(MIN_FREQ);
    const logMax = Math.log(MAX_FREQ);
    const pos = (logFreq - logMin) / (logMax - logMin);
    return pos * width;
};
const xToFreq = (x, width) => {
    if (width === 0) return MIN_FREQ;
    const pos = x / width;
    const logMin = Math.log(MIN_FREQ);
    const logMax = Math.log(MAX_FREQ);
    const logFreq = pos * (logMax - logMin) + logMin;
    return Math.exp(logFreq);
};
const dbToY = (db, height) => {
    if (height === 0) return 0;
    const range = MAX_DB - MIN_DB;
    const percent = (db - MIN_DB) / range;
    return (1 - Math.max(0, Math.min(1, percent))) * height;
};
const yToDb = (y, height) => {
    if (height === 0) return MIN_DB;
    const range = MAX_DB - MIN_DB;
    const percent = 1 - (y / height);
    return percent * range + MIN_DB;
};
const getGainColor = (gain) => {
    if (gain <= 0) return '#38bdf8';
    const hue = Math.max(0, 60 - (gain * 3));
    return `hsl(${hue}, 100%, 55%)`;
};


export const AdvancedEQUI = ({ effect, onChange, trackId }) => {
  const { bands } = effect.settings;
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const [canvasDims, setCanvasDims] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, freq: 0, db: 0, activeIndex: -1 });

  // === ÇÖZÜMÜN KALBİ: Tüm dinamik veriler artık useRef'te ===
  const drawDataRef = useRef({
      bands: [],
      responseCurve: [],
      activeBandIndex: -1,
      draggedBand: null, // { index, startY, startQ }
  });

  // Props (bands) her değiştiğinde, çizim verisini sessizce güncelle.
  // Bu, preset değişikliklerinin anında yansımasını sağlar.
  useEffect(() => {
    drawDataRef.current.bands = bands;
    drawDataRef.current.responseCurve = EQCalculations.generateResponseCurve(bands, SAMPLE_RATE, 150);
  }, [bands]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setCanvasDims({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // === TEK VE KESİNTİSİZ ÇİZİM DÖNGÜSÜ ===
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasDims.width === 0) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasDims.width * dpr;
    canvas.height = canvasDims.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    let animationFrameId;
    const drawLoop = () => {
        const { bands, responseCurve, activeBandIndex, draggedBand } = drawDataRef.current;
        const { width, height } = canvasDims;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(0, 0, width, height);
        
        const gridColor = 'rgba(255, 255, 255, 0.05)';
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        [30, 100, 300, 1000, 3000, 10000].forEach(f => { ctx.beginPath(); ctx.moveTo(freqToX(f, width), 0); ctx.lineTo(freqToX(f, width), height); ctx.stroke(); });
        [-12, -6, 0, 6, 12].forEach(db => { ctx.beginPath(); ctx.moveTo(0, dbToY(db, height)); ctx.lineTo(width, dbToY(db, height)); ctx.stroke(); });
        
        if (responseCurve && responseCurve.length > 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 2.5; ctx.shadowColor = 'rgba(255, 255, 255, 0.5)'; ctx.shadowBlur = 8;
            ctx.beginPath();
            responseCurve.forEach((point, index) => {
                const x = freqToX(point.frequency, width);
                const y = dbToY(point.magnitudeDB, height);
                if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        
        if(bands) {
            bands.forEach((band, index) => {
                if (!band || !band.active) return;
                const x = freqToX(band.frequency, width);
                const y = dbToY(band.gain, height);
                const isActive = index === activeBandIndex || index === draggedBand?.index;
                if (isActive) { ctx.beginPath(); ctx.arc(x, y, NODE_HIT_RADIUS, 0, 2 * Math.PI); ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; ctx.fill(); }
                ctx.beginPath(); ctx.arc(x, y, 8, 0, 2 * Math.PI); ctx.fillStyle = getGainColor(band.gain); ctx.fill();
            });
        }
        animationFrameId = requestAnimationFrame(drawLoop);
    };

    drawLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [canvasDims]); // Bu effect SADECE boyutlar değiştiğinde yeniden başlar.

  const findBandAtPosition = useCallback((mouseX, mouseY) => {
    return drawDataRef.current.bands.findIndex(band => {
        if (!band || !band.active) return false;
        const bandX = freqToX(band.frequency, canvasDims.width);
        const bandY = dbToY(band.gain, canvasDims.height);
        return Math.hypot(mouseX - bandX, mouseY - bandY) < NODE_HIT_RADIUS;
    });
  }, [canvasDims]);

  const handleMouseDown = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const hitIndex = findBandAtPosition(mouseX, mouseY);

    if (hitIndex !== -1) {
        e.preventDefault(); e.stopPropagation();

        const band = drawDataRef.current.bands[hitIndex];
        drawDataRef.current.draggedBand = { index: hitIndex, startY: mouseY, startQ: band.q };

        const handleDragMove = (moveEvent) => {
            const currentRect = containerRef.current?.getBoundingClientRect();
            if (!currentRect) return;

            const currentMouseX = moveEvent.clientX - currentRect.left;
            const currentMouseY = moveEvent.clientY - currentRect.top;
            
            // Sadece REF'i güncelle, RENDER TETİKLENMEZ!
            const { bands, draggedBand } = drawDataRef.current;
            const bandToUpdate = bands[draggedBand.index];
            
            let updatedBand = { ...bandToUpdate };
            if (moveEvent.altKey) {
                const deltaY = (draggedBand.startY - currentMouseY) * Q_SENSITIVITY;
                updatedBand.q = Math.max(0.1, Math.min(18, draggedBand.startQ + deltaY));
            } else {
                updatedBand.frequency = xToFreq(currentMouseX, currentRect.width);
                updatedBand.gain = yToDb(currentMouseY, currentRect.height);
            }
            const updatedBands = [...bands];
            updatedBands[draggedBand.index] = updatedBand;
            
            drawDataRef.current.bands = updatedBands;
            drawDataRef.current.responseCurve = EQCalculations.generateResponseCurve(updatedBands, SAMPLE_RATE, 150);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            // Sadece şimdi, bittiğinde, global store'u güncelle.
            onChange('bands', [...drawDataRef.current.bands]);
            drawDataRef.current.draggedBand = null;
        };

        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
  }, [findBandAtPosition, onChange]);

  const handleMouseMove = useCallback((e) => {
    if (drawDataRef.current.draggedBand) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const freq = xToFreq(mouseX, rect.width);
    const db = yToDb(mouseY, rect.height);
    const activeIndex = findBandAtPosition(mouseX, mouseY);
    setTooltip({ visible: true, x: mouseX, y: mouseY, freq, db, activeIndex });
    drawDataRef.current.activeBandIndex = activeIndex;
  }, [canvasDims.width, findBandAtPosition]);
  
  const handleMouseLeave = useCallback(() => {
    setTooltip(t => ({...t, visible: false, activeIndex: -1}));
    drawDataRef.current.activeBandIndex = -1;
  }, []);

  const handleWheel = useCallback((e) => {
      const activeIndex = drawDataRef.current.activeBandIndex;
      if (activeIndex !== -1) {
          e.preventDefault();
          const band = drawDataRef.current.bands[activeIndex];
          if(!band) return;
          const changeAmount = -e.deltaY * Q_SENSITIVITY;
          const newQ = band.q + changeAmount * (band.q * 0.5 + 0.1);
          const clampedQ = Math.max(0.1, Math.min(18, newQ));
          
          const updatedBands = [...drawDataRef.current.bands];
          updatedBands[activeIndex] = { ...band, q: clampedQ };
          
          drawDataRef.current.bands = updatedBands;
          drawDataRef.current.responseCurve = EQCalculations.generateResponseCurve(updatedBands, SAMPLE_RATE, 150);
          onChange('bands', updatedBands);
      }
  }, [onChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const handleDoubleClick = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const hitIndex = findBandAtPosition(mouseX, mouseY);
    const currentBands = drawDataRef.current.bands;

    let updatedBands;
    if (hitIndex !== -1) {
        updatedBands = currentBands.filter((_, i) => i !== hitIndex);
    } else {
        const newFreq = xToFreq(mouseX, rect.width);
        const newGain = yToDb(mouseY, rect.height);
        const newBand = { id: `band-${Date.now()}`, type: 'peaking', frequency: newFreq, gain: newGain, q: 1.5, active: true };
        updatedBands = [...currentBands, newBand];
    }
    
    drawDataRef.current.bands = updatedBands;
    drawDataRef.current.responseCurve = EQCalculations.generateResponseCurve(updatedBands, SAMPLE_RATE, 150);
    onChange('bands', updatedBands);
  }, [onChange, findBandAtPosition]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
      <div
        ref={containerRef}
        className="w-full h-full relative cursor-crosshair touch-none bg-gray-900 rounded-lg border border-white/10"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        {tooltip.visible && !drawDataRef.current.draggedBand && (
          <div
            className="absolute bg-black/80 text-white text-xs rounded p-1.5 pointer-events-none shadow-lg backdrop-blur-sm"
            style={{ left: tooltip.x + 15, top: tooltip.y + 15 }}
          >
            <div className="font-bold">{Math.round(tooltip.freq)} Hz</div>
            <div className="text-gray-400">{tooltip.db.toFixed(1)} dB</div>
            {tooltip.activeIndex !== -1 && drawDataRef.current.bands[tooltip.activeIndex] && (
              <div className="text-cyan-400 mt-1">Q: {drawDataRef.current.bands[tooltip.activeIndex].q.toFixed(2)}</div>
            )}
          </div>
        )}
      </div>
       <div className="flex justify-center gap-4 text-xs text-gray-400">
        <span>• Sürükle: Freq/Gain</span>
        <span>• Alt+Sürükle: Q</span>
        <span>• Tekerlek: Q</span>
        <span>• Çift Tıkla: Ekle/Sil</span>
      </div>
    </div>
  );
};