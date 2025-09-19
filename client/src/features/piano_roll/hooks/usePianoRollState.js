import { useState, useCallback, useMemo } from 'react';
import { SCALES } from '../utils/constants';
import { createNote, updateNote, deleteNotes } from '../utils/noteUtils';
import { PIANO_ROLL_TOOLS } from '../../../config/constants'; // GÜNCELLENDİ

export const usePianoRollState = (pattern, onPatternChange) => {
  const [tool, setTool] = useState(PIANO_ROLL_TOOLS.PENCIL);
  const [zoom, setZoom] = useState({ x: 1, y: 1 });
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [scale, setScaleData] = useState({ root: 'C', type: 'Minor' });
  const [snapSettings, setSnapSettings] = useState({
    enabled: true,
    value: '16n',
    mode: 'magnetic' // veya 'hard'
  });
  const [velocityLaneHeight, setVelocityLaneHeight] = useState(100);
  
  const notes = pattern?.notes || [];
  
  // --- ANAHTAR DÜZELTME BURADA ---
  // Bu bölüm, 'scale' nesnesini alıp ona 'getScaleNotes' fonksiyonunu ekler.
  // Bu sayede PianoKeyboard gibi bileşenler bu fonksiyonu güvenle çağırabilir.
  const scaleInfo = useMemo(() => ({
    ...scale,
    getScaleNotes: () => {
      const rootIndex = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(scale.root);
      const intervals = SCALES[scale.type] || SCALES.Minor;
      return new Set(intervals.map(interval => (rootIndex + interval) % 12));
    }
  }), [scale]);
  
  // Nota operasyonları
  const addNote = useCallback((noteData) => {
    const newNote = createNote(noteData);
    const updatedNotes = [...notes, newNote];
    onPatternChange?.({ ...pattern, notes: updatedNotes });
    setSelectedNotes(new Set([newNote.id]));
    return newNote;
  }, [notes, pattern, onPatternChange]);
  
  const updateNotes = useCallback((noteUpdates) => {
    const updatedNotes = notes.map(note => {
      const update = noteUpdates.get(note.id);
      return update ? { ...note, ...update } : note;
    });
    onPatternChange?.({ ...pattern, notes: updatedNotes });
  }, [notes, pattern, onPatternChange]);
  
  const removeNotes = useCallback((noteIds) => {
    const idsToRemove = new Set(noteIds);
    const updatedNotes = notes.filter(note => !idsToRemove.has(note.id));
    onPatternChange?.({ ...pattern, notes: updatedNotes });
    setSelectedNotes(prev => {
      const newSelection = new Set(prev);
      noteIds.forEach(id => newSelection.delete(id));
      return newSelection;
    });
  }, [notes, pattern, onPatternChange]);
  
  const updateNoteVelocity = useCallback((noteId, velocity) => {
    const updates = new Map([[noteId, { velocity: Math.max(0.01, Math.min(1, velocity)) }]]);
    updateNotes(updates);
  }, [updateNotes]);
  
  const setScale = useCallback((root, type) => {
    setScaleData({ root, type });
  }, []);
  
  const toggleVelocityLane = useCallback(() => {
    setVelocityLaneHeight(prev => prev > 0 ? 0 : 100);
  }, []);
  
  return {
    // State
    notes,
    selectedNotes,
    tool,
    zoom,
    // DÜZELTME: Artık fonksiyon içeren 'scaleInfo' nesnesini 'scale' olarak dışa aktarıyoruz.
    scale: scaleInfo,
    snapSettings,
    velocityLaneHeight,
    availableScales: SCALES,
    
    // Actions
    setTool,
    setZoom,
    setSelectedNotes,
    setScale,
    setSnapSettings,
    setVelocityLaneHeight,
    toggleVelocityLane,
    
    // Note operations
    addNote,
    updateNotes,
    removeNotes,
    updateNoteVelocity
  };
};