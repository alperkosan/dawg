import React, { useRef, useEffect } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

export const ReverbUI = ({ effect, onChange }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { decay, preDelay } = effect.settings;
    let animationFrameId;

    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.005,
      vy: (Math.random() - 0.5) * 0.005,
      life: Math.random()
    }));

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width; canvas.height = height;
      ctx.clearRect(0, 0, width, height);

      particles.forEach(p => {
        p.x += p.vx * (1 + preDelay * 10);
        p.y += p.vy * (1 + preDelay * 10);
        p.life -= 0.05 / (decay + 0.1);

        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;
        if (p.life <= 0) { p.life = 1; p.x = 0.5; p.y = 0.5; }
        
        ctx.fillStyle = `rgba(173, 216, 230, ${p.life * 0.5})`;
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, p.life * 3, 0, Math.PI * 2);
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, [effect.settings.decay, effect.settings.preDelay]);

  return (
    <div className="reverb-ui plugin-content-layout">
        <canvas ref={canvasRef} className="reverb-ui__canvas" />
        <ProfessionalKnob label="Pre-Delay" value={effect.settings.preDelay} onChange={(val) => onChange('preDelay', val)} min={0} max={0.2} defaultValue={0.01} unit="s" precision={3} size={80} />
        <ProfessionalKnob label="Decay" value={effect.settings.decay} onChange={(val) => onChange('decay', val)} min={0.1} max={15} defaultValue={2.5} unit="s" precision={2} size={120} />
        <ProfessionalKnob label="Mix" value={effect.settings.wet * 100} onChange={(val) => onChange('wet', val / 100)} min={0} max={100} defaultValue={40} unit="%" precision={0} size={80} />
    </div>
  );
};
