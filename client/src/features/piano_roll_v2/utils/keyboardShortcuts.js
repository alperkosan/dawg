// src/features/piano_roll_v2/utils/keyboardShortcuts.js
import { usePianoRollStoreV2 } from '../store/usePianoRollStoreV2'; // Araç değiştirmek için store'a erişim

/**
 * Benzersiz bir nota ID'si oluşturur.
 */
const generateNoteId = () => `note_${Date.now()}_${Math.random().toString(36).substring(7)}`;

/**
 * Piano Roll için tüm klavye kısayol mantığını yöneten merkezi modül.
 */
export const createPianoRollKeydownHandler = ({
  notes,
  selectedNotes,
  setSelectedNotes, // YENİ: Seçimi değiştirebilmek için
  handleNotesChange,
  engine,
}) => {
  return (e) => {
    if (['input', 'textarea'].includes(e.target.tagName.toLowerCase())) return;

    const { key, ctrlKey, metaKey, shiftKey } = e;
    const modKey = ctrlKey || metaKey;
    const selectedNotesArray = notes.filter(n => selectedNotes.has(n.id));

    // =============================================
    // ARAÇ DEĞİŞTİRME
    // =============================================
    if (!modKey && !shiftKey) {
        switch(key.toLowerCase()) {
            case 'b': // Brush/Pencil Tool
                e.preventDefault();
                usePianoRollStoreV2.getState().setActiveTool('pencil');
                break;
            case 'e': // Eraser Tool (Pencil modunda silme işlemi yapar)
                e.preventDefault();
                usePianoRollStoreV2.getState().setActiveTool('pencil');
                break;
            case 'p': // Pencil Tool (B ile aynı)
                e.preventDefault();
                usePianoRollStoreV2.getState().setActiveTool('pencil');
                break;
            case 'c': // Cutter/Split tool (Gelecekte eklenebilir)
                 break;
            default:
                 // Diğer harf tuşları için default'a düşer
                 break;
        }
    }


    // =============================================
    // DÜZENLEME KISAYOLLARI (MOD KEY GEREKLİ)
    // =============================================
    if (modKey) {
        switch(key.toLowerCase()) {
            // Tümünü Seç (Ctrl+A)
            case 'a':
                e.preventDefault();
                const allNoteIds = new Set(notes.map(n => n.id));
                setSelectedNotes(allNoteIds);
                break;

            // Kopyala (Ctrl+C)
            case 'c':
                e.preventDefault();
                if (selectedNotesArray.length > 0) {
                    localStorage.setItem('pianoRollClipboard', JSON.stringify(selectedNotesArray));
                }
                break;
            
            // Kes (Ctrl+X)
            case 'x':
                 e.preventDefault();
                 if (selectedNotesArray.length > 0) {
                     localStorage.setItem('pianoRollClipboard', JSON.stringify(selectedNotesArray));
                     const remainingNotes = notes.filter(n => !selectedNotes.has(n.id));
                     handleNotesChange(remainingNotes);
                     setSelectedNotes(new Set());
                 }
                 break;

            // Yapıştır (Ctrl+V)
            case 'v':
                e.preventDefault();
                const clipboardText = localStorage.getItem('pianoRollClipboard');
                if (clipboardText) {
                    const notesToPaste = JSON.parse(clipboardText);
                    const playheadTime = 0; // İleride playhead pozisyonunu alacağız
                    const firstNoteTime = Math.min(...notesToPaste.map(n => n.time));
                    const timeOffset = playheadTime - firstNoteTime;

                    const newPastedNotes = notesToPaste.map(note => ({
                        ...note,
                        id: generateNoteId(),
                        time: note.time + timeOffset,
                    }));
                    
                    handleNotesChange([...notes, ...newPastedNotes]);
                    setSelectedNotes(new Set(newPastedNotes.map(n => n.id)));
                }
                break;
            
            // Çoğalt (Ctrl+D)
            case 'd':
                e.preventDefault();
                if (selectedNotesArray.length > 0) {
                    const duplicatedNotes = selectedNotesArray.map(note => ({
                        ...note,
                        id: generateNoteId(),
                        time: note.time + (16), // 1 bar ileriye çoğalt
                    }));
                    handleNotesChange([...notes, ...duplicatedNotes]);
                    setSelectedNotes(new Set(duplicatedNotes.map(n => n.id)));
                }
                break;
        }
    }

    // =============================================
    // SEÇİM VE SİLME (MOD KEY GEREKTİRMEYEN)
    // =============================================
    switch (key) {
        // Seçimi Kaldır
        case 'Escape':
            e.preventDefault();
            setSelectedNotes(new Set());
            break;
        
        // Sil
        case 'Delete':
        case 'Backspace':
            e.preventDefault();
            if (selectedNotesArray.length > 0) {
                const remainingNotes = notes.filter(n => !selectedNotes.has(n.id));
                handleNotesChange(remainingNotes);
                setSelectedNotes(new Set());
            }
            break;
    }


    // =============================================
    // NOTA TAŞIMA (TRANSPOZİSYON)
    // =============================================
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      if (selectedNotes.size === 0) return;

      e.preventDefault();

      let semitones = 0;
      if (modKey) { 
        semitones = key === 'ArrowUp' ? 12 : -12;
      } else if (shiftKey) {
        semitones = key === 'ArrowUp' ? 1 : -1;
      } else {
        // YENİ: Sadece ok tuşları ile notaları gam içinde taşıma (gelecekte eklenebilir)
      }

      if (semitones !== 0) {
        const newNotes = notes.map(note => {
          if (selectedNotes.has(note.id)) {
            const currentIndex = engine.pitchToIndex(note.pitch);
            const newIndex = Math.max(0, Math.min(127, currentIndex + semitones));
            return { ...note, pitch: engine.indexToPitch(newIndex) };
          }
          return note;
        });
        handleNotesChange(newNotes);
      }
    }
  };
};