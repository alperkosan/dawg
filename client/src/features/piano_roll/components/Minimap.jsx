import React, { useRef, useEffect, useMemo, useCallback } from 'react';

const Minimap = ({ notes, viewport, onNavigate, selectedNotes }) => {
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

    // Arka plan
    ctx.fillStyle = 'rgba(17, 24, 39, 0.9)';
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Notaları çiz
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

    // Görünür alanı (viewport) çiz
    ctx.strokeStyle = 'rgba(0, 188, 212, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      viewport.scrollX * scaleFactors.x,
      viewport.scrollY * scaleFactors.y,
      viewport.containerWidth * scaleFactors.x,
      viewport.containerHeight * scaleFactors.y
    );
  }, [notes, viewport, scaleFactors, selectedNotes]);

  // DÜZELTME: Bu fonksiyon artık navigasyonu doğru hesaplıyor
  const handleInteraction = useCallback((e) => {
    const minimapCanvas = e.currentTarget;
    if (!minimapCanvas) return;

    const rect = minimapCanvas.getBoundingClientRect();
    
    // 1. Fare pozisyonunu minimap canvas'ına göre al
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 2. Tıklama pozisyonunun oranını (yüzdesini) hesapla
    const xRatio = mouseX / rect.width;
    const yRatio = mouseY / rect.height;

    // 3. Bu oranı ana grid'in TAM boyutuna uygulayarak hedef kaydırma pozisyonunu bul
    const targetScrollX = xRatio * viewport.gridWidth;
    const targetScrollY = yRatio * viewport.gridHeight;

    // 4. Görünümü bu hedef pozisyona ortala
    const finalScrollX = targetScrollX - (viewport.containerWidth / 2);
    const finalScrollY = targetScrollY - (viewport.containerHeight / 2);
    
    // 5. Parent'tan gelen navigasyon fonksiyonunu çağır
    onNavigate(finalScrollX, finalScrollY);
  }, [viewport, onNavigate]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    
    handleInteraction(e); // İlk tıklamada git
    
    const handleMouseMove = (moveEvent) => {
      // Sürüklerken gitmeye devam et
      const minimapCanvas = canvasRef.current;
      if (minimapCanvas) {
          const rect = minimapCanvas.getBoundingClientRect();
          // Sadece minimap içindeyse etkileşime gir
          if (moveEvent.clientX >= rect.left && moveEvent.clientX <= rect.right &&
              moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom) {
              handleInteraction(moveEvent);
          }
      }
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handleInteraction]);

  return (
    <div className="minimap-container">
      <canvas
        ref={canvasRef}
        className={`cursor-pointer border border-gray-600 rounded ...`}
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
};

export default Minimap;
