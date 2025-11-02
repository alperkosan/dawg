# DAWG Plugin System v2.0 Migration Roadmap

## Executive Summary

**Goal:** Migrate all remaining 14 plugins to unified v2.0 architecture
**Completed:** 6/20 plugins (30%)
**Remaining:** 14/20 plugins (70%)
**Estimated Time:** ~14-20 hours total

---

## ✅ Completed Migrations (6 plugins)

### Tier 1: Core Effects
1. **Saturator** ✅ - v2.0 Complete
   - Status: Full migration with 6 simplified presets
   - Layout: TwoPanelLayout
   - Presets: `saturatorPresets_simple.js`
   - UI: Removed ModeSelector, unified with PresetManager

2. **Compressor** ✅ - v2.0 Complete
   - Status: Full migration with 6 simplified presets
   - Layout: TwoPanelLayout
   - Presets: `compressorPresets_simple.js`
   - UI: Removed ModeSelector, unified with PresetManager

3. **OTT** ✅ - v2.0 Complete
   - Status: Full migration
   - Layout: TwoPanelLayout
   - Presets: Mode-based system (no factory presets needed)

4. **MultiBandEQ** ✅ - v2.0 Complete
   - Status: Full migration with 24 factory presets
   - Layout: TwoPanelLayout
   - Presets: `eqPresets.js` (24 presets across 6 categories)
   - **Fix Applied:** Added useEffect to sync with effect.settings changes

5. **ModernReverb** ✅ - v2.0 Complete
   - Status: Full migration
   - Layout: TwoPanelLayout

6. **ModernDelay** ✅ - v2.0 Complete
   - Status: Full migration with 6 factory presets
   - Layout: TwoPanelLayout
   - Presets: `delayPresets.js`

---

## 🎯 Migration Priority Tiers

### Priority 1: Tier 2 Creative Effects (4 plugins)
**Estimated Time:** 6-8 hours
**Impact:** Medium - frequently used creative effects

#### 1.1 TidalFilter
- **Current State:** v1.0 - Old UI system
- **Complexity:** Medium
- **Migration Tasks:**
  - Create `TidalFilterUI_V2.jsx`
  - Integrate PluginContainerV2
  - Add TwoPanelLayout
  - Create factory presets file (6-8 presets)
  - Categories: Lowpass, Highpass, Bandpass, Notch, Creative
  - Update pluginConfig.jsx
- **Preset Ideas:**
  - Classic Lowpass (resonance ladder)
  - Analog Highpass
  - Vocal Bandpass
  - Telephone Notch
  - Acid Squelch
  - Pad Sweep

#### 1.2 StardustChorus
- **Current State:** v1.0 - Old UI system
- **Complexity:** Medium
- **Migration Tasks:**
  - Create `StardustChorusUI_V2.jsx`
  - Integrate PluginContainerV2
  - Add TwoPanelLayout
  - Create factory presets file (6-8 presets)
  - Categories: Subtle, Lush, Wide, Vintage, Creative
  - Update pluginConfig.jsx
- **Preset Ideas:**
  - Subtle Thickener
  - 80s Ensemble
  - Wide Stereo
  - Dimension D
  - Juno Chorus
  - Detuned Dream

#### 1.3 VortexPhaser
- **Current State:** v1.0 - Old UI system
- **Complexity:** Medium
- **Migration Tasks:**
  - Create `VortexPhaserUI_V2.jsx`
  - Integrate PluginContainerV2
  - Add TwoPanelLayout
  - Create factory presets file (6-8 presets)
  - Categories: Vintage, Modern, Extreme, Subtle
  - Update pluginConfig.jsx
- **Preset Ideas:**
  - Small Stone
  - Phase 90 Classic
  - Jet Flanger
  - Slow Sweep
  - Fast Wobble
  - Analog Warmth

#### 1.4 OrbitPanner
- **Current State:** v1.0 - Old UI system
- **Complexity:** Low
- **Migration Tasks:**
  - Create `OrbitPannerUI_V2.jsx`
  - Integrate PluginContainerV2
  - Add TwoPanelLayout
  - Create factory presets file (4-6 presets)
  - Categories: Circular, Triangle, Sine, Random
  - Update pluginConfig.jsx
- **Preset Ideas:**
  - Slow Circle
  - Fast Ping-Pong
  - Subtle Drift
  - Wide Rotation
  - Random Walk
  - Figure-8

---

### Priority 2: Tier 3 Specialized Effects (8 plugins)
**Estimated Time:** 10-12 hours
**Impact:** Low-Medium - specialized use cases

