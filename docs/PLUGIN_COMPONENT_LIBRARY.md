# 🎨 DAWG Plugin Component Library
**Shared UI Components for Plugin Ecosystem**

**Date:** 2025-10-09
**Version:** 1.0.0
**Status:** 🏗️ Specification Phase

---

## 📖 Overview

Bu doküman, tüm DAWG pluginlerinde kullanılacak **paylaşımlı UI component kütüphanesini** tanımlar. Her component, [PLUGIN_DESIGN_PHILOSOPHY.md](./PLUGIN_DESIGN_PHILOSOPHY.md) ve [PLUGIN_DESIGN_THEMES.md](./PLUGIN_DESIGN_THEMES.md) prensipleriyle uyumludur.

### Design Goals

1. **Consistency** - Tüm pluginlerde aynı look & feel
2. **Reusability** - DRY principle, zero duplication
3. **Performance** - 60fps animations, optimized rendering
4. **Accessibility** - Keyboard nav, screen reader support
5. **Theming** - Category-based color palettes

---

## 🎛️ Component Catalog

### 1. ProfessionalKnob v2
**Purpose:** Rotary control for continuous parameters

#### Visual Specification
```
     ╭─────────╮
    ╱   DRIVE   ╲     ← Label (11px, uppercase)
   │             │
   │     ◉       │    ← Indicator dot
   │   ╱   ╲     │    ← Value arc
   │  ╱     ╰    │
   │             │
    ╲    40%    ╱     ← Value display (13px, mono)
     ╰─────────╯

Size: 80x100px (default)
Sizes: Small (60x80), Medium (80x100), Large (100x120)
```

#### Props
```typescript
interface ProfessionalKnobProps {
  label: string;                    // Parameter name
  value: number;                    // Current value (0-1)
  defaultValue?: number;            // Default (for double-click reset)
  min?: number;                     // Min value (default: 0)
  max?: number;                     // Max value (default: 1)
  step?: number;                    // Step size (default: 0.01)
  unit?: string;                    // Display unit ('%', 'dB', 'Hz', 'ms')
  precision?: number;               // Decimal places (default: 0)
  curve?: 'linear' | 'log' | 'exp'; // Response curve
  size?: 'small' | 'medium' | 'large';
  color?: string;                   // Theme color (from category palette)
  onChange: (value: number) => void;
  onChangeEnd?: () => void;         // For automation recording
  disabled?: boolean;
  showValue?: boolean;              // Show numeric value (default: true)
  valueFormatter?: (v: number) => string; // Custom formatting
}
```

#### Interaction Patterns
- **Drag:** Vertical drag to change value (100px = full range)
- **Shift+Drag:** Fine control (10x precision)
- **Double-Click:** Reset to default
- **Scroll:** Mouse wheel (with shift for fine)
- **Keyboard:** Up/Down arrows when focused

#### Ghost Value Integration
```jsx
import { useGhostValue } from '@/hooks/useAudioPlugin';

function SaturatorUI({ settings, onChange }) {
  const { drive } = settings;
  const ghostDrive = useGhostValue(drive, 400);

  return (
    <ProfessionalKnob
      label="DRIVE"
      value={drive}
      ghostValue={ghostDrive}  // Shows delayed visual feedback
      onChange={(v) => onChange('drive', v)}
      unit="%"
      color="#FF6B35"
    />
  );
}
```

#### CSS Variables
```css
.professional-knob {
  --knob-size: 80px;
  --knob-track-width: 4px;
  --knob-track-color: rgba(255, 255, 255, 0.1);
  --knob-fill-color: var(--theme-primary);
  --knob-indicator-size: 8px;
  --knob-label-color: rgba(255, 255, 255, 0.6);
  --knob-value-color: rgba(255, 255, 255, 0.9);
  --knob-hover-scale: 1.05;
  --knob-active-scale: 0.98;
}
```

---

### 2. LinearSlider
**Purpose:** Horizontal/vertical fader for linear parameters

#### Visual Specification
```
Horizontal:
FILTER FREQ          8000 Hz
├───────────●───────────────┤
20Hz                    20kHz

Vertical:
    ┌───┐
    │   │  +12dB
    │   │
    │ ● │  0dB
    │   │
    │   │  -12dB
    └───┘
   GAIN
```

