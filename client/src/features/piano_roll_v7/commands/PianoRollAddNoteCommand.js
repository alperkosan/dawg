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

        // ✅ FL STUDIO STYLE: Get pattern length and extend ALL new notes to pattern length
        // ALL NEW NOTES should be oval (visualLength = 1) unless explicitly resized
        const patternLengthInSteps = calculatePatternLoopLength(activePattern) || 64;
        
        // ✅ FL STUDIO STYLE: visualLength is ALWAYS 1 for new notes (unless resized later)
        // Even if length is provided (from lastNoteDuration), visualLength stays 1
        let finalLength = this.length;
        const visualLength = 1; // ✅ ALWAYS 1 step visual for new notes
        
        // If length not specified, is default (1), or is pattern length (from lastNoteDuration), extend to pattern length
        if (!this.length || this.length <= 0 || this.length === 1 || this.length >= patternLengthInSteps * 0.8) {
            // Calculate length from note start to pattern end
            const noteStartStep = this.startTime;
            const noteLengthInSteps = Math.max(1, patternLengthInSteps - noteStartStep);
            finalLength = noteLengthInSteps;
            
            console.log(`🎼 PianoRollAddNoteCommand: New note, extending to pattern length:`, {
                patternLengthInSteps,
                noteStartStep,
                noteLengthInSteps,
                finalLength,
                visualLength
            });
        }
        // else: Use provided length for audio, but visualLength stays 1

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