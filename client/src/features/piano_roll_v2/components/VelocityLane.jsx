// src/features/piano_roll_v2/components/VelocityLane.jsx
import React, { memo, useCallback, forwardRef } from 'react';

const VelocityBar = memo(({ note, isSelected, engine, height, onVelocityChange, onNoteSelect }) => {
  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    
    // Notaları seçmek için Shift tuşuyla veya direkt tıklama
    if (e.shiftKey) {
        onNoteSelect(note.id, true); // Seçime ekle/çıkar
    } else if (!isSelected) {
        onNoteSelect(note.id, false); // Sadece bunu seç
    }

    const startY = e.clientY;
    const startVelocity = note.velocity;

    const handleMouseMove = (moveEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const velocityChange = deltaY / height;
      const newVelocity = Math.max(0.01, Math.min(1, startVelocity + velocityChange));
      onVelocityChange(note.id, newVelocity);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [note.id, note.velocity, height, isSelected, onVelocityChange, onNoteSelect]);

  const barHeight = Math.max(2, note.velocity * (height - 4));
  const noteRect = engine.getNoteRect(note);
  const barClasses = `prv2-velocity-bar__bar ${isSelected ? 'prv2-velocity-bar__bar--selected' : ''}`;

  return (
    <div
      className="prv2-velocity-bar"
      style={{
        transform: `translateX(${noteRect.x}px)`,
        width: engine.stepWidth,
      }}
      onMouseDown={handleMouseDown}
      title={`Velocity: ${Math.round(note.velocity * 127)}`}
    >
      <div className={barClasses} style={{ height: barHeight }} />
    </div>
  );
});

// === GÜNCELLEME: Bileşeni forwardRef ile sarmalıyoruz ===
export const VelocityLane = memo(forwardRef(({ notes, selectedNotes, engine, height, onVelocityChange, onNoteSelect }, ref) => {
  if (height <= 20) return null;

  return (
    <div className="prv2-velocity-lane-content" style={{ height, width: engine.gridWidth }}>
      {notes.map(note => (
        <VelocityBar
          key={note.id}
          note={note}
          isSelected={selectedNotes.has(note.id)}
          engine={engine}
          height={height}
          onVelocityChange={onVelocityChange}
          onNoteSelect={onNoteSelect}
        />
      ))}
    </div>
  );

}));