# Plugin v2.0 Migration Template

Use this template when migrating a plugin to v2.0 architecture.

---

## Step 1: Create UI File

**File:** `/client/src/components/plugins/effects/{PluginName}UI_V2.jsx`

```jsx
/**
 * {PLUGIN NAME} UI V2.0
 *
 * {Brief description of plugin}
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming ({category-name})
 * ✅ Performance optimization with RAF batching
 *
 * Features:
 * - {Feature 1}
 * - {Feature 2}
 * - {Feature 3}
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob, ExpandablePanel } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useMixerStore } from '@/store/useMixerStore';

// ============================================================================
// VISUALIZATION COMPONENT (if needed)
// ============================================================================

const PluginVisualization = ({ trackId, effectId, param1, param2 }) => {
  const canvasRef = useRef(null);

  const drawVisualization = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Drawing logic here
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // ... visualization code
  }, [param1, param2]);

  // Handle canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateDimensions = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(canvas);

    return () => observer.disconnect();
  }, []);

  // Use CanvasRenderManager for smooth rendering
  useRenderer(drawVisualization, 5, 16, [param1, param2]);

  return (
    <div className="w-full h-[200px] bg-black/50 rounded-xl border border-[{color}]/20 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const {PluginName}UI_V2 = ({ trackId, effect, effectNode, definition }) => {
  // Extract settings with defaults
  const {
    param1 = defaultValue1,
    param2 = defaultValue2,
    param3 = defaultValue3,
    // ... all parameters
  } = effect.settings || {};

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('{category-name}'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam } = useParameterBatcher(effectNode);

  // Sync with effect.settings when presets are loaded
  useEffect(() => {
    // This is crucial for preset loading to work!
    if (effect.settings.param1 !== undefined) {
      // Update local state if you have any
    }
    // ... sync other params
  }, [effect.settings]);

  // Handle parameter changes
  const { handleMixerEffectChange } = useMixerStore.getState();
  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

  return (
    <PluginContainerV2
      trackId={trackId}
      effect={effect}
      definition={definition}
      category="{category-name}"
    >
      <TwoPanelLayout
        category="{category-name}"

        mainPanel={
          <>
            {/* Visualization (optional) */}
            <PluginVisualization
              trackId={trackId}
              effectId={effect.id}
              param1={param1}
              param2={param2}
            />

            {/* Main Controls */}
            <div className="bg-gradient-to-br from-black/50 to-[#001829]/30 rounded-xl p-6 border border-[{color}]/20">
              <div className="grid grid-cols-4 gap-6">
                <Knob
                  label="PARAM 1"
                  value={param1}
                  onChange={(val) => handleParamChange('param1', val)}
                  min={min1}
                  max={max1}
                  defaultValue={defaultValue1}
                  sizeVariant="medium"
                  category="{category-name}"
                  valueFormatter={(v) => `${v.toFixed(1)} unit`}
                />

                {/* More knobs... */}
              </div>
            </div>

            {/* Expandable Advanced Section (optional) */}
            <ExpandablePanel
              title="Advanced Settings"
              icon="⚙️"
              category="{category-name}"
              defaultExpanded={false}
            >
              <div className="p-4 space-y-4">
                {/* Advanced controls */}
              </div>
            </ExpandablePanel>
          </>
        }

        sidePanel={
          <>
            {/* Stats Panel */}
            <div className="bg-gradient-to-br from-[#001829]/50 to-black/50 rounded-xl p-4 border border-[{color}]/10">
              <div className="text-[9px] text-[{color}]/70 font-bold uppercase tracking-wider mb-3">
                Statistics
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/60">Metric 1:</span>
                  <span className="text-xs text-white font-mono">Value</span>
                </div>
                {/* More stats... */}
              </div>
            </div>

            {/* Info Panel */}
            <div className="bg-gradient-to-br from-[#001829]/50 to-black/50 rounded-xl p-4 border border-[{color}]/10">
              <div className="text-[9px] text-[{color}]/70 font-bold uppercase tracking-wider mb-2">
                About
              </div>
              <div className="text-[10px] text-white/60 leading-relaxed">
                {definition.story}
              </div>
            </div>
          </>
        }
      />
    </PluginContainerV2>
  );
};

export default {PluginName}UI_V2;
```

---

## Step 2: Create Preset File

**File:** `/client/src/config/presets/{pluginName}Presets.js`

```javascript
/**
 * {PLUGIN NAME} FACTORY PRESETS
 *
 * Professional presets for {plugin purpose}
 * Organized by category: {Category1}, {Category2}, {Category3}
 */

export const {pluginName}Presets = [
  // ===================================
  // CATEGORY 1
  // ===================================
  {
    id: 'preset-id-1',
    name: 'Preset Name 1',
    description: 'Brief description of what this preset does',
    category: 'Category 1',
    tags: ['tag1', 'tag2', 'tag3'],
    author: 'DAWG',
    settings: {
      param1: value1,
      param2: value2,
      param3: value3,
      // ... ALL worklet parameters with their values
    }
  },
  {
    id: 'preset-id-2',
    name: 'Preset Name 2',
    description: 'Another preset description',
    category: 'Category 1',
    tags: ['tag1', 'tag4'],
    author: 'DAWG',
    settings: {
      param1: value1,
      param2: value2,
      param3: value3,
    }
  },

  // ===================================
  // CATEGORY 2
  // ===================================
  {
    id: 'preset-id-3',
    name: 'Preset Name 3',
    description: 'Description for category 2 preset',
    category: 'Category 2',
    tags: ['tag5', 'tag6'],
    author: 'DAWG',
    settings: {
      param1: value1,
      param2: value2,
      param3: value3,
    }
  },

  // ... 4-10 more presets (aim for 6-12 total)
];

export default {pluginName}Presets;
```

