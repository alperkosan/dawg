# Debug Test Guide - ContinuousScheduler

**Date:** 24 Ocak 2026
**Goal:** Diagnose why ContinuousScheduler is not playing audio

---

## 🔧 Changes Applied

### 1. Enhanced Debug Logging

**File:** `ContinuousScheduler.js`

**Added Logs:**

1. **On start():** Pattern store state, available patterns, note count per instrument
2. **Every 50 ticks:** Window calculation, pattern existence, event count
3. **Every 100 ticks:** Pattern data structure, instrument count, total notes
4. **On missing pattern:** Warning with available pattern IDs
5. **On invalid notes:** Warning for each instrument

### 2. Old System Disabled

**File:** `PlaybackService.js:207-211`

✅ Old pattern scheduling completely skipped when ContinuousScheduler active

### 3. Event Binding Fixed

**File:** `PlaybackServiceAdapter.js:185-196`

✅ Listens to both `NOTE_ADDED` and `pattern:notes-added` events

---

## 🧪 Test Procedure

### Step 1: Refresh Browser

Press F5 or Cmd+R to reload with new debug code

---

### Step 2: Open Console

Open browser developer console (F12)

---

### Step 3: Add Notes Before Playback

1. Click on grid to add 3-4 notes
2. **Check console:** Should see pattern store updates

---

### Step 4: Start Playback

Click play button

**Expected Console Output:**

```
▶️ [ContinuousScheduler] Started {
  activePatternId: "pattern-1",
  patternExists: true,
  patternHasData: true,
  availablePatterns: ["pattern-1"],
  transport: {
    currentTick: 0,
    isPlaying: true,
    bpm: 120,
    loop: true
  }
}
  📋 hihat-1: 4 notes
    Note 1: {time: 1, step: undefined, pitch: "C4"}
    Note 2: {time: 4, step: undefined, pitch: "C4"}
    Note 3: {time: 10, step: undefined, pitch: "C4"}
    Note 4: {time: 12, step: undefined, pitch: "C4"}
```

**Red Flags:**

```
❌ patternExists: false         ← Pattern not found!
❌ patternHasData: false        ← Pattern has no data!
❌ availablePatterns: []        ← No patterns in store!
❌ hihat-1: 0 notes             ← No notes!
```

---

### Step 5: Watch Tick Logs

Every 50 ticks you should see:

```
🔍 [ContinuousScheduler] Tick #50: {
  audioTime: "5.272",
  currentTick: 192,
  windowStartTick: "288.0",
  windowEndTick: "432.0",
  lastScheduledTick: "432.0",
  activePatternId: "pattern-1",
  patternExists: true,
  patternHasData: true,
  scheduledEventsCount: 4,        ← Should be > 0!
  dirtyPatternsCount: 0
}
```

**Red Flags:**

```
❌ scheduledEventsCount: 0      ← No events scheduled!
❌ patternExists: false
❌ patternHasData: false
```

---

### Step 6: Watch Pattern Data Logs

Every 100 ticks you should see:

```
🔍 [ContinuousScheduler] Pattern data: {
  patternId: "pattern-1",
  instruments: 1,
  totalNotes: 4,
  window: "[288.0, 432.0]",
  loopEnabled: true,
  loopRange: "[0, 384]"
}
```

**Red Flags:**

```
❌ instruments: 0               ← No instruments!
❌ totalNotes: 0                ← No notes!
```

---

### Step 7: Add Note During Playback

Click to add a note while playing

**Expected Console Output:**

```
✅ [PlaybackService] Note added - delegating to ContinuousScheduler
➕ [PlaybackServiceAdapter] Notes added to pattern-1: 1 notes
🏷️ [ContinuousScheduler] Marked pattern pattern-1 dirty
🔄 [ContinuousScheduler] Refreshing dirty pattern: pattern-1
🎵 [ContinuousScheduler] Computed 5 notes in window [288.0, 432.0]
➕ [ContinuousScheduler] Filled window: scheduled 1 notes in [288.0, 432.0]
```

**Red Flags:**

