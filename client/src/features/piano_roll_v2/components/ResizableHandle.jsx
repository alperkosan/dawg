// src/features/piano_roll_v2/components/ResizableHandle.jsx
import React from 'react';

const ResizableHandle = ({ onDrag, onDoubleClick }) => {
  const handleMouseDown = (e) => {
    e.preventDefault();
    const handleMouseMove = (moveEvent) => {
      // Sadece dikey hareketi (movementY) iletiyoruz.
      onDrag(moveEvent.movementY);
    };
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
      className="prv2-resizable-handle"
      title="Sürükle veya çift tıkla"
    >
      <div className="prv2-resizable-handle__grip" />
    </div>
  );
};

export default ResizableHandle;