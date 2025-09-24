// lib/utils/zoomHandler.js
// Common zoom handling utilities

/**
 * Standard zoom factor calculation for mouse wheel events
 * @param {WheelEvent} event - The wheel event
 * @param {number} currentZoom - Current zoom level
 * @param {number} minZoom - Minimum zoom level (default: 0.1)
 * @param {number} maxZoom - Maximum zoom level (default: 5)
 * @returns {number} New zoom level
 */
export const calculateZoom = (event, currentZoom, minZoom = 0.1, maxZoom = 5) => {
  const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
  return Math.max(minZoom, Math.min(maxZoom, currentZoom * zoomFactor));
};

/**
 * Create a standardized wheel zoom handler
 * @param {function} setZoomState - State setter for zoom
 * @param {number} minZoom - Minimum zoom level
 * @param {number} maxZoom - Maximum zoom level
 * @returns {function} Wheel event handler
 */
export const createWheelZoomHandler = (setZoomState, minZoom = 0.1, maxZoom = 5) => {
  return (event, currentZoom) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();

      const newZoom = calculateZoom(event, currentZoom, minZoom, maxZoom);
      setZoomState(newZoom);

      return newZoom;
    }

    return currentZoom;
  };
};

/**
 * Create a mouse position-aware zoom handler for timelines/grids
 * @param {React.RefObject} containerRef - Container reference
 * @param {function} setZoom - Zoom state setter
 * @param {function} setScroll - Scroll position setter (optional)
 * @param {number} minZoom - Minimum zoom level
 * @param {number} maxZoom - Maximum zoom level
 * @returns {function} Wheel event handler
 */
export const createTimelineZoomHandler = (containerRef, setZoom, setScroll, minZoom = 0.1, maxZoom = 5) => {
  return (event, currentZoom) => {
    if ((event.ctrlKey || event.metaKey) && containerRef.current) {
      event.preventDefault();

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const currentScrollX = containerRef.current.scrollLeft || 0;
      const worldMouseX = mouseX + currentScrollX;

      const newZoom = calculateZoom(event, currentZoom, minZoom, maxZoom);
      setZoom(newZoom);

      // Adjust scroll to keep mouse position stable
      if (setScroll && newZoom !== currentZoom) {
        const newScrollX = worldMouseX - mouseX * (newZoom / currentZoom);
        setScroll(Math.max(0, newScrollX));
      }

      return newZoom;
    }

    return currentZoom;
  };
};