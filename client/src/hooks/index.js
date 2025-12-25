/**
 * Hooks - Barrel Export
 * 
 * Central export for all custom React hooks.
 * 
 * Hook Categories:
 * - Audio Engine hooks (useAudioEngine, usePlaybackControl, etc.)
 * - Command Manager hooks (useCommandManager, useUndoRedo)
 * - State hooks (useEngineState)
 * - UI hooks (useAutomationEditor, usePianoRoll)
 * 
 * @module hooks
 */

// =================== AUDIO ENGINE HOOKS ===================

export {
    useAudioEngine,
    useAudioServices,
    usePlaybackControl,
    useMixerControl,
    useInstrumentControl,
    useEffectControl
} from './useAudioEngine.js';

// =================== COMMAND MANAGER HOOKS ===================

export {
    useCommandManager,
    useUndoRedo,
    useUndoRedoShortcuts,
    useUndoRedoLabels
} from './useCommandManager.js';

// =================== STATE HOOKS ===================

export { useEngineState } from './useEngineState.js';
export { usePlaybackController } from './usePlaybackController.js';
export { usePlaybackControls } from './usePlaybackControls.js';
export { useTransportManager } from './useTransportManager.js';

// =================== UI HOOKS ===================

export { useAutomationEditor } from './useAutomationEditor.js';
export { usePianoRoll } from './usePianoRoll.js';
export { useGlobalPlayhead } from './useGlobalPlayhead.js';
export { useOptimizedPlayhead } from './useOptimizedPlayhead.js';

// =================== UTILITY HOOKS ===================

export { useSystemBoot } from './useSystemBoot.js';
export { useProjectManager } from './useProjectManager.js';
export { useToast } from './useToast.js';
export { useWaveformLoader } from './useWaveformLoader.js';

// =================== AUDIO HOOKS ===================

export { useAudioPlugin } from './useAudioPlugin.js';
export { useAudioRecording } from './useAudioRecording.js';
export { useAudioRenderer } from './useAudioRenderer.js';
export { useAudioParameterBatcher } from './useAudioParameterBatcher.js';
