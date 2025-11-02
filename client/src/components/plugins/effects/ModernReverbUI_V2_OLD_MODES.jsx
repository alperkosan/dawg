/**
 * MODERN REVERB UI V2.0
 *
 * Professional algorithmic reverb with decay envelope visualization
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses ThreePanelLayout
 * ✅ CanvasRenderManager for visualization
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming (spacetime-chamber)
 * ✅ Performance optimization with RAF batching
 *
 * Features:
 * - Real-time decay envelope visualization
 * - RT60 indicator
 * - Early reflections markers
 * - Mode-based workflow (6 space presets)
 * - Professional reverb parameters
 */

import React, { useState, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { ThreePanelLayout } from '../layout/ThreePanelLayout';
import { Knob, ModeSelector } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useGhostValue } from '@/hooks/useAudioPlugin';

// ============================================================================
// REVERB MODES - Factory Presets
// ============================================================================

const REVERB_MODES = {
  'room': {
    id: 'room',
    name: 'Room',
    icon: '🏠',
    description: 'Small intimate space',
    defaults: { size: 0.35, decay: 0.8, damping: 0.4, wet: 0.25, earlyLateMix: 0.4 }
  },
  'hall': {
    id: 'hall',
    name: 'Hall',
    icon: '🏛️',
    description: 'Concert hall ambience',
    defaults: { size: 0.65, decay: 2.5, damping: 0.5, wet: 0.35, earlyLateMix: 0.5 }
  },
  'cathedral': {
    id: 'cathedral',
    name: 'Cathedral',
    icon: '⛪',
    description: 'Vast sacred space',
    defaults: { size: 0.9, decay: 6.0, damping: 0.7, wet: 0.45, earlyLateMix: 0.7 }
  },
  'plate': {
    id: 'plate',
    name: 'Plate',
    icon: '📻',
    description: 'Classic plate reverb',
    defaults: { size: 0.5, decay: 1.8, damping: 0.2, wet: 0.4, earlyLateMix: 0.3 }
  },
  'vocal': {
    id: 'vocal',
    name: 'Vocal',
    icon: '🎤',
    description: 'Warm vocal treatment',
    defaults: { size: 0.45, decay: 1.5, damping: 0.6, wet: 0.3, earlyLateMix: 0.45 }
  },
  'ambient': {
    id: 'ambient',
    name: 'Ambient',
    icon: '🌌',
    description: 'Infinite soundscape',
    defaults: { size: 0.95, decay: 10.0, damping: 0.8, wet: 0.6, earlyLateMix: 0.8 }
  },
  'custom': {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    description: 'Manual control',
    defaults: { size: 0.7, decay: 2.5, damping: 0.5, wet: 0.35, earlyLateMix: 0.5 }
  }
};

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
    const earlyTimes = [0.017, 0.023, 0.031, 0.043, 0.047, 0.059, 0.067, 0.073];
    const maxTime = Math.max(decay, 1);

    earlyTimes.forEach((time) => {
      const x = (time / maxTime) * displayWidth;
      const opacity = earlyLateMix * 0.7;

      ctx.strokeStyle = `rgba(250, 204, 21, ${opacity})`; // yellow
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, displayHeight * 0.2);
      ctx.lineTo(x, displayHeight * 0.4);
      ctx.stroke();
    });

    // RT60 indicator (purple - spacetime-chamber)
    const rt60Time = decay * 0.16;
    const rt60X = (rt60Time / maxTime) * displayWidth;
    if (rt60X < displayWidth) {
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)'; // purple
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(rt60X, 0);
      ctx.lineTo(rt60X, displayHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
      ctx.font = '10px monospace';
      ctx.fillText(`RT60: ${rt60Time.toFixed(2)}s`, rt60X + 3, 12);
    }

    // Pulse animation for room size
    const pulse = Math.sin(timestamp * 0.002) * 0.5 + 0.5;
    const roomRadius = size * 15 + pulse * 3;

    ctx.strokeStyle = `rgba(34, 211, 238, ${0.3 + pulse * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(displayWidth - 30, 25, roomRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Restore context
    ctx.restore();
  }, [decay, damping, earlyLateMix, size]);

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
  useRenderer(drawDecay, 5, 16, [decay, damping, earlyLateMix, size]);

  return (
    <div ref={containerRef} className="w-full h-[200px] bg-black/50 rounded-xl border border-[#A855F7]/20 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
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

  const [selectedMode, setSelectedMode] = useState('custom');

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('spacetime-chamber'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam } = useParameterBatcher(effectNode);

  // Ghost values (400ms lag for smooth visual feedback)
  const ghostSize = useGhostValue(size * 100, 400);
  const ghostDecay = useGhostValue(decay, 400);
  const ghostDamping = useGhostValue(damping * 100, 400);
  const ghostWet = useGhostValue(wet * 100, 400);

  // Handle mode change
  const handleModeChange = useCallback((modeId) => {
    setSelectedMode(modeId);
    const mode = REVERB_MODES[modeId];
    Object.entries(mode.defaults).forEach(([key, value]) => {
      setParam(key, value);
      onChange(key, value);
    });
  }, [setParam, onChange]);

  // Handle individual parameter changes
  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    onChange(key, value);
  }, [setParam, onChange]);

  const currentMode = REVERB_MODES[selectedMode];

  // Prepare modes for ModeSelector
  const modes = useMemo(() => Object.values(REVERB_MODES).map(mode => ({
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
      category="spacetime-chamber"
    >
      <ThreePanelLayout
        category="spacetime-chamber"
        
        leftPanel={
          <>
            {/* Current Mode Info */}
            <div className="bg-gradient-to-br from-[#2d1854]/50 to-black/50 rounded-xl p-3 border border-[#A855F7]/10">
              <div className="text-[9px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-2">
                Current Mode
              </div>
              <div className="text-[10px] text-white/60 leading-relaxed">
                {currentMode?.description || 'Select a space above'}
              </div>
            </div>

            {/* Mode Selector */}
            <ModeSelector
              modes={modes}
              activeMode={selectedMode}
              onChange={handleModeChange}
              orientation="vertical"
              category="spacetime-chamber"
              className="flex-1"
            />
          </>
        }

        centerPanel={
          <>
            {/* Decay Envelope Visualizer */}
            <DecayEnvelopeVisualizer
              decay={decay}
              damping={damping}
              earlyLateMix={earlyLateMix}
              size={size}
              categoryColors={categoryColors}
            />

            {/* Main Controls */}
            <div className="bg-gradient-to-br from-black/50 to-[#2d1854]/30 rounded-xl p-6 border border-[#A855F7]/20">
              <div className="grid grid-cols-4 gap-6">
                <Knob
                  label="SIZE"
                  value={size * 100}
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
                  value={decay}
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
                  value={damping * 100}
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
                  value={wet * 100}
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

            {/* Secondary Controls */}
            <div className="grid grid-cols-2 gap-4">
              {/* Time & Space */}
              <div className="bg-black/30 rounded-xl p-4 border border-[#A855F7]/10">
                <div className="text-[10px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-3">
                  Time & Space
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Knob
                    label="PRE-DELAY"
                    value={preDelay * 1000}
                    onChange={(val) => handleParamChange('preDelay', val / 1000)}
                    min={0}
                    max={200}
                    defaultValue={20}
                    sizeVariant="small"
                    category="spacetime-chamber"
                    valueFormatter={(v) => `${v.toFixed(0)} ms`}
                  />
                  <Knob
                    label="E/L MIX"
                    value={earlyLateMix * 100}
                    onChange={(val) => handleParamChange('earlyLateMix', val / 100)}
                    min={0}
                    max={100}
                    defaultValue={50}
                    sizeVariant="small"
                    category="spacetime-chamber"
                    valueFormatter={(v) => `${v.toFixed(0)}%`}
                  />
                </div>
              </div>

              {/* Character */}
              <div className="bg-black/30 rounded-xl p-4 border border-[#A855F7]/10">
                <div className="text-[10px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-3">
                  Character
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Knob
                    label="WIDTH"
                    value={width * 100}
                    onChange={(val) => handleParamChange('width', val / 100)}
                    min={0}
                    max={200}
                    defaultValue={100}
                    sizeVariant="small"
                    category="spacetime-chamber"
                    valueFormatter={(v) => {
                      if (v < 20) return 'MONO';
                      if (v > 180) return 'ULTRA';
                      return `${v.toFixed(0)}%`;
                    }}
                  />
                  <Knob
                    label="DIFFUSION"
                    value={diffusion * 100}
                    onChange={(val) => handleParamChange('diffusion', val / 100)}
                    min={0}
                    max={100}
                    defaultValue={70}
                    sizeVariant="small"
                    category="spacetime-chamber"
                    valueFormatter={(v) => `${v.toFixed(0)}%`}
                  />
                </div>
              </div>
            </div>

            {/* Modulation */}
            <div className="bg-black/30 rounded-xl p-4 border border-[#A855F7]/10">
              <div className="text-[10px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-3">
                Modulation
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Knob
                  label="DEPTH"
                  value={modDepth * 100}
                  onChange={(val) => handleParamChange('modDepth', val / 100)}
                  min={0}
                  max={100}
                  defaultValue={30}
                  sizeVariant="small"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <Knob
                  label="RATE"
                  value={modRate}
                  onChange={(val) => handleParamChange('modRate', val)}
                  min={0.1}
                  max={2}
                  defaultValue={0.5}
                  sizeVariant="small"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(1)} Hz`}
                />
              </div>
            </div>
          </>
        }

        rightPanel={
          <>
            {/* Processing Stats */}
            <div className="bg-gradient-to-br from-black/50 to-[#2d1854]/30 rounded-xl p-4 border border-[#A855F7]/10">
              <div className="text-[9px] text-[#22D3EE]/70 uppercase tracking-wider mb-3 font-bold">
                Processing
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Space</span>
                  <span className="text-[#A855F7] text-[9px] font-medium">
                    {currentMode?.name}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#A855F7]/10">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-white/50">RT60</span>
                    <span className="text-[#22D3EE] font-mono font-bold tabular-nums">
                      {(decay * 0.16).toFixed(2)}s
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Size</span>
                  <span className="text-[#A855F7] font-mono font-bold tabular-nums">
                    {(size * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Damping</span>
                  <span className="text-[#22D3EE] font-mono font-bold tabular-nums">
                    {(damping * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Mix</span>
                  <span className="text-[#A855F7] font-mono font-bold tabular-nums">
                    {(wet * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div className="flex-1 bg-gradient-to-br from-[#2d1854]/20 to-black/50 rounded-xl p-4 border border-[#A855F7]/10 overflow-y-auto">
              <div className="text-[9px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-3">
                How It Works
              </div>
              <div className="text-[9px] text-white/50 leading-relaxed space-y-2">
                <p>
                  <span className="text-[#22D3EE] font-bold">Size:</span> Room dimensions
                </p>
                <p>
                  <span className="text-[#A855F7] font-bold">Decay:</span> Reverberation time
                </p>
                <p>
                  <span className="text-[#FACC15] font-bold">Damping:</span> High frequency absorption
                </p>
                <div className="pt-2 border-t border-[#A855F7]/10 mt-2">
                  <p className="text-[#22D3EE]/80 font-bold mb-1">✨ v2.0</p>
                  <p>
                    <span className="text-[#A855F7] font-bold">Width:</span> Stereo field (0=mono, 200=ultra)
                  </p>
                  <p>
                    <span className="text-[#22D3EE] font-bold">Mod Depth:</span> Chorus shimmer amount
                  </p>
                </div>
                <p className="text-white/30 italic pt-2 text-[8px]">
                  💡 Watch RT60 marker in decay envelope
                </p>
              </div>
            </div>
          </>
        }

        collapsible={true}
        leftPanelWidth={240}
        rightPanelWidth={200}
      />
    </PluginContainerV2>
  );
};

export default ModernReverbUI_V2;

