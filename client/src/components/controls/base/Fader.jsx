/**
 * FADER CONTROL
 *
 * Vertical fader with RAF-optimized drag handling
 *
 * Features:
 * - Smooth vertical drag
 * - Click to set value
 * - dB scale support
 * - Theme-aware
 * - No memory leaks
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { useControlTheme } from '../useControlTheme';

export const Fader = ({
  label,
  value = 0,
  min = -60,
  max = 6,
  defaultValue = 0,
  onChange,
  onChangeEnd,
  height = 120,
  width = 40,
  variant = 'default',
  disabled = false,
  showValue = true,
  unit = 'dB',
  precision = 1,
  className = '',
}) => {
  const { colors } = useControlTheme(variant);

  const trackRef = useRef(null);
  const rafRef = useRef(null);
  const latestYRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const onChangeEndRef = useRef(onChangeEnd);

  // Keep callbacks updated
  useEffect(() => {
    onChangeRef.current = onChange;
    onChangeEndRef.current = onChangeEnd;
  }, [onChange, onChangeEnd]);

  // Value to position (0-100%)
  const valueToPosition = useCallback((val) => {
    const clampedVal = Math.max(min, Math.min(max, val));
    return ((clampedVal - min) / (max - min)) * 100;
  }, [min, max]);

  // Calculate value from Y position
  const calculateValue = useCallback((clientY) => {
    if (!trackRef.current) return value;

    const rect = trackRef.current.getBoundingClientRect();
    const pos = 100 - Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return min + (pos / 100) * (max - min);
  }, [min, max, value]);

  // Mouse move handler with RAF throttling
  const handleMouseMove = useCallback((e) => {
    if (disabled) return;

    latestYRef.current = e.clientY;

    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      const newValue = calculateValue(latestYRef.current);
      onChangeRef.current?.(newValue);
      rafRef.current = null;
    });
  }, [disabled, calculateValue]);

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    // Cancel RAF
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    onChangeEndRef.current?.();

    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  // Mouse down handler
  const handleMouseDown = useCallback((e) => {
    if (disabled) return;

    e.preventDefault();

    // Set value immediately on click
    const newValue = calculateValue(e.clientY);
    onChangeRef.current?.(newValue);

    // Setup drag
    latestYRef.current = e.clientY;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [disabled, calculateValue, handleMouseMove, handleMouseUp]);

  // Double click to reset
  const handleDoubleClick = useCallback(() => {
    if (disabled) return;
    onChange?.(defaultValue);
    onChangeEnd?.();
  }, [disabled, defaultValue, onChange, onChangeEnd]);

  const position = valueToPosition(value);

  return (
    <div
      className={`inline-flex flex-col items-center gap-2 select-none ${className}`}
      role="slider"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-disabled={disabled}
    >
      {/* Label */}
      {label && (
        <div
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: colors.textMuted }}
        >
          {label}
        </div>
      )}

      {/* Fader track and thumb */}
      <div
        className="relative flex items-center justify-center"
        style={{ width, height }}
      >
        <div
          ref={trackRef}
          className={`relative bg-opacity-50 rounded-full ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-ns-resize'}`}
          style={{
            width: width * 0.3,
            height: '100%',
            backgroundColor: colors.track,
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        >
          {/* Fill (from bottom) */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-full transition-all"
            style={{
              height: `${position}%`,
              backgroundColor: colors.fill,
              boxShadow: `0 0 8px ${colors.fillGlow}`,
            }}
          />

          {/* Thumb */}
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded transition-all"
            style={{
              bottom: `calc(${position}% - 6px)`,
              width: width * 0.8,
              height: 12,
              backgroundColor: colors.indicator,
              border: `2px solid ${colors.border}`,
              boxShadow: `0 2px 4px rgba(0,0,0,0.3), 0 0 8px ${colors.fillGlow}`,
            }}
          />
        </div>
      </div>

      {/* Value display */}
      {showValue && (
        <div
          className="text-xs font-mono"
          style={{ color: colors.text }}
        >
          {value > 0 ? '+' : ''}{value.toFixed(precision)}{unit}
        </div>
      )}
    </div>
  );
};
