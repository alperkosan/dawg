/**
 * UNIFIED THEME HOOK FOR CONTROLS
 *
 * Provides theme-aware styling for all controls
 * Supports both variant-based and category-based theming
 *
 * Usage:
 *   const theme = useControlTheme('default', 'texture-lab');
 */

import { useMemo } from 'react';
import { useThemeStore } from '@/store/useThemeStore';

// Plugin category palettes (from PLUGIN_DESIGN_THEMES.md)
const CATEGORY_PALETTES = {
  'texture-lab': {
    primary: '#FF6B35',
    secondary: '#F7931E',
    accent: '#FFC857',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d1810 100%)',
    track: 'rgba(255, 107, 53, 0.1)',
    fill: '#FF6B35',
    fillGlow: 'rgba(255, 107, 53, 0.4)',
    text: '#ffffff',
    textMuted: 'rgba(255, 255, 255, 0.6)',
  },
  'dynamics-forge': {
    primary: '#00A8E8',
    secondary: '#007EA7',
    accent: '#00D9FF',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #0a1a2d 100%)',
    track: 'rgba(0, 168, 232, 0.1)',
    fill: '#00A8E8',
    fillGlow: 'rgba(0, 168, 232, 0.4)',
    text: '#ffffff',
    textMuted: 'rgba(255, 255, 255, 0.6)',
  },
  'spectral-weave': {
    primary: '#9B59B6',
    secondary: '#8E44AD',
    accent: '#C39BD3',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #1a0a2d 100%)',
    track: 'rgba(155, 89, 182, 0.1)',
    fill: '#9B59B6',
    fillGlow: 'rgba(155, 89, 182, 0.4)',
    text: '#ffffff',
    textMuted: 'rgba(255, 255, 255, 0.6)',
  },
  'modulation-machines': {
    primary: '#2ECC71',
    secondary: '#27AE60',
    accent: '#58D68D',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #0a2d1a 100%)',
    track: 'rgba(46, 204, 113, 0.1)',
    fill: '#2ECC71',
    fillGlow: 'rgba(46, 204, 113, 0.4)',
    text: '#ffffff',
    textMuted: 'rgba(255, 255, 255, 0.6)',
  },
  'spacetime-chamber': {
    primary: '#E74C3C',
    secondary: '#C0392B',
    accent: '#EC7063',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d0a0a 100%)',
    track: 'rgba(231, 76, 60, 0.1)',
    fill: '#E74C3C',
    fillGlow: 'rgba(231, 76, 60, 0.4)',
    text: '#ffffff',
    textMuted: 'rgba(255, 255, 255, 0.6)',
  },
};

// Helper: Map plugin category names to theme category keys
const CATEGORY_MAP = {
  'The Texture Lab': 'texture-lab',
  'The Dynamics Forge': 'dynamics-forge',
  'The Spectral Weave': 'spectral-weave',
  'Modulation Machines': 'modulation-machines',
  'The Spacetime Chamber': 'spacetime-chamber',
};

/**
 * Get category theme key from plugin category name
 * @param {string} pluginCategory - Category from pluginConfig
 * @returns {string} Theme category key
 */
export const getCategoryKey = (pluginCategory) => {
  return CATEGORY_MAP[pluginCategory] || null;
};

/**
 * Get all available category palettes
 * @returns {Object} Category palettes object
 */
export const getCategoryPalettes = () => CATEGORY_PALETTES;

export const useControlTheme = (variant = 'default', category = null) => {
  const theme = useThemeStore((state) => state.getActiveTheme());

  return useMemo(() => {
    const { colors } = theme;

    // If category is provided, use category palette
    if (category && CATEGORY_PALETTES[category]) {
      const categoryColors = CATEGORY_PALETTES[category];
      return {
        colors: {
          background: categoryColors.background,
          backgroundHover: colors.surfaceRaised || 'rgba(255, 255, 255, 0.05)',
          track: categoryColors.track,
          fill: categoryColors.fill,
          fillGlow: categoryColors.fillGlow,
          text: categoryColors.text,
          textMuted: categoryColors.textMuted,
          indicator: categoryColors.primary,
          border: categoryColors.track,
          primary: categoryColors.primary,
          secondary: categoryColors.secondary,
          accent: categoryColors.accent,
        },
        styles: theme.styles,
      };
    }

    // Otherwise use variant-based theming (legacy support)
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
        primary: colors.primary,
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
        primary: colors.accent,
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
        primary: '#ef4444',
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
        primary: '#22c55e',
      },
      mixer: {
        background: colors.surface,
        backgroundHover: colors.surfaceRaised,
        track: 'rgba(255, 255, 255, 0.1)',
        fill: colors.primary,
        fillGlow: `${colors.primary}60`,
        text: colors.text,
        textMuted: colors.textMuted,
        indicator: '#ffffff',
        border: 'rgba(255, 255, 255, 0.2)',
        primary: colors.primary,
      },
    };

    return {
      colors: variants[variant] || variants.default,
      styles: theme.styles,
    };
  }, [theme, variant, category]);
};
