/**
 * DAWG Logo Component
 * GHETTO BLASTER - Boombox inspired graffiti logo
 * Street Art vibes meets Digital Audio Production
 */

import React, { useMemo } from 'react';
import { useThemeStore } from '../../store/useThemeStore';

export const DawgLogo = ({ size = 32, className = '', variant = 'full' }) => {
  // Subscribe to theme changes to update logo colors dynamically
  const activeTheme = useThemeStore(state => {
    const { themes, activeThemeId } = state;
    return themes.find(t => t.id === activeThemeId) || themes[0];
  });

  // Get theme colors for graffiti boombox - vibrant street colors
  const accentHot = activeTheme?.zenith?.['accent-hot'] || '#FF6B35';
  const accentWarm = activeTheme?.zenith?.['accent-warm'] || '#FFB627';
  const accentCool = activeTheme?.zenith?.['accent-cool'] || '#4ECDC4';
  const accentCold = activeTheme?.zenith?.['accent-cold'] || '#556FB5';
  const bgPrimary = activeTheme?.zenith?.['bg-primary'] || '#0A0E1A';
  const bgSecondary = activeTheme?.zenith?.['bg-secondary'] || '#151922';

  // Generate SVG with theme colors - Ghetto Blaster Style
  const logoSvg = useMemo(() => {
    const isIcon = variant === 'icon';
    const viewBox = isIcon ? '0 0 100 100' : '0 0 220 100';
    const uniqueId = `${variant}-${size}-${Date.now().toString(36)}`;

    // Icon variant (compact ghetto blaster for avatar)
    if (isIcon) {
      return `
        <svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <!-- Graffiti gradients -->
            <linearGradient id="body-grad-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${accentHot};stop-opacity:1" />
              <stop offset="50%" style="stop-color:${accentWarm};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${accentCool};stop-opacity:1" />
            </linearGradient>

            <linearGradient id="speaker-grad-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${accentCool};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${accentCold};stop-opacity:1" />
            </linearGradient>

            <!-- Spray glow -->
            <filter id="glow-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            <!-- 3D shadow -->
            <filter id="shadow-${uniqueId}">
              <feDropShadow dx="2" dy="3" stdDeviation="2" flood-color="#000000" flood-opacity="0.8"/>
              <feDropShadow dx="3" dy="4" stdDeviation="1" flood-color="${accentHot}" flood-opacity="0.3"/>
            </filter>
          </defs>

          <!-- Background -->
          <rect width="100" height="100" rx="18" fill="${bgPrimary}" opacity="0.95"/>
          <rect x="3" y="3" width="94" height="94" rx="16" fill="${bgSecondary}" opacity="0.7"/>

          <!-- GHETTO BLASTER / BOOMBOX -->
          <g transform="translate(15, 18)">
            <!-- Main boombox body - shadow -->
            <rect x="2" y="2" width="70" height="50" rx="6" fill="#000000" opacity="0.7"/>

            <!-- Main boombox body -->
            <rect x="0" y="0" width="70" height="50" rx="6"
                  fill="url(#body-grad-${uniqueId})"
                  stroke="${accentHot}"
                  stroke-width="2.5"
                  filter="url(#shadow-${uniqueId})"/>

            <!-- Left speaker -->
            <g transform="translate(8, 10)">
              <!-- Speaker cone -->
              <circle cx="10" cy="15" r="12" fill="${bgPrimary}" opacity="0.9" stroke="${accentCool}" stroke-width="2"/>
              <!-- Speaker grille -->
              <circle cx="10" cy="15" r="9" fill="none" stroke="url(#speaker-grad-${uniqueId})" stroke-width="1.5"/>
              <circle cx="10" cy="15" r="6" fill="none" stroke="${accentCool}" stroke-width="1"/>
              <circle cx="10" cy="15" r="3" fill="${accentCool}" opacity="0.8"/>
            </g>

            <!-- Right speaker -->
            <g transform="translate(40, 10)">
              <!-- Speaker cone -->
              <circle cx="10" cy="15" r="12" fill="${bgPrimary}" opacity="0.9" stroke="${accentCool}" stroke-width="2"/>
              <!-- Speaker grille -->
              <circle cx="10" cy="15" r="9" fill="none" stroke="url(#speaker-grad-${uniqueId})" stroke-width="1.5"/>
              <circle cx="10" cy="15" r="6" fill="none" stroke="${accentCool}" stroke-width="1"/>
              <circle cx="10" cy="15" r="3" fill="${accentCool}" opacity="0.8"/>
            </g>

            <!-- Center cassette/display panel -->
            <rect x="28" y="18" width="14" height="14" rx="2" fill="${bgPrimary}" opacity="0.9" stroke="${accentWarm}" stroke-width="1.5"/>

            <!-- Cassette spools -->
            <circle cx="32" cy="25" r="2.5" fill="none" stroke="${accentWarm}" stroke-width="1"/>
            <circle cx="38" cy="25" r="2.5" fill="none" stroke="${accentWarm}" stroke-width="1"/>
            <circle cx="32" cy="25" r="1" fill="${accentWarm}" opacity="0.7"/>
            <circle cx="38" cy="25" r="1" fill="${accentWarm}" opacity="0.7"/>

            <!-- Handle on top -->
            <path d="M 20 0 Q 20 -5, 25 -5 L 45 -5 Q 50 -5, 50 0"
                  fill="none"
                  stroke="${accentHot}"
                  stroke-width="2.5"
                  stroke-linecap="round"/>

            <!-- EQ / Waveform bars -->
            <g transform="translate(5, 38)" filter="url(#glow-${uniqueId})">
              <rect x="0" y="4" width="2" height="5" rx="1" fill="${accentHot}" opacity="0.9"/>
              <rect x="4" y="2" width="2" height="7" rx="1" fill="${accentCool}" opacity="0.9"/>
              <rect x="8" y="3" width="2" height="6" rx="1" fill="${accentWarm}" opacity="0.9"/>
              <rect x="12" y="1" width="2" height="8" rx="1" fill="${accentCold}" opacity="0.9"/>
              <rect x="16" y="3" width="2" height="6" rx="1" fill="${accentHot}" opacity="0.9"/>

              <rect x="44" y="4" width="2" height="5" rx="1" fill="${accentHot}" opacity="0.9"/>
              <rect x="48" y="2" width="2" height="7" rx="1" fill="${accentCool}" opacity="0.9"/>
              <rect x="52" y="3" width="2" height="6" rx="1" fill="${accentWarm}" opacity="0.9"/>
              <rect x="56" y="1" width="2" height="8" rx="1" fill="${accentCold}" opacity="0.9"/>
              <rect x="60" y="3" width="2" height="6" rx="1" fill="${accentHot}" opacity="0.9"/>
            </g>

            <!-- DRIP EFFECTS -->
            <g filter="url(#glow-${uniqueId})">
              <!-- Drip from left speaker -->
              <path d="M 15 50 L 15 56 Q 15 58, 16 59 Q 17 60, 18 59 Q 19 58, 19 56 L 19 50 Z"
                    fill="${accentCool}" opacity="0.75"/>
              <circle cx="17" cy="60" r="1.5" fill="${accentCool}" opacity="0.6"/>

              <!-- Drip from center -->
              <path d="M 34 50 L 34 58 Q 34 60, 35 61 Q 36 62, 37 61 Q 38 60, 38 58 L 38 50 Z"
                    fill="${accentWarm}" opacity="0.75"/>
              <circle cx="36" cy="62" r="1.5" fill="${accentWarm}" opacity="0.6"/>

              <!-- Drip from right speaker -->
              <path d="M 52 50 L 52 55 Q 52 57, 53 58 Q 54 59, 55 58 Q 56 57, 56 55 L 56 50 Z"
                    fill="${accentHot}" opacity="0.75"/>
              <circle cx="54" cy="59" r="1.2" fill="${accentHot}" opacity="0.6"/>
            </g>
          </g>

          <!-- "GHETTO BLASTER" tag -->
          <text
            x="50"
            y="90"
            font-family="'Courier New', monospace"
            font-size="5"
            font-weight="700"
            letter-spacing="0.15em"
            fill="${accentCool}"
            opacity="0.85"
            text-anchor="middle"
            filter="url(#glow-${uniqueId})"
            style="text-transform: uppercase;">
            GHETTO BLASTER
          </text>
        </svg>
      `;
    }
    
    // Full variant (just ghetto blaster, wider for horizontal use)
    return `
      <svg width="${size * 2.5}" height="${size}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Graffiti gradients -->
          <linearGradient id="body-full-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${accentHot};stop-opacity:1" />
            <stop offset="50%" style="stop-color:${accentWarm};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${accentCool};stop-opacity:1" />
          </linearGradient>

          <linearGradient id="speaker-full-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${accentCool};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${accentCold};stop-opacity:1" />
          </linearGradient>

          <!-- Spray glow -->
          <filter id="glow-full-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <!-- 3D shadow -->
          <filter id="shadow-full-${uniqueId}">
            <feDropShadow dx="2" dy="3" stdDeviation="2" flood-color="#000000" flood-opacity="0.8"/>
            <feDropShadow dx="3" dy="4" stdDeviation="1" flood-color="${accentHot}" flood-opacity="0.3"/>
          </filter>
        </defs>

        <!-- Background -->
        <rect width="220" height="100" fill="${bgPrimary}" opacity="0.2"/>

        <!-- GHETTO BLASTER - centered, larger -->
        <g transform="translate(60, 15)">
          <!-- Boombox body shadow -->
          <rect x="3" y="3" width="80" height="58" rx="7" fill="#000000" opacity="0.7"/>

          <!-- Boombox body -->
          <rect x="0" y="0" width="80" height="58" rx="7"
                fill="url(#body-full-${uniqueId})"
                stroke="${accentHot}"
                stroke-width="2.5"
                filter="url(#shadow-full-${uniqueId})"/>

          <!-- Left speaker -->
          <g transform="translate(10, 12)">
            <circle cx="12" cy="17" r="14" fill="${bgPrimary}" opacity="0.9" stroke="${accentCool}" stroke-width="2"/>
            <circle cx="12" cy="17" r="10" fill="none" stroke="url(#speaker-full-${uniqueId})" stroke-width="1.8"/>
            <circle cx="12" cy="17" r="6.5" fill="none" stroke="${accentCool}" stroke-width="1.2"/>
            <circle cx="12" cy="17" r="3" fill="${accentCool}" opacity="0.8"/>
          </g>

          <!-- Right speaker -->
          <g transform="translate(44, 12)">
            <circle cx="12" cy="17" r="14" fill="${bgPrimary}" opacity="0.9" stroke="${accentCool}" stroke-width="2"/>
            <circle cx="12" cy="17" r="10" fill="none" stroke="url(#speaker-full-${uniqueId})" stroke-width="1.8"/>
            <circle cx="12" cy="17" r="6.5" fill="none" stroke="${accentCool}" stroke-width="1.2"/>
            <circle cx="12" cy="17" r="3" fill="${accentCool}" opacity="0.8"/>
          </g>

          <!-- Center cassette -->
          <rect x="32" y="21" width="16" height="16" rx="2" fill="${bgPrimary}" opacity="0.9" stroke="${accentWarm}" stroke-width="1.5"/>
          <circle cx="36" cy="29" r="3" fill="none" stroke="${accentWarm}" stroke-width="1"/>
          <circle cx="44" cy="29" r="3" fill="none" stroke="${accentWarm}" stroke-width="1"/>
          <circle cx="36" cy="29" r="1.2" fill="${accentWarm}" opacity="0.7"/>
          <circle cx="44" cy="29" r="1.2" fill="${accentWarm}" opacity="0.7"/>

          <!-- Handle -->
          <path d="M 24 0 Q 24 -6, 30 -6 L 50 -6 Q 56 -6, 56 0"
                fill="none"
                stroke="${accentHot}"
                stroke-width="2.8"
                stroke-linecap="round"/>

          <!-- EQ bars -->
          <g transform="translate(6, 44)" filter="url(#glow-full-${uniqueId})">
            <rect x="0" y="4" width="2" height="6" rx="1" fill="${accentHot}" opacity="0.9"/>
            <rect x="4" y="2" width="2" height="8" rx="1" fill="${accentCool}" opacity="0.9"/>
            <rect x="8" y="3" width="2" height="7" rx="1" fill="${accentWarm}" opacity="0.9"/>
            <rect x="12" y="1" width="2" height="9" rx="1" fill="${accentCold}" opacity="0.9"/>
            <rect x="16" y="3" width="2" height="7" rx="1" fill="${accentHot}" opacity="0.9"/>

            <rect x="52" y="4" width="2" height="6" rx="1" fill="${accentHot}" opacity="0.9"/>
            <rect x="56" y="2" width="2" height="8" rx="1" fill="${accentCool}" opacity="0.9"/>
            <rect x="60" y="3" width="2" height="7" rx="1" fill="${accentWarm}" opacity="0.9"/>
            <rect x="64" y="1" width="2" height="9" rx="1" fill="${accentCold}" opacity="0.9"/>
            <rect x="68" y="3" width="2" height="7" rx="1" fill="${accentHot}" opacity="0.9"/>
          </g>

          <!-- Drips -->
          <g filter="url(#glow-full-${uniqueId})">
            <path d="M 18 58 L 18 65 Q 18 67, 19.5 68 Q 21 69, 22.5 68 Q 24 67, 24 65 L 24 58 Z"
                  fill="${accentCool}" opacity="0.75"/>
            <circle cx="21" cy="69" r="1.5" fill="${accentCool}" opacity="0.6"/>

            <path d="M 39 58 L 39 67 Q 39 69, 40.5 70 Q 42 71, 43.5 70 Q 45 69, 45 67 L 45 58 Z"
                  fill="${accentWarm}" opacity="0.75"/>
            <circle cx="42" cy="71" r="1.5" fill="${accentWarm}" opacity="0.6"/>

            <path d="M 60 58 L 60 64 Q 60 66, 61.5 67 Q 63 68, 64.5 67 Q 66 66, 66 64 L 66 58 Z"
                  fill="${accentHot}" opacity="0.75"/>
            <circle cx="63" cy="68" r="1.3" fill="${accentHot}" opacity="0.6"/>
          </g>

          <!-- "GHETTO BLASTER" tag -->
          <text
            x="40"
            y="82"
            font-family="'Courier New', monospace"
            font-size="6"
            font-weight="700"
            letter-spacing="0.15em"
            fill="${accentCool}"
            opacity="0.85"
            text-anchor="middle"
            filter="url(#glow-full-${uniqueId})"
            style="text-transform: uppercase;">
            GHETTO BLASTER
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
