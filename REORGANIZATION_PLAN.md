# 🏗️ DAWG Frontend Reorganization Plan

## 📋 Current Issues
- Duplicate controls (VolumeKnob in /ui and /features/mixer_v3)
- Mixed responsibilities (plugin_uis vs plugin_system)
- Old unused files (mixer_v3, Fader.jsx)
- No clear component hierarchy

## 🎯 New Structure

```
/src
├── /components          # Shared, reusable components
│   ├── /common          # Basic UI elements (formerly in /ui)
│   │   ├── TabButton.jsx
│   │   ├── DebugPanel.jsx
│   │   └── SignalVisualizer.jsx
│   │
│   ├── /controls        # NEW: Unified control system
│   │   ├── index.js
│   │   ├── /base        # Core controls
│   │   │   ├── Knob.jsx
│   │   │   ├── Fader.jsx
│   │   │   ├── Slider.jsx
│   │   │   ├── Button.jsx
│   │   │   ├── Toggle.jsx
│   │   │   └── Display.jsx
│   │   ├── /advanced    # Complex controls
│   │   │   ├── XYPad.jsx
│   │   │   ├── Meter.jsx
│   │   │   └── StepSequencer.jsx
│   │   ├── /specialized # Plugin-specific
│   │   │   ├── SpectrumKnob.jsx
│   │   │   ├── WaveformKnob.jsx
│   │   │   └── EnvelopeEditor.jsx
│   │   └── useControlTheme.js
│   │
│   ├── /plugins         # Plugin UI system
│   │   ├── /container   # Plugin wrapper/chrome
│   │   │   ├── PluginContainer.jsx
│   │   │   └── PluginHeader.jsx
│   │   ├── /effects     # Effect UIs
│   │   │   ├── SaturatorUI.jsx
│   │   │   ├── ReverbUI.jsx
│   │   │   ├── CompressorUI.jsx
│   │   │   └── ... (all effect UIs)
│   │   ├── /visualizers # Effect visualizers
│   │   │   ├── SaturatorVisualizer.jsx
│   │   │   └── ...
│   │   └── PluginDesignSystem.jsx
│   │
│   └── /instruments     # Instrument components
│       └── ... (existing)
│
├── /features            # Feature modules (single responsibility)
│   ├── /arrangement
│   ├── /channel-rack
│   ├── /piano-roll
│   ├── /sample-editor
│   ├── /mixer
│   │   ├── Mixer.jsx
│   │   ├── /components
│   │   │   ├── MixerChannel.jsx
│   │   │   ├── MasterChannel.jsx
│   │   │   └── EffectsRack.jsx
│   │   └── Mixer.css
│   ├── /file-browser
│   ├── /toolbars
│   │   ├── MainToolbar.jsx
│   │   └── TopToolbar.jsx
│   └── /settings
│       ├── ThemeEditor.jsx
│       └── KeyBindings.jsx
│
├── /layout              # Layout components
│   ├── WorkspacePanel.jsx
│   └── ... (existing)
│
├── /lib                 # Core libraries
│   ├── /audio          # Audio engine, effects
│   ├── /core           # Core systems
│   ├── /services       # Services
│   ├── /utils          # Utilities
│   └── /visualization  # Visualization system
│
├── /store              # State management
│   └── ... (existing)
│
├── /config             # Configuration
│   ├── pluginConfig.jsx
│   ├── panelConfig.js
│   └── initialData.js
│
└── /styles             # Global styles
    └── ... (existing)
```

## 🔄 Migration Steps

### Phase 1: Controls Migration
1. ✅ Move `/ui/controls/*` → `/components/controls/base/*`
2. ✅ Create `/components/controls/advanced/*`
3. ✅ Create `/components/controls/specialized/*`
4. ✅ Update all imports

### Phase 2: Plugin System Reorganization
1. Move `/ui/plugin_system/*` → `/components/plugins/container/*`
2. Move `/ui/plugin_uis/*` → `/components/plugins/effects/*`
3. Move visualizers to `/components/plugins/visualizers/*`
4. Update pluginConfig.jsx

### Phase 3: Common Components
1. Move `/ui/TabButton.jsx` → `/components/common/TabButton.jsx`
2. Move `/ui/DebugPanel.jsx` → `/components/common/DebugPanel.jsx`
3. Delete `/ui/VolumeKnob.jsx` (use new Knob)
4. Delete `/ui/Fader.jsx` (use new Fader)

### Phase 4: Features Cleanup
1. Delete `/features/mixer_v3` (obsolete)
2. Rename `/features/piano_roll_v7` → `/features/piano-roll`
3. Rename `/features/sample_editor_v3` → `/features/sample-editor`
4. Move toolbars to `/features/toolbars`

### Phase 5: Missing Controls
Create missing controls:
- EnvelopeEditor (ADSR visualization)
- FrequencyGraph (for EQ)
- WaveformEditor (for sample editing)
- ModulationMatrix (for routing)

## 📦 New Exports

```javascript
// /components/controls/index.js
export * from './base';
export * from './advanced';
export * from './specialized';

// Usage anywhere:
import { Knob, Fader, XYPad, SpectrumKnob } from '@/components/controls';
```

## 🎯 Benefits

1. **Clear hierarchy** - Easy to find components
2. **No duplication** - Single source of truth
3. **Better imports** - Shorter, clearer paths
4. **Scalability** - Easy to add new features
5. **Performance** - All controls RAF-optimized
