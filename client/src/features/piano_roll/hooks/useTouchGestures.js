// Touch gestures hook for mobile support
export const useTouchGestures = ({ 
  onZoom, 
  onPan, 
  onTap, 
  onLongPress,
  containerRef 
}) => {
  const [touchState, setTouchState] = useState({
    isActive: false,
    startTime: 0,
    startDistance: 0,
    startCenter: { x: 0, y: 0 },
    lastCenter: { x: 0, y: 0 },
    touchCount: 0,
    gestureType: null
  });

  const longPressTimer = useRef(null);

  const getTouchPositions = useCallback((touches) => {
    return Array.from(touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY
    }));
  }, []);

  const getDistance = useCallback((pos1, pos2) => {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getCenter = useCallback((positions) => {
    if (positions.length === 1) return positions[0];
    
    const x = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length;
    const y = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length;
    return { x, y };
  }, []);

  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    
    const positions = getTouchPositions(e.touches);
    const center = getCenter(positions);
    const now = Date.now();
    
    if (positions.length === 1) {
      longPressTimer.current = setTimeout(() => {
        if (touchState.gestureType === null) {
          setTouchState(prev => ({ ...prev, gestureType: 'longPress' }));
          onLongPress?.(center);
        }
      }, 500);
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
  }, [getTouchPositions, getCenter, getDistance, onLongPress, touchState.gestureType]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    
    if (!touchState.isActive) return;
    
    const positions = getTouchPositions(e.touches);
    const center = getCenter(positions);
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (positions.length === 2 && touchState.touchCount === 2) {
      const currentDistance = getDistance(positions[0], positions[1]);
      const scale = currentDistance / touchState.startDistance;
      
      if (Math.abs(currentDistance - touchState.startDistance) > 10 && touchState.gestureType === null) {
        setTouchState(prev => ({ ...prev, gestureType: 'zoom' }));
      }
      
      if (touchState.gestureType === 'zoom') {
        onZoom?.(scale, center);
      }
      
    } else if (positions.length === 1) {
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

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const now = Date.now();
    const touchDuration = now - touchState.startTime;

    if (touchState.gestureType === null && touchDuration < 300) {
      onTap?.(touchState.startCenter, touchState.touchCount > 1 ? 'double' : 'single');
    }

    if (e.touches.length === 0) {
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
  }, [touchState, onTap]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options = { passive: false };

    container.addEventListener('touchstart', handleTouchStart, options);
    container.addEventListener('touchmove', handleTouchMove, options);
    container.addEventListener('touchend', handleTouchEnd, options);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    touchState,
    isTouch: touchState.isActive,
    gestureType: touchState.gestureType
  };
};