// client/src/features/piano_roll/hooks/useHybridInteractions.js
import { useState, useCallback, useRef, useEffect } from 'react';
import { useTouchHandler } from './useTouchHandler';
import { useAdvancedKeyboardShortcuts } from './useAdvancedKeyboardShortcuts';
import { useGridSnapping } from './useGridSnapping';
import { usePianoRollStore } from '../store/usePianoRollStore';

/**
 * Touch, Mouse ve Klavye etkileşimlerini birleştiren hibrit sistem
 * Modern tablet + desktop workflow'u destekler
 */
export const useHybridInteractions = ({
  notes,
  handleNotesChange,
  instrumentId,
  audioEngineRef,
  viewport,
  gridDimensions,
  coordinateConverters,
  containerRef,
  selectedNotes,
  setSelectedNotes
}) => {
  const [currentInteraction, setCurrentInteraction] = useState(null);
  const [inputMode, setInputMode] = useState('mouse'); // 'mouse', 'touch', 'hybrid'
  const [contextMenu, setContextMenu] = useState(null);
  
  const { activeTool, gridSnapValue, snapMode } = usePianoRollStore();
  const snapping = useGridSnapping({ enabled: true, value: gridSnapValue, mode: snapMode });
  
  const lastInputTime = useRef({ mouse: 0, touch: 0 });
  const multiSelectMode = useRef(false);

  // =============================================================================
  // INPUT MODE DETECTION
  // =============================================================================

  const updateInputMode = useCallback((type) => {
    const now = Date.now();
    lastInputTime.current[type] = now;
    
    // Son 1 saniye içinde hem touch hem mouse varsa hybrid mode
    const mouseRecent = (now - lastInputTime.current.mouse) < 1000;
    const touchRecent = (now - lastInputTime.current.touch) < 1000;
    
    if (mouseRecent && touchRecent) {
      setInputMode('hybrid');
    } else if (touchRecent) {
      setInputMode('touch');
    } else {
      setInputMode('mouse');
    }
  }, []);

  // =============================================================================
  // COORDINATE HELPERS
  // =============================================================================

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

  const findNoteAtPosition = useCallback((x, y) => {
    return notes.find(note => {
      const noteRect = viewport.getNoteRect(note);
      return (x >= noteRect.x && x <= noteRect.x + noteRect.width &&
              y >= noteRect.y && y <= noteRect.y + noteRect.height);
    });
  }, [notes, viewport]);

  // =============================================================================
  // AUDIO PREVIEW SYSTEM
  // =============================================================================

  const audioContext = {
    playingNotes: new Set(),
    auditionNote: useCallback((pitch, velocity = 0.8) => {
      if (audioEngineRef.current && instrumentId) {
        if (velocity > 0) {
          audioEngineRef.current.auditionNoteOn(instrumentId, pitch, velocity);
          audioContext.playingNotes.add(pitch);
        } else {
          audioEngineRef.current.auditionNoteOff(instrumentId, pitch);
          audioContext.playingNotes.delete(pitch);
        }
      }
    }, [audioEngineRef, instrumentId]),
    
    stopAllAudition: useCallback(() => {
      audioContext.playingNotes.forEach(pitch => {
        audioContext.auditionNote(pitch, 0);
      });
      audioContext.playingNotes.clear();
    }, [])
  };

  // =============================================================================
  // MOUSE EVENT HANDLERS
  // =============================================================================

  const handleMouseDown = useCallback((e) => {
    updateInputMode('mouse');
    
    // Right click için context menu
    if (e.button === 2) {
      const gridPos = getGridPosition(e.clientX, e.clientY);
      const clickedNote = findNoteAtPosition(gridPos.x, gridPos.y);
      
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        note: clickedNote,
        position: gridPos
      });
      return;
    }

    // Middle mouse veya Alt+Left için pan
    if (e.button === 1 || e.altKey) {
      setCurrentInteraction({
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        startScrollX: containerRef.current?.scrollLeft || 0,
        startScrollY: containerRef.current?.scrollTop || 0
      });
      return;
    }

    if (e.button !== 0) return; // Sadece sol tık

    const gridPos = getGridPosition(e.clientX, e.clientY);
    if (!gridPos) return;

    const clickedNote = findNoteAtPosition(gridPos.x, gridPos.y);
    
    // Multi-select mode kontrolü
    multiSelectMode.current = e.shiftKey || e.ctrlKey || e.metaKey;

    handleToolInteraction(e, gridPos, clickedNote);
  }, [updateInputMode, getGridPosition, findNoteAtPosition, activeTool]);

  const handleToolInteraction = useCallback((e, gridPos, clickedNote) => {
    switch (activeTool) {
      case 'selection':
        handleSelectionTool(e, gridPos, clickedNote);
        break;
      case 'pencil':
        handlePencilTool(e, gridPos, clickedNote);
        break;
      case 'eraser':
        handleEraserTool(e, gridPos, clickedNote);
        break;
      default:
        console.warn('Unknown tool:', activeTool);
    }
  }, [activeTool]);

  // Selection tool logic
  const handleSelectionTool = useCallback((e, gridPos, clickedNote) => {
    if (clickedNote) {
      // Note seçimi
      if (multiSelectMode.current) {
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
      
      // Drag başlat
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
      // Marquee selection başlat
      if (!multiSelectMode.current) {
        setSelectedNotes(new Set());
      }
      setCurrentInteraction({
        type: 'marquee',
        startPos: gridPos,
        currentPos: gridPos
      });
    }
  }, [selectedNotes, setSelectedNotes, notes]);

  // Pencil tool logic
  const handlePencilTool = useCallback((e, gridPos, clickedNote) => {
    if (clickedNote) {
      // Mevcut notu seç ve drag'a hazır hale getir
      setSelectedNotes(new Set([clickedNote.id]));
      setCurrentInteraction({
        type: 'drag',
        startPos: gridPos,
        noteIds: [clickedNote.id],
        originalNotes: new Map([[clickedNote.id, { ...clickedNote }]])
      });
    } else {
      // Yeni not oluştur
      const snappedTime = snapping.snapTime(gridPos.time);
      const pitch = gridPos.pitch;
      
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

  // Eraser tool logic
  const handleEraserTool = useCallback((e, gridPos, clickedNote) => {
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
  }, [notes, selectedNotes, handleNotesChange, setSelectedNotes]);

  // =============================================================================
  // TOUCH EVENT INTEGRATION
  // =============================================================================

  const touchHandlers = useTouchHandler({
    containerRef,
    
    onZoom: useCallback((scale, center) => {
      updateInputMode('touch');
      const newZoomX = Math.max(0.25, Math.min(5, viewport.zoomX * scale));
      const newZoomY = Math.max(0.5, Math.min(3, viewport.zoomY * scale));
      // Zoom center'ı da hesaba kat
      viewport.setZoom?.(newZoomX, newZoomY, center);
    }, [updateInputMode, viewport]),
    
    onPan: useCallback((deltaX, deltaY) => {
      updateInputMode('touch');
      if (containerRef.current) {
        containerRef.current.scrollLeft -= deltaX;
        containerRef.current.scrollTop -= deltaY;
      }
    }, [updateInputMode, containerRef]),
    
    onTap: useCallback((position, type) => {
      updateInputMode('touch');
      const gridPos = getGridPosition(position.x, position.y);
      if (!gridPos) return;
      
      const tappedNote = findNoteAtPosition(gridPos.x, gridPos.y);
      
      if (type === 'single') {
        if (activeTool === 'pencil' && !tappedNote) {
          // Touch'ta yeni not oluştur
          const snappedTime = snapping.snapTime(gridPos.time);
          const newNote = {
            id: `note_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            time: snappedTime,
            pitch: gridPos.pitch,
            duration: '16n',
            velocity: 0.8
          };
          
          handleNotesChange([...notes, newNote]);
          setSelectedNotes(new Set([newNote.id]));
          audioContext.auditionNote(gridPos.pitch, 0.8);
        } else if (tappedNote) {
          // Notu seç
          setSelectedNotes(new Set([tappedNote.id]));
          audioContext.auditionNote(tappedNote.pitch, tappedNote.velocity);
        }
      } else if (type === 'double') {
        if (tappedNote) {
          // Double tap ile not sil
          handleNotesChange(notes.filter(n => n.id !== tappedNote.id));
          setSelectedNotes(prev => {
            const newSet = new Set(prev);
            newSet.delete(tappedNote.id);
            return newSet;
          });
        }
      }
    }, [updateInputMode, getGridPosition, findNoteAtPosition, activeTool, snapping, notes, handleNotesChange, setSelectedNotes, audioContext]),
    
    onLongPress: useCallback((position) => {
      updateInputMode('touch');
      const gridPos = getGridPosition(position.x, position.y);
      const longPressNote = findNoteAtPosition(gridPos.x, gridPos.y);
      
      // Context menu göster
      setContextMenu({
        x: position.x,
        y: position.y,
        note: longPressNote,
        position: gridPos,
        isTouch: true
      });
    }, [updateInputMode, getGridPosition, findNoteAtPosition]),
    
    onTwoFingerTap: useCallback((center) => {
      updateInputMode('touch');
      // İki parmakla dokun = tool değiştir
      const tools = ['selection', 'pencil', 'eraser'];
      const currentIndex = tools.indexOf(activeTool);
      const nextTool = tools[(currentIndex + 1) % tools.length];
      usePianoRollStore.getState().setActiveTool(nextTool);
    }, [updateInputMode, activeTool])
  });

  // =============================================================================
  // MOUSE MOVE VE UP HANDLERS
  // =============================================================================

  const handleMouseMove = useCallback((e) => {
    if (!currentInteraction) return;
    updateInputMode('mouse');

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
  }, [currentInteraction, updateInputMode, getGridPosition]);

  const handlePanMove = useCallback((e) => {
    const { startX, startY, startScrollX, startScrollY } = currentInteraction;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    if (containerRef.current) {
      containerRef.current.scrollLeft = startScrollX - dx;
      containerRef.current.scrollTop = startScrollY - dy;
    }
  }, [currentInteraction, containerRef]);

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

  const handleDragMove = useCallback((gridPos) => {
    const deltaTime = snapping.snapTime(gridPos.time - currentInteraction.startPos.time);
    const deltaPitch = Math.round((gridPos.y - currentInteraction.startPos.y) / gridDimensions.keyHeight);
    
    const previewNotes = currentInteraction.noteIds.map(noteId => {
      const originalNote = currentInteraction.originalNotes.get(noteId);
      if (!originalNote) return null;
      
      const newTime = Math.max(0, originalNote.time + deltaTime);
      const currentPitchIndex = coordinateConverters.pitchToIndex(originalNote.pitch);
      const newPitchIndex = Math.max(0, Math.min(127, currentPitchIndex + deltaPitch));
      const newPitch = coordinateConverters.indexToPitch(newPitchIndex);
      
      return {
        ...originalNote,
        time: newTime,
        pitch: newPitch
      };
    }).filter(Boolean);
    
    setCurrentInteraction(prev => ({ ...prev, previewNotes }));
  }, [currentInteraction, snapping, gridDimensions, coordinateConverters]);

  const handleMarqueeMove = useCallback((gridPos) => {
    setCurrentInteraction(prev => ({ ...prev, currentPos: gridPos }));
    
    // Marquee içindeki notaları seç
    const rect = {
      x: Math.min(currentInteraction.startPos.x, gridPos.x),
      y: Math.min(currentInteraction.startPos.y, gridPos.y),
      width: Math.abs(gridPos.x - currentInteraction.startPos.x),
      height: Math.abs(gridPos.y - currentInteraction.startPos.y)
    };
    
    const newSelection = new Set(
      multiSelectMode.current ? Array.from(selectedNotes) : []
    );
    
    notes.forEach(note => {
      if (viewport.isNoteInRect?.(note, rect)) {
        newSelection.add(note.id);
      } else if (!multiSelectMode.current) {
        newSelection.delete(note.id);
      }
    });
    
    setSelectedNotes(newSelection);
  }, [currentInteraction, notes, viewport, selectedNotes, setSelectedNotes]);

  const handleMouseUp = useCallback(() => {
    if (!currentInteraction) return;

    switch (currentInteraction.type) {
      case 'create':
        finishCreateNote();
        break;
      case 'drag':
        finishDragNotes();
        break;
    }
    
    audioContext.stopAllAudition();
    setCurrentInteraction(null);
    multiSelectMode.current = false;
  }, [currentInteraction, audioContext]);

  const finishCreateNote = useCallback(() => {
    const { previewNote } = currentInteraction;
    if (!previewNote || !previewNote.duration) return;
    
    const newNote = {
      ...previewNote,
      id: `note_${Date.now()}_${Math.random().toString(36).substring(7)}`
    };
    
    handleNotesChange([...notes, newNote]);
    setSelectedNotes(new Set([newNote.id]));
  }, [currentInteraction, notes, handleNotesChange, setSelectedNotes]);

  const finishDragNotes = useCallback(() => {
    const { previewNotes } = currentInteraction;
    if (!previewNotes || previewNotes.length === 0) return;
    
    const updatedNotes = notes.map(note => {
      const previewNote = previewNotes.find(p => p.id === note.id);
      return previewNote || note;
    });
    
    handleNotesChange(updatedNotes);
  }, [currentInteraction, notes, handleNotesChange]);

  // =============================================================================
  // KEYBOARD SHORTCUTS INTEGRATION
  // =============================================================================

  const keyboardShortcuts = useAdvancedKeyboardShortcuts({
    pianoRollState: { notes, selectedNotes, setSelectedNotes, handleNotesChange },
    interactions: { audioContext },
    viewport
  });

  // =============================================================================
  // EVENT LISTENERS SETUP
  // =============================================================================

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (currentInteraction) {
        handleMouseUp();
      }
    };
    
    const handleGlobalClick = (e) => {
      // Context menu'yu kapat
      if (contextMenu && !e.target.closest('.context-menu')) {
        setContextMenu(null);
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('click', handleGlobalClick);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('click', handleGlobalClick);
    };
  }, [handleMouseUp, contextMenu]);

  // =============================================================================
  // RETURN INTERFACE
  // =============================================================================

  return {
    // State
    currentInteraction,
    inputMode,
    selectedNotes,
    
    // Event handlers
    eventHandlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onContextMenu: (e) => e.preventDefault(),
      // Touch handlers are automatically attached by useTouchHandler
    },
    
    // Touch state
    touchState: touchHandlers.touchState,
    
    // Utilities
    getGridPosition,
    findNoteAtPosition,
    audioContext,
    
    // Keyboard shortcuts info
    shortcuts: keyboardShortcuts.shortcuts,
    
    // Components
    contextMenu,       // State'i dışarıya ver
    setContextMenu,    // State'i güncelleyecek fonksiyonu dışarıya ver
    
    // Debug info
    debugInfo: {
      inputMode,
      currentTool: activeTool,
      interactionType: currentInteraction?.type,
      touchGesture: touchHandlers.gestureType,
      selectedCount: selectedNotes.size
    }
  };
};