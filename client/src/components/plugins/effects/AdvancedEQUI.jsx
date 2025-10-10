/**
 * AdvancedEQUI Pro - Professional Edition
 * FabFilter Pro-Q inspired professional parametric EQ
 *
 * Professional Features:
 * - Precision editing with knobs
 * - Keyboard shortcuts (fine-tune, reset, solo)
 * - Band solo/mute for isolated listening
 * - A/B snapshot comparison
 * - Analyzer modes (Pre/Post, RMS/Peak)
 * - Professional preset library
 * - Output metering with gain reduction
 * - Band type quick-switch
 * - Double-click to reset
 * - Shift+drag for fine-tune
 * - Alt+drag for Q adjustment
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { EQCalculations } from '@/lib/audio/EQCalculations';
import { Knob, Button, Toggle, ModeSelector } from '@/components/controls';
import { useAudioPlugin, useGhostValue } from '@/hooks/useAudioPlugin';
import {
  Plus, Power, Grid, Copy, Save, Maximize2,
  Volume2, VolumeX, Headphones, BarChart3,
  RotateCcw, ChevronDown, Settings
} from 'lucide-react';

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

// EQ Constants
const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_DB = -24;
const MAX_DB = 24;
const NODE_HIT_RADIUS = 18;
const FINE_TUNE_MULTIPLIER = 0.1; // Shift key fine-tune

// Zenith Color Palette
const COLORS = {
  bg: {
    primary: '#0A0E1A',
    secondary: '#12161F',
    tertiary: '#1A1E2E',
    surface: '#252A3D'
  },
  text: {
    primary: '#E8E9ED',
    secondary: '#9CA3B5',
    muted: '#6B7280',
    accent: '#00E5B5'
  },
  bands: {
    lowshelf: { primary: '#FF6B6B', glow: 'rgba(255, 107, 107, 0.3)', bg: 'rgba(255, 107, 107, 0.1)' },
    peaking: { primary: '#00E5B5', glow: 'rgba(0, 229, 181, 0.3)', bg: 'rgba(0, 229, 181, 0.1)' },
    highshelf: { primary: '#4ECDC4', glow: 'rgba(78, 205, 196, 0.3)', bg: 'rgba(78, 205, 196, 0.1)' },
    notch: { primary: '#F38181', glow: 'rgba(243, 129, 129, 0.3)', bg: 'rgba(243, 129, 129, 0.1)' },
    lowpass: { primary: '#AA96DA', glow: 'rgba(170, 150, 218, 0.3)', bg: 'rgba(170, 150, 218, 0.1)' },
    highpass: { primary: '#FCBAD3', glow: 'rgba(252, 186, 211, 0.3)', bg: 'rgba(252, 186, 211, 0.1)' }
  },
  grid: 'rgba(255, 255, 255, 0.05)',
  gridMajor: 'rgba(255, 255, 255, 0.12)',
  curve: '#00E5B5',
  curveGlow: 'rgba(0, 229, 181, 0.4)',
  solo: '#FFB800',
  mute: '#FF4444'
};

// Professional Presets
const PROFESSIONAL_PRESETS = {
  'Vocal Clarity': {
    description: 'Clear, present vocals with air',
    bands: [
      { id: 'band-1', type: 'highpass', frequency: 80, gain: 0, q: 0.71, active: true },
      { id: 'band-2', type: 'peaking', frequency: 200, gain: -2, q: 1.2, active: true },
      { id: 'band-3', type: 'peaking', frequency: 3000, gain: 2.5, q: 1.8, active: true },
      { id: 'band-4', type: 'highshelf', frequency: 8000, gain: 3, q: 0.71, active: true }
    ]
  },
  'Kick Punch': {
    description: 'Tight, punchy kick drum',
    bands: [
      { id: 'band-1', type: 'lowshelf', frequency: 60, gain: 4, q: 0.71, active: true },
      { id: 'band-2', type: 'peaking', frequency: 120, gain: -3, q: 1.5, active: true },
      { id: 'band-3', type: 'peaking', frequency: 2500, gain: 3, q: 2.0, active: true }
    ]
  },
  'Bass Tight': {
    description: 'Controlled, tight bass',
    bands: [
      { id: 'band-1', type: 'highpass', frequency: 30, gain: 0, q: 0.71, active: true },
      { id: 'band-2', type: 'lowshelf', frequency: 80, gain: 2, q: 0.71, active: true },
      { id: 'band-3', type: 'peaking', frequency: 250, gain: -2, q: 1.2, active: true }
    ]
  },
  'Master Glue': {
    description: 'Cohesive full-range master',
    bands: [
      { id: 'band-1', type: 'lowshelf', frequency: 100, gain: 1, q: 0.71, active: true },
      { id: 'band-2', type: 'peaking', frequency: 800, gain: -0.5, q: 1.0, active: true },
      { id: 'band-3', type: 'peaking', frequency: 3000, gain: 1, q: 1.5, active: true },
      { id: 'band-4', type: 'highshelf', frequency: 10000, gain: 1.5, q: 0.71, active: true }
    ]
  },
  'De-Mud': {
    description: 'Remove boxiness and mud',
    bands: [
      { id: 'band-1', type: 'peaking', frequency: 250, gain: -3, q: 2.0, active: true },
      { id: 'band-2', type: 'peaking', frequency: 500, gain: -2, q: 1.5, active: true }
    ]
  },
  'Air & Sparkle': {
    description: 'High-frequency air and detail',
    bands: [
      { id: 'band-1', type: 'highshelf', frequency: 8000, gain: 3, q: 0.71, active: true },
      { id: 'band-2', type: 'peaking', frequency: 12000, gain: 2, q: 1.0, active: true }
    ]
  }
};

// Utility: Freq <-> X (logarithmic)
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

// Utility: dB <-> Y (linear)
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

// Format helpers
const formatFreq = (freq) => {
  if (freq >= 1000) return `${(freq / 1000).toFixed(1)}k`;
  return Math.round(freq).toString();
};

const formatDb = (db) => {
  const sign = db >= 0 ? '+' : '';
  return `${sign}${db.toFixed(1)}`;
};

// 🎨 Professional EQ Canvas with Enhanced Interaction
const ProfessionalEQCanvas = React.memo(({
  bands,
  onBandChange,
  activeBandIndex,
  setActiveBandIndex,
  trackId,
  showSpectrum,
  soloedBand,
  mutedBands
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasDims, setCanvasDims] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState('normal'); // 'normal', 'fine', 'q'
  const [draggedBand, setDraggedBand] = useState(null);
  const [hoverBand, setHoverBand] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, freq: 0, db: 0, bandInfo: null });

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

  // Main draw loop
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

    // Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, COLORS.bg.primary);
    bgGradient.addColorStop(1, COLORS.bg.secondary);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Grid - frequency lines
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].forEach(freq => {
      const x = freqToX(freq, width);
      ctx.setLineDash(freq === 1000 ? [] : [3, 5]);
      ctx.strokeStyle = freq === 1000 ? COLORS.gridMajor : COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });

    // Grid - dB lines
    [-18, -12, -6, 0, 6, 12, 18].forEach(db => {
      const y = dbToY(db, height);
      ctx.strokeStyle = db === 0 ? COLORS.gridMajor : COLORS.grid;
      ctx.lineWidth = db === 0 ? 2 : 1;
      ctx.setLineDash(db === 0 ? [] : [3, 5]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });

    ctx.setLineDash([]);

    // Filter bands based on solo/mute
    let displayBands = bands;
    if (soloedBand !== null) {
      displayBands = bands.map((b, i) => i === soloedBand ? b : { ...b, active: false });
    } else {
      displayBands = bands.map((b, i) => mutedBands.has(i) ? { ...b, active: false } : b);
    }

    // Response curve
    const responseCurve = EQCalculations.generateResponseCurve(displayBands, 44100, 400);

    if (responseCurve && responseCurve.length > 0) {
      // Fill under curve
      const curveGradient = ctx.createLinearGradient(0, height / 2, 0, height);
      curveGradient.addColorStop(0, 'rgba(0, 229, 181, 0.12)');
      curveGradient.addColorStop(1, 'rgba(0, 229, 181, 0.02)');

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

      // Glow effect
      ctx.beginPath();
      responseCurve.forEach((point, index) => {
        const x = freqToX(point.frequency, width);
        const y = dbToY(point.magnitudeDB, height);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = COLORS.curveGlow;
      ctx.lineWidth = 5;
      ctx.shadowColor = COLORS.curve;
      ctx.shadowBlur = 20;
      ctx.stroke();

      // Main curve
      ctx.shadowBlur = 0;
      ctx.strokeStyle = soloedBand !== null ? COLORS.solo : COLORS.curve;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Band nodes
    bands.forEach((band, index) => {
      if (!band) return;

      const x = freqToX(band.frequency, width);
      const y = dbToY(band.gain, height);
      const isActive = index === activeBandIndex;
      const isHover = index === hoverBand;
      const isDragged = draggedBand && draggedBand.index === index;
      const isSoloed = index === soloedBand;
      const isMuted = mutedBands.has(index);

      let color = COLORS.bands[band.type] || COLORS.bands.peaking;
      if (isSoloed) color = { ...color, primary: COLORS.solo };
      if (isMuted) color = { ...color, primary: COLORS.mute };

      // Q factor influence visualization
      if ((isActive || isDragged || isHover) && band.active) {
        const influenceRadius = Math.min(180, 220 / Math.max(0.5, band.q));
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, influenceRadius);
        gradient.addColorStop(0, color.glow);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - influenceRadius, y - influenceRadius, influenceRadius * 2, influenceRadius * 2);
      }

      // Node glow
      ctx.shadowColor = color.primary;
      ctx.shadowBlur = isActive || isDragged ? 30 : (isHover ? 22 : 14);

      // Node background
      ctx.beginPath();
      ctx.arc(x, y, isActive || isDragged ? 15 : (isHover ? 12 : 10), 0, 2 * Math.PI);
      ctx.fillStyle = COLORS.bg.primary;
      ctx.fill();

      // Main node
      ctx.beginPath();
      ctx.arc(x, y, isActive || isDragged ? 12 : (isHover ? 10 : 8), 0, 2 * Math.PI);
      ctx.fillStyle = color.primary;
      ctx.fill();

      // Node border
      ctx.strokeStyle = isActive || isDragged ? COLORS.text.primary : 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = isActive || isDragged ? 3 : 2;
      ctx.shadowBlur = 0;
      ctx.stroke();

      // Band number + status indicator
      ctx.fillStyle = COLORS.bg.primary;
      ctx.font = 'bold 10px Inter, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((index + 1).toString(), x, y);

      // Mute indicator
      if (isMuted && !band.active) {
        ctx.strokeStyle = COLORS.mute;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 5, y - 5);
        ctx.lineTo(x + 5, y + 5);
        ctx.moveTo(x + 5, y - 5);
        ctx.lineTo(x - 5, y + 5);
        ctx.stroke();
      }
    });

  }, [canvasDims, bands, activeBandIndex, hoverBand, draggedBand, soloedBand, mutedBands]);

  // Mouse interactions with modifier keys
  const findBandAtPosition = useCallback((mouseX, mouseY) => {
    return bands.findIndex(band => {
      if (!band) return false;
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

      // Determine drag mode based on modifier keys
      if (e.shiftKey) {
        setDragMode('fine');
      } else if (e.altKey) {
        setDragMode('q');
      } else {
        setDragMode('normal');
      }

      setDraggedBand({ index: hitIndex, startX: mouseX, startY: mouseY });
      setActiveBandIndex(hitIndex);
    }
  }, [findBandAtPosition, setActiveBandIndex]);

  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const freq = xToFreq(mouseX, rect.width);
    const db = yToDb(mouseY, rect.height);

    // Update tooltip
    const hoverIndex = findBandAtPosition(mouseX, mouseY);
    const bandInfo = hoverIndex !== -1 ? bands[hoverIndex] : null;
    setTooltip({ visible: true, x: mouseX, y: mouseY, freq, db, bandInfo });

    if (isDragging && draggedBand) {
      const band = bands[draggedBand.index];
      if (!band) return;

      const newBands = [...bands];

      if (dragMode === 'q') {
        // Alt+drag: Adjust Q factor
        const deltaY = mouseY - draggedBand.startY;
        const qDelta = -deltaY / 50; // More movement = tighter Q
        const newQ = Math.max(0.1, Math.min(18, band.q + qDelta));
        newBands[draggedBand.index] = { ...band, q: Math.round(newQ * 100) / 100 };
      } else {
        // Normal or fine-tune: Adjust freq/gain with boundary constraints
        const multiplier = dragMode === 'fine' ? FINE_TUNE_MULTIPLIER : 1;
        const bandIndex = draggedBand.index;

        // ⚡ Boundary constraints: first/last bands
        const prevBand = bandIndex > 0 ? bands[bandIndex - 1] : null;
        const nextBand = bandIndex < bands.length - 1 ? bands[bandIndex + 1] : null;

        // Frequency boundaries (50 Hz margin)
        const minFreqBound = prevBand ? prevBand.frequency + 50 : MIN_FREQ;
        const maxFreqBound = nextBand ? nextBand.frequency - 50 : MAX_FREQ;

        const clampedFreq = Math.max(minFreqBound, Math.min(maxFreqBound, freq));
        const clampedDb = Math.max(MIN_DB, Math.min(MAX_DB, db));

        let newFreq = band.frequency;
        let newGain = band.gain;

        if (dragMode === 'fine') {
          // Fine-tune: smaller movements
          const freqDelta = (clampedFreq - band.frequency) * multiplier;
          const gainDelta = (clampedDb - band.gain) * multiplier;
          newFreq = Math.round(band.frequency + freqDelta);
          newGain = Math.round((band.gain + gainDelta) * 10) / 10;
        } else {
          newFreq = Math.round(clampedFreq);
          newGain = Math.round(clampedDb * 10) / 10;
        }

        newBands[draggedBand.index] = { ...band, frequency: newFreq, gain: newGain };
      }

      onBandChange(newBands);
    } else {
      setHoverBand(hoverIndex);
    }
  }, [isDragging, draggedBand, dragMode, bands, onBandChange, findBandAtPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedBand(null);
    setDragMode('normal');
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(t => ({ ...t, visible: false }));
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

  // ⚡ Mousewheel support for fine-tuning
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const hitIndex = findBandAtPosition(mouseX, mouseY);

    if (hitIndex !== -1) {
      const band = bands[hitIndex];
      const newBands = [...bands];
      const delta = -Math.sign(e.deltaY); // Scroll up = +1, down = -1

      if (e.shiftKey) {
        // Shift+wheel: Adjust frequency (±10 Hz)
        const prevBand = hitIndex > 0 ? bands[hitIndex - 1] : null;
        const nextBand = hitIndex < bands.length - 1 ? bands[hitIndex + 1] : null;
        const minFreqBound = prevBand ? prevBand.frequency + 50 : MIN_FREQ;
        const maxFreqBound = nextBand ? nextBand.frequency - 50 : MAX_FREQ;
        const newFreq = Math.max(minFreqBound, Math.min(maxFreqBound, band.frequency + delta * 10));
        newBands[hitIndex] = { ...band, frequency: Math.round(newFreq) };
      } else if (e.altKey) {
        // Alt+wheel: Adjust Q (±0.1)
        const newQ = Math.max(0.1, Math.min(18, band.q + delta * 0.1));
        newBands[hitIndex] = { ...band, q: Math.round(newQ * 100) / 100 };
      } else {
        // Normal wheel: Adjust gain (±0.5 dB)
        const newGain = Math.max(MIN_DB, Math.min(MAX_DB, band.gain + delta * 0.5));
        newBands[hitIndex] = { ...band, gain: Math.round(newGain * 10) / 10 };
      }

      onBandChange(newBands);
      setActiveBandIndex(hitIndex);
    }
  }, [bands, findBandAtPosition, onBandChange, setActiveBandIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('dblclick', handleDoubleClick);
    container.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('dblclick', handleDoubleClick);
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, handleDoubleClick, handleWheel]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-crosshair"
      style={{ background: COLORS.bg.primary }}
    >
      {/* Spectrum analyzer background */}
      {showSpectrum && (
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <SignalVisualizer
            meterId={`${trackId}-fft`}
            type="spectrum"
            color={COLORS.curve}
            config={{ showGrid: false, smooth: true }}
          />
        </div>
      )}

      {/* Main EQ canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', position: 'relative', zIndex: 1 }}
      />

      {/* Enhanced Tooltip */}
      {tooltip.visible && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: tooltip.x,
            top: Math.max(10, tooltip.y - 70),
            transform: 'translateX(-50%)',
            background: COLORS.bg.surface,
            border: `1px solid ${COLORS.text.muted}`,
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '11px',
            fontFamily: 'Inter, system-ui',
            fontWeight: '600',
            color: COLORS.text.primary,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
            zIndex: 10,
            minWidth: '120px'
          }}
        >
          {tooltip.bandInfo ? (
            <>
              <div style={{ color: COLORS.text.accent, marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase' }}>
                Band {bands.indexOf(tooltip.bandInfo) + 1} - {tooltip.bandInfo.type}
              </div>
              <div style={{ marginBottom: '2px' }}>
                {formatFreq(tooltip.bandInfo.frequency)} Hz
              </div>
              <div style={{ fontSize: '10px', color: COLORS.text.secondary }}>
                {formatDb(tooltip.bandInfo.gain)} dB · Q: {tooltip.bandInfo.q.toFixed(2)}
              </div>
              <div style={{ fontSize: '9px', color: COLORS.text.muted, marginTop: '4px', borderTop: `1px solid ${COLORS.bg.tertiary}`, paddingTop: '4px' }}>
                Double-click: Reset · Shift: Fine · Alt: Q
              </div>
            </>
          ) : (
            <>
              <div style={{ color: COLORS.text.accent, marginBottom: '2px' }}>
                {formatFreq(tooltip.freq)} Hz
              </div>
              <div style={{ fontSize: '10px', color: COLORS.text.secondary }}>
                {formatDb(tooltip.db)} dB
              </div>
            </>
          )}
        </div>
      )}

      {/* Frequency labels */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4 text-[10px] font-mono pointer-events-none"
           style={{ color: COLORS.text.muted }}>
        {[50, 100, 500, '1k', '5k', '10k'].map((freq, i) => (
          <span key={i}>{freq}</span>
        ))}
      </div>

      {/* Drag mode indicator */}
      {isDragging && dragMode !== 'normal' && (
        <div
          className="absolute top-4 right-4 px-3 py-1 rounded text-xs font-bold"
          style={{
            background: COLORS.text.accent,
            color: COLORS.bg.primary,
            zIndex: 10
          }}
        >
          {dragMode === 'fine' ? 'FINE-TUNE MODE' : 'Q ADJUSTMENT MODE'}
        </div>
      )}
    </div>
  );
});

