import React from 'react';

const VelocityBar = React.memo(({ note, stepToX, stepWidth, height, onVelocityChange, isSelected }) => {
  const x = stepToX(note.time);
  const barHeight = Math.max(2, note.velocity * (height - 4)); // Üstte küçük bir boşluk bırakır

  return (
    <div
      onMouseDown={(e) => { e.stopPropagation(); onVelocityChange(note, e); }}
      className="absolute bottom-0 group"
      style={{ left: x, width: stepWidth, height: height, cursor: 'ns-resize' }}
      title={`Velocity: ${note.velocity.toFixed(2)}`}
    >
      <div
        className="absolute bottom-0 w-[60%] left-[20%] rounded-t-sm transition-colors duration-100"
        style={{
          height: barHeight,
          backgroundColor: isSelected ? 'var(--color-accent)' : 'var(--color-primary)',
          opacity: isSelected ? 1 : 0.7,
        }}
      />
    </div>
  );
});

const VelocityLane = ({ notes, stepToX, stepWidth, height, onVelocityChange, selectedNotes, gridWidth }) => {
  if (height <= 5) return null; // Çok küçükse render etme

  return (
    <div 
      className="h-full relative bg-[var(--color-surface)] border-t border-black/30" 
      style={{ width: gridWidth }}
    >
      {notes.map(note => (
        <VelocityBar
          key={`${note.time}-${note.pitch}`}
          note={note}
          stepToX={stepToX}
          stepWidth={stepWidth}
          height={height}
          onVelocityChange={onVelocityChange}
          isSelected={selectedNotes.has(`${note.time}-${note.pitch}`)}
        />
      ))}
    </div>
  );
};

export default React.memo(VelocityLane);