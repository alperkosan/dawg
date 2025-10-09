import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProfessionalKnob } from '../container/PluginControls';
import { OTT_MODES, getOTTModeParameters, OTT_MODE_CATEGORIES } from '@/config/presets';
import { useAudioPlugin } from '@/hooks/useAudioPlugin';

/**
 * OTT UI - OVER THE TOP MULTIBAND COMPRESSOR
 * 3-band upward/downward compression
 */

// Ghost Value Hook - Tracks previous value for visual feedback
const useGhostValue = (value, delay = 300) => {
  const [ghostValue, setGhostValue] = useState(value);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setGhostValue(value);
    }, delay);
    return () => clearTimeout(timeoutRef.current);
  }, [value, delay]);

  return ghostValue;
};

// Enhanced Slider with Ghost Value & Advanced Interactions
const EnhancedSlider = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  defaultValue,
  color,
  unit = '',
  precision = 1,
  width = 'flex-1'
}) => {
  const ghostValue = useGhostValue(value, 400);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const sliderRef = useRef(null);

  const handleChange = (e) => {
    const val = parseFloat(e.target.value);
    onChange(val);
  };

  const handleDoubleClick = () => {
    onChange(defaultValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Shift') setIsShiftPressed(true);
  };

  const handleKeyUp = (e) => {
    if (e.key === 'Shift') setIsShiftPressed(false);
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const percentage = ((value - min) / (max - min)) * 100;
  const ghostPercentage = ((ghostValue - min) / (max - min)) * 100;

  return (
    <div className={`${width} flex items-center gap-2 group relative`}>
      <div className="text-[9px] text-white/50 w-8 uppercase">{label}</div>
      <div className="flex-1 relative h-3 flex items-center">
        {/* Ghost value indicator */}
        {Math.abs(ghostValue - value) > step && (
          <div
            className="absolute h-2 w-1 rounded-full transition-all duration-500 ease-out opacity-40"
            style={{
              left: `${ghostPercentage}%`,
              backgroundColor: color,
              transform: 'translateX(-50%)'
            }}
          />
        )}

        <input
          ref={sliderRef}
          type="range"
          min={min}
          max={max}
          step={isShiftPressed ? step / 10 : step}
          value={value}
          onChange={handleChange}
          onDoubleClick={handleDoubleClick}
          className="w-full h-1 rounded-full appearance-none cursor-pointer transition-all hover:h-1.5"
          style={{
            background: `linear-gradient(to right, ${color}40 0%, ${color} ${percentage}%, #ffffff15 ${percentage}%)`,
          }}
          title={isShiftPressed ? "Fine tune (Shift)" : "Double-click to reset"}
        />
      </div>
      <div className="text-[9px] text-white/70 w-12 text-right font-mono">
        {value.toFixed(precision)}{unit}
      </div>

      {/* Hover tooltip */}
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 px-2 py-1 rounded text-[8px] text-white/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
        Shift: Fine • DblClick: Reset
      </div>
    </div>
  );
};

// Band Control - Compact & Enhanced
const BandControl = ({ label, color, range, upRatio, downRatio, gain, onUpRatioChange, onDownRatioChange, onGainChange }) => {
  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* Label */}
      <div className="w-12 flex-shrink-0">
        <div className="text-[10px] font-bold tracking-wider" style={{ color }}>
          {label}
        </div>
        <div className="text-[7px] text-white/30">{range}</div>
      </div>

      {/* Up/Down Ratio Sliders - Compact */}
      <div className="flex-1 flex flex-col gap-1.5">
        <EnhancedSlider
          label="UP"
          value={upRatio}
          onChange={onUpRatioChange}
          min={1}
          max={20}
          step={0.1}
          defaultValue={3}
          color={color}
          unit=":1"
          precision={1}
        />
        <EnhancedSlider
          label="DN"
          value={downRatio}
          onChange={onDownRatioChange}
          min={1}
          max={20}
          step={0.1}
          defaultValue={3}
          color={color}
          unit=":1"
          precision={1}
        />
      </div>

      {/* Gain Control - Compact */}
      <div className="w-24">
        <EnhancedSlider
          label="GAIN"
          value={gain}
          onChange={onGainChange}
          min={-12}
          max={12}
          step={0.5}
          defaultValue={0}
          color={color}
          unit="dB"
          precision={1}
        />
      </div>
    </div>
  );
};

