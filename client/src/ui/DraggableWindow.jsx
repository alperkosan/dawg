import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import WindowControls from './WindowControls';

function DraggableWindow({
  id,
  title,
  children,
  position,
  size,
  onPositionChange,
  onSizeChange,
  minSize = { width: 200, height: 150 },
  disableResizing = false,
  zIndex = 'auto',
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  isMaximized
}) {
  const [preMaximizeState, setPreMaximizeState] = useState(null);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // --- YENİ: Başlık çubuğunu referans alıp yüksekliğini state'te tutacağız ---
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    setIsMounted(true);
    // Bileşen render olduğunda başlık çubuğunun yüksekliğini ölç ve state'e yaz.
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, []); // Bu sadece bir kez çalışır.

  const handleClose = () => {
    setIsAnimatingOut(true);
    setTimeout(onClose, 150);
  };

  const handleMaximize = () => {
    if (isMaximized) {
      if (preMaximizeState) {
        onSizeChange(preMaximizeState.size);
        onPositionChange(preMaximizeState.position);
        setPreMaximizeState(null);
      }
    } else {
      setPreMaximizeState({ size, position });
    }
    if (onMaximize) onMaximize(id);
  };
  
  const windowClassName = [
    "draggable-window-container",
    "bg-gray-800", "border", "border-gray-700", "rounded-lg", "shadow-2xl", "flex", "flex-col",
    (isMounted && !isAnimatingOut) ? 'open' : ''
  ].join(' ');

  return (
    <Rnd
      size={isMaximized ? { width: '100%', height: '100%' } : size}
      position={isMaximized ? { x: 0, y: 0 } : position}
      minWidth={minSize.width} 
      minHeight={minSize.height}
      dragHandleClassName="drag-handle"
      className={windowClassName}
      onMouseDown={onFocus}
      onDragStop={(e, d) => {
        if (!isMaximized) onPositionChange({ x: d.x, y: d.y });
      }}
      onResizeStop={(e, direction, ref, delta, pos) => {
        if (!isMaximized) {
          onSizeChange({ 
            width: parseInt(ref.style.width, 10), 
            height: parseInt(ref.style.height, 10) 
          });
          onPositionChange(pos);
        }
      }}
      style={{ zIndex }}
      bounds="parent"
    >
      {/* --- YENİ: Başlık çubuğuna ref ekledik --- */}
      <div ref={headerRef} className="drag-handle bg-gray-900 text-white p-2 flex justify-between items-center cursor-move rounded-t-lg">
        <span className="font-bold">{title}</span>
        <WindowControls
          onMinimize={() => onMinimize(id, title)}
          onMaximize={handleMaximize}
          onClose={handleClose}
          isMaximized={isMaximized}
        />
      </div>
      {/* --- ANA DEĞİŞİKLİK: İçerik alanının yüksekliğini dinamik olarak hesaplıyoruz --- */}
      <div 
        className="flex flex-col" // flex-grow ve p-4 kaldırıldı, padding artık içeriğin sorumluluğunda
        style={{ 
            backgroundColor: 'var(--window-bg-body)',
            // Toplam yükseklikten başlık çubuğunun yüksekliğini çıkar
            height: `calc(100% - ${headerHeight}px)`
        }}
      >
        {children}
      </div>
    </Rnd>
  );
}

export default React.memo(DraggableWindow);