#### Props
```typescript
interface LinearSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  orientation?: 'horizontal' | 'vertical';
  width?: number;              // For horizontal
  height?: number;             // For vertical
  color?: string;
  showTicks?: boolean;         // Show tick marks
  tickValues?: number[];       // Custom tick positions
  bipolar?: boolean;           // Center at 0 (for +/- controls)
  logarithmic?: boolean;       // Log scale (for frequency)
  onChange: (value: number) => void;
  disabled?: boolean;
}
```

#### Use Cases
- **Frequency Controls:** Logarithmic scale (20Hz - 20kHz)
- **Bipolar Controls:** Attack/Sustain (-50% to +50%)
- **Mix Controls:** Linear (0-100%)
- **Gain Controls:** dB scale with center detent at 0dB

---

### 3. ModeSelector
**Purpose:** Segmented button group for discrete mode selection

#### Visual Specification
```
┌─────────┬─────────┬─────────┬─────────┐
│ TOASTY  │ CRUNCHY │ DISTRESS│ CUSTOM  │
└─────────┴─────────┴─────────┴─────────┘
   ████ (active indicator)

Variants:
- Horizontal (default)
- Vertical (for sidebars)
- Compact (icon-only)
```

#### Props
```typescript
interface ModeSelectorProps {
  modes: Array<{
    id: string;
    label: string;
    icon?: React.ReactNode;
    description?: string;      // Tooltip text
    color?: string;            // Override theme color
  }>;
  activeMode: string;
  onChange: (modeId: string) => void;
  orientation?: 'horizontal' | 'vertical';
  compact?: boolean;           // Icon-only mode
  color?: string;              // Theme color
  allowDeselect?: boolean;     // Allow no selection
}
```

#### Interaction
- **Click:** Select mode
- **Keyboard:** Arrow keys to navigate, Enter to select
- **Hover:** Show description tooltip
- **Animation:** Smooth slide of active indicator

---

### 4. Meter
**Purpose:** Visual feedback for levels, gain reduction, etc.

#### Variants

##### 4a. VU Meter (Analog-style)
```
  ┌────────────────────────────────────┐
  │   -20  -10   -5   0   +3  +6      │
  │   ░░░░░▓▓▓▓▓▓▓▓▓████              │
  │                  ↑ peak hold       │
  └────────────────────────────────────┘
```

##### 4b. LED Meter (Digital-style)
```
  ┌───┐
  │▓▓▓│  +6dB  (red)
  │▓▓▓│  +3dB  (yellow)
  │▓▓▓│  0dB
  │▓▓▓│  -6dB  (green)
  │░░░│  -12dB
  │░░░│  -18dB
  └───┘
```

##### 4c. Circular Meter (for knobs)
```
     ╭─────╮
    ╱ ▓▓▓   ╲
   │ ▓▓▓▓    │
   │  ▓▓     │
    ╲       ╱
     ╰─────╯
  (Surrounds knob)
```

##### 4d. Histogram (for GR over time)
```
  ┌────────────────────────────────────┐
  │  ▓▓▓▒▒▒▒░░░                       │
  │  GR: -6dB (current)                │
  └────────────────────────────────────┘
```

#### Props
```typescript
interface MeterProps {
  type: 'vu' | 'led' | 'circular' | 'histogram';
  value: number;              // Current level (0-1 or dB)
  peakValue?: number;         // Peak hold value
  peakHoldTime?: number;      // Peak hold duration (ms)
  min?: number;               // Min dB
  max?: number;               // Max dB
  unit?: 'linear' | 'db';
  orientation?: 'horizontal' | 'vertical';
  color?: string;             // Theme color
  warningThreshold?: number;  // Yellow zone start
  dangerThreshold?: number;   // Red zone start
  showScale?: boolean;        // Show dB labels
  width?: number;
  height?: number;
}
```

---

### 5. CanvasVisualizer
**Purpose:** Audio-reactive canvas visualization

#### Base Component
```jsx
import { useCanvasVisualization } from '@/hooks/useAudioPlugin';

function MyVisualizer({ frequency, depth, wet }) {
  const drawVisualization = useCallback((ctx, width, height) => {
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw visualization
    ctx.fillStyle = '#FF6B35';
    // ... drawing logic
  }, [frequency, depth, wet]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawVisualization,
    [frequency, depth, wet],
    { noLoop: false }  // Set to true for static visualizations
  );

  return (
    <div ref={containerRef} className="visualizer-container">
      <canvas ref={canvasRef} />
    </div>
  );
}
```

