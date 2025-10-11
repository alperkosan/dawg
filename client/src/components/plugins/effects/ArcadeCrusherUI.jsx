/**
 * ArcadeCrusher v2.0 - "The Texture Lab"
 *
 * Professional bit-crushing with retro arcade aesthetics
 *
 * Features:
 * - Mode-based bit reduction (4-bit, 8-bit, 16-bit, etc.)
 * - Real-time waveform quantization visualization
 * - Sample rate reduction
 * - Texture Lab category theming (warm orange/red palette)
 * - Ghost value feedback
 * - 3-panel layout
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Knob, Button, ModeSelector } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

// Bit Crusher Modes
const CRUSHER_MODES = {
  'lo-fi': {
    id: 'lo-fi',
    name: 'Lo-Fi',
    icon: '🎮',
    description: 'Warm vintage degradation',
    color: 'amber',
    settings: { bits: 4, sampleRate: 8000, wet: 0.7 }
  },
  '4bit': {
    id: '4bit',
    name: '4-Bit',
    icon: '🕹️',
    description: 'Classic 8-bit console',
    color: 'red',
    settings: { bits: 4, sampleRate: 11025, wet: 1.0 }
  },
  '8bit': {
    id: '8bit',
    name: '8-Bit',
    icon: '🎲',
    description: 'Retro arcade crunch',
    color: 'orange',
    settings: { bits: 8, sampleRate: 22050, wet: 1.0 }
  },
  '12bit': {
    id: '12bit',
    name: '12-Bit',
    icon: '📻',
    description: 'Early digital warmth',
    color: 'amber',
    settings: { bits: 12, sampleRate: 32000, wet: 0.8 }
  },
  'telephone': {
    id: 'telephone',
    name: 'Telephone',
    icon: '☎️',
    description: 'Bandlimited phone quality',
    color: 'yellow',
    settings: { bits: 8, sampleRate: 8000, wet: 1.0 }
  },
  'custom': {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    description: 'Manual control',
    color: 'gray',
    settings: { bits: 8, sampleRate: 22050, wet: 0.5 }
  }
};

const MODE_CATEGORIES = {
  'RETRO': {
    name: 'Retro',
    modes: ['4bit', '8bit', '12bit']
  },
  'CREATIVE': {
    name: 'Creative',
    modes: ['lo-fi', 'telephone']
  },
  'CUSTOM': {
    name: 'Custom',
    modes: ['custom']
  }
};

// Pixelated Waveform Visualizer
const PixelWaveformVisualizer = ({ bits, wet, inputLevel }) => {
  const timeRef = useRef(0);
  const waveDataRef = useRef([]);

  const drawPixelWaveform = useCallback((ctx, width, height) => {
    const time = timeRef.current;

    // Clear with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(20, 15, 10, 0.95)');
    gradient.addColorStop(1, 'rgba(10, 5, 5, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Grid lines (bit steps)
    const numSteps = Math.pow(2, Math.max(1, Math.min(bits, 16)));
    const stepHeight = height / numSteps;

    ctx.strokeStyle = 'rgba(255, 100, 50, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= numSteps; i++) {
      const y = i * stepHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Generate synthetic waveform with quantization
    const numSamples = 128;
    const waveColor = `rgba(255, ${100 + inputLevel * 100}, 50, ${0.6 + wet * 0.4})`;

    ctx.strokeStyle = waveColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = waveColor;
    ctx.shadowBlur = 10;

    ctx.beginPath();
    for (let i = 0; i < numSamples; i++) {
      const x = (i / numSamples) * width;

      // Synthetic audio signal (sine + harmonics)
      const t = (i / numSamples) * Math.PI * 4 + time * 0.001;
      let sample = Math.sin(t) * 0.8;
      sample += Math.sin(t * 2) * 0.2;
      sample += Math.sin(t * 3) * 0.1;

      // Apply bit crushing quantization
      const normalizedSample = (sample + 1) / 2; // 0 to 1
      const quantized = Math.floor(normalizedSample * numSteps);
      const quantizedSample = (quantized / numSteps) * 2 - 1; // Back to -1 to 1

      // Mix dry/wet
      const finalSample = sample * (1 - wet) + quantizedSample * wet;

      const y = height / 2 - (finalSample * height * 0.4);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw bit depth indicator
    ctx.fillStyle = 'rgba(255, 150, 100, 0.8)';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 100, 50, 0.5)';
    ctx.shadowBlur = 20;
    ctx.fillText(`${bits}-BIT`, width / 2, height / 2);
    ctx.shadowBlur = 0;

    // Pixelated effect overlay
    const pixelSize = Math.max(2, 18 - bits);
    for (let px = 0; px < width; px += pixelSize * 4) {
      for (let py = 0; py < height; py += pixelSize * 4) {
        const alpha = Math.random() * 0.1 * inputLevel;
        ctx.fillStyle = `rgba(255, 100, 50, ${alpha})`;
        ctx.fillRect(px, py, pixelSize, pixelSize);
      }
    }

    timeRef.current += 16;
  }, [bits, wet, inputLevel]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawPixelWaveform,
    [bits, wet, inputLevel]
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// Mode Selector Component
const CrusherModeSelector = ({ currentMode, onModeChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const categorized = Object.entries(MODE_CATEGORIES).reduce((acc, [categoryKey, category]) => {
    acc[categoryKey] = category.modes.map(modeId => CRUSHER_MODES[modeId]);
    return acc;
  }, {});

  const currentModeObj = CRUSHER_MODES[currentMode];

  return (
    <div className="flex flex-col gap-2">
      {/* Collapsed Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 px-3 py-2.5 bg-gradient-to-r from-orange-950/50 to-red-950/50 border border-orange-500/30 rounded-lg hover:border-orange-500/50 transition-all group"
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
export const ArcadeCrusherUI = ({ trackId, effect, onChange }) => {
  const { bits, sampleRate, wet } = effect.settings;
  const [currentMode, setCurrentMode] = useState('8bit');
  const [inputLevel, setInputLevel] = useState(0);

  // Audio plugin hook
  const { metrics } = useAudioPlugin(trackId, effect.id, {
    fftSize: 1024,
    updateMetrics: true
  });

  // Update input level from metrics
  useEffect(() => {
    if (metrics?.inputPeak !== undefined) {
      setInputLevel(Math.max(0, Math.min(1, (metrics.inputPeak + 60) / 60)));
    }
  }, [metrics]);

  // Ghost values
  const ghostBits = useGhostValue(bits, 400);
  const ghostSampleRate = useGhostValue(sampleRate, 400);
  const ghostWet = useGhostValue(wet, 400);

  // Handle mode change
  const handleModeChange = (modeId) => {
    setCurrentMode(modeId);
    const mode = CRUSHER_MODES[modeId];
    if (mode && modeId !== 'custom') {
      Object.entries(mode.settings).forEach(([key, value]) => {
        onChange(key, value);
      });
    }
  };

  const currentModeObj = CRUSHER_MODES[currentMode];

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-neutral-950 to-black p-3 flex gap-3">

      {/* LEFT: Mode Selector */}
      <div className="w-[220px] flex-shrink-0 flex flex-col gap-2">
        <CrusherModeSelector currentMode={currentMode} onModeChange={handleModeChange} />
      </div>

      {/* CENTER: Main Controls */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">

        {/* Header */}
        <div className="bg-gradient-to-r from-orange-950/40 via-red-950/40 to-orange-950/40 rounded-lg px-4 py-2.5 border border-orange-500/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{currentModeObj?.icon}</div>
            <div className="flex-1">
              <div className="text-sm font-black text-orange-400 tracking-wider uppercase">
                Arcade Crusher
              </div>
              <div className="text-[9px] text-orange-300/70">{currentModeObj?.name} • {currentModeObj?.description}</div>
            </div>
          </div>
        </div>

        {/* Visualization */}
        <div className="flex-1 bg-gradient-to-br from-orange-950/20 via-black to-red-950/20 rounded-xl border border-orange-500/20 overflow-hidden">
          <PixelWaveformVisualizer bits={bits} wet={wet} inputLevel={inputLevel} />
        </div>

        {/* Controls */}
        <div className="grid grid-cols-3 gap-4 bg-gradient-to-br from-black/40 to-black/20 rounded-lg p-4 border border-orange-500/10">
          <div className="flex justify-center">
            <Knob
              label="Bit Depth"
              value={bits}
              onChange={(val) => {
                onChange('bits', Math.round(val));
                setCurrentMode('custom');
              }}
              min={1}
              max={16}
              defaultValue={8}
              precision={0}
              size={90}
              category="texture-lab"
              ghostValue={ghostBits}
              showGhostValue={true}
            />
          </div>

          <div className="flex justify-center">
            <Knob
              label="Sample Rate"
              value={sampleRate}
              onChange={(val) => {
                onChange('sampleRate', Math.round(val));
                setCurrentMode('custom');
              }}
              min={2000}
              max={48000}
              defaultValue={22050}
              unit="Hz"
              precision={0}
              size={90}
              logarithmic
              category="texture-lab"
              ghostValue={ghostSampleRate}
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
        <div className="bg-gradient-to-br from-orange-950/20 to-red-950/20 rounded-lg p-3 border border-orange-500/20 flex flex-col gap-2">
          <div className="text-[9px] text-orange-300/70 font-bold uppercase tracking-wider">Stats</div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Bit Depth</span>
            <span className="text-orange-400 font-bold">{bits}-bit</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Sample Rate</span>
            <span className="text-orange-400 font-bold">{(sampleRate / 1000).toFixed(1)}kHz</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Mix</span>
            <span className="text-orange-400 font-bold">{(wet * 100).toFixed(0)}%</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Quantization</span>
            <span className="text-orange-400 font-bold">{Math.pow(2, bits)}</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Input</span>
            <span className="text-orange-400 font-bold">{(inputLevel * 100).toFixed(0)}%</span>
          </div>
        </div>

        <div className="flex-1 bg-gradient-to-br from-orange-950/10 to-red-950/10 rounded-lg p-3 border border-orange-500/10 flex flex-col justify-center items-center">
          <div className="text-[8px] text-orange-300/50 uppercase tracking-wider mb-2">The Texture Lab</div>
          <div className="text-4xl mb-2">🎮</div>
          <div className="text-[9px] text-center text-white/40 leading-tight">
            Retro bit-crushing degradation
          </div>
        </div>
      </div>
    </div>
  );
};
