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

// Standardized spacing system [cite: 119]
export const PluginSpacingHeader = {
  padding: "2.5rem"
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

/**
 * CATEGORY PALETTE REGISTRY v2.0
 *
 * Centralized color definitions for all plugin categories
 * Each plugin category has a consistent color identity
 *
 * Usage:
 *   import { CATEGORY_PALETTE } from '@/components/plugins/PluginDesignSystem';
 *   const colors = CATEGORY_PALETTE['dynamics-forge'];
 *   <div style={{ color: colors.primary }}>
 */
export const CATEGORY_PALETTE = {
  'dynamics-forge': {
    id: 'dynamics-forge',
    name: 'The Dynamics Forge',
    icon: '⚒️',
    primary: '#00A8E8',      // Cyan blue - precise, technical
    secondary: '#00B8F8',    // Light cyan
    accent: '#003D5C',       // Dark blue
    glow: 'rgba(0, 168, 232, 0.3)',
    background: 'rgba(0, 168, 232, 0.05)',
    gradient: 'linear-gradient(135deg, #00A8E8 0%, #003D5C 100%)',
    description: 'Precision dynamics control - Compressors, limiters, gates'
  },

  'spacetime-chamber': {
    id: 'spacetime-chamber',
    name: 'The Spacetime Chamber',
    icon: '🌌',
    primary: '#A855F7',      // Purple - depth, space
    secondary: '#22D3EE',    // Cyan - time
    accent: '#7C3AED',       // Deep purple
    glow: 'rgba(168, 85, 247, 0.3)',
    background: 'rgba(168, 85, 247, 0.05)',
    gradient: 'linear-gradient(135deg, #A855F7 0%, #22D3EE 100%)',
    description: 'Time & space effects - Reverbs, delays, echoes'
  },

  'texture-lab': {
    id: 'texture-lab',
    name: 'The Texture Lab',
    icon: '🔥',
    primary: '#F97316',      // Orange - warmth, harmonics
    secondary: '#FB923C',    // Light orange
    accent: '#C2410C',       // Dark orange
    glow: 'rgba(249, 115, 22, 0.3)',
    background: 'rgba(249, 115, 22, 0.05)',
    gradient: 'linear-gradient(135deg, #F97316 0%, #C2410C 100%)',
    description: 'Harmonic saturation - Distortion, saturation, analog warmth'
  },

  'modulation-machines': {
    id: 'modulation-machines',
    name: 'Modulation Machines',
    icon: '🌀',
    primary: '#EC4899',      // Pink - movement, modulation
    secondary: '#A855F7',    // Purple
    accent: '#BE185D',       // Deep pink
    glow: 'rgba(236, 72, 153, 0.3)',
    background: 'rgba(236, 72, 153, 0.05)',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)',
    description: 'Modulation effects - Chorus, phaser, flanger, tremolo'
  },

  'master-chain': {
    id: 'master-chain',
    name: 'The Master Chain',
    icon: '👑',
    primary: '#F59E0B',      // Amber - mastering, finality
    secondary: '#FBBF24',    // Gold
    accent: '#B45309',       // Dark amber
    glow: 'rgba(245, 158, 11, 0.3)',
    background: 'rgba(245, 158, 11, 0.05)',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)',
    description: 'Mastering tools - Maximizers, limiters, stereo imaging'
  },

  'spectral-weave': {
    id: 'spectral-weave',
    name: 'The Spectral Weave',
    icon: '🎨',
    primary: '#10B981',      // Emerald - frequency, surgical
    secondary: '#34D399',    // Light green
    accent: '#047857',       // Dark green
    glow: 'rgba(16, 185, 129, 0.3)',
    background: 'rgba(16, 185, 129, 0.05)',
    gradient: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
    description: 'Spectral processing - EQ, filters, spectral tools'
  },

  'creative-chaos': {
    id: 'creative-chaos',
    name: 'Creative Chaos',
    icon: '✨',
    primary: '#8B5CF6',      // Violet - experimental, creative
    secondary: '#C084FC',    // Light violet
    accent: '#6D28D9',       // Deep violet
    glow: 'rgba(139, 92, 246, 0.3)',
    background: 'rgba(139, 92, 246, 0.05)',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    description: 'Experimental effects - Glitch, lo-fi, creative destruction'
  }
};

/**
 * Get category colors by ID
 * Falls back to default if category not found
 */
export const getCategoryColors = (categoryId) => {
  return CATEGORY_PALETTE[categoryId] || CATEGORY_PALETTE['dynamics-forge'];
};

/**
 * Get all category IDs
 */
export const getCategoryIds = () => {
  return Object.keys(CATEGORY_PALETTE);
};

/**
 * Get category by plugin type
 * Maps plugin types to their categories
 */
export const PLUGIN_CATEGORY_MAP = {
  // Dynamics Forge
  'Compressor': 'dynamics-forge',
  'Limiter': 'dynamics-forge',
  'Gate': 'dynamics-forge',
  'Expander': 'dynamics-forge',
  'TransientDesigner': 'dynamics-forge',

  // Spacetime Chamber
  'ModernReverb': 'spacetime-chamber',
  'ModernDelay': 'spacetime-chamber',
  'Echo': 'spacetime-chamber',

  // Texture Lab
  'Saturator': 'texture-lab',
  'Distortion': 'texture-lab',
  'ArcadeCrusher': 'texture-lab',
  'Clipper': 'texture-lab',

  // Modulation Machines
  'StardustChorus': 'modulation-machines',
  'VortexPhaser': 'modulation-machines',
  'Flanger': 'modulation-machines',
  'Tremolo': 'modulation-machines',
  'OrbitPanner': 'modulation-machines',

  // Master Chain
  'Maximizer': 'master-chain',
  'Imager': 'master-chain',
  'OTT': 'master-chain',

  // Spectral Weave
  'MultiBandEQ': 'spectral-weave',
  'TidalFilter': 'spectral-weave',
  'BassEnhancer808': 'spectral-weave',

  // Creative Chaos
  'HalfTime': 'creative-chaos',
  'RhythmFX': 'creative-chaos',
  'PitchShifter': 'creative-chaos'
};

/**
 * Get category for a plugin type
 */
export const getPluginCategory = (pluginType) => {
  return PLUGIN_CATEGORY_MAP[pluginType] || 'dynamics-forge';
};