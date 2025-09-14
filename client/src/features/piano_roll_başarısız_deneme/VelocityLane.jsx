import React, { useEffect, useRef } from 'react';

const VelocityBar = React.memo(({ note, isSelected, stepToX, stepWidth, height, onMouseDown, onWheel }) => {
  const barRef = useRef(null);
  const x = stepToX(note.time);
  const barHeight = Math.max(2, note.velocity * height);

  // useEffect ile olay dinleyicisini manuel ve "pasif olmayan" şekilde ekliyoruz.
  useEffect(() => {
    const element = barRef.current;
    if (!element) return;

    const handleWheelEvent = (e) => {
      // Bu fonksiyon içindeki e.preventDefault() artık sorunsuz çalışacak.
      onWheel(note, e);
    };

    // Olay dinleyicisini `{ passive: false }` seçeneğiyle ekliyoruz.
    element.addEventListener('wheel', handleWheelEvent, { passive: false });

    // Bileşen kaldırıldığında dinleyiciyi temizliyoruz.
    return () => {
      element.removeEventListener('wheel', handleWheelEvent);
    };
  }, [note, onWheel]);

  return (
    <div
      ref={barRef}
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(note, e); }}
      // onWheel prop'unu buradan kaldırıyoruz çünkü artık manuel yönetiliyor.
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

const VelocityLane = ({ notes, onVelocityBarMouseDown, onVelocityWheel, ...rest }) => {
  if (rest.height <= 0) return null;

  return (
    <div 
        data-role="velocity-lane-bg"
        className="h-full relative bg-[var(--color-background)]" 
        style={{ width: rest.gridWidth }}
    >
        {notes.map(note => (
            <VelocityBar
                key={note.id}
                note={note}
                onMouseDown={onVelocityBarMouseDown}
                onWheel={onVelocityWheel}
                isSelected={rest.selectedNotes.has(note.id)}
                {...rest}
            />
        ))}
    </div>
  );
};

export default React.memo(VelocityLane);