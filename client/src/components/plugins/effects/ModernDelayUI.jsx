import { useState, useEffect, useRef } from 'react';
import { ProfessionalKnob } from '../container/PluginControls';
import { SignalVisualizer } from '../../common/SignalVisualizer';

/**
 * MODERN DELAY UI - ZENITH COMPACT DESIGN
 *
 * Kompakt, anlamlı görselleştirmelerle profesyonel delay kontrolü
 * - Real-time ping-pong visualization
 * - Stereo feedback display
 * - Filter frequency curve
 * - Saturation/modulation meters
 */

// Compact Ping-Pong Delay Visualizer
const PingPongVisualizer = ({ timeLeft, timeRight, feedbackLeft, feedbackRight, pingPong, wet }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let time = 0;

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

      const centerY = height / 2;
      const leftX = width * 0.2;
      const rightX = width * 0.8;

      // Draw delay lines
      const maxTime = Math.max(timeLeft, timeRight, 0.5);
      const leftDelayX = leftX + (timeLeft / maxTime) * (width * 0.25);
      const rightDelayX = rightX - (timeRight / maxTime) * (width * 0.25);

      // Left channel
      ctx.strokeStyle = `rgba(100, 200, 255, ${wet * 0.8})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(leftX, centerY);
      ctx.lineTo(leftDelayX, centerY);
      ctx.stroke();

      // Right channel
      ctx.strokeStyle = `rgba(255, 100, 200, ${wet * 0.8})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rightX, centerY);
      ctx.lineTo(rightDelayX, centerY);
      ctx.stroke();

      // Ping-pong arrows
      if (pingPong > 0.1) {
        const arrowY1 = centerY - 30;
        const arrowY2 = centerY + 30;

        ctx.strokeStyle = `rgba(255, 255, 100, ${pingPong * 0.7})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        // Left to right
        ctx.beginPath();
        ctx.moveTo(leftDelayX, arrowY1);
        ctx.lineTo(rightDelayX, arrowY1);
        ctx.stroke();

        // Right to left
        ctx.beginPath();
        ctx.moveTo(rightDelayX, arrowY2);
        ctx.lineTo(leftDelayX, arrowY2);
        ctx.stroke();

        ctx.setLineDash([]);
      }

      // Feedback indicators (animated pulses)
      const pulsePhase = (time * 0.02) % 1;

      // Left feedback
      for (let i = 0; i < 3; i++) {
        const phase = (pulsePhase + i * 0.33) % 1;
        const radius = 5 + phase * 20;
        const opacity = (1 - phase) * feedbackLeft * wet;

        ctx.strokeStyle = `rgba(100, 200, 255, ${opacity})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(leftDelayX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Right feedback
      for (let i = 0; i < 3; i++) {
        const phase = (pulsePhase + i * 0.33) % 1;
        const radius = 5 + phase * 20;
        const opacity = (1 - phase) * feedbackRight * wet;

        ctx.strokeStyle = `rgba(255, 100, 200, ${opacity})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rightDelayX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Delay time labels
      ctx.fillStyle = 'rgba(100, 200, 255, 0.9)';
      ctx.font = '11px monospace';
      ctx.fillText(`L: ${(timeLeft * 1000).toFixed(0)}ms`, leftX, centerY - 40);

      ctx.fillStyle = 'rgba(255, 100, 200, 0.9)';
      ctx.fillText(`R: ${(timeRight * 1000).toFixed(0)}ms`, rightX - 60, centerY - 40);

      // Feedback percentages
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '10px monospace';
      ctx.fillText(`FB: ${(feedbackLeft * 100).toFixed(0)}%`, leftX, centerY + 50);
      ctx.fillText(`FB: ${(feedbackRight * 100).toFixed(0)}%`, rightX - 50, centerY + 50);

      time++;
      animationId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationId);
  }, [timeLeft, timeRight, feedbackLeft, feedbackRight, pingPong, wet]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// Compact Filter Curve Visualizer
const FilterCurveVisualizer = ({ filterFreq, saturation }) => {
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

    // Filter frequency response
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, 'rgba(100, 255, 150, 0.3)');
    gradient.addColorStop(1, 'rgba(100, 255, 150, 0.7)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, height);

    for (let x = 0; x <= width; x++) {
      const freq = 20 * Math.pow(20000 / 20, x / width);
      let response = 1;
      if (freq > filterFreq) {
        const ratio = freq / filterFreq;
        response = 1 / Math.sqrt(1 + ratio * ratio);
      }

      // Add saturation harmonics
      if (saturation > 0) {
        const harmonic = Math.sin(x * 0.1) * saturation * 0.1;
        response += harmonic;
      }

      const y = height - response * height * 0.8;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Cutoff marker
    const cutoffX = width * Math.log(filterFreq / 20) / Math.log(20000 / 20);
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cutoffX, 0);
    ctx.lineTo(cutoffX, height);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
    ctx.font = '10px monospace';
    ctx.fillText(`${filterFreq.toFixed(0)}Hz`, cutoffX + 3, 12);

  }, [filterFreq, saturation]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// Compact Preset Button
const PresetButton = ({ name, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
      active
        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50'
        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/90'
    }`}
  >
    {name}
  </button>
);

export const ModernDelayUI = ({ trackId, effect, onChange }) => {
  const {
    timeLeft,
    timeRight,
    feedbackLeft,
    feedbackRight,
    pingPong,
    wet,
    filterFreq,
    filterQ,
    saturation,
    modDepth,
    modRate,
    diffusion,
    width
  } = effect.settings;

  const [activePreset, setActivePreset] = useState(null);

  const presets = [
    { name: 'Slapback', settings: { timeLeft: 0.08, timeRight: 0.085, feedbackLeft: 0.15, feedbackRight: 0.15, pingPong: 0.0, wet: 0.25, saturation: 0.2 } },
    { name: 'Ping-Pong', settings: { timeLeft: 0.375, timeRight: 0.5, feedbackLeft: 0.5, feedbackRight: 0.5, pingPong: 0.9, wet: 0.4, diffusion: 0.3 } },
    { name: 'Dub', settings: { timeLeft: 0.5, timeRight: 0.75, feedbackLeft: 0.7, feedbackRight: 0.7, pingPong: 0.6, wet: 0.5, filterFreq: 2000, saturation: 0.4 } },
    { name: 'Ambient', settings: { timeLeft: 1.2, timeRight: 1.5, feedbackLeft: 0.8, feedbackRight: 0.8, pingPong: 0.3, wet: 0.6, diffusion: 0.8, modDepth: 0.02 } },
    { name: 'Tape', settings: { timeLeft: 0.425, timeRight: 0.425, feedbackLeft: 0.55, feedbackRight: 0.55, pingPong: 0.0, wet: 0.35, filterFreq: 4000, saturation: 0.5, modDepth: 0.01 } }
  ];

  const loadPreset = (preset) => {
    setActivePreset(preset.name);
    Object.entries(preset.settings).forEach(([key, value]) => {
      onChange(key, value);
    });
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-950 via-purple-950/50 to-pink-950/50 p-4 overflow-auto">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white">Modern Delay</h2>
          <p className="text-xs text-purple-300/70">Multi-Tap Stereo</p>
        </div>
        <div className="text-right text-xs text-white/50">
          <div>L/R: {(timeLeft * 1000).toFixed(0)} / {(timeRight * 1000).toFixed(0)}ms</div>
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
        <PingPongVisualizer
          timeLeft={timeLeft}
          timeRight={timeRight}
          feedbackLeft={feedbackLeft}
          feedbackRight={feedbackRight}
          pingPong={pingPong}
          wet={wet}
        />
      </div>

      {/* Main Controls - Compact Grid */}
      <div className="grid grid-cols-5 gap-3 mb-3">
        <div className="flex flex-col items-center">
          <ProfessionalKnob
            label="Time L"
            value={timeLeft * 1000}
            onChange={(v) => onChange('timeLeft', v / 1000)}
            min={1}
            max={4000}
            defaultValue={375}
            unit="ms"
            precision={0}
            size={65}
          />
        </div>

        <div className="flex flex-col items-center">
          <ProfessionalKnob
            label="Time R"
            value={timeRight * 1000}
            onChange={(v) => onChange('timeRight', v / 1000)}
            min={1}
            max={4000}
            defaultValue={500}
            unit="ms"
            precision={0}
            size={65}
          />
        </div>

        <div className="flex flex-col items-center">
          <ProfessionalKnob
            label="Feedback"
            value={feedbackLeft * 100}
            onChange={(v) => {
              onChange('feedbackLeft', v / 100);
              onChange('feedbackRight', v / 100);
            }}
            min={0}
            max={100}
            defaultValue={40}
            unit="%"
            precision={0}
            size={65}
          />
        </div>

        <div className="flex flex-col items-center">
          <ProfessionalKnob
            label="PingPong"
            value={pingPong * 100}
            onChange={(v) => onChange('pingPong', v / 100)}
            min={0}
            max={100}
            defaultValue={0}
            unit="%"
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
        {/* Left: Filter */}
        <div className="bg-black/20 rounded-lg p-3 border border-white/10">
          <h3 className="text-xs font-semibold text-white/70 mb-2">Filter & Character</h3>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="flex flex-col items-center">
              <ProfessionalKnob
                label="Cutoff"
                value={filterFreq}
                onChange={(v) => onChange('filterFreq', v)}
                min={100}
                max={20000}
                defaultValue={8000}
                unit="Hz"
                precision={0}
                size={50}
              />
            </div>

            <div className="flex flex-col items-center">
              <ProfessionalKnob
                label="Saturate"
                value={saturation * 100}
                onChange={(v) => onChange('saturation', v / 100)}
                min={0}
                max={100}
                defaultValue={0}
                unit="%"
                precision={0}
                size={50}
              />
            </div>
          </div>
          <div className="h-16">
            <FilterCurveVisualizer filterFreq={filterFreq} saturation={saturation} />
          </div>
        </div>

        {/* Right: Advanced */}
        <div className="bg-black/20 rounded-lg p-3 border border-white/10">
          <h3 className="text-xs font-semibold text-white/70 mb-2">Advanced</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center">
              <ProfessionalKnob
                label="Width"
                value={width * 100}
                onChange={(v) => onChange('width', v / 100)}
                min={0}
                max={200}
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
                defaultValue={0}
                unit="%"
                precision={0}
                size={50}
              />
            </div>

            <div className="flex flex-col items-center">
              <ProfessionalKnob
                label="Filter Q"
                value={filterQ}
                onChange={(v) => onChange('filterQ', v)}
                min={0.1}
                max={20}
                defaultValue={1}
                unit=""
                precision={1}
                size={50}
              />
            </div>
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
              value={modDepth * 1000}
              onChange={(v) => onChange('modDepth', v / 1000)}
              min={0}
              max={50}
              defaultValue={0}
              unit="ms"
              precision={1}
              size={50}
            />
          </div>

          <div className="flex flex-col items-center">
            <ProfessionalKnob
              label="Rate"
              value={modRate}
              onChange={(v) => onChange('modRate', v)}
              min={0.1}
              max={5}
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
            meterId={`${trackId}-delay`}
            type="spectrum"
            color="#a855f7"
            config={{ showGrid: false, smooth: true }}
          />
        </div>
      </div>
    </div>
  );
};
