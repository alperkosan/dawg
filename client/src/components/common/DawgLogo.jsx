/**
 * DAWG Logo Component
 * Reusable logo component with theme-aware colors
 */

import React, { useMemo } from 'react';
import { useThemeStore } from '../../store/useThemeStore';

export const DawgLogo = ({ size = 32, className = '', variant = 'full' }) => {
  // ✅ FIX: Subscribe to theme changes to update logo colors dynamically
  // Use selector to reactively get active theme
  const activeTheme = useThemeStore(state => {
    const { themes, activeThemeId } = state;
    return themes.find(t => t.id === activeThemeId) || themes[0];
  });
  
  // Get theme colors for logo
  const accentHot = activeTheme?.zenith?.['accent-hot'] || '#FF6B35';
  const accentWarm = activeTheme?.zenith?.['accent-warm'] || '#FFD23F';
  const accentCool = activeTheme?.zenith?.['accent-cool'] || '#4ECDC4';
  
  // Generate SVG with theme colors
  const logoSvg = useMemo(() => {
    const isIcon = variant === 'icon';
    const viewBox = isIcon ? '0 0 24 24' : '0 0 32 32';
    const strokeWidth = isIcon ? '2' : '2.5';
    
    return `
      <svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dawgGradient-${variant}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${accentHot};stop-opacity:1" />
            <stop offset="50%" style="stop-color:${accentWarm};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${accentCool};stop-opacity:1" />
          </linearGradient>
          <filter id="glow-${variant}">
            <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        ${isIcon ? `
          <path d="M 3 4 L 3 20 M 3 4 L 9 2 L 15 4 L 15 8 L 9 6 L 3 8 M 3 8 L 9 10 L 15 8 L 15 12 L 9 14 L 3 12 M 3 12 L 9 16 L 15 14 L 15 18 L 9 20 L 3 20" 
                stroke="url(#dawgGradient-${variant})" 
                stroke-width="${strokeWidth}" 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                fill="none"
                filter="url(#glow-${variant})"/>
          <circle cx="19" cy="8" r="1.5" fill="${accentHot}"/>
          <path d="M 17 14 Q 19 12 21 14" 
                stroke="${accentWarm}" 
                stroke-width="1.5" 
                stroke-linecap="round" 
                fill="none"/>
        ` : `
          <circle cx="16" cy="16" r="15" fill="#0A0E1A" opacity="0.8"/>
          <circle cx="16" cy="16" r="14" stroke="url(#dawgGradient-${variant})" stroke-width="1.5" opacity="0.6"/>
          <path d="M 6 8 L 6 26 M 6 10 Q 6 6 10 6 L 18 6 Q 22 6 22 10 L 22 14 Q 22 18 18 18 L 10 18 Q 6 18 6 22 L 6 26" 
                stroke="url(#dawgGradient-${variant})" 
                stroke-width="${strokeWidth}" 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                fill="none"
                filter="url(#glow-${variant})"/>
          <path d="M 22 10 L 24 8 L 26 10 L 24 12 Z" fill="${accentHot}" opacity="0.9"/>
          <circle cx="24" cy="10" r="1" fill="${accentWarm}"/>
          <path d="M 20 18 Q 22 16 24 18 Q 26 20 28 18" 
                stroke="${accentWarm}" 
                stroke-width="2" 
                stroke-linecap="round" 
                fill="none"
                opacity="0.8"/>
        `}
      </svg>
    `;
  }, [size, variant, accentHot, accentWarm, accentCool]);
  
  return (
    <div
      className={className}
      style={{ 
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        width: size,
        height: size,
      }}
      dangerouslySetInnerHTML={{ __html: logoSvg }}
    />
  );
};

export default DawgLogo;
