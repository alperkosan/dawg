// client/src/features/piano_roll/components/PianoRollGrid.jsx - Optimized version
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

  // ✅ PERFORMANS: Sadece görünür alanı hesapla
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

    // Margin ekleyerek smooth scrolling sağla
    const margin = Math.max(gridDimensions.keyHeight * 2, gridDimensions.stepWidth * 8);

    return {
      left: Math.max(0, container.scrollLeft - margin),
      right: Math.min(gridDimensions.gridWidth, container.scrollLeft + container.clientWidth + margin),
      top: Math.max(0, container.scrollTop - margin),
      bottom: Math.min(gridDimensions.gridHeight, container.scrollTop + container.clientHeight + margin)
    };
  }, [gridDimensions]);

  // ✅ SCALE NOTES - Sadece gerektiğinde hesapla
  const scaleNoteSet = useMemo(() => {
    if (!showScaleHighlighting || !scale?.getScaleNotes) return new Set();
    return scale.getScaleNotes();
  }, [scale, showScaleHighlighting]);

  // ✅ VISIBLE NOTES - Performans optimizasyonu
  const visibleNotes = useMemo(() => {
    if (!notes || notes.length === 0) return [];

    return notes.filter(note => {
      const noteX = coordinateConverters.stepToX(note.time);
      const noteY = coordinateConverters.noteToY(note.pitch);

      // Not genişliğini hesapla
      let noteWidth;
      try {
        const durationInSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
        noteWidth = durationInSteps * gridDimensions.stepWidth;
      } catch {
        noteWidth = gridDimensions.stepWidth;
      }

      // Görünürlük kontrolü
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

    // Sadece görünür alanı çiz
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

    // 1. Scale highlighting - Sadece görünür alan
    if (showScaleHighlighting && scaleNoteSet.size > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';

      for (let i = startKey; i < endKey; i++) {
        const noteIndex = (Math.floor(height / keyHeight) - 1 - i) % 12;
        if (!scaleNoteSet.has(noteIndex)) {
          const y = i * keyHeight;
          ctx.fillRect(visibleBounds.left, y, visibleBounds.right - visibleBounds.left, keyHeight);
        }
      }
    }

    // 2. Vertical grid lines - Sadece görünür barlar
    ctx.lineWidth = 1;

    for (let bar = startBar; bar <= endBar; bar++) {
      const x = bar * stepWidth * 16;

      // Bar lines (kalın)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(x, visibleBounds.top);
      ctx.lineTo(x, visibleBounds.bottom);
      ctx.stroke();

      // Beat lines (orta)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      for (let beat = 1; beat < 4; beat++) {
        const beatX = x + beat * stepWidth * 4;
        if (beatX <= width) {
          ctx.beginPath();
          ctx.moveTo(beatX, visibleBounds.top);
          ctx.lineTo(beatX, visibleBounds.bottom);
          ctx.stroke();
        }
      }

      // Subdivision lines - Sadece zoom yeterince büyükse
      if (stepWidth > 20) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        for (let step = 1; step < 16; step++) {
          if (step % 4 !== 0) { // Beat çizgilerini atla
            const stepX = x + step * stepWidth;
            if (stepX <= width && stepX >= visibleBounds.left && stepX <= visibleBounds.right) {
              ctx.beginPath();
              ctx.moveTo(stepX, visibleBounds.top);
              ctx.lineTo(stepX, visibleBounds.bottom);
              ctx.stroke();
            }
          }
        }
      }
    }

    // 3. Horizontal lines - Sadece C notaları ve oktav işaretleri
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 0.5;

    for (let key = startKey; key < endKey; key++) {
      const noteIndex = (Math.floor(height / keyHeight) - 1 - key) % 12;
      if (noteIndex === 0) { // C note
        const y = key * keyHeight;
        ctx.beginPath();
        ctx.moveTo(visibleBounds.left, y);
        ctx.lineTo(visibleBounds.right, y);
        ctx.stroke();
      }
    }
  }, [gridDimensions, visibleBounds, showScaleHighlighting, scaleNoteSet]);

  // ✅ RENDER HASH - Gereksiz render'ları önle
  const renderHash = useMemo(() => {
    return JSON.stringify({
      bounds: `${visibleBounds.left}-${visibleBounds.top}-${visibleBounds.right}-${visibleBounds.bottom}`,
      grid: `${gridDimensions.gridWidth}-${gridDimensions.gridHeight}`,
      step: `${gridDimensions.stepWidth}-${gridDimensions.keyHeight}`,
      scale: showScaleHighlighting ? `${scale?.root}-${scale?.type}` : 'none',
      scaleNotes: Array.from(scaleNoteSet).join(',')
    });
  }, [visibleBounds, gridDimensions, scale, showScaleHighlighting, scaleNoteSet]);

  // ✅ CANVAS RENDERING - Sadece gerektiğinde
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Değişiklik yoksa render etme
    if (lastRenderHash.current === renderHash) return;

    const ctx = canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true // Performans için
    });

    // DPR'yi sınırla (performans için)
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Canvas boyutlarını ayarla
    canvas.width = gridDimensions.gridWidth * dpr;
    canvas.height = gridDimensions.gridHeight * dpr;
    canvas.style.width = `${gridDimensions.gridWidth}px`;
    canvas.style.height = `${gridDimensions.gridHeight}px`;

    ctx.scale(dpr, dpr);

    // Grid'i çiz
    drawOptimizedGrid(ctx, gridDimensions.gridWidth, gridDimensions.gridHeight);

    // Hash'i güncelle
    lastRenderHash.current = renderHash;

  }, [renderHash, gridDimensions, drawOptimizedGrid]);

  // ✅ INTERACTION PREVIEWS
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

  // ✅ SELECTION RECTANGLE
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

  // ✅ PLAYHEAD
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
        contain: 'layout style paint' // Performans optimizasyonu
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

      {/* VISIBLE NOTES - Sadece görünür olanlar */}
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

      {/* RESIZE FEEDBACK */}
      {interaction?.type === 'resize' && (
        <div className="absolute top-4 left-4 bg-gray-800/90 text-white px-3 py-1 rounded-lg text-sm z-50">
          Duration: {Math.round(interaction.previewDuration || 1)} steps
        </div>
      )}

      {/* PERFORMANCE INFO - Debug için */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-4 right-4 bg-black/80 text-green-400 px-2 py-1 rounded text-xs z-50">
          Visible: {visibleNotes.length}/{notes?.length || 0}
        </div>
      )}
    </div>
  );
});

PianoRollGrid.displayName = 'PianoRollGrid';

export default PianoRollGrid;