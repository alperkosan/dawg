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
  label, value = 0, min = 0, max = 100, defaultValue = 50, onChange,
  size = 60, unit = '', precision = 0, displayMultiplier, className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ y: 0, value: 0 });

  const valueToAngle = useCallback((val) => {
    const normalizedValue = (val - min) / (max - min);
    return -135 + Math.max(0, Math.min(1, normalizedValue)) * 270;
  }, [min, max]);

  const formatValue = useCallback((val) => {
    return `${(displayMultiplier ? val * displayMultiplier : val).toFixed(precision)}${unit}`;
  }, [precision, unit, displayMultiplier]);

  const handleMouseMove = useCallback((e) => {
    const deltaY = dragStartRef.current.y - e.clientY;
    const range = max - min;
    const sensitivity = e.shiftKey ? 0.001 : 0.005;
    let newValue = dragStartRef.current.value + (deltaY * range * sensitivity);
    onChange?.(Math.max(min, Math.min(max, newValue)));
  }, [min, max, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false); document.body.style.cursor = 'default';
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);
  
  const handleMouseDown = useCallback((e) => {
    e.preventDefault(); setIsDragging(true);
    dragStartRef.current = { y: e.clientY, value };
    document.body.style.cursor = 'ns-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [value, handleMouseMove, handleMouseUp]);

  const angle = valueToAngle(value);

  return (
    <div className={`flex flex-col items-center gap-1 relative select-none ${className}`}>
      {label && <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</div>}
      <div
        style={{ width: size, height: size }}
        className="relative flex items-center justify-center cursor-ns-resize"
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onChange?.(defaultValue)}
        title={`${label}: ${formatValue(value)}`}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          <circle cx={size/2} cy={size/2} r={size/2 - 4} stroke="#333" strokeWidth="4" fill="none" strokeDasharray={`${Math.PI * (size - 8) * 0.75} ${Math.PI * (size - 8) * 0.25}`} transform={`rotate(135 ${size/2} ${size/2})`} />
          <circle cx={size/2} cy={size/2} r={size/2-4} stroke={PluginColorPalette.controls.knobFill} strokeWidth="4" fill="none" strokeDasharray={Math.PI * (size - 8)} strokeDashoffset={Math.PI * (size - 8) * (1 - (((angle + 135) / 270) * 0.75))} strokeLinecap="round" transform={`rotate(135 ${size/2} ${size/2})`} style={{ transition: isDragging ? 'none' : 'stroke-dashoffset 0.1s ease-out' }}/>
        </svg>
        <div className="absolute w-1 bg-white rounded-full" style={{ height: size * 0.3, top: size * 0.15, transform: `rotate(${angle}deg)`, transformOrigin: `50% ${size * 0.35}px`, transition: isDragging ? 'none' : `transform 0.1s ease-out` }}/>
      </div>
    </div>
  );
};

// YENİ: Aktif durumunu görsel olarak yansıtan Profesyonel Fader
export const ProfessionalFader = ({
  value, min = -60, max = 6, onChange, height = 150, isActive
}) => {
  const faderRef = useRef(null);
  const valueToPosition = useCallback((val) => ((val - min) / (max - min)) * 100, [min, max]);

  const handleInteraction = useCallback((e) => {
      if (!faderRef.current) return;
      const rect = faderRef.current.getBoundingClientRect();
      const pos = 100 - Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      onChange?.(min + (pos / 100) * (max - min));
  }, [min, max, onChange]);

  const handleMouseDown = useCallback((e) => {
    handleInteraction(e);
    const handleMouseMove = (moveEvent) => handleInteraction(moveEvent);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', () => window.removeEventListener('mousemove', handleMouseMove), { once: true });
  }, [handleInteraction]);

  const position = valueToPosition(value);

  return (
    <div className="relative w-full flex items-center justify-center" style={{ height }}>
      <div ref={faderRef} className="relative w-2 h-full bg-black/50 rounded-full cursor-pointer" onMouseDown={handleMouseDown}>
        <div className={`absolute bottom-0 left-0 w-full rounded-full transition-colors duration-200 ${isActive ? 'bg-blue-500' : 'bg-gray-500'}`} style={{ height: `${position}%` }} />
      </div>
      <div className="absolute w-5 h-7 bg-gray-300 rounded-sm border-2 border-gray-400 shadow-md pointer-events-none" style={{ left: '50%', bottom: `calc(${position}% - 14px)`, transform: 'translateX(-50%)' }}/>
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