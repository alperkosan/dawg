import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Knob, ModeSelector } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

/**
 * ORBIT PANNER V2.0 - COMPLETE REDESIGN
 *
 * "The Spacetime Chamber" - Professional auto-panner with mode presets
 *
 * Features:
 * - 7 panning modes (circle, figure-8, sine, triangle, random, wide, custom)
 * - Real-time orbit trail visualization
 * - useAudioPlugin hook with metrics
 * - Ghost value feedback
 * - 3-panel professional layout
 * - Category theming: spacetime-chamber (purple/cyan)
 *
 * Design Philosophy:
 * - "From gentle sway to extreme motion"
 * - Visual feedback of stereo position
 * - Tempo sync support
 */

// ============================================================================
// PANNER MODES
// ============================================================================

const PANNER_MODES = {
  'circle': {
    id: 'circle',
    name: 'Circle',
    icon: '⭕',
    description: 'Smooth circular orbit',
    settings: {
      rate: 2,
      depth: 0.8,
      shape: 0, // Sine
      stereoWidth: 1.0,
      wet: 1.0
    }
  },
  'figure-8': {
    id: 'figure-8',
    name: 'Figure-8',
    icon: '∞',
    description: 'Complex figure-8 pattern',
    settings: {
      rate: 1.5,
      depth: 0.9,
      shape: 0.33, // Triangle mix
      stereoWidth: 1.5,
      wet: 1.0
    }
  },
  'sine': {
    id: 'sine',
    name: 'Sine Wave',
    icon: '〰️',
    description: 'Classic L-R sweep',
    settings: {
      rate: 1.0,
      depth: 0.7,
      shape: 0, // Pure sine
      stereoWidth: 1.0,
      wet: 1.0
    }
  },
  'triangle': {
    id: 'triangle',
    name: 'Triangle',
    icon: '△',
    description: 'Linear sweep',
    settings: {
      rate: 0.8,
      depth: 0.75,
      shape: 0.5, // Triangle
      stereoWidth: 1.0,
      wet: 1.0
    }
  },
  'random': {
    id: 'random',
    name: 'Random',
    icon: '🎲',
    description: 'Unpredictable movement',
    settings: {
      rate: 3,
      depth: 0.6,
      shape: 1.0, // Square (abrupt changes)
      stereoWidth: 1.2,
      wet: 0.8
    }
  },
  'wide': {
    id: 'wide',
    name: 'Wide Stereo',
    icon: '↔️',
    description: 'Maximum width',
    settings: {
      rate: 0.5,
      depth: 1.0,
      shape: 0.25,
      stereoWidth: 2.0,
      wet: 1.0
    }
  },
  'custom': {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    description: 'Manual control',
    settings: {
      rate: 1.0,
      depth: 0.8,
      shape: 0,
      stereoWidth: 1.0,
      wet: 1.0
    }
  }
};

// ============================================================================
// ORBIT TRAIL VISUALIZER
// ============================================================================

