# Immediate Fix Plan - ContinuousScheduler Activation

**Date:** 24 Ocak 2026
**Goal:** Get ContinuousScheduler working by completely disabling old system

---

## 🔴 Critical Issues (From Analysis Report)

1. **PlaybackManager** - 146KB god object with 8+ responsibilities
2. **Multiple State Sources** - 5 different position sources causing conflicts
3. **Timing Anchor Reset** - Complex BPM change handling
4. **Old Scheduler Still Active** - Conflicts with ContinuousScheduler

---

## 🎯 Immediate Actions (Today)

### Phase 0: Emergency Cleanup

**Objective:** Make ONLY ContinuousScheduler handle scheduling

#### Action 1: Disable Old Pattern Scheduling in PlaybackService.play()

**File:** `client/src/lib/core/services/PlaybackService.js`

**Current problem:**
```javascript
// Line 204-282
if (this.schedulerService) {
    // ❌ Old system still scheduling patterns!
    this.schedulerService.schedulePattern(...)
}
```

**Fix:** Already applied but need to verify complete removal

**Status:** ✅ DONE (lines 207-211 now skip if ContinuousScheduler active)

---

#### Action 2: Verify Event Bindings

**File:** `client/src/lib/core/services/PlaybackServiceAdapter.js`

**Current problem:**
- Events not firing: `NOTE_ADDED` vs `pattern:notes-added`

**Fix:** ✅ DONE (both formats now listened)

**Status:** ✅ DONE (lines 185-196 listen to NOTE_ADDED)

---

#### Action 3: Debug Pattern Data Access

**Issue:** ContinuousScheduler may not be reading pattern data correctly

**Test Required:**
```javascript
// In browser console
const scheduler = window.playbackService.schedulerAdapter.continuousScheduler;
const pattern = scheduler.patternStore.patterns['pattern-1'];
console.log('Pattern data:', pattern?.data);
```

**Expected:** Object with instrument arrays
**Current:** Unknown - NEEDS TESTING

---

## 🔍 Diagnostic Steps

### Step 1: Check Pattern Store Access

Run in browser console:
```javascript
const adapter = window.playbackService?.schedulerAdapter;
const scheduler = adapter?.continuousScheduler;

console.log('=== PATTERN STORE CHECK ===');
console.log('activePatternId:', scheduler.patternStore.activePatternId);
console.log('patterns:', scheduler.patternStore.patterns);

const activeId = scheduler.patternStore.activePatternId;
if (activeId) {
    const pattern = scheduler.patternStore.patterns[activeId];
    console.log('Pattern:', pattern);
    console.log('Pattern.data:', pattern?.data);

    if (pattern?.data) {
        Object.keys(pattern.data).forEach(instId => {
            console.log(`  ${instId}:`, pattern.data[instId]?.length, 'notes');
        });
    }
}
```

**Expected Output:**
```
=== PATTERN STORE CHECK ===
activePatternId: "pattern-1"
patterns: {pattern-1: {...}}
Pattern: {id: "pattern-1", name: "...", data: {...}}
Pattern.data: {hihat-1: Array(4), ...}
  hihat-1: 4 notes
```

---

### Step 2: Check Event Flow

Add temporary debug to PlaybackServiceAdapter:

```javascript
// In _bindStoreEvents()
EventBus.on('NOTE_ADDED', (data) => {
    console.log('🔔 NOTE_ADDED event received:', data);
    this.onNotesAdded(data.patternId, data.notes || [data.note]);
});
```

**Expected Flow:**
```
1. User adds note
2. 🔔 NOTE_ADDED event received
3. ➕ [PlaybackServiceAdapter] Notes added
4. 🏷️ [ContinuousScheduler] Marked dirty
5. ➕ [ContinuousScheduler] Filled window
```

---

### Step 3: Check Loop Detection

**Current Issue:** Position jump not detected

**Debug Code:**
```javascript
// In ContinuousScheduler.tick()
console.log('Position check:', {
    lastScheduledTick: this.lastScheduledTick,
    windowStartTick: windowStartTick,
    jumped: this._detectPositionJump(windowStartTick)
});
```

