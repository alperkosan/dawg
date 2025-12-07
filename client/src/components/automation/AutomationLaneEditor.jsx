/**
 * 🎚️ AUTOMATION LANE EDITOR - Ortak Automation Component
 *
 * Tüm componentlerde (Piano Roll, Arrangement) kullanılabilir ortak automation editor
 * - Canvas-based rendering
 * - Point editing (add, move, delete)
 * - Curve visualization
 * - Grid snapping
 * - Viewport synchronization
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { AutomationLane } from '@/features/piano_roll_v7/types/AutomationLane';
import { STEPS_PER_BEAT } from '@/lib/audio/audioRenderConfig';
import './AutomationLaneEditor.css';

const POINT_SIZE = 6;
const POINT_HOVER_SIZE = 12; // ✅ UX: Increased hit radius for easier point selection
const POINT_SELECTED_SIZE = 8;
const CURVE_LINE_WIDTH = 2;
const DRAG_THRESHOLD = 5; // ✅ UX: Minimum pixel movement before starting drag (prevents accidental drags)
const DRAW_THRESHOLD = 3; // ✅ UX: Minimum pixel movement before adding new point (prevents accidental points)
const BRUSH_MIN_DISTANCE = 8; // ✅ UX: Minimum distance between brush points (prevents excessive points)

/**
 * Draw automation lane on canvas
 */
function drawAutomationLane(ctx, {
    lane,
    dimensions,
    viewport,
    canvasWidth,
    canvasHeight,
    hoveredPoint,
    selectedPoints,
    draggingPoint,
    keyboardWidth = 0, // Piano Roll için keyboard offset
    showGrid = true,
    timeUnit = 'steps' // ✅ NEW: 'steps' (Piano Roll) or 'beats' (Arrangement)
}) {
    if (!lane || !lane.visible) return;

    const { min, max } = AutomationLane.getValueRange(lane.ccNumber);
    const valueRange = max - min;
    const centerY = canvasHeight / 2;

    // Clear and setup
    ctx.save();

    // Translate to account for keyboard width (Piano Roll) or 0 (Arrangement)
    ctx.translate(keyboardWidth - viewport.scrollX, 0);

    // Draw grid (if enabled)
    if (showGrid) {
        ctx.strokeStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--zenith-border-subtle') || 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        // ✅ FIX: Calculate grid width based on time unit
        const stepWidth = dimensions?.stepWidth || viewport.zoomX || 1;
        const gridUnitWidth = timeUnit === 'beats'
            ? stepWidth // Arrangement: 1 beat = stepWidth pixels
            : stepWidth * STEPS_PER_BEAT; // Piano Roll: 1 beat = stepWidth * 4 pixels

        const startUnit = Math.floor(viewport.scrollX / gridUnitWidth);
        const endUnit = Math.ceil((viewport.scrollX + canvasWidth) / gridUnitWidth);

        for (let unit = startUnit; unit <= endUnit; unit++) {
            const x = unit * gridUnitWidth;
            if (x >= -viewport.scrollX && x <= canvasWidth - viewport.scrollX) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvasHeight);
                ctx.stroke();
            }
        }

        // Center line (zero line)
        ctx.strokeStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--zenith-border-medium') || 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-viewport.scrollX, centerY);
        ctx.lineTo(canvasWidth - viewport.scrollX, centerY);
        ctx.stroke();
    }

    // Get points
    const points = lane.getPoints();
    if (!points || points.length === 0) {
        ctx.restore();
        return;
    }

    // Draw automation curve
    ctx.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--zenith-accent-cool') || '#4ECDC4';
    ctx.lineWidth = CURVE_LINE_WIDTH;
    ctx.beginPath();

    // ✅ FIX: Calculate step width from viewport zoom or dimensions
    // Piano Roll uses dimensions.stepWidth, Arrangement uses viewport.zoomX
    const stepWidth = dimensions?.stepWidth || viewport.zoomX || 1;
    let firstPoint = true;

    // Calculate visible range
    // ✅ FIX: Handle time unit conversion (steps vs beats)
    const startDisplay = Math.max(0, Math.floor(viewport.scrollX / stepWidth));
    const endDisplay = Math.ceil((viewport.scrollX + canvasWidth) / stepWidth);

    // Convert display units to steps for AutomationLane
    const startStep = timeUnit === 'beats' ? startDisplay * STEPS_PER_BEAT : startDisplay;
    const endStep = timeUnit === 'beats' ? endDisplay * STEPS_PER_BEAT : endDisplay;
    const stepIncrement = timeUnit === 'beats' ? 0.25 * STEPS_PER_BEAT : 0.25; // Sample every 1/4 unit

    for (let step = startStep; step <= endStep; step += stepIncrement) {
        // ✅ FIX: Use lane's interpolation method instead of forcing linear
        const value = lane.getValueAtTime(step, undefined);
        if (value === null) continue;

        const normalizedValue = (value - min) / valueRange; // 0-1
        const y = canvasHeight - (normalizedValue * canvasHeight);

        // Convert step back to display units for drawing
        const displayStep = timeUnit === 'beats' ? step / STEPS_PER_BEAT : step;
        const x = displayStep * stepWidth;

        if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.stroke();

    // Draw automation points
    points.forEach((point, index) => {
        // ✅ FIX: Convert point time from steps to display units if needed
        let pointTime = point.time;
        if (timeUnit === 'beats') {
            // AutomationLane stores time in steps, convert to beats for display
            pointTime = pointTime / STEPS_PER_BEAT;
        }
        const x = pointTime * stepWidth;
        const normalizedValue = (point.value - min) / valueRange;
        const y = canvasHeight - (normalizedValue * canvasHeight);

        // Skip if outside viewport
        if (x < -viewport.scrollX - POINT_SIZE || x > canvasWidth - viewport.scrollX + POINT_SIZE) {
            return;
        }

        const isHovered = hoveredPoint?.laneIndex === 0 && hoveredPoint?.pointIndex === index;
        const isSelected = selectedPoints?.some(sp => sp.laneIndex === 0 && sp.pointIndex === index);
        const isDragging = draggingPoint?.laneIndex === 0 && draggingPoint?.pointIndex === index;

        const pointSize = isDragging ? POINT_SELECTED_SIZE :
            isHovered || isSelected ? POINT_HOVER_SIZE :
                POINT_SIZE;

        // Point fill
        ctx.fillStyle = isSelected || isDragging
            ? (getComputedStyle(document.documentElement)
                .getPropertyValue('--zenith-accent-warm') || '#FFB627')
            : (getComputedStyle(document.documentElement)
                .getPropertyValue('--zenith-accent-cool') || '#4ECDC4');

        ctx.beginPath();
        ctx.arc(x, y, pointSize, 0, Math.PI * 2);
        ctx.fill();

        // Point stroke
        ctx.strokeStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--zenith-bg-primary') || '#0A0E1A';
        ctx.lineWidth = 1;
        ctx.stroke();
    });

    ctx.restore();
}

