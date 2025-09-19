// Enhanced Note.jsx - Optimized note rendering with improved UX
import React, { memo, useMemo, useCallback } from 'react';
import * as Tone from 'tone';

const Note = memo(({ 
  note, 
  isSelected = false, 
  isPreview = false,
  viewport,
  coordinateConverters,
  gridDimensions,
  onResizeStart
}) => {
  // ✅ POSITION AND SIZE CALCULATIONS
  const noteGeometry = useMemo(() => {
    const x = coordinateConverters.stepToX(note.time);
    const y = coordinateConverters.noteToY(note.pitch);
    
    // Calculate duration width
    let width;
    try {
      const durationInSeconds = Tone.Time(note.duration).toSeconds();
      const secondsPerStep = Tone.Time('16n').toSeconds();
      const durationInSteps = durationInSeconds / secondsPerStep;
      width = Math.max(gridDimensions.stepWidth * 0.25, durationInSteps * gridDimensions.stepWidth - 2);
    } catch (error) {
      width = gridDimensions.stepWidth - 2;
    }
    
    const height = gridDimensions.keyHeight - 1;
    
    return { x, y, width, height };
  }, [note, coordinateConverters, gridDimensions]);

  // ✅ VISUAL STYLING
  const noteStyle = useMemo(() => {
    const baseOpacity = 0.7 + (note.velocity * 0.3);
    let backgroundColor, borderColor, boxShadow, zIndex, opacity;

    if (isPreview) {
      backgroundColor = 'rgba(0, 188, 212, 0.6)';
      borderColor = 'rgba(255, 255, 255, 0.8)';
      boxShadow = '0 0 12px rgba(0, 188, 212, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
      zIndex = 25;
      opacity = 0.9;
    } else if (isSelected) {
      backgroundColor = 'rgb(245, 158, 11)'; // amber-500
      borderColor = 'rgb(255, 255, 255)';
      boxShadow = '0 0 16px rgba(245, 158, 11, 0.5), 0 0 6px rgba(245, 158, 11, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
      zIndex = 15;
      opacity = 1;
    } else {
      backgroundColor = `rgba(34, 197, 94, ${baseOpacity})`; // green-500 with velocity-based opacity
      borderColor = 'rgba(34, 197, 94, 0.8)';
      boxShadow = '0 1px 3px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
      zIndex = 10;
      opacity = baseOpacity;
    }

    return {
      position: 'absolute',
      left: noteGeometry.x,
      top: noteGeometry.y,
      width: noteGeometry.width,
      height: noteGeometry.height,
      backgroundColor,
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor,
      borderRadius: '3px',
      boxShadow,
      opacity,
      zIndex,
      cursor: isPreview ? 'default' : 'pointer',
      // Performance optimizations
      transform: 'translateZ(0)',
      backfaceVisibility: 'hidden',
      willChange: isSelected ? 'transform, box-shadow' : 'auto',
      // Smooth transitions
      transition: isPreview ? 'none' : 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      // Text rendering
      fontSize: '11px',
      fontWeight: '500',
      color: isSelected ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: '6px',
      paddingRight: '2px',
      overflow: 'hidden',
      userSelect: 'none'
    };
  }, [noteGeometry, isSelected, isPreview, note.velocity]);

  // ✅ RESIZE HANDLE STYLING
  const resizeHandleStyle = useMemo(() => ({
    position: 'absolute',
    right: 0,
    top: 0,
    width: '8px',
    height: '100%',
    cursor: 'ew-resize',
    zIndex: 35,
    backgroundColor: 'transparent',
    borderRight: isSelected ? '2px solid rgba(255, 255, 255, 0.6)' : 'none',
    transition: 'border-color 0.15s ease',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)'
    }
  }), [isSelected]);

  // ✅ NOTE CONTENT
  const noteContent = useMemo(() => {
    const pitchDisplay = note.pitch.replace(/(\d+)/, '');
    const octave = note.pitch.match(/\d+/)?.[0] || '';
    const velocityPercent = Math.round(note.velocity * 100);
    
    // Show different content based on note width
    if (noteGeometry.width < 30) {
      return null; // Too small to show anything
    } else if (noteGeometry.width < 60) {
      return pitchDisplay; // Just note name
    } else if (noteGeometry.width < 100) {
      return `${pitchDisplay}${octave}`; // Note with octave
    } else {
      return (
        <>
          <span>{pitchDisplay}{octave}</span>
          <span className="text-xs opacity-70">{velocityPercent}</span>
        </>
      );
    }
  }, [note.pitch, note.velocity, noteGeometry.width]);

  // ✅ MOUSE EVENT HANDLERS
  const handleResizeMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart?.(note, e);
  }, [note, onResizeStart]);

  // ✅ HOVER EFFECTS
  const [isHovered, setIsHovered] = React.useState(false);

  const handleMouseEnter = useCallback(() => {
    if (!isPreview) setIsHovered(true);
  }, [isPreview]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  // ✅ DYNAMIC HOVER STYLES
  const hoverStyle = useMemo(() => {
    if (!isHovered || isPreview || isSelected) return {};
    
    return {
      transform: 'translateZ(0) scale(1.02)',
      boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
      borderColor: 'rgba(255, 255, 255, 0.6)'
    };
  }, [isHovered, isPreview, isSelected]);

  // ✅ ACCESSIBILITY
  const accessibilityProps = useMemo(() => ({
    role: 'button',
    tabIndex: isPreview ? -1 : 0,
    'aria-label': `Note ${note.pitch}, duration ${note.duration}, velocity ${Math.round(note.velocity * 127)}`,
    'aria-selected': isSelected,
    'data-note-id': note.id,
    'data-note-pitch': note.pitch,
    'data-note-time': note.time
  }), [note, isSelected, isPreview]);

  return (
    <div
      style={{ ...noteStyle, ...hoverStyle }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...accessibilityProps}
    >
      {/* NOTE CONTENT */}
      {noteContent}
      
      {/* RESIZE HANDLE - Only for non-preview notes */}
      {!isPreview && onResizeStart && noteGeometry.width > 20 && (
        <div
          style={resizeHandleStyle}
          onMouseDown={handleResizeMouseDown}
          title="Resize note duration"
          className="resize-handle"
        />
      )}
      
      {/* VELOCITY INDICATOR - Visual bar at bottom */}
      {!isPreview && noteGeometry.width > 40 && (
        <div 
          className="absolute bottom-0 left-0 h-0.5 bg-white/30 rounded-full"
          style={{ 
            width: `${note.velocity * 100}%`,
            maxWidth: 'calc(100% - 4px)',
            marginLeft: '2px'
          }}
        />
      )}
      
      {/* SELECTION INDICATOR */}
      {isSelected && (
        <div className="absolute -inset-0.5 border border-white/40 rounded-md pointer-events-none" />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // ✅ OPTIMIZED COMPARISON - Only re-render when necessary
  return (
    prevProps.note.id === nextProps.note.id &&
    prevProps.note.time === nextProps.note.time &&
    prevProps.note.pitch === nextProps.note.pitch &&
    prevProps.note.duration === nextProps.note.duration &&
    prevProps.note.velocity === nextProps.note.velocity &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isPreview === nextProps.isPreview &&
    // Grid dimensions comparison
    prevProps.gridDimensions.keyHeight === nextProps.gridDimensions.keyHeight &&
    prevProps.gridDimensions.stepWidth === nextProps.gridDimensions.stepWidth &&
    // Coordinate functions - compare by reference (should be memoized)
    prevProps.coordinateConverters === nextProps.coordinateConverters
  );
});

Note.displayName = 'OptimizedNote';

export default Note;