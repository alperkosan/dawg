import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Knob, ModeSelector } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

/**
 * TIDAL FILTER V2.0 - COMPLETE REDESIGN
 *
 * "The Spectral Weaver" - Professional auto-filter with mode presets
 *
 * Features:
 * - 7 filter modes (low-sweep, high-rise, band-wave, notch-cut, resonant, gentle, custom)
 * - Real-time frequency sweep visualization
 * - useAudioPlugin hook with metrics
 * - Ghost value feedback
 * - 3-panel professional layout
 * - Category theming: spectral-weave (cyan/teal/green)
 *
 * Design Philosophy:
 * - "From gentle waves to tidal storms"
 * - Visual feedback of frequency modulation
 * - Tempo-synced sweeps
 */

// ============================================================================
// FILTER MODES
// ============================================================================

const FILTER_MODES = {
  'low-sweep': {
    id: 'low-sweep',
    name: 'Low Sweep',
    icon: '↘️',
    description: 'Classic low-pass sweep',
    settings: {
      cutoff: 1000,
      resonance: 0.6,
      filterType: 0, // Lowpass
      drive: 1.5,
      wet: 1.0
    }
  },
  'high-rise': {
    id: 'high-rise',
    name: 'High Rise',
    icon: '↗️',
    description: 'Soaring high-pass sweep',
    settings: {
      cutoff: 2000,
      resonance: 0.5,
      filterType: 1, // Highpass
      drive: 1.2,
      wet: 1.0
    }
  },
  'band-wave': {
    id: 'band-wave',
    name: 'Band Wave',
    icon: '〰️',
    description: 'Focused band-pass sweep',
    settings: {
      cutoff: 1500,
      resonance: 0.8,
      filterType: 0.5, // Bandpass
      drive: 1.8,
      wet: 0.9
    }
  },
  'notch-cut': {
    id: 'notch-cut',
    name: 'Notch Cut',
    icon: '⌄',
    description: 'Surgical notch filter',
    settings: {
      cutoff: 800,
      resonance: 0.9,
      filterType: 0.9, // Notch
      drive: 1.0,
      wet: 0.8
    }
  },
  'resonant': {
    id: 'resonant',
    name: 'Resonant',
    icon: '🔊',
    description: 'High resonance sweep',
    settings: {
      cutoff: 1200,
      resonance: 0.95,
      filterType: 0.2, // LP with resonance
      drive: 2.0,
      wet: 0.85
    }
  },
  'gentle': {
    id: 'gentle',
    name: 'Gentle',
    icon: '✨',
    description: 'Subtle filter movement',
    settings: {
      cutoff: 3000,
      resonance: 0.2,
      filterType: 0.1,
      drive: 1.0,
      wet: 0.5
    }
  },
  'custom': {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    description: 'Manual control',
    settings: {
      cutoff: 1000,
      resonance: 0.5,
      filterType: 0,
      drive: 1.0,
      wet: 1.0
    }
  }
};

// ============================================================================
// FILTER SWEEP VISUALIZER
// ============================================================================

