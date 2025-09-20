// src/features/piano_roll_v2/hooks/useNoteInteractionsV2.js
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useArrangementStore } from '../../../store/useArrangementStore';
import { usePianoRollStoreV2 } from '../store/usePianoRollStoreV2';
import { AudioContextService } from '../../../lib/services/AudioContextService';
import { useSmartSnap } from './useSmartSnap';
import { createPianoRollKeydownHandler } from '../utils/keyboardShortcuts';
import * as Tone from 'tone';

const generateNoteId = () => `note_${Date.now()}_${Math.random().toString(36).substring(7)}`;

export const useNoteInteractionsV2 = (instrumentId, engine) => {
  const [interaction, setInteraction] = useState(null);
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  
  const { patterns, updatePatternNotes } = useArrangementStore();
  const { activePatternId } = useArrangementStore.getState();
  const { activeTool, lastUsedDuration, setLastUsedDuration } = usePianoRollStoreV2();

  const notes = patterns[activePatternId]?.data[instrumentId] || [];
  const { snapTime, effectiveSnapValue } = useSmartSnap(engine);
  
  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // === HATA DÜZELTMESİ: useRef hook'u en üst seviyeye taşındı ===
  const playingNotesRef = useRef(new Set());
  
  const handleNotesChange = useCallback((newNotes) => {
    if (instrumentId && activePatternId) {
      notesRef.current = newNotes;
      updatePatternNotes(activePatternId, instrumentId, newNotes);
    }
  }, [instrumentId, activePatternId, updatePatternNotes]);

  const audio = useMemo(() => {
    // Artık burada hook çağrılmıyor, sadece dışarıdaki ref'e erişiliyor.
    const stopPreview = (pitch) => {
      if (!instrumentId) return;
      AudioContextService.auditionNoteOff(instrumentId, pitch);
      playingNotesRef.current.delete(pitch);
    };
    const preview = (pitch, velocity = 0.8) => {
      if (!instrumentId) return;
      AudioContextService.auditionNoteOn(instrumentId, pitch, velocity);
      playingNotesRef.current.add(pitch);
    };
    const stopAllPreviews = () => {
      playingNotesRef.current.forEach(pitch => stopPreview(pitch));
    };
    return { preview, stopPreview, stopAllPreviews };
  }, [instrumentId]); // playingNotesRef'in bağımlılık olmasına gerek yok, çünkü ref'in kendisi sabittir.

  // === YENİ: Velocity Değiştirme Fonksiyonu ===
  const handleVelocityChange = useCallback((noteId, newVelocity) => {
    const newNotes = notes.map(note => 
      note.id === noteId ? { ...note, velocity: newVelocity } : note
    );
    handleNotesChange(newNotes);
  }, [notes, handleNotesChange]);

  // === YENİ: Velocity Alanından Gelen Nota Seçimini Yönetme ===
  const handleNoteSelectFromLane = useCallback((noteId, isShiftKey) => {
    setSelectedNotes(currentSelection => {
        const newSelection = new Set(currentSelection);
        if (isShiftKey) {
            newSelection.has(noteId) ? newSelection.delete(noteId) : newSelection.add(noteId);
        } else {
            return new Set([noteId]);
        }
        return newSelection;
    });
  }, []);

  useEffect(() => {
    const handlerDependencies = {
      notes,
      selectedNotes,
      setSelectedNotes,
      handleNotesChange,
      engine,
    };

    const handleKeyDown = createPianoRollKeydownHandler(handlerDependencies);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [notes, selectedNotes, engine, handleNotesChange, setSelectedNotes]);

  // Diğer tüm fonksiyonlar (onMouseDown, onMouseMove, onMouseUp, onResizeStart) aynı kalır.
  const findNoteAtPosition = useCallback((x, y, noteSource) => {
      return noteSource.find(note => {
          const rect = engine.getNoteRect(note);
          return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
      });
  }, [engine]);

  const onMouseDown = useCallback((e) => {
    const gridPos = engine.mouseToGrid(e);
    if (!gridPos) return;
    const clickedNote = findNoteAtPosition(gridPos.x, gridPos.y, notes);

    if (e.button === 2) {
      e.preventDefault();
      let initialDeleted = new Set();
      if (clickedNote) {
        handleNotesChange(notes.filter(n => n.id !== clickedNote.id));
        initialDeleted.add(clickedNote.id);
      }
      setInteraction({ type: 'erase', deleted: initialDeleted });
      return;
    }

    switch (activeTool) {
      case 'pencil':
        if (clickedNote) {
          audio.preview(clickedNote.pitch, clickedNote.velocity);
          const notesToDrag = [clickedNote.id];
          setSelectedNotes(new Set(notesToDrag));
          setInteraction({ type: 'drag', startPos: gridPos, noteIds: notesToDrag, originalNotes: new Map([[clickedNote.id, { ...clickedNote }]]) });
        } else {
          const snappedTime = snapTime(gridPos.time);
          const newNote = { id: generateNoteId(), time: snappedTime, pitch: gridPos.pitch, duration: lastUsedDuration, velocity: 0.8 };
          handleNotesChange([...notes, newNote]);
          setSelectedNotes(new Set([newNote.id]));
          audio.preview(newNote.pitch, newNote.velocity);
          setInteraction({ type: 'create', noteId: newNote.id, startGridPos: { ...gridPos, time: snappedTime } });
        }
        break;
      case 'selection':
        if (clickedNote) {
          audio.preview(clickedNote.pitch, clickedNote.velocity);
          const isSelected = selectedNotes.has(clickedNote.id);
          if (e.shiftKey) {
            const newSelection = new Set(selectedNotes);
            isSelected ? newSelection.delete(clickedNote.id) : newSelection.add(clickedNote.id);
            setSelectedNotes(newSelection);
          } else if (!isSelected) {
            setSelectedNotes(new Set([clickedNote.id]));
          }
          const notesToDrag = selectedNotes.has(clickedNote.id) ? Array.from(selectedNotes) : [clickedNote.id];
          setInteraction({ type: 'drag', startPos: gridPos, noteIds: notesToDrag, originalNotes: new Map(notes.filter(n => notesToDrag.includes(n.id)).map(n => [n.id, { ...n }])) });
        } else {
          if (!e.shiftKey) setSelectedNotes(new Set());
          setInteraction({ type: 'marquee', startPos: gridPos, currentPos: gridPos });
        }
        break;
      case 'eraser':
        let initialDeleted = new Set();
        if (clickedNote) {
          handleNotesChange(notes.filter(n => n.id !== clickedNote.id));
          initialDeleted.add(clickedNote.id);
        }
        setInteraction({ type: 'erase', deleted: initialDeleted });
        break;
    }
  }, [engine, notes, activeTool, selectedNotes, handleNotesChange, lastUsedDuration, audio, snapTime, findNoteAtPosition]);

  const onMouseMove = useCallback((e) => {
    if (!interaction) return;
    const gridPos = engine.mouseToGrid(e);
    if (!gridPos) return;
    switch (interaction.type) {
      case 'erase':
        const noteToDelete = findNoteAtPosition(gridPos.x, gridPos.y, notesRef.current);
        if (noteToDelete && !interaction.deleted.has(noteToDelete.id)) {
          const newNotes = notesRef.current.filter(n => n.id !== noteToDelete.id);
          handleNotesChange(newNotes);
          interaction.deleted.add(noteToDelete.id);
        }
        break;
      case 'create':
        const timeDiff = gridPos.time - interaction.startGridPos.time;
        const snappedTimeDiff = snapTime(timeDiff);
        const durationInSeconds = Tone.Time('16n').toSeconds() * snappedTimeDiff;
        const minDurationSeconds = Tone.Time(effectiveSnapValue).toSeconds();
        const newDurationNotation = Tone.Time(Math.max(minDurationSeconds, durationInSeconds)).toNotation();
        handleNotesChange(notes.map(n => n.id === interaction.noteId ? { ...n, duration: newDurationNotation } : n));
        setLastUsedDuration(newDurationNotation);
        break;
      case 'drag':
        const deltaTime = gridPos.time - interaction.startPos.time;
        const snappedDeltaTime = snapTime(deltaTime);
        const previewNotes = interaction.noteIds.map(id => {
          const original = interaction.originalNotes.get(id);
          if (!original) return null;
          const originalNoteY = engine.pitchToY(original.pitch);
          const newNoteY = originalNoteY + (gridPos.y - interaction.startPos.y);
          const newPitch = engine.yToPitch(newNoteY);
          return { ...original, time: Math.max(0, original.time + snappedDeltaTime), pitch: newPitch };
        }).filter(Boolean);
        setInteraction(prev => ({ ...prev, previewNotes }));
        break;
      case 'marquee':
        setInteraction(prev => ({ ...prev, currentPos: gridPos }));
        break;
    }
  }, [interaction, engine, notes, handleNotesChange, setLastUsedDuration, snapTime, effectiveSnapValue, findNoteAtPosition]);

  const onMouseUp = useCallback(() => {
    audio.stopAllPreviews();
    if (interaction?.type === 'drag' && interaction.previewNotes) {
      const updatedNotesMap = new Map(notes.map(n => [n.id, n]));
      interaction.previewNotes.forEach(p => updatedNotesMap.set(p.id, p));
      handleNotesChange(Array.from(updatedNotesMap.values()));
    } else if (interaction?.type === 'marquee') {
      const rect = {
        x: Math.min(interaction.startPos.x, interaction.currentPos.x),
        y: Math.min(interaction.startPos.y, interaction.currentPos.y),
        width: Math.abs(interaction.currentPos.x - interaction.startPos.x),
        height: Math.abs(interaction.currentPos.y - interaction.startPos.y)
      };
      const notesInRect = notes.filter(n => {
        const noteRect = engine.getNoteRect(n);
        return noteRect.x < rect.x + rect.width && noteRect.x + noteRect.width > rect.x &&
               noteRect.y < rect.y + rect.height && noteRect.y + noteRect.height > rect.y;
      });
      const newSelection = new Set(selectedNotes);
      notesInRect.forEach(n => newSelection.add(n.id));
      setSelectedNotes(newSelection);
    }
    setInteraction(null);
  }, [interaction, notes, handleNotesChange, selectedNotes, engine, audio]);

  const onResizeStart = useCallback((e, noteToResize) => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX;
    const originalDurationSteps = Tone.Time(noteToResize.duration).toSeconds() / Tone.Time('16n').toSeconds();
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSteps = deltaX / engine.stepWidth;
      const newDurationSteps = originalDurationSteps + deltaSteps;
      const snappedTotalSteps = snapTime(newDurationSteps); 
      const minDurationSteps = Tone.Time(effectiveSnapValue).toSeconds() / Tone.Time('16n').toSeconds();
      const finalSteps = Math.max(minDurationSteps, snappedTotalSteps);
      const newDurationNotation = Tone.Time(finalSteps * Tone.Time('16n').toSeconds()).toNotation();
      const currentNotes = useArrangementStore.getState().patterns[useArrangementStore.getState().activePatternId].data[instrumentId];
      updatePatternNotes(useArrangementStore.getState().activePatternId, instrumentId, currentNotes.map(n => n.id === noteToResize.id ? { ...n, duration: newDurationNotation } : n));
    };

    const handleMouseUp = () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [instrumentId, engine.stepWidth, updatePatternNotes, snapTime, effectiveSnapValue, setSelectedNotes]);
  
  return { notes, selectedNotes, interaction, onMouseDown, onMouseMove, onMouseUp, onResizeStart, handleVelocityChange, handleNoteSelectFromLane };
};