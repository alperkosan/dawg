/**
 * FL STUDIO STYLE OSCILLATOR PANEL
 *
 * Compact visual panel for oscillator controls with waveform preview
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import './OscillatorPanel.css';

// Helper to get computed CSS variable color
const getComputedColor = (varName, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const computed = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return computed || fallback;
};

export const OscillatorPanel = ({
  index = 0,
  enabled = true,
  waveform = 'sawtooth',
  level = 0.5,
  detune = 0,
  octave = 0,
  onChange,
  width = 160,
  height = 80,
}) => {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const waveforms = ['sawtooth', 'square', 'triangle', 'sine'];

  // Use Zenith theme colors
  const themeColors = [
    getComputedColor('--zenith-accent-cool', '#4A9EFF'),
    getComputedColor('--zenith-accent-warm', '#FF6B9D'),
    getComputedColor('--zenith-accent-yellow', '#FFB84D'),
    getComputedColor('--zenith-accent-green', '#6BCF7F'),
  ];
  const color = themeColors[index % themeColors.length];

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Background - use Zenith theme colors with hover/drag feedback
    let bgColor = enabled
      ? getComputedColor('--zenith-bg-tertiary', '#1a1a2e')
      : getComputedColor('--zenith-bg-primary', '#0f0f1a');

    // Add glow effect on hover/drag
    if (enabled && (isHovering || isDragging)) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      // Subtle glow overlay
      const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width/2);
      gradient.addColorStop(0, `${color}20`); // 20 = ~12% opacity
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    }

    if (!enabled) {
      ctx.fillStyle = getComputedColor('--zenith-text-tertiary', '#666');
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DISABLED', width / 2, height / 2 + 4);
      return;
    }

    // Draw waveform
    const waveHeight = height * 0.4;
    const waveY = height * 0.3;
    const cycles = 2;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const t = (x / width) * cycles * Math.PI * 2;
      let y;

      switch (waveform) {
        case 'sine':
          y = Math.sin(t);
          break;
        case 'square':
          y = Math.sign(Math.sin(t));
          break;
        case 'sawtooth':
          y = 2 * ((t / (2 * Math.PI)) % 1) - 1;
          break;
        case 'triangle':
          y = 2 * Math.abs(2 * ((t / (2 * Math.PI)) % 1) - 1) - 1;
          break;
        default:
          y = 0;
      }

      const canvasY = waveY + y * waveHeight * level;
      if (x === 0) {
        ctx.moveTo(x, canvasY);
      } else {
        ctx.lineTo(x, canvasY);
      }
    }
    ctx.stroke();

    // Draw level indicator with smooth animation
    const levelBarHeight = 4;
    const levelBarY = height - 12;

    // Background
    ctx.fillStyle = getComputedColor('--zenith-bg-secondary', '#333');
    ctx.fillRect(5, levelBarY, width - 10, levelBarHeight);

    // Level fill with gradient
    const levelGradient = ctx.createLinearGradient(5, 0, width - 5, 0);
    levelGradient.addColorStop(0, color);
    levelGradient.addColorStop(1, `${color}CC`); // Slightly transparent at end
    ctx.fillStyle = levelGradient;
    ctx.fillRect(5, levelBarY, (width - 10) * level, levelBarHeight);

    // Dragging indicator
    if (isDragging) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(4, levelBarY - 1, width - 8, levelBarHeight + 2);
    }

    // Draw labels - use Zenith text colors
    ctx.fillStyle = getComputedColor('--zenith-text-tertiary', '#888');
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${waveform.toUpperCase()}`, 5, 10);
    ctx.fillText(`${(level * 100).toFixed(0)}%`, 5, height - 2);

    ctx.textAlign = 'right';
    if (detune !== 0) {
      ctx.fillText(`${detune > 0 ? '+' : ''}${detune.toFixed(1)}¢`, width - 5, 10);
    }
    if (octave !== 0) {
      ctx.fillText(`${octave > 0 ? '+' : ''}${octave}oct`, width - 5, height - 2);
    }

  }, [waveform, level, detune, octave, enabled, width, height, color, isDragging, isHovering]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Click on waveform area = cycle waveform
    if (y < height * 0.7) {
      const currentIndex = waveforms.indexOf(waveform);
      const nextWaveform = waveforms[(currentIndex + 1) % waveforms.length];
      onChange?.({ waveform: nextWaveform });
    }
    // Click on level bar = start dragging
    else {
      setIsDragging(true);
      const newLevel = Math.max(0, Math.min(1, (x - 5) / (width - 10)));
      onChange?.({ level: newLevel });
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newLevel = Math.max(0, Math.min(1, (x - 5) / (width - 10)));
    onChange?.({ level: newLevel });
  }, [isDragging, width, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setIsDragging(false);
  };

  // Global mouse events for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className={`oscillator-panel ${!enabled ? 'oscillator-panel--disabled' : ''}`}>
      <div className="oscillator-panel__header">
        <span className="oscillator-panel__index">OSC {index + 1}</span>
        <button
          className={`oscillator-panel__toggle ${enabled ? 'active' : ''}`}
          onClick={() => onChange?.({ enabled: !enabled })}
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
      />
    </div>
  );
};
