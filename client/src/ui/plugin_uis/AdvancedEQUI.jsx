import React, { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { MeteringService } from '../../lib/core/MeteringService';
import { PluginTypography } from '../plugin_system/PluginDesignSystem';

// --- Yardımcı Fonksiyonlar (Değişiklik yok) ---
const MIN_FREQ = 20; const MAX_FREQ = 20000; const MIN_DB = -18; const MAX_DB = 18;
const NODE_HIT_RADIUS = 10; const Q_SENSITIVITY = 0.005; const ALT_DRAG_Q_SENSITIVITY = 0.02;
const SAMPLE_RATE = 44100;
const freqToX = (freq, width) => { if (width === 0) return 0; const logFreq = Math.log(freq); const logMin = Math.log(MIN_FREQ); const logMax = Math.log(MAX_FREQ); const pos = (logFreq - logMin) / (logMax - logMin); return pos * width; };
const xToFreq = (x, width) => { if (width === 0) return MIN_FREQ; const pos = x / width; const logMin = Math.log(MIN_FREQ); const logMax = Math.log(MAX_FREQ); const logFreq = pos * (logMax - logMin) + logMin; return Math.exp(logFreq); };
const dbToY = (db, height) => { if (height === 0) return 0; const range = MAX_DB - MIN_DB; const percent = (db - MIN_DB) / range; return (1 - Math.max(0, Math.min(1, percent))) * height; };
const yToDb = (y, height) => { if (height === 0) return MIN_DB; const range = MAX_DB - MIN_DB; const percent = 1 - (y / height); return percent * range + MIN_DB; };
const getGainAtFrequency = (band, targetFreq) => { if (!band.active) return 0; const { frequency, gain, q, type } = band; const normalizedDistance = Math.abs(Math.log2(targetFreq / frequency)); switch (type) { case 'peaking': { const effect = Math.max(0, 1 - normalizedDistance * q); return gain * effect * effect; } case 'lowshelf': { if (targetFreq <= frequency) return gain; const falloff = 1 + Math.log10(targetFreq / frequency) * q; return gain / falloff; } case 'highshelf': { if (targetFreq >= frequency) return gain; const falloff = 1 + Math.log10(frequency / targetFreq) * q; return gain / falloff; } default: return 0; } };
const getGainColor = (gain) => { if (gain <= 0) return '#38bdf8'; const hue = Math.max(0, 60 - (gain * 3)); return `hsl(${hue}, 100%, 55%)`; };


export const AdvancedEQUI = ({ trackId, effect, onChange, definition }) => {
  const { bands } = effect.settings;
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [canvasDims, setCanvasDims] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, freq: 0, db: 0 });
  const [activeBandIndex, setActiveBandIndex] = useState(null);
  
  // *** ONARIM: Sürükleme durumu için artık state yerine ref kullanıyoruz. ***
  // Bu, callback'lerin her render'da yeniden oluşmasını engeller ve event listener'ların
  // doğru şekilde kaldırılmasını garanti eder.
  const draggedBandRef = useRef(null);
  const lastFftDataRef = useRef(null);
  
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
  
  // *** ONARIM: Çizim döngüsünü basitleştirildi ve sadece gerekli bağımlılıklara bağlandı. ***
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasDims.width === 0) return;
    // ... (çizimle ilgili diğer kodlar aynı kalabilir)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasDims.width * dpr;
    canvas.height = canvasDims.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    
    const meterId = `${trackId}-${effect.id}-fft`;
    const handleDataUpdate = (fftData) => { lastFftDataRef.current = fftData; };
    MeteringService.subscribe(meterId, handleDataUpdate);

    const draw = () => {
        const { width, height } = canvasDims;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; ctx.lineWidth = 1;
        [30, 100, 300, 1000, 3000, 10000].forEach(f => { const x = freqToX(f, width); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); });
        [-12, -6, 0, 6, 12].forEach(db => { const y = dbToY(db, height); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); });
        if (lastFftDataRef.current) {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)'; ctx.lineWidth = 1.5; ctx.beginPath();
            for (let x = 0; x < width; x++) {
                const freq = xToFreq(x, width);
                const index = Math.round((freq / (SAMPLE_RATE / 2)) * lastFftDataRef.current.length);
                if (index < lastFftDataRef.current.length) { const db = lastFftDataRef.current[index]; const y = dbToY(db, height); if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
            }
            ctx.stroke();
        }
        const zeroDbY = dbToY(0, height); const curvePath = new Path2D();
        for (let x = 0; x < width; x++) { const freq = xToFreq(x, width); let totalGain = 0; bands.forEach(band => { totalGain += getGainAtFrequency(band, freq); }); const y = dbToY(totalGain, height); if (x === 0) curvePath.moveTo(x, y); else curvePath.lineTo(x, y); }
        const fillPath = new Path2D(curvePath); fillPath.lineTo(width, zeroDbY); fillPath.lineTo(0, zeroDbY); fillPath.closePath();
        const gradient = ctx.createLinearGradient(0, 0, 0, height); gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)'); gradient.addColorStop(1, 'rgba(56, 189, 248, 0.2)'); ctx.fillStyle = gradient; ctx.fill(fillPath);
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.shadowColor = 'rgba(255, 255, 255, 0.5)'; ctx.shadowBlur = 8; ctx.stroke(curvePath); ctx.shadowBlur = 0;
        bands.forEach((band, index) => { if (!band.active) return; const x = freqToX(band.frequency, width); const y = dbToY(band.gain, height); const color = getGainColor(band.gain); const isActive = index === activeBandIndex || index === draggedBandRef.current?.index; if(isActive) { ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; ctx.beginPath(); ctx.arc(x, y, NODE_HIT_RADIUS * 1.5, 0, 2 * Math.PI); ctx.fill(); } ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 8, 0, 2 * Math.PI); ctx.fill(); ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 2 * Math.PI); ctx.fill(); });
    };

    const animationLoop = () => { draw(); animationFrameRef.current = requestAnimationFrame(animationLoop); };
    animationLoop();
    return () => { MeteringService.unsubscribe(meterId, handleDataUpdate); if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [canvasDims, trackId, effect.id, bands, activeBandIndex]);

  // *** ONARIM: Tüm etkileşim fonksiyonları, ref'leri ve state'leri doğru kullanacak şekilde yeniden düzenlendi. ***
  const handleMouseDown = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let hitIndex = -1;
    let minDistance = Infinity;
    bands.forEach((band, index) => {
        if (!band.active) return;
        const bandX = freqToX(band.frequency, canvasDims.width);
        const bandY = dbToY(band.gain, canvasDims.height);
        const distance = Math.hypot(mouseX - bandX, mouseY - bandY);
        if (distance < NODE_HIT_RADIUS && distance < minDistance) {
            minDistance = distance;
            hitIndex = index;
        }
    });

    if (hitIndex !== -1) {
        e.preventDefault();
        e.stopPropagation();
        draggedBandRef.current = { index: hitIndex, startY: mouseY, startQ: bands[hitIndex].q };

        const handleDragMove = (moveEvent) => {
            if (!draggedBandRef.current) return;
            const moveMouseX = moveEvent.clientX - rect.left;
            const moveMouseY = moveEvent.clientY - rect.top;
            if (moveEvent.altKey) {
                const deltaY = (draggedBandRef.current.startY - moveMouseY) * ALT_DRAG_Q_SENSITIVITY;
                const newQ = Math.max(0.1, Math.min(18, draggedBandRef.current.startQ + deltaY));
                onChange(`bands.${draggedBandRef.current.index}.q`, newQ);
            } else {
                const newFreq = xToFreq(moveMouseX, rect.width);
                const newGain = yToDb(moveMouseY, rect.height);
                onChange(`bands.${draggedBandRef.current.index}.frequency`, newFreq);
                onChange(`bands.${draggedBandRef.current.index}.gain`, newGain);
            }
        };

        const handleMouseUp = () => {
            draggedBandRef.current = null;
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
        
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
  }, [bands, canvasDims, onChange]);

  const handleMouseMove = useCallback((e) => {
    if (draggedBandRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const freq = xToFreq(mouseX, rect.width);
    const db = yToDb(mouseY, rect.height);
    setTooltip({ visible: true, x: mouseX, y: mouseY, freq, db });
    let hitIndex = -1;
    let minDistance = Infinity;
    bands.forEach((band, index) => {
        if (!band.active) return;
        const bandX = freqToX(band.frequency, canvasDims.width);
        const bandY = dbToY(band.gain, canvasDims.height);
        const distance = Math.hypot(mouseX - bandX, mouseY - bandY);
        if (distance < NODE_HIT_RADIUS && distance < minDistance) {
            minDistance = distance;
            hitIndex = index;
        }
    });
    setActiveBandIndex(hitIndex !== -1 ? hitIndex : null);
  }, [bands, canvasDims]);

  const handleMouseLeave = useCallback(() => {
    setTooltip({ visible: false });
    setActiveBandIndex(null);
  }, []);

  const handleWheel = useCallback((e) => {
    if (activeBandIndex !== null) {
        e.preventDefault();
        const band = bands[activeBandIndex];
        const changeAmount = -e.deltaY * Q_SENSITIVITY;
        const newQ = band.q + changeAmount * (band.q * 0.5 + 0.1);
        const clampedQ = Math.max(0.1, Math.min(18, newQ));
        onChange(`bands.${activeBandIndex}.q`, clampedQ);
    }
  }, [onChange, activeBandIndex, bands]);

  const handleDoubleClick = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    let hitIndex = -1;
    let minDistance = Infinity;
    bands.forEach((band, index) => {
        const bandX = freqToX(band.frequency, canvasDims.width);
        const bandY = dbToY(band.gain, canvasDims.height);
        const distance = Math.hypot(mouseX - bandX, mouseY - bandY);
        if (distance < NODE_HIT_RADIUS && distance < minDistance) {
            minDistance = distance;
            hitIndex = index;
        }
    });
    if (hitIndex !== -1) {
        const newBands = bands.filter((_, i) => i !== hitIndex);
        onChange('bands', newBands); // Toplu güncelleme
    } else {
        const newFreq = xToFreq(mouseX, rect.width);
        const newBand = { id: Date.now(), type: 'peaking', frequency: newFreq, gain: 0, q: 1.5, active: true };
        onChange('bands', [...bands, newBand]); // Toplu güncelleme
    }
  }, [onChange, canvasDims, bands]);

  useEffect(() => {
    const containerElement = containerRef.current;
    if (containerElement) {
        containerElement.addEventListener('wheel', handleWheel, { passive: false });
        return () => { containerElement.removeEventListener('wheel', handleWheel); };
    }
  }, [handleWheel]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <div 
        ref={containerRef}
        className="flex-grow w-full bg-gray-900 rounded border border-white/10 relative cursor-crosshair touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
      >
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          {tooltip.visible && !draggedBandRef.current && (
            <div 
                className="absolute bg-black/80 text-white text-xs rounded p-1.5 pointer-events-none shadow-lg backdrop-blur-sm"
                style={{ left: tooltip.x + 15, top: tooltip.y + 15 }}
            >
                <div className="font-bold">{Math.round(tooltip.freq)} Hz</div>
                <div className="text-white/70">{tooltip.db.toFixed(1)} dB</div>
                {activeBandIndex !== null && bands[activeBandIndex] && (
                    <div className="text-blue-400 mt-1">
                      Q: {bands[activeBandIndex].q.toFixed(2)}
                    </div>
                )}
            </div>
          )}
      </div>
      <div className="flex justify-center gap-4" style={{...PluginTypography.description}}>
        <span>• Çift Tıkla: Ekle/Sil</span>
        <span>• Sürükle: Freq/Gain</span>
        <span>• Alt+Sürükle: Q</span>
        <span>• Tekerlek: Q</span>
      </div>
    </div>
  );
};

