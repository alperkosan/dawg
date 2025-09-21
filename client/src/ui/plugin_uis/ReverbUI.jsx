import React, { useRef, useEffect } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

export const ReverbUI = ({ effect, onChange }) => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);

  const { decay, preDelay, wet } = effect.settings;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const lerp = (a, b, n) => (1 - n) * a + n * b;

    const animate = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if(width === 0) { animationFrameId = requestAnimationFrame(animate); return; }
      canvas.width = width; canvas.height = height;
      
      const centerX = width / 2;
      const centerY = height / 2;

      // Parçacıkları güncelle
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.005 / (decay * 0.5 + 0.1); // Decay'e bağlı ömür
        p.alpha = lerp(p.alpha, 0, 0.02);

        if(p.life <= 0) {
          // Parçacığı yeniden doğur
          const angle = Math.random() * Math.PI * 2;
          const radius = preDelay * (Math.min(width, height) * 2); // Pre-delay'e bağlı başlangıç mesafesi
          p.x = centerX + Math.cos(angle) * radius;
          p.y = centerY + Math.sin(angle) * radius;
          p.vx = (Math.random() - 0.5) * 0.5;
          p.vy = (Math.random() - 0.5) * 0.5;
          p.life = 1;
          p.alpha = 1;
        }
      });
      
      // Yeni parçacık ekle (Mix'e bağlı)
      if (Math.random() < wet * 0.5 && particlesRef.current.length < 150) {
          particlesRef.current.push({ x: centerX, y: centerY, vx:0, vy:0, life:0, alpha:0 });
      }

      // Çizim
      ctx.clearRect(0, 0, width, height);
      particlesRef.current.forEach(p => {
        const size = p.life * (2 + decay * 0.5); // Decay'e bağlı boyut
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(173, 216, 230, ${p.alpha * wet * 0.8})`; // Mix'e bağlı opaklık
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [decay, preDelay, wet]);

  return (
    <div className="reverb-ui-v2 plugin-content-layout">
        <div className="reverb-ui-v2__canvas-container">
            <canvas ref={canvasRef} />
        </div>
        <ProfessionalKnob label="Pre-Delay" value={effect.settings.preDelay * 1000} onChange={(val) => onChange('preDelay', val / 1000)} min={0} max={200} defaultValue={10} unit="ms" precision={1} size={80} />
        <ProfessionalKnob label="Decay" value={effect.settings.decay} onChange={(val) => onChange('decay', val)} min={0.1} max={15} defaultValue={2.5} unit="s" precision={2} size={120} />
        <ProfessionalKnob label="Mix" value={effect.settings.wet * 100} onChange={(val) => onChange('wet', val / 100)} min={0} max={100} defaultValue={40} unit="%" precision={0} size={80} />
    </div>
  );
};