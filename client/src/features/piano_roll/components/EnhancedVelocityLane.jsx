import React, { useCallback } from 'react';

/**
 * Notaların vurgu seviyelerini (velocity) gösteren ve düzenlemeye olanak tanıyan interaktif alan.
 */
const VelocityBar = React.memo(({ note, isSelected, viewport, height, onVelocityChange }) => {
    const handleMouseDown = useCallback((e) => {
        e.stopPropagation();
        const startY = e.clientY;
        const startVelocity = note.velocity;

        const handleMouseMove = (moveEvent) => {
            const deltaY = startY - moveEvent.clientY;
            // Yüksekliğe göre velocity değişimini hesapla
            const velocityChange = deltaY / height;
            const newVelocity = Math.max(0.01, Math.min(1, startVelocity + velocityChange));
            onVelocityChange(note.id, newVelocity);
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [note.id, note.velocity, height, onVelocityChange]);
    
    const barClasses = `velocity-lane__bar ${isSelected ? 'velocity-lane__bar--selected' : ''}`;
    const barHeight = Math.max(2, note.velocity * (height - 4)); // 4px padding payı

    return (
        <div
            className="velocity-lane__bar-wrapper"
            style={{
                transform: `translateX(${viewport.timeToX(note.time)}px)`,
                width: viewport.stepWidth,
            }}
            onMouseDown={handleMouseDown}
            title={`Velocity: ${Math.round(note.velocity * 127)}`}
        >
            <div className={barClasses} style={{ height: barHeight }} />
        </div>
    );
});

export const EnhancedVelocityLane = ({ notes, selectedNotes, viewport, height, onVelocityChange }) => {
    if (height <= 0) return null;

    return (
        <div className="velocity-lane" style={{ height }}>
            {/* Sol taraftaki "Velocity" etiketi için boşluk */}
            <div className="velocity-lane__label-spacer" />
            
            {/* Notaların velocity barlarının olduğu alan */}
            <div className="velocity-lane__bars-container" style={{ width: viewport.gridWidth }}>
                {notes.map(note => (
                    <VelocityBar
                        key={note.id}
                        note={note}
                        isSelected={selectedNotes.has(note.id)}
                        viewport={viewport}
                        height={height}
                        onVelocityChange={onVelocityChange}
                    />
                ))}
            </div>
        </div>
    );
};
