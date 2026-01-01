bir# Unified Transport & Playback Architecture Analysis

## 1. Problem Statement
The current transport system suffers from fragmentation, lack of synchronization, and "split realities" between the UI, JavaScript Transport logic, and the WASM Audio Engine. Key symptoms observed:
- **Space Bar Behavior**: Pressing pause resets position to start (STOP behavior) instead of pausing in place.
- **Playhead Desync**: The visual playhead does not accurately track the audio position, or fails to update during seeks/pauses.
- **Multiple Sources of Truth**: `TransportController`, `NativeTransportSystem`, and `WasmAudioEngine` all maintain separate state counters that drift apart.
- **Performance**: Redundant event logic and lack of SharedArrayBuffer optimization for UI reading.

## 2. Proposed "Unified" Architecture
The goal is to establish a **Single Source of Truth (SSOT)** architecture where state flows unidirectionally from the Audio Engine (Physical Reality) to the UI (Visual Reality).

### 2.1 The Sync Hierarchy
1.  **Level 0: The Physical Clock (WASM/Worklet)**
    *   **SharedArrayBuffer (SAB)** is the Master Clock.
    *   Indices: `SAB_IDX_POS_TICKS` (Current Position), `SAB_IDX_PLAY_STATE` (Status).
    *   The Audio Worklet is the *only* writer to `SAB_IDX_POS_TICKS` during playback.

2.  **Level 1: The Transport Broker (`NativeTransportSystem.js`)**
    *   Manages the SAB setup and command dispatching (Play/Pause/Stop/Seek).
    *   **Does NOT** maintain its own independent "tick" counter during playback. It trusts the SAB.
    *   Exposes `getAccuratePosition()` which reads directly from SAB `Float32Array`.

3.  **Level 2: The UI Controller (`TransportController.js`)**
    *   Purely a "View Controller" for Transport.
    *   Does NOT simulate playback steps.
    *   On `play()`: Sends command to Level 1.
    *   On `pause()`: Sends command to Level 1.
    *   On `UI Update Loop`: Reads Level 1's `getAccuratePosition()` directly to drive UI elements via refs.

4.  **Level 3: The View (`ArrangementPanelV2` / `PlayheadRenderer`)**
    *   Uses `requestAnimationFrame`.
    *   Reads position from `TransportController` (who reads from `NativeTransportSystem`).
    *   Updates DOM `transform` directly.
    *   **CRITICAL**: The loop must continue running even when Paused (or update once on Pause) to show correct position.

### 2.2 Correcting the "Space Bar Stop" Bug
*   **Current Issue**: `NativeTransportSystem.pause()` likely triggers a logic path that resets `currentTick` or the `ArrangementPanelV2` unmounts the renderer when `isPlaying` becomes false.
*   **Fix**:
    *   Pause Command should simply set SAB State = 2 (Paused).
    *   Worklet stops incrementing tick.
    *   Tick count remains valid (e.g., 5400 ticks).
    *   UI reads 5400 ticks and stays there.
    *   Ensure `ArrangementPanelV2` does not hide playhead when `!isPlaying`. It should show playhead if `!isStopped`.

### 2.3 Performance Optimization Plan
1.  **Direct Memory Access**: UI components generally read from React State / Stores. This is too slow (16ms lag minimum). We will expose a direct SAB reader to `ArrangementPanelV2`.
2.  **Event Batching**: Reduce `EventBus` spam. Position updates should be *pulled* via RAF, not *pushed* via events, except for discrete state changes (Start/Stop/Seek).
3.  **Unified Loop**: A single `UIUpdateManager` (already exists) should drive the Playhead, verified to be efficient.

## 3. Implementation Roadmap

### Phase 1: Clean Transport Controller
- [ ] Remove all legacy "simulation" code from `TransportController`.
- [ ] Ensure `TransportController` delegates *everything* to `NativeTransportSystem`.
- [ ] Implement `getPrecisePosition()` in `TransportController` that proxies `NativeTransportSystem`.

### Phase 2: Fix Native Transport System
- [ ] Verify `pause()` logic does not reset ticks.
- [ ] Align PPQ (already done: 48).
- [ ] Ensure SAB is exposed cleanly.

### Phase 3: Update Arrangement Panel
- [ ] Change `useEffect` dependency: The Playhead RAF loop should run if `playbackState !== STOPPED`.
- [ ] Render Playhead even if Paused.
- [ ] Use `TransportController.getPrecisePosition()` inside the RAF loop.

## 4. Key Rules
*   **Never** write to SAB from UI (except via `NativeTransportSystem` commands).
*   **Never** assume `Date.now()` is the audio time.
*   **Always** trust `SAB_IDX_POS_TICKS`.