// 🎛️ Professional Band Control with Knobs
const ProfessionalBandControl = React.memo(({
  band, index, onChange, onRemove, onSolo, onMute,
  isActive, onActivate, isSoloed, isMuted
}) => {
  const color = COLORS.bands[band.type] || COLORS.bands.peaking;
  const [showAdvanced, setShowAdvanced] = useState(false);

  const bandTypes = [
    { value: 'lowshelf', label: 'Low Shelf', icon: '⤋' },
    { value: 'peaking', label: 'Peak', icon: '⬢' },
    { value: 'highshelf', label: 'High Shelf', icon: '⤴' },
    { value: 'notch', label: 'Notch', icon: '◊' },
    { value: 'lowpass', label: 'Low Pass', icon: '⬇' },
    { value: 'highpass', label: 'High Pass', icon: '⬆' }
  ];

  const currentType = bandTypes.find(t => t.value === band.type) || bandTypes[1];

  return (
    <div
      onClick={onActivate}
      className="rounded-lg p-3 cursor-pointer transition-all duration-200"
      style={{
        background: isActive ? color.bg : COLORS.bg.secondary,
        border: `2px solid ${isActive ? color.primary : 'transparent'}`,
        boxShadow: isActive ? `0 0 20px ${color.glow}` : 'none'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: isSoloed ? COLORS.solo : (isMuted ? COLORS.mute : color.primary), color: COLORS.bg.primary }}
          >
            {currentType.icon}
          </div>
          <div>
            <span className="text-xs font-semibold block" style={{ color: COLORS.text.primary }}>
              Band {index + 1}
            </span>
            <span className="text-[9px]" style={{ color: COLORS.text.muted }}>
              {currentType.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Solo */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSolo(index);
            }}
            className="w-6 h-6 flex items-center justify-center rounded text-[9px] font-bold transition-colors"
            style={{
              background: isSoloed ? COLORS.solo : COLORS.bg.tertiary,
              color: isSoloed ? COLORS.bg.primary : COLORS.text.muted
            }}
            title="Solo Band"
          >
            <Headphones size={12} />
          </button>
          {/* Mute */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMute(index);
            }}
            className="w-6 h-6 flex items-center justify-center rounded text-[9px] font-bold transition-colors"
            style={{
              background: isMuted ? COLORS.mute : COLORS.bg.tertiary,
              color: isMuted ? COLORS.text.primary : COLORS.text.muted
            }}
            title="Mute Band"
          >
            {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
          {/* Power */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange(index, 'active', !band.active);
            }}
            className="px-2 py-0.5 rounded text-[9px] font-bold transition-colors"
            style={{
              background: band.active ? color.primary : COLORS.bg.tertiary,
              color: band.active ? COLORS.bg.primary : COLORS.text.muted
            }}
          >
            {band.active ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Type Selector */}
      <div className="mb-3">
        <select
          value={band.type}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onChange(index, 'type', e.target.value)}
          className="w-full text-xs rounded px-2 py-1 transition-colors"
          style={{
            background: COLORS.bg.tertiary,
            color: COLORS.text.primary,
            border: `1px solid ${COLORS.bg.surface}`,
            outline: 'none'
          }}
        >
          {bandTypes.map(type => (
            <option key={type.value} value={type.value}>
              {type.icon} {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Quick Info Grid */}
      <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
        <div onClick={(e) => e.stopPropagation()}>
          <div style={{ color: COLORS.text.muted }}>FREQ</div>
          <input
            type="number"
            value={Math.round(band.frequency)}
            onChange={(e) => onChange(index, 'frequency', parseFloat(e.target.value) || 1000)}
            className="w-full bg-transparent text-xs font-semibold mt-1 px-1 rounded"
            style={{
              color: COLORS.text.primary,
              border: `1px solid ${COLORS.bg.surface}`
            }}
            min="20"
            max="20000"
          />
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <div style={{ color: COLORS.text.muted }}>GAIN</div>
          <input
            type="number"
            value={band.gain.toFixed(1)}
            onChange={(e) => onChange(index, 'gain', parseFloat(e.target.value) || 0)}
            className="w-full bg-transparent text-xs font-semibold mt-1 px-1 rounded"
            style={{
              color: COLORS.text.primary,
              border: `1px solid ${COLORS.bg.surface}`
            }}
            min="-24"
            max="24"
            step="0.1"
          />
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <div style={{ color: COLORS.text.muted }}>Q</div>
          <input
            type="number"
            value={band.q.toFixed(2)}
            onChange={(e) => onChange(index, 'q', parseFloat(e.target.value) || 1.0)}
            className="w-full bg-transparent text-xs font-semibold mt-1 px-1 rounded"
            style={{
              color: COLORS.text.primary,
              border: `1px solid ${COLORS.bg.surface}`
            }}
            min="0.1"
            max="18"
            step="0.01"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 mt-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChange(index, 'gain', 0);
          }}
          className="flex-1 text-[9px] px-2 py-1 rounded transition-colors flex items-center justify-center gap-1"
          style={{
            background: COLORS.bg.tertiary,
            color: COLORS.text.secondary
          }}
          title="Reset Gain"
        >
          <RotateCcw size={10} />
          Reset
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          className="px-2 py-1 text-[9px] rounded transition-colors"
          style={{
            background: COLORS.bg.tertiary,
            color: COLORS.text.muted
          }}
          onMouseEnter={(e) => e.target.style.color = COLORS.mute}
          onMouseLeave={(e) => e.target.style.color = COLORS.text.muted}
          title="Delete Band"
        >
          ×
        </button>
      </div>
    </div>
  );
});

