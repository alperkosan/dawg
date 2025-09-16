import React, { useRef, useState, useCallback } from 'react';

export const EnhancedVelocityLane = ({ 
  notes, 
  selectedNotes, 
  viewport, 
  store,
  onVelocityChange 
}) => {
  const { 
    showVelocityLane, 
    velocityLaneHeight, 
    isVelocityLaneCollapsed,
    setVelocityLaneHeight,
    collapseVelocityLane,
    expandVelocityLane
  } = store;
  
  const [isDragging, setIsDragging] = useState(false);
  
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    
    const startY = e.clientY;
    const startHeight = velocityLaneHeight;
    
    const handleMouseMove = (moveEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = startHeight + deltaY;
      setVelocityLaneHeight(newHeight);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [velocityLaneHeight, setVelocityLaneHeight]);
  
  const handleDoubleClick = useCallback(() => {
    if (isVelocityLaneCollapsed) {
      expandVelocityLane();
    } else {
      collapseVelocityLane();
    }
  }, [isVelocityLaneCollapsed, expandVelocityLane, collapseVelocityLane]);
  
  if (!showVelocityLane) return null;
  
  return (
    <div 
      className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-600"
      style={{ height: velocityLaneHeight }}
    >
      {/* Resize Handle */}
      <div
        className={`absolute top-0 left-0 right-0 h-2 cursor-ns-resize transition-all duration-200 ${
          isDragging ? 'bg-cyan-500' : 'bg-gray-600 hover:bg-gray-500'
        }`}
        onMouseDown={handleResizeStart}
        onDoubleClick={handleDoubleClick}
        title="Drag to resize, double-click to collapse/expand"
      >
        <div className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 flex justify-center">
          <div className={`w-12 h-0.5 rounded ${isDragging ? 'bg-white' : 'bg-gray-400'}`} />
        </div>
      </div>
      
      {/* Keyboard Area */}
      <div className="absolute top-2 left-0 w-24 h-full bg-gray-800 border-r border-gray-600 flex items-center justify-center">
        <div className="text-gray-400 text-xs font-medium transform -rotate-90 whitespace-nowrap">
          {isVelocityLaneCollapsed ? 'VEL' : 'VELOCITY'}
        </div>
      </div>
      
      {/* Velocity Bars Area */}
      <div className="ml-24 relative h-full overflow-hidden" style={{ width: viewport.gridWidth }}>
        {/* Background Grid */}
        <div className="absolute inset-0">
          {[0.25, 0.5, 0.75, 1].map(level => (
            <div
              key={level}
              className="absolute left-0 right-0 border-t border-gray-700"
              style={{ bottom: `${level * 100}%` }}
            >
              {!isVelocityLaneCollapsed && (
                <div className="absolute right-2 -top-3 text-xs text-gray-500">
                  {Math.round(level * 127)}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Velocity Bars */}
        {notes.map(note => {
          const x = note.time * 40 * store.zoomX;
          const barHeight = Math.max(2, note.velocity * (velocityLaneHeight - 8));
          const isSelected = selectedNotes.has(note.id);
          
          return (
            <div
              key={note.id}
              className={`absolute bottom-1 cursor-ns-resize transition-all duration-150 ${
                isSelected 
                  ? 'bg-cyan-500 shadow-lg shadow-cyan-500/25' 
                  : 'bg-blue-500 hover:bg-blue-400'
              }`}
              style={{
                left: x + 8,
                width: Math.max(4, 32 * store.zoomX - 4),
                height: barHeight,
                opacity: isSelected ? 1 : 0.7
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                
                const startY = e.clientY;
                const startVelocity = note.velocity;
                
                const handleMouseMove = (moveEvent) => {
                  const deltaY = startY - moveEvent.clientY;
                  const velocityChange = deltaY / velocityLaneHeight;
                  const newVelocity = Math.max(0.01, Math.min(1, startVelocity + velocityChange));
                  onVelocityChange(note.id, newVelocity);
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
              title={`Velocity: ${Math.round(note.velocity * 127)}`}
            />
          );
        })}
      </div>
      
      {/* Collapse/Expand Button */}
      <button
        onClick={handleDoubleClick}
        className="absolute top-1 right-2 p-1 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
        title={isVelocityLaneCollapsed ? 'Expand velocity lane' : 'Collapse velocity lane'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {isVelocityLaneCollapsed ? (
            <path d="M7 14l5-5 5 5" />
          ) : (
            <path d="M17 10l-5 5-5-5" />
          )}
        </svg>
      </button>
    </div>
  );
};