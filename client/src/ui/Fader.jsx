import React, { useRef, useCallback } from 'react';

function Fader({ value, onChange, minDb = -60, maxDb = 6 }) {
  const faderRef = useRef(null);

  const valueToPosition = (val) => {
    if (val <= minDb) return 100;
    if (val >= maxDb) return 0;
    const range = maxDb - minDb;
    const percentage = (val - minDb) / range;
    return (1 - percentage) * 100;
  };

  const handleMouseMove = useCallback((e) => {
    if (!faderRef.current) return;
    const rect = faderRef.current.getBoundingClientRect();
    let offsetY = e.clientY - rect.top;
    offsetY = Math.max(0, Math.min(rect.height, offsetY));
    const percentage = 1 - (offsetY / rect.height);
    const newValue = minDb + ((maxDb - minDb) * percentage);
    onChange(newValue);
  }, [minDb, maxDb, onChange]);

  const handleMouseUp = useCallback(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    handleMouseMove(e);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-1">
      <div
        ref={faderRef}
        onMouseDown={handleMouseDown}
        className="w-2 h-full bg-gray-900 rounded-full cursor-pointer relative"
      >
        <div 
          className="absolute w-6 h-8 bg-gray-600 hover:bg-cyan-500 border-2 border-gray-900 rounded-md -left-2"
          style={{ top: `calc(${valueToPosition(value)}% - 16px)` }}
        />
      </div>
    </div>
  );
}

export default Fader;
