/**
 * Pattern Commands - Commands for pattern operations
 * 
 * These commands wrap pattern mutations for undo/redo support.
 * 
 * @module lib/core/commands/PatternCommands
 */

import { Command } from './CommandManager.js';

/**
 * Command: Add a note to a pattern
 */
export class AddNoteCommand extends Command {
    constructor(store, patternId, instrumentId, note) {
        super('Add Note');
        this.store = store;
        this.patternId = patternId;
        this.instrumentId = instrumentId;
        this.note = note;
        this.noteId = note.id;
    }

    execute() {
        const state = this.store.getState();
        const pattern = state.patterns[this.patternId];

        if (!pattern) {
            console.warn(`Pattern ${this.patternId} not found`);
            return false;
        }

        const currentNotes = pattern.data?.[this.instrumentId] || [];
        const newNotes = [...currentNotes, this.note];

        state.updatePatternNotes(this.patternId, this.instrumentId, newNotes);
        return true;
    }

    undo() {
        const state = this.store.getState();
        const pattern = state.patterns[this.patternId];

        if (!pattern) return false;

        const currentNotes = pattern.data?.[this.instrumentId] || [];
        const newNotes = currentNotes.filter(n => n.id !== this.noteId);

        state.updatePatternNotes(this.patternId, this.instrumentId, newNotes);
        return true;
    }

    getDescription() {
        return `Add note at step ${this.note.step}`;
    }
}

/**
 * Command: Remove a note from a pattern
 */
export class RemoveNoteCommand extends Command {
    constructor(store, patternId, instrumentId, noteId) {
        super('Remove Note');
        this.store = store;
        this.patternId = patternId;
        this.instrumentId = instrumentId;
        this.noteId = noteId;
        this.removedNote = null; // Store for undo
    }

    execute() {
        const state = this.store.getState();
        const pattern = state.patterns[this.patternId];

        if (!pattern) return false;

        const currentNotes = pattern.data?.[this.instrumentId] || [];

        // Find and store the note for undo
        this.removedNote = currentNotes.find(n => n.id === this.noteId);

        if (!this.removedNote) {
            console.warn(`Note ${this.noteId} not found`);
            return false;
        }

        const newNotes = currentNotes.filter(n => n.id !== this.noteId);
        state.updatePatternNotes(this.patternId, this.instrumentId, newNotes);
        return true;
    }

    undo() {
        if (!this.removedNote) return false;

        const state = this.store.getState();
        const pattern = state.patterns[this.patternId];

        if (!pattern) return false;

        const currentNotes = pattern.data?.[this.instrumentId] || [];
        const newNotes = [...currentNotes, this.removedNote];

        state.updatePatternNotes(this.patternId, this.instrumentId, newNotes);
        return true;
    }

    getDescription() {
        return `Remove note${this.removedNote ? ` at step ${this.removedNote.step}` : ''}`;
    }
}

/**
 * Command: Move a note (change step/pitch)
 */
export class MoveNoteCommand extends Command {
    constructor(store, patternId, instrumentId, noteId, newStep, newPitch) {
        super('Move Note');
        this.store = store;
        this.patternId = patternId;
        this.instrumentId = instrumentId;
        this.noteId = noteId;
        this.newStep = newStep;
        this.newPitch = newPitch;
        this.oldStep = null;
        this.oldPitch = null;
    }

    execute() {
        const state = this.store.getState();
        const pattern = state.patterns[this.patternId];

        if (!pattern) return false;

        const currentNotes = pattern.data?.[this.instrumentId] || [];
        const noteIndex = currentNotes.findIndex(n => n.id === this.noteId);

        if (noteIndex === -1) return false;

        // Store old values for undo
        this.oldStep = currentNotes[noteIndex].step;
        this.oldPitch = currentNotes[noteIndex].pitch;

        // Update note
        const newNotes = [...currentNotes];
        newNotes[noteIndex] = {
            ...newNotes[noteIndex],
            step: this.newStep,
            pitch: this.newPitch
        };

        state.updatePatternNotes(this.patternId, this.instrumentId, newNotes);
        return true;
    }

    undo() {
        if (this.oldStep === null) return false;

        const state = this.store.getState();
        const pattern = state.patterns[this.patternId];

        if (!pattern) return false;

        const currentNotes = pattern.data?.[this.instrumentId] || [];
        const noteIndex = currentNotes.findIndex(n => n.id === this.noteId);

        if (noteIndex === -1) return false;

        const newNotes = [...currentNotes];
        newNotes[noteIndex] = {
            ...newNotes[noteIndex],
            step: this.oldStep,
            pitch: this.oldPitch
        };

        state.updatePatternNotes(this.patternId, this.instrumentId, newNotes);
        return true;
    }

    getDescription() {
        return `Move note from step ${this.oldStep} to ${this.newStep}`;
    }
}

/**
 * Command: Change note velocity
 */
