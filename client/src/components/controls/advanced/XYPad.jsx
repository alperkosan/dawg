/**
 * XY PAD CONTROL
 *
 * 2D control surface with RAF optimization
 *
 * Perfect for:
 * - Filter cutoff + resonance
 * - Pan + width
 * - Any 2D parameter control
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { useControlTheme } from '../useControlTheme';

export const XYPad = ({
  label,
  valueX = 0.5,
  valueY = 0.5,
  minX = 0,
  maxX = 1,
  minY = 0,
  maxY = 1,
  onChangeX,
  onChangeY,
  onChange, // onChange({ x, y })
  onChangeEnd,
  size = 200,
  variant = 'default',
  disabled = false,
  labelX = 'X',
  labelY = 'Y',
  className = '',
}) => {
  const { colors } = useControlTheme(variant);

  const padRef = useRef(null);
  const rafRef = useRef(null);
  const latestPosRef = useRef({ x: 0, y: 0 });
  const onChangeXRef = useRef(onChangeX);
  const onChangeYRef = useRef(onChangeY);
  const onChangeRef = useRef(onChange);
  const onChangeEndRef = useRef(onChangeEnd);

  useEffect(() => {
    onChangeXRef.current = onChangeX;
    onChangeYRef.current = onChangeY;
    onChangeRef.current = onChange;
    onChangeEndRef.current = onChangeEnd;
  }, [onChangeX, onChangeY, onChange, onChangeEnd]);

  const valuesToPosition = useCallback(() => {
    const x = ((valueX - minX) / (maxX - minX)) * 100;
    const y = (1 - (valueY - minY) / (maxY - minY)) * 100; // Invert Y
    return { x, y };
  }, [valueX, valueY, minX, maxX, minY, maxY]);

  const calculateValues = useCallback((clientX, clientY) => {
    if (!padRef.current) return { x: valueX, y: valueY };

    const rect = padRef.current.getBoundingClientRect();
    const posX = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const posY = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    const x = minX + (posX / 100) * (maxX - minX);
    const y = maxY - (posY / 100) * (maxY - minY); // Invert Y

    return { x, y };
  }, [minX, maxX, minY, maxY, valueX, valueY]);

  const handleMouseMove = useCallback((e) => {
    if (disabled) return;

    latestPosRef.current = { x: e.clientX, y: e.clientY };

    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      const { x, y } = calculateValues(latestPosRef.current.x, latestPosRef.current.y);

      onChangeXRef.current?.(x);
      onChangeYRef.current?.(y);
      onChangeRef.current?.({ x, y });

      rafRef.current = null;
    });
  }, [disabled, calculateValues]);

  const handleMouseUp = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    onChangeEndRef.current?.();

    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e) => {
    if (disabled) return;

    e.preventDefault();

    const { x, y } = calculateValues(e.clientX, e.clientY);
    onChangeXRef.current?.(x);
    onChangeYRef.current?.(y);
    onChangeRef.current?.({ x, y });

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [disabled, calculateValues, handleMouseMove, handleMouseUp]);

  const position = valuesToPosition();

  return (
    <div className={`inline-flex flex-col gap-2 ${className}`}>
      {label && (
        <div className="text-xs font-bold uppercase" style={{ color: colors.textMuted }}>
          {label}
        </div>
      )}

      <div
        ref={padRef}
        className="relative rounded-lg"
        style={{
          width: size,
          height: size,
          backgroundColor: colors.background,
          border: `1px solid ${colors.border}`,
          cursor: disabled ? 'not-allowed' : 'crosshair',
          opacity: disabled ? 0.5 : 1,
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Grid lines */}
        <svg className="absolute inset-0 pointer-events-none" width={size} height={size}>
          <line x1="0" y1={size / 2} x2={size} y2={size / 2} stroke={colors.border} strokeWidth="1" opacity="0.3" />
          <line x1={size / 2} y1="0" x2={size / 2} y2={size} stroke={colors.border} strokeWidth="1" opacity="0.3" />
        </svg>

        {/* Crosshair */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="w-4 h-4 rounded-full border-2"
            style={{
              backgroundColor: colors.fill,
              borderColor: colors.indicator,
              boxShadow: `0 0 12px ${colors.fillGlow}, 0 2px 4px rgba(0,0,0,0.3)`,
            }}
          />
        </div>
      </div>

      {/* Value labels */}
      <div className="flex justify-between text-xs font-mono" style={{ color: colors.text }}>
        <span>{labelX}: {valueX.toFixed(2)}</span>
        <span>{labelY}: {valueY.toFixed(2)}</span>
      </div>
    </div>
  );
};