#### 2.1 ArcadeCrusher
- **Current State:** v1.0 - Old UI system
- **Complexity:** Low-Medium
- **Migration Tasks:**
  - Create `ArcadeCrusherUI_V2.jsx`
  - Integrate PluginContainerV2
  - Add TwoPanelLayout
  - Create factory presets file (6-8 presets)
  - Categories: Lofi, Retro, Extreme, Subtle
  - Update pluginConfig.jsx
- **Preset Ideas:**
  - 8-bit Console
  - Game Boy
  - Telephone
  - AM Radio
  - Vintage Sample
  - Extreme Crush

#### 2.2 PitchShifter
- **Current State:** v1.0 - Old UI system
- **Complexity:** Medium
- **Migration Tasks:**
  - Create `PitchShifterUI_V2.jsx`
  - Integrate PluginContainerV2
  - Add TwoPanelLayout
  - Create factory presets file (6-8 presets)
  - Categories: Octave, Harmony, Detune, Creative
  - Update pluginConfig.jsx
- **Preset Ideas:**
  - Octave Up
  - Octave Down
  - Perfect Fifth
  - Micro Detune
  - Chipmunk
  - Bass Drop

#### 2.3 BassEnhancer808
- **Current State:** v1.0 - Old UI system
- **Complexity:** Medium
- **Migration Tasks:**
  - Create `BassEnhancer808UI_V2.jsx`
  - Integrate PluginContainerV2
  - Add TwoPanelLayout
  - Create factory presets file (6-8 presets)
  - Categories: Sub, Mid, Punch, Mix
  - Update pluginConfig.jsx
- **Preset Ideas:**
  - Deep Sub
  - 808 Kick
  - Bass Guitar
  - Synth Bass
  - Mix Bus
  - Live Bass

#### 2.4 TransientDesigner
- **Current State:** v1.0 - Old UI system
- **Complexity:** Medium-High
- **Migration Tasks:**
  - Create `TransientDesignerUI_V2.jsx`
  - Integrate PluginContainerV2
  - Add TwoPanelLayout
  - Create factory presets file (6-8 presets)
  - Categories: Drums, Percussion, Mix, Creative
  - Update pluginConfig.jsx
- **Preset Ideas:**
  - Punchy Kick
  - Snappy Snare
  - Tight Drums
  - Soft Attack
  - Long Sustain
  - Room Control

#### 2.5 HalfTime
- **Current State:** v1.0 - Old UI system
- **Complexity:** Low
- **Migration Tasks:**
  - Create `HalfTimeUI_V2.jsx`
  - Integrate PluginContainerV2
  - Add TwoPanelLayout
  - Create factory presets file (4-6 presets)
  - Categories: Classic, Creative, Extreme
  - Update pluginConfig.jsx
- **Preset Ideas:**
  - 50% Slow
  - 25% Crawl
  - Smooth Blend
  - Hard Cut
  - Tape Stop
  - Glitch

#### 2.6 Limiter
- **Current State:** v1.0 - Old UI system
- **Complexity:** Medium
- **Migration Tasks:**
  - Create `LimiterUI_V2.jsx`
  - Integrate PluginContainerV2
  - Add TwoPanelLayout
  - Create factory presets file (6-8 presets)
  - Categories: Mastering, Mix Bus, Aggressive, Transparent
  - Update pluginConfig.jsx
- **Preset Ideas:**
  - Transparent Master
  - Loud Master
  - Mix Bus Glue
  - Aggressive Limit
  - Brick Wall
  - Soft Ceiling

#### 2.7 Clipper
- **Current State:** v1.0 - Old UI system
- **Complexity:** Low-Medium
- **Migration Tasks:**
  - Create `ClipperUI_V2.jsx`
  - Integrate PluginContainerV2
  - Add TwoPanelLayout
  - Create factory presets file (4-6 presets)
  - Categories: Soft, Hard, Asymmetric, Creative
  - Update pluginConfig.jsx
- **Preset Ideas:**
  - Soft Clip
  - Hard Clip
  - Asymmetric
  - Tube Warmth
  - Digital Crush
  - Mastering

#### 2.8 RhythmFX
- **Current State:** v1.0 - Old UI system
- **Complexity:** Medium-High
- **Migration Tasks:**
  - Create `RhythmFXUI_V2.jsx`
  - Integrate PluginContainerV2
  - Add TwoPanelLayout
  - Create factory presets file (8-12 presets)
  - Categories: Gating, Stutters, Filters, Creative
  - Update pluginConfig.jsx
- **Preset Ideas:**
  - 1/4 Note Gate
  - 1/8 Note Gate
  - 1/16 Stutter
  - Triplet Gate
  - Filter Sweep
  - Sidechain Pump
  - Glitch Pattern
  - Breakbeat Cut

---

