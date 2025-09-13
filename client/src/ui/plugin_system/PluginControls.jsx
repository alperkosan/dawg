/**
 * @file PluginControls.jsx
 * @description "Complete Plugin System Overhaul Guide" dokümanında belirtilen,
 * tüm eklentilerde kullanılacak standart, profesyonel ve yeniden kullanılabilir
 * kontrol bileşenlerini (Knob, Fader, Button) içerir.
 */
import React, { useState, useRef, useCallback } from 'react';
import { PluginColorPalette, PluginAnimations } from './PluginDesignSystem';

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
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ y: 0, value: 0 });

  // --- MATEMATİKSEL YARDIMCILAR ---
  // Bu fonksiyonlar, knob'un min/max aralığındaki bir değeri -135 ile +135 derece arasına doğru bir şekilde haritalar.
  const toLog = useCallback((val) => {
    if (!logarithmic || min <= 0) return val;
    return min * Math.pow(max / min, (val - min) / (max - min));
  }, [logarithmic, min, max]);

  const fromLog = useCallback((val) => {
    if (!logarithmic || min <= 0) return val;
    return min + (max - min) * (Math.log(val / min) / Math.log(max / min));
  }, [logarithmic, min, max]);

  const valueToAngle = useCallback((val) => {
    const linearValue = logarithmic ? fromLog(val) : val;
    const normalizedValue = (linearValue - min) / (max - min);
    // Değerin aralık dışına çıkmasını engelle (clamp)
    const clampedValue = Math.max(0, Math.min(1, normalizedValue));
    return -135 + clampedValue * 270;
  }, [min, max, logarithmic, fromLog]);

  const formatValue = useCallback((val) => {
    return `${val.toFixed(precision)}${unit}`;
  }, [precision, unit]);

  // --- ETKİLEŞİM FONKSİYONLARI ---
  const handleMouseMove = useCallback((e) => {
    const deltaY = dragStartRef.current.y - e.clientY;
    const range = max - min;
    const sensitivity = e.shiftKey ? 0.001 : 0.005;
    const linearStartValue = logarithmic ? fromLog(dragStartRef.current.value) : dragStartRef.current.value;
    let newLinearValue = linearStartValue + (deltaY * range * sensitivity);
    // Değeri her zaman min/max aralığında tut
    newLinearValue = Math.max(min, Math.min(max, newLinearValue));
    
    const finalValue = logarithmic ? toLog(newLinearValue) : newLinearValue;
    onChange?.(finalValue);
  }, [min, max, onChange, logarithmic, toLog, fromLog]);

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
    if (defaultValue !== undefined) {
      onChange?.(defaultValue);
    }
  }, [defaultValue, onChange]);

  const angle = valueToAngle(value);

  // --- SVG HESAPLAMALARI ---
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
        title={`${label}: ${formatValue(value)} (Double-click to reset)`}
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
            height: size * 0.3,
            top: size * 0.15,
            transform: `rotate(${angle}deg)`,
            transformOrigin: `50% ${size * 0.35}px`,
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