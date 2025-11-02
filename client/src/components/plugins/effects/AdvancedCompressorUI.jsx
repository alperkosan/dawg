import { useState, useEffect, useRef, useCallback } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import { Knob, ModeSelector, ExpandablePanel } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';
import { useRenderer } from '@/services/CanvasRenderManager';
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

const CompressionCurve = ({ trackId, effectId, threshold, ratio, knee, gainReduction = 0, sidechainLevel = null, scEnable = 0, onChange }) => {
  const { isPlaying, getTimeDomainData, metricsDb } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true,
    rmsSmoothing: 0.3,
    peakSmoothing: 0.2
  });

  // 🎵 STREAMING SIGNAL BUFFER: Store last N frames for flowing visualization
  const signalBufferRef = useRef([]);
  const maxBufferSize = 300; // ~5 seconds at 60fps

  const drawCurve = useCallback((ctx, width, height) => {
    // 🎨 DIVIDE CANVAS: Transfer curve area (top 60%) + Waveform area (bottom 40%)
    const curveHeight = height * 0.6;
    const waveformHeight = height * 0.4;
    const waveformTop = curveHeight;

    // Clear entire canvas
    ctx.fillStyle = 'rgba(10, 10, 15, 0.95)';
    ctx.fillRect(0, 0, width, height);

    // Grid (only in curve area)
    ctx.strokeStyle = 'rgba(0, 168, 232, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const pos = (i / 4) * width;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, curveHeight);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (i / 4) * curveHeight);
      ctx.lineTo(width, (i / 4) * curveHeight);
      ctx.stroke();
    }

    // Waveform area background
    ctx.fillStyle = 'rgba(5, 5, 10, 0.8)';
    ctx.fillRect(0, waveformTop, width, waveformHeight);

    // Diagonal reference line (1:1) - only in curve area
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, curveHeight);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // 🎨 TRANSFER CURVE: White line showing input-output relationship (like reference image)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    const limiterCeiling = -0.3; // Soft limiter ceiling (slightly below 0dB)

    const dbToPixel = (db) => width - ((db + 60) / 60) * width;
    const outputDbToPixel = (db) => curveHeight - ((db + 60) / 60) * curveHeight;

    for (let inputDb = -60; inputDb <= 0; inputDb += 0.5) {
      const inputOverThreshold = inputDb - threshold;
      let outputDb = inputDb;

      // Compression curve
      if (inputOverThreshold > knee / 2) {
        outputDb = threshold + inputOverThreshold / ratio;
      } else if (inputOverThreshold > -knee / 2) {
        const x = inputOverThreshold + knee / 2;
        outputDb = inputDb - ((ratio - 1) * Math.pow(x, 2) / (2 * knee * ratio));
      }

      // 🎛️ LIMITER: Hard limit at ceiling (like reference image - transfer curve flattens at top)
      if (outputDb > limiterCeiling) {
        outputDb = limiterCeiling;
      }

      const x = dbToPixel(inputDb);
      const y = outputDbToPixel(outputDb);
      if (inputDb === -60) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 🎯 CLEAR CURVE: Single stroke with subtle glow for depth
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 🎛️ COMPRESSION THRESHOLD LINE (Purple/Red horizontal line like reference)
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)'; // Purple like reference
    ctx.lineWidth = 2;
    const thresholdY = outputDbToPixel(threshold);
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(width, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 🎯 THRESHOLD LABEL: Clear and informative
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = 'rgba(168, 85, 247, 1)';
    ctx.textAlign = 'left';
    // Background for readability
    ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
    ctx.fillRect(6, thresholdY - 16, 90, 14);
    ctx.fillStyle = 'rgba(168, 85, 247, 1)';
    ctx.fillText(`Threshold: ${threshold.toFixed(1)}dB`, 8, thresholdY - 5);

    // 🎯 LIMITER CEILING: Only show if relevant
    const limiterY = outputDbToPixel(limiterCeiling);
    if (limiterCeiling < -0.2) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, limiterY);
      ctx.lineTo(width, limiterY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 🎵 STREAMING SIGNAL VISUALIZATION: Show flowing signal over time
    if (isPlaying) {
      const timeData = getTimeDomainData();
      if (timeData && timeData.length > 0) {
        // Calculate RMS level in dB
        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          sumSq += timeData[i] * timeData[i];
        }
        const rms = Math.sqrt(sumSq / timeData.length);
        const inputDb = rms > 0 ? 20 * Math.log10(rms) : -60;
        const clampedInputDb = Math.max(-60, Math.min(0, inputDb));

        // Calculate output based on compression curve + limiter
        const inputOverThreshold = clampedInputDb - threshold;
        let outputDb = clampedInputDb;
        
        if (inputOverThreshold > knee / 2) {
          outputDb = threshold + inputOverThreshold / ratio;
        } else if (inputOverThreshold > -knee / 2) {
          const x = inputOverThreshold + knee / 2;
          outputDb = clampedInputDb - ((ratio - 1) * Math.pow(x, 2) / (2 * knee * ratio));
        }

        // Apply limiter ceiling
        if (outputDb > limiterCeiling) {
          outputDb = limiterCeiling;
        }

        // Add new point to buffer with sidechain information
        signalBufferRef.current.push({
          inputDb: clampedInputDb,
          outputDb,
          sidechainLevel: sidechainLevel !== null && scEnable ? sidechainLevel : null,
          timestamp: performance.now()
        });

        // Trim buffer to max size
        if (signalBufferRef.current.length > maxBufferSize) {
          signalBufferRef.current.shift(); // Remove oldest
        }

        // 🎯 SIMPLIFIED: Show only current point with clear compression indication
        const buffer = signalBufferRef.current;
        const currentPoint = buffer[buffer.length - 1];
        
        if (currentPoint) {
          const inputX = dbToPixel(currentPoint.inputDb);
          const inputY = outputDbToPixel(currentPoint.inputDb);
          const outputY = outputDbToPixel(currentPoint.outputDb);
          const isCompressing = currentPoint.outputDb < currentPoint.inputDb - 0.5;

          // 🎯 CLEAR INDICATOR: Vertical line showing current input level
          ctx.strokeStyle = isCompressing ? 'rgba(239, 68, 68, 0.8)' : 'rgba(0, 255, 255, 0.6)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(inputX, 0);
          ctx.lineTo(inputX, curveHeight);
          ctx.stroke();
          ctx.setLineDash([]);

          // 🎯 INPUT POINT: Always visible (cyan = safe, red = compressing)
          ctx.fillStyle = isCompressing ? 'rgba(239, 68, 68, 0.9)' : 'rgba(0, 255, 255, 0.9)';
          ctx.beginPath();
          ctx.arc(inputX, inputY, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // 🎯 OUTPUT POINT: Only show if compressing (makes compression obvious)
          if (isCompressing) {
            ctx.fillStyle = 'rgba(239, 68, 68, 1)';
            ctx.beginPath();
            ctx.arc(inputX, outputY, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 🎯 CLEAR ARROW: Shows compression direction (input → output)
            const compressionDistance = Math.abs(outputY - inputY);
            if (compressionDistance > 3) {
              // Solid line showing compression amount
              ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(inputX, inputY);
              ctx.lineTo(inputX, outputY);
              ctx.stroke();

              // Arrow pointing down (compression direction)
              ctx.fillStyle = 'rgba(239, 68, 68, 1)';
              ctx.beginPath();
              ctx.moveTo(inputX, outputY);
              ctx.lineTo(inputX - 6, outputY - 5);
              ctx.lineTo(inputX + 6, outputY - 5);
              ctx.closePath();
              ctx.fill();
            }
          }

          // 🎯 CLEAR LABELS: Only show essential info
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'left';
          
          // Input label (always visible)
          ctx.fillStyle = 'rgba(0, 255, 255, 1)';
          ctx.fillText(`${currentPoint.inputDb.toFixed(1)}dB IN`, inputX + 8, inputY - 8);
          
          // Output and GR (only when compressing)
          if (isCompressing) {
            const grAmount = (currentPoint.inputDb - currentPoint.outputDb).toFixed(1);
            ctx.fillStyle = 'rgba(239, 68, 68, 1)';
            ctx.fillText(`${currentPoint.outputDb.toFixed(1)}dB OUT`, inputX + 8, outputY + 18);
            ctx.font = 'bold 11px monospace';
            ctx.fillText(`−${grAmount}dB`, inputX + 8, outputY + 32);
          }
        }

        // 🎨 WAVEFORM AREA: Draw input, output, and sidechain compression (combined visualization)
        if (buffer.length > 10 && timeData) {
          const pointsPerPixel = Math.max(1, Math.floor(buffer.length / width));

          // 🎯 INPUT: Subtle background (what goes in - cyan)
          ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
          ctx.beginPath();
          
          for (let x = 0; x < width; x++) {
            const bufferIdx = Math.min(buffer.length - 1, Math.floor(x * pointsPerPixel));
            const point = buffer[bufferIdx];
            const inputDbNorm = (point.inputDb + 60) / 60;
            const y = waveformTop + waveformHeight - (inputDbNorm * waveformHeight * 0.7);
            
            if (x === 0) {
              ctx.moveTo(x, waveformTop + waveformHeight);
              ctx.lineTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.lineTo(width, waveformTop + waveformHeight);
          ctx.closePath();
          ctx.fill();

          // 🎯 OUTPUT: Clear foreground (what comes out - red when compressing, blue when safe)
          const isCurrentlyCompressing = currentPoint && currentPoint.outputDb < currentPoint.inputDb - 0.5;
          ctx.fillStyle = isCurrentlyCompressing ? 'rgba(239, 68, 68, 0.5)' : 'rgba(135, 206, 250, 0.4)';
          ctx.beginPath();
          
          for (let x = 0; x < width; x++) {
            const bufferIdx = Math.min(buffer.length - 1, Math.floor(x * pointsPerPixel));
            const point = buffer[bufferIdx];
            const outputDbNorm = (point.outputDb + 60) / 60;
            const y = waveformTop + waveformHeight - (outputDbNorm * waveformHeight * 0.7);
            
            if (x === 0) {
              ctx.moveTo(x, waveformTop + waveformHeight);
              ctx.lineTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.lineTo(width, waveformTop + waveformHeight);
          ctx.closePath();
          ctx.fill();

          // 🎯 SIDECHAIN: Simple indicator when active (yellow dashed line)
          if (scEnable && sidechainLevel !== null && isFinite(sidechainLevel)) {
            const scLevelNorm = ((sidechainLevel + 60) / 60);
            const scY = waveformTop + waveformHeight - (scLevelNorm * waveformHeight * 0.7);
            
            ctx.strokeStyle = 'rgba(255, 200, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 5]);
            ctx.beginPath();
            ctx.moveTo(0, scY);
            ctx.lineTo(width, scY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Minimal label
            ctx.font = '9px monospace';
            ctx.fillStyle = 'rgba(255, 200, 0, 1)';
            ctx.textAlign = 'right';
            ctx.fillText(`SC`, width - 6, scY - 4);
          }
        }
      }

      // Show metrics
      if (metricsDb && isFinite(metricsDb.rmsDb)) {
        ctx.font = '8px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.textAlign = 'left';
        ctx.fillText(`RMS: ${metricsDb.rmsDb.toFixed(1)}dB`, 8, height - 20);
        if (isFinite(metricsDb.peakDb)) {
          ctx.fillText(`PEAK: ${metricsDb.peakDb.toFixed(1)}dB`, 8, height - 10);
        }
      }
    } else {
      // Clear buffer when stopped
      if (signalBufferRef.current.length > 0) {
        signalBufferRef.current = [];
      }
      
      // Show "Audio Stopped" message
      ctx.font = '11px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.textAlign = 'center';
      ctx.fillText('Audio Stopped', width / 2, height / 2);
    }

    // 🎯 CLEAR AXIS LABELS: Helpful context
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('Input Level (dB)', width / 2, curveHeight - 6);
    ctx.save();
    ctx.translate(12, curveHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Output Level (dB)', 0, 0);
    ctx.restore();

    // Waveform area label
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'left';
    ctx.fillText('Signal Flow', 8, waveformTop + 13);
  }, [threshold, ratio, knee, isPlaying, getTimeDomainData, metricsDb, sidechainLevel, scEnable]);

  // Dependencies: Only threshold, ratio, knee trigger callback recreation
  // isPlaying, getTimeDomainData, metricsDb are used inside callback and updated every frame via requestAnimationFrame
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
    autoMakeup = 1,
    scEnable = 0,
    scSourceId = '',
    scGain = 0,
    scFilterType = 1,
    scFreq = 150,
    scListen = 0,
    stereoLink = 100,
    lookahead = 3,
    // 🎯 NEW v2.0: Detection mode parameters
    detectionMode = 0,
    rmsWindow = 10
  } = effect.settings || {};

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

  // List mixer tracks for sidechain source selection
  const mixerTracks = useMixerStore(state => state.mixerTracks);

  // GR Metering + Sidechain Level - Listen to worklet messages
  const [sidechainLevel, setSidechainLevel] = useState(null);
  
  useEffect(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    const handleMessage = (event) => {
      const { type, gr, scLevel } = event.data;
      if (type === 'metering') {
        if (typeof gr === 'number' && isFinite(gr)) {
          setGainReduction(gr);
        }
        if (scLevel !== null && typeof scLevel === 'number' && isFinite(scLevel)) {
          setSidechainLevel(scLevel);
        } else {
          setSidechainLevel(null);
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

        {/* Category Badge */}
        <div className="bg-gradient-to-r from-[#001829] to-[#1a1a1a] rounded-xl px-4 py-3 border border-[#00A8E8]/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{currentMode?.icon || '🎚️'}</div>
            <div className="flex-1">
              <div className="text-[9px] text-[#00B8F8]/70 font-semibold uppercase tracking-wider">The Dynamics Forge</div>
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
          <CompressionCurve 
            trackId={trackId}
            effectId={effect.id}
            threshold={threshold} 
            ratio={ratio} 
            knee={knee}
            gainReduction={gainReduction}
            sidechainLevel={sidechainLevel}
            scEnable={scEnable}
            onChange={onChange}
          />
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
          defaultExpanded={true}
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

          {/* Sidechain Controls */}
          <div className="px-4 pb-4 pt-2 border-t border-[#00A8E8]/10 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] text-[#00B8F8]/70 font-bold uppercase tracking-wider">
                External Sidechain
              </div>
              {scSourceId && (
                <span className="text-[9px] text-[#00A8E8] font-mono">
                  Source: {mixerTracks.find(t => t.id === scSourceId)?.name || scSourceId}
                </span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-6">
              {/* Source Channel */}
              <label className="flex items-center gap-3 col-span-2">
                <span className="text-xs text-white/70 w-24">Source</span>
                <select
                  className="bg-black/40 border border-[#00A8E8]/20 rounded px-2 py-1 text-xs flex-1 text-white"
                  value={scSourceId}
                  onChange={(e) => onChange('scSourceId', e.target.value)}
                >
                  <option value="">None</option>
                  {mixerTracks
                    .filter(t => t.id !== trackId) // Don't allow self-sidechain
                    .map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
              </label>
              {/* Enable */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={scEnable === 1}
                  onChange={(e) => onChange('scEnable', e.target.checked ? 1 : 0)}
                  className="w-4 h-4 rounded border-[#00A8E8]/30 bg-black/50 checked:bg-[#00A8E8] checked:border-[#00A8E8] transition-all"
                />
                <span className="text-xs text-white/70 group-hover:text-white transition-colors">Enable</span>
              </label>

              {/* Filter Type */}
              <label className="flex items-center gap-3">
                <span className="text-xs text-white/70 w-20">Filter</span>
                <select
                  className="bg-black/40 border border-[#00A8E8]/20 rounded px-2 py-1 text-xs text-white"
                  value={scFilterType}
                  onChange={(e) => onChange('scFilterType', parseInt(e.target.value, 10))}
                >
                  <option value={0}>None</option>
                  <option value={1}>HPF</option>
                  <option value={2}>LPF</option>
                </select>
              </label>

              {/* Freq */}
              <label className="flex items-center gap-3 col-span-2">
                <span className="text-xs text-white/70 w-20">Freq</span>
                <input
                  type="range"
                  min="20"
                  max="2000"
                  step="1"
                  value={scFreq}
                  onChange={(e) => onChange('scFreq', parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-[10px] text-white/50 w-12 text-right font-mono">{scFreq.toFixed(0)} Hz</span>
              </label>

              {/* Gain */}
              <Knob
                label="SC GAIN"
                value={scGain}
                onChange={(val) => onChange('scGain', val)}
                min={-24}
                max={24}
                defaultValue={0}
                sizeVariant="small"
                category="dynamics-forge"
                valueFormatter={(v) => `${v.toFixed(1)} dB`}
              />
            </div>

            {/* 🎯 NEW v2.0: Detection Mode */}
            <div className="mt-6 pt-4 border-t border-[#00A8E8]/20">
              <div className="text-[10px] text-[#00B8F8]/80 uppercase tracking-wider mb-3 font-bold">
                ✨ Detection v2.0
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => onChange('detectionMode', 0)}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    detectionMode === 0
                      ? 'bg-gradient-to-r from-[#00A8E8] to-[#00B8F8] text-white shadow-lg shadow-[#00A8E8]/30'
                      : 'bg-black/30 text-white/50 hover:bg-black/50 border border-[#00A8E8]/20'
                  }`}
                >
                  PEAK
                  <div className="text-[9px] font-normal opacity-70 mt-0.5">1176 / FET</div>
                </button>
                <button
                  onClick={() => onChange('detectionMode', 1)}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    detectionMode === 1
                      ? 'bg-gradient-to-r from-[#00A8E8] to-[#00B8F8] text-white shadow-lg shadow-[#00A8E8]/30'
                      : 'bg-black/30 text-white/50 hover:bg-black/50 border border-[#00A8E8]/20'
                  }`}
                >
                  RMS
                  <div className="text-[9px] font-normal opacity-70 mt-0.5">SSL / VCA</div>
                </button>
              </div>
              {detectionMode === 1 && (
                <label className="flex items-center gap-3 mt-3">
                  <span className="text-xs text-white/70 w-28">RMS Window</span>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={rmsWindow}
                    onChange={(e) => onChange('rmsWindow', parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-[10px] text-white/50 w-16 text-right font-mono">{rmsWindow.toFixed(0)} ms</span>
                </label>
              )}
            </div>

            {/* Link & Lookahead */}
            <div className="grid grid-cols-5 gap-6 mt-4">
              <label className="flex items-center gap-3 col-span-2">
                <span className="text-xs text-white/70 w-24">Stereo Link</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={stereoLink}
                  onChange={(e) => onChange('stereoLink', parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-[10px] text-white/50 w-12 text-right font-mono">{stereoLink.toFixed(0)}%</span>
              </label>
              <label className="flex items-center gap-3 col-span-2">
                <span className="text-xs text-white/70 w-24">Look-ahead</span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={lookahead}
                  onChange={(e) => onChange('lookahead', parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-[10px] text-white/50 w-12 text-right font-mono">{lookahead.toFixed(1)} ms</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={scListen === 1}
                  onChange={(e) => onChange('scListen', e.target.checked ? 1 : 0)}
                  className="w-4 h-4 rounded border-[#00A8E8]/30 bg-black/50 checked:bg-[#00A8E8] checked:border-[#00A8E8] transition-all"
                />
                <span className="text-xs text-white/70 group-hover:text-white transition-colors">Listen</span>
              </label>
            </div>
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
