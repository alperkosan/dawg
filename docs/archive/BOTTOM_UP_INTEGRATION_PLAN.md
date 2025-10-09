# 🏗️ Bottom-Up Integration Plan
**Temelden Yüzeye: Sistematik Entegrasyon ve Temizlik**

**Date:** 2025-10-09
**Status:** 🚀 Action Plan Ready

---

## 🎯 Strateji

**Prensip:** Temelden başla, her katman sağlam olana kadar üst katmana geçme

```
LAYER 5: Plugin UIs              ← Son adım (Week 3-12)
         ↑
LAYER 4: Shared Components       ← Week 2
         ↑
LAYER 3: Hooks & Utils           ← Week 1 (Day 4-5)
         ↑
LAYER 2: Theme System            ← Week 1 (Day 2-3)
         ↑
LAYER 1: Cleanup & Foundation    ← Week 1 (Day 1) ← BAŞLANGIÇ
```

---

## 📋 PHASE 0: Cleanup & Audit (Week 1, Day 1)

### Amaç
Eski, kullanılmayan, kırık dosyaları temizle. Temiz bir zemin oluştur.

### Step 0.1: Identify Obsolete Files

**Silinecek Dosyalar:**
```bash
# OLD versions (artık kullanılmıyor)
client/src/components/plugins/effects/SaturatorUI_OLD.jsx
client/src/components/plugins/effects/SaturatorUI_BROKEN.jsx
client/src/components/plugins/effects/AdvancedEQUI_OLD.jsx
client/src/components/plugins/effects/AdvancedEQUI_OLD_BACKUP.jsx

# Unused specialized UI (experimental, kullanılmadı)
client/src/components/plugins/effects/SaturatorUIWithWebGL.jsx
client/src/components/plugins/effects/PluginTemplate.jsx (boş template)

# Duplicate/Old versions
client/src/components/plugins/effects/AdvancedCompressorUI.jsx (v2 kullanılıyor)
client/src/components/plugins/effects/SaturatorUI.jsx (v4 kullanılıyor)
client/src/components/plugins/effects/AdvancedEQUI_v2.jsx (orijinal kullanılıyor)
```

**Aktif Kullanımda Olanlar (TUTULACAK):**
```bash
# Tier 1
SaturatorUI_v4.jsx          ← ACTIVE (pluginConfig'de import ediliyor)
AdvancedCompressorUI_v2.jsx ← ACTIVE
OTTUI.jsx                   ← ACTIVE
AdvancedEQUI.jsx            ← ACTIVE
ModernReverbUI.jsx          ← ACTIVE
ModernDelayUI.jsx           ← ACTIVE

# Tier 2
TidalFilterUI.jsx           ← ACTIVE
StardustChorusUI.jsx        ← ACTIVE
VortexPhaserUI.jsx          ← ACTIVE
OrbitPannerUI.jsx           ← ACTIVE

# Tier 3
ArcadeCrusherUI.jsx         ← ACTIVE
PitchShifterUI.jsx          ← ACTIVE
BassEnhancer808UI.jsx       ← ACTIVE
TransientDesignerUI.jsx     ← ACTIVE
```

**Action Items:**
```bash
# 1. Backup (safety first)
mkdir -p /Users/alperkosan/dawg/client/src/components/plugins/effects/_archive
mv *_OLD.jsx _archive/
mv *_BROKEN.jsx _archive/
mv *_BACKUP.jsx _archive/
mv SaturatorUIWithWebGL.jsx _archive/

# 2. Rename active files to standard names
mv SaturatorUI_v4.jsx SaturatorUI.jsx
mv AdvancedCompressorUI_v2.jsx AdvancedCompressorUI.jsx

# 3. Update pluginConfig.jsx imports
# (automatic with rename)
```

**Time:** 1 hour

---

### Step 0.2: Audit Component Dependencies

**Goal:** Hangi componentlerin hangi diğer componentleri kullandığını map et

