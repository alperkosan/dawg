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
    // ✅ FIX: Improved contrast for success green - brighter for better visibility on dark backgrounds
    'success': zenithOverrides['success'] || '#22C55E', // Brighter green (#10B981 -> #22C55E) for better contrast
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
    
    // ✅ PREMIUM TEXTURE: Workspace texture customization
    'workspace-texture-accent': zenithOverrides['workspace-texture-accent'] || 'rgba(255, 255, 255, 0.01)',
    'workspace-grid-color': zenithOverrides['workspace-grid-color'] || 'rgba(255, 255, 255, 0.02)',
    'workspace-grid-size': zenithOverrides['workspace-grid-size'] || '32px',
    'workspace-gradient': zenithOverrides['workspace-gradient'] || null, // Optional gradient override
    'workspace-gradient-opacity': zenithOverrides['workspace-gradient-opacity'] || '0.3',

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
    'success-rgb': hexToRGB(zenithOverrides['success'] || '#22C55E'), // Updated to match new success color
    'warning-rgb': hexToRGB(zenithOverrides['warning'] || '#F59E0B'),
    'error-rgb': hexToRGB(zenithOverrides['error'] || '#EF4444'),
    'info-rgb': hexToRGB(zenithOverrides['info'] || '#3B82F6'),

    ...zenithOverrides
  }
});

