/**
 * THREE PANEL LAYOUT v2.0
 *
 * Standard 3-column layout for mode-based plugins
 * Automatically themed based on plugin category
 *
 * Layout Structure:
 * ┌──────────┬─────────────────┬──────────┐
 * │   Left   │     Center      │  Right   │
 * │  240px   │    flex-1       │  200px   │
 * │          │                 │          │
 * │  Mode    │  Visualizer +   │  Stats   │
 * │ Selector │   Controls      │   Info   │
 * └──────────┴─────────────────┴──────────┘
 *
 * Features:
 * - Auto category theming
 * - Responsive breakpoints (collapse panels)
 * - Optional panel collapse
 * - Smooth transitions
 * - Overflow handling
 *
 * Usage:
 * <ThreePanelLayout
 *   category="dynamics-forge"
 *   leftPanel={<ModeSelector />}
 *   centerPanel={<>
 *     <Visualizer />
 *     <Controls />
 *   </>}
 *   rightPanel={<StatsPanel />}
 * />
 */

import React, { useState, useMemo } from 'react';
import { getCategoryColors } from '../PluginDesignSystem';

export const ThreePanelLayout = ({
  // Category theming
  category = 'dynamics-forge',

  // Panel content
  leftPanel,
  centerPanel,
  rightPanel,

  // Panel configuration
  leftPanelWidth = 240,
  rightPanelWidth = 200,
  centerMinWidth = 400,

  // Collapse options
  collapsible = false,
  defaultLeftCollapsed = false,
  defaultRightCollapsed = false,

  // Custom styling
  className = '',
  style = {},

  // Background customization
  background = 'gradient', // 'gradient' | 'solid' | 'none'
}) => {
  const [leftCollapsed, setLeftCollapsed] = useState(defaultLeftCollapsed);
  const [rightCollapsed, setRightCollapsed] = useState(defaultRightCollapsed);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors(category), [category]);

  // Background styles based on category
  const backgroundStyle = useMemo(() => {
    switch (background) {
      case 'gradient':
        return {
          background: `linear-gradient(135deg,
            ${categoryColors.accent}15 0%,
            #0a0a0a 50%,
            ${categoryColors.primary}08 100%)`
        };
      case 'solid':
        return {
          backgroundColor: '#0a0a0a'
        };
      case 'none':
        return {};
      default:
        return {
          background: `linear-gradient(135deg,
            ${categoryColors.accent}15 0%,
            #0a0a0a 50%,
            ${categoryColors.primary}08 100%)`
        };
    }
  }, [background, categoryColors]);

  return (
    <div
      className={`w-full h-full flex gap-4 overflow-hidden p-4 ${className}`}
      style={{ ...backgroundStyle, ...style }}
    >
      {/* LEFT PANEL: Mode Selector */}
      {leftPanel && !leftCollapsed && (
        <div
          className="flex-shrink-0 flex flex-col gap-4 transition-all duration-300"
          style={{ width: leftPanelWidth }}
        >
          {leftPanel}
        </div>
      )}

      {/* Collapse button for left panel */}
      {collapsible && leftPanel && (
        <button
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          className="flex-shrink-0 w-6 h-full flex items-center justify-center opacity-30 hover:opacity-100 transition-opacity group"
          style={{
            backgroundColor: categoryColors.background,
            borderLeft: `1px solid ${categoryColors.primary}20`
          }}
          title={leftCollapsed ? 'Show mode selector' : 'Hide mode selector'}
        >
          <div
            className="transform transition-transform"
            style={{ color: categoryColors.primary }}
          >
            {leftCollapsed ? '▶' : '◀'}
          </div>
        </button>
      )}

      {/* CENTER PANEL: Visualizer + Controls */}
      <div
        className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2"
        style={{ minWidth: centerMinWidth }}
      >
        {centerPanel}
      </div>

      {/* Collapse button for right panel */}
      {collapsible && rightPanel && (
        <button
          onClick={() => setRightCollapsed(!rightCollapsed)}
          className="flex-shrink-0 w-6 h-full flex items-center justify-center opacity-30 hover:opacity-100 transition-opacity group"
          style={{
            backgroundColor: categoryColors.background,
            borderRight: `1px solid ${categoryColors.primary}20`
          }}
          title={rightCollapsed ? 'Show info panel' : 'Hide info panel'}
        >
          <div
            className="transform transition-transform"
            style={{ color: categoryColors.primary }}
          >
            {rightCollapsed ? '◀' : '▶'}
          </div>
        </button>
      )}

      {/* RIGHT PANEL: Stats & Info */}
      {rightPanel && !rightCollapsed && (
        <div
          className="flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-2 transition-all duration-300"
          style={{ width: rightPanelWidth }}
        >
          {rightPanel}
        </div>
      )}
    </div>
  );
};

