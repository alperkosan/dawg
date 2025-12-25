# ✨ ZENITH - DAWG Design System

> **"Where Audio Engineering Meets Visual Excellence"**

*Zenith is DAWG's design language - a unified visual and interaction system that makes professional audio production intuitive, beautiful, and efficient.*

---

## 🎨 Philosophy

### Core Principles

```
1. CLARITY OVER DECORATION
   → Every pixel serves a purpose

2. AUDIO-FIRST FEEDBACK
   → Visual elements respond to sound

3. PROFESSIONAL DEPTH
   → Power users aren't limited

4. INSTANT COMPREHENSION
   → No learning curve for basics

5. PERFORMANCE CONSCIOUS
   → 60fps is non-negotiable
```

### Design Mantras

| Mantra | Meaning | Example |
|--------|---------|---------|
| **"Show, don't tell"** | Visual feedback > text labels | Gain reduction shows via meter animation |
| **"Touch the sound"** | Direct manipulation > menus | Drag frequency points, not type numbers |
| **"Consistent surprise"** | Predictable patterns, delightful details | Knobs work same everywhere, but each has unique character |
| **"Data density"** | Information-rich, not cluttered | Spectrum + waveform + meters in one view |

---

## 🎨 Color System

### Primary Palette: "Audio Spectrum"

```css
/* Base Colors - Inspired by Analog Gear */
--zenith-bg-primary: #0A0E1A;        /* Deep midnight - main canvas */
--zenith-bg-secondary: #151922;      /* Darker charcoal - panels */
--zenith-bg-tertiary: #1E242F;       /* Slate - cards */

/* Accent Colors - Signal Flow */
--zenith-accent-hot: #FF6B35;        /* Hot signal - peak warnings */
--zenith-accent-warm: #FFB627;       /* Warm signal - optimal range */
--zenith-accent-cool: #4ECDC4;       /* Cool signal - low activity */
--zenith-accent-cold: #556FB5;       /* Cold signal - silence */

/* Semantic Colors */
--zenith-success: #10B981;           /* Green - confirmation */
--zenith-warning: #F59E0B;           /* Amber - caution */
--zenith-error: #EF4444;             /* Red - danger */
--zenith-info: #3B82F6;              /* Blue - information */

/* Plugin-Specific Palettes */
--saturator-primary: #FF8C00;        /* Orange - tube warmth */
--compressor-primary: #9333EA;       /* Purple - dynamic control */
--eq-primary: #06B6D4;               /* Cyan - frequency spectrum */
--reverb-primary: #8B5CF6;           /* Violet - spaciousness */
--delay-primary: #10B981;            /* Emerald - time-based */
```

### Text & UI Elements

```css
/* Text Hierarchy */
--zenith-text-primary: #FFFFFF;      /* Primary text */
--zenith-text-secondary: #A1A8B5;    /* Secondary text */
--zenith-text-tertiary: #6B7280;     /* Tertiary text / placeholders */
--zenith-text-disabled: #4B5563;     /* Disabled state */

/* Borders & Dividers */
--zenith-border-strong: rgba(255, 255, 255, 0.2);   /* Prominent dividers */
--zenith-border-medium: rgba(255, 255, 255, 0.1);   /* Standard borders */
--zenith-border-subtle: rgba(255, 255, 255, 0.05);  /* Subtle separators */

/* Overlays & Shadows */
--zenith-overlay-light: rgba(255, 255, 255, 0.05);  /* Hover states */
--zenith-overlay-medium: rgba(255, 255, 255, 0.1);  /* Active states */
--zenith-overlay-heavy: rgba(0, 0, 0, 0.5);         /* Modals backdrop */

--zenith-shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.3);
--zenith-shadow-md: 0 4px 8px rgba(0, 0, 0, 0.4);
--zenith-shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.5);
--zenith-shadow-xl: 0 16px 32px rgba(0, 0, 0, 0.6);
```

### Gradient System

