/**
 * @file useScrollSync.js
 * @description Fixed scroll synchronization for timeline and keyboard
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
    isInitialized: false,
  });

  const setScroll = usePianoRollV3Store(state => state.setScroll);

  // Optimized sync handler with proper transform directions
  const throttledSyncHandler = useMemo(() => {
    return rafThrottle((scrollX, scrollY) => {
      const syncState = syncStateRef.current;

      // Check if there's an actual change
      if (syncState.lastScrollX === scrollX && syncState.lastScrollY === scrollY) {
        return;
      }

      syncState.lastScrollX = scrollX;
      syncState.lastScrollY = scrollY;
      syncState.isSyncing = true;

      // Update store only if not already syncing to prevent loops
      if (!syncState.isSyncing) {
        setScroll(scrollX, scrollY);
      }

      // Update sync targets with proper directions
      syncTargets.forEach(({ ref, axis = 'both' }) => {
        if (!ref.current) return;

        let transformValue = '';

        // Apply proper negative transforms for sync
        switch(axis) {
          case 'x':
            // Timeline - moves opposite to scroll direction
            transformValue = `translate3d(${-scrollX}px, 0, 0)`;
            break;
          case 'y':
            // Keyboard - moves opposite to scroll direction
            transformValue = `translate3d(0, ${-scrollY}px, 0)`;
            break;
          case 'both':
            transformValue = `translate3d(${-scrollX}px, ${-scrollY}px, 0)`;
            break;
          default:
            return;
        }

        // Apply transform
        ref.current.style.transform = transformValue;

        // Optimize rendering
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

  // Wheel event handler for horizontal scrolling
  const handleWheel = useCallback((e) => {
    // Skip if zooming
    if (e.ctrlKey || e.metaKey) return;

    const container = mainContainerRef.current;
    if (!container) return;

    // Horizontal scrolling with Shift+Wheel
    if (e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      
      // Use smooth scrolling for better UX
      const newScrollLeft = container.scrollLeft + e.deltaY;
      container.scrollLeft = Math.max(0, Math.min(newScrollLeft, container.scrollWidth - container.clientWidth));
      
      // Manually trigger sync for immediate response
      throttledSyncHandler(container.scrollLeft, container.scrollTop);
    }
  }, [mainContainerRef, throttledSyncHandler]);

  // Touch gesture support for mobile
  const touchStateRef = useRef({
    startX: 0,
    startY: 0,
    startScrollX: 0,
    startScrollY: 0,
    isTracking: false,
    lastTouchX: 0,
    lastTouchY: 0,
    velocityX: 0,
    velocityY: 0,
  });

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const container = mainContainerRef.current;
    if (!container) return;

    touchStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      lastTouchX: touch.clientX,
      lastTouchY: touch.clientY,
      startScrollX: container.scrollLeft,
      startScrollY: container.scrollTop,
      isTracking: true,
      velocityX: 0,
      velocityY: 0,
    };
  }, [mainContainerRef]);

  const handleTouchMove = useCallback((e) => {
    if (!touchStateRef.current.isTracking || e.touches.length !== 1) return;

    e.preventDefault();

    const touch = e.touches[0];
    const container = mainContainerRef.current;
    if (!container) return;

    const touchState = touchStateRef.current;
    
    // Calculate movement
    const deltaX = touchState.startX - touch.clientX;
    const deltaY = touchState.startY - touch.clientY;

    // Calculate velocity for momentum scrolling
    touchState.velocityX = touch.clientX - touchState.lastTouchX;
    touchState.velocityY = touch.clientY - touchState.lastTouchY;
    touchState.lastTouchX = touch.clientX;
    touchState.lastTouchY = touch.clientY;

    // Apply scroll
    const newScrollX = Math.max(0, Math.min(
      touchState.startScrollX + deltaX,
      container.scrollWidth - container.clientWidth
    ));
    const newScrollY = Math.max(0, Math.min(
      touchState.startScrollY + deltaY,
      container.scrollHeight - container.clientHeight
    ));

    container.scrollLeft = newScrollX;
    container.scrollTop = newScrollY;

    // Sync immediately for responsive feel
    throttledSyncHandler(newScrollX, newScrollY);
  }, [mainContainerRef, throttledSyncHandler]);

  const handleTouchEnd = useCallback(() => {
    const touchState = touchStateRef.current;
    if (!touchState.isTracking) return;

    touchState.isTracking = false;

    // Optional: Add momentum scrolling
    const container = mainContainerRef.current;
    if (container && (Math.abs(touchState.velocityX) > 5 || Math.abs(touchState.velocityY) > 5)) {
      // Simple momentum animation
      let momentumX = touchState.velocityX * 10;
      let momentumY = touchState.velocityY * 10;
      const friction = 0.95;

      const animateMomentum = () => {
        if (Math.abs(momentumX) > 0.5 || Math.abs(momentumY) > 0.5) {
          container.scrollLeft -= momentumX;
          container.scrollTop -= momentumY;
          momentumX *= friction;
          momentumY *= friction;
          requestAnimationFrame(animateMomentum);
        }
      };

      requestAnimationFrame(animateMomentum);
    }
  }, [mainContainerRef]);

  // Setup event listeners
  useLayoutEffect(() => {
    const container = mainContainerRef.current;
    if (!container) return;

    // Ensure containers are properly set up
    syncTargets.forEach(({ ref, axis }) => {
      if (ref.current) {
        // Set initial styles
        ref.current.style.position = 'relative';
        ref.current.style.willChange = 'transform';
        
        // Ensure proper overflow on parent containers
        const parent = ref.current.parentElement;
        if (parent) {
          if (axis === 'x') {
            parent.style.overflowX = 'hidden';
            parent.style.overflowY = 'visible';
          } else if (axis === 'y') {
            parent.style.overflowY = 'hidden';
            parent.style.overflowX = 'visible';
          }
        }
      }
    });

    // Add scroll listener
    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Touch support
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Initialize with current scroll position
    if (!syncStateRef.current.isInitialized) {
      const initialScrollX = container.scrollLeft || 0;
      const initialScrollY = container.scrollTop || 0;
      
      if (initialScrollX > 0 || initialScrollY > 0) {
        throttledSyncHandler(initialScrollX, initialScrollY);
      } else {
        // Ensure initial sync even at 0,0
        syncTargets.forEach(({ ref, axis }) => {
          if (ref.current) {
            ref.current.style.transform = 
              axis === 'x' ? 'translate3d(0, 0, 0)' :
              axis === 'y' ? 'translate3d(0, 0, 0)' :
              'translate3d(0, 0, 0)';
          }
        });
      }
      
      syncStateRef.current.isInitialized = true;
    }

    // Cleanup
    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);

      // Cancel any pending RAF
      if (throttledSyncHandler.cancel) {
        throttledSyncHandler.cancel();
      }

      // Reset will-change on cleanup
      syncTargets.forEach(({ ref }) => {
        if (ref.current) {
          ref.current.style.willChange = '';
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

  // Programmatic scroll methods
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

    // Immediately sync for programmatic scrolls
    throttledSyncHandler(x, y);
  }, [mainContainerRef, throttledSyncHandler]);

  const scrollBy = useCallback((deltaX, deltaY, smooth = false) => {
    const container = mainContainerRef.current;
    if (!container) return;

    const newX = container.scrollLeft + deltaX;
    const newY = container.scrollTop + deltaY;

    if (smooth) {
      container.scrollBy({
        left: deltaX,
        top: deltaY,
        behavior: 'smooth'
      });
    } else {
      container.scrollLeft = newX;
      container.scrollTop = newY;
    }

    throttledSyncHandler(newX, newY);
  }, [mainContainerRef, throttledSyncHandler]);

  // Grid-specific scroll helpers
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

  const centerOnNote = useCallback((step, key, smooth = true) => {
    const container = mainContainerRef.current;
    if (!container) return;

    const grid = usePianoRollV3Store.getState().grid;
    const viewport = usePianoRollV3Store.getState().viewport;

    // Calculate center positions
    const noteX = step * grid.stepWidth;
    const noteY = key * grid.keyHeight;
    
    const targetX = noteX - (viewport.width / 2) + (grid.stepWidth / 2);
    const targetY = noteY - (viewport.height / 2) + (grid.keyHeight / 2);

    scrollTo(
      Math.max(0, targetX),
      Math.max(0, targetY),
      smooth
    );
  }, [scrollTo]);

  return {
    // Scroll methods
    scrollTo,
    scrollBy,
    scrollToStep,
    scrollToKey,
    centerOnNote,

    // State getters
    getCurrentScroll: () => ({
      x: syncStateRef.current.lastScrollX,
      y: syncStateRef.current.lastScrollY,
    }),

    // Force sync (useful for initialization)
    forceSync: () => {
      const container = mainContainerRef.current;
      if (container) {
        throttledSyncHandler(container.scrollLeft, container.scrollTop);
      }
    },
  };
};