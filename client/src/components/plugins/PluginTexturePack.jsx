/**
 * PLUGIN TEXTURE PACK
 * 
 * Professional visual enhancement system for plugin UIs
 * Adds depth, texture, and premium visual effects
 * 
 * Features:
 * - Grain/noise textures
 * - Gradient overlays
 * - Glassmorphism effects
 * - Depth shadows
 * - Animated glows
 * - Pattern overlays
 */

import React from 'react';

/**
 * TEXTURE STYLES
 * Base texture definitions that can be applied to any plugin
 */
export const TextureStyles = {
  // Grain texture (subtle film grain)
  grain: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`,
    pointerEvents: 'none',
    opacity: 0.15,
    mixBlendMode: 'overlay',
  },

  // Radial gradient overlay (adds depth)
  radialGradient: (primaryColor) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `radial-gradient(circle at 30% 20%, ${primaryColor}15 0%, transparent 60%)`,
    pointerEvents: 'none',
    opacity: 0.6,
  }),

  // Linear gradient overlay (top to bottom)
  linearGradient: (primaryColor, secondaryColor) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `linear-gradient(180deg, ${primaryColor}08 0%, transparent 40%, ${secondaryColor}05 100%)`,
    pointerEvents: 'none',
    opacity: 0.8,
  }),

  // Mesh gradient (modern glass effect)
  meshGradient: (colors) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `
      radial-gradient(at 20% 30%, ${colors.primary}10 0px, transparent 50%),
      radial-gradient(at 80% 70%, ${colors.secondary}08 0px, transparent 50%),
      radial-gradient(at 50% 50%, ${colors.accent}05 0px, transparent 50%)
    `,
    pointerEvents: 'none',
    opacity: 0.7,
  }),

  // Scanline effect (subtle horizontal lines)
  scanlines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.03) 0px,
      transparent 1px,
      transparent 2px,
      rgba(0, 0, 0, 0.03) 3px
    )`,
    pointerEvents: 'none',
    opacity: 0.4,
    mixBlendMode: 'multiply',
  },

  // Diagonal pattern overlay
  diagonalPattern: (color) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      ${color}03 10px,
      ${color}03 20px
    )`,
    pointerEvents: 'none',
    opacity: 0.5,
  }),

  // Dot pattern (subtle)
  dotPattern: (color) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `radial-gradient(circle, ${color}10 1px, transparent 1px)`,
    backgroundSize: '20px 20px',
    pointerEvents: 'none',
    opacity: 0.3,
  }),
};

/**
 * DEPTH EFFECTS
 * Multi-layer shadow system for depth
 */
export const DepthEffects = {
  // Container shadow (main depth)
  containerShadow: (glowColor) => ({
    boxShadow: `
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 4px 16px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 -1px 0 rgba(0, 0, 0, 0.2),
      0 0 0 1px rgba(255, 255, 255, 0.05)
    `,
  }),

  // Glow shadow (category-based)
  glowShadow: (color, intensity = 0.3) => ({
    boxShadow: `
      0 0 20px ${color}${Math.floor(intensity * 255).toString(16).padStart(2, '0')},
      0 0 40px ${color}${Math.floor(intensity * 0.5 * 255).toString(16).padStart(2, '0')},
      0 8px 32px rgba(0, 0, 0, 0.4)
    `,
  }),

  // Inner depth (inset shadow)
  innerDepth: {
    boxShadow: `
      inset 0 2px 4px rgba(0, 0, 0, 0.3),
      inset 0 -2px 4px rgba(255, 255, 255, 0.05)
    `,
  },

  // Border glow (animated)
  borderGlow: (color) => ({
    boxShadow: `
      0 0 0 1px ${color}40,
      0 0 10px ${color}30,
      inset 0 0 10px ${color}10
    `,
  }),
};

/**
 * TEXTURE PACK COMPONENT
 * Applies texture overlays to a container
 */
export const TexturePack = ({ 
  children, 
  categoryColors,
  intensity = 'medium',
  enableGrain = true,
  enableGradient = true,
  enablePattern = false,
  enableScanlines = false,
  className = '',
  style = {}
}) => {
  const intensityMap = {
    low: { grain: 0.1, gradient: 0.4, pattern: 0.2 },
    medium: { grain: 0.15, gradient: 0.6, pattern: 0.3 },
    high: { grain: 0.2, gradient: 0.8, pattern: 0.4 },
  };

  const config = intensityMap[intensity] || intensityMap.medium;

  return (
    <div 
      className={`plugin-texture-pack ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...style
      }}
    >
      {/* Background content */}
      {children}

      {/* Texture overlays */}
      {enableGrain && (
        <div 
          style={{
            ...TextureStyles.grain,
            opacity: config.grain,
          }}
        />
      )}

      {enableGradient && (
        <>
          <div style={TextureStyles.radialGradient(categoryColors.primary)} />
          <div style={TextureStyles.linearGradient(categoryColors.primary, categoryColors.secondary)} />
          <div style={TextureStyles.meshGradient(categoryColors)} />
        </>
      )}

      {enablePattern && (
        <>
          <div style={{
            ...TextureStyles.diagonalPattern(categoryColors.primary),
            opacity: config.pattern,
          }} />
        </>
      )}

      {enableScanlines && (
        <div style={TextureStyles.scanlines} />
      )}

      {/* Subtle edge highlight */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${categoryColors.primary}40, transparent)`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

/**
 * GLASSMORPHISM EFFECT
 * Modern frosted glass effect
 */
export const Glassmorphism = ({ children, blur = 20, opacity = 0.1, categoryColors, className = '' }) => {
  return (
    <div
      className={`plugin-glassmorphism ${className}`}
      style={{
        background: `rgba(255, 255, 255, ${opacity})`,
        backdropFilter: `blur(${blur}px) saturate(180%)`,
        WebkitBackdropFilter: `blur(${blur}px) saturate(180%)`,
        border: `1px solid rgba(255, 255, 255, ${opacity * 0.3})`,
        boxShadow: `
          0 8px 32px rgba(0, 0, 0, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, ${opacity * 0.5})
        `,
        position: 'relative',
      }}
    >
      {children}
      {/* Subtle gradient overlay */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `linear-gradient(135deg, ${categoryColors.primary}05 0%, transparent 100%)`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

/**
 * ANIMATED GLOW
 * Pulsing glow effect for active elements
 */
export const AnimatedGlow = ({ children, color, intensity = 'medium', className = '' }) => {
  const intensityMap = {
    low: { duration: 3, blur: 8 },
    medium: { duration: 2, blur: 12 },
    high: { duration: 1.5, blur: 16 },
  };

  const config = intensityMap[intensity] || intensityMap.medium;

  return (
    <div
      className={`plugin-animated-glow ${className}`}
      style={{
        position: 'relative',
        animation: `glow-pulse ${config.duration}s ease-in-out infinite`,
      }}
    >
      <style>{`
        @keyframes glow-pulse {
          0%, 100% {
            box-shadow: 0 0 ${config.blur}px ${color}40, 0 0 ${config.blur * 1.5}px ${color}20;
          }
          50% {
            box-shadow: 0 0 ${config.blur * 1.5}px ${color}60, 0 0 ${config.blur * 2}px ${color}30;
          }
        }
      `}</style>
      {children}
    </div>
  );
};

/**
 * EXPORT ALL
 */
export default {
  TextureStyles,
  DepthEffects,
  TexturePack,
  Glassmorphism,
  AnimatedGlow,
};

