import React, { useState, useCallback, useEffect } from 'react';
import { Knob, ModeSelector, ExpandablePanel } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

/**
 * CLIPPER - The Hard Edge
 *
 * "The Texture Lab" - Aggressive peak shaping with harmonic generation
 *
 * Features:
 * - 6 clipping algorithms (Hard, Soft, Tube, Diode, Foldback, Bitcrush)
 * - Category theming ('texture-lab' - orange palette)
 * - Ghost value feedback
 * - Mode-based workflow
 * - Real-time clipping visualization
 */

// Clipper Modes
const CLIPPER_MODES = {
  HARD: {
    id: 'hard',
    name: 'HARD',
    icon: '⚡',
    description: 'Digital brick wall clipping',
    settings: { mode: 0, hardness: 100, harmonics: 30 }
  },
  SOFT: {
    id: 'soft',
    name: 'SOFT',
    icon: '🌊',
    description: 'Smooth saturation curve',
    settings: { mode: 1, hardness: 50, harmonics: 60 }
  },
  TUBE: {
    id: 'tube',
    name: 'TUBE',
    icon: '📻',
    description: 'Vacuum tube saturation',
    settings: { mode: 2, hardness: 40, harmonics: 80 }
  },
  DIODE: {
    id: 'diode',
    name: 'DIODE',
    icon: '🔌',
    description: 'Transistor/diode clipping',
    settings: { mode: 3, hardness: 60, harmonics: 70 }
  },
  FOLDBACK: {
    id: 'foldback',
    name: 'FOLDBACK',
    icon: '🌀',
    description: 'Wave folding distortion',
    settings: { mode: 4, hardness: 100, harmonics: 80 }
  },
  BITCRUSH: {
    id: 'bitcrush',
    name: 'BITCRUSH',
    icon: '🎮',
    description: 'Digital lo-fi crushing',
    settings: { mode: 5, hardness: 70, harmonics: 60 }
  }
};

