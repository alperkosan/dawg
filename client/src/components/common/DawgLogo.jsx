/**
 * DAWG Logo Component
 * ONLINE GHETTO - Graffiti & Drip Aesthetic
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

  // Get theme colors for graffiti logo - vibrant street colors
  const accentHot = activeTheme?.zenith?.['accent-hot'] || '#FF6B35';
  const accentWarm = activeTheme?.zenith?.['accent-warm'] || '#FFB627';
  const accentCool = activeTheme?.zenith?.['accent-cool'] || '#4ECDC4';
  const accentCold = activeTheme?.zenith?.['accent-cold'] || '#556FB5';
  const bgPrimary = activeTheme?.zenith?.['bg-primary'] || '#0A0E1A';
  const bgSecondary = activeTheme?.zenith?.['bg-secondary'] || '#151922';
  
  // Generate SVG with theme colors - Graffiti & Drip Style
  const logoSvg = useMemo(() => {
    const isIcon = variant === 'icon';
    const viewBox = isIcon ? '0 0 80 80' : '0 0 200 80';
    const uniqueId = `${variant}-${size}-${Date.now().toString(36)}`;

    // Icon variant (compact graffiti "D" with subtle drips for avatar)
    if (isIcon) {
      return `
        <svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <!-- Graffiti gradient - vibrant street colors -->
            <linearGradient id="graffiti-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${accentHot};stop-opacity:1" />
              <stop offset="30%" style="stop-color:${accentWarm};stop-opacity:1" />
              <stop offset="70%" style="stop-color:${accentCool};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${accentCold};stop-opacity:1" />
            </linearGradient>

            <!-- Spray paint glow -->
            <filter id="spray-glow-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            <!-- Graffiti shadow (3D effect) -->
            <filter id="graffiti-shadow-${uniqueId}">
              <feDropShadow dx="2" dy="3" stdDeviation="2" flood-color="#000000" flood-opacity="0.7"/>
              <feDropShadow dx="3" dy="4" stdDeviation="1" flood-color="${accentHot}" flood-opacity="0.4"/>
            </filter>
          </defs>

          <!-- Background container with rounded corners -->
          <rect width="80" height="80" rx="16" fill="${bgPrimary}" opacity="0.9"/>
          <rect x="2" y="2" width="76" height="76" rx="14" fill="${bgSecondary}" opacity="0.6"/>

          <!-- Graffiti "D" - centered and compact -->
          <g transform="translate(12, 10)">
            <!-- Black outline shadow -->
            <path d="M 8 8
                     L 8 50
                     L 14 50
                     L 22 52
                     L 30 50
                     L 36 45
                     L 40 38
                     L 40 28
                     L 36 21
                     L 30 16
                     L 22 14
                     L 14 16
                     L 8 16
                     L 8 8
                     Z"
                  fill="#000000"
                  opacity="0.8"
                  transform="translate(2, 2)"/>

            <!-- Main graffiti "D" -->
            <path d="M 8 8
                     L 8 50
                     L 14 50
                     L 22 52
                     L 30 50
                     L 36 45
                     L 40 38
                     L 40 28
                     L 36 21
                     L 30 16
                     L 22 14
                     L 14 16
                     L 8 16
                     L 8 8
                     Z"
                  fill="url(#graffiti-${uniqueId})"
                  stroke="${accentHot}"
                  stroke-width="2.5"
                  filter="url(#graffiti-shadow-${uniqueId})"/>

            <!-- Inner cut-out -->
            <path d="M 15 14
                     L 15 44
                     L 20 45
                     L 26 44
                     L 30 40
                     L 32 33
                     L 30 26
                     L 26 22
                     L 20 21
                     L 15 22
                     L 15 14
                     Z"
                  fill="${bgPrimary}"
                  opacity="0.95"/>

            <!-- Spray paint highlights -->
            <g filter="url(#spray-glow-${uniqueId})" opacity="0.6">
              <ellipse cx="16" cy="16" rx="3" ry="1.5" fill="${accentWarm}"/>
              <circle cx="19" cy="19" r="1.2" fill="${accentCool}"/>
              <circle cx="22" cy="21" r="0.8" fill="${accentHot}"/>
            </g>

            <!-- Compact drip effects - subtle, contained within square -->
            <g filter="url(#spray-glow-${uniqueId})">
              <!-- Small drip left -->
              <path d="M 10 50 L 10 56 Q 10 58, 11 58.5 Q 12 59, 13 58.5 Q 14 58, 14 56 L 14 50 Z"
                    fill="${accentHot}" opacity="0.75"/>

              <!-- Small drip center -->
              <path d="M 20 52 L 20 57 Q 20 59, 21 59.5 Q 22 60, 23 59.5 Q 24 59, 24 57 L 24 52 Z"
                    fill="${accentCool}" opacity="0.75"/>

              <!-- Small drip right -->
              <path d="M 32 50 L 32 55 Q 32 57, 33 57.5 Q 34 58, 35 57.5 Q 36 57, 36 55 L 36 50 Z"
                    fill="${accentWarm}" opacity="0.75"/>

              <!-- Tiny drip dots -->
              <circle cx="12" cy="59" r="1.5" fill="${accentHot}" opacity="0.6"/>
              <ellipse cx="22" cy="60" rx="1.5" ry="2" fill="${accentCool}" opacity="0.6"/>
              <circle cx="34" cy="58" r="1.2" fill="${accentWarm}" opacity="0.6"/>
            </g>
          </g>

          <!-- Waveform bars - compact, integrated -->
          <g transform="translate(54, 18)" filter="url(#spray-glow-${uniqueId})">
            <rect x="0" y="10" width="2.5" height="8" rx="1.25" fill="${accentHot}" opacity="0.9"/>
            <rect x="4" y="6" width="2.5" height="16" rx="1.25" fill="${accentCool}" opacity="0.9"/>
            <rect x="8" y="8" width="2.5" height="12" rx="1.25" fill="${accentWarm}" opacity="0.9"/>
            <rect x="12" y="4" width="2.5" height="20" rx="1.25" fill="${accentCold}" opacity="0.9"/>
          </g>

          <!-- "ONLINE GHETTO" tag - compact bottom text -->
          <text
            x="40"
            y="72"
            font-family="'Courier New', monospace"
            font-size="5"
            font-weight="700"
            letter-spacing="0.1em"
            fill="${accentCool}"
            opacity="0.8"
            text-anchor="middle"
            filter="url(#spray-glow-${uniqueId})"
            style="text-transform: uppercase;">
            ONLINE GHETTO
          </text>
        </svg>
      `;
    }
    
    // Full variant (graffiti "DAWG" with drips)
    return `
      <svg width="${size * 2.5}" height="${size}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Graffiti gradient - vibrant street colors -->
          <linearGradient id="graffiti-full-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${accentHot};stop-opacity:1" />
            <stop offset="30%" style="stop-color:${accentWarm};stop-opacity:1" />
            <stop offset="70%" style="stop-color:${accentCool};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${accentCold};stop-opacity:1" />
          </linearGradient>

          <linearGradient id="text-graffiti-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:${accentHot};stop-opacity:1" />
            <stop offset="25%" style="stop-color:${accentWarm};stop-opacity:1" />
            <stop offset="50%" style="stop-color:${accentCool};stop-opacity:1" />
            <stop offset="75%" style="stop-color:${accentCold};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${accentHot};stop-opacity:1" />
          </linearGradient>

          <!-- Spray paint glow -->
          <filter id="spray-glow-full-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <!-- Graffiti 3D shadow -->
          <filter id="graffiti-shadow-full-${uniqueId}">
            <feDropShadow dx="2" dy="3" stdDeviation="2" flood-color="#000000" flood-opacity="0.7"/>
            <feDropShadow dx="4" dy="5" stdDeviation="1" flood-color="${accentHot}" flood-opacity="0.5"/>
          </filter>

          <!-- Text shadow -->
          <filter id="text-shadow-${uniqueId}">
            <feDropShadow dx="3" dy="4" stdDeviation="2" flood-color="#000000" flood-opacity="0.8"/>
            <feDropShadow dx="1" dy="1" stdDeviation="3" flood-color="${accentCool}" flood-opacity="0.6"/>
          </filter>
        </defs>

        <!-- Dark background -->
        <rect width="200" height="80" fill="${bgPrimary}" opacity="0.2"/>

        <!-- GRAFFITI "D" ICON - compact -->
        <g transform="translate(4, 12)">
          <!-- Outline shadow -->
          <path d="M 6 4
                   L 6 36
                   L 11 36
                   L 17 38
                   L 23 36
                   L 27 32
                   L 29 26
                   L 29 22
                   L 27 16
                   L 23 12
                   L 17 10
                   L 11 12
                   L 6 12
                   L 6 4
                   Z"
                fill="#000000"
                opacity="0.7"
                transform="translate(1.5, 1.5)"/>

          <!-- Main "D" -->
          <path d="M 6 4
                   L 6 36
                   L 11 36
                   L 17 38
                   L 23 36
                   L 27 32
                   L 29 26
                   L 29 22
                   L 27 16
                   L 23 12
                   L 17 10
                   L 11 12
                   L 6 12
                   L 6 4
                   Z"
                fill="url(#graffiti-full-${uniqueId})"
                stroke="${accentHot}"
                stroke-width="2"
                filter="url(#graffiti-shadow-full-${uniqueId})"/>

          <!-- Inner cut -->
          <path d="M 11 8
                   L 11 32
                   L 15 33
                   L 19 32
                   L 22 28
                   L 23 24
                   L 22 20
                   L 19 16
                   L 15 15
                   L 11 16
                   L 11 8
                   Z"
                fill="${bgPrimary}"
                opacity="0.95"/>

          <!-- Spray highlights -->
          <g filter="url(#spray-glow-full-${uniqueId})" opacity="0.5">
            <ellipse cx="10" cy="10" rx="2.5" ry="1.2" fill="${accentWarm}"/>
            <circle cx="13" cy="13" r="0.8" fill="${accentHot}"/>
          </g>

          <!-- Compact drips from D -->
          <g filter="url(#spray-glow-full-${uniqueId})">
            <path d="M 8 36 L 8 42 Q 8 44, 9 45 Q 10 46, 11 45 Q 12 44, 12 42 L 12 36 Z"
                  fill="${accentHot}" opacity="0.7"/>
            <path d="M 16 38 L 16 44 Q 16 46, 17 47 Q 18 48, 19 47 Q 20 46, 20 44 L 20 38 Z"
                  fill="${accentCool}" opacity="0.7"/>
            <circle cx="10" cy="46" r="1.2" fill="${accentHot}" opacity="0.5"/>
            <circle cx="18" cy="48" r="1" fill="${accentCool}" opacity="0.5"/>
          </g>
        </g>

        <!-- GRAFFITI "DAWG" TEXT -->
        <g transform="translate(50, 0)">
          <!-- Text outline/shadow -->
          <text
            x="0"
            y="42"
            font-family="'Impact', 'Arial Black', sans-serif"
            font-size="42"
            font-weight="900"
            letter-spacing="0.05em"
            fill="#000000"
            opacity="0.8"
            transform="translate(2, 3)"
            style="text-transform: uppercase;">
            DAWG
          </text>

          <!-- Main graffiti text -->
          <text
            x="0"
            y="42"
            font-family="'Impact', 'Arial Black', sans-serif"
            font-size="42"
            font-weight="900"
            letter-spacing="0.05em"
            fill="url(#text-graffiti-${uniqueId})"
            stroke="${accentHot}"
            stroke-width="1.5"
            filter="url(#text-shadow-${uniqueId})"
            style="text-transform: uppercase; paint-order: stroke fill;">
            DAWG
          </text>

          <!-- Spray paint splatters on text -->
          <g filter="url(#spray-glow-full-${uniqueId})" opacity="0.5">
            <circle cx="8" cy="18" r="2" fill="${accentWarm}"/>
            <ellipse cx="35" cy="16" rx="2.5" ry="1.5" fill="${accentCool}"/>
            <circle cx="70" cy="20" r="1.5" fill="${accentHot}"/>
            <ellipse cx="105" cy="17" rx="2" ry="1" fill="${accentCold}"/>
          </g>

          <!-- Drips from letters - more controlled -->
          <g filter="url(#spray-glow-full-${uniqueId})">
            <!-- Drip from D -->
            <path d="M 12 42 L 12 48 Q 12 50, 13.5 51 Q 15 52, 16.5 51 Q 18 50, 18 48 L 18 42 Z"
                  fill="${accentHot}" opacity="0.7"/>

            <!-- Drip from A -->
            <path d="M 35 42 L 35 47 Q 35 49, 36.5 50 Q 38 51, 39.5 50 Q 41 49, 41 47 L 41 42 Z"
                  fill="${accentCool}" opacity="0.7"/>

            <!-- Drip from W -->
            <path d="M 70 42 L 70 50 Q 70 52, 71.5 53 Q 73 54, 74.5 53 Q 76 52, 76 50 L 76 42 Z"
                  fill="${accentWarm}" opacity="0.7"/>

            <!-- Drip from G -->
            <path d="M 105 42 L 105 46 Q 105 48, 106.5 49 Q 108 50, 109.5 49 Q 111 48, 111 46 L 111 42 Z"
                  fill="${accentCold}" opacity="0.7"/>

            <!-- Tiny drip dots -->
            <circle cx="15" cy="52" r="1.2" fill="${accentHot}" opacity="0.5"/>
            <circle cx="38" cy="51" r="1" fill="${accentCool}" opacity="0.5"/>
            <circle cx="73" cy="54" r="1.3" fill="${accentWarm}" opacity="0.5"/>
            <circle cx="108" cy="50" r="1" fill="${accentCold}" opacity="0.5"/>
          </g>

          <!-- Subtitle with graffiti style -->
          <text
            x="0"
            y="62"
            font-family="'Courier New', monospace"
            font-size="6"
            font-weight="700"
            letter-spacing="0.12em"
            fill="${accentCool}"
            opacity="0.8"
            filter="url(#spray-glow-full-${uniqueId})"
            style="text-transform: uppercase;">
            ONLINE GHETTO
          </text>
        </g>

        <!-- Waveform bars - street style -->
        <g transform="translate(168, 20)" filter="url(#spray-glow-full-${uniqueId})">
          <rect x="0" y="8" width="3" height="12" rx="1.5" fill="${accentHot}" opacity="0.95"/>
          <rect x="5" y="4" width="3" height="20" rx="1.5" fill="${accentCool}" opacity="0.95"/>
          <rect x="10" y="6" width="3" height="16" rx="1.5" fill="${accentWarm}" opacity="0.95"/>
          <rect x="15" y="2" width="3" height="24" rx="1.5" fill="${accentCold}" opacity="0.95"/>
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
