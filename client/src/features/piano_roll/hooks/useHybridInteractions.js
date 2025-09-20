// src/features/piano_roll/hooks/useHybridInteractions.js

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { usePianoRollStore } from '../store/usePianoRollStore';
import { AudioContextService } from '../../../lib/services/AudioContextService';
import { PIANO_ROLL_TOOLS } from '../../../config/constants';
import { useGridSnapping } from './useGridSnapping';
import * as Tone from 'tone';

const generateNoteId = () => `note_${Date.now()}_${Math.random().toString(36).substring(7)}`;
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export const useHybridInteractions = ({
  notes, handleNotesChange, instrumentId, viewport,
  containerRef, selectedNotes, setSelectedNotes,
}) => {
  const [currentInteraction, setCurrentInteraction] = useState(null);
  const { activeTool, lastUsedDuration, setLastUsedDuration } = usePianoRollStore();
  const playingNotesRef = useRef(new Set());
  const snapping = useGridSnapping(); 

  const audioContext = useMemo(() => ({
    auditionNote: (pitch, velocity = 0.8) => {
        if (!instrumentId || !pitch) return;
        if (velocity > 0) {
            AudioContextService.auditionNoteOn(instrumentId, pitch, velocity);
            playingNotesRef.current.add(pitch);
        } else {
            AudioContextService.auditionNoteOff(instrumentId, pitch);
            playingNotesRef.current.delete(pitch);
        }
    },
    stopAllAudition: () => {
        playingNotesRef.current.forEach(pitch => audioContext.auditionNote(pitch, 0));
        playingNotesRef.current.clear();
    }
  }), [instrumentId]);

  const findNoteAtPosition = useCallback((gridX, gridY) => {
    return notes.find(note => {
        const rect = viewport.getNoteRect(note);
        return gridX >= rect.x && gridX <= rect.x + rect.width &&
               gridY >= rect.y && gridY <= rect.y + rect.height;
    });
  }, [notes, viewport]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    
    // DÜZELTME: Doğrudan viewport'un hatasız fonksiyonunu kullanıyoruz
    const rect = containerRef.current.getBoundingClientRect();
    const gridPos = {
        x: e.clientX - rect.left + containerRef.current.scrollLeft,
        y: e.clientY - rect.top + containerRef.current.scrollTop,
    };
    
    const { time, pitch } = viewport.mouseToGrid(gridPos);
    
    const clickedNote = findNoteAtPosition(gridPos.x, gridPos.y);

    switch (activeTool) {
      case PIANO_ROLL_TOOLS.PENCIL:
        if (clickedNote) {
          handleNotesChange(notes.filter(n => n.id !== clickedNote.id));
        } else {
          const snappedTime = snapping.snapTime(time);
          const newNote = { id: generateNoteId(), time: snappedTime, pitch: pitch, duration: lastUsedDuration, velocity: 0.8 };
          handleNotesChange([...notes, newNote]);
          setSelectedNotes(new Set([newNote.id]));
          audioContext.auditionNote(pitch, 0.8);
          setCurrentInteraction({ type: 'create', noteId: newNote.id, startGridPos: { ...gridPos, time, pitch } });
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
          setCurrentInteraction({ type: 'drag', startPos: { ...gridPos, time, pitch }, noteIds: notesToDrag, originalNotes: new Map(notes.filter(n => notesToDrag.includes(n.id)).map(n => [n.id, {...n}])) });
        } else {
          if (!e.shiftKey) setSelectedNotes(new Set());
          setCurrentInteraction({ type: 'marquee', startPos: { ...gridPos, time, pitch }, currentPos: { ...gridPos, time, pitch } });
        }
        break;
    }
  }, [activeTool, findNoteAtPosition, notes, handleNotesChange, lastUsedDuration, audioContext, selectedNotes, setSelectedNotes, snapping, viewport, containerRef]);

  const handleMouseMove = useCallback((e) => {
    if (!currentInteraction) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const gridPos = {
        x: e.clientX - rect.left + containerRef.current.scrollLeft,
        y: e.clientY - rect.top + containerRef.current.scrollTop,
    };
    const { time, pitch } = viewport.mouseToGrid(gridPos);


    if (currentInteraction.type === 'create') {
        const timeDiff = time - currentInteraction.startGridPos.time;
        const snappedDuration = snapping.snapTime(timeDiff);
        const newDurationSteps = Math.max(snapping.snapSteps, snappedDuration);
        const newDurationNotation = `${newDurationSteps / snapping.snapSteps}*${snapping.value}`;
        handleNotesChange(notes.map(n => n.id === currentInteraction.noteId ? { ...n, duration: newDurationNotation } : n));
        setLastUsedDuration(newDurationNotation);
    } else if (currentInteraction.type === 'drag') {
        const deltaTime = time - currentInteraction.startPos.time;
        const deltaPitch = viewport.pitchToIndex(currentInteraction.startPos.pitch) - viewport.pitchToIndex(pitch);
        const snappedDeltaTime = snapping.snapTime(deltaTime);
        const previewNotes = currentInteraction.noteIds.map(id => {
            const original = currentInteraction.originalNotes.get(id);
            const originalPitchIndex = viewport.pitchToIndex(original.pitch);
            const newPitchIndex = clamp(originalPitchIndex + deltaPitch, 0, 127);
            return { ...original, time: Math.max(0, original.time + snappedDeltaTime), pitch: viewport.indexToPitch(newPitchIndex) };
        });
        setCurrentInteraction(prev => ({ ...prev, previewNotes }));
    } else if (currentInteraction.type === 'marquee') {
        setCurrentInteraction(prev => ({ ...prev, currentPos: { ...gridPos, time, pitch } }));
    }
  }, [currentInteraction, viewport, notes, handleNotesChange, snapping, setLastUsedDuration, containerRef]);

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
        const newDurationSteps = Math.max(snapping.snapSteps, originalDurationSteps + deltaSteps);
        const snappedDuration = snapping.snapTime(newDurationSteps);
        const newDurationNotation = `${snappedDuration / snapping.snapSteps}*${snapping.value}`;
        handleNotesChange(notes.map(n => n.id === note.id ? { ...n, duration: newDurationNotation } : n));
    };

    const handleResizeUp = () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeUp);
    };
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
  }, [notes, handleNotesChange, viewport.stepWidth, snapping]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  return {
    eventHandlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
    },
    currentInteraction,
    handleResizeStart,
    audioContext,
  };
};