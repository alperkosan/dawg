/**
 * Slider Control Component
 * Horizontal slider for parameter control
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import './Slider.css';

const Slider = ({
  value = 0.5,
  min = 0,
  max = 1,
  step = 0.01,
  defaultValue = 0.5,
  label = '',
  unit = '',
  color = '#6B8EBF',
  showValue = true,
  onChange,
  formatValue,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const sliderRef = useRef(null);
  const trackRef = useRef(null);

  // Normalize value to 0-1 range
  const normalizedValue = (value - min) / (max - min);

  // Format display value
  const formatDisplayValue = useCallback((val) => {
    if (formatValue) {
      return formatValue(val);
    }
    const decimals = step < 0.1 ? 2 : step < 1 ? 1 : 0;
    return `${val.toFixed(decimals)}${unit}`;
  }, [formatValue, unit, step]);

  // Calculate value from mouse position
  const getValueFromMouse = useCallback((clientX) => {
    if (!trackRef.current) return value;

    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));

    let newValue = min + percent * (max - min);

    // Apply step
    if (step) {
      newValue = Math.round(newValue / step) * step;
    }

    return Math.max(min, Math.min(max, newValue));
  }, [min, max, step, value]);

  // Handle mouse down
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);

    const newValue = getValueFromMouse(e.clientX);
    setDisplayValue(newValue);
    onChange?.(newValue);

    // Add global listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle mouse move
  const handleMouseMove = useCallback((e) => {
    if (!isDragging && !document.body.classList.contains('slider-dragging')) return;

    const newValue = getValueFromMouse(e.clientX);
    setDisplayValue(newValue);
    onChange?.(newValue);
  }, [isDragging, getValueFromMouse, onChange]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.classList.remove('slider-dragging');

    // Remove global listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  // Handle double click (reset to default)
  const handleDoubleClick = () => {
    setDisplayValue(defaultValue);
    onChange?.(defaultValue);
  };

  // Handle Alt+Click (snap to default)
  const handleClick = (e) => {
    if (e.altKey) {
      setDisplayValue(defaultValue);
      onChange?.(defaultValue);
    }
  };

  // Update display value when prop changes
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  // Set dragging class on body
  useEffect(() => {
    if (isDragging) {
      document.body.classList.add('slider-dragging');
    } else {
      document.body.classList.remove('slider-dragging');
    }
  }, [isDragging]);

  // Cleanup listeners
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('slider-dragging');
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div className="slider" ref={sliderRef}>
      <div className="slider__header">
        {label && <div className="slider__label">{label}</div>}
        {showValue && (
          <div className="slider__value">{formatDisplayValue(displayValue)}</div>
        )}
      </div>

      <div
        ref={trackRef}
        className={`slider__track ${isDragging ? 'slider__track--dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onClick={handleClick}
      >
        {/* Background track */}
        <div className="slider__track-bg" />

        {/* Filled track */}
        <div
          className="slider__track-fill"
          style={{
            width: `${normalizedValue * 100}%`,
            background: color,
          }}
        />

        {/* Thumb */}
        <div
          className="slider__thumb"
          style={{
            left: `${normalizedValue * 100}%`,
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </div>
    </div>
  );
};

export default Slider;
