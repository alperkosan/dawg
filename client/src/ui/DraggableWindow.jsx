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
  const [headerHeight, setHeaderHeight] = useState(38); // Varsayılan bir yükseklik

  useEffect(() => {
    // Bileşen ilk render olduğunda animasyonlu giriş için
    const timer = setTimeout(() => setIsMounted(true), 10);
    // Header'ın gerçek yüksekliğini ölç
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsAnimatingOut(true);
    setTimeout(onClose, 150); // Animasyonun bitmesini bekle
  };

  const rndStyle = {
    opacity: (isMounted && !isAnimatingOut) ? 1 : 0,
    transform: (isMounted && !isAnimatingOut) ? 'scale(1)' : 'scale(0.95)',
    transition: 'opacity 150ms ease-out, transform 150ms ease-out',
    zIndex,
    // ÖNEMLİ: Ana konteyner flexbox olmalı
    display: 'flex',
    flexDirection: 'column'
  };

  // İçerik (children) için yeni prop'lar oluşturuyoruz
  const contentStyle = {
    // Kalan tüm alanı doldur
    flexGrow: 1,
    // Scroll'u etkinleştir - auto ile ihtiyaç olduğunda scroll bar gösterir
    overflow: 'auto',
    // Yüksekliği dinamik olarak hesapla
    height: `calc(100% - ${headerHeight}px)`,
    // Minimum yükseklik belirle ki çok küçük window'larda da scroll çalışsın
    minHeight: '100px'
  };

  return (
    <Rnd
      className="window-base-new" // Çakışmayı önlemek için yeni bir sınıf adı
      style={rndStyle}
      size={isMaximized ? { width: '100%', height: '100%' } : size}
      position={isMaximized ? { x: 0, y: 0 } : position}
      minWidth={minSize.width} minHeight={minSize.height}
      dragHandleClassName="window-header"
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
      {/* Header */}
      <header ref={headerRef} className="window-header">
        <span className="window-title">{title}</span>
        <WindowControls {...{ onMinimize, onMaximize, onClose: handleClose, isMaximized }} />
      </header>
      {/* İçerik */}
      <div className="window-content-new" style={contentStyle}>
        {children}
      </div>
    </Rnd>
  );
}

export default React.memo(DraggableWindow);