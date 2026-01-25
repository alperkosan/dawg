# ContinuousScheduler Test Guide

**Quick test** to verify the SchedulerService ticker fix and note playback.

---

## 🎯 Quick Health Check

Open browser console and run:

```javascript
schedulerDiag.status()
```

**Expected output:**
```
🎵 Scheduler Status | Health: 100/100
✅ All systems operational
```

**If you see issues**, the diagnostics will tell you exactly what's wrong.

---

## 🧪 Test 1: Basic Note Playback

**Goal:** Verify notes are actually playing (not just scheduled)

**Steps:**

1. **Start playback**
   - Click play button
   - Loop should be enabled

2. **Check console immediately**
   ```javascript
   schedulerDiag.healthCheck()
   ```

3. **Look for these in health check:**
   ```javascript
   {
     score: 100,
     continuousScheduler: { running: true },
     schedulerService: { running: true }, // ← CRITICAL!
     transport: { playing: true },
     issues: [] // ← Should be empty
   }
   ```

4. **Verify audio**
   - Do you hear notes?
   - YES → Fix worked! ✅
   - NO → Check issues array in health check

---

## 🧪 Test 2: Real-Time Monitoring

**Goal:** Watch scheduler activity in real-time

**Steps:**

1. **Start monitoring before playback**
   ```javascript
   schedulerDiag.startMonitoring()
   ```

2. **Start playback**

3. **Watch the live dashboard** (updates every second)
   ```
   📊 SCHEDULER MONITOR | Health: 100/100
   🎵 Transport: ▶️ PLAYING | Tick: 384 | BPM: 120
   🔄 Scheduler: ✅ RUNNING | Ticks: 482 | Avg: 1.8ms
   📅 Events: Scheduled: 1205 | Executed: 1180 | In Map: 25
   ```

4. **Check for issues:**
   - If "SchedulerService NOT running" appears → BUG!
   - If "Events scheduled but NONE executed" → BUG!
   - If "No issues detected" → All good ✅

5. **Stop monitoring when done**
   ```javascript
   schedulerDiag.stopMonitoring()
   ```

---

## 🧪 Test 3: Add Notes During Loop Restart

**Goal:** Verify the main bug is fixed (notes not dropping during loop restart)

**Steps:**

1. **Start real-time monitoring**
   ```javascript
   schedulerDiag.startMonitoring()
   ```

2. **Start playback** (4-bar loop)

3. **Add notes rapidly as loop restarts**
   - Add 5-10 notes during one loop cycle
   - Let it loop 5-10 times
   - Keep adding/removing notes

4. **Watch the console for:**
   - ✅ "Marked pattern dirty" (good - using dirty flag)
   - ✅ "Filled window: scheduled X notes" (good - incremental)
   - ❌ NO "cancelAll" or "clearAll" spam (old bad behavior)
   - ❌ NO "Already handling loop restart" (old debounce)

5. **Listen to audio:**
   - All notes playing? → ✅ Fixed!
   - Notes dropping? → Still broken, check console

6. **Check stats:**
   ```javascript
   schedulerDiag.getState().stats
   ```

   **Good signs:**
   - `eventsScheduled` > 0
   - `eventsExecuted` ≈ `eventsScheduled` (within ~5%)
   - `avgTickDuration` < 5ms

---

## 🧪 Test 4: Note Remove During Playback

**Goal:** Verify note removal works instantly

**Steps:**

1. **Start playback** with some notes

2. **Remove a note** that's playing

3. **Expected:** Note stops within 25ms (one tick)

4. **Check console:**
   ```
   ➖ [PlaybackServiceAdapter] Notes removed from pattern-1: 1 notes
   🗑️ [ContinuousScheduler] Removed X future events for pattern pattern-1
   ```

---

## 🐛 Common Issues and Fixes

### Issue 1: No Audio Despite Healthy Status

**Symptoms:**
```javascript
{
  score: 100,
  transport: { playing: true },
  continuousScheduler: { running: true },
  schedulerService: { running: true }
}
```
But no sound!

**Check:**
```javascript
const state = schedulerDiag.getState()
console.log(state.scheduledEvents)
```

