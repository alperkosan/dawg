// Enhanced Minimap.jsx - Interactive overview with smooth navigation
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

const Minimap = ({ 
  notes, 
  viewport, 
  onNavigate, 
  className = '',
  selectedNotes = new Set()
}) => {
  const canvasRef = useRef(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // ✅ MINIMAP DIMENSIONS
  const MINIMAP_WIDTH = 220;
  const MINIMAP_HEIGHT = 140;
  
  // ✅ SCALE CALCULATIONS
  const scaleFactors = useMemo(() => {
    if (!viewport.gridWidth || !viewport.gridHeight) {
      return { x: 1, y: 1 };
    }
    
    return {
      x: MINIMAP_WIDTH / viewport.gridWidth,
      y: MINIMAP_HEIGHT / viewport.gridHeight
    };
  }, [viewport.gridWidth, viewport.gridHeight]);

  // ✅ VIEWPORT INDICATOR BOUNDS
  const viewportIndicator = useMemo(() => {
    const x = viewport.scrollX * scaleFactors.x;
    const y = viewport.scrollY * scaleFactors.y;
    const width = Math.min(MINIMAP_WIDTH, viewport.containerWidth * scaleFactors.x);
    const height = Math.min(MINIMAP_HEIGHT, viewport.containerHeight * scaleFactors.y);
    
    return { x, y, width, height };
  }, [viewport.scrollX, viewport.scrollY, viewport.containerWidth, viewport.containerHeight, scaleFactors]);

  // ✅ NOTE DENSITY CALCULATION
  const noteDensity = useMemo(() => {
    if (!notes || notes.length === 0) return [];
    
    // Create density grid for better visualization
    const gridSize = 8;
    const cellWidth = MINIMAP_WIDTH / gridSize;
    const cellHeight = MINIMAP_HEIGHT / gridSize;
    const density = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
    
    notes.forEach(note => {
      const rect = viewport.getNoteRect(note);
      const x = Math.floor((rect.x * scaleFactors.x) / cellWidth);
      const y = Math.floor((rect.y * scaleFactors.y) / cellHeight);
      
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        density[y][x]++;
      }
    });
    
    return density;
  }, [notes, viewport, scaleFactors]);

  // ✅ ENHANCED CANVAS RENDERING
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
    
    // 1. BACKGROUND WITH SUBTLE GRID
    const gradient = ctx.createLinearGradient(0, 0, 0, MINIMAP_HEIGHT);
    gradient.addColorStop(0, 'rgba(17, 24, 39, 0.95)'); // gray-900
    gradient.addColorStop(1, 'rgba(31, 41, 55, 0.95)'); // gray-800
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    
    // Grid lines for octaves
    ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)'; // gray-600
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 8; i++) {
      const y = (i / 8) * MINIMAP_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(MINIMAP_WIDTH, y);
      ctx.stroke();
    }
    
    // Bar lines
    const barsCount = 16; // Assuming 16 bars
    for (let i = 1; i < barsCount; i++) {
      const x = (i / barsCount) * MINIMAP_WIDTH;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, MINIMAP_HEIGHT);
      ctx.stroke();
    }
    
    // 2. NOTE DENSITY HEATMAP
    noteDensity.forEach((row, y) => {
      row.forEach((density, x) => {
        if (density > 0) {
          const intensity = Math.min(density / 10, 1); // Normalize density
          const alpha = 0.3 + (intensity * 0.7);
          ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`; // green-500
          
          const cellWidth = MINIMAP_WIDTH / noteDensity[0].length;
          const cellHeight = MINIMAP_HEIGHT / noteDensity.length;
          
          ctx.fillRect(
            x * cellWidth, 
            y * cellHeight, 
            cellWidth, 
            cellHeight
          );
        }
      });
    });
    
    // 3. INDIVIDUAL NOTES (if not too many)
    if (notes && notes.length < 200) {
      notes.forEach(note => {
        const rect = viewport.getNoteRect(note);
        const x = rect.x * scaleFactors.x;
        const y = rect.y * scaleFactors.y;
        const width = Math.max(1, rect.width * scaleFactors.x);
        const height = Math.max(1, rect.height * scaleFactors.y);
        
        // Different colors for selected vs normal notes
        if (selectedNotes.has(note.id)) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.9)'; // amber-500
          ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
          ctx.shadowBlur = 2;
        } else {
          const velocity = note.velocity || 0.8;
          ctx.fillStyle = `rgba(59, 130, 246, ${0.5 + velocity * 0.4})`; // blue-500
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }
        
        ctx.fillRect(x, y, width, height);
      });
    }
    
    // 4. VIEWPORT INDICATOR
    const { x: vx, y: vy, width: vw, height: vh } = viewportIndicator;
    
    // Viewport background
    ctx.fillStyle = 'rgba(0, 188, 212, 0.15)'; // cyan-500
    ctx.fillRect(vx, vy, vw, vh);
    
    // Viewport border with glow effect
    ctx.strokeStyle = 'rgba(0, 188, 212, 0.8)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 188, 212, 0.6)';
    ctx.shadowBlur = 4;
    ctx.strokeRect(vx, vy, vw, vh);
    
    // Corner indicators
    ctx.fillStyle = 'rgba(0, 188, 212, 1)';
    const cornerSize = 3;
    ctx.fillRect(vx - cornerSize/2, vy - cornerSize/2, cornerSize, cornerSize);
    ctx.fillRect(vx + vw - cornerSize/2, vy - cornerSize/2, cornerSize, cornerSize);
    ctx.fillRect(vx - cornerSize/2, vy + vh - cornerSize/2, cornerSize, cornerSize);
    ctx.fillRect(vx + vw - cornerSize/2, vy + vh - cornerSize/2, cornerSize, cornerSize);
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    
  }, [notes, viewport, scaleFactors, viewportIndicator, selectedNotes, noteDensity]);

  // ✅ CLICK/DRAG NAVIGATION
  const handleInteraction = useCallback((e, isDrag = false) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scaleFactors.x;
    const y = (e.clientY - rect.top) / scaleFactors.y;
    
    // Center the viewport on the clicked/dragged position
    const targetX = x - viewport.containerWidth / 2;
    const targetY = y - viewport.containerHeight / 2;
    
    onNavigate(
      Math.max(0, Math.min(viewport.gridWidth - viewport.containerWidth, targetX)),
      Math.max(0, Math.min(viewport.gridHeight - viewport.containerHeight, targetY))
    );
  }, [scaleFactors, viewport, onNavigate]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // Only left click
    
    setIsDragging(true);
    handleInteraction(e);
    
    const handleMouseMove = (moveEvent) => {
      handleInteraction(moveEvent, true);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handleInteraction]);

  // ✅ STATISTICS CALCULATION
  const stats = useMemo(() => {
    if (!notes || notes.length === 0) return null;
    
    const totalNotes = notes.length;
    const selectedCount = selectedNotes.size;
    const coverage = (notes.length / (viewport.gridWidth * viewport.gridHeight)) * 10000; // Percentage * 100
    
    return {
      total: totalNotes,
      selected: selectedCount,
      coverage: coverage.toFixed(1)
    };
  }, [notes, selectedNotes, viewport]);

  // ✅ KEYBOARD SHORTCUTS
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName.toLowerCase() === 'input') return;
      
      if (e.key === 'm' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isVisible || !notes || notes.length === 0) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="bg-gray-800/90 hover:bg-gray-700/90 border border-gray-600 rounded-lg p-2 text-gray-400 hover:text-white transition-all duration-200"
        title="Show minimap (Ctrl+M)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z"/>
        </svg>
      </button>
    );
  }

  return (
    <div 
      className={`bg-gray-900/95 backdrop-blur-sm border border-gray-600 rounded-lg shadow-2xl transition-all duration-200 ${
        isHovered ? 'border-gray-500 shadow-cyan-500/20' : ''
      } ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-gray-300">Overview</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Stats */}
          {stats && (
            <div className="text-xs text-gray-400 hidden sm:block">
              {stats.total} notes
              {stats.selected > 0 && ` (${stats.selected} selected)`}
            </div>
          )}
          
          {/* Close button */}
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
            title="Hide minimap (Ctrl+M)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      
      {/* CANVAS AREA */}
      <div className="p-3">
        <div className="relative">
          <canvas
            ref={canvasRef}
            className={`cursor-pointer border border-gray-600 rounded transition-all duration-150 ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            } ${isHovered ? 'border-gray-500' : ''}`}
            onMouseDown={handleMouseDown}
            onContextMenu={(e) => e.preventDefault()}
          />
          
          {/* OVERLAY CONTROLS */}
          <div className="absolute top-2 left-2 flex gap-1">
            {/* Zoom level indicator */}
            <div className="bg-black/60 text-white px-2 py-1 rounded text-xs font-mono backdrop-blur-sm">
              {Math.round(viewport.performanceInfo?.zoomLevel.x * 100 || 100)}%
            </div>
          </div>
          
          {/* NAVIGATION HINTS */}
          {isHovered && (
            <div className="absolute bottom-2 left-2 right-2 text-center">
              <div className="bg-black/80 text-white px-2 py-1 rounded text-xs backdrop-blur-sm">
                Click or drag to navigate
              </div>
            </div>
          )}
        </div>
        
        {/* LEGEND */}
        <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded"></div>
              <span>Notes</span>
            </div>
            {selectedNotes.size > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-amber-500 rounded"></div>
                <span>Selected</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 border border-cyan-400 rounded"></div>
              <span>Viewport</span>
            </div>
          </div>
          
          {/* Performance indicator */}
          {viewport.performanceInfo && (
            <div className="text-xs text-gray-500">
              {viewport.performanceInfo.visibilityRatio > 0.5 ? '🟢' : 
               viewport.performanceInfo.visibilityRatio > 0.2 ? '🟡' : '🔴'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Minimap;