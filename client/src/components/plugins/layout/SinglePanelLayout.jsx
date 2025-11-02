/**
 * SINGLE PANEL LAYOUT v2.0
 *
 * Minimal layout for simple plugins with few controls
 * Centered content with category theming
 *
 * Layout Structure:
 * ┌─────────────────────────────┐
 * │                             │
 * │     Centered Content        │
 * │    (max-width: 600px)       │
 * │                             │
 * │   Knobs/Sliders/Controls    │
 * │                             │
 * └─────────────────────────────┘
 *
 * Features:
 * - Auto category theming
 * - Centered content
 * - Compact design
 * - Perfect for utility plugins
 *
 * Usage:
 * <SinglePanelLayout
 *   category="texture-lab"
 *   maxWidth={600}
 * >
 *   <ControlGrid columns={3}>
 *     <Knob label="Drive" />
 *     <Knob label="Mix" />
 *     <Knob label="Output" />
 *   </ControlGrid>
 * </SinglePanelLayout>
 */

import React, { useMemo } from 'react';
import { getCategoryColors } from '../PluginDesignSystem';

export const SinglePanelLayout = ({
  // Category theming
  category = 'dynamics-forge',

  // Content
  children,

  // Layout configuration
  maxWidth = 600,
  centered = true,
  padding = 'default', // 'none' | 'compact' | 'default' | 'spacious'

  // Title/Header
  title,
  showCategoryBadge = false,

  // Custom styling
  className = '',
  style = {},

  // Background customization
  background = 'gradient',
}) => {
  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors(category), [category]);

  // Padding classes
  const paddingClasses = {
    none: 'p-0',
    compact: 'p-4',
    default: 'p-6',
    spacious: 'p-8'
  };

  // Background styles
  const backgroundStyle = useMemo(() => {
    switch (background) {
      case 'gradient':
        return {
          background: `radial-gradient(ellipse at center,
            ${categoryColors.accent}10 0%,
            #0a0a0a 70%,
            ${categoryColors.primary}05 100%)`
        };
      case 'solid':
        return { backgroundColor: '#0a0a0a' };
      case 'none':
        return {};
      default:
        return {
          background: `radial-gradient(ellipse at center,
            ${categoryColors.accent}10 0%,
            #0a0a0a 70%,
            ${categoryColors.primary}05 100%)`
        };
    }
  }, [background, categoryColors]);

  return (
    <div
      className={`w-full h-full flex flex-col overflow-y-auto ${paddingClasses[padding]} ${className}`}
      style={{ ...backgroundStyle, ...style }}
    >
      <div
        className={`w-full ${centered ? 'mx-auto' : ''} flex flex-col gap-6`}
        style={{ maxWidth: centered ? maxWidth : '100%' }}
      >
        {/* Header Section */}
        {(title || showCategoryBadge) && (
          <div className="flex items-center justify-between">
            {title && (
              <h2
                className="text-2xl font-bold uppercase tracking-wider"
                style={{ color: categoryColors.primary }}
              >
                {title}
              </h2>
            )}
            {showCategoryBadge && (
              <CategoryBadge category={category} />
            )}
          </div>
        )}

        {/* Main Content */}
        {children}
      </div>
    </div>
  );
};

/**
 * CONTROL GRID
 *
 * Responsive grid for arranging controls
 */
export const ControlGrid = ({
  children,
  columns = 3,
  gap = 6,
  className = ''
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6'
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-${gap} ${className}`}>
      {children}
    </div>
  );
};

/**
 * CATEGORY BADGE (imported for convenience)
 */
import { CategoryBadge } from './ThreePanelLayout';

/**
 * COMPACT VISUALIZER CONTAINER
 *
 * Small visualizer for single-panel plugins
 */
export const CompactVisualizer = ({
  category = 'dynamics-forge',
  children,
  height = 120,
  className = ''
}) => {
  const categoryColors = useMemo(() => getCategoryColors(category), [category]);

  return (
    <div
      className={`w-full rounded-xl overflow-hidden border ${className}`}
      style={{
        height,
        background: `linear-gradient(to bottom, ${categoryColors.background}, rgba(0,0,0,0.5))`,
        borderColor: `${categoryColors.primary}15`
      }}
    >
      {children}
    </div>
  );
};
