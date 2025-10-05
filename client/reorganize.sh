#!/bin/bash

# DAWG Frontend Reorganization Script
# Safely reorganizes the codebase structure

set -e  # Exit on error

echo "🏗️  Starting DAWG frontend reorganization..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base directory
SRC_DIR="./src"

# ============================================
# PHASE 1: Create new directory structure
# ============================================
echo -e "${BLUE}📁 Phase 1: Creating new directory structure...${NC}"

mkdir -p "$SRC_DIR/components/common"
mkdir -p "$SRC_DIR/components/controls/base"
mkdir -p "$SRC_DIR/components/controls/advanced"
mkdir -p "$SRC_DIR/components/controls/specialized"
mkdir -p "$SRC_DIR/components/plugins/container"
mkdir -p "$SRC_DIR/components/plugins/effects"
mkdir -p "$SRC_DIR/components/plugins/visualizers"
mkdir -p "$SRC_DIR/features/toolbars"

echo -e "${GREEN}✅ Directory structure created${NC}"

# ============================================
# PHASE 2: Migrate controls
# ============================================
echo -e "${BLUE}📦 Phase 2: Migrating controls...${NC}"

# Base controls
mv "$SRC_DIR/ui/controls/Knob.jsx" "$SRC_DIR/components/controls/base/" 2>/dev/null || true
mv "$SRC_DIR/ui/controls/Fader.jsx" "$SRC_DIR/components/controls/base/" 2>/dev/null || true
mv "$SRC_DIR/ui/controls/Slider.jsx" "$SRC_DIR/components/controls/base/" 2>/dev/null || true
mv "$SRC_DIR/ui/controls/Button.jsx" "$SRC_DIR/components/controls/base/" 2>/dev/null || true
mv "$SRC_DIR/ui/controls/Toggle.jsx" "$SRC_DIR/components/controls/base/" 2>/dev/null || true
mv "$SRC_DIR/ui/controls/Display.jsx" "$SRC_DIR/components/controls/base/" 2>/dev/null || true

# Advanced controls
mv "$SRC_DIR/ui/controls/XYPad.jsx" "$SRC_DIR/components/controls/advanced/" 2>/dev/null || true
mv "$SRC_DIR/ui/controls/Meter.jsx" "$SRC_DIR/components/controls/advanced/" 2>/dev/null || true
mv "$SRC_DIR/ui/controls/StepSequencer.jsx" "$SRC_DIR/components/controls/advanced/" 2>/dev/null || true

# Specialized controls
mv "$SRC_DIR/ui/controls/SpectrumKnob.jsx" "$SRC_DIR/components/controls/specialized/" 2>/dev/null || true
mv "$SRC_DIR/ui/controls/WaveformKnob.jsx" "$SRC_DIR/components/controls/specialized/" 2>/dev/null || true
mv "$SRC_DIR/ui/controls/EnvelopeEditor.jsx" "$SRC_DIR/components/controls/specialized/" 2>/dev/null || true
mv "$SRC_DIR/ui/controls/FrequencyGraph.jsx" "$SRC_DIR/components/controls/specialized/" 2>/dev/null || true

# Theme hook
mv "$SRC_DIR/ui/controls/useControlTheme.js" "$SRC_DIR/components/controls/" 2>/dev/null || true

# README and index
mv "$SRC_DIR/ui/controls/README.md" "$SRC_DIR/components/controls/" 2>/dev/null || true
mv "$SRC_DIR/ui/controls/index.js" "$SRC_DIR/components/controls/" 2>/dev/null || true

echo -e "${GREEN}✅ Controls migrated${NC}"

# ============================================
# PHASE 3: Migrate plugin system
# ============================================
echo -e "${BLUE}🔌 Phase 3: Migrating plugin system...${NC}"

# Plugin container components
mv "$SRC_DIR/ui/plugin_system/PluginContainer.jsx" "$SRC_DIR/components/plugins/container/" 2>/dev/null || true
mv "$SRC_DIR/ui/plugin_system/PluginDesignSystem.jsx" "$SRC_DIR/components/plugins/" 2>/dev/null || true

# Keep PluginControls temporarily for backward compatibility
cp "$SRC_DIR/ui/plugin_system/PluginControls.jsx" "$SRC_DIR/components/plugins/container/" 2>/dev/null || true

# Plugin UIs (effects)
mv "$SRC_DIR/ui/plugin_uis/SaturatorUI.jsx" "$SRC_DIR/components/plugins/effects/" 2>/dev/null || true
mv "$SRC_DIR/ui/plugin_uis/SaturatorUIWithWebGL.jsx" "$SRC_DIR/components/plugins/effects/" 2>/dev/null || true
mv "$SRC_DIR/ui/plugin_uis/ReverbUI.jsx" "$SRC_DIR/components/plugins/effects/" 2>/dev/null || true
mv "$SRC_DIR/ui/plugin_uis/AdvancedCompressorUI.jsx" "$SRC_DIR/components/plugins/effects/" 2>/dev/null || true
mv "$SRC_DIR/ui/plugin_uis/AdvancedEQUI.jsx" "$SRC_DIR/components/plugins/effects/" 2>/dev/null || true
mv "$SRC_DIR/ui/plugin_uis/DelayUI.jsx" "$SRC_DIR/components/plugins/effects/" 2>/dev/null || true
mv "$SRC_DIR/ui/plugin_uis/"*.jsx "$SRC_DIR/components/plugins/effects/" 2>/dev/null || true

