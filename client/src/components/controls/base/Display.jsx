/**
 * DISPLAY CONTROL
 *
 * Digital display for values, labels, waveforms etc
 */

import React from 'react';
import { useControlTheme } from '../useControlTheme';

export const Display = ({
  value = '',
  label,
  size = 'md',
  variant = 'default',
  monospace = true,
  align = 'center',
  className = '',
}) => {
  const { colors, styles } = useControlTheme(variant);

  const sizes = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-3',
  };

  const alignments = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.textMuted }}>
          {label}
        </div>
      )}
      <div
        className={`
          ${sizes[size]}
          ${alignments[align]}
          ${monospace ? 'font-mono' : 'font-sans'}
          rounded
        `}
        style={{
          backgroundColor: colors.background,
          color: colors.text,
          border: `1px solid ${colors.border}`,
        }}
      >
        {value}
      </div>
    </div>
  );
};
