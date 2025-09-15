import React, { useRef, useEffect, useState } from 'react';

const Minimap = ({ 
  notes, 
  viewport, 
  onNavigate, 
  className = '' 
}) => {
  const canvasRef = useRef(null);
  const [isVisible, setIsVisible] = useState(true);
  
  const MINIMAP_WIDTH = 200;
  const MINIMAP_HEIGHT = 120;
  const SCALE_X = MINIMAP_WIDTH / viewport.gridWidth;
  const SCALE_Y = MINIMAP_HEIGHT / viewport.gridHeight;
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = MINIMAP_WIDTH * dpr;
    canvas.height = MINIMAP_HEIGHT * dpr;
    canvas.style.width = `${MINIMAP_WIDTH}px`;
    canvas.style.height = `${MINIMAP_HEIGHT}px`;
    
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    
    // Notes
    ctx.fillStyle = '#3b82f6';
    notes.forEach(note => {
      const rect = viewport.getNoteRect(note);
      const x = rect.x * SCALE_X;
      const y = rect.y * SCALE_Y;
      const width = Math.max(1, rect.width * SCALE_X);
      const height = Math.max(1, rect.height * SCALE_Y);
      
      ctx.fillRect(x, y, width, height);
    });
    
    // Viewport indicator
    const viewX = viewport.scrollX * SCALE_X;
    const viewY = viewport.scrollY * SCALE_Y;
    const viewWidth = viewport.containerWidth * SCALE_X;
    const viewHeight = viewport.containerHeight * SCALE_Y;
    
    ctx.strokeStyle = '#00bcd4';
    ctx.lineWidth = 1;
    ctx.strokeRect(viewX, viewY, viewWidth, viewHeight);
    
    ctx.fillStyle = 'rgba(0, 188, 212, 0.1)';
    ctx.fillRect(viewX, viewY, viewWidth, viewHeight);
    
  }, [notes, viewport, SCALE_X, SCALE_Y]);
  
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / SCALE_X;
    const y = (e.clientY - rect.top) / SCALE_Y;
    
    onNavigate(
      x - viewport.containerWidth / 2,
      y - viewport.containerHeight / 2
    );
  };
  
  if (!isVisible || notes.length === 0) return null;
  
  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-lg p-2 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">Overview</span>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white text-xs"
        >
          ×
        </button>
      </div>
      
      <canvas
        ref={canvasRef}
        className="cursor-pointer border border-gray-600 rounded"
        onClick={handleClick}
      />
    </div>
  );
};

export default Minimap;