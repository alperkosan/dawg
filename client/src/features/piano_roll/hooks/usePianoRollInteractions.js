// Enhanced usePianoRollInteractions.js - Tüm etkileşimler optimize edildi
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useGridSnapping } from './useGridSnapping';
import { usePianoRollStore } from '../store/usePianoRollStore';
import * as Tone from 'tone';

// Utility functions
const generateNoteId = () => `note_${Date.now()}_${Math.random().toString(36).substring(7)}`;

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export const usePianoRollInteractions = ({
  notes,
  handleNotesChange,
  instrumentId,
  audioEngineRef,
  viewport,
  gridDimensions,
  coordinateConverters,
  containerRef,
  activeTool,
  selectedNotes,
  setSelectedNotes
}) => {
  // ✅ STATE
  const [currentInteraction, setCurrentInteraction] = useState(null);
  const [dragState, setDragState] = useState(null);
  const interactionRef = useRef(null);
  
  // ✅ STORE
  const { gridSnapValue, snapMode } = usePianoRollStore();
  
  // ✅ SNAPPING
  const snapping = useGridSnapping({ 
    enabled: true, 
    value: gridSnapValue, 
    mode: snapMode 
  });

  // ✅ AUDIO CONTEXT
  const audioContext = useMemo(() => ({
    playingNotes: new Set(),
    auditionNote: (pitch, velocity = 0.8) => {
      if (audioEngineRef.current && instrumentId) {
        if (velocity > 0) {
          audioEngineRef.current.auditionNoteOn(instrumentId, pitch, velocity);
          audioContext.playingNotes.add(pitch);
        } else {
          audioEngineRef.current.auditionNoteOff(instrumentId, pitch);
          audioContext.playingNotes.delete(pitch);
        }
      }
    },
    stopAllAudition: () => {
      audioContext.playingNotes.forEach(pitch => {
        audioContext.auditionNote(pitch, 0);
      });
      audioContext.playingNotes.clear();
    }
  }), [audioEngineRef, instrumentId]);

  // ✅ COORDINATE HELPERS
  const getGridPosition = useCallback((clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return null;
    
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left + container.scrollLeft - viewport.keyboardWidth;
    const y = clientY - rect.top + container.scrollTop - viewport.rulerHeight;
    
    const time = coordinateConverters.xToStep(x);
    const pitch = coordinateConverters.yToNote(y);
    
    return { x, y, time, pitch };
  }, [containerRef, viewport, coordinateConverters]);

  // ✅ NOTE FINDING
  const findNoteAtPosition = useCallback((x, y) => {
    return notes.find(note => {
      const noteRect = viewport.getNoteRect(note);
      return (x >= noteRect.x && x <= noteRect.x + noteRect.width &&
              y >= noteRect.y && y <= noteRect.y + noteRect.height);
    });
  }, [notes, viewport]);

  // ✅ MOUSE DOWN HANDLER
  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || e.altKey) {
      // Pan mode
      setCurrentInteraction({
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        startScrollX: containerRef.current?.scrollLeft || 0,
        startScrollY: containerRef.current?.scrollTop || 0
      });
      return;
    }

    if (e.button === 2) return; // Right click

    const gridPos = getGridPosition(e.clientX, e.clientY);
    if (!gridPos) return;

    const clickedNote = findNoteAtPosition(gridPos.x, gridPos.y);

    // Tool-specific handling
    switch (activeTool) {
      case 'selection':
        handleSelectionMouseDown(e, gridPos, clickedNote);
        break;
      case 'pencil':
        handlePencilMouseDown(e, gridPos, clickedNote);
        break;
      case 'eraser':
        if (clickedNote) {
          handleNotesChange(notes.filter(n => n.id !== clickedNote.id));
          if (selectedNotes.has(clickedNote.id)) {
            setSelectedNotes(prev => {
              const newSet = new Set(prev);
              newSet.delete(clickedNote.id);
              return newSet;
            });
          }
        }
        break;
    }
  }, [activeTool, getGridPosition, findNoteAtPosition, notes, selectedNotes, handleNotesChange, setSelectedNotes]);

  // ✅ SELECTION TOOL
  const handleSelectionMouseDown = useCallback((e, gridPos, clickedNote) => {
    if (clickedNote) {
      // Note selection
      if (e.shiftKey) {
        // Multi-select
        setSelectedNotes(prev => {
          const newSet = new Set(prev);
          if (newSet.has(clickedNote.id)) {
            newSet.delete(clickedNote.id);
          } else {
            newSet.add(clickedNote.id);
          }
          return newSet;
        });
      } else if (!selectedNotes.has(clickedNote.id)) {
        setSelectedNotes(new Set([clickedNote.id]));
      }
      
      // Start drag operation
      const notesToDrag = selectedNotes.has(clickedNote.id) ? 
        Array.from(selectedNotes) : [clickedNote.id];
        
      setCurrentInteraction({
        type: 'drag',
        startPos: gridPos,
        noteIds: notesToDrag,
        originalNotes: new Map(notes
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

  // ✅ PENCIL TOOL
  const handlePencilMouseDown = useCallback((e, gridPos, clickedNote) => {
    if (clickedNote) {
      // Edit existing note
      setSelectedNotes(new Set([clickedNote.id]));
      setCurrentInteraction({
        type: 'drag',
        startPos: gridPos,
        noteIds: [clickedNote.id],
        originalNotes: new Map([[clickedNote.id, { ...clickedNote }]])
      });
    } else {
      // Create new note
      const snappedTime = snapping.snapTime(gridPos.time);
      const pitch = gridPos.pitch;
      
      // Audio preview
      audioContext.auditionNote(pitch, 0.8);
      
      setCurrentInteraction({
        type: 'create',
        startPos: { ...gridPos, time: snappedTime },
        currentPos: { ...gridPos, time: snappedTime },
        pitch,
        previewNote: {
          id: 'preview',
          time: snappedTime,
          pitch,
          duration: '16n',
          velocity: 0.8
        }
      });
    }
  }, [snapping, audioContext, setSelectedNotes]);

  // ✅ MOUSE MOVE HANDLER
  const handleMouseMove = useCallback((e) => {
    if (!currentInteraction) return;

    const gridPos = getGridPosition(e.clientX, e.clientY);
    if (!gridPos) return;

    switch (currentInteraction.type) {
      case 'pan':
        handlePanMove(e);
        break;
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
  }, [currentInteraction, getGridPosition]);

  // ✅ PAN MOVE
  const handlePanMove = useCallback((e) => {
    const { startX, startY, startScrollX, startScrollY } = currentInteraction;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    if (containerRef.current) {
      containerRef.current.scrollLeft = startScrollX - dx;
      containerRef.current.scrollTop = startScrollY - dy;
    }
  }, [currentInteraction, containerRef]);

  // ✅ CREATE MOVE
  const handleCreateMove = useCallback((gridPos) => {
    const duration = Math.max(1, gridPos.time - currentInteraction.startPos.time);
    const durationNotation = `${Math.max(1, Math.round(duration))}*16n`;
    
    setCurrentInteraction(prev => ({
      ...prev,
      currentPos: gridPos,
      previewNote: {
        ...prev.previewNote,
        duration: durationNotation
      }
    }));
  }, [currentInteraction]);

  // ✅ DRAG MOVE
  const handleDragMove = useCallback((gridPos) => {
    const deltaTime = snapping.snapTime(gridPos.time - currentInteraction.startPos.time);
    const deltaPitch = Math.round((gridPos.y - currentInteraction.startPos.y) / gridDimensions.keyHeight);
    
    const previewNotes = currentInteraction.noteIds.map(noteId => {
      const originalNote = currentInteraction.originalNotes.get(noteId);
      if (!originalNote) return null;
      
      const newTime = Math.max(0, originalNote.time + deltaTime);
      const currentPitchIndex = coordinateConverters.pitchToIndex(originalNote.pitch);
      const newPitchIndex = clamp(currentPitchIndex + deltaPitch, 0, 127);
      const newPitch = coordinateConverters.indexToPitch(newPitchIndex);
      
      return {
        ...originalNote,
        time: newTime,
        pitch: newPitch
      };
    }).filter(Boolean);
    
    setCurrentInteraction(prev => ({ ...prev, previewNotes }));
  }, [currentInteraction, snapping, gridDimensions, coordinateConverters]);

  // ✅ MARQUEE MOVE
  const handleMarqueeMove = useCallback((gridPos) => {
    setCurrentInteraction(prev => ({ ...prev, currentPos: gridPos }));
    
    // Update selection
    const rect = {
      x: Math.min(currentInteraction.startPos.x, gridPos.x),
      y: Math.min(currentInteraction.startPos.y, gridPos.y),
      width: Math.abs(gridPos.x - currentInteraction.startPos.x),
      height: Math.abs(gridPos.y - currentInteraction.startPos.y)
    };
    
    const newSelection = new Set();
    notes.forEach(note => {
      if (viewport.isNoteInRect(note, rect)) {
        newSelection.add(note.id);
      }
    });
    
    setSelectedNotes(newSelection);
  }, [currentInteraction, notes, viewport, setSelectedNotes]);

  // ✅ MOUSE UP HANDLER
  const handleMouseUp = useCallback(() => {
    if (!currentInteraction) return;

    switch (currentInteraction.type) {
      case 'create':
        finishCreateNote();
        break;
      case 'drag':
        finishDragNotes();
        break;
      case 'pan':
      case 'marquee':
        // Already handled in move
        break;
    }
    
    // Stop audio preview
    audioContext.stopAllAudition();
    setCurrentInteraction(null);
  }, [currentInteraction, audioContext]);

  // ✅ FINISH CREATE
  const finishCreateNote = useCallback(() => {
    const { previewNote } = currentInteraction;
    if (!previewNote || !previewNote.duration) return;
    
    const newNote = {
      ...previewNote,
      id: generateNoteId()
    };
    
    handleNotesChange([...notes, newNote]);
    setSelectedNotes(new Set([newNote.id]));
  }, [currentInteraction, notes, handleNotesChange, setSelectedNotes]);

  // ✅ FINISH DRAG
  const finishDragNotes = useCallback(() => {
    const { previewNotes } = currentInteraction;
    if (!previewNotes || previewNotes.length === 0) return;
    
    const updatedNotes = notes.map(note => {
      const previewNote = previewNotes.find(p => p.id === note.id);
      return previewNote || note;
    });
    
    handleNotesChange(updatedNotes);
  }, [currentInteraction, notes, handleNotesChange]);

  // ✅ RESIZE HANDLER
  const handleResizeStart = useCallback((note, e) => {
    e.stopPropagation();
    e.preventDefault();
    
    const startX = e.clientX;
    const originalDuration = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
    
    const handleResizeMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSteps = deltaX / gridDimensions.stepWidth;
      const newDuration = Math.max(0.25, originalDuration + deltaSteps);
      
      setCurrentInteraction({
        type: 'resize',
        noteId: note.id,
        previewDuration: newDuration
      });
    };
    
    const handleResizeUp = () => {
      if (currentInteraction?.type === 'resize') {
        const newDurationNotation = `${Math.max(1, Math.round(currentInteraction.previewDuration))}*16n`;
        const updatedNotes = notes.map(n => 
          n.id === note.id ? { ...n, duration: newDurationNotation } : n
        );
        handleNotesChange(updatedNotes);
      }
      
      setCurrentInteraction(null);
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeUp);
    };
    
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
  }, [gridDimensions, notes, handleNotesChange, currentInteraction]);

  // ✅ VELOCITY HANDLERS
  const handleVelocityChange = useCallback((noteId, velocity) => {
    const updatedNotes = notes.map(note => 
      note.id === noteId ? { ...note, velocity: clamp(velocity, 0.01, 1) } : note
    );
    handleNotesChange(updatedNotes);
  }, [notes, handleNotesChange]);

  const handleVelocityBarMouseDown = useCallback((note, e) => {
    e.stopPropagation();
    
    const startY = e.clientY;
    const startVelocity = note.velocity;
    const velocityLaneHeight = 100; // Get from props or context
    
    const handleVelocityMove = (moveEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const velocityChange = deltaY / velocityLaneHeight;
      const newVelocity = clamp(startVelocity + velocityChange, 0.01, 1);
      handleVelocityChange(note.id, newVelocity);
    };
    
    const handleVelocityUp = () => {
      window.removeEventListener('mousemove', handleVelocityMove);
      window.removeEventListener('mouseup', handleVelocityUp);
    };
    
    window.addEventListener('mousemove', handleVelocityMove);
    window.addEventListener('mouseup', handleVelocityUp);
  }, [handleVelocityChange]);

  const handleVelocityWheel = useCallback((e) => {
    e.preventDefault();
    // Implementation for velocity wheel control
    console.log('Velocity wheel control');
  }, []);

  // ✅ GLOBAL MOUSE UP LISTENER
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (currentInteraction) {
        handleMouseUp();
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [handleMouseUp, currentInteraction]);

  // ✅ KEYBOARD SHORTCUTS
  const handleKeyDown = useCallback((e) => {
    if (e.target.tagName.toLowerCase() === 'input') return;
    
    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        if (selectedNotes.size > 0) {
          e.preventDefault();
          const remainingNotes = notes.filter(n => !selectedNotes.has(n.id));
          handleNotesChange(remainingNotes);
          setSelectedNotes(new Set());
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        setCurrentInteraction(null);
        setSelectedNotes(new Set());
        audioContext.stopAllAudition();
        break;
        
      case 'a':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setSelectedNotes(new Set(notes.map(n => n.id)));
        }
        break;
    }
  }, [selectedNotes, notes, handleNotesChange, setSelectedNotes, audioContext]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ✅ RETURN INTERFACE
  return {
    // State
    selectedNotes,
    currentInteraction,
    
    // Event handlers
    eventHandlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onContextMenu: (e) => e.preventDefault()
    },
    
    // Specialized handlers
    handleResizeStart,
    handleVelocityChange,
    handleVelocityBarMouseDown,
    handleVelocityWheel,
    
    // Utilities
    getGridPosition,
    findNoteAtPosition,
    audioContext
  };
};