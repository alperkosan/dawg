/**
 * STARDUST CHORUS UI V2.0
 *
 * Professional chorus effect with galaxy particle visualization
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
 * - Galaxy particle system visualization
 * - Real-time chorus modulation display
 * - Professional factory presets (13 presets)
 * - Multiple chorus characters (Subtle, Lush, Wide, Vintage, Creative)
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
// PARTICLE CLASS (outside component to avoid recreation)
// ============================================================================
class ChorusParticle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.originalX = x;
    this.originalY = y;
    this.angle = Math.random() * Math.PI * 2;
    this.size = 1 + Math.random() * 3;
    this.life = 1;
    this.color = `hsl(${200 + Math.random() * 100}, 80%, 60%)`;
  }

  update(currentTime, rate, modDepth) {
    const lfoOffset = Math.sin(currentTime * rate * 0.1) * modDepth * 20;
    this.x = this.originalX + Math.cos(this.angle + currentTime * 0.01) * lfoOffset;
    this.y = this.originalY + Math.sin(this.angle + currentTime * 0.01) * lfoOffset;
    this.life -= 0.005;
    this.angle += 0.02;
  }

  draw(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = this.life * alpha;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.size * 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ============================================================================
// GALAXY PARTICLE SYSTEM VISUALIZER
// ============================================================================

const GalaxyParticleSystem = ({ frequency, depth, delayTime, trackId, effectId }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const particlesRef = useRef([]);
  const timeRef = useRef(0);

  // Get audio metrics for input level
  const { metrics } = useAudioPlugin(trackId, effectId, {
    fftSize: 1024,
    updateMetrics: true
  });

  const [inputLevel, setInputLevel] = useState(0);
  useEffect(() => {
    if (metrics?.inputPeak !== undefined) {
      const level = Math.max(0, Math.min(1, (metrics.inputPeak + 60) / 60));
      setInputLevel(level);
      console.log('[StardustChorus] Input level:', level, 'from peak:', metrics.inputPeak);
    } else {
      // Fallback: use a default level when no audio signal
      setInputLevel(0.5);
    }
  }, [metrics]);

  // Debug log
  useEffect(() => {
    console.log('[StardustChorus] Visualization params:', {
      trackId,
      effectId,
      frequency,
      depth,
      inputLevel,
      hasMetrics: !!metrics
    });
  }, [trackId, effectId, frequency, depth, inputLevel, metrics]);

  const drawVisualization = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.width / dpr;
    const displayHeight = canvas.height / dpr;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);

    const time = timeRef.current;

    // Background gradient
    const gradient = ctx.createRadialGradient(
      displayWidth / 2, displayHeight / 2, 0,
      displayWidth / 2, displayHeight / 2, Math.max(displayWidth, displayHeight) / 2
    );
    gradient.addColorStop(0, 'rgba(15, 15, 40, 0.95)');
    gradient.addColorStop(1, 'rgba(5, 5, 20, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Spawn new particles
    if (inputLevel > 0.1 && particlesRef.current.length < 100) {
      for (let i = 0; i < 3; i++) {
        particlesRef.current.push(
          new ChorusParticle(
            displayWidth / 2 + (Math.random() - 0.5) * 100,
            displayHeight / 2 + (Math.random() - 0.5) * 100
          )
        );
      }
    }

    // Update and draw particles
    particlesRef.current = particlesRef.current.filter(particle => {
      particle.update(time, frequency, depth);
      particle.draw(ctx, inputLevel);
      return particle.life > 0;
    });

    ctx.restore();

    // Update time
    timeRef.current += 0.5;
  }, [frequency, depth, inputLevel]);

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
  useRenderer(drawVisualization, 5, 16, [frequency, depth, inputLevel]);

  return (
    <div ref={containerRef} className="w-full h-[200px] bg-black/50 rounded-xl border border-[#a78bfa]/20 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const StardustChorusUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  // Extract settings with defaults
  const {
    frequency = 1.5,
    delayTime = 3.5,
    depth = 0.7,
    wet = 0.5
  } = effect.settings || {};

  // Local state for UI
  const [localFrequency, setLocalFrequency] = useState(frequency);
  const [localDelayTime, setLocalDelayTime] = useState(delayTime);
  const [localDepth, setLocalDepth] = useState(depth);
  const [localWet, setLocalWet] = useState(wet);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('cosmic-modulation'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam, setParams } = useParameterBatcher(effectNode);
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Ghost values
  const ghostFrequency = useGhostValue(localFrequency, 400);
  const ghostDelayTime = useGhostValue(localDelayTime, 400);
  const ghostDepth = useGhostValue(localDepth * 100, 400);
  const ghostWet = useGhostValue(localWet * 100, 400);

  // Sync with effect.settings when presets are loaded
  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    console.log('[StardustChorus] Preset loaded, updating parameters:', effect.settings);
    const updates = {};
    if (effect.settings.frequency !== undefined) {
      setLocalFrequency(effect.settings.frequency);
      updates.frequency = effect.settings.frequency;
    }
    if (effect.settings.delayTime !== undefined) {
      setLocalDelayTime(effect.settings.delayTime);
      updates.delayTime = effect.settings.delayTime;
    }
    if (effect.settings.depth !== undefined) {
      setLocalDepth(effect.settings.depth);
      updates.depth = effect.settings.depth;
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
    if (key === 'frequency') setLocalFrequency(value);
    else if (key === 'delayTime') setLocalDelayTime(value);
    else if (key === 'depth') setLocalDepth(value);
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
            {/* Galaxy Particle System */}
            <GalaxyParticleSystem
              trackId={trackId}
              effectId={effect.id}
              frequency={localFrequency}
              depth={localDepth}
              delayTime={localDelayTime}
            />

            {/* Main Controls */}
            <div className="bg-gradient-to-br from-black/50 to-[#1e1b4b]/30 rounded-xl p-6 border border-[#a78bfa]/20">
              <div className="grid grid-cols-4 gap-6">
                <Knob
                  label="RATE"
                  value={localFrequency}
                  ghostValue={ghostFrequency}
                  onChange={(val) => handleParamChange('frequency', val)}
                  min={0.1}
                  max={10}
                  defaultValue={1.5}
                  sizeVariant="medium"
                  category="cosmic-modulation"
                  valueFormatter={(v) => `${v.toFixed(2)} Hz`}
                />

                <Knob
                  label="DELAY"
                  value={localDelayTime}
                  ghostValue={ghostDelayTime}
                  onChange={(val) => handleParamChange('delayTime', val)}
                  min={1}
                  max={20}
                  defaultValue={3.5}
                  sizeVariant="medium"
                  category="cosmic-modulation"
                  valueFormatter={(v) => `${v.toFixed(1)} ms`}
                />

                <Knob
                  label="DEPTH"
                  value={localDepth * 100}
                  ghostValue={ghostDepth}
                  onChange={(val) => handleParamChange('depth', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={70}
                  sizeVariant="medium"
                  category="cosmic-modulation"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />

                <Knob
                  label="MIX"
                  value={localWet * 100}
                  ghostValue={ghostWet}
                  onChange={(val) => handleParamChange('wet', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={50}
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
            <div className="bg-gradient-to-br from-[#1e1b4b]/50 to-black/50 rounded-xl p-4 border border-[#a78bfa]/10">
              <div className="text-[9px] text-[#c4b5fd]/70 font-bold uppercase tracking-wider mb-3">
                Modulation
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Rate</span>
                  <span className="text-[#c4b5fd] font-mono font-bold tabular-nums">
                    {localFrequency.toFixed(2)} Hz
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Delay</span>
                  <span className="text-[#a78bfa] font-mono font-bold tabular-nums">
                    {localDelayTime.toFixed(1)} ms
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Depth</span>
                  <span className="text-[#c4b5fd] font-mono font-bold tabular-nums">
                    {(localDepth * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Mix</span>
                  <span className="text-[#a78bfa] font-mono font-bold tabular-nums">
                    {(localWet * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* About Chorus */}
            <div className="bg-gradient-to-br from-[#1e1b4b]/50 to-black/50 rounded-xl p-4 border border-[#a78bfa]/10">
              <div className="text-[9px] text-[#c4b5fd]/70 font-bold uppercase tracking-wider mb-3">
                About Chorus
              </div>
              <div className="space-y-2 text-[9px] text-white/50 leading-relaxed">
                <p>
                  <span className="text-[#c4b5fd] font-bold">Rate:</span> LFO modulation speed
                </p>
                <p>
                  <span className="text-[#a78bfa] font-bold">Delay:</span> Time offset for voices
                </p>
                <p>
                  <span className="text-[#c4b5fd] font-bold">Depth:</span> Modulation intensity
                </p>
                <p>
                  <span className="text-[#a78bfa] font-bold">Mix:</span> Dry/wet balance
                </p>
                <p className="text-white/30 italic pt-2 text-[8px]">
                  💫 Galaxy particle system visualizes chorus movement
                </p>
              </div>
            </div>

            {/* About */}
            <div className="bg-gradient-to-br from-[#1e1b4b]/50 to-black/50 rounded-xl p-4 border border-[#a78bfa]/10">
              <div className="text-[9px] text-[#c4b5fd]/70 font-bold uppercase tracking-wider mb-2">
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

export default StardustChorusUI_V2;
