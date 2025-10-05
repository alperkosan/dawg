/**
 * ENVELOPE EDITOR
 *
 * ADSR envelope editor with visual curve
 *
 * Perfect for:
 * - Amplitude envelopes
 * - Filter envelopes
 * - Modulation envelopes
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { useControlTheme } from '../useControlTheme';

export const EnvelopeEditor = ({
  attack = 0.1,
  decay = 0.2,
  sustain = 0.7,
  release = 0.3,
  onAttackChange,
  onDecayChange,
  onSustainChange,
  onReleaseChange,
  onChange, // onChange({ attack, decay, sustain, release })
  maxTime = 2, // Max time in seconds
  width = 300,
  height = 150,
  variant = 'default',
  disabled = false,
  className = '',
}) => {
  const { colors } = useControlTheme(variant);

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const dragTypeRef = useRef(null); // 'attack' | 'decay' | 'sustain' | 'release'
  const latestPosRef = useRef({ x: 0, y: 0 });

  const onAttackChangeRef = useRef(onAttackChange);
  const onDecayChangeRef = useRef(onDecayChange);
  const onSustainChangeRef = useRef(onSustainChange);
  const onReleaseChangeRef = useRef(onReleaseChange);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onAttackChangeRef.current = onAttackChange;
    onDecayChangeRef.current = onDecayChange;
    onSustainChangeRef.current = onSustainChange;
    onReleaseChangeRef.current = onReleaseChange;
    onChangeRef.current = onChange;
  }, [onAttackChange, onDecayChange, onSustainChange, onReleaseChange, onChange]);

  // Draw envelope
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = width;
    const h = height;

    // Clear
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Calculate points
    const attackX = (attack / maxTime) * w;
    const decayX = attackX + (decay / maxTime) * w;
    const sustainY = h - (sustain * h);
    const totalX = decayX + (release / maxTime) * w;

    // Draw envelope curve
    ctx.strokeStyle = colors.fill;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, h); // Start at bottom

    // Attack
    ctx.lineTo(attackX, 0); // Up to peak

    // Decay
    ctx.lineTo(decayX, sustainY); // Down to sustain

    // Sustain (horizontal line)
    const sustainWidth = Math.max(w * 0.3, totalX < w ? w - totalX : 0);
    ctx.lineTo(decayX + sustainWidth, sustainY);

    // Release
    const releaseX = (release / maxTime) * w;
    ctx.lineTo(decayX + sustainWidth + releaseX, h); // Down to zero

    ctx.stroke();

    // Draw control points
    const points = [
      { x: attackX, y: 0, type: 'attack', label: 'A' },
      { x: decayX, y: sustainY, type: 'decay', label: 'D' },
      { x: decayX, y: sustainY, type: 'sustain', label: 'S' },
      { x: decayX + sustainWidth + releaseX, y: h, type: 'release', label: 'R' },
    ];

    points.forEach(({ x, y, type, label }) => {
      // Point
      ctx.fillStyle = colors.indicator;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Glow
      ctx.shadowColor = colors.fillGlow;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Label
      ctx.fillStyle = colors.text;
      ctx.font = '12px monospace';
      ctx.fillText(label, x - 4, y - 12);
    });
  }, [attack, decay, sustain, release, maxTime, width, height, colors]);

  // Determine which parameter is being dragged
  const getHitTest = useCallback((x, y) => {
    const attackX = (attack / maxTime) * width;
    const decayX = attackX + (decay / maxTime) * width;
    const sustainY = height - (sustain * height);

    const hitRadius = 15;

    if (Math.abs(x - attackX) < hitRadius && Math.abs(y - 0) < hitRadius) {
      return 'attack';
    }
    if (Math.abs(x - decayX) < hitRadius && Math.abs(y - sustainY) < hitRadius) {
      return 'decay';
    }
    if (Math.abs(y - sustainY) < hitRadius && x > decayX - 20 && x < decayX + 50) {
      return 'sustain';
    }
    if (Math.abs(y - height) < hitRadius && x > decayX + 20) {
      return 'release';
    }

    return null;
  }, [attack, decay, sustain, release, maxTime, width, height]);

  const handleMouseMove = useCallback((e) => {
    if (disabled || !dragTypeRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    latestPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      const { x, y } = latestPosRef.current;
      const type = dragTypeRef.current;

      if (type === 'attack') {
        const newAttack = Math.max(0.001, Math.min(maxTime, (x / width) * maxTime));
        onAttackChangeRef.current?.(newAttack);
        onChangeRef.current?.({ attack: newAttack, decay, sustain, release });
      } else if (type === 'decay') {
        const attackX = (attack / maxTime) * width;
        const newDecay = Math.max(0.001, Math.min(maxTime, ((x - attackX) / width) * maxTime));
        onDecayChangeRef.current?.(newDecay);
        onChangeRef.current?.({ attack, decay: newDecay, sustain, release });
      } else if (type === 'sustain') {
        const newSustain = Math.max(0, Math.min(1, 1 - (y / height)));
        onSustainChangeRef.current?.(newSustain);
        onChangeRef.current?.({ attack, decay, sustain: newSustain, release });
      } else if (type === 'release') {
        const decayX = (attack / maxTime) * width + (decay / maxTime) * width;
        const newRelease = Math.max(0.001, Math.min(maxTime, ((x - decayX) / width) * maxTime));
        onReleaseChangeRef.current?.(newRelease);
        onChangeRef.current?.({ attack, decay, sustain, release: newRelease });
      }

      rafRef.current = null;
    });
  }, [disabled, attack, decay, sustain, release, maxTime, width, height]);

  const handleMouseUp = useCallback(() => {
    dragTypeRef.current = null;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e) => {
    if (disabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hitType = getHitTest(x, y);
    if (hitType) {
      e.preventDefault();
      dragTypeRef.current = hitType;
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
  }, [disabled, getHitTest, handleMouseMove, handleMouseUp]);

  return (
    <div className={`inline-flex flex-col gap-2 ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        className={`rounded-lg border ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{
          borderColor: colors.border,
        }}
      />

      {/* Value readouts */}
      <div className="grid grid-cols-4 gap-2 text-xs font-mono" style={{ color: colors.text }}>
        <div className="text-center">
          <div style={{ color: colors.textMuted }}>A</div>
          <div>{(attack * 1000).toFixed(0)}ms</div>
        </div>
        <div className="text-center">
          <div style={{ color: colors.textMuted }}>D</div>
          <div>{(decay * 1000).toFixed(0)}ms</div>
        </div>
        <div className="text-center">
          <div style={{ color: colors.textMuted }}>S</div>
          <div>{(sustain * 100).toFixed(0)}%</div>
        </div>
        <div className="text-center">
          <div style={{ color: colors.textMuted }}>R</div>
          <div>{(release * 1000).toFixed(0)}ms</div>
        </div>
      </div>
    </div>
  );
};
