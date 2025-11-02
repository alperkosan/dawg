/**
 * LAYOUT SYSTEM EXAMPLES v2.0
 *
 * Reference implementations for all layout patterns
 * Copy these examples when creating new plugins
 */

import React from 'react';
import {
  ThreePanelLayout,
  TwoPanelLayout,
  SinglePanelLayout,
  CategoryBadge,
  PanelSection,
  ControlGrid,
  CompactVisualizer
} from './index';
import { Knob } from '@/components/controls/base/Knob';
import { ModeSelector } from '@/components/controls/base/ModeSelector';

/**
 * EXAMPLE 1: THREE PANEL LAYOUT
 *
 * Best for: Mode-based plugins (Compressor, Reverb, Saturator)
 * Pattern: Mode selector (left) + Visualizer/Controls (center) + Stats (right)
 */
export const ThreePanelExample = () => {
  // Left Panel: Mode Selector
  const leftPanel = (
    <>
      <CategoryBadge category="dynamics-forge" />

      <ModeSelector
        modes={[
          { id: 'gentle', label: 'Gentle', icon: '🌊' },
          { id: 'standard', label: 'Standard', icon: '⚙️' },
          { id: 'aggressive', label: 'Aggressive', icon: '🔥' }
        ]}
        selectedMode="standard"
        onModeChange={(mode) => console.log('Mode:', mode)}
        variant="vertical"
        category="dynamics-forge"
      />

      <PanelSection
        category="dynamics-forge"
        title="About"
      >
        <p className="text-xs text-white/70 leading-relaxed">
          Professional dynamics control with multiple compression modes.
        </p>
      </PanelSection>
    </>
  );

  // Center Panel: Visualizer + Controls
  const centerPanel = (
    <>
      {/* Visualizer */}
      <div
        className="w-full rounded-xl border border-[#00A8E8]/10"
        style={{
          height: 220,
          background: 'linear-gradient(to bottom, rgba(0,168,232,0.05), rgba(0,0,0,0.5))'
        }}
      >
        <div className="w-full h-full flex items-center justify-center text-white/30">
          Compression Curve Visualization
        </div>
      </div>

      {/* Main Controls */}
      <ControlGrid columns={4}>
        <Knob label="THRESHOLD" value={-20} min={-60} max={0} category="dynamics-forge" />
        <Knob label="RATIO" value={4} min={1} max={20} category="dynamics-forge" />
        <Knob label="ATTACK" value={5} min={0.1} max={100} category="dynamics-forge" />
        <Knob label="RELEASE" value={150} min={10} max={1000} category="dynamics-forge" />
      </ControlGrid>

      {/* Secondary Controls */}
      <PanelSection
        category="dynamics-forge"
        title="Advanced"
        collapsible={true}
        defaultCollapsed={true}
      >
        <ControlGrid columns={2}>
          <Knob label="KNEE" value={10} min={0} max={40} category="dynamics-forge" sizeVariant="small" />
          <Knob label="MAKEUP" value={0} min={-12} max={12} category="dynamics-forge" sizeVariant="small" />
        </ControlGrid>
      </PanelSection>
    </>
  );

  // Right Panel: Stats
  const rightPanel = (
    <>
      <PanelSection category="dynamics-forge" title="Processing">
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-white/50">GR Peak</span>
            <span className="text-[#00A8E8] font-mono">-6.2 dB</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Input</span>
            <span className="text-white/70 font-mono">-12.5 dB</span>
          </div>
        </div>
      </PanelSection>

      <PanelSection category="dynamics-forge" title="How It Works">
        <p className="text-[9px] text-white/60 leading-relaxed">
          Reduces dynamic range by attenuating signals above threshold.
          Ratio controls compression strength.
        </p>
      </PanelSection>
    </>
  );

  return (
    <ThreePanelLayout
      category="dynamics-forge"
      leftPanel={leftPanel}
      centerPanel={centerPanel}
      rightPanel={rightPanel}
      collapsible={true}
    />
  );
};

/**
 * EXAMPLE 2: TWO PANEL LAYOUT
 *
 * Best for: Visualization-heavy plugins (EQ, Spectrum Analyzer)
 * Pattern: Large canvas (main) + Controls sidebar
 */
