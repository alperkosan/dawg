/**
 * DAWG Logo Component
 * Reusable logo component with theme-aware colors
 * Online Ghetto Theme - Street Art Aesthetic
 */

import React, { useMemo } from 'react';
import { useThemeStore } from '../../store/useThemeStore';

export const DawgLogo = ({ size = 32, className = '', variant = 'full' }) => {
  // ✅ Subscribe to theme changes to update logo colors dynamically
  const activeTheme = useThemeStore(state => {
    const { themes, activeThemeId } = state;
    return themes.find(t => t.id === activeThemeId) || themes[0];
  });
  
  // Get theme colors for logo (Online Ghetto theme)
  const accentHot = activeTheme?.zenith?.['accent-hot'] || '#FF6B35';
  const accentWarm = activeTheme?.zenith?.['accent-warm'] || '#FFB627';
  const accentCool = activeTheme?.zenith?.['accent-cool'] || '#4ECDC4';
  const accentCold = activeTheme?.zenith?.['accent-cold'] || '#556FB5';
  const bgPrimary = activeTheme?.zenith?.['bg-primary'] || '#0A0E1A';
  const bgSecondary = activeTheme?.zenith?.['bg-secondary'] || '#151922';
  
  // Generate SVG with theme colors - Online Ghetto style
  const logoSvg = useMemo(() => {
    const isIcon = variant === 'icon';
    const viewBox = isIcon ? '0 0 64 64' : '0 0 120 120';
    const uniqueId = `${variant}-${size}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Icon variant (smaller, simplified)
    if (isIcon) {
      return `
        <svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="iconGhettoGradient-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
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
            <filter id="iconGhettoShadow-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2.5"/>
              <feOffset dx="1.5" dy="2" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.35"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <rect width="64" height="64" rx="8" fill="${bgPrimary}"/>
          <rect x="1" y="1" width="62" height="62" rx="7" fill="${bgSecondary}" opacity="0.8"/>
          <path d="M 10 12 
                   L 10 52
                   L 13 52
                   L 13 45
                   L 18 48
                   L 23 47
                   L 28 45
                   L 30 42
                   L 30 38
                   L 28 35
                   L 23 33
                   L 18 32
                   L 13 30
                   L 10 25
                   Z" 
                fill="url(#iconGhettoGradient-${uniqueId})" 
                opacity="0.95"
                filter="url(#iconGhettoShadow-${uniqueId})"/>
          <path d="M 14 20
                   L 14 42
                   L 16 41
                   L 19 40
                   L 22 38
                   L 22 36
                   L 19 34
                   L 16 33
                   L 14 32
                   Z" 
                fill="${bgPrimary}" 
                opacity="0.6"/>
          <path d="M 13 25
                   L 18 32
                   L 23 35
                   L 28 38
                   L 30 42" 
                stroke="url(#iconCoolGradient-${uniqueId})" 
                stroke-width="2" 
                stroke-linecap="round" 
                fill="none"
                opacity="0.6"
                filter="url(#iconStreetGlow-${uniqueId})"/>
          <path d="M 36 20
                   L 38 16
                   L 40 20
                   L 42 14
                   L 44 20
                   L 46 18
                   L 48 20" 
                stroke="url(#iconGhettoGradient-${uniqueId})" 
                stroke-width="2.5" 
                stroke-linecap="round" 
                stroke-linejoin="round"
                fill="none"
                opacity="0.9"
                filter="url(#iconStreetGlow-${uniqueId})"/>
          <path d="M 36 28
                   L 38 24
                   L 40 28
                   L 42 22
                   L 44 28
                   L 46 26
                   L 48 28" 
                stroke="url(#iconCoolGradient-${uniqueId})" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
                fill="none"
                opacity="0.7"
                filter="url(#iconStreetGlow-${uniqueId})"/>
          <circle cx="40" cy="24" r="2" fill="${accentHot}" opacity="0.9" filter="url(#iconStreetGlow-${uniqueId})"/>
          <circle cx="46" cy="24" r="1.5" fill="${accentCool}" opacity="0.8" filter="url(#iconStreetGlow-${uniqueId})"/>
        </svg>
      `;
    }
    
    // Full variant (larger, more detailed)
    return `
      <svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ghettoGradient-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${accentHot};stop-opacity:1" />
            <stop offset="50%" style="stop-color:${accentWarm};stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FFD700;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="coolGradient-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${accentCool};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${accentCold};stop-opacity:1" />
          </linearGradient>
          <filter id="streetGlow-${uniqueId}" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="ghettoShadow-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
            <feOffset dx="2" dy="3" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.4"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <rect width="120" height="120" rx="12" fill="${bgPrimary}"/>
        <rect x="2" y="2" width="116" height="116" rx="10" fill="${bgSecondary}" opacity="0.8"/>
        <path d="M 20 25 
                 L 20 95
                 L 25 95
                 L 25 85
                 L 35 90
                 L 45 88
                 L 55 85
                 L 60 80
                 L 60 70
                 L 55 65
                 L 50 60
                 L 45 55
                 L 40 50
                 L 35 45
                 L 30 40
                 L 25 35
                 L 20 30
                 Z" 
              fill="url(#ghettoGradient-${uniqueId})" 
              opacity="0.95"
              filter="url(#ghettoShadow-${uniqueId})"/>
        <path d="M 28 40
                 L 28 80
                 L 32 78
                 L 38 75
                 L 42 70
                 L 42 60
                 L 38 55
                 L 32 50
                 L 28 45
                 Z" 
              fill="${bgPrimary}" 
              opacity="0.7"/>
        <path d="M 25 35
                 L 30 40
                 L 35 45
                 L 40 50
                 L 45 55
                 L 50 60
                 L 55 65
                 L 60 70" 
              stroke="url(#coolGradient-${uniqueId})" 
              stroke-width="2.5" 
              stroke-linecap="round" 
              fill="none"
              opacity="0.6"
              filter="url(#streetGlow-${uniqueId})"/>
        <path d="M 70 40
                 L 72 35
                 L 75 40
                 L 78 32
                 L 81 40
                 L 84 38
                 L 87 40
                 L 90 35
                 L 93 40" 
              stroke="url(#ghettoGradient-${uniqueId})" 
              stroke-width="3" 
              stroke-linecap="round" 
              stroke-linejoin="round"
              fill="none"
              opacity="0.9"
              filter="url(#streetGlow-${uniqueId})"/>
        <path d="M 70 60
                 L 72 55
                 L 75 60
                 L 78 52
                 L 81 60
                 L 84 58
                 L 87 60
                 L 90 55
                 L 93 60" 
              stroke="url(#coolGradient-${uniqueId})" 
              stroke-width="2.5" 
              stroke-linecap="round" 
              stroke-linejoin="round"
              fill="none"
              opacity="0.7"
              filter="url(#streetGlow-${uniqueId})"/>
        <circle cx="75" cy="50" r="3" fill="${accentHot}" opacity="0.9" filter="url(#streetGlow-${uniqueId})"/>
        <circle cx="85" cy="50" r="2.5" fill="${accentCool}" opacity="0.8" filter="url(#streetGlow-${uniqueId})"/>
        <circle cx="90" cy="55" r="2" fill="${accentWarm}" opacity="0.7" filter="url(#streetGlow-${uniqueId})"/>
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
