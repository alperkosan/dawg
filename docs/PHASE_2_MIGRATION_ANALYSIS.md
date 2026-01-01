# 🔍 Phase 2: Migration Analysis & Plan

**Date**: 2025-12-27 14:45
**Status**: ANALYSIS COMPLETE

---

## 📊 Current Singleton Usage Analysis

### 1. PlaybackController Usage
**Primary Users:**
- `store/usePlaybackStore.js` - Main integration point
- `hooks/useSystemBoot.js` - Initialization
- Various components via store

**Key Methods Used:**
- `play()`, `stop()`, `pause()`, `resume()`
- `togglePlayPause()`
- `setBPM()`
- `setLoopPoints()`
- Event listeners via singleton lifecycle

### 2. TransportManager Usage
**Primary Users:**
- `hooks/useTransportManager.js` - **MOST IMPORTANT** hook
- `hooks/useSystemBoot.js` - Initialization
- `features/piano_roll_v7/PianoRoll.jsx` - Direct sync access

**Key Methods Used:**
- Position tracking
- Playback state
- getCurrentPosition()
- Event subscriptions

### 3. TimelineController Usage
**Need to search...**

---

## 🎯 Migration Strategy (Safe & Methodical)

### Phase A: Wrapper Layer (NO BREAKING CHANGES)
**Goal**: Make old singletons delegate to TransportController

1. ✅ Keep old singleton files
2. ✅ Make them thin wrappers around TransportController
3. ✅ All existing code works unchanged
4. ✅ Test everything still works

### Phase B: Gradual Migration
**Goal**: Update critical paths one by one

1. Update `usePlaybackStore` to use TransportController
2. Update `useTransportManager` hook
3. Update direct usages
4. Test after each change

### Phase C: Cleanup
**Goal**: Remove old code safely

1. Delete old singleton files
2. Remove from exports
3. Final testing

---

## 🛠️ Step-by-Step Plan

### STEP 3A: Create Wrapper Compatibility Layer
**Files to modify:**
- `PlaybackControllerSingleton.js` → Delegate to TransportController
- `TransportManagerSingleton.js` → Delegate to TransportController

**Benefits:**
- ✅ Zero breaking changes
- ✅ Test immediately
- ✅ Rollback easy if needed
- ✅ Can deploy incrementally

### STEP 3B: Update usePlaybackStore
**File**: `store/usePlaybackStore.js`
- Replace PlaybackController with TransportController
- Map all method calls
- Test thoroughly

### STEP 3C: Update useTransportManager
**File**: `hooks/useTransportManager.js`
- Replace TransportManager with TransportController
- Keep same hook API
- Test all consumers

### STEP 3D: Update Direct Usages
**Files**:
- `hooks/useSystemBoot.js`
- `features/piano_roll_v7/PianoRoll.jsx`
- Any other direct imports

### STEP 3E: Delete Old Code
- Remove wrapper delegates
- Delete old singleton files
- Update exports
- Final regression testing

---

## ⚠️ Critical: Method Mapping

Need to ensure ALL methods from old singletons exist in TransportController:

### PlaybackController → TransportController
```javascript
// Already mapped:
✅ play() → play()
✅ stop() → stop()
✅ pause() → pause()
✅ resume() → resume()
✅ togglePlayPause() → togglePlayPause()
✅ setBPM() → setBPM()
✅ setLoopPoints() → setLoopPoints()
✅ getState() → getState()

// Need to verify:
⚠️ Event listeners (lifecycle events)
⚠️ Any other methods?
```

### TransportManager → TransportController
```javascript
// Need to map:
⚠️ getCurrentPosition()
⚠️ Position tracking state
⚠️ Event subscriptions
⚠️ UIUpdateManager integration?
```

---

## 🚀 Let's Start: STEP 3A

**Next Action**: Create compatibility wrappers

This allows us to:
1. Test integration immediately
2. Keep all existing code working
3. Migrate gradually without risk
4. Rollback easily if issues

**Ready to proceed with Step 3A?**

