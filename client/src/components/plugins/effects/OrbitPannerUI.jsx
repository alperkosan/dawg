import { useState, useEffect, useRef } from 'react';
import { Knob } from '@/components/controls';
import { useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';
import { MeteringService } from '@/lib/core/MeteringService';

/**
 * ORBIT PANNER V2.0 - REDESIGNED WITH ENHANCED COMPONENTS
 *
 * "The Spacetime Chamber" - Circular auto-panner
 *
 * Features:
 * - Enhanced component library (Knob)
 * - Category theming ('spacetime-chamber' - purple/cyan palette)
 * - Ghost value feedback (400ms visual lag)
 * - Real-time orbit trail visualization
 * - Tempo sync support
 *
 * Design Philosophy:
 * - "Simple controls, complex movement"
 * - Visual feedback at every step
 * - Category-based color identity
 */

// ============================================================================
// ORBIT VISUALIZER
// ============================================================================

const OrbitVisualizer = ({ frequency, depth, inputLevel }) => {
  const timeRef = useRef(0);

  const drawOrbit = (ctx, width, height) => {
    const time = timeRef.current;
    const centerX = width / 2;
    const centerY = height / 2;

    // Dark background
    ctx.fillStyle = 'rgba(5, 5, 20, 0.3)';
    ctx.fillRect(0, 0, width, height);

    // Orbit path (purple - spacetime-chamber)
    const orbitRadius = Math.min(width, height) * 0.35 * depth;
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)'; // purple
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, orbitRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // L/R labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('L', 20, centerY + 5);
    ctx.fillText('R', width - 35, centerY + 5);

    // Center point
    ctx.fillStyle = 'rgba(168, 85, 247, 0.3)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Orbital object
    const angle = time * frequency * 0.002;
    const objX = centerX + Math.cos(angle) * orbitRadius;
    const objY = centerY + Math.sin(angle) * orbitRadius;

    // Trail (cyan - spacetime-chamber secondary)
    const trailLength = 50;
    for (let i = 0; i < trailLength; i++) {
      const trailAngle = angle - (i * 0.05);
      const trailX = centerX + Math.cos(trailAngle) * orbitRadius;
      const trailY = centerY + Math.sin(trailAngle) * orbitRadius;
      const alpha = (1 - i / trailLength) * inputLevel * 0.5;

      ctx.fillStyle = `rgba(34, 211, 238, ${alpha})`; // cyan
      ctx.beginPath();
      ctx.arc(trailX, trailY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Main object (glowing cyan)
    ctx.fillStyle = '#22D3EE';
    ctx.shadowColor = '#22D3EE';
    ctx.shadowBlur = 15 + inputLevel * 20;
    ctx.beginPath();
    ctx.arc(objX, objY, 8 + inputLevel * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Update time
    timeRef.current += 16;
  };

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawOrbit,
    [frequency, depth, inputLevel],
    { noLoop: false } // Animate
  );

  return (
    <div ref={containerRef} className="w-full h-full bg-black/50 rounded-xl border border-[#A855F7]/20">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const OrbitPannerUI = ({ trackId, effect, onChange }) => {
  const {
    frequency = 2,
    depth = 1.0,
    wet = 1.0
  } = effect.settings;

  const [inputLevel, setInputLevel] = useState(0);
  const [isSynced, setIsSynced] = useState(typeof frequency === 'string');

  // Ghost values (400ms lag for smooth visual feedback)
  const numericFreq = typeof frequency === 'string' ? 2 : frequency;
  const ghostFrequency = useGhostValue(numericFreq, 400);
  const ghostDepth = useGhostValue(depth * 100, 400);
  const ghostWet = useGhostValue(wet * 100, 400);

  // Listen to input level for visualization
  useEffect(() => {
    const meterId = `${trackId}-input`;
    const handleLevel = (data) => setInputLevel((data.peak + 60) / 60);
    const unsubscribe = MeteringService.subscribe(meterId, handleLevel);
    return unsubscribe;
  }, [trackId]);

  // Tempo sync options
  const timeOptions = [
    { value: '1n', label: '1/1' },
    { value: '2n', label: '1/2' },
    { value: '4n', label: '1/4' },
    { value: '8n', label: '1/8' },
    { value: '16n', label: '1/16' }
  ];

  // Toggle sync mode
  const toggleSync = () => {
    if (isSynced) {
      onChange('frequency', 2);
      setIsSynced(false);
    } else {
      onChange('frequency', '4n');
      setIsSynced(true);
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-neutral-950 to-black p-4 flex gap-4 overflow-hidden">

      {/* ===== LEFT PANEL: Info ===== */}
      <div className="w-[240px] flex-shrink-0 flex flex-col gap-4">

        {/* Plugin Header */}
        <div className="bg-gradient-to-r from-[#2d1854] to-[#1a1a1a] rounded-xl px-4 py-3 border border-[#A855F7]/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🌀</div>
            <div className="flex-1">
              <div className="text-sm font-black text-[#A855F7] tracking-wider uppercase">
                Orbit Panner
              </div>
              <div className="text-[9px] text-[#22D3EE]/70">The Spacetime Chamber</div>
            </div>
          </div>
        </div>

        {/* Sync Mode Toggle */}
        <div className="bg-gradient-to-br from-[#2d1854]/50 to-black/50 rounded-xl p-4 border border-[#A855F7]/10">
          <div className="text-[10px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-3">
            Rate Mode
          </div>
          <button
            onClick={toggleSync}
            className={`w-full px-4 py-3 rounded-lg border-2 transition-all font-bold text-sm ${
              isSynced
                ? 'border-[#22D3EE] bg-[#22D3EE]/20 text-[#22D3EE] shadow-lg shadow-[#22D3EE]/20'
                : 'border-[#A855F7]/50 bg-[#A855F7]/10 text-[#A855F7] hover:border-[#A855F7] hover:bg-[#A855F7]/20'
            }`}
          >
            {isSynced ? '♪ TEMPO SYNC' : '🔓 FREE RATE'}
          </button>
        </div>

        {/* How It Works */}
        <div className="flex-1 bg-gradient-to-br from-[#2d1854]/20 to-black/50 rounded-xl p-4 border border-[#A855F7]/10">
          <div className="text-[9px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-3">
            How It Works
          </div>
          <div className="text-[9px] text-white/50 leading-relaxed space-y-2">
            <p>
              <span className="text-[#22D3EE] font-bold">Rate:</span> Orbit speed (Hz or tempo-synced)
            </p>
            <p>
              <span className="text-[#A855F7] font-bold">Depth:</span> Orbit size (stereo width)
            </p>
            <p>
              <span className="text-[#FACC15] font-bold">Mix:</span> Wet/dry balance
            </p>
            <p className="text-white/30 italic pt-2 text-[8px]">
              💡 Watch the cyan orb orbit around the stereo field
            </p>
          </div>
        </div>

        {/* Category Badge */}
        <div className="bg-gradient-to-r from-[#2d1854] to-[#1a1a1a] rounded-lg px-3 py-2 border border-[#A855F7]/20 text-center">
          <div className="text-[8px] text-[#22D3EE]/50 uppercase tracking-wider">Category</div>
          <div className="text-[10px] text-[#A855F7] font-bold">The Spacetime Chamber</div>
        </div>
      </div>

      {/* ===== CENTER PANEL: Visualization + Controls ===== */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Orbit Visualizer */}
        <div className="h-[280px]">
          <OrbitVisualizer
            frequency={numericFreq}
            depth={depth}
            inputLevel={inputLevel}
          />
        </div>

        {/* Main Controls */}
        <div className="bg-gradient-to-br from-black/50 to-[#2d1854]/30 rounded-xl p-6 border border-[#A855F7]/20">
          <div className="grid grid-cols-3 gap-8">

            {/* Rate Control */}
            <div className="flex flex-col">
              <div className="text-[10px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-3 text-center">
                Rate
              </div>
              {isSynced ? (
                <select
                  value={frequency}
                  onChange={(e) => onChange('frequency', e.target.value)}
                  className="w-full bg-black/70 border-2 border-[#22D3EE] rounded-lg p-3 text-white text-center font-bold text-lg hover:bg-black/90 transition-all"
                  style={{ appearance: 'none' }}
                >
                  {timeOptions.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-gray-900">
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Knob
                  label="FREQUENCY"
                  value={numericFreq}
                  ghostValue={ghostFrequency}
                  onChange={(val) => onChange('frequency', val)}
                  min={0.1}
                  max={10}
                  defaultValue={2}
                  sizeVariant="large"
                  category="spacetime-chamber"
                  valueFormatter={(v) => `${v.toFixed(2)} Hz`}
                />
              )}
            </div>

            {/* Depth */}
            <Knob
              label="DEPTH"
              value={depth * 100}
              ghostValue={ghostDepth}
              onChange={(val) => onChange('depth', val / 100)}
              min={0}
              max={100}
              defaultValue={100}
              sizeVariant="large"
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
              defaultValue={100}
              sizeVariant="large"
              category="spacetime-chamber"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />
          </div>
        </div>

        {/* Position Indicator */}
        <div className="bg-black/30 rounded-xl p-4 border border-[#A855F7]/10">
          <div className="text-[10px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-3">
            Stereo Position
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-[#22D3EE]">L</span>
            <div className="flex-1 mx-4 h-3 bg-gradient-to-r from-[#A855F7]/20 via-[#22D3EE]/20 to-[#A855F7]/20 rounded-full relative border border-[#A855F7]/20">
              <div
                className="absolute top-0 w-5 h-3 bg-[#22D3EE] rounded-full transform -translate-x-1/2 shadow-lg shadow-[#22D3EE]/50 transition-all duration-75"
                style={{
                  left: `${50 + Math.sin(Date.now() * 0.001 * numericFreq) * 50 * depth}%`
                }}
              />
            </div>
            <span className="text-sm font-bold text-[#A855F7]">R</span>
          </div>
        </div>
      </div>

      {/* ===== RIGHT PANEL: Stats & Info ===== */}
      <div className="w-[200px] flex-shrink-0 flex flex-col gap-4">

        {/* Processing Stats */}
        <div className="bg-gradient-to-br from-black/50 to-[#2d1854]/30 rounded-xl p-4 border border-[#A855F7]/10">
          <div className="text-[9px] text-[#22D3EE]/70 uppercase tracking-wider mb-3 font-bold">
            Processing
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Mode</span>
              <span className="text-[#A855F7] text-[9px] font-medium">
                {isSynced ? 'Synced' : 'Free'}
              </span>
            </div>
            <div className="pt-2 border-t border-[#A855F7]/10">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-white/50">Rate</span>
                <span className="text-[#22D3EE] font-mono font-bold tabular-nums">
                  {isSynced ? frequency : `${numericFreq.toFixed(2)} Hz`}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Depth</span>
              <span className="text-[#A855F7] font-mono font-bold tabular-nums">
                {(depth * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Mix</span>
              <span className="text-[#22D3EE] font-mono font-bold tabular-nums">
                {(wet * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Input</span>
              <span className="text-[#A855F7] font-mono font-bold tabular-nums">
                {(inputLevel * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Visualization Key */}
        <div className="flex-1 bg-gradient-to-br from-[#2d1854]/20 to-black/50 rounded-xl p-4 border border-[#A855F7]/10">
          <div className="text-[9px] text-[#22D3EE]/70 font-bold uppercase tracking-wider mb-3">
            Visualization
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#22D3EE] shadow-sm shadow-[#22D3EE]/50"></div>
              <span className="text-[9px] text-white/60">Panner position</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-gradient-to-r from-[#22D3EE]/50 to-transparent"></div>
              <span className="text-[9px] text-white/60">Motion trail</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-[#A855F7]/50 border-dashed"></div>
              <span className="text-[9px] text-white/60">Orbit path</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
