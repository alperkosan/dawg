/**
 * TWO PANEL LAYOUT v2.0
 *
 * Standard 2-column layout for visualization-heavy plugins (EQ, Spectrum)
 * Main area for large visualizer + sidebar for controls
 *
 * Layout Structure:
 * ┌─────────────────┬──────────┐
 * │      Main       │  Side    │
 * │    flex-1       │  320px   │
 * │                 │          │
 * │  Large Canvas   │ Band     │
 * │  (EQ Curve)     │ Controls │
 * └─────────────────┴──────────┘
 *
 * Features:
 * - Auto category theming
 * - Sidebar position (left/right)
 * - Resizable sidebar (optional)
 * - Responsive collapse
 * - Smooth transitions
 *
 * Usage:
 * <TwoPanelLayout
 *   category="spectral-weave"
 *   mainPanel={<EQCanvas />}
 *   sidePanel={<BandControls />}
 *   sidePanelPosition="right"
 * />
 */

import React, { useState, useMemo } from 'react';
import { getCategoryColors } from '../PluginDesignSystem';

export const TwoPanelLayout = ({
  // Category theming
  category = 'spectral-weave',

  // Panel content
  mainPanel,
  sidePanel,

  // Panel configuration
  sidePanelWidth = 320,
  sidePanelPosition = 'right', // 'left' | 'right'
  mainMinWidth = 600,

  // Resize options
  resizable = false,
  minSideWidth = 280,
  maxSideWidth = 500,

  // Collapse options
  collapsible = false,
  defaultCollapsed = false,

  // Custom styling
  className = '',
  style = {},

  // Background customization
  background = 'gradient',
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [sideWidth, setSideWidth] = useState(sidePanelWidth);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors(category), [category]);

  // Background styles
  const backgroundStyle = useMemo(() => {
    switch (background) {
      case 'gradient':
        return {
          background: `linear-gradient(135deg,
            ${categoryColors.accent}12 0%,
            #0a0a0a 50%,
            ${categoryColors.primary}06 100%)`
        };
      case 'solid':
        return { backgroundColor: '#0a0a0a' };
      case 'none':
        return {};
      default:
        return {
          background: `linear-gradient(135deg,
            ${categoryColors.accent}12 0%,
            #0a0a0a 50%,
            ${categoryColors.primary}06 100%)`
        };
    }
  }, [background, categoryColors]);

  // Render order based on position
  const renderPanels = () => {
    const mainContent = (
      <div
        key="main"
        className="flex-1 flex flex-col overflow-hidden"
        style={{ minWidth: mainMinWidth }}
      >
        {mainPanel}
      </div>
    );

    const sideContent = !collapsed && sidePanel && (
      <div
        key="side"
        className="flex-shrink-0 flex flex-col overflow-y-auto transition-all duration-300"
        style={{ width: sideWidth }}
      >
        {sidePanel}
      </div>
    );

    const collapseButton = collapsible && sidePanel && (
      <button
        key="collapse"
        onClick={() => setCollapsed(!collapsed)}
        className="flex-shrink-0 w-6 h-full flex items-center justify-center opacity-30 hover:opacity-100 transition-opacity"
        style={{
          backgroundColor: categoryColors.background,
          borderLeft: sidePanelPosition === 'right' ? `1px solid ${categoryColors.primary}20` : 'none',
          borderRight: sidePanelPosition === 'left' ? `1px solid ${categoryColors.primary}20` : 'none'
        }}
        title={collapsed ? 'Show controls' : 'Hide controls'}
      >
        <div style={{ color: categoryColors.primary }}>
          {collapsed
            ? (sidePanelPosition === 'right' ? '◀' : '▶')
            : (sidePanelPosition === 'right' ? '▶' : '◀')
          }
        </div>
      </button>
    );

    if (sidePanelPosition === 'left') {
      return [sideContent, collapseButton, mainContent];
    } else {
      return [mainContent, collapseButton, sideContent];
    }
  };

  return (
    <div
      className={`w-full h-full flex gap-4 overflow-hidden p-4 ${className}`}
      style={{ ...backgroundStyle, ...style }}
    >
      {renderPanels()}
    </div>
  );
};

/**
 * RESPONSIVE TWO PANEL LAYOUT
 *
 * Auto-adapts to screen size with breakpoints
 */
export const ResponsiveTwoPanelLayout = ({
  category = 'spectral-weave',
  mainPanel,
  sidePanel,
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
  const BREAKPOINT_COMPACT = 900;
  const BREAKPOINT_MOBILE = 600;

  const autoCollapsed = windowWidth < BREAKPOINT_COMPACT;
  const stackVertical = windowWidth < BREAKPOINT_MOBILE;

  if (stackVertical) {
    // Mobile: Stack vertically
    return (
      <div className="w-full h-full flex flex-col gap-4 overflow-y-auto p-4">
        {mainPanel && <div className="w-full h-[400px]">{mainPanel}</div>}
        {sidePanel && <div className="w-full">{sidePanel}</div>}
      </div>
    );
  }

  return (
    <TwoPanelLayout
      category={category}
      mainPanel={mainPanel}
      sidePanel={sidePanel}
      collapsible={true}
      defaultCollapsed={autoCollapsed}
      {...props}
    />
  );
};
