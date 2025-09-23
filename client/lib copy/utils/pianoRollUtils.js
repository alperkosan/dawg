// client/src/lib/utils/pianoRollUtils.js - Native Version
// DAWG - Native Piano Roll Utilities - ToneJS'siz implementasyon

import { NativeTimeUtils } from './NativeTimeUtils.js';

// Piano Roll için genel amaçlı yardımcı fonksiyonlar.
export const pianoRollUtils = {
    // MIDI nota numarasını "C4" gibi bir dizeye çevirir.
    midiToPitch: (midiNumber) => {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNumber / 12) - 1;
        const noteIndex = midiNumber % 12;
        return `${noteNames[noteIndex]}${octave}`;
    },

    // "C4" gibi bir dizeyi MIDI nota numarasına çevirir.
    pitchToMidi: (pitch) => {
        const noteNames = { 
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 
            'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 
        };
        const noteName = pitch.replace(/[0-9]/g, '');
        const octave = parseInt(pitch.slice(-1));
        return (octave + 1) * 12 + noteNames[noteName];
    },

    // Zaman değerini mevcut grid ayarına göre hizalar (quantize).
    quantizeTime: (time, gridValue, bpm = 120) => {
        // Native implementation using NativeTimeUtils
        const gridSeconds = NativeTimeUtils.parseTime(gridValue, bpm);
        const sixteenthNote = NativeTimeUtils.parseTime('16n', bpm);
        const snap = gridSeconds / sixteenthNote;

        return Math.round(time / snap) * snap;
    },

    // Benzersiz bir nota ID'si oluşturur.
    generateNoteId: () => `note_${Date.now()}_${Math.random().toString(36).substring(7)}`,

    // Bir değeri min ve max arasında sınırlar.
    clamp: (value, min, max) => Math.max(min, Math.min(value, max)),

    // Note frequency'yi MIDI'ye çevirme
    frequencyToMidi: (frequency) => {
        return 69 + 12 * Math.log2(frequency / 440);
    },

    // MIDI'yi frequency'ye çevirme  
    midiToFrequency: (midiNote) => {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    },

    // Grid snap calculations
    getGridSnapValue: (gridSize, bpm = 120) => {
        const gridSizes = {
            '1n': 1,      // Whole note
            '2n': 0.5,    // Half note
            '4n': 0.25,   // Quarter note
            '8n': 0.125,  // Eighth note
            '16n': 0.0625, // Sixteenth note
            '32n': 0.03125 // Thirty-second note
        };

        const beatDuration = 60 / bpm; // Duration of one beat in seconds
        const noteDuration = gridSizes[gridSize] || 0.0625;

        return beatDuration * 4 * noteDuration; // 4 beats per bar
    },

    // Time position to grid position conversion
    timeToGridPosition: (timeInSeconds, bpm = 120, gridSize = '16n') => {
        const snapValue = pianoRollUtils.getGridSnapValue(gridSize, bpm);
        return Math.round(timeInSeconds / snapValue);
    },

    // Grid position to time conversion
    gridPositionToTime: (gridPosition, bpm = 120, gridSize = '16n') => {
        const snapValue = pianoRollUtils.getGridSnapValue(gridSize, bpm);
        return gridPosition * snapValue;
    },

    // Velocity scaling utilities
    scaleVelocity: (velocity, minVelocity = 0.1, maxVelocity = 1.0) => {
        return Math.max(minVelocity, Math.min(maxVelocity, velocity));
    },

    // Note duration validation
    validateNoteDuration: (duration, minDuration = 0.01, maxDuration = 4.0) => {
        return Math.max(minDuration, Math.min(maxDuration, duration));
    },

    // Piano roll view calculations
    calculateNotePosition: (note, viewPort, pixelsPerStep = 20) => {
        const x = note.time * pixelsPerStep - viewPort.scrollX;
        const y = (127 - note.pitch) * 12 - viewPort.scrollY; // MIDI range 0-127
        const width = (note.duration || 0.25) * pixelsPerStep;
        const height = 12; // Standard note height

        return { x, y, width, height };
    },

    // Selection utilities
    getNotesInSelection: (notes, selectionRect) => {
        return notes.filter(note => {
            const notePos = pianoRollUtils.calculateNotePosition(note, { scrollX: 0, scrollY: 0 });

            return notePos.x < selectionRect.x + selectionRect.width &&
                   notePos.x + notePos.width > selectionRect.x &&
                   notePos.y < selectionRect.y + selectionRect.height &&
                   notePos.y + notePos.height > selectionRect.y;
        });
    },

    // Pattern analysis
    analyzePattern: (notes) => {
        if (!notes || notes.length === 0) {
            return {
                isEmpty: true,
                noteCount: 0,
                duration: 0,
                pitchRange: { min: 0, max: 0 },
                velocityRange: { min: 0, max: 0 }
            };
        }

        const pitches = notes.map(n => n.pitch || 60);
        const velocities = notes.map(n => n.velocity || 0.8);
        const endTimes = notes.map(n => (n.time || 0) + (n.duration || 0.25));

        return {
            isEmpty: false,
            noteCount: notes.length,
            duration: Math.max(...endTimes),
            pitchRange: {
                min: Math.min(...pitches),
                max: Math.max(...pitches)
            },
            velocityRange: {
                min: Math.min(...velocities),
                max: Math.max(...velocities)
            }
        };
    }
};

// Default export for backward compatibility
export default pianoRollUtils;