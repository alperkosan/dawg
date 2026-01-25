# Loop Restart Fix - Notaların Tekrar Çalmaması Sorunu

**Date:** 24 Ocak 2026
**Status:** 🔧 Fix Applied

---

## 🐛 Problem

Loop restart olduğunda notalar çalmıyordu:
- ✅ Yeni eklenen notalar çalıyordu
- ❌ Pattern'de zaten olan notalar çalmıyordu (sadece ilk loopda)
- ❌ İkinci, üçüncü loop'ta sessizlik

**User feedback:**
> "loop restart olduğunda ses çalmıyor (sadece önceki loopta olmayan notalar schedule ediliyor)"

---

## 🔍 Root Cause Analysis

### Problem 1: Event ID Collision

Event ID generation:
```javascript
_generateEventId(noteData) {
    return `${noteData.patternId}_${noteData.instrumentId}_${noteData.tick.toFixed(1)}_${noteData.pitch}`;
}
```

**Bu tick position kullanıyor!** Yani:
- Loop 0: tick 96'da C4 → eventId: `pattern-1_kick_96.0_60`
- Loop 1: tick 96'da C4 → **AYNI eventId**: `pattern-1_kick_96.0_60`

### Problem 2: Incomplete Event Clearing

Loop restart olduğunda `_clearFutureEvents()` çağrılıyor:

```javascript
_clearFutureEvents(audioTime) {
    const safeThreshold = audioTime + this.safetyWindow; // +50ms

    this.scheduledEvents.forEach((event, eventId) => {
        if (event.time > safeThreshold && !event.executed) {
            this.scheduledEvents.delete(eventId);
        }
    });
}
```

**Sorun:** Sadece `safeThreshold` (50ms) üstündeki eventler siliniyor!

### Critical Scenario

Loop sonuna yaklaşırken lookahead window loop başını da içeriyor:

```
Time:  2.0s                    2.15s
Tick:  360 ──────────── 384|0 ──── 150
       └─ Current pos    └─Loop     └─Lookahead
                         restart      window

1. Tick 360'tayız, lookahead tick 0-150'yi schedule ediyor
   → Tick 96 için event: time=2.1s, eventId="..._96.0_60"

2. Loop restart oluyor (tick 384 → 0)
   → audioTime = 2.05s

3. _clearFutureEvents(2.05) çağrılıyor
   → safeThreshold = 2.05 + 0.05 = 2.10s
   → Tick 96 event time = 2.1s
   → 2.1s > 2.10s? HAYIR! (eşit veya küçük)
   → ❌ Event SİLİNMEZ!

4. _fillScheduleWindow() çağrılıyor
   → Tick 96 için eventId oluşturuyor: "..._96.0_60"
   → Map'te zaten var!
   → ❌ Skip edilir, schedule edilmez!

5. Sonuç: Tick 96'daki nota çalmaz!
```

---

## ✅ Fix Applied

### File: `ContinuousScheduler.js:163-167`

**Before:**
```javascript
if (positionJumped) {
    console.log(`🔄 [ContinuousScheduler] Position jump detected`);
    this._clearFutureEvents(audioTime); // ← Uses safetyWindow!
    this.lastScheduledTick = windowStartTick;
}
```

**After:**
```javascript
if (positionJumped) {
    console.log(`🔄 [ContinuousScheduler] Position jump detected`);
    this._clearAllFutureEvents(audioTime); // ← Clears ALL future events!
    this.lastScheduledTick = windowStartTick;
}
```

### New Method: `_clearAllFutureEvents()`

```javascript
/**
 * Clear ALL future events without safety window check
 * Used on position jump (loop restart) where we need a clean slate
 */
_clearAllFutureEvents(audioTime) {
    let clearedCount = 0;

    this.scheduledEvents.forEach((event, eventId) => {
        // Clear ALL future events (even within safety window)
        // Only keep events currently executing or already past
        if (event.time >= audioTime && !event.executed) {
            this.scheduledEvents.delete(eventId);
            clearedCount++;
        }
    });

    if (clearedCount > 0) {
        console.log(`🗑️ [ContinuousScheduler] Cleared ${clearedCount} future events (position jump - all)`);
    }
}
```

