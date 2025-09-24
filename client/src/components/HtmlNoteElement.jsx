// HTML Note Element - Canvas alternatifi
import React, { useState, useRef, useCallback } from 'react';

const HtmlNoteElement = ({
    note,
    isSelected = false,
    onDragStart,
    onDrag,
    onDragEnd,
    onResize,
    onDelete,
    cellWidth = 12,
    cellHeight = 12,
    zoom = 1
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0, noteX: 0, noteY: 0 });
    const noteRef = useRef(null);

    // Convert note properties to pixels
    const pixelsPerBeat = cellWidth * 4;
    const left = note.time * pixelsPerBeat * zoom;
    const top = note.pitch * cellHeight * zoom;
    const width = (note.duration || 0.25) * pixelsPerBeat * zoom;
    const height = cellHeight * zoom - 1;

    // Velocity-based color
    const getVelocityColor = (velocity = 100) => {
        const intensity = velocity / 127;
        return `hsl(120, ${60 + intensity * 40}%, ${40 + intensity * 20}%)`;
    };

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = e.currentTarget.getBoundingClientRect();
        const isResizeArea = e.clientX > rect.right - 8; // 8px resize handle

        if (isResizeArea) {
            setIsResizing(true);
            if (onResize) {
                onResize(note, 'start');
            }
        } else {
            setIsDragging(true);
            setDragStart({
                x: e.clientX,
                y: e.clientY,
                noteX: left,
                noteY: top
            });
            if (onDragStart) {
                onDragStart(note, e);
            }
        }
    }, [note, left, top, onDragStart, onResize]);

    const handleMouseMove = useCallback((e) => {
        if (isDragging && onDrag) {
            const deltaX = e.clientX - dragStart.x;
            const deltaY = e.clientY - dragStart.y;

            onDrag(note, {
                x: dragStart.noteX + deltaX,
                y: dragStart.noteY + deltaY,
                deltaX,
                deltaY
            });
        } else if (isResizing && onResize) {
            const rect = noteRef.current.getBoundingClientRect();
            const newWidth = e.clientX - rect.left;
            onResize(note, 'update', { width: newWidth });
        }
    }, [isDragging, isResizing, dragStart, note, onDrag, onResize]);

    const handleMouseUp = useCallback((e) => {
        if (isDragging) {
            setIsDragging(false);
            if (onDragEnd) {
                onDragEnd(note, e);
            }
        } else if (isResizing) {
            setIsResizing(false);
            if (onResize) {
                onResize(note, 'end');
            }
        }
    }, [isDragging, isResizing, note, onDragEnd, onResize]);

    // Global mouse events for dragging
    React.useEffect(() => {
        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

    const handleDoubleClick = useCallback((e) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(note);
        }
    }, [note, onDelete]);

    return (
        <div
            ref={noteRef}
            className={`html-note ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
            style={{
                position: 'absolute',
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
                backgroundColor: getVelocityColor(note.velocity),
                border: isSelected ? '2px solid #fff' : '1px solid rgba(0,0,0,0.2)',
                borderRadius: '2px',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                zIndex: isSelected ? 100 : 10,
                boxSizing: 'border-box',
                transition: isDragging ? 'none' : 'all 0.1s ease'
            }}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            title={`${note.pitch} - Time: ${note.time.toFixed(2)} - Duration: ${note.duration} - Velocity: ${note.velocity}`}
        >
            {/* Velocity indicator */}
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    bottom: 0,
                    width: '2px',
                    height: `${(note.velocity / 127) * 100}%`,
                    backgroundColor: 'rgba(255,255,255,0.4)',
                    borderRadius: '1px'
                }}
            />

            {/* Resize handle */}
            <div
                style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    width: '8px',
                    height: '100%',
                    cursor: 'ew-resize',
                    backgroundColor: 'transparent'
                }}
            />

            {/* Note name label (only when zoomed in) */}
            {zoom > 2 && (
                <div
                    style={{
                        position: 'absolute',
                        left: '4px',
                        top: '2px',
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.8)',
                        fontFamily: 'monospace',
                        pointerEvents: 'none'
                    }}
                >
                    {note.originalPitch || note.pitch}
                </div>
            )}
        </div>
    );
};

export default React.memo(HtmlNoteElement);