export const TwoPanelExample = () => {
  // Main Panel: EQ Canvas
  const mainPanel = (
    <div
      className="w-full h-full rounded-xl border border-[#10B981]/10"
      style={{
        background: 'linear-gradient(to bottom, rgba(16,185,129,0.05), rgba(0,0,0,0.5))'
      }}
    >
      <div className="w-full h-full flex items-center justify-center text-white/30">
        EQ Curve Visualization (Drag bands here)
      </div>
    </div>
  );

  // Side Panel: Band Controls
  const sidePanel = (
    <>
      <CategoryBadge category="spectral-weave" size="small" />

      <PanelSection category="spectral-weave" title="Band 1 - Low Shelf">
        <div className="space-y-3">
          <Knob
            label="FREQ"
            value={100}
            min={20}
            max={500}
            category="spectral-weave"
            sizeVariant="small"
          />
          <Knob
            label="GAIN"
            value={0}
            min={-12}
            max={12}
            category="spectral-weave"
            sizeVariant="small"
          />
        </div>
      </PanelSection>

      <PanelSection category="spectral-weave" title="Band 2 - Peaking">
        <div className="space-y-3">
          <Knob
            label="FREQ"
            value={1000}
            min={100}
            max={10000}
            category="spectral-weave"
            sizeVariant="small"
          />
          <Knob
            label="GAIN"
            value={2}
            min={-12}
            max={12}
            category="spectral-weave"
            sizeVariant="small"
          />
          <Knob
            label="Q"
            value={1.0}
            min={0.1}
            max={10}
            category="spectral-weave"
            sizeVariant="small"
          />
        </div>
      </PanelSection>
    </>
  );

  return (
    <TwoPanelLayout
      category="spectral-weave"
      mainPanel={mainPanel}
      sidePanel={sidePanel}
      sidePanelPosition="right"
      collapsible={true}
    />
  );
};

/**
 * EXAMPLE 3: SINGLE PANEL LAYOUT
 *
 * Best for: Simple utility plugins (Gain, Pan, simple effects)
 * Pattern: Centered controls, minimal UI
 */
export const SinglePanelExample = () => {
  return (
    <SinglePanelLayout
      category="texture-lab"
      title="Simple Saturator"
      showCategoryBadge={true}
      maxWidth={500}
    >
      {/* Compact Visualizer */}
      <CompactVisualizer category="texture-lab" height={100}>
        <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">
          Harmonic Content Meter
        </div>
      </CompactVisualizer>

      {/* Main Controls */}
      <ControlGrid columns={3} gap={8}>
        <Knob
          label="DRIVE"
          value={0.4}
          min={0}
          max={1.5}
          category="texture-lab"
          sizeVariant="large"
        />
        <Knob
          label="MIX"
          value={1.0}
          min={0}
          max={1}
          category="texture-lab"
          sizeVariant="large"
        />
        <Knob
          label="OUTPUT"
          value={1.0}
          min={0}
          max={2}
          category="texture-lab"
          sizeVariant="large"
        />
      </ControlGrid>

      {/* Additional Info */}
      <PanelSection
        category="texture-lab"
        title="Tips"
        collapsible={true}
      >
        <p className="text-xs text-white/60 leading-relaxed">
          Start with low drive values and increase gradually.
          Use mix control to blend saturated signal.
        </p>
      </PanelSection>
    </SinglePanelLayout>
  );
};

/**
 * USAGE IN ACTUAL PLUGINS:
 *
 * 1. Import the layout you need:
 *    import { ThreePanelLayout } from '@/components/plugins/layout';
 *
 * 2. Wrap your plugin content:
 *    <ThreePanelLayout
 *      category={getPluginCategory(effect.type)}
 *      leftPanel={...}
 *      centerPanel={...}
 *      rightPanel={...}
 *    />
 *
 * 3. Category is auto-detected:
 *    import { getPluginCategory } from '@/components/plugins/PluginDesignSystem';
 *    const category = getPluginCategory('Compressor'); // => 'dynamics-forge'
 *
 * 4. All theming is automatic:
 *    - Colors from CATEGORY_PALETTE
 *    - Icons, gradients, glows
 *    - Responsive breakpoints
 *    - Collapse/expand functionality
 */