```css
/* Background Gradients */
--zenith-gradient-dark: linear-gradient(135deg, #0A0E1A 0%, #151922 100%);
--zenith-gradient-panel: linear-gradient(180deg, #1E242F 0%, #151922 100%);

/* Plugin Header Gradients */
--saturator-gradient: linear-gradient(135deg, #FF8C00 0%, #FF6B35 100%);
--compressor-gradient: linear-gradient(135deg, #9333EA 0%, #7C3AED 100%);
--eq-gradient: linear-gradient(135deg, #06B6D4 0%, #0891B2 100%);

/* Meter Gradients */
--zenith-meter-safe: linear-gradient(90deg, #10B981 0%, #059669 100%);
--zenith-meter-caution: linear-gradient(90deg, #F59E0B 0%, #D97706 100%);
--zenith-meter-danger: linear-gradient(90deg, #EF4444 0%, #DC2626 100%);
```

---

## 🔤 Typography

### Font Stack

```css
/* Primary Font - UI Elements */
--zenith-font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;

/* Monospace Font - Numbers, Code */
--zenith-font-mono: 'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', monospace;

/* Display Font - Headers (optional) */
--zenith-font-display: 'Space Grotesk', 'Inter', sans-serif;
```

### Type Scale

```css
/* Font Sizes */
--zenith-text-xs: 0.625rem;      /* 10px - Labels, captions */
--zenith-text-sm: 0.75rem;       /* 12px - Secondary text */
--zenith-text-base: 0.875rem;    /* 14px - Body text */
--zenith-text-lg: 1rem;          /* 16px - Emphasis */
--zenith-text-xl: 1.25rem;       /* 20px - Headings */
--zenith-text-2xl: 1.5rem;       /* 24px - Large headings */
--zenith-text-3xl: 2rem;         /* 32px - Display */

/* Font Weights */
--zenith-weight-normal: 400;     /* Regular text */
--zenith-weight-medium: 500;     /* Slightly emphasized */
--zenith-weight-semibold: 600;   /* Headings */
--zenith-weight-bold: 700;       /* Strong emphasis */

/* Line Heights */
--zenith-leading-tight: 1.25;    /* Compact UI */
--zenith-leading-normal: 1.5;    /* Body text */
--zenith-leading-relaxed: 1.75;  /* Spacious reading */

/* Letter Spacing */
--zenith-tracking-tight: -0.025em;   /* Headings */
--zenith-tracking-normal: 0;         /* Body */
--zenith-tracking-wide: 0.025em;     /* Labels */
```

### Text Styles (Classes)

```css
/* Headings */
.zenith-h1 {
  font-size: var(--zenith-text-3xl);
  font-weight: var(--zenith-weight-bold);
  line-height: var(--zenith-leading-tight);
  letter-spacing: var(--zenith-tracking-tight);
}

.zenith-h2 {
  font-size: var(--zenith-text-2xl);
  font-weight: var(--zenith-weight-semibold);
  line-height: var(--zenith-leading-tight);
}

/* Body Text */
.zenith-body {
  font-size: var(--zenith-text-base);
  font-weight: var(--zenith-weight-normal);
  line-height: var(--zenith-leading-normal);
}

/* UI Labels */
.zenith-label {
  font-size: var(--zenith-text-xs);
  font-weight: var(--zenith-weight-medium);
  line-height: var(--zenith-leading-tight);
  letter-spacing: var(--zenith-tracking-wide);
  text-transform: uppercase;
  color: var(--zenith-text-secondary);
}

/* Numeric Values */
.zenith-value {
  font-family: var(--zenith-font-mono);
  font-size: var(--zenith-text-lg);
  font-weight: var(--zenith-weight-semibold);
  font-variant-numeric: tabular-nums;
}
```

---

## 📐 Spacing System

### Base Unit: 4px

