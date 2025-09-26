import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { SNAP_CONFIG } from '../config';
import { Viewport } from '../core/viewport';

// Test için başlangıç notaları oluşturalım
const createInitialNotes = () => {
  const notes = {};
  let idCounter = 0;
  // Basit bir C Major akor dizisi
  const chords = [
    { root: 60, type: [0, 4, 7] }, // C Major
    { root: 65, type: [0, 4, 7] }, // F Major
    { root: 67, type: [0, 4, 7] }, // G Major
    { root: 60, type: [0, 4, 7] }, // C Major
  ];

  for (let bar = 0; bar < 16; bar++) {
    const chord = chords[bar % 4];
    chord.type.forEach(interval => {
      const note = {
        id: `note_${idCounter++}`,
        tick: bar * 1920, // Her ölçünün başına bir akor
        duration: 1920,   // Bir ölçü uzunluğunda
        midiNote: chord.root + interval,
        velocity: 100,
        isSelected: false,
      };
      notes[note.id] = note;
    });
  }
  return notes;
};

export const usePianoRollStore = create((set, get) => {
  /**
   * Sadece görünür alandaki notaları verimli bir şekilde döndürür.
   * @returns {Array} Görünür notaların listesi
   */
  const getVisibleNotes = () => {
    const { viewport, notes } = get(); // 'get' artık burada tanımlı
    if (!viewport) return [];

    const { start: startTick, end: endTick } = viewport.getVisibleTickRange();
    // Dikey eksende biraz pay bırakarak notaların kenarlarının aniden kaybolmasını önleyelim
    const { start: startMidi, end: endMidi } = viewport.getVisibleMidiRange();
    const visibleMidiStart = startMidi - 1;
    const visibleMidiEnd = endMidi + 1;

    const visibleNotes = [];
    
    // Tüm notaları döngüye alıp görünürlük kontrolü yapıyoruz.
    // Daha büyük projelerde bu, bir spatial index (örn. Interval Tree) ile optimize edilebilir.
    for (const id in notes) {
      const note = notes[id];
      const noteEndTick = note.tick + note.duration;

      // Nota, zaman ve pitch ekseninde görünür alanda mı?
      if (noteEndTick >= startTick && note.tick <= endTick &&
          note.midiNote >= visibleMidiStart && note.midiNote <= visibleMidiEnd) {
        visibleNotes.push(note);
      }
    }
    return visibleNotes;
  };

  return {
    viewport: null,
    initViewport: (width, height) => {
      // DÜZELTME: "new" anahtar kelimesini ekliyoruz.
      const newViewport = new Viewport(width, height);
      set({ viewport: newViewport });
    },
    currentTool: 'select', // 'select', 'pencil', 'eraser'
    snapValue: SNAP_CONFIG['1/16'], // Başlangıç snap değeri

    notes: createInitialNotes(),
    selectedNoteIds: new Set(),
    hoveredNote: null, // Örn: { tick: 1920, midiNote: 60 }
    setHoveredNote: (note) => set({ hoveredNote: note }),

    getVisibleNotes,

    /**
     * YENİ ACTION: Viewport'un scroll pozisyonunu günceller.
     */
    setViewportScroll: (scrollLeft, scrollTop) => {
      set(state => {
        if (state.viewport) {
          // Viewport sınıfının kendi içindeki setScroll metodunu çağır
          state.viewport.setScroll(scrollLeft, scrollTop);
          // React'in değişikliği algılaması için yeni bir viewport nesnesi döndür
          return { viewport: Object.create(Object.getPrototypeOf(state.viewport), Object.getOwnPropertyDescriptors(state.viewport)) };
        }
        return {};
      });
    },

    // === YENİ ACTION'LAR ===
    setTool: (tool) => set({ currentTool: tool }),
    setSnapValue: (snapKey) => set({ snapValue: SNAP_CONFIG[snapKey] }),

    addNote: (noteData, reAdd = false) => {
        let noteId = reAdd ? noteData.id : `note_${uuidv4()}`;
        const newNote = reAdd ? { ...noteData } : { id: noteId, ...noteData, isSelected: false };

        set(state => ({
            notes: { ...state.notes, [noteId]: newNote }
        }));
        return noteId; // Komutun kullanabilmesi için ID'yi döndür
    },

    deleteNote: (noteId) => {
        set(state => {
            const newNotes = { ...state.notes };
            delete newNotes[noteId];
            const newSelectedIds = new Set(state.selectedNoteIds);
            newSelectedIds.delete(noteId);
            return { notes: newNotes, selectedNoteIds: newSelectedIds };
        });
    },

    /**
     * Bir notayı verilen güncellemelerle günceller.
     * Bu fonksiyon artık tüm nota güncellemeleri için merkezimiz olacak.
     * @param {string} noteId
     * @param {object} updates - { tick, duration, midiNote } gibi güncellemeler
     */
    updateNote: (noteId, updates) => {
      set(state => {
        const note = state.notes[noteId];
        if (!note) return state;

        // Minimum sürenin altına düşmesini engelle
        if (updates.duration !== undefined && updates.duration < state.snapValue) {
            return state; // Değişikliği uygulama
        }

        const newNotes = { ...state.notes };
        newNotes[noteId] = { ...note, ...updates };

        return { notes: newNotes };
      });
    },

    // YENİ ACTION: Nota yeniden boyutlandırma
    resizeNote: (noteId, tickDelta, durationDelta) => {
        const { snapValue, notes, updateNote } = get();
        const note = notes[noteId];
        if (!note) return;

        const newStart = note.tick + tickDelta;
        const newDuration = note.duration + durationDelta;

        // Notanın başlangıcını snap değerine hizala
        const snappedStart = Math.round(newStart / snapValue) * snapValue;
        
        // Bitiş pozisyonunu snap değerine hizala ve yeni süreyi hesapla
        const endTick = note.tick + note.duration;
        const newEnd = endTick + (tickDelta + durationDelta);
        const snappedEnd = Math.round(newEnd / snapValue) * snapValue;

        let finalStart = note.tick;
        let finalDuration = note.duration;

        if (tickDelta !== 0) { // Başlangıcı sürüklüyorsak
            finalStart = snappedStart;
            // Bitiş noktası sabit kalacak şekilde süreyi ayarla
            finalDuration = endTick - snappedStart;
        }
        if (durationDelta !== 0) { // Sonu sürüklüyorsak
            // Süreyi bitiş noktasına göre ayarla
            finalDuration = snappedEnd - finalStart;
        }

        // Notanın minimum bir uzunlukta kalmasını sağla
        if (finalDuration >= snapValue) {
            updateNote(noteId, { tick: finalStart, duration: finalDuration });
        }
    },

    /**
     * Bir notayı seçer. aSddToSelection true ise mevcut seçime ekler.
     */
    selectNote: (noteId, addToSelection = false) => {
      set(state => {
        const newSelectedIds = addToSelection ? new Set(state.selectedNoteIds) : new Set();
        newSelectedIds.add(noteId);

        // Notanın kendi state'ini de güncelleyelim
        const newNotes = { ...state.notes };
        if (state.notes[noteId]) {
          newNotes[noteId] = { ...state.notes[noteId], isSelected: true };
        }
        
        // Önceki seçilenleri temizle (eğer addToSelection false ise)
        if (!addToSelection) {
            state.selectedNoteIds.forEach(id => {
                if (newNotes[id]) newNotes[id].isSelected = false;
            })
        }

        return { selectedNoteIds: newSelectedIds, notes: newNotes };
      });
    },

    /**
     * Tüm nota seçimlerini temizler.
     */
    clearSelection: () => {
        set(state => {
            const newNotes = { ...state.notes };
            state.selectedNoteIds.forEach(id => {
                if (newNotes[id]) newNotes[id].isSelected = false;
            })
            return { selectedNoteIds: new Set(), notes: newNotes };
        });
    },

    /**
     * Bir notanın pozisyonunu günceller.
     */
    updateNotePosition: (noteId, tickDelta, midiDelta, snap) => {
        set(state => {
            const note = state.notes[noteId];
            if (!note) return state;

            const newTick = note.tick + tickDelta;
            const newMidi = note.midiNote + midiDelta;

            const snappedTick = Math.round(newTick / snap) * snap;

            const newNotes = { ...state.notes };
            newNotes[noteId] = { ...note, tick: snappedTick, midiNote: newMidi };

            return { notes: newNotes };
        });
    }
  }
});
