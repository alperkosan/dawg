import React, { useEffect } from 'react';
import { useThemeStore } from '../store/useThemeStore';

/**
 * Bu bileşen, aktif temayı Zustand store'undan dinler ve
 * tema değişikliklerini CSS değişkenleri olarak document'ın root'una uygular.
 * Uygulamanın en üst katmanında (App.jsx) kullanılmalıdır.
 */
export const ThemeProvider = ({ children }) => {
  const activeTheme = useThemeStore((state) => state.getActiveTheme());

  useEffect(() => {
    if (!activeTheme) return;

    const root = document.documentElement;

    // Renkleri CSS değişkenlerine dönüştür
    for (const [key, value] of Object.entries(activeTheme.colors)) {
      root.style.setProperty(`--color-${key}`, value);
    }
    
    // Diğer stilleri (padding, radius vb.) CSS değişkenlerine dönüştür
    for (const [key, value] of Object.entries(activeTheme.styles)) {
      root.style.setProperty(key, value);
    }

  }, [activeTheme]); // Sadece aktif tema değiştiğinde çalışır

  return <>{children}</>;
};
