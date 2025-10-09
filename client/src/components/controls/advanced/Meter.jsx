/**
 * PROFESSIONAL METER CONTROL
 *
 * Audio level meter with peak hold and category theming
 *
 * Features:
 * - Peak hold with configurable timeout
 * - Color zones (green/orange/red)
 * - Horizontal/vertical orientation
 * - Category-based theming
 * - Optional label
 * - VU-style display
 */

import React, { useEffect, useRef } from 'react';
import { useControlTheme } from '../useControlTheme';

export const Meter = ({
  label,                   // NEW: Meter label
  value = 0,               // 0-1 range
  peakValue = 0,
  min = 0,
  max = 1,
  orientation = 'vertical', // 'vertical' | 'horizontal'
  width = 20,
  height = 120,
  variant = 'default',
  category,                // NEW: Plugin category for theming
  color,                   // NEW: Custom color override
  showPeak = true,
  peakHoldTime = 1000,
  showScale = false,       // NEW: Show dB scale
  className = '',
}) => {
  const { colors } = useControlTheme(variant, category);
  const peakTimeoutRef = useRef(null);
  const displayPeakRef = useRef(peakValue);

  // Peak hold logic
  useEffect(() => {
    if (peakValue > displayPeakRef.current) {
      displayPeakRef.current = peakValue;
    }

    if (peakTimeoutRef.current) {
      clearTimeout(peakTimeoutRef.current);
    }

    peakTimeoutRef.current = setTimeout(() => {
      displayPeakRef.current = Math.max(value, peakValue);
    }, peakHoldTime);

    return () => {
      if (peakTimeoutRef.current) {
        clearTimeout(peakTimeoutRef.current);
      }
    };
  }, [value, peakValue, peakHoldTime]);

  const percentage = ((value - min) / (max - min)) * 100;
  const peakPercentage = ((displayPeakRef.current - min) / (max - min)) * 100;

  // Color based on level
  const getColor = (level) => {
    if (level > 90) return '#ef4444'; // Red
    if (level > 70) return '#f59e0b'; // Orange
    return '#22c55e'; // Green
  };

  const meterColor = color || getColor(percentage);

  if (orientation === 'horizontal') {
    return (
      <div className={`inline-flex flex-col gap-1 ${className}`}>
        {label && (
          <div
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: colors.textMuted }}
          >
            {label}
          </div>
        )}
        <div
          className="relative rounded"
          style={{
            width,
            height,
            backgroundColor: colors.track,
          }}
        >
          <div
            className="absolute left-0 top-0 bottom-0 transition-all duration-75 rounded"
            style={{
              width: `${percentage}%`,
              backgroundColor: meterColor,
              boxShadow: `0 0 8px ${meterColor}40`,
            }}
          />
          {showPeak && (
            <div
              className="absolute top-0 bottom-0 w-0.5 transition-all duration-200"
              style={{
                left: `${peakPercentage}%`,
                backgroundColor: '#fff',
                boxShadow: '0 0 4px rgba(255,255,255,0.8)',
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      {label && (
        <div
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: colors.textMuted }}
        >
          {label}
        </div>
      )}
      <div
        className="relative rounded"
        style={{
          width,
          height,
          backgroundColor: colors.track,
        }}
      >
        <div
          className="absolute left-0 right-0 bottom-0 transition-all duration-75 rounded"
          style={{
            height: `${percentage}%`,
            backgroundColor: meterColor,
            boxShadow: `0 0 8px ${meterColor}40`,
          }}
        />
        {showPeak && (
          <div
            className="absolute left-0 right-0 h-0.5 transition-all duration-200"
            style={{
              bottom: `${peakPercentage}%`,
              backgroundColor: '#fff',
              boxShadow: '0 0 4px rgba(255,255,255,0.8)',
            }}
          />
        )}
      </div>
    </div>
  );
};
