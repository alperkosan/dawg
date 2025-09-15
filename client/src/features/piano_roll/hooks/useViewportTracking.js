// src/features/piano_roll/useViewportTracking.js

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Piano Roll viewport'unu takip eden optimizasyon hook'u
 * Scroll pozisyonu ve görünür alanı izler
 */
export const useViewportTracking = (containerRef) => {
  const [viewport, setViewport] = useState({
    scrollLeft: 0,
    scrollTop: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0
  });
  
  const lastUpdateTime = useRef(0);
  const rafId = useRef(null);

  // Throttled scroll handler - 60fps'e optimize et
  const updateViewport = useCallback(() => {
    const now = performance.now();
    
    // 16ms'den daha sık güncelleme yapma (60fps limit)
    if (now - lastUpdateTime.current < 16) {
      rafId.current = requestAnimationFrame(updateViewport);
      return;
    }
    
    const container = containerRef.current;
    if (!container) return;
    
    const newViewport = {
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      width: container.clientWidth,
      height: container.clientHeight,
      x: container.scrollLeft,
      y: container.scrollTop
    };
    
    // Sadece önemli değişiklikler varsa state'i güncelle
    setViewport(prev => {
      const hasSignificantChange = 
        Math.abs(prev.scrollLeft - newViewport.scrollLeft) > 5 ||
        Math.abs(prev.scrollTop - newViewport.scrollTop) > 5 ||
        Math.abs(prev.width - newViewport.width) > 1 ||
        Math.abs(prev.height - newViewport.height) > 1;
        
      return hasSignificantChange ? newViewport : prev;
    });
    
    lastUpdateTime.current = now;
  }, [containerRef]);

  // Scroll event listener'ı kur
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // İlk viewport'u ayarla
    updateViewport();

    // Passive scroll listener - performans için
    const handleScroll = () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
      rafId.current = requestAnimationFrame(updateViewport);
    };

    container.addEventListener('scroll', handleScroll, { 
      passive: true,
      capture: false 
    });

    // Resize observer - container boyutu değiştiğinde
    const resizeObserver = new ResizeObserver(() => {
      updateViewport();
    });
    
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [updateViewport]);

  return viewport;
};