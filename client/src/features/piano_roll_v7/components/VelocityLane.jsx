import React, { useRef, useEffect, useCallback } from 'react';
import './VelocityLane.css';

const VELOCITY_LANE_HEIGHT = 100;
const KEYBOARD_WIDTH = 80;

function VelocityLane({
    notes = [],
    selectedNoteIds = [],
    onNoteVelocityChange,
    onNoteSelect,
    onDeselectAll,
    dimensions,
    viewport,
    activeTool = 'select'
}) {
    const canvasRef = useRef(null);
    const payloadRef = useRef({
        notes,
        selectedNoteIds,
        dimensions,
        viewport,
        activeTool
    });
    const dirtyRef = useRef(true);
    const lastViewportRef = useRef({ scrollX: 0, width: 0 });
    const hoveredNoteIdRef = useRef(null);

    const markDirty = useCallback(() => {
        dirtyRef.current = true;
    }, []);

    useEffect(() => {
        payloadRef.current = {
            notes,
            selectedNoteIds,
            dimensions,
            viewport,
            activeTool
        };
        markDirty();
    }, [notes, selectedNoteIds, dimensions, viewport, activeTool, markDirty]);

    useEffect(() => {
        if (typeof ResizeObserver === 'undefined') return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resizeObserver = new ResizeObserver(() => markDirty());
        resizeObserver.observe(canvas);
        return () => resizeObserver.disconnect();
    }, [markDirty]);

    const renderVelocityLane = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const payload = payloadRef.current;
        if (!ctx || !payload.dimensions || !payload.viewport) return;

        const styles = getComputedStyle(document.documentElement);
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
        }

        const bgPrimary = styles.getPropertyValue('--zenith-bg-primary').trim();
        ctx.fillStyle = bgPrimary || '#1a1d23';
        ctx.fillRect(0, 0, rect.width, rect.height);

        drawVelocityBars(ctx, {
            ...payload,
            canvasHeight: rect.height,
            hoveredNoteId: hoveredNoteIdRef.current
        });
    }, []);

    useEffect(() => {
        let rafId;
        const loop = () => {
            const payload = payloadRef.current;
            const vp = payload.viewport;
            if (vp) {
                const last = lastViewportRef.current;
                if (vp.scrollX !== last.scrollX || vp.width !== last.width) {
                    lastViewportRef.current = { scrollX: vp.scrollX, width: vp.width };
                    dirtyRef.current = true;
                }
            }

            if (dirtyRef.current) {
                dirtyRef.current = false;
                renderVelocityLane();
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [renderVelocityLane]);

    const drawVelocityBars = (ctx, { notes, selectedNoteIds, dimensions, viewport, canvasHeight, activeTool: currentTool, hoveredNoteId = null }) => {
        const styles = getComputedStyle(document.documentElement);
        const { stepWidth } = dimensions;

        // ✅ FL STUDIO STYLE: Sort notes by z-index
        // 1. Unselected notes first (drawn first = bottom layer)
        // 2. Selected notes last (drawn last = top layer)
        // 3. Last selected note (last in selectedNoteIds array) = topmost
        const sortedNotes = [...notes].sort((a, b) => {
            const aSelected = selectedNoteIds.includes(a.id);
            const bSelected = selectedNoteIds.includes(b.id);
            
            // Unselected notes go first
            if (!aSelected && bSelected) return -1;
            if (aSelected && !bSelected) return 1;
            
            // Both selected or both unselected - check selection order
            if (aSelected && bSelected) {
                const aIndex = selectedNoteIds.indexOf(a.id);
                const bIndex = selectedNoteIds.indexOf(b.id);
                // Last selected (higher index) should be drawn last (topmost)
                return aIndex - bIndex;
            }
            
            // Both unselected - maintain original order
            return 0;
        });

        // Translate for scroll
        ctx.save();
        ctx.translate(-viewport.scrollX, 0);

        // Track overlapping notes for visual distinction
        const noteOverlaps = new Map(); // noteId -> array of overlapping noteIds

        sortedNotes.forEach(note => {
            const isSelected = selectedNoteIds.includes(note.id);
            const isHovered = hoveredNoteId === note.id;
            const selectionIndex = isSelected ? selectedNoteIds.indexOf(note.id) : -1;
            const isTopmostSelected = isSelected && selectionIndex === selectedNoteIds.length - 1;
            
            // ✅ FIX: Velocity is in MIDI format (0-127), default is 100
            const velocity = note.velocity || 100;
            const normalizedVelocity = velocity / 127; // Normalize to 0-1 for rendering

            // ✅ FL STUDIO STYLE: Use visualLength for display, length for audio
            // Oval notes (visualLength < length) should show as 1 step in velocity lane
            const displayLength = note.visualLength !== undefined ? note.visualLength : note.length;

            const noteX = note.startTime * stepWidth;
            const noteWidth = Math.max(1, displayLength * stepWidth);
            const barHeight = normalizedVelocity * canvasHeight * 0.8; // 80% of canvas height max
            const barY = canvasHeight - barHeight;

            // Only draw if in viewport
            if (noteX + noteWidth < viewport.scrollX || noteX > viewport.scrollX + viewport.width - KEYBOARD_WIDTH) {
                return;
            }

            // Find overlapping notes
            const overlappingNotes = sortedNotes.filter(otherNote => {
                if (otherNote.id === note.id) return false;
                const otherDisplayLength = otherNote.visualLength !== undefined ? otherNote.visualLength : otherNote.length;
                const otherX = otherNote.startTime * stepWidth;
                const otherWidth = Math.max(1, otherDisplayLength * stepWidth);
                // Check if notes overlap in time
                return !(noteX + noteWidth <= otherX || otherX + otherWidth <= noteX);
            });

            if (overlappingNotes.length > 0) {
                noteOverlaps.set(note.id, overlappingNotes.map(n => n.id));
            }

            // ✅ FL STUDIO STYLE: Visual offset for overlapping notes
            // Topmost selected note gets no offset, others get slight offset to show stacking
            const hasOverlap = overlappingNotes.length > 0;
            const offsetX = hasOverlap && !isTopmostSelected ? 1 : 0;
            const offsetY = hasOverlap && !isTopmostSelected ? -1 : 0;

            // Bar color based on selection and velocity (MIDI thresholds)
            let barColor;
            if (isSelected) {
                barColor = styles.getPropertyValue('--zenith-accent-cool').trim() || '#3b82f6';
            } else if (velocity > 102) { // ~80% of 127
                barColor = styles.getPropertyValue('--zenith-accent-warm').trim() || '#ef4444';
            } else if (velocity > 64) { // ~50% of 127
                barColor = styles.getPropertyValue('--zenith-accent-warm').trim() || '#f59e0b';
            } else {
                barColor = styles.getPropertyValue('--zenith-accent-cool').trim() || '#10b981';
            }

            // ✅ FL STUDIO STYLE: Draw shadow/outline for overlapping notes
            if (hasOverlap) {
                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
                ctx.shadowBlur = isTopmostSelected ? 4 : 2;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = isTopmostSelected ? -2 : -1;
            }

            // Draw velocity bar with offset
            ctx.fillStyle = barColor;
            ctx.globalAlpha = isSelected ? 1.0 : (hasOverlap ? 0.6 : 0.7);
            ctx.fillRect(noteX + offsetX, barY + offsetY, noteWidth, barHeight);

            // ✅ FL STUDIO STYLE: Draw outline for topmost selected note
            if (isTopmostSelected) {
                ctx.strokeStyle = styles.getPropertyValue('--zenith-accent-cool').trim() || '#60a5fa';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 1.0;
                ctx.strokeRect(noteX + offsetX, barY + offsetY, noteWidth, barHeight);
            } else if (isSelected && hasOverlap) {
                // Selected but not topmost - lighter outline
                ctx.strokeStyle = styles.getPropertyValue('--zenith-accent-cool').trim() || '#3b82f6';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.8;
                ctx.strokeRect(noteX + offsetX, barY + offsetY, noteWidth, barHeight);
            }

            if (hasOverlap) {
                ctx.restore();
            }

            // Draw velocity value text
            if (noteWidth > 20) { // Only if bar is wide enough
                const textPrimary = styles.getPropertyValue('--zenith-text-primary').trim();
                ctx.fillStyle = textPrimary || '#ffffff';
                ctx.globalAlpha = isTopmostSelected ? 1.0 : (hasOverlap ? 0.7 : 0.9);
                ctx.font = isTopmostSelected ? '11px monospace' : '10px monospace';
                ctx.textAlign = 'center';
                // ✅ FIX: Velocity is already in MIDI format, just display it
                ctx.fillText(velocity.toString(), noteX + noteWidth/2 + offsetX, barY - 2 + offsetY);
            }

            // Draw resize handles for selected notes
            if (isSelected && currentTool === 'select') {
                const textPrimary = styles.getPropertyValue('--zenith-text-primary').trim();
                ctx.fillStyle = textPrimary || '#ffffff';
                ctx.globalAlpha = 1.0;
                const handleSize = isTopmostSelected ? 5 : 4;

                // Top handle for velocity adjustment
                const handleX = noteX + noteWidth/2 - handleSize/2 + offsetX;
                const handleY = barY - handleSize/2 + offsetY;
                ctx.fillRect(handleX, handleY, handleSize, handleSize);
                
                // ✅ FL STUDIO STYLE: Highlight handle for topmost selected note
                if (isTopmostSelected) {
                    ctx.strokeStyle = styles.getPropertyValue('--zenith-accent-cool').trim() || '#60a5fa';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(handleX, handleY, handleSize, handleSize);
                }
            }

            // ✅ FL STUDIO STYLE: Hover highlight
            if (isHovered && !isSelected) {
                ctx.strokeStyle = styles.getPropertyValue('--zenith-text-secondary').trim() || '#9ca3af';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.8;
                ctx.setLineDash([2, 2]);
                ctx.strokeRect(noteX + offsetX, barY + offsetY, noteWidth, barHeight);
                ctx.setLineDash([]);
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
        // ✅ FIX: Select note at clicked Y position (velocity height)
        const { stepWidth } = dimensions;
        const clickTime = clickX / stepWidth;
        const canvasHeight = canvas.height / (window.devicePixelRatio || 1);

        // Find all notes at click X position
        // ✅ FL STUDIO STYLE: Use visualLength for click detection in velocity lane
        const notesAtPosition = notes.filter(note => {
            const displayLength = note.visualLength !== undefined ? note.visualLength : note.length;
            return clickTime >= note.startTime && clickTime <= (note.startTime + displayLength);
        });

        if (notesAtPosition.length === 0) return;

        // ✅ FL STUDIO STYLE: Find note at click position with z-index priority
        // Priority: 1. Topmost selected note, 2. Other selected notes, 3. Unselected notes
        // Sort notes by selection priority (same as drawing order)
        const sortedNotesAtPosition = [...notesAtPosition].sort((a, b) => {
            const aSelected = selectedNoteIds.includes(a.id);
            const bSelected = selectedNoteIds.includes(b.id);
            
            if (!aSelected && bSelected) return 1; // Selected notes first
            if (aSelected && !bSelected) return -1;
            
            if (aSelected && bSelected) {
                const aIndex = selectedNoteIds.indexOf(a.id);
                const bIndex = selectedNoteIds.indexOf(b.id);
                // Last selected (higher index) = topmost = highest priority
                return bIndex - aIndex;
            }
            
            return 0;
        });

        // Find note whose velocity bar contains the click Y position
        // Check from topmost to bottommost
        let clickedNote = null;
        for (const note of sortedNotesAtPosition) {
            // ✅ FIX: Velocity is in MIDI format (0-127)
            const velocity = note.velocity || 100;
            const normalizedVelocity = velocity / 127;
            const barHeight = normalizedVelocity * canvasHeight * 0.8;
            const barY = canvasHeight - barHeight;

            // Check if click is within this note's velocity bar
            if (clickY >= barY && clickY <= canvasHeight) {
                // ✅ FL STUDIO STYLE: Topmost note at this position gets priority
                clickedNote = note;
                break; // Take the first (topmost) matching note
            }
        }

        // If no note bar was clicked (clicked below all bars), select topmost note
        if (!clickedNote && sortedNotesAtPosition.length > 0) {
            clickedNote = sortedNotesAtPosition[0]; // Topmost note
        }

        if (clickedNote) {
            // ✅ SELECT NOTE - If not already selected, select it
            const isAlreadySelected = selectedNoteIds.includes(clickedNote.id);

            if (!isAlreadySelected) {
                // Select note (with Ctrl/Cmd for multi-select)
                onNoteSelect?.(clickedNote.id, e.ctrlKey || e.metaKey);
            } else if (!e.ctrlKey && !e.metaKey && selectedNoteIds.length > 1) {
                // If clicking on already selected note without modifier and multiple selected,
                // select only this one
                onDeselectAll?.();
                onNoteSelect?.(clickedNote.id, false);
            }

            // ✅ FL STUDIO STYLE: START VELOCITY DRAG - For all selected notes
            // If multiple notes are selected, adjust all of them together
            const notesToAdjust = selectedNoteIds.length > 1 && selectedNoteIds.includes(clickedNote.id)
                ? selectedNoteIds.map(id => notes.find(n => n.id === id)).filter(Boolean)
                : [clickedNote];
            
            const startVelocities = notesToAdjust.map(note => ({
                id: note.id,
                velocity: note.velocity || 100
            }));
            const startY = clickY;
            let hasMoved = false;

            const handleMouseMove = (moveEvent) => {
                hasMoved = true;
                const currentY = moveEvent.clientY - rect.top;
                const deltaY = startY - currentY; // Inverted: up = increase velocity
                // ✅ FIX: Calculate velocity change in MIDI range (0-127)
                const velocityChange = (deltaY / rect.height) * 127; // Scale to MIDI range
                
                // ✅ FL STUDIO STYLE: Adjust all selected notes proportionally
                notesToAdjust.forEach((note, index) => {
                    const startVel = startVelocities[index].velocity;
                    const newVelocity = Math.max(1, Math.min(127, Math.round(startVel + velocityChange)));
                    onNoteVelocityChange?.(note.id, newVelocity);
                });
            };

            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        } else {
            // ✅ DESELECT ALL - Clicking on empty area
            if (!e.ctrlKey && !e.metaKey) {
                onDeselectAll?.();
            }
        }
    }, [activeTool, notes, selectedNoteIds, dimensions, viewport, onNoteVelocityChange, onNoteSelect, onDeselectAll]);

    // ✅ FL STUDIO STYLE: Handle mouse hover to highlight topmost note
    const handleMouseMove = useCallback((e) => {
        if (activeTool !== 'select') return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left + viewport.scrollX;
        const mouseY = e.clientY - rect.top;
        const { stepWidth } = dimensions;
        const clickTime = mouseX / stepWidth;
        const canvasHeight = canvas.height / (window.devicePixelRatio || 1);

        // Find all notes at mouse X position
        const notesAtPosition = notes.filter(note => {
            const displayLength = note.visualLength !== undefined ? note.visualLength : note.length;
            return clickTime >= note.startTime && clickTime <= (note.startTime + displayLength);
        });

        if (notesAtPosition.length === 0) {
            hoveredNoteIdRef.current = null;
            markDirty();
            return;
        }

        // Sort by selection priority (same as click detection)
        const sortedNotesAtPosition = [...notesAtPosition].sort((a, b) => {
            const aSelected = selectedNoteIds.includes(a.id);
            const bSelected = selectedNoteIds.includes(b.id);
            
            if (!aSelected && bSelected) return 1;
            if (aSelected && !bSelected) return -1;
            
            if (aSelected && bSelected) {
                const aIndex = selectedNoteIds.indexOf(a.id);
                const bIndex = selectedNoteIds.indexOf(b.id);
                return bIndex - aIndex;
            }
            
            return 0;
        });

        // Find topmost note at mouse Y position
        let hoveredNote = null;
        for (const note of sortedNotesAtPosition) {
            const velocity = note.velocity || 100;
            const normalizedVelocity = velocity / 127;
            const barHeight = normalizedVelocity * canvasHeight * 0.8;
            const barY = canvasHeight - barHeight;

            if (mouseY >= barY && mouseY <= canvasHeight) {
                hoveredNote = note;
                break;
            }
        }

        // If mouse is below all bars, hover the topmost note
        if (!hoveredNote && sortedNotesAtPosition.length > 0) {
            hoveredNote = sortedNotesAtPosition[0];
        }

        if (hoveredNoteIdRef.current !== hoveredNote?.id) {
            hoveredNoteIdRef.current = hoveredNote?.id || null;
            markDirty();
        }
    }, [activeTool, notes, selectedNoteIds, dimensions, viewport, markDirty]);

    const handleMouseLeave = useCallback(() => {
        hoveredNoteIdRef.current = null;
        markDirty();
    }, [markDirty]);

    return (
        <div className="velocity-lane">
            <div className="velocity-lane-label">
                <span>Velocity</span>
            </div>
            <canvas
                ref={canvasRef}
                className="velocity-lane-canvas"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
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
        prevProps.onNoteSelect === nextProps.onNoteSelect &&
        prevProps.onDeselectAll === nextProps.onDeselectAll &&
        prevProps.dimensions === nextProps.dimensions &&
        prevProps.viewport === nextProps.viewport
    );
});