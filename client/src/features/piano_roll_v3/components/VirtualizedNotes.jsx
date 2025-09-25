/**
 * @file VirtualizedNotes.jsx
 * @description High performance virtualized note rendering with interaction support
 */
import React, { memo, useMemo, useCallback, useRef, useState } from 'react';
import { LOD_LEVELS } from '../store/usePianoRollV3Store';

// Single note component with optimizations
const Note = memo(({
  note,
  x,
  y,
  width,
  height,
  isSelected,
  isGhost,
  lodLevel,
  onMouseDown,
  onDoubleClick,
  onResizeStart,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // LOD-based appearance
  const showVelocity = lodLevel === LOD_LEVELS.DETAILED || lodLevel === LOD_LEVELS.ULTRA_DETAILED;
  const showResizeHandles = !isGhost && (lodLevel === LOD_LEVELS.NORMAL || 
                                          lodLevel === LOD_LEVELS.DETAILED || 
                                          lodLevel === LOD_LEVELS.ULTRA_DETAILED);

  const noteStyle = useMemo(() => ({
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
    backgroundColor: isGhost ? 'rgba(100, 150, 255, 0.3)' :
                     isSelected ? '#4a9eff' :
                     isHovered ? '#6ab7ff' : '#5e92cc',
    border: `1px solid ${isSelected ? '#fff' : 'rgba(0,0,0,0.3)'}`,
    borderRadius: '2px',
    cursor: isGhost ? 'crosshair' : 'move',
    opacity: isGhost ? 0.6 : (note.velocity / 127),
    transition: isGhost ? 'none' : 'background-color 0.1s ease',
    pointerEvents: isGhost ? 'none' : 'auto',
    userSelect: 'none',
    boxShadow: isSelected ? '0 0 8px rgba(74, 158, 255, 0.5)' : 
               isHovered ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
  }), [x, y, width, height, isGhost, isSelected, isHovered, note.velocity]);

  const handleMouseEnter = useCallback(() => {
    if (!isGhost) setIsHovered(true);
  }, [isGhost]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleResizeLeft = useCallback((e) => {
    e.stopPropagation();
    onResizeStart?.(note.id, 'left', e);
  }, [note.id, onResizeStart]);

  const handleResizeRight = useCallback((e) => {
    e.stopPropagation();
    onResizeStart?.(note.id, 'right', e);
  }, [note.id, onResizeStart]);

  return (
    <div
      className="piano-roll-v3__note"
      style={noteStyle}
      onMouseDown={(e) => onMouseDown?.(note, e)}
      onDoubleClick={(e) => onDoubleClick?.(note, e)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-note-id={note.id}
    >
      {/* Velocity bar */}
      {showVelocity && !isGhost && (
        <div
          className="piano-roll-v3__note-velocity"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${(note.velocity / 127) * 100}%`,
            backgroundColor: 'rgba(255,255,255,0.2)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Resize handles */}
      {showResizeHandles && isHovered && (
        <>
          <div
            className="piano-roll-v3__note-resize-left"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '4px',
              cursor: 'ew-resize',
              backgroundColor: 'rgba(255,255,255,0.3)',
            }}
            onMouseDown={handleResizeLeft}
          />
          <div
            className="piano-roll-v3__note-resize-right"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '4px',
              cursor: 'ew-resize',
              backgroundColor: 'rgba(255,255,255,0.3)',
            }}
            onMouseDown={handleResizeRight}
          />
        </>
      )}

      {/* Note label (ultra detailed mode) */}
      {lodLevel === LOD_LEVELS.ULTRA_DETAILED && !isGhost && (
        <div
          className="piano-roll-v3__note-label"
          style={{
            position: 'absolute',
            left: '4px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '10px',
            color: '#fff',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 'calc(100% - 8px)',
          }}
        >
          {note.pitch} • {note.velocity}
        </div>
      )}
    </div>
  );
});

Note.displayName = 'Note';

// Main virtualized notes container
const VirtualizedNotes = memo(({ 
  engine, 
  onNoteClick,
  onNoteDoubleClick,
  onNoteDrag,
  onNoteResize,
  onSelectionBox,
}) => {
  const containerRef = useRef(null);
  const dragStateRef = useRef({
    isDragging: false,
    dragType: null, // 'move' | 'resize' | 'selection'
    startX: 0,
    startY: 0,
    noteId: null,
    resizeDirection: null,
    originalNote: null,
  });

  const { 
    notes, 
    selectedIds, 
    ghostNote,
    selectionBox,
    getVisibleNotes,
    selectNote,
    deselectNote,
    clearSelection,
    setGhostNote,
    setSelectionBox,
    startDragging,
    stopDragging,
  } = engine.store;

  const { viewport, grid, performance, coordUtils } = engine;

  // Get visible notes
  const visibleNotes = useMemo(() => {
    return getVisibleNotes();
  }, [getVisibleNotes, notes.renderVersion]);

  // === Mouse Interaction Handlers ===
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // Only left click

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const gridCoords = coordUtils.mouseToGrid(localX, localY);

    // Check if clicking on a note
    const clickedNote = visibleNotes.find(note => {
      const noteX = coordUtils.stepToPx(note.step) - viewport.scrollX;
      const noteY = coordUtils.keyToPx(note.key) - viewport.scrollY;
      const noteWidth = note.duration * grid.stepWidth;
      const noteHeight = grid.keyHeight;

      return localX >= noteX && localX <= noteX + noteWidth &&
             localY >= noteY && localY <= noteY + noteHeight;
    });

    if (clickedNote) {
      // Note interaction
      dragStateRef.current = {
        isDragging: true,
        dragType: 'move',
        startX: localX,
        startY: localY,
        noteId: clickedNote.id,
        originalNote: { ...clickedNote },
      };

      // Selection logic
      if (e.ctrlKey || e.metaKey) {
        if (selectedIds.has(clickedNote.id)) {
          deselectNote(clickedNote.id);
        } else {
          selectNote(clickedNote.id, true);
        }
      } else if (!selectedIds.has(clickedNote.id)) {
        selectNote(clickedNote.id, false);
      }

      onNoteClick?.(clickedNote, e);
    } else {
      // Start selection box
      dragStateRef.current = {
        isDragging: true,
        dragType: 'selection',
        startX: localX,
        startY: localY,
      };

      if (!e.shiftKey) {
        clearSelection();
      }

      startDragging(localX, localY);
    }
  }, [visibleNotes, viewport, grid, coordUtils, selectedIds, 
      selectNote, deselectNote, clearSelection, startDragging, onNoteClick]);

  const handleMouseMove = useCallback((e) => {
    const dragState = dragStateRef.current;
    if (!dragState.isDragging) {
      // Preview ghost note for drawing
      if (engine.store.ui.selectedTool === 'pencil') {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const localX = e.clientX - rect.left;
          const localY = e.clientY - rect.top;
          const gridCoords = coordUtils.mouseToGrid(localX, localY);
          
          setGhostNote({
            step: gridCoords.step,
            key: gridCoords.key,
            duration: grid.snapMode,
            velocity: 100,
          });
        }
      }
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const deltaX = localX - dragState.startX;
    const deltaY = localY - dragState.startY;

    if (dragState.dragType === 'move') {
      // Move note(s)
      const stepDelta = Math.round(deltaX / grid.stepWidth);
      const keyDelta = Math.round(deltaY / grid.keyHeight);

      if (stepDelta !== 0 || keyDelta !== 0) {
        const notesToMove = selectedIds.has(dragState.noteId) 
          ? [...selectedIds] 
          : [dragState.noteId];

        onNoteDrag?.(notesToMove, stepDelta, keyDelta);
      }
    } else if (dragState.dragType === 'resize') {
      // Resize note
      const stepDelta = Math.round(deltaX / grid.stepWidth);
      
      if (dragState.resizeDirection === 'left') {
        onNoteResize?.(dragState.noteId, -stepDelta, stepDelta);
      } else {
        onNoteResize?.(dragState.noteId, 0, stepDelta);
      }
    } else if (dragState.dragType === 'selection') {
      // Update selection box
      const box = {
        x: Math.min(dragState.startX, localX),
        y: Math.min(dragState.startY, localY),
        width: Math.abs(localX - dragState.startX),
        height: Math.abs(localY - dragState.startY),
      };
      
      setSelectionBox(box);
      onSelectionBox?.(box);
    }
  }, [engine.store.ui.selectedTool, grid, viewport, coordUtils, 
      selectedIds, setGhostNote, setSelectionBox, onNoteDrag, onNoteResize, onSelectionBox]);

  const handleMouseUp = useCallback(() => {
    const dragState = dragStateRef.current;
    
    if (dragState.isDragging) {
      if (dragState.dragType === 'selection') {
        // Finalize selection
        const box = selectionBox;
        if (box) {
          // Select notes within box
          const notesInBox = visibleNotes.filter(note => {
            const noteX = coordUtils.stepToPx(note.step) - viewport.scrollX;
            const noteY = coordUtils.keyToPx(note.key) - viewport.scrollY;
            const noteWidth = note.duration * grid.stepWidth;
            const noteHeight = grid.keyHeight;

            return noteX < box.x + box.width &&
                   noteX + noteWidth > box.x &&
                   noteY < box.y + box.height &&
                   noteY + noteHeight > box.y;
          });

          notesInBox.forEach(note => selectNote(note.id, true));
        }
      }

      dragStateRef.current = {
        isDragging: false,
        dragType: null,
        startX: 0,
        startY: 0,
        noteId: null,
        resizeDirection: null,
        originalNote: null,
      };

      stopDragging();
      setSelectionBox(null);
    }
  }, [visibleNotes, selectionBox, viewport, grid, coordUtils, 
      selectNote, stopDragging, setSelectionBox]);

  const handleNoteResize = useCallback((noteId, direction, e) => {
    e.stopPropagation();
    
    const note = notes.byId[noteId];
    if (!note) return;

    dragStateRef.current = {
      isDragging: true,
      dragType: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      noteId,
      resizeDirection: direction,
      originalNote: { ...note },
    };
  }, [notes.byId]);

  // Global mouse event listeners
  React.useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Render notes based on LOD
  const renderedNotes = useMemo(() => {
    const lodLevel = performance.lodLevel;
    
    // Skip rendering in ultra simplified mode
    if (lodLevel === LOD_LEVELS.ULTRA_SIMPLIFIED) {
      return [];
    }

    // Reduce detail for simplified mode
    if (lodLevel === LOD_LEVELS.SIMPLIFIED) {
      // Only render every nth note for performance
      return visibleNotes.filter((_, index) => index % 2 === 0);
    }

    return visibleNotes;
  }, [visibleNotes, performance.lodLevel]);

  return (
    <div
      ref={containerRef}
      className="piano-roll-v3__notes-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'auto',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Render notes */}
      {renderedNotes.map(note => (
        <Note
          key={note.id}
          note={note}
          x={coordUtils.stepToPx(note.step) - viewport.scrollX}
          y={coordUtils.keyToPx(note.key) - viewport.scrollY}
          width={note.duration * grid.stepWidth}
          height={grid.keyHeight - 1}
          isSelected={selectedIds.has(note.id)}
          isGhost={false}
          lodLevel={performance.lodLevel}
          onMouseDown={(note, e) => handleMouseDown(e)}
          onDoubleClick={onNoteDoubleClick}
          onResizeStart={handleNoteResize}
        />
      ))}

      {/* Ghost note preview */}
      {ghostNote && (
        <Note
          note={ghostNote}
          x={coordUtils.stepToPx(ghostNote.step) - viewport.scrollX}
          y={coordUtils.keyToPx(ghostNote.key) - viewport.scrollY}
          width={ghostNote.duration * grid.stepWidth}
          height={grid.keyHeight - 1}
          isSelected={false}
          isGhost={true}
          lodLevel={performance.lodLevel}
        />
      )}

      {/* Selection box */}
      {selectionBox && (
        <div
          className="piano-roll-v3__selection-box"
          style={{
            position: 'absolute',
            left: selectionBox.x,
            top: selectionBox.y,
            width: selectionBox.width,
            height: selectionBox.height,
            border: '1px solid #4a9eff',
            backgroundColor: 'rgba(74, 158, 255, 0.2)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Performance overlay (debug mode) */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            padding: '4px 8px',
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: '#0f0',
            fontSize: '10px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            borderRadius: '2px',
          }}
        >
          Notes: {renderedNotes.length}/{visibleNotes.length}
        </div>
      )}
    </div>
  );
});

VirtualizedNotes.displayName = 'VirtualizedNotes';

export default VirtualizedNotes;