/**
 * PitchShifter v2.0 - "The Texture Lab"
 *
 * Professional pitch-shifting with harmonic visualization
 *
 * Features:
 * - Mode-based pitch intervals (Octave Up/Down, Perfect Fifth, etc.)
 * - Real-time pitch spectrum visualization
 * - Formant preservation control
 * - Texture Lab category theming (warm orange/red palette)
 * - Ghost value feedback
 * - 3-panel layout
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Knob } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

// Pitch Shift Modes
const PITCH_MODES = {
  'octave-up': {
    id: 'octave-up',
    name: 'Octave Up',
    icon: '⬆️',
    description: 'One octave higher',
    color: 'blue',
    settings: { pitch: 12, windowSize: 0.1, wet: 1.0 }
  },
  'octave-down': {
    id: 'octave-down',
    name: 'Octave Down',
    icon: '⬇️',
    description: 'One octave lower',
    color: 'red',
    settings: { pitch: -12, windowSize: 0.1, wet: 1.0 }
  },
  'perfect-fifth': {
    id: 'perfect-fifth',
    name: 'Perfect Fifth',
    icon: '🎵',
    description: '+7 semitones harmony',
    color: 'purple',
    settings: { pitch: 7, windowSize: 0.08, wet: 0.6 }
  },
  'major-third': {
    id: 'major-third',
    name: 'Major Third',
    icon: '🎶',
    description: '+4 semitones harmony',
    color: 'green',
    settings: { pitch: 4, windowSize: 0.08, wet: 0.5 }
  },
  'shimmer': {
    id: 'shimmer',
    name: 'Shimmer',
    icon: '✨',
    description: 'Octave up subtle blend',
    color: 'cyan',
    settings: { pitch: 12, windowSize: 0.15, wet: 0.3 }
  },
  'detune': {
    id: 'detune',
    name: 'Detune',
    icon: '〜',
    description: 'Slight detuning chorus',
    color: 'amber',
    settings: { pitch: 0.15, windowSize: 0.05, wet: 0.4 }
  },
  'custom': {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    description: 'Manual control',
    color: 'gray',
    settings: { pitch: 0, windowSize: 0.1, wet: 0.5 }
  }
};

const MODE_CATEGORIES = {
  'INTERVALS': {
    name: 'Intervals',
    modes: ['octave-up', 'octave-down', 'perfect-fifth', 'major-third']
  },
  'CREATIVE': {
    name: 'Creative',
    modes: ['shimmer', 'detune']
  },
  'CUSTOM': {
    name: 'Custom',
    modes: ['custom']
  }
};

// Pitch Spectrum Visualizer
const PitchSpectrumVisualizer = ({ pitch, wet, inputLevel }) => {
  const timeRef = useRef(0);

  const drawPitchSpectrum = useCallback((ctx, width, height) => {
    const time = timeRef.current;

    // Clear with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(15, 10, 20, 0.95)');
    gradient.addColorStop(1, 'rgba(5, 5, 10, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Reference grid lines
    ctx.strokeStyle = 'rgba(255, 120, 80, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i++) {
      const y = (i / 12) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw harmonic series visualization
    const centerY = height / 2;
    const fundamentalFreq = 440; // A4

    // Calculate pitch shift ratio
    const pitchRatio = Math.pow(2, pitch / 12);
    const shiftedFreq = fundamentalFreq * pitchRatio;

    // Color based on pitch direction
    const hue = pitch > 0 ? 200 - pitch * 5 : 200 + Math.abs(pitch) * 5; // Blue to red
    const saturation = 70 + Math.abs(pitch) * 2;
    const lightness = 50 + inputLevel * 20;

    // Draw original harmonics (faded)
    for (let h = 1; h <= 8; h++) {
      const freq = fundamentalFreq * h;
      const x = (Math.log(freq / 20) / Math.log(20000 / 20)) * width;
      const amplitude = 1 / h;
      const barHeight = amplitude * height * 0.3 * (1 - wet);

      if (x > 0 && x < width) {
        ctx.fillStyle = `hsla(${hue}, 30%, 40%, ${0.3 * (1 - wet)})`;
        ctx.fillRect(x - 2, centerY - barHeight / 2, 4, barHeight);
      }
    }

    // Draw shifted harmonics (prominent)
    for (let h = 1; h <= 8; h++) {
      const freq = shiftedFreq * h;
      const x = (Math.log(freq / 20) / Math.log(20000 / 20)) * width;
      const amplitude = 1 / h;
      const barHeight = amplitude * height * 0.4 * wet * inputLevel;

      if (x > 0 && x < width) {
        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${0.8 * wet})`;
        ctx.shadowColor = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.5)`;
        ctx.shadowBlur = 10;
        ctx.fillRect(x - 3, centerY - barHeight / 2, 6, barHeight);
        ctx.shadowBlur = 0;
      }
    }

    // Pitch shift indicator
    const pitchText = pitch > 0 ? `+${pitch}st` : `${pitch}st`;
    const pitchDisplayY = pitch > 0 ? height * 0.2 : height * 0.8;

    ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.9)`;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.5)`;
    ctx.shadowBlur = 15;
    ctx.fillText(pitchText, width / 2, pitchDisplayY);
    ctx.shadowBlur = 0;

    // Draw frequency labels
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255, 150, 100, 0.5)';
    ctx.textAlign = 'center';
    [100, 200, 500, 1000, 2000, 5000, 10000].forEach(freq => {
      const x = (Math.log(freq / 20) / Math.log(20000 / 20)) * width;
      if (x > 20 && x < width - 20) {
        ctx.fillText(freq < 1000 ? `${freq}Hz` : `${freq / 1000}k`, x, height - 10);
      }
    });

    // Animated pitch shift wave
    ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${0.4 * wet})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const t = (x / width) * Math.PI * 4 + time * 0.002;
      const offset = Math.sin(t) * pitch * 2;
      const y = centerY + offset;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    timeRef.current += 16;
  }, [pitch, wet, inputLevel]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawPitchSpectrum,
    [pitch, wet, inputLevel]
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// Mode Selector Component
const PitchModeSelector = ({ currentMode, onModeChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const categorized = Object.entries(MODE_CATEGORIES).reduce((acc, [categoryKey, category]) => {
    acc[categoryKey] = category.modes.map(modeId => PITCH_MODES[modeId]);
    return acc;
  }, {});

  const currentModeObj = PITCH_MODES[currentMode];

  return (
    <div className="flex flex-col gap-2">
      {/* Collapsed Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 px-3 py-2.5 bg-gradient-to-r from-orange-950/50 to-amber-950/50 border border-orange-500/30 rounded-lg hover:border-orange-500/50 transition-all group"
      >
        <div className="text-2xl">{currentModeObj?.icon}</div>
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
          isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="flex flex-col gap-3 pt-2">
          {Object.entries(categorized).map(([category, categoryModes]) => (
            <div key={category} className="flex flex-col gap-1.5">
              <div className="text-[9px] text-white/40 uppercase tracking-wider font-medium px-2">
                {MODE_CATEGORIES[category]?.name || category}
              </div>
              <div className="flex flex-col gap-1">
                {categoryModes.map((mode) => {
                  const isActive = currentMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => {
                        onModeChange(mode.id);
                        setIsExpanded(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left ${
                        isActive
                          ? 'bg-orange-500/20 border-orange-500/60 shadow-lg shadow-orange-500/20'
                          : 'bg-black/20 border-white/10 hover:border-orange-500/30 hover:bg-orange-500/10'
                      }`}
                    >
                      <span className="text-lg">{mode.icon}</span>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-white">{mode.name}</div>
                        <div className="text-[10px] text-white/50">{mode.description}</div>
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

// Main Component
export const PitchShifterUI = ({ trackId, effect, onChange }) => {
  const { pitch, windowSize, wet } = effect.settings;
  const [currentMode, setCurrentMode] = useState('custom');
  const [inputLevel, setInputLevel] = useState(0);

  // Audio plugin hook
  const { metrics } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: true
  });

  // Update input level from metrics
  useEffect(() => {
    if (metrics?.inputPeak !== undefined) {
      setInputLevel(Math.max(0, Math.min(1, (metrics.inputPeak + 60) / 60)));
    }
  }, [metrics]);

  // Ghost values
  const ghostPitch = useGhostValue(pitch, 400);
  const ghostWindowSize = useGhostValue(windowSize, 400);
  const ghostWet = useGhostValue(wet, 400);

  // Handle mode change
  const handleModeChange = (modeId) => {
    setCurrentMode(modeId);
    const mode = PITCH_MODES[modeId];
    if (mode && modeId !== 'custom') {
      Object.entries(mode.settings).forEach(([key, value]) => {
        onChange(key, value);
      });
    }
  };

  const currentModeObj = PITCH_MODES[currentMode];

  // Calculate frequency ratio for display
  const frequencyRatio = Math.pow(2, pitch / 12);

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-neutral-950 to-black p-3 flex gap-3">

      {/* LEFT: Mode Selector */}
      <div className="w-[220px] flex-shrink-0 flex flex-col gap-2">
        <PitchModeSelector currentMode={currentMode} onModeChange={handleModeChange} />
      </div>

      {/* CENTER: Main Controls */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">

        {/* Header */}
        <div className="bg-gradient-to-r from-orange-950/40 via-amber-950/40 to-orange-950/40 rounded-lg px-4 py-2.5 border border-orange-500/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{currentModeObj?.icon}</div>
            <div className="flex-1">
              <div className="text-sm font-black text-orange-400 tracking-wider uppercase">
                Pitch Shifter
              </div>
              <div className="text-[9px] text-orange-300/70">{currentModeObj?.name} • {currentModeObj?.description}</div>
            </div>
          </div>
        </div>

        {/* Visualization */}
        <div className="flex-1 bg-gradient-to-br from-orange-950/20 via-black to-amber-950/20 rounded-xl border border-orange-500/20 overflow-hidden">
          <PitchSpectrumVisualizer pitch={pitch} wet={wet} inputLevel={inputLevel} />
        </div>

        {/* Controls */}
        <div className="grid grid-cols-3 gap-4 bg-gradient-to-br from-black/40 to-black/20 rounded-lg p-4 border border-orange-500/10">
          <div className="flex justify-center">
            <Knob
              label="Pitch"
              value={pitch}
              onChange={(val) => {
                onChange('pitch', val);
                setCurrentMode('custom');
              }}
              min={-12}
              max={12}
              defaultValue={0}
              unit="st"
              precision={1}
              size={90}
              bipolar
              category="texture-lab"
              ghostValue={ghostPitch}
              showGhostValue={true}
            />
          </div>

          <div className="flex justify-center">
            <Knob
              label="Window Size"
              value={windowSize * 1000}
              onChange={(val) => {
                onChange('windowSize', val / 1000);
                setCurrentMode('custom');
              }}
              min={10}
              max={400}
              defaultValue={100}
              unit="ms"
              precision={0}
              size={90}
              category="texture-lab"
              ghostValue={ghostWindowSize * 1000}
              showGhostValue={true}
            />
          </div>

          <div className="flex justify-center">
            <Knob
              label="Mix"
              value={wet * 100}
              onChange={(val) => {
                onChange('wet', val / 100);
                setCurrentMode('custom');
              }}
              min={0}
              max={100}
              defaultValue={100}
              unit="%"
              precision={0}
              size={90}
              category="texture-lab"
              ghostValue={ghostWet * 100}
              showGhostValue={true}
            />
          </div>
        </div>
      </div>

      {/* RIGHT: Stats */}
      <div className="w-[160px] flex-shrink-0 flex flex-col gap-3">
        <div className="bg-gradient-to-br from-orange-950/20 to-amber-950/20 rounded-lg p-3 border border-orange-500/20 flex flex-col gap-2">
          <div className="text-[9px] text-orange-300/70 font-bold uppercase tracking-wider">Stats</div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Pitch</span>
            <span className="text-orange-400 font-bold">{pitch > 0 ? '+' : ''}{pitch.toFixed(1)}st</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Ratio</span>
            <span className="text-orange-400 font-bold">{frequencyRatio.toFixed(3)}x</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Window</span>
            <span className="text-orange-400 font-bold">{(windowSize * 1000).toFixed(0)}ms</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Mix</span>
            <span className="text-orange-400 font-bold">{(wet * 100).toFixed(0)}%</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Input</span>
            <span className="text-orange-400 font-bold">{(inputLevel * 100).toFixed(0)}%</span>
          </div>
        </div>

        <div className="flex-1 bg-gradient-to-br from-orange-950/10 to-amber-950/10 rounded-lg p-3 border border-orange-500/10 flex flex-col justify-center items-center">
          <div className="text-[8px] text-orange-300/50 uppercase tracking-wider mb-2">The Texture Lab</div>
          <div className="text-4xl mb-2">🎵</div>
          <div className="text-[9px] text-center text-white/40 leading-tight">
            Professional pitch-shifting
          </div>
        </div>
      </div>
    </div>
  );
};
