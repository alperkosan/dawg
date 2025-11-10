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

export function useLoopRegionSelection(engine, snapValue, loopRegion, setLoopRegion) {
    const [isDraggingRegion, setIsDraggingRegion] = useState(false);
    const dragStartRef = useRef(null);

    // Snap to bar (16 steps = 1 bar)
    const snapToBar = useCallback((step) => {
        return Math.round(step / 16) * 16;
    }, []);

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

        // Start dragging for region selection
        dragStartRef.current = clickedStep;
        setIsDraggingRegion(true);

        // Set initial region (single point)
        setLoopRegion({ start: clickedStep, end: clickedStep });

        return true;
    }, [engine, setLoopRegion, snapToBar]);

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

        // Calculate region (start < end always)
        const start = Math.min(dragStartRef.current, currentStep);
        const end = Math.max(dragStartRef.current, currentStep);

        // ✅ IMPROVED: Snap to bars (Shift to disable snapping, Ctrl for fine control)
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            // Auto-snap to bars
            const snappedStart = snapToBar(start);
            const snappedEnd = snapToBar(end);
            // If end is at bar boundary, include that bar
            const finalEnd = (end % 16 === 0) ? snappedEnd : snapToBar(end) + 16;
            setLoopRegion({ start: snappedStart, end: finalEnd });
        } else {
            // Fine control: no snapping
            setLoopRegion({ start, end: end + 1 });
        }

        return true;
    }, [isDraggingRegion, engine, setLoopRegion, snapToBar]);

    // Handle ruler mouse up - finalize loop region
    const handleRulerMouseUp = useCallback(() => {
        if (isDraggingRegion) {
            setIsDraggingRegion(false);
            dragStartRef.current = null;
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
