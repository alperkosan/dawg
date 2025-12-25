# System Analysis & Refactor Schedule ("Outside-In")

This schedule defines the order of battle for our comprehensive system analysis and refactor. We will proceed from the outer "shell" of the application towards the inner "core" logic, ensuring the container is solid before optimizing the contents.

## Phase 1: Entry & Global Scope (The "Shell")
**Goal:** Ensure the application boots correctly, manages global state efficiently, and handles routing without leaks.
*   **Target Files:**
    *   `src/main.jsx`: Boot logic, strict mode.
    *   `src/App.jsx`: The "God Component" - needs splitting.
    *   `src/components/common/StartupScreen.jsx`: Initial user experience.
    *   `src/store/`: Review top-level stores (`useAuthStore`, `useThemeStore`, `usePanelsStore`).

## Phase 2: Layout & Navigation Structure
**Goal:** Verify that the main UI skeleton is lightweight and decoupled from audio state.
*   **Target Files:**
    *   `src/layout/WorkspacePanel.jsx`: Main flex/grid container.
    *   `src/features/toolbars/TopToolbar.jsx`: Transport controls, Menu.
    *   `src/features/toolbars/MainToolbar.jsx`: Tools (Select, Draw, Cut).
    *   `src/features/taskbar/Taskbar.jsx`: Bottom status bar.
    *   `src/components/layout/NavigationHeader.jsx`: Page navigation.

## Phase 3: Core Feature Panels (The Workhorse Layers)
**Goal:** Deep dive into specific functionalities. Each panel will be audited for the **DAW Engineering Standards** (Rendering Performance, Virtualization, Audio Sync).
*   **Priority 1: Mixer** (`src/features/mixer/`)
    *   Analyze meter rendering (React vs. RAF).
    *   Check Fader/Knob event handling.
*   **Priority 2: Piano Roll** (`src/features/piano_roll_v7/`)
    *   Review note rendering virtualization.
    *   Audit interaction logic (drag/resize notes).
*   **Priority 3: Arrangement** (`src/features/arrangement_v2/`)
    *   Analyze clip rendering and scrolling performance.
*   **Priority 4: Browser** (`src/features/file_browser/`)
    *   Check file list virtualization.
    *   Review search performance.

## Phase 4: Shared UI Library
**Goal:** Ensure reusable components are performant and accessible.
*   **Target Components:**
    *   `Knob.jsx`, `Fader.jsx`, `Toggle.jsx`.
    *   `SpectrumAnalyzer.jsx`, `Oscilloscope.jsx`.

## Phase 5: Core Services (Deep Logic)
**Goal:** Optimize the engine under the hood.
*   **Target Files:**
    *   `src/lib/core/NativeAudioEngine.js`
    *   `src/lib/services/AudioContextService.js`
    *   `src/lib/services/projectService.js` (Serialization/Hydration)

---

## Execution Strategy
For each item in the list above, we will:
1.  **Read & Map:** Understand the current implementation.
2.  **Audit:** Compare against `DAW_ENGINEERING_GUIDELINES.md`.
3.  **Refactor:** Apply fixes (Split components, optimize rendering, improve typings).
4.  **Verify:** Test changes.
