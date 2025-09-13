import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import WindowControls from './WindowControls';

function DraggableWindow({
  id, title, children, position, size, onPositionChange, onSizeChange,
  minSize = { width: 200, height: 150 },
  zIndex = 'auto', onFocus, onClose, onMinimize, onMaximize, isMaximized
}) {
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    setIsMounted(true);
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, []);

  const handleClose = () => {
    setIsAnimatingOut(true);
    setTimeout(onClose, 150);
  };

  const windowStyle = {
    background: 'var(--color-surface)',
    border: `1px solid var(--color-border)`,
    borderRadius: 'var(--border-radius)',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    opacity: (isMounted && !isAnimatingOut) ? 1 : 0,
    transform: (isMounted && !isAnimatingOut) ? 'scale(1)' : 'scale(0.95)',
    transition: 'opacity 150ms ease-out, transform 150ms ease-out',
    zIndex,
  };

  const headerStyle = {
    background: 'var(--color-background)',
    color: 'var(--color-text)',
    fontSize: 'var(--font-size-body)',
    padding: 'var(--padding-controls)',
  };
  
  return (
    <Rnd
      size={isMaximized ? { width: '100%', height: '100%' } : size}
      position={isMaximized ? { x: 0, y: 0 } : position}
      minWidth={minSize.width} minHeight={minSize.height}
      dragHandleClassName="drag-handle"
      style={windowStyle}
      onMouseDown={onFocus}
      onDragStop={(e, d) => !isMaximized && onPositionChange({ x: d.x, y: d.y })}
      onResizeStop={(e, direction, ref, delta, pos) => {
        if (!isMaximized) {
          onSizeChange({ width: parseInt(ref.style.width, 10), height: parseInt(ref.style.height, 10) });
          onPositionChange(pos);
        }
      }}
      bounds="parent"
    >
      <div 
        ref={headerRef} 
        className="drag-handle flex justify-between items-center cursor-move rounded-t-lg"
        style={headerStyle}
      >
        <span className="font-bold">{title}</span>
        <WindowControls {...{ onMinimize, onMaximize, onClose: handleClose, isMaximized }} />
      </div>
      <div className="flex flex-col" style={{ height: `calc(100% - ${headerHeight}px)`}}>
        {children}
      </div>
    </Rnd>
  );
}

export default React.memo(DraggableWindow);