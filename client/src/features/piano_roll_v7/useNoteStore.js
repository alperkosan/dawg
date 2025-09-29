import { create } from 'zustand';

// Notlar için merkezi state yönetimi
const generateNoteId = () => `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

export const useNoteStore = create((set, get) => ({
    notes: new Map(),
    selectedNoteIds: new Set(),
    history: [],
    historyIndex: -1,

    // Eylemler
    addNote: (noteData) => {
        const id = generateNoteId();
        const newNote = { ...noteData, id, isSelected: false };
        set(state => {
            const newNotes = new Map(state.notes);
            newNotes.set(id, newNote);
            return { notes: newNotes };
        });
        return newNote;
    },
    
    updateNote: (noteId, updates) => {
        set(state => {
            const newNotes = new Map(state.notes);
            const note = newNotes.get(noteId);
            if (note) {
                newNotes.set(noteId, { ...note, ...updates });
            }
            return { notes: newNotes };
        });
    },

    deleteNotes: (noteIds) => {
        set(state => {
            const newNotes = new Map(state.notes);
            const newSelected = new Set(state.selectedNoteIds);
            noteIds.forEach(id => {
                newNotes.delete(id);
                newSelected.delete(id);
            });
            return { notes: newNotes, selectedNoteIds: newSelected };
        });
    },

    selectNote: (noteId, isMultiSelect) => {
        set(state => {
            const newSelected = isMultiSelect ? new Set(state.selectedNoteIds) : new Set();
            if (newSelected.has(noteId)) {
                newSelected.delete(noteId);
            } else {
                newSelected.add(noteId);
            }
            return { selectedNoteIds: newSelected };
        });
    },
    
    selectNotesInArea: (idsToAdd, isMultiSelect) => {
        set(state => {
            const currentSelection = isMultiSelect ? new Set(state.selectedNoteIds) : new Set();
            idsToAdd.forEach(id => currentSelection.add(id));
            return { selectedNoteIds: newSelected };
        });
    },
    
    deselectAll: () => set({ selectedNoteIds: new Set() }),

    // Load multiple notes at once (for pattern loading)
    setNotes: (notesArray) => {
        set(state => {
            const newNotes = new Map();
            notesArray.forEach(note => {
                newNotes.set(note.id, note);
            });
            return { notes: newNotes };
        });
    },

    // Alias for backward compatibility with PianoRoll.jsx
    loadNotes: (notesArray) => {
        set(state => {
            const newNotes = new Map();
            notesArray.forEach(note => {
                newNotes.set(note.id, note);
            });
            return { notes: newNotes };
        });
    },
}));
