# Phase 2 - Step 4: Identify and Update Other Direct Usages of Old Singletons (Progress Update)

## Work Completed

### 1. `TransportController` Enhancements
- Updated **`lib/core/TransportController.js`** to serve as the full replacement for `TimelineController` mechanics.
- Added advanced `registerTimeline` features:
  - `enableInteraction` flag support.
  - `calculatePosition` custom callback support (for complex viewports like Piano Roll).
  - `onGhostPositionChange` callback support.
  - Integration with `EventBus` and `UIUpdateManager`.
- Exposed `isScrubbing` state in `getState()` for UI animations.

### 2. Piano Roll Migration (`features/piano_roll_v7/PianoRoll.jsx`)
- Replaced `TimelineControllerSingleton` with `TransportController` (via `AudioContextService`).
- Updated `registerTimeline` usage to match new `TransportController` API.
- Implemented ghost playhead logic using the new callback system.

### 3. Timeline Canvas Migration (`features/channel_rack/TimelineCanvas.jsx`)
- Replaced `TimelineControllerSingleton` with `TransportController`.
- Migrated interaction logic and loop length synchronization.
- Updated seek preview logic to use `TransportController` state.

### 4. Arrangement Panel V2 Migration (`features/arrangement_v2/ArrangementPanelV2.jsx`)
- Replaced `TimelineControllerSingleton` with `TransportController`.
- Updated `setCursorPosition` directly using `transportController.jumpToStep`.

### 5. Playback Controls Migration (`components/playback/PlaybackControls.jsx`)
- Refactored entire component to use `TransportController` for Stop/Play/Pause and Bar Jumping.
- Removed dependency on `TimelineControllerSingleton`.

### 6. Playback Controller Hook (`hooks/usePlaybackController.js`)
- **Rewrote completely** to act as an adapter for `usePlaybackStore` (the new SSOT).
- This effectively removes usage of `PlaybackControllerSingleton` from the hook system.
- Maintained legacy API signature for compatibility but routed all logic to modern store.

## Remaining Tasks for SSOT Completion

The following files still reference `TimelineControllerSingleton`:
1. `store/useArrangementStore.js`
2. `lib/midi/MIDIRecorder.js`

Once these are updated, `TimelineControllerSingleton.js`, `TransportManagerSingleton.js`, and `PlaybackControllerSingleton.js` can be safely deleted.
