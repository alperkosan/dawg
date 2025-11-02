/**
 * MODERN DELAY UI V2.0
 *
 * Professional stereo delay with ping-pong visualization
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
 * - Real-time ping-pong visualization with animated feedback pulses
 * - Mode-based workflow (6 delay styles)
 * - Professional factory presets
 * - A/B comparison (via PluginContainerV2)
 * - Undo/Redo (via PluginContainerV2)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { ThreePanelLayout } from '../layout/ThreePanelLayout';
import { Knob, ModeSelector } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { delayPresets } from '@/config/presets/delayPresets';
import { useMixerStore } from '@/store/useMixerStore';

// ============================================================================
// DELAY MODES - Factory Presets (imported from delayPresets.js)
// ============================================================================

// Preset icons mapping
const PRESET_ICONS = {
  slapback: '⚡',
  pingpong: '🏓',
  dub: '🎛️',
  ambient: '🌌',
  tape: '📼',
  custom: '⚙️'
};

// Transform delayPresets to UI format
const DELAY_MODES = delayPresets.map(preset => ({
  id: preset.id,
  name: preset.name,
  icon: PRESET_ICONS[preset.id] || '⚙️',
  description: preset.description,
  category: preset.category,
  tags: preset.tags,
  baseParams: preset.settings
}));

// ============================================================================
// PING-PONG VISUALIZER - Using CanvasRenderManager
// ============================================================================

const PingPongVisualizer = ({ 
  timeLeft, 
  timeRight, 
  feedbackLeft, 
  feedbackRight, 
  pingPong, 
  wet,
  categoryColors 
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const drawPingPong = useCallback((timestamp) => {
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

    // Clear with dark gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
    bgGradient.addColorStop(0, 'rgba(10, 15, 30, 0.95)');
    bgGradient.addColorStop(1, 'rgba(5, 8, 18, 0.95)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    const centerY = displayHeight / 2;
    const leftX = displayWidth * 0.2;
    const rightX = displayWidth * 0.8;

    // Calculate delay line endpoints
    const maxTime = Math.max(timeLeft, timeRight, 0.5);
    const leftDelayX = leftX + (timeLeft / maxTime) * (displayWidth * 0.25);
    const rightDelayX = rightX - (timeRight / maxTime) * (displayWidth * 0.25);

    // Left channel (cyan - spacetime-chamber secondary)
    ctx.strokeStyle = `rgba(34, 211, 238, ${wet * 0.8})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(leftX, centerY);
    ctx.lineTo(leftDelayX, centerY);
    ctx.stroke();

    // Right channel (purple - spacetime-chamber primary)
    ctx.strokeStyle = `rgba(168, 85, 247, ${wet * 0.8})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rightX, centerY);
    ctx.lineTo(rightDelayX, centerY);
    ctx.stroke();

    // Ping-pong arrows
    if (pingPong > 0.1) {
      const arrowY1 = centerY - 30;
      const arrowY2 = centerY + 30;

      ctx.strokeStyle = `rgba(250, 204, 21, ${pingPong * 0.7})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      // Left to right
      ctx.beginPath();
      ctx.moveTo(leftDelayX, arrowY1);
      ctx.lineTo(rightDelayX, arrowY1);
      ctx.stroke();

      // Right to left
      ctx.beginPath();
      ctx.moveTo(rightDelayX, arrowY2);
      ctx.lineTo(leftDelayX, arrowY2);
      ctx.stroke();

      ctx.setLineDash([]);
    }

    // Animated feedback indicators
    const time = timestamp;
    const pulsePhase = (time * 0.02) % 1;

    // Left feedback pulses
    for (let i = 0; i < 3; i++) {
      const phase = (pulsePhase + i * 0.33) % 1;
      const radius = 5 + phase * 20;
      const opacity = (1 - phase) * feedbackLeft * wet;

      ctx.strokeStyle = `rgba(34, 211, 238, ${opacity})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(leftDelayX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Right feedback pulses
    for (let i = 0; i < 3; i++) {
      const phase = (pulsePhase + i * 0.33) % 1;
      const radius = 5 + phase * 20;
      const opacity = (1 - phase) * feedbackRight * wet;

      ctx.strokeStyle = `rgba(168, 85, 247, ${opacity})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rightDelayX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Delay time labels
    ctx.fillStyle = 'rgba(34, 211, 238, 0.9)';
    ctx.font = '11px monospace';
    ctx.fillText(`L: ${(timeLeft * 1000).toFixed(0)}ms`, leftX, centerY - 40);

    ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
    ctx.font = '11px monospace';
    ctx.fillText(`R: ${(timeRight * 1000).toFixed(0)}ms`, rightX - 60, centerY - 40);

    // Feedback percentages
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '10px monospace';
    ctx.fillText(`FB: ${(feedbackLeft * 100).toFixed(0)}%`, leftX, centerY + 50);
    ctx.fillText(`FB: ${(feedbackRight * 100).toFixed(0)}%`, rightX - 50, centerY + 50);

    // Restore context
    ctx.restore();
  }, [timeLeft, timeRight, feedbackLeft, feedbackRight, pingPong, wet]);

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

    // Initial size
    updateDimensions();

    // Watch container for resize (panels expanding/collapsing will trigger this)
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Use CanvasRenderManager for smooth 60fps rendering
  useRenderer(drawPingPong, 5, 16, [timeLeft, timeRight, feedbackLeft, feedbackRight, pingPong, wet]);

  return (
    <div ref={containerRef} className="w-full h-full bg-black/50 rounded-xl border border-[#A855F7]/20 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ModernDelayUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  const {
    timeLeft = 0.375,
    timeRight = 0.5,
    feedbackLeft = 0.4,
    feedbackRight = 0.4,
    pingPong = 0.0,
    wet = 0.35,
    filterFreq = 8000,
    saturation = 0.0,
    diffusion = 0.0,
    width = 1.0
  } = effect.settings || {};

  const [selectedMode, setSelectedMode] = useState('custom');

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('spacetime-chamber'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam } = useParameterBatcher(effectNode);

  // Mixer store for parameter changes
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Prepare modes for ModeSelector
  const modes = useMemo(() => DELAY_MODES.map(mode => ({
    id: mode.id,
    label: mode.name,
    icon: mode.icon,
    description: mode.description
  })), []);

  const currentMode = DELAY_MODES.find(m => m.id === selectedMode) || DELAY_MODES[5];

  // Handle mode change (preset selection)
  const handleModeChange = useCallback((modeId) => {
    setSelectedMode(modeId);
    const mode = DELAY_MODES.find(m => m.id === modeId);
    if (mode) {
      // Apply all preset parameters at once
      Object.entries(mode.baseParams).forEach(([key, value]) => {
        setParam(key, value);
      });
      handleMixerEffectChange(trackId, effect.id, mode.baseParams);
    }
  }, [setParam, trackId, effect.id, handleMixerEffectChange]);

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
      category="spacetime-chamber"
    >
      <ThreePanelLayout
        category="spacetime-chamber"
        
        leftPanel={
          <>
            {/* Mode Selector */}
            <ModeSelector
              modes={modes}
              activeMode={selectedMode}
              onChange={handleModeChange}
              orientation="vertical"
              category="spacetime-chamber"
              className="flex-1"
            />

            {/* Quick Info */}
            <div className="bg-gradient-to-br from-[#2d1854]/50 to-black/50 rounded-xl p-3 border border-[#A855F7]/10">
              <div className="text-[9px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-2">
                Current Mode
              </div>
              <div className="text-[10px] text-white/60 leading-relaxed">
                {currentMode?.description || 'Select a mode above'}
              </div>
            </div>
          </>
        }

        centerPanel={
          <>
            {/* Ping-Pong Visualizer */}
            <div className="h-[200px]">
              <PingPongVisualizer
                timeLeft={timeLeft}
                timeRight={timeRight}
                feedbackLeft={feedbackLeft}
                feedbackRight={feedbackRight}
                pingPong={pingPong}
                wet={wet}
                categoryColors={categoryColors}
              />
            </div>

            {/* Main Controls */}
            <div className="bg-gradient-to-br from-black/50 to-[#2d1854]/30 rounded-xl p-6 border border-[#A855F7]/20">
              <div className="grid grid-cols-4 gap-6">
                {/* Time Left */}
                <Knob
                  label="TIME L"
                  value={timeLeft * 1000}
                  onChange={(val) => handleParamChange('timeLeft', val / 1000)}
                  min={1}
                  max={4000}
                  defaultValue={375}
                  sizeVariant="medium"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(0)} ms`}
                />

                {/* Time Right */}
                <Knob
                  label="TIME R"
                  value={timeRight * 1000}
                  onChange={(val) => handleParamChange('timeRight', val / 1000)}
                  min={1}
                  max={4000}
                  defaultValue={500}
                  sizeVariant="medium"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(0)} ms`}
                />

                {/* Feedback */}
                <Knob
                  label="FEEDBACK"
                  value={feedbackLeft * 100}
                  onChange={(val) => {
                    const v = val / 100;
                    handleParamChange('feedbackLeft', v);
                    handleParamChange('feedbackRight', v);
                  }}
                  min={0}
                  max={100}
                  defaultValue={40}
                  sizeVariant="medium"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />

                {/* Mix */}
                <Knob
                  label="MIX"
                  value={wet * 100}
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
              {/* Stereo & Ping-Pong */}
              <div className="bg-black/30 rounded-xl p-4 border border-[#A855F7]/10">
                <div className="text-[10px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-3">
                  Stereo
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Knob
                    label="PING-PONG"
                    value={pingPong * 100}
                    onChange={(val) => handleParamChange('pingPong', val / 100)}
                    min={0}
                    max={100}
                    defaultValue={0}
                    sizeVariant="small"
                    category="spacetime-chamber"
                    valueFormatter={(v) => `${v.toFixed(0)}%`}
                  />
                  <Knob
                    label="WIDTH"
                    value={width * 100}
                    onChange={(val) => handleParamChange('width', val / 100)}
                    min={0}
                    max={200}
                    defaultValue={100}
                    sizeVariant="small"
                    category="spacetime-chamber"
                    valueFormatter={(v) => `${v.toFixed(0)}%`}
                  />
                </div>
              </div>

              {/* Color */}
              <div className="bg-black/30 rounded-xl p-4 border border-[#A855F7]/10">
                <div className="text-[10px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-3">
                  Color
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Knob
                    label="FILTER"
                    value={filterFreq}
                    onChange={(val) => handleParamChange('filterFreq', val)}
                    min={100}
                    max={20000}
                    defaultValue={8000}
                    logarithmic={true}
                    sizeVariant="small"
                    category="spacetime-chamber"
                    valueFormatter={(v) => {
                      if (v >= 1000) return `${(v / 1000).toFixed(1)} kHz`;
                      return `${v.toFixed(0)} Hz`;
                    }}
                  />
                  <Knob
                    label="SATURATE"
                    value={saturation * 100}
                    onChange={(val) => handleParamChange('saturation', val / 100)}
                    min={0}
                    max={100}
                    defaultValue={0}
                    sizeVariant="small"
                    category="spacetime-chamber"
                    valueFormatter={(v) => `${v.toFixed(0)}%`}
                  />
                </div>
              </div>
            </div>

            {/* Diffusion */}
            <div className="bg-black/30 rounded-xl p-4 border border-[#A855F7]/10">
              <Knob
                label="DIFFUSION"
                value={diffusion * 100}
                onChange={(val) => handleParamChange('diffusion', val / 100)}
                min={0}
                max={100}
                defaultValue={0}
                sizeVariant="small"
                category="spacetime-chamber"
                valueFormatter={(v) => `${v.toFixed(0)}%`}
              />
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
                  <span className="text-white/50">Mode</span>
                  <span className="text-[#A855F7] text-[9px] font-medium">
                    {currentMode?.name}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#A855F7]/10">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-white/50">Time L</span>
                    <span className="text-[#22D3EE] font-mono font-bold tabular-nums">
                      {(timeLeft * 1000).toFixed(0)}ms
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Time R</span>
                  <span className="text-[#A855F7] font-mono font-bold tabular-nums">
                    {(timeRight * 1000).toFixed(0)}ms
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Feedback</span>
                  <span className="text-[#22D3EE] font-mono font-bold tabular-nums">
                    {(feedbackLeft * 100).toFixed(0)}%
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
            <div className="flex-1 bg-gradient-to-br from-[#2d1854]/20 to-black/50 rounded-xl p-4 border border-[#A855F7]/10">
              <div className="text-[9px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-3">
                How It Works
              </div>
              <div className="text-[9px] text-white/50 leading-relaxed space-y-2">
                <p>
                  <span className="text-[#22D3EE] font-bold">Time:</span> Delay duration per channel
                </p>
                <p>
                  <span className="text-[#A855F7] font-bold">Feedback:</span> Number of repeats
                </p>
                <p>
                  <span className="text-[#FACC15] font-bold">Ping-Pong:</span> Stereo bounce amount
                </p>
                <p className="text-white/30 italic pt-2 text-[8px]">
                  💡 Watch the delay lines dance in real-time
                </p>
              </div>
            </div>

            {/* Category Badge */}
            <div className="bg-gradient-to-r from-[#2d1854] to-[#1a1a1a] rounded-lg px-3 py-2 border border-[#A855F7]/20 text-center">
              <div className="text-[8px] text-[#22D3EE]/50 uppercase tracking-wider">Category</div>
              <div className="text-[10px] text-[#A855F7] font-bold">The Spacetime Chamber</div>
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

export default ModernDelayUI_V2;

