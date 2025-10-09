# Quick Start: Plugin Redesign Guide

**Use this guide when redesigning any plugin**

---

## 🚀 5-Minute Setup

### 1. Import Components

```javascript
import { Knob, Slider, ModeSelector, ExpandablePanel } from '@/components/controls';
import { useGhostValue } from '@/hooks/useAudioPlugin';
```

---

### 2. Choose Your Category

| Plugin Type | Category | Color | Example Plugins |
|------------|----------|-------|-----------------|
| **Saturation/Distortion** | `texture-lab` | Orange (#FF6B35) | Saturator |
| **Dynamics** | `dynamics-forge` | Blue (#00A8E8) | Compressor, TransientDesigner |
| **EQ/Filter** | `spectral-weave` | Purple (#9B59B6) | EQ, Filter |
| **Modulation** | `modulation-machines` | Green (#2ECC71) | Chorus, Phaser, Flanger |
| **Reverb/Delay** | `spacetime-chamber` | Red (#E74C3C) | Reverb, Delay |

---

### 3. Set Up Ghost Values

```javascript
// In your component
const ghostDrive = useGhostValue(drive, 400);
const ghostMix = useGhostValue(mix, 400);
```

---

### 4. Use Components

```javascript
<Knob
  label="DRIVE"
  value={drive}
  ghostValue={ghostDrive}
  onChange={(val) => onChange('drive', val)}
  min={0}
  max={1}
  sizeVariant="large"
  category="texture-lab"
  valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
/>
```

---

## 📋 Component Cheat Sheet

### Knob

**When to use:** Continuous parameters (drive, gain, mix)

```javascript
<Knob
  label="DRIVE"
  value={drive}
  ghostValue={ghostDrive}              // Optional: visual feedback
  onChange={onChange}
  min={0}
  max={1.5}
  defaultValue={0.4}
  sizeVariant="large"                  // 'small' | 'medium' | 'large'
  category="texture-lab"               // Auto theming
  valueFormatter={(v) => `${v}%`}     // Optional: custom format
/>
```

**Props:**
- `label` - Control label (uppercase recommended)
- `value` - Current value
- `ghostValue` - Ghost value for visual lag (optional)
- `onChange` - Callback when value changes
- `min` - Minimum value (default: 0)
- `max` - Maximum value (default: 1)
- `defaultValue` - Default value for double-click reset
- `sizeVariant` - Size: 'small' (60px), 'medium' (80px), 'large' (100px)
- `category` - Plugin category for theming
- `valueFormatter` - Custom value display function

---

### Slider

**When to use:**
- Bipolar controls (tone, pan, attack/sustain)
- Frequency controls (use `logarithmic`)
- Time controls (use `logarithmic`)

```javascript
// Bipolar slider (e.g., Tone control)
<Slider
  label="TONE"
  value={tone}
  ghostValue={ghostTone}
  onChange={onChange}
  min={-10}
  max={10}
  defaultValue={0}
  bipolar={true}                       // Fill from center
  centerDetent={true}                  // Snap to 0
  category="texture-lab"
  valueFormatter={(v) => {
    if (v > 0) return `+${v.toFixed(1)}`;
    if (v < 0) return `${v.toFixed(1)}`;
    return '0';
  }}
/>

// Logarithmic slider (e.g., Frequency control)
<Slider
  label="FREQUENCY"
  value={freq}
  onChange={onChange}
  min={20}
  max={20000}
  logarithmic={true}                   // Log scale
  showTicks={true}                     // Show tick marks
  category="spectral-weave"
  valueFormatter={(v) => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)} kHz`;
    return `${v.toFixed(0)} Hz`;
  }}
/>

// Vertical slider (e.g., Level control)
<Slider
  label="LEVEL"
  value={level}
  onChange={onChange}
  orientation="vertical"
  height={150}
  category="texture-lab"
/>
```

**Props:**
- `label` - Control label
- `value` - Current value
- `ghostValue` - Ghost value for visual lag (optional)
- `onChange` - Callback when value changes
- `min` - Minimum value
- `max` - Maximum value
- `defaultValue` - Default value for double-click reset
- `orientation` - 'horizontal' | 'vertical' (default: horizontal)
- `bipolar` - Enable bipolar mode (fill from center)
- `centerDetent` - Snap to center when close (requires bipolar)
- `logarithmic` - Use logarithmic scale
- `showTicks` - Show tick marks
- `tickValues` - Custom tick positions (array)
- `category` - Plugin category for theming
- `valueFormatter` - Custom value display function
- `width` - Width in pixels (horizontal only)
- `height` - Height in pixels (vertical only)

---

### ModeSelector

**When to use:** Preset modes, character selection, algorithm choice

```javascript
const modes = [
  {
    id: 'vocal-warmth',
    label: 'Vocal Warmth',
    icon: '🎤',
    description: 'Adds warm harmonics to vocals'
  },
  {
    id: 'bass-power',
    label: 'Bass Power',
    icon: '🔊',
    description: 'Enhances low-end presence'
  },
  // ... more modes
];

<ModeSelector
  modes={modes}
  activeMode={selectedMode}
  onChange={handleModeChange}
  orientation="vertical"               // 'horizontal' | 'vertical'
  category="texture-lab"
  compact={false}                      // true = icons only
/>
```

**Props:**
- `modes` - Array of mode objects `{ id, label, icon?, description? }`
- `activeMode` - Currently active mode ID
- `onChange` - Callback when mode changes (receives mode ID)
- `orientation` - 'horizontal' | 'vertical' (default: horizontal)
- `compact` - Icons only mode (default: false)
- `category` - Plugin category for theming
- `allowDeselect` - Allow deselecting (default: false)

---

### ExpandablePanel

**When to use:** Advanced settings, progressive disclosure, optional controls

```javascript
<ExpandablePanel
  title="Advanced Settings"
  icon="⚙️"
  category="texture-lab"
  defaultExpanded={false}
>
  <div className="grid grid-cols-2 gap-6 p-4">
    <Slider label="TONE" bipolar={true} />
    <Slider label="LOW CUT" logarithmic={true} />
    <Slider label="HIGH CUT" logarithmic={true} />
    {/* More controls... */}
  </div>
</ExpandablePanel>
```

**Props:**
- `title` - Panel title
- `icon` - Optional icon (emoji or component)
- `category` - Plugin category for theming
- `defaultExpanded` - Initial state (default: false)
- `expanded` - Controlled expanded state (optional)
- `onExpandedChange` - Callback when expanded state changes
- `children` - Panel content

---

### Meter

**When to use:** Audio level visualization, metering

```javascript
<Meter
  label="INPUT"
  value={inputLevel}                   // 0-1 range
  peakValue={peakLevel}
  category="texture-lab"
  orientation="vertical"
  width={20}
  height={120}
  showPeak={true}
/>
```

**Props:**
- `label` - Meter label (optional)
- `value` - Current level (0-1)
- `peakValue` - Peak level (0-1, optional)
- `category` - Plugin category for theming
- `orientation` - 'horizontal' | 'vertical'
- `width` - Width in pixels
- `height` - Height in pixels
- `showPeak` - Show peak indicator (default: true)
- `peakHoldTime` - Peak hold duration in ms (default: 1000)

---

## 🎨 Layout Templates

### Template 1: Simple (1-3 Controls)

```javascript
<div className="p-6 flex items-center justify-center gap-12">
  <Knob label="DRIVE" category="texture-lab" />
  <div className="h-24 w-px bg-gradient-to-b from-transparent via-[#FF6B35]/30 to-transparent" />
  <Knob label="MIX" category="texture-lab" />
</div>
```

---

### Template 2: Standard (Mode Selector + Controls)

```javascript
<div className="w-full h-full flex gap-4 p-4">
  {/* Left: Mode Selection */}
  <div className="w-[240px]">
    <ModeSelector
      modes={modes}
      activeMode={selectedMode}
      onChange={handleModeChange}
      orientation="vertical"
      category="texture-lab"
    />
  </div>

  {/* Center: Main Controls */}
  <div className="flex-1 flex flex-col gap-4">
    <div className="flex gap-8">
      <Knob label="PARAM1" category="texture-lab" />
      <Knob label="PARAM2" category="texture-lab" />
    </div>

    {/* Advanced Settings */}
    <ExpandablePanel title="Advanced" category="texture-lab">
      {/* More controls */}
    </ExpandablePanel>
  </div>

  {/* Right: Stats */}
  <div className="w-[200px]">
    {/* Info panel */}
  </div>
</div>
```

---

### Template 3: Complex (Visualizer + Controls)

```javascript
<div className="w-full h-full flex gap-4 p-4">
  {/* Left: Mode Selection */}
  <div className="w-[240px] flex flex-col gap-4">
    <div className="bg-gradient-to-r from-[#2d1810] to-[#1a1a1a] rounded-xl px-4 py-3 border border-[#FF6B35]/30">
      <div className="text-sm font-black text-[#FF6B35]">Plugin Name</div>
      <div className="text-[9px] text-[#F7931E]/70">Category Name</div>
    </div>

    <ModeSelector
      modes={modes}
      activeMode={selectedMode}
      onChange={handleModeChange}
      orientation="vertical"
      category="texture-lab"
    />
  </div>

  {/* Center: Visualizer + Controls */}
  <div className="flex-1 flex flex-col gap-4">
    {/* Visualizer */}
    <div className="flex-1">
      <YourVisualizerComponent />
    </div>

    {/* Main Controls */}
    <div className="bg-gradient-to-br from-black/50 to-[#2d1810]/30 rounded-xl p-6 border border-[#FF6B35]/20">
      <div className="flex gap-12">
        <Knob label="DRIVE" sizeVariant="large" category="texture-lab" />
        <Knob label="MIX" sizeVariant="large" category="texture-lab" />
      </div>
    </div>

    {/* Advanced Settings */}
    <ExpandablePanel title="Advanced Settings" category="texture-lab">
      <div className="grid grid-cols-2 gap-6 p-4">
        <Slider label="TONE" bipolar={true} category="texture-lab" />
        <Slider label="FREQ" logarithmic={true} category="texture-lab" />
      </div>
    </ExpandablePanel>
  </div>

  {/* Right: Stats */}
  <div className="w-[200px] flex flex-col gap-4">
    <div className="bg-gradient-to-br from-black/50 to-[#2d1810]/30 rounded-xl p-4 border border-[#FF6B35]/10">
      <div className="text-[9px] text-[#FFC857]/70 uppercase mb-3">Processing</div>
      {/* Stats */}
    </div>
  </div>
</div>
```

---

## 💡 Common Patterns

### Ghost Values Pattern

```javascript
// 1. Create ghost values
const ghostDrive = useGhostValue(drive, 400);
const ghostMix = useGhostValue(mix, 400);
const ghostTone = useGhostValue(tone, 400);

// 2. Pass to components
<Knob value={drive} ghostValue={ghostDrive} />
<Slider value={tone} ghostValue={ghostTone} />
```

**Why 400ms?** Good balance between responsive and smooth visual lag.

---

### Mode-Based Presets Pattern

```javascript
const modes = [
  { id: 'gentle', label: 'Gentle', icon: '✨', description: 'Subtle effect' },
  { id: 'medium', label: 'Medium', icon: '🔥', description: 'Balanced' },
  { id: 'aggressive', label: 'Aggressive', icon: '⚡', description: 'Heavy' },
];

const handleModeChange = (modeId) => {
  setSelectedMode(modeId);
  const params = getModeParameters(modeId);

  // Apply all parameters
  onChange('drive', params.drive);
  onChange('mix', params.mix);
  onChange('tone', params.tone);
  // ... more
};

<ModeSelector
  modes={modes}
  activeMode={selectedMode}
  onChange={handleModeChange}
  category="texture-lab"
/>
```

---

### Progressive Disclosure Pattern

```javascript
// Simple interface by default
<div>
  <Knob label="DRIVE" />
  <Knob label="MIX" />
</div>

// Advanced settings hidden in panel
<ExpandablePanel title="Advanced Settings" defaultExpanded={false}>
  <Slider label="TONE" bipolar={true} />
  <Slider label="LOW CUT" logarithmic={true} />
  <Slider label="HIGH CUT" logarithmic={true} />
  {/* ... 4-7 more controls */}
</ExpandablePanel>
```

**Benefits:**
- Beginners see simple interface
- Advanced users get full control
- Reduces cognitive load

---

### Bipolar Control Pattern

```javascript
// For parameters that go negative/positive
<Slider
  label="TONE"
  value={tone}                         // -10 to +10
  min={-10}
  max={10}
  defaultValue={0}
  bipolar={true}                       // Fill from center
  centerDetent={true}                  // Snap to 0
  valueFormatter={(v) => {
    if (v > 0) return `+${v.toFixed(1)}`;
    if (v < 0) return `${v.toFixed(1)}`;
    return '0';
  }}
/>
```

**Use cases:**
- Tone controls (bright/dark)
- Pan controls (left/right)
- Attack/Sustain controls (shorter/longer)
- Tilt EQ controls

---

### Logarithmic Control Pattern

```javascript
// For frequency controls
<Slider
  label="FREQUENCY"
  value={freq}
  min={20}
  max={20000}
  logarithmic={true}
  showTicks={true}
  tickValues={[20, 100, 1000, 10000, 20000]}
  valueFormatter={(v) => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)} kHz`;
    return `${v.toFixed(0)} Hz`;
  }}
/>
```

**Use cases:**
- Frequency controls (20Hz - 20kHz)
- Time controls (1ms - 10s)
- Q/Resonance controls (0.1 - 100)

---

## 🎨 Category Colors

### Category Color Reference

```javascript
// Texture Lab (Saturation/Distortion)
category="texture-lab"
// Primary: #FF6B35 (Orange)
// Use for: Saturator, Distortion, LoFi, Tape

// Dynamics Forge (Compression/Dynamics)
category="dynamics-forge"
// Primary: #00A8E8 (Blue)
// Use for: Compressor, TransientDesigner, Gate, Limiter

// Spectral Weave (EQ/Filter)
category="spectral-weave"
// Primary: #9B59B6 (Purple)
// Use for: EQ, Filter, Analyzer

// Modulation Machines (Modulation)
category="modulation-machines"
// Primary: #2ECC71 (Green)
// Use for: Chorus, Phaser, Flanger, Tremolo

// Spacetime Chamber (Reverb/Delay)
category="spacetime-chamber"
// Primary: #E74C3C (Red)
// Use for: Reverb, Delay, Echo
```

---

## ✅ Redesign Checklist

When redesigning a plugin, follow this checklist:

### Phase 1: Planning
- [ ] Identify plugin category (texture-lab, dynamics-forge, etc.)
- [ ] List all parameters (main + advanced)
- [ ] Decide which controls need ghost values
- [ ] Identify bipolar parameters (tone, pan, etc.)
- [ ] Identify logarithmic parameters (freq, time, etc.)
- [ ] Plan mode presets (if applicable)

### Phase 2: Layout
- [ ] Choose layout template (simple/standard/complex)
- [ ] Plan left panel (mode selector or info)
- [ ] Plan center panel (visualizer + controls)
- [ ] Plan right panel (stats or metering)
- [ ] Decide which settings go in ExpandablePanel

### Phase 3: Implementation
- [ ] Import components
- [ ] Set up ghost values
- [ ] Implement main controls (Knob/Slider)
- [ ] Implement mode selector (if applicable)
- [ ] Implement advanced settings panel
- [ ] Apply category theming
- [ ] Add value formatters

### Phase 4: Polish
- [ ] Test all controls
- [ ] Test keyboard navigation
- [ ] Test mode presets
- [ ] Check category theming consistency
- [ ] Verify ghost values work
- [ ] Test expandable panel

### Phase 5: Documentation
- [ ] Update plugin README
- [ ] Add usage examples
- [ ] Document mode presets
- [ ] Add screenshots (optional)

---

## 📝 Example: Compressor Redesign

Here's a quick example of redesigning a Compressor:

```javascript
import { Knob, Slider, Meter, ModeSelector, ExpandablePanel } from '@/components/controls';
import { useGhostValue } from '@/hooks/useAudioPlugin';

export const CompressorUI = ({ trackId, effect, onChange }) => {
  const { threshold, ratio, attack, release, makeupGain, mix } = effect.settings;

  // Ghost values
  const ghostThreshold = useGhostValue(threshold, 400);
  const ghostRatio = useGhostValue(ratio, 400);

  // Modes
  const modes = [
    { id: 'gentle', label: 'Gentle', icon: '✨', description: 'Transparent compression' },
    { id: 'medium', label: 'Medium', icon: '🔵', description: 'Balanced control' },
    { id: 'aggressive', label: 'Aggressive', icon: '⚡', description: 'Heavy compression' },
    { id: 'brickwall', label: 'Brick Wall', icon: '🧱', description: 'Maximum limiting' },
  ];

  return (
    <div className="w-full h-full flex gap-4 p-4">
      {/* Left: Mode Selection */}
      <div className="w-[240px]">
        <ModeSelector
          modes={modes}
          activeMode={selectedMode}
          onChange={handleModeChange}
          orientation="vertical"
          category="dynamics-forge"
        />
      </div>

      {/* Center: Controls */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex gap-8">
          <Knob
            label="THRESHOLD"
            value={threshold}
            ghostValue={ghostThreshold}
            min={-60}
            max={0}
            sizeVariant="large"
            category="dynamics-forge"
            valueFormatter={(v) => `${v.toFixed(1)} dB`}
          />

          <Knob
            label="RATIO"
            value={ratio}
            ghostValue={ghostRatio}
            min={1}
            max={20}
            sizeVariant="large"
            category="dynamics-forge"
            valueFormatter={(v) => `${v.toFixed(1)}:1`}
          />
        </div>

        <ExpandablePanel title="Advanced Settings" category="dynamics-forge">
          <div className="grid grid-cols-2 gap-6 p-4">
            <Slider
              label="ATTACK"
              value={attack}
              min={0.1}
              max={100}
              logarithmic={true}
              category="dynamics-forge"
              valueFormatter={(v) => `${v.toFixed(1)} ms`}
            />

            <Slider
              label="RELEASE"
              value={release}
              min={10}
              max={1000}
              logarithmic={true}
              category="dynamics-forge"
              valueFormatter={(v) => `${v.toFixed(0)} ms`}
            />
          </div>
        </ExpandablePanel>
      </div>

      {/* Right: Metering */}
      <div className="w-[100px] flex gap-2">
        <Meter label="IN" value={inputLevel} category="dynamics-forge" />
        <Meter label="GR" value={gainReduction} category="dynamics-forge" />
        <Meter label="OUT" value={outputLevel} category="dynamics-forge" />
      </div>
    </div>
  );
};
```

**Estimated Time:** 1.5 hours (based on Saturator experience)

---

## 🚀 Ready to Start?

1. Pick a plugin to redesign
2. Follow the checklist above
3. Use Saturator v2.0 as reference ([SaturatorUI.jsx](../client/src/components/plugins/effects/SaturatorUI.jsx))
4. Refer to this guide for component usage
5. Test thoroughly
6. Document your work

**Good luck!** 🎉

---

*This guide is based on the successful Saturator v2.0 redesign. For detailed examples, see [SATURATOR_V2_COMPLETE.md](SATURATOR_V2_COMPLETE.md).*

**Last Updated:** 2025-10-10
