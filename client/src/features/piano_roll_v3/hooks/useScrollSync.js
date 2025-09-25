/**
 * @file useScrollSync.js
 * @description V3 için optimize edilmiş scroll synchronization hook'u
 */
import { useRef, useLayoutEffect, useCallback, useMemo } from 'react';
import { rafThrottle } from '../utils/performance';
import { usePianoRollV3Store } from '../store/usePianoRollV3Store';

export const useScrollSync = (mainContainerRef, syncTargets = []) => {
  const syncStateRef = useRef({
    isSyncing: false,
    lastScrollX: 0,
    lastScrollY: 0,
    rafId: null,
  });

  const setScroll = usePianoRollV3Store(state => state.setScroll);

  // Optimize edilmiş scroll handler
  const throttledSyncHandler = useMemo(() => {
    return rafThrottle((scrollX, scrollY) => {
      const syncState = syncStateRef.current;

      // Değişiklik var mı kontrol et
      if (syncState.lastScrollX === scrollX && syncState.lastScrollY === scrollY) {
        return;
      }

      syncState.lastScrollX = scrollX;
      syncState.lastScrollY = scrollY;
      syncState.isSyncing = true;

      // Store'u güncelle
      setScroll(scrollX, scrollY);

      // Sync target'ları güncelle
      syncTargets.forEach(({ ref, axis = 'both', transform = 'translate3d' }) => {
        if (!ref.current) return;

        let transformX = 0;
        let transformY = 0;

        if (axis === 'x' || axis === 'both') {
          transformX = -scrollX;
        }
        if (axis === 'y' || axis === 'both') {
          transformY = -scrollY;
        }

        // GPU accelerated transform kullan
        if (transform === 'translate3d') {
          ref.current.style.transform = `translate3d(${transformX}px, ${transformY}px, 0)`;
        } else {
          // Fallback için translateX/translateY
          if (axis === 'x') {
            ref.current.style.transform = `translateX(${transformX}px)`;
          } else if (axis === 'y') {
            ref.current.style.transform = `translateY(${transformY}px)`;
          } else {
            ref.current.style.transform = `translate(${transformX}px, ${transformY}px)`;
          }
        }

        // Will-change özelliğini optimize et
        if (!ref.current.style.willChange) {
          ref.current.style.willChange = 'transform';
        }
      });

      syncState.isSyncing = false;
    });
  }, [syncTargets, setScroll]);

  // Main scroll event handler
  const handleScroll = useCallback((e) => {
    if (syncStateRef.current.isSyncing) return;

    const element = e.target || e.currentTarget;
    if (!element) return;

    const { scrollLeft, scrollTop } = element;
    throttledSyncHandler(scrollLeft, scrollTop);
  }, [throttledSyncHandler]);

  // Wheel event handler (sync için)
  const handleWheel = useCallback((e) => {
    // Sadece sync için wheel handling - zoom zaten engine'de handle ediliyor
    if (e.ctrlKey || e.metaKey) return; // Zoom events'i skip et

    // Horizontal scrolling support
    if (e.shiftKey && Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
      e.preventDefault();
      const container = mainContainerRef.current;
      if (container) {
        container.scrollLeft += e.deltaY;
      }
    }
  }, [mainContainerRef]);

  // Touch gesture support (mobile)
  const touchStateRef = useRef({
    startX: 0,
    startY: 0,
    startScrollX: 0,
    startScrollY: 0,
    isTracking: false,
  });

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const container = mainContainerRef.current;
    if (!container) return;

    touchStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startScrollX: container.scrollLeft,
      startScrollY: container.scrollTop,
      isTracking: true,
    };
  }, [mainContainerRef]);

  const handleTouchMove = useCallback((e) => {
    if (!touchStateRef.current.isTracking || e.touches.length !== 1) return;

    e.preventDefault();

    const touch = e.touches[0];
    const container = mainContainerRef.current;
    if (!container) return;

    const touchState = touchStateRef.current;
    const deltaX = touchState.startX - touch.clientX;
    const deltaY = touchState.startY - touch.clientY;

    container.scrollLeft = touchState.startScrollX + deltaX;
    container.scrollTop = touchState.startScrollY + deltaY;
  }, [mainContainerRef]);

  const handleTouchEnd = useCallback(() => {
    touchStateRef.current.isTracking = false;
  }, []);

  // Setup event listeners
  useLayoutEffect(() => {
    const container = mainContainerRef.current;
    if (!container) return;

    // Scroll sync setup
    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Touch support
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    // İlk sync
    const initialScrollX = container.scrollLeft;
    const initialScrollY = container.scrollTop;
    if (initialScrollX > 0 || initialScrollY > 0) {
      throttledSyncHandler(initialScrollX, initialScrollY);
    }

    // Cleanup
    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);

      // RAF cleanup
      throttledSyncHandler.cancel?.();

      // Will-change cleanup
      syncTargets.forEach(({ ref }) => {
        if (ref.current) {
          ref.current.style.willChange = 'auto';
        }
      });
    };
  }, [
    mainContainerRef,
    handleScroll,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    throttledSyncHandler,
    syncTargets,
  ]);

  // Programatic scroll methods
  const scrollTo = useCallback((x, y, smooth = false) => {
    const container = mainContainerRef.current;
    if (!container) return;

    if (smooth) {
      container.scrollTo({
        left: x,
        top: y,
        behavior: 'smooth'
      });
    } else {
      container.scrollLeft = x;
      container.scrollTop = y;
    }
  }, [mainContainerRef]);

  const scrollBy = useCallback((deltaX, deltaY, smooth = false) => {
    const container = mainContainerRef.current;
    if (!container) return;

    if (smooth) {
      container.scrollBy({
        left: deltaX,
        top: deltaY,
        behavior: 'smooth'
      });
    } else {
      container.scrollLeft += deltaX;
      container.scrollTop += deltaY;
    }
  }, [mainContainerRef]);

  // Scroll to specific grid position
  const scrollToStep = useCallback((step, smooth = false) => {
    const container = mainContainerRef.current;
    if (!container) return;

    const grid = usePianoRollV3Store.getState().grid;
    const x = step * grid.stepWidth;
    scrollTo(x, container.scrollTop, smooth);
  }, [scrollTo]);

  const scrollToKey = useCallback((key, smooth = false) => {
    const container = mainContainerRef.current;
    if (!container) return;

    const grid = usePianoRollV3Store.getState().grid;
    const y = key * grid.keyHeight;
    scrollTo(container.scrollLeft, y, smooth);
  }, [scrollTo]);

  return {
    scrollTo,
    scrollBy,
    scrollToStep,
    scrollToKey,

    // Debug info
    getCurrentScroll: () => ({
      x: syncStateRef.current.lastScrollX,
      y: syncStateRef.current.lastScrollY,
    }),
  };
};