```css
--zenith-space-0: 0;
--zenith-space-1: 0.25rem;    /* 4px */
--zenith-space-2: 0.5rem;     /* 8px */
--zenith-space-3: 0.75rem;    /* 12px */
--zenith-space-4: 1rem;       /* 16px */
--zenith-space-5: 1.25rem;    /* 20px */
--zenith-space-6: 1.5rem;     /* 24px */
--zenith-space-8: 2rem;       /* 32px */
--zenith-space-10: 2.5rem;    /* 40px */
--zenith-space-12: 3rem;      /* 48px */
--zenith-space-16: 4rem;      /* 64px */
--zenith-space-20: 5rem;      /* 80px */
```

### Component Spacing

```css
/* Padding */
--zenith-padding-control: var(--zenith-space-3);      /* Inside buttons, inputs */
--zenith-padding-panel: var(--zenith-space-4);        /* Panel content padding */
--zenith-padding-modal: var(--zenith-space-6);        /* Modal/dialog padding */

/* Gaps */
--zenith-gap-tight: var(--zenith-space-2);            /* Compact lists */
--zenith-gap-normal: var(--zenith-space-4);           /* Default spacing */
--zenith-gap-relaxed: var(--zenith-space-6);          /* Spacious layouts */

/* Border Radius */
--zenith-radius-sm: 0.25rem;      /* 4px - Buttons, tags */
--zenith-radius-md: 0.5rem;       /* 8px - Cards, inputs */
--zenith-radius-lg: 0.75rem;      /* 12px - Panels */
--zenith-radius-xl: 1rem;         /* 16px - Modals */
--zenith-radius-full: 9999px;     /* Circular elements */
```

---

## 🎛️ Component Library

### 1. Knob (ProfessionalKnob)

```jsx
<ProfessionalKnob
  label="Drive"
  value={0.5}
  min={0}
  max={1.5}
  defaultValue={0.4}
  unit="%"
  precision={2}
  size={80}
  color="var(--saturator-primary)"
  onChange={(value) => {}}
/>
```

**Visual Specs:**
- Size: 60px, 80px, 100px variants
- Track: 270° arc, 4px stroke
- Indicator: Line from center to edge
- Value: Centered text, monospace font
- Unit: Small text below value
- Hover: Glow effect (box-shadow)
- Active: Slightly enlarged (scale 1.05)

**Interaction:**
- Drag: Vertical mouse movement
- Sensitivity: 200px = full range
- Scroll: Fine adjustment (1% steps)
- Double-click: Reset to default
- Shift+drag: Fine mode (10x slower)

### 2. Slider (ZenithSlider)

```jsx
<ZenithSlider
  label="Mix"
  value={75}
  min={0}
  max={100}
  orientation="horizontal"
  showValue={true}
  showTicks={false}
/>
```

**Visual Specs:**
- Track height: 4px
- Handle size: 16px circle
- Track color: --zenith-border-medium
- Fill color: Plugin primary color
- Label: Above track, xs size

**States:**
- Default: Subtle border
- Hover: Handle grows (scale 1.2)
- Active: Track fill brightens
- Disabled: Opacity 0.5

### 3. Button (ZenithButton)

```jsx
<ZenithButton
  variant="primary" | "secondary" | "ghost"
  size="sm" | "md" | "lg"
  icon={<IconName />}
  disabled={false}
>
  Click me
</ZenithButton>
```

**Variants:**

```css
/* Primary - Call to action */
.zenith-btn-primary {
  background: linear-gradient(135deg, var(--zenith-accent-warm), var(--zenith-accent-hot));
  color: white;
  box-shadow: var(--zenith-shadow-md);
}

/* Secondary - Standard actions */
.zenith-btn-secondary {
  background: var(--zenith-bg-tertiary);
  border: 1px solid var(--zenith-border-medium);
  color: var(--zenith-text-primary);
}

/* Ghost - Subtle actions */
.zenith-btn-ghost {
  background: transparent;
  color: var(--zenith-text-secondary);
  hover:background: var(--zenith-overlay-light);
}
```

### 4. Toggle (ZenithToggle)

