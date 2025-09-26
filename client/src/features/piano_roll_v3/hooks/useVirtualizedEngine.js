/**
 * @file useVirtualizedEngine.js
 * @description Fixed virtualized rendering engine with proper calculations
 */
import { useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { usePianoRollV3Store } from '../store/usePianoRollV3Store';
import { throttle } from '../utils/performance';

// Note mapping
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const getNoteInfo = (keyIndex) => {
  const midiNote = 108 - keyIndex; // C8 to C0
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

  // Throttled scroll handler
  const throttledScrollHandler = useMemo(
    () => throttle((scrollLeft, scrollTop) => {
      scrollRef.current = { x: scrollLeft, y: scrollTop };
      setScroll(scrollLeft, scrollTop);
    }, 16),
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
    const currentZoomX = viewport.zoomX || 1;
    const newZoomX = currentZoomX * zoomFactor;

    // Calculate zoom center
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const beforeZoomStep = (viewport.scrollX + mouseX) / grid.stepWidth;
    const beforeZoomKey = (viewport.scrollY + mouseY) / grid.keyHeight;

    setZoom(newZoomX);

    // Adjust scroll position after zoom
    requestAnimationFrame(() => {
      const newStepWidth = grid.stepWidth * (newZoomX / currentZoomX);
      const newScrollX = beforeZoomStep * newStepWidth - mouseX;
      const newScrollY = beforeZoomKey * grid.keyHeight - mouseY;

      if (containerRef.current) {
        containerRef.current.scrollLeft = Math.max(0, newScrollX);
        containerRef.current.scrollTop = Math.max(0, newScrollY);
      }
    });
  }, [viewport, grid, setZoom, containerRef]);

  // Setup DOM event listeners
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Resize observer
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Event listeners
    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Initial size calculation
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

  // Virtual grid calculations - FIXED
  const virtualGrid = useMemo(() => {
    const range = getVisibleRange();
    const totalSize = getTotalGridSize();

    // Initialize arrays
    const verticalLines = [];
    const horizontalLines = [];

    // Calculate step interval based on LOD
    let stepInterval = 1;
    if (performance.lodLevel === 'ultra_simplified') {
      stepInterval = 64; // Only bars
    } else if (performance.lodLevel === 'simplified') {
      stepInterval = 16; // Bars and beats
    } else if (performance.lodLevel === 'normal') {
      stepInterval = 4; // Quarter beats
    }

    // Generate vertical lines (time grid)
    const startStep = Math.max(0, Math.floor(range.startX / stepInterval) * stepInterval);
    const endStep = Math.min(grid.dynamicBars * 64, Math.ceil(range.endX / stepInterval) * stepInterval);

    for (let step = startStep; step <= endStep; step += stepInterval) {
      const x = step * grid.stepWidth;
      const isBarLine = step % 64 === 0;
      const isBeatLine = step % 16 === 0;
      const isSubBeatLine = step % 4 === 0;

      // Determine line type
      let lineType = 'step';
      if (isBarLine) lineType = 'bar';
      else if (isBeatLine) lineType = 'beat';
      else if (isSubBeatLine) lineType = 'sub-beat';

      verticalLines.push({
        x,
        type: lineType,
        step,
        bar: Math.floor(step / 64) + 1,
        beat: Math.floor((step % 64) / 16) + 1,
      });
    }

    // Generate horizontal lines (key grid)
    const keyInterval = performance.lodLevel === 'ultra_simplified' ? 12 :
                       performance.lodLevel === 'simplified' ? 3 : 1;

    const startKey = Math.max(0, Math.floor(range.startY / keyInterval) * keyInterval);
    const endKey = Math.min(grid.totalKeys, Math.ceil(range.endY / keyInterval) * keyInterval);

    for (let key = startKey; key <= endKey; key += keyInterval) {
      const y = key * grid.keyHeight;
      const noteInfo = getNoteInfo(key);

      horizontalLines.push({
        y,
        key,
        pitch: noteInfo.pitch,
        isBlack: noteInfo.isBlack,
        isC: noteInfo.isC,
        isOctaveLine: noteInfo.isC,
      });
    }

    // Debug log
    if (verticalLines.length === 0 || horizontalLines.length === 0) {
      console.warn('Grid calculation issue:', {
        range,
        verticalCount: verticalLines.length,
        horizontalCount: horizontalLines.length,
        stepInterval,
        keyInterval,
        startStep,
        endStep,
        startKey,
        endKey
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
  }, [performance.lodLevel, grid, getVisibleRange, getTotalGridSize]);

  // Coordinate transformation utilities
  const coordUtils = useMemo(() => ({
    // Pixel to grid coordinates
    pxToStep: (px) => Math.floor(px / grid.stepWidth),
    pxToKey: (px) => Math.floor(px / grid.keyHeight),

    // Grid to pixel coordinates
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

    // Current scroll position
    getCurrentScroll: () => scrollRef.current,

    // Force update trigger
    renderVersion: performance.renderVersion,
  };
};