// Default theme presets with Zenith integration
const defaultThemes = [
  // =================== ORIGINAL THEMES ===================
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
      'text-tertiary': '#6B7280',
      
      // ✅ PREMIUM TEXTURE: Classic workspace texture (improved contrast)
      'workspace-texture-accent': 'rgba(107, 142, 191, 0.025)', // Increased from 0.015 for better visibility
      'workspace-grid-color': 'rgba(255, 255, 255, 0.035)', // Increased from 0.02 for better contrast
      'workspace-grid-size': '32px',
      'workspace-gradient-opacity': '0.3'
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
      'radius-xl': '0px',
      // ✅ PREMIUM TEXTURE: 8-bit pixelated grid texture
      'workspace-texture-accent': 'rgba(74, 222, 128, 0.03)',
      'workspace-grid-color': 'rgba(74, 222, 128, 0.05)',
      'workspace-grid-size': '16px',
      'workspace-gradient-opacity': '0.2'
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
      'text-secondary': '#C9A68A',
      // ✅ PREMIUM TEXTURE: Warm analog texture with subtle grain
      'workspace-texture-accent': 'rgba(255, 182, 39, 0.025)',
      'workspace-grid-color': 'rgba(255, 140, 0, 0.03)',
      'workspace-grid-size': '40px',
      'workspace-gradient-opacity': '0.4'
    }
  ),

  // =================== NEW USER THEMES ===================

  createTheme('Cyberpunk Neon',
    {
      primary: '#FF00FF',
      accent: '#00FFFF',
      backgroundDeep: '#0A0014',
      background: '#1A0028',
      surface: '#2D1044',
      text: '#E0E0FF',
      textMuted: '#B090D0',
      border: 'rgba(255, 0, 255, 0.3)'
    },
    {
      'bg-primary': '#0A0014',
      'bg-secondary': '#1A0028',
      'bg-tertiary': '#2D1044',
      'accent-hot': '#FF00FF',
      'accent-warm': '#FF00AA',
      'accent-cool': '#00FFFF',
      'accent-cold': '#0088FF',
      'text-primary': '#E0E0FF',
      'text-secondary': '#B090D0',
      'text-tertiary': '#8060A0',
      // ✅ PREMIUM TEXTURE: Cyberpunk neon grid with scanline effect
      'workspace-texture-accent': 'rgba(0, 255, 255, 0.04)',
      'workspace-grid-color': 'rgba(255, 0, 255, 0.06)',
      'workspace-grid-size': '20px',
      'workspace-gradient-opacity': '0.5'
    }
  ),

  createTheme('Ocean Deep',
    {
      primary: '#1E90FF',
      accent: '#00CED1',
      backgroundDeep: '#001429',
      background: '#002142',
      surface: '#003D5C',
      text: '#E0F7FF',
      textMuted: '#8FC5D9',
      border: 'rgba(30, 144, 255, 0.2)'
    },
    {
      'bg-primary': '#001429',
      'bg-secondary': '#002142',
      'bg-tertiary': '#003D5C',
      'accent-hot': '#FF6B6B',
      'accent-warm': '#FFA500',
      'accent-cool': '#00CED1',
      'accent-cold': '#1E90FF',
      'text-primary': '#E0F7FF',
      'text-secondary': '#8FC5D9',
      'text-tertiary': '#5A8FA3',
      // ✅ PREMIUM TEXTURE: Ocean wave-like texture with flowing grid
      'workspace-texture-accent': 'rgba(0, 206, 209, 0.03)',
      'workspace-grid-color': 'rgba(30, 144, 255, 0.04)',
      'workspace-grid-size': '36px',
      'workspace-gradient-opacity': '0.35'
    }
  ),

  createTheme('Forest Twilight',
    {
      primary: '#32CD32',
      accent: '#9ACD32',
      backgroundDeep: '#0A1A0A',
      background: '#152815',
      surface: '#1F3D1F',
      text: '#E8F5E8',
      textMuted: '#A8D5A8',
      border: 'rgba(50, 205, 50, 0.2)'
    },
    {
      'bg-primary': '#0A1A0A',
      'bg-secondary': '#152815',
      'bg-tertiary': '#1F3D1F',
      'accent-hot': '#FF6347',
      'accent-warm': '#FFD700',
      'accent-cool': '#32CD32',
      'accent-cold': '#2E8B57',
      'text-primary': '#E8F5E8',
      'text-secondary': '#A8D5A8',
      'text-tertiary': '#6B946B',
      // ✅ PREMIUM TEXTURE: Forest organic texture with natural grid
      'workspace-texture-accent': 'rgba(50, 205, 50, 0.025)',
      'workspace-grid-color': 'rgba(154, 205, 50, 0.035)',
      'workspace-grid-size': '28px',
      'workspace-gradient-opacity': '0.3'
    }
  ),

  createTheme('Sunset Vibes',
    {
      primary: '#FF6B35',
      accent: '#F7931E',
      backgroundDeep: '#1A0A05',
      background: '#2D1410',
      surface: '#3D241D',
      text: '#FFE5D9',
      textMuted: '#DBAC9A',
      border: 'rgba(255, 107, 53, 0.2)'
    },
    {
      'bg-primary': '#1A0A05',
      'bg-secondary': '#2D1410',
      'bg-tertiary': '#3D241D',
      'accent-hot': '#FF6B35',
      'accent-warm': '#F7931E',
      'accent-cool': '#FFB627',
      'accent-cold': '#E08E45',
      'text-primary': '#FFE5D9',
      'text-secondary': '#DBAC9A',
      'text-tertiary': '#B58A77',
      // ✅ PREMIUM TEXTURE: Sunset gradient texture with warm grid
      'workspace-texture-accent': 'rgba(255, 107, 53, 0.03)',
      'workspace-grid-color': 'rgba(255, 182, 39, 0.04)',
      'workspace-grid-size': '44px',
      'workspace-gradient-opacity': '0.45'
    }
  ),

  createTheme('Arctic Minimal',
    {
      primary: '#E0F7FF',
      accent: '#87CEEB',
      backgroundDeep: '#0D1418',
      background: '#151E24',
      surface: '#1F2B33',
      text: '#FFFFFF',
      textMuted: '#B0C4D0',
      border: 'rgba(135, 206, 235, 0.2)'
    },
    {
      'bg-primary': '#0D1418',
      'bg-secondary': '#151E24',
      'bg-tertiary': '#1F2B33',
      'accent-hot': '#FF6B6B',
      'accent-warm': '#FFD93D',
      'accent-cool': '#87CEEB',
      'accent-cold': '#4682B4',
      'text-primary': '#FFFFFF',
      'text-secondary': '#B0C4D0',
      'text-tertiary': '#7A8E9E',
      // ✅ PREMIUM TEXTURE: Minimal icy texture with subtle grid
      'workspace-texture-accent': 'rgba(135, 206, 235, 0.02)',
      'workspace-grid-color': 'rgba(224, 247, 255, 0.025)',
      'workspace-grid-size': '48px',
      'workspace-gradient-opacity': '0.25'
    }
  ),

  createTheme('Midnight Purple',
    {
      primary: '#9D4EDD',
      accent: '#C77DFF',
      backgroundDeep: '#10002B',
      background: '#240046',
      surface: '#3C096C',
      text: '#E0AAFF',
      textMuted: '#C77DFF',
      border: 'rgba(157, 78, 221, 0.2)'
    },
    {
      'bg-primary': '#10002B',
      'bg-secondary': '#240046',
      'bg-tertiary': '#3C096C',
      'accent-hot': '#FF006E',
      'accent-warm': '#FF5A9D',
      'accent-cool': '#C77DFF',
      'accent-cold': '#9D4EDD',
      'text-primary': '#E0AAFF',
      'text-secondary': '#C77DFF',
      'text-tertiary': '#9D4EDD',
      // ✅ PREMIUM TEXTURE: Mystical purple texture with cosmic grid
      'workspace-texture-accent': 'rgba(199, 125, 255, 0.035)',
      'workspace-grid-color': 'rgba(157, 78, 221, 0.05)',
      'workspace-grid-size': '30px',
      'workspace-gradient-opacity': '0.4'
    }
  ),

  createTheme('Retro Miami',
    {
      primary: '#FF1493',
      accent: '#00D9FF',
      backgroundDeep: '#1A0520',
      background: '#2D0A3D',
      surface: '#44145A',
      text: '#FFE0F7',
      textMuted: '#E0A0D9',
      border: 'rgba(255, 20, 147, 0.3)'
    },
    {
      'bg-primary': '#1A0520',
      'bg-secondary': '#2D0A3D',
      'bg-tertiary': '#44145A',
      'accent-hot': '#FF1493',
      'accent-warm': '#FF6EC7',
      'accent-cool': '#00D9FF',
      'accent-cold': '#8A2BE2',
      'text-primary': '#FFE0F7',
      'text-secondary': '#E0A0D9',
      'text-tertiary': '#B870C9',
      // ✅ PREMIUM TEXTURE: Retro Miami vibes with vibrant grid
      'workspace-texture-accent': 'rgba(0, 217, 255, 0.04)',
      'workspace-grid-color': 'rgba(255, 20, 147, 0.06)',
      'workspace-grid-size': '24px',
      'workspace-gradient-opacity': '0.5'
    }
  ),

  createTheme('Desert Heat',
    {
      primary: '#FFB627',
      accent: '#FF7F50',
      backgroundDeep: '#1A1105',
      background: '#2D1F0A',
      surface: '#3D2F14',
      text: '#FFEFD5',
      textMuted: '#D4B896',
      border: 'rgba(255, 182, 39, 0.2)'
    },
    {
      'bg-primary': '#1A1105',
      'bg-secondary': '#2D1F0A',
      'bg-tertiary': '#3D2F14',
      'accent-hot': '#FF4500',
      'accent-warm': '#FFB627',
      'accent-cool': '#FF7F50',
      'accent-cold': '#CD853F',
      'text-primary': '#FFEFD5',
      'text-secondary': '#D4B896',
      'text-tertiary': '#A8906E',
      // ✅ PREMIUM TEXTURE: Desert heat texture with sandy grid
      'workspace-texture-accent': 'rgba(255, 182, 39, 0.03)',
      'workspace-grid-color': 'rgba(255, 127, 80, 0.04)',
      'workspace-grid-size': '38px',
      'workspace-gradient-opacity': '0.4'
    }
  ),

  createTheme('Matrix Code',
    {
      primary: '#00FF41',
      accent: '#00D936',
      backgroundDeep: '#000000',
      background: '#0A0F0A',
      surface: '#0F1A0F',
      text: '#00FF41',
      textMuted: '#00B82E',
      border: 'rgba(0, 255, 65, 0.2)'
    },
    {
      'bg-primary': '#000000',
      'bg-secondary': '#0A0F0A',
      'bg-tertiary': '#0F1A0F',
      'accent-hot': '#FF0000',
      'accent-warm': '#FFFF00',
      'accent-cool': '#00FF41',
      'accent-cold': '#00D936',
      'text-primary': '#00FF41',
      'text-secondary': '#00B82E',
      'text-tertiary': '#008C22',
      'font-primary': "'Courier New', 'Courier', monospace",
      // ✅ PREMIUM TEXTURE: Matrix code texture with digital grid
      'workspace-texture-accent': 'rgba(0, 255, 65, 0.05)',
      'workspace-grid-color': 'rgba(0, 217, 54, 0.08)',
      'workspace-grid-size': '12px',
      'workspace-gradient-opacity': '0.6'
    }
  ),

  createTheme('Lavender Dreams',
    {
      primary: '#E6B8FF',
      accent: '#D4A5FF',
      backgroundDeep: '#1A0D28',
      background: '#2D1A3D',
      surface: '#3D2852',
      text: '#F5E6FF',
      textMuted: '#D4B8E6',
      border: 'rgba(230, 184, 255, 0.2)'
    },
    {
      'bg-primary': '#1A0D28',
      'bg-secondary': '#2D1A3D',
      'bg-tertiary': '#3D2852',
      'accent-hot': '#FF69B4',
      'accent-warm': '#FFB3D9',
      'accent-cool': '#D4A5FF',
      'accent-cold': '#B08BD9',
      'text-primary': '#F5E6FF',
      'text-secondary': '#D4B8E6',
      'text-tertiary': '#B090C9',
      // ✅ PREMIUM TEXTURE: Lavender dreamy texture with soft grid
      'workspace-texture-accent': 'rgba(212, 165, 255, 0.03)',
      'workspace-grid-color': 'rgba(230, 184, 255, 0.04)',
      'workspace-grid-size': '34px',
      'workspace-gradient-opacity': '0.35'
    }
  ),

  createTheme('Anime Vibes',
    {
      primary: '#FF1744',
      accent: '#E040FB',
      backgroundDeep: '#0D0012',
      background: '#1A0A1F',
      surface: '#2A1633',
      text: '#F5E6FF',
      textMuted: '#C9A8D9',
      border: 'rgba(224, 64, 251, 0.25)'
    },
    {
      // Deep dark backgrounds with purple/black gradient feel
      'bg-primary': '#0D0012',      // Near black with purple tint
      'bg-secondary': '#1A0A1F',    // Very dark purple-black
      'bg-tertiary': '#2A1633',     // Dark purple surface

      // Vibrant accent colors - anime style pop
      'accent-hot': '#FF1744',      // Bright red - energy/action
      'accent-warm': '#FF4081',     // Pink-red - playful
      'accent-cool': '#E040FB',     // Vivid purple - main theme
      'accent-cold': '#7C4DFF',     // Deep purple - shadows

      // Text with purple tint for anime aesthetic
      'text-primary': '#F5E6FF',    // Off-white with purple tint
      'text-secondary': '#C9A8D9',  // Muted purple
      'text-tertiary': '#9575B8',   // Darker purple

      // Semantic colors with anime flair
      'success': '#4ADE80',         // Bright green (improved contrast - #00E676 -> #4ADE80)
      'warning': '#FFEA00',         // Bright yellow
      'error': '#FF1744',           // Bright red (matches accent-hot)
      'info': '#E040FB',            // Purple (matches accent-cool)

      // Borders with glow effect feel
      'border-strong': 'rgba(224, 64, 251, 0.4)',
      'border-medium': 'rgba(224, 64, 251, 0.25)',
      'border-subtle': 'rgba(224, 64, 251, 0.1)',

      // Enhanced shadows for depth (anime cel-shading inspired)
      'shadow-sm': '0 2px 6px rgba(224, 64, 251, 0.2)',
      'shadow-md': '0 4px 12px rgba(224, 64, 251, 0.25)',
      'shadow-lg': '0 8px 24px rgba(224, 64, 251, 0.3)',
      'shadow-xl': '0 16px 48px rgba(224, 64, 251, 0.4)',

      // Overlays with purple tint
      'overlay-light': 'rgba(224, 64, 251, 0.08)',
      'overlay-medium': 'rgba(224, 64, 251, 0.15)',
      'overlay-heavy': 'rgba(13, 0, 18, 0.7)',

      // Smooth radius for modern anime UI
      'radius-sm': '0.375rem',
      'radius-md': '0.5rem',
      'radius-lg': '0.75rem',
      'radius-xl': '1rem',

      // Smooth animations
      'duration-fast': '120ms',
      'duration-normal': '250ms',
      'duration-slow': '350ms',
      
      // ✅ PREMIUM TEXTURE: Anime-themed workspace texture (improved contrast)
      'workspace-texture-accent': 'rgba(224, 64, 251, 0.04)', // Increased from 0.03 for better visibility
      'workspace-grid-color': 'rgba(224, 64, 251, 0.06)', // Increased from 0.05 for better contrast
      'workspace-grid-size': '24px',
      'workspace-gradient': 'linear-gradient(135deg, #0D0012 0%, #1A0A1F 50%, #0D0012 100%)',
      'workspace-gradient-opacity': '0.4'
    }
  ),
  
  // ✅ PREMIUM TEXTURE: Analog Warmth theme texture
  createTheme('Analog Warmth (Enhanced)',
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
      'text-secondary': '#C9A68A',
      
      // ✅ PREMIUM TEXTURE: Warm-themed workspace texture (improved contrast)
      'workspace-texture-accent': 'rgba(255, 182, 39, 0.03)', // Increased from 0.02 for better visibility
      'workspace-grid-color': 'rgba(255, 140, 0, 0.04)', // Increased from 0.03 for better contrast
      'workspace-grid-size': '40px',
      'workspace-gradient': 'linear-gradient(135deg, #1A0F0A 0%, #2D1810 50%, #1A0F0A 100%)',
      'workspace-gradient-opacity': '0.5'
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

      setActiveThemeId: (themeId) => {
        set({ activeThemeId: themeId });
        // ✅ Dispatch custom event for canvas re-rendering
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { themeId } }));
        console.log('🎨 Theme changed event dispatched:', themeId);
      },

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
