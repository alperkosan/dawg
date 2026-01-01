import { Command } from './Command';
import { useArrangementStore } from '@/store/useArrangementStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import EventBus from '../core/EventBus.js';
import { calculatePatternLoopLength } from '../utils/patternUtils.js';

export class FillPatternCommand extends Command {
    constructor(instrumentId, intervalSteps, clearExisting = false) {
        super();
        this.instrumentId = instrumentId;
        this.intervalSteps = intervalSteps;
        this.clearExisting = clearExisting;
        this.previousNotes = []; // For undo
        this.addedNotes = []; // For redo/undo
    }

    execute() {
        const activePatternId = useArrangementStore.getState().activePatternId;
        if (!activePatternId) return;
        this.patternId = activePatternId;

        const activePattern = useArrangementStore.getState().patterns[activePatternId];
        if (!activePattern) return;

        // Get current notes
        const currentNotes = activePattern.data[this.instrumentId] || [];
        this.previousNotes = [...currentNotes]; // Save for undo

        // Determine pattern length
        const patternLengthInSteps =
            (typeof activePattern.length === 'number' && activePattern.length > 0)
                ? activePattern.length
                : (calculatePatternLoopLength(activePattern) || 64);

        // Determine default pitch and velocity from existing notes or defaults
        let defaultPitch = 'C4';
        let defaultVelocity = 100;

        if (currentNotes.length > 0) {
            const firstNote = currentNotes[0];
            defaultPitch = firstNote.pitch || 'C4';

            if (firstNote.velocity !== undefined) {
                defaultVelocity = firstNote.velocity <= 1.0
                    ? Math.round(firstNote.velocity * 127)
                    : Math.round(firstNote.velocity);
            }
        }

        // Prepare new notes list
        let newNotes = this.clearExisting ? [] : [...currentNotes];

        // Generate notes
        const notesToAdd = [];
        for (let step = 0; step < patternLengthInSteps; step += this.intervalSteps) {
            // Check collision
            if (!this.clearExisting && currentNotes.some(n => n.time === step)) {
                continue;
            }

            const note = {
                id: `note_${step}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                time: step,
                pitch: defaultPitch,
                velocity: defaultVelocity,
                duration: null,
                length: this.intervalSteps, // Extend to next note (fill behavior)
                visualLength: 1
            };

            notesToAdd.push(note);
        }

        // Add to list
        newNotes = [...newNotes, ...notesToAdd];
        this.addedNotes = notesToAdd;

        // Update store ONCE
        useArrangementStore.getState().updatePatternNotes(activePatternId, this.instrumentId, newNotes);
        usePlaybackStore.getState().updateLoopLength();

        // Emit ONE batched notification if possible, or emit individual events if PlaybackService expects them
        // Ideally PlaybackService should have a bulk method.
        // For now, let's emit individual events but since state is already updated, it's safer.
        // However, to avoid flooding, we might want to check if PlaybackService is listening for a bulk event.
        // Looking at PlaybackService, it listens to NOTE_ADDED.
        // Let's emit NOTE_ADDED for each new note. Since we are inside one synchronous execution block, 
        // it will still be faster than multiple Commands which might trigger React renders in between.

        // Emit bulk notification for efficient scheduling
        console.log(`📝 FillPatternCommand - Emitting NOTES_ADDED event with ${notesToAdd.length} notes`);

        EventBus.emit('NOTES_ADDED', {
            patternId: activePatternId,
            instrumentId: this.instrumentId,
            notes: notesToAdd
        });
    }

    undo() {
        if (!this.patternId) return;

        // Restore previous notes
        useArrangementStore.getState().updatePatternNotes(this.patternId, this.instrumentId, this.previousNotes);
        usePlaybackStore.getState().updateLoopLength();

        // Emit removal events for added notes
        this.addedNotes.forEach(note => {
            EventBus.emit('NOTE_REMOVED', {
                patternId: this.patternId,
                instrumentId: this.instrumentId,
                noteId: note.id
            });
        });
    }

    getDescription() {
        return `Fill pattern every ${this.intervalSteps} steps for instrument ${this.instrumentId}`;
    }
}
