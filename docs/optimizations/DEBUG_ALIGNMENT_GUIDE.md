# Debug Guide - Unified Canvas Alignment

**Purpose**: Diagnose and fix alignment issues between canvas and DOM instrument rows
**Status**: Debug logging active
**Date**: 2025-10-20

---

## Debug Logs Added

### 1. Viewport Update Log (UnifiedGridContainer)

**When**: Every scroll or resize event
**What**: Viewport dimensions, scroll position, DOM element positions

```javascript
📊 Unified Canvas Viewport Update: {
  viewport: "1200×600",           // Canvas viewport size
  scroll: "X:0 Y:128",            // Current scroll position
  parentRect: DOMRect {...},      // Parent container position
  containerOffset: 0,             // Spacer div offset
}

🎯 First Instrument Row: {
  rowTop: 150,                    // Row's absolute top position
  rowHeight: 64,                  // Row height (should be 64px)
  parentTop: 100,                 // Parent container's top
  relativeTop: 50,                // Row position relative to parent
}
```

### 2. Canvas Render Log (UnifiedGridCanvas)

**When**: Every render frame
**What**: Visible bounds, scroll state, rendered content

```javascript
🎨 Unified Canvas Render: {
  viewport: "1200×600",           // Canvas size
  scroll: "X:0 Y:128",            // Scroll offset used for rendering
  rows: "2-12 of 15",             // Visible row range
  steps: "0-126 of 256",          // Visible step range
  firstRowY: 0,                   // First visible row's Y in canvas
  instrumentNames: [              // First 3 visible instruments
    "Kick",
    "Snare",
    "Hi-Hat"
  ]
}
```

---

## How to Diagnose Alignment Issues

### Step 1: Check Viewport Logs

Open DevTools Console and look for `📊 Unified Canvas Viewport Update`

**What to check**:
```javascript
// ✅ GOOD: First row position matches expectation
relativeTop: 0  // First row should be at top of parent when scrollY = 0

// ❌ BAD: First row offset from expected
relativeTop: 50  // Indicates 50px offset - something is wrong
```

### Step 2: Check Render Logs

Look for `🎨 Unified Canvas Render`

**What to check**:
```javascript
// ✅ GOOD: First visible row Y coordinate
firstRowY: 0     // When startRow=0, should be at Y=0
firstRowY: -128  // When scrolled, can be negative (buffer area)

// Calculate expected:
expectedY = startRow * 64 - scrollY
// Example: startRow=2, scrollY=128
// expectedY = 2 * 64 - 128 = 0 ✅

// ❌ BAD: Doesn't match calculation
firstRowY: 50    // Should be 0 if startRow=0 and scrollY=0
```

### Step 3: Visual Inspection Commands

Run these in DevTools Console:

```javascript
// 1. Get all elements
const parent = document.querySelector('.channel-rack-layout__grid-scroll-area');
const spacer = document.querySelector('.unified-grid-container');
const canvasContainer = document.querySelector('.unified-grid-container + div');
const canvas = canvasContainer?.querySelector('canvas');
const firstRow = parent?.querySelector('.channel-rack-layout__grid-row');

// 2. Check positions
console.log('Element Positions:', {
  parentScroll: { x: parent.scrollLeft, y: parent.scrollTop },
  spacerOffset: { top: spacer.offsetTop, left: spacer.offsetLeft },
  canvasOffset: { top: canvasContainer.offsetTop, left: canvasContainer.offsetLeft },
  firstRowOffset: { top: firstRow?.offsetTop, left: firstRow?.offsetLeft },
});

// 3. Check sizes
console.log('Element Sizes:', {
  parentSize: { w: parent.clientWidth, h: parent.clientHeight },
  spacerSize: { w: spacer.offsetWidth, h: spacer.offsetHeight },
  canvasSize: { w: canvas.width, h: canvas.height },
  firstRowSize: { w: firstRow?.offsetWidth, h: firstRow?.offsetHeight },
});

// 4. Visual alignment check
const parentRect = parent.getBoundingClientRect();
const firstRowRect = firstRow?.getBoundingClientRect();
const canvasRect = canvas?.getBoundingClientRect();

console.log('Visual Alignment:', {
  parentTop: parentRect.top,
  firstRowTop: firstRowRect?.top,
  canvasTop: canvasRect?.top,
  offset: (firstRowRect?.top || 0) - (canvasRect?.top || 0),
});
```

