import React, { useRef, useEffect, useState } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { MeteringService } from '../../lib/core/MeteringService';

export const OrbitPannerUI = ({ trackId, effect, onChange }) => {
  const canvasRef = useRef(null);
  const { frequency, depth, wet } = effect.settings;
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
    let frameId, time = 0;
    const draw = () => {
        const { width, height } = canvas.getBoundingClientRect();
        if(width === 0) { frameId = requestAnimationFrame(draw); return; }
        canvas.width = width; canvas.height = height;
        const centerX = width / 2;
        const centerY = height / 2;
        
        const normalizedGain = (Math.max(-60, inputLevel) + 60) / 66;
        
        ctx.fillStyle = `rgba(18,18,18, ${0.7 - normalizedGain * 0.4})`;
        ctx.fillRect(0,0,width,height);
        
        ctx.strokeStyle = `rgba(34, 211, 238, ${0.1 + normalizedGain * 0.2})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, width * 0.4 * depth, height * 0.4 * depth, 0, 0, Math.PI * 2);
        ctx.stroke();

        const angle = time * frequency * 2 * Math.PI;
        const x = centerX + Math.cos(angle) * width * 0.4 * depth;
        const y = centerY + Math.sin(angle) * height * 0.4 * depth;
        
        const size = 4 + normalizedGain * 8;
        ctx.fillStyle = '#22d3ee';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 10 * normalizedGain;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        time += 0.016;
        frameId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frameId);
  }, [frequency, depth, inputLevel]);

  return (
    <div className="panner-ui-v2 plugin-content-layout">
        <ProfessionalKnob label="Depth" value={depth * 100} onChange={(v) => onChange('depth', v/100)} min={0} max={100} defaultValue={100} unit="%" precision={0} size={70} />
        <canvas ref={canvasRef} className="panner-ui-v2__canvas" />
        <ProfessionalKnob label="Rate" value={frequency} onChange={(v) => onChange('frequency', v)} min={0.1} max={10} defaultValue={2} unit="Hz" precision={2} size={70} />
    </div>
  );
};
