import React, { useEffect } from 'react';
import { useThemeStore } from '../store/useThemeStore';

export const ThemeProvider = ({ children }) => {
  const activeTheme = useThemeStore(state => state.getActiveTheme());

  useEffect(() => {
    const root = document.documentElement;
    
    // Gelen temanın tüm renk ve stil değişkenlerini CSS'e uygula
    Object.entries(activeTheme.colors).forEach(([key, value]) => {
      // Değişken ismini camelCase'den kebab-case'e çevir (örn: backgroundDeep -> --color-background-deep)
      const cssVarName = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVarName, value);
    });

    Object.entries(activeTheme.styles).forEach(([key, value]) => {
      // Stil değişkenleri zaten doğru formatta
      root.style.setProperty(key, value);
    });

  }, [activeTheme]);

  return children;
};