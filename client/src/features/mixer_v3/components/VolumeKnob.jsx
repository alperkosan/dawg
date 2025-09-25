import React, { useState, useCallback, useRef, useEffect } from 'react';
import '../../../styles/components/_volumeKnob.css';

const VolumeKnob = ({
  value = 0,
  onChange,
  min = -60,
  max = 12,
  step = 0.1,
  size = 'normal', // 'mini', 'small', 'normal', 'large'
  label = '',
  bipolar = false,
  disabled = false,
  showValue = true
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(0);
  const knobRef = useRef(null);

  // Convert linear value to rotational angle
  const valueToAngle = useCallback((val) => {
    const clampedVal = Math.max(min, Math.min(max, val));
    const normalizedValue = (clampedVal - min) / (max - min);
    const startAngle = -135; // degrees
    const endAngle = 135;   // degrees
    return startAngle + (normalizedValue * (endAngle - startAngle));
  }, [min, max]);

  // Convert angle back to value
  const angleToValue = useCallback((angle) => {
    const startAngle = -135;
    const endAngle = 135;
    const normalizedAngle = (angle - startAngle) / (endAngle - startAngle);
    return min + (normalizedAngle * (max - min));
  }, [min, max]);

  const handleMouseDown = useCallback((e) => {
    if (disabled) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartValue(value);
  }, [value, disabled, label]);


  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle mouse events with useEffect
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e) => {
      const deltaY = dragStartY - e.clientY; // Inverted for natural feel
      const sensitivity = 0.5;
      const deltaValue = deltaY * sensitivity;
      let newValue = dragStartValue + deltaValue;

      // Apply step quantization
      newValue = Math.round(newValue / step) * step;

      // Clamp to range
      newValue = Math.max(min, Math.min(max, newValue));


      if (newValue !== value) {
        onChange?.(newValue);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStartY, dragStartValue, value, onChange, min, max, step]);

  const handleDoubleClick = useCallback((e) => {
    if (disabled) return;

    e.preventDefault();
    const resetValue = bipolar ? 0 : min;
    onChange?.(resetValue);
  }, [disabled, bipolar, min, onChange]);

  // Format value for display
  const formatValue = (val) => {
    if (bipolar && Math.abs(val) < 0.1) return 'C';
    if (label === 'PAN') {
      if (Math.abs(val) < 1) return 'C';
      return val > 0 ? `R${Math.abs(val)}` : `L${Math.abs(val)}`;
    }
    if (label === 'GAIN') {
      if (val <= min) return '-∞';
      return val >= 0 ? `+${val.toFixed(1)}dB` : `${val.toFixed(1)}dB`;
    }
    if (val <= min) return '-∞';
    return `${val.toFixed(1)}dB`;
  };

  // Get size classes
  const getSizeClass = () => {
    switch (size) {
      case 'mini': return 'knob--size-28';
      case 'small': return 'knob--size-28';
      case 'large': return '';
      default: return '';
    }
  };

  const angle = valueToAngle(value);
  const normalizedValue = (Math.max(min, Math.min(max, value)) - min) / (max - min);
  const arcLength = normalizedValue * 270; // 270 degrees total range

  const knobStyle = {
    transform: `rotate(${angle}deg)`
  };

  const containerStyle = {
    '--arc-length': `${arcLength}deg`,
    '--normalized-value': normalizedValue
  };


  return (
    <div className={`knob ${getSizeClass()} ${disabled ? 'knob--disabled' : ''} ${isDragging ? 'knob--is-dragging' : ''}`}>
      <div
        ref={knobRef}
        className="knob__base"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        <div className="knob__indicator" style={knobStyle} />
        {isDragging && (
          <div className="knob__tooltip">
            {formatValue(value)}
          </div>
        )}
      </div>

      {/* Label and Value */}
      {label && <div className="knob__label">{label}</div>}
    </div>
  );
};

export default VolumeKnob;