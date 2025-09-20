import React, { useRef, useEffect } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { PluginTypography } from '../plugin_system/PluginDesignSystem';
import * as Tone from 'tone';

const timeOptions = [ { value: '1n', label: '1/1' }, { value: '2n', label: '1/2' }, { value: '4n', label: '1/4' }, { value: '8n', label: '1/8' }, { value: '16n', label: '1/16' }, { value: '32n', label: '1/32' }, { value: '2t', label: '1/2T' }, { value: '4t', label: '1/4T' }, { value: '8t', label: '1/8T' }, { value: '4n.', label: '1/4D' }, { value: '8n.', label: '1/8D' }, ];

export const FeedbackDelayUI = ({ effect, onChange }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { feedback, delayTime } = effect.settings;
    let animationFrameId;

    let echoes = [];
    
    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if(width === 0) { animationFrameId = requestAnimationFrame(draw); return; }
      canvas.width = width; canvas.height = height;
      ctx.clearRect(0, 0, width, height);

      if (Math.random() < 0.1) echoes.push({ pos: 0, life: 1 });
      
      ctx.strokeStyle = '#22c55e'; // green-500
      ctx.lineWidth = 2;

      echoes.forEach((echo, i) => {
        echo.pos += (1 / Tone.Time(delayTime).toSeconds()) * 0.01;
        echo.life *= (0.99 + feedback * 0.005);
        if (echo.pos > 1) { echoes.splice(i, 1); return; }
        
        ctx.globalAlpha = echo.life;
        const x = echo.pos * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, [effect.settings]);

  return (
    <div className="plugin-content-layout delay-ui">
      <ProfessionalKnob label="Feedback" value={effect.settings.feedback * 100} onChange={(val) => onChange('feedback', val / 100)} min={0} max={95} defaultValue={40} unit="%" precision={0} size={90} />
      <div className="delay-ui__time-control">
          <label style={PluginTypography.label}>Time</label>
          <select value={effect.settings.delayTime} onChange={(e) => onChange('delayTime', e.target.value)} className="delay-ui__select">
              {timeOptions.map(opt => <option key={opt.value} value={opt.value} className="bg-gray-800">{opt.label}</option>)}
          </select>
          <canvas ref={canvasRef} className="delay-ui__canvas" />
      </div>
      <ProfessionalKnob label="Mix" value={effect.settings.wet * 100} onChange={(val) => onChange('wet', val / 100)} min={0} max={100} defaultValue={40} unit="%" precision={0} size={90} />
    </div>
  );
};
