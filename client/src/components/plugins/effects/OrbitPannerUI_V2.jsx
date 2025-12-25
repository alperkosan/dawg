/**
 * ORBIT PANNER UI V2.0
 *
 * Professional auto-panner with stereo visualization
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
 * - Orbit trail visualization
 * - Real-time stereo position display
 * - Professional factory presets (11 presets)
 * - Multiple panning patterns
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob, ModeSelector } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useAudioPlugin } from '@/hooks/useAudioPlugin';
import { useMixerStore } from '@/store/useMixerStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { selectBpm } from '@/store/selectors/playbackSelectors';

// ============================================================================
// ORBIT TRAIL VISUALIZER
// ============================================================================

const OrbitTrailVisualizer = ({ rate, depth, shape, stereoWidth, trackId, effectId }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const timeRef = useRef(0);
  const trailRef = useRef([]);

  const { metrics } = useAudioPlugin(trackId, effectId, {
    fftSize: 512,
    updateMetrics: true
  });

  const [inputLevel, setInputLevel] = useState(0.5);
  useEffect(() => {
    if (metrics?.inputPeak !== undefined) {
      setInputLevel(Math.max(0, Math.min(1, (metrics.inputPeak + 60) / 60)));
    } else {
      setInputLevel(0.5);
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
    const centerX = displayWidth / 2;
    const centerY = displayHeight / 2;

    // Background
    ctx.fillStyle = 'rgba(10, 10, 20, 0.95)';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Grid
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, displayHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(displayWidth, centerY);
    ctx.stroke();

    // Calculate pan position
    let panPos = 0;
    if (shape < 0.33) {
      // Sine wave
      panPos = Math.sin(time * rate * 0.02) * depth;
    } else if (shape < 0.66) {
      // Triangle wave
      const t = (time * rate * 0.02) % (Math.PI * 2);
      panPos = (2 / Math.PI) * Math.asin(Math.sin(t)) * depth;
    } else {
      // Random-ish
      panPos = (Math.sin(time * rate * 0.02) + Math.sin(time * rate * 0.03 * 1.618)) * 0.5 * depth;
    }

    panPos *= stereoWidth;

    // Add to trail
    const x = centerX + panPos * (displayWidth * 0.4);
    const y = centerY + Math.sin(time * rate * 0.01) * (displayHeight * 0.2) * depth;

    trailRef.current.push({ x, y, alpha: 1 });
    if (trailRef.current.length > 100) {
      trailRef.current.shift();
    }

    // Draw trail
    trailRef.current.forEach((point, i) => {
      const alpha = (i / trailRef.current.length) * inputLevel;
      ctx.fillStyle = `rgba(100, 200, 255, ${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw current position
    ctx.shadowColor = '#64c8ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = `rgba(100, 200, 255, ${inputLevel})`;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // L/R indicators
    ctx.fillStyle = 'rgba(255, 100, 100, 0.6)';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('L', 10, centerY);
    ctx.textAlign = 'right';
    ctx.fillText('R', displayWidth - 10, centerY);

    // Pan value
    ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    const panPercent = ((panPos + 1) / 2) * 100;
    ctx.fillText(`${panPercent.toFixed(0)}%`, centerX, 20);

    ctx.restore();
    timeRef.current += 1;
  }, [rate, depth, shape, stereoWidth, inputLevel]);

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

  useRenderer(drawVisualization, 5, 16, [rate, depth, shape, stereoWidth, inputLevel]);

  return (
    <div ref={containerRef} className="w-full h-[220px] bg-black/50 rounded-xl border border-[#64c8ff]/20 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const OrbitPannerUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  const {
    rate = 1.0,
    depth = 0.7,
    shape = 0,
    stereoWidth = 1.0,
    wet = 1.0,
    // ✅ NEW: Tempo sync
    tempoSync = 0,
    noteDivision = 3,
    bpm = 120
  } = effect.settings || {};

  // Get current BPM from playback store
  // ✅ PERFORMANCE FIX: Use selectBpm instead of entire store
  const currentBpm = usePlaybackStore(selectBpm);

  const [localRate, setLocalRate] = useState(rate);
  const [localDepth, setLocalDepth] = useState(depth);
  const [localShape, setLocalShape] = useState(shape);
  const [localStereoWidth, setLocalStereoWidth] = useState(stereoWidth);
  const [localWet, setLocalWet] = useState(wet);
  // ✅ NEW: Tempo sync state
  const [localTempoSync, setLocalTempoSync] = useState(tempoSync);
  const [localNoteDivision, setLocalNoteDivision] = useState(noteDivision);

  const categoryColors = useMemo(() => getCategoryColors('cosmic-modulation'), []);
  const { setParam, setParams } = useParameterBatcher(effectNode);
  const { handleMixerEffectChange } = useMixerStore.getState();

  // ✅ NEW: Update BPM when tempo changes
  useEffect(() => {
    if (currentBpm && effectNode) {
      setParam('bpm', currentBpm);
    }
  }, [currentBpm, effectNode, setParam]);

  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    console.log('[OrbitPanner] Preset loaded:', effect.settings);
    const updates = {};
    if (effect.settings.rate !== undefined) {
      setLocalRate(effect.settings.rate);
      updates.rate = effect.settings.rate;
    }
    if (effect.settings.depth !== undefined) {
      setLocalDepth(effect.settings.depth);
      updates.depth = effect.settings.depth;
    }
    if (effect.settings.shape !== undefined) {
      setLocalShape(effect.settings.shape);
      updates.shape = effect.settings.shape;
    }
    if (effect.settings.stereoWidth !== undefined) {
      setLocalStereoWidth(effect.settings.stereoWidth);
      updates.stereoWidth = effect.settings.stereoWidth;
    }
    if (effect.settings.wet !== undefined) {
      setLocalWet(effect.settings.wet);
      updates.wet = effect.settings.wet;
    }
    // ✅ NEW: Tempo sync
    if (effect.settings.tempoSync !== undefined) {
      setLocalTempoSync(effect.settings.tempoSync);
      updates.tempoSync = effect.settings.tempoSync;
    }
    if (effect.settings.noteDivision !== undefined) {
      setLocalNoteDivision(effect.settings.noteDivision);
      updates.noteDivision = effect.settings.noteDivision;
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

  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });

    if (key === 'rate') setLocalRate(value);
    else if (key === 'depth') setLocalDepth(value);
    else if (key === 'shape') setLocalShape(value);
    else if (key === 'stereoWidth') setLocalStereoWidth(value);
    else if (key === 'wet') setLocalWet(value);
    // ✅ NEW: Tempo sync
    else if (key === 'tempoSync') setLocalTempoSync(value);
    else if (key === 'noteDivision') setLocalNoteDivision(value);
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

  const getShapeName = (val) => {
    if (val < 0.33) return 'Sine';
    if (val < 0.66) return 'Triangle';
    return 'Random';
  };

  return (
    <PluginContainerV2 trackId={trackId} effect={effect} definition={definition} category="cosmic-modulation">
      <TwoPanelLayout category="cosmic-modulation"
        mainPanel={
          <>
            <OrbitTrailVisualizer
              trackId={trackId}
              effectId={effect.id}
              rate={localRate}
              depth={localDepth}
              shape={localShape}
              stereoWidth={localStereoWidth}
            />
            {/* ✅ NEW: Tempo Sync Controls */}
            <div className="bg-gradient-to-br from-black/50 to-[#1e1b4b]/30 rounded-xl p-4 border border-[#64c8ff]/20">
              <div className="text-[9px] text-[#64c8ff]/70 font-bold uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>TEMPO SYNC</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localTempoSync > 0.5}
                    onChange={(e) => handleParamChange('tempoSync', e.target.checked ? 1 : 0)}
                    className="w-4 h-4 rounded border-[#64c8ff]/30 bg-black/50 checked:bg-[#64c8ff] checked:border-[#64c8ff] focus:ring-2 focus:ring-[#64c8ff]/50"
                  />
                  <span className="text-[10px] text-white/70">ENABLED</span>
                </label>
              </div>

              {localTempoSync > 0.5 && (
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
                  activeMode={localNoteDivision}
                  onChange={(mode) => handleParamChange('noteDivision', mode)}
                  category="cosmic-modulation"
                  compact={true}
                />
              )}
            </div>

            <div className="bg-gradient-to-br from-black/50 to-[#1e1b4b]/30 rounded-xl p-6 border border-[#64c8ff]/20">
              <div className="grid grid-cols-3 gap-6">
                <Knob
                  label="RATE"
                  value={localTempoSync > 0.5 ? 0 : localRate}
                  onChange={(v) => handleParamChange('rate', v)}
                  min={0.1}
                  max={10}
                  defaultValue={1.0}
                  sizeVariant="large"
                  category="cosmic-modulation"
                  valueFormatter={(v) => localTempoSync > 0.5 ? 'SYNC' : `${v.toFixed(2)} Hz`}
                  disabled={localTempoSync > 0.5}
                />
                <Knob label="DEPTH" value={localDepth * 100} onChange={(v) => handleParamChange('depth', v / 100)}
                  min={0} max={100} defaultValue={70} sizeVariant="large" category="cosmic-modulation"
                  valueFormatter={(v) => `${v.toFixed(0)}%`} />
                <Knob label="SHAPE" value={localShape * 100} onChange={(v) => handleParamChange('shape', v / 100)}
                  min={0} max={100} defaultValue={0} sizeVariant="large" category="cosmic-modulation"
                  valueFormatter={(v) => getShapeName(v / 100)} />
              </div>
            </div>
            <div className="bg-gradient-to-br from-black/50 to-[#1e1b4b]/30 rounded-xl p-6 border border-[#64c8ff]/20">
              <div className="grid grid-cols-2 gap-6">
                <Knob label="WIDTH" value={localStereoWidth} onChange={(v) => handleParamChange('stereoWidth', v)}
                  min={0} max={2} defaultValue={1.0} sizeVariant="medium" category="cosmic-modulation"
                  valueFormatter={(v) => `${v.toFixed(2)}x`} />
                <Knob label="MIX" value={localWet * 100} onChange={(v) => handleParamChange('wet', v / 100)}
                  min={0} max={100} defaultValue={100} sizeVariant="medium" category="cosmic-modulation"
                  valueFormatter={(v) => `${v.toFixed(0)}%`} />
              </div>
            </div>
          </>
        }
        sidePanel={
          <>
            <div className="bg-gradient-to-br from-[#1e1b4b]/50 to-black/50 rounded-xl p-4 border border-[#64c8ff]/10">
              <div className="text-[9px] text-[#64c8ff]/70 font-bold uppercase tracking-wider mb-3">Panner Settings</div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Rate</span>
                  <span className="text-[#64c8ff] font-mono font-bold">{localRate.toFixed(2)} Hz</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Depth</span>
                  <span className="text-[#64c8ff] font-mono font-bold">{(localDepth * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Shape</span>
                  <span className="text-[#64c8ff] font-mono font-bold">{getShapeName(localShape)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Width</span>
                  <span className="text-[#64c8ff] font-mono font-bold">{localStereoWidth.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Mix</span>
                  <span className="text-[#64c8ff] font-mono font-bold">{(localWet * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-[#1e1b4b]/50 to-black/50 rounded-xl p-4 border border-[#64c8ff]/10">
              <div className="text-[9px] text-[#64c8ff]/70 font-bold uppercase tracking-wider mb-2">About</div>
              <div className="text-[10px] text-white/60 leading-relaxed">{definition.story}</div>
            </div>
          </>
        }
      />
    </PluginContainerV2>
  );
};

export default OrbitPannerUI_V2;