#### Common Visualization Patterns

##### Pattern A: Waveform Display
```javascript
// Real-time audio waveform
const drawWaveform = useCallback((ctx, width, height) => {
  const analyser = getAnalyser(); // From useAudioPlugin
  const buffer = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(buffer);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let i = 0; i < buffer.length; i++) {
    const x = (i / buffer.length) * width;
    const y = (buffer[i] / 255) * height;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }

  ctx.stroke();
}, [color]);
```

##### Pattern B: Spectrum Analyzer
```javascript
// Frequency spectrum bars
const drawSpectrum = useCallback((ctx, width, height) => {
  const analyser = getAnalyser();
  const buffer = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(buffer);

  const barWidth = width / buffer.length;

  for (let i = 0; i < buffer.length; i++) {
    const barHeight = (buffer[i] / 255) * height;
    const x = i * barWidth;
    const y = height - barHeight;

    ctx.fillStyle = getColorForFrequency(i);
    ctx.fillRect(x, y, barWidth - 1, barHeight);
  }
}, []);
```

##### Pattern C: Particle System
```javascript
// Animated particles (StardustChorus style)
const particlesRef = useRef([]);

const drawParticles = useCallback((ctx, width, height) => {
  const time = Date.now();

  // Spawn new particles based on LFO
  if (Math.random() < rate * 0.1) {
    particlesRef.current.push(new Particle(width, height));
  }

  // Update and draw particles
  ctx.clearRect(0, 0, width, height);
  particlesRef.current = particlesRef.current.filter(p => {
    p.update(time, depth);
    p.draw(ctx);
    return p.life > 0;
  });
}, [rate, depth]);
```

---

### 6. Toggle Switch
**Purpose:** On/off boolean controls

#### Visual Specification
```
OFF:  ○───   ON:  ───●
      ╰───╯        ╰───╯
     (gray)       (theme color)
```

#### Props
```typescript
interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  color?: string;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}
```

---

### 7. PresetBrowser
**Purpose:** Preset management UI

#### Visual Specification
```
┌─────────────────────────────────────┐
│  PRESETS                      [×]   │
├─────────────────────────────────────┤
│  FACTORY                            │
│    ▸ Vocal Warmth                   │
│    ▸ Bass Power              [★]    │
│    ▸ Mastering Glue                 │
│                                      │
│  USER                               │
│    ▸ My Mix Setting          [★]    │
│    ▸ Drum Bus Magic                 │
│                                      │
│  [SAVE AS...] [DELETE] [EXPORT]     │
└─────────────────────────────────────┘
```

#### Props
```typescript
interface PresetBrowserProps {
  presets: Array<{
    id: string;
    name: string;
    category: 'factory' | 'user';
    favorite?: boolean;
    settings: Record<string, any>;
  }>;
  currentPreset?: string;
  onLoad: (presetId: string) => void;
  onSave: (name: string, settings: any) => void;
  onDelete: (presetId: string) => void;
  onFavorite: (presetId: string) => void;
  onClose: () => void;
}
```

---

### 8. ExpandablePanel
**Purpose:** Progressive disclosure for advanced parameters

#### Visual Specification
```
Collapsed:
┌─────────────────────────────────────┐
│  ADVANCED SETTINGS           [▾]    │
└─────────────────────────────────────┘

Expanded:
┌─────────────────────────────────────┐
│  ADVANCED SETTINGS           [▴]    │
├─────────────────────────────────────┤
│  LOW CUT:   ├──●──┤  80Hz          │
│  HIGH CUT:  ├─────●┤  OFF           │
│  HEADROOM:  ├──●──┤  0dB           │
└─────────────────────────────────────┘
```

#### Props
```typescript
interface ExpandablePanelProps {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  color?: string;
  icon?: React.ReactNode;
}
```

---

### 9. ValueDisplay
**Purpose:** Large numeric display for key parameters

#### Visual Specification
```
┌────────────────────┐
│   THRESHOLD        │
│                    │
│     -24.0 dB       │  ← Large, monospace
│                    │
└────────────────────┘
```

#### Props
```typescript
interface ValueDisplayProps {
  label: string;
  value: number;
  unit: string;
  precision?: number;
  color?: string;
  size?: 'small' | 'medium' | 'large';
}
```

---

## 🎨 Theming System