```jsx
<ZenithToggle
  label="Auto Gain"
  checked={true}
  onChange={(checked) => {}}
/>
```

**Visual Specs:**
- Track: 40x20px rounded pill
- Handle: 16x16px circle
- Transition: 200ms ease-out
- Checked color: --zenith-success
- Unchecked color: --zenith-border-medium

### 5. Meter (ZenithMeter)

```jsx
<ZenithMeter
  type="vu" | "peak" | "rms"
  value={-12} // dB
  range={[-60, 0]}
  orientation="vertical" | "horizontal"
  gradient="safe" | "caution" | "danger"
/>
```

**Visual Specs:**
- Width: 100% (horizontal) or 24px (vertical)
- Height: 24px (horizontal) or 100% (vertical)
- Background: --zenith-bg-secondary
- Gradient zones:
  - -60 to -18dB: Green (safe)
  - -18 to -6dB: Yellow (caution)
  - -6 to 0dB: Red (danger)
- Peak hold: White line, 500ms decay

### 6. Selector (ZenithSelector)

```jsx
<ZenithSelector
  options={[
    { id: 'tube', label: 'Tube', color: 'amber' },
    { id: 'tape', label: 'Tape', color: 'orange' }
  ]}
  value="tube"
  onChange={(id) => {}}
  layout="vertical" | "horizontal"
/>
```

**Visual Specs:**
- Option button: Padding 12px, border radius 8px
- Selected: Accent color border + background tint
- Unselected: Border subtle, text secondary
- Hover: Border brightens
- Layout: Flex with gap-2

### 7. Canvas (PluginCanvas)

```jsx
<PluginCanvas
  pluginId="saturator-viz"
  visualizerClass={TubeGlowVisualizer}
  audioNode={audioNode}
  params={{ drive: 0.5, mix: 1.0 }}
  priority="normal"
/>
```

**Visual Specs:**
- Background: Transparent or --zenith-bg-primary
- Border: Optional, --zenith-border-subtle
- Border radius: --zenith-radius-lg
- Padding: None (full canvas)
- Min height: 200px

---

## 🎬 Animation & Motion

### Timing Functions

```css
/* Easing Curves */
--zenith-ease-linear: linear;
--zenith-ease-in: cubic-bezier(0.4, 0, 1, 1);
--zenith-ease-out: cubic-bezier(0, 0, 0.2, 1);
--zenith-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

/* Custom Eases */
--zenith-ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--zenith-ease-smooth: cubic-bezier(0.25, 0.46, 0.45, 0.94);
```

### Duration Scale

```css
--zenith-duration-instant: 50ms;      /* Immediate feedback */
--zenith-duration-fast: 100ms;        /* Quick transitions */
--zenith-duration-normal: 200ms;      /* Standard animations */
--zenith-duration-slow: 300ms;        /* Deliberate motion */
--zenith-duration-slower: 500ms;      /* Emphasis */
```

### Motion Principles

| Action | Duration | Easing | Example |
|--------|----------|--------|---------|
| **Hover** | 100ms | ease-out | Button highlight |
| **Click** | 50ms | ease-in | Button press |
| **Enter** | 200ms | ease-out | Modal fade in |
| **Exit** | 150ms | ease-in | Modal fade out |
| **Transform** | 200ms | ease-in-out | Panel slide |
| **Value Change** | 300ms | smooth | Meter movement |

### Transition Patterns

```css
/* Standard Transition */
.zenith-transition {
  transition: all var(--zenith-duration-normal) var(--zenith-ease-in-out);
}

/* Specific Property Transitions */
.zenith-transition-colors {
  transition: background-color var(--zenith-duration-fast) var(--zenith-ease-out),
              border-color var(--zenith-duration-fast) var(--zenith-ease-out),
              color var(--zenith-duration-fast) var(--zenith-ease-out);
}

.zenith-transition-transform {
  transition: transform var(--zenith-duration-normal) var(--zenith-ease-smooth);
}

.zenith-transition-opacity {
  transition: opacity var(--zenith-duration-fast) var(--zenith-ease-out);
}
```

