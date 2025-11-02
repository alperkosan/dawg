/**
 * SATURATOR UI V2.0
 *
 * Professional analog saturation with harmonic visualization
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses ThreePanelLayout
 * ✅ CanvasRenderManager for visualization
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming (texture-lab)
 * ✅ Performance optimization with RAF batching
 *
 * Features:
 * - Real-time harmonic visualization
 * - Mode-based workflow (8 saturation styles)
 * - Professional saturation parameters
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob, ExpandablePanel, Slider, Checkbox } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useAudioPlugin, useGhostValue } from '@/hooks/useAudioPlugin';
import { useMixerStore } from '@/store/useMixerStore';

// ============================================================================
// HARMONIC VISUALIZER
// ============================================================================

const HarmonicVisualizer = ({ trackId, effectId, drive, mix, categoryColors }) => {
  // Helper to convert hex to rgba with opacity
  const hexToRgba = useCallback((hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }, []);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const harmonicLevelsRef = useRef(new Array(6).fill(0));

  const { isPlaying, getFrequencyData, metricsDb } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true,
    rmsSmoothing: 0.3,
    peakSmoothing: 0.2
  });

  const drawHarmonics = useCallback((timestamp) => {
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

    // Clear with subtle fade
    ctx.fillStyle = 'rgba(10, 10, 15, 0.3)';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

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
    const barWidth = displayWidth / 8;
    const maxHeight = displayHeight * 0.8;

    harmonicLevelsRef.current.forEach((level, i) => {
      const x = (i + 1) * barWidth;
      const barHeight = level * maxHeight;
      const y = displayHeight - barHeight;

      // Category-themed gradient (using categoryColors)
      const gradient = ctx.createLinearGradient(x, y, x, displayHeight);
      if (drive < 0.3) {
        gradient.addColorStop(0, hexToRgba(categoryColors.primary, 0.8));
        gradient.addColorStop(1, hexToRgba(categoryColors.primary, 0.3));
      } else if (drive < 0.7) {
        gradient.addColorStop(0, hexToRgba(categoryColors.secondary, 0.8));
        gradient.addColorStop(1, hexToRgba(categoryColors.secondary, 0.3));
      } else {
        gradient.addColorStop(0, hexToRgba(categoryColors.accent, 0.9));
        gradient.addColorStop(1, hexToRgba(categoryColors.accent, 0.4));
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(x - barWidth / 3, y, barWidth / 1.5, barHeight);

      // Harmonic number label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`H${i + 1}`, x, displayHeight - 5);
    });

    // Metrics overlay
    if (isPlaying) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(displayWidth - 120, 10, 110, 60);

      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'right';

      ctx.fillStyle = categoryColors.primary;
      ctx.fillText(`RMS: ${metricsDb.rmsDb.toFixed(1)}dB`, displayWidth - 15, 30);

      ctx.fillStyle = categoryColors.secondary;
      ctx.fillText(`PEAK: ${metricsDb.peakDb.toFixed(1)}dB`, displayWidth - 15, 45);

      ctx.fillStyle = metricsDb.clipping ? '#ef4444' : '#22c55e'; // Red for clipping, green for OK
      ctx.fillText(metricsDb.clipping ? 'CLIP!' : 'OK', displayWidth - 15, 60);
    } else {
      // "Play to see" message (using categoryColors)
      ctx.fillStyle = hexToRgba(categoryColors.primary, 0.3);
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('▶ Play to see harmonics', displayWidth / 2, displayHeight / 2);
    }

    // Restore context
    ctx.restore();
  }, [isPlaying, getFrequencyData, metricsDb, drive, mix, categoryColors, hexToRgba]);

  // Handle canvas resizing with high DPI
  React.useEffect(() => {
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
  useRenderer(drawHarmonics, 5, 16, [drive, mix, isPlaying, categoryColors, hexToRgba]);

  // Get category colors for canvas styling
  const containerStyle = {
    background: 'rgba(0, 0, 0, 0.5)',
    borderColor: `${categoryColors.primary}33`, // 20% opacity in hex
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[200px] rounded-xl overflow-hidden"
      style={containerStyle}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const SaturatorUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  const {
    distortion = 0.4,
    wet = 1.0,
    tone = 0,
    lowCutFreq = 20,
    highCutFreq = 20000,
    autoGain = true,
    headroom = 0
  } = effect.settings || {};

  // DEBUG: Check preset count
  console.log('🔍 [SaturatorUI_V2] definition.presets:', definition?.presets?.length);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('texture-lab'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam } = useParameterBatcher(effectNode);

  // Mixer store for parameter changes
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Ghost values for smooth visual feedback
  const ghostDrive = useGhostValue(distortion, 400);
  const ghostMix = useGhostValue(wet, 400);
  const ghostTone = useGhostValue(tone, 400);

  // Handle individual parameter changes
  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, key, value);
  }, [setParam, trackId, effect.id, handleMixerEffectChange]);

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
            {/* Harmonic Visualizer */}
            <HarmonicVisualizer
              trackId={trackId}
              effectId={effect.id}
              drive={distortion}
              mix={wet}
              categoryColors={categoryColors}
            />

            {/* Main Controls */}
            <div 
              className="bg-gradient-to-br from-black/50 rounded-xl p-6"
              style={{
                background: `linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, ${categoryColors.accent}30 100%)`,
                border: `1px solid ${categoryColors.primary}33`,
              }}
            >
              <div className="flex items-center justify-center gap-16">
                {/* Drive Knob */}
                <Knob
                  label="DRIVE"
                  value={distortion}
                  ghostValue={ghostDrive}
                  onChange={(val) => handleParamChange('distortion', val)}
                  min={0}
                  max={1.5}
                  defaultValue={0.4}
                  sizeVariant="large"
                  category="texture-lab"
                  valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />

                {/* Divider */}
                <div 
                  className="h-24 w-px bg-gradient-to-b from-transparent to-transparent"
                  style={{
                    background: `linear-gradient(to bottom, transparent, ${categoryColors.primary}4D, transparent)`,
                  }}
                />

                {/* Mix Knob */}
                <Knob
                  label="MIX"
                  value={wet}
                  ghostValue={ghostMix}
                  onChange={(val) => handleParamChange('wet', val)}
                  min={0}
                  max={1}
                  defaultValue={1}
                  sizeVariant="large"
                  category="texture-lab"
                  valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
              </div>
            </div>

            {/* Advanced Settings */}
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
                    onChange={(val) => handleParamChange('tone', val)}
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
                    onChange={(val) => handleParamChange('lowCutFreq', val)}
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
                    onChange={(val) => handleParamChange('highCutFreq', val)}
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
                    onChange={(val) => handleParamChange('headroom', val)}
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
              <div 
                className="px-4 pb-4 pt-2 border-t"
                style={{ borderColor: `${categoryColors.primary}1A` }}
              >
                <Checkbox
                  checked={autoGain === true || autoGain === 1}
                  onChange={(checked) => handleParamChange('autoGain', checked)}
                  label="Auto Gain Compensation"
                  description="Automatically adjusts output level to match input"
                  category="texture-lab"
                />
              </div>
            </ExpandablePanel>
          </>
        }

        sidePanel={
          <>
            {/* Processing Stats */}
            <div 
              className="bg-gradient-to-br from-black/50 rounded-xl p-4"
              style={{
                background: `linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, ${categoryColors.accent}20 100%)`,
                border: `1px solid ${categoryColors.primary}1A`,
              }}
            >
              <div 
                className="text-[9px] uppercase tracking-wider mb-3 font-bold"
                style={{ color: `${categoryColors.secondary}B3` }}
              >
                Processing
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Drive</span>
                  <span className="text-[10px] text-white font-mono">{(distortion * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Mix</span>
                  <span className="text-[10px] text-white font-mono">{(wet * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Tone</span>
                  <span className="text-[10px] text-white font-mono">{tone > 0 ? `+${tone.toFixed(1)}` : tone.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </>
        }
      />
    </PluginContainerV2>
  );
};

export default SaturatorUI_V2;

