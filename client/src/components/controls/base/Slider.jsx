/**
 * PROFESSIONAL SLIDER CONTROL (LinearSlider)
 *
 * Horizontal/vertical slider with advanced features
 *
 * Features:
 * - Horizontal/vertical orientation
 * - Bipolar mode (center at 0)
 * - Logarithmic scaling
 * - Tick marks
 * - Center detent (snap to center)
 * - Ghost value support
 * - Category-based theming
 * - RAF optimization
 * - Zero memory leaks
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { useControlTheme } from '../useControlTheme';

export const Slider = ({
  label,
  value = 0,
  min = 0,
  max = 100,
  defaultValue,
  onChange,
  onChangeEnd,

  // NEW: Enhanced props
  orientation = 'horizontal',  // 'horizontal' | 'vertical'
  bipolar = false,             // Center at 0 (-1 to +1)
  logarithmic = false,         // Log scale
  showTicks = false,           // Show tick marks
  tickValues = [],             // Custom tick positions
  centerDetent = false,        // Snap to center
  ghostValue,                  // Ghost value support
  showGhostValue = true,       // Toggle ghost display
  color,                       // Override theme color
  category,                    // Plugin category for theming
  valueFormatter,              // Custom format function

  // Layout props
  width = 200,
  height = 200,
  variant = 'default',
  disabled = false,
  showValue = true,
  unit = '',
  precision = 0,
  className = '',
}) => {
  const { colors } = useControlTheme(variant, category);

  const trackRef = useRef(null);
  const rafRef = useRef(null);
  const latestPosRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const onChangeEndRef = useRef(onChangeEnd);

  useEffect(() => {
    onChangeRef.current = onChange;
    onChangeEndRef.current = onChangeEnd;
  }, [onChange, onChangeEnd]);

  // Color priority: prop > theme > default
  const sliderColor = color || colors.fill;

  // Value to position conversion
  const valueToPosition = useCallback((val) => {
    let normalizedValue;

    if (logarithmic && min > 0) {
      // Logarithmic scaling
      normalizedValue = Math.log(val / min) / Math.log(max / min);
    } else {
      // Linear scaling (works for both bipolar and normal modes)
      // For bipolar (e.g., -12 to +12), this maps -12→0%, 0→50%, +12→100%
      normalizedValue = (val - min) / (max - min);
    }

    return Math.max(0, Math.min(1, normalizedValue)) * 100;
  }, [min, max, logarithmic]);

  // Position to value conversion
  const positionToValue = useCallback((pos) => {
    const normalized = pos / 100;

    if (logarithmic && min > 0) {
      return min * Math.pow(max / min, normalized);
    } else {
      // Linear scaling (works for both bipolar and normal modes)
      return min + normalized * (max - min);
    }
  }, [min, max, logarithmic]);

  const calculateValue = useCallback((clientPos) => {
    if (!trackRef.current) return value;

    const rect = trackRef.current.getBoundingClientRect();
    let pos;

    if (orientation === 'horizontal') {
      pos = Math.max(0, Math.min(100, ((clientPos - rect.left) / rect.width) * 100));
    } else {
      // Vertical: invert so bottom is min
      pos = Math.max(0, Math.min(100, ((rect.bottom - clientPos) / rect.height) * 100));
    }

    let newValue = positionToValue(pos);

    // Center detent (snap to center)
    if (centerDetent && bipolar) {
      const centerPos = 50;
      const distance = Math.abs(pos - centerPos);
      if (distance < 5) { // 5% threshold
        newValue = 0; // Snap to center (0 in bipolar mode)
      }
    }

    return newValue;
  }, [orientation, positionToValue, value, bipolar, centerDetent]);

  const handleMouseMove = useCallback((e) => {
    if (disabled) return;
    const clientPos = orientation === 'horizontal' ? e.clientX : e.clientY;
    latestPosRef.current = clientPos;

    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      onChangeRef.current?.(calculateValue(latestPosRef.current));
      rafRef.current = null;
    });
  }, [disabled, calculateValue, orientation]);

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
    const clientPos = orientation === 'horizontal' ? e.clientX : e.clientY;
    onChangeRef.current?.(calculateValue(clientPos));
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [disabled, calculateValue, handleMouseMove, handleMouseUp, orientation]);

  // Double-click to reset
  const handleDoubleClick = useCallback(() => {
    if (disabled) return;
    const resetValue = defaultValue !== undefined
      ? defaultValue
      : bipolar ? 0 : (min + max) / 2;
    onChange?.(resetValue);
    onChangeEnd?.();
  }, [disabled, defaultValue, bipolar, min, max, onChange, onChangeEnd]);

  // Format display value
  const formatValue = useCallback((val) => {
    if (typeof val !== 'number' || isNaN(val)) return val;
    if (valueFormatter) return valueFormatter(val);
    return `${val.toFixed(precision)}${unit}`;
  }, [precision, unit, valueFormatter]);

  const position = valueToPosition(value);
  const ghostPosition = ghostValue !== undefined ? valueToPosition(ghostValue) : position;
  const showGhost = showGhostValue && ghostValue !== undefined && ghostValue !== value;

  // Generate tick marks
  const ticks = showTicks
    ? (tickValues.length > 0
        ? tickValues.map(v => valueToPosition(v))
        : [0, 25, 50, 75, 100])
    : [];

  // Horizontal slider
  if (orientation === 'horizontal') {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`}>
        {label && (
          <div
            className="text-[10px] font-bold uppercase tracking-wider min-w-[4rem]"
            style={{ color: colors.textMuted }}
          >
            {label}
          </div>
        )}

        <div className="relative" style={{ width }}>
          {/* Tick marks */}
          {showTicks && (
            <div className="absolute -top-2 left-0 right-0 flex justify-between">
              {ticks.map((tick, i) => (
                <div
                  key={i}
                  className="w-px h-2"
                  style={{
                    position: 'absolute',
                    left: `${tick}%`,
                    backgroundColor: colors.textMuted,
                    opacity: 0.3,
                  }}
                />
              ))}
            </div>
          )}

          {/* Center line (bipolar mode) */}
          {bipolar && (
            <div
              className="absolute top-0 bottom-0 w-px"
              style={{
                left: '50%',
                backgroundColor: colors.textMuted,
                opacity: 0.5,
              }}
            />
          )}

          <div
            ref={trackRef}
            className="relative rounded-full"
            style={{
              height: 6,
              backgroundColor: colors.track,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            title={`${label}: ${formatValue(value)}\nDouble-click to reset`}
          >
            {/* Ghost fill */}
            {showGhost && (
              <div
                className="absolute left-0 top-0 bottom-0 rounded-full"
                style={{
                  width: `${ghostPosition}%`,
                  backgroundColor: `${sliderColor}40`,
                  opacity: 0.4,
                }}
              />
            )}

            {/* Active fill */}
            <div
              className="absolute top-0 bottom-0 rounded-full transition-all duration-75"
              style={{
                left: bipolar ? (position < 50 ? `${position}%` : '50%') : '0',
                width: bipolar
                  ? `${Math.abs(position - 50)}%`
                  : `${position}%`,
                backgroundColor: sliderColor,
                boxShadow: `0 0 6px ${colors.fillGlow}`,
              }}
            />

            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 transition-all duration-75"
              style={{
                left: `calc(${position}% - 8px)`,
                backgroundColor: sliderColor,
                borderColor: colors.border,
                boxShadow: `0 2px 4px rgba(0,0,0,0.3), 0 0 6px ${colors.fillGlow}`,
              }}
            />
          </div>
        </div>

        {showValue && (
          <div
            className="text-xs font-mono min-w-[3rem] text-right"
            style={{ color: colors.text }}
          >
            {formatValue(value)}
          </div>
        )}
      </div>
    );
  }

  // Vertical slider
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      {label && (
        <div
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: colors.textMuted }}
        >
          {label}
        </div>
      )}

      <div className="relative" style={{ height }}>
        {/* Tick marks */}
        {showTicks && (
          <div className="absolute -left-2 top-0 bottom-0 flex flex-col-reverse justify-between">
            {ticks.map((tick, i) => (
              <div
                key={i}
                className="h-px w-2"
                style={{
                  position: 'absolute',
                  bottom: `${tick}%`,
                  backgroundColor: colors.textMuted,
                  opacity: 0.3,
                }}
              />
            ))}
          </div>
        )}

        {/* Center line (bipolar mode) */}
        {bipolar && (
          <div
            className="absolute left-0 right-0 h-px"
            style={{
              bottom: '50%',
              backgroundColor: colors.textMuted,
              opacity: 0.5,
            }}
          />
        )}

        <div
          ref={trackRef}
          className="relative rounded-full"
          style={{
            width: 6,
            height,
            backgroundColor: colors.track,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          title={`${label}: ${formatValue(value)}\nDouble-click to reset`}
        >
          {/* Ghost fill */}
          {showGhost && (
            <div
              className="absolute left-0 right-0 bottom-0 rounded-full"
              style={{
                height: `${ghostPosition}%`,
                backgroundColor: `${sliderColor}40`,
                opacity: 0.4,
              }}
            />
          )}

          {/* Active fill */}
          <div
            className="absolute left-0 right-0 rounded-full transition-all duration-75"
            style={{
              bottom: bipolar ? (position < 50 ? `${position}%` : '50%') : '0',
              height: bipolar
                ? `${Math.abs(position - 50)}%`
                : `${position}%`,
              backgroundColor: sliderColor,
              boxShadow: `0 0 6px ${colors.fillGlow}`,
            }}
          />

          {/* Thumb */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 transition-all duration-75"
            style={{
              bottom: `calc(${position}% - 8px)`,
              backgroundColor: sliderColor,
              borderColor: colors.border,
              boxShadow: `0 2px 4px rgba(0,0,0,0.3), 0 0 6px ${colors.fillGlow}`,
            }}
          />
        </div>
      </div>

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

// Alias for backward compatibility
export const LinearSlider = Slider;
