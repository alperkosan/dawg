/**
 * ARRANGEMENT ENGINE HOOK
 *
 * Piano Roll'dan ilham alınarak yazılmış performanslı viewport yönetimi
 * - UIUpdateManager entegrasyonu
 * - Smooth scroll/zoom animasyonları
 * - Visible bounds hesaplama
 * - LOD (Level of Detail) sistemi
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { uiUpdateManager, UPDATE_PRIORITIES, UPDATE_FREQUENCIES } from '@/lib/core/UIUpdateManager.js';

// Constants
const TRACK_HEADER_WIDTH = 150;
const TIMELINE_HEIGHT = 40;
const PIXELS_PER_BEAT = 32;
const BEATS_PER_BAR = 4;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10.0;
const SMOOTHNESS = 0.2;

export function useArrangementEngine(containerRef, arrangement) {
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [renderTrigger, setRenderTrigger] = useState(0);

  const viewportRef = useRef({
    scrollX: 0,
    scrollY: 0,
    zoomX: 1.0,
    targetScrollX: 0,
    targetScrollY: 0,
    targetZoomX: 1.0
  });

  const isPanningRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setViewportSize({ width, height });
    });

    resizeObserver.observe(container);
    setViewportSize({
      width: container.clientWidth,
      height: container.clientHeight
    });

    // İlk render için viewport'u tetikle
    setRenderTrigger(Date.now());

    return () => resizeObserver.disconnect();
  }, [containerRef]);

  // Smooth viewport animation via UIUpdateManager
  useEffect(() => {
    const unsubscribe = uiUpdateManager.subscribe(
      'arrangement-viewport-animation',
      () => {
        const vp = viewportRef.current;
        let needsRender = false;

        const dx = vp.targetScrollX - vp.scrollX;
        const dy = vp.targetScrollY - vp.scrollY;
        const dZoom = vp.targetZoomX - vp.zoomX;

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

        if (Math.abs(dZoom) > 0.001) {
          vp.zoomX += dZoom * SMOOTHNESS;
          needsRender = true;
        } else {
          vp.zoomX = vp.targetZoomX;
        }

        if (needsRender) {
          setRenderTrigger(Date.now());
        }
      },
      UPDATE_PRIORITIES.NORMAL,
      UPDATE_FREQUENCIES.REALTIME
    );

    return () => unsubscribe();
  }, []);

  // Calculate dimensions (infinite tracks)
  const dimensions = useMemo(() => {
    const totalBars = arrangement?.length || 128;
    const totalBeats = totalBars * BEATS_PER_BAR;
    const trackHeight = 60;
    const tracks = arrangement?.tracks || [];

    // Virtual track count - sonsuz scroll için
    const MAX_VIRTUAL_TRACKS = 1000; // Sanal maksimum
    const minTracksNeeded = Math.max(tracks.length, 8); // En az 8 track göster

    return {
      totalWidth: totalBeats * PIXELS_PER_BEAT,
      totalHeight: MAX_VIRTUAL_TRACKS * trackHeight, // Sanal yükseklik
      actualTrackCount: tracks.length,
      virtualTrackCount: MAX_VIRTUAL_TRACKS,
      trackHeight,
      beatWidth: PIXELS_PER_BEAT
    };
  }, [arrangement]);

  // Calculate visible bounds (Piano Roll pattern)
  const viewport = useMemo(() => {
    const vp = viewportRef.current;
    const trackHeight = dimensions.trackHeight;

    // Visible area calculations
    const visibleWidth = viewportSize.width - TRACK_HEADER_WIDTH;
    const visibleHeight = viewportSize.height - TIMELINE_HEIGHT;

    // Beat range
    const startBeat = Math.max(0, Math.floor((vp.scrollX / (PIXELS_PER_BEAT * vp.zoomX))) - 2);
    const endBeat = Math.ceil((vp.scrollX + visibleWidth) / (PIXELS_PER_BEAT * vp.zoomX)) + 2;

    // Track range
    const startTrack = Math.max(0, Math.floor(vp.scrollY / trackHeight) - 1);
    const endTrack = Math.ceil((vp.scrollY + visibleHeight) / trackHeight) + 1;

    return {
      width: viewportSize.width,
      height: viewportSize.height,
      scrollX: vp.scrollX,
      scrollY: vp.scrollY,
      zoomX: vp.zoomX,
      visibleBeats: { start: startBeat, end: endBeat },
      visibleTracks: { start: startTrack, end: endTrack }
    };
  }, [viewportSize, dimensions.trackHeight, renderTrigger]);

  // LOD calculation (based on zoom)
  const lod = useMemo(() => {
    const zoom = viewportRef.current.zoomX;
    if (zoom < 0.25) return 4; // Very low detail
    if (zoom < 0.5) return 3;  // Low detail
    if (zoom < 1.0) return 2;  // Medium detail
    if (zoom < 2.0) return 1;  // High detail
    return 0; // Maximum detail
  }, [renderTrigger]);

  // Mouse wheel handler
  const handleWheel = useCallback((e) => {
    // ✅ CRITICAL: Prevent browser back/forward navigation on horizontal scroll
    e.preventDefault();

    const { deltaX, deltaY, ctrlKey, offsetX, offsetY } = e;
    const vp = viewportRef.current;

    if (ctrlKey) {
      // Zoom factor
      const zoomFactor = 1 - deltaY * 0.005;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, vp.zoomX * zoomFactor));

      // Mouse position in canvas space (screen pixels)
      const mouseScreenX = offsetX - TRACK_HEADER_WIDTH;
      const mouseScreenY = offsetY - TIMELINE_HEIGHT;

      // Calculate world coordinate under mouse (beats cinsinden, zoom'dan bağımsız)
      // scrollX + mouseScreenX = zoomed pixel position
      // Divide by (PIXELS_PER_BEAT * zoom) to get beats
      const PIXELS_PER_BEAT = 32;
      const worldBeatsX = (vp.scrollX + mouseScreenX) / (PIXELS_PER_BEAT * vp.zoomX);
      const worldBeatsY = (vp.scrollY + mouseScreenY) / (PIXELS_PER_BEAT * vp.zoomX);

      // Calculate new scroll position to keep same world coordinate under mouse
      let newScrollX = (worldBeatsX * PIXELS_PER_BEAT * newZoom) - mouseScreenX;
      let newScrollY = (worldBeatsY * PIXELS_PER_BEAT * newZoom) - mouseScreenY;

      // Calculate max scroll bounds
      const totalWidth = dimensions.totalWidth * newZoom;
      const totalHeight = dimensions.totalHeight; // Y zoom yok, sabit
      const maxScrollX = Math.max(0, totalWidth - (viewportSize.width - TRACK_HEADER_WIDTH));
      const maxScrollY = Math.max(0, totalHeight - (viewportSize.height - TIMELINE_HEIGHT));

      // Clamp scroll values
      newScrollX = Math.max(0, Math.min(maxScrollX, newScrollX));
      newScrollY = Math.max(0, Math.min(maxScrollY, newScrollY));

      // Direct update for zoom (disable smooth animation during zoom)
      vp.scrollX = newScrollX;
      vp.scrollY = newScrollY;
      vp.zoomX = newZoom;
      vp.targetScrollX = newScrollX;
      vp.targetScrollY = newScrollY;
      vp.targetZoomX = newZoom;

      // Immediate render trigger with timestamp
      setRenderTrigger(Date.now());
    } else {
      // Normal scroll
      vp.targetScrollX += deltaX;
      vp.targetScrollY += deltaY;

      // Clamp scroll targets
      const totalWidth = dimensions.totalWidth * vp.targetZoomX;
      const totalHeight = dimensions.totalHeight;
      const maxScrollX = Math.max(0, totalWidth - (viewportSize.width - TRACK_HEADER_WIDTH));
      const maxScrollY = Math.max(0, totalHeight - (viewportSize.height - TIMELINE_HEIGHT));

      vp.targetScrollX = Math.max(0, Math.min(maxScrollX, vp.targetScrollX));
      vp.targetScrollY = Math.max(0, Math.min(maxScrollY, vp.targetScrollY));
    }
  }, [dimensions, viewportSize]);

  // Setup wheel event listener with passive: false
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const wheelHandler = (e) => handleWheel(e);
    container.addEventListener('wheel', wheelHandler, { passive: false });

    return () => {
      container.removeEventListener('wheel', wheelHandler);
    };
  }, [handleWheel, containerRef]);

  // Mouse down handler (panning)
  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle button or Alt+Left
      isPanningRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, []);

  // Mouse move handler (panning)
  const handleMouseMove = useCallback((e) => {
    if (isPanningRef.current) {
      const dx = lastMousePosRef.current.x - e.clientX;
      const dy = lastMousePosRef.current.y - e.clientY;

      const vp = viewportRef.current;
      vp.targetScrollX = Math.max(0, vp.targetScrollX + dx);
      vp.targetScrollY = Math.max(0, vp.targetScrollY + dy);

      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  return {
    viewport,
    dimensions,
    lod,
    viewportRef, // Zoom butonları için viewport referansı
    eventHandlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp
    }
  };
}
