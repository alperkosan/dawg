import * as Tone from 'tone';

/**
 * Verilen koordinatlardaki notayı bulur.
 * @param {number} x - Grid üzerindeki yatay koordinat (scroll dahil).
 * @param {number} y - Grid üzerindeki dikey koordinat (scroll dahil).
 * @param {object} props - Gerekli yardımcı fonksiyonları ve state'i içeren nesne.
 * @returns {object|undefined} - Bulunan nota veya undefined.
 */
export const getNoteAt = (x, y, props) => {
    const { notes, noteToY, stepToX, keyHeight, stepWidth } = props;

    // Notayı bulmak için tersten arama yapmak, üstteki notayı önceliklendirir.
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
    return undefined;
};

/**
 * Bir veya daha fazla notayı siler.
 * @param {Array<object>} notesToDelete - Silinecek nota nesnelerinin dizisi.
 * @param {object} props - Gerekli yardımcı fonksiyonları ve state'i içeren nesne.
 */
export const deleteNotes = (notesToDelete, props) => {
    if (!notesToDelete || notesToDelete.length === 0) return;
    const { notes, handleNotesChange } = props;
    const idsToDelete = new Set(notesToDelete.map(n => n.id));
    const newNotes = notes.filter(n => !idsToDelete.has(n.id));
    handleNotesChange(newNotes);
};

/**
 * Yeni bir nota nesnesi oluşturur. Bu fonksiyon notayı state'e eklemez,
 * sadece bir obje olarak döndürür.
 * @returns {object|null} - Oluşturulan yeni nota nesnesi.
 */
export const createNoteObject = (x, y, props) => {
    const { xToStep, yToNote, lastUsedDuration } = props;
    const time = xToStep(x);
    const pitch = yToNote(y);
    
    return {
        id: `note_${Date.now()}_${Math.random()}`, // Benzersiz ID
        time,
        pitch,
        velocity: 1.0,
        duration: lastUsedDuration
    };
};