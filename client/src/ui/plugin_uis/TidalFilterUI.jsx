import React, { useRef, useEffect } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

export const TidalFilterUI = ({ effect, onChange }) => {
  const canvasRef = useRef(null);
  const { frequency, octaves } = effect.settings;

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frameId;
    let time = 0;
    const draw = () => {
        const { width, height } = canvas.getBoundingClientRect();
        if(width === 0) { frameId = requestAnimationFrame(draw); return; }
        canvas.width = width; canvas.height = height;
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2;
        ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
            const angle = (x / width) * 2 * Math.PI * Tone.Time(frequency).toFrequency() + time;
            const lfo = (Math.sin(angle) + 1) / 2;
            const y = height - (lfo * height * (octaves / 8));
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        time += 0.05;
        frameId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frameId);
  }, [frequency, octaves]);
  
  return (
    <div className="modulation-ui">
      <ProfessionalKnob label="Depth" value={effect.settings.octaves} onChange={(val) => onChange('octaves', val)} min={0} max={8} defaultValue={2} size={80} unit=" oct" precision={1} />
      <div className="flex flex-col items-center gap-4">
        <ProfessionalKnob label="Cutoff" value={effect.settings.baseFrequency} onChange={(val) => onChange('baseFrequency', val)} min={20} max={10000} defaultValue={400} size={110} unit=" Hz" precision={0} logarithmic />
        <canvas ref={canvasRef} className="lfo-visualizer"></canvas>
      </div>
      <ProfessionalKnob label="Mix" value={effect.settings.wet * 100} onChange={(val) => onChange('wet', val/100)} min={0} max={100} defaultValue={100} unit="%" precision={0} size={80} />
    </div>
  );
};