**If `eventsScheduled > 0` but `eventsExecuted = 0`:**
- SchedulerService ticker might not be executing events
- Check instrument initialization
- Check audio routing

---

### Issue 2: SchedulerService Not Running

**Symptoms:**
```javascript
{
  issues: ['❌ SchedulerService not running (no audio!)']
}
```

**Fix:**
This is the bug we just fixed! If you see this:

1. Check PlaybackServiceAdapter.onPlayStart()
2. Should have: `this.playbackService.schedulerService.start()`
3. Should NOT have: `this.playbackService.schedulerService.stop()`

**Force restart:**
```javascript
schedulerDiag.restart()
```

---

### Issue 3: High Tick Duration

**Symptoms:**
```javascript
{
  issues: ['⚠️ Tick duration too high (>10ms)']
}
```

**Cause:** Pattern too complex or loop computation issue

**Check:**
```javascript
const state = schedulerDiag.getState()
console.log(state.stats.avgTickDuration)
```

**If > 10ms:** Pattern might be too large, optimize note count

---

### Issue 4: Events Scheduled But Not Executed

**Symptoms:**
```javascript
{
  issues: ['❌ Events scheduled but NONE executed - audio not working!']
}
```

**This is CRITICAL** - means audio routing is broken

**Debug:**
```javascript
const state = schedulerDiag.getState()
console.log('Scheduled:', state.stats.eventsScheduled)
console.log('Executed:', state.stats.eventsExecuted)
console.log('In Map:', state.scheduledEvents.total)
```

**If events in Map but not executed:**
- SchedulerService ticker not running
- Instrument routing broken
- Audio context suspended

---

## ✅ Success Criteria

**All these should be true:**

1. **Health check:**
   ```javascript
   schedulerDiag.healthCheck().score === 100
   schedulerDiag.healthCheck().issues.length === 0
   ```

2. **Audio working:**
   - Notes play immediately when added
   - Notes stop immediately when removed
   - No drops during loop restart

3. **Performance:**
   ```javascript
   schedulerDiag.getState().stats.avgTickDuration < 5 // ms
   ```

4. **No errors in console**

5. **Stats look good:**
   ```javascript
   const stats = schedulerDiag.getState().stats
   stats.eventsExecuted > 0
   stats.eventsExecuted / stats.eventsScheduled > 0.95 // 95% execution rate
   ```

---

## 🎬 Full Test Session Example

```javascript
// 1. Check initial health
schedulerDiag.status()

// 2. Start monitoring
schedulerDiag.startMonitoring()

// 3. Start playback
// (click play button in UI)

// 4. Add some notes
// (use UI to add notes)

// 5. Watch console for:
// - "▶️ [PlaybackServiceAdapter] Starting ContinuousScheduler"
// - "▶️ [PlaybackServiceAdapter] SchedulerService ticker running"
// - "▶️ [ContinuousScheduler] Started"
// - "➕ [ContinuousScheduler] Filled window: scheduled X notes"

// 6. Check stats after 10 seconds
schedulerDiag.getState().stats

// 7. Stop monitoring
schedulerDiag.stopMonitoring()

// 8. Final health check
schedulerDiag.healthCheck()
```

**Expected console output:**
```
▶️ [PlaybackServiceAdapter] Starting ContinuousScheduler
▶️ [PlaybackServiceAdapter] SchedulerService ticker running (for event execution)
▶️ [ContinuousScheduler] Started
➕ [ContinuousScheduler] Filled window: scheduled 23 notes in [0.0, 150.0]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SCHEDULER MONITOR | Health: 100/100
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎵 Transport: ▶️ PLAYING | Tick: 384 | BPM: 120
🔄 Scheduler: ✅ RUNNING | Ticks: 482 | Avg: 1.8ms
📅 Events: Scheduled: 1205 | Executed: 1180 | In Map: 25
🎹 Pattern: pattern-1 | Notes: 16
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ No issues detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

**If all tests pass:** ContinuousScheduler is working correctly! 🎉

**If any test fails:** Use the diagnostics to identify the exact issue and report it.
