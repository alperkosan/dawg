import { useState, useCallback, useMemo, useEffect } from 'react';
import { NOTES } from '../utils/constants';
import * as Tone from 'tone';

export const useViewport = (containerRef, pianoRollState) => {
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  const { zoom, notes } = pianoRollState;
  
  // Constants
  const KEYBOARD_WIDTH = 96;
  const RULER_HEIGHT = 40;
  const TOTAL_OCTAVES = 8;
  const TOTAL_KEYS = TOTAL_OCTAVES * 12;
  const BASE_KEY_HEIGHT = 20;
  const BASE_STEP_WIDTH = 40;
  
  // Calculated dimensions
  const keyHeight = BASE_KEY_HEIGHT * zoom.y;
  const stepWidth = BASE_STEP_WIDTH * zoom.x;
  const gridWidth = 256 * stepWidth; // 16 bars * 16 steps
  const gridHeight = TOTAL_KEYS * keyHeight;
  
  // Container size tracking
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [containerRef]);
  
  // Scroll handling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      setScrollPosition({
        x: container.scrollLeft,
        y: container.scrollTop
      });
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef]);
  
  // Coordinate conversions
  const clientToGrid = useCallback((clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0, time: 0 };
    
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left + scrollPosition.x - KEYBOARD_WIDTH;
    const y = clientY - rect.top + scrollPosition.y - RULER_HEIGHT;
    const time = x / stepWidth;
    
    return { x, y, time };
  }, [containerRef, scrollPosition, stepWidth]);
  
  const timeToX = useCallback((time) => {
    return time * stepWidth;
  }, [stepWidth]);
  
  const xToTime = useCallback((x) => {
    return x / stepWidth;
  }, [stepWidth]);
  
  const yToPitch = useCallback((y) => {
    const keyIndex = TOTAL_KEYS - 1 - Math.floor(y / keyHeight);
    const noteIndex = keyIndex % 12;
    const octave = Math.floor(keyIndex / 12);
    return `${NOTES[noteIndex]}${octave}`;
  }, [keyHeight]);
  
  const pitchToY = useCallback((pitch) => {
    const noteIndex = NOTES.indexOf(pitch.slice(0, -1));
    const octave = parseInt(pitch.slice(-1));
    const keyIndex = octave * 12 + noteIndex;
    return (TOTAL_KEYS - 1 - keyIndex) * keyHeight;
  }, [keyHeight]);
  
  const yToPitchIndex = useCallback((y) => {
    return TOTAL_KEYS - 1 - Math.floor(y / keyHeight);
  }, [keyHeight]);
  
  const pitchToIndex = useCallback((pitch) => {
    const noteIndex = NOTES.indexOf(pitch.slice(0, -1));
    const octave = parseInt(pitch.slice(-1));
    return octave * 12 + noteIndex;
  }, []);
  
  const pitchIndexToPitch = useCallback((index) => {
    const noteIndex = index % 12;
    const octave = Math.floor(index / 12);
    return `${NOTES[noteIndex]}${octave}`;
  }, []);
  
  // Note geometry
  const getNoteRect = useCallback((note) => {
    const x = timeToX(note.time);
    const y = pitchToY(note.pitch);
    const duration = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
    const width = Math.max(stepWidth * 0.25, duration * stepWidth - 2);
    const height = keyHeight - 1;
    
    return { x, y, width, height };
  }, [timeToX, pitchToY, stepWidth, keyHeight]);
  
  // Collision detection
  const isPointInNote = useCallback((point, note) => {
    const rect = getNoteRect(note);
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }, [getNoteRect]);
  
  const isNoteInRect = useCallback((note, rect) => {
    const noteRect = getNoteRect(note);
    return (
      noteRect.x < rect.x + rect.width &&
      noteRect.x + noteRect.width > rect.x &&
      noteRect.y < rect.y + rect.height &&
      noteRect.y + noteRect.height > rect.y
    );
  }, [getNoteRect]);
  
  const isRectVisible = useCallback((rect) => {
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
  }, [scrollPosition, containerSize]);
  
  // Navigation
  const scrollTo = useCallback((x, y) => {
    const container = containerRef.current;
    if (!container) return;
    
    container.scrollLeft = Math.max(0, x);
    container.scrollTop = Math.max(0, y);
  }, [containerRef]);
  
  const scrollToNote = useCallback((note) => {
    const rect = getNoteRect(note);
    const centerX = rect.x + rect.width / 2 - containerSize.width / 2;
    const centerY = rect.y + rect.height / 2 - containerSize.height / 2;
    scrollTo(centerX, centerY);
  }, [getNoteRect, containerSize, scrollTo]);
  
  const zoomToFit = useCallback((notesToFit = notes) => {
    if (notesToFit.length === 0) return;
    
    let minTime = Infinity;
    let maxTime = -Infinity;
    let minPitch = Infinity;
    let maxPitch = -Infinity;
    
    notesToFit.forEach(note => {
      const duration = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
      minTime = Math.min(minTime, note.time);
      maxTime = Math.max(maxTime, note.time + duration);
      
      const pitchIndex = pitchToIndex(note.pitch);
      minPitch = Math.min(minPitch, pitchIndex);
      maxPitch = Math.max(maxPitch, pitchIndex);
    });
    
    const timeRange = maxTime - minTime;
    const pitchRange = maxPitch - minPitch + 1;
    
    const targetZoomX = (containerSize.width * 0.8) / (timeRange * BASE_STEP_WIDTH);
    const targetZoomY = (containerSize.height * 0.8) / (pitchRange * BASE_KEY_HEIGHT);
    
    pianoRollState.setZoom(
      Math.max(0.25, Math.min(5, targetZoomX)),
      Math.max(0.5, Math.min(3, targetZoomY))
    );
    
    // Center on the notes
    setTimeout(() => {
      const centerTime = (minTime + maxTime) / 2;
      const centerPitch = (minPitch + maxPitch) / 2;
      const centerX = centerTime * stepWidth - containerSize.width / 2;
      const centerY = (TOTAL_KEYS - centerPitch) * keyHeight - containerSize.height / 2;
      scrollTo(centerX, centerY);
    }, 50);
  }, [notes, containerSize, pitchToIndex, pianoRollState]);
  
  return {
    // Dimensions
    keyHeight,
    stepWidth,
    gridWidth,
    gridHeight,
    totalKeys: TOTAL_KEYS,
    keyboardWidth: KEYBOARD_WIDTH,
    rulerHeight: RULER_HEIGHT,
    
    // Scroll state
    scrollX: scrollPosition.x,
    scrollY: scrollPosition.y,
    containerWidth: containerSize.width,
    containerHeight: containerSize.height,
    
    // Coordinate conversion
    clientToGrid,
    timeToX,
    xToTime,
    yToPitch,
    pitchToY,
    yToPitchIndex,
    pitchToIndex,
    pitchIndexToPitch,
    
    // Geometry
    getNoteRect,
    isPointInNote,
    isNoteInRect,
    isRectVisible,
    
    // Navigation
    scrollTo,
    scrollToNote,
    zoomToFit
  };
};
