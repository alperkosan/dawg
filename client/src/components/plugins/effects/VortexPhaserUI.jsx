import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Knob, ModeSelector } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

/**
 * VORTEX PHASER V2.0 - COMPLETE REDESIGN
 *
 * "The Modulation Machine" - Professional phaser with mode presets
 *
 * Features:
 * - 7 phaser modes (vintage, modern, deep, stereo, resonant, subtle, custom)
 * - Real-time spectral visualization
 * - useAudioPlugin hook with metrics
 * - Ghost value feedback
 * - 3-panel professional layout
 * - Category theming: modulation-machines (purple/pink)
 *
 * Design Philosophy:
 * - "From vintage warmth to modern intensity"
 * - Visual feedback of phase modulation
 * - Presets for common phaser styles
 */

// ============================================================================
// PHASER MODES
// ============================================================================

const PHASER_MODES = {
  'vintage': {
    id: 'vintage',
    name: 'Vintage',
    icon: '🎸',
    description: 'Classic 70s phaser',
    settings: {
      rate: 0.5,
      depth: 0.6,
      stages: 4,
      feedback: 0.3,
      stereoPhase: 90,
      wet: 0.7
    }
  },
  'modern': {
    id: 'modern',
    name: 'Modern',
    icon: '⚡',
    description: 'Clean & precise sweep',
    settings: {
      rate: 1.5,
      depth: 0.8,
      stages: 6,
      feedback: 0.2,
      stereoPhase: 90,
      wet: 0.6
    }
  },
  'deep': {
    id: 'deep',
    name: 'Deep',
    icon: '🌊',
    description: 'Slow, deep modulation',
    settings: {
      rate: 0.2,
      depth: 0.9,
      stages: 8,
      feedback: 0.5,
      stereoPhase: 90,
      wet: 0.8
    }
  },
  'stereo': {
    id: 'stereo',
    name: 'Stereo Wide',
    icon: '🎭',
    description: 'Wide stereo imaging',
    settings: {
      rate: 0.8,
      depth: 0.7,
      stages: 6,
      feedback: 0.4,
      stereoPhase: 180,
      wet: 0.75
    }
  },
  'resonant': {
    id: 'resonant',
    name: 'Resonant',
    icon: '🔊',
    description: 'High feedback sweep',
    settings: {
      rate: 1.0,
      depth: 0.75,
      stages: 8,
      feedback: 0.75,
      stereoPhase: 90,
      wet: 0.65
    }
  },
  'subtle': {
    id: 'subtle',
    name: 'Subtle',
    icon: '✨',
    description: 'Gentle enhancement',
    settings: {
      rate: 0.3,
      depth: 0.4,
      stages: 4,
      feedback: 0.1,
      stereoPhase: 90,
      wet: 0.4
    }
  },
  'custom': {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    description: 'Manual control',
    settings: {
      rate: 0.5,
      depth: 0.7,
      stages: 4,
      feedback: 0.5,
      stereoPhase: 90,
      wet: 0.5
    }
  }
};

// ============================================================================
// SPECTRAL PHASER VISUALIZER
// ============================================================================

