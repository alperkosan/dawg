/**
 * @file PluginControls.jsx
 * @description "Complete Plugin System Overhaul Guide" dokümanında belirtilen,
 * tüm eklentilerde kullanılacak standart, profesyonel ve yeniden kullanılabilir
 * kontrol bileşenlerini (Knob, Fader, Button) içerir.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PluginColorPalette, PluginAnimations } from './PluginDesignSystem';

// --- Profesyonel Knob Bileşeni ---
export const ProfessionalKnob = ({
  label,
  value = 0,
  min = 0,
  max = 100,
  defaultValue = 50,
  onChange,
  size = 60,
  unit = '',
  precision = 0,
  logarithmic = false,
  displayMultiplier, // Değeri gösterim için bir katsayı ile çarpar (örn: 0.5 -> 50%)
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ y: 0, value: 0 });

  const valueToAngle = useCallback((val) => {
    const normalizedValue = (val - min) / (max - min);
    const clampedValue = Math.max(0, Math.min(1, normalizedValue));
    return -135 + clampedValue * 270;
  }, [min, max]);

  const formatValue = useCallback((val) => {
    const displayVal = displayMultiplier ? val * displayMultiplier : val;
    return `${displayVal.toFixed(precision)}${unit}`;
  }, [precision, unit, displayMultiplier]);

  const handleMouseMove = useCallback((e) => {
    const deltaY = dragStartRef.current.y - e.clientY;
    const range = max - min;
    const sensitivity = e.shiftKey ? 0.001 : 0.005;
    let newValue = dragStartRef.current.value + (deltaY * range * sensitivity);
    newValue = Math.max(min, Math.min(max, newValue));
    onChange?.(newValue);
  }, [min, max, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = 'default';
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);
  
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { y: e.clientY, value };
    document.body.style.cursor = 'ns-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [value, handleMouseMove, handleMouseUp]);

  const handleDoubleClick = useCallback(() => {
    if (defaultValue !== undefined) onChange?.(defaultValue);
  }, [defaultValue, onChange]);

  const angle = valueToAngle(value);
  const r = size / 2 - 4;
  const circumference = 2 * Math.PI * r;
  const trackDashArray = `${circumference * 0.75} ${circumference * 0.25}`;
  const progressPercentage = (angle + 135) / 270;
  const progressDashOffset = circumference * (1 - (progressPercentage * 0.75));

  return (
    <div className="flex flex-col items-center gap-2 relative select-none">
      {isDragging && (
        <div className="absolute -top-10 bg-black/90 text-white text-xs px-2 py-1 rounded backdrop-blur-sm z-50">
          {formatValue(value)}
        </div>
      )}
      <div
        style={{ width: size, height: size }}
        className="relative flex items-center justify-center"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        title={`${label}: ${formatValue(value)} (Çift tıkla sıfırla)`}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} stroke={PluginColorPalette.controls.knobTrack} strokeWidth="4" fill="none" strokeDasharray={trackDashArray} transform={`rotate(135 ${size/2} ${size/2})`} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={PluginColorPalette.controls.knobFill} strokeWidth="4" fill="none"
            strokeDasharray={circumference} strokeDashoffset={progressDashOffset}
            strokeLinecap="round" transform={`rotate(135 ${size/2} ${size/2})`}
            style={{ transition: isDragging ? 'none' : `stroke-dashoffset 0.1s ${PluginAnimations.easeOut}` }}
          />
        </svg>
        <div
          className="absolute w-1 bg-white rounded-full"
          style={{
            height: size * 0.3, top: size * 0.15,
            transform: `rotate(${angle}deg)`, transformOrigin: `50% ${size * 0.35}px`,
            transition: isDragging ? 'none' : `transform ${PluginAnimations.quick}`,
          }}
        />
      </div>
      <div className="text-center">
        <div className="text-xs font-semibold text-white/90 uppercase tracking-wider">{label}</div>
        <div className="text-xs font-mono text-blue-400">{formatValue(value)}</div>
      </div>
    </div>
  );
};


// --- Profesyonel Fader Bileşeni ---
export const ProfessionalFader = ({
  label,
  value,
  min = 0,
  max = 1,
  onChange,
  height = 150,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const faderRef = useRef(null);

  const valueToPosition = useCallback((val) => {
    return ((val - min) / (max - min)) * 100;
  }, [min, max]);

  const positionToValue = useCallback((pos) => {
    return min + (pos / 100) * (max - min);
  }, [min, max]);

  const handleMouseDown = useCallback((e) => {
    if (!faderRef.current) return;
    setIsDragging(true);

    const rect = faderRef.current.getBoundingClientRect();
    const pos = 100 - ((e.clientY - rect.top) / rect.height) * 100;
    const newValue = Math.max(min, Math.min(max, positionToValue(pos)));
    onChange?.(newValue);

    const handleMouseMove = (moveEvent) => {
      const movePos = 100 - ((moveEvent.clientY - rect.top) / rect.height) * 100;
      const moveValue = Math.max(min, Math.min(max, positionToValue(movePos)));
      onChange?.(moveValue);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [min, max, onChange, positionToValue]);

  const position = valueToPosition(value);

  return (
    <div className="flex flex-col items-center gap-2 h-full justify-center">
      <div className="relative flex-grow w-10 flex items-center justify-center" style={{height}}>
        <div
          ref={faderRef}
          className="relative bg-gray-800 rounded-full cursor-ns-resize border border-white/10"
          style={{
            width: 8, height: '100%',
            background: `linear-gradient(to top, ${PluginColorPalette.controls.knobFill} 0%, ${PluginColorPalette.controls.knobFill} ${position}%, ${PluginColorPalette.controls.faderTrack} ${position}%, ${PluginColorPalette.controls.faderTrack} 100%)`
          }}
          onMouseDown={handleMouseDown}
        >
          <div
            className="absolute w-6 h-8 bg-gradient-to-b from-gray-200 to-gray-400 rounded-md border border-gray-500"
            style={{
              left: '50%',
              bottom: `${position}%`,
              transform: 'translate(-50%, 50%)',
              boxShadow: isDragging ? `0 0 12px ${PluginColorPalette.controls.knobFill}60` : '0 2px 4px rgba(0,0,0,0.3)',
              transition: isDragging ? 'none' : `box-shadow ${PluginAnimations.quick}`,
            }}
          />
        </div>
      </div>
      <div className="text-xs font-semibold text-white/90 uppercase tracking-wider text-center">{label}</div>
    </div>
  );
};


// --- Profesyonel Buton Bileşeni ---
export const ProfessionalButton = ({
  label,
  active,
  onClick,
  variant = 'default',
  size = 'md'
}) => {
  const variants = {
    default: active
      ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
      : 'bg-gradient-to-b from-gray-600 to-gray-700 text-gray-300 hover:from-gray-500 hover:to-gray-600',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  };
  return (
    <button
      onClick={onClick}
      className={`
        ${variants[variant]} ${sizes[size]}
        font-semibold rounded-lg border border-white/10
        transition-all duration-200 active:scale-95
        ${active ? 'ring-1 ring-white/20' : ''}
      `}
    >
      {label}
    </button>
  );
};