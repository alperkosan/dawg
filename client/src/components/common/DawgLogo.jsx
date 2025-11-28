/**
 * DAWG Logo Component
 * BOOMBOX FOCUSED - Iconic boombox design celebrating underground culture
 * Where sound meets community, talent rises, and beats drop
 */

import React, { useMemo, useId } from 'react';
import { useThemeStore } from '../../store/useThemeStore';

const useThemePalette = () => {
  const theme = useThemeStore(state => {
    const { themes, activeThemeId } = state;
    return themes.find(t => t.id === activeThemeId) || themes[0];
  });

  return useMemo(
    () => ({
      primary: theme?.zenith?.['accent-hot'] || '#FF6B35',
      secondary: theme?.zenith?.['accent-warm'] || '#FFB627',
      tertiary: theme?.zenith?.['accent-cool'] || '#4ECDC4',
      quaternary: theme?.zenith?.['accent-cold'] || '#556FB5',
      surface: theme?.zenith?.['bg-secondary'] || '#151922',
      surfaceDeep: theme?.zenith?.['bg-primary'] || '#0A0E1A',
      textPrimary: theme?.zenith?.['text-primary'] || '#FFFFFF',
      textMuted: theme?.zenith?.['text-secondary'] || '#A1A8B5'
    }),
    [theme]
  );
};