**Key difference:**
- `_clearFutureEvents()`: Only clears events **beyond** safety window (50ms)
- `_clearAllFutureEvents()`: Clears **ALL** future events, no safety check

---

## 🎯 Why This Works

### Before Fix:

```
Loop restart → _clearFutureEvents() → Only removes events > safeThreshold
                                    → Events in lookahead window REMAIN
                                    → Same eventIds block re-scheduling
                                    → ❌ Silence!
```

### After Fix:

```
Loop restart → _clearAllFutureEvents() → Removes ALL future events
                                      → Clean Map for new loop iteration
                                      → _fillScheduleWindow() schedules fresh
                                      → ✅ Notes play!
```

---

## 🧪 Testing

### Test Case 1: Basic Loop Restart

**Steps:**
1. Create pattern with 4-5 notes
2. Enable loop (4 bars)
3. Start playback
4. Let it loop 5+ times
5. **Expected:** All notes play on every loop iteration

**Console check:**
```
🔄 [ContinuousScheduler] Position jump detected: 384.0 → 0.0
🗑️ [ContinuousScheduler] Cleared 45 future events (position jump - all)
➕ [ContinuousScheduler] Filled window: scheduled 23 notes in [0.0, 150.0]
```

**Success criteria:**
- ✅ Notes play on loop 1, 2, 3, 4, 5...
- ✅ No silence after first loop
- ✅ Consistent playback

---

### Test Case 2: Add Notes Mid-Loop

**Steps:**
1. Start playback (empty pattern or few notes)
2. Add notes while playing
3. Let loop restart
4. **Expected:** New AND old notes play

**Before fix:**
- Loop 1: Original notes play ✅
- Add note
- Loop 2: Only new note plays, old notes silent ❌

**After fix:**
- Loop 1: Original notes play ✅
- Add note
- Loop 2: ALL notes play (old + new) ✅

---

### Test Case 3: Loop Restart + Note Add Simultaneously

**Steps:**
1. Start playback with pattern
2. Add note EXACTLY as loop restarts
3. **Expected:** All notes play including new one

**This was the critical bug scenario!**

---

## 📊 Expected Behavior

### Console Logs (Healthy)

```
▶️ [PlaybackServiceAdapter] Starting ContinuousScheduler
▶️ [PlaybackServiceAdapter] SchedulerService ticker running
▶️ [ContinuousScheduler] Started
➕ [ContinuousScheduler] Filled window: scheduled 23 notes in [0.0, 150.0]

[... playback continues ...]

🔄 [ContinuousScheduler] Position jump detected: 384.0 → 0.0
🗑️ [ContinuousScheduler] Cleared 23 future events (position jump - all)
➕ [ContinuousScheduler] Filled window: scheduled 23 notes in [0.0, 150.0]

[... loop 2 ...]

🔄 [ContinuousScheduler] Position jump detected: 384.0 → 0.0
🗑️ [ContinuousScheduler] Cleared 23 future events (position jump - all)
➕ [ContinuousScheduler] Filled window: scheduled 23 notes in [0.0, 150.0]
```

**Key signs:**
- ✅ "Cleared X future events (position jump - all)" on every loop restart
- ✅ "Filled window: scheduled X notes" after every clear
- ✅ Scheduled count should be consistent across loops

---

### Diagnostics Check

```javascript
schedulerDiag.startMonitoring()
```

**Watch for:**
```
🎵 Transport: ▶️ PLAYING | Tick: 96 | BPM: 120
🔄 Scheduler: ✅ RUNNING | Ticks: 482 | Avg: 1.8ms
📅 Events: Scheduled: 1205 | Executed: 1180 | In Map: 23
```

