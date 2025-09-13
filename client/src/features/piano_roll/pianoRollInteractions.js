import * as Tone from 'tone';
import { pianoRollUtils } from '../../lib/utils/pianoRollUtils';

/**
 * Verilen koordinatlardaki notayı bulur.
 * @param {number} x - Grid içindeki x koordinatı.
 * @param {number} y - Grid içindeki y koordinatı.
 * @param {object} props - Gerekli yardımcı fonksiyonları ve state'i içeren nesne.
 * @param {() => Array<object>} props.getNotes - En güncel nota listesini döndüren fonksiyon.
 * @param {(pitch: string) => number} props.noteToY - Nota perdesini Y koordinatına çeviren fonksiyon.
 * @param {(step: number) => number} props.stepToX - Zaman adımını X koordinatına çeviren fonksiyon.
 * @param {number} props.keyHeight - Bir nota sırasının piksel yüksekliği.
 * @param {number} props.stepWidth - Bir zaman adımının piksel genişliği.
 * @returns {object|null} - Bulunan nota nesnesi veya null.
 */
export const getNoteAt = (x, y, props) => {
    const { getNotes, noteToY, stepToX, keyHeight, stepWidth } = props;
    const notes = getNotes();
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
    return null;
};

/**
 * Belirtilen ID'lere sahip notaları siler.
 * @param {Array<string>} noteIdsToDelete - Silinecek notaların ID'lerini içeren dizi.
 * @param {object} props - Gerekli yardımcı fonksiyonları içeren nesne.
 * @param {(updater: (prevNotes: Array<object>) => Array<object>) => void} props.handleNotesChange - Nota listesini güncelleyen ana fonksiyon.
 */
export const deleteNotes = (noteIdsToDelete, props) => {
    if (!noteIdsToDelete || noteIdsToDelete.length === 0) return;
    const { handleNotesChange } = props;
    const idsToDeleteSet = new Set(noteIdsToDelete);
    handleNotesChange(prevNotes => prevNotes.filter(n => !idsToDeleteSet.has(n.id)));
};

/**
 * Yeni bir nota oluşturur ve state'e ekler.
 * @param {object} noteData - Oluşturulacak notanın bilgileri ({ time, pitch, duration }).
 * @param {object} props - Gerekli yardımcı fonksiyonları içeren nesne.
 * @param {(updater: (prevNotes: Array<object>) => Array<object>) => void} props.handleNotesChange - Nota listesini güncelleyen ana fonksiyon.
 * @returns {object} - Oluşturulan yeni nota.
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