```
❌ No "✅ [PlaybackService] Note added" log    ← Old system still active!
❌ No "➕ [PlaybackServiceAdapter]" log        ← Event not received!
❌ No "🏷️ Marked dirty" log                    ← Dirty flag not set!
❌ No "🎵 Computed X notes" log                ← Notes not computed!
```

---

### Step 8: Wait for Loop Restart

Let the loop play until it restarts (at end of 16 steps)

**Expected Console Output:**

```
🔁 [LOOP RESTART] Triggered @ 7.272s, tick 385.5 → 0
🔄 [ContinuousScheduler] Position jump detected: 384.0 → 0.0
🗑️ [ContinuousScheduler] Cleared 4 future events (position jump - all)
➕ [ContinuousScheduler] Filled window: scheduled 4 notes in [0.0, 144.0]
```

**Red Flags:**

```
❌ No "🔄 Position jump detected" log          ← Jump not detected!
❌ No "🗑️ Cleared X events" log                ← Events not cleared!
❌ No "➕ Filled window" log                    ← Window not refilled!
```

---

## 🔍 Diagnostic Checklist

Run this in browser console:

```javascript
// Copy-paste this entire block
console.log('=== DIAGNOSTIC REPORT ===\n');

const adapter = window.playbackService?.schedulerAdapter;
const scheduler = adapter?.continuousScheduler;

if (!scheduler) {
    console.error('❌ ContinuousScheduler not found!');
} else {
    console.log('✅ Scheduler exists\n');

    // 1. Pattern Store
    console.log('1️⃣ PATTERN STORE:');
    const activeId = scheduler.patternStore.activePatternId;
    const patterns = scheduler.patternStore.patterns;
    console.log('  activePatternId:', activeId);
    console.log('  patterns:', Object.keys(patterns || {}));

    if (activeId && patterns[activeId]) {
        const pattern = patterns[activeId];
        console.log('  pattern.id:', pattern.id);
        console.log('  pattern.data:', pattern.data);

        if (pattern.data) {
            Object.entries(pattern.data).forEach(([instId, notes]) => {
                console.log(`    ${instId}: ${notes?.length || 0} notes`);
                if (notes && notes.length > 0) {
                    console.log('      First note:', notes[0]);
                }
            });
        }
    }

    // 2. Scheduler State
    console.log('\n2️⃣ SCHEDULER STATE:');
    console.log('  isRunning:', scheduler.isRunning);
    console.log('  lastScheduledTick:', scheduler.lastScheduledTick);
    console.log('  scheduledEvents.size:', scheduler.scheduledEvents.size);
    console.log('  dirtyPatterns:', Array.from(scheduler.dirtyPatterns));

    // 3. Stats
    console.log('\n3️⃣ STATS:');
    console.log('  tickCount:', scheduler.stats.tickCount);
    console.log('  eventsScheduled:', scheduler.stats.eventsScheduled);
    console.log('  eventsExecuted:', scheduler.stats.eventsExecuted);
    console.log('  avgTickDuration:', scheduler.stats.avgTickDuration.toFixed(2) + 'ms');

    // 4. Transport
    console.log('\n4️⃣ TRANSPORT:');
    console.log('  currentTick:', scheduler.transport.currentTick);
    console.log('  isPlaying:', scheduler.transport.isPlaying);
    console.log('  bpm:', scheduler.transport.bpm);
    console.log('  loop:', scheduler.transport.loop);
    console.log('  loopStartTick:', scheduler.transport.loopStartTick);
    console.log('  loopEndTick:', scheduler.transport.loopEndTick);

    // 5. Test Pattern Data Access
    console.log('\n5️⃣ MANUAL NOTE COMPUTATION TEST:');
    if (activeId && patterns[activeId]) {
        try {
            const pattern = patterns[activeId];
            const windowStart = scheduler._timeToTick(scheduler.audioContext.currentTime);
            const windowEnd = windowStart + 150; // 150 ticks ahead

            const notes = scheduler._computeNotesInWindow(pattern, windowStart, windowEnd);
            console.log(`  Computed ${notes.length} notes in window [${windowStart.toFixed(1)}, ${windowEnd.toFixed(1)}]`);

            if (notes.length > 0) {
                console.log('  First note:', notes[0]);
            } else {
                console.warn('  ⚠️ No notes computed! Pattern data might be invalid.');
            }
        } catch (e) {
            console.error('  ❌ Error computing notes:', e);
        }
    }
}

console.log('\n=== END DIAGNOSTIC ===');
```

