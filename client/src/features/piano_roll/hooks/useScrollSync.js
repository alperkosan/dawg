// src/features/piano_roll/hooks/useScrollSync.js
import { useCallback, useEffect, useRef, useState } from 'react';

export const useScrollSync = ({
  mainContainerRef,
  rulerContentRef,
  keyboardContentRef,
  onScrollChange
}) => {
  const [scrollState, setScrollState] = useState({ x: 0, y: 0 });
  const isScrollingRef = useRef(false);
  const scrollTimeout = useRef(null);
  const rafId = useRef(null);

  // Throttled scroll handler - 60fps'e optimize edilmiş
  const handleScroll = useCallback(() => {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
    }

    rafId.current = requestAnimationFrame(() => {
      const container = mainContainerRef.current;
      if (!container) return;

      const newScrollX = container.scrollLeft;
      const newScrollY = container.scrollTop;

      // Sadece önemli değişikliklerde update et
      if (
        Math.abs(scrollState.x - newScrollX) > 1 ||
        Math.abs(scrollState.y - newScrollY) > 1
      ) {
        setScrollState({ x: newScrollX, y: newScrollY });

        // Ruler ve keyboard senkronizasyonu - GPU accelerated
        if (rulerContentRef.current) {
          rulerContentRef.current.style.transform = `translate3d(${-newScrollX}px, 0, 0)`;
        }

        if (keyboardContentRef.current) {
          keyboardContentRef.current.style.transform = `translate3d(0, ${-newScrollY}px, 0)`;
        }

        // Parent'a scroll değişikliğini bildir
        onScrollChange?.({ x: newScrollX, y: newScrollY });
      }

      // Scroll durma tespiti
      isScrollingRef.current = true;
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      
      scrollTimeout.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 150);
    });
  }, [mainContainerRef, rulerContentRef, keyboardContentRef, scrollState, onScrollChange]);

  // Programmatic scroll fonksiyonu
  const scrollTo = useCallback((x, y, smooth = false) => {
    const container = mainContainerRef.current;
    if (!container) return;

    container.scrollTo({
      left: x,
      top: y,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }, [mainContainerRef]);

  // Scroll listener'ı kur
  useEffect(() => {
    const container = mainContainerRef.current;
    if (!container) return;

    // Passive scroll listener - performans için
    container.addEventListener('scroll', handleScroll, {
      passive: true,
      capture: false
    });

    // İlk scroll state'ini ayarla
    setScrollState({
      x: container.scrollLeft,
      y: container.scrollTop
    });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [handleScroll, mainContainerRef]);

  // Smooth zoom to region
  const zoomToRect = useCallback((rect, padding = 50) => {
    const container = mainContainerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Merkeze hizalama hesabı
    const targetX = rect.x - (containerWidth - rect.width) / 2;
    const targetY = rect.y - (containerHeight - rect.height) / 2;

    // Padding ile clamp et
    const clampedX = Math.max(0, Math.min(targetX, container.scrollWidth - containerWidth));
    const clampedY = Math.max(0, Math.min(targetY, container.scrollHeight - containerHeight));

    scrollTo(clampedX, clampedY, true);
  }, [mainContainerRef, scrollTo]);

  // Notaları merkeze getir
  const centerOnNotes = useCallback((notes, coordinateSystem) => {
    if (!notes.length) return;

    // Tüm notaları kapsayan bounding box hesapla
    const rects = notes.map(note => coordinateSystem.getNoteRect(note));
    const minX = Math.min(...rects.map(r => r.x));
    const minY = Math.min(...rects.map(r => r.y));
    const maxX = Math.max(...rects.map(r => r.x + r.width));
    const maxY = Math.max(...rects.map(r => r.y + r.height));

    const boundingRect = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };

    zoomToRect(boundingRect);
  }, [zoomToRect]);

  return {
    // Current state
    scrollX: scrollState.x,
    scrollY: scrollState.y,
    isScrolling: isScrollingRef.current,

    // Actions
    scrollTo,
    zoomToRect,
    centerOnNotes,

    // State for external use
    scrollState
  };
};