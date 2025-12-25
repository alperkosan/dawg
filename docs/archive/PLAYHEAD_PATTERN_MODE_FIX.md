# 🐛 Playhead Movement in Pattern Mode - Fixed

**Date**: 2025-10-17
**Status**: ✅ FIXED
**Severity**: Medium (Incorrect behavior affecting UX)
**Files Affected**:
- `client/src/lib/core/PlaybackController.js`
- `client/src/lib/core/PlaybackManager.js`

---

## Problem Description

### User Report
> "playhead 'pattern' modunda iken de hareket ediyor. bu sorun giderilmeli. aranje paneli için playhead sadece 'song' modunda hareket etmeli."
> (Playhead moves in pattern mode too. This should be fixed. For the arrangement panel, playhead should only move in song mode.)

### Symptoms
1. When playing in **Pattern Mode** (individual pattern playback)
2. Playhead in **Arrangement Panel** would move
3. This is incorrect behavior - playhead should only move when in **Song Mode**
4. Pattern mode is for testing/editing individual patterns, not arrangement playback

### Expected Behavior

- **Pattern Mode**: Playhead should **NOT** move in arrangement panel (stays at current position)
- **Song Mode**: Playhead **SHOULD** move in arrangement panel (shows progress through song)

---

## Root Cause

The `PlaybackController._updatePositionFromMotor()` method was updating position on every tick **regardless of playback mode**:

```javascript
// ❌ BEFORE - Always updated position
_updatePositionFromMotor() {
  if (!this.audioEngine?.transport) return;

  const newPosition = this.audioEngine.transport.ticksToSteps(
    this.audioEngine.transport.currentTick
  );

  if (Math.abs(newPosition - this.state.currentPosition) > 0.01) {
    this.state.currentPosition = newPosition;
    this._emitPositionUpdate(); // ❌ This was called in both modes
  }
}
```

This position update would emit a `position-update` event that `usePlaybackStore` subscribes to, which then updates `currentStep`. The `ArrangementPanelV2` component reads `currentStep` directly to render the playhead position.

**Event Flow**:
1. Transport ticks → `PlaybackController._updatePositionFromMotor()`
2. → `_emitPositionUpdate()` → `position-update` event
3. → `usePlaybackStore` sets `currentStep`
4. → `ArrangementPanelV2` reads `currentStep` and renders playhead
5. ❌ This happened in **both pattern and song modes**

---

## Solution

### Fix #1: Add Mode Check in PlaybackController

**File**: `client/src/lib/core/PlaybackController.js`

Added a mode check before updating position:

```javascript
// ✅ AFTER - Only updates position in song mode
_updatePositionFromMotor() {
  if (!this.audioEngine?.transport) return;

  // ✅ FIX: Only update position in SONG mode for arrangement panel
  // In PATTERN mode, playhead should not move in arrangement
  const playbackManager = this.audioEngine.playbackManager;
  const currentMode = playbackManager?.getCurrentMode?.() || playbackManager?.currentMode || 'pattern';

  // Skip position updates in pattern mode (arrangement playhead stays still)
  if (currentMode === 'pattern') {
    return; // ✅ Early exit - no position update in pattern mode
  }

  const newPosition = this.audioEngine.transport.ticksToSteps(
    this.audioEngine.transport.currentTick
  );

  // Sadece anlamlı değişiklikte güncelle
  if (Math.abs(newPosition - this.state.currentPosition) > 0.01) {
    this.state.currentPosition = newPosition;
    this._emitPositionUpdate(); // ✅ Only emitted in song mode now
  }
}
```

**Why This Works**:
- Checks `playbackManager.getCurrentMode()` to determine current playback mode
- Returns early (exits) if in pattern mode → no position update
- Only updates position and emits event in song mode
- Simple, defensive code with fallback to 'pattern'

### Fix #2: Add getCurrentMode() Method

**File**: `client/src/lib/core/PlaybackManager.js`

Added `getCurrentMode()` as a convenience alias:

```javascript
getPlaybackMode() {
    return this.currentMode;
}

// ✅ Alias for convenience (used by PlaybackController)
getCurrentMode() {
    return this.currentMode;
}
```

**Why This Is Needed**:
- `getPlaybackMode()` already existed
- Added `getCurrentMode()` as a more intuitive alias
- Allows external code to query current mode safely
- Maintains backward compatibility

---

## Technical Details

### Playback Modes in DAWG

**Pattern Mode** (`'pattern'`):
- Used for editing and previewing individual patterns
- Loops a single pattern (e.g., 64 steps)
- Channel Rack playback, Piano Roll preview
- Playhead should NOT move in arrangement panel
- Only the pattern being edited plays

**Song Mode** (`'song'`):
- Used for full arrangement playback
- Plays all clips in the arrangement timeline
- Follows arrangement timeline (bars, beats)
- Playhead SHOULD move in arrangement panel
- Shows progress through the entire song

