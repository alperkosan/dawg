/**
 * KNOB CONTROL
 *
 * Modern, performant rotary knob with RAF throttling
 *
 * Features:
 * - Vertical drag interaction
 * - Shift for fine control
 * - Double-click to reset
 * - Logarithmic/linear scaling
 * - Theme-aware
 * - ARIA accessible
 * - Zero memory leaks
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useControlTheme } from '../useControlTheme';

export const Knob = ({
  label,
  value = 0,
  min = 0,
  max = 100,
  defaultValue = 50,
  onChange,
  onChangeEnd,
  size = 60,
  unit = '',
  precision = 0,
  logarithmic = false,
  variant = 'default',
  disabled = false,
  showValue = true,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const { colors, styles } = useControlTheme(variant);

  // Refs for RAF optimization (prevent stacking)
  const dragStartRef = useRef({ y: 0, value: 0 });
  const rafRef = useRef(null);
  const latestEventRef = useRef({ clientY: 0, shiftKey: false });
  const onChangeRef = useRef(onChange);
  const onChangeEndRef = useRef(onChangeEnd);

  // Keep callbacks up to date
  useEffect(() => {
    onChangeRef.current = onChange;
    onChangeEndRef.current = onChangeEnd;
  }, [onChange, onChangeEnd]);

  // Value to angle conversion (-135° to +135°)
  const valueToAngle = useCallback((val) => {
    if (typeof val !== 'number') return -135;
    const valueInRange = Math.max(min, Math.min(max, val));

    let normalizedValue;
    if (logarithmic && min > 0) {
      normalizedValue = Math.log(valueInRange / min) / Math.log(max / min);
    } else {
      normalizedValue = (valueInRange - min) / (max - min);
    }

    return -135 + Math.max(0, Math.min(1, normalizedValue)) * 270;
  }, [min, max, logarithmic]);

  // Format display value
  const formatValue = useCallback((val) => {
    if (typeof val !== 'number' || isNaN(val)) return val;
    return `${val.toFixed(precision)}${unit}`;
  }, [precision, unit]);

  // Mouse move handler (stable, doesn't change on re-render)
  const handleMouseMove = useCallback((e) => {
    if (disabled) return;

    // Store latest event data (no re-render)
    latestEventRef.current = { clientY: e.clientY, shiftKey: e.shiftKey };

    // Only schedule if not already scheduled (prevent stacking)
    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      const deltaY = dragStartRef.current.y - latestEventRef.current.clientY;
      const range = max - min;
      const sensitivity = logarithmic ? 0.002 : (latestEventRef.current.shiftKey ? 0.001 : 0.005);

      let newValue;
      if (logarithmic && min > 0) {
        const factor = Math.pow(1.01, -deltaY);
        newValue = dragStartRef.current.value * factor;
      } else {
        newValue = dragStartRef.current.value + (deltaY * range * sensitivity);
      }

      onChangeRef.current?.(Math.max(min, Math.min(max, newValue)));
      rafRef.current = null;
    });
  }, [min, max, logarithmic, disabled]);

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = 'default';

    // Cancel any pending RAF
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Call onChangeEnd callback
    onChangeEndRef.current?.();

    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  // Mouse down handler
  const handleMouseDown = useCallback((e) => {
    if (disabled || typeof value !== 'number') return;

    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { y: e.clientY, value };
    document.body.style.cursor = 'ns-resize';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [value, disabled, handleMouseMove, handleMouseUp]);

  // Double click to reset
  const handleDoubleClick = useCallback(() => {
    if (disabled || typeof value !== 'number') return;
    onChange?.(defaultValue);
    onChangeEnd?.();
  }, [value, defaultValue, disabled, onChange, onChangeEnd]);

  const angle = valueToAngle(value);
  const arcLength = Math.PI * (size - 8);

  return (
    <div
      className={`inline-flex flex-col items-center gap-1 select-none ${className}`}
      role="slider"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-disabled={disabled}
      title={`${label}: ${formatValue(value)}\nShift+Drag for precision\nDouble-click to reset`}
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

      {/* Knob SVG */}
      <div
        style={{ width: size, height: size }}
        className={`relative flex items-center justify-center ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-ns-resize'}`}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          {/* Track (background arc) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 4}
            stroke={colors.track}
            strokeWidth="4"
            fill="none"
            strokeDasharray={`${arcLength * 0.75} ${arcLength * 0.25}`}
            transform={`rotate(135 ${size / 2} ${size / 2})`}
          />

          {/* Fill (active arc) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 4}
            stroke={colors.fill}
            strokeWidth="4"
            fill="none"
            strokeDasharray={arcLength}
            strokeDashoffset={arcLength * (1 - (((angle + 135) / 270) * 0.75))}
            strokeLinecap="round"
            transform={`rotate(135 ${size / 2} ${size / 2})`}
            style={{
              transition: isDragging ? 'none' : 'stroke-dashoffset 0.1s ease-out',
              filter: `drop-shadow(0 0 4px ${colors.fillGlow})`,
            }}
          />
        </svg>

        {/* Indicator line */}
        <div
          className="absolute w-1 rounded-full"
          style={{
            height: size * 0.3,
            top: size * 0.15,
            backgroundColor: colors.indicator,
            transform: `rotate(${angle}deg)`,
            transformOrigin: `50% ${size * 0.35}px`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        />
      </div>

      {/* Value display */}
      {showValue && (
        <div
          className="text-xs font-mono"
          style={{ color: colors.text }}
        >
          {formatValue(value)}
        </div>
      )}
    </div>
  );
};