const FilterSweepVisualizer = ({ cutoff, resonance, filterType, drive, inputLevel }) => {
  const timeRef = useRef(0);

  const getFilterTypeName = (type) => {
    if (type <= 0.33) return 'LOWPASS';
    if (type <= 0.66) return 'BANDPASS';
    if (type <= 0.85) return 'HIGHPASS';
    return 'NOTCH';
  };

  const drawFilterResponse = useCallback((ctx, width, height) => {
    const time = timeRef.current;

    // Dark background with gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(5, 15, 20, 0.3)');
    bgGradient.addColorStop(1, 'rgba(0, 25, 30, 0.3)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const centerY = height / 2;

    // Draw frequency grid
    ctx.strokeStyle = 'rgba(50, 100, 120, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Frequency labels
      const freq = 20 * Math.pow(1000, i / 10);
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(100, 200, 220, 0.4)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${freq < 1000 ? freq.toFixed(0) : (freq / 1000).toFixed(1) + 'k'}`, x, height - 5);
      }
    }

    // Draw horizontal grid
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Calculate filter response curve
    ctx.strokeStyle = '#06b6d4'; // cyan
    ctx.lineWidth = 3;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 12;

    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const freq = 20 * Math.pow(1000, x / width);
      const ratio = freq / cutoff;
      let response = 1;

      // Calculate response based on filter type
      if (filterType <= 0.33) {
        // Lowpass
        const mix = filterType * 3;
        const lpResponse = 1 / Math.sqrt(1 + Math.pow(ratio, 4 + resonance * 8));
        const bpResponse = (resonance * 2) / Math.sqrt(1 + Math.pow((ratio - 1) / (resonance + 0.1), 2));
        response = lpResponse * (1 - mix * 0.5) + bpResponse * mix * 0.5;
      } else if (filterType <= 0.66) {
        // Bandpass
        const mix = (filterType - 0.33) * 3;
        const bpResponse = (resonance * 2) / Math.sqrt(1 + Math.pow((ratio - 1) / (resonance + 0.1), 2));
        const hpResponse = Math.pow(ratio, 2 + resonance * 4) / Math.sqrt(1 + Math.pow(ratio, 4 + resonance * 8));
        response = bpResponse * (1 - mix) + hpResponse * mix;
      } else {
        // Highpass to Notch
        const mix = (filterType - 0.66) * 3;
        const hpResponse = Math.pow(ratio, 2 + resonance * 4) / Math.sqrt(1 + Math.pow(ratio, 4 + resonance * 8));
        const notchResponse = 1 - (resonance * 2) / Math.sqrt(1 + Math.pow((ratio - 1) / (resonance + 0.1), 2));
        response = hpResponse * (1 - mix) + notchResponse * mix;
      }

      // Apply drive influence on response
      response = Math.pow(response, 1 / (drive * 0.5 + 0.5));

      // Add input level animation
      const animation = Math.sin(time * 0.003) * inputLevel * 0.1;
      response *= (1 + animation);

      const y = centerY - (response * height * 0.35);

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw cutoff frequency line
    const cutoffX = (Math.log(cutoff / 20) / Math.log(1000)) * width;
    ctx.strokeStyle = '#14b8a6'; // teal
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(cutoffX, 0);
    ctx.lineTo(cutoffX, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cutoff label
    ctx.fillStyle = '#14b8a6';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = cutoffX > width / 2 ? 'right' : 'left';
    ctx.fillText(`${cutoff.toFixed(0)}Hz`, cutoffX + (cutoffX > width / 2 ? -8 : 8), 20);

    // Filter type indicator
    ctx.fillStyle = 'rgba(100, 200, 220, 0.8)';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(getFilterTypeName(filterType), width / 2, 30);

    // Resonance indicator
    if (resonance > 0.5) {
      ctx.fillStyle = `rgba(255, 200, 100, ${resonance - 0.5})`;
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`RES: ${(resonance * 100).toFixed(0)}%`, width - 10, 20);
    }

    // Update time
    timeRef.current += 16;
  }, [cutoff, resonance, filterType, drive, inputLevel]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawFilterResponse,
    [cutoff, resonance, filterType, drive, inputLevel]
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

export const TidalFilterUI = ({ trackId, effect, onChange }) => {
  const {
    cutoff = 1000,
    resonance = 0.5,
    filterType = 0,
    drive = 1.0,
    wet = 1.0
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
  const ghostCutoff = useGhostValue(cutoff, 400);
  const ghostResonance = useGhostValue(resonance * 100, 400);
  const ghostFilterType = useGhostValue(filterType * 100, 400);
  const ghostDrive = useGhostValue(drive, 400);
  const ghostWet = useGhostValue(wet * 100, 400);

  // Mode selection handler
  const handleModeSelect = useCallback((modeId) => {
    setSelectedMode(modeId);
    const mode = FILTER_MODES[modeId];
    if (mode && mode.settings) {
      Object.entries(mode.settings).forEach(([key, value]) => {
        onChange(key, value);
      });
    }
  }, [onChange]);

  // Filter type name helper
  const getFilterTypeName = (type) => {
    if (type <= 0.33) return 'Lowpass';
    if (type <= 0.66) return 'Bandpass';
    if (type <= 0.85) return 'Highpass';
    return 'Notch';
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-teal-950/20 to-black p-4 flex gap-4 overflow-hidden">

      {/* ===== LEFT PANEL: Mode Selector ===== */}
      <div className="w-[220px] flex-shrink-0 flex flex-col gap-4">

        {/* Plugin Header */}
        <div className="bg-gradient-to-r from-cyan-900/40 to-teal-900/40 rounded-xl px-4 py-3 border border-cyan-500/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🌊</div>
            <div className="flex-1">
              <div className="text-sm font-black text-cyan-300 tracking-wider uppercase">
                Tidal Filter
              </div>
              <div className="text-[9px] text-teal-400/70">Spectral Weaver</div>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <ModeSelector
          modes={Object.values(FILTER_MODES).map(mode => ({
            id: mode.id,
            label: mode.name,
            icon: mode.icon,
            description: mode.description
          }))}
          activeMode={selectedMode}
          onChange={handleModeSelect}
          orientation="vertical"
          category="spectral-weave"
          className="flex-1"
        />

        {/* Mode Description */}
        <div className="bg-gradient-to-br from-cyan-900/20 to-black/50 rounded-xl p-4 border border-cyan-500/10">
          <div className="text-[9px] text-teal-300/70 font-bold uppercase tracking-wider mb-2">
            Mode Info
          </div>
          <div className="text-[10px] text-white/70 leading-relaxed">
            {FILTER_MODES[selectedMode].description}
          </div>
        </div>

        {/* Category Badge */}
        <div className="mt-auto bg-gradient-to-r from-cyan-900/40 to-teal-900/40 rounded-lg px-3 py-2 border border-cyan-500/20 text-center">
          <div className="text-[8px] text-teal-400/50 uppercase tracking-wider">Category</div>
          <div className="text-[10px] text-cyan-300 font-bold">Spectral Weaver</div>
        </div>
      </div>

      {/* ===== CENTER PANEL: Visualization + Controls ===== */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Filter Sweep Visualizer */}
        <div className="h-[240px] bg-black/40 rounded-xl border border-cyan-500/20 overflow-hidden">
          <FilterSweepVisualizer
            cutoff={cutoff}
            resonance={resonance}
            filterType={filterType}
            drive={drive}
            inputLevel={inputLevel}
          />
        </div>

        {/* Main Controls */}
        <div className="bg-gradient-to-br from-cyan-900/20 to-black/40 rounded-xl p-6 border border-cyan-500/20">
          <div className="grid grid-cols-3 gap-6">

            {/* Cutoff */}
            <Knob
              label="CUTOFF"
              value={cutoff}
              ghostValue={ghostCutoff}
              onChange={(val) => onChange('cutoff', val)}
              min={20}
              max={20000}
              defaultValue={1000}
              logarithmic
              sizeVariant="large"
              category="spectral-weave"
              valueFormatter={(v) => `${v < 1000 ? v.toFixed(0) : (v / 1000).toFixed(1) + 'k'}Hz`}
            />

            {/* Resonance */}
            <Knob
              label="RESONANCE"
              value={resonance * 100}
              ghostValue={ghostResonance}
              onChange={(val) => onChange('resonance', val / 100)}
              min={0}
              max={100}
              defaultValue={50}
              sizeVariant="large"
              category="spectral-weave"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />

            {/* Filter Type */}
            <Knob
              label="TYPE"
              value={filterType * 100}
              ghostValue={ghostFilterType}
              onChange={(val) => onChange('filterType', val / 100)}
              min={0}
              max={100}
              defaultValue={0}
              sizeVariant="large"
              category="spectral-weave"
              valueFormatter={(v) => getFilterTypeName(v / 100)}
            />
          </div>
        </div>

        {/* Secondary Controls */}
        <div className="bg-gradient-to-br from-cyan-900/20 to-black/40 rounded-xl p-6 border border-cyan-500/20">
          <div className="grid grid-cols-2 gap-6">

            {/* Drive */}
            <Knob
              label="DRIVE"
              value={drive}
              ghostValue={ghostDrive}
              onChange={(val) => onChange('drive', val)}
              min={1}
              max={10}
              defaultValue={1}
              sizeVariant="medium"
              category="spectral-weave"
              valueFormatter={(v) => `${v.toFixed(1)}x`}
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
              category="spectral-weave"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />
          </div>
        </div>
      </div>

      {/* ===== RIGHT PANEL: Stats ===== */}
      <div className="w-[200px] flex-shrink-0 flex flex-col gap-4">

        {/* Processing Stats */}
        <div className="bg-gradient-to-br from-cyan-900/20 to-black/40 rounded-xl p-4 border border-cyan-500/10">
          <div className="text-[9px] text-teal-300/70 uppercase tracking-wider mb-3 font-bold">
            Processing
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Mode</span>
              <span className="text-cyan-300 text-[9px] font-medium">
                {FILTER_MODES[selectedMode].name}
              </span>
            </div>
            <div className="pt-2 border-t border-cyan-500/10">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-white/50">Cutoff</span>
                <span className="text-teal-400 font-mono font-bold tabular-nums">
                  {cutoff < 1000 ? `${cutoff.toFixed(0)}Hz` : `${(cutoff / 1000).toFixed(1)}kHz`}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Resonance</span>
              <span className="text-cyan-300 font-mono font-bold tabular-nums">
                {(resonance * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Type</span>
              <span className="text-teal-400 font-mono font-bold tabular-nums">
                {getFilterTypeName(filterType)}
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Drive</span>
              <span className="text-cyan-300 font-mono font-bold tabular-nums">
                {drive.toFixed(1)}x
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Mix</span>
              <span className="text-teal-400 font-mono font-bold tabular-nums">
                {(wet * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Input</span>
              <span className="text-cyan-300 font-mono font-bold tabular-nums">
                {(inputLevel * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Filter Explanation */}
        <div className="flex-1 bg-gradient-to-br from-cyan-900/10 to-black/40 rounded-xl p-4 border border-cyan-500/10">
          <div className="text-[9px] text-teal-300/70 font-bold uppercase tracking-wider mb-3">
            About Filters
          </div>
          <div className="space-y-2 text-[9px] text-white/50 leading-relaxed">
            <p>
              <span className="text-teal-400 font-bold">Cutoff:</span> Transition frequency point
            </p>
            <p>
              <span className="text-cyan-300 font-bold">Resonance:</span> Emphasis at cutoff frequency
            </p>
            <p>
              <span className="text-teal-400 font-bold">Type:</span> Filter shape (LP/BP/HP/Notch)
            </p>
            <p>
              <span className="text-cyan-300 font-bold">Drive:</span> Input gain with saturation
            </p>
            <p className="text-white/30 italic pt-2 text-[8px]">
              💡 State-variable filter with smooth morphing
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
