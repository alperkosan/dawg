import React, { memo, useMemo } from 'react';
import { NOTES, PIANO_KEY_COLORS } from '../utils/constants';

const PianoKeyboard = memo(({ viewport, scale, onNotePreview }) => {
  const keys = useMemo(() => {
    const totalKeys = viewport.totalKeys;
    const scaleNotes = new Set(scale.getScaleNotes());
    
    return Array.from({ length: totalKeys }, (_, index) => {
      const keyIndex = totalKeys - 1 - index;
      const noteIndex = keyIndex % 12;
      const octave = Math.floor(keyIndex / 12);
      const noteName = NOTES[noteIndex];
      const pitch = `${noteName}${octave}`;
      
      const isBlackKey = noteName.includes('#');
      const isInScale = scaleNotes.has(noteIndex);
      const isC = noteName === 'C';
      
      return {
        pitch,
        noteName,
        octave,
        isBlackKey,
        isInScale,
        isC,
        y: index * viewport.keyHeight
      };
    });
  }, [viewport.totalKeys, viewport.keyHeight, scale]);
  
  const handleKeyInteraction = (pitch, type, velocity = 0.8) => {
    if (type === 'press') {
      onNotePreview?.(pitch, velocity);
    } else {
      onNotePreview?.(pitch, 0);
    }
  };
  
  return (
    <div 
      className="w-24 bg-gray-800 border-r border-gray-700 overflow-hidden"
      style={{ height: viewport.gridHeight }}
    >
      {keys.map(key => {
        const keyClasses = `
          relative w-full flex items-center px-2 text-xs cursor-pointer transition-colors
          ${key.isBlackKey 
            ? 'bg-gray-900 text-gray-400 border-t border-b border-gray-800' 
            : 'bg-gray-700 text-gray-200 border-t border-b border-gray-600'
          }
          ${key.isInScale 
            ? 'bg-indigo-900/50 text-indigo-200 font-semibold' 
            : ''
          }
          hover:bg-gray-600
        `;
        
        return (
          <div
            key={key.pitch}
            className={keyClasses}
            style={{ height: viewport.keyHeight }}
            onMouseDown={() => handleKeyInteraction(key.pitch, 'press')}
            onMouseUp={() => handleKeyInteraction(key.pitch, 'release')}
            onMouseLeave={() => handleKeyInteraction(key.pitch, 'release')}
          >
            {key.isC && (
              <span className="text-xs font-mono opacity-75">
                {key.pitch}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});

export default PianoKeyboard;
