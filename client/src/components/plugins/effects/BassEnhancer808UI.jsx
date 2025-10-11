/**
 * BassEnhancer808 v2.0 - "The Dynamics Forge"
 *
 * Professional 808-style bass enhancement with harmonic analysis
 *
 * Features:
 * - Mode-based bass processing (Sub Kick, 808 Classic, Distorted, etc.)
 * - Real-time 808 harmonic analyzer
 * - Multiband sub-bass enhancement
 * - Saturation and compression
 * - Dynamics Forge category theming (blue palette)
 * - Ghost value feedback
 * - 3-panel layout
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Knob } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

// 808 Bass Enhancement Modes
const BASS_MODES = {
  'sub-kick': {
    id: 'sub-kick',
    name: 'Sub Kick',
    icon: '🥁',
    description: 'Deep sub-bass boost',
    color: 'red',
    settings: { subBoost: 0.8, saturation: 0.2, punch: 0.5, wet: 1.0 }
  },
  '808-classic': {
    id: '808-classic',
    name: '808 Classic',
    icon: '🎛️',
    description: 'Authentic 808 character',
    color: 'orange',
    settings: { subBoost: 0.7, saturation: 0.4, punch: 0.6, wet: 0.8 }
  },
  'distorted': {
    id: 'distorted',
    name: 'Distorted',
    icon: '🔥',
    description: 'Heavy saturation punch',
    color: 'red',
    settings: { subBoost: 0.5, saturation: 0.8, punch: 0.7, wet: 0.9 }
  },
  'warm-sub': {
    id: 'warm-sub',
    name: 'Warm Sub',
    icon: '☀️',
    description: 'Smooth sub enhancement',
    color: 'amber',
    settings: { subBoost: 0.9, saturation: 0.3, punch: 0.3, wet: 0.7 }
  },
  'tight-punch': {
    id: 'tight-punch',
    name: 'Tight Punch',
    icon: '👊',
    description: 'Controlled low-end impact',
    color: 'blue',
    settings: { subBoost: 0.4, saturation: 0.5, punch: 0.9, wet: 0.8 }
  },
  'trap-808': {
    id: 'trap-808',
    name: 'Trap 808',
    icon: '💎',
    description: 'Modern trap bass',
    color: 'purple',
    settings: { subBoost: 0.85, saturation: 0.6, punch: 0.8, wet: 1.0 }
  },
  'custom': {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    description: 'Manual control',
    color: 'gray',
    settings: { subBoost: 0.5, saturation: 0.5, punch: 0.5, wet: 0.5 }
  }
};

const MODE_CATEGORIES = {
  'DRUMS': {
    name: 'Drums',
    modes: ['sub-kick', '808-classic', 'tight-punch']
  },
  'CREATIVE': {
    name: 'Creative',
    modes: ['distorted', 'warm-sub', 'trap-808']
  },
  'CUSTOM': {
    name: 'Custom',
    modes: ['custom']
  }
};

// 808 Harmonic Analyzer Visualizer
const HarmonicAnalyzer808 = ({ subBoost, saturation, punch, inputLevel }) => {
  const timeRef = useRef(0);

  const drawHarmonics = useCallback((ctx, width, height) => {
    const time = timeRef.current;

    // Clear with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(10, 15, 25, 0.95)');
    gradient.addColorStop(1, 'rgba(5, 10, 20, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 808 Fundamental frequencies
    const fundamentals = [60, 80, 120]; // Typical 808 frequencies (Hz)
    const harmonics = [];

    // Generate harmonics for each fundamental
    fundamentals.forEach(freq => {
      for (let h = 1; h <= 8; h++) {
        let amplitude = 1 / Math.pow(h, 1.5); // Natural harmonic rolloff

        // Apply processing
        if (h === 1) amplitude *= (1 + subBoost * 0.8); // Sub boost
        if (h <= 3) amplitude *= (1 + saturation * 0.6); // Low harmonics
        if (h >= 2) amplitude *= (1 + saturation * h * 0.1); // Upper harmonics
        amplitude *= (1 + punch * 0.3); // Punch enhancement

        harmonics.push({
          freq: freq * h,
          amplitude: amplitude * inputLevel,
          source: freq,
          harmonic: h
        });
      }
    });

    // Draw frequency grid
    const maxFreq = 2000;
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.1)';
    ctx.lineWidth = 1;
    [100, 200, 500, 1000].forEach(freq => {
      const x = (freq / maxFreq) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });

    // Draw harmonics
    harmonics.forEach(harmonic => {
      if (harmonic.freq > maxFreq) return;

      const x = (harmonic.freq / maxFreq) * width;
      const barHeight = harmonic.amplitude * height * 0.7;
      const y = height - barHeight;

      // Color coding based on frequency range
      let hue = 0;
      let saturationColor = 70;
      let lightness = 50;

      if (harmonic.freq < 100) {
        hue = 0; // Red (sub)
        saturationColor = 80 + subBoost * 20;
        lightness = 50 + subBoost * 20;
      } else if (harmonic.freq < 300) {
        hue = 30; // Orange (mid-bass)
        saturationColor = 70 + punch * 20;
        lightness = 50 + punch * 15;
      } else {
        hue = 60; // Yellow (upper harmonics)
        saturationColor = 60 + saturation * 30;
        lightness = 50 + saturation * 20;
      }

      // Draw harmonic bar
      ctx.fillStyle = `hsl(${hue}, ${saturationColor}%, ${lightness}%)`;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = harmonic.amplitude * 15;
      ctx.fillRect(x - 3, y, 6, barHeight);
      ctx.shadowBlur = 0;

      // Draw harmonic number label for fundamentals
      if (harmonic.harmonic === 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(harmonic.freq)}Hz`, x, height - 5);
      }
    });

    // Draw 808 character indicator
    ctx.fillStyle = `rgba(255, 100, 100, ${0.6 + saturation * 0.4})`;
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 100, 100, 0.5)';
    ctx.shadowBlur = 20;
    ctx.fillText('808', width / 2, height / 3);
    ctx.shadowBlur = 0;

    // Sub boost indicator
    const subIndicatorHeight = subBoost * height * 0.15;
    ctx.fillStyle = `rgba(255, 50, 50, ${0.3 + subBoost * 0.4})`;
    ctx.fillRect(0, height - subIndicatorHeight, width, subIndicatorHeight);

    // Animated pulse based on input level
    const pulseRadius = 20 + inputLevel * 30;
    const pulseAlpha = 0.2 * inputLevel;
    ctx.fillStyle = `rgba(255, 100, 100, ${pulseAlpha})`;
    ctx.beginPath();
    ctx.arc(width / 2, height / 3, pulseRadius, 0, Math.PI * 2);
    ctx.fill();

    timeRef.current += 16;
  }, [subBoost, saturation, punch, inputLevel]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawHarmonics,
    [subBoost, saturation, punch, inputLevel]
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// Mode Selector Component
const BassModeSelector = ({ currentMode, onModeChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const categorized = Object.entries(MODE_CATEGORIES).reduce((acc, [categoryKey, category]) => {
    acc[categoryKey] = category.modes.map(modeId => BASS_MODES[modeId]);
    return acc;
  }, {});

  const currentModeObj = BASS_MODES[currentMode];

  return (
    <div className="flex flex-col gap-2">
      {/* Collapsed Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 px-3 py-2.5 bg-gradient-to-r from-blue-950/50 to-indigo-950/50 border border-blue-500/30 rounded-lg hover:border-blue-500/50 transition-all group"
      >
        <div className="text-2xl">{currentModeObj?.icon}</div>
        <div className="flex-1 text-left">
          <div className="text-[10px] text-blue-300/70 uppercase tracking-wider">Mode</div>
          <div className="text-xs font-bold text-white">{currentModeObj?.name}</div>
        </div>
        <div className={`text-xs text-blue-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
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
                          ? 'bg-blue-500/20 border-blue-500/60 shadow-lg shadow-blue-500/20'
                          : 'bg-black/20 border-white/10 hover:border-blue-500/30 hover:bg-blue-500/10'
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
export const BassEnhancer808UI = ({ trackId, effect, onChange }) => {
  const { subBoost, saturation, punch, wet } = effect.settings;
  const [currentMode, setCurrentMode] = useState('808-classic');
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
  const ghostSubBoost = useGhostValue(subBoost, 400);
  const ghostSaturation = useGhostValue(saturation, 400);
  const ghostPunch = useGhostValue(punch, 400);
  const ghostWet = useGhostValue(wet, 400);

  // Handle mode change
  const handleModeChange = (modeId) => {
    setCurrentMode(modeId);
    const mode = BASS_MODES[modeId];
    if (mode && modeId !== 'custom') {
      Object.entries(mode.settings).forEach(([key, value]) => {
        onChange(key, value);
      });
    }
  };

  const currentModeObj = BASS_MODES[currentMode];

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-neutral-950 to-black p-3 flex gap-3">

      {/* LEFT: Mode Selector */}
      <div className="w-[220px] flex-shrink-0 flex flex-col gap-2">
        <BassModeSelector currentMode={currentMode} onModeChange={handleModeChange} />
      </div>

      {/* CENTER: Main Controls */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-blue-950/40 rounded-lg px-4 py-2.5 border border-blue-500/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{currentModeObj?.icon}</div>
            <div className="flex-1">
              <div className="text-sm font-black text-blue-400 tracking-wider uppercase">
                808 Bass Enhancer
              </div>
              <div className="text-[9px] text-blue-300/70">{currentModeObj?.name} • {currentModeObj?.description}</div>
            </div>
          </div>
        </div>

        {/* Visualization */}
        <div className="flex-1 bg-gradient-to-br from-blue-950/20 via-black to-indigo-950/20 rounded-xl border border-blue-500/20 overflow-hidden">
          <HarmonicAnalyzer808
            subBoost={subBoost}
            saturation={saturation}
            punch={punch}
            inputLevel={inputLevel}
          />
        </div>

        {/* Controls */}
        <div className="grid grid-cols-4 gap-4 bg-gradient-to-br from-black/40 to-black/20 rounded-lg p-4 border border-blue-500/10">
          <div className="flex justify-center">
            <Knob
              label="Sub Boost"
              value={subBoost}
              onChange={(val) => {
                onChange('subBoost', val);
                setCurrentMode('custom');
              }}
              min={0}
              max={1}
              defaultValue={0.5}
              precision={2}
              size={85}
              category="dynamics-forge"
              ghostValue={ghostSubBoost}
              showGhostValue={true}
            />
          </div>

          <div className="flex justify-center">
            <Knob
              label="Saturation"
              value={saturation}
              onChange={(val) => {
                onChange('saturation', val);
                setCurrentMode('custom');
              }}
              min={0}
              max={1}
              defaultValue={0.5}
              precision={2}
              size={85}
              category="dynamics-forge"
              ghostValue={ghostSaturation}
              showGhostValue={true}
            />
          </div>

          <div className="flex justify-center">
            <Knob
              label="Punch"
              value={punch}
              onChange={(val) => {
                onChange('punch', val);
                setCurrentMode('custom');
              }}
              min={0}
              max={1}
              defaultValue={0.5}
              precision={2}
              size={85}
              category="dynamics-forge"
              ghostValue={ghostPunch}
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
              size={85}
              category="dynamics-forge"
              ghostValue={ghostWet * 100}
              showGhostValue={true}
            />
          </div>
        </div>
      </div>

      {/* RIGHT: Stats */}
      <div className="w-[160px] flex-shrink-0 flex flex-col gap-3">
        <div className="bg-gradient-to-br from-blue-950/20 to-indigo-950/20 rounded-lg p-3 border border-blue-500/20 flex flex-col gap-2">
          <div className="text-[9px] text-blue-300/70 font-bold uppercase tracking-wider">Stats</div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Sub Boost</span>
            <span className="text-blue-400 font-bold">{(subBoost * 100).toFixed(0)}%</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Saturation</span>
            <span className="text-blue-400 font-bold">{(saturation * 100).toFixed(0)}%</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Punch</span>
            <span className="text-blue-400 font-bold">{(punch * 100).toFixed(0)}%</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Mix</span>
            <span className="text-blue-400 font-bold">{(wet * 100).toFixed(0)}%</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Input</span>
            <span className="text-blue-400 font-bold">{(inputLevel * 100).toFixed(0)}%</span>
          </div>
        </div>

        <div className="flex-1 bg-gradient-to-br from-blue-950/10 to-indigo-950/10 rounded-lg p-3 border border-blue-500/10 flex flex-col justify-center items-center">
          <div className="text-[8px] text-blue-300/50 uppercase tracking-wider mb-2">The Dynamics Forge</div>
          <div className="text-4xl mb-2">🥁</div>
          <div className="text-[9px] text-center text-white/40 leading-tight">
            808 bass enhancement
          </div>
        </div>
      </div>
    </div>
  );
};
