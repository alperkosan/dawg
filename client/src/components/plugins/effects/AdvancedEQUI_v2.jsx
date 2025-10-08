import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { EQCalculations } from '@/lib/audio/EQCalculations';
import { SignalVisualizer } from '../../common/SignalVisualizer';
import { ProfessionalKnob } from '../container/PluginControls';
import { Plus, Copy, Trash2, Power, Grid, Mic } from 'lucide-react';

// ⚡ Performance utilities
const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Constants
const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_DB = -24;
const MAX_DB = 24;
const NODE_HIT_RADIUS = 18;

// Color palette for different band types
const BAND_COLORS = {
  lowshelf: { primary: '#FF6B6B', glow: 'rgba(255, 107, 107, 0.3)' },
  peaking: { primary: '#4ECDC4', glow: 'rgba(78, 205, 196, 0.3)' },
  highshelf: { primary: '#95E1D3', glow: 'rgba(149, 225, 211, 0.3)' },
  notch: { primary: '#F38181', glow: 'rgba(243, 129, 129, 0.3)' },
  lowpass: { primary: '#AA96DA', glow: 'rgba(170, 150, 218, 0.3)' },
  highpass: { primary: '#FCBAD3', glow: 'rgba(252, 186, 211, 0.3)' }
};

// Utility: Frequency to X position (logarithmic)
const freqToX = (freq, width) => {
  const logFreq = Math.log(freq);
  const logMin = Math.log(MIN_FREQ);
  const logMax = Math.log(MAX_FREQ);
  return ((logFreq - logMin) / (logMax - logMin)) * width;
};

const xToFreq = (x, width) => {
  const pos = x / width;
  const logMin = Math.log(MIN_FREQ);
  const logMax = Math.log(MAX_FREQ);
  return Math.exp(pos * (logMax - logMin) + logMin);
};

// Utility: dB to Y position (linear)
const dbToY = (db, height) => {
  const range = MAX_DB - MIN_DB;
  const percent = (MAX_DB - db) / range;
  return percent * height;
};

const yToDb = (y, height) => {
  const range = MAX_DB - MIN_DB;
  const percent = y / height;
  return MAX_DB - (percent * range);
};

