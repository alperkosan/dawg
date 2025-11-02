/**
 * MODERN REVERB UI V2.0 - UNIFIED DESIGN
 *
 * Professional algorithmic reverb with decay envelope visualization
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout (unified design)
 * ✅ PresetManager integration (NO ModeSelector)
 * ✅ CanvasRenderManager for visualization
 * ✅ Parameter Batching
 * ✅ Category-based theming (spacetime-chamber)
 *
 * Features:
 * - Real-time decay envelope visualization
 * - RT60 indicator
 * - Early reflections markers
 * - Professional factory presets (12 presets)
 * - A/B comparison (via PluginContainerV2)
 * - Undo/Redo (via PluginContainerV2)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useGhostValue } from '@/hooks/useAudioPlugin';
import { useMixerStore } from '@/store/useMixerStore';

// ============================================================================
// DECAY ENVELOPE VISUALIZER - Using CanvasRenderManager
// ============================================================================

const DecayEnvelopeVisualizer = ({
  decay,
  damping,
  earlyLateMix,
  size,
  categoryColors
}) => {
  const canvasRef = React.useRef(null);
  const containerRef = React.useRef(null);

  const drawDecay = useCallback((timestamp) => {
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

    // Dark gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
    bgGradient.addColorStop(0, 'rgba(10, 15, 30, 0.95)');
    bgGradient.addColorStop(1, 'rgba(5, 8, 18, 0.95)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Decay envelope curve (cyan - spacetime-chamber)
    const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
    gradient.addColorStop(0, 'rgba(34, 211, 238, 0.9)'); // cyan
    gradient.addColorStop(1, 'rgba(34, 211, 238, 0.1)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, displayHeight);

    for (let x = 0; x <= displayWidth; x++) {
      const t = x / displayWidth;
      const decayFactor = Math.exp(-t * (8 / decay));
      const dampFactor = Math.exp(-t * damping * 4);
      const amplitude = decayFactor * dampFactor;
      const y = displayHeight - amplitude * displayHeight * 0.85;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(displayWidth, displayHeight);
    ctx.closePath();
    ctx.fill();

    // Early reflections markers (yellow accent)
    const earlyReflectionTime = earlyLateMix * 0.15;
    const earlyX = earlyReflectionTime * displayWidth;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(earlyX, 0);
    ctx.lineTo(earlyX, displayHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // RT60 indicator (60dB decay time)
    const rt60 = decay * 0.6;
    ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
    ctx.font = 'bold 11px Inter, system-ui';
    ctx.fillText(`RT60: ${rt60.toFixed(2)}s`, 10, displayHeight - 10);

    // Size indicator
    ctx.fillStyle = 'rgba(34, 211, 238, 0.8)';
    ctx.font = '10px Inter, system-ui';
    ctx.fillText(`Size: ${(size * 100).toFixed(0)}%`, 10, 20);

    ctx.restore();
  }, [decay, damping, earlyLateMix, size, categoryColors]);

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

  // Register with CanvasRenderManager (30fps)
  useRenderer(drawDecay, 5, 33.33, [decay, damping, earlyLateMix, size, categoryColors]);

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

const ModernReverbUI_V2 = ({ trackId, effect, effectNode, onChange, definition }) => {
  const {
    size = 0.7,
    decay = 2.5,
    damping = 0.5,
    width = 1.0,
    preDelay = 0.02,
    wet = 0.35,
    earlyLateMix = 0.5,
    diffusion = 0.7,
    modDepth = 0.3,
    modRate = 0.5
  } = effect.settings || {};

  // Local state for all parameters
  const [localSize, setLocalSize] = useState(size);
  const [localDecay, setLocalDecay] = useState(decay);
  const [localDamping, setLocalDamping] = useState(damping);
  const [localWidth, setLocalWidth] = useState(width);
  const [localPreDelay, setLocalPreDelay] = useState(preDelay);
  const [localWet, setLocalWet] = useState(wet);
  const [localEarlyLateMix, setLocalEarlyLateMix] = useState(earlyLateMix);
  const [localDiffusion, setLocalDiffusion] = useState(diffusion);
  const [localModDepth, setLocalModDepth] = useState(modDepth);
  const [localModRate, setLocalModRate] = useState(modRate);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('spacetime-chamber'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam } = useParameterBatcher(effectNode);

  // Mixer store
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Ghost values (400ms lag for smooth visual feedback)
  const ghostSize = useGhostValue(localSize * 100, 400);
  const ghostDecay = useGhostValue(localDecay, 400);
  const ghostDamping = useGhostValue(localDamping * 100, 400);
  const ghostWet = useGhostValue(localWet * 100, 400);

  // Sync with effect.settings when presets are loaded
  useEffect(() => {
    console.log('[ModernReverb] Preset loaded, updating parameters:', effect.settings);
    if (effect.settings.size !== undefined) setLocalSize(effect.settings.size);
    if (effect.settings.decay !== undefined) setLocalDecay(effect.settings.decay);
    if (effect.settings.damping !== undefined) setLocalDamping(effect.settings.damping);
    if (effect.settings.width !== undefined) setLocalWidth(effect.settings.width);
    if (effect.settings.preDelay !== undefined) setLocalPreDelay(effect.settings.preDelay);
    if (effect.settings.wet !== undefined) setLocalWet(effect.settings.wet);
    if (effect.settings.earlyLateMix !== undefined) setLocalEarlyLateMix(effect.settings.earlyLateMix);
    if (effect.settings.diffusion !== undefined) setLocalDiffusion(effect.settings.diffusion);
    if (effect.settings.modDepth !== undefined) setLocalModDepth(effect.settings.modDepth);
    if (effect.settings.modRate !== undefined) setLocalModRate(effect.settings.modRate);
  }, [effect.settings]);

  // Handle individual parameter changes
  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });
    onChange?.(key, value);

    // Update local state
    switch(key) {
      case 'size': setLocalSize(value); break;
      case 'decay': setLocalDecay(value); break;
      case 'damping': setLocalDamping(value); break;
      case 'width': setLocalWidth(value); break;
      case 'preDelay': setLocalPreDelay(value); break;
      case 'wet': setLocalWet(value); break;
      case 'earlyLateMix': setLocalEarlyLateMix(value); break;
      case 'diffusion': setLocalDiffusion(value); break;
      case 'modDepth': setLocalModDepth(value); break;
      case 'modRate': setLocalModRate(value); break;
    }
  }, [setParam, handleMixerEffectChange, trackId, effect.id, onChange]);

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
            {/* Decay Envelope Visualizer */}
            <div className="h-48 mb-4">
              <DecayEnvelopeVisualizer
                decay={localDecay}
                damping={localDamping}
                earlyLateMix={localEarlyLateMix}
                size={localSize}
                categoryColors={categoryColors}
              />
            </div>

            {/* Main Controls */}
            <div className="bg-gradient-to-br from-black/50 to-[#2d1854]/30 rounded-xl p-6 border border-[#A855F7]/20 mb-4">
              <div className="text-xs font-bold text-[#22D3EE]/70 mb-4 uppercase tracking-wider">Main Parameters</div>
              <div className="grid grid-cols-4 gap-6">
                <Knob
                  label="SIZE"
                  value={localSize * 100}
                  ghostValue={ghostSize}
                  onChange={(val) => handleParamChange('size', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={70}
                  sizeVariant="medium"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <Knob
                  label="DECAY"
                  value={localDecay}
                  ghostValue={ghostDecay}
                  onChange={(val) => handleParamChange('decay', val)}
                  min={0.1}
                  max={15}
                  defaultValue={2.5}
                  sizeVariant="medium"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(1)} s`}
                />
                <Knob
                  label="DAMPING"
                  value={localDamping * 100}
                  ghostValue={ghostDamping}
                  onChange={(val) => handleParamChange('damping', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={50}
                  sizeVariant="medium"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <Knob
                  label="MIX"
                  value={localWet * 100}
                  ghostValue={ghostWet}
                  onChange={(val) => handleParamChange('wet', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={35}
                  sizeVariant="medium"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />
              </div>
            </div>

            {/* Advanced Controls */}
            <div className="bg-gradient-to-br from-[#1e1b4b]/50 to-black/50 rounded-xl p-6 border border-[#A855F7]/10">
              <div className="text-xs font-bold text-[#22D3EE]/70 mb-4 uppercase tracking-wider">Advanced</div>
              <div className="grid grid-cols-3 gap-6">
                <Knob
                  label="EARLY/LATE"
                  value={localEarlyLateMix * 100}
                  onChange={(val) => handleParamChange('earlyLateMix', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={50}
                  sizeVariant="small"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <Knob
                  label="DIFFUSION"
                  value={localDiffusion * 100}
                  onChange={(val) => handleParamChange('diffusion', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={70}
                  sizeVariant="small"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <Knob
                  label="PRE-DELAY"
                  value={localPreDelay * 1000}
                  onChange={(val) => handleParamChange('preDelay', val / 1000)}
                  min={0}
                  max={100}
                  defaultValue={20}
                  sizeVariant="small"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(0)} ms`}
                />
              </div>

              <div className="grid grid-cols-3 gap-6 mt-4">
                <Knob
                  label="WIDTH"
                  value={localWidth * 100}
                  onChange={(val) => handleParamChange('width', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={100}
                  sizeVariant="small"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <Knob
                  label="MOD DEPTH"
                  value={localModDepth * 100}
                  onChange={(val) => handleParamChange('modDepth', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={30}
                  sizeVariant="small"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <Knob
                  label="MOD RATE"
                  value={localModRate}
                  onChange={(val) => handleParamChange('modRate', val)}
                  min={0.1}
                  max={5}
                  defaultValue={0.5}
                  sizeVariant="small"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(1)} Hz`}
                />
              </div>
            </div>
          </>
        }

        sidePanel={
          <div className="h-full flex items-center justify-center">
            <div className="text-center p-8">
              <div className="text-[#22D3EE] text-6xl mb-4">🌌</div>
              <div className="text-sm text-[#A855F7] font-bold mb-2">Modern Reverb</div>
              <div className="text-xs text-white/40 leading-relaxed">
                Professional algorithmic reverb with early reflections and decay envelope control.
              </div>
            </div>
          </div>
        }
      />
    </PluginContainerV2>
  );
};

export default ModernReverbUI_V2;
