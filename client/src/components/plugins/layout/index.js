/**
 * PLUGIN LAYOUT SYSTEM v2.0
 *
 * Unified layout components for all plugins
 * Auto-themed based on plugin category
 *
 * Components:
 * - ThreePanelLayout: Mode-based plugins (Compressor, Reverb, etc.)
 * - TwoPanelLayout: Visualization-heavy (EQ, Spectrum)
 * - SinglePanelLayout: Simple utility plugins
 *
 * Utilities:
 * - CategoryBadge: Visual category indicator
 * - PanelSection: Themed section container
 * - ControlGrid: Responsive control arrangement
 * - CompactVisualizer: Small visualization container
 */

// Layouts
export {
  ThreePanelLayout,
  ResponsiveThreePanelLayout,
  CategoryBadge,
  PanelSection
} from './ThreePanelLayout';

export {
  TwoPanelLayout,
  ResponsiveTwoPanelLayout
} from './TwoPanelLayout';

export {
  SinglePanelLayout,
  ControlGrid,
  CompactVisualizer
} from './SinglePanelLayout';
