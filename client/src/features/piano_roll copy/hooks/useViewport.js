import { useState, useCallback, useMemo, useEffect } from 'react';
import { NOTES } from '../utils/constants';
import * as Tone from 'tone';

export const useViewport = (containerRef, pianoRollState) => {
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  const { zoom } = pianoRollState;
  
  // Sabitler
  const KEYBOARD_WIDTH = 96;
  const RULER_HEIGHT = 40;
  const TOTAL_OCTAVES = 8;
  const TOTAL_KEYS = TOTAL_OCTAVES * 12;
  const BASE_KEY_HEIGHT = 20;
  const BASE_STEP_WIDTH = 40;
  
  // Hesaplanmış boyutlar
  const keyHeight = BASE_KEY_HEIGHT * zoom.y;
  const stepWidth = BASE_STEP_WIDTH * zoom.x;
  const gridWidth = 256 * stepWidth; // 16 bar * 16 adım
  const gridHeight = TOTAL_KEYS * keyHeight;
  
  // Container boyutu takibi
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);
  
  // Scroll takibi
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => setScrollPosition({ x: container.scrollLeft, y: container.scrollTop });
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef]);
  
  // --- ANAHTAR FONKSİYON: Tüm koordinat çevrimlerini burada merkezileştiriyoruz ---
  const clientToGrid = useCallback((clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0, time: 0 };
    
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left + scrollPosition.x - KEYBOARD_WIDTH;
    const y = clientY - rect.top + scrollPosition.y - RULER_HEIGHT;
    const time = x / stepWidth;
    
    return { x, y, time };
  }, [containerRef, scrollPosition.x, scrollPosition.y, stepWidth]);
  
  const timeToX = useCallback((time) => time * stepWidth, [stepWidth]);
  const yToPitch = useCallback((y) => {
    const keyIndex = TOTAL_KEYS - 1 - Math.floor(y / keyHeight);
    return `${NOTES[keyIndex % 12]}${Math.floor(keyIndex / 12)}`;
  }, [keyHeight]);
  
  const pitchToY = useCallback((pitch) => {
    const noteIndex = NOTES.indexOf(pitch.slice(0, -1));
    const octave = parseInt(pitch.slice(-1));
    const keyIndex = octave * 12 + noteIndex;
    return (TOTAL_KEYS - 1 - keyIndex) * keyHeight;
  }, [keyHeight]);

  const getNoteRect = useCallback((note) => {
    const x = timeToX(note.time);
    const y = pitchToY(note.pitch);
    const duration = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
    const width = Math.max(stepWidth * 0.25, duration * stepWidth - 2);
    const height = keyHeight - 1;
    return { x, y, width, height };
  }, [timeToX, pitchToY, stepWidth, keyHeight]);

  // Diğer tüm yardımcı fonksiyonlar...
  const yToPitchIndex = useCallback((y) => TOTAL_KEYS - 1 - Math.floor(y / keyHeight), [keyHeight]);
  const pitchToIndex = useCallback((pitch) => (parseInt(pitch.slice(-1)) * 12) + NOTES.indexOf(pitch.slice(0, -1)), []);
  const pitchIndexToPitch = useCallback((index) => `${NOTES[index % 12]}${Math.floor(index / 12)}`, []);
  const isPointInNote = useCallback((point, note) => { /* ... */ }, [getNoteRect]);
  const isNoteInRect = useCallback((note, rect) => { /* ... */ }, [getNoteRect]);
  const isRectVisible = useCallback((rect) => { /* ... */ }, [scrollPosition, containerSize]);
  const scrollTo = useCallback((x, y) => { if(containerRef.current) { containerRef.current.scrollLeft = x; containerRef.current.scrollTop = y; }}, [containerRef]);

  return {
    keyHeight, stepWidth, gridWidth, gridHeight, totalKeys: TOTAL_KEYS,
    scrollX: scrollPosition.x, scrollY: scrollPosition.y,
    containerWidth: containerSize.width, containerHeight: containerSize.height,
    clientToGrid, timeToX, yToPitch, pitchToY, getNoteRect,
    yToPitchIndex, pitchToIndex, pitchIndexToPitch,
    isPointInNote, isNoteInRect, isRectVisible, scrollTo
  };
};