# Visualizers
mv "$SRC_DIR/ui/plugin_uis/visualizers/"*.jsx "$SRC_DIR/components/plugins/visualizers/" 2>/dev/null || true
mv "$SRC_DIR/ui/plugin_uis/visualizers/"*.css "$SRC_DIR/components/plugins/visualizers/" 2>/dev/null || true

echo -e "${GREEN}✅ Plugin system migrated${NC}"

# ============================================
# PHASE 4: Migrate common components
# ============================================
echo -e "${BLUE}🧩 Phase 4: Migrating common components...${NC}"

mv "$SRC_DIR/ui/TabButton.jsx" "$SRC_DIR/components/common/" 2>/dev/null || true
mv "$SRC_DIR/ui/DebugPanel.jsx" "$SRC_DIR/components/common/" 2>/dev/null || true
mv "$SRC_DIR/ui/SignalVisualizer.jsx" "$SRC_DIR/components/common/" 2>/dev/null || true

echo -e "${GREEN}✅ Common components migrated${NC}"

# ============================================
# PHASE 5: Migrate toolbars
# ============================================
echo -e "${BLUE}🛠️  Phase 5: Migrating toolbars...${NC}"

mv "$SRC_DIR/features/main_toolbar/MainToolbar.jsx" "$SRC_DIR/features/toolbars/" 2>/dev/null || true
mv "$SRC_DIR/features/top_toolbar/TopToolbar.jsx" "$SRC_DIR/features/toolbars/" 2>/dev/null || true

echo -e "${GREEN}✅ Toolbars migrated${NC}"

# ============================================
# PHASE 6: Cleanup old directories
# ============================================
echo -e "${BLUE}🗑️  Phase 6: Cleaning up...${NC}"

# Mark old directories for manual deletion
echo -e "${YELLOW}⚠️  Please manually delete these obsolete directories after verifying:${NC}"
echo "  - $SRC_DIR/ui/controls (old controls)"
echo "  - $SRC_DIR/ui/plugin_system (old plugin system)"
echo "  - $SRC_DIR/ui/plugin_uis (old plugin UIs)"
echo "  - $SRC_DIR/ui/VolumeKnob.jsx (replaced by new Knob)"
echo "  - $SRC_DIR/ui/Fader.jsx (replaced by new Fader)"
echo "  - $SRC_DIR/features/mixer_v3 (obsolete)"
echo "  - $SRC_DIR/features/main_toolbar (moved to toolbars)"
echo "  - $SRC_DIR/features/top_toolbar (moved to toolbars)"

# ============================================
# PHASE 7: Update index files
# ============================================
echo -e "${BLUE}📝 Phase 7: Creating index files...${NC}"

# Create controls/base index
cat > "$SRC_DIR/components/controls/base/index.js" << 'EOF'
export { Knob } from './Knob';
export { Fader } from './Fader';
export { Slider } from './Slider';
export { Button } from './Button';
export { Toggle } from './Toggle';
export { Display } from './Display';
EOF

# Create controls/advanced index
cat > "$SRC_DIR/components/controls/advanced/index.js" << 'EOF'
export { XYPad } from './XYPad';
export { Meter } from './Meter';
export { StepSequencer } from './StepSequencer';
EOF

# Create controls/specialized index
cat > "$SRC_DIR/components/controls/specialized/index.js" << 'EOF'
export { SpectrumKnob } from './SpectrumKnob';
export { WaveformKnob } from './WaveformKnob';
export { EnvelopeEditor } from './EnvelopeEditor';
export { FrequencyGraph } from './FrequencyGraph';
EOF

# Update main controls index to use subfolders
cat > "$SRC_DIR/components/controls/index.js" << 'EOF'
/**
 * DAWG UNIFIED CONTROL SYSTEM
 */

// Base controls
export * from './base';

// Advanced controls
export * from './advanced';

// Specialized controls
export * from './specialized';

// Theme hook
export { useControlTheme } from './useControlTheme';
EOF

echo -e "${GREEN}✅ Index files created${NC}"

# ============================================
# DONE
# ============================================
echo ""
echo -e "${GREEN}🎉 Reorganization complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Update imports in your code from:"
echo "   import { Knob } from '@/ui/controls/Knob'"
echo "   to:"
echo "   import { Knob } from '@/components/controls'"
echo ""
echo "2. Update pluginConfig.jsx to use new paths"
echo ""
echo "3. Test the application thoroughly"
echo ""
echo "4. Once verified, delete the old directories listed above"
