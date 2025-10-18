/**
 * Knob Control Component
 * Circular knob with arc indicator for parameter control
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import './Knob.css';

const Knob = ({
  value = 0.5,
  min = 0,
  max = 1,
  step = 0.01,
  defaultValue = 0.5,
  label = '',
  unit = '',
  size = 'medium', // 'small' | 'medium' | 'large'
  color = '#6B8EBF',
  onChange,
  formatValue,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const knobRef = useRef(null);
  const startYRef = useRef(0);
  const startValueRef = useRef(0);

  // Normalize value to 0-1 range
  const normalizedValue = (value - min) / (max - min);

  // Arc parameters
  const radius = size === 'small' ? 20 : size === 'large' ? 36 : 28;
  const strokeWidth = size === 'small' ? 3 : size === 'large' ? 5 : 4;
  const centerX = radius + strokeWidth;
  const centerY = radius + strokeWidth;
  const arcStart = 135; // degrees
  const arcEnd = 405; // degrees (270° travel)

  // Calculate arc path
  const getArcPath = (progress) => {
    const startAngle = (arcStart * Math.PI) / 180;
    const endAngle = (arcStart + (arcEnd - arcStart) * progress) * Math.PI / 180;

    const startX = centerX + radius * Math.cos(startAngle);
    const startY = centerY + radius * Math.sin(startAngle);
    const endX = centerX + radius * Math.cos(endAngle);
    const endY = centerY + radius * Math.sin(endAngle);

    const largeArc = progress > 0.5 ? 1 : 0;

    return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`;
  };

  // Format display value
  const formatDisplayValue = useCallback((val) => {
    if (formatValue) {
      return formatValue(val);
    }
    return `${val.toFixed(2)}${unit}`;
  }, [formatValue, unit]);

  // Handle mouse down
  const handleMouseDown = (e) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValueRef.current = value;

    // Add global listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle mouse move
  const handleMouseMove = useCallback((e) => {
    if (!isDragging && !startYRef.current) return;

    const deltaY = startYRef.current - e.clientY;
    const sensitivity = e.shiftKey ? 0.001 : 0.005; // Fine control with Shift
    const delta = deltaY * (max - min) * sensitivity;

    let newValue = startValueRef.current + delta;
    newValue = Math.max(min, Math.min(max, newValue));

    // Apply step
    if (step) {
      newValue = Math.round(newValue / step) * step;
    }

    setDisplayValue(newValue);
    onChange?.(newValue);
  }, [isDragging, min, max, step, onChange]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    startYRef.current = 0;

    // Remove global listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  // Handle double click (reset to default)
  const handleDoubleClick = () => {
    setDisplayValue(defaultValue);
    onChange?.(defaultValue);
  };

  // Handle scroll wheel
  const handleWheel = (e) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    const delta = -e.deltaY * (max - min) * 0.001;
    let newValue = value + delta;
    newValue = Math.max(min, Math.min(max, newValue));

    if (step) {
      newValue = Math.round(newValue / step) * step;
    }

    setDisplayValue(newValue);
    onChange?.(newValue);
  };

  // Update display value when prop changes
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  // Cleanup listeners
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const svgSize = (radius + strokeWidth) * 2;

  return (
    <div className={`knob knob--${size}`}>
      <div
        ref={knobRef}
        className={`knob__control ${isDragging ? 'knob__control--dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      >
        <svg width={svgSize} height={svgSize}>
          {/* Background arc */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Value arc */}
          <path
            d={getArcPath(normalizedValue)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="knob__arc"
          />

          {/* Indicator dot */}
          <circle
            cx={centerX + radius * Math.cos((arcStart + (arcEnd - arcStart) * normalizedValue) * Math.PI / 180)}
            cy={centerY + radius * Math.sin((arcStart + (arcEnd - arcStart) * normalizedValue) * Math.PI / 180)}
            r={strokeWidth * 1.2}
            fill={color}
            className="knob__indicator"
          />
        </svg>
      </div>

      {label && <div className="knob__label">{label}</div>}
      <div className="knob__value">{formatDisplayValue(displayValue)}</div>
    </div>
  );
};

export default Knob;
