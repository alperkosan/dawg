import React from 'react';

const ResizableHandle = ({ onDrag, onDoubleClick }) => {
  const handleMouseDown = (e) => {
    e.preventDefault();
    const handleMouseMove = (moveEvent) => onDrag(moveEvent.movementY);
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
      className="w-full h-2 cursor-ns-resize flex items-center justify-center shrink-0"
      style={{ backgroundColor: 'var(--color-surface)' }}
      title="Sürükle veya çift tıkla"
    >
      <div
        className="w-8 h-1 rounded-full"
        style={{ backgroundColor: 'var(--color-muted)' }}
      />
    </div>
  );
};

export default ResizableHandle;