# Plugin V2.0 Compatibility Issues Report

## 🔍 Compressor (AdvancedCompressorUI_V2.jsx)

### ❌ Hard-coded Colors (Should use categoryColors)

1. **Canvas Container (Line 847)**
   ```jsx
   className="... border border-[#00A8E8]/20"
   ```
   ❌ Should use: `categoryColors.primary` with opacity

2. **GR Meter Container (Line 1044)**
   ```jsx
   className="bg-gradient-to-br from-black/50 to-[#001829]/30 ... border border-[#00A8E8]/20"
   ```
   ❌ Should use: Category-based gradient and border colors

3. **Checkbox Styling (Lines 1129, 1160)**
   ```jsx
   className="... border-[#00A8E8]/30 ... checked:bg-[#00A8E8] checked:border-[#00A8E8]"
   ```
   ❌ Should use: `categoryColors.primary`

4. **Text Colors (Lines 1132, 1168)**
   ```jsx
   className="... text-[#00B8F8]/70"
   className="... group-hover:text-[#00A8E8]"
   ```
   ❌ Should use: `categoryColors.secondary` and `categoryColors.primary`

5. **Select Element (Line 1172)**
   ```jsx
   className="... border border-[#00A8E8]/20"
   ```
   ❌ Should use: `categoryColors.primary` with opacity

6. **Border Dividers (Lines 1123, etc.)**
   ```jsx
   className="... border-t border-[#00A8E8]/10"
   ```
   ❌ Should use: `categoryColors.primary` with opacity

7. **GainReductionMeter Component (Lines 861-863)**
   ```jsx
   let color = '#00A8E8'; // Hard-coded
   if (absGR > 12) color = '#ef4444';
   else if (absGR > 6) color = '#f59e0b';
   ```
   ❌ Should use: Dynamic colors based on category or use shared color constants

### ❌ Canvas Rendering Colors (Lines 86-810)
- Many hard-coded rgba values that should reference categoryColors
- Threshold colors: `rgba(168, 85, 247, ...)` should use `categoryColors.primary`
- GR meter colors: `rgba(0, 168, 232, ...)` should use `categoryColors.primary`
- Compression colors: `rgba(239, 68, 68, ...)` should use warning/error colors from shared palette

---

## 🔍 Saturator (SaturatorUI_V2.jsx)

### ❌ Hard-coded Colors (Should use categoryColors)

1. **Canvas Container (Line 175)**
   ```jsx
   className="... border border-[#FF6B35]/20"
   ```
   ❌ Should use: `categoryColors.primary` with opacity

2. **Main Controls Container (Line 240)**
   ```jsx
   className="bg-gradient-to-br from-black/50 to-[#2d1810]/30 ... border border-[#FF6B35]/20"
   ```
   ❌ Should use: Category-based gradient using `categoryColors`

3. **Divider (Line 257)**
   ```jsx
   className="... via-[#FF6B35]/30"
   ```
   ❌ Should use: `categoryColors.primary` with opacity

4. **Checkbox Styling (Line 363)**
   ```jsx
   className="... border-[#FF6B35]/30 ... checked:bg-[#FF6B35] checked:border-[#FF6B35]"
   ```
   ❌ Should use: `categoryColors.primary`

5. **Text Colors (Lines 366, 383)**
   ```jsx
   className="... group-hover:text-[#FF6B35]"
   className="... text-[#FFC857]/70"
   ```
   ❌ Should use: `categoryColors.primary` and `categoryColors.secondary`

6. **Processing Stats Container (Line 382)**
   ```jsx
   className="bg-gradient-to-br from-black/50 to-[#2d1810]/30 ... border border-[#FF6B35]/10"
   ```
   ❌ Should use: Category-based gradient and border

7. **Border Dividers (Line 357)**
   ```jsx
   className="... border-t border-[#FF6B35]/10"
   ```
   ❌ Should use: `categoryColors.primary` with opacity

### ❌ Canvas Rendering Colors (Lines 67-175)
- Hard-coded orange colors in harmonic visualization
- `rgba(255, 107, 53, ...)` should use `categoryColors.primary`
- `rgba(255, 200, 87, ...)` should use `categoryColors.secondary` or accent

---

## 📋 Common Issues Across Both Plugins

### ❌ Missing Shared Components
1. **Checkbox Component**: Both plugins use inline checkbox styling. Should use shared component or standardize styling with categoryColors
2. **Select/Dropdown Component**: Compressor uses inline select. Should use shared styled component
3. **Stat/Info Panel Component**: Saturator has manual stats panel. Should use PanelSection or shared component

### ❌ Layout Structure Issues
1. **Manual Container Styling**: Both plugins manually style containers instead of using PanelSection or layout-provided styling
2. **Gradient Backgrounds**: Hard-coded gradients instead of using categoryColors-based gradients
3. **Border Styling**: Inline border classes instead of category-based borders

### ❌ Missing Integration
1. **Texture Pack**: Both plugins should automatically inherit texture pack from PluginContainerV2 (already done via wrapper)
2. **Depth Effects**: Container shadows should use DepthEffects utilities from TexturePack

---

## ✅ What's Already Correct

1. ✅ Using `TwoPanelLayout` correctly
2. ✅ Using `PluginContainerV2` wrapper
3. ✅ Using `Knob` and `ExpandablePanel` from shared components
4. ✅ Using `useParameterBatcher`
5. ✅ Using `useRenderer` for canvas
6. ✅ Using `categoryColors` in some places (Knob components)
7. ✅ Category prop passed correctly to layouts

---

## 🔧 Required Fixes

### Priority 1: Hard-coded Colors
- Replace all `#00A8E8` (Compressor) with `categoryColors.primary`
- Replace all `#FF6B35` (Saturator) with `categoryColors.primary`
- Replace all secondary colors with `categoryColors.secondary`
- Replace gradients with categoryColors-based gradients

### Priority 2: Canvas Rendering
- Extract color constants or use categoryColors in canvas rendering
- Use shared color palette for status colors (warning, error, success)

### Priority 3: Shared Components
- Create/use shared Checkbox component with category theming
- Create/use shared Select component with category theming
- Replace manual stat panels with PanelSection component

### Priority 4: Container Styling
- Use PanelSection for stat/info containers
- Use categoryColors for all gradient backgrounds
- Standardize border styling