// 🎨 Professional EQ Canvas - Zenith Style
const ProfessionalEQCanvas = React.memo(({
  bands,
  onBandChange,
  activeBandIndex,
  setActiveBandIndex,
  trackId,
  showSpectrum = true
}) => {
  const canvasRef = useRef(null);
  const spectrumCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasDims, setCanvasDims] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedBand, setDraggedBand] = useState(null);
  const [hoverBand, setHoverBand] = useState(null);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setCanvasDims({ width, height });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw EQ curve and nodes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasDims.width === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasDims.width * dpr;
    canvas.height = canvasDims.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const { width, height } = canvasDims;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background gradient - Zenith dark
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(10, 15, 30, 0.95)');
    bgGradient.addColorStop(1, 'rgba(20, 25, 40, 0.95)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Grid - subtle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    // Frequency grid lines
    [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].forEach(freq => {
      const x = freqToX(freq, width);
      ctx.setLineDash(freq === 1000 ? [] : [2, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });

    // dB grid lines
    [-18, -12, -6, 0, 6, 12, 18].forEach(db => {
      const y = dbToY(db, height);
      ctx.strokeStyle = db === 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = db === 0 ? 2 : 1;
      ctx.setLineDash(db === 0 ? [] : [2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });

    ctx.setLineDash([]);

    // Generate and draw response curve
    const responseCurve = EQCalculations.generateResponseCurve(bands, 44100, 300);

    if (responseCurve && responseCurve.length > 0) {
      // Gradient fill under curve
      const curveGradient = ctx.createLinearGradient(0, height / 2, 0, height);
      curveGradient.addColorStop(0, 'rgba(78, 205, 196, 0.15)');
      curveGradient.addColorStop(1, 'rgba(78, 205, 196, 0.02)');

      ctx.beginPath();
      responseCurve.forEach((point, index) => {
        const x = freqToX(point.frequency, width);
        const y = dbToY(point.magnitudeDB, height);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = curveGradient;
      ctx.fill();

      // Main curve - glow effect
      ctx.beginPath();
      responseCurve.forEach((point, index) => {
        const x = freqToX(point.frequency, width);
        const y = dbToY(point.magnitudeDB, height);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(78, 205, 196, 0.4)';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#4ECDC4';
      ctx.shadowBlur = 15;
      ctx.stroke();

      // Main curve - solid
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#4ECDC4';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Draw EQ bands
    bands.forEach((band, index) => {
      if (!band || !band.active) return;

      const x = freqToX(band.frequency, width);
      const y = dbToY(band.gain, height);
      const isActive = index === activeBandIndex;
      const isHover = index === hoverBand;
      const isDragged = draggedBand && draggedBand.index === index;

      const color = BAND_COLORS[band.type] || BAND_COLORS.peaking;

      // Influence visualization (Q factor)
      if (isActive || isDragged || isHover) {
        const influenceRadius = Math.min(150, 200 / Math.max(0.5, band.q));
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, influenceRadius);
        gradient.addColorStop(0, color.glow);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - influenceRadius, y - influenceRadius, influenceRadius * 2, influenceRadius * 2);
      }

      // Node glow
      ctx.shadowColor = color.primary;
      ctx.shadowBlur = isActive || isDragged ? 25 : (isHover ? 18 : 10);

      // Node background
      ctx.beginPath();
      ctx.arc(x, y, isActive || isDragged ? 12 : (isHover ? 10 : 8), 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(10, 15, 30, 0.9)';
      ctx.fill();

      // Main node
      ctx.beginPath();
      ctx.arc(x, y, isActive || isDragged ? 10 : (isHover ? 8 : 6), 0, 2 * Math.PI);
      ctx.fillStyle = color.primary;
      ctx.fill();

      // Node border
      ctx.strokeStyle = isActive || isDragged ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = isActive || isDragged ? 2.5 : 1.5;
      ctx.shadowBlur = 0;
      ctx.stroke();

      // Band number
      if (isActive || isHover || isDragged) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px Inter, system-ui';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 4;
        ctx.fillText((index + 1).toString(), x, y + 4);
        ctx.shadowBlur = 0;
      }
    });

  }, [canvasDims, bands, activeBandIndex, hoverBand, draggedBand]);

  // Mouse interactions
  const findBandAtPosition = useCallback((mouseX, mouseY) => {
    return bands.findIndex(band => {
      if (!band || !band.active) return false;
      const bandX = freqToX(band.frequency, canvasDims.width);
      const bandY = dbToY(band.gain, canvasDims.height);
      return Math.hypot(mouseX - bandX, mouseY - bandY) < NODE_HIT_RADIUS;
    });
  }, [bands, canvasDims]);

  const handleMouseDown = useCallback((e) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const hitIndex = findBandAtPosition(mouseX, mouseY);

    if (hitIndex !== -1) {
      setIsDragging(true);
      setDraggedBand({ index: hitIndex });
      setActiveBandIndex(hitIndex);
    }
  }, [findBandAtPosition, setActiveBandIndex]);

  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging && draggedBand) {
      const freq = Math.max(MIN_FREQ, Math.min(MAX_FREQ, xToFreq(mouseX, rect.width)));
      const gain = Math.max(MIN_DB, Math.min(MAX_DB, yToDb(mouseY, rect.height)));

      const newBands = [...bands];
      newBands[draggedBand.index] = {
        ...newBands[draggedBand.index],
        frequency: Math.round(freq),
        gain: Math.round(gain * 10) / 10
      };
      onBandChange(newBands);
    } else {
      const hoverIndex = findBandAtPosition(mouseX, mouseY);
      setHoverBand(hoverIndex);
    }
  }, [isDragging, draggedBand, bands, onBandChange, findBandAtPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedBand(null);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverBand(null);
    setIsDragging(false);
    setDraggedBand(null);
  }, []);

  const handleDoubleClick = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const hitIndex = findBandAtPosition(mouseX, mouseY);

    if (hitIndex !== -1) {
      // Reset band gain to 0
      const newBands = [...bands];
      newBands[hitIndex] = { ...newBands[hitIndex], gain: 0 };
      onBandChange(newBands);
    }
  }, [bands, findBandAtPosition, onBandChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('dblclick', handleDoubleClick);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('dblclick', handleDoubleClick);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, handleDoubleClick]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-crosshair"
      style={{ background: 'rgba(10, 15, 30, 0.5)' }}
    >
      {/* Spectrum analyzer background (optional) */}
      {showSpectrum && (
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <SignalVisualizer
            meterId={`${trackId}-fft`}
            type="spectrum"
            color="#4ECDC4"
            config={{ showGrid: false, smooth: true }}
          />
        </div>
      )}

      {/* Main EQ canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', position: 'relative', zIndex: 1 }}
      />

      {/* Frequency labels */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4 text-xs font-mono text-white/40 pointer-events-none">
        {[50, 100, 500, '1k', '5k', '10k', '20k'].map((freq, i) => (
          <span key={i}>{freq}</span>
        ))}
      </div>
    </div>
  );
});

// 🎛️ Compact Band Control - Zen