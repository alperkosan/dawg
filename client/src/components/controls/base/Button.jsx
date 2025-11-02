/**
 * BUTTON CONTROL
 *
 * Theme-aware button with variants
 */

import React from 'react';
import { useControlTheme } from '../useControlTheme';

export const Button = ({
  label,
  active = false,
  onClick,
  variant = 'default',
  size = 'md',
  disabled = false,
  className = '',
  children,
}) => {
  const { colors, styles } = useControlTheme(variant);

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizes[size]}
        font-semibold rounded-lg
        transition-all duration-150
        active:scale-95
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      style={{
        backgroundColor: active ? colors.fill : colors.background,
        color: active ? '#000' : colors.text,
        border: `1px solid ${active ? colors.fill : colors.border}`,
        boxShadow: active ? `0 0 12px ${colors.fillGlow}, 0 2px 4px rgba(0,0,0,0.3)` : 'none',
        transition: styles?.['--transition-fast'] || '150ms ease-out',
      }}
    >
      {children || label}
    </button>
  );
};
