/**
 * Loop Region Selection Hook
 *
 * Handles interactive loop region selection on timeline ruler
 * - Click and drag to select region
 * - Snap to bars for musical alignment
 * - Alt+Click for quick bar selection
 */

import { useState, useCallback, useRef } from 'react';

const RULER_HEIGHT = 30;
const KEYBOARD_WIDTH = 80;

export function useLoopRegionSelection(engine, snapValue, loopRegion, setLoopRegion, onSetPlayhead) {
    const [isDraggingRegion, setIsDraggingRegion] = useState(false);
    const dragStartRef = useRef(null);
    const hasMovedRef = useRef(false); // Track if mouse moved during drag

    // Snap to bar (16 steps = 1 bar) - Only used for Alt+Click
    const snapToBar = useCallback((step) => {
        return Math.round(step / 16) * 16;
    }, []);

    // Snap to grid using snapValue
    const snapToGrid = useCallback((step) => {
        if (snapValue <= 0) return step;
        return Math.round(step / snapValue) * snapValue;
    }, [snapValue]);

    // Handle ruler mouse down - start loop region selection
    const handleRulerMouseDown = useCallback((e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Only handle if in ruler area
        if (mouseY > RULER_HEIGHT || mouseX < KEYBOARD_WIDTH) {
            return false;
        }

        // ✅ FIX: Calculate step position matching renderer algorithm
        // Renderer uses: ctx.translate(-scrollX), then draws at x = step * stepWidth
        // scrollX is in screen coordinates, but after translate(-scrollX), screen and world are 1:1
        // After translate(-scrollX), screen x=0 corresponds to world x=scrollX
        // Screen mouse position → World position: worldX = scrollX + canvasX (after translate, 1:1 mapping)
        // World position → Step: step = worldX / stepWidth
        const { stepWidth } = engine.dimensions;
        const { scrollX } = engine.viewport;
        const canvasX = mouseX - KEYBOARD_WIDTH;
        // scrollX is in screen coordinates, but after translate(-scrollX), it maps to world coordinates
        // After translate, screen coordinate canvasX maps to world coordinate scrollX + canvasX
        const worldX = scrollX + canvasX; // After translate, screen and world are 1:1
        const clickedStep = Math.floor(worldX / stepWidth);

        // Alt+Click: Select single bar
        if (e.altKey) {
            const barStart = snapToBar(clickedStep);
            const barEnd = barStart + 16;
            setLoopRegion({ start: barStart, end: barEnd });
            return true;
        }

        // ✅ FIX: Don't create loop region on single click
        // Only start tracking drag, create region only if mouse moves
        dragStartRef.current = clickedStep;
        setIsDraggingRegion(true);
        hasMovedRef.current = false; // Reset movement flag

        // ✅ Set playhead position on single click
        if (onSetPlayhead) {
            onSetPlayhead(clickedStep);
        }

        return true;
    }, [engine, setLoopRegion, snapToBar, onSetPlayhead]);

    // Handle ruler mouse move - update loop region
    const handleRulerMouseMove = useCallback((e) => {
        if (!isDraggingRegion || !dragStartRef.current) {
            return false;
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;

        // ✅ FIX: Calculate step position matching renderer algorithm
        // Renderer uses: ctx.translate(-scrollX), then draws at x = step * stepWidth
        // So scrollX is in world coordinates (already includes zoomX)
        // Screen mouse position → World position: worldX = scrollX + canvasX
        // World position → Step: step = worldX / stepWidth
        const { stepWidth } = engine.dimensions;
        const { scrollX } = engine.viewport;
        const canvasX = mouseX - KEYBOARD_WIDTH;
        const worldX = scrollX + canvasX;
        const currentStep = Math.floor(worldX / stepWidth);

        // ✅ FIX: Only create loop region if mouse actually moved
        // Check if mouse moved at least 8 pixels (to avoid accidental region creation on click)
        const startPixelX = dragStartRef.current * stepWidth + KEYBOARD_WIDTH - scrollX;
        const pixelDelta = Math.abs(mouseX - startPixelX);
        if (pixelDelta < 8) {
            return true; // Mouse hasn't moved enough, don't create region yet
        }

        hasMovedRef.current = true; // Mark that mouse has moved

        // Calculate region (start < end always)
        const start = Math.min(dragStartRef.current, currentStep);
        const end = Math.max(dragStartRef.current, currentStep);

        // ✅ IMPROVED: Snap to grid using snapValue (Shift to disable snapping)
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            // Auto-snap to grid
            const snappedStart = snapToGrid(start);
            const snappedEnd = snapToGrid(end);
            setLoopRegion({ start: snappedStart, end: snappedEnd + snapValue });
        } else {
            // Fine control: no snapping (exact step positions)
            setLoopRegion({ start, end: end + 1 });
        }

        return true;
    }, [isDraggingRegion, engine, setLoopRegion, snapToGrid, snapValue]);

    // Handle ruler mouse up - finalize loop region
    const handleRulerMouseUp = useCallback(() => {
        if (isDraggingRegion) {
            // ✅ FIX: If mouse didn't move, it was just a click (playhead was already set)
            // Don't create a single-step loop region
            if (!hasMovedRef.current) {
                // Just a click, no loop region created
                setIsDraggingRegion(false);
                dragStartRef.current = null;
                hasMovedRef.current = false;
                return true;
            }

            // Mouse moved, loop region was created during drag
            setIsDraggingRegion(false);
            dragStartRef.current = null;
            hasMovedRef.current = false;
            return true;
        }
        return false;
    }, [isDraggingRegion]);

    // Clear loop region (Escape key)
    const clearLoopRegion = useCallback(() => {
        setLoopRegion(null);
    }, [setLoopRegion]);

    return {
        handleRulerMouseDown,
        handleRulerMouseMove,
        handleRulerMouseUp,
        clearLoopRegion,
        isDraggingRegion
    };
}
