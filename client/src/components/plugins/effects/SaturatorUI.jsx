import React, { useState, useCallback } from 'react';
import { Knob, Slider, ModeSelector, ExpandablePanel } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';
import { SATURATOR_MODES, getModeParameters } from '@/config/presets/saturatorPresets';

/**
 * SATURATOR V2.0 - REDESIGNED WITH ENHANCED COMPONENTS
 *
 * "The Texture Lab" - Warm, organic analog saturation
 *
 * Features:
 * - Enhanced component library (Knob, Slider, ModeSelector, ExpandablePanel)
 * - Category theming ('texture-lab' - orange palette)
 * - Ghost value feedback (400ms visual lag)
 * - Mode-based workflow (8 presets)
 * - Real-time harmonic visualization
 * - Progressive disclosure (advanced settings)
 *
 * Design Philosophy:
 * - "One knob, infinite possibilities" via modes
 * - Visual feedback at every step
 * - Category-based color identity
 */

// ============================================================================
// HARMONIC VISUALIZER
// ============================================================================

const HarmonicVisualizer = ({ trackId, effectId, drive, mix }) => {
  const { isPlaying, getFrequencyData, metricsDb } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true,
    rmsSmoothing: 0.3,
    peakSmoothing: 0.2
  });

  const harmonicLevelsRef = React.useRef(new Array(6).fill(0));

  const drawHarmonics = useCallback((ctx, width, height) => {
    // Clear with subtle fade
    ctx.fillStyle = 'rgba(10, 10, 15, 0.3)';
    ctx.fillRect(0, 0, width, height);

    const freqData = getFrequencyData();

    if (isPlaying && freqData) {
      // Calculate harmonic content
      const fundamental = 100; // Hz
      const binWidth = 48000 / 2 / freqData.length;

      for (let i = 0; i < 6; i++) {
        const harmonic = fundamental * (i + 1);
        const binIndex = Math.floor(harmonic / binWidth);

        if (binIndex < freqData.length) {
          const dbValue = freqData[binIndex];
          const normalized = Math.max(0, Math.min(1, (dbValue + 100) / 100));
          harmonicLevelsRef.current[i] = harmonicLevelsRef.current[i] * 0.8 + normalized * 0.2;
        }
      }
    }

    // Draw harmonic bars
    const barWidth = width / 8;
    const maxHeight = height * 0.8;

    harmonicLevelsRef.current.forEach((level, i) => {
      const x = (i + 1) * barWidth;
      const barHeight = level * maxHeight;
      const y = height - barHeight;

      // Category-themed gradient (texture-lab orange)
      const gradient = ctx.createLinearGradient(x, y, x, height);
      if (drive < 0.3) {
        gradient.addColorStop(0, 'rgba(255, 107, 53, 0.8)'); // Orange
        gradient.addColorStop(1, 'rgba(255, 107, 53, 0.3)');
      } else if (drive < 0.7) {
        gradient.addColorStop(0, 'rgba(247, 147, 30, 0.8)'); // Warm orange
        gradient.addColorStop(1, 'rgba(247, 147, 30, 0.3)');
      } else {
        gradient.addColorStop(0, 'rgba(255, 200, 87, 0.9)'); // Bright amber
        gradient.addColorStop(1, 'rgba(255, 200, 87, 0.4)');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(x - barWidth / 3, y, barWidth / 1.5, barHeight);

      // Harmonic number label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`H${i + 1}`, x, height - 5);
    });

    // Metrics overlay
    if (isPlaying) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(width - 120, 10, 110, 60);

      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'right';

      ctx.fillStyle = 'rgba(255, 107, 53, 0.9)'; // texture-lab primary
      ctx.fillText(`RMS: ${metricsDb.rmsDb.toFixed(1)}dB`, width - 15, 30);

      ctx.fillStyle = 'rgba(255, 200, 87, 0.9)'; // texture-lab accent
      ctx.fillText(`PEAK: ${metricsDb.peakDb.toFixed(1)}dB`, width - 15, 45);

      ctx.fillStyle = metricsDb.clipping ? 'rgba(239, 68, 68, 0.9)' : 'rgba(34, 197, 94, 0.9)';
      ctx.fillText(metricsDb.clipping ? 'CLIP!' : 'OK', width - 15, 60);
    } else {
      // "Play to see" message
      ctx.fillStyle = 'rgba(255, 107, 53, 0.3)';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('▶ Play to see harmonics', width / 2, height / 2);
    }
  }, [isPlaying, getFrequencyData, metricsDb, drive]);

  const { containerRef, canvasRef } = useCanvasVisualization(drawHarmonics, [drive, mix, isPlaying]);

  return (
    <div ref={containerRef} className="w-full h-full bg-black/50 rounded-xl border border-[#FF6B35]/20">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SaturatorUI = ({ trackId, effect, onChange }) => {
  const {
    distortion = 0.4,
    wet = 1.0,
    tone = 0,
    lowCutFreq = 20,
    highCutFreq = 20000,
    autoGain = true,
    headroom = 0
  } = effect.settings;

  const [selectedMode, setSelectedMode] = useState('vocal-warmth');

  // Ghost values (400ms lag for smooth visual feedback)
  const ghostDrive = useGhostValue(distortion, 400);
  const ghostMix = useGhostValue(wet, 400);
  const ghostTone = useGhostValue(tone, 400);

  // Prepare modes for ModeSelector component
  const modes = Object.values(SATURATOR_MODES).map(mode => ({
    id: mode.id,
    label: mode.name,
    icon: mode.icon,
    description: mode.description
  }));

  const currentMode = SATURATOR_MODES[selectedMode];

  // Handle mode change
  const handleModeChange = (modeId) => {
    setSelectedMode(modeId);
    const params = getModeParameters(modeId, 50); // Default 50% amount

    // Apply mode parameters
    onChange('distortion', params.distortion);
    onChange('wet', params.wet);

    // Apply advanced parameters if they exist
    if (params.tone !== undefined) onChange('tone', params.tone);
    if (params.lowCutFreq !== undefined) onChange('lowCutFreq', params.lowCutFreq);
    if (params.highCutFreq !== undefined) onChange('highCutFreq', params.highCutFreq);
    if (params.autoGain !== undefined) onChange('autoGain', params.autoGain);
    if (params.headroom !== undefined) onChange('headroom', params.headroom);
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-neutral-950 to-black p-4 flex gap-4 overflow-hidden">

      {/* ===== LEFT PANEL: Mode Selection ===== */}
      <div className="w-[240px] flex-shrink-0 flex flex-col gap-4">

        {/* Plugin Header */}
        <div className="bg-gradient-to-r from-[#2d1810] to-[#1a1a1a] rounded-xl px-4 py-3 border border-[#FF6B35]/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{currentMode?.icon || '🔥'}</div>
            <div className="flex-1">
              <div className="text-sm font-black text-[#FF6B35] tracking-wider uppercase">
                Saturator
              </div>
              <div className="text-[9px] text-[#F7931E]/70">The Texture Lab</div>
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

      {/* ===== CENTER PANEL: Visualizer + Controls ===== */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto pr-2">

        {/* Harmonic Visualizer */}
        <div className="flex-1 min-h-0">
          <HarmonicVisualizer
            trackId={trackId}
            effectId={effect.id}
            drive={distortion}
            mix={wet}
          />
        </div>

        {/* Main Controls */}
        <div className="bg-gradient-to-br from-black/50 to-[#2d1810]/30 rounded-xl p-6 border border-[#FF6B35]/20">
          <div className="flex items-center justify-center gap-16">

            {/* Drive Knob */}
            <Knob
              label="DRIVE"
              value={distortion}
              ghostValue={ghostDrive}
              onChange={(val) => onChange('distortion', val)}
              min={0}
              max={1.5}
              defaultValue={0.4}
              sizeVariant="large"
              category="texture-lab"
              valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />

            {/* Divider */}
            <div className="h-24 w-px bg-gradient-to-b from-transparent via-[#FF6B35]/30 to-transparent" />

            {/* Mix Knob */}
            <Knob
              label="MIX"
              value={wet}
              ghostValue={ghostMix}
              onChange={(val) => onChange('wet', val)}
              min={0}
              max={1}
              defaultValue={1}
              sizeVariant="large"
              category="texture-lab"
              valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
          </div>
        </div>

        {/* Advanced Settings (Expandable) */}
        <ExpandablePanel
          title="Advanced Settings"
          icon="⚙️"
          category="texture-lab"
          defaultExpanded={false}
        >
          <div className="grid grid-cols-2 gap-6 p-4">

            {/* Tone Control */}
            <div>
              <Slider
                label="TONE"
                value={tone}
                ghostValue={ghostTone}
                onChange={(val) => onChange('tone', val)}
                min={-10}
                max={10}
                defaultValue={0}
                bipolar={true}
                centerDetent={true}
                category="texture-lab"
                valueFormatter={(v) => {
                  if (v > 0) return `+${v.toFixed(1)}`;
                  if (v < 0) return `${v.toFixed(1)}`;
                  return '0';
                }}
              />
            </div>

            {/* Low Cut Filter */}
            <div>
              <Slider
                label="LOW CUT"
                value={lowCutFreq}
                onChange={(val) => onChange('lowCutFreq', val)}
                min={20}
                max={500}
                defaultValue={20}
                logarithmic={true}
                showTicks={true}
                category="texture-lab"
                valueFormatter={(v) => `${v.toFixed(0)} Hz`}
              />
            </div>

            {/* High Cut Filter */}
            <div>
              <Slider
                label="HIGH CUT"
                value={highCutFreq}
                onChange={(val) => onChange('highCutFreq', val)}
                min={5000}
                max={20000}
                defaultValue={20000}
                logarithmic={true}
                showTicks={true}
                category="texture-lab"
                valueFormatter={(v) => {
                  if (v >= 1000) return `${(v / 1000).toFixed(1)} kHz`;
                  return `${v.toFixed(0)} Hz`;
                }}
              />
            </div>

            {/* Headroom */}
            <div>
              <Slider
                label="HEADROOM"
                value={headroom}
                onChange={(val) => onChange('headroom', val)}
                min={-6}
                max={6}
                defaultValue={0}
                bipolar={true}
                centerDetent={true}
                category="texture-lab"
                valueFormatter={(v) => `${v.toFixed(1)} dB`}
              />
            </div>
          </div>

          {/* Auto Gain Toggle */}
          <div className="px-4 pb-4 pt-2 border-t border-[#FF6B35]/10">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={autoGain}
                onChange={(e) => onChange('autoGain', e.target.checked)}
                className="w-4 h-4 rounded border-[#FF6B35]/30 bg-black/50 checked:bg-[#FF6B35] checked:border-[#FF6B35] transition-all"
              />
              <div>
                <div className="text-xs font-medium text-white group-hover:text-[#FF6B35] transition-colors">
                  Auto Gain Compensation
                </div>
                <div className="text-[10px] text-white/40">
                  Automatically adjusts output level to match input
                </div>
              </div>
            </label>
          </div>
        </ExpandablePanel>
      </div>

      {/* ===== RIGHT PANEL: Stats & Info ===== */}
      <div className="w-[200px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-2">

        {/* Processing Stats */}
        <div className="bg-gradient-to-br from-black/50 to-[#2d1810]/30 rounded-xl p-4 border border-[#FF6B35]/10">
          <div className="text-[9px] text-[#FFC857]/70 uppercase tracking-wider mb-3 font-bold">
            Processing
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Drive</span>
              <span className="text-[#FF6B35] font-mono font-bold tabular-nums">
                {(distortion * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Mix</span>
              <span className="text-[#F7931E] font-mono font-bold tabular-nums">
                {(wet * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Tone</span>
              <span className="text-[#FFC857] font-mono font-bold tabular-nums">
                {tone > 0 ? '+' : ''}{tone.toFixed(1)}
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
          <div className="text-[9px] text-white/50 leading-relaxed space-y-2">
            <p>
              <span className="text-[#FF6B35] font-bold">Drive:</span> Amount of harmonic saturation
            </p>
            <p>
              <span className="text-[#F7931E] font-bold">Mix:</span> Blend between dry and wet signal
            </p>
            <p>
              <span className="text-[#FFC857] font-bold">Tone:</span> Tilt EQ (bright/dark)
            </p>
            <p className="text-white/30 italic pt-2 text-[8px]">
              💡 Watch the harmonic bars grow as you increase drive
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
