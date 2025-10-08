import React, { useState, useEffect, useRef } from 'react';
import { MeteringService } from '@/lib/core/MeteringService';
import { PluginVisualizerAPI } from '@/lib/visualization/PluginVisualizerAPI';
import { TubeGlowVisualizer, HarmonicVisualizer } from '@/lib/visualization/plugin-visualizers';
import { ProfessionalKnob } from '../container/PluginControls';

/**
 * SATURATOR UI V2 - VisualizationEngine Integration
 *
 * Modern saturator with centralized visualization system.
 * Uses PluginVisualizerAPI for performance-optimized rendering.
 */

// Drive Meter (unchanged)
const DriveMeter = ({ distortion }) => {
  const normalizedDrive = Math.min(distortion / 1.5, 1);
  const colorStops = [
    { pos: 0, color: '#10b981' },
    { pos: 0.6, color: '#f59e0b' },
    { pos: 0.85, color: '#ef4444' }
  ];

  const getColor = (value) => {
    if (value < 0.6) return colorStops[0].color;
    if (value < 0.85) return colorStops[1].color;
    return colorStops[2].color;
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div className="text-[10px] text-white/40 mb-2">DRIVE</div>
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 100 100" className="transform -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={getColor(normalizedDrive)}
            strokeWidth="8"
            strokeDasharray={`${normalizedDrive * 251.2} 251.2`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-white">{Math.round(normalizedDrive * 100)}</span>
        </div>
      </div>
    </div>
  );
};

// Saturation Type Selector (unchanged)
const SaturationType = ({ currentType, onTypeChange }) => {
  const types = [
    { id: 'tube', name: 'Tube', color: 'amber' },
    { id: 'tape', name: 'Tape', color: 'orange' },
    { id: 'transistor', name: 'Transistor', color: 'red' }
  ];

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="text-[10px] text-amber-300/60">TYPE</div>
      <div className="flex flex-col gap-1 flex-grow">
        {types.map((type) => (
          <button
            key={type.id}
            onClick={() => onTypeChange(type.id)}
            className={`p-2 text-[10px] rounded border transition-all h-12 ${
              currentType === type.id ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-white/20 text-white/60 hover:border-white/40'
            }`}
          >
            {type.name}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * VisualizationEngine-based Visualizer Wrapper
 */
const PluginCanvas = ({ pluginId, visualizerClass, params, priority = 'normal' }) => {
  const canvasRef = useRef(null);
  const visualizerRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Register visualizer with VisualizationEngine
    visualizerRef.current = PluginVisualizerAPI.register(pluginId, {
      canvas: canvasRef.current,
      visualizer: visualizerClass,
      priority,
      params
    });

    return () => {
      // Unregister on unmount
      PluginVisualizerAPI.unregister(pluginId);
    };
  }, [pluginId, visualizerClass, priority]);

  // Update parameters
  useEffect(() => {
    if (visualizerRef.current) {
      PluginVisualizerAPI.updateParams(pluginId, params);
    }
  }, [pluginId, params]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
};

// === MAIN SATURATOR UI V2 ===
export const SaturatorUI = ({ trackId, effect, onChange }) => {
  const { distortion, wet } = effect.settings;
  const [inputLevel, setInputLevel] = useState(-60);
  const [saturationType, setSaturationType] = useState('tube');

  // Subscribe to input level metering
  useEffect(() => {
    const meterId = `${trackId}-input`;
    const handleLevel = (data) => setInputLevel(data.peak || -60);
    const unsubscribe = MeteringService.subscribe(meterId, handleLevel);
    return unsubscribe;
  }, [trackId]);

  // Plugin ID for visualizers
  const pluginId = effect.id || `saturator-${trackId}`;

  return (
    <div className="w-full h-full bg-gradient-to-br from-amber-950 via-orange-950 to-red-950 p-4 grid grid-cols-[2fr_1fr] gap-4">

      {/* LEFT COLUMN: MAIN VISUALIZATION */}
      <div className="flex flex-col gap-4 h-full">
        {/* Tube Glow Visualizer (VisualizationEngine) */}
        <div className="bg-black/30 rounded-xl p-2 border border-amber-600/20 flex-grow min-h-0">
          <PluginCanvas
            pluginId={`${pluginId}-tube-glow`}
            visualizerClass={TubeGlowVisualizer}
            priority="normal"
            params={{
              drive: distortion * 100,
              mix: wet,
              tone: 0.5,
              inputLevel
            }}
          />
        </div>
      </div>

      {/* RIGHT COLUMN: CONTROLS */}
      <div className="flex flex-col gap-4">
        {/* Main Knobs */}
        <div className="grid grid-cols-2 gap-2 bg-black/20 p-3 rounded-lg border border-white/10">
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

        {/* Meter and Type Selector */}
        <div className="grid grid-cols-2 gap-4 flex-grow">
          <div className="flex justify-center items-center bg-black/20 p-3 rounded-lg border border-white/10">
            <DriveMeter distortion={distortion} />
          </div>
          <div className="bg-black/20 p-3 rounded-lg border border-white/10">
            <SaturationType
              currentType={saturationType}
              onTypeChange={setSaturationType}
            />
          </div>
        </div>

        {/* Harmonic Analyzer (VisualizationEngine) */}
        <div className="bg-black/20 rounded-lg p-3 border border-white/10">
          <div className="text-xs text-amber-300 mb-1">HARMONIC CONTENT</div>
          <div className="h-24">
            <PluginCanvas
              pluginId={`${pluginId}-harmonic`}
              visualizerClass={HarmonicVisualizer}
              priority="low"
              params={{
                drive: distortion * 100,
                type: saturationType
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Default export
export default SaturatorUI;
