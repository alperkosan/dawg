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

  useEffect(() => {
    // Bileşen ilk render olduğunda animasyonlu giriş için
    const timer = setTimeout(() => setIsMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsAnimatingOut(true);
    setTimeout(onClose, 150); // Animasyonun bitmesini bekle
  };

  // RND bileşenine uygulanacak dinamik stil
  const rndStyle = {
    // Animasyonlar için
    opacity: (isMounted && !isAnimatingOut) ? 1 : 0,
    transform: (isMounted && !isAnimatingOut) ? 'scale(1)' : 'scale(0.95)',
    transition: 'opacity 150ms ease-out, transform 150ms ease-out',
    // zIndex, prop'tan geliyor
    zIndex,
    overflow: "auto"
  };

  return (
    <Rnd
      // 'window-base' sınıfı, tüm temel stil ve layout'u yönetir.
      className="window-base" 
      style={rndStyle}
      size={isMaximized ? { width: '100%', height: '100%' } : size}
      position={isMaximized ? { x: 0, y: 0 } : position}
      minWidth={minSize.width} minHeight={minSize.height}
      dragHandleClassName="window-header" // Sadece header'dan sürükle
      onMouseDown={onFocus}
      onDragStop={(e, d) => !isMaximized && onPositionChange({ x: d.x, y: d.y })}
      onResizeStop={(e, direction, ref, delta, pos) => {
        if (!isMaximized) {
          onSizeChange({ width: parseInt(ref.style.width, 10), height: parseInt(ref.style.height, 10) });
          onPositionChange(pos);
        }
      }}
      // Pencerelerin ana içerik alanının dışına taşmasını engelle
      bounds="parent" 
    >
      {/* Header */}
      <header ref={headerRef} className="window-header">
        <span className="window-title">{title}</span>
        <WindowControls {...{ onMinimize, onMaximize, onClose: handleClose, isMaximized }} />
      </header>
      {/* İçerik */}
      {/* 'window-content' sınıfı, içeriğin header'dan taşmamasını ve kalan alanı doldurmasını sağlar */}
      <div className="window-content">
        {children}
      </div>
    </Rnd>
  );
}

export default React.memo(DraggableWindow);

