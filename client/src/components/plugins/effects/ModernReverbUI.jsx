import React, { useState, useEffect, useRef } from 'react';
import { ProfessionalKnob } from '../container/PluginControls';
import { SignalVisualizer } from '../../common/SignalVisualizer';

/**
 * MODERN REVERB UI - ZENITH COMPACT DESIGN
 *
 * Kompakt, anlamlı görselleştirmelerle profesyonel reverb kontrolü
 * - Real-time decay envelope
 * - Early/Late reflection visualization
 * - Frequency damping curve
 * - Stereo field display
 */

// Compact Decay Envelope Visualizer
const DecayEnvelopeVisualizer = ({ decay, damping, earlyLateMix, size }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let pulseTime = 0;

    const animate = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0) {
        animationId = requestAnimationFrame(animate);
        return;
      }

      canvas.width = width;
      canvas.height = height;

      // Dark gradient background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, 'rgba(10, 15, 30, 0.95)');
      bgGradient.addColorStop(1, 'rgba(5, 8, 18, 0.95)');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Decay envelope curve
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(100, 200, 255, 0.9)');
      gradient.addColorStop(1, 'rgba(100, 200, 255, 0.1)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, height);

      for (let x = 0; x <= width; x++) {
        const t = x / width;
        const decayFactor = Math.exp(-t * (8 / decay));
        const dampFactor = Math.exp(-t * damping * 4);
        const amplitude = decayFactor * dampFactor;
        const y = height - amplitude * height * 0.85;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // Early reflections markers
      const earlyTimes = [0.017, 0.023, 0.031, 0.043, 0.047, 0.059, 0.067, 0.073];
      const maxTime = Math.max(decay, 1);

      earlyTimes.forEach((time, i) => {
        const x = (time / maxTime) * width;
        const opacity = earlyLateMix * 0.7;

        ctx.strokeStyle = `rgba(255, 200, 100, ${opacity})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, height * 0.2);
        ctx.lineTo(x, height * 0.4);
        ctx.stroke();
      });

      // RT60 indicator
      const rt60Time = decay * 0.16; // Approximate RT60
      const rt60X = (rt60Time / maxTime) * width;
      if (rt60X < width) {
        ctx.strokeStyle = 'rgba(150, 255, 150, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(rt60X, 0);
        ctx.lineTo(rt60X, height);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(150, 255, 150, 0.8)';
        ctx.font = '10px monospace';
        ctx.fillText(`RT60: ${rt60Time.toFixed(2)}s`, rt60X + 3, 12);
      }

      // Pulse animation for room size
      pulseTime += 0.05;
      const pulse = Math.sin(pulseTime) * 0.5 + 0.5;
      const roomRadius = size * 15 + pulse * 3;

      ctx.strokeStyle = `rgba(100, 150, 255, ${0.3 + pulse * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(width - 30, 25, roomRadius, 0, Math.PI * 2);
      ctx.stroke();

      animationId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationId);
  }, [decay, damping, earlyLateMix, size]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// Compact Frequency Damping Visualizer
const DampingCurveVisualizer = ({ damping }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = 'rgba(10, 15, 30, 0.5)';
    ctx.fillRect(0, 0, width, height);

    // Damping frequency
    const dampFreq = 2000 + (1 - damping) * 18000;

    // Frequency response curve
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, 'rgba(255, 150, 100, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 150, 100, 0.7)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, height);

    for (let x = 0; x <= width; x++) {
      const freq = 20 * Math.pow(20000 / 20, x / width);
      let response = 1;
      if (freq > dampFreq) {
        const ratio = freq / dampFreq;
        response = 1 / (1 + ratio * ratio);
      }
      const y = height - response * height * 0.8;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Frequency markers
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '9px monospace';
    [100, 1000, 10000].forEach(freq => {
      const x = width * Math.log(freq / 20) / Math.log(1000);
      ctx.fillText(`${freq}`, x, height - 3);
    });

  }, [damping]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// Compact Preset Button
const PresetButton = ({ name, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
      active
        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/90'
    }`}
  >
    {name}
  </button>
);

export const ModernReverbUI = ({ trackId, effect, onChange }) => {
  const { size, decay, damping, width, preDelay, wet, earlyLateMix, diffusion, modDepth, modRate } = effect.settings;
  const [activePreset, setActivePreset] = useState(null);

  const presets = [
    { name: 'Room', settings: { size: 0.35, decay: 0.8, damping: 0.4, wet: 0.25, earlyLateMix: 0.4 } },
    { name: 'Hall', settings: { size: 0.65, decay: 2.5, damping: 0.5, wet: 0.35, earlyLateMix: 0.5 } },
    { name: 'Cathedral', settings: { size: 0.9, decay: 6.0, damping: 0.7, wet: 0.45, earlyLateMix: 0.7 } },
    { name: 'Plate', settings: { size: 0.5, decay: 1.8, damping: 0.2, wet: 0.4, earlyLateMix: 0.3 } },
    { name: 'Vocal', settings: { size: 0.45, decay: 1.5, damping: 0.6, wet: 0.3, earlyLateMix: 0.45 } },
    { name: 'Ambient', settings: { size: 0.95, decay: 10.0, damping: 0.8, wet: 0.6, earlyLateMix: 0.8 } }
  ];

  const loadPreset = (preset) => {
    setActivePreset(preset.name);
    Object.entries(preset.settings).forEach(([key, value]) => {
      onChange(key, value);
    });
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-950 via-blue-950/50 to-purple-950/50 p-4 overflow-auto">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white">Modern Reverb</h2>
          <p className="text-xs text-blue-300/70">Freeverb Engine</p>
        </div>
        <div className="text-right text-xs text-white/50">
          <div>RT60: {(decay * 0.16).toFixed(2)}s</div>
          <div>Mix: {(wet * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* Compact Presets */}
      <div className="flex gap-1.5 flex-wrap mb-3">
        {presets.map(preset => (
          <PresetButton
            key={preset.name}
            name={preset.name}
            active={activePreset === preset.name}
            onClick={() => loadPreset(preset)}
          />
        ))}
      </div>

      {/* Main Visualization - Compact */}
      <div className="bg-black/30 rounded-lg overflow-hidden mb-3 h-32 border border-white/10">
        <DecayEnvelopeVisualizer
          decay={decay}
          damping={damping}
          earlyLateMix={earlyLateMix}
          size={size}
        />
      </div>

      {/* Main Controls - Compact Grid */}
      <div className="grid grid-cols-5 gap-3 mb-3">
        <div className="flex flex-col items-center">
          <ProfessionalKnob
            label="Size"
            value={size * 100}
            onChange={(v) => onChange('size', v / 100)}
            min={0}
            max={100}
            defaultValue={70}
            unit="%"
            precision={0}
            size={65}
          />
        </div>

        <div className="flex flex-col items-center">
          <ProfessionalKnob
            label="Decay"
            value={decay}
            onChange={(v) => onChange('decay', v)}
            min={0.1}
            max={15}
            defaultValue={2.5}
            unit="s"
            precision={1}
            size={65}
          />
        </div>

        <div className="flex flex-col items-center">
          <ProfessionalKnob
            label="Damping"
            value={damping * 100}
            onChange={(v) => onChange('damping', v / 100)}
            min={0}
            max={100}
            defaultValue={50}
            unit="%"
            precision={0}
            size={65}
          />
        </div>

        <div className="flex flex-col items-center">
          <ProfessionalKnob
            label="PreDelay"
            value={preDelay * 1000}
            onChange={(v) => onChange('preDelay', v / 1000)}
            min={0}
            max={200}
            defaultValue={20}
            unit="ms"
            precision={0}
            size={65}
          />
        </div>

        <div className="flex flex-col items-center">
          <ProfessionalKnob
            label="Mix"
            value={wet * 100}
            onChange={(v) => onChange('wet', v / 100)}
            min={0}
            max={100}
            defaultValue={35}
            unit="%"
            precision={0}
            size={65}
          />
        </div>
      </div>

      {/* Secondary Controls - Compact */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Left: Advanced */}
        <div className="bg-black/20 rounded-lg p-3 border border-white/10">
          <h3 className="text-xs font-semibold text-white/70 mb-2">Advanced</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center">
              <ProfessionalKnob
                label="E/L Mix"
                value={earlyLateMix * 100}
                onChange={(v) => onChange('earlyLateMix', v / 100)}
                min={0}
                max={100}
                defaultValue={50}
                unit="%"
                precision={0}
                size={50}
              />
            </div>

            <div className="flex flex-col items-center">
              <ProfessionalKnob
                label="Width"
                value={width * 100}
                onChange={(v) => onChange('width', v / 100)}
                min={0}
                max={100}
                defaultValue={100}
                unit="%"
                precision={0}
                size={50}
              />
            </div>

            <div className="flex flex-col items-center">
              <ProfessionalKnob
                label="Diffuse"
                value={diffusion * 100}
                onChange={(v) => onChange('diffusion', v / 100)}
                min={0}
                max={100}
                defaultValue={70}
                unit="%"
                precision={0}
                size={50}
              />
            </div>
          </div>
        </div>

        {/* Right: Frequency Response */}
        <div className="bg-black/20 rounded-lg p-3 border border-white/10">
          <h3 className="text-xs font-semibold text-white/70 mb-2">HF Damping</h3>
          <div className="h-20">
            <DampingCurveVisualizer damping={damping} />
          </div>
        </div>
      </div>

      {/* Modulation - Compact */}
      <div className="bg-black/20 rounded-lg p-3 mb-3 border border-white/10">
        <h3 className="text-xs font-semibold text-white/70 mb-2">Modulation</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center">
            <ProfessionalKnob
              label="Depth"
              value={modDepth * 100}
              onChange={(v) => onChange('modDepth', v / 100)}
              min={0}
              max={100}
              defaultValue={30}
              unit="%"
              precision={0}
              size={50}
            />
          </div>

          <div className="flex flex-col items-center">
            <ProfessionalKnob
              label="Rate"
              value={modRate}
              onChange={(v) => onChange('modRate', v)}
              min={0.1}
              max={2}
              defaultValue={0.5}
              unit="Hz"
              precision={1}
              size={50}
            />
          </div>
        </div>
      </div>

      {/* Signal Analyzer - Compact */}
      <div className="bg-black/20 rounded-lg p-3 border border-white/10">
        <h3 className="text-xs font-semibold text-white/70 mb-2">Output</h3>
        <div className="h-16">
          <SignalVisualizer
            meterId={`${trackId}-reverb`}
            type="spectrum"
            color="#60a5fa"
            config={{ showGrid: false, smooth: true }}
          />
        </div>
      </div>
    </div>
  );
};