const BoomboxLogo = ({ palette, uniqueId, isIcon, offsetX = 0, offsetY = 0 }) => {
  // 100x100 alan için optimize - her detay maksimum etki için
  return (
    <g transform={`translate(${offsetX}, ${offsetY})`} opacity={1}>
      <defs>
        {/* Main boombox gradient - bold and vibrant */}
        <linearGradient id={`boombox-gradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.primary} />
          <stop offset="50%" stopColor={palette.secondary} />
          <stop offset="100%" stopColor={palette.tertiary} />
        </linearGradient>

        {/* Text gradient - high contrast */}
        <linearGradient id={`text-gradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={palette.secondary} />
          <stop offset="50%" stopColor={palette.primary} />
          <stop offset="100%" stopColor={palette.tertiary} />
        </linearGradient>

        {/* Strong glow for impact */}
        <filter id={`glow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Simple speaker pattern - visible at small sizes */}
        <pattern id={`speaker-dots-${uniqueId}`} x="0" y="0" width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.6" fill={palette.surfaceDeep} opacity="0.8" />
        </pattern>

        {/* Shine effect */}
        <linearGradient id={`shine-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.5" />
          <stop offset="50%" stopColor="white" stopOpacity="0.2" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Main boombox body - fills 100x100 space efficiently */}
      <g filter={`url(#glow-${uniqueId})`}>
        {/* Boombox case - main body, fills most space */}
        <rect
          x="8"
          y="15"
          width="84"
          height="60"
          rx="5"
          ry="5"
          fill={`url(#boombox-gradient-${uniqueId})`}
          stroke={palette.surface}
          strokeWidth="2"
        />

        {/* Top shine - adds depth */}
        <rect
          x="8"
          y="15"
          width="84"
          height="30"
          rx="5"
          fill={`url(#shine-${uniqueId})`}
        />

        {/* Left speaker - bold and clear */}
        <g transform="translate(15, 22)">
          <rect
            x="0"
            y="0"
            width="24"
            height="24"
            rx="3"
            fill={palette.surfaceDeep}
            opacity="0.9"
          />
          <rect
            x="1.5"
            y="1.5"
            width="21"
            height="21"
            rx="2"
            fill={`url(#speaker-dots-${uniqueId})`}
          />
          {/* Speaker center highlight - visible */}
          <circle
            cx="12"
            cy="12"
            r="7"
            fill="none"
            stroke={palette.secondary}
            strokeWidth="1.5"
            opacity="0.8"
          />
        </g>

        {/* Center - DAWG text - MAXIMUM IMPACT */}
        <g transform="translate(38, 26)">
          <rect
            x="0"
            y="0"
            width="24"
            height="16"
            rx="2.5"
            fill={palette.surfaceDeep}
            opacity="0.95"
          />
          <text
            x="12"
            y="11"
            fontFamily="'Sora', 'Inter', sans-serif"
            fontSize="10"
            fontWeight="900"
            letterSpacing="0.08em"
            fill={`url(#text-gradient-${uniqueId})`}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            DAWG
          </text>
        </g>

        {/* Right speaker - bold and clear */}
        <g transform="translate(61, 22)">
          <rect
            x="0"
            y="0"
            width="24"
            height="24"
            rx="3"
            fill={palette.surfaceDeep}
            opacity="0.9"
          />
          <rect
            x="1.5"
            y="1.5"
            width="21"
            height="21"
            rx="2"
            fill={`url(#speaker-dots-${uniqueId})`}
          />
          {/* Speaker center highlight - visible */}
          <circle
            cx="12"
            cy="12"
            r="7"
            fill="none"
            stroke={palette.tertiary}
            strokeWidth="1.5"
            opacity="0.8"
          />
        </g>

        {/* Bottom accent bar - visual anchor */}
        <rect
          x="15"
          y="70"
          width="70"
          height="5"
          rx="2.5"
          fill={palette.surfaceDeep}
          opacity="0.85"
        />
        {/* Audio level bars - colorful indicators */}
        <rect x="18" y="71.5" width="5" height="2" rx="0.5" fill={palette.primary} />
        <rect x="25" y="71.5" width="5" height="2" rx="0.5" fill={palette.secondary} />
        <rect x="32" y="71.5" width="5" height="2" rx="0.5" fill={palette.tertiary} />
        <rect x="39" y="71.5" width="5" height="2" rx="0.5" fill={palette.quaternary} />

        {/* Audio waves - minimal but impactful */}
        <g transform="translate(0, 8)" opacity="0.95">
          <path
            d="M18 7 Q21 4, 24 7 Q27 10, 30 7"
            fill="none"
            stroke={palette.secondary}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M70 7 Q73 4, 76 7 Q79 10, 82 7"
            fill="none"
            stroke={palette.tertiary}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </g>
    </g>
  );
};

export const DawgLogo = ({ size = 32, className = '', variant = 'full' }) => {
  const palette = useThemePalette();
  const uniqueId = useId();
  const isIcon = variant === 'icon';

  // 100x100 alan için optimize edilmiş boyutlar
  const svgHeight = size;
  const svgWidth = size; // Her zaman kare
  const viewBoxSize = 100; // 100x100 viewBox
  const boomboxSize = 100; // Boombox tam alanı kullanır
  const logoOffsetX = 0;
  const logoOffsetY = 0;

  const wordmark = !isIcon && (
    <g transform={`translate(50, 88)`} opacity={0.95}>
      <defs>
        <linearGradient id={`wordmark-gradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={palette.secondary} />
          <stop offset="50%" stopColor={palette.primary} />
          <stop offset="100%" stopColor={palette.tertiary} />
        </linearGradient>
      </defs>
      <text
        x={0}
        y={0}
        fontFamily="'Sora', 'Inter', -apple-system, sans-serif"
        fontSize="7"
        fontWeight="800"
        letterSpacing="0.1em"
        fill={`url(#wordmark-gradient-${uniqueId})`}
        textAnchor="middle"
      >
        ELEVATE
      </text>
    </g>
  );
  
  return (
    <svg
      role="img"
      aria-label="DAWG logo - Boombox"
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      className={className}
      style={{ display: 'block' }}
    >
      <BoomboxLogo
        palette={palette}
        uniqueId={uniqueId}
        isIcon={isIcon}
        offsetX={logoOffsetX}
        offsetY={logoOffsetY}
      />
      {wordmark}
    </svg>
  );
};

export default DawgLogo;
