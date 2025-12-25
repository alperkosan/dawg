# UI Component System (Feature-Sliced)

This document details the interface and usage of the unified UI component library located in `client/src/components`.

## 🎛️ Input Controls (`/controls`)

All controls support `variant` props for theming (default, accent, danger) and use `requestAnimationFrame` for performance.

### `Knob`
A rotary control for continuous values.

```jsx
import { Knob } from '@/components/controls';

<Knob
  label="Cutoff"      // string: displayed label
  value={1000}        // number: current value
  onChange={(v) => {}} // func: callback(newValue)
  min={20}            // number: minimum value
  max={20000}         // number: maximum value
  logarithmic={true}  // bool: use logarithmic scale
  variant="accent"    // string: 'default' | 'accent' | 'danger'
/>
```

### `Fader`
Vertical slider for level control (dB scale).

```jsx
import { Fader } from '@/components/controls';

<Fader
  value={-6.0}
  onChange={val => console.log(val)}
  min={-60}
  max={6}
  unit="dB"           // string: suffix for display
/>
```

### `EnvelopeEditor`
Visual ADSR editor.

```jsx
import { EnvelopeEditor } from '@/components/controls';

<EnvelopeEditor
  attack={0.1}   // number: seconds
  decay={0.2}    // number: seconds
  sustain={0.7}  // number: 0.0 - 1.0 (gain)
  release={0.5}  // number: seconds
  onChange={({a,d,s,r}) => updateADSR(a,d,s,r)}
/>
```

## 🎨 Design Tokens (`index.css`)

The UI relies on CSS variables for consistent theming.

| Variable | Value (Default) | Usage |
| :--- | :--- | :--- |
| `--color-bg-base` | `#121214` | Main background |
| `--color-bg-surface`| `#1e1e24` | Panels, cards |
| `--color-accent` | `#3b82f6` | Active states, primary buttons, knob rings |
| `--color-text-main` | `#ececec` | Primary text |
| `--radius-sm` | `4px` | Small buttons |
| `--radius-md` | `8px` | Panels, larger inputs |

## 📦 Import Strategy
Use the central barrel export to keep imports clean:
`import { Knob, Fader, Button } from '@/components/controls';`

---

## 🎨 Theme System

The UI components are styled using the **Zenith Design System**, which provides dynamic theming via CSS variables.

For full details on the theme architecture, built-in themes, and how to create custom themes, see:
**[🎨 Theme Manager System](./03_theme_system.md)**

---

**Last Updated:** 2025-12-25

