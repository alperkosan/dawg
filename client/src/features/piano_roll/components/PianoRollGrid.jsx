// Enhanced PianoRollGrid.jsx - Optimized rendering and interactions
import React, { useEffect, useRef, useMemo, useCallback, memo } from 'react';
import * as Tone from 'tone';
import Note from './Note';
import { usePianoRollStore } from '../store/usePianoRollStore';

const PianoRollGrid = memo(({
  notes,
  selectedNotes,
  viewport,
  gridDimensions,
  coordinateConverters,
  interaction,
  playbackState,
  playheadRef,
  scale,
  onResizeStart
}) => {
  const canvasRef = useRef(null);
  const lastRenderHash = useRef('');
  
  // Store state
  const { showScaleHighlighting } = usePianoRollStore();

  // ✅ VIEWPORT CALCULATION - Only render visible area
  const visibleBounds = useMemo(() => {
    const container = canvasRef.current?.parentElement?.parentElement;
    if (!container) {
      return { 
        left: 0, 
        right: gridDimensions.gridWidth,
        top: 0,
        bottom: gridDimensions.gridHeight 
      };
    }
    
    const margin = Math.max(gridDimensions.keyHeight * 3, gridDimensions.stepWidth * 16);
    
    return {
      left: Math.max(0, container.scrollLeft - margin),
      right: Math.min(gridDimensions.gridWidth, container.scrollLeft + container.clientWidth + margin),
      top: Math.max(0, container.scrollTop - margin),
      bottom: Math.min(gridDimensions.gridHeight, container.scrollTop + container.clientHeight + margin)
    };
  }, [gridDimensions, viewport]);

  // ✅ SCALE NOTES CALCULATION
  const scaleNoteSet = useMemo(() => {
    if (!showScaleHighlighting || !scale?.getScaleNotes) return new Set();
    return scale.getScaleNotes();
  }, [scale, showScaleHighlighting]);

  // ✅ VISIBLE NOTES - Performance optimization
  const visibleNotes = useMemo(() => {
    if (!notes || notes.length === 0) return [];
    
    return notes.filter(note => {
      const noteX = coordinateConverters.stepToX(note.time);
      const noteY = coordinateConverters.noteToY(note.pitch);
      
      // Calculate note width
      let noteWidth;
      try {
        const durationInSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
        noteWidth = durationInSteps * gridDimensions.stepWidth;
      } catch {
        noteWidth = gridDimensions.stepWidth;
      }
      
      // Visibility check
      const isHorizontallyVisible = 
        noteX + noteWidth >= visibleBounds.left &&
        noteX <= visibleBounds.right;
        
      const isVerticallyVisible = 
        noteY + gridDimensions.keyHeight >= visibleBounds.top &&
        noteY <= visibleBounds.bottom;
      
      return isHorizontallyVisible && isVerticallyVisible;
    });
  }, [notes, visibleBounds, coordinateConverters, gridDimensions]);

  // ✅ OPTIMIZED GRID DRAWING
  const drawOptimizedGrid = useCallback((ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    
    const { stepWidth, keyHeight } = gridDimensions;
    
    // Calculate visible grid range
    const startBar = Math.max(0, Math.floor(visibleBounds.left / (stepWidth * 16)) - 1);
    const endBar = Math.min(
      Math.ceil(width / (stepWidth * 16)), 
      Math.ceil(visibleBounds.right / (stepWidth * 16)) + 1
    );
    
    const startKey = Math.max(0, Math.floor(visibleBounds.top / keyHeight) - 2);
    const endKey = Math.min(
      Math.floor(height / keyHeight),
      Math.ceil(visibleBounds.bottom / keyHeight) + 2
    );

    // 1. Scale highlighting
    if (showScaleHighlighting && scaleNoteSet.size > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      
      for (let i = startKey; i < endKey; i++) {
        const noteIndex = (Math.floor(height / keyHeight) - 1 - i) % 12;
        if (!scaleNoteSet.has(noteIndex)) {
          const y = i * keyHeight;
          ctx.fillRect(0, y, width, keyHeight);
        }
      }
    }

    // 2. Vertical grid lines
    ctx.lineWidth = 1;
    
    for (let bar = startBar; bar <= endBar; bar++) {
      const x = bar * stepWidth * 16;
      
      // Bar lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      
      // Beat lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      for (let beat = 1; beat < 4; beat++) {
        const beatX = x + beat * stepWidth * 4;
        if (beatX <= width) {
          ctx.beginPath();
          ctx.moveTo(beatX, 0);
          ctx.lineTo(beatX, height);
          ctx.stroke();
        }
      }
      
      // Subdivision lines (if zoomed in enough)
      if (stepWidth > 20) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        for (let step = 1; step < 16; step++) {
          if (step % 4 !== 0) {
            const stepX = x + step * stepWidth;
            if (stepX <= width) {
              ctx.beginPath();
              ctx.moveTo(stepX, 0);
              ctx.lineTo(stepX, height);
              ctx.stroke();
            }
          }
        }
      }
    }

    // 3. Horizontal lines (octave markers)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 0.5;
    
    for (let octave = 0; octave < 8; octave++) {
      const y = octave * 12 * keyHeight;
      if (y >= visibleBounds.top && y <= visibleBounds.bottom) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // 4. C note highlighting
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    for (let key = startKey; key < endKey; key++) {
      const noteIndex = (Math.floor(height / keyHeight) - 1 - key) % 12;
      if (noteIndex === 0) { // C note
        const y = key * keyHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
  }, [gridDimensions, visibleBounds, showScaleHighlighting, scaleNoteSet]);

  // ✅ RENDER HASH - Prevent unnecessary re-renders
  const renderHash = useMemo(() => {
    return JSON.stringify({
      bounds: `${visibleBounds.left}-${visibleBounds.top}-${visibleBounds.right}-${visibleBounds.bottom}`,
      grid: `${gridDimensions.gridWidth}-${gridDimensions.gridHeight}`,
      step: `${gridDimensions.stepWidth}-${gridDimensions.keyHeight}`,
      scale: showScaleHighlighting ? `${scale?.root}-${scale?.type}` : 'none',
      scaleNotes: Array.from(scaleNoteSet).join(',')
    });
  }, [visibleBounds, gridDimensions, scale, showScaleHighlighting, scaleNoteSet]);

  // ✅ CANVAS RENDERING EFFECT
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Skip if nothing changed
    if (lastRenderHash.current === renderHash) return;
    
    const ctx = canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true
    });
    
    // Limit DPR for performance
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    
    // Set canvas dimensions
    canvas.width = gridDimensions.gridWidth * dpr;
    canvas.height = gridDimensions.gridHeight * dpr;
    canvas.style.width = `${gridDimensions.gridWidth}px`;
    canvas.style.height = `${gridDimensions.gridHeight}px`;
    
    ctx.scale(dpr, dpr);
    
    // Draw grid
    drawOptimizedGrid(ctx, gridDimensions.gridWidth, gridDimensions.gridHeight);
    
    // Update hash
    lastRenderHash.current = renderHash;
    
  }, [renderHash, gridDimensions, drawOptimizedGrid]);

  // ✅ INTERACTION PREVIEW COMPONENTS
  const renderInteractionPreviews = () => {
    const previews = [];
    
    if (interaction?.type === 'create' && interaction.previewNote) {
      previews.push(
        <Note
          key="preview-creating"
          note={interaction.previewNote}
          isPreview={true}
          viewport={viewport}
          coordinateConverters={coordinateConverters}
          gridDimensions={gridDimensions}
        />
      );
    }
    
    if (interaction?.previewNotes) {
      interaction.previewNotes.forEach(note => {
        previews.push(
          <Note
            key={`preview-${note.id}`}
            note={note}
            isPreview={true}
            viewport={viewport}
            coordinateConverters={coordinateConverters}
            gridDimensions={gridDimensions}
          />
        );
      });
    }
    
    return previews;
  };

  // ✅ MARQUEE SELECTION RECTANGLE
  const renderMarqueeSelection = () => {
    if (interaction?.type !== 'marquee') return null;
    
    const { startPos, currentPos } = interaction;
    
    return (
      <div
        className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/10 pointer-events-none z-40"
        style={{
          left: Math.min(startPos.x, currentPos.x),
          top: Math.min(startPos.y, currentPos.y),
          width: Math.abs(currentPos.x - startPos.x),
          height: Math.abs(currentPos.y - startPos.y),
          borderRadius: '4px'
        }}
      />
    );
  };

  // ✅ PLAYHEAD COMPONENT
  const renderPlayhead = () => {
    if (!playbackState?.isPlaying) return null;
    
    return (
      <div 
        ref={playheadRef} 
        className="absolute top-0 bottom-0 w-0.5 z-30 pointer-events-none bg-cyan-400 shadow-lg shadow-cyan-400/50"
        style={{ 
          transform: 'translateZ(0)',
          filter: 'drop-shadow(0 0 4px rgba(0, 188, 212, 0.8))'
        }}
      />
    );
  };

  return (
    <div 
      className="relative bg-gray-900" 
      style={{ 
        width: gridDimensions.gridWidth, 
        height: gridDimensions.gridHeight,
        contain: 'layout style paint'
      }}
    >
      {/* BACKGROUND GRID CANVAS */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 pointer-events-none z-0"
        style={{ 
          imageRendering: 'pixelated',
          transform: 'translateZ(0)',
          contain: 'strict'
        }}
      />
      
      {/* VISIBLE NOTES */}
      {visibleNotes.map((note) => (
        <Note
          key={note.id}
          note={note}
          isSelected={selectedNotes.has(note.id)}
          viewport={viewport}
          coordinateConverters={coordinateConverters}
          gridDimensions={gridDimensions}
          onResizeStart={onResizeStart}
        />
      ))}
      
      {/* INTERACTION PREVIEWS */}
      {renderInteractionPreviews()}
      
      {/* MARQUEE SELECTION */}
      {renderMarqueeSelection()}
      
      {/* PLAYHEAD */}
      {renderPlayhead()}
      
      {/* RESIZE PREVIEW */}
      {interaction?.type === 'resize' && (
        <div className="absolute top-4 left-4 bg-gray-800/90 text-white px-3 py-1 rounded-lg text-sm z-50">
          Duration: {Math.round(interaction.previewDuration || 1)} steps
        </div>
      )}
    </div>
  );
});

PianoRollGrid.displayName = 'PianoRollGrid';

export default PianoRollGrid;