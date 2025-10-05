import React, { useRef, useCallback, useState, useEffect } from 'react';
// Tailwind yerine merkezi stil dosyamızı import edeceğiz,
// ancak bu import işlemi main.jsx'te tek seferde yapılacak.

function VolumeKnob({
    size = 48,
    value = 0,
    defaultValue = 0,
    min = -40,
    max = 6,
    onChange,
    label
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const dragStartInfo = useRef({ y: 0, value: 0 });
  const rafRef = useRef(null);
  const latestEventRef = useRef({ clientY: 0, shiftKey: false });
  const onChangeRef = useRef(onChange);

  // Keep onChange ref updated
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const valueToAngle = (val) => {
    const range = max - min;
    if (range === 0) return -135;
    const normalizedValue = (val - min) / range;
    return normalizedValue * 270 - 135;
  };

  const handleMouseMove = useCallback((e) => {
    // Store latest event data
    latestEventRef.current = { clientY: e.clientY, shiftKey: e.shiftKey };

    // Only schedule if not already scheduled
    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      const deltaY = dragStartInfo.current.y - latestEventRef.current.clientY;
      const range = max - min;
      const sensitivity = latestEventRef.current.shiftKey ? 1000 : 200;
      const newValue = dragStartInfo.current.value + (deltaY / sensitivity) * range;
      const clampedValue = Math.max(min, Math.min(max, newValue));
      onChangeRef.current(clampedValue);
      rafRef.current = null;
    });
  }, [min, max]); // Remove onChange from deps!

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = 'default';

    // Cleanup RAF
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

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

  const handleDoubleClick = () => {
    onChange(defaultValue);
  };

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);
  
  // BEM sınıfını artık boyut için kullanmıyoruz.
  const knobClasses = `
    knob 
    ${isDragging ? 'knob--is-dragging' : ''}
  `;

  // Dinamik olarak inline stiller oluşturuyoruz.
  const baseStyle = {
    width: `${size}px`,
    height: `${size}px`,
  };

  const indicatorStyle = {
    height: `${size * 0.33}px`, // Boyutla orantılı yükseklik
    top: `${size * 0.16}px`,     // Boyutla orantılı pozisyon
    transformOrigin: `50% ${size * 0.33}px`, // Dönme noktası
    transform: `translateX(-50%) rotate(${valueToAngle(displayValue)}deg)`,
  };

  return (
    <div className={knobClasses}>
        <div className="knob__tooltip">
            {displayValue.toFixed(1)}
        </div>
      <div
        className="knob__base"
        style={baseStyle} // Dinamik stili burada uyguluyoruz
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        title={`${label}: ${value.toFixed(1)} (Shift for fine-tune, Double-click to reset)`}
      >
        <div
          className="knob__indicator"
          style={indicatorStyle} // Dinamik stili burada uyguluyoruz
        />
      </div>
      {label && <span className="knob__label">{label}</span>}
    </div>
  );
}

export default VolumeKnob;