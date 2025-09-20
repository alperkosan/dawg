// src/features/piano_roll/hooks/useViewport.js
import { useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { NOTES, TOTAL_KEYS } from '../utils/constants';
import * as Tone from 'tone';

// Bu hook artık Piano Roll'un fiziksel dünyasıyla (pikseller, boyutlar, kaydırma)
// mantıksal dünyası (zaman, nota) arasındaki tek ve güvenilir çevirmendir.
export const useViewport = (containerRef, options = {}) => {
  const {
    zoomX = 1, zoomY = 1, loopLength = 16,
    keyboardWidth = 80, rulerHeight = 32,
    snapSettings = { value: '16n', enabled: true }
  } = options;

  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Boyut ve pozisyon hesaplamaları için merkezi mantık
  const dimensions = useMemo(() => {
    const keyHeight = 20 * zoomY;
    const stepWidth = 40 * zoomX;
    const gridWidth = loopLength * stepWidth;
    const gridHeight = TOTAL_KEYS * keyHeight;

    const timeToX = (time) => time * stepWidth;
    const xToTime = (x) => x / stepWidth;

    const pitchToIndex = (pitch) => {
      const noteName = pitch.replace(/[0-9-]/g, '');
      const octave = parseInt(pitch.replace(/[^0-9-]/g, ''), 10) || 0;
      const noteIndex = NOTES.indexOf(noteName);
      return noteIndex === -1 ? 0 : octave * 12 + noteIndex;
    };

    const indexToPitch = (index) => {
      const noteIndex = index % 12;
      const octave = Math.floor(index / 12);
      return `${NOTES[noteIndex]}${octave}`;
    };

    const pitchToY = (pitch) => (TOTAL_KEYS - 1 - pitchToIndex(pitch)) * keyHeight;
    const yToPitch = (y) => {
      const keyIndex = TOTAL_KEYS - 1 - Math.floor(y / keyHeight);
      const clampedIndex = Math.max(0, Math.min(TOTAL_KEYS - 1, keyIndex));
      return indexToPitch(clampedIndex);
    };

    return { keyHeight, stepWidth, gridWidth, gridHeight, timeToX, xToTime, pitchToY, yToPitch, pitchToIndex, indexToPitch, totalKeys: TOTAL_KEYS };
  }, [zoomX, zoomY, loopLength]);

  // Kaydırma ve yeniden boyutlandırma olaylarını dinle
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateMetrics = () => {
      setContainerSize({ width: container.clientWidth, height: container.clientHeight });
      setScrollPosition({ x: container.scrollLeft, y: container.scrollTop });
    };

    const handleScroll = () => setScrollPosition({ x: container.scrollLeft, y: container.scrollTop });

    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(container);
    container.addEventListener('scroll', handleScroll, { passive: true });
    updateMetrics(); // İlk ölçümleri al

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef]);

  // Mouse koordinatlarını grid pozisyonuna çeviren DÜZELTİLMİŞ fonksiyon
  const mouseToGrid = useCallback((e) => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollPosition.x;
    const y = e.clientY - rect.top + scrollPosition.y;
    return { x, y, time: dimensions.xToTime(x), pitch: dimensions.yToPitch(y) };
  }, [containerRef, scrollPosition, dimensions]);

  // Bir notanın ekrandaki pozisyonunu ve boyutunu hesapla
  const getNoteRect = useCallback((note) => {
    const x = dimensions.timeToX(note.time);
    const y = dimensions.pitchToY(note.pitch);
    const durationInSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
    const width = Math.max(4, durationInSteps * dimensions.stepWidth - 1);
    return { x, y, width, height: dimensions.keyHeight - 1 };
  }, [dimensions]);

  // Bir notanın görünür alanda olup olmadığını kontrol et (optimizasyon için)
  const isNoteVisible = useCallback((note) => {
    const rect = getNoteRect(note);
    const margin = 200; // Ekstra render alanı
    return (
      rect.x < scrollPosition.x + containerSize.width + margin &&
      rect.x + rect.width > scrollPosition.x - margin &&
      rect.y < scrollPosition.y + containerSize.height + margin &&
      rect.y + rect.height > scrollPosition.y - margin
    );
  }, [getNoteRect, scrollPosition, containerSize]);

  // Hook'un dış dünyaya sunduğu her şey burada
  return {
    ...dimensions,
    scrollX: scrollPosition.x,
    scrollY: scrollPosition.y,
    containerWidth: containerSize.width,
    containerHeight: containerSize.height,
    mouseToGrid,
    getNoteRect,
    isNoteVisible,
  };
};