**Komut:**
```bash
# Her plugin'de hangi control componentler kullanılıyor?
grep -r "from '@/components/controls" client/src/components/plugins/effects/*.jsx
```

**Expected Output Mapping:**
```
SaturatorUI.jsx:
  - Knob (drive, wet, tone, headroom)
  - Slider (lowCut, highCut)
  - Toggle (autoGain)
  - Display (THD)
  - Meter (input, output)

AdvancedCompressorUI.jsx:
  - Knob (threshold, ratio, attack, release, knee)
  - Slider (upward controls)
  - Meter (GR meter)
  - Display (values)

... (document all 14 plugins)
```

**Action:** Create dependency map document

**Time:** 2 hours

---

### Step 0.3: Clean Up CSS/Styles

**Goal:** Eski stil dosyalarını temizle, backup dosyaları sil

**Backup Files Found:**
```bash
client/src/styles/components/_window.css.backup
client/src/styles/features/_instrumentRow.css.backup
client/src/styles/features/_pianoRollMiniView.css.backup
client/src/styles/features/_taskbar.css.backup
client/src/styles/layout/_layout.css.backup
client/src/styles/layout/_toolbar.css.backup
client/src/styles/layout/_workspace.css.backup
```

**Action:**
```bash
# Move to archive
mkdir -p client/src/styles/_archive
mv **/*.backup client/src/styles/_archive/
```

**Time:** 30 minutes

---

## 🎨 PHASE 1: Theme System Foundation (Week 1, Day 2-3)

### Amaç
Tüm componentlerin kullanacağı **unified theme system** oluştur

### Step 1.1: Enhance useControlTheme.js

**File:** `client/src/components/controls/useControlTheme.js`

**Current State:**
```javascript
export const useControlTheme = (variant = 'default') => {
  // Basic variant-based theming
};
```

**Enhanced Version:**
```javascript
/**
 * UNIFIED THEME SYSTEM
 * Supports both variant-based and category-based theming
 */

// Category palettes (from PLUGIN_DESIGN_THEMES.md)
const CATEGORY_THEMES = {
  'texture-lab': {
    primary: '#FF6B35',
    secondary: '#F7931E',
    accent: '#FFC857',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d1810 100%)',
    track: 'rgba(255, 107, 53, 0.1)',
    fill: '#FF6B35',
    glow: 'rgba(255, 107, 53, 0.4)',
  },
  'dynamics-forge': {
    primary: '#00A8E8',
    secondary: '#007EA7',
    accent: '#00D9FF',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #0a1a2d 100%)',
    track: 'rgba(0, 168, 232, 0.1)',
    fill: '#00A8E8',
    glow: 'rgba(0, 168, 232, 0.4)',
  },
  'spectral-weave': {
    primary: '#9B59B6',
    secondary: '#8E44AD',
    accent: '#C39BD3',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #1a0a2d 100%)',
    track: 'rgba(155, 89, 182, 0.1)',
    fill: '#9B59B6',
    glow: 'rgba(155, 89, 182, 0.4)',
  },
  'modulation-machines': {
    primary: '#2ECC71',
    secondary: '#27AE60',
    accent: '#58D68D',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #0a2d1a 100%)',
    track: 'rgba(46, 204, 113, 0.1)',
    fill: '#2ECC71',
    glow: 'rgba(46, 204, 113, 0.4)',
  },
  'spacetime-chamber': {
    primary: '#E74C3C',
    secondary: '#C0392B',
    accent: '#EC7063',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d0a0a 100%)',
    track: 'rgba(231, 76, 60, 0.1)',
    fill: '#E74C3C',
    glow: 'rgba(231, 76, 60, 0.4)',
  },
};

// Variant themes (legacy support)
const VARIANT_THEMES = {
  default: {
    primary: '#ffffff',
    secondary: '#999999',
    accent: '#00D9FF',
    background: '#1a1a1a',
    track: 'rgba(255, 255, 255, 0.1)',
    fill: '#ffffff',
    glow: 'rgba(255, 255, 255, 0.2)',
  },
  // ... other variants
};

export const useControlTheme = (variant = 'default', category) => {
  // Priority: category > variant > default
  const theme = category
    ? CATEGORY_THEMES[category]
    : VARIANT_THEMES[variant] || VARIANT_THEMES.default;

  return {
    colors: theme,
    styles: {
      // Common style utilities
      knobSize: {
        small: 60,
        medium: 80,
        large: 100,
      },
      spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
      },
      borderRadius: {
        sm: 4,
        md: 8,
        lg: 12,
        full: 9999,
      },
      typography: {
        label: {
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        },
        value: {
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'monospace',
        },
      },
    },
  };
};
```

