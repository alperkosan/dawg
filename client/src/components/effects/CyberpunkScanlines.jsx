/**
 * CYBERPUNK SCANLINES EFFECT
 * Animated scanlines with neon pulses for Cyberpunk Neon theme
 */

import React, { useEffect, useRef } from 'react';

export const CyberpunkScanlines = ({ opacity = 0.15, speed = 1 }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const timeRef = useRef(0);

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

    // Scanlines
    const lineHeight = 4;
    const scanlineSpeed = speed * 2;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      timeRef.current += 0.016 * scanlineSpeed;

      // Horizontal scanlines
      for (let y = 0; y < canvas.height; y += lineHeight * 2) {
        const offset = (timeRef.current * 20) % (lineHeight * 2);
        const actualY = (y + offset) % canvas.height;

        ctx.fillStyle = 'rgba(255, 0, 255, 0.05)';
        ctx.fillRect(0, actualY, canvas.width, 1);
      }

      // Occasional bright scan pulse
      const pulseY = (timeRef.current * 100) % canvas.height;
      const gradient = ctx.createLinearGradient(0, pulseY - 20, 0, pulseY + 20);
      gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
      gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.3)');
      gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, pulseY - 20, canvas.width, 40);

      // Vertical neon glitch lines (rare)
      if (Math.random() > 0.98) {
        const glitchX = Math.random() * canvas.width;
        ctx.fillStyle = 'rgba(255, 0, 255, 0.4)';
        ctx.fillRect(glitchX, 0, 2, canvas.height);
      }
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

export default CyberpunkScanlines;
