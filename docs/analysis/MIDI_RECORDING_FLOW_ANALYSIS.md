# MIDI Recording Flow Analysis

## 🔍 Complete Workflow Analysis

### 1. **Recording Start Flow**

```
User clicks Record Button
  ↓
PianoRoll.jsx: onRecordToggle()
  ↓
MIDIRecorder.startRecording(options)
  ↓
  ├─ Capture initial playhead position (BEFORE playback starts)
  │   ├─ If playback running: playbackManager.getCurrentPosition()
  │   └─ If playback stopped: playbackStore.currentStep (UI position)
  │   └─ Store as: this.state.initialPlayheadStep
  │
  ├─ Count-in (if enabled)
  │   └─ startCountIn() → callback → beginRecording()
  │
  └─ beginRecording()
      ├─ Disable loop (save state)
      ├─ Start playback (if not playing)
      │   └─ jumpToStep(initialPlayheadStep) BEFORE starting
      ├─ Set recordStartStep = initialPlayheadStep
      ├─ Set recordStartAudioTime = audioContext.currentTime
      └─ Subscribe to MIDI events
```

### 2. **MIDI Event Flow**

```
Keyboard Key Press
  ↓
useNoteInteractionsV3: handleKeyDown()
  ↓
  ├─ Convert key to MIDI pitch
  ├─ Emit: 'midi:keyboardNoteOn' event
  │   └─ { pitch, velocity, timestamp: audioContext.currentTime }
  │
PianoRoll.jsx: handleKeyboardNoteOn()
  ↓
MIDIRecorder.handleMIDIEvent(midiEvent)
  ↓
  ├─ Calculate currentStep:
  │   ├─ If loop disabled: linearStep = recordStartStep + elapsedSteps
  │   └─ If loop enabled: actualPlayheadStep from playbackManager
  │
  ├─ Quantize step (if enabled)
  │
  └─ Route to:
      ├─ handleNoteOn(pitch, velocity, step, timestamp)
      └─ handleNoteOff(pitch, step, timestamp)
```

### 3. **Note On Processing**

```
handleNoteOn(pitch, velocity, step, timestamp)
  ↓
  ├─ Generate unique noteId
  ├─ Convert step to beats: startTimeBeats = step / STEPS_PER_BEAT
  ├─ Store in pendingNotes:
  │   ├─ noteId
  │   ├─ pitch
  │   ├─ velocity
  │   ├─ startTime: startTimeBeats (in beats)
  │   ├─ startTimeSteps: step (in steps)
  │   ├─ startKeyboardTime: audioContext.currentTime
  │   └─ startActualPlayhead: playbackManager.currentPosition
```

### 4. **Note Off Processing**

```
handleNoteOff(pitch, step, timestamp)
  ↓
  ├─ Get pendingNote from pendingNotes.get(pitch)
  ├─ Calculate length:
  │   ├─ lengthSteps = endStep - startTimeSteps
  │   └─ lengthBeats = lengthSteps / STEPS_PER_BEAT
  │
  ├─ Create note object:
  │   ├─ id: pendingNote.noteId
  │   ├─ time: pendingNote.startTime (beats)
  │   ├─ pitch: pitchToString(pitch) → "C#4"
  │   ├─ velocity: pendingNote.velocity
  │   ├─ duration: lengthToDuration(lengthBeats) → "4n", "8n", etc.
  │   ├─ length: lengthBeats (beats)
  │   └─ visualLength: lengthBeats (beats) ⚠️ PROBLEM HERE
  │
  └─ Write to pattern store:
      ├─ Get fresh state: useArrangementStore.getState()
      ├─ Get existing notes: pattern.data[instrumentId]
      ├─ Filter duplicates: existingNotes.filter(n => n.id !== note.id)
      ├─ Add new note: [...filteredNotes, note]
      └─ Update: updatePatternNotes(patternId, instrumentId, updatedNotes)
```

## 🐛 **IDENTIFIED PROBLEMS**

