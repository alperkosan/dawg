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
import { Knob, ModeSelector, Checkbox } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useAudioPlugin, useGhostValue } from '@/hooks/useAudioPlugin';
import { useMixerStore } from '@/store/useMixerStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';

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
    <div ref={containerRef} className="w-full h-[180px] bg-black/50 rounded-xl border border-[#06b6d4]/20 overflow-hidden">
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
    wet = 1.0,
    // ✅ NEW: Filter model and LFO
    filterModel = 0,
    lfoEnabled = 0,
    lfoRate = 1.0,
    lfoDepth = 0.5,
    lfoShape = 0,
    lfoTempoSync = 0,
    lfoNoteDivision = 3,
    bpm = 120
  } = effect.settings || {};

  // Get current BPM from playback store
  const { bpm: currentBpm } = usePlaybackStore();

  // Local state for UI
  const [localCutoff, setLocalCutoff] = useState(cutoff);
  const [localResonance, setLocalResonance] = useState(resonance);
  const [localFilterType, setLocalFilterType] = useState(filterType);
  const [localDrive, setLocalDrive] = useState(drive);
  const [localWet, setLocalWet] = useState(wet);
  // ✅ NEW: Filter model and LFO state
  const [localFilterModel, setLocalFilterModel] = useState(filterModel);
  const [localLfoEnabled, setLocalLfoEnabled] = useState(lfoEnabled);
  const [localLfoRate, setLocalLfoRate] = useState(lfoRate);
  const [localLfoDepth, setLocalLfoDepth] = useState(lfoDepth);
  const [localLfoShape, setLocalLfoShape] = useState(lfoShape);
  const [localLfoTempoSync, setLocalLfoTempoSync] = useState(lfoTempoSync);
  const [localLfoNoteDivision, setLocalLfoNoteDivision] = useState(lfoNoteDivision);

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

  // ✅ NEW: Update BPM when tempo changes
  useEffect(() => {
    if (currentBpm && effectNode) {
      setParam('bpm', currentBpm);
    }
  }, [currentBpm, effectNode, setParam]);

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
    // ✅ NEW: Filter model and LFO
    if (effect.settings.filterModel !== undefined) {
      setLocalFilterModel(effect.settings.filterModel);
      updates.filterModel = effect.settings.filterModel;
    }
    if (effect.settings.lfoEnabled !== undefined) {
      setLocalLfoEnabled(effect.settings.lfoEnabled);
      updates.lfoEnabled = effect.settings.lfoEnabled;
    }
    if (effect.settings.lfoRate !== undefined) {
      setLocalLfoRate(effect.settings.lfoRate);
      updates.lfoRate = effect.settings.lfoRate;
    }
    if (effect.settings.lfoDepth !== undefined) {
      setLocalLfoDepth(effect.settings.lfoDepth);
      updates.lfoDepth = effect.settings.lfoDepth;
    }
    if (effect.settings.lfoShape !== undefined) {
      setLocalLfoShape(effect.settings.lfoShape);
      updates.lfoShape = effect.settings.lfoShape;
    }
    if (effect.settings.lfoTempoSync !== undefined) {
      setLocalLfoTempoSync(effect.settings.lfoTempoSync);
      updates.lfoTempoSync = effect.settings.lfoTempoSync;
    }
    if (effect.settings.lfoNoteDivision !== undefined) {
      setLocalLfoNoteDivision(effect.settings.lfoNoteDivision);
      updates.lfoNoteDivision = effect.settings.lfoNoteDivision;
    }
    if (currentBpm) {
      updates.bpm = currentBpm;
    }

    // Send all parameter updates to worklet immediately
    // Note: Don't call handleMixerEffectChange here - it's already called by PresetManager
    if (Object.keys(updates).length > 0) {
      setParams(updates, { immediate: true });
    }
  }, [effect.settings, effectNode, setParams, currentBpm]);

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
    // ✅ NEW: Filter model and LFO
    else if (key === 'filterModel') setLocalFilterModel(value);
    else if (key === 'lfoEnabled') setLocalLfoEnabled(value);
    else if (key === 'lfoRate') setLocalLfoRate(value);
    else if (key === 'lfoDepth') setLocalLfoDepth(value);
    else if (key === 'lfoShape') setLocalLfoShape(value);
    else if (key === 'lfoTempoSync') setLocalLfoTempoSync(value);
    else if (key === 'lfoNoteDivision') setLocalLfoNoteDivision(value);
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
      <div
        className="w-full h-full flex flex-col gap-3 overflow-y-auto p-4"
        style={{
          background: `linear-gradient(135deg,
            ${categoryColors.accent}12 0%,
            #0a0a0a 50%,
            ${categoryColors.primary}06 100%)`
        }}
      >
            {/* Filter Sweep Visualizer */}
            <div className="flex-shrink-0">
              <FilterSweepVisualizer
                trackId={trackId}
                effectId={effect.id}
                cutoff={localCutoff}
                resonance={localResonance}
                filterType={localFilterType}
                drive={localDrive}
              />
            </div>

            {/* ✅ NEW: Filter Model Selector */}
            <div className="flex-shrink-0 bg-gradient-to-br from-black/50 to-[#001829]/30 rounded-xl p-3 border border-[#06b6d4]/20">
              <div className="text-[9px] text-[#14b8a6]/70 font-bold uppercase tracking-wider mb-2">
                FILTER MODEL
              </div>
              <ModeSelector
                modes={[
                  { id: 0, name: 'State-Var', description: 'Clean state-variable filter' },
                  { id: 1, name: 'Moog', description: 'Warm Moog ladder filter' },
                  { id: 2, name: 'Korg', description: 'Aggressive Korg MS-20 filter' },
                  { id: 3, name: 'Oberheim', description: 'Smooth Oberheim SEM filter' }
                ]}
                activeMode={localFilterModel}
                onChange={(mode) => handleParamChange('filterModel', mode)}
                category="spectral-weave"
                compact={true}
              />
            </div>

            {/* Main Controls */}
            <div className="flex-shrink-0 bg-gradient-to-br from-black/50 to-[#001829]/30 rounded-xl p-4 border border-[#06b6d4]/20">
              <div className="grid grid-cols-3 gap-4">
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
            <div className="flex-shrink-0 bg-gradient-to-br from-black/50 to-[#001829]/30 rounded-xl p-4 border border-[#06b6d4]/20">
              <div className="grid grid-cols-2 gap-4">
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

            {/* ✅ NEW: LFO Modulation */}
            <div className="flex-shrink-0 bg-gradient-to-br from-black/50 to-[#001829]/30 rounded-xl p-4 border border-[#06b6d4]/20">
              <div className="text-[9px] text-[#14b8a6]/70 font-bold uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>LFO MODULATION</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localLfoEnabled > 0.5}
                    onChange={(e) => handleParamChange('lfoEnabled', e.target.checked ? 1 : 0)}
                    className="w-4 h-4 rounded border-[#06b6d4]/30 bg-black/50 checked:bg-[#06b6d4] checked:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/50"
                  />
                  <span className="text-[10px] text-white/70">ENABLED</span>
                </label>
              </div>
              
              {localLfoEnabled > 0.5 && (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <Knob
                      label="RATE"
                      value={localLfoTempoSync > 0.5 ? 0 : localLfoRate}
                      onChange={(val) => handleParamChange('lfoRate', val)}
                      min={0.1}
                      max={20}
                      defaultValue={1.0}
                      sizeVariant="medium"
                      category="spectral-weave"
                      valueFormatter={(v) => `${v.toFixed(2)}Hz`}
                      disabled={localLfoTempoSync > 0.5}
                    />

                    <Knob
                      label="DEPTH"
                      value={localLfoDepth * 100}
                      onChange={(val) => handleParamChange('lfoDepth', val / 100)}
                      min={0}
                      max={100}
                      defaultValue={50}
                      sizeVariant="medium"
                      category="spectral-weave"
                      valueFormatter={(v) => `${v.toFixed(0)}%`}
                    />
                  </div>

                  <div className="mb-3">
                    <div className="text-[9px] text-[#14b8a6]/70 font-bold uppercase tracking-wider mb-2">
                      SHAPE
                    </div>
                    <ModeSelector
                      modes={[
                        { id: 0, name: 'Sine', description: 'Smooth sine wave' },
                        { id: 1, name: 'Triangle', description: 'Linear triangle wave' },
                        { id: 2, name: 'Square', description: 'Hard square wave' },
                        { id: 3, name: 'Saw', description: 'Rising sawtooth wave' }
                      ]}
                      activeMode={localLfoShape}
                      onChange={(mode) => handleParamChange('lfoShape', mode)}
                      category="spectral-weave"
                      compact={true}
                    />
                  </div>

                  <div className="mb-0">
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={localLfoTempoSync > 0.5}
                        onChange={(e) => handleParamChange('lfoTempoSync', e.target.checked ? 1 : 0)}
                        className="w-4 h-4 rounded border-[#06b6d4]/30 bg-black/50 checked:bg-[#06b6d4] checked:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/50"
                      />
                      <span className="text-[10px] text-white/70 font-bold uppercase">TEMPO SYNC</span>
                    </label>

                    {localLfoTempoSync > 0.5 && (
                      <ModeSelector
                        modes={[
                          { id: 0, name: '1/32', description: '1/32 note' },
                          { id: 1, name: '1/16', description: '1/16 note' },
                          { id: 2, name: '1/8', description: '1/8 note' },
                          { id: 3, name: '1/4', description: '1/4 note' },
                          { id: 4, name: '1/2', description: '1/2 note' },
                          { id: 5, name: '1/1', description: 'Whole note' },
                          { id: 6, name: '1/8.', description: 'Dotted 1/8 note' },
                          { id: 7, name: '1/4.', description: 'Dotted 1/4 note' },
                          { id: 8, name: '1/8t', description: '1/8 triplet' },
                          { id: 9, name: '1/4t', description: '1/4 triplet' }
                        ]}
                        activeMode={localLfoNoteDivision}
                        onChange={(mode) => handleParamChange('lfoNoteDivision', mode)}
                        category="spectral-weave"
                        compact={true}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
      </div>
    </PluginContainerV2>
  );
};

export default TidalFilterUI_V2;