/**
 * AutomationLaneEditor - Ortak Automation Editor Component
 */
export function AutomationLaneEditor({
    lane, // AutomationLane instance
    dimensions, // { width, height }
    viewport, // { scrollX, scrollY, zoomX, zoomY, width, height }
    onPointAdd, // (time, value) => void
    onPointUpdate, // (pointIndex, updates) => void
    onPointRemove, // (pointIndex) => void
    onLaneChange, // (lane) => void
    selectedPoints = [], // [{ laneIndex, pointIndex }]
    keyboardWidth = 0, // Piano Roll için keyboard offset
    showGrid = true,
    snapValue = 1, // Grid snap value
    activeTool = 'select',
    className = '',
    timeUnit = 'steps' // ✅ NEW: 'steps' (Piano Roll) or 'beats' (Arrangement)
}) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [hoveredPoint, setHoveredPoint] = useState({ laneIndex: -1, pointIndex: -1 });
    const [draggingPoint, setDraggingPoint] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [mouseDownPos, setMouseDownPos] = useState(null); // ✅ UX: Track initial mouse position for drag threshold
    const [hasMoved, setHasMoved] = useState(false); // ✅ UX: Track if mouse has moved enough to start drag/draw
    const [lastBrushPoint, setLastBrushPoint] = useState(null); // ✅ UX: Track last brush point position to prevent excessive points
    const [selectedPointIndex, setSelectedPointIndex] = useState(-1); // ✅ UX: Track selected point for keyboard deletion

    // ✅ FIX: Get lane points for dependency tracking
    const lanePoints = useMemo(() => {
        if (!lane) return [];
        const points = lane.getPoints();
        console.log('🎚️ AutomationLaneEditor: lanePoints memo', { pointsCount: points.length, laneId: lane.id, ccNumber: lane.ccNumber });
        return points;
    }, [lane]);

    // Render automation lane
    const renderLane = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !lane || !dimensions || !viewport) return;

        const styles = getComputedStyle(document.documentElement);
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
        }

        // Background
        const bgPrimary = styles.getPropertyValue('--zenith-bg-primary').trim();
        ctx.fillStyle = bgPrimary || '#0A0E1A';
        ctx.fillRect(0, 0, rect.width, rect.height);

        // Draw automation lane
        drawAutomationLane(ctx, {
            lane,
            dimensions,
            viewport,
            canvasWidth: rect.width,
            canvasHeight: rect.height,
            hoveredPoint,
            selectedPoints,
            draggingPoint,
            keyboardWidth,
            showGrid,
            timeUnit
        });
    }, [lane, lanePoints, dimensions, viewport, hoveredPoint, selectedPoints, draggingPoint, keyboardWidth, showGrid, timeUnit]);

    // ✅ FIX: Render on lane points changes
    // Use a key based on lane points to force re-render when points change
    const lanePointsKey = useMemo(() => {
        if (!lane) return '';
        const points = lane.getPoints();
        const key = JSON.stringify(points.map(p => ({ time: p.time, value: p.value })));
        console.log('🎚️ AutomationLaneEditor: lanePointsKey', { keyLength: key.length, pointsCount: points.length });
        return key;
    }, [lanePoints]);

    useEffect(() => {
        console.log('🎚️ AutomationLaneEditor: Rendering lane', { lanePointsKey, lanePointsCount: lanePoints.length });
        renderLane();
    }, [renderLane, lanePointsKey]);

    // Handle canvas resize
    useEffect(() => {
        if (typeof ResizeObserver === 'undefined') return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resizeObserver = new ResizeObserver(() => renderLane());
        resizeObserver.observe(canvas);
        return () => resizeObserver.disconnect();
    }, [renderLane]);

    /**
     * Convert screen coordinates to world coordinates
     */
    const screenToWorld = useCallback((clientX, clientY) => {
        const canvas = canvasRef.current;
        if (!canvas) return { time: 0, value: 0 };

        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left - keyboardWidth;
        const y = clientY - rect.top;

        // ✅ FIX: Calculate step width from viewport zoom or dimensions
        const stepWidth = dimensions?.stepWidth || viewport.zoomX || 1;
        let time = (x + viewport.scrollX) / stepWidth;

        // ✅ FIX: Convert time unit if needed
        // AutomationLane uses steps, but Arrangement uses beats
        if (timeUnit === 'beats') {
            // Convert beats to steps for AutomationLane
            time = time * STEPS_PER_BEAT;
        }

        const { min, max } = AutomationLane.getValueRange(lane?.ccNumber || 7);
        const normalizedY = 1 - (y / rect.height); // 0-1, inverted
        const value = min + (normalizedY * (max - min));

        return { time, value };
    }, [viewport, dimensions, keyboardWidth, lane, timeUnit]);

    /**
     * Find point at screen coordinates
     */
    const findPointAt = useCallback((clientX, clientY) => {
        if (!lane) return null;

        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left - keyboardWidth;
        const y = clientY - rect.top;

        const worldPos = screenToWorld(clientX, clientY);
        const points = lane.getPoints();
        if (!points || points.length === 0) return null;

        // ✅ FIX: Calculate step width from viewport zoom or dimensions
        const stepWidth = dimensions?.stepWidth || viewport.zoomX || 1;
        const hitRadius = POINT_HOVER_SIZE;

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            // ✅ FIX: Convert point time from steps to display units if needed
            let pointTime = point.time;
            if (timeUnit === 'beats') {
                // AutomationLane stores time in steps, convert to beats for display
                pointTime = pointTime / STEPS_PER_BEAT;
            }
            const pointX = pointTime * stepWidth;
            const { min, max } = AutomationLane.getValueRange(lane.ccNumber);
            const normalizedValue = (point.value - min) / (max - min);
            const pointY = rect.height - (normalizedValue * rect.height);

            const dx = (pointX + viewport.scrollX) - x;
            const dy = pointY - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= hitRadius) {
                return { laneIndex: 0, pointIndex: i };
            }
        }

        return null;
    }, [lane, viewport, keyboardWidth, screenToWorld]);

    /**
     * Snap time to grid
     */
    const snapToGrid = useCallback((time) => {
        if (!snapValue || snapValue <= 0) return time;
        // ✅ FIX: Convert snap value to steps if timeUnit is beats
        let snap = snapValue;
        if (timeUnit === 'beats') {
            snap = snapValue * STEPS_PER_BEAT;
        }
        return Math.round(time / snap) * snap;
    }, [snapValue, timeUnit]);

    /**
     * Clamp value to valid range
     */
    const clampValue = useCallback((value) => {
        if (!lane) return value;
        const { min, max } = AutomationLane.getValueRange(lane.ccNumber);
        return Math.max(min, Math.min(max, value));
    }, [lane]);

    // Mouse event handlers
    const handleMouseDown = useCallback((e) => {
        if (!lane) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const point = findPointAt(e.clientX, e.clientY);

        // ✅ UX: Store initial mouse position for drag threshold
        setMouseDownPos({ x: e.clientX, y: e.clientY });
        setHasMoved(false);

        if (point) {
            // ✅ UX: Point found - prepare for drag (but wait for movement threshold)
            setDraggingPoint(point);
            setIsDrawing(false); // ✅ UX: Ensure drawing is disabled when dragging
            e.preventDefault();
            e.stopPropagation();
        } else if (activeTool === 'paintBrush') {
            // ✅ UX: Paint brush - start drawing immediately
            const worldPos = screenToWorld(e.clientX, e.clientY);
            const snappedTime = snapToGrid(worldPos.time);
            const clampedValue = clampValue(worldPos.value);

            if (onPointAdd) {
                onPointAdd(snappedTime, clampedValue);
            }

            setIsDrawing(true);
            setDraggingPoint(null); // ✅ UX: Ensure drag is disabled when drawing
            setLastBrushPoint({ time: snappedTime, value: clampedValue }); // ✅ UX: Initialize brush point tracking
            e.preventDefault();
            e.stopPropagation();
        } else if (activeTool === 'select') {
            // ✅ UX: Select tool - wait for movement threshold before adding point
            // This prevents accidental point creation when trying to drag
            setIsDrawing(false); // Don't start drawing yet - wait for mouse move
            setDraggingPoint(null);
            e.preventDefault();
            e.stopPropagation();
        }
    }, [lane, findPointAt, activeTool, screenToWorld, snapToGrid, clampValue, onPointAdd]);

    const handleMouseMove = useCallback((e) => {
        if (!lane) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // ✅ UX: Calculate movement distance from initial mouse down position
        let movementDistance = 0;
        if (mouseDownPos) {
            const dx = e.clientX - mouseDownPos.x;
            const dy = e.clientY - mouseDownPos.y;
            movementDistance = Math.sqrt(dx * dx + dy * dy);
        }

        // Update hover (only if not dragging/drawing)
        if (!draggingPoint && !isDrawing) {
            const hovered = findPointAt(e.clientX, e.clientY);
            const newHovered = hovered || { laneIndex: -1, pointIndex: -1 };
            setHoveredPoint(newHovered);
            // ✅ UX: Update selected point for keyboard deletion
            if (newHovered.pointIndex >= 0) {
                setSelectedPointIndex(newHovered.pointIndex);
            }
        }

        // Handle dragging
        if (draggingPoint) {
            // ✅ UX: Only start drag if movement exceeds threshold
            if (!hasMoved && movementDistance < DRAG_THRESHOLD) {
                return; // Wait for threshold before starting drag
            }

            setHasMoved(true);
            const worldPos = screenToWorld(e.clientX, e.clientY);
            const snappedTime = snapToGrid(worldPos.time);
            const clampedValue = clampValue(worldPos.value);

            if (onPointUpdate) {
                onPointUpdate(draggingPoint.pointIndex, {
                    time: snappedTime,
                    value: clampedValue
                });
            }

            e.preventDefault();
            e.stopPropagation();
        } else if (isDrawing && activeTool === 'paintBrush') {
            // ✅ UX: Paint brush - continue drawing with minimum distance check
            const worldPos = screenToWorld(e.clientX, e.clientY);
            const snappedTime = snapToGrid(worldPos.time);
            const clampedValue = clampValue(worldPos.value);

            // ✅ UX: Only add point if moved enough distance from last point
            let shouldAddPoint = true;
            if (lastBrushPoint) {
                const dx = worldPos.time - lastBrushPoint.time;
                const dy = worldPos.value - lastBrushPoint.value;
                // Convert time difference to pixels for distance calculation
                const stepWidth = dimensions?.stepWidth || viewport.zoomX || 1;
                const timePixels = Math.abs(dx) * stepWidth;
                const valuePixels = Math.abs(dy) * (canvas.getBoundingClientRect().height / 127); // Approximate value to pixel conversion
                const distance = Math.sqrt(timePixels * timePixels + valuePixels * valuePixels);

                if (distance < BRUSH_MIN_DISTANCE) {
                    shouldAddPoint = false; // Too close to last point
                }
            }

            if (shouldAddPoint && onPointAdd) {
                onPointAdd(snappedTime, clampedValue);
                setLastBrushPoint({ time: snappedTime, value: clampedValue });
            }
        } else if (activeTool === 'select' && mouseDownPos && !draggingPoint) {
            // ✅ UX: Select tool - only add point if movement exceeds threshold
            // This prevents accidental point creation when trying to drag existing points
            if (movementDistance >= DRAW_THRESHOLD) {
                const worldPos = screenToWorld(e.clientX, e.clientY);
                const snappedTime = snapToGrid(worldPos.time);
                const clampedValue = clampValue(worldPos.value);

                if (onPointAdd) {
                    onPointAdd(snappedTime, clampedValue);
                    setIsDrawing(true); // Start drawing after threshold
                    setHasMoved(true);
                }
            }
        }
    }, [lane, findPointAt, draggingPoint, isDrawing, activeTool, screenToWorld, snapToGrid, clampValue, onPointAdd, onPointUpdate, mouseDownPos, hasMoved, lastBrushPoint, dimensions, viewport]);

    const handleMouseUp = useCallback((e) => {
        // ✅ UX: If mouse was pressed but not moved enough, add point at click position (select tool only)
        if (activeTool === 'select' && mouseDownPos && !hasMoved && !draggingPoint) {
            const worldPos = screenToWorld(mouseDownPos.x, mouseDownPos.y);
            const snappedTime = snapToGrid(worldPos.time);
            const clampedValue = clampValue(worldPos.value);

            if (onPointAdd) {
                onPointAdd(snappedTime, clampedValue);
            }
        }

        if (draggingPoint) {
            setDraggingPoint(null);
            e.preventDefault();
            e.stopPropagation();
        }
        if (isDrawing) {
            setIsDrawing(false);
        }

        // ✅ UX: Reset mouse tracking
        setMouseDownPos(null);
        setHasMoved(false);
        setLastBrushPoint(null); // ✅ UX: Reset brush point tracking
    }, [draggingPoint, isDrawing, activeTool, mouseDownPos, hasMoved, screenToWorld, snapToGrid, clampValue, onPointAdd]);

    const handleMouseLeave = useCallback(() => {
        setHoveredPoint({ laneIndex: -1, pointIndex: -1 });
        if (draggingPoint) {
            setDraggingPoint(null);
        }
        if (isDrawing) {
            setIsDrawing(false);
        }
        // ✅ UX: Reset mouse tracking
        setMouseDownPos(null);
        setHasMoved(false);
        setLastBrushPoint(null); // ✅ UX: Reset brush point tracking
    }, [draggingPoint, isDrawing]);

    // Double-click to delete point
    const handleDoubleClick = useCallback((e) => {
        if (!lane) return;

        const point = findPointAt(e.clientX, e.clientY);
        if (point && onPointRemove) {
            onPointRemove(point.pointIndex);
            setSelectedPointIndex(-1); // ✅ UX: Clear selection after deletion
            e.preventDefault();
            e.stopPropagation();
        }
    }, [lane, findPointAt, onPointRemove]);

    // ✅ UX: Keyboard handler for deletion (Delete/Backspace keys)
    const handleKeyDown = useCallback((e) => {
        if (!lane) return;

        // Delete/Backspace - delete selected or hovered point
        if ((e.key === 'Delete' || e.key === 'Backspace') && onPointRemove) {
            const pointToDelete = selectedPointIndex >= 0
                ? selectedPointIndex
                : (hoveredPoint.pointIndex >= 0 ? hoveredPoint.pointIndex : -1);

            if (pointToDelete >= 0) {
                onPointRemove(pointToDelete);
                setSelectedPointIndex(-1);
                setHoveredPoint({ laneIndex: -1, pointIndex: -1 });
                e.preventDefault();
                e.stopPropagation();
            }
        }
    }, [lane, selectedPointIndex, hoveredPoint, onPointRemove]);

    if (!lane) {
        return (
            <div className={`automation-lane-editor empty ${className}`}>
                <span>No automation lane selected</span>
            </div>
        );
    }

    // ✅ UX: Attach keyboard handler to container (needs focus)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('keydown', handleKeyDown);
        container.setAttribute('tabIndex', '0'); // Make focusable for keyboard events

        return () => {
            container.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    return (
        <div
            ref={containerRef}
            className={`automation-lane-editor ${className}`}
            style={{ position: 'relative', width: '100%', height: '100%', outline: 'none' }}
            onFocus={(e) => e.target.focus()} // Ensure focus on click
        >
            <canvas
                ref={canvasRef}
                className="automation-lane-editor-canvas"
                style={{
                    cursor: draggingPoint ? 'grabbing' : hoveredPoint.pointIndex >= 0 ? 'pointer' : 'crosshair',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'auto'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onDoubleClick={handleDoubleClick}
            />
        </div>
    );
}

export default AutomationLaneEditor;

