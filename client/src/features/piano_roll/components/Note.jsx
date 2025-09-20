import React, { memo, useMemo } from 'react';
import * as Tone from 'tone';

const Note = memo(({ note, isSelected, isPreview, isGhost, ghostColor, viewport, onResizeStart, precomputedRect }) => {
    // Performans için önceden hesaplanmış `rect` kullan, yoksa yeniden hesapla
    const { x, y, width, height } = useMemo(() => 
        precomputedRect || viewport.getNoteRect(note),
    [note, viewport, precomputedRect]);

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