// Canvas-based 3-Band Spectrum Meter with advanced visuals
const ThreeBandMeter = ({ bands = { low: 0, mid: 0, high: 0 } }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const smoothedBandsRef = useRef({ low: 0, mid: 0, high: 0 });
  const peaksRef = useRef({ low: 0, mid: 0, high: 0 });
  const maxPeaksRef = useRef({ low: 0, mid: 0, high: 0 }); // All-time max
  const peakFallRef = useRef({ low: 0, mid: 0, high: 0 });

  // RMS averaging for stable readings
  const rmsBufferRef = useRef({
    low: new Array(30).fill(0),
    mid: new Array(30).fill(0),
    high: new Array(30).fill(0)
  });
  const rmsIndexRef = useRef(0);

  // Display value smoothing (slower for text)
  const displayValuesRef = useRef({ low: 0, mid: 0, high: 0 });

  const bandConfigs = [
    { key: 'low', label: 'BASS', color: '#ef4444', range: '0-250Hz', rgb: [239, 68, 68] },
    { key: 'mid', label: 'MID', color: '#f59e0b', range: '250Hz-2.5k', rgb: [245, 158, 11] },
    { key: 'high', label: 'HIGH', color: '#3b82f6', range: '2.5k+', rgb: [59, 130, 246] }
  ];

  const drawMeter = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const barWidth = width / 3;
    const topMargin = 35; // Space for current + max labels
    const bottomMargin = 45; // Space for band labels
    const maxHeight = height - topMargin - bottomMargin;

    bandConfigs.forEach(({ key, label, color, range, rgb }, index) => {
      // Get raw value from bands (should be in dB, likely 0-60 range)
      const rawValue = bands[key] || 0;
      const targetLevel = Math.min(Math.max(rawValue / 60, 0), 1); // Normalize to 0-1

      // RMS averaging for stability
      const buffer = rmsBufferRef.current[key];
      buffer[rmsIndexRef.current % 30] = targetLevel;
      const rmsAverage = buffer.reduce((sum, val) => sum + val, 0) / buffer.length;

      // Smooth the level changes (for bar movement)
      const barSmoothing = 0.15; // Slower for visual stability
      smoothedBandsRef.current[key] += (rmsAverage - smoothedBandsRef.current[key]) * barSmoothing;
      const level = Math.max(0, Math.min(1, smoothedBandsRef.current[key]));

      // Display value smoothing (even slower for text readability)
      const displaySmoothing = 0.08; // Very slow
      displayValuesRef.current[key] += (rmsAverage - displayValuesRef.current[key]) * displaySmoothing;
      const displayLevel = Math.max(0, Math.min(1, displayValuesRef.current[key]));

      // Peak hold logic - track the smoothed bar level, not raw
      if (level > peaksRef.current[key]) {
        peaksRef.current[key] = level;
        peakFallRef.current[key] = 0;
      } else {
        peakFallRef.current[key] += 0.003; // Slower fall
        peaksRef.current[key] = Math.max(0, peaksRef.current[key] - peakFallRef.current[key]);
      }

      // Track all-time max - use peak hold value for accuracy
      if (peaksRef.current[key] > maxPeaksRef.current[key]) {
        maxPeaksRef.current[key] = peaksRef.current[key];
      }

      const x = index * barWidth;
      const barHeight = level * maxHeight;
      const peakY = topMargin + (1 - peaksRef.current[key]) * maxHeight;

      // Draw scale markers
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const markerY = topMargin + (i / 5) * maxHeight;
        ctx.beginPath();
        ctx.moveTo(x + barWidth/2 - 32, markerY);
        ctx.lineTo(x + barWidth/2 + 32, markerY);
        ctx.stroke();

        // Scale labels (0, -12, -24, -36, -48, -60 dB)
        if (i === 0 || i === 5) {
          ctx.font = '7px monospace';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.textAlign = 'left';
          ctx.fillText(i === 0 ? '0' : `-60`, x + barWidth/2 + 34, markerY + 2);
        }
      }

      // Draw background gradient
      const bgGradient = ctx.createLinearGradient(x + barWidth/2 - 30, 0, x + barWidth/2 + 30, 0);
      bgGradient.addColorStop(0, 'rgba(255,255,255,0.02)');
      bgGradient.addColorStop(0.5, 'rgba(255,255,255,0.05)');
      bgGradient.addColorStop(1, 'rgba(255,255,255,0.02)');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(x + barWidth/2 - 30, topMargin, 60, maxHeight);

      // Draw main bar with multi-stop gradient
      const barY = topMargin + maxHeight - barHeight;
      const gradient = ctx.createLinearGradient(0, topMargin + maxHeight, 0, barY);

      // Color based on level (green -> yellow -> red)
      if (level < 0.5) {
        gradient.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`);
        gradient.addColorStop(0.5, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.9)`);
        gradient.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.5)`);
      } else if (level < 0.8) {
        gradient.addColorStop(0, `rgba(245, 158, 11, 1)`); // Orange warning
        gradient.addColorStop(0.5, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.9)`);
        gradient.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.5)`);
      } else {
        gradient.addColorStop(0, `rgba(239, 68, 68, 1)`); // Red danger
        gradient.addColorStop(0.5, `rgba(245, 158, 11, 0.9)`);
        gradient.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.5)`);
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(x + barWidth/2 - 25, barY, 50, barHeight);

      // Draw glow effect
      ctx.shadowBlur = 20;
      ctx.shadowColor = color;
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.2)`;
      ctx.fillRect(x + barWidth/2 - 25, barY, 50, barHeight);
      ctx.shadowBlur = 0;

      // Draw segments/LEDs effect (more segments for better resolution)
      const segmentCount = 35;
      const segmentHeight = maxHeight / segmentCount;
      const segmentGap = 1.5;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      for (let i = 0; i < segmentCount; i++) {
        const segY = topMargin + (i * segmentHeight);
        if (segY < barY - segmentGap) {
          ctx.fillRect(x + barWidth/2 - 25, segY + segmentHeight - segmentGap, 50, segmentGap);
        }
      }

      // Draw peak hold indicator (follows the bar peaks)
      if (peaksRef.current[key] > 0.02) {
        const peakHeight = 4;
        // Ensure peak is within bounds
        const clampedPeakY = Math.max(topMargin, Math.min(topMargin + maxHeight, peakY));

        ctx.fillStyle = color;
        ctx.fillRect(x + barWidth/2 - 32, clampedPeakY - peakHeight/2, 64, peakHeight);

        // Peak glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.8)`;
        ctx.fillRect(x + barWidth/2 - 32, clampedPeakY - peakHeight/2, 64, peakHeight);
        ctx.shadowBlur = 0;

        // Peak value on the side
        const peakDb = peaksRef.current[key] * 60; // 0-60 range
        const peakDbFS = peakDb - 60; // Convert to -60 to 0 dBFS
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.fillText(`${peakDbFS.toFixed(0)}`, x + barWidth/2 + 36, clampedPeakY + 3);
      }

      // Draw current level dB (using slower display value)
      const currentDb = displayLevel * 60; // 0-60 range
      const currentDbFS = currentDb - 60; // Convert to -60 to 0 dBFS
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = displayLevel > 0.85 ? '#ef4444' : displayLevel > 0.5 ? '#f59e0b' : 'rgba(255, 255, 255, 0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(`${currentDbFS.toFixed(1)}dB`, x + barWidth/2, topMargin - 18);

      // Average indicator (for context)
      ctx.font = '6px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText('AVG', x + barWidth/2, topMargin - 28);

      // Draw MAX indicator (all-time peak) - always visible
      const maxPeakNormalized = maxPeaksRef.current[key];
      const maxDb = maxPeakNormalized * 60; // 0-60 range
      const maxDbFS = maxDb - 60; // Convert to -60 to 0 dBFS
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.8)`;
      ctx.fillText(`MAX ${maxDbFS.toFixed(1)}dB`, x + barWidth/2, topMargin - 6);

      // Draw max peak line on the meter (dashed line at highest point ever reached)
      if (maxPeakNormalized > 0.02) {
        const maxPeakY = topMargin + (1 - maxPeakNormalized) * maxHeight;
        const clampedMaxPeakY = Math.max(topMargin, Math.min(topMargin + maxHeight, maxPeakY));

        ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.6)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x + barWidth/2 - 32, clampedMaxPeakY);
        ctx.lineTo(x + barWidth/2 + 32, clampedMaxPeakY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Small triangle marker on the side
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.8)`;
        ctx.beginPath();
        ctx.moveTo(x + barWidth/2 + 34, clampedMaxPeakY);
        ctx.lineTo(x + barWidth/2 + 38, clampedMaxPeakY - 3);
        ctx.lineTo(x + barWidth/2 + 38, clampedMaxPeakY + 3);
        ctx.closePath();
        ctx.fill();
      }

      // Draw label
      ctx.font = 'bold 10px system-ui';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(label, x + barWidth/2, height - bottomMargin + 18);

      // Draw range
      ctx.font = '7px system-ui';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillText(range, x + barWidth/2, height - bottomMargin + 30);

      // Draw raw input value for debugging
      ctx.font = '7px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText(`RAW: ${rawValue.toFixed(1)}`, x + barWidth/2, height - bottomMargin + 42);
    });

    // Update RMS buffer index
    rmsIndexRef.current++;

    animationRef.current = requestAnimationFrame(drawMeter);
  }, [bands]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    // Start animation loop
    animationRef.current = requestAnimationFrame(drawMeter);

    return () => {
      window.removeEventListener('resize', updateSize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawMeter]);

  return (
    <div className="relative" style={{ width: '260px', height: '220px' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 rounded-lg"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

// Collapsible Mode Selector - Compact
const ModeSelector = ({ currentMode, onModeChange }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const modes = Object.values(OTT_MODES);

  const categorized = modes.reduce((acc, mode) => {
    if (!acc[mode.category]) acc[mode.category] = [];
    acc[mode.category].push(mode);
    return acc;
  }, {});

  const getColorClass = (color, active) => {
    const colors = {
      blue: active ? 'border-blue-500/60 bg-blue-500/15' : '',
      red: active ? 'border-red-500/60 bg-red-500/15' : '',
      purple: active ? 'border-purple-500/60 bg-purple-500/15' : '',
      amber: active ? 'border-amber-500/60 bg-amber-500/15' : '',
      cyan: active ? 'border-cyan-500/60 bg-cyan-500/15' : '',
      green: active ? 'border-green-500/60 bg-green-500/15' : '',
      indigo: active ? 'border-indigo-500/60 bg-indigo-500/15' : ''
    };
    return colors[color] || '';
  };

  const currentModeObj = modes.find(m => m.id === currentMode);

  return (
    <div className="flex flex-col gap-2">
      {/* Collapsed Header - Shows current mode */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 px-3 py-2.5 bg-gradient-to-r from-orange-950/50 to-red-950/50 border border-orange-500/30 rounded-lg hover:border-orange-500/50 transition-all group"
      >
        <div className="text-lg">{currentModeObj?.icon}</div>
        <div className="flex-1 text-left">
          <div className="text-[10px] text-orange-300/70 uppercase tracking-wider">Mode</div>
          <div className="text-xs font-bold text-white">{currentModeObj?.name}</div>
        </div>
        <div className={`text-xs text-orange-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </div>
      </button>

      {/* Expandable Mode List */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="flex flex-col gap-3 pt-2">
          {Object.entries(categorized).map(([category, categoryModes]) => (
            <div key={category} className="flex flex-col gap-1.5">
              <div className="text-[9px] text-white/40 uppercase tracking-wider font-medium px-2">
                {OTT_MODE_CATEGORIES[category]?.name || category}
              </div>
              <div className="flex flex-col gap-1">
                {categoryModes.map((mode) => {
                  const isActive = currentMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => onModeChange(mode.id)}
                      className={`
                        flex items-center gap-2 px-2.5 py-2 rounded-lg
                        border transition-all duration-200
                        ${isActive
                          ? `${getColorClass(mode.color, true)} border-opacity-60 shadow-lg scale-105`
                          : 'border-white/5 hover:border-white/15 hover:bg-white/5'
                        }
                      `}
                    >
                      <div className="text-base">{mode.icon}</div>
                      <div className="flex-1 text-left">
                        <div className="text-[10px] font-medium text-white">{mode.name}</div>
                        <div className="text-[8px] text-white/40 leading-tight">{mode.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const OTTUI = ({ trackId, effect, onChange }) => {
  const {
    depth = 0.5,
    time = 0.5,
    wet = 1.0
  } = effect.settings;

  // Mode-based state
  const [selectedMode, setSelectedMode] = useState('ott-drums');
  const [amount, setAmount] = useState(50);
  const [bandLevels, setBandLevels] = useState({ low: 0, mid: 0, high: 0 });

  // Store onChange in ref
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Apply mode + amount
  useEffect(() => {
    const params = getOTTModeParameters(selectedMode, amount);
    if (!params) return;

    Object.entries(params).forEach(([key, value]) => {
      onChangeRef.current(key, value);
    });
  }, [selectedMode, amount]);

  // Use standardized audio plugin hook
  const { plugin } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: false
  });

  // Metering - Listen to worklet messages
  useEffect(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    const handleMessage = (event) => {
      const { type, bands } = event.data;
      if (type === 'metering' && bands) {
        setBandLevels(bands);
      }
    };

    audioNode.port.onmessage = handleMessage;

    return () => {
      if (audioNode?.port) {
        audioNode.port.onmessage = null;
      }
    };
  }, [plugin]);

  const currentMode = OTT_MODES[selectedMode];

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-neutral-950 to-black p-3 flex gap-3 overflow-hidden">

      {/* LEFT: Compact Mode Selector */}
      <div className="w-[220px] flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
        <ModeSelector currentMode={selectedMode} onModeChange={setSelectedMode} />
      </div>

      {/* CENTER: Hero Controls */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">

        {/* OTT Branding + Current Mode - Compact */}
        <div className="relative bg-gradient-to-r from-orange-950/40 via-red-950/40 to-orange-950/40 rounded-lg px-4 py-2.5 border border-orange-500/30 shadow-lg shadow-orange-500/10 transition-all hover:shadow-orange-500/20">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{currentMode?.icon}</div>
            <div className="flex-1">
              <div className="text-sm font-black text-orange-400 tracking-wider uppercase">
                Over The Top
              </div>
              <div className="text-[9px] text-orange-300/70">{currentMode?.name} • {currentMode?.description}</div>
            </div>
            <div className="text-lg font-bold text-orange-400 font-mono tabular-nums">{amount}%</div>
          </div>
        </div>

        {/* Main Control Area - Compact */}
        <div className="flex-grow flex flex-col gap-4 bg-gradient-to-br from-orange-950/20 via-black to-red-950/20 rounded-xl p-5 border border-orange-500/20">

          {/* Top: Knobs Row - Compact */}
          <div className="flex items-center justify-center gap-10">
            {/* DEPTH Knob (Hero Control) */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-[10px] text-orange-300/80 font-bold tracking-widest uppercase">Depth</div>
              <ProfessionalKnob
                label=""
                value={amount}
                onChange={setAmount}
                min={0}
                max={100}
                defaultValue={50}
                unit="%"
                precision={0}
                size={110}
              />
              <div className="text-2xl font-black text-orange-400 tabular-nums">{amount}%</div>
              <div className="text-[8px] text-white/30 uppercase tracking-wider">Amount</div>
            </div>

            {/* TIME Knob */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-[10px] text-orange-300/80 font-bold tracking-widest uppercase">Time</div>
              <ProfessionalKnob
                label=""
                value={time}
                onChange={(val) => onChange('time', val)}
                min={0}
                max={1}
                defaultValue={0.5}
                unit=""
                precision={2}
                size={85}
              />
              <div className="text-lg font-bold text-white tabular-nums">{(time * 100).toFixed(0)}%</div>
              <div className="text-[8px] text-white/30 uppercase tracking-wider">Attack/Release</div>
            </div>

            {/* Divider */}
            <div className="h-32 w-px bg-gradient-to-b from-transparent via-orange-500/30 to-transparent" />

            {/* 3-Band Spectrum */}
            <ThreeBandMeter bands={bandLevels} />
          </div>

          {/* Band Controls - Compact */}
          <div className="bg-gradient-to-br from-black/40 to-black/20 rounded-lg p-4 border border-orange-500/10">
            <div className="text-[10px] text-orange-300/70 font-bold uppercase tracking-wider mb-3">Band Control</div>

            <div className="flex flex-col gap-2.5">
              {/* LOW Band */}
              <BandControl
                label="LOW"
                color="#ef4444"
                range="0-250Hz"
                upRatio={effect.settings.lowUpRatio || 3}
                downRatio={effect.settings.lowDownRatio || 3}
                gain={effect.settings.lowGain || 0}
                onUpRatioChange={(val) => onChange('lowUpRatio', val)}
                onDownRatioChange={(val) => onChange('lowDownRatio', val)}
                onGainChange={(val) => onChange('lowGain', val)}
              />

              {/* MID Band */}
              <BandControl
                label="MID"
                color="#f59e0b"
                range="250Hz-2.5k"
                upRatio={effect.settings.midUpRatio || 3}
                downRatio={effect.settings.midDownRatio || 3}
                gain={effect.settings.midGain || 0}
                onUpRatioChange={(val) => onChange('midUpRatio', val)}
                onDownRatioChange={(val) => onChange('midDownRatio', val)}
                onGainChange={(val) => onChange('midGain', val)}
              />

              {/* HIGH Band */}
              <BandControl
                label="HIGH"
                color="#3b82f6"
                range="2.5k+"
                upRatio={effect.settings.highUpRatio || 3}
                downRatio={effect.settings.highDownRatio || 3}
                gain={effect.settings.highGain || 0}
                onUpRatioChange={(val) => onChange('highUpRatio', val)}
                onDownRatioChange={(val) => onChange('highDownRatio', val)}
                onGainChange={(val) => onChange('highGain', val)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Compact Output Control */}
      <div className="w-[160px] flex-shrink-0 flex flex-col gap-3">

        {/* Output Gain */}
        <div className="bg-gradient-to-br from-black/50 to-black/30 rounded-lg p-3 border border-white/10">
          <div className="text-[10px] text-white/50 font-semibold tracking-wide uppercase mb-2">Output</div>
          <ProfessionalKnob
            label="Mix"
            value={wet}
            onChange={(val) => onChange('wet', val)}
            min={0}
            max={1}
            defaultValue={1}
            unit="%"
            displayMultiplier={100}
            precision={0}
            size={70}
          />
        </div>

        {/* Info Panel - Compact */}
        <div className="flex-1 bg-gradient-to-br from-orange-950/20 to-red-950/20 rounded-lg p-3 border border-orange-500/20 flex flex-col gap-2">
          <div className="text-[9px] text-orange-300/70 font-bold uppercase tracking-wider">Stats</div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Depth</span>
            <span className="text-orange-400 font-mono tabular-nums">{amount}%</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Time</span>
            <span className="text-orange-400 font-mono tabular-nums">{(time * 100).toFixed(0)}%</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Mix</span>
            <span className="text-orange-400 font-mono tabular-nums">{(wet * 100).toFixed(0)}%</span>
          </div>

          <div className="border-t border-orange-500/20 pt-2 mt-auto">
            <div className="text-[8px] text-white/30 leading-relaxed">
              Multiband OTT compression
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
