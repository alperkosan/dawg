// Professional color palette for audio plugins [cite: 88, 89]
export const PluginColorPalette = {
  backgrounds: {
    primary: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    secondary: 'linear-gradient(135deg, #252525 0%, #1a1a1a 100%)',
    accent: 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)',
  },
  meters: {
    green: '#00ff41',
    yellow: '#ffff00',
    orange: '#ff8c00',
    red: '#ff0040',
    blue: '#00a8ff',
  },
  controls: {
    knobTrack: '#333333',
    knobFill: '#00a8ff',
    knobHandle: '#ffffff',
    faderTrack: '#2a2a2a',
    faderHandle: '#00a8ff',
    buttonActive: '#00a8ff',
    buttonInactive: '#555555',
  },
  status: {
    bypass: '#666666',
    active: '#00a8ff',
    warning: '#ff8c00',
    error: '#ff0040',
  },
};

// Standardized spacing system [cite: 119]
export const PluginSpacing = {
  xs: '0.25rem', // 4px
  sm: '0.5rem',  // 8px
  md: '1rem',    // 16px
  lg: '1.5rem',  // 24px
  xl: '2rem',    // 32px
  xxl: '3rem',   // 48px
};

// Typography system for plugins [cite: 130]
export const PluginTypography = {
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: '600',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  value: {
    fontSize: '0.875rem',
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  description: {
    fontSize: '0.75rem',
    fontWeight: '400',
    opacity: 0.8,
    lineHeight: 1.4,
  },
};

// Animation constants [cite: 158]
export const PluginAnimations = {
  quick: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
};