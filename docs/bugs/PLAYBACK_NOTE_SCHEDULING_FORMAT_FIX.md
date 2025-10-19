# Playback Note Scheduling Format Fix

## Problem

**User Report**: "bir vasynth enstrümanında piano roll üzerinde nota yazdığımda schedulingleri mi bozuluyor?"

**Symptoms**:
- Piano roll'da yazılan notalar doğru uzunlukta çalmıyor
- Tüm notalar 1 step gibi kısa sürüyor
- Note off (release) eventi hiç schedule edilmiyor

## Root Cause

**Format Mismatch** between Piano Roll and PlaybackManager!

### Piano Roll Format (NEW - Current)
```javascript
{
  time: 0,        // Note start time in steps (number)
  pitch: 60,      // MIDI note number (number)
  length: 4,      // Note duration in steps (number)
  velocity: 100   // Note velocity (number 0-127)
}
```

### PlaybackManager Expected Format (LEGACY - Old)
```javascript
{
  time: 0,
  pitch: 'C4',        // Note name as string
  duration: '4n',     // Duration in music notation (string)
  velocity: 1.0       // Velocity as 0-1 float
}
```

### The Bug

In `PlaybackManager.js` line 1305-1307:

```javascript
const noteDuration = note.duration ?
    NativeTimeUtils.parseTime(note.duration, this.transport.bpm) :
    this.transport.stepsToSeconds(1);  // ❌ Always fallback to 1 step!
```

When notes from Piano Roll arrive:
1. `note.duration` is **undefined** (Piano Roll uses `note.length`)
2. Code falls back to `stepsToSeconds(1)` → **All notes become 1 step long!**
3. Note off check `if (note.duration && note.duration !== 'trigger')` **always fails**
4. **No note off events scheduled** → Notes never release properly

## Solution

Updated `PlaybackManager.js` to support **both formats**:

```javascript
// ✅ FIX: Support both new format (length: number) and legacy format (duration: string)
let noteDuration;
if (typeof note.length === 'number') {
    // NEW FORMAT: length in steps (number)
    noteDuration = this.transport.stepsToSeconds(note.length);
} else if (note.duration) {
    // LEGACY FORMAT: duration as string ("4n", "8n", etc)
    noteDuration = note.duration === 'trigger' ?
        this.transport.stepsToSeconds(0.1) :
        NativeTimeUtils.parseTime(note.duration, this.transport.bpm);
} else {
    // FALLBACK: Default to 1 step
    noteDuration = this.transport.stepsToSeconds(1);
}

// ✅ FIX: Note off event - check for both length and duration
const shouldScheduleNoteOff = (typeof note.length === 'number' && note.length > 0) ||
                             (note.duration && note.duration !== 'trigger');

if (shouldScheduleNoteOff) {
    this.transport.scheduleEvent(
        absoluteTime + noteDuration,
        (scheduledTime) => {
            try {
                instrument.releaseNote(note.pitch || 'C4', scheduledTime);
            } catch (error) {
            }
        },
        { type: 'noteOff', instrumentId, note, clipId }
    );
}
```

## Verification: Piano Roll Operations

### ✅ Note Writing
**File**: `useNoteInteractionsV2.js:180-195`

Format is correct:
```javascript
const standardizedNotes = pianoRollNotes.map(note => ({
    id: note.id,
    time: note.startTime,       // ✅ Correct
    pitch: note.pitch,          // ✅ Correct (MIDI number)
    velocity: note.velocity || 100,
    length: note.length         // ✅ Correct (number in steps)
}));
```

### ✅ Note Resize
**File**: `useNoteInteractionsV2.js:1069-1113`

Correctly updates `length`:
```javascript
// Left resize
updatedNote.startTime = newStartTime;
updatedNote.length = newLength;  // ✅ Correct

// Right resize
updatedNote.length = newLength;  // ✅ Correct
```

### ✅ Note Move
**File**: `useNoteInteractionsV2.js:1036-1068`

Correctly preserves `length`:
```javascript
return {
    ...note,
    startTime: newTime,  // ✅ Updates position
    pitch: newPitch      // ✅ Updates pitch
    // length is preserved from spread  // ✅ Correct
};
```

## Files Changed

1. **PlaybackManager.js** (lines 1305-1352)
   - ✅ Added support for `note.length` (number) format
   - ✅ Maintained backward compatibility with `note.duration` (string)
   - ✅ Fixed note off scheduling condition

## Impact

- ✅ Piano roll notes now play with **correct duration**
- ✅ VASynth notes **release properly** at note end
- ✅ Resize operations work correctly
- ✅ Move operations preserve note length
- ✅ Backward compatibility maintained for legacy samples/patterns

## Testing

To verify the fix:

1. **Open Piano Roll** with VASynth instrument
2. **Write notes** of different lengths (1, 2, 4, 8 steps)
3. **Play pattern** - notes should:
   - Sound for their full length
   - Release cleanly at the end
   - No overlapping/stuck notes

4. **Resize notes** (drag left/right handles)
   - Playback duration should match visual length

5. **Move notes** (drag note body)
   - Duration should remain unchanged

## Related Files

- `useNoteInteractionsV2.js` - Piano roll note operations (already correct)
- `PianoRollMiniView.jsx` - Mini preview (fixed in separate PR)
- `PianoRollMiniViewC4.jsx` - C4 preview (fixed in separate PR)

---

**Fixed**: 2025-10-19
**Bug Severity**: Critical - Broke note playback for VASynth
**Affected Systems**: All synth instruments in Piano Roll mode
