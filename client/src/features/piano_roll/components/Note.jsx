import React, { memo, useMemo } from 'react';
import * as Tone from 'tone';

const Note = memo(({ note, isSelected, isPreview, isGhost, ghostColor, viewport, onResizeStart }) => {
    const { x, y, width, height } = useMemo(() => {
        const xPos = note.time * viewport.stepWidth;
        const yPos = viewport.pitchToY(note.pitch);
        let noteWidth;
        try {
            const durationInSteps = Tone.Time(note.duration).toSeconds() / Tone.Time('16n').toSeconds();
            noteWidth = Math.max(4, durationInSteps * viewport.stepWidth - 1);
        } catch {
            noteWidth = viewport.stepWidth - 1;
        }
        return { x: xPos, y: yPos, width: noteWidth, height: viewport.keyHeight - 1 };
    }, [note, viewport]);

    const noteClasses = [
        'note',
        isSelected && !isGhost ? 'note--selected' : '',
        isPreview && !isGhost ? 'note--preview' : '',
        isGhost ? 'note--ghost' : '',
    ].join(' ');

    const style = {
        transform: `translate(${x}px, ${y}px)`,
        width,
        height,
        '--note-velocity-opacity': 0.6 + note.velocity * 0.4,
        '--note-ghost-color': ghostColor || 'transparent',
    };

    return (
        <div className={noteClasses} style={style}>
            <span className="note__label">{!isGhost && width > 40 && note.pitch}</span>
            {/* --- YENİ: Yeniden Boyutlandırma Tutamacı --- */}
            {!isGhost && !isPreview && (
                <div 
                    className="note__resize-handle"
                    onMouseDown={(e) => onResizeStart(note, e)}
                />
            )}
        </div>
    );
});

Note.displayName = "Note";
export default Note;

