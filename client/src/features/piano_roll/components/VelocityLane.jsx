import React, { useRef, useEffect, useCallback } from 'react';
import { renderVelocityBars } from '../utils/renderUtils';

const VelocityBar = React.memo(({ 
  note, 
  isSelected, 
  viewport, 
  height, 
  onVelocityChange,
  onSelect 
}) => {
  const barRef = useRef(null);
  
  const x = viewport.timeToX(note.time);
  const barHeight = Math.max(2, note.velocity * height);
  const barWidth = viewport.stepWidth * 0.6;
  
  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    
    if (e.shiftKey) {
      onSelect(note.id, 'toggle');
    } else if (!isSelected) {
      onSelect(note.id, 'replace');
    }
    
    const startY = e.clientY;
    const startVelocity = note.velocity;
    
    const handleMouseMove = (moveEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const velocityChange = deltaY / height;
      const newVelocity = Math.max(0.01, Math.min(1, startVelocity + velocityChange));
      onVelocityChange(note.id, newVelocity);
    };
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [note, isSelected, onVelocityChange, onSelect, height]);
  
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const velocityChange = -e.deltaY * 0.001;
    const newVelocity = Math.max(0.01, Math.min(1, note.velocity + velocityChange));
    onVelocityChange(note.id, newVelocity);
  }, [note.velocity, onVelocityChange]);
  
  useEffect(() => {
    const element = barRef.current;
    if (!element) return;
    
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);
  
  return (
    <div
      ref={barRef}
      className="absolute bottom-0 cursor-ns-resize group"
      style={{
        left: x + viewport.stepWidth * 0.2,
        width: barWidth,
        height: height
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        className={`
          absolute bottom-0 w-full rounded-t transition-all duration-150
          ${isSelected 
            ? 'bg-cyan-500 shadow-lg shadow-cyan-500/25' 
            : 'bg-blue-500 hover:bg-blue-400'
          }
        `}
        style={{
          height: barHeight,
          opacity: isSelected ? 1 : 0.7
        }}
      />
      
      {/* Velocity value tooltip on hover */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {Math.round(note.velocity * 127)}
      </div>
    </div>
  );
});

const VelocityLane = ({ 
  notes, 
  selectedNotes, 
  viewport, 
  height, 
  onVelocityChange,
  onResize 
}) => {
  const canvasRef = useRef(null);
  const handleRef = useRef(null);
  
  // Render background grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = viewport.gridWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${viewport.gridWidth}px`;
    canvas.style.height = `${height}px`;
    
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, viewport.gridWidth, height);
    
    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    
    // Horizontal reference lines
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(viewport.gridWidth, y);
      ctx.stroke();
    }
    
    // Vertical beat lines
    const beatWidth = viewport.stepWidth * 4;
    for (let i = 0; i < viewport.gridWidth / beatWidth; i++) {
      const x = i * beatWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }, [viewport.gridWidth, viewport.stepWidth, height]);
  
  const handleSelect = useCallback((noteId, mode) => {
    // Implementation depends on parent component's selection logic
  }, []);
  
  if (height <= 0) return null;
  
  return (
    <div className="relative bg-gray-900 border-t border-gray-700">
      {/* Resize handle */}
      <div
        ref={handleRef}
        className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize bg-gray-600 hover:bg-gray-500 transition-colors"
        onMouseDown={(e) => {
          const startY = e.clientY;
          const startHeight = height;
          
          const handleMouseMove = (moveEvent) => {
            const deltaY = startY - moveEvent.clientY;
            const newHeight = Math.max(50, Math.min(300, startHeight + deltaY));
            onResize(newHeight);
          };
          
          const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
          };
          
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
        }}
      />
      
      {/* Keyboard spacer */}
      <div className="absolute left-0 top-0 w-24 h-full bg-gray-800 border-r border-gray-700" />
      
      {/* Main velocity area */}
      <div 
        className="ml-24 relative"
        style={{ width: viewport.gridWidth, height }}
      >
        {/* Background canvas */}
        <canvas 
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
        />
        
        {/* Velocity bars */}
        {notes.map(note => (
          <VelocityBar
            key={note.id}
            note={note}
            isSelected={selectedNotes.has(note.id)}
            viewport={viewport}
            height={height}
            onVelocityChange={onVelocityChange}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default VelocityLane;