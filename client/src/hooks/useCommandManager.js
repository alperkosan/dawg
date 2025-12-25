/**
 * useCommandManager - React Hook for Undo/Redo
 * 
 * Provides access to the global command manager for undo/redo functionality.
 * 
 * Usage:
 * ```jsx
 * import { useCommandManager, useUndoRedo } from '@/hooks/useCommandManager';
 * import { AddNoteCommand } from '@/lib/core/commands';
 * 
 * function PianoRoll() {
 *   const { execute, undo, redo, canUndo, canRedo } = useUndoRedo();
 *   
 *   const handleAddNote = (note) => {
 *     execute(new AddNoteCommand(store, patternId, instrumentId, note));
 *   };
 * }
 * ```
 * 
 * @module hooks/useCommandManager
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { globalCommandManager } from '@/lib/core/commands/CommandManager.js';

/**
 * Hook to access the global command manager
 * @returns {CommandManager}
 */
export function useCommandManager() {
    return globalCommandManager;
}

/**
 * Hook for undo/redo functionality with reactive state
 * @returns {Object} Undo/redo methods and state
 */
export function useUndoRedo() {
    const [canUndo, setCanUndo] = useState(globalCommandManager.canUndo());
    const [canRedo, setCanRedo] = useState(globalCommandManager.canRedo());
    const [lastCommand, setLastCommand] = useState(globalCommandManager.getLastCommandDescription());

    useEffect(() => {
        const listener = ({ action, command, canUndo: canUndoNow, canRedo: canRedoNow }) => {
            setCanUndo(canUndoNow);
            setCanRedo(canRedoNow);
            setLastCommand(globalCommandManager.getLastCommandDescription());
        };

        globalCommandManager.addListener(listener);

        return () => {
            globalCommandManager.removeListener(listener);
        };
    }, []);

    const execute = useCallback((command) => {
        return globalCommandManager.execute(command);
    }, []);

    const undo = useCallback(() => {
        return globalCommandManager.undo();
    }, []);

    const redo = useCallback(() => {
        return globalCommandManager.redo();
    }, []);

    const beginBatch = useCallback((name) => {
        globalCommandManager.beginBatch(name);
    }, []);

    const endBatch = useCallback(() => {
        globalCommandManager.endBatch();
    }, []);

    const cancelBatch = useCallback(() => {
        globalCommandManager.cancelBatch();
    }, []);

    const clear = useCallback(() => {
        globalCommandManager.clear();
    }, []);

    return {
        execute,
        undo,
        redo,
        canUndo,
        canRedo,
        lastCommand,
        beginBatch,
        endBatch,
        cancelBatch,
        clear
    };
}

/**
 * Hook for keyboard shortcuts (Ctrl+Z, Ctrl+Y)
 * @param {boolean} enabled - Whether shortcuts are enabled
 */
export function useUndoRedoShortcuts(enabled = true) {
    const { undo, redo, canUndo, canRedo } = useUndoRedo();

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event) => {
            // Skip if in input/textarea
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

            if (ctrlOrCmd && event.key === 'z' && !event.shiftKey) {
                event.preventDefault();
                if (canUndo) {
                    undo();
                }
            } else if (ctrlOrCmd && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
                event.preventDefault();
                if (canRedo) {
                    redo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, undo, redo, canUndo, canRedo]);
}

/**
 * Hook to get undo/redo button labels
 * @returns {Object} Labels for undo/redo buttons
 */
export function useUndoRedoLabels() {
    const [undoLabel, setUndoLabel] = useState('Undo');
    const [redoLabel, setRedoLabel] = useState('Redo');

    useEffect(() => {
        const listener = () => {
            const lastCmd = globalCommandManager.getLastCommandDescription();
            const nextRedo = globalCommandManager.getNextRedoDescription();

            setUndoLabel(lastCmd ? `Undo: ${lastCmd}` : 'Undo');
            setRedoLabel(nextRedo ? `Redo: ${nextRedo}` : 'Redo');
        };

        globalCommandManager.addListener(listener);
        listener(); // Initial call

        return () => globalCommandManager.removeListener(listener);
    }, []);

    return { undoLabel, redoLabel };
}

export default useCommandManager;
