Migrated Piano Roll and PlaybackController to TransportController.

## Files Updated
- **`features/piano_roll_v7/PianoRoll.jsx`**: Replaced `TimelineControllerSingleton` with `TransportController`. Updated `registerTimeline` to use new API with interaction flags and callbacks.
- **`features/channel_rack/TimelineCanvas.jsx`**: Replaced legacy controller usage. Updated loop length sync and seek preview logic to use `TransportController`.
- **`features/arrangement_v2/ArrangementPanelV2.jsx`**: Wired transport actions to `AudioContextService.getTransportController()`.
- **`components/playback/PlaybackControls.jsx`**: Refactored transport buttons to use the unified `TransportController`.
- **`hooks/usePlaybackController.js`**: Rewritten as an adapter for `usePlaybackStore`, eliminating `PlaybackControllerSingleton` dependency while maintaining API compatibility.
- **`lib/core/TransportController.js`**: Enhanced support for timeline registration (interaction flags, custom position calculators, `onSeek`/`onGhostPositionChange` callbacks) to match legacy feature set.

## Status
- **Piano Roll Migration**: ✅ Complete.
- **Playback Controller Migration**: ✅ Complete (and aligned with Store SSOT).
- **Architecture**: `TransportController` is now the dominant controller for UI and Transport logic. `TimelineController` usage is significantly reduced (only remains in `MIDIRecorder` and `useArrangementStore`).
