import React, { useRef, useEffect, useState } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import * as Tone from 'tone';
import { MeteringService } from '../../lib/core/MeteringService';

const timeOptions = [ { value: '1n', label: '1/1' }, { value: '2n', label: '1/2' }, { value: '4n', label: '1/4' }, { value: '8n', label: '1/8' }, { value: '16n', label: '1/16' }, { value: '32n', label: '1/32' }, { value: '2t', label: '1/2T' }, { value: '4t', label: '1/4T' }, { value: '8t', label: '1/8T' }, { value: '4n.', label: '1/4D' }, { value: '8n.', label: '1/8D' }, ];

export const DelayUI = ({ trackId, effect, onChange }) => {
  const canvasRef = useRef(null);
  const { feedback, delayTime, wet } = effect.settings;
  const [inputLevel, setInputLevel] = useState(-60);

  useEffect(() => {
    const meterId = `${trackId}-input`;
    const handleLevel = (db) => setInputLevel(db);
    MeteringService.subscribe(meterId, handleLevel);
    return () => MeteringService.unsubscribe(meterId, handleLevel);
  }, [trackId]);
  
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let rotation = 0;
    const normalizedGain = (Math.max(-60, inputLevel) + 60) / 66;

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if(width === 0) { animationFrameId = requestAnimationFrame(draw); return; }
      canvas.width = width; canvas.height = height;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      
      const delayInSeconds = Tone.Time(delayTime).toSeconds();
      rotation += (1 / (delayInSeconds + 0.1)) * 0.1;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);

      const pointCount = 100;
      const maxRadius = Math.min(width, height) * 0.45;

      ctx.lineWidth = 1 + (wet * 4) + (normalizedGain * 3); // Gain'e bağlı kalınlık
      ctx.strokeStyle = `rgba(34, 197, 94, ${0.2 + wet * 0.8})`;
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 10 * wet * (1 + normalizedGain); // Gain'e bağlı parlama
      
      ctx.beginPath();
      for(let i = 0; i < pointCount; i++) {
        const ratio = i / pointCount;
        const radius = ratio * maxRadius * (0.5 + feedback * 0.5);
        const tightness = 1 + (1 / (delayInSeconds + 0.1)) * 5;
        const angle = ratio * Math.PI * 2 * tightness;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      animationFrameId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, [feedback, delayTime, wet, inputLevel]);

  return (
    <div className="delay-ui-v2 plugin-content-layout">
      <ProfessionalKnob label="Feedback" value={effect.settings.feedback * 100} onChange={(val) => onChange('feedback', val / 100)} min={0} max={95} defaultValue={30} unit="%" precision={0} size={80} />
      <div className="delay-ui-v2__center-stack">
        <canvas ref={canvasRef} className="delay-ui-v2__canvas" />
        <select value={effect.settings.delayTime} onChange={(e) => onChange('delayTime', e.target.value)} className="delay-ui-v2__select">
            {timeOptions.map(opt => <option key={opt.value} value={opt.value} className="bg-gray-800">{opt.label}</option>)}
        </select>
      </div>
      <ProfessionalKnob label="Mix" value={effect.settings.wet * 100} onChange={(val) => onChange('wet', val / 100)} min={0} max={100} defaultValue={35} unit="%" precision={0} size={80} />
    </div>
  );
};