### Problem 1: **Initial Position Capture**

**Location**: `MIDIRecorder.startRecording()`

**Issue**: 
- When playback is stopped, `playbackStore.currentStep` is used
- But this is the UI position, which might be 0 if user hasn't clicked timeline
- Should use actual visual playhead position from Piano Roll engine

**Current Code**:
```javascript
if (this.playbackStore.isPlaying && audioEngine?.playbackManager) {
    initialPlayheadStep = audioEngine.playbackManager.getCurrentPosition();
} else {
    initialPlayheadStep = this.playbackStore.currentStep || 0; // ⚠️ Might be 0
}
```

**Fix Needed**: Get playhead position from Piano Roll engine's viewport/playhead state

---

### Problem 2: **Position Calculation Mismatch**

**Location**: `MIDIRecorder.handleMIDIEvent()`

**Issue**:
- When loop is disabled, uses `linearStep = recordStartStep + elapsedSteps`
- But `recordStartStep` might be 0 (from Problem 1)
- Even if correct, `elapsedSteps` is calculated from `AudioContext.currentTime`
- But `PlaybackManager.getCurrentPosition()` might return different value due to pattern boundaries

**Current Code**:
```javascript
if (!loopEnabled) {
    currentStep = linearStep; // ⚠️ Might not match actual playhead
} else {
    currentStep = actualPlayheadStep; // ⚠️ Might be clamped to pattern length
}
```

**Fix Needed**: 
- Always use `PlaybackManager.getCurrentPosition()` as primary source
- If loop disabled and position exceeds pattern length, use linear calculation as fallback
- But ensure `recordStartStep` is correct first

---

### Problem 3: **Duration Not Reflecting Key Press Duration**

**Location**: `MIDIRecorder.handleNoteOff()`

**Issue**:
- `visualLength` is set to `length` (calculated from step difference)
- But should reflect actual keyboard press duration
- `keyboardPressDuration` is calculated but not used for `visualLength`

**Current Code**:
```javascript
const note = {
    // ...
    length: length, // In beats (from step difference)
    visualLength: length, // ⚠️ Should be keyboard press duration
    // ...
};
```

**Fix Needed**: 
- Use `keyboardPressDurationSteps` for `visualLength` if available
- Fallback to `length` if keyboard duration not available

---

### Problem 4: **Note Format Inconsistency**

**Location**: `MIDIRecorder.handleNoteOff()`

**Issue**:
- Pattern store expects notes with `time` in beats
- But Piano Roll engine expects `startTime` in beats
- Conversion happens in `useNoteInteractionsV3` but might cause issues

**Current Code**:
```javascript
const note = {
    time: pendingNote.startTime, // ✅ Correct (beats)
    pitch: pitchToString(pendingNote.pitch), // ✅ Correct (string)
    length: length, // ✅ Correct (beats)
    visualLength: length, // ⚠️ Should be keyboard duration
    // ...
};
```

**Fix Needed**: Ensure `visualLength` uses keyboard press duration

---

## 🔧 **RECOMMENDED FIXES**

### Fix 1: Get Initial Position from Piano Roll Engine

```javascript
// In startRecording(), get position from Piano Roll engine
let initialPlayheadStep = 0;
try {
    const audioEngine = AudioContextService.getAudioEngine();
    
    if (this.playbackStore.isPlaying && audioEngine?.playbackManager) {
        initialPlayheadStep = audioEngine.playbackManager.getCurrentPosition();
    } else {
        // ✅ FIX: Get from Piano Roll engine's playhead state
        // This should be passed as a prop or retrieved from engine
        // For now, use playbackStore but ensure it's correct
        initialPlayheadStep = this.playbackStore.currentStep || 0;
        
        // TODO: Get actual playhead position from PianoRoll engine
        // This requires passing playhead position from PianoRoll.jsx
    }
} catch (e) {
    console.warn('⚠️ Could not get initial playhead position:', e);
    initialPlayheadStep = this.playbackStore.currentStep || 0;
}
```

