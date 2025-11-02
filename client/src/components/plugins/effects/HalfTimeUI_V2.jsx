/**
 * HALFTIME UI V2.0
 *
 * Professional time-stretching with granular synthesis
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout
 * ✅ CanvasRenderManager for visualization
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming (spacetime-chamber)
 * ✅ Performance optimization with RAF batching
 *
 * Features:
 * - Real-time granular cloud visualization
 * - Time dilation animation
 * - Professional factory presets (12 presets)
 * - Multiple time-stretch modes
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
// GRANULAR CLOUD VISUALIZER
// ============================================================================

class GranularParticle {
  constructor(width, height) {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.life = 1.0;
    this.size = 2 + Math.random() * 4;
    this.hue = 270 + Math.random() * 60; // Purple to cyan
  }

  update(width, height, speedFactor) {
    this.x += this.vx * speedFactor;
    this.y += this.vy * speedFactor;
    this.life -= 0.01;

    // Wrap around edges
    if (this.x < 0) this.x = width;
    if (this.x > width) this.x = 0;
    if (this.y < 0) this.y = height;
    if (this.y > height) this.y = 0;
  }

  draw(ctx, inputLevel) {
    if (this.life <= 0) return;

    const alpha = this.life * inputLevel;
    const glowSize = this.size * 2;

    // Glow
    ctx.fillStyle = `hsla(${this.hue}, 70%, 50%, ${alpha * 0.2})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, glowSize, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = `hsla(${this.hue}, 80%, 60%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

class GranularCloudRenderer {
  constructor() {
    this.particles = [];
    this.time = 0;
  }

  updateParticles(targetCount, width, height, rate, inputLevel) {
    // Calculate particle count based on grain density
    const speedFactor = 1 - rate * 0.7;

    // Remove dead particles
    this.particles = this.particles.filter(p => {
      p.update(width, height, speedFactor);
      return p.life > 0;
    });

    // Spawn new particles
    while (this.particles.length < targetCount) {
      this.particles.push(new GranularParticle(width, height));
    }
  }

  draw(ctx, width, height, rate, smoothing, inputLevel, categoryColors) {
    this.time += 0.016;

    // Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(20, 10, 20, 0.95)');
    bgGradient.addColorStop(0.5, 'rgba(30, 15, 25, 0.95)');
    bgGradient.addColorStop(1, 'rgba(15, 8, 15, 0.95)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Target particle count
    const targetCount = Math.floor(smoothing / 10) * 2;

    // Update particles
    this.updateParticles(targetCount, width, height, rate, inputLevel);

    // Draw particles
    this.particles.forEach(p => p.draw(ctx, inputLevel));

    // Time warp effect (concentric circles)
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2;

    ctx.strokeStyle = `${categoryColors.primary}${Math.round(0.2 * inputLevel * 255).toString(16)}`;
    ctx.lineWidth = 2;

    for (let r = 20; r < maxRadius; r += 40) {
      const radius = Math.max(1, r + (Math.sin(this.time * rate * 2) * 10));
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Rate indicator
    ctx.fillStyle = `${categoryColors.primary}CC`;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    const ratePercent = (rate * 100).toFixed(0);
    const stretchFactor = rate <= 0.26 ? 'x4' : rate <= 0.51 ? 'x2' : 'x1';
    ctx.fillText(`${ratePercent}% speed (${stretchFactor})`, centerX, height - 20);
  }
}

const GranularCloudVisualizer = ({ rate, smoothing, inputLevel, trackId, effectId, categoryColors }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rendererRef = useRef(new GranularCloudRenderer());

  const { isPlaying } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true
  });

  const drawCloud = useCallback((timestamp) => {
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

    rendererRef.current.draw(ctx, displayWidth, displayHeight, rate, smoothing, inputLevel, categoryColors);

    ctx.restore();
  }, [rate, smoothing, inputLevel, categoryColors]);

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
  useRenderer(drawCloud, 5, 16, [rate, smoothing, inputLevel, isPlaying]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[300px] rounded-xl overflow-hidden"
      style={{
        background: 'rgba(0, 0, 0, 0.5)',
        borderColor: `${categoryColors.primary}33`,
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const HalfTimeUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  const {
    rate = 0.5,
    smoothing = 50,
    pitchShift = -12,
    grainSize = 100,
    grainDensity = 8,
    pitchLock = 1,
    mix = 100
  } = effect.settings || {};

  // Local state
  const [localRate, setLocalRate] = useState(rate);
  const [localSmoothing, setLocalSmoothing] = useState(smoothing);
  const [localPitchShift, setLocalPitchShift] = useState(pitchShift);
  const [localGrainSize, setLocalGrainSize] = useState(grainSize);
  const [localGrainDensity, setLocalGrainDensity] = useState(grainDensity);
  const [localPitchLock, setLocalPitchLock] = useState(pitchLock);
  const [localMix, setLocalMix] = useState(mix);
  const [inputLevel, setInputLevel] = useState(0.5);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('spacetime-chamber'), []);

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
  const ghostRate = useGhostValue(localRate, 400);
  const ghostSmoothing = useGhostValue(localSmoothing, 400);
  const ghostPitchShift = useGhostValue(localPitchShift, 400);
  const ghostGrainDensity = useGhostValue(localGrainDensity, 400);

  // Sync with effect.settings when presets are loaded
  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    const updates = {};
    if (effect.settings.rate !== undefined) {
      setLocalRate(effect.settings.rate);
      updates.rate = effect.settings.rate;
    }
    if (effect.settings.smoothing !== undefined) {
      setLocalSmoothing(effect.settings.smoothing);
      updates.smoothing = effect.settings.smoothing;
    }
    if (effect.settings.pitchShift !== undefined) {
      setLocalPitchShift(effect.settings.pitchShift);
      updates.pitchShift = effect.settings.pitchShift;
    }
    if (effect.settings.grainSize !== undefined) {
      setLocalGrainSize(effect.settings.grainSize);
      updates.grainSize = effect.settings.grainSize;
    }
    if (effect.settings.grainDensity !== undefined) {
      setLocalGrainDensity(effect.settings.grainDensity);
      updates.grainDensity = effect.settings.grainDensity;
    }
    if (effect.settings.pitchLock !== undefined) {
      setLocalPitchLock(effect.settings.pitchLock);
      updates.pitchLock = effect.settings.pitchLock;
    }
    if (effect.settings.mix !== undefined) {
      setLocalMix(effect.settings.mix);
      updates.mix = effect.settings.mix;
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
    switch (key) {
      case 'rate':
        setLocalRate(value);
        break;
      case 'smoothing':
        setLocalSmoothing(value);
        break;
      case 'pitchShift':
        setLocalPitchShift(value);
        break;
      case 'grainSize':
        setLocalGrainSize(value);
        break;
      case 'grainDensity':
        setLocalGrainDensity(value);
        break;
      case 'pitchLock':
        setLocalPitchLock(value);
        break;
      case 'mix':
        setLocalMix(value);
        break;
    }
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

  // Format helpers
  const formatStretch = useCallback((value) => {
    if (value <= 0.26) return 'x4';
    if (value <= 0.51) return 'x2';
    return 'x1';
  }, []);

  const formatPitch = useCallback((value) => {
    const rounded = Math.round(value);
    return `${rounded >= 0 ? '+' : ''}${rounded}st`;
  }, []);

  return (
    <PluginContainerV2
      trackId={trackId}
      effect={effect}
      definition={definition}
      category="spacetime-chamber"
    >
      <TwoPanelLayout
        category="spacetime-chamber"

        mainPanel={
          <>
            {/* Granular Cloud Visualizer */}
            <GranularCloudVisualizer
              rate={localRate}
              smoothing={localSmoothing}
              inputLevel={inputLevel}
              trackId={trackId}
              effectId={effect.id}
              categoryColors={categoryColors}
            />

            {/* Main Controls */}
            <div className="grid grid-cols-4 gap-4 p-6">
              <Knob
                label="RATE"
                value={localRate}
                ghostValue={ghostRate}
                onChange={(val) => handleParamChange('rate', val)}
                min={0.25}
                max={2.0}
                defaultValue={0.5}
                sizeVariant="medium"
                category="spacetime-chamber"
                valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />

              <Knob
                label="SMOOTHING"
                value={localSmoothing}
                ghostValue={ghostSmoothing}
                onChange={(val) => handleParamChange('smoothing', val)}
                min={0}
                max={100}
                defaultValue={50}
                sizeVariant="medium"
                category="spacetime-chamber"
                valueFormatter={(v) => `${v.toFixed(0)}%`}
              />

              <Knob
                label="PITCH SHIFT"
                value={localPitchShift}
                ghostValue={ghostPitchShift}
                onChange={(val) => handleParamChange('pitchShift', val)}
                min={-24}
                max={24}
                defaultValue={-12}
                sizeVariant="medium"
                category="spacetime-chamber"
                valueFormatter={formatPitch}
              />

              <Knob
                label="GRAIN DENSITY"
                value={localGrainDensity}
                ghostValue={ghostGrainDensity}
                onChange={(val) => handleParamChange('grainDensity', Math.round(val))}
                min={1}
                max={16}
                defaultValue={8}
                sizeVariant="medium"
                category="spacetime-chamber"
                valueFormatter={(v) => `${Math.round(v)}x`}
              />
            </div>

            {/* Secondary Controls */}
            <div className="grid grid-cols-3 gap-4 p-6">
              <Knob
                label="GRAIN SIZE"
                value={localGrainSize}
                onChange={(val) => handleParamChange('grainSize', Math.round(val))}
                min={50}
                max={500}
                defaultValue={100}
                sizeVariant="medium"
                category="spacetime-chamber"
                valueFormatter={(v) => `${Math.round(v)}ms`}
              />

              <Knob
                label="PITCH LOCK"
                value={localPitchLock}
                onChange={(val) => handleParamChange('pitchLock', Math.round(val))}
                min={0}
                max={1}
                defaultValue={1}
                sizeVariant="medium"
                category="spacetime-chamber"
                valueFormatter={(v) => Math.round(v) ? 'ON' : 'OFF'}
              />

              <Knob
                label="MIX"
                value={localMix}
                onChange={(val) => handleParamChange('mix', val)}
                min={0}
                max={100}
                defaultValue={100}
                sizeVariant="medium"
                category="spacetime-chamber"
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
                  <span className="text-[10px] text-white/60">Rate</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {(localRate * 100).toFixed(0)}% ({formatStretch(localRate)})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Smoothing</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localSmoothing.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Pitch Shift</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {formatPitch(localPitchShift)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Grain Size</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {Math.round(localGrainSize)}ms
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Grain Density</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {Math.round(localGrainDensity)}x
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Pitch Lock</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localPitchLock ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Mix</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localMix.toFixed(0)}%
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

export default HalfTimeUI_V2;

