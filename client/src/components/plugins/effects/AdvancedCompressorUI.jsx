import { useState, useEffect, useRef, useCallback } from 'react';
import { Knob, ModeSelector, ExpandablePanel } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';
import { COMPRESSOR_MODES, getCompressorModeParameters } from '@/config/presets';

/**
 * COMPRESSOR V2.0 - REDESIGNED WITH ENHANCED COMPONENTS
 *
 * "The Dynamics Forge" - Precise, powerful dynamic control
 *
 * Features:
 * - Enhanced component library (Knob, Slider, ModeSelector, ExpandablePanel, Meter)
 * - Category theming ('dynamics-forge' - blue palette)
 * - Ghost value feedback (400ms visual lag)
 * - Mode-based workflow (6 compression presets)
 * - Real-time gain reduction visualization
 * - Progressive disclosure (manual controls)
 * - Compression curve visualizer
 *
 * Design Philosophy:
 * - "One knob, infinite possibilities" via modes
 * - Visual feedback at every step
 * - Category-based color identity
 */

// ============================================================================
// COMPRESSION CURVE VISUALIZER
// ============================================================================

const CompressionCurve = ({ threshold, ratio, knee }) => {
  const drawCurve = useCallback((ctx, width, height) => {
    // Clear
    ctx.fillStyle = 'rgba(10, 10, 15, 0.3)';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = 'rgba(0, 168, 232, 0.08)'; // dynamics-forge blue
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const pos = (i / 4) * width;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(width, pos);
      ctx.stroke();
    }

    // Diagonal reference line (1:1)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // Compression Curve
    ctx.strokeStyle = '#00A8E8'; // dynamics-forge primary
    ctx.lineWidth = 3;
    ctx.beginPath();

    const dbToPixel = (db) => width - ((db + 60) / 60) * width;
    const outputDbToPixel = (db) => height - ((db + 60) / 60) * height;

    for (let inputDb = -60; inputDb <= 0; inputDb += 0.5) {
      const inputOverThreshold = inputDb - threshold;
      let outputDb = inputDb;

      if (inputOverThreshold > knee / 2) {
        outputDb = threshold + inputOverThreshold / ratio;
      } else if (inputOverThreshold > -knee / 2) {
        const x = inputOverThreshold + knee / 2;
        outputDb = inputDb - ((ratio - 1) * Math.pow(x, 2) / (2 * knee * ratio));
      }

      const x = dbToPixel(inputDb);
      const y = outputDbToPixel(outputDb);
      if (inputDb === -60) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Curve glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00A8E8';
    ctx.strokeStyle = 'rgba(0, 168, 232, 0.5)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Threshold line
    ctx.strokeStyle = '#ef4444';
    ctx.setLineDash([3, 3]);
    const thresholdX = dbToPixel(threshold);
    ctx.beginPath();
    ctx.moveTo(thresholdX, 0);
    ctx.lineTo(thresholdX, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Threshold label
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'left';
    ctx.fillText(`${threshold.toFixed(0)}dB`, thresholdX + 5, 15);

    // Axis labels
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('Input (dB)', width / 2, height - 5);
    ctx.save();
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Output (dB)', 0, 0);
    ctx.restore();
  }, [threshold, ratio, knee]);

  const { containerRef, canvasRef } = useCanvasVisualization(drawCurve, [threshold, ratio, knee]);

  return (
    <div ref={containerRef} className="w-full h-full bg-black/50 rounded-xl border border-[#00A8E8]/20">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// GAIN REDUCTION METER (Circular)
// ============================================================================

const GainReductionMeter = ({ gainReduction }) => {
  const absGR = Math.abs(gainReduction);
  const percentage = Math.min((absGR / 20) * 100, 100);

  // Color based on GR amount
  let color = '#00A8E8'; // Blue (gentle)
  if (absGR > 12) color = '#ef4444'; // Red (heavy)
  else if (absGR > 6) color = '#f59e0b'; // Amber (moderate)

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Circular meter */}
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 100 100" className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="rgba(0, 168, 232, 0.1)"
            strokeWidth="6"
          />
          {/* GR arc */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={`${percentage * 2.639} 263.9`}
            strokeLinecap="round"
            style={{ transition: 'stroke 0.3s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-5xl font-black text-white tabular-nums" style={{ color }}>
            {absGR.toFixed(1)}
          </div>
          <div className="text-xs text-white/50 uppercase tracking-wider font-bold mt-1">dB GR</div>
        </div>
      </div>

      {/* Scale markers */}
      <div className="flex justify-between w-full px-4 text-[9px] text-white/40 font-mono">
        <span>0</span>
        <span>-6</span>
        <span>-12</span>
        <span>-20</span>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const AdvancedCompressorUI = ({ trackId, effect, onChange }) => {
  const {
    threshold = -24,
    ratio = 4,
    attack = 0.01,
    release = 0.1,
    knee = 12,
    autoMakeup = 1
  } = effect.settings;

  const [selectedMode, setSelectedMode] = useState('custom');
  const [amount, setAmount] = useState(50);
  const [gainReduction, setGainReduction] = useState(0);

  // Ghost values (400ms lag for smooth visual feedback)
  const ghostAmount = useGhostValue(amount, 400);
  const ghostThreshold = useGhostValue(threshold, 400);
  const ghostRatio = useGhostValue(ratio, 400);
  const ghostAttack = useGhostValue(attack * 1000, 400);
  const ghostRelease = useGhostValue(release * 1000, 400);
  const ghostKnee = useGhostValue(knee, 400);

  // Prepare modes for ModeSelector component
  const modes = Object.values(COMPRESSOR_MODES).map(mode => ({
    id: mode.id,
    label: mode.name,
    icon: mode.icon,
    description: mode.description
  }));

  const currentMode = COMPRESSOR_MODES[selectedMode];

  // Store onChange in ref
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Handle mode change
  const handleModeChange = (modeId) => {
    setSelectedMode(modeId);
  };

  // Apply mode + amount
  useEffect(() => {
    const params = getCompressorModeParameters(selectedMode, amount);
    if (!params) return;

    Object.entries(params).forEach(([key, value]) => {
      // Convert boolean autoMakeup to number (0 or 1) for worklet
      if (key === 'autoMakeup') {
        onChangeRef.current(key, value ? 1 : 0);
      } else {
        onChangeRef.current(key, value);
      }
    });
  }, [selectedMode, amount]);

  // Use standardized audio plugin hook
  const { plugin } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: false
  });

  // GR Metering - Listen to worklet messages
  useEffect(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    const handleMessage = (event) => {
      const { type, gr } = event.data;
      if (type === 'metering') {
        if (typeof gr === 'number' && isFinite(gr)) {
          setGainReduction(gr);
        }
      }
    };

    audioNode.port.onmessage = handleMessage;

    return () => {
      if (audioNode?.port) {
        audioNode.port.onmessage = null;
      }
    };
  }, [plugin]);

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-neutral-950 to-black p-4 flex gap-4 overflow-hidden">

      {/* ===== LEFT PANEL: Mode Selection ===== */}
      <div className="w-[240px] flex-shrink-0 flex flex-col gap-4">

        {/* Plugin Header */}
        <div className="bg-gradient-to-r from-[#001829] to-[#1a1a1a] rounded-xl px-4 py-3 border border-[#00A8E8]/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{currentMode?.icon || '🎚️'}</div>
            <div className="flex-1">
              <div className="text-sm font-black text-[#00A8E8] tracking-wider uppercase">
                Compressor
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

      {/* ===== CENTER PANEL: GR Meter + Amount Control ===== */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto pr-2">

        {/* Compression Curve Visualizer */}
        <div className="h-[180px]">
          <CompressionCurve threshold={threshold} ratio={ratio} knee={knee} />
        </div>

        {/* GR Meter + Amount Knob */}
        <div className="flex-1 bg-gradient-to-br from-black/50 to-[#001829]/30 rounded-xl p-6 border border-[#00A8E8]/20 flex items-center justify-center gap-12">

          {/* Gain Reduction Meter */}
          <GainReductionMeter gainReduction={gainReduction} />

          {/* Divider */}
          <div className="h-48 w-px bg-gradient-to-b from-transparent via-[#00A8E8]/30 to-transparent" />

          {/* Amount Knob */}
          <Knob
            label="AMOUNT"
            value={amount}
            ghostValue={ghostAmount}
            onChange={setAmount}
            min={0}
            max={100}
            defaultValue={50}
            sizeVariant="large"
            category="dynamics-forge"
            valueFormatter={(v) => `${v.toFixed(0)}%`}
          />
        </div>

        {/* Manual Controls (Expandable) */}
        <ExpandablePanel
          title="Manual Control"
          icon="⚙️"
          category="dynamics-forge"
          defaultExpanded={false}
        >
          <div className="grid grid-cols-5 gap-6 p-4">

            {/* Threshold */}
            <Knob
              label="THRESHOLD"
              value={threshold}
              ghostValue={ghostThreshold}
              onChange={(val) => onChange('threshold', val)}
              min={-60}
              max={0}
              defaultValue={-24}
              sizeVariant="medium"
              category="dynamics-forge"
              valueFormatter={(v) => `${v.toFixed(1)} dB`}
            />

            {/* Ratio */}
            <Knob
              label="RATIO"
              value={ratio}
              ghostValue={ghostRatio}
              onChange={(val) => onChange('ratio', val)}
              min={1}
              max={20}
              defaultValue={4}
              sizeVariant="medium"
              category="dynamics-forge"
              valueFormatter={(v) => `${v.toFixed(1)}:1`}
            />

            {/* Attack */}
            <Knob
              label="ATTACK"
              value={attack * 1000}
              ghostValue={ghostAttack}
              onChange={(val) => onChange('attack', val / 1000)}
              min={0.1}
              max={100}
              defaultValue={10}
              sizeVariant="medium"
              category="dynamics-forge"
              valueFormatter={(v) => `${v.toFixed(1)} ms`}
            />

            {/* Release */}
            <Knob
              label="RELEASE"
              value={release * 1000}
              ghostValue={ghostRelease}
              onChange={(val) => onChange('release', val / 1000)}
              min={10}
              max={1000}
              defaultValue={100}
              sizeVariant="medium"
              category="dynamics-forge"
              valueFormatter={(v) => `${v.toFixed(0)} ms`}
            />

            {/* Knee */}
            <Knob
              label="KNEE"
              value={knee}
              ghostValue={ghostKnee}
              onChange={(val) => onChange('knee', val)}
              min={0}
              max={30}
              defaultValue={12}
              sizeVariant="medium"
              category="dynamics-forge"
              valueFormatter={(v) => `${v.toFixed(1)} dB`}
            />
          </div>

          {/* Auto Makeup Toggle */}
          <div className="px-4 pb-4 pt-2 border-t border-[#00A8E8]/10">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={autoMakeup === 1}
                onChange={(e) => onChange('autoMakeup', e.target.checked ? 1 : 0)}
                className="w-4 h-4 rounded border-[#00A8E8]/30 bg-black/50 checked:bg-[#00A8E8] checked:border-[#00A8E8] transition-all"
              />
              <div>
                <div className="text-xs font-medium text-white group-hover:text-[#00A8E8] transition-colors">
                  Auto Makeup Gain
                </div>
                <div className="text-[10px] text-white/40">
                  Automatically compensate for gain reduction
                </div>
              </div>
            </label>
          </div>
        </ExpandablePanel>
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
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Amount</span>
              <span className="text-[#00A8E8] font-mono font-bold tabular-nums">
                {amount.toFixed(0)}%
              </span>
            </div>
            <div className="pt-2 border-t border-[#00A8E8]/10">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-white/50">Threshold</span>
                <span className="text-[#00B8F8] font-mono font-bold tabular-nums">
                  {threshold.toFixed(1)}dB
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Ratio</span>
              <span className="text-[#00B8F8] font-mono font-bold tabular-nums">
                {ratio.toFixed(1)}:1
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Attack</span>
              <span className="text-[#00B8F8] font-mono font-bold tabular-nums">
                {(attack * 1000).toFixed(1)}ms
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">Release</span>
              <span className="text-[#00B8F8] font-mono font-bold tabular-nums">
                {(release * 1000).toFixed(0)}ms
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
              <span className="text-[#00A8E8] font-bold">Mode:</span> Select compression style
            </p>
            <p>
              <span className="text-[#00B8F8] font-bold">Amount:</span> Adjust compression intensity
            </p>
            <p>
              <span className="text-[#00C8F8] font-bold">GR Meter:</span> Watch gain reduction in real-time
            </p>
            <p className="text-white/30 italic pt-2 text-[8px]">
              💡 Start with a mode, then adjust amount to taste
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
