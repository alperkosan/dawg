// src/features/piano_roll/hooks/useImprovedInteractions.js
import { useState, useCallback, useRef, useEffect } from 'react';
import { usePianoRollStore } from '../store/usePianoRollStore';
import { AudioContextService } from '../../../lib/services/AudioContextService';
import { PIANO_ROLL_TOOLS } from '../../../config/constants';
import { useGridSnapping } from './useGridSnapping';
import * as Tone from 'tone';

const generateNoteId = () => `note_${Date.now()}_${Math.random().toString(36).substring(7)}`;

export const useImprovedInteractions = ({
  notes,
  handleNotesChange,
  instrumentId,
  viewport, // Bu artık unified viewport
  selectedNotes,
  setSelectedNotes
}) => {
  const [currentInteraction, setCurrentInteraction] = useState(null);
  const { activeTool, lastUsedDuration, setLastUsedDuration } = usePianoRollStore();
  const playingNotesRef = useRef(new Set());
  const snapping = useGridSnapping();

  // Improved audio context with error handling
  const audioContext = {
    auditionNote: useCallback((pitch, velocity = 0.8) => {
      if (!instrumentId || !pitch) return;
      
      try {
        if (velocity > 0) {
          AudioContextService.auditionNoteOn(instrumentId, pitch, velocity);
          playingNotesRef.current.add(pitch);
        } else {
          AudioContextService.auditionNoteOff(instrumentId, pitch);
          playingNotesRef.current.delete(pitch);
        }
      } catch (error) {
        console.warn('Audio audition failed:', error);
      }
    }, [instrumentId]),

    stopAllAudition: useCallback(() => {
      playingNotesRef.current.forEach(pitch => {
        try {
          AudioContextService.auditionNoteOff(instrumentId, pitch);
        } catch (error) {
          console.warn('Failed to stop audition for pitch:', pitch);
        }
      });
      playingNotesRef.current.clear();
    }, [instrumentId])
  };

  // Improved note finding with bounds checking
  const findNoteAtPosition = useCallback((gridPos) => {
    if (!gridPos || !gridPos.inGrid) return null;
    
    return notes.find(note => {
      const rect = viewport.getNoteRect(note);
      return (
        gridPos.x >= rect.x && 
        gridPos.x <= rect.x + rect.width &&
        gridPos.y >= rect.y && 
        gridPos.y <= rect.y + rect.height
      );
    });
  }, [notes, viewport]);

  // Enhanced mouse down handler with better error handling
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // Only handle left clicks
    
    e.preventDefault();
    
    const gridPos = viewport.mouseToGrid(e);
    if (!gridPos) return;

    const clickedNote = findNoteAtPosition(gridPos);

    // Tool-specific handling with improved logic
    switch (activeTool) {
      case PIANO_ROLL_TOOLS.PENCIL:
        handlePencilTool(gridPos, clickedNote, e);
        break;
        
      case PIANO_ROLL_TOOLS.SELECTION:
        handleSelectionTool(gridPos, clickedNote, e);
        break;
        
      case PIANO_ROLL_TOOLS.ERASER:
        handleEraserTool(clickedNote);
        break;
        
      case PIANO_ROLL_TOOLS.SPLIT:
        handleSplitTool(gridPos, clickedNote);
        break;
    }
  }, [activeTool, viewport, findNoteAtPosition]);

  // Pencil tool handler
  const handlePencilTool = useCallback((gridPos, clickedNote, e) => {
    if (clickedNote) {
      // Delete existing note
      handleNotesChange(notes.filter(n => n.id !== clickedNote.id));
    } else {
      // Create new note
      const snappedTime = snapping.snapTime(gridPos.time);
      const newNote = {
        id: generateNoteId(),
        time: snappedTime,
        pitch: gridPos.pitch,
        duration: lastUsedDuration,
        velocity: 0.8
      };
      
      handleNotesChange([...notes, newNote]);
      setSelectedNotes(new Set([newNote.id]));
      
      // Audio preview
      audioContext.auditionNote(gridPos.pitch, 0.8);
      
      // Start creation interaction for duration adjustment
      setCurrentInteraction({
        type: 'create',
        noteId: newNote.id,
        startGridPos: gridPos,
        startTime: snappedTime
      });
    }
  }, [notes, handleNotesChange, snapping, lastUsedDuration, setSelectedNotes, audioContext]);

  // Selection tool handler
  const handleSelectionTool = useCallback((gridPos, clickedNote, e) => {
    if (clickedNote) {
      // Handle note selection
      const isSelected = selectedNotes.has(clickedNote.id);
      
      if (e.shiftKey) {
        // Multi-select mode
        const newSelection = new Set(selectedNotes);
        if (isSelected) {
          newSelection.delete(clickedNote.id);
        } else {
          newSelection.add(clickedNote.id);
        }
        setSelectedNotes(newSelection);
      } else if (!isSelected) {
        // Single select mode
        setSelectedNotes(new Set([clickedNote.id]));
      }
      
      // Start drag operation
      const notesToDrag = selectedNotes.has(clickedNote.id) 
        ? Array.from(selectedNotes) 
        : [clickedNote.id];
        
      setCurrentInteraction({
        type: 'drag',
        startPos: gridPos,
        noteIds: notesToDrag,
        originalNotes: new Map(
          notes
            .filter(n => notesToDrag.includes(n.id))
            .map(n => [n.id, { ...n }])
        )
      });
    } else {
      // Start marquee selection
      if (!e.shiftKey) {
        setSelectedNotes(new Set());
      }
      
      setCurrentInteraction({
        type: 'marquee',
        startPos: gridPos,
        currentPos: gridPos
      });
    }
  }, [selectedNotes, setSelectedNotes, notes]);

  // Eraser tool handler
  const handleEraserTool = useCallback((clickedNote) => {
    if (clickedNote) {
      handleNotesChange(notes.filter(n => n.id !== clickedNote.id));
      
      // Remove from selection if selected
      if (selectedNotes.has(clickedNote.id)) {
        const newSelection = new Set(selectedNotes);
        newSelection.delete(clickedNote.id);
        setSelectedNotes(newSelection);
      }
    }
  }, [notes, handleNotesChange, selectedNotes, setSelectedNotes]);

  // Split tool handler
  const handleSplitTool = useCallback((gridPos, clickedNote) => {
    if (!clickedNote) return;
    
    const noteRect = viewport.getNoteRect(clickedNote);
    const splitTime = snapping.snapTime(gridPos.time);
    const noteStartTime = clickedNote.time;
    const noteEndTime = noteStartTime + Tone.Time(clickedNote.duration).toSeconds() / Tone.Time('16n').toSeconds();
    
    // Check if split position is within note bounds
    if (splitTime > noteStartTime && splitTime < noteEndTime) {
      const firstNoteDuration = splitTime - noteStartTime;
      const secondNoteDuration = noteEndTime - splitTime;
      
      const firstNote = {
        ...clickedNote,
        duration: `${firstNoteDuration}*16n`
      };
      
      const secondNote = {
        ...clickedNote,
        id: generateNoteId(),
        time: splitTime,
        duration: `${secondNoteDuration}*16n`
      };
      
      // Replace original note with two new notes
      const updatedNotes = notes.map(n => 
        n.id === clickedNote.id ? firstNote : n
      );
      updatedNotes.push(secondNote);
      
      handleNotesChange(updatedNotes);
      setSelectedNotes(new Set([firstNote.id, secondNote.id]));
    }
  }, [viewport, snapping, notes, handleNotesChange, setSelectedNotes]);

  // Improved mouse move handler
  const handleMouseMove = useCallback((e) => {
    if (!currentInteraction) return;
    
    const gridPos = viewport.mouseToGrid(e);
    if (!gridPos) return;

    switch (currentInteraction.type) {
      case 'create':
        handleCreateMove(gridPos);
        break;
        
      case 'drag':
        handleDragMove(gridPos);
        break;
        
      case 'marquee':
        handleMarqueeMove(gridPos);
        break;
    }
  }, [currentInteraction, viewport]);

  // Create interaction move handler
  const handleCreateMove = useCallback((gridPos) => {
    const timeDiff = gridPos.time - currentInteraction.startTime;
    const snappedDuration = Math.max(snapping.snapSteps, snapping.snapTime(timeDiff));
    const durationNotation = `${snappedDuration / snapping.snapSteps}*${snapping.value}`;
    
    // Update the note being created
    const updatedNotes = notes.map(n => 
      n.id === currentInteraction.noteId 
        ? { ...n, duration: durationNotation }
        : n
    );
    
    handleNotesChange(updatedNotes);
    setLastUsedDuration(durationNotation);
  }, [currentInteraction, snapping, notes, handleNotesChange, setLastUsedDuration]);

  // Drag interaction move handler
  const handleDragMove = useCallback((gridPos) => {
    const deltaTime = gridPos.time - currentInteraction.startPos.time;
    const deltaPitch = viewport.pitchToIndex(currentInteraction.startPos.pitch) - viewport.pitchToIndex(gridPos.pitch);
    
    const snappedDeltaTime = snapping.snapTime(deltaTime);
    
    const previewNotes = currentInteraction.noteIds.map(id => {
      const original = currentInteraction.originalNotes.get(id);
      if (!original) return null;
      
      const originalPitchIndex = viewport.pitchToIndex(original.pitch);
      const newPitchIndex = Math.max(0, Math.min(127, originalPitchIndex + deltaPitch));
      
      return {
        ...original,
        time: Math.max(0, original.time + snappedDeltaTime),
        pitch: viewport.indexToPitch(newPitchIndex)
      };
    }).filter(Boolean);
    
    setCurrentInteraction(prev => ({ ...prev, previewNotes }));
  }, [currentInteraction, viewport, snapping]);

  // Marquee interaction move handler
  const handleMarqueeMove = useCallback((gridPos) => {
    setCurrentInteraction(prev => ({ ...prev, currentPos: gridPos }));
    
    // Calculate marquee rectangle
    const rect = {
      x: Math.min(currentInteraction.startPos.x, gridPos.x),
      y: Math.min(currentInteraction.startPos.y, gridPos.y),
      width: Math.abs(gridPos.x - currentInteraction.startPos.x),
      height: Math.abs(gridPos.y - currentInteraction.startPos.y)
    };
    
    // Find notes within marquee
    const notesInMarquee = notes.filter(note => {
      const noteRect = viewport.getNoteRect(note);
      return (
        noteRect.x < rect.x + rect.width &&
        noteRect.x + noteRect.width > rect.x &&
        noteRect.y < rect.y + rect.height &&
        noteRect.y + noteRect.height > rect.y
      );
    });
    
    // Update selection
    const newSelection = new Set(selectedNotes);
    notesInMarquee.forEach(note => newSelection.add(note.id));
    setSelectedNotes(newSelection);
  }, [currentInteraction, notes, viewport, selectedNotes, setSelectedNotes]);

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    if (!currentInteraction) return;

    switch (currentInteraction.type) {
      case 'drag':
        finalizeDragOperation();
        break;
        
      case 'create':
      case 'marquee':
        // These are handled during move events
        break;
    }
    
    audioContext.stopAllAudition();
    setCurrentInteraction(null);
  }, [currentInteraction, audioContext]);

  // Finalize drag operation
  const finalizeDragOperation = useCallback(() => {
    if (!currentInteraction.previewNotes) return;
    
    const updatedNotesMap = new Map(notes.map(n => [n.id, n]));
    
    currentInteraction.previewNotes.forEach(previewNote => {
      updatedNotesMap.set(previewNote.id, previewNote);
    });
    
    handleNotesChange(Array.from(updatedNotesMap.values()));
  }, [currentInteraction, notes, handleNotesChange]);

  // Resize start handler
  const handleResizeStart = useCallback((note, e) => {
    e.stopPropagation();
    e.preventDefault();
    
    const startX = e.clientX;
    const originalDurationSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
    
    const handleResizeMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSteps = deltaX / viewport.stepWidth;
      const newDurationSteps = Math.max(snapping.snapSteps, originalDurationSteps + deltaSteps);
      const snappedDuration = snapping.snapTime(newDurationSteps);
      const durationNotation = `${snappedDuration / snapping.snapSteps}*${snapping.value}`;
      
      const updatedNotes = notes.map(n => 
        n.id === note.id ? { ...n, duration: durationNotation } : n
      );
      
      handleNotesChange(updatedNotes);
    };

    const handleResizeUp = () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeUp);
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
  }, [notes, handleNotesChange, viewport, snapping]);

  // Global mouse up listener
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (currentInteraction) {
        handleMouseUp();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [handleMouseUp, currentInteraction]);

  return {
    eventHandlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
    },
    currentInteraction,
    handleResizeStart,
    audioContext,
    
    // Utility functions
    findNoteAtPosition,
  };
};