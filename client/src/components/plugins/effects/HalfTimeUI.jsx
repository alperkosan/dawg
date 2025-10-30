/**
 * HALFTIME V2.0 - The Time Stretcher
 *
 * "The Spacetime Chamber" - Professional time-stretching with granular synthesis
 * Inspired by: CableGuys HalfTime, Gross Beat, dBlue Glitch
 *
 * Features:
 * - Mode-based time effects (Clean, Tape, Granular, Vinyl, Cassette, Glitch)
 * - Real-time granular cloud visualization
 * - Time dilation animation
 * - Category theming ('spacetime-chamber' - deep red/purple palette)
 * - Ghost value feedback
 * - Professional mode system
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Knob, ModeSelector, ExpandablePanel } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

// ============================================================================
// HALFTIME MODES
// ============================================================================

const HALFTIME_MODES = {
  clean: {
    id: 'clean',
    name: 'Clean',
    icon: '✨',
    description: 'Pristine algorithmic stretch - transparent time manipulation',
    category: 'pristine',
    baseParams: {
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
  tape: {
    id: 'tape',
    name: 'Tape',
    icon: '📼',
    description: 'Analog tape slow-down with warmth and flutter',
    category: 'analog',
    baseParams: {
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
  granular: {
    id: 'granular',
    name: 'Granular',
    icon: '⚛️',
    description: 'Dense granular texture - experimental time cloud',
    category: 'pristine',
    baseParams: {
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
  vinyl: {
    id: 'vinyl',
    name: 'Vinyl',
    icon: '💿',
    description: 'Record player slow-down - vintage character',
    category: 'analog',
    baseParams: {
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
  cassette: {
    id: 'cassette',
    name: 'Cassette',
    icon: '📻',
    description: 'Lo-fi tape with warble and saturation',
    category: 'analog',
    baseParams: {
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
  glitch: {
    id: 'glitch',
    name: 'Glitch',
    icon: '⚡',
    description: 'Stuttering, broken time - digital artifacts',
    category: 'creative',
    baseParams: {
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

// ============================================================================
// GRANULAR CLOUD VISUALIZER
// ============================================================================

const GranularCloudVisualizer = ({ grainDensity, smoothing, rate, inputLevel, mode }) => {
  const timeRef = useRef(0);
  const particlesRef = useRef([]);

  const drawGranularCloud = useCallback((ctx, width, height) => {
    const time = timeRef.current;
    timeRef.current += 0.016; // ~60fps

    // 🎨 THEME: "The Spacetime Chamber" - Deep red/purple palette
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(20, 10, 20, 0.95)');
    bgGradient.addColorStop(0.5, 'rgba(30, 15, 25, 0.95)');
    bgGradient.addColorStop(1, 'rgba(15, 8, 15, 0.95)');
    ctx.fillStyle = bgGradient;
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

      // Update position (slower movement when half-time active)
      const speedFactor = 1 - rate * 0.7; // Slower at lower rates
      p.x += p.vx * speedFactor;
      p.y += p.vy * speedFactor;

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

      // Glow (purple/red theme)
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
    const maxRadius = Math.min(width, height) / 2;

    ctx.strokeStyle = `rgba(231, 76, 60, ${0.2 * inputLevel})`; // Red
    ctx.lineWidth = 2;

    for (let r = 20; r < maxRadius; r += 40) {
      const radius = Math.max(1, r + (Math.sin(time * rate * 2) * 10));
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Rate indicator
    ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    const ratePercent = (rate * 100).toFixed(0);
    const stretchFactor = rate <= 0.26 ? 'x4' : rate <= 0.51 ? 'x2' : 'x1';
    ctx.fillText(`${ratePercent}% speed (${stretchFactor})`, centerX, height - 20);

    // Mode indicator
    const modeNames = ['Clean', 'Tape', 'Granular', 'Vinyl', 'Cassette', 'Glitch'];
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(231, 76, 60, 0.6)';
    ctx.fillText(modeNames[mode] || 'Unknown', centerX, height - 5);

  }, [grainDensity, smoothing, rate, inputLevel, mode]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawGranularCloud,
    [grainDensity, smoothing, rate, inputLevel, mode],
    { noLoop: false }
  );

  return (
    <div ref={containerRef} className="w-full h-full bg-black/50 rounded-xl border border-[#E74C3C]/20 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN HALFTIME UI COMPONENT
// ============================================================================

const HalfTimeUI = ({ trackId, effect, onChange }) => {
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
  } = effect.settings || {};

  const [currentMode, setCurrentMode] = useState('clean');
  const [inputLevel, setInputLevel] = useState(0.5);

  // Audio plugin hook
  const { plugin, meterValue } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: true
  });

  // Ghost values for smooth visual feedback
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
      Object.entries(modeConfig.baseParams).forEach(([key, value]) => {
        onChange(key, value);
      });
    }
  }, [onChange]);

  // Parameter change handler
  const handleParameterChange = useCallback((param, value) => {
    onChange(param, value);
  }, [onChange]);

  // Format stretch amount
  const formatStretch = (value) => {
    if (value <= 0.26) return 'x4';
    if (value <= 0.51) return 'x2';
    return 'x1';
  };

  // Format smoothing
  const formatSmoothing = (value) => {
    if (value < 20) return '1/8';
    if (value < 40) return '1/4';
    if (value < 60) return '1/2';
    if (value < 80) return '1 bar';
    return '2 bars';
  };

  // Format pitch
  const formatPitch = (value) => {
    const rounded = Math.round(value);
    const sign = rounded >= 0 ? '+' : '';
    return `${sign}${rounded}st`;
  };

  // Prepare modes for ModeSelector
  const modes = Object.values(HALFTIME_MODES).map(m => ({
    id: m.id,
    label: m.name,
    icon: m.icon,
    description: m.description
  }));

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-[#1A0F1A] to-black p-4 flex flex-col gap-4 overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl">⏱️</div>
          <div>
            <p className="text-xs text-[#E74C3C]/70 font-semibold uppercase tracking-wider">The Spacetime Chamber</p>
          </div>
        </div>
      </div>

      {/* Mode Selector */}
      <ModeSelector
        modes={modes}
        activeMode={currentMode}
        onChange={handleModeChange}
        orientation="horizontal"
        category="spacetime-chamber"
      />

      {/* Visualization */}
      <div className="flex-1 min-h-[200px] rounded-xl overflow-hidden border-2 border-[#E74C3C]/50 bg-[#0F0810]/50">
        <GranularCloudVisualizer
          grainDensity={grainDensity}
          smoothing={smoothing}
          rate={rate}
          inputLevel={inputLevel}
          mode={mode}
        />
      </div>

      {/* Main Controls */}
      <div className="grid grid-cols-4 gap-6">
        
        {/* Stretch Rate */}
        <div className="flex flex-col items-center">
          <label className="text-[10px] text-[#E74C3C]/80 font-bold uppercase mb-2 tracking-wider">
            STRETCH
          </label>
          <Knob
            value={rate}
            ghostValue={rateGhost}
            onChange={(value) => handleParameterChange('rate', value)}
            min={0.25}
            max={1.0}
            defaultValue={0.5}
            sizeVariant="large"
            category="spacetime-chamber"
            valueFormatter={formatStretch}
          />
          <div className="text-xs text-[#E74C3C]/60 mt-2 font-mono">
            {formatStretch(rate)}
          </div>
        </div>

        {/* Smoothing */}
        <div className="flex flex-col items-center">
          <label className="text-[10px] text-[#E74C3C]/80 font-bold uppercase mb-2 tracking-wider">
            SMOOTHING
          </label>
          <Knob
            value={smoothing}
            ghostValue={smoothingGhost}
            onChange={(value) => handleParameterChange('smoothing', value)}
            min={0}
            max={100}
            defaultValue={50}
            sizeVariant="large"
            category="spacetime-chamber"
            valueFormatter={formatSmoothing}
          />
          <div className="text-xs text-[#E74C3C]/60 mt-2 font-mono">
            {formatSmoothing(smoothing)}
          </div>
        </div>

        {/* Pitch Shift */}
        <div className="flex flex-col items-center">
          <label className="text-[10px] text-[#E74C3C]/80 font-bold uppercase mb-2 tracking-wider">
            PITCH
          </label>
          <Knob
            value={pitchShift}
            ghostValue={pitchShiftGhost}
            onChange={(value) => handleParameterChange('pitchShift', Math.round(value))}
            min={-24}
            max={24}
            step={1}
            defaultValue={-12}
            sizeVariant="large"
            category="spacetime-chamber"
            centerDetent={true}
            valueFormatter={formatPitch}
          />
          <div className="text-xs text-[#E74C3C]/60 mt-2 font-mono">
            {formatPitch(pitchShift)}
          </div>
        </div>

        {/* Mix */}
        <div className="flex flex-col items-center">
          <label className="text-[10px] text-[#E74C3C]/80 font-bold uppercase mb-2 tracking-wider">
            MIX
          </label>
          <Knob
            value={mix}
            onChange={(value) => handleParameterChange('mix', value)}
            min={0}
            max={100}
            defaultValue={100}
            sizeVariant="large"
            category="spacetime-chamber"
            valueFormatter={(v) => `${Math.round(v)}%`}
          />
          <div className="text-xs text-[#E74C3C]/60 mt-2 font-mono">
            {Math.round(mix)}%
          </div>
        </div>
      </div>

      {/* Advanced Controls */}
      <ExpandablePanel
        title="Advanced Parameters"
        icon="⚙️"
        category="spacetime-chamber"
        defaultExpanded={false}
      >
        <div className="grid grid-cols-4 gap-6 p-4">
          
          {/* Grain Size */}
          <Knob
            label="GRAIN SIZE"
            value={grainSize}
            onChange={(value) => handleParameterChange('grainSize', value)}
            min={50}
            max={500}
            step={10}
            defaultValue={100}
            sizeVariant="medium"
            category="spacetime-chamber"
            valueFormatter={(v) => `${Math.round(v)}ms`}
          />

          {/* Grain Density */}
          <Knob
            label="DENSITY"
            value={grainDensity}
            onChange={(value) => handleParameterChange('grainDensity', value)}
            min={1}
            max={16}
            step={1}
            defaultValue={8}
            sizeVariant="medium"
            category="spacetime-chamber"
            valueFormatter={(v) => `${Math.round(v)}`}
          />

          {/* Analog Warmth */}
          {(mode === 1 || mode === 3 || mode === 4) && (
            <Knob
              label="WARMTH"
              value={analogWarmth}
              onChange={(value) => handleParameterChange('analogWarmth', value)}
              min={0}
              max={100}
              step={1}
              defaultValue={0}
              sizeVariant="medium"
              category="spacetime-chamber"
              valueFormatter={(v) => `${Math.round(v)}%`}
            />
          )}

          {/* Glitch Amount */}
          {mode === 5 && (
            <Knob
              label="GLITCH"
              value={glitchAmount}
              onChange={(value) => handleParameterChange('glitchAmount', value)}
              min={0}
              max={100}
              step={1}
              defaultValue={0}
              sizeVariant="medium"
              category="spacetime-chamber"
              valueFormatter={(v) => `${Math.round(v)}%`}
            />
          )}
        </div>

        {/* Pitch Lock Toggle */}
        <div className="px-4 pb-4 flex items-center justify-center">
          <button
            onClick={() => handleParameterChange('pitchLock', pitchLock ? 0 : 1)}
            className={`
              px-6 py-3 rounded-lg font-semibold text-sm transition-all
              ${pitchLock
                ? 'bg-[#E74C3C] text-white shadow-lg shadow-[#E74C3C]/50'
                : 'bg-gray-700/50 text-gray-400 border border-gray-600/50'
              }
            `}
          >
            {pitchLock ? '🔒 PITCH LOCKED' : '🔓 PITCH FOLLOWS RATE'}
          </button>
        </div>
      </ExpandablePanel>

      {/* Info Display */}
      <div className="bg-gradient-to-r from-[#1A0F1A] to-[#0F0810] rounded-lg px-4 py-2 border border-[#E74C3C]/20">
        <div className="flex justify-between text-xs text-white/50">
          <span>Mode: <span className="text-[#E74C3C] font-bold">{HALFTIME_MODES[currentMode]?.name}</span></span>
          <span>Grains: <span className="text-[#E74C3C] font-bold">~{Math.floor(grainDensity * smoothing / 100 * 2)}</span></span>
          <span>Speed: <span className="text-[#E74C3C] font-bold">{(rate * 100).toFixed(0)}%</span></span>
        </div>
      </div>
    </div>
  );
};

export default HalfTimeUI;
