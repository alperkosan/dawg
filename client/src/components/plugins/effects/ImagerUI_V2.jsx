/**
 * IMAGER UI V2.0
 *
 * Professional multiband stereo imaging
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

const DEFAULT_BANDS = [
  { id: 'low', name: 'Low', freq: 100 },
  { id: 'lowMid', name: 'Low Mid', freq: 600 },
  { id: 'highMid', name: 'High Mid', freq: 3000 },
  { id: 'high', name: 'High', freq: 6000 }
];

// ============================================================================
// STEREO FIELD VECTORSCOPE - Shows stereo width visually
// ============================================================================

const StereoVectorscope = ({ trackId, effectId, globalWidth, correlation, categoryColors }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const pointsRef = useRef([]);

  const { isPlaying, getTimeDomainData } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true
  });

  const drawVectorscope = useCallback((timestamp) => {
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
    const bgGradient = ctx.createLinearGradient(0, 0, displayWidth, displayHeight);
    bgGradient.addColorStop(0, 'rgba(5, 10, 20, 0.98)');
    bgGradient.addColorStop(1, 'rgba(10, 5, 15, 0.98)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    const centerX = displayWidth / 2;
    const centerY = displayHeight / 2;
    const radius = Math.min(displayWidth, displayHeight) * 0.4;

    // Draw circular grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * (i / 4), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw crosshairs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.stroke();

    // Draw stereo field indicator based on global width
    const widthRadius = radius * Math.min(globalWidth, 2);
    ctx.strokeStyle = `${categoryColors.primary}40`;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, widthRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Get audio data and plot vectorscope
    if (isPlaying) {
      const timeData = getTimeDomainData();
      if (timeData && timeData.length > 0) {
        // Plot points - simulate L/R from mono for now
        ctx.strokeStyle = categoryColors.primary;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        for (let i = 0; i < timeData.length; i += 2) {
          // Simulate stereo from mono data
          const sample = timeData[i];
          const phase = (i / timeData.length) * Math.PI * 2;

          // Create pseudo-stereo with width
          const left = sample * (1 + Math.sin(phase) * 0.3 * globalWidth);
          const right = sample * (1 - Math.sin(phase) * 0.3 * globalWidth);

          const x = centerX + (right * radius);
          const y = centerY - (left * radius);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          // Store for trail effect
          if (i % 8 === 0) {
            pointsRef.current.push({ x, y, time: timestamp });
          }
        }
        ctx.stroke();

        // Draw trail (fade out old points)
        pointsRef.current = pointsRef.current.filter(p => timestamp - p.time < 1000);
        pointsRef.current.forEach((point, i) => {
          const age = timestamp - point.time;
          const alpha = Math.max(0, 1 - age / 1000);
          ctx.fillStyle = `${categoryColors.secondary}${Math.round(alpha * 100).toString(16).padStart(2, '0')}`;
          ctx.fillRect(point.x - 1, point.y - 1, 2, 2);
        });
      }
    }

    // Draw correlation indicator
    const corrColor = correlation > 0.8 ? categoryColors.primary :
                      correlation < 0 ? '#ef4444' :
                      categoryColors.accent;
    ctx.fillStyle = corrColor;
    ctx.font = 'bold 16px Inter, system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`CORR: ${correlation.toFixed(2)}`, 15, 30);

    // Draw width indicator
    ctx.fillStyle = categoryColors.secondary;
    ctx.font = 'bold 14px Inter, system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(`WIDTH: ${globalWidth.toFixed(2)}x`, displayWidth - 15, 30);

    // Labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '11px Inter, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('MONO', centerX, centerY + 15);
    ctx.textAlign = 'left';
    ctx.fillText('L', 15, centerY + 5);
    ctx.textAlign = 'right';
    ctx.fillText('R', displayWidth - 15, centerY + 5);
    ctx.textAlign = 'center';
    ctx.fillText('STEREO', centerX, 20);

    ctx.restore();
  }, [isPlaying, getTimeDomainData, globalWidth, correlation, categoryColors]);

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

  // Register with CanvasRenderManager (30fps sufficient for vectorscope)
  useRenderer(drawVectorscope, 5, 33.33, [isPlaying, globalWidth, correlation, categoryColors]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-black/40 rounded-lg">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

const ImagerUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  const {
    band1Freq = 100,
    band2Freq = 600,
    band3Freq = 3000,
    band4Freq = 6000,
    band1Width = 0,
    band2Width = 0,
    band3Width = 0,
    band4Width = 0,
    globalWidth = 1.0,
    stereoize = 0
  } = effect.settings || {};

  // Local state
  const [localBand1Freq, setLocalBand1Freq] = useState(band1Freq);
  const [localBand2Freq, setLocalBand2Freq] = useState(band2Freq);
  const [localBand3Freq, setLocalBand3Freq] = useState(band3Freq);
  const [localBand4Freq, setLocalBand4Freq] = useState(band4Freq);
  const [localBand1Width, setLocalBand1Width] = useState(band1Width);
  const [localBand2Width, setLocalBand2Width] = useState(band2Width);
  const [localBand3Width, setLocalBand3Width] = useState(band3Width);
  const [localBand4Width, setLocalBand4Width] = useState(band4Width);
  const [localGlobalWidth, setLocalGlobalWidth] = useState(globalWidth);
  const [localStereoize, setLocalStereoize] = useState(stereoize);
  const [correlation, setCorrelation] = useState(1);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('master-chain'), []);

  // Use ParameterBatcher
  const { setParam, setParams } = useParameterBatcher(effectNode);

  // Mixer store
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Audio plugin for correlation
  const { plugin } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: false
  });

  // Listen for correlation
  useEffect(() => {
    const port = plugin?.audioNode?.workletNode?.port;
    if (!port) return;

    const onMsg = (e) => {
      if (e.data?.type === 'corr' && typeof e.data.value === 'number') {
        setCorrelation(Math.max(-1, Math.min(1, e.data.value)));
      }
    };

    port.addEventListener('message', onMsg);
    return () => port.removeEventListener('message', onMsg);
  }, [plugin]);

  // Ghost values
  const ghostBand1Width = useGhostValue(localBand1Width, 400);
  const ghostBand2Width = useGhostValue(localBand2Width, 400);
  const ghostBand3Width = useGhostValue(localBand3Width, 400);
  const ghostBand4Width = useGhostValue(localBand4Width, 400);

  // Sync with effect.settings
  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    const updates = {};
    if (effect.settings.band1Freq !== undefined) {
      setLocalBand1Freq(effect.settings.band1Freq);
      updates.band1Freq = effect.settings.band1Freq;
    }
    if (effect.settings.band2Freq !== undefined) {
      setLocalBand2Freq(effect.settings.band2Freq);
      updates.band2Freq = effect.settings.band2Freq;
    }
    if (effect.settings.band3Freq !== undefined) {
      setLocalBand3Freq(effect.settings.band3Freq);
      updates.band3Freq = effect.settings.band3Freq;
    }
    if (effect.settings.band4Freq !== undefined) {
      setLocalBand4Freq(effect.settings.band4Freq);
      updates.band4Freq = effect.settings.band4Freq;
    }
    if (effect.settings.band1Width !== undefined) {
      setLocalBand1Width(effect.settings.band1Width);
      updates.band1Width = effect.settings.band1Width;
    }
    if (effect.settings.band2Width !== undefined) {
      setLocalBand2Width(effect.settings.band2Width);
      updates.band2Width = effect.settings.band2Width;
    }
    if (effect.settings.band3Width !== undefined) {
      setLocalBand3Width(effect.settings.band3Width);
      updates.band3Width = effect.settings.band3Width;
    }
    if (effect.settings.band4Width !== undefined) {
      setLocalBand4Width(effect.settings.band4Width);
      updates.band4Width = effect.settings.band4Width;
    }
    if (effect.settings.globalWidth !== undefined) {
      setLocalGlobalWidth(effect.settings.globalWidth);
      updates.globalWidth = effect.settings.globalWidth;
    }
    if (effect.settings.stereoize !== undefined) {
      setLocalStereoize(effect.settings.stereoize);
      updates.stereoize = effect.settings.stereoize;
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
      band1Freq: setLocalBand1Freq,
      band2Freq: setLocalBand2Freq,
      band3Freq: setLocalBand3Freq,
      band4Freq: setLocalBand4Freq,
      band1Width: setLocalBand1Width,
      band2Width: setLocalBand2Width,
      band3Width: setLocalBand3Width,
      band4Width: setLocalBand4Width,
      globalWidth: setLocalGlobalWidth,
      stereoize: setLocalStereoize
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
            {/* Stereo Vectorscope */}
            <div className="h-64 mb-4">
              <StereoVectorscope
                trackId={trackId}
                effectId={effect.id}
                globalWidth={localGlobalWidth}
                correlation={correlation}
                categoryColors={categoryColors}
              />
            </div>

            {/* Band Width Controls */}
            <div className="grid grid-cols-4 gap-4 p-6">
              <Knob
                label="LOW"
                value={localBand1Width}
                ghostValue={ghostBand1Width}
                onChange={(val) => handleParamChange('band1Width', val)}
                min={-100}
                max={100}
                defaultValue={0}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
              />

              <Knob
                label="LOW MID"
                value={localBand2Width}
                ghostValue={ghostBand2Width}
                onChange={(val) => handleParamChange('band2Width', val)}
                min={-100}
                max={100}
                defaultValue={0}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
              />

              <Knob
                label="HIGH MID"
                value={localBand3Width}
                ghostValue={ghostBand3Width}
                onChange={(val) => handleParamChange('band3Width', val)}
                min={-100}
                max={100}
                defaultValue={0}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
              />

              <Knob
                label="HIGH"
                value={localBand4Width}
                ghostValue={ghostBand4Width}
                onChange={(val) => handleParamChange('band4Width', val)}
                min={-100}
                max={100}
                defaultValue={0}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
              />
            </div>

            {/* Frequency Controls */}
            <div className="grid grid-cols-4 gap-4 p-6">
              <Knob
                label="LOW CROSSOVER"
                value={localBand1Freq}
                onChange={(val) => handleParamChange('band1Freq', Math.round(val))}
                min={20}
                max={200}
                defaultValue={100}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${Math.round(v)}Hz`}
              />

              <Knob
                label="LOW MID CROSSOVER"
                value={localBand2Freq}
                onChange={(val) => handleParamChange('band2Freq', Math.round(val))}
                min={200}
                max={1000}
                defaultValue={600}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${Math.round(v)}Hz`}
              />

              <Knob
                label="HIGH MID CROSSOVER"
                value={localBand3Freq}
                onChange={(val) => handleParamChange('band3Freq', Math.round(val))}
                min={1000}
                max={6000}
                defaultValue={3000}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${Math.round(v)}Hz`}
              />

              <Knob
                label="HIGH CROSSOVER"
                value={localBand4Freq}
                onChange={(val) => handleParamChange('band4Freq', Math.round(val))}
                min={3000}
                max={20000}
                defaultValue={6000}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${Math.round(v)}Hz`}
              />
            </div>

            {/* Global Controls */}
            <div className="grid grid-cols-2 gap-4 p-6">
              <Knob
                label="GLOBAL WIDTH"
                value={localGlobalWidth}
                onChange={(val) => handleParamChange('globalWidth', val)}
                min={0}
                max={2}
                defaultValue={1.0}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${v.toFixed(2)}x`}
              />

              <Knob
                label="STEREOIZE"
                value={localStereoize}
                onChange={(val) => handleParamChange('stereoize', val)}
                min={0}
                max={100}
                defaultValue={0}
                sizeVariant="medium"
                category="master-chain"
                valueFormatter={(v) => `${v.toFixed(0)}%`}
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
                  <span className="text-[10px] text-white/60">Low Width</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localBand1Width >= 0 ? '+' : ''}{localBand1Width.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Low Mid Width</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localBand2Width >= 0 ? '+' : ''}{localBand2Width.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">High Mid Width</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localBand3Width >= 0 ? '+' : ''}{localBand3Width.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">High Width</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localBand4Width >= 0 ? '+' : ''}{localBand4Width.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Global Width</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localGlobalWidth.toFixed(2)}x
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Stereoize</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localStereoize.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Correlation</span>
                  <span className="text-[10px] font-mono" style={{ 
                    color: correlation > 0.8 ? categoryColors.primary : correlation < 0 ? '#ef4444' : categoryColors.accent 
                  }}>
                    {correlation.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </>
        }
      />
    </PluginContainerV2>
  );
};

export default ImagerUI_V2;
