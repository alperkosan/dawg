/**
 * DAWG Logo Component
 * Premium Brand Identity - Original, Clear, Recognizable
 * "Online Ghetto" Aesthetic with Professional Audio Focus
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
  
  // Generate SVG with theme colors - Premium Brand Identity
  const logoSvg = useMemo(() => {
    const isIcon = variant === 'icon';
    const viewBox = isIcon ? '0 0 64 64' : '0 0 160 64';
    const uniqueId = `${variant}-${size}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Icon variant (compact, highly recognizable)
    if (isIcon) {
      return `
        <svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="iconBrandGradient-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${accentHot};stop-opacity:1" />
              <stop offset="50%" style="stop-color:${accentWarm};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${accentCool};stop-opacity:1" />
            </linearGradient>
            <linearGradient id="iconWaveGradient-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:${accentCool};stop-opacity:0.9" />
              <stop offset="50%" style="stop-color:${accentWarm};stop-opacity:0.8" />
              <stop offset="100%" style="stop-color:${accentHot};stop-opacity:0.9" />
            </linearGradient>
            <filter id="iconBrandGlow-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <filter id="iconBrandShadow-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
              <feOffset dx="2" dy="2.5" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.5"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <!-- Background container -->
          <rect width="64" height="64" rx="12" fill="${bgPrimary}"/>
          <rect x="2" y="2" width="60" height="60" rx="10" fill="${bgSecondary}" opacity="0.95"/>
          
          <!-- Bold "D" - Primary brand element -->
          <path d="M 12 12 
                   L 12 52
                   L 18 52
                   L 18 46
                   L 24 48
                   L 30 47
                   L 34 45
                   L 34 39
                   L 30 37
                   L 24 36
                   L 18 34
                   L 12 30
                   L 12 12
                   Z" 
                fill="url(#iconBrandGradient-${uniqueId})" 
                opacity="1"
                filter="url(#iconBrandShadow-${uniqueId})"/>
          
          <!-- Inner highlight on D -->
          <path d="M 15 18
                   L 15 44
                   L 18 45
                   L 22 44
                   L 25 42
                   L 25 40
                   L 22 38
                   L 18 37
                   L 15 36
                   L 15 28
                   L 18 27
                   L 22 26
                   L 25 24
                   L 25 22
                   L 22 20
                   L 18 19
                   L 15 18
                   Z" 
                fill="${bgPrimary}" 
                opacity="0.6"/>
          
          <!-- Audio waveform - Brand identity -->
          <g filter="url(#iconBrandGlow-${uniqueId})">
            <!-- Waveform bars integrated with D -->
            <rect x="38" y="20" width="3" height="8" rx="1.5" fill="url(#iconWaveGradient-${uniqueId})" opacity="0.95"/>
            <rect x="42" y="16" width="3" height="16" rx="1.5" fill="url(#iconWaveGradient-${uniqueId})" opacity="0.95"/>
            <rect x="46" y="18" width="3" height="12" rx="1.5" fill="url(#iconWaveGradient-${uniqueId})" opacity="0.95"/>
            <rect x="50" y="14" width="3" height="20" rx="1.5" fill="url(#iconWaveGradient-${uniqueId})" opacity="0.95"/>
            
            <!-- Accent pulse dots -->
            <circle cx="40" cy="24" r="2" fill="${accentHot}" opacity="0.9"/>
            <circle cx="44" cy="24" r="1.5" fill="${accentCool}" opacity="0.85"/>
            <circle cx="48" cy="24" r="1.5" fill="${accentWarm}" opacity="0.85"/>
          </g>
        </svg>
      `;
    }
    
    // Full variant (horizontal layout with "DAWG" text + icon)
    return `
      <svg width="${size}" height="${size * 0.4}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="brandGradient-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${accentHot};stop-opacity:1" />
            <stop offset="50%" style="stop-color:${accentWarm};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${accentCool};stop-opacity:1" />
          </linearGradient>
          <linearGradient id="waveGradient-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:${accentCool};stop-opacity:0.9" />
            <stop offset="50%" style="stop-color:${accentWarm};stop-opacity:0.8" />
            <stop offset="100%" style="stop-color:${accentHot};stop-opacity:0.9" />
          </linearGradient>
          <linearGradient id="textGradient-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:${accentWarm};stop-opacity:1" />
            <stop offset="50%" style="stop-color:${accentCool};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${accentWarm};stop-opacity:1" />
          </linearGradient>
          <filter id="brandGlow-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="brandShadow-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
            <feOffset dx="2" dy="3" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.6"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="textGlow-${uniqueId}" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- Icon section: Bold "D" with waveform -->
        <g transform="translate(0, 0)">
          <!-- Background -->
          <rect width="64" height="64" rx="14" fill="${bgPrimary}"/>
          <rect x="2" y="2" width="60" height="60" rx="12" fill="${bgSecondary}" opacity="0.95"/>
          
          <!-- Bold "D" - Primary brand element -->
          <path d="M 12 12 
                   L 12 52
                   L 18 52
                   L 18 46
                   L 24 48
                   L 30 47
                   L 34 45
                   L 34 39
                   L 30 37
                   L 24 36
                   L 18 34
                   L 12 30
                   L 12 12
                   Z" 
                fill="url(#brandGradient-${uniqueId})" 
                opacity="1"
                filter="url(#brandShadow-${uniqueId})"/>
          
          <!-- Inner highlight -->
          <path d="M 15 18
                   L 15 44
                   L 18 45
                   L 22 44
                   L 25 42
                   L 25 40
                   L 22 38
                   L 18 37
                   L 15 36
                   L 15 28
                   L 18 27
                   L 22 26
                   L 25 24
                   L 25 22
                   L 22 20
                   L 18 19
                   L 15 18
                   Z" 
                fill="${bgPrimary}" 
                opacity="0.6"/>
          
          <!-- Audio waveform - Brand identity -->
          <g filter="url(#brandGlow-${uniqueId})">
            <rect x="38" y="20" width="3" height="8" rx="1.5" fill="url(#waveGradient-${uniqueId})" opacity="0.95"/>
            <rect x="42" y="16" width="3" height="16" rx="1.5" fill="url(#waveGradient-${uniqueId})" opacity="0.95"/>
            <rect x="46" y="18" width="3" height="12" rx="1.5" fill="url(#waveGradient-${uniqueId})" opacity="0.95"/>
            <rect x="50" y="14" width="3" height="20" rx="1.5" fill="url(#waveGradient-${uniqueId})" opacity="0.95"/>
            
            <!-- Accent pulse dots -->
            <circle cx="40" cy="24" r="2" fill="${accentHot}" opacity="0.9"/>
            <circle cx="44" cy="24" r="1.5" fill="${accentCool}" opacity="0.85"/>
            <circle cx="48" cy="24" r="1.5" fill="${accentWarm}" opacity="0.85"/>
          </g>
        </g>
        
        <!-- Text section: "DAWG" typography -->
        <g transform="translate(72, 0)">
          <!-- "DAWG" text with premium typography -->
          <text 
            x="0" 
            y="42" 
            font-family="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
            font-size="36"
            font-weight="800"
            letter-spacing="-0.02em"
            fill="url(#textGradient-${uniqueId})"
            filter="url(#textGlow-${uniqueId})"
            style="text-transform: uppercase;">
            DAWG
          </text>
          
          <!-- Subtitle: "Digital Audio Workstation" -->
          <text 
            x="0" 
            y="56" 
            font-family="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
            font-size="8"
            font-weight="500"
            letter-spacing="0.1em"
            fill="${accentCool}"
            opacity="0.7"
            style="text-transform: uppercase;">
            Digital Audio Workstation
          </text>
        </g>
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
        width: variant === 'icon' ? size : size * 2.5, // Full variant is wider
        height: size,
      }}
      dangerouslySetInnerHTML={{ __html: logoSvg }}
    />
  );
};

export default DawgLogo;