**Testing:**
```javascript
// Test all category themes
const categories = [
  'texture-lab',
  'dynamics-forge',
  'spectral-weave',
  'modulation-machines',
  'spacetime-chamber'
];

categories.forEach(cat => {
  const { colors } = useControlTheme('default', cat);
  console.log(`${cat}:`, colors.primary);
});
```

**Time:** 4 hours

---

### Step 1.2: Create ThemeProvider Component

**File:** `client/src/components/controls/ThemeProvider.jsx`

**Purpose:** React Context provider for theme

```javascript
import React, { createContext, useContext } from 'react';
import { useControlTheme } from './useControlTheme';

const ThemeContext = createContext(null);

export const ThemeProvider = ({
  category,
  variant = 'default',
  children
}) => {
  const theme = useControlTheme(variant, category);

  return (
    <ThemeContext.Provider value={theme}>
      <div
        className="theme-provider"
        style={{
          '--theme-primary': theme.colors.primary,
          '--theme-secondary': theme.colors.secondary,
          '--theme-accent': theme.colors.accent,
          '--theme-track': theme.colors.track,
          '--theme-fill': theme.colors.fill,
          '--theme-glow': theme.colors.glow,
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return theme;
};
```

**Time:** 2 hours

---

## 🔧 PHASE 2: Enhance Core Components (Week 1, Day 3-5)

### Step 2.1: Enhance Knob.jsx → ProfessionalKnob

**File:** `client/src/components/controls/base/Knob.jsx`

**Enhancements:**
```javascript
export const Knob = ({
  // ... existing props

  // NEW PROPS:
  ghostValue,              // For visual feedback lag
  color,                   // Override theme color
  size = 'medium',         // 'small' | 'medium' | 'large'
  valueFormatter,          // Custom format function
  showGhostValue = true,   // Toggle ghost value display

  // ... rest
}) => {
  const theme = useTheme(); // Use theme context

  // Size mapping
  const sizeMap = {
    small: 60,
    medium: 80,
    large: 100,
  };
  const knobSize = sizeMap[size];

  // Color priority: prop > theme > default
  const knobColor = color || theme.colors.primary || '#ffffff';

  // Ghost value rendering
  const renderGhostArc = () => {
    if (!showGhostValue || ghostValue === undefined || ghostValue === value) {
      return null;
    }

    const ghostAngle = valueToAngle(ghostValue);
    return (
      <circle
        cx={knobSize / 2}
        cy={knobSize / 2}
        r={(knobSize / 2) - 8}
        fill="none"
        stroke={`${knobColor}40`}  // 25% opacity
        strokeWidth="4"
        strokeDasharray={`${(ghostAngle + 135) * Math.PI / 180 * ((knobSize / 2) - 8)} ${2 * Math.PI * ((knobSize / 2) - 8)}`}
        transform={`rotate(-135 ${knobSize / 2} ${knobSize / 2})`}
      />
    );
  };

  return (
    <div className="knob-container">
      <svg width={knobSize} height={knobSize}>
        {/* Ghost value arc (behind main arc) */}
        {renderGhostArc()}

        {/* Main value arc */}
        <circle
          cx={knobSize / 2}
          cy={knobSize / 2}
          r={(knobSize / 2) - 8}
          fill="none"
          stroke={theme.colors.track}
          strokeWidth="4"
        />
        <circle
          cx={knobSize / 2}
          cy={knobSize / 2}
          r={(knobSize / 2) - 8}
          fill="none"
          stroke={knobColor}
          strokeWidth="4"
          strokeDasharray={`${currentAngle * Math.PI / 180 * ((knobSize / 2) - 8)} ${2 * Math.PI * ((knobSize / 2) - 8)}`}
          transform={`rotate(-135 ${knobSize / 2} ${knobSize / 2})`}
          style={{
            filter: `drop-shadow(0 0 8px ${knobColor}40)`,
          }}
        />

        {/* Indicator dot */}
        <circle
          cx={indicatorX}
          cy={indicatorY}
          r={4}
          fill={knobColor}
        />
      </svg>

      <div className="knob-label">{label}</div>
      <div className="knob-value">
        {valueFormatter ? valueFormatter(value) : formatValue(value)}
      </div>
    </div>
  );
};
```

