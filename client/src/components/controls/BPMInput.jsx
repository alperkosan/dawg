/**
 * 🎵 ENHANCED BPM INPUT COMPONENT
 * 
 * Professional BPM input with:
 * - Keyboard shortcuts (Arrow keys)
 * - Mouse wheel support
 * - Debouncing (save on blur/Enter)
 * - Focus management (select all on focus)
 * - Escape to cancel
 * - Formatting (decimal display control)
 * - Tap tempo
 * - Visual feedback
 * - Preset values
 * - Increment/decrement buttons
 * - Modern UI design
 */

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { ChevronUp, ChevronDown, Music, X, Hand, Circle } from 'lucide-react';
import './BPMInput.css';

const BPM_PRESETS = [60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
const ARROW_STEP = 1; // Normal step
const SHIFT_ARROW_STEP = 10; // Shift + Arrow step
const WHEEL_STEP = 0.5; // Mouse wheel step

export function BPMInput({
  value,
  onChange,
  onCancel,
  className = '',
  showPresets = true,
  showTapTempo = true,
  showButtons = true,
  min = 0.1,
  max = null,
  step = 0.1,
  precision = 1, // Decimal places to show
  disabled = false
}) {
  const [tempValue, setTempValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [tapTimes, setTapTimes] = useState([]);
  const [isTapping, setIsTapping] = useState(false);
  const [presetMenuPosition, setPresetMenuPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const presetButtonRef = useRef(null);
  const presetMenuRef = useRef(null);
  const tapTimeoutRef = useRef(null);
  const repeatIntervalRef = useRef(null);
  const repeatTimeoutRef = useRef(null);
  const repeatStartTimeRef = useRef(null);

  // Sync with external value changes
  useEffect(() => {
    if (!isEditing) {
      setTempValue(value);
    }
  }, [value, isEditing]);

  // Format display value
  const formatValue = useCallback((val) => {
    if (val == null || isNaN(val)) return '';
    const num = parseFloat(val);
    if (isNaN(num)) return '';
    return num.toFixed(precision);
  }, [precision]);

  // Validate and clamp value
  const validateValue = useCallback((val) => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return null;
    if (min != null && num < min) return min;
    if (max != null && num > max) return max;
    return num;
  }, [min, max]);

  // Handle value change with validation
  const handleValueChange = useCallback((newValue, shouldCommit = false) => {
    const validated = validateValue(newValue);
    if (validated === null) return;

    if (shouldCommit) {
      // Commit immediately (for buttons, arrows, wheel)
      onChange(validated);
      setTempValue(validated);
    } else {
      // Just update temp value (for typing)
      setTempValue(newValue);
    }
  }, [validateValue, onChange]);

  // Handle input focus
  const handleFocus = useCallback((e) => {
    setIsEditing(true);
    // Select all text on focus - use setTimeout to override browser's default selection behavior
    const input = e.target;
    setTimeout(() => {
      input.select();
    }, 0);
  }, []);

  // Handle input click - ensure text is selected on click
  const handleClick = useCallback((e) => {
    e.target.select();
  }, []);

  // Handle input blur
  const handleBlur = useCallback(() => {
    const validated = validateValue(tempValue);
    if (validated !== null) {
      onChange(validated);
      setTempValue(validated);
    } else {
      // Invalid - reset to current value
      setTempValue(value);
    }
    setIsEditing(false);
  }, [tempValue, validateValue, onChange, value]);

  // Handle keyboard input
  const handleKeyDown = useCallback((e) => {
    if (disabled) return;

    // Escape - cancel editing
    if (e.key === 'Escape') {
      setTempValue(value);
      setIsEditing(false);
      inputRef.current?.blur();
      if (onCancel) onCancel();
      return;
    }

    // Enter - commit
    if (e.key === 'Enter') {
      handleBlur();
      inputRef.current?.blur();
      return;
    }

    // Arrow keys - adjust value
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.shiftKey ? SHIFT_ARROW_STEP : ARROW_STEP;
      const direction = e.key === 'ArrowUp' ? 1 : -1;
      const current = parseFloat(tempValue) || value;
      const newValue = current + (direction * step);
      handleValueChange(newValue, true);
      return;
    }

    // Allow: backspace, delete, tab, escape, enter, numbers, decimal point
    if (!/[0-9.]/.test(e.key) &&
      !['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
    }
  }, [disabled, value, tempValue, handleValueChange, handleBlur, onCancel]);

  // Handle mouse wheel
  const handleWheel = useCallback((e) => {
    if (disabled || !isHovered) return;
    e.preventDefault();

    const direction = e.deltaY > 0 ? -1 : 1;
    const step = e.shiftKey ? WHEEL_STEP * 5 : WHEEL_STEP;
    const current = parseFloat(tempValue) || value;
    const newValue = current + (direction * step);
    handleValueChange(newValue, true);
  }, [disabled, isHovered, value, tempValue, handleValueChange]);

  // Handle increment button
  const handleIncrement = useCallback((e) => {
    const step = e?.shiftKey ? SHIFT_ARROW_STEP : ARROW_STEP;
    const current = parseFloat(tempValue) || value;
    handleValueChange(current + step, true);
  }, [value, tempValue, handleValueChange]);

  // Handle decrement button
  const handleDecrement = useCallback((e) => {
    const step = e?.shiftKey ? SHIFT_ARROW_STEP : ARROW_STEP;
    const current = parseFloat(tempValue) || value;
    handleValueChange(current - step, true);
  }, [value, tempValue, handleValueChange]);

  // ✅ NEW: Hold-to-repeat with acceleration
  // Use ref to always get latest value (avoids stale closure issue)
  const currentValueRef = useRef(value);
  useEffect(() => {
    currentValueRef.current = value;
  }, [value]);

  // Define stopRepeat first to avoid reference error
  const stopRepeat = useCallback(() => {
    if (repeatTimeoutRef.current) {
      clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    if (repeatIntervalRef.current) {
      clearTimeout(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
    repeatStartTimeRef.current = null;
  }, []);

  const startRepeat = useCallback((direction, shiftKey = false) => {
    // Clear any existing repeat inline (don't call stopRepeat to avoid dep issue)
    if (repeatTimeoutRef.current) {
      clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    if (repeatIntervalRef.current) {
      clearTimeout(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }

    repeatStartTimeRef.current = Date.now();
    const baseStep = shiftKey ? SHIFT_ARROW_STEP : ARROW_STEP;

    const doRepeat = () => {
      const elapsed = Date.now() - repeatStartTimeRef.current;
      // ✅ FIX: Read from ref instead of closure-captured value
      const current = currentValueRef.current;

      // Acceleration: speed up after holding for a while
      // 0-500ms: normal step
      // 500-1500ms: 2x step
      // 1500ms+: 5x step
      let stepMultiplier = 1;
      if (elapsed > 1500) {
        stepMultiplier = 5;
      } else if (elapsed > 500) {
        stepMultiplier = 2;
      }

      const step = baseStep * stepMultiplier;
      const newValue = current + (direction * step);
      handleValueChange(newValue, true);

      // Accelerate interval: start at 200ms, go down to 30ms
      let nextInterval = 200;
      if (elapsed > 1500) {
        nextInterval = 30;
      } else if (elapsed > 1000) {
        nextInterval = 50;
      } else if (elapsed > 500) {
        nextInterval = 100;
      }

      repeatIntervalRef.current = setTimeout(doRepeat, nextInterval);
    };

    // Initial delay before repeat starts (300ms)
    repeatTimeoutRef.current = setTimeout(doRepeat, 300);
  }, [handleValueChange]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopRepeat();
    };
  }, [stopRepeat]);

  // Handle tap tempo
  const handleTapTempo = useCallback(() => {
    const now = Date.now();
    const newTapTimes = [...tapTimes, now].slice(-4); // Keep last 4 taps
    setTapTimes(newTapTimes);
    setIsTapping(true);

    // Clear previous timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    // Calculate BPM from tap intervals
    if (newTapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < newTapTimes.length; i++) {
        intervals.push(newTapTimes[i] - newTapTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBPM = Math.round((60000 / avgInterval) * 10) / 10; // Round to 1 decimal

      if (calculatedBPM > 0 && calculatedBPM < 1000) {
        handleValueChange(calculatedBPM, true);
      }
    }

    // Reset tapping state after 2 seconds
    tapTimeoutRef.current = setTimeout(() => {
      setIsTapping(false);
      setTapTimes([]);
    }, 2000);
  }, [tapTimes, handleValueChange]);

  // Handle preset selection
  const handlePresetSelect = useCallback((preset) => {
    handleValueChange(preset, true);
    setShowPresetMenu(false);
  }, [handleValueChange]);

  // Calculate preset menu position
  useLayoutEffect(() => {
    if (!showPresetMenu || !presetButtonRef.current) return;

    const buttonRect = presetButtonRef.current.getBoundingClientRect();
    const menuWidth = 200; // Approximate menu width
    const menuHeight = 200; // Approximate menu height
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = buttonRect.right;
    let top = buttonRect.bottom + 4;

    // Adjust if menu would overflow viewport
    if (left + menuWidth > viewportWidth) {
      left = buttonRect.left - menuWidth;
    }
    if (top + menuHeight > viewportHeight) {
      top = buttonRect.top - menuHeight - 4;
    }

    setPresetMenuPosition({ top, left });
  }, [showPresetMenu]);

  // Close preset menu on outside click
  useEffect(() => {
    if (!showPresetMenu) return;

    const handleClickOutside = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        presetMenuRef.current &&
        !presetMenuRef.current.contains(e.target)
      ) {
        setShowPresetMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPresetMenu]);

  const displayValue = isEditing ? tempValue : formatValue(value);
  const isValid = validateValue(tempValue) !== null;

  return (
    <div
      ref={containerRef}
      className={`bpm-input-container ${className} ${disabled ? 'disabled' : ''} ${isHovered ? 'hovered' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onWheel={handleWheel}
    >
      <div className="bpm-input-wrapper">
        {/* Decrement Button */}
        {showButtons && (
          <button
            type="button"
            className="bpm-input-btn bpm-input-btn--decrement"
            onClick={handleDecrement}
            onMouseDown={(e) => {
              e.preventDefault();
              startRepeat(-1, e.shiftKey);
            }}
            onMouseUp={stopRepeat}
            onMouseLeave={stopRepeat}
            disabled={disabled}
            title="Decrease BPM (Hold for acceleration, Shift+Click for ±10)"
          >
            <ChevronDown size={14} />
          </button>
        )}

        {/* Input Field */}
        <div className="bpm-input-field-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={displayValue}
            onChange={(e) => {
              const newValue = e.target.value;
              setTempValue(newValue);
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={`bpm-input ${!isValid && isEditing ? 'invalid' : ''} ${isEditing ? 'editing' : ''}`}
            disabled={disabled}
            placeholder="BPM"
            title="BPM - Arrow keys: ±1, Shift+Arrow: ±10, Mouse wheel: ±0.5, Shift+Wheel: ±2.5"
          />
          {isTapping && (
            <div className="bpm-input-tap-indicator">
              <Music size={12} />
            </div>
          )}
        </div>

        {/* Increment Button */}
        {showButtons && (
          <button
            type="button"
            className="bpm-input-btn bpm-input-btn--increment"
            onClick={handleIncrement}
            onMouseDown={(e) => {
              e.preventDefault();
              startRepeat(1, e.shiftKey);
            }}
            onMouseUp={stopRepeat}
            onMouseLeave={stopRepeat}
            disabled={disabled}
            title="Increase BPM (Hold for acceleration, Shift+Click for ±10)"
          >
            <ChevronUp size={14} />
          </button>
        )}
      </div>

      {/* Label */}
      <span className="bpm-input-label">BPM</span>

      {/* Preset Menu Button */}
      {showPresets && (
        <div className="bpm-input-preset-wrapper">
          <button
            ref={presetButtonRef}
            type="button"
            className="bpm-input-preset-btn"
            onClick={() => setShowPresetMenu(!showPresetMenu)}
            title="BPM Presets"
          >
            <Music size={12} />
          </button>

          {/* ✅ FIX: Render preset menu in portal to avoid z-index issues */}
          {showPresetMenu && ReactDOM.createPortal(
            <div
              ref={presetMenuRef}
              className="bpm-input-preset-menu"
              style={{
                position: 'fixed',
                top: `${presetMenuPosition.top}px`,
                left: `${presetMenuPosition.left}px`,
                zIndex: 10000
              }}
            >
              <div className="bpm-input-preset-header">
                <span>Presets</span>
                <button
                  type="button"
                  className="bpm-input-preset-close"
                  onClick={() => setShowPresetMenu(false)}
                >
                  <X size={12} />
                </button>
              </div>
              <div className="bpm-input-preset-grid">
                {BPM_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`bpm-input-preset-item ${Math.abs(value - preset) < 0.1 ? 'active' : ''}`}
                    onClick={() => handlePresetSelect(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>,
            document.body
          )}
        </div>
      )}

      {/* Tap Tempo Button */}
      {showTapTempo && (
        <button
          type="button"
          className={`bpm-input-tap-btn ${isTapping ? 'tapping' : ''}`}
          onClick={handleTapTempo}
          title="Tap Tempo - Click repeatedly to the beat to set BPM"
        >
          <div className="bpm-input-tap-icon-wrapper">
            <Hand size={12} strokeWidth={2.5} />
            <Circle size={6} className="bpm-input-tap-dot" />
          </div>
        </button>
      )}
    </div>
  );
}

export default BPMInput;

