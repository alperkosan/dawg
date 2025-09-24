import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { usePianoRoll } from '../../hooks/usePianoRoll';

export const PianoRollCanvas = ({ instrumentId, width = 800, height = 400 }) => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [mouseState, setMouseState] = useState({ 
    isDown: false, 
    tool: 'select',
    currentPos: { x: 0, y: 0 }
  });
  const [dragStart, setDragStart] = useState(null);

  const {
    notes,
    selectedNotes,
    isRecording,
    isPlaying,
    gridSnap,
    zoomLevel,
    viewPort,
    addNote,
    deleteNote,
    updateNote,
    selectNotes,
    clearSelection,
    previewNote,
    currentStep,
    bpm,
    calculateNotePosition,
    getMidiFromY,
    getTimeFromX
  } = usePianoRoll(instrumentId);

  // Memoized drawing settings
  const drawingSettings = useMemo(() => ({
    noteHeight: 12,
    stepWidth: 20 * zoomLevel,
    backgroundColor: '#1a1a1a',
    gridColor: '#333',
    beatGridColor: '#555',
    noteColor: '#4a9eff',
    selectedNoteColor: '#ff6b35',
    playheadColor: '#ff0000'
  }), [zoomLevel]);

  // =================== DRAWING FUNCTIONS ===================

  const drawGrid = useCallback((ctx) => {
    const { stepWidth, noteHeight, gridColor, beatGridColor } = drawingSettings;
    
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Vertical grid lines (time)
    const startStep = Math.floor(viewPort.scrollX / stepWidth);
    const endStep = Math.ceil((viewPort.scrollX + width) / stepWidth);

    for (let step = startStep; step <= endStep; step++) {
      const x = step * stepWidth - viewPort.scrollX;
      
      // Beat lines (stronger every 4 steps)
      if (step % 4 === 0) {
        ctx.strokeStyle = beatGridColor;
        ctx.lineWidth = step % 16 === 0 ? 3 : 2; // Bar lines even stronger
      } else {
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
      }
      
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines (pitch)
    const startNote = Math.floor(viewPort.scrollY / noteHeight);
    const endNote = Math.ceil((viewPort.scrollY + height) / noteHeight);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    for (let noteIndex = startNote; noteIndex <= endNote; noteIndex++) {
      const y = noteIndex * noteHeight - viewPort.scrollY;
      const midiNote = 127 - noteIndex;
      
      // White key lines (stronger)
      const noteInOctave = midiNote % 12;
      const isWhiteKey = [0, 2, 4, 5, 7, 9, 11].includes(noteInOctave);
      
      ctx.strokeStyle = isWhiteKey ? '#444' : '#2a2a2a';
      ctx.lineWidth = noteInOctave === 0 ? 2 : 1; // C note lines stronger
      
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }, [drawingSettings, viewPort, width, height]);

  const drawNotes = useCallback((ctx) => {
    const { noteColor, selectedNoteColor } = drawingSettings;
    
    notes.forEach(note => {
      const pos = calculateNotePosition(note);
      
      // Skip if note is outside viewport
      if (pos.x + pos.width < 0 || pos.x > width || 
          pos.y + pos.height < 0 || pos.y > height) {
        return;
      }

      const isSelected = selectedNotes.has(note.id);
      const velocity = note.velocity || 0.8;

      // Note styling
      if (isSelected) {
        ctx.fillStyle = selectedNoteColor;
        ctx.strokeStyle = '#ff4500';
      } else {
        // Color based on velocity
        const intensity = Math.floor(velocity * 255);
        ctx.fillStyle = `rgba(74, 158, 255, ${velocity})`;
        ctx.strokeStyle = '#2980b9';
      }

      ctx.lineWidth = 1;

      // Draw note body
      ctx.fillRect(pos.x, pos.y, pos.width, pos.height);
      ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);

      // Draw note name (when zoomed in enough)
      if (zoomLevel > 1.5 && pos.width > 30) {
        ctx.fillStyle = isSelected ? '#fff' : '#000';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(note.pitch, pos.x + 2, pos.y + 9);
      }

      // Velocity indicator (small bar on left edge)
      if (pos.width > 10) {
        ctx.fillStyle = `rgba(255, 255, 255, ${velocity * 0.5})`;
        ctx.fillRect(pos.x, pos.y, 2, pos.height);
      }
    });
  }, [notes, selectedNotes, calculateNotePosition, drawingSettings, zoomLevel, width, height]);

  const drawPlayhead = useCallback((ctx) => {
    if (!isPlaying || currentStep === undefined) return;
    
    const x = (currentStep * drawingSettings.stepWidth) - viewPort.scrollX;
    
    if (x >= 0 && x <= width) {
      ctx.strokeStyle = drawingSettings.playheadColor;
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      
      // Playhead triangle at top
      ctx.fillStyle = drawingSettings.playheadColor;
      ctx.beginPath();
      ctx.moveTo(x - 5, 0);
      ctx.lineTo(x + 5, 0);
      ctx.lineTo(x, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [isPlaying, currentStep, drawingSettings, viewPort.scrollX, width, height]);

  const drawSelectionRect = useCallback((ctx) => {
    if (!dragStart || !mouseState.currentPos || dragStart.type !== 'select') return;

    const x = Math.min(dragStart.x, mouseState.currentPos.x);
    const y = Math.min(dragStart.y, mouseState.currentPos.y);
    const w = Math.abs(mouseState.currentPos.x - dragStart.x);
    const h = Math.abs(mouseState.currentPos.y - dragStart.y);

    // Selection rectangle
    ctx.strokeStyle = '#00ff00';
    ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }, [dragStart, mouseState.currentPos]);

  const drawRecordingIndicator = useCallback((ctx) => {
    if (!isRecording) return;
    
    // Blinking red circle in top-right
    const time = Date.now() / 500;
    const alpha = (Math.sin(time) + 1) / 2;
    
    ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
    ctx.beginPath();
    ctx.arc(width - 20, 20, 8, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('REC', width - 35, 25);
  }, [isRecording, width]);

  // =================== MAIN DRAW FUNCTION ===================

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.fillStyle = drawingSettings.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    drawGrid(ctx);

    // Draw notes
    drawNotes(ctx);

    // Draw playhead
    drawPlayhead(ctx);

    // Draw selection rectangle
    drawSelectionRect(ctx);

    // Draw recording indicator
    drawRecordingIndicator(ctx);

    // Draw zoom indicator
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(zoomLevel * 100)}%`, 10, height - 10);
  }, [
    drawingSettings, 
    width, 
    height, 
    drawGrid, 
    drawNotes, 
    drawPlayhead, 
    drawSelectionRect, 
    drawRecordingIndicator,
    zoomLevel
  ]);

  // =================== MOUSE EVENTS ===================

  const getNoteAtPosition = useCallback((x, y) => {
    return notes.find(note => {
      const pos = calculateNotePosition(note);
      return x >= pos.x && x <= pos.x + pos.width &&
             y >= pos.y && y <= pos.y + pos.height;
    });
  }, [notes, calculateNotePosition]);

  const handleMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMouseState(prev => ({ 
      ...prev, 
      isDown: true, 
      currentPos: { x, y } 
    }));

    const clickedNote = getNoteAtPosition(x, y);
    
    if (clickedNote) {
      // Note selection
      if (e.ctrlKey || e.metaKey) {
        const newSelection = new Set(selectedNotes);
        if (newSelection.has(clickedNote.id)) {
          newSelection.delete(clickedNote.id);
        } else {
          newSelection.add(clickedNote.id);
        }
        selectNotes([...newSelection]);
      } else if (!selectedNotes.has(clickedNote.id)) {
        selectNotes([clickedNote.id]);
      }

      setDragStart({ x, y, type: 'move', noteIds: [...selectedNotes] });
      previewNote(clickedNote.pitch, clickedNote.velocity);
    } else {
      // Add new note or start selection
      if (e.altKey || mouseState.tool === 'draw') {
        const time = getTimeFromX(x);
        const pitch = getMidiFromY(y);
        
        if (pitch >= 0 && pitch <= 127) {
          addNote({
            time: Math.max(0, time),
            pitch,
            velocity: 0.8,
            duration: '16n'
          });
        }
      } else {
        setDragStart({ x, y, type: 'select' });
        clearSelection();
      }
    }
  }, [
    selectedNotes, 
    mouseState.tool, 
    getNoteAtPosition, 
    selectNotes, 
    previewNote, 
    clearSelection, 
    addNote, 
    getTimeFromX, 
    getMidiFromY
  ]);

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMouseState(prev => ({ ...prev, currentPos: { x, y } }));

    if (!mouseState.isDown || !dragStart) return;

    if (dragStart.type === 'move' && dragStart.noteIds) {
      // Move notes (implement note dragging logic here)
      const deltaX = x - dragStart.x;
      const deltaTime = deltaX / drawingSettings.stepWidth;
      
      // Update notes with new positions
      // This would need debouncing for performance
    }
  }, [mouseState.isDown, dragStart, drawingSettings.stepWidth]);

  const handleMouseUp = useCallback(() => {
    if (dragStart && dragStart.type === 'select' && mouseState.currentPos) {
      // Select notes in rectangle
      const selectionRect = {
        x: Math.min(dragStart.x, mouseState.currentPos.x),
        y: Math.min(dragStart.y, mouseState.currentPos.y),
        width: Math.abs(mouseState.currentPos.x - dragStart.x),
        height: Math.abs(mouseState.currentPos.y - dragStart.y)
      };

      const notesInSelection = notes.filter(note => {
        const pos = calculateNotePosition(note);
        return pos.x < selectionRect.x + selectionRect.width &&
               pos.x + pos.width > selectionRect.x &&
               pos.y < selectionRect.y + selectionRect.height &&
               pos.y + pos.height > selectionRect.y;
      });

      selectNotes(notesInSelection.map(note => note.id));
    }

    setMouseState(prev => ({ ...prev, isDown: false }));
    setDragStart(null);
  }, [dragStart, mouseState.currentPos, notes, calculateNotePosition, selectNotes]);

  const handleDoubleClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedNote = getNoteAtPosition(x, y);
    if (clickedNote) {
      deleteNote(clickedNote.id);
    }
  }, [getNoteAtPosition, deleteNote]);

  // =================== EFFECTS ===================

  useEffect(() => {
    const animate = () => {
      draw();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('dblclick', handleDoubleClick);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ 
        cursor: mouseState.tool === 'draw' ? 'crosshair' : 'default',
        display: 'block',
        backgroundColor: drawingSettings.backgroundColor
      }}
    />
  );
};

export default PianoRollCanvas;
