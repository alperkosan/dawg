/**
 * MULTI-NOTE OPERATIONS COMMAND
 *
 * Single undo/redo operation for batch note updates
 * Used for Quantize, Humanize, Velocity operations, etc.
 */

import { ICommand } from './CommandStack';

/**
 * Batch Update Notes Command
 * Updates multiple notes at once as a single undoable operation
 */
export class BatchUpdateNotesCommand extends ICommand {
    constructor(noteUpdates, updatePatternStoreFn, description = 'Batch update notes') {
        super();
        this.noteUpdates = noteUpdates; // Array of { noteId, oldState, newState }
        this.updatePatternStoreFn = updatePatternStoreFn;
        this.description = description;
    }

    execute() {
        // Apply all new states
        const updates = new Map();
        this.noteUpdates.forEach(({ noteId, newState }) => {
            updates.set(noteId, newState);
        });
        this.updatePatternStoreFn(updates);
    }

    undo() {
        // Revert to all old states
        const updates = new Map();
        this.noteUpdates.forEach(({ noteId, oldState }) => {
            updates.set(noteId, oldState);
        });
        this.updatePatternStoreFn(updates);
    }

    getDescription() {
        return this.description;
    }
}

export default BatchUpdateNotesCommand;
