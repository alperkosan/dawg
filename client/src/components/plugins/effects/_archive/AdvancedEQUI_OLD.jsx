/**
 * AdvancedEQUI - Zenith Edition
 * Modern, minimalist, FabFilter Pro-Q inspired EQ interface
 *
 * Design Philosophy:
 * - Dark theme (Zenith palette)
 * - Clean, spacious layout
 * - Interactive visual feedback
 * - Professional workflow
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { EQCalculations } from '@/lib/audio/EQCalculations';
import { SignalVisualizer } from '../../common/SignalVisualizer';
import { Plus, Power, Grid, Copy, Save, Maximize2 } from 'lucide-react';

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
const NODE_HIT_RADIUS = 16;

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
  curveGlow: 'rgba(0, 229, 181, 0.4)'
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

// Format frequency for display
const formatFreq = (freq) => {
  if (freq >= 1000) return `${(freq / 1000).toFixed(1)}k`;
  return Math.round(freq).toString();
};

// Format dB for display
const formatDb = (db) => {
  const sign = db >= 0 ? '+' : '';
  return `${sign}${db.toFixed(1)}`;
};

// 🎨 Professional EQ Canvas - Zenith Style
const ZenithEQCanvas = React.memo(({
  bands,
  onBandChange,
  activeBandIndex,
  setActiveBandIndex,
  trackId,
  showSpectrum = true
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasDims, setCanvasDims] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedBand, setDraggedBand] = useState(null);
  const [hoverBand, setHoverBand] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, freq: 0, db: 0 });

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

    // Response curve
    const responseCurve = EQCalculations.generateResponseCurve(bands, 44100, 400);

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
      ctx.strokeStyle = COLORS.curve;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Band nodes
    bands.forEach((band, index) => {
      if (!band || !band.active) return;

      const x = freqToX(band.frequency, width);
      const y = dbToY(band.gain, height);
      const isActive = index === activeBandIndex;
      const isHover = index === hoverBand;
      const isDragged = draggedBand && draggedBand.index === index;

      const color = COLORS.bands[band.type] || COLORS.bands.peaking;

      // Q factor influence visualization
      if (isActive || isDragged || isHover) {
        const influenceRadius = Math.min(180, 220 / Math.max(0.5, band.q));
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, influenceRadius);
        gradient.addColorStop(0, color.glow);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - influenceRadius, y - influenceRadius, influenceRadius * 2, influenceRadius * 2);
      }

      // Node glow
      ctx.shadowColor = color.primary;
      ctx.shadowBlur = isActive || isDragged ? 28 : (isHover ? 20 : 12);

      // Node background
      ctx.beginPath();
      ctx.arc(x, y, isActive || isDragged ? 14 : (isHover ? 11 : 9), 0, 2 * Math.PI);
      ctx.fillStyle = COLORS.bg.primary;
      ctx.fill();

      // Main node
      ctx.beginPath();
      ctx.arc(x, y, isActive || isDragged ? 11 : (isHover ? 9 : 7), 0, 2 * Math.PI);
      ctx.fillStyle = color.primary;
      ctx.fill();

      // Node border
      ctx.strokeStyle = isActive || isDragged ? COLORS.text.primary : 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = isActive || isDragged ? 3 : 2;
      ctx.shadowBlur = 0;
      ctx.stroke();

      // Band number (always visible)
      ctx.fillStyle = COLORS.bg.primary;
      ctx.font = 'bold 10px Inter, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((index + 1).toString(), x, y);
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
    const freq = xToFreq(mouseX, rect.width);
    const db = yToDb(mouseY, rect.height);

    // Update tooltip
    setTooltip({ visible: true, x: mouseX, y: mouseY, freq, db });

    if (isDragging && draggedBand) {
      const clampedFreq = Math.max(MIN_FREQ, Math.min(MAX_FREQ, freq));
      const clampedDb = Math.max(MIN_DB, Math.min(MAX_DB, db));

      const newBands = [...bands];
      newBands[draggedBand.index] = {
        ...newBands[draggedBand.index],
        frequency: Math.round(clampedFreq),
        gain: Math.round(clampedDb * 10) / 10
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

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: tooltip.x,
            top: Math.max(10, tooltip.y - 50),
            transform: 'translateX(-50%)',
            background: COLORS.bg.surface,
            border: `1px solid ${COLORS.text.muted}`,
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '11px',
            fontFamily: 'Inter, system-ui',
            fontWeight: '600',
            color: COLORS.text.primary,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
            zIndex: 10
          }}
        >
          <div style={{ color: COLORS.text.accent, marginBottom: '2px' }}>
            {formatFreq(tooltip.freq)} Hz
          </div>
          <div style={{ fontSize: '10px', color: COLORS.text.secondary }}>
            {formatDb(tooltip.db)} dB
          </div>
        </div>
      )}

      {/* Frequency labels */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4 text-[10px] font-mono pointer-events-none"
           style={{ color: COLORS.text.muted }}>
        {[50, 100, 500, '1k', '5k', '10k'].map((freq, i) => (
          <span key={i}>{freq}</span>
        ))}
      </div>
    </div>
  );
});

