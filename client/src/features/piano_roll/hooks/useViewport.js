import { useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { NOTES } from '../utils/constants';
import * as Tone from 'tone';

// Sabitler
const TOTAL_OCTAVES = 8;
const TOTAL_KEYS = TOTAL_OCTAVES * 12;

export const useViewport = (containerRef, options = {}) => {
  const {
    zoomX = 1,
    zoomY = 1,
    loopLength = 16,
    keyboardWidth = 80,
    rulerHeight = 32
  } = options;

  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Dinamik boyutları ve koordinat dönüştürücüleri hesapla
  const dimensionsAndConverters = useMemo(() => {
    const keyHeight = 20 * zoomY;
    const stepWidth = 40 * zoomX;
    // loopLength step cinsinden geliyor, bar değil.
    const gridWidth = loopLength * stepWidth; 
    const gridHeight = TOTAL_KEYS * keyHeight;

    const timeToX = (time) => time * stepWidth;
    
    const pitchToIndex = (pitch) => {
      const noteName = pitch.replace(/[0-9-]/g, '');
      const octave = parseInt(pitch.replace(/[^0-9-]/g, ''), 10) || 0;
      const noteIndex = NOTES.indexOf(noteName);
      if (noteIndex === -1) return 0;
      return octave * 12 + noteIndex;
    };

    const indexToPitch = (index) => {
        const noteIndex = index % 12;
        const octave = Math.floor(index / 12);
        return `${NOTES[noteIndex]}${octave}`;
    };

    const pitchToY = (pitch) => {
        const keyIndex = pitchToIndex(pitch);
        return (TOTAL_KEYS - 1 - keyIndex) * keyHeight;
    };

    const xToStep = (x) => x / stepWidth;
    
    const yToNote = (y) => {
        const keyIndex = TOTAL_KEYS - 1 - Math.floor(y / keyHeight);
        const clampedIndex = Math.max(0, Math.min(TOTAL_KEYS - 1, keyIndex));
        return indexToPitch(clampedIndex);
    };

    return {
      keyHeight, stepWidth, gridWidth, gridHeight,
      timeToX, pitchToY, xToStep, yToNote, pitchToIndex, indexToPitch
    };
  }, [zoomX, zoomY, loopLength]);

  // Konteyner boyutu ve scroll pozisyonunu izle
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      setContainerSize({ width: container.clientWidth, height: container.clientHeight });
      setScrollPosition({ x: container.scrollLeft, y: container.scrollTop });
    };
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(container);
    container.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', update);
    };
  }, [containerRef]);

  // Nota ve dikdörtgen görünürlüğünü kontrol eden fonksiyonlar
  const getNoteRect = useCallback((note) => {
      const x = dimensionsAndConverters.timeToX(note.time);
      const y = dimensionsAndConverters.pitchToY(note.pitch);
      let width;
      try {
        const durationInSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
        width = Math.max(4, durationInSteps * dimensionsAndConverters.stepWidth - 1);
      } catch {
        width = dimensionsAndConverters.stepWidth - 1;
      }
      return { x, y, width, height: dimensionsAndConverters.keyHeight - 1 };
  }, [dimensionsAndConverters]);

  const isRectVisible = useCallback((rect) => {
      const margin = 200; // Ekstra render alanı
      return (
        rect.x < scrollPosition.x + containerSize.width + margin &&
        rect.x + rect.width > scrollPosition.x - margin &&
        rect.y < scrollPosition.y + containerSize.height + margin &&
        rect.y + rect.height > scrollPosition.y - margin
      );
  }, [scrollPosition, containerSize]);

  const isNoteVisible = useCallback((note) => {
      const rect = getNoteRect(note);
      return isRectVisible(rect);
  }, [getNoteRect, isRectVisible]);

  return {
    ...dimensionsAndConverters,
    keyboardWidth,
    rulerHeight,
    totalKeys: TOTAL_KEYS,
    NOTES: NOTES,
    getNoteRect,
    isNoteVisible,
  };
};