### Priority 3: Master Chain (2 plugins)
**Estimated Time:** 3-4 hours
**Impact:** High - used on master channel

#### 3.1 Maximizer
- **Current State:** v1.0 - Old UI system
- **Complexity:** Medium
- **Migration Tasks:**
  - Create `MaximizerUI_V2.jsx`
  - Integrate PluginContainerV2
  - Add TwoPanelLayout
  - Create factory presets file (6-8 presets)
  - Categories: Mastering, Mix Bus, Loud, Transparent
  - Update pluginConfig.jsx
- **Preset Ideas:**
  - Streaming Master
  - CD Master
  - Club Master
  - Transparent
  - Aggressive
  - Modern Loud

#### 3.2 Imager
- **Current State:** v1.0 - Old UI system
- **Complexity:** Low-Medium
- **Migration Tasks:**
  - Create `ImagerUI_V2.jsx`
  - Integrate PluginContainerV2
  - Add TwoPanelLayout
  - Create factory presets file (4-6 presets)
  - Categories: Wide, Mono, Mid-Side, Creative
  - Update pluginConfig.jsx
- **Preset Ideas:**
  - Subtle Width
  - Wide Stereo
  - Mono Bass
  - Mid-Side Balance
  - Vinyl Narrow
  - Ultra Wide

---

## 📋 Standard Migration Checklist

For each plugin, follow this checklist:

### Phase 1: File Creation (15-20 min)
- [ ] Create `{PluginName}UI_V2.jsx` in `/components/plugins/effects/`
- [ ] Copy header documentation from existing v2.0 plugin
- [ ] Import required dependencies:
  - `PluginContainerV2`
  - `TwoPanelLayout` or `ThreePanelLayout`
  - `Knob`, `ExpandablePanel`, controls
  - `getCategoryColors`
  - `useParameterBatcher`
  - `useRenderer` (if visualization needed)
  - `useMixerStore`

### Phase 2: Layout Migration (30-45 min)
- [ ] Wrap UI in `<PluginContainerV2>`
- [ ] Convert old layout to `TwoPanelLayout`
- [ ] Define `mainPanel` (visualization + main controls)
- [ ] Define `sidePanel` (stats, advanced settings)
- [ ] Remove any old container/wrapper components
- [ ] Add proper category prop

### Phase 3: Preset System (45-60 min)
- [ ] Create `/config/presets/{pluginName}Presets.js`
- [ ] Define 6-12 factory presets with:
  - `id`, `name`, `category`, `description`, `tags`, `author`
  - `settings` object with real worklet parameters
- [ ] Import preset file in `pluginConfig.jsx`
- [ ] Add `presets: {pluginName}Presets` to plugin definition
- [ ] Test preset loading via dropdown

### Phase 4: State Management (20-30 min)
- [ ] Add `useEffect` to sync with `effect.settings` changes
- [ ] Use `useMixerStore.handleMixerEffectChange` for parameter updates
- [ ] Remove any old onChange handlers
- [ ] Ensure parameter batching works

### Phase 5: Testing (15-20 min)
- [ ] Test plugin opens correctly
- [ ] Test all controls update parameters
- [ ] Test preset dropdown shows all presets
- [ ] Test preset selection applies settings
- [ ] Test visualization (if applicable)
- [ ] Check console for errors

### Phase 6: Cleanup (10-15 min)
- [ ] Remove old UI file (keep as `{PluginName}UI_OLD.jsx` initially)
- [ ] Update imports in `pluginConfig.jsx`
- [ ] Add v2.0 comment markers
- [ ] Document any breaking changes
- [ ] Update plugin story text if needed

**Total Time per Plugin:** ~2.5-3.5 hours

---

## 🎨 Design System Reference

### Layout Patterns

#### TwoPanelLayout (Most Common)
```jsx
<PluginContainerV2
  trackId={trackId}
  effect={effect}
  definition={definition}
  category="category-name"
>
  <TwoPanelLayout
    category="category-name"
    mainPanel={
      <>
        {/* Visualization */}
        {/* Main Controls */}
        {/* Expandable Panels */}
      </>
    }
    sidePanel={
      <>
        {/* Stats */}
        {/* Advanced Settings */}
        {/* Info Panels */}
      </>
    }
  />
</PluginContainerV2>
```

#### ThreePanelLayout (Complex Plugins)
```jsx
<ThreePanelLayout
  category="category-name"
  leftPanel={/* Mode selector or navigation */}
  centerPanel={/* Main visualization + controls */}
  rightPanel={/* Stats + advanced */}
/>
```

