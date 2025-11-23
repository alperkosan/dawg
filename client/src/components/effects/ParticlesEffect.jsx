/**
 * UNIVERSAL PARTICLES EFFECT
 * Flexible particle system for various themes
 * Supports: stars, snowflakes, petals, fireflies, etc.
 */

import React, { useEffect, useRef } from 'react';

export const ParticlesEffect = ({
  opacity = 0.2,
  count = 50,
  type = 'stars', // 'stars', 'snow', 'petals', 'fireflies', 'sparkles'
  color = '#FFFFFF',
  secondaryColor = null,
  speed = 1,
  size = { min: 1, max: 3 },
}) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);

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

    // Initialize particles
    const initParticles = () => {
      particlesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: size.min + Math.random() * (size.max - size.min),
        speedX: (Math.random() - 0.5) * speed * 0.5,
        speedY: Math.random() * speed * 0.5 + 0.1,
        opacity: 0.3 + Math.random() * 0.7,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
      }));
    };
    initParticles();

    const drawStar = (particle) => {
      // Twinkling stars
      const twinkle = Math.sin(particle.pulse) * 0.3 + 0.7;
      ctx.shadowBlur = particle.size * 3;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = particle.opacity * twinkle;

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      // Cross glow
      ctx.beginPath();
      ctx.moveTo(particle.x - particle.size * 2, particle.y);
      ctx.lineTo(particle.x + particle.size * 2, particle.y);
      ctx.moveTo(particle.x, particle.y - particle.size * 2);
      ctx.lineTo(particle.x, particle.y + particle.size * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    const drawSnowflake = (particle) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = particle.opacity;

      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);

      // Simple snowflake shape
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 * i) / 6);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, particle.size * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
      ctx.globalAlpha = 1;
    };

    const drawPetal = (particle) => {
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.globalAlpha = particle.opacity;

      // Petal shape
      ctx.fillStyle = secondaryColor || color;
      ctx.beginPath();
      ctx.ellipse(0, 0, particle.size * 1.5, particle.size, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      ctx.globalAlpha = 1;
    };

    const drawFirefly = (particle) => {
      const glow = Math.sin(particle.pulse) * 0.5 + 0.5;
      ctx.shadowBlur = particle.size * 8 * glow;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = particle.opacity * glow;

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    const drawSparkle = (particle) => {
      const sparkle = Math.sin(particle.pulse) * 0.5 + 0.5;
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.globalAlpha = particle.opacity * sparkle;

      // Diamond shape
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -particle.size * 2);
      ctx.lineTo(particle.size, 0);
      ctx.lineTo(0, particle.size * 2);
      ctx.lineTo(-particle.size, 0);
      ctx.closePath();
      ctx.fill();

      // Glow
      ctx.shadowBlur = particle.size * 4;
      ctx.shadowColor = color;
      ctx.stroke();

      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach(particle => {
        // Update position
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        particle.rotation += particle.rotationSpeed;
        particle.pulse += particle.pulseSpeed;

        // Wrap around
        if (particle.x < -10) particle.x = canvas.width + 10;
        if (particle.x > canvas.width + 10) particle.x = -10;
        if (particle.y > canvas.height + 10) {
          particle.y = -10;
          particle.x = Math.random() * canvas.width;
        }

        // Draw based on type
        switch (type) {
          case 'stars':
            drawStar(particle);
            break;
          case 'snow':
            drawSnowflake(particle);
            break;
          case 'petals':
            drawPetal(particle);
            break;
          case 'fireflies':
            drawFirefly(particle);
            break;
          case 'sparkles':
            drawSparkle(particle);
            break;
          default:
            drawStar(particle);
        }
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
  }, [count, type, color, secondaryColor, speed, size.min, size.max]);

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

export default ParticlesEffect;
