import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { usePianoRollStore } from '../store/usePianoRollStore';
import { AudioContextService } from '../../../lib/services/AudioContextService';
import { PIANO_ROLL_TOOLS } from '../../../config/constants'; // GÜNCELLENDİ

import * as Tone from 'tone';

const generateNoteId = () => `note_${Date.now()}_${Math.random().toString(36).substring(7)}`;

/**
 * Piano Roll'daki tüm kullanıcı etkileşimlerini (mouse, klavye, touch) yöneten
 * merkezi ve gelişmiş hook. Hatalar giderildi ve profesyonel DAW özellikleri eklendi.
 */
export const useHybridInteractions = ({
  notes,
  handleNotesChange,
  instrumentId,
  viewport,
  containerRef,
  selectedNotes,
  setSelectedNotes,
}) => {
  const [currentInteraction, setCurrentInteraction] = useState(null);
  const { activeTool, gridSnapValue, lastUsedDuration, setLastUsedDuration } = usePianoRollStore();
  const playingNotesRef = useRef(new Set());

  const audioContext = useMemo(() => {
    const auditionNote = (pitch, velocity = 0.8) => {
      if (!instrumentId || typeof pitch !== 'string' || !pitch) return;
      if (velocity > 0) {
        AudioContextService.auditionNoteOn(instrumentId, pitch, velocity);
        playingNotesRef.current.add(pitch);
      } else {
        AudioContextService.auditionNoteOff(instrumentId, pitch);
        playingNotesRef.current.delete(pitch);
      }
    };
    const stopAllAudition = () => {
      playingNotesRef.current.forEach(pitch => auditionNote(pitch, 0));
      playingNotesRef.current.clear();
    };
    return { auditionNote, stopAllAudition };
  }, [instrumentId]);

  const getGridPosition = useCallback((clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left + container.scrollLeft - viewport.keyboardWidth;
    const y = clientY - rect.top + container.scrollTop - viewport.rulerHeight;
    const time = viewport.xToStep(x);
    const pitch = viewport.yToNote(y);
    return { x, y, time, pitch };
  }, [containerRef, viewport]);

  const findNoteAtPosition = useCallback((x, y) => {
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      const noteRect = viewport.getNoteRect(note);
      if (x >= noteRect.x && x <= noteRect.x + noteRect.width &&
          y >= noteRect.y && y <= noteRect.y + noteRect.height) {
        return note;
      }
    }
    return null;
  }, [notes, viewport]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const gridPos = getGridPosition(e.clientX, e.clientY);
    if (!gridPos) return;
    const clickedNote = findNoteAtPosition(gridPos.x, gridPos.y);

    switch (activeTool) {
      case PIANO_ROLL_TOOLS.PENCIL:
        if (clickedNote) {
            handleNotesChange(notes.filter(n => n.id !== clickedNote.id));
        } else {
            const snappedTime = Math.round(gridPos.time);
            const newNote = { id: generateNoteId(), time: snappedTime, pitch: gridPos.pitch, duration: lastUsedDuration, velocity: 0.8 };
            handleNotesChange([...notes, newNote]);
            setSelectedNotes(new Set([newNote.id]));
            audioContext.auditionNote(gridPos.pitch, 0.8);
            setCurrentInteraction({ type: 'create', noteId: newNote.id, startMouseX: gridPos.x });
        }
        break;
      case PIANO_ROLL_TOOLS.SELECTION:
        if (clickedNote) {
          const isSelected = selectedNotes.has(clickedNote.id);
          if (e.shiftKey) {
            const newSelection = new Set(selectedNotes);
            isSelected ? newSelection.delete(clickedNote.id) : newSelection.add(clickedNote.id);
            setSelectedNotes(newSelection);
          } else if (!isSelected) {
            setSelectedNotes(new Set([clickedNote.id]));
          }
          const notesToDrag = selectedNotes.has(clickedNote.id) ? Array.from(selectedNotes) : [clickedNote.id];
          setCurrentInteraction({ type: 'drag', startPos: gridPos, noteIds: notesToDrag, originalNotes: new Map(notes.filter(n => notesToDrag.includes(n.id)).map(n => [n.id, {...n}])) });
        } else {
          if (!e.shiftKey) setSelectedNotes(new Set());
          setCurrentInteraction({ type: 'marquee', startPos: gridPos, currentPos: gridPos });
        }
        break;
    }
  }, [activeTool, getGridPosition, findNoteAtPosition, notes, handleNotesChange, lastUsedDuration, audioContext, selectedNotes, setSelectedNotes]);

  const handleMouseMove = useCallback((e) => {
    if (!currentInteraction) return;
    const gridPos = getGridPosition(e.clientX, e.clientY);
    if (!gridPos) return;

    if (currentInteraction.type === 'create') {
        const timeDiff = (gridPos.x - currentInteraction.startMouseX) / viewport.stepWidth;
        const newDurationSteps = Math.max(1, Math.round(timeDiff / (Tone.Time(gridSnapValue).toSeconds() / Tone.Time('16n').toSeconds())));
        const newDurationNotation = `${newDurationSteps}*${gridSnapValue}`;
        handleNotesChange(notes.map(n => n.id === currentInteraction.noteId ? { ...n, duration: newDurationNotation } : n));
        setLastUsedDuration(newDurationNotation);
    } else if (currentInteraction.type === 'drag') {
        const deltaTime = gridPos.time - currentInteraction.startPos.time;
        const deltaPitch = Math.round((gridPos.y - currentInteraction.startPos.y) / viewport.keyHeight);
        const snappedDeltaTime = Math.round(deltaTime);
        const previewNotes = currentInteraction.noteIds.map(id => {
            const original = currentInteraction.originalNotes.get(id);
            const newPitchIndex = viewport.pitchToIndex(original.pitch) - deltaPitch;
            return { ...original, time: Math.max(0, original.time + snappedDeltaTime), pitch: viewport.indexToPitch(newPitchIndex) };
        });
        setCurrentInteraction(prev => ({ ...prev, previewNotes }));
    } else if (currentInteraction.type === 'marquee') {
        setCurrentInteraction(prev => ({ ...prev, currentPos: gridPos }));
    }
  }, [currentInteraction, getGridPosition, viewport, notes, handleNotesChange, gridSnapValue, setLastUsedDuration]);

  const handleMouseUp = useCallback(() => {
    if (currentInteraction?.type === 'drag' && currentInteraction.previewNotes) {
        const updatedNotesMap = new Map(notes.map(n => [n.id, n]));
        currentInteraction.previewNotes.forEach(p => updatedNotesMap.set(p.id, p));
        handleNotesChange(Array.from(updatedNotesMap.values()));
    } else if (currentInteraction?.type === 'marquee') {
        const rect = {
            x: Math.min(currentInteraction.startPos.x, currentInteraction.currentPos.x),
            y: Math.min(currentInteraction.startPos.y, currentInteraction.currentPos.y),
            width: Math.abs(currentInteraction.currentPos.x - currentInteraction.startPos.x),
            height: Math.abs(currentInteraction.currentPos.y - currentInteraction.startPos.y)
        };
        const notesInRect = notes.filter(n => {
            const noteRect = viewport.getNoteRect(n);
            return noteRect.x < rect.x + rect.width && noteRect.x + noteRect.width > rect.x &&
                   noteRect.y < rect.y + rect.height && noteRect.y + noteRect.height > rect.y;
        });
        const newSelection = new Set(selectedNotes);
        notesInRect.forEach(n => newSelection.add(n.id));
        setSelectedNotes(newSelection);
    }
    audioContext.stopAllAudition();
    setCurrentInteraction(null);
  }, [audioContext, currentInteraction, notes, handleNotesChange, selectedNotes, setSelectedNotes, viewport]);
  
  const handleResizeStart = useCallback((note, e) => {
    e.stopPropagation();
    const startX = e.clientX;
    const originalDurationSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
    
    const handleResizeMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaSteps = deltaX / viewport.stepWidth;
        const newDurationSteps = Math.max(1, originalDurationSteps + deltaSteps);
        const newDurationNotation = `${Math.round(newDurationSteps)}*16n`;
        handleNotesChange(notes.map(n => n.id === note.id ? { ...n, duration: newDurationNotation } : n));
    };

    const handleResizeUp = () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeUp);
    };
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
  }, [notes, handleNotesChange, viewport.stepWidth]);

  useEffect(() => {
    // mouseup olayını global olarak dinlemek, pencere dışında fare bırakılsa bile işlemi sonlandırır.
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  // --- HATA DÜZELTMESİ: eventHandlers objesi artık doğru fonksiyon isimlerini referans alıyor. ---
  return {
    eventHandlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      // onMouseUp'ı doğrudan elemente bağlamak yerine global olarak dinliyoruz.
    },
    currentInteraction,
    handleResizeStart,
    audioContext,
  };
};

