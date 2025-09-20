// src/features/piano_roll/components/ui/VelocityLane.jsx
import React, { useRef, useEffect, useCallback } from 'react';
import { clamp } from '../../utils/core/noteUtils';
import '../../styles/components/VelocityLane.css';

const VelocityBar = React.memo(({ 
  note, 
  isSelected, 
  viewport, 
  height, 
  onVelocityChange 
}) => {
  const x = viewport.timeToX(note.time);
  const barHeight = Math.max(2, note.velocity * height);
  const barWidth = viewport.stepWidth * 0.6;
  
  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    
    const startY = e.clientY;
    const startVelocity = note.velocity;
    
    const handleMouseMove = (moveEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const velocityChange = deltaY / height;
      const newVelocity = clamp(startVelocity + velocityChange, 0.01, 1);
      onVelocityChange(note.id, newVelocity);
    };
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [note, height, onVelocityChange]);
  
  return (
    <div
      className="velocity-bar"
      style={{
        position: 'absolute',
        left: x + viewport.stepWidth * 0.2,
        bottom: 0,
        width: barWidth,
        height: height,
        cursor: 'ns-resize'
      }}
      onMouseDown={handleMouseDown}
      title={`Velocity: ${Math.round(note.velocity * 127)}`}
    >
      <div
        className={`velocity-bar__fill ${isSelected ? 'velocity-bar__fill--selected' : ''}`}
        style={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          height: barHeight,
          backgroundColor: isSelected ? '#00bcd4' : '#3b82f6',
          borderRadius: '2px 2px 0 0',
          opacity: isSelected ? 1 : 0.7
        }}
      />
    </div>
  );
});

export const VelocityLane = React.memo(({ 
  notes, 
  selectedNotes, 
  viewport, 
  height, 
  onHeightChange,
  onNotesChange 
}) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || height <= 0) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewport.gridWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${viewport.gridWidth}px`;
    canvas.style.height = `${height}px`;
    
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, viewport.gridWidth, height);
    
    // Background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, viewport.gridWidth, height);
    
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

  const handleVelocityChange = useCallback((noteId, velocity) => {
    const updatedNotes = notes.map(note => 
      note.id === noteId ? { ...note, velocity } : note
    );
    onNotesChange(updatedNotes);
  }, [notes, onNotesChange]);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;
    
    const handleResizeMove = (moveEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = clamp(startHeight + deltaY, 30, 300);
      onHeightChange(newHeight);
    };
    
    const handleResizeUp = () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeUp);
    };
    
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
  }, [height, onHeightChange]);

  if (height <= 0) return null;

  return (
    <div className="velocity-lane" style={{ height }}>
      {/* Resize handle */}
      <div 
        className="velocity-lane__resize-handle"
        onMouseDown={handleResizeStart}
      />
      
      {/* Keyboard spacer */}
      <div className="velocity-lane__spacer" />
      
      {/* Main velocity area */}
      <div className="velocity-lane__content" style={{ width: viewport.gridWidth }}>
        <canvas ref={canvasRef} className="velocity-lane__canvas" />
        {notes.map(note => (
          <VelocityBar
            key={note.id}
            note={note}
            isSelected={selectedNotes.has(note.id)}
            viewport={viewport}
            height={height}
            onVelocityChange={handleVelocityChange}
          />
        ))}
      </div>
    </div>
  );
});
