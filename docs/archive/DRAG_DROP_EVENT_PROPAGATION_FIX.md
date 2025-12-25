# 🐛 Drag & Drop Event Propagation Conflict

**Date**: 2025-10-17
**Status**: ✅ FIXED
**Severity**: High (Core functionality blocked)
**Files Affected**:
- `client/src/features/arrangement_v2/components/PatternBrowser.jsx`
- `client/src/features/arrangement_v2/ArrangementPanelV2.jsx`

---

## Problem Description

### User Report
> "aranje paneli arkasında sadece 'channel rack' açık iken patterns tabı içerisinde drag eventi çalışmıyor. channel rack minimize edildiğinde çalışıyor."

### Symptoms
1. When Channel Rack is open behind Arrangement Panel
2. Dragging patterns from Pattern Browser (inside Arrangement Panel)
3. Drag events don't work - patterns can't be dropped
4. **Works when Channel Rack is minimized**
5. Works with other panels open (only Channel Rack causes issue)

### Root Cause
**Event Propagation Conflict with DraggableWindow**

The issue was NOT a z-index problem, but an event propagation conflict:

1. Pattern Browser is rendered inside ArrangementPanelV2
2. ArrangementPanelV2 is wrapped in a `<DraggableWindow>` component
3. DraggableWindow has its own `onDragStart` handler (line 64):
   ```jsx
   onDragStart={() => setIsDragging(true)}
   ```
4. When user drags a pattern from Pattern Browser:
   - Pattern's `onDragStart` fires first
   - Event bubbles up to DraggableWindow
   - DraggableWindow's handler interferes with drag data
   - Drop event fails

### Why It Worked When Channel Rack Was Minimized
When minimized, Channel Rack doesn't render its window, so there's less event interference.

---

## Solution

### Fix #1: Stop Propagation in Pattern Browser

**File**: `client/src/features/arrangement_v2/components/PatternBrowser.jsx`

Added `e.stopPropagation()` to prevent events from bubbling to parent DraggableWindow:

```javascript
const handleDragStart = (e, patternId) => {
  console.log('🎯 PatternBrowser handleDragStart called!');

  // CRITICAL FIX: Stop event propagation to prevent DraggableWindow from interfering
  e.stopPropagation();

  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('application/x-dawg-pattern', patternId);

  console.log('✅ Drag data set:', patternId);
};

const handleAudioDragStart = (e, sample) => {
  console.log('🎯 Audio drag start called!');

  // CRITICAL FIX: Stop event propagation to prevent DraggableWindow from interfering
  e.stopPropagation();

  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('application/x-dawg-audio', sample.assetId);

  console.log('✅ Audio drag data set:', sample.assetId);
};
```

### Fix #2: Stop Propagation in Arrangement Panel

**File**: `client/src/features/arrangement_v2/ArrangementPanelV2.jsx`

Added `e.stopPropagation()` to drag event handlers:

```javascript
const handleDragOver = useCallback((e) => {
  e.preventDefault();
  e.stopPropagation(); // Prevent event from bubbling to parent panels
  e.dataTransfer.dropEffect = 'copy';
  // ... rest of handler
}, [...]);

const handleDrop = useCallback((e) => {
  e.preventDefault();
  e.stopPropagation(); // Prevent event from bubbling to parent panels
  console.log('🎯 ArrangementPanel handleDrop called');

  try {
    const patternId = e.dataTransfer.getData('application/x-dawg-pattern');
    if (patternId) {
      console.log('✅ Pattern drop detected:', patternId);
      handlePatternDrop(e, patternId);
      return;
    }
    // ... rest of handler
  }
}, [...]);
```

---

## Key Lessons Learned

### ⚠️ Event Propagation in Nested Draggable Elements

When implementing drag & drop in nested components where parent has drag handlers:

1. **ALWAYS use `e.stopPropagation()`** in child drag handlers
2. Parent's drag handlers will interfere with child's drag data
3. This is especially critical in panel-based UIs with `DraggableWindow` wrappers

### ⚠️ Debug Checklist for Drag & Drop Issues

If drag & drop isn't working:

1. ✅ Check z-index (is the correct panel on top?)
2. ✅ Check event propagation (are parent handlers interfering?)
3. ✅ Check event.dataTransfer (is drag data being set correctly?)
4. ✅ Test with parent elements hidden/minimized (isolates propagation issues)

### 🎯 Console Logging Strategy

Added debug logs to track event flow:
```javascript
console.log('🎯 PatternBrowser handleDragStart called!');
console.log('✅ Drag data set:', patternId);
console.log('🎯 ArrangementPanel handleDrop called');
console.log('✅ Pattern drop detected:', patternId);
```

These help identify:
- Which handlers are firing
- In what order they fire
- Whether drag data is set correctly

---

## False Leads (What DIDN'T Work)

### ❌ Attempt 1: Z-Index Manipulation
Tried to dynamically bring arrangement panel to front:
```javascript
usePanelsStore.getState().bringPanelToFront('arrangement-v2');
```
**Result**: Didn't fix the issue. Panel stack was already correct.

### ❌ Attempt 2: Pointer-Events CSS
Tried to use `pointer-events: none` on Channel Rack:
```css
.channel-rack-layout {
  pointer-events: none;
}
```
**Result**: Would break all Channel Rack interactions. Not a valid solution.

### ❌ Attempt 3: Manual Z-Index DOM Manipulation
Tried to force z-index via DOM:
```javascript
const arrangementWindow = document.querySelector('[data-panel-id="arrangement-v2"]');
arrangementWindow.style.zIndex = newZIndex;
```
**Result**: Unnecessary complexity. Real issue was event propagation, not z-index.

---

## Related Issues

- Panel stack system works correctly with `bringPanelToFront()`
- DraggableWindow component has built-in drag handlers for window dragging
- Nested draggable elements require explicit `stopPropagation()`

---

## Testing Checklist

- [x] Drag pattern from Pattern Browser → Arrangement (Channel Rack open)
- [x] Drag pattern from Pattern Browser → Arrangement (Channel Rack minimized)
- [x] Drag audio from Audio tab → Arrangement (Channel Rack open)
- [x] Window dragging still works (header drag not affected)
- [x] Console logs show correct event firing order
- [x] Pattern preview shows during drag
- [x] Drop creates clip at correct position

---

## Prevention

To avoid this issue in the future:

1. **Document DraggableWindow behavior**: Any child drag handlers MUST use `stopPropagation()`
2. **Add to component docs**: Mention this requirement in DraggableWindow.jsx comments
3. **Code review checklist**: Check for `stopPropagation()` in nested drag handlers
4. **Test with multiple panels**: Always test drag & drop with various panel configurations

---

## Code References

- Pattern Browser drag handlers: `PatternBrowser.jsx:26-48`
- Arrangement drop handlers: `ArrangementPanelV2.jsx:1838-1849, 1920-1933`
- DraggableWindow drag handler: `DraggableWindow.jsx:64`
- Panel stack system: `usePanelsStore.js:47-56`

---

**Resolution Time**: ~2 hours
**Debugging Approach**: Systematic elimination + user testing feedback
**Final Solution**: 4 lines of code (`e.stopPropagation()` in 4 handlers)
