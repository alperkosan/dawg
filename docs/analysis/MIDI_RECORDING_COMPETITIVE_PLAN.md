# 🎹 MIDI Recording Competitive Development Plan

## 🎯 **MISSION: Industry-Leading MIDI Recording**

Goal: Match or exceed FL Studio, Ableton Live, and Logic Pro in MIDI recording accuracy, timing precision, and user experience.

---

## 🔴 **CRITICAL ISSUES IDENTIFIED**

### Issue 1: **Position Calculation Error** (Line 63-64)

**Current Problem**:
```javascript
startTimeBeats = step / STEPS_PER_BEAT
```

**Root Cause**:
- `step` is calculated from `elapsedSteps` which uses `AudioContext.currentTime`
- But `PlaybackManager.getCurrentPosition()` may return different value
- Mismatch between calculated position and actual playhead position
- **Result**: Notes written at wrong positions, especially when loop is disabled

**Industry Standard** (FL Studio, Ableton, Logic):
- Use transport position as **single source of truth**
- All timing calculations based on transport's internal clock
- No separate "calculated" vs "actual" positions
- Transport position is always accurate and synchronized

---

### Issue 2: **Duration Calculation Error** (Line 81-83)

**Current Problem**:
```javascript
lengthSteps = endStep - startTimeSteps
lengthBeats = lengthSteps / STEPS_PER_BEAT
visualLength: length  // ❌ Uses step difference, not actual key press duration
```

**Root Cause**:
- Duration calculated from step difference (endStep - startStep)
- But actual keyboard press duration is calculated separately and **ignored**
- `keyboardPressDurationSteps` is computed but not used for `visualLength`
- **Result**: Notes appear with wrong visual length, don't reflect actual key press time

**Industry Standard** (FL Studio, Ableton, Logic):
- Duration = **actual key press time** (from Note On to Note Off)
- Visual length = **exact duration** user held the key
- No "step difference" calculation - use raw timing data
- High precision (sample-accurate timing)

---

## 🏆 **COMPETITIVE FEATURES TO IMPLEMENT**

### Phase 1: **Core Accuracy Fixes** (Priority: CRITICAL)

#### 1.1 **Unified Position System**
- **Goal**: Single source of truth for position
- **Implementation**:
  - Always use `PlaybackManager.getCurrentPosition()` as primary source
  - Remove separate "calculated" position logic
  - Sync `recordStartStep` with actual transport position
  - Use transport's internal clock for all timing

#### 1.2 **Precise Duration Tracking**
- **Goal**: Accurate note duration from key press
- **Implementation**:
  - Use `AudioContext.currentTime` difference for duration
  - Store `startKeyboardTime` and `endKeyboardTime` in `pendingNotes`
  - Calculate `visualLength` from actual key press duration
  - Convert to beats: `(endTime - startTime) * (bpm / 60) * STEPS_PER_BEAT`

#### 1.3 **Position Synchronization**
- **Goal**: Perfect sync between recording and playback
- **Implementation**:
  - Capture initial position from `PlaybackManager` (not store)
  - Use transport position throughout recording
  - Handle loop boundaries correctly (wrap or extend based on mode)

---

### Phase 2: **Advanced Recording Features** (Priority: HIGH)

#### 2.1 **Sample-Accurate Timing**
- **Goal**: Sub-millisecond precision
- **Implementation**:
  - Use `AudioContext.currentTime` (sample-accurate)
  - Store timestamps at Note On/Off events
  - Calculate positions with microsecond precision
  - Round only for display, not for storage

#### 2.2 **Quantization During Recording**
- **Goal**: Real-time quantization (like FL Studio)
- **Implementation**:
  - Apply quantization to `currentStep` before storing
  - Support grid sizes: 1/4, 1/8, 1/16, 1/32, 1/64
  - Swing quantization (50-75% strength)
  - Visual feedback during recording

