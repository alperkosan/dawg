/**
 * @file usePianoRollInteractions.js
 * @description Complete interaction handling for Piano Roll V3
 */
import { useRef, useCallback, useEffect } from 'react';
import { usePianoRollV3Store } from '../store/usePianoRollV3Store';

export const usePianoRollInteractions = (containerRef, engine) => {
  const interactionStateRef = useRef({
    isDrawing: false,
    isPanning: false,
    isSelecting: false,
    isResizing: false,
    lastMousePos: { x: 0, y: 0 },
    startMousePos: { x: 0, y: 0 },
    currentTool: 'select',
    modifiers: {
      shift: false,
      ctrl: false,
      alt: false,
      meta: false,
    },
  });

  // Store actions
  const {
    addNote,
    updateNote,
    deleteNote,
    selectNote,
    deselectNote,
    clearSelection,
    setGhostNote,
    setSelectionBox,
    undo,
    redo,
    zoomIn,
    zoomOut,
    setTool,
  } = usePianoRollV3Store();

  const { coordUtils, viewport, grid } = engine;

  // === KEYBOARD SHORTCUTS ===
  const handleKeyDown = useCallback((e) => {
    const state = interactionStateRef.current;
    
    // Update modifiers
    state.modifiers.shift = e.shiftKey;
    state.modifiers.ctrl = e.ctrlKey;
    state.modifiers.alt = e.altKey;
    state.modifiers.meta = e.metaKey;

    // Tool shortcuts
    switch(e.key) {
      case '1':
      case 'v':
        setTool('select');
        state.currentTool = 'select';
        break;
      
      case '2':
      case 'p':
        setTool('pencil');
        state.currentTool = 'pencil';
        break;
      
      case '3':
      case 'e':
        setTool('eraser');
        state.currentTool = 'eraser';
        break;
      
      case '4':
      case 's':
        setTool('split');
        state.currentTool = 'split';
        break;

      // Zoom controls
      case '+':
      case '=':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          zoomIn();
        }
        break;
      
      case '-':
      case '_':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          zoomOut();
        }
        break;
      
      case '0':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          usePianoRollV3Store.getState().setZoom(1.0);
        }
        break;

      // Undo/Redo
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
        break;
      
      case 'y':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          redo();
        }
        break;

      // Selection
      case 'a':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Select all visible notes
          const visibleNotes = usePianoRollV3Store.getState().getVisibleNotes();
          visibleNotes.forEach(note => selectNote(note.id, true));
        }
        break;

      case 'Escape':
        clearSelection();
        setGhostNote(null);
        setSelectionBox(null);
        break;

      // Delete
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        const selectedIds = usePianoRollV3Store.getState().notes.selectedIds;
        selectedIds.forEach(id => deleteNote(id));
        break;

      // Copy/Cut/Paste
      case 'c':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleCopy();
        }
        break;

      case 'x':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleCut();
        }
        break;

      case 'v':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handlePaste();
        }
        break;

      // Navigation
      case 'Home':
        if (containerRef.current) {
          containerRef.current.scrollLeft = 0;
        }
        break;

      case 'End':
        if (containerRef.current) {
          const maxScroll = usePianoRollV3Store.getState().viewport.maxScrollX;
          containerRef.current.scrollLeft = maxScroll;
        }
        break;

      case 'PageUp':
        if (containerRef.current) {
          containerRef.current.scrollTop -= viewport.height * 0.8;
        }
        break;

      case 'PageDown':
        if (containerRef.current) {
          containerRef.current.scrollTop += viewport.height * 0.8;
        }
        break;

      // Arrow keys for note nudging
      case 'ArrowLeft':
        if (e.shiftKey) {
          nudgeSelectedNotes(-1, 0);
        }
        break;

      case 'ArrowRight':
        if (e.shiftKey) {
          nudgeSelectedNotes(1, 0);
        }
        break;

      case 'ArrowUp':
        if (e.shiftKey) {
          nudgeSelectedNotes(0, -1);
        }
        break;

      case 'ArrowDown':
        if (e.shiftKey) {
          nudgeSelectedNotes(0, 1);
        }
        break;

      // Space for play/pause (when integrated with playback)
      case ' ':
        e.preventDefault();
        // Toggle playback when connected to audio engine
        console.log('Toggle playback');
        break;
    }
  }, [setTool, zoomIn, zoomOut, undo, redo, selectNote, clearSelection, 
      deleteNote, setGhostNote, setSelectionBox, containerRef, viewport]);

  const handleKeyUp = useCallback((e) => {
    const state = interactionStateRef.current;
    
    // Update modifiers
    state.modifiers.shift = e.shiftKey;
    state.modifiers.ctrl = e.ctrlKey;
    state.modifiers.alt = e.altKey;
    state.modifiers.meta = e.metaKey;
  }, []);

  // === MOUSE INTERACTIONS ===
  const handleMouseDown = useCallback((e) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const state = interactionStateRef.current;
    
    state.lastMousePos = { x, y };
    state.startMousePos = { x, y };

    // Middle mouse button - start panning
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      state.isPanning = true;
      containerRef.current.style.cursor = 'grabbing';
      return;
    }

    // Right mouse button - context menu
    if (e.button === 2) {
      handleContextMenu(e);
      return;
    }

    // Left mouse button - tool-specific action
    if (e.button === 0) {
      const gridCoords = coordUtils.mouseToGrid(x, y);

      switch(state.currentTool) {
        case 'pencil':
          handleDrawNote(gridCoords);
          state.isDrawing = true;
          break;

        case 'eraser':
          handleEraseNote(gridCoords);
          break;

        case 'split':
          handleSplitNote(gridCoords);
          break;

        case 'select':
        default:
          // Selection handled in VirtualizedNotes component
          break;
      }
    }
  }, [containerRef, coordUtils]);

  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const state = interactionStateRef.current;

    const deltaX = x - state.lastMousePos.x;
    const deltaY = y - state.lastMousePos.y;

    // Panning
    if (state.isPanning) {
      containerRef.current.scrollLeft -= deltaX;
      containerRef.current.scrollTop -= deltaY;
    }

    // Drawing notes
    if (state.isDrawing && state.currentTool === 'pencil') {
      const gridCoords = coordUtils.mouseToGrid(x, y);
      handleExtendNote(gridCoords);
    }

    // Update ghost note position
    if (state.currentTool === 'pencil' && !state.isDrawing) {
      const gridCoords = coordUtils.mouseToGrid(x, y);
      setGhostNote({
        step: Math.floor(gridCoords.step / grid.snapMode) * grid.snapMode,
        key: gridCoords.key,
        duration: grid.snapMode,
        velocity: 100,
        pitch: coordUtils.getNoteInfo(gridCoords.key).pitch,
      });
    }

    state.lastMousePos = { x, y };
  }, [containerRef, coordUtils, grid.snapMode, setGhostNote]);

  const handleMouseUp = useCallback((e) => {
    const state = interactionStateRef.current;

    // Stop panning
    if (state.isPanning) {
      state.isPanning = false;
      if (containerRef.current) {
        containerRef.current.style.cursor = 'default';
      }
    }

    // Stop drawing
    if (state.isDrawing) {
      state.isDrawing = false;
      finalizeDrawnNote();
    }

    // Clear ghost note
    if (state.currentTool === 'pencil') {
      setGhostNote(null);
    }
  }, [containerRef, setGhostNote]);

  const handleWheel = useCallback((e) => {
    if (!containerRef.current) return;

    // Zoom with Ctrl/Cmd + wheel
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
      const currentZoom = usePianoRollV3Store.getState().viewport.zoomX;
      const newZoom = currentZoom * zoomDelta;

      // Calculate zoom center point
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Store scroll position before zoom
      const scrollXBefore = containerRef.current.scrollLeft;
      const scrollYBefore = containerRef.current.scrollTop;

      // Apply zoom
      usePianoRollV3Store.getState().setZoom(newZoom);

      // Adjust scroll to keep mouse position stable
      requestAnimationFrame(() => {
        const zoomRatio = newZoom / currentZoom;
        const newScrollX = (scrollXBefore + mouseX) * zoomRatio - mouseX;
        const newScrollY = (scrollYBefore + mouseY) * zoomRatio - mouseY;

        containerRef.current.scrollLeft = Math.max(0, newScrollX);
        containerRef.current.scrollTop = Math.max(0, newScrollY);
      });
    } 
    // Horizontal scroll with Shift + wheel
    else if (e.shiftKey) {
      e.preventDefault();
      containerRef.current.scrollLeft += e.deltaY;
    }
  }, [containerRef]);

  // === NOTE MANIPULATION ===
  const handleDrawNote = useCallback((gridCoords) => {
    const snappedStep = Math.floor(gridCoords.step / grid.snapMode) * grid.snapMode;
    
    // Check if note already exists at this position
    const existingNoteKey = `${snappedStep}-${gridCoords.key}`;
    const existingNoteId = usePianoRollV3Store.getState().notes.byPosition.get(existingNoteKey);
    
    if (!existingNoteId) {
      const noteInfo = coordUtils.getNoteInfo(gridCoords.key);
      const noteId = addNote({
        step: snappedStep,
        key: gridCoords.key,
        duration: grid.snapMode,
        velocity: 100,
        pitch: noteInfo.pitch,
      });

      // Store the drawn note for extension
      interactionStateRef.current.drawnNoteId = noteId;
    }
  }, [grid.snapMode, coordUtils, addNote]);

  const handleExtendNote = useCallback((gridCoords) => {
    const state = interactionStateRef.current;
    if (!state.drawnNoteId) return;

    const note = usePianoRollV3Store.getState().notes.byId[state.drawnNoteId];
    if (!note) return;

    const snappedStep = Math.floor(gridCoords.step / grid.snapMode) * grid.snapMode;
    const newDuration = Math.max(grid.snapMode, snappedStep - note.step + grid.snapMode);

    if (newDuration !== note.duration) {
      updateNote(state.drawnNoteId, { duration: newDuration });
    }
  }, [grid.snapMode, updateNote]);

  const finalizeDrawnNote = useCallback(() => {
    interactionStateRef.current.drawnNoteId = null;
  }, []);

  const handleEraseNote = useCallback((gridCoords) => {
    // Find note at position
    const notes = usePianoRollV3Store.getState().notes;
    const visibleNotes = usePianoRollV3Store.getState().getVisibleNotes();
    
    const noteToErase = visibleNotes.find(note => {
      const noteEndStep = note.step + note.duration;
      return gridCoords.key === note.key && 
             gridCoords.step >= note.step && 
             gridCoords.step < noteEndStep;
    });

    if (noteToErase) {
      deleteNote(noteToErase.id);
    }
  }, [deleteNote]);

  const handleSplitNote = useCallback((gridCoords) => {
    const visibleNotes = usePianoRollV3Store.getState().getVisibleNotes();
    
    const noteToSplit = visibleNotes.find(note => {
      const noteEndStep = note.step + note.duration;
      return gridCoords.key === note.key && 
             gridCoords.step > note.step && 
             gridCoords.step < noteEndStep;
    });

    if (noteToSplit) {
      const splitPoint = Math.floor(gridCoords.step / grid.snapMode) * grid.snapMode;
      const firstDuration = splitPoint - noteToSplit.step;
      const secondDuration = noteToSplit.duration - firstDuration;

      // Update first note
      updateNote(noteToSplit.id, { duration: firstDuration });

      // Create second note
      addNote({
        step: splitPoint,
        key: noteToSplit.key,
        duration: secondDuration,
        velocity: noteToSplit.velocity,
        pitch: noteToSplit.pitch,
      });
    }
  }, [grid.snapMode, updateNote, addNote]);

  const nudgeSelectedNotes = useCallback((stepDelta, keyDelta) => {
    const selectedIds = usePianoRollV3Store.getState().notes.selectedIds;
    const notes = usePianoRollV3Store.getState().notes.byId;

    selectedIds.forEach(id => {
      const note = notes[id];
      if (note) {
        updateNote(id, {
          step: Math.max(0, note.step + stepDelta),
          key: Math.max(0, Math.min(107, note.key + keyDelta)),
        });
      }
    });
  }, [updateNote]);

  // === CLIPBOARD OPERATIONS ===
  const handleCopy = useCallback(() => {
    const selectedIds = usePianoRollV3Store.getState().notes.selectedIds;
    const notes = usePianoRollV3Store.getState().notes.byId;
    
    const clipboard = [...selectedIds].map(id => ({ ...notes[id] }));
    
    usePianoRollV3Store.setState(state => ({
      notes: { ...state.notes, clipboard }
    }));
    
    console.log('Copied', clipboard.length, 'notes');
  }, []);

  const handleCut = useCallback(() => {
    handleCopy();
    
    const selectedIds = usePianoRollV3Store.getState().notes.selectedIds;
    selectedIds.forEach(id => deleteNote(id));
  }, [handleCopy, deleteNote]);

  const handlePaste = useCallback(() => {
    const clipboard = usePianoRollV3Store.getState().notes.clipboard;
    const currentStep = Math.floor(viewport.scrollX / grid.stepWidth);
    
    if (clipboard.length === 0) return;

    // Find leftmost note in clipboard
    const minStep = Math.min(...clipboard.map(n => n.step));
    const offset = currentStep - minStep;

    clearSelection();

    // Paste notes with offset
    clipboard.forEach(note => {
      const newNote = {
        ...note,
        step: note.step + offset,
      };
      delete newNote.id; // Remove old ID
      const newId = addNote(newNote);
      selectNote(newId, true);
    });
    
    console.log('Pasted', clipboard.length, 'notes');
  }, [viewport.scrollX, grid.stepWidth, clearSelection, addNote, selectNote]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    // Implement context menu here
    console.log('Context menu at', e.clientX, e.clientY);
  }, []);

  // === SETUP EVENT LISTENERS ===
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Add event listeners
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    // Document-level listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      // Cleanup
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('wheel', handleWheel);
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [containerRef, handleMouseDown, handleMouseMove, handleMouseUp, 
      handleWheel, handleKeyDown, handleKeyUp]);

  return {
    currentTool: interactionStateRef.current.currentTool,
    isPanning: interactionStateRef.current.isPanning,
    isDrawing: interactionStateRef.current.isDrawing,
    modifiers: interactionStateRef.current.modifiers,
    
    // Exposed methods for external use
    setCurrentTool: (tool) => {
      interactionStateRef.current.currentTool = tool;
      setTool(tool);
    },
    
    copyNotes: handleCopy,
    cutNotes: handleCut,
    pasteNotes: handlePaste,
    nudgeNotes: nudgeSelectedNotes,
  };
};