// 🎛️ Compact Band Control - Zenith Edition
const ZenithBandControl = React.memo(({ band, index, onChange, onRemove, isActive, onActivate }) => {
  const color = COLORS.bands[band.type] || COLORS.bands.peaking;

  const typeIcons = {
    lowshelf: '⤋',
    peaking: '⬢',
    highshelf: '⤴',
    notch: '◊',
    lowpass: '⬇',
    highpass: '⬆'
  };

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
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: color.primary, color: COLORS.bg.primary }}
          >
            {typeIcons[band.type] || index + 1}
          </div>
          <span className="text-xs font-semibold" style={{ color: COLORS.text.primary }}>
            Band {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-1">
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(index);
            }}
            className="w-5 h-5 flex items-center justify-center rounded text-sm transition-colors"
            style={{ color: COLORS.text.muted }}
            onMouseEnter={(e) => e.target.style.color = '#FF6B6B'}
            onMouseLeave={(e) => e.target.style.color = COLORS.text.muted}
          >
            ×
          </button>
        </div>
      </div>

      {/* Quick info */}
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <div style={{ color: COLORS.text.muted }}>FREQ</div>
          <div style={{ color: COLORS.text.primary, fontWeight: '600' }}>
            {formatFreq(band.frequency)}
          </div>
        </div>
        <div>
          <div style={{ color: COLORS.text.muted }}>GAIN</div>
          <div style={{ color: COLORS.text.primary, fontWeight: '600' }}>
            {formatDb(band.gain)}
          </div>
        </div>
        <div>
          <div style={{ color: COLORS.text.muted }}>Q</div>
          <div style={{ color: COLORS.text.primary, fontWeight: '600' }}>
            {band.q.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
});

// 🎨 Main Zenith EQ UI Component
export const AdvancedEQUI = ({ trackId, effect, onChange }) => {
  const { bands } = effect.settings;
  const [activeBandIndex, setActiveBandIndex] = useState(-1);
  const [showSpectrum, setShowSpectrum] = useState(true);

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
            <h2 className="text-xl font-bold" style={{ color: COLORS.text.accent }}>
              Zenith EQ
            </h2>
            <p className="text-xs" style={{ color: COLORS.text.muted }}>
              Professional Parametric Equalizer
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSpectrum(!showSpectrum)}
              className="p-2 rounded-lg transition-colors"
              style={{
                background: showSpectrum ? COLORS.text.accent : COLORS.bg.secondary,
                color: showSpectrum ? COLORS.bg.primary : COLORS.text.secondary
              }}
              title="Toggle Spectrum"
            >
              <Grid size={16} />
            </button>
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
              Add Band ({bands.length}/8)
            </button>
          </div>
        </div>

        {/* EQ Canvas */}
        <div className="flex-1 rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.bg.surface}` }}>
          <ZenithEQCanvas
            bands={bands}
            onBandChange={handleBandChange}
            activeBandIndex={activeBandIndex}
            setActiveBandIndex={setActiveBandIndex}
            trackId={trackId}
            showSpectrum={showSpectrum}
          />
        </div>
      </div>

      {/* Sidebar - Band Controls */}
      <div
        className="w-72 flex flex-col p-4 overflow-y-auto"
        style={{ background: COLORS.bg.secondary, borderLeft: `1px solid ${COLORS.bg.tertiary}` }}
      >
        <div className="text-xs font-bold mb-3" style={{ color: COLORS.text.secondary }}>
          BANDS ({bands.length})
        </div>

        <div className="space-y-2">
          {bands.map((band, index) => (
            <ZenithBandControl
              key={band.id || index}
              band={band}
              index={index}
              onChange={handleBandParamChange}
              onRemove={handleRemoveBand}
              isActive={index === activeBandIndex}
              onActivate={() => setActiveBandIndex(index)}
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
