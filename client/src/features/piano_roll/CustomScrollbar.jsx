import React, { useCallback, useRef } from 'react';

const CustomScrollbar = ({
  contentSize,
  viewportSize,
  scrollPosition,
  onScroll,
  orientation = 'horizontal'
}) => {
  const trackRef = useRef(null);

  // Sadece viewport içeriğe sığmıyorsa scrollbar'ı göster.
  if (viewportSize >= contentSize) {
    return null;
  }

  const isHorizontal = orientation === 'horizontal';
  const trackSize = isHorizontal ? 'width' : 'height';
  const thumbSize = (viewportSize / contentSize) * 100; // Yüzde olarak
  const thumbPosition = (scrollPosition / (contentSize - viewportSize)) * (100 - thumbSize);

  // Scrollbar'a tıklandığında veya sürüklendiğinde yeni pozisyonu hesaplar.
  const handlePointerMove = useCallback((e) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const percentage = isHorizontal
      ? (e.clientX - rect.left) / rect.width
      : (e.clientY - rect.top) / rect.height;
    
    onScroll(percentage * (contentSize - viewportSize));
  }, [trackRef, isHorizontal, onScroll, contentSize, viewportSize]);

  // Sürükleme bittiğinde olay dinleyicilerini kaldırır.
  const handlePointerUp = useCallback(() => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    document.body.style.cursor = 'default';
  }, [handlePointerMove]);

  // Sürüklemeyi başlatır.
  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    handlePointerMove(e); // Tıklanan yere anında atla
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    document.body.style.cursor = isHorizontal ? 'ew-resize' : 'ns-resize';
  }, [handlePointerMove, handlePointerUp, isHorizontal]);


  // Ana scrollbar stilini belirler.
  const trackStyle = {
    position: 'absolute',
    background: 'rgba(10, 10, 10, 0.5)',
    ...(isHorizontal
      ? { height: '12px', bottom: 0, left: 0, right: 0 }
      : { width: '12px', right: 0, top: 0, bottom: 0 })
  };

  // Sürüklenebilir başparmak (thumb) stilini belirler.
  const thumbStyle = {
    position: 'absolute',
    background: 'rgba(100, 116, 139, 0.7)',
    borderRadius: '6px',
    transition: 'background-color 150ms',
    willChange: 'transform',
    ...(isHorizontal
      ? { height: '100%', width: `${thumbSize}%`, left: `${thumbPosition}%` }
      : { width: '100%', height: `${thumbSize}%`, top: `${thumbPosition}%` })
  };

  return (
    <div
      ref={trackRef}
      style={trackStyle}
      onPointerDown={handlePointerDown}
      className="custom-scrollbar-track hover:bg-opacity-70"
    >
      <div style={thumbStyle} className="custom-scrollbar-thumb hover:bg-slate-500" />
    </div>
  );
};

export default React.memo(CustomScrollbar);
