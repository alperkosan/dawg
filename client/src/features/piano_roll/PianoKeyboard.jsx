import React, { useMemo } from 'react';
import { NOTES } from '../../store/usePianoRollStore';

const totalOctaves = 8;
const totalNotes = totalOctaves * 12;

function PianoKeyboard({ keyHeight, scaleNotes }) {
  const keys = useMemo(() => {
    console.log("Piyano tuşları yeniden hesaplanıyor...");
    const keyElements = [];
    for (let i = 0; i < totalNotes; i++) {
      const noteIndexAbs = (totalNotes - 1 - i);
      const noteIndex = noteIndexAbs % 12;
      const octave = Math.floor(noteIndexAbs / 12);
      const noteName = NOTES[noteIndex];
      const isBlackKey = noteName.includes('#');
      const isInScale = scaleNotes?.has(noteIndex);

      const keyClass = `
        w-full text-xs flex items-center transition-colors duration-150 relative
        ${isBlackKey 
          ? 'bg-gray-800 text-gray-400 pl-4 border-t border-b border-gray-900' 
          : 'bg-gray-600 text-gray-200 pl-2 border-t border-b border-gray-700'
        }
        ${isInScale ? '!bg-indigo-600 !text-white font-bold' : ''}
      `;

      keyElements.push(
        <div key={`key-${octave}-${noteName}`} className={keyClass} style={{ height: keyHeight }}>
          {noteName === 'C' ? <span className='absolute left-2 font-mono text-xs'>{`${noteName}${octave}`}</span> : ''}
        </div>
      );
    }
    return keyElements;
  }, [keyHeight, scaleNotes]); 

  return (
    <div className="w-24 bg-gray-900 shrink-0 h-full">
      {keys}
    </div>
  );
}

export default React.memo(PianoKeyboard);