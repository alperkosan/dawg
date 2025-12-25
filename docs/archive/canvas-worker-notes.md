# Canvas Worker Migration Notes

Latest status: ✅ Channel Rack grid now renders via the shared `CanvasWorkerBridge`, with incremental data feeds from `UnifiedGridCanvas`.

## Goals
- Offload render loops for heavy canvases (Channel Rack grid first, Piano Roll + Mixer meters next) to a shared Web Worker.
- Keep the main thread responsive by eliminating repeated DOM/canvas work and minimizing serialization overhead.
- Provide a consistent protocol so future canvases can piggyback on the same worker infrastructure.

## Key Components
### `CanvasWorkerBridge`
- Manages worker lifecycle, surface registration, message queuing, and transferable OffscreenCanvas objects.
- Tracks canvases with a `WeakMap` to prevent multiple `transferControlToOffscreen` calls (avoids `InvalidStateError` when panels mount/unmount or when React StrictMode double-renders).
- Surfaces receive two-phase setup:
  1. `REGISTER_SURFACE`: load renderer module, set initial state, and get a `markDirty` hook.
  2. `INIT_SURFACE`: deliver the OffscreenCanvas and start the dedicated render loop.

### `canvasRenderWorker.js`
- Hosts all renderer modules and runs one `requestAnimationFrame` loop per surface.
- Marks surfaces dirty when updates arrive or when the renderer itself calls `markDirty`.
- Currently ships with `channelRackGridRenderer`; Piano Roll + Mixer surfaces will register separate renderer names but reuse the same infrastructure.

### `UnifiedGridCanvas.jsx`
- Creates and owns a single `<canvas>` element in React, then hands it off to the worker when OffscreenCanvas is supported.
- Maintains refs for scroll positions, hover, palette, etc., so state changes can stream to the worker without triggering React re-renders.
- **Serialization optimizations**:
  - One-time full sync when the panel becomes visible; caches instrument signatures, serialized note arrays, palette hash, loop length, etc.
  - Diff-based updates after the initial sync. Only changed instruments, notes, pattern lengths, or viewport dimensions are sent.
  - Notes diff watches actual note content (id/start/length/pitch/velocity/mute), not just array references, so in-place mutations still trigger patches.
  - Scroll updates throttle themselves by comparing the last sent coordinates before posting.

## Renderer Changes (`channelRackGridRenderer.js`)
- Accepts `notesPatch` and `notesRemove` messages so incremental updates can mutate its local `notesData` without rebuilding the entire state object.
- Draw stack mirrors the previous main-thread renderer:
  - Row backgrounds, grid lines, mini-step dividers.
  - Pattern overlay dimming beyond loop length.
  - Adaptive notes (step-sequencer bars vs. mini preview with pitch-based positioning).
  - Hover ghost note visuals.
- Maintains its own palette cache and only redraws when marked dirty.

## Known Follow-ups
1. **Typed buffer transport** for note payloads to reduce GC pressure (current JSON clone already drops CPU, but typed arrays will avoid repeated object allocations).
2. **Shared worker adoption** for Piano Roll layered canvases and Mixer meters (all can reuse the diff protocol + renderer catalog).
3. **Telemetry hooks** to record worker render timings vs. main-thread fallbacks for performance overlay reporting.

## Testing Checklist
- Toggle notes in step sequencer & mini preview rows; verify patches repaint within the worker.
- Scroll/zoom Channel Rack while hidden & re-opened; confirm worker retains surfaces without re-transfer errors.
- Disable OffscreenCanvas in browser flags → ensure main thread fallback path still renders.

These notes should be updated as soon as Piano Roll and Mixer surfaces join the shared pipeline or if the protocol changes (e.g., typed buffers, z-order layers, clip rect support).

