import React, { useState, useCallback, useMemo } from 'react';
import { NOTES } from '../../utils/constants';
import { useAudioContext } from '../../hooks/audio/useAudioContext';
import '../../styles/components/PianoKeyboard.css';

export const PianoKeyboard = React.memo(({ viewport, scale, instrumentId }) => {
  const [playingNotes, setPlayingNotes] = useState(new Set());
  const { auditionNote } = useAudioContext(instrumentId);

  const keys = useMemo(() => {
    const keyData = [];
    const scaleNoteSet = scale?.getScaleNotes ? scale.getScaleNotes() : new Set();
    
    for (let i = 0; i < viewport.totalKeys; i++) {
      const keyIndex = viewport.totalKeys - 1 - i;
      const noteIndex = keyIndex % 12;
      const octave = Math.floor(keyIndex / 12);
      const noteName = NOTES[noteIndex];
      
      keyData.push({
        pitch: `${noteName}${octave}`,
        noteName,
        isBlackKey: noteName.includes('#'),
        isInScale: scaleNoteSet.has(noteIndex),
        isRoot: scale && noteName === scale.root,
        isC: noteName === 'C'
      });
    }
    return keyData;
  }, [viewport.totalKeys, scale]);

  const handleMouseDown = useCallback((pitch) => {
    setPlayingNotes(prev => new Set(prev).add(pitch));
    auditionNote(pitch, 0.8);
  }, [auditionNote]);

  const handleMouseUp = useCallback((pitch) => {
    setPlayingNotes(prev => {
      const newSet = new Set(prev);
      newSet.delete(pitch);
      return newSet;
    });
    auditionNote(pitch, 0);
  }, [auditionNote]);

  return (
    <div 
      className="piano-keyboard"
      style={{
        height: viewport.gridHeight,
        transform: `translateY(${-viewport.scrollY}px)`,
        willChange: 'transform'
      }}
    >
      {keys.map((key, index) => {
        if (key.isBlackKey) return null;

        const nextKey = keys[index - 1];
        const hasBlackKey = nextKey && nextKey.isBlackKey;

        return (
          <div
            key={key.pitch}
            className={`piano-key piano-key--white ${
              key.isInScale ? 'piano-key--in-scale' : ''
            } ${
              key.isRoot ? 'piano-key--root' : ''
            } ${
              playingNotes.has(key.pitch) ? 'piano-key--playing' : ''
            }`}
            style={{ height: viewport.keyHeight }}
            onMouseDown={() => handleMouseDown(key.pitch)}
            onMouseUp={() => handleMouseUp(key.pitch)}
            onMouseLeave={() => playingNotes.has(key.pitch) && handleMouseUp(key.pitch)}
          >
            {(key.isC || key.isRoot) && (
              <span className="piano-key__label">{key.pitch}</span>
            )}
            {hasBlackKey && (
              <div
                key={nextKey.pitch}
                className={`piano-key piano-key--black ${
                  nextKey.isInScale ? 'piano-key--in-scale' : ''
                } ${
                  nextKey.isRoot ? 'piano-key--root' : ''
                } ${
                  playingNotes.has(nextKey.pitch) ? 'piano-key--playing' : ''
                }`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleMouseDown(nextKey.pitch);
                }}
                onMouseUp={(e) => {
                  e.stopPropagation();
                  handleMouseUp(nextKey.pitch);
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  playingNotes.has(nextKey.pitch) && handleMouseUp(nextKey.pitch);
                }}
              >
                <span className="piano-key__label piano-key__label--black">
                  {nextKey.noteName}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
