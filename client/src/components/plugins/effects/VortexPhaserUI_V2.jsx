/**
 * VORTEX PHASER UI V2.0
 *
 * Professional phaser effect with spectral visualization
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming (cosmic-modulation)
 * ✅ Performance optimization with RAF batching
 *
 * Features:
 * - Spectral phaser visualization
 * - Real-time modulation display
 * - Professional factory presets (13 presets)
 * - Multiple phaser characters (Vintage, Modern, Extreme, Subtle)
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
// SPECTRAL PHASER VISUALIZER
// ============================================================================

const SpectralPhaserVisualizer = ({ rate, depth, stages, feedback, trackId, effectId }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const timeRef = useRef(0);

  // Get audio metrics for input level
  const { metrics } = useAudioPlugin(trackId, effectId, {
    fftSize: 1024,
    updateMetrics: true
  });

  const [inputLevel, setInputLevel] = useState(0.5);
  useEffect(() => {
    if (metrics?.inputPeak !== undefined) {
      setInputLevel(Math.max(0, Math.min(1, (metrics.inputPeak + 60) / 60)));
    } else {
      setInputLevel(0.5); // Fallback
    }
  }, [metrics]);

  const drawVisualization = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.width / dpr;
    const displayHeight = canvas.height / dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const time = timeRef.current;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, displayWidth, displayHeight);
    gradient.addColorStop(0, 'rgba(20, 10, 30, 0.95)');
    gradient.addColorStop(1, 'rgba(30, 10, 40, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Grid
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * displayWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, displayHeight);
      ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const y = (i / 6) * displayHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(displayWidth, y);
      ctx.stroke();
    }

    // Draw notch positions (phaser stages)
    const numNotches = Math.floor(stages);
    const lfoValue = Math.sin(time * rate * 0.01) * depth;

    for (let stage = 0; stage < numNotches; stage++) {
      const baseFreq = 200 + (stage / numNotches) * 2000;
      const modulatedFreq = baseFreq + lfoValue * 1000;

      // Frequency to X position (log scale)
      const minFreq = 100;
      const maxFreq = 5000;
      const x = ((Math.log(modulatedFreq) - Math.log(minFreq)) / (Math.log(maxFreq) - Math.log(minFreq))) * displayWidth;

      // Draw notch line
      const alpha = 0.3 + (feedback * 0.4) + (inputLevel * 0.3);
      ctx.strokeStyle = `rgba(168, 85, 247, ${alpha})`;
      ctx.lineWidth = 2 + feedback * 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, displayHeight);
      ctx.stroke();

      // Draw glow
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 10 + feedback * 20;
      ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.5})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw sweep wave
    ctx.strokeStyle = 'rgba(216, 180, 254, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < displayWidth; x++) {
      const freq = 100 + (x / displayWidth) * 4900;
      const sweepValue = Math.sin(time * rate * 0.01 + (x / displayWidth) * Math.PI * 2);
      const y = displayHeight / 2 + sweepValue * depth * (displayHeight * 0.3) * inputLevel;

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Info text
    ctx.fillStyle = 'rgba(216, 180, 254, 0.8)';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${numNotches} Stages`, 10, 20);
    ctx.fillText(`Rate: ${rate.toFixed(2)} Hz`, 10, 35);
    ctx.fillText(`Depth: ${(depth * 100).toFixed(0)}%`, 10, 50);

    ctx.restore();
    timeRef.current += 1;
  }, [rate, depth, stages, feedback, inputLevel]);

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
  useRenderer(drawVisualization, 5, 16, [rate, depth, stages, feedback, inputLevel]);

  return (
    <div ref={containerRef} className="w-full h-[220px] bg-black/50 rounded-xl border border-[#a855f7]/20 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const VortexPhaserUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  // Extract settings with defaults
  const {
    rate = 0.5,
    depth = 0.6,
    stages = 4,
    feedback = 0.3,
    stereoPhase = 90,
    wet = 0.7
  } = effect.settings || {};

  // Local state for UI
  const [localRate, setLocalRate] = useState(rate);
  const [localDepth, setLocalDepth] = useState(depth);
  const [localStages, setLocalStages] = useState(stages);
  const [localFeedback, setLocalFeedback] = useState(feedback);
  const [localStereoPhase, setLocalStereoPhase] = useState(stereoPhase);
  const [localWet, setLocalWet] = useState(wet);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('cosmic-modulation'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam, setParams } = useParameterBatcher(effectNode);
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Ghost values
  const ghostRate = useGhostValue(localRate, 400);
  const ghostDepth = useGhostValue(localDepth * 100, 400);
  const ghostStages = useGhostValue(localStages, 400);
  const ghostFeedback = useGhostValue(localFeedback * 100, 400);
  const ghostStereoPhase = useGhostValue(localStereoPhase, 400);
  const ghostWet = useGhostValue(localWet * 100, 400);

  // Sync with effect.settings when presets are loaded
  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    console.log('[VortexPhaser] Preset loaded, updating parameters:', effect.settings);
    const updates = {};
    if (effect.settings.rate !== undefined) {
      setLocalRate(effect.settings.rate);
      updates.rate = effect.settings.rate;
    }
    if (effect.settings.depth !== undefined) {
      setLocalDepth(effect.settings.depth);
      updates.depth = effect.settings.depth;
    }
    if (effect.settings.stages !== undefined) {
      setLocalStages(effect.settings.stages);
      updates.stages = effect.settings.stages;
    }
    if (effect.settings.feedback !== undefined) {
      setLocalFeedback(effect.settings.feedback);
      updates.feedback = effect.settings.feedback;
    }
    if (effect.settings.stereoPhase !== undefined) {
      setLocalStereoPhase(effect.settings.stereoPhase);
      updates.stereoPhase = effect.settings.stereoPhase;
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
    if (key === 'rate') setLocalRate(value);
    else if (key === 'depth') setLocalDepth(value);
    else if (key === 'stages') setLocalStages(value);
    else if (key === 'feedback') setLocalFeedback(value);
    else if (key === 'stereoPhase') setLocalStereoPhase(value);
    else if (key === 'wet') setLocalWet(value);
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

  return (
    <PluginContainerV2
      trackId={trackId}
      effect={effect}
      definition={definition}
      category="cosmic-modulation"
    >
      <TwoPanelLayout
        category="cosmic-modulation"

        mainPanel={
          <>
            {/* Spectral Phaser Visualization */}
            <SpectralPhaserVisualizer
              trackId={trackId}
              effectId={effect.id}
              rate={localRate}
              depth={localDepth}
              stages={localStages}
              feedback={localFeedback}
            />

            {/* Main Controls */}
            <div className="bg-gradient-to-br from-black/50 to-[#1e1b4b]/30 rounded-xl p-6 border border-[#a855f7]/20">
              <div className="grid grid-cols-3 gap-6">
                <Knob
                  label="RATE"
                  value={localRate}
                  ghostValue={ghostRate}
                  onChange={(val) => handleParamChange('rate', val)}
                  min={0.1}
                  max={10}
                  defaultValue={0.5}
                  sizeVariant="large"
                  category="cosmic-modulation"
                  valueFormatter={(v) => `${v.toFixed(2)} Hz`}
                />

                <Knob
                  label="DEPTH"
                  value={localDepth * 100}
                  ghostValue={ghostDepth}
                  onChange={(val) => handleParamChange('depth', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={60}
                  sizeVariant="large"
                  category="cosmic-modulation"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />

                <Knob
                  label="STAGES"
                  value={localStages}
                  ghostValue={ghostStages}
                  onChange={(val) => handleParamChange('stages', Math.round(val))}
                  min={2}
                  max={12}
                  defaultValue={4}
                  sizeVariant="large"
                  category="cosmic-modulation"
                  valueFormatter={(v) => `${Math.round(v)}`}
                />
              </div>
            </div>

            {/* Secondary Controls */}
            <div className="bg-gradient-to-br from-black/50 to-[#1e1b4b]/30 rounded-xl p-6 border border-[#a855f7]/20">
              <div className="grid grid-cols-3 gap-6">
                <Knob
                  label="FEEDBACK"
                  value={localFeedback * 100}
                  ghostValue={ghostFeedback}
                  onChange={(val) => handleParamChange('feedback', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={30}
                  sizeVariant="medium"
                  category="cosmic-modulation"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />

                <Knob
                  label="STEREO"
                  value={localStereoPhase}
                  ghostValue={ghostStereoPhase}
                  onChange={(val) => handleParamChange('stereoPhase', val)}
                  min={0}
                  max={180}
                  defaultValue={90}
                  sizeVariant="medium"
                  category="cosmic-modulation"
                  valueFormatter={(v) => `${v.toFixed(0)}°`}
                />

                <Knob
                  label="MIX"
                  value={localWet * 100}
                  ghostValue={ghostWet}
                  onChange={(val) => handleParamChange('wet', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={70}
                  sizeVariant="medium"
                  category="cosmic-modulation"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />
              </div>
            </div>
          </>
        }

        sidePanel={
          <>
            {/* Processing Stats */}
            <div className="bg-gradient-to-br from-[#1e1b4b]/50 to-black/50 rounded-xl p-4 border border-[#a855f7]/10">
              <div className="text-[9px] text-[#d8b4fe]/70 font-bold uppercase tracking-wider mb-3">
                Phaser Settings
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Rate</span>
                  <span className="text-[#d8b4fe] font-mono font-bold tabular-nums">
                    {localRate.toFixed(2)} Hz
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Depth</span>
                  <span className="text-[#a855f7] font-mono font-bold tabular-nums">
                    {(localDepth * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Stages</span>
                  <span className="text-[#d8b4fe] font-mono font-bold tabular-nums">
                    {Math.round(localStages)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Feedback</span>
                  <span className="text-[#a855f7] font-mono font-bold tabular-nums">
                    {(localFeedback * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Stereo Phase</span>
                  <span className="text-[#d8b4fe] font-mono font-bold tabular-nums">
                    {localStereoPhase.toFixed(0)}°
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Mix</span>
                  <span className="text-[#a855f7] font-mono font-bold tabular-nums">
                    {(localWet * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* About Phaser */}
            <div className="bg-gradient-to-br from-[#1e1b4b]/50 to-black/50 rounded-xl p-4 border border-[#a855f7]/10">
              <div className="text-[9px] text-[#d8b4fe]/70 font-bold uppercase tracking-wider mb-3">
                About Phaser
              </div>
              <div className="space-y-2 text-[9px] text-white/50 leading-relaxed">
                <p>
                  <span className="text-[#d8b4fe] font-bold">Rate:</span> LFO modulation speed
                </p>
                <p>
                  <span className="text-[#a855f7] font-bold">Depth:</span> Sweep intensity
                </p>
                <p>
                  <span className="text-[#d8b4fe] font-bold">Stages:</span> Number of notch filters
                </p>
                <p>
                  <span className="text-[#a855f7] font-bold">Feedback:</span> Resonance amount
                </p>
                <p className="text-white/30 italic pt-2 text-[8px]">
                  🌀 Creates sweeping notch filters for classic phaser sound
                </p>
              </div>
            </div>

            {/* About */}
            <div className="bg-gradient-to-br from-[#1e1b4b]/50 to-black/50 rounded-xl p-4 border border-[#a855f7]/10">
              <div className="text-[9px] text-[#d8b4fe]/70 font-bold uppercase tracking-wider mb-2">
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

export default VortexPhaserUI_V2;
