/**
 * @file useVirtualizedEngine.js
 * @description Infinite scroll ve LOD destekli virtualized rendering engine
 */
import { useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { usePianoRollV3Store } from '../store/usePianoRollV3Store';
import { throttle } from '../utils/performance';

// Note mapping - MIDI note sayısından pitch string'e
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const getNoteInfo = (keyIndex) => {
  const midiNote = 108 - keyIndex; // C8'den C0'a
  const octave = Math.floor(midiNote / 12);
  const noteIndex = midiNote % 12;
  return {
    pitch: `${NOTES[noteIndex]}${octave}`,
    isBlack: NOTES[noteIndex].includes('#'),
    isC: NOTES[noteIndex] === 'C',
    midiNote,
  };
};

export const useVirtualizedEngine = (containerRef) => {
  const scrollRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const lastUpdateRef = useRef(0);

  // Store selectors
  const viewport = usePianoRollV3Store(state => state.viewport);
  const virtualization = usePianoRollV3Store(state => state.virtualization);
  const grid = usePianoRollV3Store(state => state.grid);
  const performance = usePianoRollV3Store(state => state.performance);

  const setViewportSize = usePianoRollV3Store(state => state.setViewportSize);
  const setScroll = usePianoRollV3Store(state => state.setScroll);
  const setZoom = usePianoRollV3Store(state => state.setZoom);
  const getVisibleRange = usePianoRollV3Store(state => state.getVisibleRange);
  const getTotalGridSize = usePianoRollV3Store(state => state.getTotalGridSize);

  // Throttled scroll handler - performans için
  const throttledScrollHandler = useMemo(
    () => throttle((scrollLeft, scrollTop) => {
      scrollRef.current = { x: scrollLeft, y: scrollTop };
      setScroll(scrollLeft, scrollTop);
    }, 16), // 60fps
    [setScroll]
  );

  // Container resize observer
  const handleResize = useCallback((entries) => {
    if (!entries?.[0]) return;
    const { width, height } = entries[0].contentRect;
    setViewportSize(width, height);
  }, [setViewportSize]);

  // Scroll event handler
  const handleScroll = useCallback((e) => {
    if (!e.target) return;
    const { scrollLeft, scrollTop } = e.target;
    throttledScrollHandler(scrollLeft, scrollTop);
  }, [throttledScrollHandler]);

  // Wheel zoom handler
  const handleWheel = useCallback((e) => {
    if (!(e.ctrlKey || e.metaKey)) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoomX = viewport.zoomX * zoomFactor;

    // Zoom center hesaplama
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const beforeZoomStep = (viewport.scrollX + mouseX) / grid.stepWidth;
    const beforeZoomKey = (viewport.scrollY + mouseY) / grid.keyHeight;

    setZoom(newZoomX);

    // Zoom sonrası scroll pozisyonunu ayarla
    requestAnimationFrame(() => {
      const newStepWidth = grid.stepWidth * (newZoomX / viewport.zoomX);
      const newScrollX = beforeZoomStep * newStepWidth - mouseX;
      const newScrollY = beforeZoomKey * grid.keyHeight - mouseY;

      if (containerRef.current) {
        containerRef.current.scrollLeft = Math.max(0, newScrollX);
        containerRef.current.scrollTop = Math.max(0, newScrollY);
      }
    });
  }, [viewport.zoomX, viewport.scrollX, viewport.scrollY, grid.stepWidth, grid.keyHeight, setZoom, containerRef]);

  // DOM setup
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Resize observer
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Event listeners
    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('wheel', handleWheel, { passive: false });

    // İlk boyut hesaplama
    const rect = container.getBoundingClientRect();
    setViewportSize(rect.width, rect.height);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleResize, handleScroll, handleWheel, setViewportSize]);

  // Virtual grid hesaplamaları
  const virtualGrid = useMemo(() => {
    const range = getVisibleRange();
    const totalSize = getTotalGridSize();

    // Görünür grid çizgileri
    const verticalLines = [];
    const horizontalLines = [];

    // LOD'a göre grid çizgilerini hesapla
    const stepInterval = performance.lodLevel === 'ultra_simplified' ? 64 :
                        performance.lodLevel === 'simplified' ? 16 :
                        performance.lodLevel === 'normal' ? 4 : 1;

    // Dikey çizgiler (time grid)
    for (let step = Math.floor(range.startX / stepInterval) * stepInterval;
         step <= range.endX;
         step += stepInterval) {
      const x = step * grid.stepWidth;
      const isBarLine = step % 64 === 0; // 4 beats * 16 steps
      const isBeatLine = step % 16 === 0;

      verticalLines.push({
        x,
        type: isBarLine ? 'bar' : isBeatLine ? 'beat' : 'step',
        step,
        bar: Math.floor(step / 64) + 1,
        beat: Math.floor((step % 64) / 16) + 1,
      });
    }

    // Yatay çizgiler (key grid)
    const keyInterval = performance.lodLevel === 'ultra_simplified' ? 12 :
                       performance.lodLevel === 'simplified' ? 6 : 1;

    for (let key = Math.floor(range.startY / keyInterval) * keyInterval;
         key <= range.endY;
         key += keyInterval) {
      const y = key * grid.keyHeight;
      const noteInfo = getNoteInfo(key);

      horizontalLines.push({
        y,
        key,
        ...noteInfo,
        isOctaveLine: noteInfo.isC,
      });
    }

    return {
      verticalLines,
      horizontalLines,
      visibleBounds: {
        left: range.startX * grid.stepWidth,
        right: range.endX * grid.stepWidth,
        top: range.startY * grid.keyHeight,
        bottom: range.endY * grid.keyHeight,
      },
      totalSize,
    };
  }, [performance.lodLevel, grid.stepWidth, grid.keyHeight, getVisibleRange, getTotalGridSize]);

  // Koordinat dönüşüm fonksiyonları
  const coordUtils = useMemo(() => ({
    // Pixel to step/key
    pxToStep: (px) => Math.floor(px / grid.stepWidth),
    pxToKey: (px) => Math.floor(px / grid.keyHeight),

    // Step/key to pixel
    stepToPx: (step) => step * grid.stepWidth,
    keyToPx: (key) => key * grid.keyHeight,

    // Mouse position to grid coordinates
    mouseToGrid: (mouseX, mouseY) => ({
      step: Math.floor((viewport.scrollX + mouseX) / grid.stepWidth),
      key: Math.floor((viewport.scrollY + mouseY) / grid.keyHeight),
    }),

    // Grid coordinates to screen position
    gridToScreen: (step, key) => ({
      x: step * grid.stepWidth - viewport.scrollX,
      y: key * grid.keyHeight - viewport.scrollY,
    }),

    // Note info getter
    getNoteInfo,
  }), [grid.stepWidth, grid.keyHeight, viewport.scrollX, viewport.scrollY]);

  return {
    // State
    viewport,
    virtualization,
    grid,
    performance,
    virtualGrid,

    // Utils
    coordUtils,

    // Actions
    setZoom,

    // Current scroll position (for real-time updates)
    getCurrentScroll: () => scrollRef.current,

    // Force update trigger
    renderVersion: performance.renderVersion,
  };
};