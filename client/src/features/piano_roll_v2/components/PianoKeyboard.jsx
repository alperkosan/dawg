// src/features/piano_roll_v2/components/PianoKeyboard.jsx
import React, { useMemo, useState, useCallback } from 'react';
import { NOTES } from '../store/usePianoRollStoreV2';
import { AudioContextService } from '../../../lib/services/AudioContextService';

export const PianoKeyboard = React.memo(({ engine, instrumentId }) => {
  const [playingNotes, setPlayingNotes] = useState(new Set());

  const keys = useMemo(() => {
    const keyData = [];
    for (let i = 0; i < engine.totalKeys; i++) {
      const keyIndex = engine.totalKeys - 1 - i;
      const noteIndex = keyIndex % 12;
      const octave = Math.floor(keyIndex / 12);
      const noteName = NOTES[noteIndex];
      keyData.push({
        pitch: `${noteName}${octave}`,
        isBlack: noteName.includes('#'),
        isC: noteName === 'C',
      });
    }
    return keyData;
  }, [engine.totalKeys]);

  const handleMouseDown = useCallback((pitch) => {
    AudioContextService.auditionNoteOn(instrumentId, pitch, 0.8);
    setPlayingNotes(prev => new Set(prev).add(pitch));
  }, [instrumentId]);

  const handleMouseUp = useCallback((pitch) => {
    AudioContextService.auditionNoteOff(instrumentId, pitch);
    setPlayingNotes(prev => {
      const newSet = new Set(prev);
      newSet.delete(pitch);
      return newSet;
    });
  }, [instrumentId]);

  return (
    <div className="prv2-keyboard__content" style={{ height: engine.gridHeight }}>
      {keys.map((key) => (
        <div
          key={key.pitch}
          className={`prv2-keyboard__key ${key.isBlack ? 'prv2-keyboard__key--black' : 'prv2-keyboard__key--white'} ${playingNotes.has(key.pitch) ? 'prv2-keyboard__key--playing' : ''}`}
          style={{ height: engine.keyHeight }}
          onMouseDown={() => handleMouseDown(key.pitch)}
          onMouseUp={() => handleMouseUp(key.pitch)}
          onMouseLeave={() => playingNotes.has(key.pitch) && handleMouseUp(key.pitch)}
        >
          {key.isC && <span className="prv2-keyboard__label">{key.pitch}</span>}
        </div>
      ))}
    </div>
  );
});