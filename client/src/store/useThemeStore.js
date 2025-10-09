// src/store/useThemeStore.js - Zenith Design System Integration
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extract RGB values from hex color for alpha transparency
 * @param {string} hex - Hex color (e.g., '#FF6B35' or '#4ECDC4')
 * @returns {string} RGB values (e.g., '255, 107, 53')
 */
const hexToRGB = (hex) => {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Parse hex to RGB
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return `${r}, ${g}, ${b}`;
};

/**
 * Zenith-compatible theme creator
 * Maps Zenith design tokens to dynamic theme values
 */
const createTheme = (name, colors, zenithOverrides = {}) => ({
  id: uuidv4(),
  name,

  // Core colors (backward compatible)
  colors: {
    backgroundDeep: colors.backgroundDeep || '#0A0E1A',
    background: colors.background || '#151922',
    surface: colors.surface || '#1E242F',
    surfaceRaised: colors.surfaceRaised || '#2C3544',
    border: colors.border || 'rgba(255, 255, 255, 0.1)',
    borderSubtle: colors.borderSubtle || 'rgba(255, 255, 255, 0.05)',
    primary: colors.primary || '#FFD700',
    accent: colors.accent || '#FF00FF',
    text: colors.text || '#FFFFFF',
    textMuted: colors.textMuted || '#A1A8B5',
    textHeading: colors.textHeading || '#FFFFFF',
    ...colors,
  },

  // Zenith Design Tokens
  zenith: {
    // Background Layers
    'bg-primary': zenithOverrides['bg-primary'] || colors.backgroundDeep || '#0A0E1A',
    'bg-secondary': zenithOverrides['bg-secondary'] || colors.background || '#151922',
    'bg-tertiary': zenithOverrides['bg-tertiary'] || colors.surface || '#1E242F',

    // Accent Colors
    'accent-hot': zenithOverrides['accent-hot'] || '#FF6B35',
    'accent-warm': zenithOverrides['accent-warm'] || '#FFB627',
    'accent-cool': zenithOverrides['accent-cool'] || colors.accent || '#4ECDC4',
    'accent-cold': zenithOverrides['accent-cold'] || '#556FB5',

    // Semantic Colors
    'success': zenithOverrides['success'] || '#10B981',
    'warning': zenithOverrides['warning'] || '#F59E0B',
    'error': zenithOverrides['error'] || '#EF4444',
    'info': zenithOverrides['info'] || '#3B82F6',

    // Text Hierarchy
    'text-primary': zenithOverrides['text-primary'] || colors.text || '#FFFFFF',
    'text-secondary': zenithOverrides['text-secondary'] || colors.textMuted || '#A1A8B5',
    'text-tertiary': zenithOverrides['text-tertiary'] || '#6B7280',
    'text-disabled': zenithOverrides['text-disabled'] || '#4B5563',

    // Borders
    'border-strong': zenithOverrides['border-strong'] || 'rgba(255, 255, 255, 0.2)',
    'border-medium': zenithOverrides['border-medium'] || colors.border || 'rgba(255, 255, 255, 0.1)',
    'border-subtle': zenithOverrides['border-subtle'] || colors.borderSubtle || 'rgba(255, 255, 255, 0.05)',

    // Overlays & Shadows
    'overlay-light': zenithOverrides['overlay-light'] || 'rgba(255, 255, 255, 0.05)',
    'overlay-medium': zenithOverrides['overlay-medium'] || 'rgba(255, 255, 255, 0.1)',
    'overlay-heavy': zenithOverrides['overlay-heavy'] || 'rgba(0, 0, 0, 0.5)',

    'shadow-sm': zenithOverrides['shadow-sm'] || '0 2px 4px rgba(0, 0, 0, 0.3)',
    'shadow-md': zenithOverrides['shadow-md'] || '0 4px 8px rgba(0, 0, 0, 0.4)',
    'shadow-lg': zenithOverrides['shadow-lg'] || '0 8px 16px rgba(0, 0, 0, 0.5)',
    'shadow-xl': zenithOverrides['shadow-xl'] || '0 16px 32px rgba(0, 0, 0, 0.6)',

    // Typography
    'font-primary': zenithOverrides['font-primary'] || "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    'font-mono': zenithOverrides['font-mono'] || "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', monospace",

    // Spacing
    'radius-sm': zenithOverrides['radius-sm'] || '0.25rem',
    'radius-md': zenithOverrides['radius-md'] || '0.5rem',
    'radius-lg': zenithOverrides['radius-lg'] || '0.75rem',
    'radius-xl': zenithOverrides['radius-xl'] || '1rem',

    // Animation
    'ease-out': zenithOverrides['ease-out'] || 'cubic-bezier(0, 0, 0.2, 1)',
    'ease-in-out': zenithOverrides['ease-in-out'] || 'cubic-bezier(0.4, 0, 0.2, 1)',
    'ease-smooth': zenithOverrides['ease-smooth'] || 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',

    'duration-fast': zenithOverrides['duration-fast'] || '100ms',
    'duration-normal': zenithOverrides['duration-normal'] || '200ms',
    'duration-slow': zenithOverrides['duration-slow'] || '300ms',

    // RGB variants for alpha transparency (rgba usage)
    'accent-hot-rgb': hexToRGB(zenithOverrides['accent-hot'] || '#FF6B35'),
    'accent-warm-rgb': hexToRGB(zenithOverrides['accent-warm'] || '#FFB627'),
    'accent-cool-rgb': hexToRGB(zenithOverrides['accent-cool'] || colors.accent || '#4ECDC4'),
    'accent-cold-rgb': hexToRGB(zenithOverrides['accent-cold'] || '#556FB5'),
    'success-rgb': hexToRGB(zenithOverrides['success'] || '#10B981'),
    'warning-rgb': hexToRGB(zenithOverrides['warning'] || '#F59E0B'),
    'error-rgb': hexToRGB(zenithOverrides['error'] || '#EF4444'),
    'info-rgb': hexToRGB(zenithOverrides['info'] || '#3B82F6'),

    ...zenithOverrides
  }
});

