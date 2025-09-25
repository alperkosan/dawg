// src/features/piano_roll_v2/hooks/usePianoRollEngineV2.js
import { useState, useMemo, useLayoutEffect, useCallback, useRef } from 'react';
import { usePianoRollStoreV2, NOTES } from '../store/usePianoRollStoreV2';
import { getRectangle, releaseRectangle } from '../../../lib/utils/objectPool';
import { NativeTimeUtils } from '../../../lib/utils/NativeTimeUtils';

const KEYBOARD_WIDTH = 80;
const RULER_HEIGHT = 32;
const TOTAL_KEYS = 12 * 8; // C0 to B7

export const usePianoRollEngineV2 = (containerRef, loopLength) => {
  // Optimize state selectors - only listen to zoom changes
  const zoomX = usePianoRollStoreV2(state => state.zoomX);
  const zoomY = usePianoRollStoreV2(state => state.zoomY);
  const scrollRef = useRef({ x: 0, y: 0 });
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [, forceUpdate] = useState({});
  
  // FIXED: Add invisible content div reference for scroll area
  const invisibleContentRef = useRef(null);

  const dimensions = useMemo(() => {
    const keyHeight = 20 * zoomY;
    const stepWidth = 40 * zoomX;

    // Infinite scrolling: Dynamic width based on viewport and scroll position
    const minBars = 200; // Minimum 200 bars (3200 steps)
    const baseSteps = minBars * 16; // 16 steps per bar
    const currentScrollX = scrollPos.x;
    const viewportWidth = size.width || 1200;

    // Calculate how many bars we're scrolled to
    const currentBar = Math.floor(currentScrollX / (stepWidth * 16));
    const requiredBars = Math.max(minBars, currentBar + 50); // Always have 50 bars ahead
    const totalSteps = requiredBars * 16;

    const gridWidth = totalSteps * stepWidth;
    const gridHeight = TOTAL_KEYS * keyHeight;

    return {
      keyHeight,
      stepWidth,
      gridWidth,
      gridHeight,
      totalKeys: TOTAL_KEYS,
      keyboardWidth: KEYBOARD_WIDTH,
      rulerHeight: RULER_HEIGHT,
      totalSteps,
      loopSteps: loopLength * 4,
      currentBar,
      requiredBars
    };
  }, [zoomX, zoomY, loopLength, size.width, scrollPos.x]);

  // FIXED: Update scroll container's scrollable area
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create or update invisible content div to define scroll area
    let invisibleContent = invisibleContentRef.current;
    if (!invisibleContent) {
      invisibleContent = document.createElement('div');
      invisibleContent.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: ${dimensions.gridWidth}px;
        height: ${dimensions.gridHeight}px;
        pointer-events: none;
        visibility: hidden;
        z-index: -1;
      `;
      container.appendChild(invisibleContent);
      invisibleContentRef.current = invisibleContent;
    } else {
      // Update size
      invisibleContent.style.width = `${dimensions.gridWidth}px`;
      invisibleContent.style.height = `${dimensions.gridHeight}px`;
    }


  }, [dimensions.gridWidth, dimensions.gridHeight, containerRef]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId = null;
    let lastScrollTime = 0;
    const throttleDelay = 33; // ~30fps - Aggressive throttling for Piano Roll performance

    const handleScroll = () => {
      const now = Date.now();
      if (now - lastScrollTime < throttleDelay) return;

      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        const newScrollX = container.scrollLeft;
        const newScrollY = container.scrollTop;

        const oldScrollX = scrollRef.current.x;
        const oldScrollY = scrollRef.current.y;

        scrollRef.current = { x: newScrollX, y: newScrollY };

        // COMBINED: Handle scroll sync here to avoid duplicate handlers
        const rulerContainer = document.querySelector('.prv2-ruler-container');
        const keyboardContainer = document.querySelector('.prv2-keyboard-container');
        const velocityContainer = document.querySelector('.prv2-velocity-lane');

        // Sync horizontal scroll for ruler and velocity lane
        if (rulerContainer) rulerContainer.scrollLeft = newScrollX;
        if (velocityContainer) velocityContainer.scrollLeft = newScrollX;

        // Sync vertical scroll for keyboard
        if (keyboardContainer) keyboardContainer.scrollTop = newScrollY;

        // ULTRA AGGRESSIVE: Only update on major scroll changes for performance
        const scrollDeltaX = Math.abs(newScrollX - oldScrollX);
        const scrollDeltaY = Math.abs(newScrollY - oldScrollY);
        const shouldUpdate = scrollDeltaX > 200 || scrollDeltaY > 200; // Doubled threshold

        if (shouldUpdate) {
          setScrollPos({ x: newScrollX, y: newScrollY });
          forceUpdate({});
        } else {
          // Still update scrollPos for consistency but don't force re-render
          setScrollPos(prev => {
            if (Math.abs(prev.x - newScrollX) > 50 || Math.abs(prev.y - newScrollY) > 50) {
              return { x: newScrollX, y: newScrollY };
            }
            return prev;
          });
        }

        lastScrollTime = now;
      });
    };

    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });

    resizeObserver.observe(container);
    container.addEventListener('scroll', handleScroll, { passive: true });
    setSize({ width: container.clientWidth, height: container.clientHeight });

    // Initialize scroll position
    const initialScrollX = container.scrollLeft || 0;
    const initialScrollY = container.scrollTop || 0;
    scrollRef.current = { x: initialScrollX, y: initialScrollY };
    setScrollPos({ x: initialScrollX, y: initialScrollY });

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
      
      // Clean up invisible content
      if (invisibleContentRef.current && container.contains(invisibleContentRef.current)) {
        container.removeChild(invisibleContentRef.current);
        invisibleContentRef.current = null;
      }
    };
  }, [containerRef, dimensions]);

  const converters = useMemo(() => {
    const pitchToIndex = (pitch) => {
      if (!pitch) return 0;
      const noteName = pitch.replace(/[\d-]/g, '');
      const octave = parseInt(pitch.replace(/[^\d-]/g, ''), 10) || 0;
      const noteIndex = NOTES.indexOf(noteName);
      return noteIndex === -1 ? 0 : octave * 12 + noteIndex;
    };
    const indexToPitch = (index) => {
      const noteIndex = index % 12;
      const octave = Math.floor(index / 12);
      return `${NOTES[noteIndex]}${octave}`;
    };
    const timeToX = (time) => time * dimensions.stepWidth;

    return {
      timeToX,
      xToTime: (x) => x / dimensions.stepWidth,
      pitchToY: (pitch) => (TOTAL_KEYS - 1 - pitchToIndex(pitch)) * dimensions.keyHeight,
      yToPitch: (y) => {
        const keyIndex = TOTAL_KEYS - 1 - Math.floor(y / dimensions.keyHeight);
        return indexToPitch(Math.max(0, Math.min(TOTAL_KEYS - 1, keyIndex)));
      },
      getNoteRect: (note) => {
        const x = timeToX(note.time);
        const y = (TOTAL_KEYS - 1 - pitchToIndex(note.pitch)) * dimensions.keyHeight;
        // Replace Tone.js with native time calculation
        const durationInSteps = NativeTimeUtils.parseTime(note.duration, 120) / NativeTimeUtils.parseTime('16n', 120);
        const width = Math.max(4, durationInSteps * dimensions.stepWidth - 1);

        // Use pooled rectangle object to reduce GC pressure
        const rect = getRectangle(x, y, width, dimensions.keyHeight - 1);

        // Return a copy since we'll immediately release the pooled object
        const result = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        releaseRectangle(rect);

        return result;
      },
      pitchToIndex,
      indexToPitch,
    };
  }, [dimensions]);

  const mouseToGrid = useCallback((e) => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current.x;
    const y = e.clientY - rect.top + scrollRef.current.y;
    return { x, y, time: converters.xToTime(x), pitch: converters.yToPitch(y) };
  }, [containerRef, converters]);

  return useMemo(() => ({
    ...dimensions,
    scroll: scrollRef.current,
    size,
    ...converters,
    mouseToGrid,
  }), [dimensions, size, converters, mouseToGrid, scrollPos]);
};