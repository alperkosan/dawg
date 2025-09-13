import React, { useEffect, useRef } from 'react';
import { useThemeStore } from '../../store/useThemeStore'; // Tema store'unu import ediyoruz

const EnvelopeDisplay = ({ envelope }) => {
  const canvasRef = useRef(null);
  const { attack, decay, sustain, release } = envelope;
  
  // Aktif temanın renklerine erişiyoruz
  const activeTheme = useThemeStore((state) => state.getActiveTheme());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 20;
    const peakHeight = height - padding * 2;
    
    const totalTime = Math.max(1, attack + decay + release);
    const attackX = (attack / totalTime) * (width - padding * 2);
    const decayX = (decay / totalTime) * (width - padding * 2);

    ctx.clearRect(0, 0, width, height);
    
    // Çizim stilini artık doğrudan temadan alıyoruz
    const primaryColor = activeTheme.colors.primary || '#38bdf8';
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = `${primaryColor}80`; // %50 saydamlıkta gölge
    ctx.shadowBlur = 8;

    // Zarfı çiz
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(padding + attackX, padding);
    ctx.lineTo(padding + attackX + decayX, padding + (1 - sustain) * peakHeight);
    const sustainEndX = width - padding - ( (release/totalTime) * (width - padding * 2) );
    ctx.lineTo(sustainEndX, padding + (1 - sustain) * peakHeight);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Dolgu
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `${primaryColor}66`); // %40 saydamlık
    gradient.addColorStop(1, `${primaryColor}1A`); // %10 saydamlık
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.shadowBlur = 0;

  }, [attack, decay, sustain, release, activeTheme]); // activeTheme'i bağımlılıklara ekliyoruz

  return (
    <div className="w-full h-full rounded-lg" style={{ backgroundColor: 'var(--color-background)' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default EnvelopeDisplay;