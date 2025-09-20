// src/features/piano_roll/components/ui/Minimap.jsx
import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import '../../styles/components/Minimap.css';

export const Minimap = React.memo(({ notes, selectedNotes, viewport, onNavigate }) => {
  const canvasRef = useRef(null);
  const MINIMAP_WIDTH = 200;
  const MINIMAP_HEIGHT = 120;

  const scaleFactors = useMemo(() => ({
    x: MINIMAP_WIDTH / viewport.gridWidth,
    y: MINIMAP_HEIGHT / viewport.gridHeight
  }), [viewport.gridWidth, viewport.gridHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_WIDTH * dpr;
    canvas.height = MINIMAP_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = 'rgba(17, 24, 39, 0.9)';
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Notes
    notes.forEach(note => {
      const rect = viewport.getNoteRect(note);
      ctx.fillStyle = selectedNotes.has(note.id) ? 'rgba(245, 158, 11, 0.9)' : 'rgba(59, 130, 246, 0.7)';
      ctx.fillRect(
        rect.x * scaleFactors.x,
        rect.y * scaleFactors.y,
        Math.max(1, rect.width * scaleFactors.x),
        Math.max(1, rect.height * scaleFactors.y)
      );
    });

    // Viewport indicator
    ctx.strokeStyle = 'rgba(0, 188, 212, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      viewport.scrollX * scaleFactors.x,
      viewport.scrollY * scaleFactors.y,
      viewport.containerWidth * scaleFactors.x,
      viewport.containerHeight * scaleFactors.y
    );
  }, [notes, viewport, scaleFactors, selectedNotes]);

  const handleClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xRatio = mouseX / rect.width;
    const yRatio = mouseY / rect.height;

    const targetScrollX = xRatio * viewport.gridWidth - viewport.containerWidth / 2;
    const targetScrollY = yRatio * viewport.gridHeight - viewport.containerHeight / 2;
    
    onNavigate?.(Math.max(0, targetScrollX), Math.max(0, targetScrollY));
  }, [viewport, onNavigate]);

  return (
    <div className="minimap">
      <canvas
        ref={canvasRef}
        className="minimap__canvas"
        onClick={handleClick}
        style={{ 
          width: MINIMAP_WIDTH, 
          height: MINIMAP_HEIGHT,
          cursor: 'pointer',
          border: '1px solid #374151',
          borderRadius: '4px'
        }}
      />
    </div>
  );
});
