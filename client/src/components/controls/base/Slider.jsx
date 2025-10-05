/**
 * SLIDER CONTROL
 *
 * Horizontal slider with RAF optimization
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { useControlTheme } from '../useControlTheme';

export const Slider = ({
  label,
  value = 0,
  min = 0,
  max = 100,
  onChange,
  onChangeEnd,
  width = 200,
  variant = 'default',
  disabled = false,
  showValue = true,
  unit = '',
  precision = 0,
  className = '',
}) => {
  const { colors } = useControlTheme(variant);

  const trackRef = useRef(null);
  const rafRef = useRef(null);
  const latestXRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const onChangeEndRef = useRef(onChangeEnd);

  useEffect(() => {
    onChangeRef.current = onChange;
    onChangeEndRef.current = onChangeEnd;
  }, [onChange, onChangeEnd]);

  const valueToPosition = useCallback((val) => {
    return ((val - min) / (max - min)) * 100;
  }, [min, max]);

  const calculateValue = useCallback((clientX) => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    return min + (pos / 100) * (max - min);
  }, [min, max, value]);

  const handleMouseMove = useCallback((e) => {
    if (disabled) return;
    latestXRef.current = e.clientX;

    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      onChangeRef.current?.(calculateValue(latestXRef.current));
      rafRef.current = null;
    });
  }, [disabled, calculateValue]);

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
    onChangeRef.current?.(calculateValue(e.clientX));
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [disabled, calculateValue, handleMouseMove, handleMouseUp]);

  const position = valueToPosition(value);

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {label && <div className="text-xs" style={{ color: colors.textMuted }}>{label}</div>}
      <div
        ref={trackRef}
        className="relative rounded-full"
        style={{
          width,
          height: 6,
          backgroundColor: colors.track,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
        onMouseDown={handleMouseDown}
      >
        <div
          className="absolute left-0 top-0 bottom-0 rounded-full"
          style={{
            width: `${position}%`,
            backgroundColor: colors.fill,
            boxShadow: `0 0 6px ${colors.fillGlow}`,
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2"
          style={{
            left: `calc(${position}% - 8px)`,
            backgroundColor: colors.indicator,
            borderColor: colors.border,
            boxShadow: `0 2px 4px rgba(0,0,0,0.3), 0 0 6px ${colors.fillGlow}`,
          }}
        />
      </div>
      {showValue && (
        <div className="text-xs font-mono min-w-[3rem] text-right" style={{ color: colors.text }}>
          {value.toFixed(precision)}{unit}
        </div>
      )}
    </div>
  );
};
