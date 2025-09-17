import React, { useEffect } from 'react';
import { useThemeStore } from '../store/useThemeStore';

export const ThemeProvider = ({ children }) => {
  const activeTheme = useThemeStore(state => state.getActiveTheme());

  useEffect(() => {
    const root = document.documentElement;
    
    // Renkleri CSS değişkenleri olarak ayarla
    Object.entries(activeTheme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Stilleri CSS değişkenleri olarak ayarla
    Object.entries(activeTheme.styles).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Ek CSS değişkenleri ekle (component-specific)
    // Hover ve active state'ler için
    root.style.setProperty('--hover-opacity', '0.1');
    root.style.setProperty('--active-opacity', '0.2');
    root.style.setProperty('--disabled-opacity', '0.5');
    
    // Gölgeler
    root.style.setProperty('--shadow-sm', '0 1px 2px rgba(0, 0, 0, 0.05)');
    root.style.setProperty('--shadow-md', '0 4px 6px rgba(0, 0, 0, 0.1)');
    root.style.setProperty('--shadow-lg', '0 10px 15px rgba(0, 0, 0, 0.15)');
    root.style.setProperty('--shadow-xl', '0 20px 25px rgba(0, 0, 0, 0.2)');
    
    // Animasyon süreleri
    root.style.setProperty('--transition-fast', '0.15s');
    root.style.setProperty('--transition-base', '0.2s');
    root.style.setProperty('--transition-slow', '0.3s');
    
    // Component-specific renkler
    root.style.setProperty('--playhead-color', activeTheme.colors.accent);
    root.style.setProperty('--grid-line-color', activeTheme.colors.border + '40');
    root.style.setProperty('--hover-bg', activeTheme.colors.primary + '20');
    root.style.setProperty('--active-bg', activeTheme.colors.primary + '30');
    root.style.setProperty('--selection-bg', activeTheme.colors.accent + '30');
    
  }, [activeTheme]);

  return children;
};