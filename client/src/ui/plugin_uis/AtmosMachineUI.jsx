import React, { useRef, useEffect, useCallback } from 'react';
import { PresetManager } from '../PresetManager';

// Yardımcı fonksiyonlar
const lerp = (a, b, n) => (1 - n) * a + n * b;
const map = (value, start1, stop1, start2, stop2) => {
  return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
};

// Parçacık sınıfı
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

export const AtmosMachineUI = ({ effect, onChange, definition }) => {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const mouse = useRef({ x: 9999, y: 9999, down: false });
  const animationFrameId = useRef(null);

  const { size, movement, width: stereoWidth, character } = effect.settings;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    mouse.current.x = canvas.width / 2 / dpr;
    mouse.current.y = canvas.height / 2 / dpr;

    const animate = () => {
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        if (particles.current.length < 200 * size) {
            for(let i = 0; i < 5; i++) {
                particles.current.push(new Particle(mouse.current.x, mouse.current.y));
            }
        }
        for (let i = particles.current.length - 1; i >= 0; i--) {
            const p = particles.current[i];
            p.update(mouse.current, movement);
            if (p.life <= 0) {
                particles.current.splice(i, 1);
                continue;
            }
            const hue = map(p.pos.x, 0, canvas.width / dpr, 180, 280);
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

    return () => {
        cancelAnimationFrame(animationFrameId.current);
    };
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
    if (e.button === 2) {
        onChange('character', Math.min(1, character + 0.1));
    }
  };
  
  const handleMouseUp = () => { mouse.current.down = false; };
  
  // Değişiklikler bu iki fonksiyonda
  const handleWheel = useCallback((e) => {
    e.preventDefault(); // Artık hata vermeyecek
    const change = e.deltaY * -0.0005;
    // 'movement'ı effect.settings'den okumak yerine doğrudan state'den alıyoruz ki en güncel hali olsun.
    const currentMovement = effect.settings.movement;
    const newMovement = Math.max(0, Math.min(1, currentMovement + change));
    onChange('movement', newMovement);
  }, [onChange, effect.settings.movement]); // Bağımlılıklara ekliyoruz

  // YENİ: Event Listener'ı manuel olarak ekleyen useEffect
  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (canvasElement) {
      // Olay dinleyicisini 'passive: false' seçeneği ile ekliyoruz
      canvasElement.addEventListener('wheel', handleWheel, { passive: false });
    }
    // Component kaldırıldığında olay dinleyicisini temizliyoruz
    return () => {
      if (canvasElement) {
        canvasElement.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel]); // handleWheel fonksiyonu değiştiğinde bu effect'i yeniden çalıştır

  return (
    <div className="relative w-full h-full p-4 bg-gray-900 rounded-lg flex flex-col items-center justify-between border-2 border-gray-950">
      <PresetManager 
        pluginType={definition.type} 
        effect={effect}
        factoryPresets={definition.presets} 
        onChange={onChange}
      />
      <div className="w-full text-center pt-8">
        <h3 className="text-xl font-bold text-indigo-300" style={{ textShadow: '2px 2px #000' }}>{definition.type}</h3>
        <p className="text-xs text-center text-gray-400 max-w-xs px-2 mt-1 mx-auto">{definition.story}</p>
      </div>

      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        // onWheel prop'unu buradan kaldırdık
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-48 rounded-lg cursor-pointer bg-gray-900 border border-gray-700"
      />
      
      <div className="flex justify-around gap-4 text-xs text-gray-400 w-full pt-2">
          <span>Sürükle: Boyut</span>
          <span>Tekerlek: Hareket</span>
          <span>Sağ Tık: Karakter</span>
      </div>
    </div>
  );
};