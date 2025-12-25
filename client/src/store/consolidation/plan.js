/**
 * Store Consolidation Plan
 * 
 * Current State: 13 stores, 7,036 lines
 * Target: 9 stores (4 merges)
 * 
 * Merge Plan:
 * 1. useMixerUIStore (78) → useMixerStore (962)
 *    - UI state like activeChannel, expandedChannels belongs with mixer
 * 
 * 2. usePreviewPlayerStore (560) → useInstrumentsStore (437)
 *    - Preview is instrument-related functionality
 * 
 * 3. useProjectAudioStore (89) → usePlaybackStore (326)
 *    - Audio settings belong with playback
 * 
 * 4. useInstrumentEditorStore (300) → useInstrumentsStore (437)
 *    - Editor state for instruments belongs with instruments
 * 
 * Keeps Separate:
 * - useArrangementStore (1284) - Too large, core domain
 * - useArrangementWorkspaceStore (1050) - Separate concern (workspace vs data)
 * - useMixerStore (962) - Core domain
 * - useFileBrowserStore (941) - Separate feature
 * - useThemeStore (671) - UI/visual only
 * - useAuthStore (78) - Security isolated
 * - usePanelsStore (260) - Layout only
 */

export const STORE_CONSOLIDATION_PLAN = {
    phase1: {
        name: 'Mixer UI Merge',
        source: 'useMixerUIStore',
        target: 'useMixerStore',
        slices: ['ui']
    },
    phase2: {
        name: 'Preview Player Merge',
        source: 'usePreviewPlayerStore',
        target: 'useInstrumentsStore',
        slices: ['preview']
    },
    phase3: {
        name: 'Project Audio Merge',
        source: 'useProjectAudioStore',
        target: 'usePlaybackStore',
        slices: ['audioSettings']
    },
    phase4: {
        name: 'Instrument Editor Merge',
        source: 'useInstrumentEditorStore',
        target: 'useInstrumentsStore',
        slices: ['editor']
    }
};
