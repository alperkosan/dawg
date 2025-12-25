# DAW Engineering Guidelines & Best Practices

This document outlines the core engineering principles for developing a professional-grade Digital Audio Workstation (DAW). These ideals will guide our refactoring process to ensure high performance, stability, and a premium user experience.

## 1. Audio Engine Architecture (The Heart)

### 🎵 1.1. Audio Thread Isolation
*   **Principle:** The audio processing thread (WebAudio / AudioWorklet) must **never** be blocked by the main thread (UI).
*   **Ideal:** Heavy calculations (FFT, synthesis) happen in AudioWorklets or WASM.
*   **Anti-Pattern:** decoding audio or calculating layouts in a way that freezes the UI, or conversely, heavy DOM updates causing audio crackles (dropouts).

### 🚀 1.2. Zero-Allocation (Garbage Collection Avoidance)
*   **Principle:** Garbage Collection (GC) pauses cause audio dropouts.
*   **Implement:**
    *   **Object Pooling:** Pre-allocate voices, oscillators, and event objects. Reuse them instead of `new` + `delete`.
    *   **Static Buffers:** specific TypedArrays (Float32Array) for signal processing, reused every frame.
*   **Goal:** ZERO allocations inside the `process()` loop of AudioWorklets.

### ⏱ 1.3. Sample-Accurate Scheduling
*   **Principle:** `setTimeout` and `setInterval` are not precise enough for music (jittery).
*   **Implement:** Schedule events (notes, parameter automation) using `AudioContext.currentTime` (lookahead scheduling).
*   **Mechanism:** React Main Loop -> Lookahead Window (e.g., 100ms) -> Schedule WebAudio Nodes.

---

## 2. React UI & Visualization (The Face)

### ⚡ 2.1. Decoupled Rendering
*   **Principle:** Audio state changes 44,100 times per second. UI typically updates at 60Hz.
*   **Implement:**
    *   **Do NOT** sync React state for every volume meter update.
    *   **Use:** `requestAnimationFrame` loops that read directly from Analyzers or SharedArrayBuffers for meters/scopes.
    *   **Bypass React:** modifying DOM elements directly (refs) for high-frequency visuals (VU meters, playheads) is acceptable to avoid React Reconciliation overhead.

### 🖌 2.2. Virtualization
*   **Principle:** A project may have 1000s of clips or notes. DOM nodes are heavy.
*   **Implement:** Windowing/Virtualization (e.g., `react-window`) for Piano Roll and Playlist. Only render what is visible on screen.

### 🧠 2.3. State Management (UI vs Audio)
*   **Principle:** Single Source of Truth, but Dual Representation.
    *   **Project State:** Serializable JSON (Save/Load).
    *   **Audio Graph:** Live WebAudio Nodes.
*   **Sync Strategy:**
    1.  User turns knob (UI).
    2.  Update React State (Optimistic UI).
    3.  Send "Command" to Audio Service.
    4.  Audio Service ramps value (`linearRampToValueAtTime`) to prevent "zipper noise".

---

## 3. Engineering Quality & Maintainability

### 🧩 3.1. Modularity
*   **Principle:** Each component (Mixer, Sequencer, Synth) should be testable in isolation.
*   **Structure:**
    *   `core/`: Audio Engine (Logic only, no UI).
    *   `features/`: UI Components + Business Logic.
    *   `services/`: Bridges between UI and Core.

### 🛡 3.2. Error Resilience
*   **Principle:** A crash in a plugin or UI panel should not stop the audio engine.
*   **Implement:** Error Boundaries in React. Catch blocks in AudioWorklet messaging.

---

## 4. Refactoring Checklist for Panels

For each panel (Mixer, Piano Roll, Playlist, Browser), we will audit:

1.  **Rendering Performance:** Are we re-rendering the whole panel for a single solo update?
2.  **Audio Sync:** Is the visual state safely decoupled from high-frequency audio data?
3.  **Code Quality:** proper hooks structure, no "God Components", strict type checks (props).
4.  **UX Polish:** Smooth transitions, proper cursor feedback, keyboard shortcuts.
