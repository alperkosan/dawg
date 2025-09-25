import React, { useState, useCallback, useRef, useEffect } from 'react';

const FaderV3 = ({
  value = -60,
  onChange,
  min = -60,
  max = 12,
  step = 0.1,
  showValue = true,
  disabled = false,
  orientation = 'vertical' // 'vertical' or 'horizontal'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(0);
  const faderRef = useRef(null);
  const trackRef = useRef(null);

  // Convert value to percentage position
  const valueToPosition = useCallback((val) => {
    return ((val - min) / (max - min)) * 100;
  }, [min, max]);

  // Convert position back to value
  const positionToValue = useCallback((pos) => {
    const normalizedPos = Math.max(0, Math.min(100, pos));
    return min + (normalizedPos / 100) * (max - min);
  }, [min, max]);

  const handleMouseDown = useCallback((e) => {
    if (disabled) return;

    e.preventDefault();
    setIsDragging(true);

    const pos = orientation === 'vertical' ? e.clientY : e.clientX;
    setDragStartPos(pos);
    setDragStartValue(value);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [value, disabled, orientation]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    let newPosition;

    if (orientation === 'vertical') {
      const trackHeight = rect.height;
      const mouseY = e.clientY - rect.top;
      // Invert for vertical faders (top = max, bottom = min)
      newPosition = ((trackHeight - mouseY) / trackHeight) * 100;
    } else {
      const trackWidth = rect.width;
      const mouseX = e.clientX - rect.left;
      newPosition = (mouseX / trackWidth) * 100;
    }

    let newValue = positionToValue(newPosition);

    // Apply step quantization
    newValue = Math.round(newValue / step) * step;

    // Clamp to range
    newValue = Math.max(min, Math.min(max, newValue));

    if (newValue !== value) {
      onChange?.(newValue);
    }
  }, [isDragging, value, onChange, min, max, step, orientation, positionToValue]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleTrackClick = useCallback((e) => {
    if (disabled || isDragging) return;

    const rect = trackRef.current.getBoundingClientRect();
    let clickPosition;

    if (orientation === 'vertical') {
      const trackHeight = rect.height;
      const clickY = e.clientY - rect.top;
      // Invert for vertical faders
      clickPosition = ((trackHeight - clickY) / trackHeight) * 100;
    } else {
      const trackWidth = rect.width;
      const clickX = e.clientX - rect.left;
      clickPosition = (clickX / trackWidth) * 100;
    }

    let newValue = positionToValue(clickPosition);
    newValue = Math.round(newValue / step) * step;
    newValue = Math.max(min, Math.min(max, newValue));

    onChange?.(newValue);
  }, [disabled, isDragging, orientation, onChange, min, max, step, positionToValue]);

  const handleDoubleClick = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();

    // Reset to unity gain (0dB)
    const resetValue = Math.max(min, Math.min(max, 0));
    onChange?.(resetValue);
  }, [disabled, min, max, onChange]);

  // Format value for display
  const formatValue = (val) => {
    if (val <= min) return '-∞';
    return `${val.toFixed(1)}dB`;
  };

  const position = valueToPosition(value);
  const handleStyle = orientation === 'vertical'
    ? { bottom: `${position}%` }
    : { left: `${position}%` };

  return (
    <div className={`fader-v3 fader-v3--${orientation} ${disabled ? 'fader-v3--disabled' : ''}`}>
      <div
        ref={trackRef}
        className={`fader-v3__track ${isDragging ? 'fader-v3__track--dragging' : ''}`}
        onMouseDown={handleTrackClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Volume level indicator */}
        <div
          className="fader-v3__level"
          style={orientation === 'vertical'
            ? { height: `${position}%` }
            : { width: `${position}%` }
          }
        />

        {/* Zero dB marker */}
        {min < 0 && max > 0 && (
          <div
            className="fader-v3__zero-marker"
            style={orientation === 'vertical'
              ? { bottom: `${valueToPosition(0)}%` }
              : { left: `${valueToPosition(0)}%` }
            }
          />
        )}

        {/* Fader handle */}
        <div
          ref={faderRef}
          className={`fader-v3__handle ${isDragging ? 'fader-v3__handle--dragging' : ''}`}
          style={handleStyle}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        >
          <div className="fader-v3__handle-grip" />
        </div>
      </div>

      {/* Value display */}
      {showValue && (
        <div className="fader-v3__value">
          {formatValue(value)}
        </div>
      )}

      {/* Scale markings */}
      <div className="fader-v3__scale">
        {[-60, -30, -20, -10, -6, -3, 0, 3, 6, 12].map((mark) => {
          if (mark < min || mark > max) return null;

          const markPosition = valueToPosition(mark);

          return (
            <div
              key={mark}
              className={`fader-v3__scale-mark ${mark === 0 ? 'fader-v3__scale-mark--zero' : ''}`}
              style={orientation === 'vertical'
                ? { bottom: `${markPosition}%` }
                : { left: `${markPosition}%` }
              }
            >
              <div className="fader-v3__scale-tick" />
              <div className="fader-v3__scale-label">
                {mark === 0 ? '0' : mark > 0 ? `+${mark}` : mark}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FaderV3;