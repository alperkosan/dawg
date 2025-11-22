/**
 * DAWG Logo Component
 * Reusable logo component with theme-aware colors
 * Original, Clear, Recognizable Design
 */

import React, { useMemo } from 'react';
import { useThemeStore } from '../../store/useThemeStore';

export const DawgLogo = ({ size = 32, className = '', variant = 'full' }) => {
  // ✅ Subscribe to theme changes to update logo colors dynamically
  const activeTheme = useThemeStore(state => {
    const { themes, activeThemeId } = state;
    return themes.find(t => t.id === activeThemeId) || themes[0];
  });
  
  // Get theme colors for logo
  const accentHot = activeTheme?.zenith?.['accent-hot'] || '#FF6B35';
  const accentWarm = activeTheme?.zenith?.['accent-warm'] || '#FFB627';
  const accentCool = activeTheme?.zenith?.['accent-cool'] || '#4ECDC4';
  const accentCold = activeTheme?.zenith?.['accent-cold'] || '#556FB5';
  const bgPrimary = activeTheme?.zenith?.['bg-primary'] || '#0A0E1A';
  const bgSecondary = activeTheme?.zenith?.['bg-secondary'] || '#151922';
  
  // Generate SVG with theme colors - Original, Clear, Recognizable
  const logoSvg = useMemo(() => {
    const isIcon = variant === 'icon';
    const viewBox = isIcon ? '0 0 64 64' : '0 0 120 120';
    const uniqueId = `${variant}-${size}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Icon variant (smaller, simplified but still recognizable)
    if (isIcon) {
      return `
        <svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="iconPrimaryGradient-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${accentHot};stop-opacity:1" />
              <stop offset="50%" style="stop-color:${accentWarm};stop-opacity:1" />
              <stop offset="100%" style="stop-color:#FFD700;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="iconCoolGradient-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${accentCool};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${accentCold};stop-opacity:1" />
            </linearGradient>
            <filter id="iconStreetGlow-${uniqueId}" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <filter id="iconStrongShadow-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
              <feOffset dx="2" dy="2.5" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.4"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <rect width="64" height="64" rx="10" fill="${bgPrimary}"/>
          <rect x="2" y="2" width="60" height="60" rx="8" fill="${bgSecondary}" opacity="0.9"/>
          <path d="M 12 10 
                   L 12 54
                   L 15 54
                   L 15 47
                   L 21 50
                   L 27 49
                   L 32 47
                   L 34 44
                   L 34 40
                   L 32 37
                   L 27 35
                   L 21 34
                   L 15 32
                   L 12 26
                   L 12 10
                   Z" 
                fill="url(#iconPrimaryGradient-${uniqueId})" 
                opacity="0.98"
                filter="url(#iconStrongShadow-${uniqueId})"/>
          <path d="M 15 18
                   L 15 46
                   L 17 45
                   L 20 44
                   L 22 42
                   L 22 40
                   L 20 38
                   L 17 37
                   L 15 36
                   L 15 28
                   L 17 27
                   L 20 26
                   L 22 24
                   L 22 22
                   L 20 20
                   L 17 19
                   L 15 18
                   Z" 
                fill="${bgPrimary}" 
                opacity="0.7"/>
          <path d="M 38 18
                   L 40 14
                   L 42 18
                   L 44 12
                   L 46 18
                   L 48 16
                   L 50 18" 
                stroke="url(#iconPrimaryGradient-${uniqueId})" 
                stroke-width="3" 
                stroke-linecap="round" 
                stroke-linejoin="round"
                fill="none"
                opacity="0.95"
                filter="url(#iconStreetGlow-${uniqueId})"/>
          <path d="M 38 26
                   L 40 22
                   L 42 26
                   L 44 20
                   L 46 26
                   L 48 24
                   L 50 26" 
                stroke="url(#iconCoolGradient-${uniqueId})" 
                stroke-width="2.5" 
                stroke-linecap="round" 
                stroke-linejoin="round"
                fill="none"
                opacity="0.85"
                filter="url(#iconStreetGlow-${uniqueId})"/>
          <circle cx="42" cy="22" r="2.5" fill="${accentHot}" opacity="0.95" filter="url(#iconStreetGlow-${uniqueId})"/>
          <circle cx="48" cy="22" r="2" fill="${accentCool}" opacity="0.9" filter="url(#iconStreetGlow-${uniqueId})"/>
          <path d="M 15 18
                   L 21 34
                   L 27 37
                   L 32 40" 
                stroke="url(#iconCoolGradient-${uniqueId})" 
                stroke-width="2" 
                stroke-linecap="round" 
                fill="none"
                opacity="0.7"
                filter="url(#iconStreetGlow-${uniqueId})"/>
        </svg>
      `;
    }
    
    // Full variant (larger, more detailed, highly recognizable)
    return `
      <svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="primaryGradient-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${accentHot};stop-opacity:1" />
            <stop offset="50%" style="stop-color:${accentWarm};stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FFD700;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="coolGradient-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${accentCool};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${accentCold};stop-opacity:1" />
          </linearGradient>
          <filter id="streetGlow-${uniqueId}" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="strongShadow-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="5"/>
            <feOffset dx="3" dy="4" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.5"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <rect width="120" height="120" rx="14" fill="${bgPrimary}"/>
        <rect x="3" y="3" width="114" height="114" rx="11" fill="${bgSecondary}" opacity="0.9"/>
        <path d="M 25 20 
                 L 25 100
                 L 30 100
                 L 30 90
                 L 42 95
                 L 55 92
                 L 65 88
                 L 70 82
                 L 70 72
                 L 65 66
                 L 55 62
                 L 42 60
                 L 30 55
                 L 25 50
                 L 25 20
                 Z" 
              fill="url(#primaryGradient-${uniqueId})" 
              opacity="0.98"
              filter="url(#strongShadow-${uniqueId})"/>
        <path d="M 32 35
                 L 32 85
                 L 36 84
                 L 44 82
                 L 50 78
                 L 50 72
                 L 44 68
                 L 36 66
                 L 32 65
                 L 32 55
                 L 36 54
                 L 44 52
                 L 50 48
                 L 50 42
                 L 44 38
                 L 36 36
                 L 32 35
                 Z" 
              fill="${bgPrimary}" 
              opacity="0.8"/>
        <path d="M 75 35
                 L 77 30
                 L 80 35
                 L 83 25
                 L 86 35
                 L 89 32
                 L 92 35
                 L 95 30
                 L 98 35" 
              stroke="url(#primaryGradient-${uniqueId})" 
              stroke-width="4" 
              stroke-linecap="round" 
              stroke-linejoin="round"
              fill="none"
              opacity="0.95"
              filter="url(#streetGlow-${uniqueId})"/>
        <path d="M 75 50
                 L 77 45
                 L 80 50
                 L 83 40
                 L 86 50
                 L 89 47
                 L 92 50
                 L 95 45
                 L 98 50" 
              stroke="url(#coolGradient-${uniqueId})" 
              stroke-width="3.5" 
              stroke-linecap="round" 
              stroke-linejoin="round"
              fill="none"
              opacity="0.85"
              filter="url(#streetGlow-${uniqueId})"/>
        <path d="M 75 65
                 L 77 60
                 L 80 65
                 L 83 55
                 L 86 65
                 L 89 62
                 L 92 65
                 L 95 60
                 L 98 65" 
              stroke="url(#primaryGradient-${uniqueId})" 
              stroke-width="3" 
              stroke-linecap="round" 
              stroke-linejoin="round"
              fill="none"
              opacity="0.75"
              filter="url(#streetGlow-${uniqueId})"/>
        <circle cx="80" cy="42" r="4" fill="${accentHot}" opacity="0.95" filter="url(#streetGlow-${uniqueId})"/>
        <circle cx="89" cy="42" r="3.5" fill="${accentCool}" opacity="0.9" filter="url(#streetGlow-${uniqueId})"/>
        <circle cx="95" cy="47" r="3" fill="${accentWarm}" opacity="0.85" filter="url(#streetGlow-${uniqueId})"/>
        <path d="M 30 35
                 L 42 60
                 L 55 66
                 L 65 72" 
              stroke="url(#coolGradient-${uniqueId})" 
              stroke-width="3" 
              stroke-linecap="round" 
              fill="none"
              opacity="0.7"
              filter="url(#streetGlow-${uniqueId})"/>
      </svg>
    `;
  }, [size, variant, accentHot, accentWarm, accentCool, accentCold, bgPrimary, bgSecondary]);
  
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