### Keyframe Animations

```css
/* Pulse - Draw attention */
@keyframes zenith-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Glow - Active state */
@keyframes zenith-glow {
  0%, 100% { box-shadow: 0 0 20px var(--zenith-accent-warm); }
  50% { box-shadow: 0 0 40px var(--zenith-accent-hot); }
}

/* Shimmer - Loading state */
@keyframes zenith-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Bounce - Success feedback */
@keyframes zenith-bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
```

---

## 🎨 Plugin-Specific Design Tokens

### Saturator

```css
:root[data-plugin="saturator"] {
  --plugin-primary: var(--saturator-primary);
  --plugin-gradient: var(--saturator-gradient);
  --plugin-glow: rgba(255, 140, 0, 0.5);

  /* Visual theme */
  --viz-background: radial-gradient(circle, rgba(255,140,0,0.1), transparent);
  --viz-accent: #FFB627;
  --viz-highlight: #FF6B35;
}
```

### Compressor

```css
:root[data-plugin="compressor"] {
  --plugin-primary: var(--compressor-primary);
  --plugin-gradient: var(--compressor-gradient);
  --plugin-glow: rgba(147, 51, 234, 0.5);

  --viz-background: radial-gradient(circle, rgba(147,51,234,0.1), transparent);
  --viz-accent: #A855F7;
  --viz-highlight: #7C3AED;
}
```

### EQ

```css
:root[data-plugin="eq"] {
  --plugin-primary: var(--eq-primary);
  --plugin-gradient: var(--eq-gradient);
  --plugin-glow: rgba(6, 182, 212, 0.5);

  --viz-background: linear-gradient(180deg, rgba(6,182,212,0.1), transparent);
  --viz-accent: #22D3EE;
  --viz-highlight: #0891B2;
}
```

---

## 📱 Responsive Breakpoints

```css
/* Breakpoints */
--zenith-breakpoint-xs: 480px;    /* Mobile portrait */
--zenith-breakpoint-sm: 640px;    /* Mobile landscape */
--zenith-breakpoint-md: 768px;    /* Tablet portrait */
--zenith-breakpoint-lg: 1024px;   /* Tablet landscape */
--zenith-breakpoint-xl: 1280px;   /* Desktop */
--zenith-breakpoint-2xl: 1536px;  /* Large desktop */

/* Usage */
@media (min-width: var(--zenith-breakpoint-md)) {
  .plugin-container {
    grid-template-columns: 2fr 1fr 1fr;
  }
}
```

---

## ♿ Accessibility

### Focus States

```css
/* Keyboard Focus Ring */
.zenith-focus-ring {
  outline: 2px solid var(--zenith-accent-cool);
  outline-offset: 2px;
  border-radius: var(--zenith-radius-sm);
}

/* Focus Visible (keyboard only) */
*:focus-visible {
  outline: 2px solid var(--zenith-accent-cool);
  outline-offset: 2px;
}

*:focus:not(:focus-visible) {
  outline: none;
}
```

### ARIA Labels

```jsx
// All interactive elements must have labels
<button aria-label="Increase drive">+</button>
<div role="slider" aria-valuenow={50} aria-valuemin={0} aria-valuemax={100}>
```

### Color Contrast

```
Minimum Ratios (WCAG AA):
- Normal text: 4.5:1
- Large text: 3:1
- UI components: 3:1

Target Ratios (WCAG AAA):
- Normal text: 7:1
- Large text: 4.5:1
```

---

## 🎨 Icon System

### Icon Library: Lucide React

```jsx
import { Play, Square, Mic, Headphones, Settings } from 'lucide-react';

<Play size={16} strokeWidth={2} color="var(--zenith-text-primary)" />
```

### Icon Sizes

```css
--zenith-icon-xs: 12px;   /* Inline icons */
--zenith-icon-sm: 16px;   /* UI controls */
--zenith-icon-md: 20px;   /* Buttons */
--zenith-icon-lg: 24px;   /* Feature icons */
--zenith-icon-xl: 32px;   /* Hero icons */
```