### Category Color Palettes
```javascript
// client/src/styles/pluginThemes.js

export const PLUGIN_THEMES = {
  'texture-lab': {
    primary: '#FF6B35',
    secondary: '#F7931E',
    accent: '#FFC857',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d1810 100%)',
  },
  'dynamics-forge': {
    primary: '#00A8E8',
    secondary: '#007EA7',
    accent: '#00D9FF',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #0a1a2d 100%)',
  },
  'spectral-weave': {
    primary: '#9B59B6',
    secondary: '#8E44AD',
    accent: '#C39BD3',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #1a0a2d 100%)',
  },
  'modulation-machines': {
    primary: '#2ECC71',
    secondary: '#27AE60',
    accent: '#58D68D',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #0a2d1a 100%)',
  },
  'spacetime-chamber': {
    primary: '#E74C3C',
    secondary: '#C0392B',
    accent: '#EC7063',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d0a0a 100%)',
  }
};
```

### ThemeProvider Usage
```jsx
import { ThemeProvider } from '@/components/shared/ThemeProvider';

function SaturatorUI({ settings, onChange }) {
  return (
    <ThemeProvider theme="texture-lab">
      <div className="plugin-container">
        <ProfessionalKnob
          label="DRIVE"
          value={settings.drive}
          onChange={(v) => onChange('drive', v)}
          // Automatically uses theme colors
        />
      </div>
    </ThemeProvider>
  );
}
```

---

## 🏗️ Component Architecture

### File Structure
```
client/src/components/
├── shared/
│   ├── controls/
│   │   ├── ProfessionalKnob.jsx
│   │   ├── LinearSlider.jsx
│   │   ├── ModeSelector.jsx
│   │   ├── ToggleSwitch.jsx
│   │   └── ValueDisplay.jsx
│   ├── meters/
│   │   ├── VUMeter.jsx
│   │   ├── LEDMeter.jsx
│   │   ├── CircularMeter.jsx
│   │   └── HistogramMeter.jsx
│   ├── visualizers/
│   │   ├── CanvasVisualizer.jsx
│   │   ├── WaveformVisualizer.jsx
│   │   ├── SpectrumVisualizer.jsx
│   │   └── ParticleVisualizer.jsx
│   ├── layout/
│   │   ├── PluginContainer.jsx
│   │   ├── ExpandablePanel.jsx
│   │   └── ControlGroup.jsx
│   ├── presets/
│   │   ├── PresetBrowser.jsx
│   │   └── PresetButton.jsx
│   └── theme/
│       ├── ThemeProvider.jsx
│       └── useTheme.js
└── plugins/
    └── effects/
        ├── SaturatorUI.jsx
        ├── CompressorUI.jsx
        └── ... (uses shared components)
```

### Import Pattern
```jsx
// Clean imports from shared library
import {
  ProfessionalKnob,
  LinearSlider,
  ModeSelector,
  VUMeter,
  CanvasVisualizer,
  ThemeProvider
} from '@/components/shared';
```

---

## 📐 Layout Patterns

### Standard Plugin Layout
```jsx
<ThemeProvider theme="texture-lab">
  <PluginContainer title="SATURATOR">
    {/* Header */}
    <PluginHeader>
      <PresetButton />
      <HelpButton />
    </PluginHeader>

    {/* Main Visualization */}
    <VisualizationArea>
      <CanvasVisualizer {...vizProps} />
    </VisualizationArea>

    {/* Primary Controls */}
    <ControlGroup label="MAIN">
      <ProfessionalKnob label="DRIVE" {...driveProps} />
      <ProfessionalKnob label="MIX" {...mixProps} />
    </ControlGroup>

    {/* Mode Selection */}
    <ModeSelector modes={modes} activeMode={mode} />

    {/* Secondary Controls */}
    <ControlGroup label="TONE">
      <LinearSlider label="TONE" {...toneProps} />
    </ControlGroup>

    {/* Advanced Panel */}
    <ExpandablePanel title="ADVANCED">
      <LinearSlider label="LOW CUT" {...lowCutProps} />
      <LinearSlider label="HIGH CUT" {...highCutProps} />
      <ToggleSwitch label="AUTO GAIN" {...autoGainProps} />
    </ExpandablePanel>

    {/* Metering */}
    <MeterGroup>
      <VUMeter label="INPUT" {...inputMeterProps} />
      <VUMeter label="OUTPUT" {...outputMeterProps} />
      <ValueDisplay label="THD" value={thd} unit="%" />
    </MeterGroup>
  </PluginContainer>
</ThemeProvider>
```

