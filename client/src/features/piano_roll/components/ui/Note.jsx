// src/features/piano_roll/components/ui/Note.jsx
import React, { memo } from 'react';
import '../../styles/components/Note.css';

export const Note = memo(({ 
  note, 
  isSelected, 
  isPreview, 
  isGhost, 
  ghostColor, 
  viewport, 
  onResizeStart,
  precomputedRect 
}) => {
  const rect = precomputedRect || viewport.getNoteRect(note);

  const noteClasses = [
    'note',
    isSelected && !isGhost ? 'note--selected' : '',
    isPreview && !isGhost ? 'note--preview' : '',
    isGhost ? 'note--ghost' : '',
  ].filter(Boolean).join(' ');

  const style = {
    transform: `translate(${rect.x}px, ${rect.y}px)`,
    width: rect.width,
    height: rect.height,
    '--note-velocity-opacity': 0.6 + note.velocity * 0.4,
    '--note-ghost-color': ghostColor || 'transparent',
  };

  return (
    <div className={noteClasses} style={style}>
      <span className="note__label">
        {!isGhost && rect.width > 40 && note.pitch}
      </span>
      {!isGhost && !isPreview && onResizeStart && (
        <div 
          className="note__resize-handle"
          onMouseDown={(e) => onResizeStart(note, e)}
        />
      )}
    </div>
  );
});
