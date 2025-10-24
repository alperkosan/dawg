/**
 * HalfTime v1.0 - "The Time Stretcher"
 *
 * Professional time-stretching with granular visualization
 *
 * Features:
 * - Mode-based time effects (Clean, Tape, Granular, Vinyl, Cassette, Glitch)
 * - Real-time granular cloud visualization
 * - Time dilation animation
 * - Spacetime Chamber category theming (deep purple/cyan palette)
 * - Ghost value feedback
 * - 3-panel layout
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Knob, ModeSelector } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

// Half Time Modes
const HALFTIME_MODES = {
  'clean': {
    id: 'clean',
    name: 'Clean',
    icon: '✨',
    description: 'Pristine algorithmic stretch',
    color: 'blue',
    settings: {
      rate: 0.5,
      smoothing: 80,
      pitchShift: -12,
      pitchLock: 1,
      grainSize: 100,
      grainDensity: 8,
      analogWarmth: 0,
      glitchAmount: 0,
      mode: 0
    }
  },
  'tape': {
    id: 'tape',
    name: 'Tape',
    icon: '📼',
    description: 'Analog tape slow-down',
    color: 'amber',
    settings: {
      rate: 0.5,
      smoothing: 30,
      pitchShift: -12,
      pitchLock: 0,
      grainSize: 200,
      grainDensity: 4,
      analogWarmth: 40,
      glitchAmount: 0,
      mode: 1
    }
  },
  'granular': {
    id: 'granular',
    name: 'Granular',
    icon: '⚛️',
    description: 'Dense granular texture',
    color: 'purple',
    settings: {
      rate: 0.5,
      smoothing: 70,
      pitchShift: -12,
      pitchLock: 1,
      grainSize: 100,
      grainDensity: 12,
      analogWarmth: 0,
      glitchAmount: 0,
      mode: 2
    }
  },
  'vinyl': {
    id: 'vinyl',
    name: 'Vinyl',
    icon: '💿',
    description: 'Record player slow-down',
    color: 'red',
    settings: {
      rate: 0.5,
      smoothing: 40,
      pitchShift: -12,
      pitchLock: 0,
      grainSize: 150,
      grainDensity: 6,
      analogWarmth: 60,
      glitchAmount: 0,
      mode: 3
    }
  },
  'cassette': {
    id: 'cassette',
    name: 'Cassette',
    icon: '📻',
    description: 'Lo-fi tape with warble',
    color: 'orange',
    settings: {
      rate: 0.5,
      smoothing: 35,
      pitchShift: -12,
      pitchLock: 0,
      grainSize: 180,
      grainDensity: 8,
      analogWarmth: 50,
      glitchAmount: 0,
      mode: 4
    }
  },
  'glitch': {
    id: 'glitch',
    name: 'Glitch',
    icon: '⚡',
    description: 'Stuttering, broken time',
    color: 'cyan',
    settings: {
      rate: 0.5,
      smoothing: 90,
      pitchShift: -12,
      pitchLock: 1,
      grainSize: 50,
      grainDensity: 16,
      analogWarmth: 0,
      glitchAmount: 30,
      mode: 5
    }
  }
};

const MODE_CATEGORIES = {
  'PRISTINE': {
    name: 'Pristine',
    modes: ['clean', 'granular']
  },
  'ANALOG': {
    name: 'Analog',
    modes: ['tape', 'vinyl', 'cassette']
  },
  'CREATIVE': {
    name: 'Creative',
    modes: ['glitch']
  }
};

// Granular Cloud Visualizer
const GranularCloudVisualizer = ({ grainDensity, smoothing, rate, inputLevel }) => {
  const timeRef = useRef(0);
  const particlesRef = useRef([]);

  const drawGranularCloud = useCallback((ctx, width, height) => {
    const time = timeRef.current;
    timeRef.current += 0.016; // ~60fps

    // Clear with gradient (deep purple space)
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(20, 10, 30, 0.95)');
    gradient.addColorStop(1, 'rgba(10, 5, 15, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Calculate particle count based on grain density and smoothing
    const targetParticleCount = Math.floor(grainDensity * (smoothing / 100) * 2);

    // Spawn new particles
    while (particlesRef.current.length < targetParticleCount) {
      particlesRef.current.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 1.0,
        size: 2 + Math.random() * 4,
        hue: 270 + Math.random() * 60 // Purple to cyan
      });
    }

    // Update and draw particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];

      // Update position
      p.x += p.vx * (1 - rate); // Slower movement when half-time active
      p.y += p.vy * (1 - rate);

      // Update life
      p.life -= 0.01;

      // Remove dead particles
      if (p.life <= 0) {
        particlesRef.current.splice(i, 1);
        continue;
      }

      // Wrap around edges
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      // Draw particle with glow
      const alpha = p.life * inputLevel;
      const glowSize = p.size * 2;

      // Glow
      ctx.fillStyle = `hsla(${p.hue}, 70%, 50%, ${alpha * 0.2})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Time warp effect (concentric circles)
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.max(width, height) / 2;

    ctx.strokeStyle = `rgba(150, 100, 200, ${0.2 * inputLevel})`;
    ctx.lineWidth = 2;

    for (let r = 20; r < maxRadius; r += 40) {
      const radius = Math.max(1, r + (Math.sin(time * rate * 2) * 10)); // Ensure positive radius
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Rate indicator text
    ctx.fillStyle = 'rgba(200, 150, 255, 0.6)';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${(rate * 100).toFixed(0)}% speed`, centerX, height - 20);

  }, [grainDensity, smoothing, rate, inputLevel]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawGranularCloud,
    [grainDensity, smoothing, rate, inputLevel]
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ imageRendering: 'auto' }}
      />
    </div>
  );
};

// Main HalfTime UI Component
const HalfTimeUI = ({ trackId, effect, onChange }) => {
  // Destructure settings with defaults
  const {
    rate = 0.5,
    smoothing = 50,
    pitchShift = -12,
    grainSize = 100,
    grainDensity = 8,
    pitchLock = 1,
    mix = 100,
    mode = 0,
    analogWarmth = 0,
    glitchAmount = 0
  } = effect.settings;

  const [currentMode, setCurrentMode] = useState('clean');
  const [inputLevel, setInputLevel] = useState(0.5);

  // Audio plugin hook
  const { updateParameter, meterValue } = useAudioPlugin(trackId, effect.id);

  // Ghost values for visual feedback
  const rateGhost = useGhostValue(rate, 500);
  const smoothingGhost = useGhostValue(smoothing, 500);
  const pitchShiftGhost = useGhostValue(pitchShift, 500);

  // Update input level from meter
  useEffect(() => {
    if (meterValue) {
      setInputLevel(Math.min(1, meterValue * 2));
    }
  }, [meterValue]);

  // Mode change handler
  const handleModeChange = useCallback((modeId) => {
    setCurrentMode(modeId);
    const modeConfig = HALFTIME_MODES[modeId];
    if (modeConfig && onChange) {
      // Apply all mode settings
      Object.entries(modeConfig.settings).forEach(([key, value]) => {
        onChange(key, value);
      });
    }
  }, [onChange]);

  // Parameter change handler
  const handleParameterChange = useCallback((param, value) => {
    onChange(param, value);
    updateParameter?.(param, value);
  }, [onChange, updateParameter]);

  // Format stretch amount (fixed options)
  const formatStretch = (value) => {
    // Map rate to stretch amount (inverse relationship)
    if (value <= 0.26) return 'x4'; // 4x slower, -2 octaves
    if (value <= 0.51) return 'x2'; // 2x slower, -1 octave
    return 'x1'; // Normal speed
  };

  // Format refresh rate display
  const formatRefresh = (value) => {
    // Map smoothing to musical divisions
    if (value < 20) return '1/8';
    if (value < 40) return '1/4';
    if (value < 60) return '1/2';
    if (value < 80) return '1 bar';
    return '2 bars';
  };

  // Format pitch display (rounded)
  const formatPitch = (value) => {
    const rounded = Math.round(value);
    const sign = rounded >= 0 ? '+' : '';
    return `${sign}${rounded}st`;
  };

  return (
    <div className="halftime-ui flex flex-col h-full bg-gradient-to-b from-purple-950 via-purple-900 to-indigo-950 text-purple-100 p-4 rounded-lg shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="text-2xl">⏱️</div>
          <div>
            <h3 className="text-lg font-bold text-purple-100">HalfTime</h3>
            <p className="text-xs text-purple-400">The Time Stretcher</p>
          </div>
        </div>
        <button
          onClick={() => {
            if (onChange) {
              onChange({ ...effect.settings, bypass: !effect.bypass });
            }
          }}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            effect.bypass
              ? 'bg-gray-700 text-gray-400'
              : 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
          }`}
        >
          {effect.bypass ? 'BYPASSED' : 'ACTIVE'}
        </button>
      </div>

      {/* Mode Selector */}
      <div className="mb-4">
        <ModeSelector
          modes={Object.values(HALFTIME_MODES).map(mode => ({
            id: mode.id,
            label: mode.name,
            icon: mode.icon,
            description: mode.description
          }))}
          activeMode={currentMode}
          onChange={handleModeChange}
          orientation="horizontal"
          category="spacetime-chamber"
          className="w-full"
        />
      </div>

      {/* Visualization */}
      <div className="flex-1 mb-4 rounded-lg overflow-hidden border-2 border-purple-700/50 bg-purple-950/50 min-h-[200px]">
        <GranularCloudVisualizer
          grainDensity={grainDensity}
          smoothing={smoothing}
          rate={rate}
          inputLevel={inputLevel}
        />
      </div>

      {/* Main Controls */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Stretch Amount */}
        <div className="flex flex-col items-center">
          <label className="text-xs font-semibold text-purple-300 mb-2">STRETCH</label>
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => handleParameterChange('rate', 1.0)}
              className={`px-4 py-2 rounded font-semibold transition-all ${
                rate > 0.75 ? 'bg-purple-600 text-white' : 'bg-purple-900/30 text-purple-400'
              }`}
            >
              x1 (Normal)
            </button>
            <button
              onClick={() => handleParameterChange('rate', 0.5)}
              className={`px-4 py-2 rounded font-semibold transition-all ${
                rate > 0.26 && rate <= 0.75 ? 'bg-purple-600 text-white' : 'bg-purple-900/30 text-purple-400'
              }`}
            >
              x2 (-1 oct)
            </button>
            <button
              onClick={() => handleParameterChange('rate', 0.25)}
              className={`px-4 py-2 rounded font-semibold transition-all ${
                rate <= 0.26 ? 'bg-purple-600 text-white' : 'bg-purple-900/30 text-purple-400'
              }`}
            >
              x4 (-2 oct)
            </button>
          </div>
          <div className="text-xs text-purple-400 mt-2">
            {formatStretch(rate)}
          </div>
        </div>

        {/* Refresh Rate */}
        <div className="flex flex-col items-center">
          <label className="text-xs font-semibold text-purple-300 mb-2">REFRESH</label>
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => handleParameterChange('smoothing', 10)}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${
                smoothing < 20 ? 'bg-purple-600 text-white' : 'bg-purple-900/30 text-purple-400'
              }`}
            >
              1/8
            </button>
            <button
              onClick={() => handleParameterChange('smoothing', 30)}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${
                smoothing >= 20 && smoothing < 40 ? 'bg-purple-600 text-white' : 'bg-purple-900/30 text-purple-400'
              }`}
            >
              1/4
            </button>
            <button
              onClick={() => handleParameterChange('smoothing', 50)}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${
                smoothing >= 40 && smoothing < 60 ? 'bg-purple-600 text-white' : 'bg-purple-900/30 text-purple-400'
              }`}
            >
              1/2
            </button>
            <button
              onClick={() => handleParameterChange('smoothing', 70)}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${
                smoothing >= 60 && smoothing < 80 ? 'bg-purple-600 text-white' : 'bg-purple-900/30 text-purple-400'
              }`}
            >
              1 bar
            </button>
            <button
              onClick={() => handleParameterChange('smoothing', 90)}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${
                smoothing >= 80 ? 'bg-purple-600 text-white' : 'bg-purple-900/30 text-purple-400'
              }`}
            >
              2 bars
            </button>
          </div>
          <div className="text-xs text-purple-400 mt-2">
            {formatRefresh(smoothing)}
          </div>
        </div>

        {/* Pitch Shift */}
        <div className="flex flex-col items-center">
          <label className="text-xs font-semibold text-purple-300 mb-2">PITCH</label>
          <Knob
            value={pitchShift}
            onChange={(value) => handleParameterChange('pitchShift', Math.round(value))}
            min={-24}
            max={24}
            step={1}
            size={80}
            color="pink"
            showValue
            valueFormatter={formatPitch}
            bipolar
          />
          <div className="text-xs text-purple-400 mt-1">
            {formatPitch(pitchShiftGhost)}
          </div>
        </div>
      </div>

      {/* Advanced Controls */}
      <div className="grid grid-cols-4 gap-3 bg-purple-950/50 p-3 rounded-lg border border-purple-700/30">
        {/* Grain Size */}
        <div className="flex flex-col items-center">
          <label className="text-xs font-semibold text-purple-300 mb-1">GRAIN SIZE</label>
          <Knob
            value={grainSize}
            onChange={(value) => handleParameterChange('grainSize', value)}
            min={50}
            max={500}
            step={10}
            size={50}
            color="purple"
            showValue
            valueFormatter={(v) => `${Math.round(v)}ms`}
          />
        </div>

        {/* Grain Density */}
        <div className="flex flex-col items-center">
          <label className="text-xs font-semibold text-purple-300 mb-1">DENSITY</label>
          <Knob
            value={grainDensity}
            onChange={(value) => handleParameterChange('grainDensity', value)}
            min={1}
            max={16}
            step={1}
            size={50}
            color="cyan"
            showValue
          />
        </div>

        {/* Analog Warmth */}
        <div className="flex flex-col items-center">
          <label className="text-xs font-semibold text-purple-300 mb-1">WARMTH</label>
          <Knob
            value={analogWarmth}
            onChange={(value) => handleParameterChange('analogWarmth', value)}
            min={0}
            max={100}
            step={1}
            size={50}
            color="orange"
            showValue
            valueFormatter={(v) => `${Math.round(v)}%`}
          />
        </div>

        {/* Mix */}
        <div className="flex flex-col items-center">
          <label className="text-xs font-semibold text-purple-300 mb-1">MIX</label>
          <Knob
            value={mix}
            onChange={(value) => handleParameterChange('mix', value)}
            min={0}
            max={100}
            step={1}
            size={50}
            color="white"
            showValue
            valueFormatter={(v) => `${Math.round(v)}%`}
          />
        </div>
      </div>

      {/* Pitch Lock Toggle */}
      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          onClick={() => handleParameterChange('pitchLock', pitchLock ? 0 : 1)}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            pitchLock
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
              : 'bg-gray-700 text-gray-400'
          }`}
        >
          {pitchLock ? '🔒 PITCH LOCKED' : '🔓 PITCH FOLLOWS RATE'}
        </button>
      </div>

      {/* Info Display */}
      <div className="mt-3 text-center text-xs text-purple-400">
        <div className="flex justify-between px-4">
          <span>Mode: {HALFTIME_MODES[currentMode]?.name}</span>
          <span>Grains: ~{Math.floor(grainDensity * smoothing / 100 * 2)}</span>
        </div>
      </div>
    </div>
  );
};

export default HalfTimeUI;
