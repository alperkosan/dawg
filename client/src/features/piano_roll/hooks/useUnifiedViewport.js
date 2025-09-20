// src/features/piano_roll/hooks/useUnifiedViewport.js
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useCoordinateSystem } from './useCoordinateSystem';
import { useScrollSync } from './useScrollSync';
import { usePianoRollStore } from '../store/usePianoRollStore';

/**
 * Piano Roll için birleşik viewport yönetimi
 * Koordinat sistemi, scroll senkronizasyon ve viewport tracking'i birleştirir
 */
export const useUnifiedViewport = ({
  containerRef,
  rulerContentRef,
  keyboardContentRef,
  loopLength = 16
}) => {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  
  // Store'dan zoom değerlerini al
  const { zoomX, zoomY } = usePianoRollStore();

  // Koordinat sistemi
  const coordinateSystem = useCoordinateSystem({
    containerRef,
    zoomX,
    zoomY,
    loopLength,
    scrollPosition
  });

  // Scroll senkronizasyon
  const scrollSync = useScrollSync({
    mainContainerRef: containerRef,
    rulerContentRef,
    keyboardContentRef,
    onScrollChange: setScrollPosition
  });

  // Container boyut değişikliklerini izle
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight
      });
    };

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    
    // İlk boyutu ayarla
    updateSize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  // Viewport bounds hesaplama
  const viewportBounds = useMemo(() => {
    const margin = 200; // Render buffer
    
    return {
      left: scrollPosition.x - margin,
      right: scrollPosition.x + containerSize.width + margin,
      top: scrollPosition.y - margin,
      bottom: scrollPosition.y + containerSize.height + margin,
      
      // Viewport center
      centerX: scrollPosition.x + containerSize.width / 2,
      centerY: scrollPosition.y + containerSize.height / 2,
      
      // Visible area (without buffer)
      visibleLeft: scrollPosition.x,
      visibleRight: scrollPosition.x + containerSize.width,
      visibleTop: scrollPosition.y,
      visibleBottom: scrollPosition.y + containerSize.height
    };
  }, [scrollPosition, containerSize]);

  // Gelişmiş görünürlük kontrolü
  const isNoteInViewport = useCallback((note, includeBuffer = true) => {
    const rect = coordinateSystem.getNoteRect(note);
    const bounds = includeBuffer ? viewportBounds : {
      left: viewportBounds.visibleLeft,
      right: viewportBounds.visibleRight,
      top: viewportBounds.visibleTop,
      bottom: viewportBounds.visibleBottom
    };
    
    return (
      rect.x < bounds.right &&
      rect.right > bounds.left &&
      rect.y < bounds.bottom &&
      rect.bottom > bounds.top
    );
  }, [coordinateSystem, viewportBounds]);

  // Batch note filtering for performance
  const filterVisibleNotes = useCallback((notes, includeBuffer = true) => {
    return notes.filter(note => isNoteInViewport(note, includeBuffer));
  }, [isNoteInViewport]);

  // Gelişmiş mouse-to-grid dönüştürme
  const mouseToGrid = useCallback((e) => {
    let clientX, clientY;
    
    // Mouse ve touch event'lerini destekle
    if (e.touches) {
      const touch = e.touches[0] || e.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const gridPos = coordinateSystem.mouseToGrid(clientX, clientY);
    
    if (!gridPos) return null;
    
    // Ek bilgiler ekle
    return {
      ...gridPos,
      
      // Snap edilmiş pozisyonlar
      snappedTime: coordinateSystem.snapToGrid(gridPos.time),
      
      // Viewport içinde mi?
      inViewport: gridPos.inGrid && (
        gridPos.x >= viewportBounds.visibleLeft &&
        gridPos.x <= viewportBounds.visibleRight &&
        gridPos.y >= viewportBounds.visibleTop &&
        gridPos.y <= viewportBounds.visibleBottom
      ),
      
      // Relativized coordinates (viewport'a göre)
      relativeX: gridPos.x - scrollPosition.x,
      relativeY: gridPos.y - scrollPosition.y
    };
  }, [coordinateSystem, viewportBounds, scrollPosition]);

  // Zoom operations
  const zoomOperations = useMemo(() => ({
    zoomToFit: (notes) => {
      if (!notes.length) return;
      
      const rects = notes.map(note => coordinateSystem.getNoteRect(note));
      const bounds = {
        left: Math.min(...rects.map(r => r.x)),
        top: Math.min(...rects.map(r => r.y)),
        right: Math.max(...rects.map(r => r.right)),
        bottom: Math.max(...rects.map(r => r.bottom))
      };
      
      scrollSync.zoomToRect({
        x: bounds.left,
        y: bounds.top,
        width: bounds.right - bounds.left,
        height: bounds.bottom - bounds.top
      });
    },
    
    centerOnTime: (time) => {
      const x = coordinateSystem.timeToX(time);
      const targetScrollX = x - containerSize.width / 2;
      scrollSync.scrollTo(targetScrollX, scrollPosition.y);
    },
    
    centerOnPitch: (pitch) => {
      const y = coordinateSystem.pitchToY(pitch);
      const targetScrollY = y - containerSize.height / 2;
      scrollSync.scrollTo(scrollPosition.x, targetScrollY);
    }
  }), [coordinateSystem, scrollSync, containerSize, scrollPosition]);

  // Performance monitoring
  const getPerformanceMetrics = useCallback((notes = []) => {
    const visibleNotes = filterVisibleNotes(notes).length;
    
    return {
      totalNotes: notes.length,
      visibleNotes,
      cullRatio: notes.length > 0 ? (1 - visibleNotes / notes.length) : 0,
      viewportArea: containerSize.width * containerSize.height,
      gridCoverage: {
        x: containerSize.width / coordinateSystem.gridWidth,
        y: containerSize.height / coordinateSystem.gridHeight
      }
    };
  }, [filterVisibleNotes, containerSize, coordinateSystem]);

  // Debug information
  const getDebugInfo = useCallback(() => ({
    scrollPosition,
    containerSize,
    viewportBounds,
    coordinateSystem: coordinateSystem.getDebugInfo(),
    zoom: { x: zoomX, y: zoomY }
  }), [scrollPosition, containerSize, viewportBounds, coordinateSystem, zoomX, zoomY]);

  return {
    // Coordinate system methods
    ...coordinateSystem,
    
    // Scroll control
    ...scrollSync,
    
    // Viewport state
    containerWidth: containerSize.width,
    containerHeight: containerSize.height,
    viewportBounds,
    
    // Enhanced methods
    mouseToGrid,
    isNoteInViewport,
    filterVisibleNotes,
    
    // Zoom operations
    ...zoomOperations,
    
    // Utilities
    getPerformanceMetrics,
    getDebugInfo
  };
};