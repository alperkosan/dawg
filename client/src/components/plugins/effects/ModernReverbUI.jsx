import { useState } from 'react';
import { Knob, ModeSelector } from '@/components/controls';
import { useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

/**
 * MODERN REVERB V2.0 - REDESIGNED WITH ENHANCED COMPONENTS
 *
 * "The Spacetime Chamber" - Professional algorithmic reverb
 *
 * Features:
 * - Enhanced component library (Knob, ModeSelector)
 * - Category theming ('spacetime-chamber' - purple/cyan palette)
 * - Ghost value feedback (400ms visual lag)
 * - Mode-based workflow (6 space presets)
 * - Real-time decay envelope visualization
 * - Early/late reflections display
 *
 * Design Philosophy:
 * - "One knob, infinite possibilities" via modes
 * - Visual feedback at every step
 * - Category-based color identity
 */

// ============================================================================
// DECAY ENVELOPE VISUALIZER
// ============================================================================

const DecayEnvelopeVisualizer = ({ decay, damping, earlyLateMix, size }) => {
  const drawDecay = (ctx, width, height) => {
    // Dark gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(10, 15, 30, 0.95)');
    bgGradient.addColorStop(1, 'rgba(5, 8, 18, 0.95)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Decay envelope curve (cyan - spacetime-chamber)
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(34, 211, 238, 0.9)'); // cyan
    gradient.addColorStop(1, 'rgba(34, 211, 238, 0.1)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, height);

    for (let x = 0; x <= width; x++) {
      const t = x / width;
      const decayFactor = Math.exp(-t * (8 / decay));
      const dampFactor = Math.exp(-t * damping * 4);
      const amplitude = decayFactor * dampFactor;
      const y = height - amplitude * height * 0.85;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Early reflections markers (yellow accent)
    const earlyTimes = [0.017, 0.023, 0.031, 0.043, 0.047, 0.059, 0.067, 0.073];
    const maxTime = Math.max(decay, 1);

    earlyTimes.forEach((time) => {
      const x = (time / maxTime) * width;
      const opacity = earlyLateMix * 0.7;

      ctx.strokeStyle = `rgba(250, 204, 21, ${opacity})`; // yellow
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, height * 0.2);
      ctx.lineTo(x, height * 0.4);
      ctx.stroke();
    });

    // RT60 indicator (purple - spacetime-chamber)
    const rt60Time = decay * 0.16;
    const rt60X = (rt60Time / maxTime) * width;
    if (rt60X < width) {
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)'; // purple
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(rt60X, 0);
      ctx.lineTo(rt60X, height);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
      ctx.font = '10px monospace';
      ctx.fillText(`RT60: ${rt60Time.toFixed(2)}s`, rt60X + 3, 12);
    }

    // Pulse animation for room size
    const time = performance.now();
    const pulse = Math.sin(time * 0.002) * 0.5 + 0.5;
    const roomRadius = size * 15 + pulse * 3;

    ctx.strokeStyle = `rgba(34, 211, 238, ${0.3 + pulse * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width - 30, 25, roomRadius, 0, Math.PI * 2);
    ctx.stroke();
  };

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawDecay,
    [decay, damping, earlyLateMix, size],
    { noLoop: false } // Animate for room pulse
  );

  return (
    <div ref={containerRef} className="w-full h-full bg-black/50 rounded-xl border border-[#A855F7]/20">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// REVERB MODES
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
// MAIN COMPONENT
// ============================================================================

export const ModernReverbUI = ({ trackId, effect, onChange }) => {
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
  } = effect.settings;

  const [selectedMode, setSelectedMode] = useState('custom');

  // Ghost values (400ms lag for smooth visual feedback)
  const ghostSize = useGhostValue(size * 100, 400);
  const ghostDecay = useGhostValue(decay, 400);
  const ghostDamping = useGhostValue(damping * 100, 400);
  const ghostWet = useGhostValue(wet * 100, 400);

  // Prepare modes for ModeSelector component
  const modes = Object.values(REVERB_MODES).map(mode => ({
    id: mode.id,
    label: mode.name,
    icon: mode.icon,
    description: mode.description
  }));

  const currentMode = REVERB_MODES[selectedMode];

  // Handle mode change
  const handleModeChange = (modeId) => {
    setSelectedMode(modeId);
    const mode = REVERB_MODES[modeId];
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
            <div className="text-2xl">{currentMode?.icon || '🔊'}</div>
            <div className="flex-1">
              <div className="text-sm font-black text-[#A855F7] tracking-wider uppercase">
                Modern Reverb
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
            {currentMode?.description || 'Select a space above'}
          </div>
        </div>
      </div>

      {/* ===== CENTER PANEL: Visualization + Controls ===== */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto pr-2">

        {/* Decay Envelope Visualizer */}
        <div className="h-[200px]">
          <DecayEnvelopeVisualizer
            decay={decay}
            damping={damping}
            earlyLateMix={earlyLateMix}
            size={size}
          />
        </div>

        {/* Main Controls */}
        <div className="bg-gradient-to-br from-black/50 to-[#2d1854]/30 rounded-xl p-6 border border-[#A855F7]/20">
          <div className="grid grid-cols-4 gap-6">

            {/* Size */}
            <Knob
              label="SIZE"
              value={size * 100}
              ghostValue={ghostSize}
              onChange={(val) => onChange('size', val / 100)}
              min={0}
              max={100}
              defaultValue={70}
              sizeVariant="medium"
              category="spacetime-chamber"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />

            {/* Decay */}
            <Knob
              label="DECAY"
              value={decay}
              ghostValue={ghostDecay}
              onChange={(val) => onChange('decay', val)}
              min={0.1}
              max={15}
              defaultValue={2.5}
              sizeVariant="medium"
              category="spacetime-chamber"
              valueFormatter={(v) => `${v.toFixed(1)} s`}
            />

            {/* Damping */}
            <Knob
              label="DAMPING"
              value={damping * 100}
              ghostValue={ghostDamping}
              onChange={(val) => onChange('damping', val / 100)}
              min={0}
              max={100}
              defaultValue={50}
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
          {/* Time & Space */}
          <div className="bg-black/30 rounded-xl p-4 border border-[#A855F7]/10">
            <div className="text-[10px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-3">
              Time & Space
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Knob
                label="PRE-DELAY"
                value={preDelay * 1000}
                onChange={(val) => onChange('preDelay', val / 1000)}
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
                onChange={(val) => onChange('earlyLateMix', val / 100)}
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
                onChange={(val) => onChange('width', val / 100)}
                min={0}
                max={100}
                defaultValue={100}
                sizeVariant="small"
                category="spacetime-chamber"
                valueFormatter={(v) => `${v.toFixed(0)}%`}
              />
              <Knob
                label="DIFFUSION"
                value={diffusion * 100}
                onChange={(val) => onChange('diffusion', val / 100)}
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
              onChange={(val) => onChange('modDepth', val / 100)}
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
              onChange={(val) => onChange('modRate', val)}
              min={0.1}
              max={2}
              defaultValue={0.5}
              sizeVariant="small"
              category="spacetime-chamber"
              valueFormatter={(v) => `${v.toFixed(1)} Hz`}
            />
          </div>
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
        <div className="flex-1 bg-gradient-to-br from-[#2d1854]/20 to-black/50 rounded-xl p-4 border border-[#A855F7]/10">
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
            <p className="text-white/30 italic pt-2 text-[8px]">
              💡 Watch RT60 marker in decay envelope
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
