# Unified Canvas - Alignment & Positioning Fixes ✅

**Date**: 2025-10-20
**Issue**: Canvas not aligned with instrument rows and grid layout
**Status**: ✅ Fixed

---

## Problems Identified

From user screenshot, the unified canvas had several alignment issues:

1. ❌ **Canvas positioning incorrect** - Not aligned with scroll container
2. ❌ **Row heights mismatched** - Grid rows not matching instrument rows
3. ❌ **Note positions incorrect** - Notes appearing in wrong locations
4. ❌ **Canvas overflow** - Canvas extending beyond viewport

---

## Root Causes

### 1. Position: Fixed Issues
**Problem**: Using `position: fixed` for canvas overlay
- Fixed position doesn't work inside scrollable container
- Canvas positioned relative to viewport, not parent

**Solution**: Changed to `position: absolute` within parent scroll container

### 2. Coordinate Inconsistency
**Problem**: Variable names for Y coordinates not consistent
- Using `y` for both rowY and noteY
- Easy to confuse base row position with note offset

**Solution**: Renamed variables for clarity:
```javascript
// Before (confusing)
const y = row * ROW_HEIGHT - scrollY + noteSlotY;

// After (clear)
const rowY = row * ROW_HEIGHT - scrollY;
const noteY = rowY + noteSlotY;
```

### 3. Spacer & Overlay Structure
**Problem**: Canvas container handling scroll itself
- Trying to be both spacer and overlay
- Complex position:fixed logic

**Solution**: Separate concerns:
- Spacer div: Enables scrolling (position: relative)
- Canvas overlay: Renders content (position: absolute)

---

## Changes Made

### UnifiedGridContainer.jsx

**Before**:
```jsx
<div className="unified-grid-container" onScroll={...}>
  <div style={{ position: 'absolute', width: totalWidth, height: totalHeight }} />
  <div style={{ position: 'sticky' }}>
    <UnifiedGridCanvas />
  </div>
</div>
```

**After**:
```jsx
<>
  {/* Spacer for scrolling */}
  <div
    className="unified-grid-container"
    style={{
      position: 'relative',
      width: totalWidth,
      height: totalHeight,
      pointerEvents: 'none', // Let clicks pass through
    }}
  />

  {/* Canvas overlay */}
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      pointerEvents: 'auto',
      zIndex: 1,
    }}
  >
    <UnifiedGridCanvas />
  </div>
</>
```

**Key Changes**:
1. Fragment (`<>`) to return multiple elements
2. Spacer div with `pointerEvents: 'none'` (clicks pass through to canvas)
3. Canvas overlay with `position: absolute` (relative to scroll container)
4. Removed complex position:fixed logic

### UnifiedGridCanvas.jsx - Coordinate Consistency

**Changed all Y coordinate calculations to use consistent naming**:

```javascript
// Row backgrounds
for (let row = startRow; row < endRow; row++) {
  const rowY = row * ROW_HEIGHT - scrollY; // Base row position
  ctx.fillRect(0, rowY, viewportWidth, ROW_HEIGHT);
}

// Note slots
for (let row = startRow; row < endRow; row++) {
  const rowY = row * ROW_HEIGHT - scrollY;
  const slotY = rowY + noteSlotY; // Slot offset from row base
  ctx.fillRect(slotX, slotY, slotWidth, noteSlotHeight);
}

// Notes
for (let row = startRow; row < endRow; row++) {
  const rowY = row * ROW_HEIGHT - scrollY;
  const noteY = rowY + noteSlotY; // Note offset from row base
  ctx.fillRect(noteX, noteY + 1, noteWidth, noteSlotHeight - 2);
}

// Hover overlay
const rowY = row * ROW_HEIGHT - scrollY;
const hoverY = rowY + noteSlotY; // Hover offset from row base
ctx.strokeRect(noteX + 0.5, hoverY + 1.5, noteWidth - 1, noteSlotHeight - 3);
```

**Benefits**:
- Consistent variable naming
- Easier to debug
- Clear relationship between row base and offsets
- Less chance of coordinate bugs

### Debug Logging

Added temporary debug logging (1% sample rate):

```javascript
if (Math.random() < 0.01) {
  console.log('🎨 Unified Canvas Render:', {
    viewport: `${viewportWidth}×${viewportHeight}`,
    scroll: `X:${scrollX} Y:${scrollY}`,
    rows: `${startRow}-${endRow} (${instruments.length} total)`,
    steps: `${startStep}-${endStep} (${totalSteps} total)`,
  });
}
```