**Testing:**
```javascript
// Test with ghost value
<Knob
  label="DRIVE"
  value={0.4}
  ghostValue={0.6}  // Lags behind
  size="large"
  color="#FF6B35"
  valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
  onChange={handleChange}
/>
```

**Time:** 6 hours

---

### Step 2.2: Enhance Slider.jsx → LinearSlider

**File:** `client/src/components/controls/base/Slider.jsx`

**Enhancements:**
```javascript
export const Slider = ({
  // ... existing props

  // NEW PROPS:
  orientation = 'horizontal', // 'horizontal' | 'vertical'
  bipolar = false,            // Center at 0
  logarithmic = false,        // Log scale
  showTicks = false,          // Show tick marks
  tickValues = [],            // Custom tick positions
  centerDetent = false,       // Snap to center
}) => {
  const theme = useTheme();

  // Bipolar mode: -1 to +1 range with 0 at center
  const getBipolarValue = (rawValue) => {
    if (!bipolar) return rawValue;
    // Map 0-1 to -1 to +1
    return (rawValue - 0.5) * 2;
  };

  // Center detent logic
  const handleDrag = (clientPos) => {
    let newValue = calculateValue(clientPos);

    if (centerDetent && bipolar) {
      const distance = Math.abs(newValue - 0.5);
      if (distance < 0.05) { // 5% threshold
        newValue = 0.5; // Snap to center
      }
    }

    onChange(newValue);
  };

  // Tick marks
  const renderTicks = () => {
    if (!showTicks) return null;

    const ticks = tickValues.length > 0
      ? tickValues
      : [0, 0.25, 0.5, 0.75, 1.0];

    return ticks.map((tick, i) => {
      const position = tick * 100;
      return (
        <div
          key={i}
          className="slider-tick"
          style={{
            [orientation === 'horizontal' ? 'left' : 'bottom']: `${position}%`,
          }}
        />
      );
    });
  };

  // Bipolar center indicator
  const renderCenterLine = () => {
    if (!bipolar) return null;

    return (
      <div
        className="slider-center"
        style={{
          [orientation === 'horizontal' ? 'left' : 'bottom']: '50%',
          borderLeft: '2px solid rgba(255, 255, 255, 0.3)',
        }}
      />
    );
  };

  return (
    <div className={`slider-container ${orientation}`}>
      <div className="slider-track">
        {renderTicks()}
        {renderCenterLine()}

        <div
          className="slider-fill"
          style={{
            [orientation === 'horizontal' ? 'width' : 'height']: `${value * 100}%`,
            background: theme.colors.fill,
          }}
        />

        <div
          className="slider-thumb"
          style={{
            [orientation === 'horizontal' ? 'left' : 'bottom']: `${value * 100}%`,
          }}
        />
      </div>

      <div className="slider-label">{label}</div>
      <div className="slider-value">
        {bipolar ? getBipolarValue(value).toFixed(2) : formatValue(value)}
      </div>
    </div>
  );
};
```

**Time:** 6 hours

