# Piano Roll Infinite Loop Fix

## Problem

**User Report**: "e.piano'yu ve diğer pianoları piano roll de açmak istediğimde bu hatayla karşılaşıyorum"

**Error Messages**:
```
Warning: The result of getSnapshot should be cached to avoid an infinite loop
Error: Maximum update depth exceeded
```

**Component**: `useNoteInteractionsV2.js:145`

**Symptom**:
- Piano Roll crashes when opening instruments
- Infinite re-render loop
- App becomes unresponsive

## Root Cause

### The Bug

Same issue as Mixer.jsx - using Zustand selector that returns new array on every call:

```javascript
// ❌ BEFORE: Creates NEW array on every call
const storedNotes = useArrangementStore(
    state => {
        if (!state.activePatternId || !currentInstrument) return [];
        const pattern = state.patterns[state.activePatternId];
        return pattern?.data?.[currentInstrument.id] || [];
    },
    shallow  // Even shallow comparison can't prevent infinite loop
);
```

**Why this causes infinite loop:**
1. Component renders
2. Selector function creates **new array** `[]`
3. Even if array content is same, it's a new reference
4. React detects change → re-render
5. Go to step 2 → infinite loop
6. React throws "Maximum update depth exceeded"

### Technical Details

The selector returns a **new array reference** on every call, even when the data inside hasn't changed. React's `useSyncExternalStore` (which Zustand uses) detects this as a non-cached `getSnapshot` function.

## Solution

### Use Individual Selectors + useMemo

Instead of returning derived data from selector, subscribe to primitives and derive with `useMemo`:

```javascript
// ✅ AFTER: Individual selectors + useMemo
const activePatternId = useArrangementStore(state => state.activePatternId);
const patterns = useArrangementStore(state => state.patterns);
const updatePatternNotes = useArrangementStore(state => state.updatePatternNotes);

// Derive storedNotes from patterns using useMemo (stable reference)
const storedNotes = useMemo(() => {
    if (!activePatternId || !currentInstrument) return [];
    const pattern = patterns[activePatternId];
    return pattern?.data?.[currentInstrument.id] || [];
}, [patterns, activePatternId, currentInstrument]);
```

**Why this works:**
- Each selector returns **stable primitive or object reference**
- `useMemo` creates **stable derived value**
- Only re-computes when dependencies actually change
- No infinite loop

## Implementation

### Files Changed

#### 1. `client/src/features/piano_roll_v7/hooks/useNoteInteractionsV2.js`

**Before**:
```javascript
import { shallow } from 'zustand/shallow';

const storedNotes = useArrangementStore(
    state => {
        if (!state.activePatternId || !currentInstrument) return [];
        const pattern = state.patterns[state.activePatternId];
        return pattern?.data?.[currentInstrument.id] || [];
    },
    shallow
);
const activePatternId = useArrangementStore(state => state.activePatternId);
const updatePatternNotes = useArrangementStore(state => state.updatePatternNotes);
```

**After**:
```javascript
// Removed shallow import

const activePatternId = useArrangementStore(state => state.activePatternId);
const patterns = useArrangementStore(state => state.patterns);
const updatePatternNotes = useArrangementStore(state => state.updatePatternNotes);

const storedNotes = useMemo(() => {
    if (!activePatternId || !currentInstrument) return [];
    const pattern = patterns[activePatternId];
    return pattern?.data?.[currentInstrument.id] || [];
}, [patterns, activePatternId, currentInstrument]);
```

## Benefits

### Performance
- ✅ No infinite loops
- ✅ Stable references prevent unnecessary re-renders
- ✅ `useMemo` only recomputes when dependencies change
- ✅ Individual selectors are more efficient than object selectors

### Code Quality
- ✅ Follows Zustand best practices
- ✅ Consistent with Mixer.jsx fix
- ✅ Easier to understand and maintain

## Pattern: Zustand Best Practices

### ❌ DON'T: Return derived data from selector
```javascript
// Creates new reference on every call
const data = useStore(
    state => state.items.filter(item => item.active),
    shallow
);
```

### ✅ DO: Subscribe to primitives, derive with useMemo
```javascript
const items = useStore(state => state.items);
const activeItems = useMemo(
    () => items.filter(item => item.active),
    [items]
);
```

### ❌ DON'T: Return objects from selector
```javascript
const { value1, value2 } = useStore(
    state => ({ value1: state.value1, value2: state.value2 }),
    shallow
);
```

### ✅ DO: Use individual selectors
```javascript
const value1 = useStore(state => state.value1);
const value2 = useStore(state => state.value2);
```

## Testing

### Verify Fix

1. Open Piano Roll for any instrument (e.g., E.Piano)
2. Check browser console
3. Should see NO warnings or errors

**Expected**:
```
🎹 PianoRoll: Starting UIUpdateManager-based viewport animation
✅ Piano Roll timeline registered
✅ Preview ready: E.Piano (vasynth)
```

**NOT Expected** (these should be gone):
```
❌ Warning: getSnapshot should be cached
❌ Error: Maximum update depth exceeded
```

### Test Cases

#### Test 1: Open Piano Roll
1. Double-click any instrument in Channel Rack
2. Piano Roll should open smoothly
3. No console errors

**Result**: ✅ Works

#### Test 2: Switch Between Instruments
1. Open Piano Roll for instrument A
2. Close it
3. Open Piano Roll for instrument B
4. Repeat several times

**Result**: ✅ No errors, smooth switching

#### Test 3: Edit Notes
1. Open Piano Roll
2. Add/remove/move notes
3. Check console for warnings

**Result**: ✅ No warnings, edits work correctly

## Related Fixes

This is the **same pattern** as previous fixes:

1. **Mixer.jsx** (Phase 1 Optimization)
   - Same issue: object selector with shallow
   - Same fix: individual selectors

2. **useNoteInteractionsV2.js** (This fix)
   - Same issue: array selector with shallow
   - Same fix: individual selectors + useMemo

### Pattern Recognition

**If you see this error**:
```
Warning: The result of getSnapshot should be cached
```

**Look for**:
```javascript
const data = useStore(
    state => ({ ... }) or state => [...],
    shallow
);
```

**Fix with**:
```javascript
const primitiveValue = useStore(state => state.value);
const derived = useMemo(() => ..., [primitiveValue]);
```

## Files Modified

1. ✅ `client/src/features/piano_roll_v7/hooks/useNoteInteractionsV2.js`
   - Removed `shallow` import
   - Changed to individual selectors
   - Added `useMemo` for derived data
   - Fixed infinite loop

## Lessons Learned

1. **Zustand selectors should return stable references**
   - Primitives are always stable
   - Objects/arrays need special handling

2. **`shallow` is not magic**
   - It compares object keys/values
   - But selector still creates new reference
   - React still detects this as non-cached

3. **useMemo is the right tool for derived data**
   - Stable reference until dependencies change
   - Works perfectly with Zustand
   - No infinite loops

4. **Individual selectors > Object selectors**
   - More performant
   - More predictable
   - Easier to debug

---

**Fixed**: 2025-10-19
**Bug Severity**: Critical - Piano Roll completely broken
**Root Cause**: Non-cached Zustand selector returning new array reference
**Impact**: App crashes when opening Piano Roll
**Solution**: Individual selectors + useMemo for derived data