**After loop restart:**
```
🎵 Transport: ▶️ PLAYING | Tick: 0 | BPM: 120  ← Reset to 0
🔄 Scheduler: ✅ RUNNING | Ticks: 498 | Avg: 1.9ms
📅 Events: Scheduled: 1228 | Executed: 1203 | In Map: 23  ← Similar count
```

**Red flag (if still broken):**
```
📅 Events: Scheduled: 1228 | Executed: 1203 | In Map: 0  ← Empty Map!
```

---

## 🐛 If Still Not Working

### Check 1: Event Clearing

```javascript
// Before playback, add debug to console
const origClear = window.playbackService.schedulerAdapter.continuousScheduler._clearAllFutureEvents;
window.playbackService.schedulerAdapter.continuousScheduler._clearAllFutureEvents = function(audioTime) {
    console.log('🔍 DEBUG: _clearAllFutureEvents called, Map size before:', this.scheduledEvents.size);
    origClear.call(this, audioTime);
    console.log('🔍 DEBUG: Map size after:', this.scheduledEvents.size);
};
```

**Expected on loop restart:**
```
🔍 DEBUG: _clearAllFutureEvents called, Map size before: 23
🔍 DEBUG: Map size after: 0  ← Should be 0 or very small!
```

---

### Check 2: Event ID Uniqueness

```javascript
// Watch for duplicate event IDs
const origFill = window.playbackService.schedulerAdapter.continuousScheduler._fillScheduleWindow;
window.playbackService.schedulerAdapter.continuousScheduler._fillScheduleWindow = function(start, end) {
    const sizeBefore = this.scheduledEvents.size;
    origFill.call(this, start, end);
    const sizeAfter = this.scheduledEvents.size;
    console.log(`🔍 DEBUG: _fillScheduleWindow [${start}-${end}], Map ${sizeBefore} → ${sizeAfter}`);
};
```

**Expected:**
```
🔍 DEBUG: _fillScheduleWindow [0-150], Map 0 → 23  ← Good, added 23 events
```

**Bad (duplicate IDs):**
```
🔍 DEBUG: _fillScheduleWindow [0-150], Map 23 → 23  ← Bad! No events added!
```

---

## 📋 Success Criteria

**All must be true:**

1. ✅ **Loop 1 plays** - All notes audible
2. ✅ **Loop 2 plays** - All notes audible (same as loop 1)
3. ✅ **Loop 3+ plays** - Consistent playback
4. ✅ **Console shows clearing** - "Cleared X future events (position jump - all)"
5. ✅ **Console shows refilling** - "Filled window: scheduled X notes"
6. ✅ **No silence after first loop**
7. ✅ **Diagnostics show healthy** - schedulerDiag.healthCheck().score === 100

---

## 🎓 Technical Notes

### Why Safety Window Exists

`_clearFutureEvents()` uses safety window (50ms) to avoid clearing events that are **about to execute**:

```
audioTime = 2.0s
safetyWindow = 0.05s
safeThreshold = 2.05s

Events at 2.01s, 2.02s → Keep (imminent)
Events at 2.10s, 2.20s → Clear (future)
```

This is good for:
- Pattern dirty refresh (notes added/removed)
- Tempo changes
- Gradual position changes

### Why Position Jump Needs Full Clear

On loop restart, position **teleports**:
```
tick 384 → tick 0  (instant jump)
```

All scheduled events are now **invalid** because:
- They were scheduled for tick 384-534
- But we're now at tick 0-150
- Same tick numbers, different loop iteration
- Same eventIds → collision!

**Solution:** Clear **everything** on position jump, reschedule from scratch.

---

## 🚀 Next Steps

1. **Refresh browser** and test
2. **Run diagnostics:**
   ```javascript
   schedulerDiag.status()
   ```
3. **Start playback** and let it loop 5+ times
4. **Listen carefully** - all notes should play on every loop
5. **Report results**

---

**Expected result:** Loop restart şimdi mükemmel çalışmalı, her loop'ta tüm notalar çalmalı! 🎵
