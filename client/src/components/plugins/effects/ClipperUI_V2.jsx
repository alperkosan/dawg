/**
 * CLIPPER UI V2.0
 *
 * Aggressive peak shaping with harmonic generation
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout
 * ✅ CanvasRenderManager for visualization (reuses ClippingVisualizer)
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming (texture-lab)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob, Toggle, ModeSelector } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useMixerStore } from '@/store/useMixerStore';
import { useGhostValue, useAudioPlugin, useCanvasVisualization } from '@/hooks/useAudioPlugin';

// Reuse ClippingVisualizer from old UI
const ClippingVisualizer = ({ trackId, effectId, ceiling, mode, categoryColors }) => {
  const { isPlaying, getTimeDomainData, metricsDb } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true
  });

  const [clippingPercentage, setClippingPercentage] = useState(0);
  const plugin = useAudioPlugin(trackId, effectId, { fftSize: 2048, updateMetrics: false }).plugin;

  // Listen for metering from worklet
  useEffect(() => {
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

  const drawClipping = useCallback((ctx, width, height) => {
    ctx.fillStyle = 'rgba(10, 10, 15, 0.3)';
    ctx.fillRect(0, 0, width, height);

    if (!isPlaying) {
      ctx.fillStyle = `${categoryColors.secondary}80`;
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Audio Stopped', width / 2, height / 2);
      return;
    }

    const timeData = getTimeDomainData();
    if (!timeData) return;

    const ceilingLinear = Math.pow(10, ceiling / 20);
    const ceilingY = height / 2 - (ceilingLinear * height / 2);

    // Ceiling line
    ctx.strokeStyle = categoryColors.accent;
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

    // Waveform
    ctx.strokeStyle = categoryColors.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / timeData.length;
    let x = 0;

    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i];
      const y = (v + 1) * height / 2;

      if (Math.abs(v) > ceilingLinear * 0.95) {
        ctx.stroke();
        ctx.strokeStyle = categoryColors.accent;
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

    // Labels
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = categoryColors.accent;
    ctx.textAlign = 'left';
    ctx.fillText(`${ceiling.toFixed(1)}dB`, 10, ceilingY + 15);

    if (clippingPercentage > 5) {
      ctx.fillStyle = categoryColors.accent;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`🔴 CLIPPING ${clippingPercentage.toFixed(0)}%`, width - 10, 20);
    }

    if (metricsDb?.rmsDb !== undefined) {
      ctx.fillStyle = `${categoryColors.secondary}E6`;
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`RMS: ${metricsDb.rmsDb.toFixed(1)}dB`, width - 10, height - 25);
      ctx.fillText(`PEAK: ${metricsDb.peakDb?.toFixed(1) || '-∞'}dB`, width - 10, height - 10);
    }
  }, [isPlaying, getTimeDomainData, ceiling, clippingPercentage, metricsDb, categoryColors]);

  const { containerRef, canvasRef } = useCanvasVisualization(drawClipping, [ceiling, mode, clippingPercentage]);

  return (
    <div ref={containerRef} className="w-full h-[300px] rounded-xl overflow-hidden" style={{
      background: 'rgba(0, 0, 0, 0.5)',
      borderColor: `${categoryColors.primary}33`,
    }}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

const ClipperUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  const {
    ceiling = 0.0,
    hardness = 100,
    harmonics = 50,
    preGain = 0,
    postGain = 0,
    mix = 100,
    mode = 0,
    curve = 1,
    dcFilter = 1,
    oversample = 2
  } = effect.settings || {};

  // Local state
  const [localCeiling, setLocalCeiling] = useState(ceiling);
  const [localHardness, setLocalHardness] = useState(hardness);
  const [localHarmonics, setLocalHarmonics] = useState(harmonics);
  const [localPreGain, setLocalPreGain] = useState(preGain);
  const [localPostGain, setLocalPostGain] = useState(postGain);
  const [localMix, setLocalMix] = useState(mix);
  const [localMode, setLocalMode] = useState(mode);
  const [localCurve, setLocalCurve] = useState(curve);
  const [localDcFilter, setLocalDcFilter] = useState(dcFilter);
  const [localOversample, setLocalOversample] = useState(oversample);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('texture-lab'), []);

  // Use ParameterBatcher
  const { setParam, setParams } = useParameterBatcher(effectNode);

  // Mixer store
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Ghost values
  const ghostCeiling = useGhostValue(localCeiling, 400);
  const ghostHardness = useGhostValue(localHardness, 400);
  const ghostHarmonics = useGhostValue(localHarmonics, 400);

  // Sync with effect.settings
  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    const updates = {};
    if (effect.settings.ceiling !== undefined) {
      setLocalCeiling(effect.settings.ceiling);
      updates.ceiling = effect.settings.ceiling;
    }
    if (effect.settings.hardness !== undefined) {
      setLocalHardness(effect.settings.hardness);
      updates.hardness = effect.settings.hardness;
    }
    if (effect.settings.harmonics !== undefined) {
      setLocalHarmonics(effect.settings.harmonics);
      updates.harmonics = effect.settings.harmonics;
    }
    if (effect.settings.preGain !== undefined) {
      setLocalPreGain(effect.settings.preGain);
      updates.preGain = effect.settings.preGain;
    }
    if (effect.settings.postGain !== undefined) {
      setLocalPostGain(effect.settings.postGain);
      updates.postGain = effect.settings.postGain;
    }
    if (effect.settings.mix !== undefined) {
      setLocalMix(effect.settings.mix);
      updates.mix = effect.settings.mix;
    }
    if (effect.settings.mode !== undefined) {
      setLocalMode(effect.settings.mode);
      updates.mode = effect.settings.mode;
    }
    if (effect.settings.curve !== undefined) {
      setLocalCurve(effect.settings.curve);
      updates.curve = effect.settings.curve;
    }
    if (effect.settings.dcFilter !== undefined) {
      setLocalDcFilter(effect.settings.dcFilter);
      updates.dcFilter = effect.settings.dcFilter;
    }
    if (effect.settings.oversample !== undefined) {
      setLocalOversample(effect.settings.oversample);
      updates.oversample = effect.settings.oversample;
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
      ceiling: setLocalCeiling,
      hardness: setLocalHardness,
      harmonics: setLocalHarmonics,
      preGain: setLocalPreGain,
      postGain: setLocalPostGain,
      mix: setLocalMix,
      mode: setLocalMode,
      curve: setLocalCurve,
      dcFilter: setLocalDcFilter,
      oversample: setLocalOversample
    };
    if (stateMap[key]) stateMap[key](value);
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

  return (
    <PluginContainerV2
      trackId={trackId}
      effect={effect}
      definition={definition}
      category="texture-lab"
    >
      <TwoPanelLayout
        category="texture-lab"

        mainPanel={
          <>
            {/* Visualizer */}
            <ClippingVisualizer
              trackId={trackId}
              effectId={effect.id}
              ceiling={localCeiling}
              mode={localMode}
              categoryColors={categoryColors}
            />

            {/* Clipping Curve */}
            <div className="p-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold tracking-wider uppercase text-center" style={{ color: categoryColors.secondary }}>
                  CLIPPING CURVE
                </label>
                <ModeSelector
                  value={localCurve.toString()}
                  onChange={(val) => handleParamChange('curve', parseFloat(val))}
                  options={[
                    { id: '0', label: 'Soft' },
                    { id: '1', label: 'Medium' },
                    { id: '2', label: 'Hard' }
                  ]}
                  category="texture-lab"
                  compact={true}
                />
              </div>
            </div>

            {/* Main Controls */}
            <div className="grid grid-cols-5 gap-4 p-6">
              <Knob
                label="CEILING"
                value={localCeiling}
                ghostValue={ghostCeiling}
                onChange={(val) => handleParamChange('ceiling', val)}
                min={-10}
                max={3}
                defaultValue={0.0}
                sizeVariant="medium"
                category="texture-lab"
                valueFormatter={(v) => `${v.toFixed(1)}dB`}
              />

              <Knob
                label="HARDNESS"
                value={localHardness}
                ghostValue={ghostHardness}
                onChange={(val) => handleParamChange('hardness', val)}
                min={0}
                max={100}
                defaultValue={100}
                sizeVariant="medium"
                category="texture-lab"
                valueFormatter={(v) => `${v.toFixed(0)}%`}
              />

              <Knob
                label="HARMONICS"
                value={localHarmonics}
                ghostValue={ghostHarmonics}
                onChange={(val) => handleParamChange('harmonics', val)}
                min={0}
                max={100}
                defaultValue={50}
                sizeVariant="medium"
                category="texture-lab"
                valueFormatter={(v) => `${v.toFixed(0)}%`}
              />

              <Knob
                label="PRE GAIN"
                value={localPreGain}
                onChange={(val) => handleParamChange('preGain', val)}
                min={-12}
                max={12}
                defaultValue={0}
                sizeVariant="medium"
                category="texture-lab"
                valueFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}dB`}
              />

              <Knob
                label="POST GAIN"
                value={localPostGain}
                onChange={(val) => handleParamChange('postGain', val)}
                min={-12}
                max={12}
                defaultValue={0}
                sizeVariant="medium"
                category="texture-lab"
                valueFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}dB`}
              />
            </div>

            {/* Secondary Controls */}
            <div className="grid grid-cols-4 gap-4 p-6">
              <Knob
                label="MIX"
                value={localMix}
                onChange={(val) => handleParamChange('mix', val)}
                min={0}
                max={100}
                defaultValue={100}
                sizeVariant="medium"
                category="texture-lab"
                valueFormatter={(v) => `${v.toFixed(0)}%`}
              />

              <Knob
                label="OVERSAMPLE"
                value={localOversample}
                onChange={(val) => {
                  const logVal = Math.log2(val);
                  const rounded = Math.round(logVal);
                  const result = Math.pow(2, rounded);
                  handleParamChange('oversample', result);
                }}
                min={1}
                max={8}
                defaultValue={2}
                sizeVariant="medium"
                category="texture-lab"
                valueFormatter={(v) => `${v}x`}
              />

              <Toggle
                label="DC FILTER"
                value={localDcFilter === 1}
                onChange={(val) => handleParamChange('dcFilter', val ? 1 : 0)}
                category="texture-lab"
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
                  <span className="text-[10px] text-white/60">Ceiling</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localCeiling.toFixed(1)}dB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Hardness</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localHardness.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Harmonics</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localHarmonics.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Pre Gain</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localPreGain >= 0 ? '+' : ''}{localPreGain.toFixed(1)}dB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Post Gain</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localPostGain >= 0 ? '+' : ''}{localPostGain.toFixed(1)}dB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Mix</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localMix.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Oversample</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localOversample}x
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

export default ClipperUI_V2;

