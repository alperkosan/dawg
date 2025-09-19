import React, { memo, useMemo } from 'react';
import * as Tone from 'tone';

const Note = memo(({ note, isSelected, isPreview, isGhost, ghostColor, viewport }) => {
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

    const style = useMemo(() => {
        let backgroundColor = `rgba(34, 197, 94, ${0.6 + note.velocity * 0.4})`;
        let borderColor = 'rgba(34, 197, 94, 0.9)';
        let zIndex = 10;
        let color = 'white';

        if (isGhost) {
            backgroundColor = ghostColor ? `${ghostColor}40` : 'rgba(107, 114, 128, 0.25)';
            borderColor = ghostColor ? `${ghostColor}80` : 'rgba(107, 114, 128, 0.5)';
            zIndex = 1;
        } else if (isPreview) {
            backgroundColor = 'rgba(0, 188, 212, 0.6)';
            borderColor = 'rgba(255, 255, 255, 0.8)';
            zIndex = 25;
        } else if (isSelected) {
            backgroundColor = 'rgb(245, 158, 11)';
            borderColor = 'rgb(255, 255, 255)';
            zIndex = 15;
            color = 'black';
        }

        return {
            left: x,
            top: y,
            width,
            height,
            backgroundColor,
            borderColor,
            zIndex,
            color,
        };
    }, [x, y, width, height, note.velocity, isSelected, isPreview, isGhost, ghostColor]);

    return (
        <div 
            className="absolute rounded border flex items-center px-2 text-xs font-medium overflow-hidden" 
            style={style}
        >
            {!isGhost && width > 40 && note.pitch}
        </div>
    );
});

export default Note;
