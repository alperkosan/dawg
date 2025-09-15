import { useState, useCallback, useRef, useEffect } from 'react';
import { useGridSnapping } from './useGridSnapping';
import * as Tone from 'tone';

export const usePianoRollInteractions = ({
  notes,
  selectedNotes,
  setSelectedNotes,
  tool,
  viewport,
  snapSettings,
  addNote,
  updateNotes,
  removeNotes,
  audioEngine,
  instrumentId
}) => {
  const [interaction, setInteraction] = useState(null);
  const [previewNotes, setPreviewNotes] = useState(null);
  const [selectionRect, setSelectionRect] = useState(null);
  
  const snapping = useGridSnapping(snapSettings, viewport);
  const panState = useRef({ isPanning: false });
  
  // Mouse down handler
  const handleMouseDown = useCallback((e) => {
    if (e.altKey || e.button === 1) {
      // Pan mode
      panState.current = {
        isPanning: true,
        startX: e.clientX,
        startY: e.clientY,
        startScrollX: viewport.scrollX,
        startScrollY: viewport.scrollY
      };
      return;
    }
    
    if (e.button === 2) return; // Handle right click elsewhere
    
    const gridPos = viewport.clientToGrid(e.clientX, e.clientY);
    const clickedNote = notes.find(note => viewport.isPointInNote(gridPos, note));
    
    switch (tool) {
      case 'select':
        handleSelectTool(e, gridPos, clickedNote);
        break;
      case 'pencil':
        handlePencilTool(e, gridPos, clickedNote);
        break;
      case 'eraser':
        if (clickedNote) removeNotes([clickedNote.id]);
        break;
    }
  }, [tool, notes, viewport, selectedNotes, removeNotes]);
  
  const handleSelectTool = useCallback((e, gridPos, clickedNote) => {
    if (clickedNote) {
      if (e.shiftKey) {
        // Multi-select
        setSelectedNotes(prev => {
          const newSelection = new Set(prev);
          if (newSelection.has(clickedNote.id)) {
            newSelection.delete(clickedNote.id);
          } else {
            newSelection.add(clickedNote.id);
          }
          return newSelection;
        });
      } else if (!selectedNotes.has(clickedNote.id)) {
        setSelectedNotes(new Set([clickedNote.id]));
      }
      
      // Start drag operation
      setInteraction({
        type: 'drag',
        startPos: gridPos,
        notes: Array.from(selectedNotes).map(id => notes.find(n => n.id === id)).filter(Boolean),
        originalNotes: new Map(notes.filter(n => selectedNotes.has(n.id)).map(n => [n.id, { ...n }]))
      });
    } else {
      // Start selection rectangle
      setSelectedNotes(new Set());
      setInteraction({
        type: 'select',
        startPos: gridPos,
        currentPos: gridPos
      });
    }
  }, [selectedNotes, setSelectedNotes, notes]);
  
  const handlePencilTool = useCallback((e, gridPos, clickedNote) => {
    if (clickedNote) {
      // Start drag existing note
      setSelectedNotes(new Set([clickedNote.id]));
      setInteraction({
        type: 'drag',
        startPos: gridPos,
        notes: [clickedNote],
        originalNotes: new Map([[clickedNote.id, { ...clickedNote }]])
      });
    } else {
      // Start creating new note
      const snappedTime = snapping.snapTime(gridPos.time);
      const pitch = viewport.yToPitch(gridPos.y);
      
      setInteraction({
        type: 'create',
        startPos: { ...gridPos, time: snappedTime },
        currentPos: { ...gridPos, time: snappedTime },
        pitch
      });
      
      // Audio preview
      audioEngine?.auditionNote(instrumentId, pitch, 0.8);
    }
  }, [snapping, viewport, setSelectedNotes, audioEngine, instrumentId]);
  
  // Mouse move handler
  const handleMouseMove = useCallback((e) => {
    if (panState.current.isPanning) {
      const dx = e.clientX - panState.current.startX;
      const dy = e.clientY - panState.current.startY;
      viewport.scrollTo(
        panState.current.startScrollX - dx,
        panState.current.startScrollY - dy
      );
      return;
    }
    
    if (!interaction) return;
    
    const gridPos = viewport.clientToGrid(e.clientX, e.clientY);
    
    switch (interaction.type) {
      case 'create':
        handleCreateMove(gridPos);
        break;
      case 'drag':
        handleDragMove(gridPos);
        break;
      case 'select':
        handleSelectMove(gridPos);
        break;
    }
  }, [interaction, viewport]);
  
  const handleCreateMove = useCallback((gridPos) => {
    const duration = Math.max(
      snapping.snapDuration(gridPos.time - interaction.startPos.time),
      snapping.getMinDuration()
    );
    
    const previewNote = {
      id: 'preview',
      time: interaction.startPos.time,
      pitch: interaction.pitch,
      duration: Tone.Time(duration * Tone.Time('16n').toSeconds()).toNotation(),
      velocity: 0.8
    };
    
    setPreviewNotes([previewNote]);
    setInteraction(prev => ({ ...prev, currentPos: gridPos, duration }));
  }, [interaction, snapping]);
  
  const handleDragMove = useCallback((gridPos) => {
    const deltaTime = snapping.snapTime(gridPos.time - interaction.startPos.time);
    const deltaPitch = viewport.yToPitchIndex(gridPos.y) - viewport.yToPitchIndex(interaction.startPos.y);
    
    const updatedNotes = interaction.notes.map(note => {
      const original = interaction.originalNotes.get(note.id);
      return {
        ...original,
        time: Math.max(0, original.time + deltaTime),
        pitch: viewport.pitchIndexToPitch(
          Math.max(0, Math.min(127, viewport.pitchToIndex(original.pitch) + deltaPitch))
        )
      };
    });
    
    setPreviewNotes(updatedNotes);
  }, [interaction, snapping, viewport]);
  
  const handleSelectMove = useCallback((gridPos) => {
    const rect = {
      x: Math.min(interaction.startPos.x, gridPos.x),
      y: Math.min(interaction.startPos.y, gridPos.y),
      width: Math.abs(gridPos.x - interaction.startPos.x),
      height: Math.abs(gridPos.y - interaction.startPos.y)
    };
    
    setSelectionRect(rect);
    
    // Update selected notes based on rectangle
    const newSelection = new Set();
    notes.forEach(note => {
      if (viewport.isNoteInRect(note, rect)) {
        newSelection.add(note.id);
      }
    });
    setSelectedNotes(newSelection);
    
    setInteraction(prev => ({ ...prev, currentPos: gridPos }));
  }, [interaction, notes, viewport, setSelectedNotes]);
  
  // Mouse up handler
  const handleMouseUp = useCallback((e) => {
    if (panState.current.isPanning) {
      panState.current.isPanning = false;
      return;
    }
    
    if (!interaction) return;
    
    switch (interaction.type) {
      case 'create':
        finishCreateNote();
        break;
      case 'drag':
        finishDragNotes();
        break;
      case 'select':
        finishSelection();
        break;
    }
    
    setInteraction(null);
    setPreviewNotes(null);
    setSelectionRect(null);
  }, [interaction]);
  
  const finishCreateNote = useCallback(() => {
    if (!interaction || interaction.duration <= 0) return;
    
    const newNote = addNote({
      time: interaction.startPos.time,
      pitch: interaction.pitch,
      duration: Tone.Time(interaction.duration * Tone.Time('16n').toSeconds()).toNotation(),
      velocity: 0.8
    });
    
    // Stop audio preview
    audioEngine?.auditionNoteOff(instrumentId, interaction.pitch);
  }, [interaction, addNote, audioEngine, instrumentId]);
  
  const finishDragNotes = useCallback(() => {
    if (!previewNotes) return;
    
    const updates = new Map();
    previewNotes.forEach(note => {
      updates.set(note.id, {
        time: note.time,
        pitch: note.pitch
      });
    });
    
    updateNotes(updates);
  }, [previewNotes, updateNotes]);
  
  const finishSelection = useCallback(() => {
    // Selection is already updated in handleSelectMove
  }, []);
  
  // Note-specific interactions
  const onNoteInteraction = useCallback((action, note, e) => {
    e.stopPropagation();
    
    switch (action) {
      case 'select':
        if (e.shiftKey) {
          setSelectedNotes(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(note.id)) {
              newSelection.delete(note.id);
            } else {
              newSelection.add(note.id);
            }
            return newSelection;
          });
        } else {
          setSelectedNotes(new Set([note.id]));
        }
        break;
        
      case 'delete':
        removeNotes([note.id]);
        break;
        
      case 'resize':
        startResize(note, e);
        break;
    }
  }, [setSelectedNotes, removeNotes]);
  
  const startResize = useCallback((note, e) => {
    const startX = e.clientX;
    const originalDuration = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
    
    const handleResizeMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSteps = deltaX / viewport.stepWidth;
      const newDuration = Math.max(
        snapping.getMinDuration(),
        snapping.snapDuration(originalDuration + deltaSteps)
      );
      
      setPreviewNotes([{
        ...note,
        duration: Tone.Time(newDuration * Tone.Time('16n').toSeconds()).toNotation()
      }]);
    };
    
    const handleResizeUp = () => {
      if (previewNotes) {
        const updatedNote = previewNotes[0];
        updateNotes(new Map([[note.id, { duration: updatedNote.duration }]]));
      }
      
      setPreviewNotes(null);
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeUp);
    };
    
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
  }, [viewport, snapping, updateNotes, previewNotes]);
  
  // Global mouse up handler
  useEffect(() => {
    const handleGlobalMouseUp = (e) => {
      if (panState.current.isPanning || interaction) {
        handleMouseUp(e);
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [handleMouseUp, interaction]);
  
  // Container props
  const containerProps = {
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onContextMenu: (e) => e.preventDefault()
  };
  
  return {
    containerProps,
    previewNotes,
    selectionRect,
    onNoteInteraction,
    interaction
  };
};