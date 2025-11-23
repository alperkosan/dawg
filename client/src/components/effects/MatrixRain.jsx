/**
 * MATRIX RAIN EFFECT
 * Digital rain animation for Matrix Code theme
 * Canvas-based falling characters effect
 */

import React, { useEffect, useRef } from 'react';

export const MatrixRain = ({ opacity = 0.8, fontSize = 14, speed = 0.5 }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Set canvas size to window size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Matrix characters - mix of katakana, latin, numbers
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}|;:,.<>?/~`';
    const matrix = chars.split('');

    // Seyrek sütunlar için fontSize'ı artırıyoruz
    const columnSpacing = fontSize * 2; // Her sütun arasında 2x boşluk
    const columns = Math.floor(canvas.width / columnSpacing);
    const drops = Array(columns).fill(1);

    // Draw characters
    const draw = () => {
      // Daha belirgin trail efekti için alpha'yı artırdık
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#00FF41'; // Matrix green
      ctx.font = `${fontSize}px 'Courier New', monospace`;

      // Draw each column
      for (let i = 0; i < drops.length; i++) {
        // Random character
        const text = matrix[Math.floor(Math.random() * matrix.length)];
        const x = i * columnSpacing;
        const y = drops[i] * fontSize;

        // Brighter at the tip
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.98) {
          drops[i] = 0;
        }

        // Daha yumuşak glow efekti
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#00FF41';
        ctx.fillText(text, x, y);

        // Move drop down - speed parametresi ile
        drops[i] += speed;

        // Reset when drop goes off screen - daha sık reset
        if (y > canvas.height && Math.random() > 0.98) {
          drops[i] = 0;
        }
      }
    };

    // Animation loop
    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [fontSize, speed]);

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

export default MatrixRain;
