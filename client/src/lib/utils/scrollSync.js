// lib/utils/scrollSync.js
// Common scroll synchronization utilities

/**
 * Create a scroll synchronization handler
 * @param {React.RefObject} sourceRef - Main scroll container reference
 * @param {Array<{ref: React.RefObject, axis: 'x'|'y'|'both'}>} targets - Target containers to sync
 * @returns {function} Cleanup function
 */
export const createScrollSynchronizer = (sourceRef, targets) => {
  const handleScroll = () => {
    if (!sourceRef.current) return;

    const { scrollLeft, scrollTop } = sourceRef.current;

    targets.forEach(({ ref, axis = 'both' }) => {
      if (!ref.current) return;

      if (axis === 'x' || axis === 'both') {
        ref.current.scrollLeft = scrollLeft;
      }
      if (axis === 'y' || axis === 'both') {
        ref.current.scrollTop = scrollTop;
      }
    });
  };

  // Add event listener
  if (sourceRef.current) {
    sourceRef.current.addEventListener('scroll', handleScroll, { passive: true });
  }

  // Return cleanup function
  return () => {
    if (sourceRef.current) {
      sourceRef.current.removeEventListener('scroll', handleScroll);
    }
  };
};

/**
 * Create a wheel event forwarder for synchronized scrolling
 * @param {React.RefObject} sourceRef - Source container
 * @param {React.RefObject} targetRef - Target container that receives wheel events
 * @param {string} axis - Which axis to forward ('x'|'y'|'both')
 * @returns {function} Cleanup function
 */
export const createWheelForwarder = (sourceRef, targetRef, axis = 'y') => {
  const handleWheel = (e) => {
    if (!targetRef.current) return;

    // Only forward vertical wheel events by default (for instrument list -> main grid)
    if (axis === 'y' && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      targetRef.current.scrollTop += e.deltaY;
    } else if (axis === 'x' && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      targetRef.current.scrollLeft += e.deltaX;
    } else if (axis === 'both') {
      e.preventDefault();
      targetRef.current.scrollTop += e.deltaY;
      targetRef.current.scrollLeft += e.deltaX;
    }
  };

  // Add event listener
  if (sourceRef.current) {
    sourceRef.current.addEventListener('wheel', handleWheel, { passive: false });
  }

  // Return cleanup function
  return () => {
    if (sourceRef.current) {
      sourceRef.current.removeEventListener('wheel', handleWheel);
    }
  };
};

// Note: useScrollSync hook would require React import
// For now, use createScrollSynchronizer and createWheelForwarder directly in components