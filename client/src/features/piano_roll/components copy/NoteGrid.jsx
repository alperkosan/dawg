import React, { useMemo, useRef, useEffect } from 'react';
import { useCanvas } from '../hooks/useCanvas';
import { renderGrid, renderPlayhead } from '../utils/renderUtils';
import Note from './Note';

const NoteGrid = ({
  notes,
  selectedNotes,
  viewport,
  scale,
  tool,
  snapSettings,
  interactions,
  playbackState
}) => {
  const canvasRef = useRef(null);
  
  // Optimized note filtering for viewport
  const visibleNotes = useMemo(() => {
    return notes.filter(note => {
      const noteRect = viewport.getNoteRect(note);
      return viewport.isRectVisible(noteRect);
    });
  }, [notes, viewport]);
  
  // Canvas rendering for grid lines and background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = viewport.gridWidth * dpr;
    canvas.height = viewport.gridHeight * dpr;
    canvas.style.width = `${viewport.gridWidth}px`;
    canvas.style.height = `${viewport.gridHeight}px`;
    
    ctx.scale(dpr, dpr);
    
    // Render grid
    renderGrid(ctx, {
      width: viewport.gridWidth,
      height: viewport.gridHeight,
      stepWidth: viewport.stepWidth,
      keyHeight: viewport.keyHeight,
      scale,
      snapSettings
    });
    
  }, [viewport, scale, snapSettings]);
  
  return (
    <div 
      className="relative w-full h-full bg-gray-900"
      style={{
        width: viewport.gridWidth,
        height: viewport.gridHeight
      }}
    >
      {/* Background grid canvas */}
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />
      
      {/* Notes */}
      {visibleNotes.map(note => (
        <Note
          key={note.id}
          note={note}
          isSelected={selectedNotes.has(note.id)}
          viewport={viewport}
          tool={tool}
          onInteraction={interactions.onNoteInteraction}
        />
      ))}
      
      {/* Preview notes during drag operations */}
      {interactions.previewNotes?.map(note => (
        <Note
          key={`preview-${note.id}`}
          note={note}
          isPreview={true}
          viewport={viewport}
          tool={tool}
        />
      ))}
      
      {/* Selection rectangle */}
      {interactions.selectionRect && (
        <div
          className="absolute border-2 border-dashed border-blue-400 bg-blue-400/20 pointer-events-none"
          style={interactions.selectionRect}
        />
      )}
      
      {/* Playhead */}
      {playbackState.isPlaying && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 pointer-events-none z-20"
          style={{
            left: viewport.timeToX(playbackState.position)
          }}
        />
      )}
    </div>
  );
};

export default NoteGrid;