---

## Step 3: Update pluginConfig.jsx

```javascript
// 1. Import the v2.0 UI component
import {PluginName}UI_V2 from '@/components/plugins/effects/{PluginName}UI_V2'; // ✨ v2.0

// 2. Import the presets
import { {pluginName}Presets } from '@/config/presets/{pluginName}Presets.js';

// 3. Update plugin definition
export const pluginRegistry = {
  // ...
  '{PluginName}': {
    type: '{PluginName}',
    category: '{The Category Name}',
    story: "{Updated story text}",
    toneNode: '{ToneNodeName}',
    uiComponent: {PluginName}UI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 750 },
    minSize: { width: 1000, height: 650 },
    defaultSettings: {
      param1: defaultValue1,
      param2: defaultValue2,
      param3: defaultValue3,
      // ... all parameters
    },
    // ✨ v2.0: Factory presets managed by PresetManager
    presets: {pluginName}Presets
  },
  // ...
};
```

---

## Step 4: Testing Checklist

### Manual Testing
- [ ] Plugin opens without errors
- [ ] All knobs/controls update parameters smoothly
- [ ] Preset dropdown shows in header
- [ ] All factory presets appear in dropdown
- [ ] Selecting a preset updates all parameters
- [ ] Visualization renders correctly (if applicable)
- [ ] No console errors or warnings
- [ ] UI is responsive (resize window)

### Console Checks
Look for these debug logs:
```
🔍 [PluginContainerV2] Creating PresetManager: { pluginType, category, factoryPresetsCount }
🎯 [PluginContainerV2] Loading preset: [preset name] [settings]
✅ [PluginContainerV2] Applying settings: { settings object }
```

### Performance Checks
- [ ] Parameter changes are smooth (no lag)
- [ ] Visualization runs at 60fps (if applicable)
- [ ] No memory leaks (open/close plugin multiple times)
- [ ] Preset loading is fast (<100ms)

---

## Step 5: Common Issues & Solutions

### Issue 1: Presets Not Showing
**Symptom:** Dropdown only shows "Custom"
**Solution:**
- Check preset file exports correctly: `export const {pluginName}Presets = [...]`
- Check import in pluginConfig: `import { {pluginName}Presets } from '...'`
- Check plugin definition has: `presets: {pluginName}Presets`
- Verify preset objects have all required fields (id, name, category, settings)

### Issue 2: Presets Not Applying
**Symptom:** Preset selected but parameters don't change
**Solution:**
- Add `useEffect` to sync with `effect.settings`:
```javascript
useEffect(() => {
  if (effect.settings.param1 !== undefined) {
    setParam1(effect.settings.param1);
  }
  // ... other params
}, [effect.settings]);
```

### Issue 3: Blank Plugin UI
**Symptom:** Plugin opens but shows nothing
**Solution:**
- Check `TwoPanelLayout` props: use `mainPanel` and `sidePanel`, not `centerPanel`/`rightPanel`
- Verify category name matches design system categories
- Check for JSX errors in console

### Issue 4: Parameter Changes Don't Save
**Symptom:** Knobs move but effect doesn't change
**Solution:**
- Verify `handleParamChange` calls both `setParam` and `handleMixerEffectChange`
- Check `effectNode` is passed correctly to `useParameterBatcher`
- Verify worklet parameter names match exactly

### Issue 5: Visualization Not Rendering
**Symptom:** Canvas is blank
**Solution:**
- Check `useRenderer` is called with correct dependencies
- Verify canvas dimensions are set (width/height)
- Check devicePixelRatio scaling
- Add console logs in draw function to verify it's being called

---

## Step 6: Category Reference

### Category Colors & Themes

| Category | Color | Use Case |
|----------|-------|----------|
| `texture-lab` | Orange/Red | Distortion, saturation, warmth |
| `dynamics-forge` | Cyan/Blue | Compression, limiting, gating |
| `spectral-weave` | Purple | EQ, filters, frequency tools |
| `spacetime-chamber` | Green/Teal | Reverb, delay, echoes |
| `cosmic-modulation` | Pink/Magenta | Chorus, phaser, flanger, panning |
| `reality-bender` | Yellow/Gold | Pitch, time, extreme effects |
| `master-chain` | White/Silver | Mastering tools, imaging, maximizing |

---

## Step 7: Parameter Naming Best Practices

### Standard Parameter Names
Use these standard names when applicable:
- `wet` - Dry/wet mix (0-1)
- `output` - Output gain (0-2)
- `threshold` - Threshold in dB (-60 to 0)
- `ratio` - Compression/expansion ratio (1-20)
- `attack` - Attack time in seconds (0.001-1)
- `release` - Release time in seconds (0.01-5)
- `frequency` - Frequency in Hz (20-20000)
- `gain` - Gain in dB (-24 to 24)
- `q` - Q factor/resonance (0.1-20)

### Avoid These Mistakes
- ❌ Don't use different units in UI vs worklet (ms vs seconds)
- ❌ Don't use mode-based parameters (use direct worklet params)
- ❌ Don't use non-existent worklet parameters
- ❌ Don't forget to add all parameters to defaultSettings

---

## Complete Example: Simple Filter Plugin

See `SaturatorUI_V2.jsx` and `saturatorPresets_simple.js` for a complete working example.

Key points:
1. Simple, clean UI structure
2. Direct worklet parameter mapping
3. Proper effect.settings syncing
4. Category-based theming
5. Factory presets with real parameters

---

**Migration Estimated Time:** 2.5-3.5 hours per plugin
**Difficulty Level:** Medium
**Success Rate:** High (if following template)

Last Updated: 2025-11-02