const OrbitTrailVisualizer = ({ rate, depth, shape, stereoWidth, inputLevel }) => {
  const timeRef = useRef(0);

  const generateLFO = (phase, shapeValue) => {
    // Sine wave
    if (shapeValue <= 0.33) {
      return Math.sin(phase);
    }
    // Triangle wave (morphing from sine)
    else if (shapeValue <= 0.66) {
      const mix = (shapeValue - 0.33) * 3;
      const sine = Math.sin(phase);
      const triangle = (2 / Math.PI) * Math.asin(Math.sin(phase));
      return sine * (1 - mix) + triangle * mix;
    }
    // Square wave (morphing from triangle)
    else {
      const mix = (shapeValue - 0.66) * 3;
      const triangle = (2 / Math.PI) * Math.asin(Math.sin(phase));
      const square = phase % (2 * Math.PI) < Math.PI ? 1 : -1;
      return triangle * (1 - mix) + square * mix;
    }
  };

  const drawOrbit = useCallback((ctx, width, height) => {
    const time = timeRef.current;
    const centerX = width / 2;
    const centerY = height / 2;

    // Dark background with subtle gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(10, 5, 25, 0.3)');
    bgGradient.addColorStop(1, 'rgba(5, 5, 15, 0.3)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw orbit path preview
    const orbitRadius = Math.min(width, height) * 0.35 * depth * stereoWidth;
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)'; // purple
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, orbitRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // L/R labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('L', 30, centerY + 6);
    ctx.fillText('R', width - 30, centerY + 6);

    // Center marker
    ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw center line
    ctx.strokeStyle = 'rgba(100, 100, 150, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Calculate current position
    const phase = time * rate * 0.002;
    const lfo = generateLFO(phase, shape) * depth * stereoWidth;
    const objX = centerX + lfo * (width * 0.4);
    const objY = centerY;

    // Draw trail
    const trailLength = 80;
    for (let i = 0; i < trailLength; i++) {
      const trailPhase = phase - (i * 0.03);
      const trailLfo = generateLFO(trailPhase, shape) * depth * stereoWidth;
      const trailX = centerX + trailLfo * (width * 0.4);
      const trailY = centerY;
      const alpha = (1 - i / trailLength) * inputLevel * 0.6;

      ctx.fillStyle = `rgba(34, 211, 238, ${alpha})`; // cyan
      ctx.beginPath();
      ctx.arc(trailX, trailY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Main panner object (glowing cyan)
    const glowSize = 10 + inputLevel * 8;
    ctx.fillStyle = '#22D3EE';
    ctx.shadowColor = '#22D3EE';
    ctx.shadowBlur = 20 + inputLevel * 15;
    ctx.beginPath();
    ctx.arc(objX, objY, glowSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw position indicator lines
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(objX, objY - 30);
    ctx.lineTo(objX, objY + 30);
    ctx.stroke();

    // Update time
    timeRef.current += 16;
  }, [rate, depth, shape, stereoWidth, inputLevel]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawOrbit,
    [rate, depth, shape, stereoWidth, inputLevel]
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const OrbitPannerUI = ({ trackId, effect, onChange }) => {
  const {
    rate = 1.0,
    depth = 0.8,
    shape = 0,
    stereoWidth = 1.0,
    wet = 1.0
  } = effect.settings;

  const [selectedMode, setSelectedMode] = useState('custom');

  // Audio plugin hook with metrics
  const { plugin, metrics, isPlaying, getFrequencyData } = useAudioPlugin(
    trackId,
    effect.id,
    {
      fftSize: 1024,
      updateMetrics: true
    }
  );

  // Input level from metrics
  const [inputLevel, setInputLevel] = useState(0);
  useEffect(() => {
    if (metrics?.inputPeak !== undefined) {
      setInputLevel(Math.max(0, Math.min(1, (metrics.inputPeak + 60) / 60)));
    }
  }, [metrics]);

  // Ghost values (400ms delay)
  const ghostRate = useGhostValue(rate, 400);
  const ghostDepth = useGhostValue(depth * 100, 400);
  const ghostShape = useGhostValue(shape * 100, 400);
  const ghostStereoWidth = useGhostValue(stereoWidth * 100, 400);
  const ghostWet = useGhostValue(wet * 100, 400);

  // Mode selection handler
  const handleModeSelect = useCallback((modeId) => {
    setSelectedMode(modeId);
    const mode = PANNER_MODES[modeId];
    if (mode && mode.settings) {
      Object.entries(mode.settings).forEach(([key, value]) => {
        onChange(key, value);
      });
    }
  }, [onChange]);

  // Shape name helper
  const getShapeName = (shapeValue) => {
    if (shapeValue <= 0.33) return 'Sine';
    if (shapeValue <= 0.66) return 'Triangle';
    return 'Square';
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-purple-950/20 to-black p-4 flex gap-4 overflow-hidden">

      {/* ===== LEFT PANEL: Mode Selector ===== */}
      <div className="w-[220px] flex-shrink-0 flex flex-col gap-4">

        {/* Plugin Header */}
        <div className="bg-gradient-to-r from-purple-900/40 to-cyan-900/40 rounded-xl px-4 py-3 border border-purple-500/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🌀</div>
            <div className="flex-1">
              <div className="text-sm font-black text-purple-300 tracking-wider uppercase">
                Orbit Panner
              </div>
              <div className="text-[9px] text-cyan-400/70">Spacetime Chamber</div>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <ModeSelector
          modes={Object.values(PANNER_MODES).map(mode => ({
            id: mode.id,
            label: mode.name,
            icon: mode.icon,
            description: mode.description
          }))}
          activeMode={selectedMode}
          onChange={handleModeSelect}
          orientation="vertical"
          category="spacetime-chamber"
          className="flex-1"
        />

        {/* Mode Description */}
        <div className="bg-gradient-to-br from-purple-900/20 to-black/50 rounded-xl p-4 border border-purple-500/10">
          <div className="text-[9px] text-cyan-300/70 font-bold uppercase tracking-wider mb-2">
            Mode Info
          </div>
          <div className="text-[10px] text-white/70 leading-relaxed">
            {PANNER_MODES[selectedMode].description}
          </div>
        </div>

        {/* Category Badge */}
        <div className="mt-auto bg-gradient-to-r from-purple-900/40 to-cyan-900/40 rounded-lg px-3 py-2 border border-purple-500/20 text-center">
          <div className="text-[8px] text-cyan-400/50 uppercase tracking-wider">Category</div>
          <div className="text-[10px] text-purple-300 font-bold">Spacetime Chamber</div>
        </div>
      </div>

      {/* ===== CENTER PANEL: Visualization + Controls ===== */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Orbit Visualizer */}
        <div className="h-[240px] bg-black/40 rounded-xl border border-purple-500/20 overflow-hidden">
          <OrbitTrailVisualizer
            rate={rate}
            depth={depth}
            shape={shape}
            stereoWidth={stereoWidth}
            inputLevel={inputLevel}
          />
        </div>

        {/* Main Controls */}
        <div className="bg-gradient-to-br from-purple-900/20 to-black/40 rounded-xl p-6 border border-purple-500/20">
          <div className="grid grid-cols-3 gap-6">

            {/* Rate */}
            <Knob
              label="RATE"
              value={rate}
              ghostValue={ghostRate}
              onChange={(val) => onChange('rate', val)}
              min={0.1}
              max={20}
              defaultValue={1.0}
              sizeVariant="large"
              category="spacetime-chamber"
              valueFormatter={(v) => `${v.toFixed(2)} Hz`}
            />

            {/* Depth */}
            <Knob
              label="DEPTH"
              value={depth * 100}
              ghostValue={ghostDepth}
              onChange={(val) => onChange('depth', val / 100)}
              min={0}
              max={100}
              defaultValue={80}
              sizeVariant="large"
              category="spacetime-chamber"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />

            {/* Shape */}
            <Knob
              label="SHAPE"
              value={shape * 100}
              ghostValue={ghostShape}
              onChange={(val) => onChange('shape', val / 100)}
              min={0}
              max={100}
              defaultValue={0}
              sizeVariant="large"
              category="spacetime-chamber"
              valueFormatter={(v) => getShapeName(v / 100)}
            />
          </div>
        </div>

        {/* Secondary Controls */}
        <div className="bg-gradient-to-br from-purple-900/20 to-black/40 rounded-xl p-6 border border-purple-500/20">
          <div className="grid grid-cols-2 gap-6">

            {/* Stereo Width */}
            <Knob
              label="WIDTH"
              value={stereoWidth * 100}
              ghostValue={ghostStereoWidth}
              onChange={(val) => onChange('stereoWidth', val / 100)}
              min={0}
              max={200}
              defaultValue={100}
              sizeVariant="medium"
              category="spacetime-chamber"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />

            {/* Mix */}
            <Knob
              label="MIX"
              value={wet * 100}
              ghostValue={ghostWet}
              onChange={(val) => onChange('wet', val / 100)}
              min={0}
              max={100}
              defaultValue={100}
              sizeVariant="medium"
              category="spacetime-chamber"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />
          </div>
        </div>

        {/* Position Indicator */}
        <div className="bg-black/30 rounded-xl p-4 border border-purple-500/10">
          <div className="text-[10px] text-cyan-300/70 font-bold uppercase tracking-wider mb-3">
            Stereo Position
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-cyan-400">L</span>
            <div className="flex-1 mx-4 h-4 bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-purple-500/20 rounded-full relative border border-purple-500/20">
              <div
                className="absolute top-0 w-6 h-4 bg-cyan-400 rounded-full transform -translate-x-1/2 shadow-lg shadow-cyan-400/50 transition-all duration-75"
                style={{
                  left: `${50 + Math.sin(Date.now() * 0.001 * rate) * 50 * depth * stereoWidth}%`
                }}
              />
            </div>
            <span className="text-sm font-bold text-purple-400">R</span>
          </div>
        </div>
      </div>

      {/* ===== RIGHT PANEL: Stats ===== */}
      <div className="w-[200px] flex-shrink-0 flex flex-col gap-4">

        {/* Processing Stats */}
        <div className="bg-gradient-to-br from-purple-900/20 to-black/40 rounded-xl p-4 border border-purple-500/10">
          <div className="text-[9px] text-cyan-300/70 uppercase tracking-wider mb-3 font-bold">
            Processing
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Mode</span>
              <span className="text-purple-300 text-[9px] font-medium">
                {PANNER_MODES[selectedMode].name}
              </span>
            </div>
            <div className="pt-2 border-t border-purple-500/10">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-white/50">Rate</span>
                <span className="text-cyan-400 font-mono font-bold tabular-nums">
                  {rate.toFixed(2)} Hz
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Depth</span>
              <span className="text-purple-300 font-mono font-bold tabular-nums">
                {(depth * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Shape</span>
              <span className="text-cyan-400 font-mono font-bold tabular-nums">
                {getShapeName(shape)}
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Width</span>
              <span className="text-purple-300 font-mono font-bold tabular-nums">
                {(stereoWidth * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Mix</span>
              <span className="text-cyan-400 font-mono font-bold tabular-nums">
                {(wet * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Input</span>
              <span className="text-purple-300 font-mono font-bold tabular-nums">
                {(inputLevel * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Auto-Pan Explanation */}
        <div className="flex-1 bg-gradient-to-br from-purple-900/10 to-black/40 rounded-xl p-4 border border-purple-500/10">
          <div className="text-[9px] text-cyan-300/70 font-bold uppercase tracking-wider mb-3">
            About Auto-Pan
          </div>
          <div className="space-y-2 text-[9px] text-white/50 leading-relaxed">
            <p>
              <span className="text-cyan-400 font-bold">Rate:</span> Speed of panning motion
            </p>
            <p>
              <span className="text-purple-300 font-bold">Depth:</span> Amount of movement
            </p>
            <p>
              <span className="text-cyan-400 font-bold">Shape:</span> LFO waveform type (sine/tri/square)
            </p>
            <p>
              <span className="text-purple-300 font-bold">Width:</span> Stereo field expansion
            </p>
            <p className="text-white/30 italic pt-2 text-[8px]">
              💡 Creates movement and depth in the stereo field
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
