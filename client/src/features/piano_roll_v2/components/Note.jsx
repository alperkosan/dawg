import React from 'react';
import { LOD_LEVELS } from '../store/usePianoRollStoreV2'; // LOD_LEVELS'i import et

export const Note = React.memo(({ note, isSelected, isGhost, isPreview, ghostColor, engine, onResizeStart, disableTransitions = false, lod }) => {
  const rect = engine?.getNoteRect?.(note) || { x: 0, y: 0, width: 40, height: 20 };

  // Velocity-based color calculation (FL Studio style)
  const getVelocityColor = (velocity) => {
    const normalizedVelocity = Math.max(0, Math.min(1, velocity));
    if (normalizedVelocity < 0.3) {
      return `hsl(${200 + normalizedVelocity * 40}, 70%, ${30 + normalizedVelocity * 20}%)`;
    } else if (normalizedVelocity < 0.7) {
      const hue = 200 - (normalizedVelocity - 0.3) * 80;
      return `hsl(${hue}, 75%, ${40 + normalizedVelocity * 15}%)`;
    } else {
      const hue = 40 - (normalizedVelocity - 0.7) * 40;
      return `hsl(${hue}, 85%, ${55 + normalizedVelocity * 10}%)`;
    }
  };

  const isOverview = lod === LOD_LEVELS.OVERVIEW;

  const noteClasses = [
    'prv2-note',
    isSelected && !isGhost ? 'prv2-note--selected' : '',
    isPreview && !isGhost ? 'prv2-note--preview' : '',
    isGhost ? 'prv2-note--ghost' : '',
    disableTransitions ? 'prv2-note--no-transitions' : '',
    isOverview ? 'prv2-note--overview' : '',
  ].filter(Boolean).join(' ');

  const baseColor = getVelocityColor(note.velocity || 0.8);
  const style = {
    transform: `translate(${rect.x}px, ${rect.y}px)`,
    width: isOverview ? Math.max(1, rect.width) : rect.width,
    height: rect.height,
    '--note-base-color': baseColor,
    '--note-velocity': note.velocity || 0.8,
    '--note-ghost-color': ghostColor || 'transparent',
    transition: disableTransitions ? 'none' : undefined,
  };

  return (
    <div
      className={noteClasses}
      style={style}
      autoComplete="off"
      role="presentation"
      draggable={false}
    >
      {/* Etiketi ve resize handle'ı sadece yakın zoom'larda göster */}
      {!isOverview && rect.width > 35 && (
        <span
          className="prv2-note__label"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        >
          {note.pitch}
        </span>
      )}
      {!isGhost && !isPreview && !isOverview && (
        <div
          className="prv2-note__resize-handle"
          onMouseDown={(e) => onResizeStart(e, note)}
          draggable={false}
        />
      )}
    </div>
  );
});