---

### Step 2.3: Enhance Meter.jsx

**File:** `client/src/components/controls/advanced/Meter.jsx`

**Enhancements:**
```javascript
export const Meter = ({
  // ... existing props

  // NEW PROPS:
  type = 'vu',           // 'vu' | 'led' | 'circular' | 'histogram'
  unit = 'linear',       // 'linear' | 'db'
  showScale = false,     // Show dB labels
  segments = 20,         // For LED meter
}) => {
  const theme = useTheme();

  // Render based on type
  switch (type) {
    case 'led':
      return <LEDMeter {...props} theme={theme} />;
    case 'circular':
      return <CircularMeter {...props} theme={theme} />;
    case 'histogram':
      return <HistogramMeter {...props} theme={theme} />;
    case 'vu':
    default:
      return <VUMeter {...props} theme={theme} />;
  }
};

// Sub-components
const LEDMeter = ({ value, segments, theme, ...props }) => {
  const filledSegments = Math.floor((value / 100) * segments);

  return (
    <div className="led-meter">
      {Array.from({ length: segments }).map((_, i) => {
        const isFilled = i < filledSegments;
        const color = getSegmentColor(i, segments);

        return (
          <div
            key={i}
            className={`led-segment ${isFilled ? 'active' : ''}`}
            style={{
              background: isFilled ? color : 'rgba(255,255,255,0.1)',
              boxShadow: isFilled ? `0 0 4px ${color}` : 'none',
            }}
          />
        );
      })}
    </div>
  );
};

const getSegmentColor = (index, total) => {
  const percentage = (index / total) * 100;
  if (percentage > 90) return '#ef4444'; // Red
  if (percentage > 70) return '#f59e0b'; // Orange
  return '#22c55e'; // Green
};
```

**Time:** 8 hours

---

## 🆕 PHASE 3: Create Missing Components (Week 1-2)

### Step 3.1: Create ModeSelector Component

**File:** `client/src/components/controls/base/ModeSelector.jsx`

```javascript
import React, { useState } from 'react';
import { useTheme } from '../ThemeProvider';

export const ModeSelector = ({
  modes = [],              // Array of { id, label, icon?, description? }
  activeMode,
  onChange,
  orientation = 'horizontal', // 'horizontal' | 'vertical'
  compact = false,         // Icon-only mode
  allowDeselect = false,
}) => {
  const theme = useTheme();
  const [hoveredMode, setHoveredMode] = useState(null);

  const handleClick = (modeId) => {
    if (allowDeselect && activeMode === modeId) {
      onChange(null);
    } else {
      onChange(modeId);
    }
  };

  return (
    <div className={`mode-selector ${orientation}`}>
      <div className="mode-buttons">
        {modes.map((mode, index) => {
          const isActive = activeMode === mode.id;
          const isHovered = hoveredMode === mode.id;

          return (
            <button
              key={mode.id}
              className={`mode-button ${isActive ? 'active' : ''}`}
              onClick={() => handleClick(mode.id)}
              onMouseEnter={() => setHoveredMode(mode.id)}
              onMouseLeave={() => setHoveredMode(null)}
              title={mode.description}
              style={{
                color: isActive ? theme.colors.primary : 'rgba(255,255,255,0.6)',
                borderBottom: isActive
                  ? `2px solid ${theme.colors.primary}`
                  : '2px solid transparent',
              }}
            >
              {mode.icon && <span className="mode-icon">{mode.icon}</span>}
              {!compact && <span className="mode-label">{mode.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Active indicator (animated underline) */}
      {orientation === 'horizontal' && (
        <div
          className="mode-indicator"
          style={{
            transform: `translateX(${modes.findIndex(m => m.id === activeMode) * 100}%)`,
            background: theme.colors.primary,
            boxShadow: `0 0 8px ${theme.colors.glow}`,
          }}
        />
      )}

      {/* Tooltip for hovered mode */}
      {hoveredMode && modes.find(m => m.id === hoveredMode)?.description && (
        <div className="mode-tooltip">
          {modes.find(m => m.id === hoveredMode).description}
        </div>
      )}
    </div>
  );
};
```

