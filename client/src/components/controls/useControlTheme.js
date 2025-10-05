/**
 * THEME HOOK FOR CONTROLS
 *
 * Provides theme-aware styling for all controls
 */

import { useMemo } from 'react';
import { useThemeStore } from '@/store/useThemeStore';

export const useControlTheme = (variant = 'default') => {
  const theme = useThemeStore((state) => state.getActiveTheme());

  return useMemo(() => {
    const { colors } = theme;

    const variants = {
      default: {
        background: colors.surface,
        backgroundHover: colors.surfaceRaised,
        track: colors.border,
        fill: colors.primary,
        fillGlow: `${colors.primary}40`,
        text: colors.text,
        textMuted: colors.textMuted,
        indicator: colors.primary,
        border: colors.borderSubtle,
      },
      accent: {
        background: colors.surface,
        backgroundHover: colors.surfaceRaised,
        track: colors.border,
        fill: colors.accent,
        fillGlow: `${colors.accent}40`,
        text: colors.text,
        textMuted: colors.textMuted,
        indicator: colors.accent,
        border: colors.borderSubtle,
      },
      danger: {
        background: colors.surface,
        backgroundHover: colors.surfaceRaised,
        track: colors.border,
        fill: '#ef4444',
        fillGlow: '#ef444440',
        text: colors.text,
        textMuted: colors.textMuted,
        indicator: '#ef4444',
        border: colors.borderSubtle,
      },
      success: {
        background: colors.surface,
        backgroundHover: colors.surfaceRaised,
        track: colors.border,
        fill: '#22c55e',
        fillGlow: '#22c55e40',
        text: colors.text,
        textMuted: colors.textMuted,
        indicator: '#22c55e',
        border: colors.borderSubtle,
      },
    };

    return {
      colors: variants[variant] || variants.default,
      styles: theme.styles,
    };
  }, [theme, variant]);
};
