/**
 * MODERN DELAY UI V2.0 - UNIFIED DESIGN
 *
 * Professional stereo delay with ping-pong visualization
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Full-width layout (removed TwoPanelLayout)
 * ✅ Expanded PingPongVisualizer
 * ✅ Added Modulation Controls (Wobble, Flutter)
 * ✅ Parameter Batching
 * ✅ Category-based theming (spacetime-chamber)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { Knob, Slider, Checkbox } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useMixerStore } from '@/store/useMixerStore';

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
  wobble,
  flutter
}) => {
  const canvasRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const animationPhaseRef = React.useRef(0);

  const drawPingPong = useCallback((timestamp) => {
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

    // Background
    // ctx.fillStyle = 'rgba(5, 5, 10, 0.98)';
    // ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Animation phase
    animationPhaseRef.current = (animationPhaseRef.current + 0.02) % 1;
    const phase = animationPhaseRef.current;

    const centerY = displayHeight / 2;
    const leftX = displayWidth * 0.2;
    const rightX = displayWidth * 0.8;

    // Draw stereo channels
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
    ctx.lineWidth = 3;

    // Left channel
    ctx.beginPath();
    ctx.arc(leftX, centerY, 30, 0, Math.PI * 2);
    ctx.stroke();

    // Right channel
    ctx.beginPath();
    ctx.arc(rightX, centerY, 30, 0, Math.PI * 2);
    ctx.stroke();

    // Ping-pong connection line
    if (pingPong > 0) {
      ctx.strokeStyle = `rgba(168, 85, 247, ${pingPong * 0.8})`;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(leftX, centerY);
      ctx.lineTo(rightX, centerY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Delay time indicators
    const maxTime = Math.max(timeLeft, timeRight, 0.5);
    const leftDelayX = leftX + (timeLeft / maxTime) * (displayWidth * 0.25);
    const rightDelayX = rightX - (timeRight / maxTime) * (displayWidth * 0.25);

    // Wobble effect on position
    const wobbleOffset = Math.sin(phase * 10) * wobble * 10;

    // Left delay marker
    ctx.fillStyle = 'rgba(34, 211, 238, 0.8)';
    ctx.beginPath();
    ctx.arc(leftDelayX + wobbleOffset, centerY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Right delay marker
    ctx.fillStyle = 'rgba(168, 85, 247, 0.8)';
    ctx.beginPath();
    ctx.arc(rightDelayX - wobbleOffset, centerY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Feedback pulses
    for (let i = 0; i < 3; i++) {
      const pulsePhase = (phase + i * 0.33) % 1;
      const opacity = (1 - pulsePhase) * feedbackLeft * wet;

      // Flutter effect on radius
      const flutterOffset = (Math.random() - 0.5) * flutter * 5;

      ctx.strokeStyle = `rgba(34, 211, 238, ${opacity})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(leftX, centerY, 30 + pulsePhase * 40 + flutterOffset, 0, Math.PI * 2);
      ctx.stroke();

      const opacityR = (1 - pulsePhase) * feedbackRight * wet;
      ctx.strokeStyle = `rgba(168, 85, 247, ${opacityR})`;
      ctx.beginPath();
      ctx.arc(rightX, centerY, 30 + pulsePhase * 40 + flutterOffset, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Labels
    ctx.fillStyle = 'rgba(34, 211, 238, 0.9)';
    ctx.font = 'bold 12px Inter, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('L', leftX, centerY + 5);
    ctx.fillText(`${(timeLeft * 1000).toFixed(0)}ms`, leftX, centerY - 40);
    ctx.fillText(`FB: ${(feedbackLeft * 100).toFixed(0)}%`, leftX, centerY + 50);

    ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
    ctx.fillText('R', rightX, centerY + 5);
    ctx.fillText(`${(timeRight * 1000).toFixed(0)}ms`, rightX, centerY - 40);
    ctx.fillText(`FB: ${(feedbackRight * 100).toFixed(0)}%`, rightX, centerY + 50);

    ctx.restore();
  }, [timeLeft, timeRight, feedbackLeft, feedbackRight, pingPong, wet, wobble, flutter]);

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
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Register with CanvasRenderManager (30fps)
  useRenderer(drawPingPong, 5, 33.33, [timeLeft, timeRight, feedbackLeft, feedbackRight, pingPong, wet, wobble, flutter]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-black/40 rounded-lg border border-white/5 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ModernDelayUI_V2 = ({ trackId, effect, effectNode, onChange, definition }) => {
  const {
    timeLeft = 0.375,
    timeRight = 0.5,
    feedbackLeft = 0.4,
    feedbackRight = 0.4,
    pingPong = 0,
    wet = 0.35,
    filterFreq = 8000,
    saturation = 0.0,
    diffusion = 0.0,
    wobble = 0.0,
    flutter = 0.0,
    width = 1.0
  } = effect.settings || {};

  // Local state
  const [localTimeLeft, setLocalTimeLeft] = useState(timeLeft);
  const [localTimeRight, setLocalTimeRight] = useState(timeRight);
  const [localFeedbackLeft, setLocalFeedbackLeft] = useState(feedbackLeft);
  const [localFeedbackRight, setLocalFeedbackRight] = useState(feedbackRight);
  const [localPingPong, setLocalPingPong] = useState(pingPong);
  const [localWet, setLocalWet] = useState(wet);
  const [localFilterFreq, setLocalFilterFreq] = useState(filterFreq);
  const [localSaturation, setLocalSaturation] = useState(saturation);
  const [localDiffusion, setLocalDiffusion] = useState(diffusion);
  const [localWobble, setLocalWobble] = useState(wobble);
  const [localFlutter, setLocalFlutter] = useState(flutter);
  const [localWidth, setLocalWidth] = useState(width);

  const categoryColors = useMemo(() => getCategoryColors('spacetime-chamber'), []);
  const { setParam } = useParameterBatcher(effectNode);
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Sync with presets
  useEffect(() => {
    if (effect.settings.timeLeft !== undefined) setLocalTimeLeft(effect.settings.timeLeft);
    if (effect.settings.timeRight !== undefined) setLocalTimeRight(effect.settings.timeRight);
    if (effect.settings.feedbackLeft !== undefined) setLocalFeedbackLeft(effect.settings.feedbackLeft);
    if (effect.settings.feedbackRight !== undefined) setLocalFeedbackRight(effect.settings.feedbackRight);
    if (effect.settings.pingPong !== undefined) setLocalPingPong(effect.settings.pingPong);
    if (effect.settings.wet !== undefined) setLocalWet(effect.settings.wet);
    if (effect.settings.filterFreq !== undefined) setLocalFilterFreq(effect.settings.filterFreq);
    if (effect.settings.saturation !== undefined) setLocalSaturation(effect.settings.saturation);
    if (effect.settings.diffusion !== undefined) setLocalDiffusion(effect.settings.diffusion);
    if (effect.settings.wobble !== undefined) setLocalWobble(effect.settings.wobble);
    if (effect.settings.flutter !== undefined) setLocalFlutter(effect.settings.flutter);
    if (effect.settings.width !== undefined) setLocalWidth(effect.settings.width);
  }, [effect.settings]);

  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });
    onChange?.(key, value);

    switch (key) {
      case 'timeLeft': setLocalTimeLeft(value); break;
      case 'timeRight': setLocalTimeRight(value); break;
      case 'feedbackLeft': setLocalFeedbackLeft(value); break;
      case 'feedbackRight': setLocalFeedbackRight(value); break;
      case 'pingPong': setLocalPingPong(value); break;
      case 'wet': setLocalWet(value); break;
      case 'filterFreq': setLocalFilterFreq(value); break;
      case 'saturation': setLocalSaturation(value); break;
      case 'diffusion': setLocalDiffusion(value); break;
      case 'wobble': setLocalWobble(value); break;
      case 'flutter': setLocalFlutter(value); break;
      case 'width': setLocalWidth(value); break;
    }
  }, [setParam, handleMixerEffectChange, trackId, effect.id, onChange]);

  return (
    <PluginContainerV2
      trackId={trackId}
      effect={effect}
      definition={definition}
      category="spacetime-chamber"
    >
      <div className="flex flex-col h-full gap-3 p-3">

        {/* TOP SECTION: Visualizer & Time Controls */}
        <div className="flex flex-1 gap-3 min-h-0">

          {/* Visualizer (Slightly reduced width to give more space to controls) */}
          <div className="flex-[1.4] relative min-w-0">
            <PingPongVisualizer
              timeLeft={localTimeLeft}
              timeRight={localTimeRight}
              feedbackLeft={localFeedbackLeft}
              feedbackRight={localFeedbackRight}
              pingPong={localPingPong}
              wet={localWet}
              wobble={localWobble}
              flutter={localFlutter}
            />
          </div>

          {/* Time & Feedback Controls */}
          <div className="flex-1 bg-gradient-to-br from-black/50 to-[#2d1854]/30 rounded-xl p-3 border border-[#A855F7]/20 flex flex-col justify-between min-w-0">
            <div className="text-[11px] font-bold text-[#22D3EE]/70 mb-2 uppercase tracking-wider truncate">Time & Space</div>

            <div className="flex flex-col gap-2">
              {/* Left */}
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-[9px] text-cyan-400 font-bold mb-1 truncate">LEFT CHANNEL</div>
                <div className="flex items-center gap-3">
                  <Knob
                    label="TIME"
                    value={localTimeLeft * 1000}
                    onChange={(v) => handleParamChange('timeLeft', v / 1000)}
                    min={10}
                    max={2000}
                    defaultValue={375}
                    sizeVariant="medium"
                    category="spacetime-chamber"
                    valueFormatter={(v) => `${v.toFixed(0)} ms`}
                  />
                  <div className="flex-1 pt-3">
                    <Slider
                      label="FEEDBACK"
                      value={localFeedbackLeft * 100}
                      onChange={(v) => handleParamChange('feedbackLeft', v / 100)}
                      min={0}
                      max={100}
                      defaultValue={40}
                      unit="%"
                      precision={0}
                      category="spacetime-chamber"
                    />
                  </div>
                </div>
              </div>

              {/* Right */}
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-[9px] text-purple-400 font-bold mb-1 truncate">RIGHT CHANNEL</div>
                <div className="flex items-center gap-3">
                  <Knob
                    label="TIME"
                    value={localTimeRight * 1000}
                    onChange={(v) => handleParamChange('timeRight', v / 1000)}
                    min={10}
                    max={2000}
                    defaultValue={500}
                    sizeVariant="medium"
                    category="spacetime-chamber"
                    valueFormatter={(v) => `${v.toFixed(0)} ms`}
                  />
                  <div className="flex-1 pt-3">
                    <Slider
                      label="FEEDBACK"
                      value={localFeedbackRight * 100}
                      onChange={(v) => handleParamChange('feedbackRight', v / 100)}
                      min={0}
                      max={100}
                      defaultValue={40}
                      unit="%"
                      precision={0}
                      category="spacetime-chamber"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-white/5">
              <Slider
                label="PING-PONG"
                value={localPingPong * 100}
                onChange={(v) => handleParamChange('pingPong', v / 100)}
                defaultValue={0}
                unit="%"
                precision={0}
                category="spacetime-chamber"
              />
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Character, Modulation & Mix */}
        <div className="h-32 flex gap-3 min-h-0">

          {/* Character */}
          <div className="flex-1 bg-gradient-to-br from-[#1e1b4b]/50 to-black/50 rounded-xl p-3 border border-[#A855F7]/10 min-w-0">
            <div className="text-[11px] font-bold text-[#22D3EE]/70 mb-2 uppercase tracking-wider">Character</div>
            <div className="flex gap-2 justify-between">
              <Knob
                label="FILTER"
                value={localFilterFreq}
                onChange={(v) => handleParamChange('filterFreq', v)}
                min={200}
                max={20000}
                defaultValue={8000}
                sizeVariant="small"
                category="spacetime-chamber"
                valueFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
              />
              <Knob
                label="SATURATE"
                value={localSaturation * 100}
                onChange={(v) => handleParamChange('saturation', v / 100)}
                min={0}
                max={100}
                defaultValue={0}
                sizeVariant="small"
                category="spacetime-chamber"
                valueFormatter={(v) => `${v.toFixed(0)}%`}
              />
              <Knob
                label="DIFFUSE"
                value={localDiffusion * 100}
                onChange={(v) => handleParamChange('diffusion', v / 100)}
                min={0}
                max={100}
                defaultValue={0}
                sizeVariant="small"
                category="spacetime-chamber"
                valueFormatter={(v) => `${v.toFixed(0)}%`}
              />
            </div>
          </div>

          {/* Modulation (NEW) */}
          <div className="flex-1 bg-gradient-to-br from-[#1e1b4b]/50 to-black/50 rounded-xl p-3 border border-[#A855F7]/10 min-w-0">
            <div className="text-[11px] font-bold text-[#A855F7]/70 mb-2 uppercase tracking-wider">Modulation</div>
            <div className="flex gap-2 justify-between">
              <Knob
                label="WOBBLE"
                value={localWobble * 100}
                onChange={(v) => handleParamChange('wobble', v / 100)}
                min={0}
                max={100}
                defaultValue={0}
                sizeVariant="small"
                category="spacetime-chamber"
                valueFormatter={(v) => `${v.toFixed(0)}%`}
              />
              <Knob
                label="FLUTTER"
                value={localFlutter * 100}
                onChange={(v) => handleParamChange('flutter', v / 100)}
                min={0}
                max={100}
                defaultValue={0}
                sizeVariant="small"
                category="spacetime-chamber"
                valueFormatter={(v) => `${v.toFixed(0)}%`}
              />
              <Knob
                label="WIDTH"
                value={localWidth * 100}
                onChange={(v) => handleParamChange('width', v / 100)}
                min={0}
                max={100}
                defaultValue={100}
                sizeVariant="small"
                category="spacetime-chamber"
                valueFormatter={(v) => `${v.toFixed(0)}%`}
              />
            </div>
          </div>

          {/* Output */}
          <div className="w-28 bg-black/40 rounded-xl p-3 border border-white/5 flex flex-col justify-center min-w-0">
            <Knob
              label="MIX"
              value={localWet * 100}
              onChange={(v) => handleParamChange('wet', v / 100)}
              min={0}
              max={100}
              defaultValue={35}
              sizeVariant="medium"
              category="spacetime-chamber"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />
          </div>

        </div>
      </div>
    </PluginContainerV2>
  );
};

export default ModernDelayUI_V2;
