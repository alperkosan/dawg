import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import * as Tone from 'tone';
import Note from './Note';
import { usePianoRollStore, NOTES, SCALES } from '../store/usePianoRollStore';

const totalOctaves = 8;
const totalKeys = totalOctaves * 12;

const PianoRollGrid = ({
  notes,
  gridWidth,
  gridHeight,
  noteToY,
  stepToX,
  keyHeight,
  stepWidth,
  onResizeStart,
  selectedNotes,
  interaction,
  playbackMode,
  playheadRef,
}) => {
  const canvasRef = useRef(null);
  const lastRenderHash = useRef('');
  
  // YENİ: Gam bilgilerini store'dan alıyoruz
  const { scale, showScaleHighlighting } = usePianoRollStore();

  // YENİ: Viewport hesaplama - sadece görünür alanı render etmek için
  const viewport = useMemo(() => {
    // Parent container'dan scroll pozisyonunu al
    const container = canvasRef.current?.parentElement?.parentElement;
    if (!container) {
      return { 
        x: 0, 
        y: 0, 
        width: gridWidth, 
        height: gridHeight,
        scrollLeft: 0,
        scrollTop: 0
      };
    }
    
    return {
      x: container.scrollLeft,
      y: container.scrollTop,
      width: container.clientWidth,
      height: container.clientHeight,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop
    };
  }, [gridWidth, gridHeight]);

  // YENİ: Gam notalarını hesaplayan optimize edilmiş fonksiyon
  const scaleNoteSet = useMemo(() => {
    if (!showScaleHighlighting) return new Set();
    const rootNoteIndex = NOTES.indexOf(scale.root);
    const scaleIntervals = SCALES[scale.type];
    const noteIndicesInScale = new Set();
    scaleIntervals.forEach(interval => {
        noteIndicesInScale.add((rootNoteIndex + interval) % 12);
    });
    return noteIndicesInScale;
  }, [scale, showScaleHighlighting]);

  // YENİ: Görünür notaları filtreleyen optimizasyon
  const visibleNotes = useMemo(() => {
    if (!notes || notes.length === 0) return [];
    
    // Viewport kenar boşluğu - render alanını biraz genişlet
    const margin = Math.max(keyHeight * 2, stepWidth * 8);
    
    return notes.filter(note => {
      const noteX = stepToX(note.time);
      const noteY = noteToY(note.pitch);
      
      // Notanın genişliğini hesapla
      const durationInSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
      const noteWidth = durationInSteps * stepWidth;
      
      // Viewport içinde mi kontrolü
      const isHorizontallyVisible = 
        noteX + noteWidth >= viewport.scrollLeft - margin &&
        noteX <= viewport.scrollLeft + viewport.width + margin;
        
      const isVerticallyVisible = 
        noteY + keyHeight >= viewport.scrollTop - margin &&
        noteY <= viewport.scrollTop + viewport.height + margin;
      
      return isHorizontallyVisible && isVerticallyVisible;
    });
  }, [notes, viewport, noteToY, stepToX, keyHeight, stepWidth]);

  // YENİ: Grid çizim fonksiyonu - optimize edilmiş
  const drawOptimizedGrid = useCallback((ctx, width, height) => {
    // Canvas'ı temizle
    ctx.clearRect(0, 0, width, height);
    
    // Sadece görünür alanı hesapla
    const viewStartBar = Math.max(0, Math.floor(viewport.scrollLeft / (stepWidth * 16)) - 1);
    const viewEndBar = Math.min(
      Math.ceil(width / (stepWidth * 16)), 
      Math.ceil((viewport.scrollLeft + viewport.width) / (stepWidth * 16)) + 1
    );
    
    const viewStartKey = Math.max(0, Math.floor(viewport.scrollTop / keyHeight) - 2);
    const viewEndKey = Math.min(
      totalKeys, 
      Math.ceil((viewport.scrollTop + viewport.height) / keyHeight) + 2
    );

    // 1. Gam vurgulaması (eğer aktifse)
    if (showScaleHighlighting && scaleNoteSet.size > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      
      for (let i = viewStartKey; i < viewEndKey; i++) {
        const noteIndex = (totalKeys - 1 - i) % 12;
        if (!scaleNoteSet.has(noteIndex)) {
          const y = i * keyHeight;
          ctx.fillRect(0, y, width, keyHeight);
        }
      }
    }

    // 2. Dikey çizgiler (Bar çizgileri)
    ctx.lineWidth = 1;
    
    for (let bar = viewStartBar; bar <= viewEndBar; bar++) {
      const x = bar * stepWidth * 16;
      
      // Ana bar çizgisi
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      
      // Beat çizgileri (1/4 note divisions)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      for (let beat = 1; beat < 4; beat++) {
        const beatX = x + beat * stepWidth * 4;
        ctx.beginPath();
        ctx.moveTo(beatX, 0);
        ctx.lineTo(beatX, height);
        ctx.stroke();
      }
    }

    // 3. Yatay çizgiler (Oktav çizgileri) - isteğe bağlı
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    for (let octave = 0; octave < totalOctaves; octave++) {
      const y = octave * 12 * keyHeight;
      if (y >= viewport.scrollTop - keyHeight && y <= viewport.scrollTop + viewport.height + keyHeight) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
  }, [
    viewport, 
    stepWidth, 
    keyHeight, 
    showScaleHighlighting, 
    scaleNoteSet
  ]);

  // YENİ: Render hash - gereksiz re-render'ları önlemek için
  const renderHash = useMemo(() => {
    return JSON.stringify({
      viewport: `${viewport.scrollLeft}-${viewport.scrollTop}-${viewport.width}-${viewport.height}`,
      gridSize: `${gridWidth}-${gridHeight}`,
      stepSize: `${stepWidth}-${keyHeight}`,
      scale: showScaleHighlighting ? `${scale.root}-${scale.type}` : 'none'
    });
  }, [viewport, gridWidth, gridHeight, stepWidth, keyHeight, scale, showScaleHighlighting]);

  // Canvas rendering effect - optimize edilmiş
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Hash değişmediyse render etme
    if (lastRenderHash.current === renderHash) return;
    
    const ctx = canvas.getContext('2d', { 
      alpha: false,  // Alpha channel'ı kapat - performans artışı
      desynchronized: true  // GPU için optimize et
    });
    
    // Device Pixel Ratio'yu sınırla - çok yüksek DPR performansı düşürür
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    
    // Canvas boyutlarını ayarla
    canvas.width = gridWidth * dpr;
    canvas.height = gridHeight * dpr;
    canvas.style.width = `${gridWidth}px`;
    canvas.style.height = `${gridHeight}px`;
    
    ctx.scale(dpr, dpr);
    
    // Grid'i çiz
    drawOptimizedGrid(ctx, gridWidth, gridHeight);
    
    // Hash'i güncelle
    lastRenderHash.current = renderHash;
    
  }, [renderHash, gridWidth, gridHeight, drawOptimizedGrid]);

  return (
    <div className="relative" style={{ width: gridWidth, height: gridHeight }}>
      {/* Optimize edilmiş Canvas */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 pointer-events-none z-0"
        style={{ 
          imageRendering: 'pixelated',  // Crisp rendering
          transform: 'translateZ(0)',   // GPU layer
        }}
      />
      
      {/* Sadece görünür notaları render et */}
      {visibleNotes.map((note) => (
        <Note
          key={note.id}
          note={note}
          noteToY={noteToY}
          stepToX={stepToX}
          keyHeight={keyHeight}
          stepWidth={stepWidth}
          onResizeStart={onResizeStart}
          isSelected={selectedNotes.has(note.id)}
        />
      ))}
      
      {/* Interaction preview notları */}
      {interaction?.previewNotes?.map(note => (
        <Note 
          key={`preview-${note.id}`} 
          note={note} 
          isPreview={true} 
          {...{noteToY, stepToX, keyHeight, stepWidth}}
        />
      ))}
      
      {/* Tek nota preview */}
      {interaction?.previewNote && (
        <Note 
          key="preview-creating" 
          note={interaction.previewNote} 
          isPreview={true} 
          {...{noteToY, stepToX, keyHeight, stepWidth}}
        />
      )}
      
      {/* Marquee selection */}
      {interaction?.type === 'marquee' && (
        <div
          className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/20 pointer-events-none z-40"
          style={{
            left: Math.min(interaction.gridStartX, interaction.currentX),
            top: Math.min(interaction.gridStartY, interaction.currentY),
            width: Math.abs(interaction.currentX - interaction.gridStartX),
            height: Math.abs(interaction.currentY - interaction.gridStartY),
          }}
        />
      )}
      
      {/* Playhead */}
      {playbackMode === 'pattern' && (
        <div 
          ref={playheadRef} 
          className="absolute top-0 bottom-0 w-0.5 z-30 pointer-events-none bg-cyan-400"
          style={{ transform: 'translateZ(0)' }}  // GPU layer
        />
      )}
    </div>
  );
};

export default React.memo(PianoRollGrid);