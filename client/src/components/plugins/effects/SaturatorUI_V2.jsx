/**
 * SATURATOR UI V2.0
 *
 * Professional analog saturation with multiband capability
 *
 * v2.0 Changes:
 * ✅ Full-width layout (removed TwoPanelLayout)
 * ✅ Multiband controls (Low/Mid/High Drive & Mix)
 * ✅ Crossover frequency controls
 * ✅ Enhanced visualizer integration
 * ✅ "Texture Lab" theme
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { Knob, Slider, Checkbox, ModeSelector } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useAudioPlugin, useGhostValue } from '@/hooks/useAudioPlugin';
import { useMixerStore } from '@/store/useMixerStore';

// ============================================================================
// HARMONIC VISUALIZER
// ============================================================================

const TransferCurveVisualizer = ({ trackId, effectId, drive, mix, categoryColors, multiband }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const { isPlaying, metricsDb } = useAudioPlugin(trackId, effectId, {
    updateMetrics: true,
    rmsSmoothing: 0.3,
    peakSmoothing: 0.1
  });

  // Copy of the DSP logic for accurate visualization
  const tubeSaturate = useCallback((x) => {
    const sign = Math.sign(x);
    const abs = Math.abs(x);

    // 'wide' mode parameters (default)
    const threshold1 = 0.33;
    const threshold2 = 0.66;
    const knee1 = 0.15;

    if (abs < threshold1 - knee1) {
      return x;
    } else if (abs < threshold1 + knee1) {
      const t = (abs - (threshold1 - knee1)) / (2 * knee1);
      const smooth = t * t * (3 - 2 * t);
      const linearPart = x * (1 - smooth);
      const saturatedPart = sign * (threshold1 + (abs - threshold1) * 0.7) * smooth;
      return linearPart + saturatedPart;
    } else if (abs < threshold2) {
      const t = (abs - threshold1) / (threshold2 - threshold1);
      const saturated = threshold1 + (threshold2 - threshold1) * (1 - Math.pow(1 - t, 2));
      return sign * saturated;
    } else {
      const excess = abs - threshold2;
      const limited = threshold2 + (1 - threshold2) * (1 - Math.exp(-excess / 0.1));
      return sign * Math.min(0.95, limited);
    }
  }, []);

  const drawCurve = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Horizontal center
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    // Vertical center
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    // Calculate effective drive (matching processor logic: 1 + distortion * 9)
    const effectiveDrive = 1 + drive * 9;

    // Draw Transfer Curve
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = categoryColors.primary;

    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      // x goes from -1 to 1
      const x = (i / steps) * 2 - 1;

      // Apply drive then saturate
      const drivenX = x * effectiveDrive;
      const saturatedY = tubeSaturate(drivenX);

      // Map to screen coordinates
      // x: -1 -> 0, 1 -> width
      // y: 1 -> 0, -1 -> height (inverted y)
      const screenX = ((x + 1) / 2) * width;
      const screenY = height - ((saturatedY + 1) / 2) * height;

      if (i === 0) ctx.moveTo(screenX, screenY);
      else ctx.lineTo(screenX, screenY);
    }
    ctx.stroke();

    // Draw Linear Reference (faint)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.setLineDash([4, 4]);
    ctx.moveTo(0, height);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // Visualize Signal Level (Ball)
    if (isPlaying) {
      // Convert dB to linear (0-1)
      const peakLinear = Math.pow(10, metricsDb.peakDb / 20);
      // Clamp to 0-1
      const clampedPeak = Math.min(1, Math.max(0, peakLinear));

      if (clampedPeak > 0.001) {
        // Calculate position on the curve
        // We show the positive peak
        const x = clampedPeak;
        const drivenX = x * effectiveDrive;
        const saturatedY = tubeSaturate(drivenX);

        const screenX = ((x + 1) / 2) * width;
        const screenY = height - ((saturatedY + 1) / 2) * height;

        // Draw ball
        ctx.beginPath();
        ctx.fillStyle = '#fff';
        ctx.shadowColor = categoryColors.accent;
        ctx.shadowBlur = 10;
        ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Mirror ball (for symmetry visual)
        const screenXMirror = ((-x + 1) / 2) * width;
        const screenYMirror = height - ((-saturatedY + 1) / 2) * height;

        ctx.beginPath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.arc(screenXMirror, screenYMirror, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Metrics Overlay
    const formatDb = (val) => val < -100 ? '-Inf' : val.toFixed(1);

    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';

    // RMS
    ctx.fillStyle = categoryColors.primary;
    ctx.fillText(`RMS: ${formatDb(metricsDb.rmsDb)} dB`, width - 10, 20);

    // Peak
    ctx.fillStyle = categoryColors.secondary;
    ctx.fillText(`PEAK: ${formatDb(metricsDb.peakDb)} dB`, width - 10, 35);

    // Clip
    if (metricsDb.clipping) {
      ctx.fillStyle = '#ef4444';
      ctx.fillText('CLIP', width - 10, 50);
    }

    // Multiband Label
    if (multiband) {
      ctx.textAlign = 'left';
      ctx.fillStyle = categoryColors.accent;
      ctx.fillText('MULTIBAND ACTIVE', 10, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText('(Curve shows global character)', 10, 35);
    }

    ctx.restore();
  }, [drive, categoryColors, isPlaying, metricsDb, tubeSaturate, multiband]);

  // Setup canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useRenderer(drawCurve);

  return (
    <div ref={containerRef} className="w-full h-full relative rounded-lg overflow-hidden bg-black/40 border border-white/5">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const SaturatorUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  // Theme colors from design system
  const categoryColors = getCategoryColors('texture-lab');

  // Parameter batcher
  const { setParam } = useParameterBatcher(effectNode);
  const handleMixerEffectChange = useMixerStore.getState().handleMixerEffectChange;

  // Local state for smooth UI
  const [localDistortion, setLocalDistortion] = useState(effect.settings.distortion || 0.4);
  const [localWet, setLocalWet] = useState(effect.settings.wet || 1.0);
  const [localAutoGain, setLocalAutoGain] = useState(effect.settings.autoGain || 1);
  const [localLowCut, setLocalLowCut] = useState(effect.settings.lowCutFreq || 0);
  const [localHighCut, setLocalHighCut] = useState(effect.settings.highCutFreq || 20000);
  const [localTone, setLocalTone] = useState(effect.settings.tone || 0);
  const [localHeadroom, setLocalHeadroom] = useState(effect.settings.headroom || 0);

  // Multiband State
  const [isMultiband, setIsMultiband] = useState((effect.settings.multiband || 0) === 1);
  const [localLowMidX, setLocalLowMidX] = useState(effect.settings.lowMidCrossover || 250);
  const [localMidHighX, setLocalMidHighX] = useState(effect.settings.midHighCrossover || 2500);

  const [localLowDrive, setLocalLowDrive] = useState(effect.settings.lowDrive || 1.0);
  const [localMidDrive, setLocalMidDrive] = useState(effect.settings.midDrive || 1.0);
  const [localHighDrive, setLocalHighDrive] = useState(effect.settings.highDrive || 1.0);

  const [localLowMix, setLocalLowMix] = useState(effect.settings.lowMix || 1.0);
  const [localMidMix, setLocalMidMix] = useState(effect.settings.midMix || 1.0);
  const [localHighMix, setLocalHighMix] = useState(effect.settings.highMix || 1.0);
  
  // ✅ NEW: Oversampling, Drive Curve, and Tape Modeling state
  const [localOversampling, setLocalOversampling] = useState(effect.settings.oversampling || 2);
  const [localDriveCurve, setLocalDriveCurve] = useState(effect.settings.driveCurve !== undefined ? effect.settings.driveCurve : 3);
  const [localTapeBias, setLocalTapeBias] = useState(effect.settings.tapeBias || 0.5);
  const [localTapeWow, setLocalTapeWow] = useState(effect.settings.tapeWow || 0);
  const [localTapeFlutter, setLocalTapeFlutter] = useState(effect.settings.tapeFlutter || 0);
  const [localTapeSpeed, setLocalTapeSpeed] = useState(effect.settings.tapeSpeed || 1.0);

  // Sync with presets
  useEffect(() => {
    setLocalDistortion(effect.settings.distortion ?? 0.4);
    setLocalWet(effect.settings.wet ?? 1.0);
    setLocalAutoGain(effect.settings.autoGain ?? 1);
    setLocalLowCut(effect.settings.lowCutFreq ?? 0);
    setLocalHighCut(effect.settings.highCutFreq ?? 20000);
    setLocalTone(effect.settings.tone ?? 0);
    setLocalHeadroom(effect.settings.headroom ?? 0);

    setIsMultiband((effect.settings.multiband ?? 0) === 1);
    setLocalLowMidX(effect.settings.lowMidCrossover ?? 250);
    setLocalMidHighX(effect.settings.midHighCrossover ?? 2500);
    setLocalLowDrive(effect.settings.lowDrive ?? 1.0);
    setLocalMidDrive(effect.settings.midDrive ?? 1.0);
    setLocalHighDrive(effect.settings.highDrive ?? 1.0);
    setLocalLowMix(effect.settings.lowMix ?? 1.0);
    setLocalMidMix(effect.settings.midMix ?? 1.0);
    setLocalHighMix(effect.settings.highMix ?? 1.0);
    
    // ✅ NEW: Sync oversampling, drive curve, and tape modeling
    setLocalOversampling(effect.settings.oversampling ?? 2);
    setLocalDriveCurve(effect.settings.driveCurve !== undefined ? effect.settings.driveCurve : 3);
    setLocalTapeBias(effect.settings.tapeBias ?? 0.5);
    setLocalTapeWow(effect.settings.tapeWow ?? 0);
    setLocalTapeFlutter(effect.settings.tapeFlutter ?? 0);
    setLocalTapeSpeed(effect.settings.tapeSpeed ?? 1.0);
  }, [effect.settings, effect.id]); // Added effect.id to force update on preset change

  // Handlers
  const handleParamChange = useCallback((param, value) => {
    // Update local state immediately
    switch (param) {
      case 'distortion': setLocalDistortion(value); break;
      case 'wet': setLocalWet(value); break;
      case 'autoGain': setLocalAutoGain(value); break;
      case 'lowCutFreq': setLocalLowCut(value); break;
      case 'highCutFreq': setLocalHighCut(value); break;
      case 'tone': setLocalTone(value); break;
      case 'headroom': setLocalHeadroom(value); break;
      case 'multiband': setIsMultiband(value === 1); break;
      case 'lowMidCrossover': setLocalLowMidX(value); break;
      case 'midHighCrossover': setLocalMidHighX(value); break;
      case 'lowDrive': setLocalLowDrive(value); break;
      case 'midDrive': setLocalMidDrive(value); break;
      case 'highDrive': setLocalHighDrive(value); break;
      case 'lowMix': setLocalLowMix(value); break;
      case 'midMix': setLocalMidMix(value); break;
      case 'highMix': setLocalHighMix(value); break;
      case 'oversampling': setLocalOversampling(value); break;
      case 'driveCurve': setLocalDriveCurve(value); break;
      case 'tapeBias': setLocalTapeBias(value); break;
      case 'tapeWow': setLocalTapeWow(value); break;
      case 'tapeFlutter': setLocalTapeFlutter(value); break;
      case 'tapeSpeed': setLocalTapeSpeed(value); break;
      default: break;
    }

    // Send to audio engine + store
    setParam(param, value);
    handleMixerEffectChange(trackId, effect.id, param, value);
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

  return (
    <PluginContainerV2
      trackId={trackId}
      effect={effect}
      definition={definition}
      title="SATURATOR"
      subtitle="TUBE HARMONICS"
      category="texture-lab"
      presets={[
        { id: 'default', name: 'Default' },
        { id: 'warm_tube', name: 'Warm Tube' },
        { id: 'crushed', name: 'Crushed' },
        { id: 'master_warmth', name: 'Master Warmth' },
        { id: 'vocal_grit', name: 'Vocal Grit' },
        { id: 'bass_growl', name: 'Bass Growl' }, // New
        { id: 'drum_bus', name: 'Drum Bus Crush' }, // New
        { id: 'multiband_master', name: 'Multiband Master' } // New
      ]}
    >
      <div className="flex flex-col h-full gap-4 p-2">

        {/* TOP SECTION: Visualizer & Mode Switch */}
        <div className="h-48 flex gap-4">
          {/* Visualizer (Expanded) */}
          <div className="flex-1 relative">
            <TransferCurveVisualizer
              trackId={trackId}
              effectId={effect.id}
              drive={localDistortion}
              mix={localWet}
              categoryColors={categoryColors}
              multiband={isMultiband}
            />

            {/* Mode Switch Overlay */}
            <div className="absolute top-2 right-2 flex flex-col gap-2">
              <div className="flex bg-black/60 rounded-lg p-1 backdrop-blur-sm border border-white/10">
                <button
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${!isMultiband ? 'bg-[#F97316] text-black' : 'text-white/60 hover:text-white'}`}
                  onClick={() => handleParamChange('multiband', 0)}
                >
                  SINGLE BAND
                </button>
                <button
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${isMultiband ? 'bg-[#F97316] text-black' : 'text-white/60 hover:text-white'}`}
                  onClick={() => handleParamChange('multiband', 1)}
                >
                  MULTIBAND
                </button>
              </div>
              
              {/* ✅ NEW: Oversampling Selector */}
              <div className="bg-black/60 rounded-lg p-2 backdrop-blur-sm border border-white/10">
                <div className="text-[9px] text-white/60 mb-1 text-center">OVERSAMPLING</div>
                <ModeSelector
                  modes={[
                    { id: 1, name: '1x', description: 'Off' },
                    { id: 2, name: '2x', description: 'Standard' },
                    { id: 4, name: '4x', description: 'High Quality' },
                    { id: 8, name: '8x', description: 'Ultra' }
                  ]}
                  activeMode={localOversampling}
                  onChange={(mode) => handleParamChange('oversampling', mode)}
                  compact={true}
                />
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CONTROLS */}
        <div className="flex-1 bg-black/20 rounded-lg p-4 border border-[#F97316]/10">

          {/* SINGLE BAND MODE */}
          {!isMultiband && (
            <div className="h-full flex flex-col justify-between animate-in fade-in duration-300">
              <div className="flex justify-center gap-12 items-center flex-1">
                <Knob
                  label="DRIVE"
                  value={localDistortion}
                  onChange={(v) => handleParamChange('distortion', v)}
                  min={0}
                  max={1.5}
                  defaultValue={0.4}
                  sizeVariant="large"
                  category="texture-lab"
                />
                <Knob
                  label="MIX"
                  value={localWet}
                  onChange={(v) => handleParamChange('wet', v)}
                  min={0}
                  max={1}
                  defaultValue={1}
                  sizeVariant="large"
                  category="texture-lab"
                  valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
              </div>

              {/* ✅ NEW: Drive Curve Selector */}
              <div className="flex justify-center mb-4">
                <div className="bg-black/30 rounded-lg p-3 border border-[#F97316]/20">
                  <div className="text-xs text-white/60 mb-2 text-center">DRIVE CURVE</div>
                  <ModeSelector
                    modes={[
                      { id: 0, name: 'Soft', description: 'Gentle' },
                      { id: 1, name: 'Medium', description: 'Balanced' },
                      { id: 2, name: 'Hard', description: 'Aggressive' },
                      { id: 3, name: 'Tube', description: 'Warm' },
                      { id: 4, name: 'Tape', description: 'Vintage' }
                    ]}
                    activeMode={localDriveCurve}
                    onChange={(mode) => handleParamChange('driveCurve', mode)}
                    compact={true}
                  />
                </div>
              </div>
              
              {/* ✅ NEW: Tape Modeling Controls (only visible when Tape mode is selected) */}
              {localDriveCurve === 4 && (
                <div className="bg-[#F97316]/10 rounded-lg p-4 mb-4 border border-[#F97316]/30 animate-in fade-in duration-300">
                  <div className="text-xs font-bold text-[#F97316] mb-3 text-center">TAPE MODELING</div>
                  <div className="grid grid-cols-2 gap-4">
                    <Knob
                      label="BIAS"
                      value={localTapeBias}
                      onChange={(v) => handleParamChange('tapeBias', v)}
                      min={0}
                      max={1}
                      defaultValue={0.5}
                      sizeVariant="small"
                      category="texture-lab"
                      valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    />
                    <Knob
                      label="SPEED"
                      value={localTapeSpeed}
                      onChange={(v) => handleParamChange('tapeSpeed', v)}
                      min={0.5}
                      max={2.0}
                      defaultValue={1.0}
                      sizeVariant="small"
                      category="texture-lab"
                      valueFormatter={(v) => `${v.toFixed(2)}x`}
                    />
                    <Knob
                      label="WOW"
                      value={localTapeWow}
                      onChange={(v) => handleParamChange('tapeWow', v)}
                      min={0}
                      max={1}
                      defaultValue={0}
                      sizeVariant="small"
                      category="texture-lab"
                      valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    />
                    <Knob
                      label="FLUTTER"
                      value={localTapeFlutter}
                      onChange={(v) => handleParamChange('tapeFlutter', v)}
                      min={0}
                      max={1}
                      defaultValue={0}
                      sizeVariant="small"
                      category="texture-lab"
                      valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    />
                  </div>
                </div>
              )}

              {/* Tone Controls */}
              <div className="flex justify-center gap-8 pt-4 border-t border-white/5">
                <Knob
                  label="TONE"
                  value={localTone}
                  onChange={(v) => handleParamChange('tone', v)}
                  min={-12}
                  max={12}
                  defaultValue={0}
                  sizeVariant="small"
                  category="texture-lab"
                  valueFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`}
                />
                <Knob
                  label="LOW CUT"
                  value={localLowCut}
                  onChange={(v) => handleParamChange('lowCutFreq', v)}
                  min={0}
                  max={500}
                  defaultValue={0}
                  sizeVariant="small"
                  category="texture-lab"
                  valueFormatter={(v) => `${v.toFixed(0)} Hz`}
                />
                <Knob
                  label="HIGH CUT"
                  value={localHighCut}
                  onChange={(v) => handleParamChange('highCutFreq', v)}
                  min={5000}
                  max={20000}
                  defaultValue={20000}
                  sizeVariant="small"
                  category="texture-lab"
                  valueFormatter={(v) => `${(v / 1000).toFixed(1)} kHz`}
                />
                <Knob
                  label="HEADROOM"
                  value={localHeadroom}
                  onChange={(v) => handleParamChange('headroom', v)}
                  min={-6}
                  max={6}
                  defaultValue={0}
                  sizeVariant="small"
                  category="texture-lab"
                  valueFormatter={(v) => `${v.toFixed(1)} dB`}
                />
              </div>
            </div>
          )}

          {/* MULTIBAND MODE */}
          {isMultiband && (
            <div className="h-full flex flex-col gap-4 animate-in fade-in duration-300">
              {/* Crossovers */}
              <div className="flex gap-4 px-4 py-2 bg-black/20 rounded-lg border border-[#F97316]/10">
                <div className="flex-1">
                  <Slider
                    label="LOW X-OVER"
                    value={localLowMidX}
                    onChange={(v) => handleParamChange('lowMidCrossover', v)}
                    min={50}
                    max={500}
                    defaultValue={250}
                    category="texture-lab"
                    valueFormatter={(v) => `${v.toFixed(0)} Hz`}
                  />
                </div>
                <div className="flex-1">
                  <Slider
                    label="HIGH X-OVER"
                    value={localMidHighX}
                    onChange={(v) => handleParamChange('midHighCrossover', v)}
                    min={1000}
                    max={8000}
                    defaultValue={2500}
                    category="texture-lab"
                    valueFormatter={(v) => `${(v / 1000).toFixed(1)} kHz`}
                  />
                </div>
              </div>

              {/* 3 Bands */}
              <div className="grid grid-cols-3 gap-4 flex-1">
                {/* Low Band */}
                <div className="bg-black/20 rounded-lg p-4 border border-[#F97316]/10 flex flex-col items-center gap-4">
                  <div className="text-xs font-bold text-[#F97316]">LOW BAND</div>
                  <Knob
                    label="DRIVE"
                    value={localLowDrive}
                    onChange={(v) => handleParamChange('lowDrive', v)}
                    min={0}
                    max={2}
                    defaultValue={1}
                    sizeVariant="medium"
                    category="texture-lab"
                  />
                  <Slider
                    label="MIX"
                    value={localLowMix * 100}
                    onChange={(v) => handleParamChange('lowMix', v / 100)}
                    min={0}
                    max={100}
                    defaultValue={100}
                    category="texture-lab"
                    unit="%"
                  />
                </div>

                {/* Mid Band */}
                <div className="bg-black/20 rounded-lg p-4 border border-[#F97316]/10 flex flex-col items-center gap-4">
                  <div className="text-xs font-bold text-[#F97316]">MID BAND</div>
                  <Knob
                    label="DRIVE"
                    value={localMidDrive}
                    onChange={(v) => handleParamChange('midDrive', v)}
                    min={0}
                    max={2}
                    defaultValue={1}
                    sizeVariant="medium"
                    category="texture-lab"
                  />
                  <Slider
                    label="MIX"
                    value={localMidMix * 100}
                    onChange={(v) => handleParamChange('midMix', v / 100)}
                    min={0}
                    max={100}
                    defaultValue={100}
                    category="texture-lab"
                    unit="%"
                  />
                </div>

                {/* High Band */}
                <div className="bg-black/20 rounded-lg p-4 border border-[#F97316]/10 flex flex-col items-center gap-4">
                  <div className="text-xs font-bold text-[#F97316]">HIGH BAND</div>
                  <Knob
                    label="DRIVE"
                    value={localHighDrive}
                    onChange={(v) => handleParamChange('highDrive', v)}
                    min={0}
                    max={2}
                    defaultValue={1}
                    sizeVariant="medium"
                    category="texture-lab"
                  />
                  <Slider
                    label="MIX"
                    value={localHighMix * 100}
                    onChange={(v) => handleParamChange('highMix', v / 100)}
                    min={0}
                    max={100}
                    defaultValue={100}
                    category="texture-lab"
                    unit="%"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex justify-between items-center px-4 py-2 bg-black/20 rounded-lg border border-[#F97316]/10">
          <Checkbox
            checked={localAutoGain === true || localAutoGain === 1}
            onChange={(checked) => handleParamChange('autoGain', checked ? 1 : 0)}
            label="AUTO GAIN"
            category="texture-lab"
          />
          <div className="text-[10px] text-white/40">
            {isMultiband ? 'MULTIBAND PROCESSING ACTIVE' : 'SINGLE BAND TUBE EMULATION'}
          </div>
        </div>

      </div>
    </PluginContainerV2>
  );
};

export default SaturatorUI_V2;
