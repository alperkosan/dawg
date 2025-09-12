import React, { useRef, useCallback, useState, useEffect } from 'react';

// Fare sürüklemesiyle değeri değişen, şık ve yeniden kullanılabilir bir knob bileşeni.
function VolumeKnob({ 
    size = 28, 
    value = 0, 
    defaultValue = 0, // Çift tıklandığında dönülecek varsayılan değer
    min = -40, 
    max = 6, 
    onChange, 
    label 
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const dragStartInfo = useRef({ y: 0, value: 0 });

  // Değeri -135 ile +135 derece arasında bir açıya çevirir
  const valueToAngle = (val) => {
    const range = max - min;
    if (range === 0) return -135;
    const normalizedValue = (val - min) / range;
    return normalizedValue * 270 - 135;
  };

  const handleMouseMove = useCallback((e) => {
    const deltaY = dragStartInfo.current.y - e.clientY;
    const range = max - min;
    
    // [YENİ] Shift tuşuna basılıysa hassasiyeti 10 kat artır
    const sensitivity = e.shiftKey ? 2000 : 200; 
    
    const newValue = dragStartInfo.current.value + (deltaY / sensitivity) * range;
    const clampedValue = Math.max(min, Math.min(max, newValue));
    
    onChange(clampedValue);
    setDisplayValue(clampedValue); // Gösterilen değeri anlık güncelle
  }, [min, max, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = 'default';
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartInfo.current = { y: e.clientY, value: value };
    document.body.style.cursor = 'ns-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // [YENİ] Çift tıklandığında değeri sıfırla
  const handleDoubleClick = () => {
    onChange(defaultValue);
    setDisplayValue(defaultValue);
  };

  // State'i dışarıdan gelen prop ile senkronize et
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);


  const angle = valueToAngle(displayValue);

  return (
    <div className="flex flex-col items-center justify-center select-none relative">
        {/* [YENİ] Anlık Değer Göstergesi */}
        {isDragging && (
            <div className="absolute -top-7 bg-cyan-500 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
                {displayValue.toFixed(1)}
            </div>
        )}
      <div 
        className="flex flex-col items-center justify-center"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        title={`${label}: ${value.toFixed(1)} (Shift for fine-tune, Double-click to reset)`}
      >
        <div
          className="relative bg-gray-700 rounded-full cursor-ns-resize border-2 border-gray-900 shadow-inner"
          style={{ width: size, height: size }}
        >
          <div 
            className="absolute top-1/2 left-1/2 w-1 h-1/2 bg-cyan-400 rounded-full"
            style={{ 
              transform: `translate(-50%, -100%) rotate(${angle}deg)`, 
              transformOrigin: '50% 100%',
              transition: isDragging ? 'none' : 'transform 100ms ease-out'
            }}
          />
        </div>
        {label && <span className="text-xs mt-1 text-gray-400">{label}</span>}
      </div>
    </div>
  );
}

export default VolumeKnob;