// Clipping Waveform Visualizer
const ClippingVisualizer = ({ trackId, effectId, ceiling, mode, clippingPercentage }) => {
  const { isPlaying, getTimeDomainData, metricsDb } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true,
    rmsSmoothing: 0.3,
    peakSmoothing: 0.2
  });

  const drawClipping = useCallback((ctx, width, height) => {
    // Clear with fade
    ctx.fillStyle = 'rgba(10, 10, 15, 0.3)';
    ctx.fillRect(0, 0, width, height);

    if (!isPlaying) {
      ctx.fillStyle = 'rgba(255, 107, 53, 0.5)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Audio Stopped', width / 2, height / 2);
      return;
    }

    const timeData = getTimeDomainData();
    if (!timeData) return;

    const ceilingLinear = Math.pow(10, ceiling / 20);
    const ceilingY = height / 2 - (ceilingLinear * height / 2);

    // Draw ceiling line
    ctx.strokeStyle = '#E63946';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, ceilingY);
    ctx.lineTo(width, ceilingY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height - ceilingY);
    ctx.lineTo(width, height - ceilingY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw waveform
    ctx.strokeStyle = '#FF6B35';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / timeData.length;
    let x = 0;

    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i];
      const y = (v + 1) * height / 2;

      // Change color if clipping
      if (Math.abs(v) > ceilingLinear * 0.95) {
        ctx.stroke();
        ctx.strokeStyle = '#E63946';
        ctx.beginPath();
        ctx.moveTo(x, y);
      }

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();

    // Ceiling labels
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#E63946';
    ctx.textAlign = 'left';
    ctx.fillText(`${ceiling.toFixed(1)}dB`, 10, ceilingY + 15);

    // Clipping indicator
    if (clippingPercentage > 5) {
      ctx.fillStyle = '#E63946';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`🔴 CLIPPING ${clippingPercentage.toFixed(0)}%`, width - 10, 20);
    }

    // Metrics
    ctx.fillStyle = 'rgba(255, 107, 53, 0.9)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`RMS: ${metricsDb.rmsDb.toFixed(1)}dB`, width - 10, height - 25);
    ctx.fillText(`PEAK: ${metricsDb.peakDb.toFixed(1)}dB`, width - 10, height - 10);

  }, [isPlaying, getTimeDomainData, ceiling, clippingPercentage, metricsDb]);

  const { containerRef, canvasRef } = useCanvasVisualization(drawClipping, [ceiling, mode, clippingPercentage]);

  return (
    <div ref={containerRef} className="w-full h-full bg-black/50 rounded-xl border border-[#FF6B35]/20">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// Main Clipper UI
export const ClipperUI = ({ trackId, effect, onChange }) => {
  const {
    ceiling = 0.0,
    hardness = 100,
    harmonics = 50,
    preGain = 0,
    postGain = 0,
    mix = 100,
    mode = 0,
    dcFilter = 1,
    oversample = 2
  } = effect.settings;

  const [selectedMode, setSelectedMode] = useState('hard');
  const [clippingPercentage, setClippingPercentage] = useState(0);

  // Ghost values
  const ghostCeiling = useGhostValue(ceiling, 400);
  const ghostHardness = useGhostValue(hardness, 400);
  const ghostHarmonics = useGhostValue(harmonics, 400);

  // Prepare modes
  const modes = Object.values(CLIPPER_MODES).map(m => ({
    id: m.id,
    label: m.name,
    icon: m.icon,
    description: m.description
  }));

  const currentMode = CLIPPER_MODES[selectedMode.toUpperCase()] || CLIPPER_MODES.HARD;

  // Audio plugin hook
  const { plugin } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: false
  });

  // Listen for metering from worklet
  React.useEffect(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    const handleMessage = (e) => {
      if (e.data.type === 'metering') {
        setClippingPercentage(e.data.data.clippingPercentage || 0);
      }
    };

    audioNode.port.onmessage = handleMessage;
    return () => {
      if (audioNode?.port) {
        audioNode.port.onmessage = null;
      }
    };
  }, [plugin]);

  // Mode change handler
  const handleModeChange = useCallback((modeId) => {
    setSelectedMode(modeId);
    const modeConfig = CLIPPER_MODES[modeId.toUpperCase()];
    if (modeConfig) {
      Object.entries(modeConfig.settings).forEach(([key, value]) => {
        onChange(key, value);
      });
    }
  }, [onChange]);

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-neutral-950 to-black p-4 flex gap-4 overflow-hidden">

      {/* LEFT PANEL: Mode Selection */}
      <div className="w-[240px] flex-shrink-0 flex flex-col gap-4">

        {/* Plugin Header */}
        <div className="bg-gradient-to-r from-[#2d1810] to-[#1a1a1a] rounded-xl px-4 py-3 border border-[#FF6B35]/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{currentMode?.icon || '⚡'}</div>
            <div className="flex-1">
              <div className="text-sm font-black text-[#FF6B35] tracking-wider uppercase">
                Clipper
              </div>
              <div className="text-[9px] text-[#FFC857]/70">The Texture Lab</div>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <ModeSelector
          modes={modes}
          activeMode={selectedMode}
          onChange={handleModeChange}
          orientation="vertical"
          category="texture-lab"
          className="flex-1"
        />

        {/* Quick Info */}
        <div className="bg-gradient-to-br from-[#2d1810]/50 to-black/50 rounded-xl p-3 border border-[#FF6B35]/10">
          <div className="text-[9px] text-[#FFC857]/70 font-bold uppercase tracking-wider mb-2">
            Current Mode
          </div>
          <div className="text-[10px] text-white/60 leading-relaxed">
            {currentMode?.description || 'Select a mode above'}
          </div>
        </div>
      </div>

      {/* CENTER PANEL: Visualization + Controls */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto pr-2">

        {/* Clipping Visualizer */}
        <div className="h-[180px]">
          <ClippingVisualizer
            trackId={trackId}
            effectId={effect.id}
            ceiling={ceiling}
            mode={mode}
            clippingPercentage={clippingPercentage}
          />
        </div>

        {/* Main Controls */}
        <div className="bg-gradient-to-br from-black/50 to-[#2d1810]/30 rounded-xl p-6 border border-[#FF6B35]/20">
          <div className="flex items-center justify-center gap-16">

            {/* Ceiling */}
            <Knob
              label="CEILING"
              value={ceiling}
              ghostValue={ghostCeiling}
              onChange={(val) => onChange('ceiling', val)}
              min={-10}
              max={3}
              defaultValue={0}
              sizeVariant="large"
              category="texture-lab"
              valueFormatter={(v) => `${v.toFixed(1)}dB`}
            />

            {/* Divider */}
            <div className="h-24 w-px bg-gradient-to-b from-transparent via-[#FF6B35]/30 to-transparent" />

            {/* Hardness */}
            <Knob
              label="HARDNESS"
              value={hardness}
              ghostValue={ghostHardness}
              onChange={(val) => onChange('hardness', val)}
              min={0}
              max={100}
              defaultValue={100}
              sizeVariant="large"
              category="texture-lab"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />

            {/* Divider */}
            <div className="h-24 w-px bg-gradient-to-b from-transparent via-[#FF6B35]/30 to-transparent" />

            {/* Harmonics */}
            <Knob
              label="HARMONICS"
              value={harmonics}
              ghostValue={ghostHarmonics}
              onChange={(val) => onChange('harmonics', val)}
              min={0}
              max={100}
              defaultValue={50}
              sizeVariant="large"
              category="texture-lab"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />
          </div>
        </div>

        {/* Advanced Controls */}
        <ExpandablePanel
          title="Advanced"
          icon="⚙️"
          category="texture-lab"
          defaultExpanded={false}
        >
          <div className="grid grid-cols-4 gap-6 p-4">

            {/* Pre Gain */}
            <Knob
              label="PRE GAIN"
              value={preGain}
              onChange={(val) => onChange('preGain', val)}
              min={-12}
              max={12}
              defaultValue={0}
              centerDetent={true}
              sizeVariant="medium"
              category="texture-lab"
              valueFormatter={(v) => `${v.toFixed(1)}dB`}
            />

            {/* Post Gain */}
            <Knob
              label="POST GAIN"
              value={postGain}
              onChange={(val) => onChange('postGain', val)}
              min={-12}
              max={12}
              defaultValue={0}
              centerDetent={true}
              sizeVariant="medium"
              category="texture-lab"
              valueFormatter={(v) => `${v.toFixed(1)}dB`}
            />

            {/* Mix */}
            <Knob
              label="MIX"
              value={mix}
              onChange={(val) => onChange('mix', val)}
              min={0}
              max={100}
              defaultValue={100}
              sizeVariant="medium"
              category="texture-lab"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />

            {/* Oversample */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-[9px] text-[#FFC857]/70 font-bold uppercase tracking-wider">
                OVERSAMPLE
              </div>
              <select
                value={oversample}
                onChange={(e) => onChange('oversample', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-black/50 border border-[#FF6B35]/30 rounded text-white text-sm"
              >
                <option value="1">OFF</option>
                <option value="2">2x</option>
                <option value="4">4x</option>
                <option value="8">8x</option>
              </select>
            </div>
          </div>

          {/* DC Filter Toggle */}
          <div className="px-4 pb-4 pt-2 border-t border-[#FF6B35]/10">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={dcFilter >= 0.5}
                onChange={(e) => onChange('dcFilter', e.target.checked ? 1 : 0)}
                className="w-4 h-4 rounded border-[#FF6B35]/30 bg-black/50 checked:bg-[#FF6B35] checked:border-[#FF6B35] transition-all"
              />
              <div>
                <div className="text-xs font-medium text-white group-hover:text-[#FF6B35] transition-colors">
                  DC Filter
                </div>
                <div className="text-[9px] text-white/40">Remove DC offset</div>
              </div>
            </label>
          </div>
        </ExpandablePanel>
      </div>

      {/* RIGHT PANEL: Stats + Info */}
      <div className="w-[300px] flex-shrink-0 flex flex-col gap-4">

        {/* Processing Stats */}
        <div className="bg-gradient-to-br from-black/50 to-[#2d1810]/30 rounded-xl p-4 border border-[#FF6B35]/10">
          <div className="text-[9px] text-[#FFC857]/70 uppercase tracking-wider mb-3 font-bold">
            Processing
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between">
              <span className="text-white/50">Ceiling</span>
              <span className="text-[#FF6B35] font-mono font-bold tabular-nums">
                {ceiling.toFixed(1)}dB
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Hardness</span>
              <span className="text-[#FF6B35] font-mono font-bold tabular-nums">
                {hardness.toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Harmonics</span>
              <span className="text-[#FF6B35] font-mono font-bold tabular-nums">
                {harmonics.toFixed(0)}%
              </span>
            </div>
            <div className="pt-2 border-t border-[#FF6B35]/10">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-white/50">Mode</span>
                <span className="text-[#FF6B35] text-[9px] font-medium">
                  {currentMode?.name}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="flex-1 bg-gradient-to-br from-[#2d1810]/20 to-black/50 rounded-xl p-4 border border-[#FF6B35]/10">
          <div className="text-[9px] text-[#FFC857]/70 font-bold uppercase tracking-wider mb-3">
            How It Works
          </div>
          <div className="space-y-2 text-[10px] text-white/50 leading-relaxed">
            <p>
              <span className="text-[#FF6B35] font-bold">Ceiling:</span> Clipping threshold
            </p>
            <p>
              <span className="text-[#FF6B35] font-bold">Hardness:</span> Soft to hard knee
            </p>
            <p>
              <span className="text-[#FF6B35] font-bold">Harmonics:</span> Add richness
            </p>
            <p className="pt-2 border-t border-[#FF6B35]/10 text-[9px]">
              Select a mode, then adjust amount to taste. Clipper adds aggressive character.
            </p>
          </div>
        </div>

        {/* Category Badge */}
        <div className="bg-gradient-to-r from-[#2d1810] to-[#1a1a1a] rounded-lg px-3 py-2 border border-[#FF6B35]/20 text-center">
          <div className="text-[8px] text-[#FFC857]/50 uppercase tracking-wider">Category</div>
          <div className="text-[10px] text-[#FF6B35] font-bold">The Texture Lab</div>
        </div>
      </div>

    </div>
  );
};

export default ClipperUI;
