/**
 * Store - Barrel Export
 * 
 * Central export for all Zustand stores.
 * 
 * Store Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                     Zustand Stores                          │
 * ├───────────────────┬──────────────────┬─────────────────────┤
 * │   Domain Stores   │   UI Stores      │   Utility Stores    │
 * ├───────────────────┼──────────────────┼─────────────────────┤
 * │ useArrangement    │ usePanels        │ useAuth             │
 * │ useInstruments    │ useTheme         │ useFileBrowser      │
 * │ useMixer          │                  │ usePreviewPlayer    │
 * │ usePlayback       │                  │ useProjectAudio     │
 * └───────────────────┴──────────────────┴─────────────────────┘
 * 
 * @module store
 */

// =================== DOMAIN STORES ===================

// Arrangement - Pattern/Song data and clips
export { useArrangementStore } from './useArrangementStore.js';
export { useArrangementWorkspaceStore } from './useArrangementWorkspaceStore.js';

// Instruments - Instrument definitions and management
export { useInstrumentsStore } from './useInstrumentsStore.js';
export { default as useInstrumentEditorStore } from './useInstrumentEditorStore.js';

// Mixer - Tracks, effects, routing
export { useMixerStore } from './useMixerStore.js';

// Playback - Transport, BPM, position
export { usePlaybackStore } from './usePlaybackStore.js';

// =================== UI STORES ===================

// Panels - Panel visibility and layout
export { usePanelsStore } from './usePanelsStore.js';

// Theme - UI theme and colors
export { useThemeStore } from './useThemeStore.js';

// =================== UTILITY STORES ===================

// Auth - User authentication
export { useAuthStore } from './useAuthStore.js';

// File Browser - File system access
export { useFileBrowserStore } from './useFileBrowserStore.js';

// Preview Player - Audio preview and waveforms
export { usePreviewPlayerStore } from './usePreviewPlayerStore.js';

// Project Audio - Exported/frozen samples
export { useProjectAudioStore } from './useProjectAudioStore.js';

// =================== DEPRECATED ===================

// useMixerUIStore - Merged into useMixerStore
// @deprecated Use useMixerStore instead
export { useMixerUIStore } from './useMixerUIStore.js';

// =================== UTILITIES ===================

// Store Manager - Cross-store coordination
export { storeManager } from './StoreManager.js';

// Selectors - Optimized state selectors
export * from './selectors/index.js';