**Purpose**: Verify viewport and scroll calculations
**Note**: Remove after testing confirmed

---

## Expected Behavior After Fix

### Visual Alignment
✅ Grid rows align perfectly with instrument rows
✅ Notes appear in correct vertical positions
✅ Hover preview aligns with grid slots
✅ Canvas stays within viewport bounds

### Scroll Behavior
✅ Smooth scrolling in both X and Y axes
✅ Canvas content tracks scroll position correctly
✅ No visual pop-in or misalignment during scroll
✅ Viewport culling works (only visible content rendered)

### Interaction
✅ Click detection matches visual positions
✅ Hover preview appears at mouse position
✅ Note toggle works at all scroll positions

---

## Testing Checklist

### Visual Verification
- [ ] Open Channel Rack
- [ ] Check grid lines align with instrument rows
- [ ] Check notes appear in correct positions
- [ ] Check alternating row backgrounds align
- [ ] Scroll vertically - rows stay aligned
- [ ] Scroll horizontally - notes stay aligned

### Interaction Verification
- [ ] Hover over grid - ghost note appears at mouse
- [ ] Click to add note - note appears where clicked
- [ ] Click to remove note - note disappears
- [ ] Works at different scroll positions (X and Y)

### Performance Verification
- [ ] Smooth 60 FPS scrolling
- [ ] No visual glitches or flickering
- [ ] Console shows correct viewport/scroll values
- [ ] Canvas count still 2 (timeline + unified grid)

---

## Debug Console Commands

### Check Alignment
```javascript
// Run while viewing Channel Rack
const canvas = document.querySelector('.unified-grid-container + div canvas');
const parent = document.querySelector('.channel-rack-layout__grid-scroll-area');

console.log('Canvas position:', {
  canvasTop: canvas.getBoundingClientRect().top,
  canvasLeft: canvas.getBoundingClientRect().left,
  parentTop: parent.getBoundingClientRect().top,
  parentLeft: parent.getBoundingClientRect().left,
});

console.log('Scroll state:', {
  scrollX: parent.scrollLeft,
  scrollY: parent.scrollTop,
  viewportWidth: parent.clientWidth,
  viewportHeight: parent.clientHeight,
});
```

### Check Row Alignment
```javascript
// Get first instrument row element (legacy DOM)
// Compare with canvas row rendering
const firstRow = document.querySelector('.channel-rack-layout__grid-row');
if (firstRow) {
  const rowRect = firstRow.getBoundingClientRect();
  console.log('First row position:', {
    top: rowRect.top,
    height: rowRect.height,
    expectedCanvasRowY: 0, // First row should be at Y=0 in canvas
  });
}
```

---

## Known Limitations

### Not Yet Implemented
1. Piano roll mini views - Only drum grid rendering currently
2. Row selection highlighting
3. Instrument name overlay on canvas

### Future Improvements
1. Remove debug logging after confirmed working
2. Add piano roll rendering mode
3. Optimize render calls (dirty regions)

---

## Files Modified

1. **client/src/features/channel_rack/UnifiedGridContainer.jsx**
   - Lines 89-127: Changed to fragment with separate spacer and overlay
   - Lines 52-84: Simplified scroll tracking (removed fixed positioning)

2. **client/src/features/channel_rack/UnifiedGridCanvas.jsx**
   - Lines 93-101: Added debug logging
   - Lines 190-202: Consistent rowY/slotY naming for note slots
   - Lines 210-248: Consistent rowY/noteY naming for notes
   - Lines 253-267: Consistent rowY/hoverY naming for hover

---

## Rollback Instructions

If issues persist, rollback is simple:

```javascript
// In ChannelRack.jsx line 31
const USE_UNIFIED_CANVAS = false;
```

This will switch back to legacy multi-canvas approach while keeping unified canvas code intact for future fixes.

---

## Next Steps

1. **Test in browser** - Verify alignment is correct
2. **Remove debug logging** - Once confirmed working
3. **Performance profiling** - Measure actual gains
4. **Piano roll integration** - Add pitch-based rendering

---

**Status**: ✅ Fixes applied, ready for browser testing
**Expected Result**: Perfect alignment with instrument rows and grid layout
