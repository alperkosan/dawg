import React, { useEffect } from 'react';
import { useThemeStore } from '@/store/useThemeStore';

/**
 * ThemeProvider - Zenith Design System Integration
 * Dynamically applies theme tokens to CSS custom properties
 */
export const ThemeProvider = ({ children }) => {
  const activeTheme = useThemeStore(state => state.getActiveTheme());

  useEffect(() => {
    const root = document.documentElement;

    // 1. Apply legacy color variables (backward compatibility)
    Object.entries(activeTheme.colors).forEach(([key, value]) => {
      const cssVarName = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVarName, value);
    });

    // 2. Apply Zenith design tokens
    if (activeTheme.zenith) {
      Object.entries(activeTheme.zenith).forEach(([key, value]) => {
        // Zenith tokens use --zenith- prefix
        const cssVarName = `--zenith-${key}`;
        root.style.setProperty(cssVarName, value);
      });
    }

    console.log(`🎨 Theme applied: ${activeTheme.name}`, {
      colors: Object.keys(activeTheme.colors).length,
      zenithTokens: activeTheme.zenith ? Object.keys(activeTheme.zenith).length : 0
    });

  }, [activeTheme]);

  return children;
};