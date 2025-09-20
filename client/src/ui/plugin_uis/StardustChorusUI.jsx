import React, { useRef, useEffect } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

export const StardustChorusUI = ({ effect, onChange }) => {
  const canvasRef = useRef(null);
  const { frequency, depth } = effect.settings;

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frameId;
    let time = 0;
    const draw = () => {
        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = width; canvas.height = height;
        ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
            const angle = (x / width) * 2 * Math.PI * frequency + time;
            const y = height / 2 + Math.sin(angle) * (height / 2 * depth);
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        time += 0.05;
        frameId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frameId);
  }, [frequency, depth]);

  return (
    <div className="modulation-ui">
      <ProfessionalKnob label="Depth" value={effect.settings.depth * 100} onChange={(val) => onChange('depth', val / 100)} min={0} max={100} defaultValue={70} unit="%" precision={0} size={80} />
      <div className="flex flex-col items-center gap-4">
        <ProfessionalKnob label="Rate" value={effect.settings.frequency} onChange={(val) => onChange('frequency', val)} min={0.1} max={10} defaultValue={1.5} unit=" Hz" precision={2} size={110} />
        <canvas ref={canvasRef} className="lfo-visualizer"></canvas>
      </div>
      <ProfessionalKnob label="Mix" value={effect.settings.wet * 100} onChange={(val) => onChange('wet', val / 100)} min={0} max={100} defaultValue={50} unit="%" precision={0} size={80} />
    </div>
  );
};
