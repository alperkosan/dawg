/**
 * BassEnhancer808 V3.0 - "The Dynamics Forge"
 *
 * Professional 808-style bass enhancement with TASTE & TEXTURE controls
 *
 * Features:
 * - TASTE: Reverb, delay, chorus, modulation (tad verici efektler)
 * - TEXTURE: Saturation, harmonics, drive, warmth (dokusal özellikler)
 * - Mode-based bass processing
 * - Real-time harmonic analyzer
 * - Professional bass sculpting
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Knob, ModeSelector } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

// 808 Bass Enhancement Modes
const BASS_MODES = {
  'sub-kick': {
    id: 'sub-kick',
    name: 'Sub Kick',
    icon: '🥁',
    description: 'Deep sub-bass boost',
    color: 'red',
    settings: { 
      subBoost: 0.8, 
      saturation: 0.2, 
      punch: 0.5, 
      wet: 1.0,
      taste: 0.1,
      texture: 0.3
    }
  },
  '808-classic': {
    id: '808-classic',
    name: '808 Classic',
    icon: '🎛️',
    description: 'Authentic 808 character',
    color: 'orange',
    settings: { 
      subBoost: 0.7, 
      saturation: 0.4, 
      punch: 0.6, 
      wet: 0.8,
      taste: 0.2,
      texture: 0.5
    }
  },
  'distorted': {
    id: 'distorted',
    name: 'Distorted',
    icon: '🔥',
    description: 'Heavy saturation punch',
    color: 'red',
    settings: { 
      subBoost: 0.5, 
      saturation: 0.8, 
      punch: 0.7, 
      wet: 0.9,
      taste: 0.3,
      texture: 0.9
    }
  },
  'warm-sub': {
    id: 'warm-sub',
    name: 'Warm Sub',
    icon: '☀️',
    description: 'Smooth sub enhancement',
    color: 'amber',
    settings: { 
      subBoost: 0.9, 
      saturation: 0.3, 
      punch: 0.3, 
      wet: 0.7,
      taste: 0.4,
      texture: 0.6
    }
  },
  'tight-punch': {
    id: 'tight-punch',
    name: 'Tight Punch',
    icon: '👊',
    description: 'Controlled low-end impact',
    color: 'blue',
    settings: { 
      subBoost: 0.4, 
      saturation: 0.5, 
      punch: 0.9, 
      wet: 0.8,
      taste: 0.1,
      texture: 0.7
    }
  },
  'trap-808': {
    id: 'trap-808',
    name: 'Trap 808',
    icon: '💎',
    description: 'Modern trap bass',
    color: 'purple',
    settings: { 
      subBoost: 0.85, 
      saturation: 0.6, 
      punch: 0.8, 
      wet: 1.0,
      taste: 0.5,
      texture: 0.8
    }
  },
  'custom': {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    description: 'Manual control',
    color: 'gray',
    settings: { 
      subBoost: 0.5, 
      saturation: 0.5, 
      punch: 0.5, 
      wet: 0.5,
      taste: 0.5,
      texture: 0.5
    }
  }
};

// Optimized Harmonic Analyzer - Reduced computation
const HarmonicAnalyzer808 = React.memo(({ subBoost, saturation, punch, taste, texture, inputLevel }) => {
  const timeRef = useRef(0);
  const harmonicsCacheRef = useRef([]);
  const lastParamsRef = useRef({});

  const drawHarmonics = useCallback((ctx, width, height) => {
    const time = timeRef.current;
    
    // Only recalculate harmonics if params changed significantly
    const paramsChanged = 
      Math.abs(lastParamsRef.current.subBoost - subBoost) > 0.05 ||
      Math.abs(lastParamsRef.current.saturation - saturation) > 0.05 ||
      Math.abs(lastParamsRef.current.texture - texture) > 0.05;

    // Clear with gradient
    ctx.fillStyle = 'rgba(10, 15, 25, 0.95)';
    ctx.fillRect(0, 0, width, height);

    if (paramsChanged || harmonicsCacheRef.current.length === 0) {
      const fundamentals = [60, 80, 120];
      harmonicsCacheRef.current = [];

      fundamentals.forEach(freq => {
        for (let h = 1; h <= 8; h++) {
          let amplitude = 1 / Math.pow(h, 1.5);

          if (h === 1) amplitude *= (1 + subBoost * 0.8);
          if (h <= 3) amplitude *= (1 + saturation * 0.6);
          if (h >= 2) amplitude *= (1 + texture * h * 0.15); // Texture affects harmonics
          amplitude *= (1 + punch * 0.3);
          amplitude *= (1 + taste * 0.2); // Taste adds subtle modulation

          harmonicsCacheRef.current.push({
            freq: freq * h,
            amplitude: amplitude * inputLevel,
            harmonic: h
          });
        }
      });

      lastParamsRef.current = { subBoost, saturation, texture };
    }

    // Draw frequency grid (only once)
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

    // Draw cached harmonics
    harmonicsCacheRef.current.forEach(harmonic => {
      if (harmonic.freq > maxFreq) return;

      const x = (harmonic.freq / maxFreq) * width;
      const barHeight = harmonic.amplitude * height * 0.7;
      const y = height - barHeight;

      // Color coding with taste/texture influence
      let hue = 0;
      let saturationColor = 70;
      let lightness = 50;

      if (harmonic.freq < 100) {
        hue = 0;
        saturationColor = 80 + subBoost * 20;
        lightness = 50 + subBoost * 20;
      } else if (harmonic.freq < 300) {
        hue = 30;
        saturationColor = 70 + punch * 20;
        lightness = 50 + punch * 15;
      } else {
        hue = 60;
        saturationColor = 60 + texture * 30; // Texture affects upper harmonics color
        lightness = 50 + texture * 20;
      }

      // Taste adds shimmer/glow effect
      const glowAlpha = taste * 0.3;
      
      ctx.fillStyle = `hsl(${hue}, ${saturationColor}%, ${lightness}%)`;
      ctx.shadowColor = taste > 0.3 ? `hsl(${hue}, ${saturationColor}%, ${lightness}%)` : 'transparent';
      ctx.shadowBlur = harmonic.amplitude * 15 * (1 + taste * 0.5);
      ctx.fillRect(x - 3, y, 6, barHeight);
      ctx.shadowBlur = 0;

      if (harmonic.harmonic === 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(harmonic.freq)}Hz`, x, height - 5);
      }
    });

    // Draw 808 character indicator with texture influence
    const indicatorAlpha = 0.6 + saturation * 0.4;
    ctx.fillStyle = `rgba(255, 100, 100, ${indicatorAlpha})`;
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = taste > 0.3 ? 'rgba(255, 100, 100, 0.5)' : 'transparent';
    ctx.shadowBlur = 20 * (1 + taste * 0.5);
    ctx.fillText('808', width / 2, height / 3);
    ctx.shadowBlur = 0;

    // Sub boost indicator
    const subIndicatorHeight = subBoost * height * 0.15;
    ctx.fillStyle = `rgba(255, 50, 50, ${0.3 + subBoost * 0.4})`;
    ctx.fillRect(0, height - subIndicatorHeight, width, subIndicatorHeight);

    // Animated pulse with taste influence
    const pulseRadius = 20 + inputLevel * 30;
    const pulseAlpha = (0.2 * inputLevel) * (1 + taste * 0.3);
    ctx.fillStyle = `rgba(255, 100, 100, ${pulseAlpha})`;
    ctx.beginPath();
    ctx.arc(width / 2, height / 3, pulseRadius, 0, Math.PI * 2);
    ctx.fill();

    timeRef.current += 16;
  }, [subBoost, saturation, punch, taste, texture, inputLevel]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawHarmonics,
    [subBoost, saturation, punch, taste, texture, inputLevel],
    { throttleMs: 33 } // ~30fps for better performance
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
});

HarmonicAnalyzer808.displayName = 'HarmonicAnalyzer808';

// Main Component
export const BassEnhancer808UI = ({ trackId, effect, onChange }) => {
  const { 
    subBoost = 0.5, 
    saturation = 0.5, 
    punch = 0.5, 
    wet = 1.0,
    taste = 0.5,
    texture = 0.5
  } = effect.settings || {};
  
  const [currentMode, setCurrentMode] = useState('808-classic');
  const [inputLevel, setInputLevel] = useState(0);

  // Audio plugin hook
  const { metrics } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: true,
    rmsSmoothing: 0.3,
    peakSmoothing: 0.2
  });

  // Update input level from metrics (throttled)
  useEffect(() => {
    if (metrics?.inputPeak !== undefined) {
      setInputLevel(prev => {
        const newLevel = Math.max(0, Math.min(1, (metrics.inputPeak + 60) / 60));
        // Smooth transition
        return prev * 0.9 + newLevel * 0.1;
      });
    }
  }, [metrics]);

  // Ghost values
  const ghostSubBoost = useGhostValue(subBoost, 400);
  const ghostSaturation = useGhostValue(saturation, 400);
  const ghostPunch = useGhostValue(punch, 400);
  const ghostTaste = useGhostValue(taste, 400);
  const ghostTexture = useGhostValue(texture, 400);
  const ghostWet = useGhostValue(wet, 400);

  // Handle mode change
  const handleModeChange = useCallback((modeId) => {
    setCurrentMode(modeId);
    const mode = BASS_MODES[modeId];
    if (mode && modeId !== 'custom') {
      Object.entries(mode.settings).forEach(([key, value]) => {
        onChange(key, value);
      });
    }
  }, [onChange]);

  const currentModeObj = BASS_MODES[currentMode];

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-neutral-950 to-black p-3 flex gap-3">
      {/* LEFT: Mode Selector */}
      <div className="w-[220px] flex-shrink-0 flex flex-col gap-4">
        {/* Plugin Header */}
        <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 rounded-xl px-4 py-3 border border-blue-500/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🥁</div>
            <div className="flex-1">
              <div className="text-[9px] text-indigo-400/70 font-semibold uppercase tracking-wider">The Dynamics Forge</div>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <ModeSelector
          modes={Object.values(BASS_MODES).map(mode => ({
            id: mode.id,
            label: mode.name,
            icon: mode.icon,
            description: mode.description
          }))}
          activeMode={currentMode}
          onChange={handleModeChange}
          orientation="vertical"
          category="dynamics-forge"
          className="flex-1"
        />

        {/* Mode Description */}
        <div className="bg-gradient-to-br from-blue-900/20 to-black/50 rounded-xl p-4 border border-blue-500/10">
          <div className="text-[9px] text-blue-300/70 font-bold uppercase tracking-wider mb-2">
            Mode Info
          </div>
          <div className="text-[10px] text-white/70 leading-relaxed">
            {BASS_MODES[currentMode].description}
          </div>
        </div>
      </div>

      {/* CENTER: Main Controls */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-blue-950/40 rounded-lg px-4 py-2.5 border border-blue-500/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{currentModeObj?.icon}</div>
            <div className="flex-1">
              <div className="text-sm font-black text-blue-400 tracking-wider uppercase">
                {currentModeObj?.name}
              </div>
              <div className="text-[9px] text-blue-300/70">{currentModeObj?.description}</div>
            </div>
          </div>
        </div>

        {/* Visualization */}
        <div className="flex-1 bg-gradient-to-br from-blue-950/20 via-black to-indigo-950/20 rounded-xl border border-blue-500/20 overflow-hidden">
          <HarmonicAnalyzer808
            subBoost={subBoost}
            saturation={saturation}
            punch={punch}
            taste={taste}
            texture={texture}
            inputLevel={inputLevel}
          />
        </div>

        {/* Main Controls: TASTE & TEXTURE */}
        <div className="bg-gradient-to-br from-black/40 to-black/20 rounded-lg p-4 border border-blue-500/10">
          <div className="grid grid-cols-2 gap-6 mb-4">
            {/* TASTE Control */}
            <div className="flex flex-col items-center">
              <div className="text-[9px] text-blue-300/70 font-bold uppercase tracking-wider mb-2">
                TASTE
              </div>
              <div className="text-[8px] text-white/50 text-center mb-3">
                Reverb • Delay • Chorus • Modulation
              </div>
              <Knob
                label=""
                value={taste * 100}
                onChange={(val) => {
                  onChange('taste', val / 100);
                  setCurrentMode('custom');
                }}
                min={0}
                max={100}
                defaultValue={50}
                unit="%"
                precision={0}
                size={100}
                category="dynamics-forge"
                ghostValue={ghostTaste * 100}
                showGhostValue={true}
              />
            </div>

            {/* TEXTURE Control */}
            <div className="flex flex-col items-center">
              <div className="text-[9px] text-blue-300/70 font-bold uppercase tracking-wider mb-2">
                TEXTURE
              </div>
              <div className="text-[8px] text-white/50 text-center mb-3">
                Saturation • Harmonics • Drive • Warmth
              </div>
              <Knob
                label=""
                value={texture * 100}
                onChange={(val) => {
                  onChange('texture', val / 100);
                  setCurrentMode('custom');
                }}
                min={0}
                max={100}
                defaultValue={50}
                unit="%"
                precision={0}
                size={100}
                category="dynamics-forge"
                ghostValue={ghostTexture * 100}
                showGhostValue={true}
              />
            </div>
          </div>

          {/* Secondary Controls */}
          <div className="grid grid-cols-4 gap-4">
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
                size={75}
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
                size={75}
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
                size={75}
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
                size={75}
                category="dynamics-forge"
                ghostValue={ghostWet * 100}
                showGhostValue={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Stats */}
      <div className="w-[160px] flex-shrink-0 flex flex-col gap-3">
        <div className="bg-gradient-to-br from-blue-950/20 to-indigo-950/20 rounded-lg p-3 border border-blue-500/20 flex flex-col gap-2">
          <div className="text-[9px] text-blue-300/70 font-bold uppercase tracking-wider">Stats</div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Taste</span>
            <span className="text-blue-400 font-bold">{(taste * 100).toFixed(0)}%</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span className="text-white/40">Texture</span>
            <span className="text-blue-400 font-bold">{(texture * 100).toFixed(0)}%</span>
          </div>

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
        </div>
      </div>
    </div>
  );
};
