// client/src/features/piano_roll/hooks/useTouchHandler.js
import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Piano Roll için touch event yönetimi
 * Pinch-to-zoom, pan, tap, long-press desteği
 */
export const useTouchHandler = ({
  onZoom,
  onPan, 
  onTap,
  onLongPress,
  onTwoFingerTap,
  containerRef
}) => {
  const [touchState, setTouchState] = useState({
    isActive: false,
    startTime: 0,
    startDistance: 0,
    startCenter: { x: 0, y: 0 },
    lastCenter: { x: 0, y: 0 },
    touchCount: 0,
    gestureType: null // 'pan', 'zoom', 'tap', 'longPress'
  });

  const longPressTimer = useRef(null);
  const tapTimer = useRef(null);
  const lastTapTime = useRef(0);

  // Touch pozisyonları hesaplama
  const getTouchPositions = useCallback((touches) => {
    const positions = Array.from(touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY
    }));
    
    return positions;
  }, []);

  // İki parmak arasındaki mesafe
  const getDistance = useCallback((pos1, pos2) => {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // İki parmağın ortası
  const getCenter = useCallback((positions) => {
    if (positions.length === 1) {
      return positions[0];
    }
    
    const x = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length;
    const y = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length;
    return { x, y };
  }, []);

  // Touch başlangıcı
  const handleTouchStart = useCallback((e) => {
    e.preventDefault(); // Scrolling'i engelle
    
    const positions = getTouchPositions(e.touches);
    const center = getCenter(positions);
    const now = Date.now();
    
    // Long press timer başlat
    if (positions.length === 1) {
      longPressTimer.current = setTimeout(() => {
        if (touchState.gestureType === null) {
          setTouchState(prev => ({ ...prev, gestureType: 'longPress' }));
          onLongPress?.(center);
        }
      }, 500); // 500ms long press
    }

    setTouchState({
      isActive: true,
      startTime: now,
      startDistance: positions.length > 1 ? getDistance(positions[0], positions[1]) : 0,
      startCenter: center,
      lastCenter: center,
      touchCount: positions.length,
      gestureType: null
    });
  }, [getTouchPositions, getCenter, getDistance, touchState.gestureType, onLongPress]);

  // Touch hareketi
  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    
    if (!touchState.isActive) return;
    
    const positions = getTouchPositions(e.touches);
    const center = getCenter(positions);
    
    // Long press timer'ı iptal et (hareket varsa)
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (positions.length === 2 && touchState.touchCount === 2) {
      // Pinch to zoom
      const currentDistance = getDistance(positions[0], positions[1]);
      const distanceChange = currentDistance - touchState.startDistance;
      const scale = currentDistance / touchState.startDistance;
      
      if (Math.abs(distanceChange) > 10 && touchState.gestureType === null) {
        setTouchState(prev => ({ ...prev, gestureType: 'zoom' }));
      }
      
      if (touchState.gestureType === 'zoom') {
        onZoom?.(scale, center);
      }
      
    } else if (positions.length === 1) {
      // Single finger pan
      const deltaX = center.x - touchState.lastCenter.x;
      const deltaY = center.y - touchState.lastCenter.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (distance > 5 && touchState.gestureType === null) {
        setTouchState(prev => ({ ...prev, gestureType: 'pan' }));
      }
      
      if (touchState.gestureType === 'pan') {
        onPan?.(deltaX, deltaY, center);
      }
    }
    
    setTouchState(prev => ({ ...prev, lastCenter: center }));
  }, [touchState, getTouchPositions, getCenter, getDistance, onZoom, onPan]);

  // Touch bitişi
  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const now = Date.now();
    const touchDuration = now - touchState.startTime;
    const remainingTouches = e.touches.length;

    // Tap gesture algılama
    if (touchState.gestureType === null && touchDuration < 300) {
      const timeSinceLastTap = now - lastTapTime.current;
      
      if (touchState.touchCount === 1) {
        // Single tap
        if (timeSinceLastTap < 300) {
          // Double tap
          if (tapTimer.current) {
            clearTimeout(tapTimer.current);
            tapTimer.current = null;
          }
          onTap?.(touchState.startCenter, 'double');
        } else {
          // Potential single tap - wait to see if double tap follows
          tapTimer.current = setTimeout(() => {
            onTap?.(touchState.startCenter, 'single');
            tapTimer.current = null;
          }, 300);
        }
        lastTapTime.current = now;
        
      } else if (touchState.touchCount === 2) {
        // Two finger tap
        onTwoFingerTap?.(touchState.startCenter);
      }
    }

    // State'i sıfırla
    if (remainingTouches === 0) {
      setTouchState({
        isActive: false,
        startTime: 0,
        startDistance: 0,
        startCenter: { x: 0, y: 0 },
        lastCenter: { x: 0, y: 0 },
        touchCount: 0,
        gestureType: null
      });
    }
  }, [touchState, onTap, onTwoFingerTap]);

  // Touch iptal
  const handleTouchCancel = useCallback((e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
    }

    setTouchState({
      isActive: false,
      startTime: 0,
      startDistance: 0,
      startCenter: { x: 0, y: 0 },
      lastCenter: { x: 0, y: 0 },
      touchCount: 0,
      gestureType: null
    });
  }, []);

  // Event listener'ları ekle
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options = { passive: false }; // preventDefault için

    container.addEventListener('touchstart', handleTouchStart, options);
    container.addEventListener('touchmove', handleTouchMove, options);
    container.addEventListener('touchend', handleTouchEnd, options);
    container.addEventListener('touchcancel', handleTouchCancel, options);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  return {
    touchState,
    isTouch: touchState.isActive,
    gestureType: touchState.gestureType
  };
};