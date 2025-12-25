/**
 * MAXIMIZER UI V2.0
 *
 * Loudness maximizer with soft saturation and brick-wall limiting
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming (master-chain)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob, Toggle } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useMixerStore } from '@/store/useMixerStore';
import { useGhostValue, useAudioPlugin } from '@/hooks/useAudioPlugin';

// ============================================================================
// WAVEFORM VISUALIZER - Live signal with GR overlay
// ============================================================================

const WaveformVisualizer = ({ trackId, effectId, grMeter, ceiling, categoryColors }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const historyRef = useRef(new Array(100).fill(0));

  const { isPlaying, getTimeDomainData } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true
  });

  const drawWaveform = useCallback((timestamp) => {
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

    // Dark background with gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
    bgGradient.addColorStop(0, 'rgba(10, 10, 20, 0.95)');
    bgGradient.addColorStop(1, 'rgba(5, 5, 10, 0.95)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    const centerY = displayHeight / 2;

    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(displayWidth, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw ceiling threshold
    const ceilingY = centerY - (Math.abs(ceiling) / 6) * (displayHeight * 0.4);
    ctx.strokeStyle = categoryColors.accent + '80';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(0, ceilingY);
    ctx.lineTo(displayWidth, ceilingY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, displayHeight - ceilingY);
    ctx.lineTo(displayWidth, displayHeight - ceilingY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Get time domain data and draw waveform
    if (isPlaying) {
      const timeData = getTimeDomainData();
      if (timeData && timeData.length > 0) {
        // Add peak to history
        const peak = Math.max(...timeData.map(v => Math.abs(v)));
        historyRef.current.push(peak);
        if (historyRef.current.length > 100) historyRef.current.shift();

        // Draw waveform
        const step = displayWidth / timeData.length;
        const waveGradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
        waveGradient.addColorStop(0, categoryColors.primary);
        waveGradient.addColorStop(0.5, categoryColors.secondary);
        waveGradient.addColorStop(1, categoryColors.primary);

        ctx.strokeStyle = waveGradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < timeData.length; i++) {
          const x = i * step;
          const y = centerY + (timeData[i] * displayHeight * 0.4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // Draw GR overlay
    if (grMeter > 0.01) {
      ctx.fillStyle = `${categoryColors.accent}${Math.round(grMeter * 100).toString(16).padStart(2, '0')}`;
      ctx.fillRect(0, 0, displayWidth, displayHeight);

      // GR text
      ctx.fillStyle = categoryColors.accent;
      ctx.font = 'bold 14px Inter, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`-${(grMeter * 20).toFixed(1)}dB GR`, displayWidth - 10, 25);
    }

    // Peak history bars
    const barWidth = displayWidth / historyRef.current.length;
    historyRef.current.forEach((peak, i) => {
      const x = i * barWidth;
      const barHeight = peak * displayHeight * 0.1;
      const alpha = Math.round((1 - (i / historyRef.current.length)) * 100);
      ctx.fillStyle = `${categoryColors.secondary}${alpha.toString(16).padStart(2, '0')}`;
      ctx.fillRect(x, displayHeight - barHeight, barWidth - 1, barHeight);
    });

    ctx.restore();
  }, [isPlaying, getTimeDomainData, grMeter, ceiling, categoryColors]);

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
  useRenderer(drawWaveform, 5, 16.67, [isPlaying, grMeter, ceiling, categoryColors]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-black/40 rounded-lg">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const MaximizerUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  const {
    inputGain = 2,
    saturation = 0.3,
    ceiling = -0.5,
    release = 0.15,
    wet = 1.0,
    lookahead = 3,
    truePeak = 1
  } = effect.settings || {};

  // Local state
  const [localInputGain, setLocalInputGain] = useState(inputGain);
  const [localSaturation, setLocalSaturation] = useState(saturation);
  const [localCeiling, setLocalCeiling] = useState(ceiling);
  const [localRelease, setLocalRelease] = useState(release);
  const [localWet, setLocalWet] = useState(wet);
  const [localLookahead, setLocalLookahead] = useState(lookahead);
  const [localTruePeak, setLocalTruePeak] = useState(truePeak);
  const [grMeter, setGrMeter] = useState(0);
  const [outPeak, setOutPeak] = useState(0);
  const [lufs, setLufs] = useState(-144);
  const [lra, setLra] = useState(0);
  const [peak, setPeak] = useState(-144);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('master-chain'), []);

  // Use ParameterBatcher
  const { setParam, setParams } = useParameterBatcher(effectNode);

  // Mixer store
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Audio plugin for metering
  const { plugin } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: false
  });

  // Subscribe to meters from worklet port
  useEffect(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    const handleMessage = (event) => {
      const data = event.data;
      if (!data) return;
      
      if (data.type === 'meters') {
        if (typeof data.gr === 'number') {
          setGrMeter(Math.max(0, Math.min(1, data.gr)));
        }
        if (typeof data.out === 'number') {
          setOutPeak(Math.max(0, Math.min(1, data.out)));
        }
        if (typeof data.lufs === 'number' && isFinite(data.lufs) && data.lufs > -144) {
          setLufs(data.lufs);
        }
        if (typeof data.lra === 'number' && isFinite(data.lra)) {
          setLra(data.lra);
        }
        if (typeof data.peak === 'number' && isFinite(data.peak) && data.peak > -144) {
          setPeak(data.peak);
        }
      }
    };

    audioNode.port.onmessage = handleMessage;

    return () => {
      if (audioNode?.port) {
        audioNode.port.onmessage = null;
      }
    };
  }, [plugin]);

  // Ghost values
  const ghostInputGain = useGhostValue(localInputGain, 400);
  const ghostSaturation = useGhostValue(localSaturation, 400);
  const ghostCeiling = useGhostValue(localCeiling, 400);

  // Sync with effect.settings
  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    const updates = {};
    if (effect.settings.inputGain !== undefined) {
      setLocalInputGain(effect.settings.inputGain);
      updates.inputGain = effect.settings.inputGain;
    }
    if (effect.settings.saturation !== undefined) {
      setLocalSaturation(effect.settings.saturation);
      updates.saturation = effect.settings.saturation;
    }
    if (effect.settings.ceiling !== undefined) {
      setLocalCeiling(effect.settings.ceiling);
      updates.ceiling = effect.settings.ceiling;
    }
    if (effect.settings.release !== undefined) {
      setLocalRelease(effect.settings.release);
      updates.release = effect.settings.release;
    }
    if (effect.settings.wet !== undefined) {
      setLocalWet(effect.settings.wet);
      updates.wet = effect.settings.wet;
    }
    if (effect.settings.lookahead !== undefined) {
      setLocalLookahead(effect.settings.lookahead);
      updates.lookahead = effect.settings.lookahead;
    }
    if (effect.settings.truePeak !== undefined) {
      setLocalTruePeak(effect.settings.truePeak);
      updates.truePeak = effect.settings.truePeak;
    }

    if (Object.keys(updates).length > 0) {
      setParams(updates, { immediate: true });
    }
  }, [effect.settings, effectNode, setParams]);

  // Handle parameter changes
  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });

    const stateMap = {
      inputGain: setLocalInputGain,
      saturation: setLocalSaturation,
      ceiling: setLocalCeiling,
      release: setLocalRelease,
      wet: setLocalWet,
      lookahead: setLocalLookahead,
      truePeak: setLocalTruePeak
    };
    if (stateMap[key]) stateMap[key](value);
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

  return (
    <PluginContainerV2
      trackId={trackId}
      effect={effect}
      definition={definition}
      category="master-chain"
    >
      <TwoPanelLayout
        category="master-chain"

        mainPanel={
          <>
            {/* Waveform Visualizer */}
            <div className="h-48 mb-4">
              <WaveformVisualizer
                trackId={trackId}
                effectId={effect.id}
                grMeter={grMeter}
                ceiling={localCeiling}
                categoryColors={categoryColors}
              />
            </div>

            {/* Gain Reduction Meter */}
            <div 
              className="rounded-xl p-4 mb-6"
              style={{
                background: `linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, ${categoryColors.accent}20 100%)`,
                border: `1px solid ${categoryColors.primary}1A`,
              }}
            >
              <div 
                className="text-[9px] uppercase tracking-wider mb-3 font-bold"
                style={{ color: `${categoryColors.secondary}B3` }}
              >
                Gain Reduction
              </div>
              <div className="h-8 bg-black/50 rounded overflow-hidden relative">
                <div 
                  className="h-full transition-all duration-100"
                  style={{
                    width: `${grMeter * 100}%`,
                    background: `linear-gradient(90deg, ${categoryColors.primary} 0%, ${categoryColors.accent} 100%)`,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {(-grMeter * 20).toFixed(1)} dB
                  </span>
                </div>
              </div>
            </div>

            {/* Main Controls */}
            <div className="grid grid-cols-4 gap-4 p-6">
              <Knob
                label="INPUT GAIN"
                value={localInputGain}
                ghostValue={ghostInputGain}
                onChange={(val) => handleParamChange('inputGain', val)}
                min={-12}
                max={12}
                defaultValue={2}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}dB`}
              />

              <Knob
                label="SATURATION"
                value={localSaturation}
                ghostValue={ghostSaturation}
                onChange={(val) => handleParamChange('saturation', val)}
                min={0}
                max={1}
                defaultValue={0.3}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />

              <Knob
                label="CEILING"
                value={localCeiling}
                ghostValue={ghostCeiling}
                onChange={(val) => handleParamChange('ceiling', val)}
                min={-6}
                max={0}
                defaultValue={-0.5}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${v.toFixed(1)}dB`}
              />

              <Knob
                label="RELEASE"
                value={localRelease}
                onChange={(val) => handleParamChange('release', val)}
                min={0.01}
                max={1}
                defaultValue={0.15}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
              />
            </div>

            {/* Secondary Controls */}
            <div className="grid grid-cols-3 gap-4 p-6">
              <Knob
                label="LOOKAHEAD"
                value={localLookahead}
                onChange={(val) => handleParamChange('lookahead', val)}
                min={0}
                max={10}
                defaultValue={3}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${v.toFixed(1)}ms`}
              />

              <Knob
                label="WET"
                value={localWet}
                onChange={(val) => handleParamChange('wet', val)}
                min={0}
                max={1}
                defaultValue={1.0}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />

              <Toggle
                label="TRUE PEAK"
                value={localTruePeak === 1}
                onChange={(val) => handleParamChange('truePeak', val ? 1 : 0)}
                category="master-chain"
              />
            </div>
          </>
        }

        sidePanel={
          <>
            {/* Stats Display */}
            <div 
              className="rounded-xl p-4"
              style={{
                background: `linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, ${categoryColors.accent}20 100%)`,
                border: `1px solid ${categoryColors.primary}1A`,
              }}
            >
              <div 
                className="text-[9px] uppercase tracking-wider mb-3 font-bold"
                style={{ color: `${categoryColors.secondary}B3` }}
              >
                Processing Info
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Input Gain</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localInputGain >= 0 ? '+' : ''}{localInputGain.toFixed(1)}dB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Saturation</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {(localSaturation * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Ceiling</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localCeiling.toFixed(1)}dB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Release</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {(localRelease * 1000).toFixed(0)}ms
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Lookahead</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localLookahead.toFixed(1)}ms
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">True Peak</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localTruePeak ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>

            {/* Loudness Metering */}
            <div 
              className="rounded-xl p-4 mt-4 mb-4"
              style={{
                background: `linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, ${categoryColors.accent}20 100%)`,
                border: `1px solid ${categoryColors.primary}1A`,
              }}
            >
              <div 
                className="text-[9px] uppercase tracking-wider mb-3 font-bold"
                style={{ color: `${categoryColors.secondary}B3` }}
              >
                Loudness Metering
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-white/60">LUFS</span>
                    <span className="text-lg font-bold font-mono" style={{ color: categoryColors.primary }}>
                      {lufs > -144 ? lufs.toFixed(1) : '---'}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
                    <div
                      className="h-full transition-all duration-100"
                      style={{
                        width: `${Math.min(100, Math.max(0, ((lufs + 60) / 60) * 100))}%`,
                        background: lufs > -14 
                          ? `linear-gradient(to right, ${categoryColors.primary}, #E74C3C)`
                          : lufs > -23
                          ? `linear-gradient(to right, ${categoryColors.accent}, ${categoryColors.primary})`
                          : categoryColors.accent
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">LRA</span>
                  <span className="text-[12px] font-mono" style={{ color: categoryColors.primary }}>
                    {lra > 0 ? lra.toFixed(1) : '---'} LU
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Peak</span>
                  <span className="text-[12px] font-mono" style={{ color: categoryColors.primary }}>
                    {peak > -144 ? peak.toFixed(1) : '---'} LUFS
                  </span>
                </div>
              </div>
            </div>

            {/* Output Peak Meter */}
            <div 
              className="rounded-xl p-4"
              style={{
                background: `linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, ${categoryColors.accent}20 100%)`,
                border: `1px solid ${categoryColors.primary}1A`,
              }}
            >
              <div 
                className="text-[9px] uppercase tracking-wider mb-3 font-bold"
                style={{ color: `${categoryColors.secondary}B3` }}
              >
                Output Peak
              </div>
              <div className="h-4 bg-black/50 rounded overflow-hidden relative">
                <div 
                  className="h-full transition-all duration-100"
                  style={{
                    width: `${outPeak * 100}%`,
                    background: outPeak > 0.95 
                      ? categoryColors.accent 
                      : `linear-gradient(90deg, ${categoryColors.primary} 0%, ${categoryColors.secondary} 100%)`,
                  }}
                />
              </div>
              <div className="mt-2 text-[10px] font-mono text-center" style={{ color: categoryColors.primary }}>
                {(20 * Math.log10(outPeak || 0.001)).toFixed(1)} dB
              </div>
            </div>
          </>
        }
      />
    </PluginContainerV2>
  );
};

export default MaximizerUI_V2;

