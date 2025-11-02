/**
 * OTT UI V2.0
 *
 * Professional multiband compressor with 3-band spectrum analyzer
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses ThreePanelLayout
 * ✅ CanvasRenderManager for visualization
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming (dynamics-forge)
 * ✅ Performance optimization with RAF batching
 *
 * Features:
 * - Real-time 3-band spectrum analyzer
 * - Mode-based workflow (8 compression styles)
 * - Professional factory presets
 * - A/B comparison (via PluginContainerV2)
 * - Undo/Redo (via PluginContainerV2)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { ThreePanelLayout } from '../layout/ThreePanelLayout';
import { Knob, Slider, ModeSelector } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useAudioPlugin, useGhostValue } from '@/hooks/useAudioPlugin';
import { useMixerStore } from '@/store/useMixerStore';
import { OTT_MODES, getOTTModeParameters, OTT_MODE_CATEGORIES } from '@/config/presets';

// ============================================================================
// OTT MODES - Factory Presets (from config/presets)
// ============================================================================

// Using existing OTT_MODES from config/presets

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
      const barSmoothing = 0.15;
      smoothedBandsRef.current[key] += (rmsAverage - smoothedBandsRef.current[key]) * barSmoothing;
      const level = Math.max(0, Math.min(1, smoothedBandsRef.current[key]));

      // Display value smoothing
      const displaySmoothing = 0.08;
      displayValuesRef.current[key] += (rmsAverage - displayValuesRef.current[key]) * displaySmoothing;
      const displayLevel = Math.max(0, Math.min(1, displayValuesRef.current[key]));

      // Peak hold logic
      if (level > peaksRef.current[key]) {
        peaksRef.current[key] = level;
        peakFallRef.current[key] = 0;
      } else {
        peakFallRef.current[key] += 0.003;
        peaksRef.current[key] = Math.max(0, peaksRef.current[key] - peakFallRef.current[key]);
      }

      // Track all-time max
      if (peaksRef.current[key] > maxPeaksRef.current[key]) {
        maxPeaksRef.current[key] = peaksRef.current[key];
      }

      const x = index * barWidth;
      const barHeight = level * maxHeight;
      const peakY = topMargin + (1 - peaksRef.current[key]) * maxHeight;

      // Draw scale markers
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const markerY = topMargin + (i / 5) * maxHeight;
        ctx.beginPath();
        ctx.moveTo(x + barWidth/2 - 32, markerY);
        ctx.lineTo(x + barWidth/2 + 32, markerY);
        ctx.stroke();

        if (i === 0 || i === 5) {
          ctx.font = '7px monospace';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.textAlign = 'left';
          ctx.fillText(i === 0 ? '0' : '-60', x + barWidth/2 + 34, markerY + 2);
        }
      }

      // Draw background gradient
      const bgGradient = ctx.createLinearGradient(x + barWidth/2 - 30, 0, x + barWidth/2 + 30, 0);
      bgGradient.addColorStop(0, 'rgba(255,255,255,0.02)');
      bgGradient.addColorStop(0.5, 'rgba(255,255,255,0.05)');
      bgGradient.addColorStop(1, 'rgba(255,255,255,0.02)');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(x + barWidth/2 - 30, topMargin, 60, maxHeight);

      // Draw main bar with gradient
      const barY = topMargin + maxHeight - barHeight;
      const gradient = ctx.createLinearGradient(0, topMargin + maxHeight, 0, barY);

      // Color based on level
      if (level < 0.5) {
        gradient.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`);
        gradient.addColorStop(0.5, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.9)`);
        gradient.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.5)`);
      } else if (level < 0.8) {
        gradient.addColorStop(0, 'rgba(245, 158, 11, 1)');
        gradient.addColorStop(0.5, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.9)`);
        gradient.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.5)`);
      } else {
        gradient.addColorStop(0, 'rgba(239, 68, 68, 1)');
        gradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.9)');
        gradient.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.5)`);
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(x + barWidth/2 - 25, barY, 50, barHeight);

      // Draw glow effect
      ctx.shadowBlur = 20;
      ctx.shadowColor = color;
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.2)`;
      ctx.fillRect(x + barWidth/2 - 25, barY, 50, barHeight);
      ctx.shadowBlur = 0;

      // Draw segments/LEDs effect
      const segmentCount = 35;
      const segmentHeight = maxHeight / segmentCount;
      const segmentGap = 1.5;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      for (let i = 0; i < segmentCount; i++) {
        const segY = topMargin + (i * segmentHeight);
        if (segY < barY - segmentGap) {
          ctx.fillRect(x + barWidth/2 - 25, segY + segmentHeight - segmentGap, 50, segmentGap);
        }
      }

      // Draw peak hold indicator
      if (peaksRef.current[key] > 0.02) {
        const peakHeight = 4;
        const clampedPeakY = Math.max(topMargin, Math.min(topMargin + maxHeight, peakY));

        ctx.fillStyle = color;
        ctx.fillRect(x + barWidth/2 - 32, clampedPeakY - peakHeight/2, 64, peakHeight);

        // Peak glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.8)`;
        ctx.fillRect(x + barWidth/2 - 32, clampedPeakY - peakHeight/2, 64, peakHeight);
        ctx.shadowBlur = 0;

        // Peak value label
        const peakDb = peaksRef.current[key] * 60;
        const peakDbFS = peakDb - 60;
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.fillText(`${peakDbFS.toFixed(0)}`, x + barWidth/2 + 36, clampedPeakY + 3);
      }

      // Draw current level dB
      const currentDb = displayLevel * 60;
      const currentDbFS = currentDb - 60;
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = displayLevel > 0.85 ? '#ef4444' : displayLevel > 0.5 ? '#f59e0b' : 'rgba(255, 255, 255, 0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(`${currentDbFS.toFixed(1)}dB`, x + barWidth/2, topMargin - 18);

      // Average indicator
      ctx.font = '6px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText('AVG', x + barWidth/2, topMargin - 28);

      // Draw MAX indicator
      const maxPeakNormalized = maxPeaksRef.current[key];
      if (maxPeakNormalized > 0.01) {
        const maxDb = maxPeakNormalized * 60;
        const maxDbFS = maxDb - 60;
        ctx.font = 'bold 7px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText(`MAX: ${maxDbFS.toFixed(0)}`, x + barWidth/2 - 38, topMargin - 8);
      }

      // Draw band label
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(label, x + barWidth/2, displayHeight - 28);
      ctx.font = '7px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText(range, x + barWidth/2, displayHeight - 16);
    });

    rmsIndexRef.current = (rmsIndexRef.current + 1) % 30;

    // Restore context
    ctx.restore();
  }, [bands, bandConfigs]);

  // Handle canvas resizing with high DPI
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

  // Use CanvasRenderManager for smooth 60fps rendering
  useRenderer(drawMeter, 5, 16, [bands]);

  return (
    <div ref={containerRef} className="relative" style={{ width: '260px', height: '220px' }}>
      <canvas ref={canvasRef} className="absolute inset-0 rounded-lg" style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

// Compact slider wrapper
const CompactSlider = ({ label, value, onChange, min, max, defaultValue, color, unit = '', precision = 1, className = '' }) => {
  const ghostValue = useGhostValue(value, 400);

  return (
    <Slider
      label={label}
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      defaultValue={defaultValue}
      color={color}
      ghostValue={ghostValue}
      showGhostValue={true}
      unit={unit}
      precision={precision}
      width="100%"
      showValue={true}
      className={className}
    />
  );
};

// Band Control
const BandControl = ({ label, color, range, upRatio, downRatio, gain, onUpRatioChange, onDownRatioChange, onGainChange }) => {
  return (
    <div className="flex flex-col gap-2 py-2">
      {/* Top Row: Label + UP/DN Ratios */}
      <div className="flex items-start gap-3">
        <div className="w-12 flex-shrink-0 pt-1">
          <div className="text-[9px] font-bold tracking-wider" style={{ color }}>
            {label}
          </div>
          <div className="text-[7px] text-white/30 mt-0.5">{range}</div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <CompactSlider
            label="UP"
            value={upRatio}
            onChange={onUpRatioChange}
            min={1}
            max={20}
            defaultValue={3}
            color={color}
            unit=":1"
            precision={1}
          />
          <CompactSlider
            label="DN"
            value={downRatio}
            onChange={onDownRatioChange}
            min={1}
            max={20}
            defaultValue={3}
            color={color}
            unit=":1"
            precision={1}
          />
        </div>
      </div>

      {/* Bottom Row: Gain Slider */}
      <div className="flex items-center gap-3">
        <div className="w-12 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <CompactSlider
            label="GAIN"
            value={gain}
            onChange={onGainChange}
            min={-12}
            max={12}
            defaultValue={0}
            color={color}
            unit="dB"
            precision={1}
            className="flex w-full"
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const OTTUI_V2 = ({ trackId, effect, effectNode, onChange, definition }) => {
  const {
    depth = 0.5,
    time = 0.5,
    wet = 1.0
  } = effect.settings || {};

  const [selectedMode, setSelectedMode] = useState('custom');
  const [amount, setAmount] = useState(50);
  const [bandLevels, setBandLevels] = useState({ low: 0, mid: 0, high: 0 });

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('dynamics-forge'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam, setParams } = useParameterBatcher(effectNode);

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

  // Sync with effect.settings
  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    const updates = {};
    if (effect.settings.depth !== undefined) {
      updates.depth = effect.settings.depth;
    }
    if (effect.settings.time !== undefined) {
      updates.time = effect.settings.time;
    }
    if (effect.settings.wet !== undefined) {
      updates.wet = effect.settings.wet;
    }
    // Sync band parameters
    ['lowUpRatio', 'lowDownRatio', 'lowGain', 'midUpRatio', 'midDownRatio', 'midGain', 'highUpRatio', 'highDownRatio', 'highGain'].forEach(key => {
      if (effect.settings[key] !== undefined) {
        updates[key] = effect.settings[key];
      }
    });

    if (Object.keys(updates).length > 0) {
      setParams(updates, { immediate: true });
    }
  }, [effect.settings, effectNode, setParams]);

  // Store onChange in ref
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Apply mode + amount (only when user actively changes mode)
  useEffect(() => {
    if (selectedMode === 'custom') return;

    const params = getOTTModeParameters(selectedMode, amount);
    if (!params) return;

    const updates = {};
    Object.entries(params).forEach(([key, value]) => {
      setParam(key, value);
      updates[key] = value;
      handleMixerEffectChange(trackId, effect.id, { [key]: value });
    });
  }, [selectedMode, amount, setParam, handleMixerEffectChange, trackId, effect.id]);

  // Handle individual parameter changes
  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });
    onChange?.(key, value);
  }, [setParam, handleMixerEffectChange, trackId, effect.id, onChange]);

  const currentMode = OTT_MODES[selectedMode];

  // Prepare modes for ModeSelector
  const modes = useMemo(() => Object.values(OTT_MODES).map(mode => ({
    id: mode.id,
    label: mode.name,
    icon: mode.icon,
    description: mode.description
  })), []);

  return (
    <PluginContainerV2
      trackId={trackId}
      effect={effect}
      definition={definition}
      category="dynamics-forge"
    >
      <ThreePanelLayout
        category="dynamics-forge"
        
        leftPanel={
          <ModeSelector
            modes={modes}
            activeMode={selectedMode}
            onChange={setSelectedMode}
            orientation="vertical"
            category="dynamics-forge"
            className="flex-1"
          />
        }

        centerPanel={
          <>
            {/* Hero Controls */}
            <div className="bg-gradient-to-br from-orange-950/20 via-black to-red-950/20 rounded-xl p-5 border border-orange-500/20">
              {/* Top: Knobs Row */}
              <div className="flex items-center justify-center gap-10 mb-6">
                {/* DEPTH Knob */}
                <div className="flex flex-col items-center gap-2">
                  <div className="text-[10px] text-orange-300/80 font-bold tracking-widest uppercase">Depth</div>
                  <Knob
                    label=""
                    value={amount}
                    onChange={setAmount}
                    min={0}
                    max={100}
                    defaultValue={50}
                    unit="%"
                    precision={0}
                    size={110}
                    category="dynamics-forge"
                  />
                  <div className="text-2xl font-black text-orange-400 tabular-nums">{amount}%</div>
                  <div className="text-[8px] text-white/30 uppercase tracking-wider">Amount</div>
                </div>

                {/* TIME Knob */}
                <div className="flex flex-col items-center gap-2">
                  <div className="text-[10px] text-orange-300/80 font-bold tracking-widest uppercase">Time</div>
                  <Knob
                    label=""
                    value={time}
                    onChange={(val) => handleParamChange('time', val)}
                    min={0}
                    max={1}
                    defaultValue={0.5}
                    unit=""
                    precision={2}
                    size={85}
                    category="dynamics-forge"
                  />
                  <div className="text-lg font-bold text-white tabular-nums">{(time * 100).toFixed(0)}%</div>
                  <div className="text-[8px] text-white/30 uppercase tracking-wider">Attack/Release</div>
                </div>

                {/* Divider */}
                <div className="h-32 w-px bg-gradient-to-b from-transparent via-orange-500/30 to-transparent" />

                {/* 3-Band Spectrum */}
                <ThreeBandMeter bands={bandLevels} categoryColors={categoryColors} />
              </div>

              {/* Band Controls */}
              <div className="bg-gradient-to-br from-black/40 to-black/20 rounded-lg p-4 border border-orange-500/10">
                <div className="text-[10px] text-orange-300/70 font-bold uppercase tracking-wider mb-4">Band Control</div>

                <div className="flex flex-col gap-3">
                  {/* LOW Band */}
                  <BandControl
                    label="LOW"
                    color="#ef4444"
                    range="0-250Hz"
                    upRatio={effect.settings.lowUpRatio || 3}
                    downRatio={effect.settings.lowDownRatio || 3}
                    gain={effect.settings.lowGain || 0}
                    onUpRatioChange={(val) => handleParamChange('lowUpRatio', val)}
                    onDownRatioChange={(val) => handleParamChange('lowDownRatio', val)}
                    onGainChange={(val) => handleParamChange('lowGain', val)}
                  />

                  <div className="h-px bg-white/5" />

                  {/* MID Band */}
                  <BandControl
                    label="MID"
                    color="#f59e0b"
                    range="250Hz-2.5k"
                    upRatio={effect.settings.midUpRatio || 3}
                    downRatio={effect.settings.midDownRatio || 3}
                    gain={effect.settings.midGain || 0}
                    onUpRatioChange={(val) => handleParamChange('midUpRatio', val)}
                    onDownRatioChange={(val) => handleParamChange('midDownRatio', val)}
                    onGainChange={(val) => handleParamChange('midGain', val)}
                  />

                  <div className="h-px bg-white/5" />

                  {/* HIGH Band */}
                  <BandControl
                    label="HIGH"
                    color="#3b82f6"
                    range="2.5k+"
                    upRatio={effect.settings.highUpRatio || 3}
                    downRatio={effect.settings.highDownRatio || 3}
                    gain={effect.settings.highGain || 0}
                    onUpRatioChange={(val) => handleParamChange('highUpRatio', val)}
                    onDownRatioChange={(val) => handleParamChange('highDownRatio', val)}
                    onGainChange={(val) => handleParamChange('highGain', val)}
                  />
                </div>
              </div>
            </div>
          </>
        }

        rightPanel={
          <>
            {/* Output Gain */}
            <div className="bg-gradient-to-br from-black/50 to-black/30 rounded-lg p-3 border border-white/10">
              <div className="text-[10px] text-white/50 font-semibold tracking-wide uppercase mb-2">Output</div>
              <Knob
                label="Mix"
                value={wet}
                onChange={(val) => handleParamChange('wet', val)}
                min={0}
                max={1}
                defaultValue={1}
                unit="%"
                displayMultiplier={100}
                precision={0}
                size={70}
                category="dynamics-forge"
              />
            </div>

            {/* Stats Panel */}
            <div className="flex-1 bg-gradient-to-br from-orange-950/20 to-red-950/20 rounded-lg p-3 border border-orange-500/20 flex flex-col gap-2">
              <div className="text-[9px] text-orange-300/70 font-bold uppercase tracking-wider">Stats</div>

              <div className="flex justify-between text-[10px]">
                <span className="text-white/40">Depth</span>
                <span className="text-orange-400 font-mono tabular-nums">{amount}%</span>
              </div>

              <div className="flex justify-between text-[10px]">
                <span className="text-white/40">Time</span>
                <span className="text-orange-400 font-mono tabular-nums">{(time * 100).toFixed(0)}%</span>
              </div>

              <div className="flex justify-between text-[10px]">
                <span className="text-white/40">Mix</span>
                <span className="text-orange-400 font-mono tabular-nums">{(wet * 100).toFixed(0)}%</span>
              </div>

              <div className="border-t border-orange-500/20 pt-2 mt-auto">
                <div className="text-[8px] text-white/30 leading-relaxed">
                  Multiband OTT compression
                </div>
              </div>
            </div>

            {/* Current Mode Info */}
            <div className="bg-gradient-to-br from-black/50 to-black/30 rounded-lg p-3 border border-orange-500/10">
              <div className="text-[9px] text-orange-300/70 font-bold uppercase tracking-wider mb-2">Current Mode</div>
              <div className="text-[10px] text-white/60 leading-relaxed">
                {currentMode?.description || 'Select a mode'}
              </div>
            </div>
          </>
        }

        collapsible={true}
        leftPanelWidth={220}
        rightPanelWidth={160}
      />
    </PluginContainerV2>
  );
};

export default OTTUI_V2;

