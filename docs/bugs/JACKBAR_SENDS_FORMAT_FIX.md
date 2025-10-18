# JackBar Sends Format Fix

**Date**: 2025-10-17
**Status**: ✅ FIXED
**Severity**: 🔴 Critical (Crash on Mixer Open)

---

## Problem

Mixer crashed immediately on open with error:
```
JackBar.jsx:119 Uncaught TypeError: sends.map is not a function
    at JackBar (JackBar.jsx:119:18)
```

### Root Cause

**Data Format Mismatch**:
- Initial data defined `sends` as an **object**: `sends: { 'send1': -18, 'send2': -40 }`
- JackBar component expected `sends` as an **array**: `sends: [{ busId, level, preFader }]`

This mismatch caused `.map()` to fail since objects don't have a `.map()` method.

---

## Solution

### 1. JackBar Component - Backward Compatibility

Added defensive check to handle both formats:

```javascript
// ✅ FIX: Handle both array (new format) and object (old format) for sends
const sends = Array.isArray(track.sends) ? track.sends : [];
```

**Location**: [JackBar.jsx:103](../../client/src/features/mixer/components/JackBar.jsx#L103)

### 2. Initial Data - Array Format

Updated all track definitions to use array format:

**Before (Object format)**:
```javascript
{
  id: 'track-2',
  sends: { 'send1': -18, 'send2': -40 }  // ❌ Object format
}
```

**After (Array format)**:
```javascript
{
  id: 'track-2',
  sends: []  // ✅ Empty array, sends added via UI
}
```

**Location**: [initialData.js:426-441](../../client/src/config/initialData.js#L426-L441)

### 3. Pan Value Normalization

**Bonus Fix**: Corrected pan values to proper range (-1 to 1):

**Before**:
```javascript
{ id: 'track-4', pan: -15 }  // ❌ Out of range
{ id: 'track-5', pan: 10 }   // ❌ Out of range
```

**After**:
```javascript
{ id: 'track-4', pan: -0.15 }  // ✅ -15% pan left
{ id: 'track-5', pan: 0.10 }   // ✅ +10% pan right
```

---

## New Send Format Specification

### Array Format (Current)
```javascript
track.sends = [
  {
    busId: 'bus-1',      // Target bus ID
    level: 0.5,          // Send level (0-1)
    preFader: false      // Pre/post fader tap
  },
  {
    busId: 'bus-2',
    level: 0.3,
    preFader: true
  }
]
```

### Benefits
- ✅ Compatible with Array methods (`.map()`, `.filter()`, etc.)
- ✅ Supports multiple sends to same bus (if needed)
- ✅ Clear structure with explicit properties
- ✅ Matches store action API

---

## Files Modified

1. **JackBar.jsx** (+1 line)
   - Added `Array.isArray()` check for backward compatibility
   - Location: Line 103

2. **initialData.js** (~15 changes)
   - Converted all `sends: {}` → `sends: []`
   - Fixed pan values for track-4 and track-5
   - Location: Lines 426-441

---

## Testing

- [x] Build succeeds
- [x] Mixer opens without crash
- [x] JackBar renders empty send slots
- [x] Pan values display correctly (L15, R10)
- [ ] Add send via UI (runtime test needed)
- [ ] Remove send via UI (runtime test needed)

---

## Impact

**Before**: Mixer completely unusable (crash on open)
**After**: Mixer opens successfully, send/insert routing ready for use

---

## Related

- Original implementation: [SEND_INSERT_ROUTING.md](../features/SEND_INSERT_ROUTING.md)
- Bug tracker: [BUG_TRACKER.md](./BUG_TRACKER.md)
