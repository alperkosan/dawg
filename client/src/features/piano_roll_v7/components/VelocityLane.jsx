import React, { useRef, useEffect, useCallback } from 'react';
import './VelocityLane.css';

const VELOCITY_LANE_HEIGHT = 100;
const KEYBOARD_WIDTH = 80;

function VelocityLane({
    notes = [],
    selectedNoteIds = [],
    onNoteVelocityChange,
    dimensions,
    viewport,
    activeTool = 'select'
}) {
    const canvasRef = useRef(null);

    // Draw velocity lane
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !dimensions || !viewport) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
        }

        // Clear canvas
        ctx.fillStyle = '#1a1d23';
        ctx.fillRect(0, 0, rect.width, rect.height);

        // Draw velocity bars
        drawVelocityBars(ctx, {
            notes,
            selectedNoteIds,
            dimensions,
            viewport,
            canvasHeight: rect.height
        });

    }, [notes, selectedNoteIds, dimensions, viewport]);

    const drawVelocityBars = (ctx, { notes, selectedNoteIds, dimensions, viewport, canvasHeight }) => {
        const { stepWidth } = dimensions;

        // Translate for scroll
        ctx.save();
        ctx.translate(-viewport.scrollX, 0);

        notes.forEach(note => {
            const isSelected = selectedNoteIds.includes(note.id);
            const velocity = note.velocity || 0.7; // Default velocity 70%

            const noteX = note.startTime * stepWidth;
            const noteWidth = Math.max(1, note.length * stepWidth);
            const barHeight = velocity * canvasHeight * 0.8; // 80% of canvas height max
            const barY = canvasHeight - barHeight;

            // Only draw if in viewport
            if (noteX + noteWidth < viewport.scrollX || noteX > viewport.scrollX + viewport.width - KEYBOARD_WIDTH) {
                return;
            }

            // Bar color based on selection and velocity
            let barColor;
            if (isSelected) {
                barColor = '#3b82f6'; // Blue for selected
            } else if (velocity > 0.8) {
                barColor = '#ef4444'; // Red for high velocity
            } else if (velocity > 0.5) {
                barColor = '#f59e0b'; // Orange for medium velocity
            } else {
                barColor = '#10b981'; // Green for low velocity
            }

            // Draw velocity bar
            ctx.fillStyle = barColor;
            ctx.globalAlpha = isSelected ? 1.0 : 0.7;
            ctx.fillRect(noteX, barY, noteWidth, barHeight);

            // Draw velocity value text
            if (noteWidth > 20) { // Only if bar is wide enough
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 0.9;
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                const velocityText = Math.round(velocity * 127).toString();
                ctx.fillText(velocityText, noteX + noteWidth/2, barY - 2);
            }

            // Draw resize handles for selected notes
            if (isSelected && activeTool === 'select') {
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 1.0;
                const handleSize = 4;

                // Top handle for velocity adjustment
                const handleX = noteX + noteWidth/2 - handleSize/2;
                const handleY = barY - handleSize/2;
                ctx.fillRect(handleX, handleY, handleSize, handleSize);
            }
        });

        ctx.restore();
    };

    // Handle mouse interactions
    const handleMouseDown = useCallback((e) => {
        if (activeTool !== 'select') return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left + viewport.scrollX;
        const clickY = e.clientY - rect.top;

        // Find note at click position
        const { stepWidth } = dimensions;
        const clickTime = clickX / stepWidth;

        const clickedNote = notes.find(note => {
            const noteStartX = note.startTime * stepWidth;
            const noteEndX = noteStartX + (note.length * stepWidth);
            return clickTime >= note.startTime && clickTime <= (note.startTime + note.length);
        });

        if (clickedNote && selectedNoteIds.includes(clickedNote.id)) {
            // Start velocity drag
            const startVelocity = clickedNote.velocity || 0.7;
            const startY = clickY;

            const handleMouseMove = (moveEvent) => {
                const currentY = moveEvent.clientY - rect.top;
                const deltaY = startY - currentY; // Inverted: up = increase velocity
                const velocityChange = deltaY / rect.height; // Normalize to 0-1 range
                const newVelocity = Math.max(0.01, Math.min(1.0, startVelocity + velocityChange));

                onNoteVelocityChange?.(clickedNote.id, newVelocity);
            };

            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
    }, [activeTool, notes, selectedNoteIds, dimensions, viewport, onNoteVelocityChange]);

    return (
        <div className="velocity-lane">
            <div className="velocity-lane-label">
                <span>Velocity</span>
            </div>
            <canvas
                ref={canvasRef}
                className="velocity-lane-canvas"
                onMouseDown={handleMouseDown}
                style={{
                    width: '100%',
                    height: VELOCITY_LANE_HEIGHT,
                    cursor: activeTool === 'select' ? 'pointer' : 'default'
                }}
            />
        </div>
    );
}

// Memoize component to prevent unnecessary re-renders during playback
export default React.memo(VelocityLane, (prevProps, nextProps) => {
    // Custom comparison for performance
    return (
        prevProps.notes === nextProps.notes &&
        prevProps.selectedNoteIds === nextProps.selectedNoteIds &&
        prevProps.activeTool === nextProps.activeTool &&
        prevProps.onNoteVelocityChange === nextProps.onNoteVelocityChange &&
        prevProps.dimensions === nextProps.dimensions &&
        prevProps.viewport === nextProps.viewport
    );
});