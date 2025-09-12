import React, { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { MeteringService } from '../../lib/core/MeteringService';
import { PresetManager } from '../PresetManager'; // Preset yöneticisini import et

// --- YARDIMCI FONKSİYONLAR VE SABİTLER ---
const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_DB = -18;
const MAX_DB = 18;
const NODE_HIT_RADIUS = 10;
const GAIN_VISUAL_MULTIPLIER = 3;
const Q_SENSITIVITY = 0.005;
const ALT_DRAG_Q_SENSITIVITY = 0.02;
const SAMPLE_RATE = 44100;

// --- MATEMATİKSEL DÖNÜŞÜM FONKSİYONLARI ---
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
const getGainAtFrequency = (band, targetFreq) => {
    if (!band.active) return 0;
    const { frequency, gain, q, type } = band;
    const normalizedDistance = Math.abs(Math.log2(targetFreq / frequency));
    switch (type) {
        case 'peaking': { const effect = Math.max(0, 1 - normalizedDistance * q); return gain * effect * effect; }
        case 'lowshelf': { if (targetFreq <= frequency) return gain; const falloff = 1 + Math.log10(targetFreq / frequency) * q; return gain / falloff; }
        case 'highshelf': { if (targetFreq >= frequency) return gain; const falloff = 1 + Math.log10(frequency / targetFreq) * q; return gain / falloff; }
        default: return 0;
    }
};
const getGainColor = (gain) => {
    if (gain <= 0) return '#38bdf8';
    const hue = Math.max(0, 60 - (gain * GAIN_VISUAL_MULTIPLIER));
    return `hsl(${hue}, 100%, 55%)`;
};


export const AdvancedEQUI = ({ effect, onChange, trackId, definition}) => {
  const { bands } = effect.settings;
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);

  // --- STATE'LER: Sadece React'in render'ı tetiklemesi gereken veriler ---
  const [canvasDims, setCanvasDims] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, freq: 0, db: 0 });
  const [activeBandIndex, setActiveBandIndex] = useState(null); 
  const [draggedBand, setDraggedBand] = useState(null);

  // --- VERİ KÖPRÜSÜ (REF BRIDGE): Animasyon döngüsünün en güncel veriye anında erişimini sağlar ---
  const bandsRef = useRef(bands);
  const activeBandIndexRef = useRef(activeBandIndex);
  const draggedBandRef = useRef(draggedBand);
  const tooltipRef = useRef(tooltip);
  const lastFftDataRef = useRef(null);

  // State her değiştiğinde, ilgili Ref'i de anında güncelle
  useEffect(() => { bandsRef.current = bands; }, [bands]);
  useEffect(() => { activeBandIndexRef.current = activeBandIndex; }, [activeBandIndex]);
  useEffect(() => { draggedBandRef.current = draggedBand; }, [draggedBand]);
  useEffect(() => { tooltipRef.current = tooltip; }, [tooltip]);

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
  
  // --- ANA ÇİZİM DÖNGÜSÜ: Sadece bir kez kurulur ve sürekli, render'dan bağımsız çalışır ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasDims.width === 0) return;
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
        const currentBands = bandsRef.current;
        const currentActiveBandIndex = activeBandIndexRef.current;
        const currentDraggedBand = draggedBandRef.current;
        const currentTooltip = tooltipRef.current;
        const lastFftData = lastFftDataRef.current;
        
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, width, height);

        // Arka Plan Izgarası
        const gridColor = 'rgba(255, 255, 255, 0.05)';
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        [30, 100, 300, 1000, 3000, 10000].forEach(f => {
            const x = freqToX(f, width);
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        });
        [-12, -6, 0, 6, 12].forEach(db => {
            const y = dbToY(db, height);
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        });

        // Canlı Spektrum Analizörü
        if (lastFftData) {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let x = 0; x < width; x++) {
                const freq = xToFreq(x, width);
                const index = Math.round((freq / (SAMPLE_RATE / 2)) * lastFftData.length);
                if (index < lastFftData.length) {
                    const db = lastFftData[index];
                    const y = dbToY(db, height);
                    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }

        // Aktif Bandın Q Eğrisini Çiz
        if (currentActiveBandIndex !== null && !currentDraggedBand) {
            const activeBand = currentBands[currentActiveBandIndex];
            ctx.strokeStyle = getGainColor(activeBand.gain) + '80';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let x = 0; x < width; x++) {
                const freq = xToFreq(x, width);
                const gain = getGainAtFrequency(activeBand, freq);
                const y = dbToY(gain, height);
                if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Birleşik EQ Eğrisini ve Dolgusunu Çiz
        const zeroDbY = dbToY(0, height);
        const curvePath = new Path2D();
        for (let x = 0; x < width; x++) {
            const freq = xToFreq(x, width);
            let totalGain = 0;
            currentBands.forEach(band => { totalGain += getGainAtFrequency(band, freq); });
            const y = dbToY(totalGain, height);
            if (x === 0) curvePath.moveTo(x, y); else curvePath.lineTo(x, y);
        }
        const fillPath = new Path2D(curvePath);
        fillPath.lineTo(width, zeroDbY);
        fillPath.lineTo(0, zeroDbY);
        fillPath.closePath();
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(56, 189, 248, 0.2)');
        ctx.fillStyle = gradient;
        ctx.fill(fillPath);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 8;
        ctx.stroke(curvePath);
        ctx.shadowBlur = 0;

        // Kontrol Noktalarını Çiz
        currentBands.forEach((band, index) => {
            if (!band.active) return;
            const x = freqToX(band.frequency, width);
            const y = dbToY(band.gain, height);
            const color = getGainColor(band.gain);
            const isActive = index === currentActiveBandIndex || index === currentDraggedBand?.index;
            if(isActive) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.beginPath(); ctx.arc(x, y, NODE_HIT_RADIUS * 1.5, 0, 2 * Math.PI); ctx.fill();
            }
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(x, y, 8, 0, 2 * Math.PI); ctx.fill();
            ctx.fillStyle = '#111827';
            ctx.beginPath(); ctx.arc(x, y, 4, 0, 2 * Math.PI); ctx.fill();
        });
        
        if (currentTooltip.visible) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1 / dpr;
            ctx.beginPath();
            ctx.moveTo(currentTooltip.x, 0);
            ctx.lineTo(currentTooltip.x, height);
            ctx.stroke();
        }
    };
    
    const animationLoop = () => {
        draw();
        animationFrameRef.current = requestAnimationFrame(animationLoop);
    };
    animationLoop();

    return () => {
      MeteringService.unsubscribe(meterId, handleDataUpdate);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [canvasDims, trackId, effect.id]);

  // --- EVENT HANDLER'LAR: Kullanıcı etkileşimini yakalar ve `onChange` ile dış dünyaya bildirir ---

  const handleDragMove = useCallback((e) => {
    const dragInfo = draggedBandRef.current;
    if (!dragInfo) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (e.altKey) {
        const deltaY = (dragInfo.startY - mouseY) * ALT_DRAG_Q_SENSITIVITY;
        const newQ = Math.max(0.1, Math.min(18, dragInfo.startQ + deltaY));
        onChange(`bands.${dragInfo.index}.q`, newQ);
    } else {
        const newFreq = xToFreq(mouseX, rect.width);
        const newGain = yToDb(mouseY, rect.height);
        onChange(`bands.${dragInfo.index}.frequency`, newFreq);
        onChange(`bands.${dragInfo.index}.gain`, newGain);
    }
  }, [onChange]);

  const handleMouseUp = useCallback(() => {
    setDraggedBand(null);
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleDragMove]);

  const handleMouseDown = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    let hitIndex = -1;
    let minDistance = Infinity;
    bandsRef.current.forEach((band, index) => {
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
        setDraggedBand({ 
            index: hitIndex, 
            startY: mouseY, 
            startQ: bandsRef.current[hitIndex].q
        });
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
  }, [canvasDims, handleDragMove, handleMouseUp]);

  const handleMouseMove = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const freq = xToFreq(mouseX, rect.width);
    const db = yToDb(mouseY, rect.height);
    setTooltip({ visible: true, x: mouseX, y: mouseY, freq, db });
    let hitIndex = -1;
    let minDistance = Infinity;
    bandsRef.current.forEach((band, index) => {
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
  }, [canvasDims]);

  const handleWheel = useCallback((e) => {
    const currentActiveBandIndex = activeBandIndexRef.current;
    if (currentActiveBandIndex !== null) {
        e.preventDefault();
        const band = bandsRef.current[currentActiveBandIndex];
        const changeAmount = -e.deltaY * Q_SENSITIVITY;
        const newQ = band.q + changeAmount * (band.q * 0.5 + 0.1);
        const clampedQ = Math.max(0.1, Math.min(18, newQ));
        onChange(`bands.${currentActiveBandIndex}.q`, clampedQ);
    }
  }, [onChange]);

  const handleDoubleClick = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    let hitIndex = -1;
    let minDistance = Infinity;
    bandsRef.current.forEach((band, index) => {
        const bandX = freqToX(band.frequency, canvasDims.width);
        const bandY = dbToY(band.gain, canvasDims.height);
        const distance = Math.hypot(mouseX - bandX, mouseY - bandY);
        if (distance < NODE_HIT_RADIUS && distance < minDistance) {
            minDistance = distance;
            hitIndex = index;
        }
    });
    if (hitIndex !== -1) {
        const newBands = bandsRef.current.filter((_, i) => i !== hitIndex);
        onChange('bands', newBands);
    } else {
        const newFreq = xToFreq(mouseX, rect.width);
        const newBand = { id: Date.now(), type: 'peaking', frequency: newFreq, gain: 0, q: 1.5, active: true };
        onChange('bands', [...bandsRef.current, newBand]);
    }
  }, [onChange, canvasDims]);

  useEffect(() => {
    const containerElement = containerRef.current;
    if (containerElement) {
        containerElement.addEventListener('wheel', handleWheel, { passive: false });
        return () => { containerElement.removeEventListener('wheel', handleWheel); };
    }
  }, [handleWheel]);

  return (
    <div className="relative w-full h-full p-4 bg-gray-800 rounded-lg flex flex-col gap-4 border border-gray-700
                    bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-700/50 to-gray-800">
    <PresetManager 
      pluginType={definition.type} 
      effect={effect} // Efektin tüm verisini gönderiyoruz
      factoryPresets={definition.presets} 
      onChange={onChange}
    />
      <div 
        ref={containerRef}
        className="flex-grow w-full bg-gray-900 rounded border border-gray-700 relative cursor-crosshair touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setTooltip({visible: false}); setActiveBandIndex(null); }}
        onDoubleClick={handleDoubleClick}
      >
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          {tooltip.visible && (
            <div 
                className="absolute bg-gray-950 text-white text-xs rounded p-1.5 pointer-events-none shadow-lg"
                style={{ left: tooltip.x + 15, top: tooltip.y + 15 }}
            >
                <div className="font-bold">{Math.round(tooltip.freq)} Hz</div>
                <div className="text-gray-400">{tooltip.db.toFixed(1)} dB</div>
                {activeBandIndex !== null && bands[activeBandIndex] && (
                    <div className="text-cyan-400 mt-1">
                      Q: {bands[activeBandIndex].q.toFixed(2)}
                    </div>
                )}
            </div>
          )}
      </div>
      <div className="flex justify-center gap-4 text-xs text-gray-400">
        <span>• Çift Tıkla: Ekle/Sil</span>
        <span>• Sürükle: Freq/Gain</span>
        <span>• Alt+Sürükle: Q</span>
        <span>• Tekerlek: Q</span>
      </div>
    </div>
  );
};

