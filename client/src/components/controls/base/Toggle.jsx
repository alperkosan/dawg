/**
 * TOGGLE CONTROL
 *
 * Animated toggle switch
 */

import React from 'react';
import { useControlTheme } from '../useControlTheme';

export const Toggle = ({
  label,
  value = false,
  onChange,
  variant = 'default',
  disabled = false,
  size = 'md',
  className = '',
}) => {
  const { colors, styles } = useControlTheme(variant);

  const sizes = {
    sm: { width: 36, height: 20, thumbSize: 16 },
    md: { width: 48, height: 24, thumbSize: 20 },
    lg: { width: 60, height: 30, thumbSize: 26 },
  };

  const { width, height, thumbSize } = sizes[size];

  return (
    <label className={`inline-flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      {label && (
        <span className="text-sm" style={{ color: colors.text }}>
          {label}
        </span>
      )}
      <div
        className="relative rounded-full transition-all"
        style={{
          width,
          height,
          backgroundColor: value ? colors.fill : colors.track,
          boxShadow: value ? `0 0 8px ${colors.fillGlow}` : 'none',
          transition: styles['--transition-fast'],
        }}
        onClick={() => !disabled && onChange?.(!value)}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-full transition-all"
          style={{
            width: thumbSize,
            height: thumbSize,
            left: value ? `calc(100% - ${thumbSize + 2}px)` : 2,
            backgroundColor: value ? '#000' : colors.indicator,
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            transition: styles['--transition-fast'],
          }}
        />
      </div>
    </label>
  );
};
