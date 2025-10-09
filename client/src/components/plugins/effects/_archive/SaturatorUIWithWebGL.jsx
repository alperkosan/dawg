import React, { useState, useEffect } from 'react';
import { MeteringService } from '@/lib/core/MeteringService';
import { ProfessionalKnob } from '../container/PluginControls';
import { SaturatorVisualizer } from '@/components/plugins/visualizers/SaturatorVisualizer';

/**
 * SATURATOR UI WITH WEBGL VISUALIZATION
 *
 * Simple example showing how to integrate WebGL visualizers
 */

// Drive Meter Component
const DriveMeter = ({ distortion }) => {
  const percentage = Math.min(100, (distortion / 1.5) * 100);
  const segments = 12;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-xs font-bold text-amber-300">DRIVE</div>
      <div className="flex flex-col-reverse gap-1 h-32 w-6 bg-black/50 rounded p-1 border border-amber-600/30">
        {Array.from({ length: segments }).map((_, i) => {
          const segmentValue = ((segments - 1 - i) / (segments - 1)) * 100;
          const isActive = percentage >= segmentValue;
          let color = '#22c55e';
          if (segmentValue > 60) color = '#f59e0b';
          if (segmentValue > 80) color = '#ef4444';
          return (
            <div
              key={i}
              className="h-2 w-full rounded-sm transition-all duration-100"
              style={{
                backgroundColor: isActive ? color : 'rgba(255,255,255,0.1)',
                boxShadow: isActive ? `0 0 8px ${color}` : 'none'
              }}
            />
          );
        })}
      </div>
      <div className="text-[10px] text-amber-300 font-mono">
        {percentage.toFixed(0)}%
      </div>
    </div>
  );
};

// Main UI Component
export const SaturatorUIWithWebGL = ({ trackId, effect, effectNode, onChange }) => {
  const { distortion, wet } = effect.settings;
  const [inputLevel, setInputLevel] = useState(-60);

  useEffect(() => {
    const meterId = `${trackId}-input`;
    const handleLevel = (data) => setInputLevel(data.peak || -60);
    const unsubscribe = MeteringService.subscribe(meterId, handleLevel);
    return unsubscribe;
  }, [trackId]);

  return (
    <div className="w-full h-full bg-gradient-to-br from-amber-950 via-orange-950 to-red-950 p-4 flex flex-col gap-4">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-amber-300">
          🔥 SATURATOR
        </h2>
        <div className="text-xs text-amber-300/60">
          WebGL Powered
        </div>
      </div>

      {/* WEBGL VISUALIZATION AREA */}
      <div className="flex-grow min-h-0 bg-black/30 rounded-xl border border-amber-600/20 overflow-hidden">
        <SaturatorVisualizer
          effectNode={effectNode}
          distortion={distortion}
          wet={wet}
        />
      </div>

      {/* CONTROLS */}
      <div className="grid grid-cols-[1fr_2fr] gap-4">
        {/* Left: Drive Meter */}
        <div className="flex justify-center items-center bg-black/20 p-3 rounded-lg border border-white/10">
          <DriveMeter distortion={distortion} />
        </div>

        {/* Right: Knobs */}
        <div className="grid grid-cols-2 gap-4 bg-black/20 p-3 rounded-lg border border-white/10">
          <ProfessionalKnob
            label="Drive"
            value={distortion}
            onChange={(val) => onChange('distortion', val)}
            min={0}
            max={1.5}
            defaultValue={0.4}
            precision={2}
            size={80}
          />
          <ProfessionalKnob
            label="Mix"
            value={wet * 100}
            onChange={(val) => onChange('wet', val / 100)}
            min={0}
            max={100}
            defaultValue={100}
            unit="%"
            precision={0}
            size={80}
          />
        </div>
      </div>
    </div>
  );
};