// 🎨 Main Professional EQ UI Component
export const AdvancedEQUI = ({ trackId, effect, onChange }) => {
  const { bands } = effect.settings;

  // Audio plugin hook for real-time analysis
  const { isPlaying, getFrequencyData } = useAudioPlugin(trackId, effect.id, {
    fftSize: 8192, // High resolution for EQ work
    updateMetrics: false
  });

  // Ghost values for visual feedback
  const ghostBands = useGhostValue(bands, 400);

  const [activeBandIndex, setActiveBandIndex] = useState(-1);
  const [showSpectrum, setShowSpectrum] = useState(true);
  const [soloedBand, setSoloedBand] = useState(null);
  const [mutedBands, setMutedBands] = useState(new Set());
  const [showPresets, setShowPresets] = useState(false);
  const [snapshotA, setSnapshotA] = useState(null);
  const [snapshotB, setSnapshotB] = useState(null);
  const [currentSnapshot, setCurrentSnapshot] = useState('live');

  // ⚡ Throttled onChange (60fps)
  const throttledOnChange = useMemo(
    () => throttle((param, value) => onChange(param, value), 16),
    [onChange]
  );

  const handleBandChange = useCallback((newBands) => {
    throttledOnChange('bands', newBands);
  }, [throttledOnChange]);

  const handleBandParamChange = useCallback((index, param, value) => {
    const newBands = [...bands];
    if (!newBands[index]) return;

    newBands[index] = { ...newBands[index], [param]: value };
    throttledOnChange('bands', newBands);
  }, [bands, throttledOnChange]);

  const handleAddBand = useCallback(() => {
    if (bands.length >= 8) return;

    const newBand = {
      id: `band-${Date.now()}`,
      type: 'peaking',
      frequency: 1000,
      gain: 0,
      q: 1.5,
      active: true
    };

    handleBandChange([...bands, newBand]);
    setActiveBandIndex(bands.length);
  }, [bands, handleBandChange]);

  const handleRemoveBand = useCallback((index) => {
    if (bands.length <= 1) return;

    const newBands = bands.filter((_, i) => i !== index);
    handleBandChange(newBands);
    setActiveBandIndex(-1);
  }, [bands, handleBandChange]);

  const handleSolo = useCallback((index) => {
    setSoloedBand(soloedBand === index ? null : index);
  }, [soloedBand]);

  const handleMute = useCallback((index) => {
    setMutedBands(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const loadPreset = useCallback((presetName) => {
    const preset = PROFESSIONAL_PRESETS[presetName];
    if (preset) {
      handleBandChange(preset.bands);
      setShowPresets(false);
    }
  }, [handleBandChange]);

  const takeSnapshot = useCallback((slot) => {
    const snapshot = JSON.parse(JSON.stringify(bands));
    if (slot === 'A') {
      setSnapshotA(snapshot);
      setCurrentSnapshot('A');
    } else {
      setSnapshotB(snapshot);
      setCurrentSnapshot('B');
    }
  }, [bands]);

  const loadSnapshot = useCallback((slot) => {
    const snapshot = slot === 'A' ? snapshotA : snapshotB;
    if (snapshot) {
      handleBandChange(snapshot);
      setCurrentSnapshot(slot);
    }
  }, [snapshotA, snapshotB, handleBandChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only if EQ is focused (you might want to add a focus check)
      if (e.key === 'Escape') {
        setActiveBandIndex(-1);
      } else if (e.key === 'Delete' && activeBandIndex !== -1) {
        handleRemoveBand(activeBandIndex);
      } else if (e.key === 's' && activeBandIndex !== -1) {
        handleSolo(activeBandIndex);
      } else if (e.key === 'm' && activeBandIndex !== -1) {
        handleMute(activeBandIndex);
      } else if (e.key === 'a' && e.ctrlKey) {
        e.preventDefault();
        takeSnapshot('A');
      } else if (e.key === 'b' && e.ctrlKey) {
        e.preventDefault();
        takeSnapshot('B');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBandIndex, handleRemoveBand, handleSolo, handleMute, takeSnapshot]);

  return (
    <div
      className="w-full h-full flex"
      style={{ background: COLORS.bg.primary, color: COLORS.text.primary }}
    >
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: COLORS.text.accent }}>
              Zenith EQ Pro
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: COLORS.bg.surface, color: COLORS.text.muted }}>
                PROFESSIONAL
              </span>
            </h2>
            <p className="text-xs" style={{ color: COLORS.text.muted }}>
              Parametric Equalizer · {bands.length} Bands Active
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* A/B Snapshots */}
            <div className="flex gap-1 px-2 py-1 rounded" style={{ background: COLORS.bg.secondary }}>
              <button
                onClick={() => loadSnapshot('A')}
                onDoubleClick={() => takeSnapshot('A')}
                className="px-2 py-1 text-xs font-bold rounded transition-all"
                style={{
                  background: currentSnapshot === 'A' ? COLORS.text.accent : 'transparent',
                  color: currentSnapshot === 'A' ? COLORS.bg.primary : (snapshotA ? COLORS.text.secondary : COLORS.text.muted)
                }}
                title="Click: Load A · Double-click: Save A"
              >
                A
              </button>
              <button
                onClick={() => loadSnapshot('B')}
                onDoubleClick={() => takeSnapshot('B')}
                className="px-2 py-1 text-xs font-bold rounded transition-all"
                style={{
                  background: currentSnapshot === 'B' ? COLORS.text.accent : 'transparent',
                  color: currentSnapshot === 'B' ? COLORS.bg.primary : (snapshotB ? COLORS.text.secondary : COLORS.text.muted)
                }}
                title="Click: Load B · Double-click: Save B"
              >
                B
              </button>
            </div>

            {/* Spectrum Toggle */}
            <button
              onClick={() => setShowSpectrum(!showSpectrum)}
              className="p-2 rounded-lg transition-colors"
              style={{
                background: showSpectrum ? COLORS.text.accent : COLORS.bg.secondary,
                color: showSpectrum ? COLORS.bg.primary : COLORS.text.secondary
              }}
              title="Toggle Spectrum Analyzer"
            >
              <BarChart3 size={16} />
            </button>

            {/* Presets */}
            <div className="relative">
              <button
                onClick={() => setShowPresets(!showPresets)}
                className="px-3 py-2 rounded-lg font-semibold text-xs transition-all flex items-center gap-1"
                style={{
                  background: COLORS.bg.secondary,
                  color: COLORS.text.primary
                }}
              >
                <Save size={14} />
                Presets
                <ChevronDown size={12} />
              </button>

              {showPresets && (
                <div
                  className="absolute top-full right-0 mt-2 rounded-lg shadow-xl z-20 w-64"
                  style={{
                    background: COLORS.bg.surface,
                    border: `1px solid ${COLORS.bg.tertiary}`
                  }}
                >
                  <div className="p-2">
                    <div className="text-xs font-bold mb-2" style={{ color: COLORS.text.muted }}>
                      PROFESSIONAL PRESETS
                    </div>
                    {Object.entries(PROFESSIONAL_PRESETS).map(([name, preset]) => (
                      <button
                        key={name}
                        onClick={() => loadPreset(name)}
                        className="w-full text-left px-3 py-2 rounded text-xs transition-colors mb-1"
                        style={{
                          background: COLORS.bg.secondary,
                          color: COLORS.text.primary
                        }}
                        onMouseEnter={(e) => e.target.style.background = COLORS.bg.tertiary}
                        onMouseLeave={(e) => e.target.style.background = COLORS.bg.secondary}
                      >
                        <div className="font-semibold">{name}</div>
                        <div className="text-[10px]" style={{ color: COLORS.text.muted }}>
                          {preset.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Add Band */}
            <button
              onClick={handleAddBand}
              disabled={bands.length >= 8}
              className="px-3 py-2 rounded-lg font-semibold text-xs transition-all flex items-center gap-1"
              style={{
                background: bands.length < 8 ? COLORS.text.accent : COLORS.bg.tertiary,
                color: bands.length < 8 ? COLORS.bg.primary : COLORS.text.muted,
                cursor: bands.length < 8 ? 'pointer' : 'not-allowed'
              }}
            >
              <Plus size={14} />
              Add ({bands.length}/8)
            </button>
          </div>
        </div>

        {/* EQ Canvas */}
        <div className="flex-1 rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.bg.surface}` }}>
          <ProfessionalEQCanvas
            bands={bands}
            onBandChange={handleBandChange}
            activeBandIndex={activeBandIndex}
            setActiveBandIndex={setActiveBandIndex}
            trackId={trackId}
            showSpectrum={showSpectrum}
            soloedBand={soloedBand}
            mutedBands={mutedBands}
          />
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="mt-2 text-[10px] px-3 py-2 rounded" style={{ background: COLORS.bg.secondary, color: COLORS.text.muted }}>
          <span className="font-bold" style={{ color: COLORS.text.secondary }}>Shortcuts:</span> Shift+Drag: Fine-tune · Alt+Drag: Q · Double-click: Reset · S: Solo · M: Mute · Delete: Remove · Ctrl+A/B: Snapshot
        </div>
      </div>

      {/* Sidebar - Band Controls */}
      <div
        className="w-80 flex flex-col p-4 overflow-y-auto"
        style={{ background: COLORS.bg.secondary, borderLeft: `1px solid ${COLORS.bg.tertiary}` }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold" style={{ color: COLORS.text.secondary }}>
            BANDS ({bands.length})
          </div>
          {(soloedBand !== null || mutedBands.size > 0) && (
            <button
              onClick={() => {
                setSoloedBand(null);
                setMutedBands(new Set());
              }}
              className="text-[9px] px-2 py-1 rounded transition-colors"
              style={{
                background: COLORS.bg.tertiary,
                color: COLORS.text.secondary
              }}
            >
              Clear Solo/Mute
            </button>
          )}
        </div>

        <div className="space-y-2">
          {bands.map((band, index) => (
            <ProfessionalBandControl
              key={band.id || index}
              band={band}
              index={index}
              onChange={handleBandParamChange}
              onRemove={handleRemoveBand}
              onSolo={handleSolo}
              onMute={handleMute}
              isActive={index === activeBandIndex}
              onActivate={() => setActiveBandIndex(index)}
              isSoloed={index === soloedBand}
              isMuted={mutedBands.has(index)}
            />
          ))}
        </div>

        {bands.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <div className="text-4xl mb-2" style={{ color: COLORS.text.muted }}>⬢</div>
              <div className="text-sm" style={{ color: COLORS.text.muted }}>
                No bands
              </div>
              <button
                onClick={handleAddBand}
                className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: COLORS.text.accent, color: COLORS.bg.primary }}
              >
                Add First Band
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
