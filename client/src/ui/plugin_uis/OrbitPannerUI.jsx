import React, { useRef, useEffect } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

export const OrbitPannerUI = ({ effect, onChange }) => {
  const canvasRef = useRef(null);
  const { frequency, depth } = effect.settings;

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frameId;
    let time = 0;
    const draw = () => {
        const { width, height } = canvas.getBoundingClientRect();
        if(width === 0) { frameId = requestAnimationFrame(draw); return; }
        canvas.width = width; canvas.height = height;
        const centerX = width / 2;
        const centerY = height / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0,0,width,height);
        
        // Yörünge
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, width * 0.4 * depth, height * 0.2 * depth, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Sinyal
        const angle = time * frequency * 2;
        const x = centerX + Math.cos(angle) * width * 0.4 * depth;
        const y = centerY + Math.sin(angle) * height * 0.2 * depth;
        
        ctx.fillStyle = '#22d3ee';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        time += 0.05;
        frameId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frameId);
  }, [frequency, depth]);

  return (
    <div className="modulation-ui">
      <ProfessionalKnob label="Depth" value={effect.settings.depth * 100} onChange={(val) => onChange('depth', val/100)} min={0} max={100} defaultValue={100} unit="%" precision={0} size={80} />
      <div className="flex flex-col items-center gap-4">
        <ProfessionalKnob label="Rate" value={effect.settings.frequency} onChange={(val) => onChange('frequency', val)} min={0.1} max={10} defaultValue={2} unit=" Hz" precision={2} size={110} />
        <canvas ref={canvasRef} className="lfo-visualizer" />
      </div>
      <ProfessionalKnob label="Mix" value={effect.settings.wet * 100} onChange={(val) => onChange('wet', val/100)} min={0} max={100} defaultValue={100} unit="%" precision={0} size={80} />
    </div>
  );
};
