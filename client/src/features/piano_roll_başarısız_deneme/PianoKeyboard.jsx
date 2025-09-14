import React, { useMemo } from 'react';
import { NOTES } from '../../store/usePianoRollStore';

const totalOctaves = 8;
const totalNotes = totalOctaves * 12;

function PianoKeyboard({ keyHeight, scaleNotes, onKeyInteraction }) {
  const keys = useMemo(() => {
    return Array.from({ length: totalNotes }, (_, i) => {
      const noteIndexAbs = totalNotes - 1 - i;
      const noteIndex = noteIndexAbs % 12;
      const octave = Math.floor(noteIndexAbs / 12);
      const noteName = NOTES[noteIndex];
      const pitch = `${noteName}${octave}`;
      const isBlackKey = noteName.includes('#');
      const isInScale = scaleNotes?.has(noteIndex);

      const keyClass = `w-full text-xs flex items-center transition-colors duration-100 relative cursor-pointer
        ${isBlackKey ? 'bg-gray-800 text-gray-400 pl-4 border-t border-b border-gray-900' : 'bg-gray-600 text-gray-200 pl-2 border-t border-b border-gray-700'}
        ${isInScale ? 'bg-indigo-800/70 !text-white font-bold' : ''}
        ${isBlackKey ? 'hover:bg-gray-700' : 'hover:bg-gray-500'}`;

      return (
        <div
          key={pitch}
          className={keyClass}
          style={{ height: keyHeight }}
          onMouseDown={() => onKeyInteraction(pitch, 'on')}
          onMouseUp={() => onKeyInteraction(pitch, 'off')}
          onMouseEnter={(e) => { if (e.buttons === 1) onKeyInteraction(pitch, 'on'); }}
          onMouseLeave={() => onKeyInteraction(pitch, 'off')}
        >
          {noteName === 'C' && <span className='absolute left-2 font-mono text-xs pointer-events-none'>{pitch}</span>}
        </div>
      );
    });
  }, [keyHeight, scaleNotes, onKeyInteraction]);

  return <div className="w-24 bg-gray-900 shrink-0 h-full">{keys}</div>;
}

export default React.memo(PianoKeyboard);
