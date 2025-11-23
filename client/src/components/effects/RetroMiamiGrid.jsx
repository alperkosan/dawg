/**
 * RETRO MIAMI GRID EFFECT
 * 80s perspective grid with neon glow for Retro Miami theme
 */

import React, { useEffect, useRef } from 'react';

export const RetroMiamiGrid = ({ opacity = 0.12, speed = 0.5 }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      offsetRef.current += speed;
      if (offsetRef.current > 40) offsetRef.current = 0;

      const centerY = canvas.height * 0.7;
      const gridSize = 40;
      const lines = 20;

      // Perspective grid
      ctx.strokeStyle = 'rgba(255, 20, 147, 0.3)'; // Hot pink
      ctx.lineWidth = 1;

      // Horizontal lines (perspective)
      for (let i = 0; i < lines; i++) {
        const y = centerY + (i * gridSize) - offsetRef.current;
        if (y > canvas.height) continue;

        const scale = (y - centerY + canvas.height * 0.5) / canvas.height;
        const width = canvas.width * scale;
        const x1 = (canvas.width - width) / 2;
        const x2 = x1 + width;

        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
      }

      // Vertical lines (perspective)
      ctx.strokeStyle = 'rgba(0, 217, 255, 0.25)'; // Cyan
      for (let i = -lines; i <= lines; i++) {
        const spacing = canvas.width / (lines * 2);
        const x = canvas.width / 2 + i * spacing;

        ctx.beginPath();
        ctx.moveTo(x, centerY);
        ctx.lineTo(canvas.width / 2 + i * spacing * 2, canvas.height);
        ctx.stroke();
      }

      // Horizon glow
      const gradient = ctx.createLinearGradient(0, centerY - 50, 0, centerY + 50);
      gradient.addColorStop(0, 'rgba(255, 20, 147, 0)');
      gradient.addColorStop(0.5, 'rgba(255, 20, 147, 0.15)');
      gradient.addColorStop(1, 'rgba(0, 217, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, centerY - 50, canvas.width, 100);
    };

    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [speed]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: opacity,
        zIndex: 0,
      }}
    />
  );
};

export default RetroMiamiGrid;
