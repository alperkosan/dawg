import { Command } from '../../../lib/commands/Command';
import { useArrangementStore } from '../../../store/useArrangementStore';
import { usePlaybackStore } from '../../../store/usePlaybackStore';
import EventBus from '../../../lib/core/EventBus.js';

/**
 * Piano Roll için nota ekleme komutu - daha detaylı nota özellikleri ile
 */
export class PianoRollAddNoteCommand extends Command {
    constructor(noteData) {
        super();
        this.instrumentId = noteData.instrumentId;
        this.startTime = noteData.startTime;
        this.pitch = noteData.pitch;
        this.length = noteData.length || 1;
        this.velocity = noteData.velocity || 100;
        // Execute sırasında oluşturulacak
        this.note = null;
    }

    execute() {
        const activePatternId = useArrangementStore.getState().activePatternId;
        if (!activePatternId) return;

        // Convert Piano Roll format to Channel Rack format for storage
        const pitchToString = (midiPitch) => {
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const octave = Math.floor(midiPitch / 12) - 1;
            const noteIndex = midiPitch % 12;
            return noteNames[noteIndex] + octave;
        };

        const lengthToDuration = (length) => {
            const durationMap = { 16: '1n', 8: '2n', 4: '4n', 2: '8n', 1: '16n', 0.5: '32n' };
            return durationMap[length] || '16n';
        };

        // Create note in Channel Rack format (for pattern storage)
        this.note = {
            id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            time: Math.max(0, this.startTime),
            pitch: pitchToString(Math.max(0, Math.min(127, this.pitch))),
            velocity: Math.max(1, Math.min(127, this.velocity)),
            duration: lengthToDuration(Math.max(0.25, this.length))
        };

        console.log('🎼 PianoRollAddNoteCommand executing:', this.note);

        // Get current notes and add new one
        const currentNotes = useArrangementStore.getState().patterns[activePatternId].data[this.instrumentId] || [];
        const newNotes = [...currentNotes, this.note];

        // Update pattern store with Command pattern - guaranteed fresh state
        useArrangementStore.getState().updatePatternNotes(activePatternId, this.instrumentId, newNotes);
        usePlaybackStore.getState().updateLoopLength();

        // Notify PlaybackManager via EventBus
        EventBus.emit('NOTE_ADDED', {
            patternId: activePatternId,
            instrumentId: this.instrumentId,
            note: this.note
        });

        console.log('✅ Note added via command pattern');
        return this.note;
    }

    undo() {
        const activePatternId = useArrangementStore.getState().activePatternId;
        if (!activePatternId || !this.note) return;

        const currentNotes = useArrangementStore.getState().patterns[activePatternId].data[this.instrumentId] || [];
        const newNotes = currentNotes.filter(note => note.id !== this.note.id);

        useArrangementStore.getState().updatePatternNotes(activePatternId, this.instrumentId, newNotes);
        usePlaybackStore.getState().updateLoopLength();

        // Notify PlaybackManager via EventBus
        EventBus.emit('NOTE_REMOVED', {
            patternId: activePatternId,
            instrumentId: this.instrumentId,
            noteId: this.note.id
        });
    }

    getDescription() {
        return `Add piano roll note (pitch: ${this.pitch}, time: ${this.startTime})`;
    }
}