#### 2.3 **Recording Modes Enhancement**
- **Goal**: Professional recording modes
- **Implementation**:
  - **Replace**: Clear notes in region (current implementation)
  - **Overdub**: Add notes without clearing (current implementation)
  - **Loop**: Record with loop wrapping (needs improvement)
  - **Punch In/Out**: Record only in specific time range
  - **Step Record**: Record one note at a time with confirmation

---

### Phase 3: **User Experience Enhancements** (Priority: MEDIUM)

#### 3.1 **Visual Feedback**
- **Goal**: Real-time visual feedback during recording
- **Implementation**:
  - Highlight recorded notes in real-time
  - Show recording region overlay
  - Display quantized vs. unquantized positions
  - Show note duration preview

#### 3.2 **Recording Options Panel**
- **Goal**: Professional recording settings
- **Implementation**:
  - Quantization strength slider (0-100%)
  - Grid size selector
  - Recording mode selector
  - Count-in bars selector
  - Auto-quantize toggle
  - Velocity sensitivity slider

#### 3.3 **Undo/Redo for Recording**
- **Goal**: Full undo/redo support
- **Implementation**:
  - Group all recorded notes in single undo command
  - Support per-note undo (if user wants)
  - Visual undo preview
  - Redo with re-recording option

---

### Phase 4: **Advanced Features** (Priority: LOW - Future)

#### 4.1 **MIDI Input Filtering**
- Filter by velocity range
- Filter by note range
- Filter by channel
- Ignore duplicate notes

#### 4.2 **Recording Templates**
- Save recording presets
- Quick access to common settings
- Per-instrument recording settings

#### 4.3 **MIDI Overdub with Layers**
- Record multiple takes
- Switch between takes
- Merge takes
- A/B comparison

---

## 🔧 **IMPLEMENTATION PLAN**

### Step 1: Fix Position Calculation (CRITICAL)

**File**: `client/src/lib/midi/MIDIRecorder.js`

**Changes**:
1. Remove `elapsedSteps` calculation from `AudioContext.currentTime`
2. Always use `PlaybackManager.getCurrentPosition()` as primary source
3. Store `recordStartStep` from `PlaybackManager` (not store)
4. Calculate position as: `currentStep = playbackManager.getCurrentPosition()`

**Code Changes**:
```javascript
// BEFORE (Line 385-406)
if (this.state.audioContext && this.state.recordStartAudioTime !== undefined) {
    const currentAudioTime = this.state.audioContext.currentTime;
    const elapsedAudioTime = currentAudioTime - this.state.recordStartAudioTime;
    const elapsedSteps = (elapsedAudioTime * bpm / 60) * STEPS_PER_BEAT;
    currentStep = this.state.recordStartStep + elapsedSteps;
}

// AFTER
let currentStep;
try {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine?.playbackManager) {
        // ✅ PRIMARY: Use PlaybackManager position (single source of truth)
        currentStep = audioEngine.playbackManager.getCurrentPosition();
        
        // ✅ FALLBACK: If playhead not available, use linear calculation
        if (currentStep === null || currentStep === undefined || isNaN(currentStep)) {
            const currentAudioTime = this.state.audioContext?.currentTime;
            if (currentAudioTime && this.state.recordStartAudioTime !== undefined) {
                const elapsedAudioTime = currentAudioTime - this.state.recordStartAudioTime;
                const bpm = this.playbackStore.bpm || 120;
                const elapsedSteps = (elapsedAudioTime * bpm / 60) * STEPS_PER_BEAT;
                currentStep = this.state.recordStartStep + elapsedSteps;
            }
        }
    }
} catch (e) {
    console.warn('⚠️ Could not get position:', e);
    currentStep = this.state.recordStartStep || 0;
}
```

---

### Step 2: Fix Duration Calculation (CRITICAL)

**File**: `client/src/lib/midi/MIDIRecorder.js`

**Changes**:
1. Use `keyboardPressDuration` for `visualLength` (not step difference)
2. Keep `length` for audio playback (step-based)
3. Calculate duration from `AudioContext.currentTime` difference

