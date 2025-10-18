/**
 * Loop Region Overlay Component
 *
 * Interactive loop region selection for Piano Roll
 * - Click and drag on timeline to select region
 * - Visual feedback with Zenith theme colors
 * - Syncs with Ctrl+D for bar-based copying
 */

import React from 'react';
import './LoopRegionOverlay.css';

const RULER_HEIGHT = 30;
const KEYBOARD_WIDTH = 80;

export function LoopRegionOverlay({
    loopRegion,
    dimensions,
    viewport,
    onLoopRegionChange
}) {
    if (!loopRegion || !dimensions || !viewport) return null;

    const { start, end } = loopRegion;
    const { stepWidth } = dimensions;

    // Calculate pixel positions
    const startX = (start * stepWidth) - viewport.scrollX + KEYBOARD_WIDTH;
    const endX = (end * stepWidth) - viewport.scrollX + KEYBOARD_WIDTH;
    const width = endX - startX;

    // Only render if visible in viewport
    if (endX < KEYBOARD_WIDTH || startX > viewport.width) {
        return null;
    }

    // Clamp to visible area
    const visibleStartX = Math.max(KEYBOARD_WIDTH, startX);
    const visibleEndX = Math.min(viewport.width, endX);
    const visibleWidth = visibleEndX - visibleStartX;

    if (visibleWidth <= 0) return null;

    return (
        <div
            className="loop-region-overlay"
            style={{
                left: `${visibleStartX}px`,
                top: `${RULER_HEIGHT}px`,
                width: `${visibleWidth}px`,
                height: `calc(100% - ${RULER_HEIGHT}px)`,
                pointerEvents: 'none'
            }}
        >
            <div className="loop-region-overlay__fill" />
            <div className="loop-region-overlay__border-left" />
            <div className="loop-region-overlay__border-right" style={{ left: `${visibleWidth}px` }} />
        </div>
    );
}

export default LoopRegionOverlay;
