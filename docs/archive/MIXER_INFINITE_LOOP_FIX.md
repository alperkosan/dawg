# Mixer Infinite Loop Fix

## Problem

**Error**: "Warning: The result of getSnapshot should be cached to avoid an infinite loop"

**Location**: `Mixer.jsx:43`

**Symptom**: Console warning about infinite loop in Zustand selector

## Root Cause

### The Bug

When using Zustand with a selector that returns a new object on every call, combined with `shallow` comparison, React detects that `getSnapshot` is not properly cached.

```javascript
// ❌ PROBLEM: Creates NEW object on every call
const { mixerTracks, addTrack, ... } = useMixerStore(
  state => ({
    mixerTracks: state.mixerTracks,  // New object reference
    addTrack: state.addTrack,
    // ...
  }),
  shallow  // Even shallow comparison sees new object reference
);
```

**Why this causes infinite loop:**
1. Component renders
2. Selector creates new object `{ mixerTracks: ..., addTrack: ... }`
3. `shallow` comparison sees new object reference (different from last)
4. Triggers re-render
5. Go to step 2 → infinite loop

### Technical Explanation

Zustand's `shallow` comparison compares the **keys and values** of objects:
```javascript
// Shallow comparison
const obj1 = { a: 1, b: 2 };
const obj2 = { a: 1, b: 2 };

// obj1 !== obj2  (different references)
// But shallow(obj1, obj2) === true (same keys and values)
```

However, when the selector creates a **new object on every render**, even though the keys/values are same, the **selector function itself** is being called repeatedly, which React's useSyncExternalStore detects as a non-cached getSnapshot.

## Solution

### Use Individual Selectors (Recommended)

Instead of returning an object from selector, subscribe to each value individually:

```javascript
// ✅ SOLUTION: Each selector is stable and cached
const mixerTracks = useMixerStore(state => state.mixerTracks);
const addTrack = useMixerStore(state => state.addTrack);
const removeTrack = useMixerStore(state => state.removeTrack);
const toggleMute = useMixerStore(state => state.toggleMute);
const toggleSolo = useMixerStore(state => state.toggleSolo);

const activeChannelId = useMixerUIStore(state => state.activeChannelId);
const setActiveChannelId = useMixerUIStore(state => state.setActiveChannelId);
```

**Why this works:**
- Each selector returns a **primitive value or stable reference**
- Zustand automatically caches each selector
- No new objects created on every render
- React doesn't detect infinite loop

### Alternative: useCallback (More Complex)

If you really need to destructure, use `useCallback`:

```javascript
// ✅ ALTERNATIVE: Cache selector with useCallback
const selector = useCallback(
  state => ({
    mixerTracks: state.mixerTracks,
    addTrack: state.addTrack,
    // ...
  }),
  []
);

const { mixerTracks, addTrack, ... } = useMixerStore(selector, shallow);
```

But this is more verbose and harder to maintain.

## Implementation

### Before (Buggy)
```javascript
// File: client/src/features/mixer/Mixer.jsx

import { shallow } from 'zustand/shallow';

const {
  mixerTracks,
  addTrack,
  removeTrack,
  toggleMute,
  toggleSolo
} = useMixerStore(
  state => ({
    mixerTracks: state.mixerTracks,
    addTrack: state.addTrack,
    removeTrack: state.removeTrack,
    toggleMute: state.toggleMute,
    toggleSolo: state.toggleSolo
  }),
  shallow  // ❌ Causes infinite loop warning
);
```

### After (Fixed)
```javascript
// File: client/src/features/mixer/Mixer.jsx

// ✅ Individual selectors - stable and cached
const mixerTracks = useMixerStore(state => state.mixerTracks);
const addTrack = useMixerStore(state => state.addTrack);
const removeTrack = useMixerStore(state => state.removeTrack);
const toggleMute = useMixerStore(state => state.toggleMute);
const toggleSolo = useMixerStore(state => state.toggleSolo);

const activeChannelId = useMixerUIStore(state => state.activeChannelId);
const setActiveChannelId = useMixerUIStore(state => state.setActiveChannelId);
```

## Performance Impact

### Question: "Won't multiple subscriptions hurt performance?"

**Answer: No!** Actually, it's **better** for performance.

**Individual selectors:**
```javascript
const mixerTracks = useMixerStore(state => state.mixerTracks);
const addTrack = useMixerStore(state => state.addTrack);
```
- Component re-renders **only** when `mixerTracks` changes
- `addTrack` change doesn't trigger re-render (functions are stable)

**Object selector:**
```javascript
const { mixerTracks, addTrack } = useMixerStore(
  state => ({ mixerTracks: state.mixerTracks, addTrack: state.addTrack }),
  shallow
);
```
- Component re-renders when **any key** in object changes
- More comparisons to do (check all keys)
- New object allocation on every call

**Conclusion:** Individual selectors are **more performant** and **more stable**.

## Zustand Best Practices

### ✅ DO: Use individual selectors
```javascript
const value1 = useStore(state => state.value1);
const value2 = useStore(state => state.value2);
```

### ✅ DO: Use simple selectors
```javascript
const user = useStore(state => state.user);
```

### ✅ DO: Use derived selectors with useMemo
```javascript
const user = useStore(state => state.user);
const userName = useMemo(() => user?.name, [user]);
```

### ❌ DON'T: Return new objects without caching
```javascript
const { value1, value2 } = useStore(
  state => ({ value1: state.value1, value2: state.value2 }),
  shallow
);
```

### ❌ DON'T: Return new arrays without caching
```javascript
const items = useStore(state => state.items.filter(item => item.active));
// New array on every render! Use useMemo instead
```

### ✅ DO: Cache derived values with useMemo
```javascript
const items = useStore(state => state.items);
const activeItems = useMemo(
  () => items.filter(item => item.active),
  [items]
);
```

## Related Warnings

### "Cannot update a component while rendering a different component"

This can also happen with improper Zustand selectors. Fix: Use individual selectors.

### "Too many re-renders"

Caused by infinite loops from non-cached selectors. Fix: Use individual selectors.

## Files Changed

1. ✅ `client/src/features/mixer/Mixer.jsx`
   - Removed `shallow` import
   - Changed object selector to individual selectors
   - Fixed infinite loop warning

## Testing

### Verify Fix
1. Open app in browser
2. Open Mixer panel
3. Open Console
4. Check for warnings

**Expected**: No "getSnapshot should be cached" warnings

### Performance Test
```javascript
// Should work smoothly
window.performanceHelpers.addManyChannels(50);
```

**Expected**:
- No console warnings
- Smooth performance
- 60 FPS

## Lessons Learned

1. **Zustand selectors should be stable**
   - Don't create new objects/arrays
   - Use individual selectors for multiple values
   - Cache derived values with useMemo

2. **`shallow` is not a silver bullet**
   - It compares object keys/values
   - But selector still creates new object reference
   - Individual selectors are cleaner

3. **React's useSyncExternalStore is strict**
   - Detects non-cached selectors
   - Warns about potential infinite loops
   - Follow best practices to avoid warnings

---

**Fixed**: 2025-10-19
**Bug Severity**: Warning - potential infinite loop
**Root Cause**: Non-cached Zustand selector returning new object
**Impact**: Console warning, potential performance issues
**Solution**: Individual selectors instead of object selector
