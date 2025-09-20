// src/features/piano_roll_v2/hooks/useTouchGestures.js
import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Piano Roll için dokunmatik hareketleri (pinch-to-zoom, pan) yöneten hook.
 */
export const useTouchGestures = ({ onZoom, onPan, containerRef }) => {
  const touchStateRef = useRef({
    lastDistance: 0,
    lastCenter: null,
  });

  const getDistance = (touches) => {
    const [t1, t2] = touches;
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  };

  const getCenter = (touches) => {
    const [t1, t2] = touches;
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };
  };

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      touchStateRef.current.lastDistance = getDistance(e.touches);
      touchStateRef.current.lastCenter = getCenter(e.touches);
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const newDist = getDistance(e.touches);
      const newCenter = getCenter(e.touches);
      
      const scale = newDist / touchStateRef.current.lastDistance;
      onZoom?.(scale, newCenter);

      touchStateRef.current.lastDistance = newDist;
      touchStateRef.current.lastCenter = newCenter;
    } else if (e.touches.length === 1 && touchStateRef.current.lastCenter) {
        // Pan logic can be added here if needed, but default scroll handles it
    }
  }, [onZoom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // Tarayıcının pasif dinleyici uyarılarını önlemek ve
    // preventDefault'un çalışmasını sağlamak için { passive: false } kullanılır.
    const options = { passive: false };

    container.addEventListener('touchstart', handleTouchStart, options);
    container.addEventListener('touchmove', handleTouchMove, options);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [containerRef, handleTouchStart, handleTouchMove]);
};