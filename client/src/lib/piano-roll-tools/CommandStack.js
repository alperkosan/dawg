/**
 * PIANO ROLL COMMAND STACK
 *
 * Undo/Redo system using Command Pattern
 * Professional DAW-style history management
 *
 * Features:
 * - Command batching for complex operations
 * - 100-level history
 * - Memory-efficient state snapshots
 * - Keyboard shortcuts (Ctrl+Z / Ctrl+Y)
 */

/**
 * Base Command Interface
 * All note operations must implement this
 */
export class ICommand {
    execute() {
        throw new Error('Command.execute() must be implemented');
    }

    undo() {
        throw new Error('Command.undo() must be implemented');
    }

    getDescription() {
        return 'Unknown command';
    }
}

/**
 * Add Note Command
 */
export class AddNoteCommand extends ICommand {
    constructor(note, addNoteFn, deleteNoteFn) {
        super();
        this.note = note;
        this.addNoteFn = addNoteFn;
        this.deleteNoteFn = deleteNoteFn;
    }

    execute() {
        this.addNoteFn(this.note);
    }

    undo() {
        this.deleteNoteFn([this.note.id]);
    }

    getDescription() {
        return `Add note ${this.note.pitch} at ${this.note.startTime}`;
    }
}

/**
 * Delete Notes Command
 */
export class DeleteNotesCommand extends ICommand {
    constructor(notes, deleteNoteFn, addNotesFn) {
        super();
        this.notes = notes; // Array of note objects to delete
        this.deleteNoteFn = deleteNoteFn;
        this.addNotesFn = addNotesFn;
    }

    execute() {
        const noteIds = this.notes.map(n => n.id);
        this.deleteNoteFn(noteIds);
    }

    undo() {
        this.addNotesFn(this.notes);
    }

    getDescription() {
        return `Delete ${this.notes.length} note(s)`;
    }
}

/**
 * Update Note Command (for resize, velocity change, etc.)
 */
export class UpdateNoteCommand extends ICommand {
    constructor(noteId, oldState, newState, updateNoteFn) {
        super();
        this.noteId = noteId;
        this.oldState = oldState;
        this.newState = newState;
        this.updateNoteFn = updateNoteFn;
    }

    execute() {
        this.updateNoteFn(this.noteId, this.newState);
    }

    undo() {
        this.updateNoteFn(this.noteId, this.oldState);
    }

    getDescription() {
        const changedProps = Object.keys(this.newState).join(', ');
        return `Update note ${this.noteId} (${changedProps})`;
    }
}

/**
 * Move Notes Command (for drag operations)
 */
export class MoveNotesCommand extends ICommand {
    constructor(noteIds, originalStates, newStates, updatePatternStoreFn) {
        super();
        this.noteIds = noteIds;
        this.originalStates = originalStates; // Map<noteId, {startTime, pitch}>
        this.newStates = newStates; // Map<noteId, {startTime, pitch}>
        this.updatePatternStoreFn = updatePatternStoreFn;
    }

    execute() {
        this.updatePatternStoreFn(this.newStates);
    }

    undo() {
        this.updatePatternStoreFn(this.originalStates);
    }

    getDescription() {
        return `Move ${this.noteIds.length} note(s)`;
    }
}

/**
 * Transpose Notes Command
 */
export class TransposeNotesCommand extends ICommand {
    constructor(notes, semitones, updatePatternStoreFn) {
        super();
        this.notes = notes; // Array of note objects
        this.semitones = semitones; // Number of semitones to transpose (+/-)
        this.updatePatternStoreFn = updatePatternStoreFn;

        // Store original pitches for undo
        this.originalPitches = new Map();
        notes.forEach(note => {
            this.originalPitches.set(note.id, note.pitch);
        });
    }

    execute() {
        const transposedNotes = this.notes.map(note => {
            const newPitch = Math.max(0, Math.min(127, note.pitch + this.semitones));
            return { ...note, pitch: newPitch };
        });
        this.updatePatternStoreFn(transposedNotes);
    }

    undo() {
        const restoredNotes = this.notes.map(note => {
            const originalPitch = this.originalPitches.get(note.id);
            return { ...note, pitch: originalPitch };
        });
        this.updatePatternStoreFn(restoredNotes);
    }

