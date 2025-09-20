// src/features/piano_roll/components/PianoKeyboard.jsx
import React, { memo, useMemo, useState, useCallback } from 'react';
import { NOTES } from '../utils/constants';

const PianoKeyboard = memo(({ viewport, scale, onNotePreview }) => {
    const [playingNotes, setPlayingNotes] = useState(new Set());

    const keys = useMemo(() => {
        const keyData = [];
        const scaleNoteSet = scale?.getScaleNotes ? scale.getScaleNotes() : new Set();
        for (let i = 0; i < viewport.totalKeys; i++) {
            const keyIndex = viewport.totalKeys - 1 - i;
            const noteIndex = keyIndex % 12;
            const octave = Math.floor(keyIndex / 12);
            const noteName = NOTES[noteIndex];
            keyData.push({ pitch: `${noteName}${octave}`, noteName, isBlackKey: noteName.includes('#'), isInScale: scaleNoteSet.has(noteIndex), isRoot: scale && noteName === scale.root, isC: noteName === 'C' });
        }
        return keyData;
    }, [viewport.totalKeys, scale]);

    const handleMouseDown = useCallback((pitch) => {
        setPlayingNotes(prev => new Set(prev).add(pitch));
        onNotePreview?.(pitch, 0.8);
    }, [onNotePreview]);

    const handleMouseUp = useCallback((pitch) => {
        setPlayingNotes(prev => { const newSet = new Set(prev); newSet.delete(pitch); return newSet; });
        onNotePreview?.(pitch, 0);
    }, [onNotePreview]);

    return (
        <div className="piano-keyboard" style={{ height: viewport.gridHeight }}>
            {keys.map((key, index) => {
                if (key.isBlackKey) return null;

                const nextKey = keys[index - 1];
                const hasBlackKey = nextKey && nextKey.isBlackKey;

                const whiteKeyClasses = `piano-keyboard__key piano-keyboard__key--white ${key.isInScale ? 'piano-keyboard__key--in-scale' : ''} ${key.isRoot ? 'piano-keyboard__key--root' : ''} ${playingNotes.has(key.pitch) ? 'piano-keyboard__key--playing' : ''}`;
                const blackKeyClasses = hasBlackKey ? `piano-keyboard__key piano-keyboard__key--black ${nextKey.isInScale ? 'piano-keyboard__key--in-scale' : ''} ${nextKey.isRoot ? 'piano-keyboard__key--root' : ''} ${playingNotes.has(nextKey.pitch) ? 'piano-keyboard__key--playing' : ''}` : '';

                return (
                    <div key={key.pitch} className={whiteKeyClasses} style={{ height: viewport.keyHeight }} onMouseDown={() => handleMouseDown(key.pitch)} onMouseUp={() => handleMouseUp(key.pitch)} onMouseLeave={() => playingNotes.has(key.pitch) && handleMouseUp(key.pitch)}>
                        {(key.isC || key.isRoot) && <span className="piano-keyboard__label">{key.pitch}</span>}
                        {hasBlackKey && (
                            <div key={nextKey.pitch} className={blackKeyClasses} onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(nextKey.pitch); }} onMouseUp={(e) => { e.stopPropagation(); handleMouseUp(nextKey.pitch); }} onMouseLeave={(e) => { e.stopPropagation(); playingNotes.has(nextKey.pitch) && handleMouseUp(nextKey.pitch); }}>
                                <span className="piano-keyboard__label piano-keyboard__label--black">{nextKey.noteName}</span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
});

PianoKeyboard.displayName = 'PianoKeyboard';
export default PianoKeyboard;