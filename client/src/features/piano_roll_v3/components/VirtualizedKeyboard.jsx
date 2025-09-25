
/**
 * @file VirtualizedKeyboard.jsx - FIXED VERSION
 * @description Keyboard with proper scroll viewport handling
 */
const PianoKey = memo(({
  noteInfo,
  y,
  height,
  width,
  isActive,
  isVisible,
  onMouseDown,
  onMouseUp,
  lodLevel
}) => {
  if (!isVisible) return null;

  const keyClassName = [
    'piano-roll-v3__key',
    `piano-roll-v3__key--${noteInfo.isBlack ? 'black' : 'white'}`,
    isActive && 'piano-roll-v3__key--active'
  ].filter(Boolean).join(' ');

  const showLabel = (lodLevel === LOD_LEVELS.DETAILED || lodLevel === LOD_LEVELS.ULTRA_DETAILED) &&
                   noteInfo.isC;

  return (
    <div
      className={keyClassName}
      style={{
        position: 'absolute',
        left: 0,
        top: y,
        width,
        height: height - 1,
        cursor: 'pointer',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}
      onMouseDown={() => onMouseDown(noteInfo)}
      onMouseUp={() => onMouseUp(noteInfo)}
      onMouseLeave={() => onMouseUp(noteInfo)}
    >
      {showLabel && (
        <span
          className="piano-roll-v3__key-label"
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '11px',
            fontWeight: 'bold',
            color: noteInfo.isBlack ? '#fff' : '#333',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {noteInfo.pitch}
        </span>
      )}
    </div>
  );
});

export const VirtualizedKeyboard = memo(({ engine, onNotePreview, instrumentId }) => {
  const { virtualGrid, performance, viewport, grid, coordUtils } = engine;
  const [activeNotes, setActiveNotes] = React.useState(new Set());

  // Visible keys with FIXED positioning
  const visibleKeys = useMemo(() => {
    const { horizontalLines } = virtualGrid;
    const lodLevel = performance.lodLevel;

    return horizontalLines.map(line => {
      const noteInfo = coordUtils.getNoteInfo(line.key);
      // IMPORTANT: Don't subtract viewport.scrollY here!
      const y = line.y;
      const isVisible = y >= viewport.scrollY - grid.keyHeight && 
                       y <= viewport.scrollY + viewport.height + grid.keyHeight;

      // LOD-based filtering
      let shouldRender = true;
      if (lodLevel === LOD_LEVELS.ULTRA_SIMPLIFIED) {
        shouldRender = noteInfo.isC && (line.key % 12 === 0);
      } else if (lodLevel === LOD_LEVELS.SIMPLIFIED) {
        shouldRender = noteInfo.isC || !noteInfo.isBlack;
      }

      return {
        ...line,
        noteInfo,
        y,
        isVisible: isVisible && shouldRender,
        isActive: activeNotes.has(noteInfo.pitch),
      };
    });
  }, [virtualGrid, performance.lodLevel, viewport.scrollY, viewport.height, grid.keyHeight, coordUtils, activeNotes]);

  // Note preview handlers
  const handleMouseDown = useCallback((noteInfo) => {
    if (!onNotePreview || activeNotes.has(noteInfo.pitch)) return;

    setActiveNotes(prev => new Set(prev).add(noteInfo.pitch));
    onNotePreview(noteInfo.pitch, true, instrumentId);
  }, [onNotePreview, instrumentId, activeNotes]);

  const handleMouseUp = useCallback((noteInfo) => {
    if (!onNotePreview || !activeNotes.has(noteInfo.pitch)) return;

    setActiveNotes(prev => {
      const newSet = new Set(prev);
      newSet.delete(noteInfo.pitch);
      return newSet;
    });
    onNotePreview(noteInfo.pitch, false, instrumentId);
  }, [onNotePreview, instrumentId, activeNotes]);

  // Global mouse up cleanup
  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (activeNotes.size === 0) return;

      activeNotes.forEach(pitch => {
        onNotePreview?.(pitch, false, instrumentId);
      });
      setActiveNotes(new Set());
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [activeNotes, onNotePreview, instrumentId]);

  // Dynamic keyboard width based on LOD
  const keyboardWidth = useMemo(() => {
    const baseWidth = 80;
    if (performance.lodLevel === LOD_LEVELS.ULTRA_SIMPLIFIED) return baseWidth * 0.6;
    if (performance.lodLevel === LOD_LEVELS.SIMPLIFIED) return baseWidth * 0.8;
    return baseWidth;
  }, [performance.lodLevel]);

  return (
    <div
      className="piano-roll-v3__keyboard"
      style={{
        position: 'relative',
        width: keyboardWidth,
        height: '100%', // Full height of content
        overflow: 'visible', // Allow content to be visible
        backgroundColor: '#2a2a2a',
        borderRight: '1px solid #444',
      }}
    >
      {/* Piano keys */}
      {visibleKeys.filter(key => key.isVisible).map(key => (
        <PianoKey
          key={`key-${key.key}`}
          noteInfo={key.noteInfo}
          y={key.y}
          height={grid.keyHeight}
          width={keyboardWidth}
          isActive={key.isActive}
          isVisible={true}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          lodLevel={performance.lodLevel}
        />
      ))}

      {/* Octave separators */}
      {(performance.lodLevel === LOD_LEVELS.DETAILED ||
        performance.lodLevel === LOD_LEVELS.ULTRA_DETAILED) && (
        <div className="piano-roll-v3__octave-separators">
          {visibleKeys
            .filter(key => key.isVisible && key.noteInfo.isC && key.noteInfo.pitch.endsWith('0'))
            .map(key => (
              <div
                key={`octave-${key.key}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: key.y,
                  width: '100%',
                  height: '2px',
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  pointerEvents: 'none',
                }}
              />
            ))
          }
        </div>
      )}

      {/* Active indicator */}
      {activeNotes.size > 0 && (
        <div
          className="piano-roll-v3__active-indicator"
          style={{
            position: 'fixed',
            top: 4,
            right: 4,
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#00ff88',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
});

VirtualizedTimeline.displayName = 'VirtualizedTimeline';
VirtualizedKeyboard.displayName = 'VirtualizedKeyboard';

export { VirtualizedTimeline, VirtualizedKeyboard };