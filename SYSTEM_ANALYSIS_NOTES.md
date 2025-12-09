# System Analysis Notes

This document contains detailed engineering notes, observations, and refactoring recommendations for each file analyzed during the system review.

## Phase 1: Entry & Global Scope

### `src/main.jsx`
*   **Status:** ✅ Good
*   **Observations:**
    *   Standard Vite React entry point.
    *   `React.StrictMode` is enabled (good for catching side effects).
    *   `DndProvider` (React DnD) is initialized here, which is appropriate for a global drag-and-drop context.
*   **Recommendations:** None.

---

### `src/App.jsx`
*   **Status:** ❌ Needs Refactor (Critical)
*   **Observations:**
    *   **"God Component":** Over 1100 lines. Acts as a catch-all for Global State, Audio Initialization, Project Logic, and Routing.
    *   **Logic Coupling:** Audio Engine setup is tightly coupled with React Effects inside the view layer.
    *   **Hacky DOM Updates:** Uses `queueMicrotask` + `flushSync` in `showNotification` to force React updates, indicating sync issues.
*   **Recommendations:**
    *   Extract `InitializationLogic` into a custom hook `useSystemBoot()`.
    *   Move Project Save/Load logic to a `<ProjectManager />` non-visual component or Context.
    *   Move `ToastContainer` logic to a dedicated `ToastProvider`.

### `src/store/useThemeStore.js`
*   **Status:** ⚠️ Bloated
*   **Observations:**
    *   Contains massive hardcoded theme definition objects inside the store file (~500 lines of data).
    *   Uses `window.dispatchEvent` (Good!) to notify non-React components (Canvas) of theme changes.
*   **Recommendations:**
    *   Move `defaultThemes` array to `src/config/themes.js` or `src/data/themes.json`.
    *   Keep store logic pure (CRUD for themes).

### `src/store/usePanelsStore.js`
*   **Status:** ⚠️ Leaky Logic
*   **Observations:**
    *   Store contains business logic (`handleEditInstrument`) that decides *how* to open an editor, fetching audio buffers, etc.
    *   This couples UI state management with Domain Data logic.
*   **Recommendations:**
    *   Simplify store to only track `panelState` (isOpen, position).
    *   Move "Open Editor" logic to a controller or the `InstrumentEditor` component itself.
    *   Remove legacy commented-out code.

### `src/store/useAuthStore.js`
*   **Status:** ✅ Good
*   **Observations:**
    *   standard implementation with `persist`. Simple and effective.

---

## Phase 2: Layout & Navigation

### `src/layout/WorkspacePanel.jsx`
*   **Status:** ⚠️ Mixed Concerns
*   **Observations:**
    *   **Logic Leak:** Contains significant logic for initializing and rendering Plugins (lines 238-305). It checks effect types, looks up registries, and manages V1/V2 container logic.
    *   **Fragile Theme Effects:** Renders atmospheric effects based on string matching (`activeTheme.name`).
    *   **Event Listeners:** Manually adds `mousemove`/`mouseup` listeners for sidebar resizing. Could be extracted to a `useResizable` hook.
*   **Recommendations:**
    *   Extract Plugin rendering logic to a `<PluginRenderer />` component.
    *   Memoize theme effect rendering.

### `src/features/toolbars/TopToolbar.jsx`
*   **Status:** ⚠️ Direct Coupling
*   **Observations:**
    *   **Direct Audio Call:** Directly calls `AudioContextService.setMasterVolume(value)`. This bypasses the Store/Action pattern.
    *   **Redundant State:** Local `masterVolume` state might desync with actual Audio Engine volume if changed elsewhere.
*   **Recommendations:**
    *   Move volume control to `useMixerStore` or `usePlaybackStore` actions.

### `src/features/toolbars/MainToolbar.jsx`
*   **Status:** ⚠️ Dead Code (Minor)
*   **Observations:**
    *   **Unused State:** `performanceStats` state is defined but never updated or rendered.
*   **Recommendations:**
    *   Remove unused `performanceStats` state.

### `src/components/layout/NavigationHeader.jsx`
*   **Status:** ✅ Good
*   **Observations:**
    *   Clean routing logic.
    *   Conditional rendering for Auth/Project states is handled well.

### `src/features/taskbar/Taskbar.jsx`
*   **Status:** ✅ Good
*   **Observations:**
    *   Simple functional component.
    *   Correctly uses `usePanelsStore`.

---

## Phase 3: Core Feature Panels

### `src/features/mixer/Mixer.jsx`
*   **Status:** ✅ Good (Modern)
*   **Observations:**
    *   Clean separation of concerns with sub-components (`MixerChannel`, `EffectsRack`).
    *   Good use of store selectors to optimize re-renders.
    *   **Minor:** standard `useEffect` for keyboard shortcuts could be centralized.

### `src/features/piano_roll_v7/PianoRoll.jsx`
*   **Status:** ⚠️ Complex / Leaky
*   **Observations:**
    *   **Logic Leak:** `MIDIRecorder` initialization and event handling (recording logic) is hardcoded inside this visual component.
    *   **Tech Debt:** Contains "V2 DEPRECATED" / "V3 ACTIVE" comments, indicating ongoing transitions.
    *   **Performance:** Correctly uses Canvas for the heavy lifting (grid/notes).

### `src/features/channel_rack/ChannelRack.jsx`
*   **Status:** ⚠️ Data Logic in UI
*   **Observations:**
    *   **Critical Logic Leak:** The `handleNativeDrop` function directly fetches, decodes, and processes AudioBuffers from dropped files. This is heavy business logic inside a React view.
    *   **Architecture:** Hybrid DOM (Instrument List) + Canvas (Timeline) makes scroll synchronization complex (handled by custom sync utilities).

### `src/features/arrangement_v2/ArrangementPanelV2.jsx`
*   **Status:** ✅ Good (Canvas Architecture)
*   **Observations:**
    *   Fully canvas-based rendering for performance.
    *   **Logic Leak:** `handleClipDoubleClick` performs direct audio buffer loading/decoding from `audioAssetManager`.
    *   **Dependency:** Tightly coupled to `StyleCache` for theming (which is fine, just complex).

---

## Phase 4: Shared UI Components

### `src/components/controls/base/Knob.jsx`
*   **Status:** ✅ Excellent
*   **Observations:**
    *   high-quality implementation.
    *   Uses `requestAnimationFrame` for throttling updates (Performance friendly).
    *   Includes accessibility attributes (`aria-valuenow`, etc.).
    *   Handles "Ghost Values" for latency visualization.
    *   Safe against `NaN` crashes.

---

## Phase 5: Core Services & Audio Engine

### `src/lib/services/AudioContextService.js`
*   **Status:** ❌ Critical God Object
*   **Observations:**
    *   **Monolithic:** ~2700 lines. Managing *everything* related to audio.
    *   **Logic Coupling:** Directly initializes Interface Layers (`TimelineSelectionAPI`, etc.).
    *   **Router Coupling:** Watches `window.location` to trigger "Idle Optimization" (suspending audio context). This couples the low-level service to the router.
    *   **Mixer Logic:** Direct manipulation of mixer tracks.

### `src/lib/audio/RenderEngine.js`
*   **Status:** ⚠️ Tight Coupling
*   **Observations:**
    *   Imports `AudioContextService` directly to access the active engine instance.
    *   Has its own sync logic (`_getSyncedSampleRate`) which is good but could be standardized.
    *   Offline rendering logic is robust (using `OfflineAudioContext` and Worklets).