/**
 * CATEGORY BADGE
 *
 * Reusable badge component for showing plugin category
 */
export const CategoryBadge = ({
  category = 'dynamics-forge',
  position = 'top', // 'top' | 'bottom'
  showIcon = true,
  showName = true,
  size = 'default' // 'small' | 'default' | 'large'
}) => {
  const categoryColors = useMemo(() => getCategoryColors(category), [category]);
  const categoryData = useMemo(() => {
    const { getCategoryColors, ...rest } = categoryColors;
    return rest;
  }, [categoryColors]);

  const sizeClasses = {
    small: 'text-[9px] px-3 py-1.5 gap-1.5',
    default: 'text-[10px] px-4 py-2 gap-2',
    large: 'text-xs px-5 py-2.5 gap-2.5'
  };

  return (
    <div
      className={`inline-flex items-center justify-center rounded-lg font-bold uppercase tracking-wider transition-all ${sizeClasses[size]}`}
      style={{
        background: categoryData.gradient,
        boxShadow: `0 0 20px ${categoryData.glow}`,
        border: `1px solid ${categoryData.primary}40`
      }}
    >
      {showIcon && (
        <span className="text-base">{categoryData.icon}</span>
      )}
      {showName && (
        <span style={{ color: 'white' }}>
          {categoryData.name}
        </span>
      )}
    </div>
  );
};

/**
 * PANEL SECTION
 *
 * Styled container for panel sections with category theming
 */
export const PanelSection = ({
  category = 'dynamics-forge',
  title,
  children,
  className = '',
  collapsible = false,
  defaultCollapsed = false
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const categoryColors = useMemo(() => getCategoryColors(category), [category]);

  return (
    <div
      className={`rounded-xl p-4 border ${className}`}
      style={{
        background: `linear-gradient(to br, ${categoryColors.background}, rgba(0,0,0,0.3))`,
        borderColor: `${categoryColors.primary}10`
      }}
    >
      {title && (
        <div
          className={`flex items-center justify-between mb-3 ${collapsible ? 'cursor-pointer' : ''}`}
          onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
        >
          <div
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: `${categoryColors.secondary}cc` }}
          >
            {title}
          </div>
          {collapsible && (
            <div
              className="text-xs transform transition-transform"
              style={{ color: categoryColors.primary }}
            >
              {collapsed ? '▼' : '▲'}
            </div>
          )}
        </div>
      )}
      {!collapsed && children}
    </div>
  );
};

/**
 * RESPONSIVE THREE PANEL LAYOUT
 *
 * Auto-adapts to screen size with breakpoints
 */
export const ResponsiveThreePanelLayout = ({
  category = 'dynamics-forge',
  leftPanel,
  centerPanel,
  rightPanel,
  ...props
}) => {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  // Listen to window resize
  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Breakpoints
  const BREAKPOINT_COMPACT = 1000;
  const BREAKPOINT_MOBILE = 700;

  // Auto-collapse panels based on screen size
  const autoCollapsedLeft = windowWidth < BREAKPOINT_COMPACT;
  const autoCollapsedRight = windowWidth < BREAKPOINT_COMPACT;
  const stackVertical = windowWidth < BREAKPOINT_MOBILE;

  if (stackVertical) {
    // Mobile: Stack vertically
    return (
      <div className="w-full h-full flex flex-col gap-4 overflow-y-auto p-4">
        {leftPanel && <div className="w-full">{leftPanel}</div>}
        {centerPanel && <div className="w-full">{centerPanel}</div>}
        {rightPanel && <div className="w-full">{rightPanel}</div>}
      </div>
    );
  }

  return (
    <ThreePanelLayout
      category={category}
      leftPanel={leftPanel}
      centerPanel={centerPanel}
      rightPanel={rightPanel}
      collapsible={true}
      defaultLeftCollapsed={autoCollapsedLeft}
      defaultRightCollapsed={autoCollapsedRight}
      {...props}
    />
  );
};