### Category Colors
- `texture-lab` - Saturator, distortion
- `dynamics-forge` - Compressor, OTT, limiters
- `spectral-weave` - EQ, filters
- `spacetime-chamber` - Reverb, delay
- `cosmic-modulation` - Chorus, phaser, panner
- `reality-bender` - Pitch, time effects
- `master-chain` - Maximizer, imager

### Preset File Template
```javascript
export const pluginPresets = [
  {
    id: 'preset-id',
    name: 'Preset Name',
    category: 'Category',
    description: 'Short description',
    tags: ['tag1', 'tag2', 'tag3'],
    author: 'DAWG',
    settings: {
      param1: value1,
      param2: value2,
      // ... all worklet parameters
    }
  },
  // ... more presets
];
```

---

## 🚀 Recommended Migration Order

### Week 1: Tier 2 Creative Effects (Priority 1)
**Day 1-2:** TidalFilter, StardustChorus
**Day 3-4:** VortexPhaser, OrbitPanner

### Week 2: Master Chain + High-Priority Specialized
**Day 1:** Maximizer, Imager (master chain - high priority)
**Day 2-3:** Limiter, TransientDesigner
**Day 4:** BassEnhancer808

### Week 3: Remaining Specialized Effects
**Day 1-2:** ArcadeCrusher, PitchShifter
**Day 3:** HalfTime, Clipper
**Day 4:** RhythmFX (most complex)

---

## 📊 Success Metrics

### Code Quality
- [ ] All plugins use PluginContainerV2
- [ ] Consistent layout patterns (TwoPanel/ThreePanel)
- [ ] All presets use factory preset system
- [ ] No old UI wrapper components
- [ ] Clean parameter batching

### User Experience
- [ ] Preset selection works in all plugins
- [ ] Consistent visual design across all plugins
- [ ] Smooth parameter changes
- [ ] No console errors
- [ ] Visualizations render at 60fps

### Architecture
- [ ] Single source of truth for settings (mixer store)
- [ ] Proper effect.settings syncing
- [ ] Clean separation of concerns
- [ ] Reusable components
- [ ] Performance optimized

---

## 🎯 Post-Migration Tasks

### Documentation
- [ ] Update plugin documentation
- [ ] Create preset creation guide
- [ ] Document v2.0 architecture
- [ ] Create migration guide for custom plugins

### Cleanup
- [ ] Delete all old UI files (`*UI_OLD.jsx`)
- [ ] Remove deprecated imports
- [ ] Clean up unused preset files
- [ ] Archive migration documentation

### Testing
- [ ] Full integration testing
- [ ] Performance profiling
- [ ] User acceptance testing
- [ ] Edge case validation

### Polish
- [ ] Fine-tune preset values
- [ ] Improve visualizations
- [ ] Add keyboard shortcuts
- [ ] Enhance accessibility

---

## 🔧 Common Migration Patterns

### Pattern 1: Effect.settings Sync
```javascript
// Sync with effect.settings when presets are loaded
useEffect(() => {
  if (effect.settings.param1 !== undefined) {
    setParam1(effect.settings.param1);
  }
  // ... other params
}, [effect.settings]);
```

### Pattern 2: Parameter Change Handler
```javascript
const { handleMixerEffectChange } = useMixerStore.getState();
const handleParamChange = useCallback((key, value) => {
  setParam(key, value);
  handleMixerEffectChange(trackId, effect.id, { [key]: value });
}, [setParam, handleMixerEffectChange, trackId, effect.id]);
```

### Pattern 3: ModeSelector Removal
```javascript
// OLD (v1.0)
<ModeSelector
  modes={modes}
  activeMode={selectedMode}
  onChange={handleModeChange}
/>

// NEW (v2.0)
// Remove entirely - use PresetManager in header
```

---

## 📝 Notes & Considerations

### Technical Debt
- Some plugins may have complex worklet implementations
- Visualization performance needs monitoring
- Preset parameter validation needed
- Error handling improvements

### Future Enhancements
- Preset import/export functionality
- User custom presets
- Preset morphing/interpolation
- A/B testing improvements
- Undo/redo stack expansion

### Known Issues to Address
- Effect.settings deep copy performance
- Multiple preset loads in rapid succession
- Visualization memory leaks (check cleanup)
- WebGL context limits

---

## 🎉 Completion Criteria

Migration is complete when:
1. ✅ All 20 plugins use v2.0 architecture
2. ✅ All plugins have factory presets
3. ✅ Preset selection works consistently
4. ✅ No console errors or warnings
5. ✅ Performance metrics met (60fps, <100ms preset load)
6. ✅ Old UI files archived/deleted
7. ✅ Documentation updated
8. ✅ User testing passed

---

**Current Progress: 30% (6/20)**
**Estimated Completion: 2-3 weeks**
**Last Updated: 2025-11-02**