**Code Changes**:
```javascript
// BEFORE (Line 509-514, 594)
const lengthSteps = Math.max(1, endTimeSteps - pendingNote.startTimeSteps);
const lengthBeats = lengthSteps / STEPS_PER_BEAT;
const length = Math.max(minLengthBeats, lengthBeats);

// ...

visualLength: length, // ❌ Uses step difference

// AFTER
// Calculate duration from actual key press time (AudioContext)
let actualDurationBeats = length; // Fallback to step-based
if (pendingNote.startKeyboardTime !== undefined && currentAudioTime !== undefined) {
    const durationSeconds = currentAudioTime - pendingNote.startKeyboardTime;
    const bpm = this.playbackStore.bpm || 120;
    // Convert seconds to beats: (seconds * bpm / 60)
    actualDurationBeats = (durationSeconds * bpm / 60);
    // Minimum duration: 1/16 note
    actualDurationBeats = Math.max(0.25 / STEPS_PER_BEAT, actualDurationBeats);
}

// Calculate step-based length for audio playback
const lengthSteps = Math.max(1, endTimeSteps - pendingNote.startTimeSteps);
const lengthBeats = lengthSteps / STEPS_PER_BEAT;
const length = Math.max(minLengthBeats, lengthBeats);

// ...

const note = {
    // ...
    length, // Step-based length (for audio playback)
    visualLength: actualDurationBeats, // ✅ Actual key press duration (for visual display)
    // ...
};
```

---

### Step 3: Fix Initial Position Capture (HIGH)

**File**: `client/src/lib/midi/MIDIRecorder.js`

**Changes**:
1. Get initial position from `PlaybackManager` (not store)
2. If playback stopped, get from Piano Roll engine's playhead
3. Ensure `recordStartStep` matches actual transport position

**Code Changes**:
```javascript
// BEFORE (Line 106-124)
if (this.playbackStore.isPlaying && audioEngine?.playbackManager) {
    initialPlayheadStep = audioEngine.playbackManager.getCurrentPosition();
} else {
    initialPlayheadStep = this.playbackStore.currentStep || 0;
}

// AFTER
let initialPlayheadStep = 0;
try {
    const audioEngine = AudioContextService.getAudioEngine();
    
    if (this.playbackStore.isPlaying && audioEngine?.playbackManager) {
        // ✅ Playback running: Get from PlaybackManager
        initialPlayheadStep = audioEngine.playbackManager.getCurrentPosition();
        if (initialPlayheadStep === null || initialPlayheadStep === undefined || isNaN(initialPlayheadStep)) {
            initialPlayheadStep = 0;
        }
    } else {
        // ✅ Playback stopped: Get from PlaybackManager's stored position
        // This is more accurate than store.currentStep
        if (audioEngine?.playbackManager) {
            initialPlayheadStep = audioEngine.playbackManager.currentPosition || 0;
        } else {
            // Fallback to store
            initialPlayheadStep = this.playbackStore.currentStep || 0;
        }
    }
} catch (e) {
    console.warn('⚠️ Could not get initial playhead position:', e);
    initialPlayheadStep = this.playbackStore.currentStep || 0;
}
```

---

### Step 4: Add Position Validation (MEDIUM)

**File**: `client/src/lib/midi/MIDIRecorder.js`

**Changes**:
1. Validate position before writing notes
2. Log warnings if position seems incorrect
3. Handle edge cases (negative positions, NaN, etc.)

**Code Changes**:
```javascript
// In handleNoteOn/handleNoteOff, before storing:
if (step < 0 || isNaN(step) || !isFinite(step)) {
    console.warn(`⚠️ Invalid step position: ${step}, using 0`);
    step = 0;
}

// Validate duration
if (length < 0 || isNaN(length) || !isFinite(length)) {
    console.warn(`⚠️ Invalid note length: ${length}, using minimum`);
    length = 0.25 / STEPS_PER_BEAT; // 1/16 note
}
```

---

## 📊 **TESTING STRATEGY**