const SpectralPhaserVisualizer = ({ rate, depth, stages, feedback, inputLevel }) => {
  const timeRef = useRef(0);

  const drawSpectrum = useCallback((ctx, width, height) => {
    const time = timeRef.current;

    // Dark background with subtle gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(10, 5, 20, 0.3)');
    bgGradient.addColorStop(1, 'rgba(30, 10, 40, 0.3)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const centerY = height / 2;

    // Draw frequency spectrum with phaser notches
    const numBands = 80;
    const bandWidth = width / numBands;

    for (let i = 0; i < numBands; i++) {
      const freq = 20 * Math.pow(2, (i / numBands) * 10); // 20Hz to ~20kHz (log scale)
      const x = i * bandWidth;

      // LFO modulation
      const lfo = Math.sin(time * rate * 0.001) * depth;

      // Phaser notch positions (multiple notches based on stages)
      let magnitude = 1.0;
      for (let stage = 0; stage < stages; stage++) {
        const notchFreq = 200 + lfo * 1800 + stage * 300; // Sweeping notches
        const notchWidth = 100 + feedback * 200;

        // Create notch (frequency attenuation)
        const distance = Math.abs(freq - notchFreq);
        const attenuation = Math.max(0, 1 - (distance / notchWidth));
        magnitude *= (1 - attenuation * 0.8);
      }

      // Add input level modulation
      magnitude *= (0.3 + inputLevel * 0.7);

      // Bar height
      const barHeight = magnitude * height * 0.4;

      // Color gradient based on magnitude (purple to pink)
      const hue = 280 + magnitude * 40; // 280 (purple) to 320 (pink)
      const saturation = 70 + magnitude * 20;
      const lightness = 40 + magnitude * 30;

      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      ctx.fillRect(x, centerY - barHeight / 2, bandWidth - 1, barHeight);

      // Glow effect on peaks
      if (magnitude > 0.7) {
        ctx.shadowColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        ctx.shadowBlur = 10;
        ctx.fillRect(x, centerY - barHeight / 2, bandWidth - 1, barHeight);
        ctx.shadowBlur = 0;
      }
    }

    // Draw center line
    ctx.strokeStyle = 'rgba(200, 100, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw LFO waveform overlay
    ctx.strokeStyle = 'rgba(255, 100, 200, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < width; x += 4) {
      const phase = (x / width) * Math.PI * 4 + time * rate * 0.001;
      const lfo = Math.sin(phase) * depth;
      const y = centerY + lfo * height * 0.3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Update time
    timeRef.current += 16;
  }, [rate, depth, stages, feedback, inputLevel]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawSpectrum,
    [rate, depth, stages, feedback, inputLevel]
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

export const VortexPhaserUI = ({ trackId, effect, onChange }) => {
  const {
    rate = 0.5,
    depth = 0.7,
    stages = 4,
    feedback = 0.5,
    stereoPhase = 90,
    wet = 0.5
  } = effect.settings;

  const [selectedMode, setSelectedMode] = useState('custom');

  // Audio plugin hook with metrics
  const { plugin, metrics, isPlaying, getFrequencyData } = useAudioPlugin(
    trackId,
    effect.id,
    {
      fftSize: 2048,
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
  const ghostStages = useGhostValue(stages, 400);
  const ghostFeedback = useGhostValue(feedback * 100, 400);
  const ghostStereoPhase = useGhostValue(stereoPhase, 400);
  const ghostWet = useGhostValue(wet * 100, 400);

  // Mode selection handler
  const handleModeSelect = useCallback((modeId) => {
    setSelectedMode(modeId);
    const mode = PHASER_MODES[modeId];
    if (mode && mode.settings) {
      Object.entries(mode.settings).forEach(([key, value]) => {
        onChange(key, value);
      });
    }
  }, [onChange]);

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-purple-950/30 to-black p-4 flex gap-4 overflow-hidden">

      {/* ===== LEFT PANEL: Mode Selector ===== */}
      <div className="w-[220px] flex-shrink-0 flex flex-col gap-4">

        {/* Plugin Header */}
        <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-xl px-4 py-3 border border-purple-500/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🌀</div>
            <div className="flex-1">
              <div className="text-sm font-black text-purple-300 tracking-wider uppercase">
                Vortex Phaser
              </div>
              <div className="text-[9px] text-pink-400/70">Modulation Machines</div>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <ModeSelector
          modes={Object.values(PHASER_MODES).map(mode => ({
            id: mode.id,
            label: mode.name,
            icon: mode.icon,
            description: mode.description
          }))}
          activeMode={selectedMode}
          onChange={handleModeSelect}
          orientation="vertical"
          category="modulation-machines"
          className="flex-1"
        />

        {/* Mode Description */}
        <div className="bg-gradient-to-br from-purple-900/20 to-black/50 rounded-xl p-4 border border-purple-500/10">
          <div className="text-[9px] text-purple-300/70 font-bold uppercase tracking-wider mb-2">
            Mode Info
          </div>
          <div className="text-[10px] text-white/70 leading-relaxed">
            {PHASER_MODES[selectedMode].description}
          </div>
        </div>

        {/* Category Badge */}
        <div className="mt-auto bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-lg px-3 py-2 border border-purple-500/20 text-center">
          <div className="text-[8px] text-pink-400/50 uppercase tracking-wider">Category</div>
          <div className="text-[10px] text-purple-300 font-bold">Modulation Machines</div>
        </div>
      </div>

      {/* ===== CENTER PANEL: Visualization + Controls ===== */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Spectral Visualizer */}
        <div className="h-[240px] bg-black/40 rounded-xl border border-purple-500/20 overflow-hidden">
          <SpectralPhaserVisualizer
            rate={rate}
            depth={depth}
            stages={Math.round(stages)}
            feedback={feedback}
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
              max={10}
              defaultValue={0.5}
              sizeVariant="large"
              category="modulation-machines"
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
              defaultValue={70}
              sizeVariant="large"
              category="modulation-machines"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />

            {/* Stages */}
            <Knob
              label="STAGES"
              value={stages}
              ghostValue={ghostStages}
              onChange={(val) => onChange('stages', Math.round(val))}
              min={2}
              max={12}
              defaultValue={4}
              sizeVariant="large"
              category="modulation-machines"
              valueFormatter={(v) => `${Math.round(v)}`}
            />
          </div>
        </div>

        {/* Secondary Controls */}
        <div className="bg-gradient-to-br from-purple-900/20 to-black/40 rounded-xl p-6 border border-purple-500/20">
          <div className="grid grid-cols-3 gap-6">

            {/* Feedback */}
            <Knob
              label="FEEDBACK"
              value={feedback * 100}
              ghostValue={ghostFeedback}
              onChange={(val) => onChange('feedback', val / 100)}
              min={0}
              max={95}
              defaultValue={50}
              sizeVariant="medium"
              category="modulation-machines"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />

            {/* Stereo Phase */}
            <Knob
              label="STEREO"
              value={stereoPhase}
              ghostValue={ghostStereoPhase}
              onChange={(val) => onChange('stereoPhase', val)}
              min={0}
              max={180}
              defaultValue={90}
              sizeVariant="medium"
              category="modulation-machines"
              valueFormatter={(v) => `${v.toFixed(0)}°`}
            />

            {/* Mix */}
            <Knob
              label="MIX"
              value={wet * 100}
              ghostValue={ghostWet}
              onChange={(val) => onChange('wet', val / 100)}
              min={0}
              max={100}
              defaultValue={50}
              sizeVariant="medium"
              category="modulation-machines"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />
          </div>
        </div>
      </div>

      {/* ===== RIGHT PANEL: Stats ===== */}
      <div className="w-[200px] flex-shrink-0 flex flex-col gap-4">

        {/* Processing Stats */}
        <div className="bg-gradient-to-br from-purple-900/20 to-black/40 rounded-xl p-4 border border-purple-500/10">
          <div className="text-[9px] text-purple-300/70 uppercase tracking-wider mb-3 font-bold">
            Processing
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Mode</span>
              <span className="text-purple-300 text-[9px] font-medium">
                {PHASER_MODES[selectedMode].name}
              </span>
            </div>
            <div className="pt-2 border-t border-purple-500/10">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-white/50">Rate</span>
                <span className="text-pink-400 font-mono font-bold tabular-nums">
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
              <span className="text-white/50">Stages</span>
              <span className="text-pink-400 font-mono font-bold tabular-nums">
                {Math.round(stages)}
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Feedback</span>
              <span className="text-purple-300 font-mono font-bold tabular-nums">
                {(feedback * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Stereo</span>
              <span className="text-pink-400 font-mono font-bold tabular-nums">
                {stereoPhase.toFixed(0)}°
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Mix</span>
              <span className="text-purple-300 font-mono font-bold tabular-nums">
                {(wet * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Input</span>
              <span className="text-pink-400 font-mono font-bold tabular-nums">
                {(inputLevel * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Phaser Explanation */}
        <div className="flex-1 bg-gradient-to-br from-purple-900/10 to-black/40 rounded-xl p-4 border border-purple-500/10">
          <div className="text-[9px] text-purple-300/70 font-bold uppercase tracking-wider mb-3">
            About Phaser
          </div>
          <div className="space-y-2 text-[9px] text-white/50 leading-relaxed">
            <p>
              <span className="text-pink-400 font-bold">All-Pass Filters:</span> Create frequency notches that sweep through the spectrum
            </p>
            <p>
              <span className="text-purple-300 font-bold">Stages:</span> More stages = more notches = deeper effect
            </p>
            <p>
              <span className="text-pink-400 font-bold">Feedback:</span> Enhances resonance at notch points
            </p>
            <p className="text-white/30 italic pt-2 text-[8px]">
              💡 Classic effect used in rock, funk, and electronic music
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
