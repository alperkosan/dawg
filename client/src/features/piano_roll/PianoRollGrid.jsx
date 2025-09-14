import React, { useEffect, useRef, useMemo } from 'react';
import Note from './Note';
import { usePianoRollStore, NOTES, SCALES } from '../../store/usePianoRollStore';

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
  // YENİ: Gam bilgilerini store'dan alıyoruz
  const { scale, showScaleHighlighting } = usePianoRollStore();

  // YENİ: Hangi notaların gama dahil olduğunu hesaplayan ve hafızada tutan mantık
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

  // Grid ve gam vurgulamasını çizen mantık
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = gridWidth * dpr;
    canvas.height = gridHeight * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, gridWidth, gridHeight);

    // Gam Vurgulama Çizimi
    if (showScaleHighlighting) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'; // Vurgu rengi
        for (let i = 0; i < totalKeys; i++) {
            const noteIndex = (totalKeys - 1 - i) % 12;
            if (!scaleNoteSet.has(noteIndex)) {
                ctx.fillRect(0, i * keyHeight, gridWidth, keyHeight);
            }
        }
    }

    const barWidth = stepWidth * 16;
    const beatWidth = stepWidth * 4;
    const totalBars = Math.ceil(gridWidth / barWidth);

    // Dikey çizgiler (BBT standardı)
    for (let bar = 0; bar < totalBars; bar++) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bar * barWidth, 0);
      ctx.lineTo(bar * barWidth, gridHeight);
      ctx.stroke();

      for (let beat = 1; beat < 4; beat++) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(bar * barWidth + beat * beatWidth, 0);
        ctx.lineTo(bar * barWidth + beat * beatWidth, gridHeight);
        ctx.stroke();
      }
    }
  }, [gridWidth, gridHeight, stepWidth, keyHeight, scaleNoteSet, showScaleHighlighting]);

  return (
    <div className="relative" style={{ width: gridWidth, height: gridHeight }}>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />
      {notes.map((note) => (
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
      {interaction?.previewNotes?.map(note => <Note key={`preview-${note.id}`} note={note} isPreview={true} {...{noteToY, stepToX, keyHeight, stepWidth}}/>)}
      {interaction?.previewNote && <Note key="preview-creating" note={interaction.previewNote} isPreview={true} {...{noteToY, stepToX, keyHeight, stepWidth}}/>}
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
      {playbackMode === 'pattern' && (
        <div ref={playheadRef} className="absolute top-0 bottom-0 w-0.5 z-30 pointer-events-none bg-cyan-400" />
      )}
    </div>
  );
};

export default React.memo(PianoRollGrid);