**Usage Example:**
```javascript
<ModeSelector
  modes={[
    { id: 'toasty', label: 'Toasty', description: 'Subtle warmth' },
    { id: 'crunchy', label: 'Crunchy', description: 'Medium saturation' },
    { id: 'distress', label: 'Distress', description: 'Heavy distortion' },
  ]}
  activeMode="toasty"
  onChange={setMode}
/>
```

**Time:** 8 hours (1 day)

---

### Step 3.2: Create ExpandablePanel Component

**File:** `client/src/components/controls/base/ExpandablePanel.jsx`

```javascript
import React, { useState } from 'react';
import { useTheme } from '../ThemeProvider';

export const ExpandablePanel = ({
  title,
  defaultExpanded = false,
  children,
  icon,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const theme = useTheme();

  return (
    <div className="expandable-panel">
      <button
        className="panel-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          borderLeft: `3px solid ${theme.colors.primary}`,
        }}
      >
        {icon && <span className="panel-icon">{icon}</span>}
        <span className="panel-title">{title}</span>
        <span className={`panel-chevron ${isExpanded ? 'expanded' : ''}`}>
          ▾
        </span>
      </button>

      <div
        className={`panel-content ${isExpanded ? 'expanded' : 'collapsed'}`}
        style={{
          maxHeight: isExpanded ? '1000px' : '0',
          opacity: isExpanded ? 1 : 0,
          overflow: 'hidden',
          transition: 'all 0.3s ease-in-out',
        }}
      >
        <div className="panel-inner">
          {children}
        </div>
      </div>
    </div>
  );
};
```

**Time:** 4 hours (0.5 day)

---

### Step 3.3: Create PresetBrowser Component

**File:** `client/src/components/controls/advanced/PresetBrowser.jsx`

```javascript
import React, { useState } from 'react';
import { useTheme } from '../ThemeProvider';

export const PresetBrowser = ({
  presets = [],
  currentPreset,
  onLoad,
  onSave,
  onDelete,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const theme = useTheme();

  const filteredPresets = presets.filter(preset => {
    const matchesSearch = preset.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || preset.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="preset-browser">
      <div className="browser-header">
        <h3>Presets</h3>
        <button onClick={onClose}>×</button>
      </div>

      <div className="browser-filters">
        <input
          type="text"
          placeholder="Search presets..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="preset-search"
        />

        <div className="category-tabs">
          <button onClick={() => setSelectedCategory('all')}>All</button>
          <button onClick={() => setSelectedCategory('factory')}>Factory</button>
          <button onClick={() => setSelectedCategory('user')}>User</button>
        </div>
      </div>

      <div className="preset-list">
        {filteredPresets.map(preset => (
          <div
            key={preset.id}
            className={`preset-item ${currentPreset === preset.id ? 'active' : ''}`}
            onClick={() => onLoad(preset.id)}
            style={{
              borderLeft: currentPreset === preset.id
                ? `3px solid ${theme.colors.primary}`
                : '3px solid transparent',
            }}
          >
            <span className="preset-name">{preset.name}</span>
            {preset.favorite && <span className="preset-star">★</span>}
            {preset.category === 'user' && (
              <button
                className="preset-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(preset.id);
                }}
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="browser-actions">
        <button onClick={() => onSave()}>Save As...</button>
      </div>
    </div>
  );
};
```

**Time:** 8 hours (1 day)

---

## 📊 PHASE 4: Testing & Documentation (Week 2)

### Step 4.1: Storybook Setup

**Create stories for each component:**

```bash
# Create Storybook stories directory
mkdir -p client/src/components/controls/stories

# Create story files
touch client/src/components/controls/stories/Knob.stories.jsx
touch client/src/components/controls/stories/Slider.stories.jsx
touch client/src/components/controls/stories/ModeSelector.stories.jsx
touch client/src/components/controls/stories/Meter.stories.jsx
# ... etc
```