---

## Common Issues and Fixes

### Issue 1: Canvas Offset from Parent

**Symptom**:
```javascript
// Canvas is not at top-left of parent
canvasContainer.offsetTop !== 0
canvasContainer.offsetLeft !== 0
```

**Diagnosis**: Canvas container position is wrong

**Fix**: Verify `position: absolute; top: 0; left: 0;` in UnifiedGridContainer

### Issue 2: Row Height Mismatch

**Symptom**:
```javascript
// DOM row height doesn't match ROW_HEIGHT constant
firstRow.offsetHeight !== 64
```

**Diagnosis**: CSS border or padding affecting height

**Fix**: Check `.channel-rack-layout__grid-row` CSS:
```css
.channel-rack-layout__grid-row {
  height: 64px;
  box-sizing: border-box; /* Important! */
  border-bottom: 1px solid ...; /* Included in 64px */
}
```

### Issue 3: Scroll Calculation Wrong

**Symptom**:
```javascript
// firstRowY doesn't match visual position
// Expected: startRow * 64 - scrollY
// Actual: Something else
```

**Diagnosis**: ScrollY not being read correctly

**Fix**: Log parent.scrollTop in updateViewportAndScroll

### Issue 4: Instrument Order Mismatch

**Symptom**:
```javascript
// Canvas shows different instruments than DOM
instrumentNames: ["Snare", "Hi-Hat", "Kick"]
// But DOM shows: ["Kick", "Snare", "Hi-Hat"]
```

**Diagnosis**: `instruments` array order doesn't match DOM

**Fix**: Verify `visibleInstruments` in ChannelRack matches DOM render order

---

## Expected Values (No Issues)

### At ScrollY = 0 (Top)

```javascript
📊 Viewport: {
  scroll: "X:0 Y:0",
  containerOffset: 0,
}

🎯 First Row: {
  relativeTop: 0,  // ✅ At top
  rowHeight: 64,   // ✅ Correct size
}

🎨 Render: {
  rows: "0-10 of 15",     // ✅ Starting from row 0
  firstRowY: 0,           // ✅ At Y=0
  instrumentNames: ["Kick", ...],  // ✅ First instrument
}
```

### At ScrollY = 128 (2 rows down)

```javascript
📊 Viewport: {
  scroll: "X:0 Y:128",
}

🎯 First Row: {
  relativeTop: -128,  // ✅ Scrolled up (negative)
  rowHeight: 64,
}

🎨 Render: {
  rows: "2-12 of 15",      // ✅ Starting from row 2
  firstRowY: 0,            // ✅ Row 2 at Y=0 in canvas (2*64-128=0)
  instrumentNames: ["Hi-Hat", ...],  // ✅ Third instrument (row 2)
}
```

---

## Remove Debug Logging

Once alignment is confirmed working:

### UnifiedGridContainer.jsx (lines 72-91)
```javascript
// Remove this entire block:
console.log('📊 Unified Canvas Viewport Update:', {...});
console.log('🎯 First Instrument Row:', {...});
```

### UnifiedGridCanvas.jsx (lines 93-101)
```javascript
// Remove this entire block:
console.log('🎨 Unified Canvas Render:', {...});
```

Or reduce to 1% sampling:
```javascript
if (Math.random() < 0.01) {
  console.log('🎨 Unified Canvas Render:', {...});
}
```

---

## Quick Test Procedure

1. **Open Channel Rack**
2. **Open DevTools Console**
3. **Scroll to top** (scrollY = 0)
4. **Check logs**:
   - First row `relativeTop` should be 0
   - Canvas `firstRowY` should be 0
   - Canvas `instrumentNames[0]` should match first DOM row

5. **Scroll down 2 rows** (~128px)
6. **Check logs**:
   - Scroll should show `Y:128`
   - Canvas `rows` should start from "2-..."
   - Canvas `firstRowY` should be 0 (or close)

7. **Visual check**:
   - Grid lines align with DOM rows?
   - Notes appear in correct rows?
   - Hover preview in correct position?

---

**Status**: Debug logging active, awaiting test results
**Next Step**: Run test procedure, report findings
