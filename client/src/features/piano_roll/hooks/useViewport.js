// Enhanced useViewport.js - Comprehensive viewport management
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { NOTES } from '../utils/constants';
import * as Tone from 'tone';

export const useViewport = (containerRef, options = {}) => {
  const {
    zoomX = 1,
    zoomY = 1,
    loopLength = 16,
    totalKeys = 96,
    keyboardWidth = 96,
    rulerHeight = 32
  } = options;

  // ✅ STATE
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isScrolling, setIsScrolling] = useState(false);
  
  // Performance tracking
  const lastScrollTime = useRef(0);
  const scrollTimeout = useRef(null);

  // ✅ CALCULATED DIMENSIONS
  const dimensions = useMemo(() => {
    const BASE_KEY_HEIGHT = 20;
    const BASE_STEP_WIDTH = 40;
    
    const keyHeight = BASE_KEY_HEIGHT * zoomY;
    const stepWidth = BASE_STEP_WIDTH * zoomX;
    const gridWidth = loopLength * 16 * stepWidth; // 16 steps per bar
    const gridHeight = totalKeys * keyHeight;
    
    return {
      keyHeight,
      stepWidth,
      gridWidth,
      gridHeight,
      baseKeyHeight: BASE_KEY_HEIGHT,
      baseStepWidth: BASE_STEP_WIDTH
    };
  }, [zoomX, zoomY, loopLength, totalKeys]);

  // ✅ CONTAINER SIZE TRACKING
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ 
          width: rect.width, 
          height: rect.height 
        });
      }
    };
    
    updateSize();
    
    // Use ResizeObserver for better performance
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    window.addEventListener('resize', updateSize);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [containerRef]);

  // ✅ SCROLL HANDLING - Throttled for performance
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const now = performance.now();
      
      // Throttle scroll updates to 60fps
      if (now - lastScrollTime.current < 16) return;
      lastScrollTime.current = now;
      
      setScrollPosition({
        x: container.scrollLeft,
        y: container.scrollTop
      });
      
      setIsScrolling(true);
      
      // Clear scrolling state after scroll ends
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      scrollTimeout.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [containerRef]);

  // ✅ COORDINATE CONVERSION FUNCTIONS
  const coordinateConverters = useMemo(() => ({
    // Time conversions
    timeToX: (time) => time * dimensions.stepWidth,
    xToTime: (x) => x / dimensions.stepWidth,
    
    // Pitch conversions
    pitchToY: (pitch) => {
      const noteIndex = NOTES.indexOf(pitch.slice(0, -1));
      const octave = parseInt(pitch.slice(-1));
      const keyIndex = octave * 12 + noteIndex;
      return (totalKeys - 1 - keyIndex) * dimensions.keyHeight;
    },
    
    yToPitch: (y) => {
      const keyIndex = totalKeys - 1 - Math.floor(y / dimensions.keyHeight);
      const noteIndex = keyIndex % 12;
      const octave = Math.floor(keyIndex / 12);
      return `${NOTES[noteIndex]}${octave}`;
    },
    
    // Index conversions
    pitchToIndex: (pitch) => {
      const noteIndex = NOTES.indexOf(pitch.slice(0, -1));
      const octave = parseInt(pitch.slice(-1));
      return octave * 12 + noteIndex;
    },
    
    indexToPitch: (index) => {
      const noteIndex = index % 12;
      const octave = Math.floor(index / 12);
      return `${NOTES[noteIndex]}${octave}`;
    }
  }), [dimensions, totalKeys]);

  // ✅ GEOMETRY UTILITIES
  const geometryUtils = useMemo(() => ({
    // Get note rectangle
    getNoteRect: (note) => {
      const x = coordinateConverters.timeToX(note.time);
      const y = coordinateConverters.pitchToY(note.pitch);
      
      let width;
      try {
        const duration = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
        width = Math.max(dimensions.stepWidth * 0.25, duration * dimensions.stepWidth - 2);
      } catch {
        width = dimensions.stepWidth - 2;
      }
      
      const height = dimensions.keyHeight - 1;
      return { x, y, width, height };
    },
    
    // Check if point is in note
    isPointInNote: (point, note) => {
      const rect = geometryUtils.getNoteRect(note);
      return (
        point.x >= rect.x &&
        point.x <= rect.x + rect.width &&
        point.y >= rect.y &&
        point.y <= rect.y + rect.height
      );
    },
    
    // Check if note is in rectangle
    isNoteInRect: (note, rect) => {
      const noteRect = geometryUtils.getNoteRect(note);
      return (
        noteRect.x < rect.x + rect.width &&
        noteRect.x + noteRect.width > rect.x &&
        noteRect.y < rect.y + rect.height &&
        noteRect.y + noteRect.height > rect.y
      );
    },
    
    // Check if rectangle is visible in viewport
    isRectVisible: (rect) => {
      const viewLeft = scrollPosition.x;
      const viewRight = scrollPosition.x + containerSize.width;
      const viewTop = scrollPosition.y;
      const viewBottom = scrollPosition.y + containerSize.height;
      
      return (
        rect.x < viewRight &&
        rect.x + rect.width > viewLeft &&
        rect.y < viewBottom &&
        rect.y + rect.height > viewTop
      );
    }
  }), [coordinateConverters, dimensions, scrollPosition, containerSize]);

  // ✅ CLIENT TO GRID COORDINATE CONVERSION
  const clientToGrid = useCallback((clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0, time: 0, pitch: 'C4' };
    
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left + scrollPosition.x - keyboardWidth;
    const y = clientY - rect.top + scrollPosition.y - rulerHeight;
    const time = coordinateConverters.xToTime(x);
    const pitch = coordinateConverters.yToPitch(y);
    
    return { x, y, time, pitch };
  }, [containerRef, scrollPosition, keyboardWidth, rulerHeight, coordinateConverters]);

  // ✅ NAVIGATION UTILITIES
  const navigationUtils = useMemo(() => ({
    // Scroll to position
    scrollTo: (x, y, smooth = false) => {
      const container = containerRef.current;
      if (!container) return;
      
      container.scrollTo({
        left: Math.max(0, x),
        top: Math.max(0, y),
        behavior: smooth ? 'smooth' : 'auto'
      });
    },
    
    // Scroll to note
    scrollToNote: (note, options = {}) => {
      const { centerX = true, centerY = true, smooth = true } = options;
      const rect = geometryUtils.getNoteRect(note);
      
      let targetX = scrollPosition.x;
      let targetY = scrollPosition.y;
      
      if (centerX) {
        targetX = rect.x + rect.width / 2 - containerSize.width / 2;
      }
      
      if (centerY) {
        targetY = rect.y + rect.height / 2 - containerSize.height / 2;
      }
      
      navigationUtils.scrollTo(targetX, targetY, smooth);
    },
    
    // Zoom to fit notes
    zoomToFit: (notes, padding = 0.1) => {
      if (notes.length === 0) return;
      
      let minTime = Infinity;
      let maxTime = -Infinity;
      let minPitch = Infinity;
      let maxPitch = -Infinity;
      
      notes.forEach(note => {
        const duration = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
        minTime = Math.min(minTime, note.time);
        maxTime = Math.max(maxTime, note.time + duration);
        
        const pitchIndex = coordinateConverters.pitchToIndex(note.pitch);
        minPitch = Math.min(minPitch, pitchIndex);
        maxPitch = Math.max(maxPitch, pitchIndex);
      });
      
      const timeRange = maxTime - minTime;
      const pitchRange = maxPitch - minPitch + 1;
      
      const availableWidth = containerSize.width * (1 - padding * 2);
      const availableHeight = containerSize.height * (1 - padding * 2);
      
      const targetZoomX = availableWidth / (timeRange * dimensions.baseStepWidth);
      const targetZoomY = availableHeight / (pitchRange * dimensions.baseKeyHeight);
      
      // Return zoom values for parent to apply
      return {
        zoomX: Math.max(0.25, Math.min(5, targetZoomX)),
        zoomY: Math.max(0.5, Math.min(3, targetZoomY)),
        centerTime: (minTime + maxTime) / 2,
        centerPitch: coordinateConverters.indexToPitch(Math.floor((minPitch + maxPitch) / 2))
      };
    }
  }), [containerRef, scrollPosition, containerSize, geometryUtils, coordinateConverters, dimensions]);

  // ✅ VISIBLE BOUNDS CALCULATION
  const visibleBounds = useMemo(() => {
    const margin = Math.max(dimensions.keyHeight * 2, dimensions.stepWidth * 8);
    
    return {
      left: Math.max(0, scrollPosition.x - margin),
      right: Math.min(dimensions.gridWidth, scrollPosition.x + containerSize.width + margin),
      top: Math.max(0, scrollPosition.y - margin),
      bottom: Math.min(dimensions.gridHeight, scrollPosition.y + containerSize.height + margin),
      
      // Visible area without margin
      visibleLeft: scrollPosition.x,
      visibleRight: scrollPosition.x + containerSize.width,
      visibleTop: scrollPosition.y,
      visibleBottom: scrollPosition.y + containerSize.height
    };
  }, [scrollPosition, containerSize, dimensions]);

  // ✅ PERFORMANCE METRICS
  const performanceInfo = useMemo(() => ({
    isScrolling,
    visibleArea: containerSize.width * containerSize.height,
    totalArea: dimensions.gridWidth * dimensions.gridHeight,
    visibilityRatio: (containerSize.width * containerSize.height) / 
                    (dimensions.gridWidth * dimensions.gridHeight),
    zoomLevel: { x: zoomX, y: zoomY }
  }), [isScrolling, containerSize, dimensions, zoomX, zoomY]);

  return {
    // Dimensions
    ...dimensions,
    keyboardWidth,
    rulerHeight,
    totalKeys,
    
    // Scroll state
    scrollX: scrollPosition.x,
    scrollY: scrollPosition.y,
    containerWidth: containerSize.width,
    containerHeight: containerSize.height,
    isScrolling,
    
    // Bounds
    visibleBounds,
    
    // Coordinate conversion
    ...coordinateConverters,
    clientToGrid,
    
    // Geometry utilities
    ...geometryUtils,
    
    // Navigation
    ...navigationUtils,
    
    // Performance info
    performanceInfo
  };
};