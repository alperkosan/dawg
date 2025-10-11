import { useState } from 'react';
import { Knob, ModeSelector } from '@/components/controls';
import { useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

/**
 * MODERN DELAY V2.0 - REDESIGNED WITH ENHANCED COMPONENTS
 *
 * "The Spacetime Chamber" - Professional stereo delay
 *
 * Features:
 * - Enhanced component library (Knob, ModeSelector)
 * - Category theming ('spacetime-chamber' - purple/cyan palette)
 * - Ghost value feedback (400ms visual lag)
 * - Mode-based workflow (5 presets: Slapback/Ping-Pong/Dub/Ambient/Tape)
 * - Real-time ping-pong visualization
 * - Filter frequency curve
 *
 * Design Philosophy:
 * - "One knob, infinite possibilities" via modes
 * - Visual feedback at every step
 * - Category-based color identity
 */

// ============================================================================
// PING-PONG VISUALIZER
// ============================================================================

const PingPongVisualizer = ({ timeLeft, timeRight, feedbackLeft, feedbackRight, pingPong, wet }) => {
  const drawPingPong = (ctx, width, height) => {
    // Dark gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(10, 15, 30, 0.95)');
    bgGradient.addColorStop(1, 'rgba(5, 8, 18, 0.95)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const centerY = height / 2;
    const leftX = width * 0.2;
    const rightX = width * 0.8;

    // Draw delay lines
    const maxTime = Math.max(timeLeft, timeRight, 0.5);
    const leftDelayX = leftX + (timeLeft / maxTime) * (width * 0.25);
    const rightDelayX = rightX - (timeRight / maxTime) * (width * 0.25);

    // Left channel (cyan - spacetime-chamber secondary)
    ctx.strokeStyle = `rgba(34, 211, 238, ${wet * 0.8})`; // cyan
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(leftX, centerY);
    ctx.lineTo(leftDelayX, centerY);
    ctx.stroke();

    // Right channel (purple - spacetime-chamber primary)
    ctx.strokeStyle = `rgba(168, 85, 247, ${wet * 0.8})`; // purple
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rightX, centerY);
    ctx.lineTo(rightDelayX, centerY);
    ctx.stroke();

    // Ping-pong arrows
    if (pingPong > 0.1) {
      const arrowY1 = centerY - 30;
      const arrowY2 = centerY + 30;

      ctx.strokeStyle = `rgba(250, 204, 21, ${pingPong * 0.7})`; // yellow accent
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

    // Feedback indicators (animated pulses)
    const time = performance.now();
    const pulsePhase = (time * 0.02) % 1;

    // Left feedback
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

    // Right feedback
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
    ctx.fillText(`R: ${(timeRight * 1000).toFixed(0)}ms`, rightX - 60, centerY - 40);

    // Feedback percentages
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '10px monospace';
    ctx.fillText(`FB: ${(feedbackLeft * 100).toFixed(0)}%`, leftX, centerY + 50);
    ctx.fillText(`FB: ${(feedbackRight * 100).toFixed(0)}%`, rightX - 50, centerY + 50);
  };

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawPingPong,
    [timeLeft, timeRight, feedbackLeft, feedbackRight, pingPong, wet],
    { noLoop: false } // Animate for feedback pulses
  );

  return (
    <div ref={containerRef} className="w-full h-full bg-black/50 rounded-xl border border-[#A855F7]/20">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// DELAY MODES
// ============================================================================

const DELAY_MODES = {
  'slapback': {
    id: 'slapback',
    name: 'Slapback',
    icon: '⚡',
    description: 'Vintage rockabilly echo',
    defaults: { timeLeft: 0.08, timeRight: 0.085, feedbackLeft: 0.15, feedbackRight: 0.15, pingPong: 0.0, wet: 0.25 }
  },
  'ping-pong': {
    id: 'ping-pong',
    name: 'Ping-Pong',
    icon: '🏓',
    description: 'Stereo bouncing delay',
    defaults: { timeLeft: 0.375, timeRight: 0.5, feedbackLeft: 0.5, feedbackRight: 0.5, pingPong: 0.9, wet: 0.4 }
  },
  'dub': {
    id: 'dub',
    name: 'Dub',
    icon: '🎛️',
    description: 'Deep reggae echo',
    defaults: { timeLeft: 0.5, timeRight: 0.75, feedbackLeft: 0.7, feedbackRight: 0.7, pingPong: 0.6, wet: 0.5, filterFreq: 2000 }
  },
  'ambient': {
    id: 'ambient',
    name: 'Ambient',
    icon: '🌌',
    description: 'Lush atmospheric delay',
    defaults: { timeLeft: 1.2, timeRight: 1.5, feedbackLeft: 0.8, feedbackRight: 0.8, pingPong: 0.3, wet: 0.6, diffusion: 0.8 }
  },
  'tape': {
    id: 'tape',
    name: 'Tape',
    icon: '📼',
    description: 'Warm analog character',
    defaults: { timeLeft: 0.425, timeRight: 0.425, feedbackLeft: 0.55, feedbackRight: 0.55, pingPong: 0.0, wet: 0.35, filterFreq: 4000, saturation: 0.5 }
  },
  'custom': {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    description: 'Manual control',
    defaults: { timeLeft: 0.375, timeRight: 0.5, feedbackLeft: 0.4, feedbackRight: 0.4, pingPong: 0.0, wet: 0.35 }
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ModernDelayUI = ({ trackId, effect, onChange }) => {
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
  } = effect.settings;

  const [selectedMode, setSelectedMode] = useState('custom');

  // Ghost values (400ms lag for smooth visual feedback)
  const ghostTimeLeft = useGhostValue(timeLeft * 1000, 400);
  const ghostTimeRight = useGhostValue(timeRight * 1000, 400);
  const ghostFeedbackLeft = useGhostValue(feedbackLeft * 100, 400);
  const ghostWet = useGhostValue(wet * 100, 400);

  // Prepare modes for ModeSelector component
  const modes = Object.values(DELAY_MODES).map(mode => ({
    id: mode.id,
    label: mode.name,
    icon: mode.icon,
    description: mode.description
  }));

  const currentMode = DELAY_MODES[selectedMode];

  // Handle mode change
  const handleModeChange = (modeId) => {
    setSelectedMode(modeId);
    const mode = DELAY_MODES[modeId];
    Object.entries(mode.defaults).forEach(([key, value]) => {
      onChange(key, value);
    });
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-neutral-950 to-black p-4 flex gap-4 overflow-hidden">

      {/* ===== LEFT PANEL: Mode Selection ===== */}
      <div className="w-[240px] flex-shrink-0 flex flex-col gap-4">

        {/* Plugin Header */}
        <div className="bg-gradient-to-r from-[#2d1854] to-[#1a1a1a] rounded-xl px-4 py-3 border border-[#A855F7]/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{currentMode?.icon || '⏱️'}</div>
            <div className="flex-1">
              <div className="text-sm font-black text-[#A855F7] tracking-wider uppercase">
                Modern Delay
              </div>
              <div className="text-[9px] text-[#22D3EE]/70">The Spacetime Chamber</div>
            </div>
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

        {/* Quick Info */}
        <div className="bg-gradient-to-br from-[#2d1854]/50 to-black/50 rounded-xl p-3 border border-[#A855F7]/10">
          <div className="text-[9px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-2">
            Current Mode
          </div>
          <div className="text-[10px] text-white/60 leading-relaxed">
            {currentMode?.description || 'Select a mode above'}
          </div>
        </div>
      </div>

      {/* ===== CENTER PANEL: Visualization + Controls ===== */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto pr-2">

        {/* Ping-Pong Visualizer */}
        <div className="h-[200px]">
          <PingPongVisualizer
            timeLeft={timeLeft}
            timeRight={timeRight}
            feedbackLeft={feedbackLeft}
            feedbackRight={feedbackRight}
            pingPong={pingPong}
            wet={wet}
          />
        </div>

        {/* Main Controls */}
        <div className="bg-gradient-to-br from-black/50 to-[#2d1854]/30 rounded-xl p-6 border border-[#A855F7]/20">
          <div className="grid grid-cols-4 gap-6">

            {/* Time Left */}
            <Knob
              label="TIME L"
              value={timeLeft * 1000}
              ghostValue={ghostTimeLeft}
              onChange={(val) => onChange('timeLeft', val / 1000)}
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
              ghostValue={ghostTimeRight}
              onChange={(val) => onChange('timeRight', val / 1000)}
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
              ghostValue={ghostFeedbackLeft}
              onChange={(val) => {
                onChange('feedbackLeft', val / 100);
                onChange('feedbackRight', val / 100);
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
              ghostValue={ghostWet}
              onChange={(val) => onChange('wet', val / 100)}
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
                onChange={(val) => onChange('pingPong', val / 100)}
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
                onChange={(val) => onChange('width', val / 100)}
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
                onChange={(val) => onChange('filterFreq', val)}
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
                onChange={(val) => onChange('saturation', val / 100)}
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
            onChange={(val) => onChange('diffusion', val / 100)}
            min={0}
            max={100}
            defaultValue={0}
            sizeVariant="small"
            category="spacetime-chamber"
            valueFormatter={(v) => `${v.toFixed(0)}%`}
          />
        </div>
      </div>

      {/* ===== RIGHT PANEL: Stats & Info ===== */}
      <div className="w-[200px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-2">

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
      </div>

    </div>
  );
};
