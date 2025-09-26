// src/ui/plugin_uis/FeedbackDelayUI.jsx

import React, { useState, useEffect, useRef } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

// Görselleştirme için Canvas Bileşeni
const TapeEchoVisualizer = ({ delayTime, feedback, wet }) => {
  const canvasRef = useRef(null);
  const echoesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let lastSpawn = 0;

    class TapeEcho {
      constructor(x, amplitude) {
        this.x = x;
        this.amplitude = amplitude;
        this.life = 1;
        this.speed = 1.5; // Biraz daha hızlı
      }
      update() {
        this.x += this.speed;
        this.life *= (0.99 + feedback * 0.009); // Feedback'e daha duyarlı
        this.amplitude *= this.life;
      }
      draw(ctx, height) {
        if (this.life < 0.01) return;
        ctx.strokeStyle = `rgba(255, 140, 0, ${this.life * wet})`;
        ctx.lineWidth = 1 + this.amplitude * 4;
        ctx.shadowColor = 'rgba(255, 140, 0, 0.5)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(this.x, height/2 - this.amplitude * height * 0.4);
        ctx.lineTo(this.x, height/2 + this.amplitude * height * 0.4);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    const animate = (timestamp) => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      canvas.width = width;
      canvas.height = height;

      // Arka planı temizle
      ctx.clearRect(0,0,width,height);

      // Yeni yankıları tetikle
      const delayMs = typeof delayTime === 'string' ? Tone.Time(delayTime).toMilliseconds() : delayTime * 1000;
      if (timestamp - lastSpawn > delayMs) {
        echoesRef.current.push(new TapeEcho(60, 0.5 + Math.random() * 0.5));
        lastSpawn = timestamp;
      }

      // Yankıları güncelle ve çiz
      echoesRef.current = echoesRef.current.filter(echo => {
        echo.update();
        echo.draw(ctx, height);
        return echo.x < width && echo.life > 0.01;
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate(0);
    return () => cancelAnimationFrame(animationFrameId);
  }, [delayTime, feedback, wet]);

  return <canvas ref={canvasRef} className="feedback-delay__canvas" />;
};


// Ana UI Bileşeni
export const FeedbackDelayUI = ({ effect, onChange }) => {
  const { delayTime, feedback, wet } = effect.settings;

  const timeOptions = [
    { value: '8n', label: '1/8' }, { value: '8n.', label: '1/8D' },
    { value: '8t', label: '1/8T' }, { value: '4n', label: '1/4' },
    { value: '4n.', label: '1/4D' }, { value: '4t', label: '1/4T' },
    { value: '2n', label: '1/2' }
  ];

  return (
    <div className="feedback-delay-ui plugin-content-layout">
      {/* Kontrol Grubu */}
      <div className="feedback-delay__controls">
        <div className="feedback-delay__control-group">
          <label className="feedback-delay__label">Delay Time</label>
          <select
            value={delayTime}
            onChange={(e) => onChange('delayTime', e.target.value)}
            className="feedback-delay__select"
          >
            {timeOptions.map(opt => (
              <option key={opt.value} value={opt.value} className="feedback-delay__option">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <ProfessionalKnob
          label="Feedback"
          value={feedback * 100}
          onChange={(v) => onChange('feedback', v / 100)}
          min={0} max={95} defaultValue={40}
          unit="%" precision={0} size={80}
        />
        <ProfessionalKnob
          label="Mix"
          value={wet * 100}
          onChange={(v) => onChange('wet', v / 100)}
          min={0} max={100} defaultValue={40}
          unit="%" precision={0} size={80}
        />
      </div>

      {/* Görselleştirme Alanı */}
      <div className="feedback-delay__visualizer">
        <TapeEchoVisualizer delayTime={delayTime} feedback={feedback} wet={wet} />
      </div>
    </div>
  );
};