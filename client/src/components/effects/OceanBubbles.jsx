/**
 * OCEAN BUBBLES EFFECT
 * Floating bubbles rising up for Ocean Deep theme
 */

import React, { useEffect, useRef } from 'react';

export const OceanBubbles = ({ opacity = 0.2, count = 15 }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const bubblesRef = useRef([]);

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

    // Initialize bubbles
    const initBubbles = () => {
      bubblesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 2 + Math.random() * 4,
        speed: 0.2 + Math.random() * 0.5,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.03,
      }));
    };
    initBubbles();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      bubblesRef.current.forEach(bubble => {
        // Update position
        bubble.y -= bubble.speed;
        bubble.wobble += bubble.wobbleSpeed;
        const wobbleX = Math.sin(bubble.wobble) * 2;

        // Reset if bubble goes off screen
        if (bubble.y + bubble.radius < 0) {
          bubble.y = canvas.height + bubble.radius;
          bubble.x = Math.random() * canvas.width;
        }

        // Draw bubble
        const gradient = ctx.createRadialGradient(
          bubble.x + wobbleX,
          bubble.y,
          0,
          bubble.x + wobbleX,
          bubble.y,
          bubble.radius
        );
        gradient.addColorStop(0, 'rgba(0, 206, 209, 0.3)');
        gradient.addColorStop(0.5, 'rgba(30, 144, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(30, 144, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(bubble.x + wobbleX, bubble.y, bubble.radius, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(224, 247, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(
          bubble.x + wobbleX - bubble.radius * 0.3,
          bubble.y - bubble.radius * 0.3,
          bubble.radius * 0.3,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });
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
  }, [count]);

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

export default OceanBubbles;
