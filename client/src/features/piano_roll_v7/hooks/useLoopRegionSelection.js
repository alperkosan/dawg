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

        // Calculate step position
        const { stepWidth } = engine.dimensions;
        const canvasX = mouseX - KEYBOARD_WIDTH;
        const worldX = engine.viewport.scrollX + canvasX;
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

        // Calculate step position
        const { stepWidth } = engine.dimensions;
        const canvasX = mouseX - KEYBOARD_WIDTH;
        const worldX = engine.viewport.scrollX + canvasX;
        const currentStep = Math.floor(worldX / stepWidth);

        // Calculate region (start < end always)
        const start = Math.min(dragStartRef.current, currentStep);
        const end = Math.max(dragStartRef.current, currentStep);

        // Snap to bars (Shift to disable snapping)
        if (!e.shiftKey) {
            const snappedStart = snapToBar(start);
            const snappedEnd = snapToBar(end) + 16; // End at next bar boundary
            setLoopRegion({ start: snappedStart, end: snappedEnd });
        } else {
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
