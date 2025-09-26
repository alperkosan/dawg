import React, { useRef, useEffect, useCallback } from 'react';
import { usePianoRollStore } from '../store/usePianoRollStore';
import { Viewport } from '../core/viewport';
import { Renderer } from '../core/renderer';
import { InteractionManager } from '../core/interactionManager';

const PianoRollCanvas = () => {
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);
  const interactionManagerRef = useRef(null);
  const isPanning = useRef(false);
  
  const viewport = usePianoRollStore((state) => state.viewport);
  const getVisibleNotes = usePianoRollStore((state) => state.getVisibleNotes);
  const currentTool = usePianoRollStore((state) => state.currentTool);

  // === RENDER DÖNGÜSÜ ===
  const renderLoop = useCallback(() => {
    if (!viewport) return;
    
    // GÖRÜNÜR NOTALARI AL
    const visibleNotes = getVisibleNotes();

    const renderer = new Renderer(canvasRef.current);
    renderer.clear();
    renderer.drawGrid(viewport);
    
    // NOTALARI ÇİZ
    renderer.drawNotes(viewport, visibleNotes);

    animationFrameId.current = requestAnimationFrame(renderLoop);
  }, [viewport, getVisibleNotes]);

  // === KURULUM (useEffect) ===
  // useEffect'i temizliyoruz. Artık viewport başlatma görevi burada değil.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!viewport) return; // viewport hazır olana kadar bekle

    // Canvas boyutunu ayarla
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    viewport.resize(rect.width, rect.height); // Viewport'a da haber ver

    // InteractionManager'ı başlat
    if (!interactionManagerRef.current) {
        interactionManagerRef.current = new InteractionManager(viewport);
    }
    
    animationFrameId.current = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [renderLoop, viewport]); // Bağımlılık sadece renderLoop ve viewport

  // === ETKİLEŞİM HANDLER'LARI ===
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !viewport) return;

    const handleWheel = (e) => {
      // Sadece Ctrl tuşuyla birlikte zoom yap
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        viewport.zoom(e.deltaY, e.offsetX, e.offsetY);
      }
      // Normal scroll için hiçbir şey yapma, scroll sync halledecek
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [viewport]); // Viewport değiştiğinde yeniden bağla

  const handleMouseDown = (e) => {
    if (e.button === 0 && interactionManagerRef.current) { // Sol tık
      interactionManagerRef.current.handleMouseDown(e.nativeEvent);
    }
    // Orta tuş ile pan etme
    if (e.button === 1) {
        canvasRef.current.style.cursor = 'grabbing';
    }
  };

  const handleMouseUp = (e) => {
    if (interactionManagerRef.current) {
      interactionManagerRef.current.handleMouseUp(e.nativeEvent);
    }
     if (e.button === 1) {
        canvasRef.current.style.cursor = 'grab';
    }
  };
  
  const handleMouseMove = (e) => {
    if (interactionManagerRef.current) {
        // Fare basılı olsun ya da olmasın, olayı yöneticiye gönder.
        // Yönetici, sürükleme durumuna göre ne yapacağına karar verecek.
        interactionManagerRef.current.handleMouseMove(e.nativeEvent);
        
        // Orta tuş ile pan etme
        if(e.buttons === 4) {
            viewport.pan(e.movementX, e.movementY);
        }
    }
  };

  const getCursor = () => {
    // İmleç yönetimini artık InteractionManager yapacağı için bu fonksiyonu sadeleştirebiliriz
    // veya tamamen kaldırıp, doğrudan InteractionManager'ın canvas stilini değiştirmesini sağlayabiliriz.
    // InteractionManager'daki çözümümüz zaten bunu yapıyor.
    switch (currentTool) {
      case 'pencil': return 'crosshair';
      case 'eraser': return 'not-allowed';
      default: return 'default'; // Varsayılan, manager değiştirecek
    }
  };

  const handleMouseLeave = () => {
    isPanning.current = false;
    canvasRef.current.style.cursor = 'grab';
    interactionManagerRef.current.handleMouseLeave();
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', cursor: getCursor() }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onContextMenu={(e) => e.preventDefault()} // Sağ tık menüsünü engelle
    />
  );
};

export default PianoRollCanvas;