### Test 1: Position Accuracy
- **Setup**: Start recording at different playhead positions (0, 16, 32, 64 steps)
- **Action**: Record single note
- **Expected**: Note appears at exact playhead position
- **Verify**: Compare `note.time` with actual playhead position

### Test 2: Duration Accuracy
- **Setup**: Record notes with different key press durations (short tap, medium hold, long hold)
- **Action**: Record notes and measure actual key press time
- **Expected**: `visualLength` matches actual key press duration
- **Verify**: Compare `note.visualLength` with measured key press time

### Test 3: Loop Disabled Recording
- **Setup**: Disable loop, start recording at position 0
- **Action**: Record notes beyond pattern length (e.g., 100 steps)
- **Expected**: Notes written at correct positions (0, 10, 20, 30, etc.)
- **Verify**: Check note positions in pattern store

### Test 4: Loop Enabled Recording
- **Setup**: Enable loop (0-64 steps), start recording at position 0
- **Action**: Record notes beyond loop end
- **Expected**: Notes wrap to loop start OR extend beyond (based on mode)
- **Verify**: Check note positions respect loop bounds

### Test 5: Real-Time Recording
- **Setup**: Start recording, play notes in real-time
- **Action**: Record multiple notes with varying durations
- **Expected**: All notes appear at correct positions with correct durations
- **Verify**: Visual inspection + log analysis

---

## 🎯 **SUCCESS METRICS**

### Accuracy Metrics
- ✅ Position accuracy: ±0.1 steps (1/40th of a beat at 120 BPM)
- ✅ Duration accuracy: ±5ms (sample-accurate at 44.1kHz)
- ✅ Timing consistency: No drift over 5-minute recording

### Performance Metrics
- ✅ Recording latency: <10ms (imperceptible)
- ✅ CPU usage: <5% during recording
- ✅ Memory usage: <50MB for 1000 notes

### User Experience Metrics
- ✅ Visual feedback: <16ms (60 FPS)
- ✅ Note appearance: Instant (no delay)
- ✅ Undo/redo: <100ms response time

---

## 🚀 **IMPLEMENTATION TIMELINE**

### Week 1: Critical Fixes
- **Day 1-2**: Fix position calculation (Step 1)
- **Day 3-4**: Fix duration calculation (Step 2)
- **Day 5**: Fix initial position capture (Step 3)
- **Testing**: Position and duration accuracy tests

### Week 2: Validation & Polish
- **Day 1-2**: Add position validation (Step 4)
- **Day 3-4**: Comprehensive testing
- **Day 5**: Bug fixes and optimization

### Week 3: Advanced Features (Optional)
- **Day 1-3**: Sample-accurate timing
- **Day 4-5**: Recording options panel

---

## 📝 **NOTES**

### Industry Standards Reference
- **FL Studio**: Uses transport position, sample-accurate timing, visual length = key press duration
- **Ableton Live**: High precision timing, real-time quantization, visual feedback
- **Logic Pro**: Sample-accurate, supports multiple recording modes, undo/redo

### Key Principles
1. **Single Source of Truth**: Always use `PlaybackManager.getCurrentPosition()`
2. **Precision First**: Use `AudioContext.currentTime` for duration calculations
3. **User Intent**: Visual length should reflect actual key press duration
4. **Consistency**: All timing calculations use same time source

---

## ✅ **CHECKLIST**

### Critical Fixes
- [ ] Fix position calculation to use PlaybackManager
- [ ] Fix duration calculation to use key press duration
- [ ] Fix initial position capture
- [ ] Add position validation
- [ ] Test position accuracy
- [ ] Test duration accuracy

### Advanced Features (Future)
- [ ] Sample-accurate timing
- [ ] Real-time quantization
- [ ] Recording options panel
- [ ] Visual feedback enhancements
- [ ] Undo/redo for recording

---

**Status**: 🟡 Ready for Implementation
**Priority**: 🔴 CRITICAL
**Estimated Time**: 1-2 weeks for critical fixes

