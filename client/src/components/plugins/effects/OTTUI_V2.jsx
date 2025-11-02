/**
 * OTT UI V2.0 - UNIFIED DESIGN
 *
 * Professional multiband compressor with 3-band spectrum analyzer
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout (unified design)
 * ✅ PresetManager integration (NO ModeSelector)
 * ✅ CanvasRenderManager for visualization
 * ✅ Parameter Batching
 * ✅ Category-based theming (dynamics-forge)
 *
 * Features:
 * - Real-time 3-band spectrum analyzer
 * - Professional factory presets (8 presets)
 * - A/B comparison (via PluginContainerV2)
 * - Undo/Redo (via PluginContainerV2)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob, Slider } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useAudioPlugin } from '@/hooks/useAudioPlugin';
import { useMixerStore } from '@/store/useMixerStore';

// ============================================================================
// THREE BAND METER - Using CanvasRenderManager
// ============================================================================

const ThreeBandMeter = ({ bands = { low: 0, mid: 0, high: 0 }, categoryColors }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const smoothedBandsRef = useRef({ low: 0, mid: 0, high: 0 });
  const peaksRef = useRef({ low: 0, mid: 0, high: 0 });
  const maxPeaksRef = useRef({ low: 0, mid: 0, high: 0 });
  const peakFallRef = useRef({ low: 0, mid: 0, high: 0 });
  const displayValuesRef = useRef({ low: 0, mid: 0, high: 0 });

  // RMS averaging for stability
  const rmsBufferRef = useRef({
    low: new Array(30).fill(0),
    mid: new Array(30).fill(0),
    high: new Array(30).fill(0)
  });
  const rmsIndexRef = useRef(0);

  const bandConfigs = [
    { key: 'low', label: 'BASS', color: categoryColors.accent || '#ef4444', range: '0-250Hz', rgb: [239, 68, 68] },
    { key: 'mid', label: 'MID', color: categoryColors.secondary || '#f59e0b', range: '250Hz-2.5k', rgb: [245, 158, 11] },
    { key: 'high', label: 'HIGH', color: categoryColors.primary || '#3b82f6', range: '2.5k+', rgb: [59, 130, 246] }
  ];

  const drawMeter = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use display dimensions (accounting for DPR)
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.width / dpr;
    const displayHeight = canvas.height / dpr;

    // Clear (use full canvas dimensions)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scale context for sharp rendering on retina
    ctx.save();
    ctx.scale(dpr, dpr);

    const barWidth = displayWidth / 3;
    const topMargin = 35;
    const bottomMargin = 45;
    const maxHeight = displayHeight - topMargin - bottomMargin;

    bandConfigs.forEach(({ key, label, color, range, rgb }, index) => {
      const rawValue = bands[key] || 0;
      const targetLevel = Math.min(Math.max(rawValue / 60, 0), 1);

      // RMS averaging for stability
      const buffer = rmsBufferRef.current[key];
      buffer[rmsIndexRef.current % 30] = targetLevel;
      const rmsAverage = buffer.reduce((sum, val) => sum + val, 0) / buffer.length;

      // Smooth the level changes
      const currentSmoothed = smoothedBandsRef.current[key];
      const smoothingFactor = 0.15;
      const newSmoothed = currentSmoothed + (rmsAverage - currentSmoothed) * smoothingFactor;
      smoothedBandsRef.current[key] = newSmoothed;

      // Peak hold
      if (newSmoothed > peaksRef.current[key]) {
        peaksRef.current[key] = newSmoothed;
        peakFallRef.current[key] = 0;
      } else {
        peakFallRef.current[key] += 0.01;
        peaksRef.current[key] = Math.max(0, peaksRef.current[key] - peakFallRef.current[key]);
      }

      // Max peak hold
      if (newSmoothed > maxPeaksRef.current[key]) {
        maxPeaksRef.current[key] = newSmoothed;
      }

      // Display value (slower smoothing)
      const displayCurrent = displayValuesRef.current[key];
      displayValuesRef.current[key] = displayCurrent + (newSmoothed - displayCurrent) * 0.08;

      const x = index * barWidth;
      const level = smoothedBandsRef.current[key];
      const peak = peaksRef.current[key];
      const displayValue = displayValuesRef.current[key];

      // Background bar
      ctx.fillStyle = 'rgba(20, 20, 30, 0.9)';
      ctx.fillRect(x + 8, topMargin, barWidth - 16, maxHeight);

      // Level bar with gradient
      const barHeight = level * maxHeight;
      const gradient = ctx.createLinearGradient(0, topMargin + maxHeight - barHeight, 0, topMargin + maxHeight);
      gradient.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.9)`);
      gradient.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(
        x + 8,
        topMargin + maxHeight - barHeight,
        barWidth - 16,
        barHeight
      );

      // Peak indicator
      const peakY = topMargin + maxHeight - (peak * maxHeight);
      ctx.fillStyle = color;
      ctx.fillRect(x + 8, peakY - 2, barWidth - 16, 3);

      // Labels
      ctx.fillStyle = color;
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + barWidth / 2, topMargin - 20);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '9px Inter, system-ui, sans-serif';
      ctx.fillText(range, x + barWidth / 2, topMargin - 7);

      // dB value
      const db = Math.round((displayValue * 60) - 60);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.fillText(db === -60 ? '-∞' : `${db > 0 ? '+' : ''}${db}`, x + barWidth / 2, displayHeight - 20);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '9px Inter, system-ui, sans-serif';
      ctx.fillText('dB', x + barWidth / 2, displayHeight - 5);
    });

    // Increment RMS buffer index
    rmsIndexRef.current++;

    ctx.restore();
  }, [bands, categoryColors]);

  // Canvas resize handling with DPR
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

  // Register with CanvasRenderManager (60fps)
  useRenderer(drawMeter, 5, 16.67, [bands, categoryColors]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-black/40 rounded-lg">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const OTTUI_V2 = ({ trackId, effect, effectNode, onChange, definition }) => {
  // Extract settings
  const {
    depth = 0.5,
    time = 0.5,
    lowUpRatio = 3,
    lowDownRatio = 3,
    lowGain = 0,
    midUpRatio = 3,
    midDownRatio = 3,
    midGain = 0,
    highUpRatio = 3,
    highDownRatio = 3,
    highGain = 0,
    wet = 1.0
  } = effect.settings || {};

  // Local state for all parameters
  const [localDepth, setLocalDepth] = useState(depth);
  const [localTime, setLocalTime] = useState(time);
  const [localLowUpRatio, setLocalLowUpRatio] = useState(lowUpRatio);
  const [localLowDownRatio, setLocalLowDownRatio] = useState(lowDownRatio);
  const [localLowGain, setLocalLowGain] = useState(lowGain);
  const [localMidUpRatio, setLocalMidUpRatio] = useState(midUpRatio);
  const [localMidDownRatio, setLocalMidDownRatio] = useState(midDownRatio);
  const [localMidGain, setLocalMidGain] = useState(midGain);
  const [localHighUpRatio, setLocalHighUpRatio] = useState(highUpRatio);
  const [localHighDownRatio, setLocalHighDownRatio] = useState(highDownRatio);
  const [localHighGain, setLocalHighGain] = useState(highGain);
  const [localWet, setLocalWet] = useState(wet);

  const [bandLevels, setBandLevels] = useState({ low: 0, mid: 0, high: 0 });

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('dynamics-forge'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam } = useParameterBatcher(effectNode);

  // Mixer store
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Use standardized audio plugin hook for metering
  const { plugin } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: false
  });

  // Metering - Listen to worklet messages
  useEffect(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    const handleMessage = (event) => {
      const { type, bands } = event.data;
      if (type === 'metering' && bands) {
        setBandLevels(bands);
      }
    };

    audioNode.port.onmessage = handleMessage;

    return () => {
      if (audioNode?.port) {
        audioNode.port.onmessage = null;
      }
    };
  }, [plugin]);

  // Sync with effect.settings when presets are loaded
  useEffect(() => {
    console.log('[OTT] Preset loaded, updating parameters:', effect.settings);
    if (effect.settings.depth !== undefined) setLocalDepth(effect.settings.depth);
    if (effect.settings.time !== undefined) setLocalTime(effect.settings.time);
    if (effect.settings.lowUpRatio !== undefined) setLocalLowUpRatio(effect.settings.lowUpRatio);
    if (effect.settings.lowDownRatio !== undefined) setLocalLowDownRatio(effect.settings.lowDownRatio);
    if (effect.settings.lowGain !== undefined) setLocalLowGain(effect.settings.lowGain);
    if (effect.settings.midUpRatio !== undefined) setLocalMidUpRatio(effect.settings.midUpRatio);
    if (effect.settings.midDownRatio !== undefined) setLocalMidDownRatio(effect.settings.midDownRatio);
    if (effect.settings.midGain !== undefined) setLocalMidGain(effect.settings.midGain);
    if (effect.settings.highUpRatio !== undefined) setLocalHighUpRatio(effect.settings.highUpRatio);
    if (effect.settings.highDownRatio !== undefined) setLocalHighDownRatio(effect.settings.highDownRatio);
    if (effect.settings.highGain !== undefined) setLocalHighGain(effect.settings.highGain);
    if (effect.settings.wet !== undefined) setLocalWet(effect.settings.wet);
  }, [effect.settings]);

  // Handle individual parameter changes
  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });
    onChange?.(key, value);

    // Update local state
    switch(key) {
      case 'depth': setLocalDepth(value); break;
      case 'time': setLocalTime(value); break;
      case 'lowUpRatio': setLocalLowUpRatio(value); break;
      case 'lowDownRatio': setLocalLowDownRatio(value); break;
      case 'lowGain': setLocalLowGain(value); break;
      case 'midUpRatio': setLocalMidUpRatio(value); break;
      case 'midDownRatio': setLocalMidDownRatio(value); break;
      case 'midGain': setLocalMidGain(value); break;
      case 'highUpRatio': setLocalHighUpRatio(value); break;
      case 'highDownRatio': setLocalHighDownRatio(value); break;
      case 'highGain': setLocalHighGain(value); break;
      case 'wet': setLocalWet(value); break;
    }
  }, [setParam, handleMixerEffectChange, trackId, effect.id, onChange]);

  return (
    <PluginContainerV2
      trackId={trackId}
      effect={effect}
      definition={definition}
      category="dynamics-forge"
    >
      <TwoPanelLayout
        category="dynamics-forge"

        mainPanel={
          <>
            {/* Global Controls */}
            <div className="bg-gradient-to-br from-orange-950/20 via-black to-red-950/20 rounded-xl p-6 border border-orange-500/20 mb-4">
              <div className="flex items-center justify-center gap-8">
                <Knob
                  label="Depth"
                  value={localDepth}
                  onChange={(v) => handleParamChange('depth', v)}
                  min={0}
                  max={1}
                  defaultValue={0.5}
                  precision={2}
                  size={80}
                  category="dynamics-forge"
                />
                <Knob
                  label="Time"
                  value={localTime}
                  onChange={(v) => handleParamChange('time', v)}
                  min={0}
                  max={1}
                  defaultValue={0.5}
                  precision={2}
                  size={80}
                  category="dynamics-forge"
                />
                <Knob
                  label="Wet"
                  value={localWet}
                  onChange={(v) => handleParamChange('wet', v)}
                  min={0}
                  max={1}
                  defaultValue={1.0}
                  unit="%"
                  displayMultiplier={100}
                  precision={0}
                  size={80}
                  category="dynamics-forge"
                />
              </div>
            </div>

            {/* Band Controls */}
            <div className="grid grid-cols-3 gap-3">
              {/* LOW BAND */}
              <div className="bg-gradient-to-b from-red-950/20 to-black rounded-xl p-4 border border-red-500/20">
                <div className="text-xs font-bold text-red-400 mb-3 text-center tracking-wider">BASS (0-250Hz)</div>
                <div className="space-y-3">
                  <Knob
                    label="Up"
                    value={localLowUpRatio}
                    onChange={(v) => handleParamChange('lowUpRatio', v)}
                    min={1}
                    max={10}
                    defaultValue={3}
                    precision={1}
                    size={60}
                    category="dynamics-forge"
                  />
                  <Knob
                    label="Down"
                    value={localLowDownRatio}
                    onChange={(v) => handleParamChange('lowDownRatio', v)}
                    min={1}
                    max={10}
                    defaultValue={3}
                    precision={1}
                    size={60}
                    category="dynamics-forge"
                  />
                  <Slider
                    label="Gain"
                    value={localLowGain}
                    onChange={(v) => handleParamChange('lowGain', v)}
                    min={-12}
                    max={12}
                    defaultValue={0}
                    unit="dB"
                    precision={1}
                    category="dynamics-forge"
                  />
                </div>
              </div>

              {/* MID BAND */}
              <div className="bg-gradient-to-b from-amber-950/20 to-black rounded-xl p-4 border border-amber-500/20">
                <div className="text-xs font-bold text-amber-400 mb-3 text-center tracking-wider">MID (250Hz-2.5k)</div>
                <div className="space-y-3">
                  <Knob
                    label="Up"
                    value={localMidUpRatio}
                    onChange={(v) => handleParamChange('midUpRatio', v)}
                    min={1}
                    max={10}
                    defaultValue={3}
                    precision={1}
                    size={60}
                    category="dynamics-forge"
                  />
                  <Knob
                    label="Down"
                    value={localMidDownRatio}
                    onChange={(v) => handleParamChange('midDownRatio', v)}
                    min={1}
                    max={10}
                    defaultValue={3}
                    precision={1}
                    size={60}
                    category="dynamics-forge"
                  />
                  <Slider
                    label="Gain"
                    value={localMidGain}
                    onChange={(v) => handleParamChange('midGain', v)}
                    min={-12}
                    max={12}
                    defaultValue={0}
                    unit="dB"
                    precision={1}
                    category="dynamics-forge"
                  />
                </div>
              </div>

              {/* HIGH BAND */}
              <div className="bg-gradient-to-b from-blue-950/20 to-black rounded-xl p-4 border border-blue-500/20">
                <div className="text-xs font-bold text-blue-400 mb-3 text-center tracking-wider">HIGH (2.5k+)</div>
                <div className="space-y-3">
                  <Knob
                    label="Up"
                    value={localHighUpRatio}
                    onChange={(v) => handleParamChange('highUpRatio', v)}
                    min={1}
                    max={10}
                    defaultValue={3}
                    precision={1}
                    size={60}
                    category="dynamics-forge"
                  />
                  <Knob
                    label="Down"
                    value={localHighDownRatio}
                    onChange={(v) => handleParamChange('highDownRatio', v)}
                    min={1}
                    max={10}
                    defaultValue={3}
                    precision={1}
                    size={60}
                    category="dynamics-forge"
                  />
                  <Slider
                    label="Gain"
                    value={localHighGain}
                    onChange={(v) => handleParamChange('highGain', v)}
                    min={-12}
                    max={12}
                    defaultValue={0}
                    unit="dB"
                    precision={1}
                    category="dynamics-forge"
                  />
                </div>
              </div>
            </div>
          </>
        }

        sidePanel={
          <ThreeBandMeter
            bands={bandLevels}
            categoryColors={categoryColors}
          />
        }
      />
    </PluginContainerV2>
  );
};

export default OTTUI_V2;