// Default theme presets with Zenith integration
const defaultThemes = [
  createTheme('Ghetto Star (Zenith)',
    {
      primary: '#FFD700',
      accent: '#6B8EBF',
      backgroundDeep: '#0A0E1A',
      background: '#151922',
      surface: '#1E242F',
      text: '#FFFFFF',
      textMuted: '#A1A8B5',
      border: 'rgba(255, 255, 255, 0.1)'
    },
    {
      'bg-primary': '#0A0E1A',
      'bg-secondary': '#151922',
      'bg-tertiary': '#1E242F',
      'accent-hot': '#E74C3C',
      'accent-warm': '#FFD700',
      'accent-cool': '#6B8EBF',
      'accent-cold': '#5A6C8A',
      'text-primary': '#FFFFFF',
      'text-secondary': '#A1A8B5',
      'text-tertiary': '#6B7280'
    }
  ),
  createTheme('8-Bit Night',
    {
      primary: '#4ade80',
      accent: '#fb923c',
      backgroundDeep: '#0f172a',
      background: '#1e293b',
      surface: '#334155',
      text: '#e2e8f0',
      textMuted: '#94a3b8',
      border: 'rgba(148, 163, 184, 0.2)'
    },
    {
      'bg-primary': '#0f172a',
      'bg-secondary': '#1e293b',
      'bg-tertiary': '#334155',
      'accent-cool': '#4ade80',
      'accent-warm': '#fb923c',
      'radius-sm': '0px',
      'radius-md': '0px',
      'radius-lg': '0px',
      'radius-xl': '0px'
    }
  ),
  createTheme('Analog Warmth',
    {
      primary: '#FF8C00',
      accent: '#FFB627',
      backgroundDeep: '#1A0F0A',
      background: '#2D1810',
      surface: '#3D2418',
      text: '#FFE6D5',
      textMuted: '#C9A68A',
      border: 'rgba(255, 140, 0, 0.2)'
    },
    {
      'bg-primary': '#1A0F0A',
      'bg-secondary': '#2D1810',
      'bg-tertiary': '#3D2418',
      'accent-hot': '#FF8C00',
      'accent-warm': '#FFB627',
      'text-primary': '#FFE6D5',
      'text-secondary': '#C9A68A'
    }
  )
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
        themes: [...state.themes, createTheme(
          newTheme.name,
          newTheme.colors || {},
          newTheme.zenith || {}
        )]
      })),

      updateTheme: (themeId, updatedProperties) => set(state => ({
        themes: state.themes.map(theme => {
          if (theme.id === themeId) {
            return {
              ...theme,
              name: updatedProperties.name || theme.name,
              colors: { ...theme.colors, ...updatedProperties.colors },
              zenith: { ...theme.zenith, ...updatedProperties.zenith }
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
    { name: 'dawg-zenith-theme-manager' }
  )
);