---

## 🐛 Expected Issues & Solutions

### Issue 1: Pattern Data Structure Mismatch

**Symptom:**
```
⚠️ [ContinuousScheduler] Invalid notes for hihat-1: [...]
```

**Cause:** Pattern data format doesn't match expectations

**Check:**
```javascript
const pattern = window.__stores.useArrangementStore.getState().patterns['pattern-1'];
console.log('Pattern.data:', pattern.data);
```

**Expected:**
```javascript
{
  "hihat-1": [
    {id: "...", time: 1, pitch: "C4", velocity: 100, length: 1}
  ]
}
```

**Fix:** If format is different, adjust `_computeNotesInWindow()` logic

---

### Issue 2: No Pattern Found

**Symptom:**
```
⚠️ [ContinuousScheduler] No pattern found for ID: pattern-1
  availablePatterns: []
```

**Cause:** Pattern store not accessible

**Check:**
```javascript
console.log('Store:', window.__stores);
console.log('useArrangementStore:', window.__stores?.useArrangementStore);
```

**Fix:** Verify `useArrangementStore.js` exports to window

---

### Issue 3: Events Scheduled But Not Executed

**Symptom:**
```
eventsScheduled: 100
eventsExecuted: 0
scheduledEventsCount: 100  ← Still in Map!
```

**Cause:** SchedulerService ticker not running OR scheduleNote() failing

**Check:**
```javascript
const ss = window.playbackService.schedulerService;
console.log('SchedulerService:', {
    exists: !!ss,
    isRunning: ss?.isRunning,
    tickerHandle: ss?.tickerHandle
});
```

**Fix:** Ensure SchedulerService.start() is called (already done in adapter)

---

### Issue 4: Position Jump Not Detected

**Symptom:**
```
🔁 [LOOP RESTART] Triggered
(No "🔄 Position jump detected" log)
```

**Cause:** `_detectPositionJump()` logic issue

**Debug:**
```javascript
// Add to tick() temporarily
console.log('Jump check:', {
    lastScheduledTick: this.lastScheduledTick,
    windowStartTick: windowStartTick,
    jumped: this._detectPositionJump(windowStartTick)
});
```

**Fix:** Adjust `jumpThreshold` or detection logic

---

## 📊 Success Indicators

✅ **Healthy Output:**

```
▶️ [ContinuousScheduler] Started
  📋 hihat-1: 4 notes
🔍 [ContinuousScheduler] Tick #50: scheduledEventsCount: 4
🔍 [ContinuousScheduler] Pattern data: totalNotes: 4
➕ [ContinuousScheduler] Filled window: scheduled 4 notes
🔁 [LOOP RESTART] Triggered
🔄 [ContinuousScheduler] Position jump detected
🗑️ [ContinuousScheduler] Cleared 4 future events
➕ [ContinuousScheduler] Filled window: scheduled 4 notes
```

❌ **Unhealthy Output:**

```
▶️ [ContinuousScheduler] Started
  📋 hihat-1: 0 notes                              ← NO NOTES!
🔍 [ContinuousScheduler] Tick #50: scheduledEventsCount: 0    ← NO EVENTS!
⚠️ [ContinuousScheduler] No pattern found         ← NO PATTERN!
```

---

## 🚀 Next Actions

**If healthy output:**
- ✅ ContinuousScheduler is working correctly
- Listen for audio - if no sound, issue is in SchedulerService execution
- Run performance test (schedulerDiag.startMonitoring())

**If unhealthy output:**
- ❌ Pattern data issue - share console output
- ❌ Pattern store access issue - check window.__stores
- ❌ Note structure mismatch - inspect pattern.data format

---

**Refresh et ve test et!** Console output'u paylaş, problemi birlikte çözeriz.
