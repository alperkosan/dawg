/**
 * BASSENHANCER808 UI V2.0
 *
 * Professional 808-style bass enhancement with TASTE & TEXTURE controls
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout
 * ✅ CanvasRenderManager for visualization
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming (dynamics-forge)
 * ✅ Performance optimization with RAF batching
 *
 * Features:
 * - TASTE: Reverb, delay, chorus, modulation (tad verici efektler)
 * - TEXTURE: Saturation, harmonics, drive, warmth (dokusal özellikler)
 * - Real-time harmonic analyzer
 * - Professional factory presets (13 presets)
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
// HARMONIC ANALYZER 808
// ============================================================================

class HarmonicAnalyzer808Renderer {
  constructor() {
    this.harmonics = [];
    this.lastParams = { subBoost: 0, saturation: 0, texture: 0 };
  }

  updateHarmonics(freqData, subBoost, saturation, punch, taste, texture, inputLevel) {
    if (!freqData || freqData.length === 0) return;

    // Calculate harmonic amplitudes
    const fundamentalFreq = 60; // 808 kick fundamental
    const sampleRate = 48000;
    const binWidth = sampleRate / 2 / freqData.length;

    this.harmonics = [];
    
    for (let h = 1; h <= 8; h++) {
      const harmonicFreq = fundamentalFreq * h;
      const binIndex = Math.floor(harmonicFreq / binWidth);

      if (binIndex < freqData.length) {
        let amplitude = Math.max(0, Math.min(1, (freqData[binIndex] + 100) / 100));

        // Apply processing
        if (h === 1) amplitude *= (1 + subBoost * 0.8);
        if (h <= 3) amplitude *= (1 + saturation * 0.6);
        if (h >= 2) amplitude *= (1 + texture * h * 0.15);
        amplitude *= (1 + punch * 0.3);
        amplitude *= (1 + taste * 0.2);

        this.harmonics.push({
          harmonic: h,
          amplitude: amplitude,
          frequency: harmonicFreq
        });
      }
    }

    this.lastParams = { subBoost, saturation, texture };
  }

  draw(ctx, width, height, subBoost, saturation, punch, taste, texture, inputLevel, categoryColors) {
    // Clear with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(10, 5, 5, 0.95)');
    gradient.addColorStop(1, 'rgba(5, 5, 10, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    if (this.harmonics.length === 0) return;

    const centerY = height / 2;
    const barWidth = width / (this.harmonics.length + 1);

    this.harmonics.forEach((harmonic, index) => {
      const x = (index + 1) * barWidth;
      const barHeight = harmonic.amplitude * height * 0.6 * inputLevel;

      // Color coding with taste/texture influence
      const hue = 0; // Red/orange spectrum
      let saturationColor = 70;
      let lightness = 50;

      if (harmonic.harmonic === 1) {
        saturationColor = 80 + subBoost * 20;
        lightness = 50 + subBoost * 20;
      } else if (harmonic.harmonic <= 3) {
        saturationColor = 70 + punch * 20;
        lightness = 50 + punch * 15;
      } else {
        saturationColor = 60 + texture * 30;
        lightness = 50 + texture * 20;
      }

      // Taste adds shimmer/glow effect
      const glowAlpha = taste * 0.3;
      ctx.fillStyle = `${categoryColors.primary}CC`;
      ctx.shadowColor = taste > 0.3 ? `${categoryColors.glow}${Math.round(glowAlpha * 255).toString(16)}` : 'transparent';
      ctx.shadowBlur = harmonic.amplitude * 15 * (1 + taste * 0.5);

      ctx.fillRect(x - barWidth / 3, centerY - barHeight / 2, barWidth / 1.5, barHeight);
      ctx.shadowBlur = 0;

      // Harmonic label
      ctx.fillStyle = `${categoryColors.secondary}CC`;
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`H${harmonic.harmonic}`, x, height - 10);
    });

    // Draw 808 character indicator with texture influence
    const indicatorAlpha = 0.6 + saturation * 0.4;
    ctx.fillStyle = `${categoryColors.primary}${Math.round(indicatorAlpha * 255).toString(16)}`;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = taste > 0.3 ? `${categoryColors.glow}80` : 'transparent';
    ctx.shadowBlur = 20 * (1 + taste * 0.5);
    ctx.fillText('808', width / 2, centerY);
    ctx.shadowBlur = 0;

    // Sub indicator bar
    const subIndicatorHeight = subBoost * height * 0.15;
    ctx.fillStyle = `${categoryColors.accent}${Math.round((0.3 + subBoost * 0.4) * 255).toString(16)}`;
    ctx.fillRect(width / 2 - 30, height - subIndicatorHeight - 10, 60, subIndicatorHeight);

    // Animated pulse with taste influence
    const time = performance.now() * 0.001;
    const pulseAlpha = (0.2 * inputLevel) * (1 + taste * 0.3);
    ctx.fillStyle = `${categoryColors.primary}${Math.round((pulseAlpha * Math.sin(time * 2)) * 255).toString(16)}`;
    ctx.beginPath();
    ctx.arc(width / 2, centerY, 30 * (1 + inputLevel * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

const HarmonicAnalyzer808 = ({ subBoost, saturation, punch, taste, texture, inputLevel, trackId, effectId, categoryColors }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rendererRef = useRef(new HarmonicAnalyzer808Renderer());

  const { isPlaying, getFrequencyData } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true
  });

  const drawAnalyzer = useCallback((timestamp) => {
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

    if (isPlaying) {
      const freqData = getFrequencyData();
      if (freqData && freqData.length > 0) {
        rendererRef.current.updateHarmonics(
          freqData.map(v => Math.max(-100, Math.min(0, v))),
          subBoost,
          saturation,
          punch,
          taste,
          texture,
          inputLevel
        );
      }
    }

    rendererRef.current.draw(ctx, displayWidth, displayHeight, subBoost, saturation, punch, taste, texture, inputLevel, categoryColors);

    ctx.restore();
  }, [subBoost, saturation, punch, taste, texture, inputLevel, isPlaying, getFrequencyData, categoryColors]);

  // Canvas resize handling
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

  // Use CanvasRenderManager
  useRenderer(drawAnalyzer, 5, 16, [subBoost, saturation, punch, taste, texture, inputLevel, isPlaying]);

  // Container styling
  const containerStyle = {
    background: 'rgba(0, 0, 0, 0.5)',
    borderColor: `${categoryColors.primary}33`,
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[300px] rounded-xl overflow-hidden"
      style={containerStyle}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const BassEnhancer808UI_V2 = ({ trackId, effect, effectNode, definition }) => {
  const {
    subBoost = 0.5,
    saturation = 0.5,
    punch = 0.5,
    taste = 0.5,
    texture = 0.5,
    wet = 1.0
  } = effect.settings || {};

  // Local state
  const [localSubBoost, setLocalSubBoost] = useState(subBoost);
  const [localSaturation, setLocalSaturation] = useState(saturation);
  const [localPunch, setLocalPunch] = useState(punch);
  const [localTaste, setLocalTaste] = useState(taste);
  const [localTexture, setLocalTexture] = useState(texture);
  const [localWet, setLocalWet] = useState(wet);
  const [inputLevel, setInputLevel] = useState(0.5);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('dynamics-forge'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam, setParams } = useParameterBatcher(effectNode);

  // Mixer store for parameter changes
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Audio plugin for visualization
  const { metrics } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: true
  });

  // Update input level from metrics
  useEffect(() => {
    if (metrics?.inputPeak !== undefined) {
      setInputLevel(Math.max(0, Math.min(1, (metrics.inputPeak + 60) / 60)));
    } else {
      setInputLevel(0.5); // Fallback
    }
  }, [metrics]);

  // Ghost values for smooth visual feedback
  const ghostSubBoost = useGhostValue(localSubBoost, 400);
  const ghostSaturation = useGhostValue(localSaturation, 400);
  const ghostPunch = useGhostValue(localPunch, 400);
  const ghostTaste = useGhostValue(localTaste, 400);
  const ghostTexture = useGhostValue(localTexture, 400);
  const ghostWet = useGhostValue(localWet, 400);

  // Sync with effect.settings when presets are loaded
  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    const updates = {};
    if (effect.settings.subBoost !== undefined) {
      setLocalSubBoost(effect.settings.subBoost);
      updates.subBoost = effect.settings.subBoost;
    }
    if (effect.settings.saturation !== undefined) {
      setLocalSaturation(effect.settings.saturation);
      updates.saturation = effect.settings.saturation;
    }
    if (effect.settings.punch !== undefined) {
      setLocalPunch(effect.settings.punch);
      updates.punch = effect.settings.punch;
    }
    if (effect.settings.taste !== undefined) {
      setLocalTaste(effect.settings.taste);
      updates.taste = effect.settings.taste;
    }
    if (effect.settings.texture !== undefined) {
      setLocalTexture(effect.settings.texture);
      updates.texture = effect.settings.texture;
    }
    if (effect.settings.wet !== undefined) {
      setLocalWet(effect.settings.wet);
      updates.wet = effect.settings.wet;
    }

    // Send all parameter updates to worklet immediately
    // Note: Don't call handleMixerEffectChange here - it's already called by PresetManager
    // and would cause infinite loop by updating effect.settings again
    if (Object.keys(updates).length > 0) {
      setParams(updates, { immediate: true });
    }
  }, [effect.settings, effectNode, setParams]);

  // Handle parameter changes
  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });

    // Update local state
    switch (key) {
      case 'subBoost':
        setLocalSubBoost(value);
        break;
      case 'saturation':
        setLocalSaturation(value);
        break;
      case 'punch':
        setLocalPunch(value);
        break;
      case 'taste':
        setLocalTaste(value);
        break;
      case 'texture':
        setLocalTexture(value);
        break;
      case 'wet':
        setLocalWet(value);
        break;
    }
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

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
            {/* Harmonic Analyzer */}
            <HarmonicAnalyzer808
              subBoost={localSubBoost}
              saturation={localSaturation}
              punch={localPunch}
              taste={localTaste}
              texture={localTexture}
              inputLevel={inputLevel}
              trackId={trackId}
              effectId={effect.id}
              categoryColors={categoryColors}
            />

            {/* Main Controls: TASTE & TEXTURE */}
            <div className="grid grid-cols-2 gap-6 p-6">
              {/* TASTE Control */}
              <div className="flex flex-col items-center gap-3">
                <div className="text-center">
                  <div 
                    className="text-sm font-black uppercase tracking-wider mb-1"
                    style={{ color: categoryColors.secondary }}
                  >
                    TASTE
                  </div>
                  <div className="text-[9px] text-white/50">
                    Reverb • Delay • Chorus • Modulation
                  </div>
                </div>
                <Knob
                  label=""
                  value={localTaste}
                  ghostValue={ghostTaste}
                  onChange={(val) => handleParamChange('taste', val)}
                  min={0}
                  max={1}
                  defaultValue={0.5}
                  sizeVariant="large"
                  category="dynamics-forge"
                  valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
              </div>

              {/* TEXTURE Control */}
              <div className="flex flex-col items-center gap-3">
                <div className="text-center">
                  <div 
                    className="text-sm font-black uppercase tracking-wider mb-1"
                    style={{ color: categoryColors.secondary }}
                  >
                    TEXTURE
                  </div>
                  <div className="text-[9px] text-white/50">
                    Saturation • Harmonics • Drive • Warmth
                  </div>
                </div>
                <Knob
                  label=""
                  value={localTexture}
                  ghostValue={ghostTexture}
                  onChange={(val) => handleParamChange('texture', val)}
                  min={0}
                  max={1}
                  defaultValue={0.5}
                  sizeVariant="large"
                  category="dynamics-forge"
                  valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
              </div>
            </div>

            {/* Advanced Controls */}
            <div className="grid grid-cols-4 gap-4 p-6">
              <Knob
                label="SUB BOOST"
                value={localSubBoost}
                ghostValue={ghostSubBoost}
                onChange={(val) => handleParamChange('subBoost', val)}
                min={0}
                max={1}
                defaultValue={0.5}
                sizeVariant="medium"
                category="dynamics-forge"
                valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />

              <Knob
                label="SATURATION"
                value={localSaturation}
                ghostValue={ghostSaturation}
                onChange={(val) => handleParamChange('saturation', val)}
                min={0}
                max={1}
                defaultValue={0.5}
                sizeVariant="medium"
                category="dynamics-forge"
                valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />

              <Knob
                label="PUNCH"
                value={localPunch}
                ghostValue={ghostPunch}
                onChange={(val) => handleParamChange('punch', val)}
                min={0}
                max={1}
                defaultValue={0.5}
                sizeVariant="medium"
                category="dynamics-forge"
                valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />

              <Knob
                label="MIX"
                value={localWet}
                ghostValue={ghostWet}
                onChange={(val) => handleParamChange('wet', val)}
                min={0}
                max={1}
                defaultValue={1.0}
                sizeVariant="medium"
                category="dynamics-forge"
                valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
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
                  <span className="text-[10px] text-white/60">Taste</span>
                  <span className="text-[10px] text-white font-mono">{(localTaste * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Texture</span>
                  <span className="text-[10px] text-white font-mono">{(localTexture * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Sub Boost</span>
                  <span className="text-[10px] text-white font-mono">{(localSubBoost * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Saturation</span>
                  <span className="text-[10px] text-white font-mono">{(localSaturation * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Punch</span>
                  <span className="text-[10px] text-white font-mono">{(localPunch * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Mix</span>
                  <span className="text-[10px] text-white font-mono">{(localWet * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </>
        }
      />
    </PluginContainerV2>
  );
};

export default BassEnhancer808UI_V2;