**Expected on loop restart:**
```
Position check: {
    lastScheduledTick: 384,
    windowStartTick: 0,
    jumped: true  ← Should be true!
}
```

---

## 🐛 Known Issues To Fix

### Issue 1: Position Jump Detection Not Working

**File:** `ContinuousScheduler.js:518-526`

**Current:**
```javascript
_detectPositionJump(currentWindowStartTick) {
    if (this.lastScheduledTick < 0) return false;

    const jumpThreshold = 100; // ticks
    const expectedMinimum = this.lastScheduledTick - jumpThreshold;

    return currentWindowStartTick < expectedMinimum;
}
```

**Problem:** `lastScheduledTick` might not be updated correctly

**Debug:** Add logging to see actual values

---

### Issue 2: Pattern Data Structure Mismatch

**Expected by ContinuousScheduler:**
```javascript
pattern.data = {
    "hihat-1": [
        {id: "note_1", time: 1, pitch: "C4", velocity: 100, length: 1}
    ]
}
```

**Actual:** Unknown - needs verification

---

### Issue 3: Tick/Time Conversion

**Critical Methods:**
- `_timeToTick(time)` - Converts audio time to tick
- `_tickToTime(tick)` - Converts tick to audio time

**Verification:**
```javascript
const scheduler = window.playbackService.schedulerAdapter.continuousScheduler;
const audioTime = scheduler.audioContext.currentTime;
const tick = scheduler._timeToTick(audioTime);
const backToTime = scheduler._tickToTime(tick);

console.log({audioTime, tick, backToTime});
// audioTime and backToTime should be close
```

---

## 📋 Checklist

### Pre-Test
- [x] Old PlaybackService scheduling disabled
- [x] Event listeners bound to NOTE_ADDED/NOTE_REMOVED
- [x] ContinuousScheduler initialized
- [ ] Pattern data structure verified
- [ ] Tick conversion verified

### During Test
- [ ] Play button starts ContinuousScheduler
- [ ] Adding note triggers NOTE_ADDED event
- [ ] Dirty flag set on note add
- [ ] Notes scheduled in window
- [ ] Loop restart detected as position jump
- [ ] All future events cleared on loop restart
- [ ] Notes re-scheduled after loop restart

### Debug Outputs
- [ ] `schedulerDiag.status()` shows 100/100 health
- [ ] `eventsScheduled` > 0
- [ ] `eventsExecuted` ≈ `eventsScheduled`
- [ ] `eventsInMap` > 0 during playback
- [ ] Position jump log appears on loop restart

---

## 🚀 Next Steps After Fix

Once ContinuousScheduler is working:

### Short Term (Week 1)
1. Add comprehensive logging
2. Monitor for 24h in production
3. Collect performance metrics
4. Document gotchas

### Medium Term (Week 2-4)
1. Remove dead code from PlaybackService
2. Extract LoopRestartHandler (per analysis report)
3. Add unit tests for ContinuousScheduler
4. Performance benchmarks

### Long Term (Month 2-3)
1. Full refactoring per analysis report
2. PlaybackManager decomposition
3. Timing specification formal docs
4. Component extraction (PatternScheduler, etc.)

---

## 📊 Success Criteria

**Minimum Viable:**
- ✅ Notes play on first loop
- ✅ Notes play on subsequent loops
- ✅ Adding notes during playback works
- ✅ Removing notes during playback works
- ✅ No duplicate scheduling
- ✅ No race conditions

**Optimal:**
- ✅ All above PLUS:
- ✅ Position jump detected < 1ms
- ✅ Scheduling latency ≤ 25ms
- ✅ CPU usage < 5% for scheduler
- ✅ No memory leaks over 1hr
- ✅ Clean console logs (no errors/warnings)

---

**Current Status:** Testing needed - refresh and run diagnostics

**Blocker:** Unknown if pattern data structure matches ContinuousScheduler expectations
