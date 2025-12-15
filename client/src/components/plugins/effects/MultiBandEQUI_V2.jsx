/**
 * MULTIBAND EQ UI V2.0
 *
 * Professional parametric equalizer with WebGL spectrum analyzer
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout
 * ✅ WebGL Spectrum Analyzer
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming (spectral-weave)
 * ✅ Performance optimization with RAF batching
 *
 * Features:
 * - Interactive EQ curve visualization
 * - Up to 20 bands (any filter type)
 * - Real-time spectrum analyzer (WebGL)
 * - Band solo/mute
 * - Keyboard shortcuts
 * - Professional factory presets
 * - A/B comparison (via PluginContainerV2)
 * - Undo/Redo (via PluginContainerV2)
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob } from '@/components/controls/base/Knob';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useWebGLSpectrum } from '@/services/WebGLSpectrumAnalyzer';
import { EQCalculations } from '@/lib/audio/EQCalculations.js';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { useMixerStore } from '@/store/useMixerStore';
import {
  Plus, Volume2, VolumeX, Headphones,
  Trash2, Power, Settings
} from 'lucide-react';
import { Checkbox } from '@/components/controls';

// Constants
const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_DB = -24;
const MAX_DB = 24;
const NODE_HIT_RADIUS = 18;
const FINE_TUNE_MULTIPLIER = 0.1;

// Filter types
const FILTER_TYPES = [
  { value: 'highpass', label: 'HPF' },
  { value: 'lowpass', label: 'LPF' },
  { value: 'lowshelf', label: 'Low Shelf' },
  { value: 'highshelf', label: 'High Shelf' },
  { value: 'peaking', label: 'Peak' },
  { value: 'notch', label: 'Notch' }
];

/**
 * FREQUENCY/DB CONVERSION HELPERS
 */
const freqToX = (freq, width) => {
  const minLog = Math.log10(MIN_FREQ);
  const maxLog = Math.log10(MAX_FREQ);
  const freqLog = Math.log10(Math.max(MIN_FREQ, Math.min(MAX_FREQ, freq)));
  return ((freqLog - minLog) / (maxLog - minLog)) * width;
};

const xToFreq = (x, width) => {
  const minLog = Math.log10(MIN_FREQ);
  const maxLog = Math.log10(MAX_FREQ);
  const ratio = x / width;
  const freqLog = minLog + ratio * (maxLog - minLog);
  return Math.pow(10, freqLog);
};

const dbToY = (db, height) => {
  const ratio = (db - MIN_DB) / (MAX_DB - MIN_DB);
  return height - (ratio * height);
};

const yToDb = (y, height) => {
  const ratio = 1 - (y / height);
  return MIN_DB + ratio * (MAX_DB - MIN_DB);
};

/**
 * BAND CONTROL COMPONENT
 */