### Fix 2: Use PlaybackManager Position as Primary Source

```javascript
// In handleMIDIEvent(), prioritize PlaybackManager position
let currentStep;
let actualPlayheadStep = null;

try {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine?.playbackManager) {
        actualPlayheadStep = audioEngine.playbackManager.getCurrentPosition();
    }
} catch (e) {
    console.warn('⚠️ Could not get PlaybackManager position:', e);
}

// Calculate linear position as fallback
let linearStep;
if (this.state.audioContext && this.state.recordStartAudioTime !== undefined) {
    const currentAudioTime = this.state.audioContext.currentTime;
    const elapsedAudioTime = currentAudioTime - this.state.recordStartAudioTime;
    const bpm = this.playbackStore.bpm || 120;
    const elapsedSteps = (elapsedAudioTime * bpm / 60) * STEPS_PER_BEAT;
    linearStep = this.state.recordStartStep + elapsedSteps;
}

// ✅ FIX: Always use actual playhead if available
// Only use linear if playhead is unavailable or loop disabled and beyond pattern
if (actualPlayheadStep !== null && actualPlayheadStep !== undefined) {
    const loopEnabled = this.playbackStore.loopEnabled;
    const patternLength = audioEngine?.playbackManager?.patternLength || 64;
    
    if (!loopEnabled && actualPlayheadStep < patternLength) {
        // Loop disabled but still within pattern - use playhead
        currentStep = actualPlayheadStep;
    } else if (!loopEnabled && actualPlayheadStep >= patternLength) {
        // Loop disabled and beyond pattern - use linear
        currentStep = linearStep;
    } else {
        // Loop enabled - use playhead (respects loop bounds)
        currentStep = actualPlayheadStep;
    }
} else {
    // Fallback to linear if playhead unavailable
    currentStep = linearStep;
}
```

### Fix 3: Use Keyboard Press Duration for visualLength

```javascript
// In handleNoteOff(), use keyboard duration for visualLength
const note = {
    id: pendingNote.noteId,
    time: pendingNote.startTime,
    pitch: pitchToString(pendingNote.pitch),
    velocity: pendingNote.velocity,
    duration: lengthToDuration(length),
    length, // In beats (from step difference)
    visualLength: keyboardPressDurationSteps !== 'N/A' 
        ? parseFloat(keyboardPressDurationSteps) / STEPS_PER_BEAT // ✅ Use keyboard duration
        : length, // Fallback to step-based length
    isMuted: false
};
```

---

## 📊 **DATA FLOW SUMMARY**

```
Keyboard Press
  ↓
MIDI Event (pitch, velocity, timestamp)
  ↓
handleMIDIEvent()
  ├─ Calculate currentStep (from playhead or linear)
  └─ Route to handleNoteOn/Off
      ↓
handleNoteOn()
  ├─ Store in pendingNotes
  └─ startTime = step / STEPS_PER_BEAT
      ↓
handleNoteOff()
  ├─ Calculate length = (endStep - startStep) / STEPS_PER_BEAT
  ├─ Calculate keyboardDuration (from AudioContext time difference)
  ├─ Create note object
  │   ├─ time: startTime (beats)
  │   ├─ length: step-based length (beats)
  │   └─ visualLength: keyboard duration (beats) ⚠️ FIX NEEDED
  └─ Write to pattern store
      ↓
Pattern Store
  └─ pattern.data[instrumentId] = [...notes, newNote]
      ↓
Piano Roll Engine
  └─ Reads notes, converts time → startTime, length → visualLength
```

---

## ✅ **NEXT STEPS**

1. **Fix initial position capture** - Get from Piano Roll engine
2. **Fix position calculation** - Prioritize PlaybackManager position
3. **Fix visualLength** - Use keyboard press duration
4. **Test with loop disabled** - Ensure notes write beyond pattern length
5. **Test with loop enabled** - Ensure notes respect loop bounds
6. **Verify duration accuracy** - Compare visualLength with actual key press time

