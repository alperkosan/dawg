// src/features/piano_roll_v2/components/Note.jsx
import React from 'react';

export const Note = React.memo(({ note, isSelected, isGhost, isPreview, ghostColor, engine, onResizeStart }) => {
  const rect = engine.getNoteRect(note);

  const noteClasses = [
    'prv2-note',
    isSelected && !isGhost ? 'prv2-note--selected' : '',
    isPreview && !isGhost ? 'prv2-note--preview' : '',
    isGhost ? 'prv2-note--ghost' : '',
  ].filter(Boolean).join(' ');

  const style = {
    transform: `translate(${rect.x}px, ${rect.y}px)`,
    width: rect.width,
    height: rect.height,
    '--note-velocity-opacity': 0.6 + note.velocity * 0.4,
    '--note-ghost-color': ghostColor || 'transparent',
  };

  return (
    // === HATA DÜZELTMESİ: Tarayıcıya ve eklentilere ipuçları ekliyoruz ===
    <div
      className={noteClasses}
      style={style}
      // Otomatik doldurma ve şifre yöneticilerini devre dışı bırakır
      autoComplete="off"
      // Bu elementin sunumsal olduğunu, bir form kontrolü olmadığını belirtir
      role="presentation"
    >
      {rect.width > 35 && (
        <span className="prv2-note__label">
          {note.pitch}
        </span>
      )}
      {!isGhost && !isPreview && (
        <div 
          className="prv2-note__resize-handle"
          onMouseDown={(e) => onResizeStart(e, note)}
        />
      )}
    </div>
  );
});