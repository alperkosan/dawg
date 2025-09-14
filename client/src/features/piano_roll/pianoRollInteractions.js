import * as Tone from 'tone';
import { pianoRollUtils } from '../../lib/utils/pianoRollUtils';

/**
 * Verilen koordinatlardaki notayı bulur.
 */
export const getNoteAt = (x, y, props) => {
    const { getNotes, noteToY, stepToX, keyHeight, stepWidth } = props;
    const notes = getNotes();
    for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i];
        const noteY = noteToY(n.pitch);
        const noteStartX = stepToX(n.time);
        const durationInSteps = Tone.Time(n.duration).toSeconds() / Tone.Time('16n').toSeconds();
        const noteEndX = noteStartX + (durationInSteps * stepWidth);
        if (x >= noteStartX && x < noteEndX && y >= noteY && y < noteY + keyHeight) {
            return n;
        }
    }
    return null;
};

/**
 * Belirtilen ID'lere sahip notaları siler.
 */
export const deleteNotes = (noteIdsToDelete, props) => {
    if (!noteIdsToDelete || noteIdsToDelete.length === 0) return;
    const { handleNotesChange } = props;
    const idsToDeleteSet = new Set(noteIdsToDelete);
    handleNotesChange(prevNotes => prevNotes.filter(n => !idsToDeleteSet.has(n.id)));
};

/**
 * Yeni bir nota oluşturur ve state'e ekler.
 */
export const createNote = (noteData, props) => {
    const { handleNotesChange } = props;
    const newNote = {
        ...noteData,
        id: pianoRollUtils.generateNoteId(), // Benzersiz ID oluştur
        velocity: 1.0,
    };
    handleNotesChange(prevNotes => [...prevNotes, newNote]);
    return newNote;
};