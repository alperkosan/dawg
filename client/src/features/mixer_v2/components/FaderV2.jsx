import React, { useCallback, useRef } from 'react';

export const FaderV2 = ({ value = 0, min = -60, max = 6, onChange }) => {
    const faderRef = useRef(null);
    const [isDragging, setIsDragging] = React.useState(false);

    const valueToPosition = useCallback((val) => {
        const clampedVal = Math.max(min, Math.min(max, val));
        return ((clampedVal - min) / (max - min)) * 100;
    }, [min, max]);

    const handleInteraction = useCallback((e) => {
        if (!faderRef.current) return;
        const rect = faderRef.current.getBoundingClientRect();
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const posY = 100 - Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
        onChange?.(min + (posY / 100) * (max - min));
    }, [min, max, onChange]);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
        handleInteraction(e);
        
        const handleMouseMove = (moveEvent) => handleInteraction(moveEvent);
        const handleMouseUp = () => {
            setIsDragging(false);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [handleInteraction]);
    
    const faderPosition = valueToPosition(value);
    const dbValue = value > -59 ? value.toFixed(1) : '-∞';

    return (
        <div className="fader-v2-container">
            <div ref={faderRef} className="fader-v2-track" onMouseDown={handleMouseDown}>
                <div 
                  className={`fader-v2-handle ${isDragging ? 'dragging' : ''}`}
                  style={{ bottom: `calc(${faderPosition}% - 14px)` }} 
                />
            </div>
            <div className="fader-v2-value">{dbValue}</div>
        </div>
    );
};