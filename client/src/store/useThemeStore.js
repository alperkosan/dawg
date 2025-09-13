import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

// Her tema için tutarlı bir yapı oluşturan yardımcı fonksiyon
const createTheme = (name, colors, styles) => ({
  id: uuidv4(),
  name,
  colors: {
    primary: colors.primary || '#0ea5e9',
    background: colors.background || '#111827',
    surface: colors.surface || '#1f2937',
    surface2: colors.surface2 || '#374151', // Ek yüzey rengi
    text: colors.text || '#d1d5db',
    muted: colors.muted || '#6b7280',
    accent: colors.accent || '#f59e0b',
    // YENİ: Kenarlık rengi artık varsayılan olarak tanımlı
    border: colors.border || '#374151', 
    ...colors,
  },
  styles: {
    '--border-radius': styles?.borderRadius || '0.5rem',
    '--padding-container': styles?.paddingContainer || '1rem',
    '--padding-controls': styles?.paddingControls || '0.5rem',
    '--gap-container': styles?.gapContainer || '1rem',
    '--gap-controls': styles?.gapControls || '0.5rem', 
    '--font-size-header': styles?.fontSizeHeader || '1.125rem',
    '--font-size-subheader': styles?.fontSizeSubheader || '1rem',
    '--font-size-body': styles?.fontSizeBody || '0.875rem',
    '--font-size-label': styles?.fontSizeLabel || '0.75rem',
    ...styles,
  }
});

const defaultThemes = [
  createTheme('Dark Cyan (Varsayılan)', 
    { primary: '#0ea5e9', accent: '#f59e0b', border: '#374151' },
    { '--border-radius': '0.5rem' }
  ),
  createTheme('Synthwave', 
    { primary: '#f43f5e', background: '#1e1b4b', surface: '#312e81', text: '#f5d0fe', accent: '#fbbf24', border: '#4f46e5' },
    { '--border-radius': '0.25rem' }
  ),
  createTheme('Monochrome', 
    { primary: '#ffffff', background: '#000000', surface: '#1f1f1f', text: '#e3e3e3', accent: '#ffffff', border: '#444444' },
    { '--border-radius': '0rem' }
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
              ...updatedProperties,
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
    { name: 'daw-full-theme-manager' }
  )
);