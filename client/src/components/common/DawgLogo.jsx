/**
 * DAWG Logo Component
 * UNDERGROUND - Abstract graffiti-inspired logo
 * Street Art vibes meets Digital Audio Production
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
      primary: theme?.zenith?.['accent-hot'] || '#FF4411',
      secondary: theme?.zenith?.['accent-warm'] || '#FFD40F',
      tertiary: theme?.zenith?.['accent-cool'] || '#25FF90',
      quaternary: theme?.zenith?.['accent-cold'] || '#0CE0FF',
      surface: theme?.zenith?.['bg-secondary'] || '#161B25',
      surfaceDeep: theme?.zenith?.['bg-primary'] || '#080C14',
      textPrimary: theme?.zenith?.['text-primary'] || '#F8F8F2',
      textMuted: theme?.zenith?.['text-secondary'] || '#7E8795'
    }),
    [theme]
  );
};

const UndergroundLogo = ({ palette, uniqueId, isIcon, offsetX = 0, offsetY = 0 }) => {
  const scale = isIcon ? 0.6 : 1;
  const baseSize = 80 * scale;

  return (
    <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`} opacity={0.95}>
      <defs>
        <linearGradient id={`neon-glow-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.primary} />
          <stop offset="50%" stopColor={palette.secondary} />
          <stop offset="100%" stopColor={palette.tertiary} />
        </linearGradient>

        <filter id={`neon-shadow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id={`drip-filter-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background abstract shape */}
      <path
        d="M40 15 Q20 40, 15 65 Q40 85, 65 65 Q85 40, 65 15 Q40 0, 40 15"
        fill={palette.surface}
        opacity={0.3}
        stroke={palette.primary}
        strokeWidth="2"
        filter={`url(#neon-shadow-${uniqueId})`}
      />

      {/* D - Bold graffiti style */}
      <g transform="translate(10, 20)">
        <path
          d="M0 0 Q0 20, 15 20 L25 20 Q35 20, 35 10 L35 40 Q35 50, 25 50 L15 50 Q0 50, 0 30 Z"
          fill={palette.primary}
          stroke={palette.secondary}
          strokeWidth="2"
          filter={`url(#neon-shadow-${uniqueId})`}
        />
        <path
          d="M35 15 Q45 15, 45 25 L45 35 Q45 45, 35 45"
          fill="none"
          stroke={palette.secondary}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>

      {/* A - Arrow style graffiti */}
      <g transform="translate(50, 20)">
        <path
          d="M0 50 L15 0 L30 50 L25 50 L20 35 L10 35 L5 50 Z"
          fill={palette.tertiary}
          stroke={palette.primary}
          strokeWidth="2"
        />
        <rect x="12" y="20" width="6" height="15" fill={palette.secondary} />
      </g>

      {/* W - Wave pattern */}
      <g transform="translate(85, 20)">
        <path
          d="M0 0 L5 15 L10 5 L15 20 L20 0 L25 15 L30 5 L35 20 L40 0 L40 50 L35 35 L30 45 L25 30 L20 45 L15 25 L10 45 L5 30 L0 50 Z"
          fill={palette.quaternary}
          stroke={palette.primary}
          strokeWidth="1.5"
        />
      </g>

      {/* G - Underground style */}
      <g transform="translate(135, 20)">
        <path
          d="M0 15 Q0 5, 15 5 L25 5 Q35 5, 35 15 L35 25 L20 25 L20 35 L35 35 Q35 45, 25 45 L15 45 Q0 45, 0 35 Z"
          fill={palette.secondary}
          stroke={palette.primary}
          strokeWidth="2"
        />
        <path
          d="M20 15 L30 15"
          stroke={palette.tertiary}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>

      {/* Audio wave overlay */}
      <g transform="translate(0, 70)" opacity={0.8}>
        <path
          d="M10 0 Q20 10, 30 0 Q40 10, 50 0 Q60 10, 70 0 Q80 10, 90 0 Q100 10, 110 0 Q120 10, 130 0 Q140 10, 150 0"
          fill="none"
          stroke={palette.quaternary}
          strokeWidth="2"
          strokeLinecap="round"
          filter={`url(#neon-shadow-${uniqueId})`}
        />
        <path
          d="M10 10 Q20 0, 30 10 Q40 0, 50 10 Q60 0, 70 10 Q80 0, 90 10 Q100 0, 110 10 Q120 0, 130 10 Q140 0, 150 10"
          fill="none"
          stroke={palette.tertiary}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>

      {/* Drip effects */}
      <g filter={`url(#drip-filter-${uniqueId})`} opacity={0.7}>
        <path
          d="M25 75 L25 85 Q25 90, 27 95"
          stroke={palette.primary}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M85 75 L85 90 Q85 95, 87 100"
          stroke={palette.secondary}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M145 75 L145 80 Q145 85, 147 90"
          stroke={palette.tertiary}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
};

export const DawgLogo = ({ size = 32, className = '', variant = 'full' }) => {
  const palette = useThemePalette();
  const uniqueId = useId();
  const isIcon = variant === 'icon';

  const svgHeight = size;
  const svgWidth = isIcon ? size : size * 2.2;
  const viewBoxWidth = isIcon ? 120 : 200;
  const viewBoxHeight = 100;
  const logoWidth = isIcon ? 108 : 180;
  const logoHeight = isIcon ? 60 : 100;
  const boomboxOffsetX = (viewBoxWidth - logoWidth) / 2;
  const boomboxOffsetY = (viewBoxHeight - logoHeight) / 2;

  const wordmark = !isIcon && (
    <g transform={`translate(${viewBoxWidth / 2}, 85)`} opacity={0.92}>
      <text
        x={-70}
        y={0}
        fontFamily="'Sora', 'Inter', sans-serif"
        fontSize="28"
        fontWeight="700"
        letterSpacing="0.08em"
        fill={palette.textPrimary}
        textAnchor="middle"
      >
        DAWG
      </text>
          <text
        x={-70}
        y={20}
        fontFamily="'Space Mono', monospace"
        fontSize="10"
        letterSpacing="0.5em"
        fill={palette.textMuted}
        opacity={0.85}
        textAnchor="middle"
      >
        AUDIO
          </text>
        </g>
  );
  
  return (
    <svg
      role="img"
      aria-label="DAWG logo"
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      className={className}
    >
      <defs>
        <linearGradient id={`bg-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.surfaceDeep} />
          <stop offset="100%" stopColor={palette.surface} />
        </linearGradient>
      </defs>

      <rect width={viewBoxWidth} height={viewBoxHeight} rx={isIcon ? 16 : 24} fill={`url(#bg-${uniqueId})`} />
      <rect
        x={isIcon ? 4 : 8}
        y={isIcon ? 4 : 8}
        width={viewBoxWidth - (isIcon ? 8 : 16)}
        height={viewBoxHeight - (isIcon ? 8 : 16)}
        rx={isIcon ? 12 : 18}
        fill={palette.surface}
        opacity={0.9}
      />

      <UndergroundLogo
        palette={palette}
        uniqueId={uniqueId}
        isIcon={isIcon}
        offsetX={boomboxOffsetX}
        offsetY={boomboxOffsetY}
      />
      {wordmark}
    </svg>
  );
};

export default DawgLogo;
