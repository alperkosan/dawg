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
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, freq: 0, db: 0 });
  const [activeBandIndex, setActiveBandIndex] = useState(null);
  const [draggedBand, setDraggedBand] = useState(null);
  
  const responseCurve = useMemo(() => {
    if (!bands || bands.length === 0) return [];
    return EQCalculations.generateResponseCurve(bands, SAMPLE_RATE, 150);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasDims.width === 0 || canvasDims.height === 0) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasDims.width * dpr;
    canvas.height = canvasDims.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const animationFrameId = requestAnimationFrame(function draw() {
        const { width, height } = canvasDims;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(0, 0, width, height);
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
        if (responseCurve.length > 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            responseCurve.forEach((point, index) => {
                const x = freqToX(point.frequency, width);
                const y = dbToY(point.magnitudeDB, height);
                if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        bands.forEach((band, index) => {
            if (!band || !band.active) return;
            const x = freqToX(band.frequency, width);
            const y = dbToY(band.gain, height);
            const isActive = index === activeBandIndex || index === draggedBand?.index;
            if (isActive) {
                ctx.beginPath();
                ctx.arc(x, y, NODE_HIT_RADIUS, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fill();
            }
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.fillStyle = getGainColor(band.gain);
            ctx.fill();
        });
        requestAnimationFrame(draw);
    });

    return () => cancelAnimationFrame(animationFrameId);
  }, [canvasDims, bands, responseCurve, activeBandIndex, draggedBand]);

  const findBandAtPosition = useCallback((mouseX, mouseY) => {
    let hitIndex = -1;
    let minDistance = Infinity;
    if (!bands) return -1;
    bands.forEach((band, index) => {
        if (!band || !band.active) return;
        const bandX = freqToX(band.frequency, canvasDims.width);
        const bandY = dbToY(band.gain, canvasDims.height);
        const distance = Math.hypot(mouseX - bandX, mouseY - bandY);
        if (distance < NODE_HIT_RADIUS && distance < minDistance) {
            minDistance = distance;
            hitIndex = index;
        }
    });
    return hitIndex;
  }, [bands, canvasDims]);
  
  // *** ONARIM BÖLGESİ BAŞLANGICI ***

  // ONARIM: `handleMouseUp` ve `handleDragMove` fonksiyonları artık `useCallback` içinde değil.
  // Bunun yerine, `handleMouseDown` içinde anlık olarak oluşturulacaklar.

  const handleMouseDown = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const hitIndex = findBandAtPosition(mouseX, mouseY);

    if (hitIndex !== -1) {
        const band = bands[hitIndex];
        if (band) {
            e.preventDefault();
            e.stopPropagation();

            const dragStartInfo = { index: hitIndex, startY: mouseY, startQ: band.q };
            setDraggedBand(dragStartInfo);

            // ONARIM: Sürükleme ve bırakma fonksiyonlarını `mousedown` anında burada tanımlıyoruz.
            // Bu, 'stale closure' sorununu tamamen çözer.
            const handleDragMoveForThisInstance = (moveEvent) => {
                // `onChange`'e fonksiyonel bir güncelleme göndererek, `bands`'in
                // en güncel halini kullanmasını sağlıyoruz ve bağımlılıklardan kurtuluyoruz.
                onChange('bands', (prevBands) => {
                    const updatedBands = [...prevBands];
                    const bandToUpdate = updatedBands[dragStartInfo.index];
                    if (!bandToUpdate) return prevBands;

                    const currentMouseX = moveEvent.clientX - rect.left;
                    const currentMouseY = moveEvent.clientY - rect.top;
                    let updatedBand = { ...bandToUpdate };

                    if (moveEvent.altKey) {
                        const deltaY = (dragStartInfo.startY - currentMouseY) * Q_SENSITIVITY;
                        updatedBand.q = Math.max(0.1, Math.min(18, dragStartInfo.startQ + deltaY));
                    } else {
                        updatedBand.frequency = xToFreq(currentMouseX, rect.width);
                        updatedBand.gain = yToDb(currentMouseY, rect.height);
                    }
                    updatedBands[dragStartInfo.index] = updatedBand;
                    return updatedBands;
                });
            };

            const handleMouseUpForThisInstance = () => {
                setDraggedBand(null);
                window.removeEventListener('mousemove', handleDragMoveForThisInstance);
                window.removeEventListener('mouseup', handleMouseUpForThisInstance);
            };

            window.addEventListener('mousemove', handleDragMoveForThisInstance);
            window.addEventListener('mouseup', handleMouseUpForThisInstance);
        }
    }
  }, [bands, findBandAtPosition, onChange]); // Bağımlılıklar artık çok daha basit ve güvenli.

  // *** ONARIM BÖLGESİ SONU ***

  const handleMouseMove = useCallback((e) => {
    if (draggedBand) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const freq = xToFreq(mouseX, rect.width);
    const db = yToDb(mouseY, rect.height);
    setTooltip({ visible: true, x: mouseX, y: mouseY, freq, db });
    setActiveBandIndex(findBandAtPosition(mouseX, mouseY));
  }, [canvasDims.width, findBandAtPosition, draggedBand]);
  
  const handleWheel = useCallback((e) => {
    if (activeBandIndex !== null) {
        e.preventDefault();
        const band = bands[activeBandIndex];
        if (band) {
            const changeAmount = -e.deltaY * Q_SENSITIVITY;
            const newQ = band.q + changeAmount * (band.q * 0.5 + 0.1);
            const clampedQ = Math.max(0.1, Math.min(18, newQ));
            onChange('bands', (prevBands) => {
                const updatedBands = [...prevBands];
                updatedBands[activeBandIndex] = { ...band, q: clampedQ };
                return updatedBands;
            });
        }
    }
  }, [activeBandIndex, bands, onChange]);

  useEffect(() => {
    const containerElement = containerRef.current;
    if (containerElement) {
        containerElement.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
        if (containerElement) {
            containerElement.removeEventListener('wheel', handleWheel);
        }
    };
  }, [handleWheel]);

  const handleDoubleClick = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const hitIndex = findBandAtPosition(mouseX, mouseY);

    if (hitIndex !== -1) {
        onChange('bands', bands.filter((_, i) => i !== hitIndex));
    } else {
        const newFreq = xToFreq(mouseX, rect.width);
        const newGain = yToDb(mouseY, rect.height);
        const newBand = { id: `band-${Date.now()}`, type: 'peaking', frequency: newFreq, gain: newGain, q: 1.5, active: true };
        onChange('bands', [...bands, newBand]);
    }
  }, [bands, onChange, findBandAtPosition]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
      <div
        ref={containerRef}
        className="w-full h-full relative cursor-crosshair touch-none bg-gray-900 rounded-lg border border-white/10"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setTooltip({ visible: false }); setActiveBandIndex(null); }}
        onDoubleClick={handleDoubleClick}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        {tooltip.visible && !draggedBand && (
          <div
            className="absolute bg-black/80 text-white text-xs rounded p-1.5 pointer-events-none shadow-lg backdrop-blur-sm"
            style={{ left: tooltip.x + 15, top: tooltip.y + 15 }}
          >
            <div className="font-bold">{Math.round(tooltip.freq)} Hz</div>
            <div className="text-gray-400">{tooltip.db.toFixed(1)} dB</div>
            {activeBandIndex !== -1 && bands[activeBandIndex] && (
              <div className="text-cyan-400 mt-1">Q: {bands[activeBandIndex].q.toFixed(2)}</div>
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