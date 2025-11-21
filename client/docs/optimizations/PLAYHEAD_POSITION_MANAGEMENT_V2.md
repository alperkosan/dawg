# Playhead Position Management V2 - Industry Standard Approach

## Problem Analysis

Current issue: Playhead position resets to 0 when transitioning from STOP to PLAY state, even though the engine plays from the correct position.

## Industry Standard Solutions (FL Studio, Ableton Live, Logic Pro)

### 1. **Position Persistence Pattern**
- Playhead position is **independent** of playback state
- Position persists across play/stop cycles
- Timeline click sets a "target position" that survives state changes

### 2. **UI/Transport Separation**
- **UI Playhead Position**: What user sees (can be set independently)
- **Transport Position**: What audio engine uses (synced with UI on play start)
- These can diverge temporarily but sync on play start

### 3. **Position Snapshot on Play Start**
- When play starts, take a snapshot of current UI position
- Use this snapshot as the starting position for transport
- Lock position for first 2-3 frames to prevent transport override

### 4. **Debounced Position Updates**
- Transport position updates are debounced (16-33ms)
- UI position updates are immediate
- Prevents jitter and race conditions

## Proposed Solution Architecture

### Phase 1: Position State Separation

```javascript
// PlaybackController state enhancement
this.state = {
  // ... existing state ...
  
  // ✅ NEW: Separate UI and Transport positions
  uiPosition: 0,           // What user sees (persistent)
  transportPosition: 0,   // What engine uses (synced on play)
  
  // ✅ NEW: Position lock mechanism
  positionLocked: false,
  positionLockFrames: 0,
  
  // ✅ NEW: Position snapshot for play start
  playStartSnapshot: null,
};
```

### Phase 2: Position Lock Mechanism

```javascript
_startPositionLoop() {
  // ✅ Lock position for first 3 frames after play start
  this.state.positionLocked = true;
  this.state.positionLockFrames = 3;
  this.state.playStartSnapshot = this.state.uiPosition;
  
  // Initialize transport with locked position
  this.state.transportPosition = this.state.uiPosition;
  
  // ... rest of loop setup ...
}

_updatePositionFromMotor() {
  // ✅ Skip update if position is locked
  if (this.state.positionLocked) {
    this.state.positionLockFrames--;
    if (this.state.positionLockFrames <= 0) {
      this.state.positionLocked = false;
    }
    // Use locked position instead of transport
    this._emitPositionUpdate();
    return;
  }
  
  // Normal update logic...
}
```

### Phase 3: Position Persistence

```javascript
async play(startPosition = null) {
  // ✅ Always use UI position as source of truth
  const targetPosition = startPosition ?? this.state.uiPosition;
  
  // ✅ Take snapshot before starting
  this.state.playStartSnapshot = targetPosition;
  this.state.uiPosition = targetPosition;
  this.state.transportPosition = targetPosition;
  
  // ✅ Lock position for initial frames
  this.state.positionLocked = true;
  this.state.positionLockFrames = 3;
  
  // Start playback with snapshot position
  await this.audioEngine.playbackManager.play(targetPosition);
  
  // ✅ Immediate UI update with locked position
  this._emitPositionUpdate();
  
  // ... rest of play logic ...
}
```

### Phase 4: Timeline Click Integration

```javascript
async jumpToPosition(position, options = {}) {
  // ✅ Update UI position immediately (persistent)
  this.state.uiPosition = position;
  
  // ✅ Update transport only if playing
  if (this.state.isPlaying) {
    this.state.transportPosition = position;
    await this.audioEngine.playbackManager.jumpToStep(position);
  }
  
  // ✅ Always emit UI update
  this._emitPositionUpdate();
}
```

## Implementation Priority

1. **High Priority**: Position lock mechanism (prevents 0 position on play start)
2. **High Priority**: UI position persistence (survives stop/play cycles)
3. **Medium Priority**: Position snapshot system (clean play start)
4. **Low Priority**: Debounced transport updates (performance optimization)

## Benefits

1. **User Experience**: Playhead position never resets unexpectedly
2. **Reliability**: Position survives all state transitions
3. **Performance**: Reduced unnecessary updates
4. **Industry Standard**: Matches behavior of professional DAWs

## Active Playheads

All playheads now use the industry-standard position management system:

### ✅ Piano Roll Playhead
- **Location**: `client/src/features/piano_roll_v7/PianoRoll.jsx`
- **Source**: `usePlaybackStore.getState().currentStep`
- **Status**: ✅ Active - Uses PlaybackController position updates

### ✅ Channel Rack Playhead
- **Location**: `client/src/features/channel_rack/ChannelRack.jsx`
- **Source**: `usePlaybackStore(state => state.currentStep)`
- **Status**: ✅ Active - Uses PlaybackController position updates

### ✅ Arrangement Panel Playhead
- **Location**: `client/src/features/arrangement_v2/ArrangementPanelV2.jsx`
- **Source**: `usePlaybackStore(state => state.currentStep)`
- **Status**: ✅ Active - Uses PlaybackController position updates

### ✅ Unified Timeline Playhead
- **Location**: `client/src/features/channel_rack/UnifiedTimeline.jsx`
- **Source**: TimelineController (synced with PlaybackController)
- **Status**: ✅ Active - TimelineController uses PlaybackManager position

### ✅ Timeline Canvas Playhead
- **Location**: `client/src/features/channel_rack/TimelineCanvas.jsx`
- **Source**: TimelineController (synced with PlaybackController)
- **Status**: ✅ Active - TimelineController uses PlaybackManager position

## Implementation Details

### Position Update Flow
1. **PlaybackController** → `_emitPositionUpdate()` → `usePlaybackStore.currentStep`
2. **All Playheads** → Read from `usePlaybackStore.currentStep`
3. **TimelineController** → Uses `PlaybackManager.currentPosition` (synced with PlaybackController)

### Key Features Active in All Playheads
- ✅ Position persistence (survives stop/play cycles)
- ✅ Position lock mechanism (prevents 0 position on play start)
- ✅ Position snapshot (clean play start)
- ✅ UI/Transport separation (persistent UI position)

## Testing Checklist

- [ ] Timeline click sets playhead position
- [ ] Stop → Play: Playhead stays at clicked position
- [ ] Play → Stop → Play: Playhead stays at last position
- [ ] Transport position syncs with UI on play start
- [ ] Position lock prevents 0 position on first frames
- [ ] Multiple rapid play/stop cycles maintain position
- [ ] All playheads (Piano Roll, Channel Rack, Arrangement) stay synchronized

