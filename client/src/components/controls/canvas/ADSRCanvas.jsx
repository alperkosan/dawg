/**
 * FL STUDIO STYLE ADSR ENVELOPE CANVAS
 *
 * Interactive canvas-based ADSR envelope with visual feedback
 * Click and drag to adjust attack, decay, sustain, release
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import './ADSRCanvas.css';

export const ADSRCanvas = ({
  attack = 0.01,
  decay = 0.1,
  sustain = 0.7,
  release = 0.3,
  onChange,
  onChangeEnd,
  width = 280,
  height = 120,
  color = null, // Will use CSS variable
  backgroundColor = null,
  gridColor = null,
}) => {
  // Get colors from CSS variables (Zenith theme)
  const getComputedColor = (varName, fallback) => {
    if (typeof window === 'undefined') return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
  };

  const actualColor = color || getComputedColor('--zenith-accent-cool', '#4ECDC4');
  const actualBgColor = backgroundColor || getComputedColor('--zenith-bg-secondary', '#151922');
  const actualGridColor = gridColor || getComputedColor('--zenith-border-subtle', 'rgba(255, 255, 255, 0.05)');
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null); // 'attack', 'decay', 'sustain', 'release'
  const [hovering, setHovering] = useState(null);
  const [actualWidth, setActualWidth] = useState(width);
  const [actualHeight, setActualHeight] = useState(height);

  // Handle resize to make canvas responsive
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: containerWidth } = entry.contentRect;
        setActualWidth(containerWidth || width);
        // Keep aspect ratio
        setActualHeight(((containerWidth || width) * height) / width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [width, height]);

  // Normalize values for display (0-1 range to canvas coordinates)
  const maxTime = 3; // Maximum time in seconds for A, D, R

  // Linear Time Layout
  // We calculate a total duration to view, ensuring a minimum duration for usability.
  // The sustain phase is given a visual duration (e.g., 20% of the view or a fixed time)
  // so it doesn't disappear if we only have A, D, R.

  const sustainVisualDuration = 0.5; // Visual duration for sustain in seconds
  const totalDuration = attack + decay + release + sustainVisualDuration;
  const minDuration = 2.0; // Minimum view duration in seconds
  const viewDuration = Math.max(totalDuration * 1.1, minDuration); // Add 10% padding

  const scale = actualWidth / viewDuration; // pixels per second

  const attackX = attack * scale;
  const decayX = attackX + decay * scale;
  const sustainStartX = decayX;
  const sustainEndX = sustainStartX + sustainVisualDuration * scale;
  const releaseX = sustainEndX + release * scale;

  const sustainY = actualHeight - 10 - (sustain * (actualHeight - 20));

  // Sustain handle position (midpoint of sustain phase)
  const sustainHandleX = sustainStartX + (sustainEndX - sustainStartX) / 2;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Get fresh theme colors
    const textColor = getComputedColor('--zenith-text-primary', '#FFFFFF');
    const valueColor = getComputedColor('--zenith-text-tertiary', '#6B7280');
    const monoFont = getComputedColor('--zenith-font-mono', 'monospace');
    const accentColor = actualColor;

    // Set canvas size for retina displays
    canvas.width = actualWidth * dpr;
    canvas.height = actualHeight * dpr;
    canvas.style.width = `${actualWidth}px`;
    canvas.style.height = `${actualHeight}px`;
    // Reset any previous transforms before applying DPR scale
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = actualBgColor;
    ctx.fillRect(0, 0, actualWidth, actualHeight);

    // Draw grid (Time based)
    ctx.strokeStyle = actualGridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Vertical lines (every 0.5s or 1s depending on viewDuration)
    const timeStep = viewDuration > 5 ? 1 : 0.5;
    for (let t = timeStep; t < viewDuration; t += timeStep) {
      const x = t * scale;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, actualHeight);
    }

    // Horizontal lines
    for (let i = 1; i < 4; i++) {
      const y = (i / 4) * actualHeight;
      ctx.moveTo(0, y);
      ctx.lineTo(actualWidth, y);
    }
    ctx.stroke();

    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, actualHeight);
    gradient.addColorStop(0, `${accentColor}40`); // 25% opacity
    gradient.addColorStop(1, `${accentColor}05`); // ~2% opacity

    // Draw envelope path for fill
    ctx.beginPath();
    ctx.moveTo(0, actualHeight - 10); // Start at 0
    ctx.lineTo(attackX, 10); // Attack Peak
    ctx.lineTo(decayX, sustainY); // Decay End / Sustain Start
    ctx.lineTo(sustainEndX, sustainY); // Sustain End
    ctx.lineTo(releaseX, actualHeight - 10); // Release End
    ctx.lineTo(releaseX, actualHeight); // Bottom right
    ctx.lineTo(0, actualHeight); // Bottom left
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw envelope line
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(0, actualHeight - 10);
    ctx.lineTo(attackX, 10);
    ctx.lineTo(decayX, sustainY);
    ctx.lineTo(sustainEndX, sustainY);
    ctx.lineTo(releaseX, actualHeight - 10);
    ctx.stroke();

    // Draw control points
    const drawPoint = (x, y, isActive, label) => {
      ctx.fillStyle = isActive ? textColor : actualBgColor;
      ctx.strokeStyle = isActive ? accentColor : textColor;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(x, y, isActive ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Label
      if (isActive || hovering === label) {
        ctx.fillStyle = textColor;
        ctx.font = `bold 10px ${monoFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(label.toUpperCase(), x, y - 12);
      }
    };

    drawPoint(attackX, 10, dragging === 'attack' || hovering === 'attack', 'A');
    drawPoint(decayX, sustainY, dragging === 'decay' || hovering === 'decay', 'D');
    // Sustain handle is at the middle of sustain phase
    drawPoint(sustainHandleX, sustainY, dragging === 'sustain' || hovering === 'sustain', 'S');
    // Release handle is at the end of release phase
    drawPoint(releaseX, actualHeight - 10, dragging === 'release' || hovering === 'release', 'R');

    // Draw values text
    ctx.fillStyle = valueColor;
    ctx.font = `10px ${monoFont}`;
    ctx.textAlign = 'left';

    const formatTime = (t) => t < 1 ? `${(t * 1000).toFixed(0)}ms` : `${t.toFixed(2)}s`;

    ctx.fillText(`A: ${formatTime(attack)}`, 10, actualHeight - 6);
    ctx.fillText(`D: ${formatTime(decay)}`, 80, actualHeight - 6);
    ctx.fillText(`S: ${(sustain * 100).toFixed(0)}%`, 150, actualHeight - 6);
    ctx.fillText(`R: ${formatTime(release)}`, 220, actualHeight - 6);

  }, [attack, decay, sustain, release, actualWidth, actualHeight, actualColor, actualBgColor, actualGridColor, dragging, hovering, attackX, decayX, sustainStartX, sustainY, releaseX, sustainEndX, sustainHandleX, scale, viewDuration]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const findClosestPoint = (mouseX, mouseY) => {
    const points = [
      { name: 'attack', x: attackX, y: 10 },
      { name: 'decay', x: decayX, y: sustainY },
      { name: 'sustain', x: sustainHandleX, y: sustainY }, // Sustain handle at midpoint
      { name: 'release', x: releaseX, y: actualHeight - 10 }
    ];

    let closest = null;
    let minDist = 20; // Increased hit area

    points.forEach(point => {
      const dist = Math.sqrt(Math.pow(mouseX - point.x, 2) + Math.pow(mouseY - point.y, 2));
      if (dist < minDist) {
        minDist = dist;
        closest = point.name;
      }
    });

    return closest;
  };

  const handleMouseDown = (e) => {
    const pos = getMousePos(e);
    const point = findClosestPoint(pos.x, pos.y);
    if (point) {
      setDragging(point);
      e.preventDefault();
    }
  };

  const handleMouseMove = useCallback((e) => {
    const pos = getMousePos(e);

    if (dragging) {
      const newValues = { attack, decay, sustain, release };

      // Convert mouse X to time
      const timeAtMouse = Math.max(0, pos.x / scale);

      if (dragging === 'attack') {
        // Attack is simply time at mouse
        newValues.attack = Math.min(maxTime, timeAtMouse);
      } else if (dragging === 'decay') {
        // Decay is time at mouse minus attack time
        newValues.decay = Math.max(0.001, Math.min(maxTime, timeAtMouse - attack));
      } else if (dragging === 'sustain') {
        // Sustain is vertical only
        const newSustain = Math.max(0, Math.min(1, 1 - (pos.y - 10) / (actualHeight - 20)));
        newValues.sustain = newSustain;
      } else if (dragging === 'release') {
        // Release is time at mouse minus end of sustain
        // Note: sustainEndX depends on scale, which depends on total duration...
        // But visually, the user is dragging the end point.
        // The start of release is at (attack + decay + sustainVisualDuration)
        const releaseStartTime = attack + decay + sustainVisualDuration;
        newValues.release = Math.max(0.001, Math.min(maxTime, timeAtMouse - releaseStartTime));
      }

      onChange?.(newValues);
    } else {
      // Hover detection
      const point = findClosestPoint(pos.x, pos.y);
      setHovering(point);
    }
  }, [dragging, attack, decay, sustain, release, scale, actualHeight, onChange, maxTime, sustainVisualDuration]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      onChangeEnd?.();
      setDragging(null);
    }
  }, [dragging, onChangeEnd]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="adsr-canvas" ref={containerRef}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovering(null)}
        style={{ cursor: dragging ? 'grabbing' : (hovering ? 'grab' : 'default') }}
      />
    </div>
  );
};
