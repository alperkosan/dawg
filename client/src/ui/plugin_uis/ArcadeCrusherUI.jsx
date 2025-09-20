import React, { useRef, useEffect } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

export const ArcadeCrusherUI = ({ effect, onChange }) => {
  const canvasRef = useRef(null);
  const { bits } = effect.settings;

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width; canvas.height = height;
    
    ctx.clearRect(0,0,width,height);
    const numSteps = Math.pow(2, bits);
    const stepHeight = height / numSteps;

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for(let i = 0; i < numSteps; i++) {
        ctx.fillRect(0, i * stepHeight, width, 1);
    }
    
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for(let x=0; x < width; x++) {
        const sine = Math.sin(x / width * Math.PI * 4); // Örnek sinyal
        const quantized = Math.floor(((sine + 1) / 2) * numSteps);
        const y = height - (quantized + 0.5) * stepHeight;
        if(x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

  }, [bits]);

  return (
    <div className="plugin-content-layout">
      <ProfessionalKnob label="Mix" value={effect.settings.wet * 100} onChange={(val) => onChange('wet', val / 100)} min={0} max={100} defaultValue={100} unit="%" precision={0} size={80} />
      <div className="flex flex-col items-center gap-2">
        <ProfessionalKnob label="Bits" value={effect.settings.bits} onChange={(val) => onChange('bits', val)} min={1} max={16} defaultValue={4} precision={0} size={120} />
        <canvas ref={canvasRef} className="delay-ui__canvas"></canvas>
      </div>
    </div>
  );
};