**Example Story:**
```javascript
// Knob.stories.jsx
import { Knob } from '../base/Knob';
import { ThemeProvider } from '../ThemeProvider';

export default {
  title: 'Controls/Knob',
  component: Knob,
};

export const Default = () => (
  <ThemeProvider category="texture-lab">
    <Knob
      label="DRIVE"
      value={0.4}
      onChange={(v) => console.log(v)}
    />
  </ThemeProvider>
);

export const WithGhostValue = () => (
  <ThemeProvider category="texture-lab">
    <Knob
      label="DRIVE"
      value={0.4}
      ghostValue={0.7}
      onChange={(v) => console.log(v)}
    />
  </ThemeProvider>
);

export const AllSizes = () => (
  <div style={{ display: 'flex', gap: '20px' }}>
    <Knob label="SMALL" size="small" value={0.3} />
    <Knob label="MEDIUM" size="medium" value={0.5} />
    <Knob label="LARGE" size="large" value={0.7} />
  </div>
);
```

**Time:** 2 days (all components)

---

### Step 4.2: Unit Tests

**Create test files:**

```javascript
// Knob.test.jsx
import { render, fireEvent } from '@testing-library/react';
import { Knob } from '../base/Knob';

describe('Knob', () => {
  it('renders with label', () => {
    const { getByText } = render(<Knob label="TEST" value={0.5} />);
    expect(getByText('TEST')).toBeInTheDocument();
  });

  it('calls onChange on drag', () => {
    const onChange = jest.fn();
    const { container } = render(<Knob label="TEST" value={0.5} onChange={onChange} />);

    // Simulate drag
    const knob = container.querySelector('.knob-container');
    fireEvent.mouseDown(knob);
    fireEvent.mouseMove(knob, { clientY: -50 });

    expect(onChange).toHaveBeenCalled();
  });

  it('renders ghost value when provided', () => {
    const { container } = render(
      <Knob label="TEST" value={0.5} ghostValue={0.7} />
    );

    const ghostArc = container.querySelector('[stroke*="40"]'); // 25% opacity
    expect(ghostArc).toBeInTheDocument();
  });
});
```

**Time:** 2 days (all components)

---

## 🎨 PHASE 5: Plugin Redesign (Week 3-12)

### Step 5.1: Saturator v2.0 (Week 3-4)

**Goal:** Reference implementation using new component library

**Tasks:**
1. Update `saturator-processor.js` (DSP enhancements)
2. Redesign `SaturatorUI.jsx` with new components
3. Test and polish
4. Documentation

**Template:**
```javascript
import { ThemeProvider } from '@/components/controls/ThemeProvider';
import { Knob, Slider, Toggle, ModeSelector, ExpandablePanel, Meter } from '@/components/controls';
import { useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

export const SaturatorUI = ({ settings, onChange }) => {
  const { drive, wet, tone, headroom, autoGain, lowCut, highCut } = settings;

  // Ghost values
  const ghostDrive = useGhostValue(drive, 400);
  const ghostWet = useGhostValue(wet, 400);

  return (
    <ThemeProvider category="texture-lab">
      <div className="saturator-ui">
        {/* Main visualization */}
        <TubeGlowVisualizer drive={drive} />

        {/* Main controls */}
        <div className="main-controls">
          <Knob
            label="DRIVE"
            value={drive}
            ghostValue={ghostDrive}
            size="large"
            onChange={(v) => onChange('drive', v)}
          />
          <Knob
            label="MIX"
            value={wet}
            ghostValue={ghostWet}
            size="large"
            onChange={(v) => onChange('wet', v)}
          />
        </div>

        {/* Mode selector */}
        <ModeSelector
          modes={[
            { id: 'toasty', label: 'Toasty' },
            { id: 'crunchy', label: 'Crunchy' },
            { id: 'distress', label: 'Distress' },
          ]}
          activeMode={settings.mode}
          onChange={(m) => onChange('mode', m)}
        />

        {/* Advanced panel */}
        <ExpandablePanel title="ADVANCED">
          <Slider label="LOW CUT" value={lowCut} onChange={(v) => onChange('lowCut', v)} />
          <Slider label="HIGH CUT" value={highCut} onChange={(v) => onChange('highCut', v)} />
          <Toggle label="AUTO GAIN" checked={autoGain} onChange={(v) => onChange('autoGain', v)} />
        </ExpandablePanel>

        {/* Metering */}
        <div className="meters">
          <Meter type="vu" label="INPUT" value={inputLevel} />
          <Meter type="vu" label="OUTPUT" value={outputLevel} />
        </div>
      </div>
    </ThemeProvider>
  );
};
```

