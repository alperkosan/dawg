import React from 'react';

// Her bir velocity (vuruş gücü) çubuğunu temsil eden alt bileşen.
const VelocityBar = React.memo(({ note, stepToX, stepWidth, height, onVelocityChange, isSelected }) => {
  const x = stepToX(note.time);
  const barHeight = Math.max(2, note.velocity * height);

  return (
    <div
      // Fareye tıklandığında velocity değiştirme etkileşimini başlatır.
      onMouseDown={(e) => { e.stopPropagation(); onVelocityChange(note, e); }}
      className="absolute bottom-0 group"
      style={{ left: x, width: stepWidth, height: height, cursor: 'ns-resize' }}
    >
      <div
        className="absolute bottom-0 w-[60%] left-[20%] rounded-t transition-all duration-150"
        style={{
          height: barHeight,
          // GÜNCELLEME: isSelected durumuna göre stil değiştiriliyor.
          backgroundColor: isSelected ? 'var(--color-accent)' : 'var(--color-primary)',
          opacity: isSelected ? 1 : 0.7,
          // GÜNCELLEME: Seçiliyken bir parlama efekti (box-shadow) ekleniyor.
          boxShadow: isSelected ? `0 0 8px var(--color-accent)` : 'none'
        }}
      />
    </div>
  );
});

// Tüm velocity çubuklarını içeren ana bileşen.
const VelocityLane = ({ notes, stepToX, stepWidth, height, onVelocityChange, selectedNotes, gridWidth }) => {
  if (height <= 0) return null;

  return (
    <div className="h-full relative bg-[var(--color-background)]" style={{ width: gridWidth }}>
      {notes.map(note => (
        <VelocityBar
          key={note.id} // Anahtar olarak benzersiz nota ID'si kullanılıyor
          note={note}
          stepToX={stepToX}
          stepWidth={stepWidth}
          height={height}
          onVelocityChange={onVelocityChange}
          // GÜNCELLEME: Ana notanın seçili olup olmadığı bilgisi buraya aktarılıyor.
          isSelected={selectedNotes.has(note.id)}
        />
      ))}
    </div>
  );
};

export default React.memo(VelocityLane);