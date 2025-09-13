import { useState, useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { usePianoRollStore } from '../../store/usePianoRollStore';
import { getNoteAt, deleteNotes, createNoteObject } from './pianoRollInteractions';

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export const usePianoRollInteraction = ({
  notes, handleNotesChange, instrumentId, audioEngineRef,
  noteToY, stepToX, keyHeight, stepWidth, xToStep, yToNote, pitchToIndex, indexToPitch, totalKeys,
  gridContainerRef, keyboardWidth
}) => {
  const [interaction, setInteraction] = useState(null);
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const { activeTool, lastUsedDuration, setLastUsedDuration, gridSnapValue } = usePianoRollStore();
  const lastAuditionedPitchRef = useRef(null);

  const snapSteps = Tone.Time(gridSnapValue).toSeconds() / Tone.Time('16n').toSeconds();
  const commonInteractionProps = { noteToY, stepToX, keyHeight, stepWidth, xToStep, yToNote, handleNotesChange, lastUsedDuration };

  const getGridCoordinates = useCallback((e) => {
    const grid = gridContainerRef.current;
    if (!grid) return { x: 0, y: 0, rect: null };
    const rect = grid.getBoundingClientRect();
    const x = e.clientX - rect.left + grid.scrollLeft - keyboardWidth;
    const y = e.clientY - rect.top + grid.scrollTop;
    return { x, y, rect };
  }, [gridContainerRef, keyboardWidth]);

  useEffect(() => {
    const grid = gridContainerRef.current;
    if (!grid) return;
    const handleKeyDown = (e) => { if ((e.altKey || e.metaKey) && !interaction) grid.style.cursor = 'grab'; };
    const handleKeyUp = (e) => { if ((e.altKey || e.metaKey) && !interaction) grid.style.cursor = 'cell'; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (grid) grid.style.cursor = 'cell';
    };
  }, [gridContainerRef, interaction]);

  const handleResizeStart = useCallback((noteToResize, startEvent) => {
    startEvent.preventDefault();
    startEvent.stopPropagation();
    setInteraction({
        type: 'resizing',
        note: noteToResize,
        startX: startEvent.clientX,
        startDurationSteps: Tone.Time(noteToResize.duration).toSeconds() / Tone.Time('16n').toSeconds(),
    });
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.altKey || e.metaKey) {
        e.preventDefault();
        const grid = gridContainerRef.current;
        if (!grid) return;
        grid.style.cursor = 'grabbing';
        setInteraction({ type: 'panning', startX: e.clientX, startY: e.clientY, startScrollLeft: grid.scrollLeft, startScrollTop: grid.scrollTop });
        return;
    }
      
    e.preventDefault();
    const { x, y } = getGridCoordinates(e);

    // GÜNCELLEME: Sağ tıkla silme (tüm araçlar için geçerli)
    if (e.button === 2) {
      const noteToDelete = getNoteAt(x, y, { ...commonInteractionProps, notes });
      setInteraction({ type: 'erasing', deletedNoteIds: new Set(noteToDelete ? [noteToDelete.id] : []) });
      if (noteToDelete) {
        deleteNotes([noteToDelete], { ...commonInteractionProps, notes });
      }
      return;
    }
    
    const clickedNote = getNoteAt(x, y, { ...commonInteractionProps, notes });
    let interactionType = null;
    let newSelection = new Set(selectedNotes);
    let noteForInteraction = clickedNote;

    switch (activeTool) {
      case 'pencil':
        if (clickedNote) {
            interactionType = 'dragging';
            newSelection = new Set([clickedNote.id]);
        } else {
            // HATA DÜZELTME: Notayı hemen ekleme, sadece önizleme başlat
            const newNote = createNoteObject(x, y, commonInteractionProps);
            if (newNote) {
                interactionType = 'resizing'; 
                noteForInteraction = newNote;
                newSelection = new Set([newNote.id]);
            }
        }
        break;
      case 'eraser':
        // GÜNCELLEME: Silgi aracıyla sol tıkla silme
        const noteToDelete = getNoteAt(x, y, { ...commonInteractionProps, notes });
        setInteraction({ type: 'erasing', deletedNoteIds: new Set(noteToDelete ? [noteToDelete.id] : []) });
        if (noteToDelete) {
          deleteNotes([noteToDelete], { ...commonInteractionProps, notes });
        }
        break;
      case 'selection':
        if (clickedNote) {
            const noteId = clickedNote.id;
            if (e.shiftKey) {
                newSelection.has(noteId) ? newSelection.delete(noteId) : newSelection.add(noteId);
            } else if (!newSelection.has(noteId)) {
                newSelection = new Set([noteId]);
            }
            interactionType = 'dragging';
        } else {
            newSelection = new Set();
            interactionType = 'marquee';
        }
        break;
      default: break;
    }
    
    setSelectedNotes(newSelection);

    if (interactionType) {
        const notesToDrag = interactionType === 'dragging' 
            ? notes.filter(n => newSelection.has(n.id)).map(n => ({...n, originalTime: n.time, originalPitchIndex: pitchToIndex(n.pitch)}))
            : [];
        const startDurationSteps = noteForInteraction ? Tone.Time(noteForInteraction.duration).toSeconds() / Tone.Time('16n').toSeconds() : 0;
        setInteraction({ type: interactionType, startX: e.clientX, startY: e.clientY, gridStartX: x, gridStartY: y, endX: x, endY: y, note: noteForInteraction, notesToDrag, startDurationSteps });
    }
  }, [activeTool, commonInteractionProps, selectedNotes, notes, pitchToIndex, gridContainerRef, getGridCoordinates]);

  const handleMouseMove = useCallback((e) => {
    if (!interaction) return;

    if (interaction.type === 'panning') {
        const grid = gridContainerRef.current;
        if (!grid) return;
        const dx = e.clientX - interaction.startX;
        const dy = e.clientY - interaction.startY;
        grid.scrollLeft = interaction.startScrollLeft - dx;
        grid.scrollTop = interaction.startScrollTop - dy;
        return;
    }
    
    // GÜNCELLEME: Sürükleyerek silme mantığı
    if (interaction.type === 'erasing') {
      const { x, y } = getGridCoordinates(e);
      // Notları güncel state'ten alarak işlem yap
      let currentNotes = [];
      useInstrumentsStore.getState().instruments.forEach(inst => { if (inst.id === instrumentId) currentNotes = inst.notes; });
      
      const noteToDelete = getNoteAt(x, y, { ...commonInteractionProps, notes: currentNotes });
      
      if (noteToDelete && !interaction.deletedNoteIds.has(noteToDelete.id)) {
        setInteraction(prev => ({ ...prev, deletedNoteIds: new Set(prev.deletedNoteIds).add(noteToDelete.id) }));
        deleteNotes([noteToDelete], { ...commonInteractionProps, notes: currentNotes });
      }
      return;
    }

    let updatedInteraction = { ...interaction };
    switch (interaction.type) {
        case 'dragging': {
            const dx = e.clientX - interaction.startX;
            const dy = e.clientY - interaction.startY;
            const dxSteps = Math.round((dx / stepWidth) / snapSteps) * snapSteps;
            const dySteps = Math.round(dy / keyHeight);
            updatedInteraction.previewNotes = interaction.notesToDrag.map(note => {
                const newTime = Math.max(0, note.originalTime + dxSteps);
                const newPitchIndex = clamp(note.originalPitchIndex - dySteps, 0, totalKeys - 1);
                const newPitch = indexToPitch(newPitchIndex);
                if (newPitch !== lastAuditionedPitchRef.current) {
                    audioEngineRef.current?.auditionNoteOff(instrumentId, lastAuditionedPitchRef.current);
                    audioEngineRef.current?.auditionNoteOn(instrumentId, newPitch);
                    lastAuditionedPitchRef.current = newPitch;
                }
                return { ...note, time: newTime, pitch: newPitch };
            });
            break;
        }
        case 'resizing': {
            const dx = e.clientX - interaction.startX;
            const dSteps = dx / stepWidth;
            const newDurationSteps = Math.max(snapSteps, interaction.startDurationSteps + dSteps);
            const newDuration = Tone.Time(newDurationSteps * Tone.Time('16n').toSeconds()).toNotation();
            updatedInteraction.previewNote = { ...interaction.note, duration: newDuration };
            break;
        }
        case 'marquee': {
            const { x: currentX, y: currentY } = getGridCoordinates(e);
            const x1 = Math.min(interaction.gridStartX, currentX);
            const y1 = Math.min(interaction.gridStartY, currentY);
            const x2 = Math.max(interaction.gridStartX, currentX);
            const y2 = Math.max(interaction.gridStartY, currentY);
            const selectedIds = new Set();
            notes.forEach(note => {
                const noteY = noteToY(note.pitch);
                const noteStartX = stepToX(note.time);
                const noteEndX = noteStartX + (Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds() * stepWidth);
                if (noteEndX > x1 && noteStartX < x2 && noteY + keyHeight > y1 && noteY < y2) {
                    selectedIds.add(note.id);
                }
            });
            setSelectedNotes(selectedIds);
            updatedInteraction.endX = currentX;
            updatedInteraction.endY = currentY;
            break;
        }
    }
    setInteraction(updatedInteraction);
  }, [interaction, notes, instrumentId, stepWidth, keyHeight, snapSteps, indexToPitch, noteToY, stepToX, audioEngineRef, gridContainerRef, getGridCoordinates, commonInteractionProps]);

  const handleMouseUp = useCallback((e) => {
    if (!interaction) return;

    if (interaction.type === 'panning' || interaction.type === 'erasing') {
        const grid = gridContainerRef.current;
        if(grid) grid.style.cursor = (e.altKey || e.metaKey) ? 'grab' : 'cell';
        setInteraction(null);
        return;
    }

    audioEngineRef.current?.auditionNoteOff(instrumentId, lastAuditionedPitchRef.current);
    lastAuditionedPitchRef.current = null;

    let finalNotes = [...notes]; // Başlangıçta mevcut notaların bir kopyasını al
    let newSelectionIds = new Set(selectedNotes);

    switch (interaction.type) {
        case 'dragging': {
            const dx = e.clientX - interaction.startX;
            const dy = e.clientY - interaction.startY;
            const dxSteps = Math.round((dx / stepWidth) / snapSteps) * snapSteps;
            const dySteps = Math.round(dy / keyHeight);
            if (dxSteps !== 0 || dySteps !== 0) {
                const movedNoteOriginalIds = new Set(interaction.notesToDrag.map(n => n.id));
                const otherNotes = notes.filter(n => !movedNoteOriginalIds.has(n.id));
                const newMovedNotes = interaction.notesToDrag.map(note => {
                    const newTime = Math.max(0, note.originalTime + dxSteps);
                    const newPitchIndex = clamp(note.originalPitchIndex - dySteps, 0, totalKeys - 1);
                    const { originalTime, originalPitchIndex, ...restOfNote } = note;
                    return { ...restOfNote, time: newTime, pitch: indexToPitch(newPitchIndex) };
                });
                finalNotes = [...otherNotes, ...newMovedNotes];
                newSelectionIds = new Set(newMovedNotes.map(n => n.id));
            }
            break;
        }
        case 'resizing': {
            const dx = e.clientX - interaction.startX;
            const dSteps = dx / stepWidth;
            const finalDurationSteps = Math.max(snapSteps, Math.round((interaction.startDurationSteps + dSteps) / snapSteps) * snapSteps);
            const newDuration = Tone.Time(finalDurationSteps * Tone.Time('16n').toSeconds()).toNotation();
            setLastUsedDuration(newDuration);
            const finalNote = { ...interaction.note, duration: newDuration };
            
            // HATA DÜZELTME: Notanın var olup olmadığını kontrol et ve ona göre ekle/güncelle
            const noteExists = notes.some(n => n.id === finalNote.id);
            if (noteExists) {
                finalNotes = notes.map(n => (n.id === finalNote.id) ? finalNote : n);
            } else {
                finalNotes.push(finalNote);
            }
            newSelectionIds = new Set([finalNote.id]);
            break;
        }
    }
    
    // Yalnızca gerçekten bir değişiklik varsa state'i güncelle
    if (JSON.stringify(finalNotes) !== JSON.stringify(notes)) { 
        handleNotesChange(finalNotes); 
    }
    setSelectedNotes(newSelectionIds);
    setInteraction(null);

  }, [interaction, notes, handleNotesChange, setLastUsedDuration, stepWidth, keyHeight, snapSteps, indexToPitch, totalKeys, selectedNotes, instrumentId, audioEngineRef, gridContainerRef]);

  const handleVelocityChange = useCallback((noteToUpdate, startEvent) => {
    const startY = startEvent.clientY;
    const startVelocity = noteToUpdate.velocity;
    const onMove = (moveEvent) => {
        const deltaY = startY - moveEvent.clientY;
        const newVelocity = clamp(startVelocity + (deltaY / keyHeight) * 0.5, 0.01, 1.0);
        // Anlık güncelleme için fonksiyonel update kullan
        handleNotesChange(currentNotes => currentNotes.map(n => n.id === noteToUpdate.id ? { ...n, velocity: newVelocity } : n));
    };
    const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [handleNotesChange, keyHeight]);

  useEffect(() => {
    const mouseUpHandler = (e) => handleMouseUp(e);
    window.addEventListener('mouseup', mouseUpHandler);
    return () => window.removeEventListener('mouseup', mouseUpHandler);
  }, [handleMouseUp]);

  return {
    interactionProps: { onMouseDown: handleMouseDown, onMouseMove: handleMouseMove },
    selectedNotes,
    interaction,
    handleVelocityChange,
    handleResizeStart,
  };
};