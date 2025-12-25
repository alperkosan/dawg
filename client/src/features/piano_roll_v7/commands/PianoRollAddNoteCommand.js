import { Command } from '@/lib/commands/Command';
import { useArrangementStore } from '@/store/useArrangementStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import EventBus from '@/lib/core/EventBus.js';
import { calculatePatternLoopLength } from '@/lib/utils/patternUtils.js';

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

        const activePattern = useArrangementStore.getState().patterns[activePatternId];
        if (!activePattern) return;

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

        // ✅ FIX: Piano roll notes should use the actual written length, not extend to pattern end
        // Only sequencer notes (from AddNoteCommand) should be oval (1 step visual, pattern-length audio)
        // Piano roll notes should have both visualLength and length equal to the written length
        
        // ✅ FIX: Use provided length if valid, otherwise default to 1 step
        let finalLength = this.length;
        let visualLength = this.length || 1; // ✅ Piano roll: visualLength = actual length
        
        // Only extend to pattern end if length is explicitly 1 (sequencer-style trigger)
        // This distinguishes between:
        // - Sequencer notes: length=1 → extend to pattern end (oval note)
        // - Piano roll notes: length=N → use N steps (normal note)
        if (this.length === 1) {
            // ✅ SEQUENCER STYLE: 1-step trigger → extend to pattern end (oval note)
            const patternLengthInSteps = calculatePatternLoopLength(activePattern) || 64;
            const noteStartStep = this.startTime;
            const noteLengthInSteps = Math.max(1, patternLengthInSteps - noteStartStep);
            finalLength = noteLengthInSteps;
            visualLength = 1; // Visual stays 1 step for oval notes
            
            console.log(`🎼 PianoRollAddNoteCommand: 1-step trigger, extending to pattern length:`, {
                patternLengthInSteps,
                noteStartStep,
                noteLengthInSteps,
                finalLength,
                visualLength
            });
        } else if (!this.length || this.length <= 0) {
            // No length specified → default to 1 step
            finalLength = 1;
            visualLength = 1;
        } else {
            // ✅ PIANO ROLL STYLE: Use provided length (normal note, not oval)
            finalLength = this.length;
            visualLength = this.length;
            
            console.log(`🎼 PianoRollAddNoteCommand: Normal note with length:`, {
                length: this.length,
                finalLength,
                visualLength
            });
        }

        // Create note in Channel Rack format (for pattern storage)
        // Note: We store both visualLength (for display) and duration/length (for audio)
        const audioDurationString = lengthToDuration(Math.max(0.25, finalLength));
        
        this.note = {
            id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            time: Math.max(0, this.startTime),
            pitch: pitchToString(Math.max(0, Math.min(127, this.pitch))),
            velocity: Math.max(1, Math.min(127, this.velocity)),
            duration: audioDurationString, // Audio duration (for playback - legacy format)
            length: finalLength, // ✅ Audio length in steps (for PlaybackManager - new format)
            visualLength: visualLength // ✅ FL STUDIO STYLE: All new notes are oval (1 step visual)
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