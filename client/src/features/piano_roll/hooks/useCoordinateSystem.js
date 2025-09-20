// src/features/piano_roll/hooks/useCoordinateSystem.js
import { useCallback, useMemo } from 'react';
import { NOTES, TOTAL_KEYS } from '../utils/constants';
import * as Tone from 'tone';

export const useCoordinateSystem = ({
  containerRef,
  zoomX = 1,
  zoomY = 1,
  loopLength = 16,
  scrollPosition = { x: 0, y: 0 }
}) => {
  // Sabit boyutlar
  const KEYBOARD_WIDTH = 80;
  const RULER_HEIGHT = 32;
  
  // Temel boyut hesaplamaları
  const dimensions = useMemo(() => {
    const keyHeight = 20 * zoomY;
    const stepWidth = 40 * zoomX;
    const gridWidth = loopLength * stepWidth;
    const gridHeight = TOTAL_KEYS * keyHeight;
    
    return {
      keyHeight,
      stepWidth,
      gridWidth,
      gridHeight,
      keyboardWidth: KEYBOARD_WIDTH,
      rulerHeight: RULER_HEIGHT
    };
  }, [zoomX, zoomY, loopLength]);

  // Pitch hesaplama fonksiyonları
  const pitchHelpers = useMemo(() => ({
    pitchToIndex: (pitch) => {
      const noteName = pitch.replace(/[0-9-]/g, '');
      const octave = parseInt(pitch.replace(/[^0-9-]/g, ''), 10) || 0;
      const noteIndex = NOTES.indexOf(noteName);
      return noteIndex === -1 ? 0 : octave * 12 + noteIndex;
    },
    
    indexToPitch: (index) => {
      const noteIndex = index % 12;
      const octave = Math.floor(index / 12);
      return `${NOTES[noteIndex]}${octave}`;
    }
  }), []);

  // Koordinat dönüştürme fonksiyonları - DÜZELTİLMİŞ
  const transforms = useMemo(() => ({
    // Zaman <-> X pozisyonu
    timeToX: (time) => time * dimensions.stepWidth,
    xToTime: (x) => x / dimensions.stepWidth,
    
    // Pitch <-> Y pozisyonu
    pitchToY: (pitch) => {
      const index = pitchHelpers.pitchToIndex(pitch);
      return (TOTAL_KEYS - 1 - index) * dimensions.keyHeight;
    },
    
    yToPitch: (y) => {
      const keyIndex = TOTAL_KEYS - 1 - Math.floor(y / dimensions.keyHeight);
      const clampedIndex = Math.max(0, Math.min(TOTAL_KEYS - 1, keyIndex));
      return pitchHelpers.indexToPitch(clampedIndex);
    }
  }), [dimensions, pitchHelpers]);

  // Mouse koordinatlarını grid pozisyonuna çeviren MERKEZI fonksiyon
  const mouseToGrid = useCallback((clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return null;
    
    const rect = container.getBoundingClientRect();
    
    // DÜZELTME: Offset'leri doğru hesapla
    const rawX = clientX - rect.left + scrollPosition.x;
    const rawY = clientY - rect.top + scrollPosition.y;
    
    // Grid koordinatları (keyboard ve ruler offset'leri dahil)
    const gridX = rawX - dimensions.keyboardWidth;
    const gridY = rawY - dimensions.rulerHeight;
    
    // Clamp koordinatları
    const clampedX = Math.max(0, gridX);
    const clampedY = Math.max(0, gridY);
    
    return {
      // Raw mouse pozisyonları
      rawX,
      rawY,
      
      // Grid koordinatları
      x: clampedX,
      y: clampedY,
      
      // Mantıksal koordinatlar
      time: transforms.xToTime(clampedX),
      pitch: transforms.yToPitch(clampedY),
      
      // Hangi alanda olduğu bilgisi
      inKeyboard: rawX < dimensions.keyboardWidth,
      inRuler: rawY < dimensions.rulerHeight,
      inGrid: rawX >= dimensions.keyboardWidth && rawY >= dimensions.rulerHeight
    };
  }, [containerRef, scrollPosition, dimensions, transforms]);

  // Nota rect'i hesaplama - optimize edilmiş
  const getNoteRect = useCallback((note) => {
    const x = transforms.timeToX(note.time);
    const y = transforms.pitchToY(note.pitch);
    
    // Duration hesaplama (cache'lenebilir)
    let width;
    try {
      const durationSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
      width = Math.max(4, durationSteps * dimensions.stepWidth - 1);
    } catch (error) {
      console.warn('Invalid note duration:', note.duration);
      width = dimensions.stepWidth - 1;
    }
    
    return {
      x,
      y,
      width,
      height: dimensions.keyHeight - 1,
      right: x + width,
      bottom: y + dimensions.keyHeight - 1
    };
  }, [transforms, dimensions]);

  // Viewport culling - performans için
  const isRectVisible = useCallback((rect, margin = 100) => {
    const viewLeft = scrollPosition.x - margin;
    const viewRight = scrollPosition.x + (containerRef.current?.clientWidth || 0) + margin;
    const viewTop = scrollPosition.y - margin;
    const viewBottom = scrollPosition.y + (containerRef.current?.clientHeight || 0) + margin;
    
    return (
      rect.x < viewRight &&
      rect.right > viewLeft &&
      rect.y < viewBottom &&
      rect.bottom > viewTop
    );
  }, [scrollPosition, containerRef]);

  // Nota görünürlük kontrolü
  const isNoteVisible = useCallback((note, margin = 100) => {
    const rect = getNoteRect(note);
    return isRectVisible(rect, margin);
  }, [getNoteRect, isRectVisible]);

  // Grid snap hesaplaması
  const snapToGrid = useCallback((time, snapValue = '16n') => {
    try {
      const snapSteps = Tone.Time(snapValue).toSeconds() / Tone.Time('16n').toSeconds();
      return Math.round(time / snapSteps) * snapSteps;
    } catch (error) {
      console.warn('Invalid snap value:', snapValue);
      return Math.round(time);
    }
  }, []);

  // Debug bilgileri
  const getDebugInfo = useCallback(() => ({
    dimensions,
    scrollPosition,
    containerSize: {
      width: containerRef.current?.clientWidth || 0,
      height: containerRef.current?.clientHeight || 0
    },
    transforms: Object.keys(transforms)
  }), [dimensions, scrollPosition, transforms, containerRef]);

  return {
    // Boyutlar
    ...dimensions,
    
    // Dönüştürme fonksiyonları
    ...transforms,
    
    // Yardımcı fonksiyonlar
    mouseToGrid,
    getNoteRect,
    isNoteVisible,
    isRectVisible,
    snapToGrid,
    
    // Pitch yardımcıları
    ...pitchHelpers,
    
    // Debug
    getDebugInfo,
    
    // Scroll bilgisi
    scrollX: scrollPosition.x,
    scrollY: scrollPosition.y
  };
};