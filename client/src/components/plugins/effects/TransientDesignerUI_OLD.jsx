import { useState, useCallback, useRef } from 'react';
import { Slider, ModeSelector } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

/**
 * TRANSIENT DESIGNER V2.0 - REDESIGNED WITH ENHANCED COMPONENTS
 *
 * "The Dynamics Forge" - Precise transient shaping
 *
 * Features:
 * - Enhanced component library (Slider bipolar, ModeSelector)
 * - Category theming ('dynamics-forge' - blue palette)
 * - Ghost value feedback (400ms visual lag)
 * - Mode-based workflow (6 presets for drums/bass)
 * - Real-time waveform visualization
 * - Bipolar sliders (attack/sustain: -12dB to +12dB)
 *
 * Design Philosophy:
 * - "One knob, infinite possibilities" via modes
 * - Bipolar controls for boost/cut
 * - Visual feedback at every step
 */

// ============================================================================
// WAVEFORM VISUALIZER
// ============================================================================

const WaveformVisualizer = ({ trackId, effectId, attackAmount, sustainAmount }) => {
  const { isPlaying, getTimeDomainData } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: false
  });

  const waveformBufferRef = useRef(new Array(200).fill(0));
  const envelopeBufferRef = useRef(new Array(200).fill(0));
  const lastUpdateRef = useRef(0);

  const drawWaveform = useCallback((ctx, width, height) => {
    // Clear with fade
    ctx.fillStyle = 'rgba(10, 10, 15, 0.3)';
    ctx.fillRect(0, 0, width, height);

    const centerY = height / 2;
    const audioData = getTimeDomainData();

    // Update waveform when playing
    if (isPlaying && audioData) {
      const now = performance.now();
      if (now - lastUpdateRef.current > 33) {
        const step = Math.floor(audioData.length / 200);
        for (let i = 0; i < 200; i++) {
          const idx = i * step;
          waveformBufferRef.current[i] = audioData[idx] || 0;

          // Calculate envelope
          const absValue = Math.abs(waveformBufferRef.current[i]);
          if (i === 0) {
            envelopeBufferRef.current[i] = absValue;
          } else {
            const attack = 0.3;
            const release = 0.05;
            const coeff = absValue > envelopeBufferRef.current[i - 1] ? attack : release;
            envelopeBufferRef.current[i] = envelopeBufferRef.current[i - 1] * (1 - coeff) + absValue * coeff;
          }
        }
        lastUpdateRef.current = now;
      }
    }

    const dataPoints = waveformBufferRef.current;
    const stepX = width / dataPoints.length;

    // Static message when not playing
    if (!isPlaying) {
      ctx.strokeStyle = 'rgba(0, 168, 232, 0.3)'; // dynamics-forge blue
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      ctx.font = 'bold 14px system-ui';
      ctx.fillStyle = 'rgba(0, 168, 232, 0.3)';
      ctx.textAlign = 'center';
      ctx.fillText('▶ Play to see waveform', width / 2, centerY);
      return;
    }

    // Grid
    ctx.strokeStyle = 'rgba(0, 168, 232, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw envelope (amber)
    const envelopeData = envelopeBufferRef.current;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 2;
    envelopeData.forEach((value, i) => {
      const x = i * stepX;
      const y1 = centerY - (value * centerY * 0.8);
      if (i === 0) ctx.moveTo(x, y1);
      else ctx.lineTo(x, y1);
    });
    envelopeData.forEach((value, i) => {
      const x = (envelopeData.length - 1 - i) * stepX;
      const y = centerY + (envelopeData[envelopeData.length - 1 - i] * centerY * 0.8);
      ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
    ctx.fill();
    ctx.stroke();

    // Draw original waveform (gray)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
    ctx.lineWidth = 1.5;
    dataPoints.forEach((value, i) => {
      const x = i * stepX;
      const y = centerY - (value * centerY * 0.8);
      if (i === 0) ctx.moveTo(x, y);
      else {
        const prevX = (i - 1) * stepX;
        const prevY = centerY - (dataPoints[i - 1] * centerY * 0.8);
        const cpX1 = prevX + stepX / 3;
        const cpX2 = x - stepX / 3;
        ctx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y);
      }
    });
    ctx.stroke();

    // Draw processed waveform (gradient)
    ctx.beginPath();
    const attackMultiplier = 1 + (attackAmount / 12);
    const sustainMultiplier = 1 + (sustainAmount / 12);

    dataPoints.forEach((value, i) => {
      const x = i * stepX;
      const envelope = envelopeData[i];
      const isTransient = envelope > 0.08;
      const processedValue = value * (isTransient ? attackMultiplier : sustainMultiplier);
      const y = centerY - (processedValue * centerY * 0.8);

      if (i === 0) ctx.moveTo(x, y);
      else {
        const prevX = (i - 1) * stepX;
        const prevValue = dataPoints[i - 1];
        const prevEnv = envelopeData[i - 1];
        const prevIsTransient = prevEnv > 0.08;
        const prevProcessed = prevValue * (prevIsTransient ? attackMultiplier : sustainMultiplier);
        const prevY = centerY - (prevProcessed * centerY * 0.8);
        const cpX1 = prevX + stepX / 3;
        const cpX2 = x - stepX / 3;
        ctx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y);
      }
    });

    // Gradient stroke (category blue)
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'rgba(0, 168, 232, 0.9)'); // dynamics-forge blue
    gradient.addColorStop(0.5, 'rgba(0, 184, 248, 0.9)');
    gradient.addColorStop(1, 'rgba(0, 200, 248, 0.9)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Glow effect
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0, 168, 232, 0.5)';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw transient markers (red)
    const transientThreshold = 0.08;
    for (let i = 1; i < dataPoints.length - 1; i++) {
      const prev = Math.abs(dataPoints[i - 1]);
      const curr = Math.abs(dataPoints[i]);
      const next = Math.abs(dataPoints[i + 1]);

      if (curr > prev && curr > next && curr > transientThreshold) {
        const x = i * stepX;
        const y = centerY - (dataPoints[i] * centerY * 0.8);

        // Vertical marker
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, centerY - height * 0.4);
        ctx.lineTo(x, centerY + height * 0.4);
        ctx.stroke();
        ctx.setLineDash([]);

        // Peak dot
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.fill();
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }, [attackAmount, sustainAmount, isPlaying, getTimeDomainData]);

  const { containerRef, canvasRef } = useCanvasVisualization(drawWaveform, [attackAmount, sustainAmount, isPlaying]);

  return (
    <div ref={containerRef} className="w-full h-full bg-black/50 rounded-xl border border-[#00A8E8]/20">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 text-[9px] font-mono bg-black/60 backdrop-blur-sm px-2 py-1.5 rounded-lg border border-white/10">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <span className="text-red-400">Transients</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
          <span className="text-amber-400">Envelope</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-0.5 bg-[#00A8E8] rounded"></div>
          <span className="text-[#00A8E8]">Processed</span>
        </div>
      </div>

      {/* Live indicator */}
      {isPlaying && (
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-[9px] text-red-400 font-mono">LIVE</span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// PRESET MODES
// ============================================================================

const TRANSIENT_MODES = {
  'punch-drums': {
    id: 'punch-drums',
    name: 'Punchy Drums',
    icon: '🥁',
    description: 'Add punch to drum hits',
    defaults: { attack: 6, sustain: -3 }
  },
  'tight-kick': {
    id: 'tight-kick',
    name: 'Tight Kick',
    icon: '👊',
    description: 'Focused low-end impact',
    defaults: { attack: 8, sustain: -6 }
  },
  'snappy-snare': {
    id: 'snappy-snare',
    name: 'Snappy Snare',
    icon: '⚡',
    description: 'Sharp transient response',
    defaults: { attack: 9, sustain: -4 }
  },
  'smooth-drums': {
    id: 'smooth-drums',
    name: 'Smooth Drums',
    icon: '✨',
    description: 'Reduce harshness',
    defaults: { attack: -3, sustain: 2 }
  },
  'plucky-bass': {
    id: 'plucky-bass',
    name: 'Plucky Bass',
    icon: '🎸',
    description: 'Enhance string attack',
    defaults: { attack: 7, sustain: -2 }
  },
  'smooth-bass': {
    id: 'smooth-bass',
    name: 'Smooth Bass',
    icon: '🌊',
    description: 'Rounded sub response',
    defaults: { attack: -2, sustain: 3 }
  },
  'custom': {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    description: 'Manual control',
    defaults: { attack: 0, sustain: 0 }
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const TransientDesignerUI = ({ trackId, effect, onChange }) => {
  const {
    attack = 0,
    sustain = 0,
    mix = 1.0
  } = effect.settings;

  const [selectedMode, setSelectedMode] = useState('custom');

  // Ghost values (400ms lag for smooth visual feedback)
  const ghostAttack = useGhostValue(attack, 400);
  const ghostSustain = useGhostValue(sustain, 400);
  const ghostMix = useGhostValue(mix * 100, 400);

  // Prepare modes for ModeSelector component
  const modes = Object.values(TRANSIENT_MODES).map(mode => ({
    id: mode.id,
    label: mode.name,
    icon: mode.icon,
    description: mode.description
  }));

  const currentMode = TRANSIENT_MODES[selectedMode];

  // Handle mode change
  const handleModeChange = (modeId) => {
    setSelectedMode(modeId);
    const mode = TRANSIENT_MODES[modeId];
    onChange('attack', mode.defaults.attack);
    onChange('sustain', mode.defaults.sustain);
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-neutral-950 to-black p-4 flex gap-4 overflow-hidden">

      {/* ===== LEFT PANEL: Mode Selection ===== */}
      <div className="w-[240px] flex-shrink-0 flex flex-col gap-4">

        {/* Plugin Header */}
        <div className="bg-gradient-to-r from-[#001829] to-[#1a1a1a] rounded-xl px-4 py-3 border border-[#00A8E8]/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{currentMode?.icon || '⚡'}</div>
            <div className="flex-1">
              <div className="text-sm font-black text-[#00A8E8] tracking-wider uppercase">
                Transient Designer
              </div>
              <div className="text-[9px] text-[#00B8F8]/70">The Dynamics Forge</div>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <ModeSelector
          modes={modes}
          activeMode={selectedMode}
          onChange={handleModeChange}
          orientation="vertical"
          category="dynamics-forge"
          className="flex-1"
        />

        {/* Quick Info */}
        <div className="bg-gradient-to-br from-[#001829]/50 to-black/50 rounded-xl p-3 border border-[#00A8E8]/10">
          <div className="text-[9px] text-[#00B8F8]/70 font-bold uppercase tracking-wider mb-2">
            Current Mode
          </div>
          <div className="text-[10px] text-white/60 leading-relaxed">
            {currentMode?.description || 'Select a mode above'}
          </div>
        </div>
      </div>

      {/* ===== CENTER PANEL: Waveform + Controls ===== */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto pr-2">

        {/* Waveform Visualizer */}
        <div className="flex-1 min-h-0">
          <WaveformVisualizer
            trackId={trackId}
            effectId={effect.id}
            attackAmount={attack}
            sustainAmount={sustain}
          />
        </div>

        {/* Main Controls - Bipolar Sliders */}
        <div className="bg-gradient-to-br from-black/50 to-[#001829]/30 rounded-xl p-6 border border-[#00A8E8]/20">
          <div className="grid grid-cols-3 gap-12">

            {/* Attack Slider (Bipolar) */}
            <div>
              <Slider
                label="ATTACK"
                value={attack}
                ghostValue={ghostAttack}
                onChange={(val) => onChange('attack', val)}
                min={-12}
                max={12}
                defaultValue={0}
                bipolar={true}
                centerDetent={true}
                category="dynamics-forge"
                valueFormatter={(v) => {
                  if (v > 0) return `+${v.toFixed(1)} dB`;
                  if (v < 0) return `${v.toFixed(1)} dB`;
                  return '0 dB';
                }}
              />
            </div>

            {/* Sustain Slider (Bipolar) */}
            <div>
              <Slider
                label="SUSTAIN"
                value={sustain}
                ghostValue={ghostSustain}
                onChange={(val) => onChange('sustain', val)}
                min={-12}
                max={12}
                defaultValue={0}
                bipolar={true}
                centerDetent={true}
                category="dynamics-forge"
                valueFormatter={(v) => {
                  if (v > 0) return `+${v.toFixed(1)} dB`;
                  if (v < 0) return `${v.toFixed(1)} dB`;
                  return '0 dB';
                }}
              />
            </div>

            {/* Mix Slider */}
            <div>
              <Slider
                label="MIX"
                value={mix * 100}
                ghostValue={ghostMix}
                onChange={(val) => onChange('mix', val / 100)}
                min={0}
                max={100}
                defaultValue={100}
                category="dynamics-forge"
                valueFormatter={(v) => `${v.toFixed(0)}%`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===== RIGHT PANEL: Stats & Info ===== */}
      <div className="w-[200px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-2">

        {/* Processing Stats */}
        <div className="bg-gradient-to-br from-black/50 to-[#001829]/30 rounded-xl p-4 border border-[#00A8E8]/10">
          <div className="text-[9px] text-[#00B8F8]/70 uppercase tracking-wider mb-3 font-bold">
            Processing
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Mode</span>
              <span className="text-[#00A8E8] text-[9px] font-medium">
                {currentMode?.name}
              </span>
            </div>
            <div className="pt-2 border-t border-[#00A8E8]/10">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-white/50">Attack</span>
                <span className={`font-mono font-bold tabular-nums ${attack >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {attack > 0 ? '+' : ''}{attack.toFixed(1)}dB
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Sustain</span>
              <span className={`font-mono font-bold tabular-nums ${sustain >= 0 ? 'text-orange-400' : 'text-red-400'}`}>
                {sustain > 0 ? '+' : ''}{sustain.toFixed(1)}dB
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Mix</span>
              <span className="text-[#00B8F8] font-mono font-bold tabular-nums">
                {(mix * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="flex-1 bg-gradient-to-br from-[#001829]/20 to-black/50 rounded-xl p-4 border border-[#00A8E8]/10">
          <div className="text-[9px] text-[#00B8F8]/70 font-bold uppercase tracking-wider mb-3">
            How It Works
          </div>
          <div className="text-[9px] text-white/50 leading-relaxed space-y-2">
            <p>
              <span className="text-green-400 font-bold">Attack:</span> Shape initial transient hit
            </p>
            <p>
              <span className="text-orange-400 font-bold">Sustain:</span> Control body and tail
            </p>
            <p>
              <span className="text-[#00A8E8] font-bold">Mix:</span> Blend dry/wet signal
            </p>
            <p className="text-white/30 italic pt-2 text-[8px]">
              💡 Positive boosts, negative cuts
            </p>
          </div>
        </div>

        {/* Category Badge */}
        <div className="bg-gradient-to-r from-[#001829] to-[#1a1a1a] rounded-lg px-3 py-2 border border-[#00A8E8]/20 text-center">
          <div className="text-[8px] text-[#00B8F8]/50 uppercase tracking-wider">Category</div>
          <div className="text-[10px] text-[#00A8E8] font-bold">The Dynamics Forge</div>
        </div>
      </div>

    </div>
  );
};
