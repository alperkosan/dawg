/**
 * TIDAL FILTER UI V2.0
 *
 * Professional auto-filter with spectral weaving
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming (spectral-weave)
 * ✅ Performance optimization with RAF batching
 *
 * Features:
 * - Real-time frequency response visualization
 * - State-variable filter with morphing
 * - Multiple filter types (LP/BP/HP/Notch)
 * - Drive saturation
 * - Professional factory presets (12 presets)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useAudioPlugin, useGhostValue } from '@/hooks/useAudioPlugin';
import { useMixerStore } from '@/store/useMixerStore';

// ============================================================================
// FILTER SWEEP VISUALIZER
// ============================================================================

const FilterSweepVisualizer = ({ cutoff, resonance, filterType, drive, trackId, effectId }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const timeRef = useRef(0);

  // Get audio metrics for input level
  const { metrics } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true
  });

  const [inputLevel, setInputLevel] = useState(0);
  useEffect(() => {
    if (metrics?.inputPeak !== undefined) {
      setInputLevel(Math.max(0, Math.min(1, (metrics.inputPeak + 60) / 60)));
    }
  }, [metrics]);

  const getFilterTypeName = (type) => {
    if (type <= 0.33) return 'LOWPASS';
    if (type <= 0.66) return 'BANDPASS';
    if (type <= 0.85) return 'HIGHPASS';
    return 'NOTCH';
  };

  const drawVisualization = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.width / dpr;
    const displayHeight = canvas.height / dpr;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);

    const time = timeRef.current;
    const centerY = displayHeight / 2;

    // Dark background with gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
    bgGradient.addColorStop(0, 'rgba(5, 15, 20, 0.95)');
    bgGradient.addColorStop(1, 'rgba(0, 25, 30, 0.95)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Draw frequency grid
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * displayWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, displayHeight);
      ctx.stroke();

      // Frequency labels
      const freq = 20 * Math.pow(1000, i / 10);
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(100, 200, 220, 0.5)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${freq < 1000 ? freq.toFixed(0) : (freq / 1000).toFixed(1) + 'k'}`, x, displayHeight - 5);
      }
    }

    // Draw horizontal grid
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * displayHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(displayWidth, y);
      ctx.stroke();
    }

    // Calculate filter response curve
    ctx.strokeStyle = '#06b6d4'; // cyan
    ctx.lineWidth = 3;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 12;

    ctx.beginPath();
    for (let x = 0; x < displayWidth; x++) {
      const freq = 20 * Math.pow(1000, x / displayWidth);
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

      const y = centerY - (response * displayHeight * 0.35);

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw cutoff frequency line
    const cutoffX = (Math.log(cutoff / 20) / Math.log(1000)) * displayWidth;
    ctx.strokeStyle = '#14b8a6'; // teal
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(cutoffX, 0);
    ctx.lineTo(cutoffX, displayHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cutoff label
    ctx.fillStyle = '#14b8a6';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = cutoffX > displayWidth / 2 ? 'right' : 'left';
    ctx.fillText(`${cutoff.toFixed(0)}Hz`, cutoffX + (cutoffX > displayWidth / 2 ? -8 : 8), 20);

    // Filter type indicator
    ctx.fillStyle = 'rgba(100, 200, 220, 0.9)';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(getFilterTypeName(filterType), displayWidth / 2, 30);

    // Resonance indicator
    if (resonance > 0.5) {
      ctx.fillStyle = `rgba(255, 200, 100, ${resonance - 0.5})`;
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`RES: ${(resonance * 100).toFixed(0)}%`, displayWidth - 10, 20);
    }

    ctx.restore();

    // Update time
    timeRef.current += 16;
  }, [cutoff, resonance, filterType, drive, inputLevel]);

  // Handle canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Use CanvasRenderManager for smooth rendering
  useRenderer(drawVisualization, 5, 16, [cutoff, resonance, filterType, drive, inputLevel]);

  return (
    <div ref={containerRef} className="w-full h-[220px] bg-black/50 rounded-xl border border-[#06b6d4]/20 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const TidalFilterUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  // Extract settings with defaults
  const {
    cutoff = 1000,
    resonance = 0.5,
    filterType = 0,
    drive = 1.0,
    wet = 1.0
  } = effect.settings || {};

  // Local state for UI
  const [localCutoff, setLocalCutoff] = useState(cutoff);
  const [localResonance, setLocalResonance] = useState(resonance);
  const [localFilterType, setLocalFilterType] = useState(filterType);
  const [localDrive, setLocalDrive] = useState(drive);
  const [localWet, setLocalWet] = useState(wet);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('spectral-weave'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam, setParams } = useParameterBatcher(effectNode);
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Ghost values
  const ghostCutoff = useGhostValue(localCutoff, 400);
  const ghostResonance = useGhostValue(localResonance * 100, 400);
  const ghostFilterType = useGhostValue(localFilterType * 100, 400);
  const ghostDrive = useGhostValue(localDrive, 400);
  const ghostWet = useGhostValue(localWet * 100, 400);

  // Sync with effect.settings when presets are loaded
  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    console.log('[TidalFilter] Preset loaded, updating parameters:', effect.settings);
    const updates = {};
    if (effect.settings.cutoff !== undefined) {
      setLocalCutoff(effect.settings.cutoff);
      updates.cutoff = effect.settings.cutoff;
    }
    if (effect.settings.resonance !== undefined) {
      setLocalResonance(effect.settings.resonance);
      updates.resonance = effect.settings.resonance;
    }
    if (effect.settings.filterType !== undefined) {
      setLocalFilterType(effect.settings.filterType);
      updates.filterType = effect.settings.filterType;
    }
    if (effect.settings.drive !== undefined) {
      setLocalDrive(effect.settings.drive);
      updates.drive = effect.settings.drive;
    }
    if (effect.settings.wet !== undefined) {
      setLocalWet(effect.settings.wet);
      updates.wet = effect.settings.wet;
    }

    // Send all parameter updates to worklet immediately
    // Note: Don't call handleMixerEffectChange here - it's already called by PresetManager
    if (Object.keys(updates).length > 0) {
      setParams(updates, { immediate: true });
    }
  }, [effect.settings, effectNode, setParams]);

  // Handle parameter changes
  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });

    // Update local state
    if (key === 'cutoff') setLocalCutoff(value);
    else if (key === 'resonance') setLocalResonance(value);
    else if (key === 'filterType') setLocalFilterType(value);
    else if (key === 'drive') setLocalDrive(value);
    else if (key === 'wet') setLocalWet(value);
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

  // Filter type name helper
  const getFilterTypeName = (type) => {
    if (type <= 0.33) return 'Lowpass';
    if (type <= 0.66) return 'Bandpass';
    if (type <= 0.85) return 'Highpass';
    return 'Notch';
  };

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
          <>
            {/* Filter Sweep Visualizer */}
            <FilterSweepVisualizer
              trackId={trackId}
              effectId={effect.id}
              cutoff={localCutoff}
              resonance={localResonance}
              filterType={localFilterType}
              drive={localDrive}
            />

            {/* Main Controls */}
            <div className="bg-gradient-to-br from-black/50 to-[#001829]/30 rounded-xl p-6 border border-[#06b6d4]/20">
              <div className="grid grid-cols-3 gap-6">
                <Knob
                  label="CUTOFF"
                  value={localCutoff}
                  ghostValue={ghostCutoff}
                  onChange={(val) => handleParamChange('cutoff', val)}
                  min={20}
                  max={20000}
                  defaultValue={1000}
                  logarithmic
                  sizeVariant="large"
                  category="spectral-weave"
                  valueFormatter={(v) => `${v < 1000 ? v.toFixed(0) : (v / 1000).toFixed(1) + 'k'}Hz`}
                />

                <Knob
                  label="RESONANCE"
                  value={localResonance * 100}
                  ghostValue={ghostResonance}
                  onChange={(val) => handleParamChange('resonance', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={50}
                  sizeVariant="large"
                  category="spectral-weave"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />

                <Knob
                  label="TYPE"
                  value={localFilterType * 100}
                  ghostValue={ghostFilterType}
                  onChange={(val) => handleParamChange('filterType', val / 100)}
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
            <div className="bg-gradient-to-br from-black/50 to-[#001829]/30 rounded-xl p-6 border border-[#06b6d4]/20">
              <div className="grid grid-cols-2 gap-6">
                <Knob
                  label="DRIVE"
                  value={localDrive}
                  ghostValue={ghostDrive}
                  onChange={(val) => handleParamChange('drive', val)}
                  min={1}
                  max={10}
                  defaultValue={1}
                  sizeVariant="medium"
                  category="spectral-weave"
                  valueFormatter={(v) => `${v.toFixed(1)}x`}
                />

                <Knob
                  label="MIX"
                  value={localWet * 100}
                  ghostValue={ghostWet}
                  onChange={(val) => handleParamChange('wet', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={100}
                  sizeVariant="medium"
                  category="spectral-weave"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />
              </div>
            </div>
          </>
        }

        sidePanel={
          <>
            {/* Processing Stats */}
            <div className="bg-gradient-to-br from-[#001829]/50 to-black/50 rounded-xl p-4 border border-[#06b6d4]/10">
              <div className="text-[9px] text-[#14b8a6]/70 font-bold uppercase tracking-wider mb-3">
                Processing
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Cutoff</span>
                  <span className="text-[#14b8a6] font-mono font-bold tabular-nums">
                    {localCutoff < 1000 ? `${localCutoff.toFixed(0)}Hz` : `${(localCutoff / 1000).toFixed(1)}kHz`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Resonance</span>
                  <span className="text-[#06b6d4] font-mono font-bold tabular-nums">
                    {(localResonance * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Type</span>
                  <span className="text-[#14b8a6] font-mono font-bold tabular-nums">
                    {getFilterTypeName(localFilterType)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Drive</span>
                  <span className="text-[#06b6d4] font-mono font-bold tabular-nums">
                    {localDrive.toFixed(1)}x
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Mix</span>
                  <span className="text-[#14b8a6] font-mono font-bold tabular-nums">
                    {(localWet * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Filter Explanation */}
            <div className="bg-gradient-to-br from-[#001829]/50 to-black/50 rounded-xl p-4 border border-[#06b6d4]/10">
              <div className="text-[9px] text-[#14b8a6]/70 font-bold uppercase tracking-wider mb-3">
                About Filters
              </div>
              <div className="space-y-2 text-[9px] text-white/50 leading-relaxed">
                <p>
                  <span className="text-[#14b8a6] font-bold">Cutoff:</span> Transition frequency point
                </p>
                <p>
                  <span className="text-[#06b6d4] font-bold">Resonance:</span> Emphasis at cutoff
                </p>
                <p>
                  <span className="text-[#14b8a6] font-bold">Type:</span> LP/BP/HP/Notch morphing
                </p>
                <p>
                  <span className="text-[#06b6d4] font-bold">Drive:</span> Input gain saturation
                </p>
                <p className="text-white/30 italic pt-2 text-[8px]">
                  💡 State-variable filter with smooth morphing
                </p>
              </div>
            </div>

            {/* About */}
            <div className="bg-gradient-to-br from-[#001829]/50 to-black/50 rounded-xl p-4 border border-[#06b6d4]/10">
              <div className="text-[9px] text-[#14b8a6]/70 font-bold uppercase tracking-wider mb-2">
                About
              </div>
              <div className="text-[10px] text-white/60 leading-relaxed">
                {definition.story}
              </div>
            </div>
          </>
        }
      />
    </PluginContainerV2>
  );
};

export default TidalFilterUI_V2;