export class ChangeVelocityCommand extends Command {
    constructor(store, patternId, instrumentId, noteId, newVelocity) {
        super('Change Velocity');
        this.store = store;
        this.patternId = patternId;
        this.instrumentId = instrumentId;
        this.noteId = noteId;
        this.newVelocity = newVelocity;
        this.oldVelocity = null;
    }

    execute() {
        const state = this.store.getState();
        const pattern = state.patterns[this.patternId];

        if (!pattern) return false;

        const currentNotes = pattern.data?.[this.instrumentId] || [];
        const noteIndex = currentNotes.findIndex(n => n.id === this.noteId);

        if (noteIndex === -1) return false;

        this.oldVelocity = currentNotes[noteIndex].velocity;

        const newNotes = [...currentNotes];
        newNotes[noteIndex] = {
            ...newNotes[noteIndex],
            velocity: this.newVelocity
        };

        state.updatePatternNotes(this.patternId, this.instrumentId, newNotes);
        return true;
    }

    undo() {
        if (this.oldVelocity === null) return false;

        const state = this.store.getState();
        const pattern = state.patterns[this.patternId];

        if (!pattern) return false;

        const currentNotes = pattern.data?.[this.instrumentId] || [];
        const noteIndex = currentNotes.findIndex(n => n.id === this.noteId);

        if (noteIndex === -1) return false;

        const newNotes = [...currentNotes];
        newNotes[noteIndex] = {
            ...newNotes[noteIndex],
            velocity: this.oldVelocity
        };

        state.updatePatternNotes(this.patternId, this.instrumentId, newNotes);
        return true;
    }

    getDescription() {
        return `Change velocity: ${this.oldVelocity} → ${this.newVelocity}`;
    }
}

/**
 * Command: Change note duration
 */
export class ChangeDurationCommand extends Command {
    constructor(store, patternId, instrumentId, noteId, newDuration) {
        super('Change Duration');
        this.store = store;
        this.patternId = patternId;
        this.instrumentId = instrumentId;
        this.noteId = noteId;
        this.newDuration = newDuration;
        this.oldDuration = null;
    }

    execute() {
        const state = this.store.getState();
        const pattern = state.patterns[this.patternId];

        if (!pattern) return false;

        const currentNotes = pattern.data?.[this.instrumentId] || [];
        const noteIndex = currentNotes.findIndex(n => n.id === this.noteId);

        if (noteIndex === -1) return false;

        this.oldDuration = currentNotes[noteIndex].duration;

        const newNotes = [...currentNotes];
        newNotes[noteIndex] = {
            ...newNotes[noteIndex],
            duration: this.newDuration
        };

        state.updatePatternNotes(this.patternId, this.instrumentId, newNotes);
        return true;
    }

    undo() {
        if (this.oldDuration === null) return false;

        const state = this.store.getState();
        const pattern = state.patterns[this.patternId];

        if (!pattern) return false;

        const currentNotes = pattern.data?.[this.instrumentId] || [];
        const noteIndex = currentNotes.findIndex(n => n.id === this.noteId);

        if (noteIndex === -1) return false;

        const newNotes = [...currentNotes];
        newNotes[noteIndex] = {
            ...newNotes[noteIndex],
            duration: this.oldDuration
        };

        state.updatePatternNotes(this.patternId, this.instrumentId, newNotes);
        return true;
    }

    getDescription() {
        return `Change duration: ${this.oldDuration} → ${this.newDuration}`;
    }
}

/**
 * Command: Create a new pattern
 */
export class CreatePatternCommand extends Command {
    constructor(store, patternName) {
        super('Create Pattern');
        this.store = store;
        this.patternName = patternName;
        this.createdPatternId = null;
    }

    execute() {
        const state = this.store.getState();
        this.createdPatternId = state.createPattern(this.patternName);
        return this.createdPatternId;
    }

    undo() {
        if (!this.createdPatternId) return false;

        const state = this.store.getState();
        return state.deletePattern(this.createdPatternId);
    }

    getDescription() {
        return `Create pattern: ${this.patternName || this.createdPatternId}`;
    }
}

/**
 * Command: Delete a pattern
 */
export class DeletePatternCommand extends Command {
    constructor(store, patternId) {
        super('Delete Pattern');
        this.store = store;
        this.patternId = patternId;
        this.deletedPattern = null;
        this.patternIndex = null;
    }

    execute() {
        const state = this.store.getState();

        // Store pattern for undo
        this.deletedPattern = state.patterns[this.patternId];
        this.patternIndex = state.patternOrder.indexOf(this.patternId);

        if (!this.deletedPattern) return false;

        return state.deletePattern(this.patternId);
    }

    undo() {
        if (!this.deletedPattern) return false;

        // Re-create the pattern
        this.store.setState(state => ({
            patterns: {
                ...state.patterns,
                [this.patternId]: this.deletedPattern
            },
            patternOrder: [
                ...state.patternOrder.slice(0, this.patternIndex),
                this.patternId,
                ...state.patternOrder.slice(this.patternIndex)
            ]
        }));

        return true;
    }

    getDescription() {
        return `Delete pattern: ${this.deletedPattern?.name || this.patternId}`;
    }
}
