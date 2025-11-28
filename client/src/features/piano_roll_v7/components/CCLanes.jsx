import React, { useRef, useEffect, useCallback, useState } from 'react';
import { AutomationLane } from '../types/AutomationLane';
import './CCLanes.css';

const CC_LANE_HEIGHT = 80;
const KEYBOARD_WIDTH = 80;
const POINT_SIZE = 6;
const POINT_HOVER_SIZE = 8;

/**
 * CC Lanes Component
 * Phase 2: FIRST LAYER - UI & Basic Editing
 * Displays and allows editing of MIDI CC automation lanes
 */
function CCLanes({
    lanes = [], // Array of AutomationLane instances
    selectedNoteIds = [],
    onLaneChange, // (laneId, lane) => void
    onPointAdd, // (laneId, time, value) => void
    onPointRemove, // (laneId, pointIndex) => void
    onPointUpdate, // (laneId, pointIndex, updates) => void
    onScroll, // (deltaX, deltaY) => void - Scroll callback to sync with Piano Roll
    dimensions,
    viewport,
    activeTool = 'select',
    snapValue = 1
}) {
    const canvasRef = useRef(null);
    const [hoveredPoint, setHoveredPoint] = useState({ laneIndex: -1, pointIndex: -1 });
    const [draggingPoint, setDraggingPoint] = useState(null);
    const [selectedLaneIndex, setSelectedLaneIndex] = useState(0);
    const payloadRef = useRef({
        lanes,
        selectedLaneIndex: 0,
        hoveredPoint: { laneIndex: -1, pointIndex: -1 },
        draggingPoint: null,
        dimensions,
        viewport
    });
    const dirtyRef = useRef(true);
    const lastViewportRef = useRef({ scrollX: 0, width: 0 });

    const markDirty = useCallback(() => {
        dirtyRef.current = true;
    }, []);

    useEffect(() => {
        payloadRef.current = {
            lanes,
            selectedLaneIndex,
            hoveredPoint,
            draggingPoint,
            dimensions,
            viewport
        };
        markDirty();
    }, [lanes, selectedLaneIndex, hoveredPoint, draggingPoint, dimensions, viewport, markDirty]);

    useEffect(() => {
        if (typeof ResizeObserver === 'undefined') return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resizeObserver = new ResizeObserver(() => markDirty());
        resizeObserver.observe(canvas);
        return () => resizeObserver.disconnect();
    }, [markDirty]);

    const renderCCLanes = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const payload = payloadRef.current;
        if (!ctx || !payload.dimensions || !payload.viewport || payload.lanes.length === 0) return;

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

        const { selectedLaneIndex: laneIndex, lanes: laneList } = payload;
        if (laneIndex >= 0 && laneIndex < laneList.length) {
            const lane = laneList[laneIndex];
            if (lane?.visible) {
                drawAutomationLane(ctx, {
                    lane,
                    laneIndex,
                    dimensions: payload.dimensions,
                    viewport: payload.viewport,
                    canvasHeight: rect.height,
                    canvasWidth: rect.width,
                    hoveredPoint: payload.hoveredPoint,
                    draggingPoint: payload.draggingPoint
                });
            }
        }
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
                renderCCLanes();
            }

            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [renderCCLanes]);

    const drawAutomationLane = (ctx, { lane, laneIndex, dimensions, viewport, canvasHeight, canvasWidth, hoveredPoint, draggingPoint }) => {
        const styles = getComputedStyle(document.documentElement);
        const { stepWidth } = dimensions;
        const points = lane.getPoints();
        const { min, max } = AutomationLane.getValueRange(lane.ccNumber);

        ctx.save();
        // ✅ FIX: CCLanes should align with piano roll grid area
        // Grid area starts at KEYBOARD_WIDTH, so we need to translate by KEYBOARD_WIDTH
        // Then apply scroll offset: translate(KEYBOARD_WIDTH - scrollX, 0)
        // This ensures automation points align with piano roll notes
        ctx.translate(KEYBOARD_WIDTH - viewport.scrollX, 0);

        // Draw grid lines
        const gridColor = styles.getPropertyValue('--zenith-border-subtle').trim() || '#2a2d35';
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.3;

        // Calculate visible width
        const visibleWidth = viewport.width - KEYBOARD_WIDTH;

        // ✅ FIX: After translate(KEYBOARD_WIDTH - scrollX, 0), world coordinates are used directly
        // Horizontal grid (value lines)
        for (let i = 0; i <= 4; i++) {
            const valueY = (canvasHeight / 4) * i;
            ctx.beginPath();
            // Draw from scrollX (world space start) to scrollX + visibleWidth
            ctx.moveTo(viewport.scrollX, valueY);
            ctx.lineTo(viewport.scrollX + visibleWidth, valueY);
            ctx.stroke();
        }

        // Vertical grid (time lines)
        // After translate(KEYBOARD_WIDTH - scrollX, 0), world x coordinates are used directly
        // So we draw from scrollX to scrollX + visibleWidth in world coordinates
        const startStep = Math.floor(viewport.scrollX / stepWidth);
        const endStep = Math.ceil((viewport.scrollX + visibleWidth) / stepWidth);
        for (let step = startStep; step <= endStep; step++) {
            const x = step * stepWidth;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
            ctx.stroke();
        }

        ctx.globalAlpha = 1.0;

        // Draw automation curve
        if (points.length > 0) {
            ctx.strokeStyle = lane.color;
            ctx.lineWidth = 2;
            ctx.beginPath();

            // Draw curve connecting points
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                const x = point.time * stepWidth;
                const valueNormalized = (point.value - min) / (max - min);
                const y = canvasHeight - (valueNormalized * canvasHeight);

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    // Linear interpolation between points
                    ctx.lineTo(x, y);
                }
            }

            ctx.stroke();

            // Fill area under curve
            if (points.length > 1) {
                ctx.fillStyle = lane.color;
                ctx.globalAlpha = 0.2;
                ctx.lineTo(points[points.length - 1].time * stepWidth, canvasHeight);
                ctx.lineTo(points[0].time * stepWidth, canvasHeight);
                ctx.closePath();
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }
        }

        // Draw automation points
        points.forEach((point, pointIndex) => {
            const x = point.time * stepWidth;
            const valueNormalized = (point.value - min) / (max - min);
            const y = canvasHeight - (valueNormalized * canvasHeight);

            // Only draw if in viewport
            if (x < viewport.scrollX || x > viewport.scrollX + viewport.width - KEYBOARD_WIDTH) {
                return;
            }

            const isHovered = hoveredPoint.laneIndex === laneIndex && hoveredPoint.pointIndex === pointIndex;
            const isDragging = draggingPoint?.laneIndex === laneIndex && draggingPoint?.pointIndex === pointIndex;
            const size = (isHovered || isDragging) ? POINT_HOVER_SIZE : POINT_SIZE;

            // Point circle
            ctx.fillStyle = isDragging ? '#ffffff' : lane.color;
            ctx.globalAlpha = isHovered || isDragging ? 1.0 : 0.8;
            ctx.beginPath();
            ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            ctx.fill();

            // Point outline
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Value label
            if (isHovered || isDragging) {
                const textPrimary = styles.getPropertyValue('--zenith-text-primary').trim();
                ctx.fillStyle = textPrimary || '#ffffff';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(point.value.toString(), x, y - size - 5);
            }
        });

        ctx.restore();
    };


    // Handle mouse interactions
    const handleMouseDown = useCallback((e) => {
        // ✅ FIX: Allow automation drawing with any tool (or at least select/paintBrush)
        // Automation should be drawable regardless of active tool
        // ✅ FIX: Use current values from ref to get latest selectedLaneIndex and lanes during scroll
        const payload = payloadRef.current;
        const currentSelectedLaneIndex = payload.selectedLaneIndex ?? selectedLaneIndex;
        const currentLanes = payload.lanes || lanes;
        
        if (currentSelectedLaneIndex < 0 || currentSelectedLaneIndex >= currentLanes.length) return;
        
        // ✅ FIX: Stop event propagation to prevent piano roll from handling the event
        e.stopPropagation();

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        // ✅ FIX: Use current values from ref to get latest scrollX, dimensions, and lanes during scroll
        const currentViewport = payload.viewport || viewport;
        const currentDimensions = payload.dimensions || dimensions;
        
        // ✅ FIX: Canvas drawing uses translate(KEYBOARD_WIDTH - scrollX, 0)
        // So world space point at x is drawn at canvas coordinate (x + KEYBOARD_WIDTH - scrollX)
        // Mouse at canvas coordinate screenX corresponds to world space (screenX - KEYBOARD_WIDTH + scrollX)
        // But since canvas starts at KEYBOARD_WIDTH, we need to account for that
        const screenX = e.clientX - rect.left;
        const clickX = screenX - KEYBOARD_WIDTH + currentViewport.scrollX;
        const clickY = e.clientY - rect.top;

        const { stepWidth } = currentDimensions;
        const clickTime = clickX / stepWidth;
        const lane = currentLanes[currentSelectedLaneIndex];
        if (!lane) return;
        const points = lane.getPoints();
        const { min, max } = AutomationLane.getValueRange(lane.ccNumber);
        const canvasHeight = rect.height;
        const clickValue = max - ((clickY / canvasHeight) * (max - min));

        // Snap time to grid
        const snappedTime = snapValue > 0 ? Math.round(clickTime / snapValue) * snapValue : clickTime;

        // Check if clicking on existing point
        let clickedPointIndex = -1;
        const clickTolerance = 10; // pixels

        points.forEach((point, index) => {
            // ✅ FIX: Point coordinates are in world space (point.time * stepWidth)
            // Canvas uses translate(-scrollX), so point appears at (pointX - scrollX) on screen
            // For distance calculation, we need to compare in the same coordinate system
            // Use world coordinates for both: point is at pointX, click is at clickX
            const pointX = point.time * stepWidth;
            const pointY = canvasHeight - ((point.value - min) / (max - min)) * canvasHeight;
            
            // ✅ FIX: Both clickX and pointX are in world coordinates, so distance calculation is correct
            const distance = Math.sqrt(
                Math.pow(clickX - pointX, 2) + Math.pow(clickY - pointY, 2)
            );

            if (distance < clickTolerance) {
                clickedPointIndex = index;
            }
        });

        if (clickedPointIndex >= 0) {
            // ✅ PERFORMANCE: Start dragging point with document-level listeners for smooth dragging
            setDraggingPoint({ laneIndex: currentSelectedLaneIndex, pointIndex: clickedPointIndex });
            
            // ✅ PERFORMANCE: Add document-level mouse move/up listeners for smooth dragging outside canvas
            const handleDocumentMouseMove = (moveEvent) => {
                // Use the same logic as handleMouseMove but with document coordinates
                const canvas = canvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                
                // ✅ FIX: Use current values from ref to get latest scrollX, dimensions, and lanes during scroll
                const payload = payloadRef.current;
                const currentViewport = payload.viewport || viewport;
                const currentDimensions = payload.dimensions || dimensions;
                const currentLanes = payload.lanes || lanes;
                
                // ✅ FIX: Canvas drawing uses translate(KEYBOARD_WIDTH - scrollX, 0)
                // So world space point at x is drawn at canvas coordinate (x + KEYBOARD_WIDTH - scrollX)
                // Mouse at canvas coordinate screenX corresponds to world space (screenX - KEYBOARD_WIDTH + scrollX)
                const screenX = moveEvent.clientX - rect.left;
                const mouseX = screenX - KEYBOARD_WIDTH + currentViewport.scrollX;
                const mouseY = moveEvent.clientY - rect.top;

                const { stepWidth } = currentDimensions;
                const newTime = mouseX / stepWidth;
                // ✅ FIX: Get current selectedLaneIndex from payload ref
                const currentPayload = payloadRef.current;
                const currentSelectedLaneIndex = currentPayload.selectedLaneIndex ?? selectedLaneIndex;
                const lane = currentLanes[currentSelectedLaneIndex];
                if (!lane) return;
                const { min, max } = AutomationLane.getValueRange(lane.ccNumber);
                const canvasHeight = rect.height;
                const newValue = max - ((mouseY / canvasHeight) * (max - min));

                // Snap time to grid
                const snappedTime = snapValue > 0 ? Math.round(newTime / snapValue) * snapValue : newTime;

                // Store pending update
                pendingDragUpdateRef.current = {
                    laneId: lane.ccNumber,
                    pointIndex: clickedPointIndex,
                    time: Math.max(0, snappedTime),
                    value: Math.max(min, Math.min(max, Math.round(newValue)))
                };

                // ✅ PERFORMANCE: Batch updates via RAF
                if (!dragUpdateRef.current) {
                    dragUpdateRef.current = requestAnimationFrame(() => {
                        if (pendingDragUpdateRef.current && onPointUpdate) {
                            onPointUpdate(
                                pendingDragUpdateRef.current.laneId,
                                pendingDragUpdateRef.current.pointIndex,
                                {
                                    time: pendingDragUpdateRef.current.time,
                                    value: pendingDragUpdateRef.current.value
                                }
                            );
                            pendingDragUpdateRef.current = null;
                        }
                        dragUpdateRef.current = null;
                    });
                }
            };

            const handleDocumentMouseUp = (upEvent) => {
                // ✅ PERFORMANCE: Clean up document listeners
                document.removeEventListener('mousemove', handleDocumentMouseMove);
                document.removeEventListener('mouseup', handleDocumentMouseUp);
                
                // Cancel any pending RAF updates
                if (dragUpdateRef.current) {
                    cancelAnimationFrame(dragUpdateRef.current);
                    dragUpdateRef.current = null;
                }
                if (hoverUpdateRef.current) {
                    cancelAnimationFrame(hoverUpdateRef.current);
                    hoverUpdateRef.current = null;
                }
                
                setDraggingPoint(null);
            };

            // ✅ PERFORMANCE: Add document-level listeners for smooth dragging
            document.addEventListener('mousemove', handleDocumentMouseMove);
            document.addEventListener('mouseup', handleDocumentMouseUp);
        } else {
            // Add new point
            if (onPointAdd) {
                onPointAdd(lane.ccNumber, snappedTime, Math.max(min, Math.min(max, Math.round(clickValue))));
            }
        }
    }, [selectedLaneIndex, lanes, dimensions, viewport, snapValue, onPointAdd, onPointUpdate]);

    // ✅ PERFORMANCE: Throttle hover updates to reduce re-renders
    const hoverUpdateRef = useRef(null);
    const lastHoverRef = useRef({ laneIndex: -1, pointIndex: -1 });

    // ✅ PERFORMANCE: Use RAF for smooth drag updates
    const dragUpdateRef = useRef(null);
    const pendingDragUpdateRef = useRef(null);

    const handleMouseMove = useCallback((e) => {
        // ✅ PERFORMANCE: Skip hover detection during drag (handled by document listener)
        if (draggingPoint) {
            e.stopPropagation();
            return;
        }

        // ✅ FIX: Stop event propagation when interacting with automation
        if (selectedLaneIndex >= 0 && selectedLaneIndex < lanes.length) {
            e.stopPropagation();
        }
        
        // ✅ PERFORMANCE: Throttle hover updates using RAF to reduce re-renders
        if (hoverUpdateRef.current) {
            cancelAnimationFrame(hoverUpdateRef.current);
        }

        hoverUpdateRef.current = requestAnimationFrame(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            // ✅ FIX: Use current values from ref to get latest scrollX, dimensions, and lanes during scroll
            const payload = payloadRef.current;
            const currentViewport = payload.viewport || viewport;
            const currentDimensions = payload.dimensions || dimensions;
            const currentLanes = payload.lanes || lanes;
            
            // ✅ FIX: Canvas drawing uses translate(KEYBOARD_WIDTH - scrollX, 0)
            // So world space point at x is drawn at canvas coordinate (x + KEYBOARD_WIDTH - scrollX)
            // Mouse at canvas coordinate screenX corresponds to world space (screenX - KEYBOARD_WIDTH + scrollX)
            const screenX = e.clientX - rect.left;
            const mouseX = screenX - KEYBOARD_WIDTH + currentViewport.scrollX;
            const mouseY = e.clientY - rect.top;

            const { stepWidth } = currentDimensions;
            // ✅ FIX: Get current selectedLaneIndex from payload ref
            const currentSelectedLaneIndex = payload.selectedLaneIndex ?? selectedLaneIndex;
            const lane = currentLanes[currentSelectedLaneIndex];
            if (!lane) return;
            const points = lane.getPoints();
            const { min, max } = AutomationLane.getValueRange(lane.ccNumber);
            const canvasHeight = rect.height;
            const clickTolerance = 10;

            let foundHover = { laneIndex: -1, pointIndex: -1 };

            points.forEach((point, index) => {
                const pointX = point.time * stepWidth;
                const pointY = canvasHeight - ((point.value - min) / (max - min)) * canvasHeight;
                const distance = Math.sqrt(
                    Math.pow(mouseX - pointX, 2) + Math.pow(mouseY - pointY, 2)
                );

                if (distance < clickTolerance) {
                    foundHover = { laneIndex: currentSelectedLaneIndex, pointIndex: index };
                }
            });

            // ✅ PERFORMANCE: Only update if hover state changed
            if (foundHover.laneIndex !== lastHoverRef.current.laneIndex || 
                foundHover.pointIndex !== lastHoverRef.current.pointIndex) {
                lastHoverRef.current = foundHover;
                setHoveredPoint(foundHover);
            }
        });
    }, [draggingPoint, selectedLaneIndex, lanes, dimensions, viewport]);

    const handleMouseUp = useCallback((e) => {
        // ✅ FIX: Stop event propagation when interacting with automation
        if (draggingPoint) {
            e?.stopPropagation();
            
            // ✅ PERFORMANCE: Clean up RAF updates
            if (dragUpdateRef.current) {
                cancelAnimationFrame(dragUpdateRef.current);
                dragUpdateRef.current = null;
            }
            if (hoverUpdateRef.current) {
                cancelAnimationFrame(hoverUpdateRef.current);
                hoverUpdateRef.current = null;
            }
            
            setDraggingPoint(null);
        }
    }, [draggingPoint]);

    // ✅ FIX: Add wheel event listener manually with passive: false to allow preventDefault
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const wheelHandler = (e) => {
            if (!onScroll) return;

            e.preventDefault();
            e.stopPropagation();

            // Pass scroll delta to parent (Piano Roll)
            onScroll(e.deltaX, e.deltaY);
        };

        // Add event listener with passive: false to allow preventDefault
        canvas.addEventListener('wheel', wheelHandler, { passive: false });

        return () => {
            canvas.removeEventListener('wheel', wheelHandler);
        };
    }, [onScroll]);

    return (
        <div className="cc-lanes">
            <div className="cc-lanes-header">
                <div className="cc-lanes-label">
                    <span>Automation</span>
                </div>
                <div className="cc-lanes-selector">
                    <select
                        value={selectedLaneIndex}
                        onChange={(e) => setSelectedLaneIndex(parseInt(e.target.value))}
                        className="cc-lane-select"
                    >
                        {lanes.map((lane, index) => (
                            <option key={index} value={index}>
                                {lane.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <canvas
                ref={canvasRef}
                className="cc-lanes-canvas"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                    width: '100%',
                    height: CC_LANE_HEIGHT,
                    cursor: draggingPoint ? 'grabbing' : (hoveredPoint.pointIndex >= 0 ? 'pointer' : 'crosshair')
                }}
            />
        </div>
    );
}

export default React.memo(CCLanes);

