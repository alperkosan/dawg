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
  return (
    <g transform={`translate(${offsetX}, ${offsetY})`}>
      <defs>
        {/* Boombox body gradient - metallic feel with vibrant accents */}
        <linearGradient id={`boombox-body-gradient-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={palette.surface} stopOpacity="0.95" />
          <stop offset="30%" stopColor={palette.surfaceDeep} stopOpacity="0.98" />
          <stop offset="70%" stopColor={palette.surfaceDeep} stopOpacity="1" />
          <stop offset="100%" stopColor={palette.surfaceDeep} stopOpacity="1" />
        </linearGradient>

        {/* Boombox accent gradient - colorful edge */}
        <linearGradient id={`boombox-accent-gradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={palette.primary} />
          <stop offset="25%" stopColor={palette.secondary} />
          <stop offset="50%" stopColor={palette.tertiary} />
          <stop offset="75%" stopColor={palette.quaternary} />
          <stop offset="100%" stopColor={palette.primary} />
        </linearGradient>

        {/* Speaker grill pattern - professional */}
        <pattern id={`speaker-grill-${uniqueId}`} x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.8" fill={palette.surfaceDeep} opacity="0.6" />
        </pattern>

        {/* Speaker highlight pattern */}
        <radialGradient id={`speaker-highlight-${uniqueId}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor={palette.textPrimary} stopOpacity="0.3" />
          <stop offset="70%" stopColor={palette.surfaceDeep} stopOpacity="0.5" />
          <stop offset="100%" stopColor={palette.surfaceDeep} stopOpacity="1" />
        </radialGradient>

        {/* Boombox shadow for depth */}
        <filter id={`boombox-shadow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="blur" />
          <feOffset in="blur" dx="2" dy="2" result="offsetBlur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.4" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Glow effect for speakers */}
        <filter id={`speaker-glow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Metallic shine */}
        <linearGradient id={`metallic-shine-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.15" />
          <stop offset="30%" stopColor="white" stopOpacity="0.05" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Main composition - Boombox centered and prominent */}
      <g>
        {/* Boombox body - large, centered, and detailed */}
        <g transform="translate(5, 20)" filter={`url(#boombox-shadow-${uniqueId})`}>
          {/* Main body with accent border */}
          <rect
            x="0"
            y="0"
            width="90"
            height="55"
            rx="5"
            ry="5"
            fill={`url(#boombox-body-gradient-${uniqueId})`}
            stroke={`url(#boombox-accent-gradient-${uniqueId})`}
            strokeWidth="2"
            opacity="0.95"
          />
          
          {/* Accent border highlight */}
          <rect
            x="1"
            y="1"
            width="88"
            height="53"
            rx="4"
            fill="none"
            stroke={palette.primary}
            strokeWidth="0.8"
            opacity="0.4"
          />
          
          {/* Metallic shine overlay */}
          <rect
            x="0"
            y="0"
            width="90"
            height="28"
            rx="5"
            fill={`url(#metallic-shine-${uniqueId})`}
          />

          {/* Left speaker - prominent and detailed */}
          <g transform="translate(10, 8)">
            <rect
              x="0"
              y="0"
              width="30"
              height="39"
              rx="3.5"
              fill={palette.surfaceDeep}
              opacity="0.95"
            />
            <rect
              x="2"
              y="2"
              width="26"
              height="35"
              rx="2.5"
              fill={`url(#speaker-grill-${uniqueId})`}
            />
            {/* Speaker center cone - more prominent */}
            <ellipse
              cx="15"
              cy="19.5"
              rx="9"
              ry="11"
              fill={`url(#speaker-highlight-${uniqueId})`}
              filter={`url(#speaker-glow-${uniqueId})`}
            />
            <ellipse
              cx="15"
              cy="19.5"
              rx="6"
              ry="7"
              fill="none"
              stroke={palette.primary}
              strokeWidth="1.5"
              opacity="0.75"
            />
            <ellipse
              cx="15"
              cy="19.5"
              rx="3"
              ry="3.5"
              fill={palette.primary}
              opacity="0.3"
            />
          </g>

          {/* Right speaker - prominent and detailed */}
          <g transform="translate(50, 8)">
            <rect
              x="0"
              y="0"
              width="30"
              height="39"
              rx="3.5"
              fill={palette.surfaceDeep}
              opacity="0.95"
            />
            <rect
              x="2"
              y="2"
              width="26"
              height="35"
              rx="2.5"
              fill={`url(#speaker-grill-${uniqueId})`}
            />
            {/* Speaker center cone - more prominent */}
            <ellipse
              cx="15"
              cy="19.5"
              rx="9"
              ry="11"
              fill={`url(#speaker-highlight-${uniqueId})`}
              filter={`url(#speaker-glow-${uniqueId})`}
            />
            <ellipse
              cx="15"
              cy="19.5"
              rx="6"
              ry="7"
              fill="none"
              stroke={palette.tertiary}
              strokeWidth="1.5"
              opacity="0.75"
            />
            <ellipse
              cx="15"
              cy="19.5"
              rx="3"
              ry="3.5"
              fill={palette.tertiary}
              opacity="0.3"
            />
          </g>

          {/* Center control panel - enhanced with details */}
          <g transform="translate(35, 12)">
            <rect
              x="0"
              y="0"
              width="20"
              height="31"
              rx="2.5"
              fill={palette.surfaceDeep}
              opacity="0.92"
            />
            {/* Control panel details */}
            <rect
              x="3"
              y="5"
              width="14"
              height="3"
              rx="1"
              fill={palette.secondary}
              opacity="0.6"
            />
            <circle
              cx="10"
              cy="15"
              r="4"
              fill={palette.quaternary}
              opacity="0.5"
            />
            <rect
              x="3"
              y="22"
              width="14"
              height="2"
              rx="1"
              fill={palette.primary}
              opacity="0.5"
            />
          </g>

          {/* Top handle/bar */}
          <rect
            x="35"
            y="2"
            width="20"
            height="4"
            rx="2"
            fill={palette.surfaceDeep}
            opacity="0.9"
          />
        </g>

        {/* Audio waves - dynamic, positioned above boombox */}
        <g transform="translate(0, 10)" opacity="0.95">
          <path
            d="M12 6 Q15 3, 18 6 Q21 9, 24 6 Q27 3, 30 6"
            fill="none"
            stroke={palette.primary}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
          <path
            d="M70 6 Q73 3, 76 6 Q79 9, 82 6 Q85 3, 88 6"
            fill="none"
            stroke={palette.tertiary}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
        </g>

        {/* Bottom accent - professional detail, aligned with boombox */}
        <g transform="translate(10, 78)">
          <rect
            x="0"
            y="0"
            width="80"
            height="4"
            rx="2"
            fill={palette.surfaceDeep}
            opacity="0.9"
          />
          {/* Audio level indicators - vibrant and visible */}
          <g transform="translate(3, 1)">
            <rect x="0" y="0" width="6" height="2" rx="0.5" fill={palette.primary} opacity="1" />
            <rect x="8" y="0" width="6" height="2" rx="0.5" fill={palette.secondary} opacity="1" />
            <rect x="16" y="0" width="6" height="2" rx="0.5" fill={palette.tertiary} opacity="1" />
            <rect x="24" y="0" width="6" height="2" rx="0.5" fill={palette.quaternary} opacity="1" />
            <rect x="32" y="0" width="6" height="2" rx="0.5" fill={palette.primary} opacity="0.85" />
            <rect x="40" y="0" width="6" height="2" rx="0.5" fill={palette.secondary} opacity="0.85" />
            <rect x="48" y="0" width="6" height="2" rx="0.5" fill={palette.tertiary} opacity="0.7" />
            <rect x="56" y="0" width="6" height="2" rx="0.5" fill={palette.quaternary} opacity="0.7" />
            <rect x="64" y="0" width="6" height="2" rx="0.5" fill={palette.primary} opacity="0.5" />
            <rect x="72" y="0" width="6" height="2" rx="0.5" fill={palette.secondary} opacity="0.5" />
          </g>
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
    <g transform={`translate(50, 90)`} opacity={0.95}>
      <defs>
        <linearGradient id={`wordmark-gradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={palette.textMuted} />
          <stop offset="50%" stopColor={palette.secondary} />
          <stop offset="100%" stopColor={palette.textMuted} />
        </linearGradient>
      </defs>
      <text
        x={0}
        y={0}
        fontFamily="'Sora', 'Inter', -apple-system, sans-serif"
        fontSize="6.8"
        fontWeight="700"
        letterSpacing="0.22em"
        fill={`url(#wordmark-gradient-${uniqueId})`}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ textRendering: 'optimizeLegibility' }}
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
