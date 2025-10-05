import React, { useRef, useEffect, useState } from 'react';
import { ProfessionalKnob } from '../container/PluginControls';
import { MeteringService } from '@/lib/core/MeteringService';

export const ArcadeCrusherUI = ({ trackId, effect, onChange }) => {
  const canvasRef = useRef(null);
  const { bits, wet } = effect.settings;
  const [waveform, setWaveform] = useState(null);

  useEffect(() => {
    const meterId = `${trackId}-waveform`;
    MeteringService.subscribe(meterId, setWaveform);
    return () => MeteringService.unsubscribe(meterId, setWaveform);
  }, [trackId]);

  useEffect(() => {
    const canvas = canvasRef.current; 
    if (!canvas || !waveform) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width; canvas.height = height;
    
    ctx.clearRect(0,0,width,height);
    const numSteps = Math.pow(2, bits);
    const stepHeight = height / numSteps;

    ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + wet * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for(let i=0; i < waveform.length; i++) {
        const x = (i / waveform.length) * width;
        const sample = waveform[i];
        const quantized = Math.floor(((sample + 1) / 2) * numSteps);
        const y = height - (quantized + 0.5) * stepHeight;
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

  }, [bits, wet, waveform]);

  return (
    <div className="bitcrusher-ui-v2 plugin-content-layout">
      <ProfessionalKnob label="Bits" value={bits} onChange={(val) => onChange('bits', Math.round(val))} min={1} max={16} defaultValue={4} precision={0} size={100} />
      <div className="bitcrusher-ui-v2__visualizer">
        <canvas ref={canvasRef}></canvas>
      </div>
      <ProfessionalKnob label="Mix" value={wet * 100} onChange={(val) => onChange('wet', val / 100)} min={0} max={100} defaultValue={100} unit="%" precision={0} size={70} />
    </div>
  );
};