### Position Update Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Transport Tick Event                     │
│                  (fires every audio frame)                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│            PlaybackController (tick listener)                │
│                                                              │
│  _updatePositionFromMotor() {                               │
│    ✅ Check mode                                            │
│    if (currentMode === 'pattern') return; ← NEW             │
│                                                              │
│    Update position                                           │
│    Emit 'position-update' event                             │
│  }                                                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼ (only in song mode)
┌─────────────────────────────────────────────────────────────┐
│                   usePlaybackStore                           │
│                                                              │
│  controller.on('position-update', (data) => {               │
│    set({ currentStep: data.position });                     │
│  });                                                         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│               ArrangementPanelV2 (React)                     │
│                                                              │
│  const currentStep = usePlaybackStore(                      │
│    state => state.currentStep                               │
│  );                                                          │
│                                                              │
│  // Draw playhead at currentStep position                   │
│  const playheadX = (currentStep / 4) *                      │
│                    PIXELS_PER_BEAT * zoomX;                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Checklist

- [x] Pattern mode playback - playhead stays still in arrangement
- [x] Song mode playback - playhead moves in arrangement
- [x] Mode switching while playing - playhead behavior changes correctly
- [x] Mode switching while stopped - no side effects
- [x] Channel Rack playback (pattern mode) - no arrangement playhead movement
- [x] Piano Roll preview (pattern mode) - no arrangement playhead movement
- [x] Arrangement playback (song mode) - playhead follows playback
- [x] Build succeeds without errors

---

## Behavioral Changes

### Before Fix

| Playback Mode | Arrangement Playhead | Correct? |
|--------------|---------------------|----------|
| Pattern      | ✅ Moves            | ❌ NO    |
| Song         | ✅ Moves            | ✅ YES   |

### After Fix

| Playback Mode | Arrangement Playhead | Correct? |
|--------------|---------------------|----------|
| Pattern      | ⏸️ Stays Still      | ✅ YES   |
| Song         | ✅ Moves            | ✅ YES   |

---

## Edge Cases Handled

### 1. Undefined playbackManager
```javascript
const playbackManager = this.audioEngine.playbackManager;
// ✅ Handles case where playbackManager might not be initialized yet
```

### 2. Missing getCurrentMode() Method
```javascript
const currentMode = playbackManager?.getCurrentMode?.() ||
                    playbackManager?.currentMode ||
                    'pattern';
// ✅ Fallbacks:
// 1. Try getCurrentMode() method
// 2. Try direct currentMode property access
// 3. Default to 'pattern' (safe default - no playhead movement)
```

### 3. Mode Switching During Playback
- Playback continues without interruption
- Position updates start/stop based on new mode
- No glitches or position jumps

### 4. Rapid Mode Switching
- Each tick checks current mode
- No caching issues
- Immediate response to mode changes

---

## Performance Impact

### Before Fix
- Position update on **every tick** (both modes)
- ~60 updates per second minimum
- Unnecessary re-renders in pattern mode

### After Fix
- Position update **only in song mode**
- Pattern mode: 0 position updates → saves CPU
- Song mode: Same as before
- **~50% reduction in position updates** (assuming 50/50 pattern/song usage)

---

## Related Code

### Mode Management
- Mode is set via: `PlaybackManager.setPlaybackMode(mode)`
- Default mode: `'pattern'`
- Modes stored in: `PlaybackManager.currentMode`

### Playback Controls
Located in `client/src/components/playback/PlaybackControls.jsx`:
- Pattern/Song mode toggle button
- Triggers `setPlaybackMode('pattern' | 'song')`

### Arrangement Playhead Rendering
Located in `client/src/features/arrangement_v2/ArrangementPanelV2.jsx`:
```javascript
// Reads from PlaybackStore
const currentStep = usePlaybackStore(state => state.currentStep);

// Renders playhead line
const playheadBeats = currentStep / 4;
const playheadX = (playheadBeats * PIXELS_PER_BEAT * zoomX) - scrollX;
```

---

## Future Considerations

### Potential Enhancements

1. **Visual Mode Indicator**
   - Show current mode (Pattern/Song) in arrangement panel
   - Different playhead colors per mode

2. **Pattern Mode Position**
   - Consider showing pattern loop position indicator
   - Separate from song position

3. **Mode-Specific Playhead States**
   - Pattern mode: Show which pattern is playing
   - Song mode: Show timeline position

4. **Keyboard Shortcuts**
   - Quick toggle between pattern/song mode
   - Currently requires clicking UI button

---

## Prevention Strategies

To avoid similar issues:

1. **Mode-Aware Updates**: Always check playback mode before updating global state
2. **Clear Separation**: Keep pattern playback separate from song playback
3. **Documentation**: Document which features work in which modes
4. **Testing**: Test all features in both modes
5. **User Feedback**: Visual indicators for current mode

---

## Related Issues

- **Clip Editing During Playback**: Separate issue (clips cut out when resized during song mode playback)
- **Pattern Length Calculation**: Auto-calculates loop points in pattern mode
- **Song Loop Points**: Determined by arrangement clips in song mode

---

**Resolution Time**: ~30 minutes
**Debugging Approach**: Event flow tracing from Transport → PlaybackController → Store → UI
**Lines Changed**: ~15 lines (mode check + helper method)
**Risk Level**: Low (isolated change, early exit pattern)
**User Impact**: High (fixes core workflow issue)
