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

  // Horizontal layout (left → right)
  const leftPadding = 10;
  const rightPadding = 10;
  const attackWidth = actualWidth * 0.3;   // 30% width reserved for attack
  const decayWidth = actualWidth * 0.3;    // 30% width reserved for decay
  const sustainStartX = leftPadding + attackWidth + decayWidth;
  const sustainEndX = actualWidth - rightPadding; // release spans this range
  const releaseWidth = Math.max(1, sustainEndX - sustainStartX);

  const attackX = (attack / maxTime) * attackWidth;
  const decayX = attackX + (decay / maxTime) * decayWidth;
  const sustainX = sustainStartX;
  const releaseX = sustainEndX;
  const sustainY = actualHeight - 10 - (sustain * (actualHeight - 20));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Get fresh theme colors
    const textColor = getComputedColor('--zenith-text-primary', '#FFFFFF');
    const valueColor = getComputedColor('--zenith-text-tertiary', '#6B7280');
    const monoFont = getComputedColor('--zenith-font-mono', 'monospace');

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

    // Draw grid
    ctx.strokeStyle = actualGridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * actualHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(actualWidth, y);
      ctx.stroke();
    }

    // Draw envelope curve
    ctx.strokeStyle = actualColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(leftPadding, actualHeight - 10); // Start point (0, 0)

    // Attack
    ctx.lineTo(leftPadding + attackX, 10); // Peak

    // Decay
    ctx.lineTo(leftPadding + decayX, sustainY); // Sustain level

    // Sustain (flat line)
    ctx.lineTo(sustainX, sustainY);

    // Release
    ctx.lineTo(releaseX, actualHeight - 10);

    ctx.stroke();

    // Draw control points
    const drawPoint = (x, y, isActive, label) => {
      ctx.fillStyle = isActive ? textColor : actualColor;
      ctx.strokeStyle = isActive ? actualColor : textColor;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(x, y, isActive ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Label
      if (isActive || hovering === label) {
        ctx.fillStyle = textColor;
        ctx.font = `10px ${monoFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(label.toUpperCase(), x, y - 12);
      }
    };

    drawPoint(leftPadding + attackX, 10, dragging === 'attack' || hovering === 'attack', 'A');
    drawPoint(leftPadding + decayX, sustainY, dragging === 'decay' || hovering === 'decay', 'D');
    drawPoint(sustainX, sustainY, dragging === 'sustain' || hovering === 'sustain', 'S');
    drawPoint(releaseX, actualHeight - 10, dragging === 'release' || hovering === 'release', 'R');

    // Draw values
    ctx.fillStyle = valueColor;
    ctx.font = `9px ${monoFont}`;
    ctx.textAlign = 'left';
    ctx.fillText(`A: ${(attack * 1000).toFixed(0)}ms`, 5, actualHeight - 5);
    ctx.fillText(`D: ${(decay * 1000).toFixed(0)}ms`, 70, actualHeight - 5);
    ctx.fillText(`S: ${(sustain * 100).toFixed(0)}%`, 135, actualHeight - 5);
    ctx.fillText(`R: ${(release * 1000).toFixed(0)}ms`, 195, actualHeight - 5);

  }, [attack, decay, sustain, release, actualWidth, actualHeight, actualColor, actualBgColor, actualGridColor, dragging, hovering, attackX, decayX, sustainX, sustainY, releaseX]);

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
      { name: 'attack', x: leftPadding + attackX, y: 10 },
      { name: 'decay', x: leftPadding + decayX, y: sustainY },
      { name: 'sustain', x: sustainX, y: sustainY },
      { name: 'release', x: releaseX, y: actualHeight - 10 }
    ];

    let closest = null;
    let minDist = 15; // Minimum distance to activate

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

      if (dragging === 'attack') {
        const ratio = Math.max(0, Math.min(1, (pos.x - leftPadding) / attackWidth));
        const newAttack = Math.max(0.001, Math.min(maxTime, ratio * maxTime));
        newValues.attack = newAttack;
      } else if (dragging === 'decay') {
        // Decay measured from end of attack segment
        const localX = Math.max(0, Math.min(decayWidth, (pos.x - leftPadding - attackX)));
        const ratio = Math.max(0, Math.min(1, localX / decayWidth));
        const newDecay = Math.max(0.001, Math.min(maxTime, ratio * maxTime));
        newValues.decay = newDecay;
      } else if (dragging === 'sustain') {
        const newSustain = Math.max(0, Math.min(1, 1 - (pos.y - 10) / (actualHeight - 20)));
        newValues.sustain = newSustain;
      } else if (dragging === 'release') {
        // Release measured from sustain segment start to right padding
        const clampedX = Math.max(sustainStartX, Math.min(sustainEndX, pos.x));
        const localX = clampedX - sustainStartX;
        const ratio = Math.max(0, Math.min(1, localX / releaseWidth));
        const newRelease = Math.max(0.001, Math.min(maxTime, ratio * maxTime));
        newValues.release = newRelease;
      }

      onChange?.(newValues);
    } else {
      // Hover detection
      const point = findClosestPoint(pos.x, pos.y);
      setHovering(point);
    }
  }, [dragging, attack, decay, sustain, release, attackX, actualWidth, actualHeight, onChange]);

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
