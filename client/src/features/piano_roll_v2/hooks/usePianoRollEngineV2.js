// src/features/piano_roll_v2/hooks/usePianoRollEngineV2.js
import { useState, useMemo, useLayoutEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';
import { usePianoRollStoreV2, NOTES } from '../store/usePianoRollStoreV2';

const KEYBOARD_WIDTH = 80;
const RULER_HEIGHT = 32;
const TOTAL_KEYS = 12 * 8; // C0 to B7

export const usePianoRollEngineV2 = (containerRef, loopLength) => {
  const { zoomX, zoomY } = usePianoRollStoreV2();
  const scrollRef = useRef({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [, forceUpdate] = useState({}); 

  const dimensions = useMemo(() => {
    const keyHeight = 20 * zoomY;
    const stepWidth = 40 * zoomX;
    const totalSteps = loopLength * 4;
    const gridWidth = totalSteps * stepWidth;
    const gridHeight = TOTAL_KEYS * keyHeight;
    return { keyHeight, stepWidth, gridWidth, gridHeight, totalKeys: TOTAL_KEYS, keyboardWidth: KEYBOARD_WIDTH, rulerHeight: RULER_HEIGHT };
  }, [zoomX, zoomY, loopLength]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      scrollRef.current = { x: container.scrollLeft, y: container.scrollTop };
      forceUpdate({});
    };
    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    resizeObserver.observe(container);
    container.addEventListener('scroll', handleScroll, { passive: true });
    setSize({ width: container.clientWidth, height: container.clientHeight });
    
    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef]);

  // === HATA DÜZELTMESİ: Gerekli fonksiyonlar artık dışarıya aktarılıyor ===
  const converters = useMemo(() => {
    const pitchToIndex = (pitch) => {
      if (!pitch) return 0; // Güvenlik kontrolü
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
        const durationInSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
        const width = Math.max(4, durationInSteps * dimensions.stepWidth - 1);
        return { x, y, width, height: dimensions.keyHeight - 1 };
      },
      // Kısayol yöneticisinin ihtiyaç duyduğu fonksiyonları buraya ekliyoruz
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
  }), [dimensions, size, converters, mouseToGrid, scrollRef.current]);
};