---

## 🎯 Component Development Checklist

### For Each Component

#### 1. Specification Phase
- [ ] Define props interface (TypeScript)
- [ ] Design visual appearance (ASCII mockup)
- [ ] Document interaction patterns
- [ ] Identify accessibility requirements

#### 2. Implementation Phase
- [ ] Create React component
- [ ] Add prop validation
- [ ] Implement event handlers
- [ ] Add keyboard navigation
- [ ] Implement theme support

#### 3. Styling Phase
- [ ] Create CSS module / styled-component
- [ ] Use CSS variables for theming
- [ ] Add hover/active/disabled states
- [ ] Ensure responsive behavior

#### 4. Testing Phase
- [ ] Unit tests (Jest)
- [ ] Interaction tests (Testing Library)
- [ ] Visual regression tests (Chromatic)
- [ ] Accessibility audit (aXe)

#### 5. Documentation Phase
- [ ] Add JSDoc comments
- [ ] Create Storybook story
- [ ] Write usage examples
- [ ] Document edge cases

---

## 🚀 Implementation Roadmap

### Week 1: Foundation Components
**Priority: High**
- [x] ProfessionalKnob v2
- [x] LinearSlider
- [x] ModeSelector
- [x] ThemeProvider

### Week 2: Meters & Displays
**Priority: High**
- [ ] VUMeter
- [ ] LEDMeter
- [ ] CircularMeter
- [ ] ValueDisplay

### Week 3: Advanced Components
**Priority: Medium**
- [ ] CanvasVisualizer (wrapper)
- [ ] PresetBrowser
- [ ] ExpandablePanel
- [ ] ControlGroup

### Week 4: Specialized Visualizers
**Priority: Medium**
- [ ] WaveformVisualizer
- [ ] SpectrumVisualizer
- [ ] ParticleVisualizer
- [ ] EnvelopeVisualizer

### Week 5: Polish & Testing
**Priority: High**
- [ ] Accessibility improvements
- [ ] Performance optimization
- [ ] Storybook documentation
- [ ] Component library export

---

## 📊 Success Metrics

### Code Quality
- [ ] 100% TypeScript coverage
- [ ] 90%+ test coverage
- [ ] Zero prop-types warnings
- [ ] A11y audit score: 100%

### Performance
- [ ] Knob drag: < 16ms per frame
- [ ] Meter update: < 8ms per frame
- [ ] Canvas draw: < 16ms per frame
- [ ] Bundle size: < 150KB gzipped

### Developer Experience
- [ ] < 5 lines to use any component
- [ ] Clear prop documentation
- [ ] Helpful error messages
- [ ] Storybook examples for all components

---

## 💡 Advanced Patterns

### 1. Compound Components
```jsx
<ControlGroup>
  <ControlGroup.Header>DYNAMICS</ControlGroup.Header>
  <ControlGroup.Row>
    <ProfessionalKnob label="THRESHOLD" {...props} />
    <ProfessionalKnob label="RATIO" {...props} />
  </ControlGroup.Row>
</ControlGroup>
```

### 2. Render Props
```jsx
<PresetBrowser>
  {({ presets, loadPreset }) => (
    <CustomPresetUI
      presets={presets}
      onSelect={loadPreset}
    />
  )}
</PresetBrowser>
```

### 3. Custom Hooks
```jsx
// useKnobGesture.js - Shared gesture handling
function useKnobGesture(onChange, sensitivity = 1) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((deltaY, shiftKey) => {
    const precision = shiftKey ? 0.1 : 1;
    const delta = -deltaY * sensitivity * precision / 100;
    onChange(delta);
  }, [onChange, sensitivity]);

  return { isDragging, handleDrag };
}
```

---

## 🎓 Learning Resources

### React Patterns
- Compound Components pattern
- Render Props pattern
- Custom Hooks for reusability

### Animation
- Framer Motion for declarative animations
- React Spring for physics-based motion
- CSS transitions for simple cases

### Accessibility
- WAI-ARIA authoring practices
- Keyboard navigation patterns
- Screen reader testing

---

*Bu doküman, DAWG plugin ekosisteminin paylaşımlı UI component kütüphanesini tanımlar.*

**Last Updated:** 2025-10-09
**Version:** 1.0.0
**Status:** 🏗️ Ready for Development
