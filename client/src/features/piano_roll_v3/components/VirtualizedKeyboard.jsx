/**
 * @file VirtualizedKeyboard.jsx
 * @description Fixed keyboard component with proper scroll sync
 */
import React, { memo, useMemo, useCallback, useState } from 'react';
import { LOD_LEVELS } from '../store/usePianoRollV3Store';

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
  const keyOpacity = noteInfo.isBlack ? 0.8 : 1;

  return (
    <div
      className={keyClassName}
      style={{
        position: 'absolute',
        left: 0,
        top: y,
        width,
        height: height - 1,
        opacity: keyOpacity,
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

PianoKey.displayName = 'PianoKey';

const VirtualizedKeyboard = memo(({ engine, onNotePreview, instrumentId }) => {
  const { virtualGrid, performance, viewport, grid, coordUtils } = engine;
  const [activeNotes, setActiveNotes] = useState(new Set());

  // Visible keys with FIXED positioning (no viewport offset subtraction!)
  const visibleKeys = useMemo(() => {
    const { horizontalLines } = virtualGrid;
    const lodLevel = performance.lodLevel;

    return horizontalLines.map(line => {
      const noteInfo = coordUtils.getNoteInfo(line.key);
      // IMPORTANT: Don't subtract viewport.scrollY here!
      // The keyboard content is already being transformed by useScrollSync
      const y = line.y;
      const isVisible = y >= viewport.scrollY - grid.keyHeight && 
                       y <= viewport.scrollY + viewport.height + grid.keyHeight;

      // LOD-based filtering
      let shouldRender = true;
      if (lodLevel === LOD_LEVELS.ULTRA_SIMPLIFIED) {
        shouldRender = noteInfo.isC && (line.key % 12 === 0); // Only C notes, 1 octave spacing
      } else if (lodLevel === LOD_LEVELS.SIMPLIFIED) {
        shouldRender = noteInfo.isC || !noteInfo.isBlack; // C notes + white keys
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

  // Global mouse up handler for cleanup
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
        height: '100%',
        overflow: 'visible',
        backgroundColor: '#2a2a2a',
        borderRight: '1px solid #444',
      }}
    >
      {/* Keyboard background */}
      <div className="piano-roll-v3__keyboard-bg" />

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

      {/* Octave separators (detailed modes) */}
      {(performance.lodLevel === LOD_LEVELS.DETAILED ||
        performance.lodLevel === LOD_LEVELS.ULTRA_DETAILED) && (
        <div className="piano-roll-v3__octave-separators">
          {visibleKeys
            .filter(key => key.isVisible && key.noteInfo.isC && key.noteInfo.pitch.includes('0'))
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

      {/* Active notes indicator */}
      {activeNotes.size > 0 && (
        <div
          className="piano-roll-v3__active-indicator"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#00ff88',
            pointerEvents: 'none',
            animation: 'pulse 1s ease infinite',
          }}
        />
      )}

      {/* Scroll position indicator (ultra detailed mode) */}
      {performance.lodLevel === LOD_LEVELS.ULTRA_DETAILED && (
        <div
          className="piano-roll-v3__scroll-indicator"
          style={{
            position: 'absolute',
            right: 2,
            top: 8,
            bottom: 8,
            width: '4px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '2px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: `${(viewport.scrollY / (grid.totalKeys * grid.keyHeight)) * 100}%`,
              width: '100%',
              height: `${(viewport.height / (grid.totalKeys * grid.keyHeight)) * 100}%`,
              backgroundColor: 'rgba(255,255,255,0.5)',
              borderRadius: '2px',
              minHeight: '20px',
            }}
          />
        </div>
      )}
    </div>
  );
});

VirtualizedKeyboard.displayName = 'VirtualizedKeyboard';

export default VirtualizedKeyboard;