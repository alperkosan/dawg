import React, { memo, useMemo, useCallback, useState } from 'react';
import { NOTES } from '../utils/constants';

const PianoKeyboard = memo(({ 
  viewport, 
  scale, 
  onNotePreview, 
}) => {
  const totalKeys = viewport.totalKeys || 96;
  const [playingNotes, setPlayingNotes] = useState(new Set());

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
      
      return { pitch, noteName, octave, isBlackKey, isInScale, isRoot, isC, isPlaying: playingNotes.has(pitch) };
    });
  }, [totalKeys, scale, playingNotes]);

  const handleMouseDown = useCallback((key) => {
    setPlayingNotes(prev => new Set(prev).add(key.pitch));
    onNotePreview?.(key.pitch, 0.8);
  }, [onNotePreview]);

  const handleMouseUp = useCallback((key) => {
    setPlayingNotes(prev => {
      const newSet = new Set(prev);
      newSet.delete(key.pitch);
      return newSet;
    });
    onNotePreview?.(key.pitch, 0);
  }, [onNotePreview]);

  return (
    <div className="piano-keyboard" style={{ height: viewport.gridHeight }}>
      {keys.map(key => {
          const keyClasses = [
              'piano-keyboard__key',
              key.isBlackKey ? 'piano-keyboard__key--black' : 'piano-keyboard__key--white',
              key.isInScale ? 'piano-keyboard__key--in-scale' : '',
              key.isRoot ? 'piano-keyboard__key--root' : '',
              key.isPlaying ? 'piano-keyboard__key--playing' : '',
          ].join(' ');

          return (
            <div
                key={key.pitch}
                className={keyClasses}
                style={{ height: viewport.keyHeight }}
                onMouseDown={() => handleMouseDown(key)}
                onMouseUp={() => handleMouseUp(key)}
                onMouseLeave={() => key.isPlaying && handleMouseUp(key)}
            >
                {(key.isC || key.isRoot) && (
                    <span className={key.isC ? 'piano-keyboard__octave-label' : ''}>
                        {key.pitch}
                    </span>
                )}
            </div>
          )
      })}
    </div>
  );
});

PianoKeyboard.displayName = 'PianoKeyboard';
export default PianoKeyboard; // Varsayılan (default) export

