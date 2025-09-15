import React from 'react';
import * as Tone from 'tone';

const Note = React.memo(({ 
  note, noteToY, stepToX, keyHeight, stepWidth, 
  isSelected, isPreview, onResizeStart 
}) => {
  // Boyut hesaplamaları - memoized değerler
  const durationInSeconds = Tone.Time(note.duration).toSeconds();
  const secondsPerStep = Tone.Time('16n').toSeconds();
  const durationInSteps = durationInSeconds / secondsPerStep;
  const width = Math.max(stepWidth / 4, durationInSteps * stepWidth - 2);

  const y = noteToY(note.pitch);
  const x = stepToX(note.time);
  
  // Stil hesaplamaları - performance için inline styles
  const baseOpacity = 0.8 + (note.velocity * 0.2);
  
  // Class name optimizasyonu - template literals yerine conditional
  let className = 'absolute rounded flex items-center justify-end pr-1 piano-roll-note';
  let zIndex = 5;
  let opacity = baseOpacity;

  if (isPreview) {
    className += ' bg-cyan-500/70 border-2 border-dashed border-white piano-roll-preview-note';
    opacity = 1.0;
    zIndex = 20;
  } else if (isSelected) {
    className += ' bg-amber-500 border-white ring-2 ring-white selected';
    opacity = 1.0;
    zIndex = 10;
  } else {
    className += ' bg-cyan-600 border-cyan-800 hover:border-white';
  }

  // Inline styles - CSS değişkenlerinden daha performanslı
  const noteStyle = {
    left: x,
    top: y,
    height: keyHeight,
    width: width,
    opacity: opacity,
    zIndex: zIndex,
    // GPU layer zorla
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
    // Will-change sadece seçili notalar için
    willChange: isSelected ? 'transform, box-shadow' : 'auto',
    // Box shadow optimize et
    boxShadow: isSelected ? `0 0 10px var(--color-accent)` : 'none'
  };

  // Resize handle style
  const resizeHandleStyle = {
    position: 'absolute',
    right: 0,
    top: 0,
    height: '100%',
    width: '8px',
    cursor: 'ew-resize',
    zIndex: 30,
    // Invisible but clickable area
    backgroundColor: 'transparent'
  };

  // Mouse event handler - useCallback gereksiz çünkü component memoized
  const handleResizeStart = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart(note, e);
  };
  
  return (
    <div
      className={className}
      style={noteStyle}
      // Data attributes for debugging
      data-note-id={note.id}
      data-note-pitch={note.pitch}
      data-note-time={note.time}
    >
      {/* Resize handle - sadece preview olmayan notalar için */}
      {!isPreview && (
        <div
          style={resizeHandleStyle}
          onMouseDown={handleResizeStart}
          title="Süreyi Değiştir"
        />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Shallow comparison - sadece gerekli alanları kontrol et
  return (
    prevProps.note.id === nextProps.note.id &&
    prevProps.note.time === nextProps.note.time &&
    prevProps.note.pitch === nextProps.note.pitch &&
    prevProps.note.duration === nextProps.note.duration &&
    prevProps.note.velocity === nextProps.note.velocity &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isPreview === nextProps.isPreview &&
    // Grid boyutları değiştiğinde re-render et
    prevProps.keyHeight === nextProps.keyHeight &&
    prevProps.stepWidth === nextProps.stepWidth &&
    // Coordinate functions referans karşılaştırması
    prevProps.noteToY === nextProps.noteToY &&
    prevProps.stepToX === nextProps.stepToX
  );
});

// Display name for debugging
Note.displayName = 'OptimizedNote';

export default Note;