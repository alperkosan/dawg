/**
 * 🎨 ARRANGEMENT CANVAS HOOK
 *
 * Custom hook for canvas setup and rendering in ArrangementPanelV2
 * - Handles canvas sizing with devicePixelRatio
 * - Manages viewport state (zoom, pan, scroll)
 * - Animation loop using requestAnimationFrame
 * - Viewport culling for performance
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { uiUpdateManager, UPDATE_PRIORITIES, UPDATE_FREQUENCIES } from '@/lib/core/UIUpdateManager';

// ============================================================================
// CONSTANTS
// ============================================================================

const TIMELINE_HEIGHT = 40;
const TRACK_HEADER_WIDTH = 200;
const PIXELS_PER_BEAT = 48; // Base pixels per beat at zoom = 1
const MIN_ZOOM_X = 0.1;
const MAX_ZOOM_X = 10.0;
const MIN_ZOOM_Y = 0.5;
const MAX_ZOOM_Y = 3.0;
const SMOOTHNESS = 0.15; // Viewport smoothing factor
const DEFAULT_TRACK_HEIGHT = 80;

// ============================================================================
// HOOK
// ============================================================================

/**
 * Main canvas hook for arrangement panel
 */
export function useArrangementCanvas(containerRef, tracks = []) {
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [, setRenderTrigger] = useState(0);

  // Viewport state with smooth animation targets
  const viewportRef = useRef({
    scrollX: 0,
    scrollY: 0,
    zoomX: 1.0,
    zoomY: 1.0,
    targetScrollX: 0,
    targetScrollY: 0,
    targetZoomX: 1.0,
    targetZoomY: 1.0
  });

  // Interaction state
  const isPanningRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // ============================================================================
  // VIEWPORT DIMENSIONS & LOD
  // ============================================================================

  const dimensions = useMemo(() => {
    const vp = viewportRef.current;
    const pixelsPerBeat = PIXELS_PER_BEAT * vp.zoomX;

    // Calculate total dimensions
    const totalBeats = 3996; // 999 bars * 4 beats
    const totalWidth = totalBeats * pixelsPerBeat;

    const trackCount = Math.max(tracks.length, 100); // Minimum 100 virtual tracks
    const trackHeight = DEFAULT_TRACK_HEIGHT * vp.zoomY;
    const totalHeight = trackCount * trackHeight;

    return {
      pixelsPerBeat,
      trackHeight,
      totalWidth,
      totalHeight,
      trackCount,
      totalBeats
    };
  }, [tracks.length, viewportRef.current.zoomX, viewportRef.current.zoomY]);

  // LOD (Level of Detail) based on zoom level
  const lod = useMemo(() => {
    const pixelsPerBeat = PIXELS_PER_BEAT * viewportRef.current.zoomX;
    if (pixelsPerBeat < 4) return 4;   // Ultra zoomed out
    if (pixelsPerBeat < 12) return 3;  // Very zoomed out
    if (pixelsPerBeat < 24) return 2;  // Zoomed out
    if (pixelsPerBeat < 48) return 1;  // Normal
    return 0;                          // Zoomed in
  }, [viewportRef.current.zoomX]);

  // Visible viewport ranges (for culling)
  const visibleRanges = useMemo(() => {
    const vp = viewportRef.current;
    const { pixelsPerBeat, trackHeight } = dimensions;

    // Calculate visible beat range
    const startBeat = Math.floor(vp.scrollX / pixelsPerBeat);
    const endBeat = Math.ceil((vp.scrollX + viewportSize.width - TRACK_HEADER_WIDTH) / pixelsPerBeat) + 1;

    // Calculate visible track range
    const startTrack = Math.floor(vp.scrollY / trackHeight);
    const endTrack = Math.ceil((vp.scrollY + viewportSize.height - TIMELINE_HEIGHT) / trackHeight) + 1;

    return {
      beats: { start: Math.max(0, startBeat), end: endBeat },
      tracks: { start: Math.max(0, startTrack), end: Math.min(dimensions.trackCount, endTrack) }
    };
  }, [viewportRef.current.scrollX, viewportRef.current.scrollY, viewportSize, dimensions]);

  // ============================================================================
  // RESIZE OBSERVER
  // ============================================================================

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      console.log('🔄 Arrangement canvas resized:', { width, height });
      setViewportSize({ width, height });
      setRenderTrigger(Date.now());
    });

    resizeObserver.observe(container);
    setViewportSize({
      width: container.clientWidth,
      height: container.clientHeight
    });

    return () => resizeObserver.disconnect();
  }, [containerRef]);

  // ============================================================================
  // SMOOTH VIEWPORT ANIMATION
  // ============================================================================

  useEffect(() => {
    const unsubscribe = uiUpdateManager.subscribe(
      'arrangement-v2-viewport-animation',
      () => {
        const vp = viewportRef.current;
        let needsRender = false;

        // Smooth scrolling
        const dx = vp.targetScrollX - vp.scrollX;
        const dy = vp.targetScrollY - vp.scrollY;

        if (Math.abs(dx) > 0.1) {
          vp.scrollX += dx * SMOOTHNESS;
          needsRender = true;
        } else {
          vp.scrollX = vp.targetScrollX;
        }

        if (Math.abs(dy) > 0.1) {
          vp.scrollY += dy * SMOOTHNESS;
          needsRender = true;
        } else {
          vp.scrollY = vp.targetScrollY;
        }

        // Smooth zooming
        const dZoomX = vp.targetZoomX - vp.zoomX;
        const dZoomY = vp.targetZoomY - vp.zoomY;

        if (Math.abs(dZoomX) > 0.001) {
          vp.zoomX += dZoomX * SMOOTHNESS;
          needsRender = true;
        } else {
          vp.zoomX = vp.targetZoomX;
        }

        if (Math.abs(dZoomY) > 0.001) {
          vp.zoomY += dZoomY * SMOOTHNESS;
          needsRender = true;
        } else {
          vp.zoomY = vp.targetZoomY;
        }

        if (needsRender) {
          setRenderTrigger(Date.now());
        }
      },
      UPDATE_PRIORITIES.LOW, // Can be skipped if frame budget exceeded
      UPDATE_FREQUENCIES.REALTIME // 60fps attempt - frame budget decides
    );

    return unsubscribe;
  }, []);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  // Wheel handler (zoom + scroll)
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const { deltaX, deltaY, ctrlKey, offsetX, offsetY } = e;
    const vp = viewportRef.current;

    if (ctrlKey) {
      // Zoom mode
      const zoomFactor = 1 - deltaY * 0.005;
      const newZoomX = Math.max(MIN_ZOOM_X, Math.min(MAX_ZOOM_X, vp.zoomX * zoomFactor));
      const newZoomY = Math.max(MIN_ZOOM_Y, Math.min(MAX_ZOOM_Y, vp.zoomY * zoomFactor));

      // Calculate mouse position in world space
      const mouseX = offsetX - TRACK_HEADER_WIDTH;
      const mouseY = offsetY - TIMELINE_HEIGHT;

      // Protect against division by zero or NaN
      const safeZoomX = Math.max(MIN_ZOOM_X, vp.zoomX || 1);
      const safeZoomY = Math.max(MIN_ZOOM_Y, vp.zoomY || 1);

      const worldX = (vp.scrollX + mouseX) / safeZoomX;
      const worldY = (vp.scrollY + mouseY) / safeZoomY;

      // Calculate new scroll to keep mouse position fixed
      let newScrollX = (worldX * newZoomX) - mouseX;
      let newScrollY = (worldY * newZoomY) - mouseY;

      // Protect against NaN propagation
      if (!isFinite(newScrollX)) newScrollX = vp.scrollX || 0;
      if (!isFinite(newScrollY)) newScrollY = vp.scrollY || 0;

      // Apply immediately for responsive zoom
      vp.scrollX = newScrollX;
      vp.scrollY = newScrollY;
      vp.zoomX = newZoomX;
      vp.zoomY = newZoomY;
      vp.targetScrollX = newScrollX;
      vp.targetScrollY = newScrollY;
      vp.targetZoomX = newZoomX;
      vp.targetZoomY = newZoomY;

      setRenderTrigger(Date.now());
    } else {
      // Scroll mode (smooth animation)
      vp.targetScrollX += deltaX;
      vp.targetScrollY += deltaY;

      // Clamp scroll bounds
      const maxScrollX = Math.max(0, dimensions.totalWidth - (viewportSize.width - TRACK_HEADER_WIDTH));
      const maxScrollY = Math.max(0, dimensions.totalHeight - (viewportSize.height - TIMELINE_HEIGHT));
      vp.targetScrollX = Math.max(0, Math.min(maxScrollX, vp.targetScrollX));
      vp.targetScrollY = Math.max(0, Math.min(maxScrollY, vp.targetScrollY));
    }
  }, [dimensions, viewportSize]);

  // Mouse down handler (middle-click pan)
  const handleMouseDown = useCallback((e) => {
    if (e.button === 1) {
      // Middle mouse button - pan mode
      isPanningRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.style.cursor = 'grabbing';
    }
  }, []);

  // Mouse move handler
  const handleMouseMove = useCallback((e) => {
    if (isPanningRef.current) {
      const vp = viewportRef.current;
      const deltaX = e.clientX - lastMousePosRef.current.x;
      const deltaY = e.clientY - lastMousePosRef.current.y;

      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      vp.targetScrollX -= deltaX;
      vp.targetScrollY -= deltaY;

      // Clamp scroll bounds
      const maxScrollX = Math.max(0, dimensions.totalWidth - (viewportSize.width - TRACK_HEADER_WIDTH));
      const maxScrollY = Math.max(0, dimensions.totalHeight - (viewportSize.height - TIMELINE_HEIGHT));
      vp.targetScrollX = Math.max(0, Math.min(maxScrollX, vp.targetScrollX));
      vp.targetScrollY = Math.max(0, Math.min(maxScrollY, vp.targetScrollY));
    }
  }, [dimensions, viewportSize]);

  // Mouse up handler
  const handleMouseUp = useCallback((e) => {
    if (e.button === 1) {
      isPanningRef.current = false;
      e.currentTarget.style.cursor = 'default';
    }
  }, []);

  // Mouse leave handler
  const handleMouseLeave = useCallback((e) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      e.currentTarget.style.cursor = 'default';
    }
  }, []);

  // Zoom handler (for toolbar and keyboard shortcuts)
  const handleZoom = useCallback((newZoomX, newZoomY) => {
    const vp = viewportRef.current;

    // Clamp zoom values
    const clampedZoomX = Math.max(MIN_ZOOM_X, Math.min(MAX_ZOOM_X, newZoomX));
    const clampedZoomY = Math.max(MIN_ZOOM_Y, Math.min(MAX_ZOOM_Y, newZoomY));

    // Apply zoom
    vp.zoomX = clampedZoomX;
    vp.zoomY = clampedZoomY;
    vp.targetZoomX = clampedZoomX;
    vp.targetZoomY = clampedZoomY;

    setRenderTrigger(Date.now());
  }, []);

  // ============================================================================
  // CANVAS SETUP HELPER
  // ============================================================================

  const setupCanvas = useCallback((canvas) => {
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Only resize if dimensions changed
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      console.log('🎨 Canvas resizing:', {
        canvasId: canvas.id || canvas.className,
        from: { w: canvas.width / dpr, h: canvas.height / dpr },
        to: { w: rect.width, h: rect.height },
        dpr
      });
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      // ✅ FIX: Reset transform before scaling to avoid double-scaling
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    } else {
      // ✅ FIX: Ensure scale is applied even if dimensions didn't change
      // This handles cases where context was reset
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    return ctx;
  }, []);

  // ============================================================================
  // RETURN VALUE
  // ============================================================================

  return {
    // Viewport state
    viewport: {
      ...viewportRef.current,
      width: viewportSize.width,
      height: viewportSize.height,
      visibleBeats: visibleRanges.beats,
      visibleTracks: visibleRanges.tracks
    },

    // Dimensions
    dimensions,
    lod,

    // Event handlers
    eventHandlers: {
      onWheel: handleWheel,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
      onZoom: handleZoom
    },

    // Utilities
    setupCanvas,

    // Constants (for components to use)
    constants: {
      TIMELINE_HEIGHT,
      TRACK_HEADER_WIDTH,
      PIXELS_PER_BEAT
    }
  };
}
