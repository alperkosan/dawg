import React, { useRef, useEffect, useCallback } from 'react';

// --- KANVAS VE ANİMASYON MANTIĞI (DEĞİŞMEDİ) ---
const lerp = (a, b, n) => (1 - n) * a + n * b;
const map = (value, start1, stop1, start2, stop2) => {
  return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
};

class Particle {
  constructor(x, y) {
    this.pos = { x, y };
    this.vel = { x: 0, y: 0 };
    this.acc = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
    this.life = 1;
    this.size = Math.random() * 3 + 1;
  }
  update(mouse, movement) {
    let mouseForce = { x: (this.pos.x - mouse.x) * 0.0001, y: (this.pos.y - mouse.y) * 0.0001 };
    this.acc.x -= mouseForce.x;
    this.acc.y -= mouseForce.y;
    this.vel.x += this.acc.x * 0.1;
    this.vel.y += this.acc.y * 0.1;
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this.vel.x *= 0.96 + (movement * 0.02);
    this.vel.y *= 0.96 + (movement * 0.02);
    this.life -= 0.005;
  }
}
// --- KANVAS VE ANİMASYON MANTIĞI SONU ---

export const AtmosMachineUI = ({ trackId, effect, onChange, definition }) => {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const mouse = useRef({ x: 9999, y: 9999, down: false });
  const animationFrameId = useRef(null);

  const { size, movement, width: stereoWidth, character } = effect.settings;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    mouse.current.x = rect.width / 2;
    mouse.current.y = rect.height / 2;

    const animate = () => {
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.globalAlpha = 1;
        if (particles.current.length < 200 * size) {
            for(let i = 0; i < 5; i++) particles.current.push(new Particle(mouse.current.x, mouse.current.y));
        }
        for (let i = particles.current.length - 1; i >= 0; i--) {
            const p = particles.current[i];
            p.update(mouse.current, movement);
            if (p.life <= 0) {
                particles.current.splice(i, 1);
                continue;
            }
            const hue = map(p.pos.x, 0, rect.width, 180, 280);
            const saturation = 80 + (character * 20);
            const lightness = p.life * 60;
            const alpha = lerp(0, 0.8, p.life);
            ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
            const particleSize = p.size * lerp(1, 3, size);
            const zPos = Math.sin(p.life * Math.PI) * (stereoWidth * 50);
            ctx.beginPath();
            ctx.arc(p.pos.x + zPos, p.pos.y, particleSize, 0, Math.PI * 2);
            ctx.fill();
        }
        animationFrameId.current = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [size, movement, stereoWidth, character]);

  const handleMouseMove = (e) => {
    const rect = e.target.getBoundingClientRect();
    mouse.current.x = e.clientX - rect.left;
    mouse.current.y = e.clientY - rect.top;
    if (mouse.current.down) {
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const distance = Math.hypot(mouse.current.x - centerX, mouse.current.y - centerY);
      const newSize = map(distance, 0, Math.max(centerX, centerY), 0, 1);
      onChange('size', Math.max(0, Math.min(1, newSize)));
    }
  };

  const handleMouseDown = (e) => {
    mouse.current.down = true;
    if (e.button === 2) onChange('character', Math.min(1, character + 0.1));
  };
  
  const handleMouseUp = () => { mouse.current.down = false; };
  
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const change = e.deltaY * -0.0005;
    const currentMovement = effect.settings.movement;
    const newMovement = Math.max(0, Math.min(1, currentMovement + change));
    onChange('movement', newMovement);
  }, [onChange, effect.settings.movement]);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (canvasElement) {
      canvasElement.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (canvasElement) canvasElement.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-48 rounded-lg cursor-pointer bg-gray-900 border border-white/10"
      />
      <div className="flex justify-around gap-4 text-xs text-white/50 w-full">
          <span>Sürükle: Boyut</span>
          <span>Tekerlek: Hareket</span>
          <span>Sağ Tık: Karakter</span>
      </div>
    </div>
  );
};