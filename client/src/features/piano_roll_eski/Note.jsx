import React from 'react';
import * as Tone from 'tone';

const Note = React.memo(({ note, noteToY, stepToX, keyHeight, stepWidth, isSelected, isPreview, onResizeStart }) => {
  const durationInSeconds = Tone.Time(note.duration).toSeconds();
  const secondsPerStep = Tone.Time('16n').toSeconds();
  const durationInSteps = durationInSeconds / secondsPerStep;
  const width = Math.max(stepWidth / 4, durationInSteps * stepWidth - 2);

  const y = noteToY(note.pitch);
  const x = stepToX(note.time);
  
  let stateClasses = 'bg-cyan-600 border-cyan-800 hover:border-white';
  let opacity = 0.8 + (note.velocity * 0.2);
  let zIndex = 5;

  if (isPreview) {
    stateClasses = 'bg-cyan-500/70 border-2 border-dashed border-white';
    opacity = 1.0;
    zIndex = 20;
  } else if (isSelected) {
    stateClasses = 'bg-amber-500 border-white ring-2 ring-white';
    opacity = 1.0;
    zIndex = 10;
  }
  
  return (
    <div
      className={`absolute rounded flex items-center justify-end pr-1 transition-colors duration-50 ${stateClasses}`}
      style={{
        left: x, top: y, height: keyHeight, width: width, opacity, zIndex,
        boxShadow: isSelected ? `0 0 10px var(--color-accent)` : 'none'
      }}
    >
      <div
        data-role="note-resize-handle"
        onMouseDown={(e) => onResizeStart(note, e)}
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize z-30"
        title="Süreyi Değiştir"
      />
    </div>
  );
});

export default Note;

