// src/features/piano_roll_v2/components/PianoKeyboard.jsx
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { NOTES } from '../store/usePianoRollStoreV2';
import { AudioContextService } from '../../../lib/services/AudioContextService';

export const PianoKeyboard = React.memo(({ engine, instrumentId, contentRef }) => {
  const [playingNotes, setPlayingNotes] = useState(new Set());
  const playingNotesRef = useRef(new Set());
  
  // --- YENİ: Klavye tuşlarının hesaplaması artık sadece motorun
  // totalKeys değeri değiştiğinde yapılıyor. ---
  const keys = useMemo(() => {
    return Array.from({ length: engine.totalKeys }, (_, i) => {
      const keyIndex = engine.totalKeys - 1 - i;
      const noteIndex = keyIndex % 12;
      const octave = Math.floor(keyIndex / 12);
      const noteName = NOTES[noteIndex];
      return {
        pitch: `${noteName}${octave}`,
        isBlack: noteName.includes('#'),
        isC: noteName === 'C',
      };
    });
  }, [engine.totalKeys]);

  const handleMouseDown = useCallback((pitch) => {
    if (!playingNotesRef.current.has(pitch)) {
      AudioContextService.auditionNoteOn(instrumentId, pitch, 0.8);
      playingNotesRef.current.add(pitch);
      setPlayingNotes(prev => new Set(prev).add(pitch));
    }
  }, [instrumentId]);

  const handleMouseUp = useCallback((pitch) => {
    if (playingNotesRef.current.has(pitch)) {
      AudioContextService.auditionNoteOff(instrumentId, pitch);
      playingNotesRef.current.delete(pitch);
      setPlayingNotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(pitch);
        return newSet;
      });
    }
  }, [instrumentId]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      playingNotesRef.current.forEach(pitch => {
        AudioContextService.auditionNoteOff(instrumentId, pitch);
      });
      playingNotesRef.current.clear();
      setPlayingNotes(new Set());
    };
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [instrumentId]);

  return (
    // --- YENİ: İçerik artık CSS transform ile hareket ettiriliyor ---
    <div
      ref={contentRef}
      className="prv2-keyboard__content"
      style={{
        height: engine.gridHeight,
      }}
    >
      {keys.map((key, i) => (
        <div
          key={key.pitch}
          className={`prv2-keyboard__key ${key.isBlack ? 'prv2-keyboard__key--black' : 'prv2-keyboard__key--white'} ${playingNotes.has(key.pitch) ? 'prv2-keyboard__key--playing' : ''}`}
          style={{ height: engine.keyHeight, top: i * engine.keyHeight, position: 'absolute', width: '100%' }}
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
