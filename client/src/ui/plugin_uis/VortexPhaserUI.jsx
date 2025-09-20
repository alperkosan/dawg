import React, { useRef, useEffect } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

export const VortexPhaserUI = ({ effect, onChange }) => {
  const canvasRef = useRef(null);
  const { frequency, octaves } = effect.settings;

  useEffect(() => {
    // StardustChorus ile aynı görselleştirme mantığını kullanabiliriz
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frameId;
    let time = 0;
    const draw = () => {
        const { width, height } = canvas.getBoundingClientRect();
        if(width === 0) { frameId = requestAnimationFrame(draw); return; }
        canvas.width = width; canvas.height = height;
        ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 2;
        ctx.shadowColor = '#ec4899'; ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
            const angle = (x / width) * 4 * Math.PI * frequency + time;
            const y = height / 2 + Math.sin(angle) * (height / 2 * (octaves / 8));
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
      <ProfessionalKnob label="Depth" value={effect.settings.octaves} onChange={(val) => onChange('octaves', val)} min={1} max={8} defaultValue={3} unit=" oct" precision={1} size={80} />
      <div className="flex flex-col items-center gap-4">
        <ProfessionalKnob label="Rate" value={effect.settings.frequency} onChange={(val) => onChange('frequency', val)} min={0.1} max={8} defaultValue={0.5} unit=" Hz" precision={2} size={110} />
        <canvas ref={canvasRef} className="lfo-visualizer" />
      </div>
      <ProfessionalKnob label="Mix" value={effect.settings.wet * 100} onChange={(val) => onChange('wet', val / 100)} min={0} max={100} defaultValue={50} unit="%" precision={0} size={80} />
    </div>
  );
};
