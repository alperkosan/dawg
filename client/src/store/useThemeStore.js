// src/store/useThemeStore.js - Değişiklik yok.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

// Her tema için tutarlı bir yapı oluşturan yardımcı fonksiyon
const createTheme = (name, colors, styles) => ({
  id: uuidv4(),
  name,
  colors: {
    // Varsayılan renkler
    backgroundDeep: colors.backgroundDeep || '#121212',
    background: colors.background || '#1A1A1A',
    surface: colors.surface || '#242424',
    surfaceRaised: colors.surfaceRaised || '#2C2C2C',
    border: colors.border || '#3A3A3A',
    borderSubtle: colors.borderSubtle || '#2A2A2A',
    primary: colors.primary || '#FFD700',
    accent: colors.accent || '#FF00FF',
    text: colors.text || '#E0E0E0',
    textMuted: colors.textMuted || '#888888',
    textHeading: colors.textHeading || '#FFFFFF',
    ...colors,
  },
  styles: {
    '--font-body': styles?.fontBody || "'Inter', sans-serif",
    '--font-display': styles?.fontDisplay || "'Roboto Mono', monospace",
    '--spacing-xs': styles?.spacingXs || '4px',
    '--spacing-sm': styles?.spacingSm || '8px',
    '--spacing-md': styles?.spacingMd || '16px',
    '--spacing-lg': styles?.spacingLg || '24px',
    '--spacing-xl': styles?.spacingXl || '32px',
    '--border-radius': styles?.borderRadius || '4px',
    '--transition-fast': styles?.transitionFast || '150ms ease-out',
    '--transition-slow': styles?.transitionSlow || '300ms ease-out',
    ...styles,
  }
});

const defaultThemes = [
  createTheme('Ghetto Star', 
    { 
      primary: '#FFD700', // Altın Sarısı
      accent: '#FF00FF', // Macenta
      backgroundDeep: '#121212',
      surface: '#242424',
      border: '#3A3A3A'
    },
    { 
      '--border-radius': '4px' 
    }
  ),
  createTheme('8-Bit Night', 
    { primary: '#4ade80', accent: '#fb923c', background: '#1e293b', surface: '#334155', text: '#e2e8f0', border: '#475569' },
    { '--border-radius': '0px' }
  ),
];

export const useThemeStore = create(
  persist(
    (set, get) => ({
      themes: defaultThemes,
      activeThemeId: defaultThemes[0].id,
      getActiveTheme: () => {
        const { themes, activeThemeId } = get();
        return themes.find(t => t.id === activeThemeId) || themes[0];
      },
      setActiveThemeId: (themeId) => set({ activeThemeId: themeId }),
      addTheme: (newTheme) => set(state => ({
        themes: [...state.themes, createTheme(newTheme.name, newTheme.colors, newTheme.styles)]
      })),
      updateTheme: (themeId, updatedProperties) => set(state => ({
        themes: state.themes.map(theme => {
          if (theme.id === themeId) {
            return {
              ...theme,
              name: updatedProperties.name || theme.name,
              colors: { ...theme.colors, ...updatedProperties.colors },
              styles: { ...theme.styles, ...updatedProperties.styles },
            };
          }
          return theme;
        })
      })),
      deleteTheme: (themeId) => {
        if (get().activeThemeId === themeId) {
          set({ activeThemeId: defaultThemes[0].id });
        }
        set(state => ({ themes: state.themes.filter(theme => theme.id !== themeId) }));
      },
    }),
    { name: 'soundforge-theme-manager' }
  )
);