    getDescription() {
        const direction = this.semitones > 0 ? 'up' : 'down';
        const amount = Math.abs(this.semitones);
        return `Transpose ${this.notes.length} note(s) ${direction} by ${amount} semitone(s)`;
    }
}

/**
 * Toggle Mute Command (Ghost Notes)
 */
export class ToggleMuteCommand extends ICommand {
    constructor(notes, updatePatternStoreFn) {
        super();
        this.notes = notes; // Array of note objects
        this.updatePatternStoreFn = updatePatternStoreFn;

        // Store original mute states for undo
        this.originalMuteStates = new Map();
        notes.forEach(note => {
            this.originalMuteStates.set(note.id, note.isMuted || false);
        });
    }

    execute() {
        const toggledNotes = this.notes.map(note => {
            return { ...note, isMuted: !(note.isMuted || false) };
        });
        this.updatePatternStoreFn(toggledNotes);
    }

    undo() {
        const restoredNotes = this.notes.map(note => {
            const originalMuteState = this.originalMuteStates.get(note.id);
            return { ...note, isMuted: originalMuteState };
        });
        this.updatePatternStoreFn(restoredNotes);
    }

    getDescription() {
        const muteCount = this.notes.filter(n => !n.isMuted).length;
        const unmuteCount = this.notes.length - muteCount;
        if (muteCount > unmuteCount) {
            return `Mute ${muteCount} note(s)`;
        } else {
            return `Unmute ${unmuteCount} note(s)`;
        }
    }
}

/**
 * Batch Command (for complex operations with multiple sub-commands)
 */
export class BatchCommand extends ICommand {
    constructor(commands, description = 'Batch operation') {
        super();
        this.commands = commands;
        this.description = description;
    }

    execute() {
        this.commands.forEach(cmd => cmd.execute());
    }

    undo() {
        // Undo in reverse order
        for (let i = this.commands.length - 1; i >= 0; i--) {
            this.commands[i].undo();
        }
    }

    getDescription() {
        return this.description;
    }
}

/**
 * Command Stack Manager
 * Manages undo/redo history
 */
export class CommandStack {
    constructor(maxHistory = 100) {
        this.maxHistory = maxHistory;
        this.undoStack = [];
        this.redoStack = [];
        this.listeners = new Set();
    }

    /**
     * Execute a command and add to history
     */
    execute(command) {
        command.execute();

        // Add to undo stack
        this.undoStack.push(command);

        // Clear redo stack (new action invalidates redo history)
        this.redoStack = [];

        // Limit history size
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }

        this._notifyListeners();
    }

    /**
     * Undo last command
     */
    undo() {
        if (!this.canUndo()) {
            console.warn('❌ Nothing to undo');
            return false;
        }

        const command = this.undoStack.pop();
        command.undo();
        this.redoStack.push(command);

        this._notifyListeners();
        console.log(`↩️ Undo: ${command.getDescription()}`);
        return true;
    }

    /**
     * Redo last undone command
     */
    redo() {
        if (!this.canRedo()) {
            console.warn('❌ Nothing to redo');
            return false;
        }

        const command = this.redoStack.pop();
        command.execute();
        this.undoStack.push(command);

        this._notifyListeners();
        console.log(`↪️ Redo: ${command.getDescription()}`);
        return true;
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * Clear all history
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this._notifyListeners();
        console.log('🧹 Command history cleared');
    }

    /**
     * Get history info
     */
    getHistoryInfo() {
        return {
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            lastCommand: this.undoStack[this.undoStack.length - 1]?.getDescription() || null,
            nextRedoCommand: this.redoStack[this.redoStack.length - 1]?.getDescription() || null
        };
    }

    /**
     * Subscribe to history changes
     */
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notify listeners of changes
     */
    _notifyListeners() {
        const info = this.getHistoryInfo();
        this.listeners.forEach(listener => {
            try {
                listener(info);
            } catch (error) {
                console.error('Command stack listener error:', error);
            }
        });
    }
}

// Singleton instance for piano roll
let commandStackInstance = null;

export function getCommandStack() {
    if (!commandStackInstance) {
        commandStackInstance = new CommandStack(100);
    }
    return commandStackInstance;
}

export function resetCommandStack() {
    if (commandStackInstance) {
        commandStackInstance.clear();
    }
    commandStackInstance = null;
}

export default CommandStack;