const BandControl = ({
  band,
  index,
  onChange,
  onRemove,
  onSolo,
  onMute,
  isActive,
  onActivate,
  isSoloed,
  isMuted,
  categoryColors
}) => {
  const bandColor = useMemo(() => {
    const colorMap = {
      lowshelf: '#FF6B6B',
      peaking: categoryColors.primary,
      highshelf: '#4ECDC4',
      notch: '#F38181',
      lowpass: '#AA96DA',
      highpass: '#FCBAD3'
    };
    return colorMap[band.type] || categoryColors.primary;
  }, [band.type, categoryColors.primary]);

  return (
    <div
      className="eq-band-control"
      onClick={onActivate}
      style={{
        background: isActive ? `${bandColor}15` : 'rgba(255, 255, 255, 0.03)',
        borderLeft: `3px solid ${isActive ? bandColor : 'transparent'}`,
        padding: '12px',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        marginBottom: '8px'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: band.active ? bandColor : 'rgba(255, 255, 255, 0.2)',
              boxShadow: band.active ? `0 0 8px ${bandColor}` : 'none'
            }}
          />
          <span className="text-xs font-semibold" style={{ color: '#E8E9ED' }}>
            Band {index + 1}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Solo */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSolo(index);
            }}
            className="px-2 py-1 rounded text-[9px] font-bold transition-all"
            style={{
              background: isSoloed ? '#FFB800' : 'rgba(255, 255, 255, 0.05)',
              color: isSoloed ? '#000' : '#9CA3B5',
              border: `1px solid ${isSoloed ? '#FFB800' : 'transparent'}`
            }}
            title="Solo band"
          >
            S
          </button>

          {/* Mute */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMute(index);
            }}
            className="px-2 py-1 rounded text-[9px] font-bold transition-all"
            style={{
              background: isMuted ? '#FF4444' : 'rgba(255, 255, 255, 0.05)',
              color: isMuted ? '#fff' : '#9CA3B5',
              border: `1px solid ${isMuted ? '#FF4444' : 'transparent'}`
            }}
            title="Mute band"
          >
            M
          </button>

          {/* Power */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange(index, 'active', !band.active);
            }}
            className="p-1 rounded transition-all"
            style={{
              background: band.active ? `${bandColor}30` : 'rgba(255, 255, 255, 0.05)',
              color: band.active ? bandColor : '#6B7280'
            }}
            title="Enable/disable band"
          >
            <Power size={12} />
          </button>

          {/* Remove */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(index);
            }}
            className="p-1 rounded transition-all hover:bg-red-500/20"
            style={{ color: '#6B7280' }}
            title="Remove band"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Type Selector */}
      <select
        value={band.type}
        onChange={(e) => onChange(index, 'type', e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="w-full mb-3 px-2 py-1 rounded text-xs"
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          border: `1px solid ${bandColor}40`,
          color: '#E8E9ED'
        }}
      >
        {FILTER_TYPES.map(type => (
          <option key={type.value} value={type.value}>{type.label}</option>
        ))}
      </select>

      {/* Parameters */}
      <div className="grid grid-cols-3 gap-2">
        {/* Frequency */}
        <div className="text-center">
          <div className="text-[9px] text-gray-400 mb-1">FREQ</div>
          <div className="text-xs font-mono" style={{ color: bandColor }}>
            {band.frequency >= 1000
              ? `${(band.frequency / 1000).toFixed(1)}k`
              : `${Math.round(band.frequency)}`
            }
          </div>
        </div>

        {/* Gain (only for peaking, shelves, notch) */}
        {(band.type === 'peaking' || band.type === 'lowshelf' || band.type === 'highshelf' || band.type === 'notch') && (
          <div className="text-center">
            <div className="text-[9px] text-gray-400 mb-1">GAIN</div>
            <div
              className="text-xs font-mono"
              style={{
                color: band.gain > 0 ? '#4ECDC4' : band.gain < 0 ? '#FF6B6B' : '#9CA3B5'
              }}
            >
              {band.gain > 0 ? '+' : ''}{band.gain.toFixed(1)} dB
            </div>
          </div>
        )}

        {/* Q */}
        <div className="text-center">
          <div className="text-[9px] text-gray-400 mb-1">Q</div>
          <div className="text-xs font-mono text-gray-400">
            {band.q.toFixed(2)}
          </div>
        </div>
      </div>

      {/* ✅ NEW: Dynamic EQ Controls */}
      <div className="mt-3 pt-3 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[9px] text-gray-400 uppercase">Dynamic EQ</div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={band.dynamicEnabled || false}
              onChange={(e) => onChange(index, 'dynamicEnabled', e.target.checked)}
              className="w-3 h-3 rounded transition-all appearance-none cursor-pointer"
              style={{
                border: `1px solid ${bandColor}30`,
                backgroundColor: band.dynamicEnabled ? bandColor : 'rgba(0, 0, 0, 0.5)',
                borderColor: band.dynamicEnabled ? bandColor : `${bandColor}30`,
                boxShadow: band.dynamicEnabled ? `0 0 6px ${bandColor}40` : 'none',
              }}
            />
            {band.dynamicEnabled && (
              <svg
                className="absolute w-2 h-2 pointer-events-none"
                style={{
                  left: '1px',
                  top: '1px',
                  color: '#fff',
                  position: 'relative',
                  marginLeft: '-11px',
                }}
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2 6L5 9L10 2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </label>
        </div>

        {band.dynamicEnabled && (
          <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-200">
            <div>
              <div className="text-[8px] text-gray-500 mb-1">THRESHOLD</div>
              <input
                type="range"
                min="-60"
                max="0"
                step="0.1"
                value={band.threshold !== undefined ? band.threshold : -12}
                onChange={(e) => onChange(index, 'threshold', parseFloat(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${bandColor} 0%, ${bandColor} ${((band.threshold || -12) + 60) / 60 * 100}%, rgba(255,255,255,0.1) ${((band.threshold || -12) + 60) / 60 * 100}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
              <div className="text-[9px] text-gray-400 mt-0.5 text-center">
                {(band.threshold || -12).toFixed(1)} dB
              </div>
            </div>

            <div>
              <div className="text-[8px] text-gray-500 mb-1">RATIO</div>
              <input
                type="range"
                min="1"
                max="20"
                step="0.1"
                value={band.ratio !== undefined ? band.ratio : 2}
                onChange={(e) => onChange(index, 'ratio', parseFloat(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${bandColor} 0%, ${bandColor} ${((band.ratio || 2) - 1) / 19 * 100}%, rgba(255,255,255,0.1) ${((band.ratio || 2) - 1) / 19 * 100}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
              <div className="text-[9px] text-gray-400 mt-0.5 text-center">
                1:{(band.ratio || 2).toFixed(1)}
              </div>
            </div>

            <div>
              <div className="text-[8px] text-gray-500 mb-1">ATTACK</div>
              <input
                type="range"
                min="0.1"
                max="100"
                step="0.1"
                value={band.attack !== undefined ? band.attack : 10}
                onChange={(e) => onChange(index, 'attack', parseFloat(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-[9px] text-gray-400 mt-0.5 text-center">
                {(band.attack || 10).toFixed(1)} ms
              </div>
            </div>

            <div>
              <div className="text-[8px] text-gray-500 mb-1">RELEASE</div>
              <input
                type="range"
                min="1"
                max="500"
                step="1"
                value={band.release !== undefined ? band.release : 100}
                onChange={(e) => onChange(index, 'release', parseFloat(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-[9px] text-gray-400 mt-0.5 text-center">
                {(band.release || 100).toFixed(0)} ms
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * EQ CURVE CANVAS
 */
const EQCurveCanvas = ({
  bands,
  onBandChange,
  activeBandIndex,
  setActiveBandIndex,
  soloedBand,
  mutedBands,
  categoryColors,
  canvasDimensions,
  onDimensionsChange,
  onSolo
}) => {
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [hoverBand, setHoverBand] = useState(null);

  // ResizeObserver to maintain high resolution on panel resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Use device pixel ratio for retina displays
        const dpr = window.devicePixelRatio || 1;
        const scaledWidth = Math.floor(width * dpr);
        const scaledHeight = Math.floor(height * dpr);

        // Update canvas dimensions via callback
        onDimensionsChange({ width: scaledWidth, height: scaledHeight });
      }
    });

    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [onDimensionsChange]);

  // Draw EQ curve
  useRenderer(
    () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      // Use display dimensions (accounting for DPR)
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.width / dpr;
      const displayHeight = canvas.height / dpr;

      // Clear (use full canvas dimensions)
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Scale context for sharp rendering on retina
      ctx.save();
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = '#0A0E1A';
      ctx.fillRect(0, 0, displayWidth, displayHeight);

      // Grid
      drawGrid(ctx, displayWidth, displayHeight);

      // 0dB line
      const y0db = dbToY(0, displayHeight);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y0db);
      ctx.lineTo(displayWidth, y0db);
      ctx.stroke();

      // Draw frequency response curve
      drawFrequencyResponse(ctx, displayWidth, displayHeight, bands, soloedBand, mutedBands, categoryColors);

      // Draw band nodes
      drawBandNodes(ctx, displayWidth, displayHeight, bands, activeBandIndex, hoverBand, categoryColors);

      // Restore context
      ctx.restore();
    },
    5, // high priority
    16, // 60fps
    [bands, activeBandIndex, hoverBand, soloedBand, mutedBands, canvasDimensions]
  );

  const drawGrid = (ctx, width, height) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    // Vertical frequency lines
    const frequencies = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    frequencies.forEach(freq => {
      const x = freqToX(freq, width);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '9px monospace';
      ctx.fillText(freq >= 1000 ? `${freq / 1000}k` : freq, x + 2, height - 4);
    });

    // Horizontal dB lines
    const dbLines = [-18, -12, -6, 0, 6, 12, 18];
    dbLines.forEach(db => {
      const y = dbToY(db, height);
      ctx.strokeStyle = db === 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '9px monospace';
      ctx.fillText(`${db > 0 ? '+' : ''}${db}dB`, 4, y - 2);
    });
  };

  const drawFrequencyResponse = (ctx, width, height, bands, soloedBand, mutedBands, colors) => {
    const activeBands = bands.filter((band, idx) => {
      if (!band.active) return false;
      if (soloedBand !== null) return idx === soloedBand;
      if (mutedBands.has(idx)) return false;
      return true;
    });

    if (activeBands.length === 0) return;

    ctx.beginPath();
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 2;
    ctx.shadowColor = colors.primary;
    ctx.shadowBlur = 8;

    for (let x = 0; x <= width; x += 2) {
      const freq = xToFreq(x, width);
      let totalDb = 0;

      activeBands.forEach(band => {
        // Calculate biquad coefficients
        const coeffs = EQCalculations.calculateBiquadCoefficients(
          band.type,
          band.frequency,
          band.gain || 0,
          band.q,
          44100
        );

        // Get frequency response
        const response = EQCalculations.getFrequencyResponse(coeffs, freq, 44100);
        totalDb += response.magnitudeDB;
      });

      const y = dbToY(totalDb, height);

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill under curve
    ctx.lineTo(width, height / 2);
    ctx.lineTo(0, height / 2);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `${colors.primary}30`);
    gradient.addColorStop(1, `${colors.primary}05`);
    ctx.fillStyle = gradient;
    ctx.fill();
  };

  const drawBandNodes = (ctx, width, height, bands, activeIdx, hoverIdx, colors) => {
    bands.forEach((band, idx) => {
      if (!band.active) return;

      const x = freqToX(band.frequency, width);
      const y = dbToY(band.gain || 0, height);
      const isActive = idx === activeIdx;
      const isHover = idx === hoverIdx;

      const bandColor = getBandColor(band.type, colors.primary);

      // Glow
      if (isActive || isHover) {
        ctx.shadowColor = bandColor;
        ctx.shadowBlur = 16;
        ctx.fillStyle = `${bandColor}40`;
        ctx.beginPath();
        ctx.arc(x, y, NODE_HIT_RADIUS + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Node
      ctx.fillStyle = bandColor;
      ctx.beginPath();
      ctx.arc(x, y, isActive ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();

      // Outline
      ctx.strokeStyle = isActive ? '#fff' : bandColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      if (isActive || isHover) {
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.fillText(`Band ${idx + 1}`, x + 10, y - 10);
      }
    });
  };

  const getBandColor = (type, defaultColor) => {
    const colorMap = {
      lowshelf: '#FF6B6B',
      peaking: defaultColor,
      highshelf: '#4ECDC4',
      notch: '#F38181',
      lowpass: '#AA96DA',
      highpass: '#FCBAD3'
    };
    return colorMap[type] || defaultColor;
  };

  // Mouse handlers
  // Helper: Get scaled mouse coordinates
  const getScaledMousePos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();

    // Mouse position relative to canvas (in display pixels)
    const displayX = e.clientX - rect.left;
    const displayY = e.clientY - rect.top;

    // Scale to internal canvas coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: displayX * scaleX,
      y: displayY * scaleY
    };
  };

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getScaledMousePos(e, canvas);

    // Find clicked band
    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      if (!band.active) continue;

      const bandX = freqToX(band.frequency, canvas.width);
      const bandY = dbToY(band.gain || 0, canvas.height);
      const distance = Math.sqrt((x - bandX) ** 2 + (y - bandY) ** 2);

      if (distance <= NODE_HIT_RADIUS) {
        // Ctrl/Cmd+Click: Solo band
        if (e.ctrlKey || e.metaKey) {
          onSolo(i);
          return;
        }

        setDragging({ index: i, shiftKey: e.shiftKey, altKey: e.altKey });
        setActiveBandIndex(i);
        return;
      }
    }
  };

  const handleDoubleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getScaledMousePos(e, canvas);

    // Find clicked band
    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      if (!band.active) continue;

      const bandX = freqToX(band.frequency, canvas.width);
      const bandY = dbToY(band.gain || 0, canvas.height);
      const distance = Math.sqrt((x - bandX) ** 2 + (y - bandY) ** 2);

      if (distance <= NODE_HIT_RADIUS) {
        // Double-click: Cycle filter type
        const types = ['peaking', 'lowshelf', 'highshelf', 'highpass', 'lowpass', 'notch'];
        const currentIndex = types.indexOf(band.type);
        const nextType = types[(currentIndex + 1) % types.length];
        onBandChange(i, 'type', nextType);
        return;
      }
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getScaledMousePos(e, canvas);

    // Find hovered band
    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      if (!band.active) continue;

      const bandX = freqToX(band.frequency, canvas.width);
      const bandY = dbToY(band.gain || 0, canvas.height);
      const distance = Math.sqrt((x - bandX) ** 2 + (y - bandY) ** 2);

      if (distance <= NODE_HIT_RADIUS) {
        // Mouse wheel: Adjust Q
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const multiplier = e.shiftKey ? FINE_TUNE_MULTIPLIER : 1;
        const newQ = Math.max(0.1, Math.min(20, band.q + delta * multiplier));
        onBandChange(i, 'q', newQ);
        return;
      }
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getScaledMousePos(e, canvas);

    if (dragging) {
      const band = bands[dragging.index];
      const multiplier = dragging.shiftKey ? FINE_TUNE_MULTIPLIER : 1;

      if (dragging.altKey) {
        // Alt: Adjust Q
        const deltaY = e.movementY * -0.01 * multiplier;
        const newQ = Math.max(0.1, Math.min(20, band.q + deltaY));
        onBandChange(dragging.index, 'q', newQ);
      } else {
        // Normal: Adjust frequency and gain
        const newFreq = xToFreq(x, canvas.width);
        const newGain = yToDb(y, canvas.height);

        onBandChange(dragging.index, 'frequency', Math.max(MIN_FREQ, Math.min(MAX_FREQ, newFreq)));

        if (band.type === 'peaking' || band.type === 'lowshelf' || band.type === 'highshelf' || band.type === 'notch') {
          onBandChange(dragging.index, 'gain', Math.max(MIN_DB, Math.min(MAX_DB, newGain)));
        }
      }
    } else {
      // Update hover
      let foundHover = null;
      for (let i = 0; i < bands.length; i++) {
        const band = bands[i];
        if (!band.active) continue;

        const bandX = freqToX(band.frequency, canvas.width);
        const bandY = dbToY(band.gain || 0, canvas.height);
        const distance = Math.sqrt((x - bandX) ** 2 + (y - bandY) ** 2);

        if (distance <= NODE_HIT_RADIUS) {
          foundHover = i;
          break;
        }
      }
      setHoverBand(foundHover);
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging]);

  // Wheel event listener (non-passive to allow preventDefault)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [bands, onBandChange]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasDimensions.width}
      height={canvasDimensions.height}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMouseMove}
      style={{
        width: '100%',
        height: '100%',
        cursor: dragging ? 'grabbing' : hoverBand !== null ? 'grab' : 'crosshair',
        borderRadius: '12px'
      }}
      title="Drag: Move | Shift+Drag: Fine tune | Alt+Drag: Adjust Q | Wheel: Q | Ctrl+Click: Solo | Double-click: Cycle type"
    />
  );
};

/**
 * MAIN COMPONENT
 */
export const MultiBandEQUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  const categoryColors = useMemo(() => getCategoryColors('spectral-weave'), []);
  const { handleMixerEffectChange } = useMixerStore();

  // State
  const [bands, setBands] = useState(() => {
    // ✅ NEW: Ensure all bands have Dynamic EQ parameters
    const initialBands = effect.settings.bands || [];
    return initialBands.map(band => ({
      ...band,
      dynamicEnabled: band.dynamicEnabled !== undefined ? band.dynamicEnabled : false,
      threshold: band.threshold !== undefined ? band.threshold : -12,
      ratio: band.ratio !== undefined ? band.ratio : 2,
      attack: band.attack !== undefined ? band.attack : 10,
      release: band.release !== undefined ? band.release : 100
    }));
  });
  const [wet, setWet] = useState(effect.settings.wet || 1.0);
  const [output, setOutput] = useState(effect.settings.output || 1.0);
  const [activeBandIndex, setActiveBandIndex] = useState(0);
  const [soloedBand, setSoloedBand] = useState(null);
  const [mutedBands, setMutedBands] = useState(new Set());
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 400 });

  // Use effectNode prop (passed from WorkspacePanel)
  const workletNode = effectNode || effect.node;

  // Debug: Log connection status
  useEffect(() => {
    console.log('[MultiBandEQ] Connection status:', {
      hasEffectNode: !!effectNode,
      hasEffectDotNode: !!effect.node,
      hasWorkletNode: !!workletNode,
      hasPort: !!workletNode?.port,
      effectId: effect.id,
      trackId
    });
  }, [effectNode, effect.node, workletNode, effect.id, trackId]);

  // Get audio context for spectrum analyzer
  const audioContext = AudioContextService.audioEngine?.audioContext;

  // Spectrum analyzer
  const { canvasRef: spectrumCanvasRef } = useWebGLSpectrum(
    workletNode,
    audioContext,
    {
      mode: 'filled',
      minFreq: 20,
      maxFreq: 20000,
      fftSize: 4096,
      smoothing: 0.8,
      minDecibels: -90,
      maxDecibels: -20,
      peakHold: false,
      barSpacing: 0.05,
      showGrid: false,
      showLabels: false,
      colors: [categoryColors.primary, categoryColors.secondary, categoryColors.accent]
    }
  );

  // Parameter batching
  const { setParams } = useParameterBatcher(workletNode);

  // Sync with effect.settings when presets are loaded
  useEffect(() => {
    if (effect.settings.bands) {
      console.log('[MultiBandEQ] Preset loaded, updating bands:', effect.settings.bands);
      setBands(effect.settings.bands);
    }
    if (effect.settings.wet !== undefined) {
      setWet(effect.settings.wet);
    }
    if (effect.settings.output !== undefined) {
      setOutput(effect.settings.output);
    }
  }, [effect.settings]);

  // Update effect when bands change
  useEffect(() => {
    // Silent return if worklet not ready (common during initialization)
    if (!workletNode?.port) return;

    // Send batched parameters
    setParams({
      wet,
      output
    });

    // Send bands via postMessage (worklet expects bands array)
    workletNode.port.postMessage({
      type: 'updateBands',
      bands: bands.filter(b => b.active)
    });

    console.log('[MultiBandEQ] Updated bands:', bands.filter(b => b.active).length);
  }, [bands, wet, output, workletNode, setParams]);

  // Band management
  const handleBandChange = useCallback((index, param, value) => {
    setBands(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [param]: value };

      // ✅ CRITICAL FIX: Sync band changes to store
      // This ensures changes persist across effect reordering
      handleMixerEffectChange(trackId, effect.id, 'bands', updated);

      return updated;
    });
  }, [trackId, effect.id, handleMixerEffectChange]);

  const handleAddBand = useCallback(() => {
    if (bands.length >= 20) return;

    const newBand = {
      id: `band-${Date.now()}`,
      type: 'peaking',
      frequency: 1000,
      gain: 0,
      q: 1.0,
      active: true,
      // ✅ NEW: Dynamic EQ default parameters
      dynamicEnabled: false,
      threshold: -12,
      ratio: 2,
      attack: 10,
      release: 100
    };

    setBands(prev => {
      const updated = [...prev, newBand];

      // ✅ CRITICAL FIX: Sync band changes to store
      handleMixerEffectChange(trackId, effect.id, 'bands', updated);

      return updated;
    });
    setActiveBandIndex(bands.length);
  }, [bands.length, trackId, effect.id, handleMixerEffectChange]);

  const handleRemoveBand = useCallback((index) => {
    setBands(prev => {
      const updated = prev.filter((_, i) => i !== index);

      // ✅ CRITICAL FIX: Sync band changes to store
      handleMixerEffectChange(trackId, effect.id, 'bands', updated);

      return updated;
    });
    if (activeBandIndex >= bands.length - 1) {
      setActiveBandIndex(Math.max(0, bands.length - 2));
    }
  }, [activeBandIndex, bands.length, trackId, effect.id, handleMixerEffectChange]);

  const handleSolo = useCallback((index) => {
    setSoloedBand(prev => prev === index ? null : index);
  }, []);

  const handleMute = useCallback((index) => {
    setMutedBands(prev => {
      const updated = new Set(prev);
      if (updated.has(index)) {
        updated.delete(index);
      } else {
        updated.add(index);
      }
      return updated;
    });
  }, []);

  // ✅ CRITICAL FIX: Wrapper functions to sync parameter changes to store
  const handleWetChange = useCallback((value) => {
    setWet(value);
    handleMixerEffectChange(trackId, effect.id, 'wet', value);
  }, [trackId, effect.id, handleMixerEffectChange]);

  const handleOutputChange = useCallback((value) => {
    setOutput(value);
    handleMixerEffectChange(trackId, effect.id, 'output', value);
  }, [trackId, effect.id, handleMixerEffectChange]);

  return (
    <PluginContainerV2
      trackId={trackId}
      effect={effect}
      definition={definition}
      category="spectral-weave"
    >
      <TwoPanelLayout
        category="spectral-weave"

        mainPanel={
          <div className="flex flex-col h-full gap-4">
            {/* EQ Curve + Spectrum */}
            <div className="flex-1 bg-black/30 rounded-xl overflow-hidden relative">
              <div className="absolute inset-0 p-4">
                {/* Spectrum Analyzer (background) */}
                <canvas
                  ref={spectrumCanvasRef}
                  width={canvasDimensions.width}
                  height={canvasDimensions.height}
                  className="absolute inset-0 rounded-lg pointer-events-none"
                  style={{
                    width: '100%',
                    height: '100%',
                    mixBlendMode: 'lighten',
                    opacity: 0.4
                  }}
                />

                {/* EQ Curve (foreground) */}
                <EQCurveCanvas
                  bands={bands}
                  onBandChange={handleBandChange}
                  activeBandIndex={activeBandIndex}
                  setActiveBandIndex={setActiveBandIndex}
                  soloedBand={soloedBand}
                  mutedBands={mutedBands}
                  categoryColors={categoryColors}
                  canvasDimensions={canvasDimensions}
                  onDimensionsChange={setCanvasDimensions}
                  onSolo={handleSolo}
                />
              </div>
            </div>

            {/* Global Controls */}
            <div className="flex items-center gap-4 px-4">
              <Knob
                label="Output"
                value={output}
                min={0}
                max={2}
                defaultValue={1}
                onChange={handleOutputChange}
                category="spectral-weave"
                sizeVariant="small"
                valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <Knob
                label="Mix"
                value={wet}
                min={0}
                max={1}
                defaultValue={1}
                onChange={handleWetChange}
                category="spectral-weave"
                sizeVariant="small"
                valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />

              <div className="flex-1" />

              <button
                onClick={handleAddBand}
                disabled={bands.length >= 20}
                className="px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
                style={{
                  background: bands.length >= 20 ? 'rgba(255, 255, 255, 0.05)' : categoryColors.primary,
                  color: bands.length >= 20 ? '#6B7280' : '#000',
                  opacity: bands.length >= 20 ? 0.5 : 1
                }}
              >
                <Plus size={16} />
                Add Band ({bands.length}/20)
              </button>
            </div>
          </div>
        }

        sidebarPanel={
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <div className="text-xs font-bold text-gray-400">
                BANDS ({bands.length})
              </div>
              {(soloedBand !== null || mutedBands.size > 0) && (
                <button
                  onClick={() => {
                    setSoloedBand(null);
                    setMutedBands(new Set());
                  }}
                  className="text-[9px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:bg-white/10"
                >
                  Clear S/M
                </button>
              )}
            </div>

            {/* Band List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {bands.map((band, index) => (
                <BandControl
                  key={band.id || index}
                  band={band}
                  index={index}
                  onChange={handleBandChange}
                  onRemove={handleRemoveBand}
                  onSolo={handleSolo}
                  onMute={handleMute}
                  isActive={index === activeBandIndex}
                  onActivate={() => setActiveBandIndex(index)}
                  isSoloed={index === soloedBand}
                  isMuted={mutedBands.has(index)}
                  categoryColors={categoryColors}
                />
              ))}
            </div>

            {/* Empty State */}
            {bands.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <div className="text-4xl mb-2 text-gray-600">⬢</div>
                  <div className="text-sm text-gray-500 mb-3">No bands</div>
                  <button
                    onClick={handleAddBand}
                    className="px-4 py-2 rounded-lg text-xs font-semibold"
                    style={{
                      background: categoryColors.primary,
                      color: '#000'
                    }}
                  >
                    Add First Band
                  </button>
                </div>
              </div>
            )}
          </div>
        }

        sidebarPosition="right"
        sidebarWidth={300}
      />
    </PluginContainerV2>
  );
};

export default MultiBandEQUI_V2;
