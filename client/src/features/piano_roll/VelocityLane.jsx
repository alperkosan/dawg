// src/features/piano_roll/VelocityLane.jsx

import React from 'react';

/**
 * VelocityBar artık tüm proplarını doğrudan ve isimlendirilmiş olarak alıyor.
 */
const VelocityBar = React.memo(({ note, isSelected, stepToX, stepWidth, height, onMouseDown, onWheel }) => {
  const x = stepToX(note.time);
  const barHeight = Math.max(2, note.velocity * height);

  return (
    <div
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(note, e); }}
      onWheel={(e) => { onWheel(note, e); }}
      className="absolute bottom-0 group"
      style={{ left: x, width: stepWidth, height: height, cursor: 'ns-resize' }}
    >
      <div
        className="absolute bottom-0 w-[60%] left-[20%] rounded-t transition-all duration-150"
        style={{
          height: barHeight,
          backgroundColor: isSelected ? 'var(--color-accent)' : 'var(--color-primary)',
          opacity: isSelected ? 1 : 0.7,
          boxShadow: isSelected ? `0 0 8px var(--color-accent)` : 'none'
        }}
      />
    </div>
  );
});

/**
 * VelocityLane artık "...rest" kullanmıyor.
 * Aldığı her prop'u ismen biliyor ve ismen aşağıya aktarıyor.
 */
const VelocityLane = ({ 
    notes, 
    selectedNotes, 
    gridWidth, 
    stepToX, 
    stepWidth, 
    height, 
    onVelocityBarMouseDown, 
    onVelocityWheel 
}) => {
  if (height <= 0) return null;

  return (
    <div 
        data-role="velocity-lane-bg"
        className="h-full relative bg-[var(--color-background)]" 
        style={{ width: gridWidth }}
    >
        {notes.map(note => (
            <VelocityBar
                key={note.id}
                note={note}
                isSelected={selectedNotes.has(note.id)}
                
                // Propları açıkça aktarıyoruz
                stepToX={stepToX}
                stepWidth={stepWidth}
                height={height}
                onMouseDown={onVelocityBarMouseDown}
                onWheel={onVelocityWheel}
            />
        ))}
    </div>
  );
};

export default React.memo(VelocityLane);