### Custom Icons

```jsx
// Use SVG components for plugin-specific icons
const TubeIcon = () => (
  <svg viewBox="0 0 24 24" className="zenith-icon">
    {/* Custom path */}
  </svg>
);
```

---

## 📦 Component Composition Patterns

### Plugin Container Template

```jsx
<div className="zenith-plugin-container" data-plugin="saturator">
  {/* Header */}
  <header className="zenith-plugin-header">
    <h2 className="zenith-h2">Saturator</h2>
    <div className="zenith-plugin-actions">
      <PresetSelector />
      <BypassToggle />
      <MoreMenu />
    </div>
  </header>

  {/* Content Grid */}
  <div className="zenith-plugin-grid">
    {/* Visualization Column */}
    <div className="zenith-viz-column">
      <PluginCanvas {...visualizerConfig} />
    </div>

    {/* Controls Column */}
    <div className="zenith-controls-column">
      <ProfessionalKnob {...driveConfig} />
      <ProfessionalKnob {...mixConfig} />
      <ZenithSelector {...modeConfig} />
    </div>

    {/* Metering Column */}
    <div className="zenith-meter-column">
      <ZenithMeter {...meterConfig} />
      <THDDisplay value={2.4} />
    </div>
  </div>
</div>
```

---

## 🎓 Best Practices

### Do's ✅

- Use CSS custom properties for theming
- Maintain 4px grid for spacing
- Provide keyboard navigation
- Test with screen readers
- Optimize animations for 60fps
- Use semantic HTML
- Provide clear visual feedback
- Keep component APIs consistent

### Don'ts ❌

- Don't use absolute positioning excessively
- Don't animate expensive properties (width, height)
- Don't ignore loading states
- Don't skip focus indicators
- Don't use color alone for information
- Don't break expected interaction patterns
- Don't nest components too deeply

---

## 🚀 Implementation Checklist

### Phase 1: Foundation
- [ ] CSS custom properties defined
- [ ] Base typography styles
- [ ] Color palette implemented
- [ ] Spacing system setup

### Phase 2: Core Components
- [ ] ProfessionalKnob
- [ ] ZenithSlider
- [ ] ZenithButton
- [ ] ZenithToggle
- [ ] ZenithMeter
- [ ] ZenithSelector

### Phase 3: Animations
- [ ] Transition system
- [ ] Keyframe animations
- [ ] Easing functions
- [ ] Performance testing

### Phase 4: Documentation
- [ ] Component storybook
- [ ] Usage examples
- [ ] Accessibility guide
- [ ] Migration guide (from old components)

---

## 📚 Resources

### Internal
- `/components/common/` - Shared components
- `/components/plugins/container/` - Plugin controls
- `/lib/visualization/` - Visualization engine

### External
- [Tailwind CSS](https://tailwindcss.com) - Utility framework
- [Lucide Icons](https://lucide.dev) - Icon library
- [Inter Font](https://rsms.me/inter/) - Primary typeface
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

---

## 🎯 Success Metrics

- [ ] Design token coverage: 100%
- [ ] Component reuse: >80%
- [ ] Accessibility score: AAA
- [ ] Performance: 60fps sustained
- [ ] Developer velocity: 2x faster
- [ ] User satisfaction: >4.5/5

---

*Zenith is a living design system. As DAWG evolves, so does Zenith.*

**Version:** 1.0.0
**Last Updated:** 2025-10-08
**Maintainer:** DAWG Design Team

---

## 🔥 Quick Start

```bash
# Import design tokens
import '@/styles/zenith.css';

# Use components
import { ProfessionalKnob, ZenithButton } from '@/components/zenith';

# Apply theme
<div data-plugin="saturator" className="zenith-plugin-container">
  {/* Your plugin UI */}
</div>
```

**Let's build something beautiful!** ✨