**Time:** 2 weeks (reference implementation, detailed testing)

---

## 📋 Summary Timeline

| Week | Phase | Tasks | Status |
|------|-------|-------|--------|
| **W1 D1** | Phase 0 | Cleanup & Audit | 🔵 Ready |
| **W1 D2-3** | Phase 1 | Theme System | 🔵 Ready |
| **W1 D3-5** | Phase 2 | Enhance Components | 🔵 Ready |
| **W1-2** | Phase 3 | Create Missing Components | 🔵 Ready |
| **W2** | Phase 4 | Testing & Storybook | 🔵 Ready |
| **W3-4** | Phase 5 | Saturator v2.0 | 🔵 Ready |
| **W5-12** | Phase 5 | Remaining Plugins | 🔵 Ready |

---

## ✅ Checklist

### Week 1, Day 1 (Cleanup)
- [ ] Archive old plugin files (`_OLD`, `_BROKEN`, `_BACKUP`)
- [ ] Rename active files to standard names
- [ ] Update `pluginConfig.jsx` imports
- [ ] Clean up CSS backup files
- [ ] Create component dependency map
- [ ] Document cleanup in CHANGELOG

### Week 1, Day 2-3 (Theme System)
- [ ] Enhance `useControlTheme.js` with category palettes
- [ ] Create `ThemeProvider.jsx` component
- [ ] Add CSS variables for theming
- [ ] Test all 5 category themes
- [ ] Document theme usage

### Week 1, Day 3-5 (Core Components)
- [ ] Enhance `Knob.jsx` (ghost value, sizes, color)
- [ ] Enhance `Slider.jsx` (bipolar, log, ticks)
- [ ] Enhance `Toggle.jsx` (sizes, colors)
- [ ] Enhance `Display.jsx` (sizes)
- [ ] Enhance `Meter.jsx` (variants)
- [ ] Test all enhancements

### Week 1-2 (New Components)
- [ ] Create `ModeSelector.jsx`
- [ ] Create `ExpandablePanel.jsx`
- [ ] Create `ControlGroup.jsx`
- [ ] Create `PresetBrowser.jsx`
- [ ] Create `HistogramMeter.jsx`
- [ ] Test all new components

### Week 2 (Documentation)
- [ ] Create Storybook stories (all components)
- [ ] Write unit tests (90%+ coverage)
- [ ] Create usage examples
- [ ] Performance benchmarks
- [ ] Update component library docs

### Week 3-4 (Saturator)
- [ ] Update DSP (auto-gain, filtering, tone)
- [ ] Redesign UI with new components
- [ ] User testing
- [ ] Documentation
- [ ] Tutorial video

---

**Total Estimated Time:**
- Week 1: Foundation + Components (~40 hours)
- Week 2: Testing + Docs (~40 hours)
- Week 3-4: Saturator v2.0 (~80 hours)
- **Total for foundation:** 160 hours (4 weeks)

**Next Step:** Begin Phase 0 - Cleanup & Audit

---

*Bu plan, temelden başlayarak sistematik bir şekilde yeni tasarım sistemine geçişi sağlar.*

**Last Updated:** 2025-10-09
**Status:** 🚀 Ready to Execute
