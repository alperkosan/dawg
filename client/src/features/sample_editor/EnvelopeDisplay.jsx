import React, { useEffect, useRef } from 'react';

// Envelope grafiğini çizen, yeniden kullanılabilir bir bileşen.
const EnvelopeDisplay = ({ envelope }) => {
  const canvasRef = useRef(null);
  const { attack, decay, sustain, release } = envelope;

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

    // Toplam süreyi normalize et (görsel amaçlı)
    const totalTime = Math.max(1, attack + decay + release);
    const attackX = (attack / totalTime) * (width - padding * 2);
    const decayX = (decay / totalTime) * (width - padding * 2);

    ctx.clearRect(0, 0, width, height);
    
    // Çizim stili
    ctx.strokeStyle = '#38bdf8'; // cyan-400
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
    ctx.shadowBlur = 8;

    // Zarfı çiz
    ctx.beginPath();
    // Başlangıç
    ctx.moveTo(padding, height - padding);
    // Attack
    ctx.lineTo(padding + attackX, padding);
    // Decay
    ctx.lineTo(padding + attackX + decayX, padding + (1 - sustain) * peakHeight);
    // Sustain (yatay çizgi)
    const sustainEndX = width - padding - ( (release/totalTime) * (width - padding * 2) );
    ctx.lineTo(sustainEndX, padding + (1 - sustain) * peakHeight);
    // Release
    ctx.lineTo(width - padding, height - padding);

    ctx.stroke();
    
    // Dolgu
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0.1)');
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.shadowBlur = 0; // Sonraki çizimler için gölgeyi sıfırla

  }, [attack, decay, sustain, release]);

  return (
    <div className="w-full h-full bg-gray-900 rounded-lg p-4">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default EnvelopeDisplay;