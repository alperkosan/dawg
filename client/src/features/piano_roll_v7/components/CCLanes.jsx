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
    dimensions,
    viewport,
    activeTool = 'select',
    snapValue = 1
}) {
    const canvasRef = useRef(null);
    const [hoveredPoint, setHoveredPoint] = useState({ laneIndex: -1, pointIndex: -1 });
    const [draggingPoint, setDraggingPoint] = useState(null);
    const [selectedLaneIndex, setSelectedLaneIndex] = useState(0);

    // Draw CC lanes
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !dimensions || !viewport || lanes.length === 0) return;

        const styles = getComputedStyle(document.documentElement);
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
        }

        // Clear canvas
        const bgPrimary = styles.getPropertyValue('--zenith-bg-primary').trim();
        ctx.fillStyle = bgPrimary || '#1a1d23';
        ctx.fillRect(0, 0, rect.width, rect.height);

        // Draw active lane
        if (selectedLaneIndex >= 0 && selectedLaneIndex < lanes.length) {
            const lane = lanes[selectedLaneIndex];
            if (lane.visible) {
                drawAutomationLane(ctx, {
                    lane,
                    laneIndex: selectedLaneIndex,
                    dimensions,
                    viewport,
                    canvasHeight: rect.height,
                    canvasWidth: rect.width,
                    hoveredPoint,
                    draggingPoint
                });
            }
        }

    }, [lanes, selectedLaneIndex, hoveredPoint, draggingPoint, dimensions, viewport]);

    const drawAutomationLane = (ctx, { lane, laneIndex, dimensions, viewport, canvasHeight, canvasWidth, hoveredPoint, draggingPoint }) => {
        const styles = getComputedStyle(document.documentElement);
        const { stepWidth } = dimensions;
        const points = lane.getPoints();
        const { min, max } = AutomationLane.getValueRange(lane.ccNumber);

        ctx.save();
        ctx.translate(-viewport.scrollX, 0);

        // Draw grid lines
        const gridColor = styles.getPropertyValue('--zenith-border-subtle').trim() || '#2a2d35';
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.3;

        // Calculate visible width
        const visibleWidth = viewport.width - KEYBOARD_WIDTH;

        // Horizontal grid (value lines)
        for (let i = 0; i <= 4; i++) {
            const valueY = (canvasHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(viewport.scrollX, valueY);
            ctx.lineTo(viewport.scrollX + visibleWidth, valueY);
            ctx.stroke();
        }

        // Vertical grid (time lines)
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
        if (activeTool !== 'select' || selectedLaneIndex < 0 || selectedLaneIndex >= lanes.length) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left + viewport.scrollX;
        const clickY = e.clientY - rect.top;

        const { stepWidth } = dimensions;
        const clickTime = clickX / stepWidth;
        const lane = lanes[selectedLaneIndex];
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
            const pointX = point.time * stepWidth;
            const pointY = canvasHeight - ((point.value - min) / (max - min)) * canvasHeight;
            const distance = Math.sqrt(
                Math.pow(clickX - pointX, 2) + Math.pow(clickY - pointY, 2)
            );

            if (distance < clickTolerance) {
                clickedPointIndex = index;
            }
        });

        if (clickedPointIndex >= 0) {
            // Start dragging point
            setDraggingPoint({ laneIndex: selectedLaneIndex, pointIndex: clickedPointIndex });
        } else {
            // Add new point
            if (onPointAdd) {
                onPointAdd(lane.ccNumber, snappedTime, Math.max(min, Math.min(max, Math.round(clickValue))));
            }
        }
    }, [activeTool, selectedLaneIndex, lanes, dimensions, viewport, snapValue, onPointAdd]);

    const handleMouseMove = useCallback((e) => {
        if (!draggingPoint || selectedLaneIndex < 0 || selectedLaneIndex >= lanes.length) {
            // Update hover state
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left + viewport.scrollX;
            const mouseY = e.clientY - rect.top;

            const { stepWidth } = dimensions;
            const lane = lanes[selectedLaneIndex];
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
                    foundHover = { laneIndex: selectedLaneIndex, pointIndex: index };
                }
            });

            setHoveredPoint(foundHover);
            return;
        }

        // Drag point
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left + viewport.scrollX;
        const mouseY = e.clientY - rect.top;

        const { stepWidth } = dimensions;
        const newTime = mouseX / stepWidth;
        const lane = lanes[selectedLaneIndex];
        const { min, max } = AutomationLane.getValueRange(lane.ccNumber);
        const canvasHeight = rect.height;
        const newValue = max - ((mouseY / canvasHeight) * (max - min));

        // Snap time to grid
        const snappedTime = snapValue > 0 ? Math.round(newTime / snapValue) * snapValue : newTime;

        if (onPointUpdate) {
            onPointUpdate(
                lane.ccNumber,
                draggingPoint.pointIndex,
                {
                    time: Math.max(0, snappedTime),
                    value: Math.max(min, Math.min(max, Math.round(newValue)))
                }
            );
        }
    }, [draggingPoint, selectedLaneIndex, lanes, dimensions, viewport, snapValue, onPointUpdate]);

    const handleMouseUp = useCallback(() => {
        if (draggingPoint) {
            setDraggingPoint(null);
        }
    }, [draggingPoint]);

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

