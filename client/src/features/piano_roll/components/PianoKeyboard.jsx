// Enhanced PianoKeyboard.jsx - Interactive piano keyboard with scale highlighting
import React, { memo, useMemo, useCallback, useState } from 'react';
import { NOTES } from '../utils/constants';

const PianoKeyboard = memo(({ 
  viewport, 
  scale, 
  onNotePreview, 
  totalKeys = 96,
  className = '' 
}) => {
  const [playingNotes, setPlayingNotes] = useState(new Set());
  const [hoveredKey, setHoveredKey] = useState(null);

  // ✅ GENERATE KEYS WITH ENHANCED METADATA
  const keys = useMemo(() => {
    const scaleNotes = scale?.getScaleNotes ? scale.getScaleNotes() : new Set();
    
    return Array.from({ length: totalKeys }, (_, index) => {
      const keyIndex = totalKeys - 1 - index;
      const noteIndex = keyIndex % 12;
      const octave = Math.floor(keyIndex / 12);
      const noteName = NOTES[noteIndex];
      const pitch = `${noteName}${octave}`;
      
      const isBlackKey = noteName.includes('#');
      const isInScale = scaleNotes.has(noteIndex);
      const isRoot = scale && noteName === scale.root;
      const isC = noteName === 'C';
      const isPlaying = playingNotes.has(pitch);
      const isHovered = hoveredKey === pitch;
      
      return {
        pitch,
        noteName,
        octave,
        noteIndex,
        isBlackKey,
        isInScale,
        isRoot,
        isC,
        isPlaying,
        isHovered,
        y: index * viewport.keyHeight,
        keyIndex
      };
    });
  }, [totalKeys, viewport.keyHeight, scale, playingNotes, hoveredKey]);

  // ✅ KEY INTERACTION HANDLERS
  const handleKeyMouseDown = useCallback((key, e) => {
    e.preventDefault();
    
    setPlayingNotes(prev => new Set(prev).add(key.pitch));
    onNotePreview?.(key.pitch, 0.8);
  }, [onNotePreview]);

  const handleKeyMouseUp = useCallback((key) => {
    setPlayingNotes(prev => {
      const newSet = new Set(prev);
      newSet.delete(key.pitch);
      return newSet;
    });
    onNotePreview?.(key.pitch, 0);
  }, [onNotePreview]);

  const handleKeyMouseEnter = useCallback((key) => {
    setHoveredKey(key.pitch);
  }, []);

  const handleKeyMouseLeave = useCallback((key) => {
    setHoveredKey(null);
    // Also stop note if it was playing
    if (playingNotes.has(key.pitch)) {
      handleKeyMouseUp(key);
    }
  }, [playingNotes, handleKeyMouseUp]);

  // ✅ KEY STYLING FUNCTION
  const getKeyStyles = useCallback((key) => {
    let baseClasses = `
      relative w-full flex items-center px-3 text-xs font-medium cursor-pointer 
      transition-all duration-100 border-x border-gray-600 select-none
    `;
    
    let backgroundColor, textColor, borderColor, transform, boxShadow;

    // Base styling by key type
    if (key.isBlackKey) {
      backgroundColor = 'rgb(17, 24, 39)'; // gray-900
      textColor = 'rgb(156, 163, 175)'; // gray-400
      borderColor = 'rgb(75, 85, 99)'; // gray-600
    } else {
      backgroundColor = 'rgb(55, 65, 81)'; // gray-700
      textColor = 'rgb(229, 231, 235)'; // gray-200
      borderColor = 'rgb(107, 114, 128)'; // gray-500
    }

    // Scale highlighting
    if (key.isInScale) {
      if (key.isRoot) {
        backgroundColor = key.isBlackKey ? 'rgb(99, 102, 241)' : 'rgb(129, 140, 248)'; // indigo-600/500
        textColor = 'rgb(255, 255, 255)';
        boxShadow = '0 0 12px rgba(99, 102, 241, 0.4)';
      } else {
        backgroundColor = key.isBlackKey ? 'rgb(67, 56, 202)' : 'rgb(99, 102, 241)'; // indigo-700/600
        textColor = 'rgb(224, 231, 255)'; // indigo-100
        boxShadow = '0 0 8px rgba(99, 102, 241, 0.2)';
      }
    }

    // Playing state
    if (key.isPlaying) {
      backgroundColor = 'rgb(34, 197, 94)'; // green-500
      textColor = 'rgb(255, 255, 255)';
      transform = 'scale(0.98)';
      boxShadow = '0 0 16px rgba(34, 197, 94, 0.6), inset 0 2px 4px rgba(0, 0, 0, 0.2)';
    }
    // Hover state (if not playing)
    else if (key.isHovered) {
      backgroundColor = key.isInScale 
        ? (key.isRoot ? 'rgb(129, 140, 248)' : 'rgb(99, 102, 241)')
        : (key.isBlackKey ? 'rgb(31, 41, 55)' : 'rgb(75, 85, 99)');
      transform = 'scale(1.02)';
      boxShadow = `0 2px 8px rgba(0, 0, 0, 0.3)`;
    }

    return {
      backgroundColor,
      color: textColor,
      borderColor,
      transform: transform || 'scale(1)',
      boxShadow: boxShadow || 'none',
      height: viewport.keyHeight,
      borderTopWidth: '1px',
      borderBottomWidth: '1px'
    };
  }, [viewport.keyHeight]);

  // ✅ OCTAVE MARKERS
  const renderOctaveMarkers = () => {
    const markers = [];
    for (let octave = 0; octave < 8; octave++) {
      const cIndex = octave * 12;
      const yPosition = (totalKeys - 1 - cIndex) * viewport.keyHeight;
      
      markers.push(
        <div
          key={`octave-${octave}`}
          className="absolute left-0 right-0 border-t-2 border-cyan-400/30 pointer-events-none"
          style={{ top: yPosition }}
        >
          <div className="absolute right-1 -top-3 text-xs text-cyan-400/60 font-mono">
            C{octave}
          </div>
        </div>
      );
    }
    return markers;
  };

  // ✅ SCALE INFO DISPLAY
  const renderScaleInfo = () => {
    if (!scale) return null;
    
    return (
      <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs font-medium backdrop-blur-sm">
        {scale.root} {scale.type}
      </div>
    );
  };

  return (
    <div 
      className={`relative bg-gray-800 border-r border-gray-600 overflow-hidden ${className}`}
      style={{ 
        width: 96,
        height: viewport.gridHeight,
        contain: 'layout style paint'
      }}
    >
      {/* SCALE INFO */}
      {renderScaleInfo()}
      
      {/* OCTAVE MARKERS */}
      {renderOctaveMarkers()}
      
      {/* PIANO KEYS */}
      <div className="relative h-full">
        {keys.map(key => (
          <div
            key={key.pitch}
            style={getKeyStyles(key)}
            onMouseDown={(e) => handleKeyMouseDown(key, e)}
            onMouseUp={() => handleKeyMouseUp(key)}
            onMouseEnter={() => handleKeyMouseEnter(key)}
            onMouseLeave={() => handleKeyMouseLeave(key)}
            onContextMenu={(e) => e.preventDefault()}
            title={`${key.pitch}${key.isInScale ? ' (in scale)' : ''}${key.isRoot ? ' (root)' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`Piano key ${key.pitch}`}
            data-pitch={key.pitch}
            data-note={key.noteName}
            data-octave={key.octave}
          >
            {/* KEY LABEL */}
            <div className="flex items-center justify-between w-full">
              {/* Note name - always show for C keys and root notes */}
              {(key.isC || key.isRoot || key.isInScale) && (
                <span className={`font-mono ${key.isRoot ? 'font-bold' : ''}`}>
                  {key.isC ? key.pitch : key.noteName}
                  {key.isRoot && <span className="ml-1 text-xs">★</span>}
                </span>
              )}
              
              {/* Scale degree indicator */}
              {key.isInScale && scale?.getScaleNotes && (
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    key.isRoot ? 'bg-white' : 'bg-white/60'
                  }`} />
                </div>
              )}
            </div>
            
            {/* VELOCITY SENSITIVITY INDICATOR */}
            {key.isPlaying && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/60" />
            )}
          </div>
        ))}
      </div>
      
      {/* KEYBOARD SHORTCUT HINTS */}
      <div className="absolute bottom-2 left-2 right-2 text-xs text-gray-500 text-center">
        <div>Click to preview</div>
        <div className="text-xs opacity-75">Hold to sustain</div>
      </div>
    </div>
  );
});

PianoKeyboard.displayName = 'PianoKeyboard';

export default PianoKeyboard;