// Infinite Channel Rack - Canvas tabanlı sonsuz step sequencer
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { InfiniteGridEngine } from '../lib/canvas/InfiniteGridEngine';
import { useInstrumentsStore } from '../store/useInstrumentsStore';
import { useArrangementStore } from '../store/useArrangementStore';
import { usePlaybackStore } from '../store/usePlaybackStore';

const InfiniteChannelRack = ({
    onNoteToggle,
    onLoopCreate,
    className = ""
}) => {
    const containerRef = useRef(null);
    const engineRef = useRef(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [performanceStats, setPerformanceStats] = useState({});
    const [selectedLoop, setSelectedLoop] = useState(null);

    // Store connections
    const { instruments } = useInstrumentsStore();
    const { patterns, activePatternId, loopRegions } = useArrangementStore();
    const { currentStep, isPlaying } = usePlaybackStore();

    // Convert patterns object to array if needed
    const patternsArray = Array.isArray(patterns) ? patterns : Object.values(patterns);
    const activePattern = patternsArray.find(p => p.id === activePatternId);

    // Initialize canvas engine for channel rack
    useEffect(() => {
        if (!containerRef.current || isInitialized) return;

        const engine = new InfiniteGridEngine({
            cellWidth: 32,       // Wider steps for channel rack
            cellHeight: 40,      // Taller instrument rows
            bufferSize: 50,
            chunkSize: 500,      // Smaller chunks for step data
            maxZoom: 4,
            minZoom: 0.25
        });

        // Custom rendering for channel rack
        engine.renderNotes = function() {
            const ctx = this.layers.notes.ctx;
            const { cellWidth, cellHeight } = this.options;
            const { zoom } = this.viewport;

            // Render each instrument's steps
            instruments.forEach((instrument, instrumentIndex) => {
                const notes = activePattern?.data[instrument.id] || [];
                const y = instrumentIndex * cellHeight * zoom - this.viewport.y;

                if (y + cellHeight * zoom < 0 || y > this.viewport.height) return;

                // Draw instrument label background
                ctx.fillStyle = '#2a2a2a';
                ctx.fillRect(-this.viewport.x, y, 200 * zoom, cellHeight * zoom - 1);

                // Draw instrument name
                ctx.fillStyle = '#ffffff';
                ctx.font = `${12 * zoom}px Arial`;
                ctx.fillText(
                    instrument.name,
                    10 - this.viewport.x,
                    y + (cellHeight * zoom / 2) + (4 * zoom)
                );

                // Draw steps
                notes.forEach(note => {
                    const stepX = (note.time * 4) * cellWidth; // Convert to step position
                    const x = stepX * zoom - this.viewport.x;

                    if (x + cellWidth * zoom >= 0 && x <= this.viewport.width) {
                        // Step background
                        ctx.fillStyle = note.velocity > 0 ? '#4CAF50' : '#666';
                        ctx.fillRect(
                            x + 200 * zoom,
                            y + 2,
                            cellWidth * zoom - 2,
                            cellHeight * zoom - 4
                        );

                        // Velocity indicator
                        if (note.velocity > 0) {
                            const velocityHeight = (note.velocity / 127) * (cellHeight * zoom - 8);
                            ctx.fillStyle = '#81C784';
                            ctx.fillRect(
                                x + 200 * zoom + 2,
                                y + (cellHeight * zoom - velocityHeight - 4),
                                cellWidth * zoom - 6,
                                velocityHeight
                            );
                        }
                    }
                });
            });

            // Draw playhead
            if (isPlaying) {
                const playheadX = (currentStep * cellWidth * zoom) + (200 * zoom) - this.viewport.x;
                if (playheadX >= 0 && playheadX <= this.viewport.width) {
                    ctx.strokeStyle = '#FF5722';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(playheadX, 0);
                    ctx.lineTo(playheadX, this.viewport.height);
                    ctx.stroke();
                }
            }

            // Draw loop regions
            loopRegions.forEach(loop => {
                const startX = (loop.start * cellWidth * zoom) + (200 * zoom) - this.viewport.x;
                const endX = (loop.end * cellWidth * zoom) + (200 * zoom) - this.viewport.x;

                if (endX >= 0 && startX <= this.viewport.width) {
                    ctx.fillStyle = 'rgba(33, 150, 243, 0.2)';
                    ctx.fillRect(startX, 0, endX - startX, this.viewport.height);

                    // Loop borders
                    ctx.strokeStyle = '#2196F3';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(startX, 0);
                    ctx.lineTo(startX, this.viewport.height);
                    ctx.moveTo(endX, 0);
                    ctx.lineTo(endX, this.viewport.height);
                    ctx.stroke();

                    // Loop label
                    ctx.fillStyle = '#2196F3';
                    ctx.font = `${10 * zoom}px Arial`;
                    ctx.fillText(loop.name || 'Loop', startX + 5, 15);
                }
            });
        };

        // Override note loading for step data
        engine.getNotesInRange = (startTime, endTime) => {
            const allNotes = [];
            instruments.forEach(instrument => {
                const notes = activePattern?.data[instrument.id] || [];
                notes.forEach(note => {
                    const stepTime = note.time * 4; // Convert to step time
                    if (stepTime >= startTime && stepTime < endTime) {
                        allNotes.push({
                            ...note,
                            instrumentId: instrument.id,
                            stepTime
                        });
                    }
                });
            });
            return allNotes;
        };

        engine.init(containerRef.current);
        engineRef.current = engine;
        setIsInitialized(true);

        console.log('🎛️ Infinite Channel Rack initialized');

        return () => {
            engine.destroy();
        };
    }, []);

    // Update when data changes
    useEffect(() => {
        if (!engineRef.current || !isInitialized) return;

        engineRef.current.world.chunks.clear();
        engineRef.current.updateVisibleChunks();
        engineRef.current.invalidateAll();
    }, [instruments, activePattern, isInitialized, currentStep, loopRegions]);

    // Performance monitoring
    useEffect(() => {
        if (!isInitialized) return;

        const interval = setInterval(() => {
            if (engineRef.current) {
                setPerformanceStats(engineRef.current.getPerformanceStats());
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isInitialized]);

    // Handle canvas interactions
    const handleCanvasClick = useCallback((e) => {
        if (!engineRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        const { worldX, worldY } = engineRef.current.screenToWorld(screenX, screenY);

        // Determine instrument and step
        const instrumentIndex = Math.floor(worldY / 40);
        const stepTime = Math.floor((worldX - 200) / 32); // Account for instrument label width

        if (instrumentIndex >= 0 && instrumentIndex < instruments.length && stepTime >= 0) {
            const instrument = instruments[instrumentIndex];
            const noteTime = stepTime * 0.25; // Convert to note time

            onNoteToggle?.(instrument.id, noteTime);
        }
    }, [instruments, onNoteToggle]);

    // Loop creation with drag
    const [isCreatingLoop, setIsCreatingLoop] = useState(false);
    const [loopStart, setLoopStart] = useState(null);

    const handleMouseDown = useCallback((e) => {
        if (e.shiftKey) {
            // Start loop creation
            const rect = containerRef.current.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const { worldX } = engineRef.current.screenToWorld(screenX, 0);
            const stepTime = Math.floor((worldX - 200) / 32);

            setIsCreatingLoop(true);
            setLoopStart(stepTime);
        }
    }, []);

    const handleMouseUp = useCallback((e) => {
        if (isCreatingLoop && loopStart !== null) {
            const rect = containerRef.current.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const { worldX } = engineRef.current.screenToWorld(screenX, 0);
            const stepTime = Math.floor((worldX - 200) / 32);

            const loopEnd = Math.max(loopStart + 1, stepTime);

            onLoopCreate?.({
                id: Date.now(),
                name: `Loop ${loopRegions.length + 1}`,
                start: Math.min(loopStart, loopEnd),
                end: Math.max(loopStart, loopEnd)
            });

            setIsCreatingLoop(false);
            setLoopStart(null);
        }
    }, [isCreatingLoop, loopStart, loopRegions.length, onLoopCreate]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!engineRef.current) return;

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    // Toggle playback
                    break;
                case 'l':
                    if (e.shiftKey) {
                        // Enter loop creation mode
                        setIsCreatingLoop(true);
                    }
                    break;
                case 'Escape':
                    setIsCreatingLoop(false);
                    setLoopStart(null);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className={`infinite-channel-rack ${className}`}>
            {/* Channel Rack Header */}
            <div className="channel-rack-header">
                <div className="rack-info">
                    <h3>Infinite Channel Rack</h3>
                    <span className="instrument-count">{instruments.length} instruments</span>
                </div>

                {/* Performance Stats */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="performance-stats">
                        <span>FPS: {performanceStats.fps || 0}</span>
                        <span>Chunks: {performanceStats.activeChunks || 0}</span>
                        <span>Zoom: {(performanceStats.viewportPosition?.zoom || 1).toFixed(2)}x</span>
                    </div>
                )}

                {/* Mode indicator */}
                {isCreatingLoop && (
                    <div className="mode-indicator">
                        <span>🔄 Loop Creation Mode - Drag to create loop region</span>
                    </div>
                )}

                {/* Controls */}
                <div className="rack-controls">
                    <button
                        onClick={() => setIsCreatingLoop(!isCreatingLoop)}
                        className={isCreatingLoop ? 'active' : ''}
                        title="Create Loop Region (Shift+L)"
                    >
                        🔄
                    </button>
                    <button
                        onClick={() => {
                            // Clear all loops
                            // This would connect to your store
                        }}
                        title="Clear Loops"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            {/* Canvas Container */}
            <div
                ref={containerRef}
                className="channel-rack-canvas"
                onClick={!isCreatingLoop ? handleCanvasClick : undefined}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                style={{
                    position: 'relative',
                    width: '100%',
                    height: `${Math.max(400, instruments.length * 40 + 50)}px`,
                    backgroundColor: '#1a1a1a',
                    cursor: isCreatingLoop ? 'crosshair' : 'pointer',
                    overflow: 'hidden'
                }}
            />

            {/* Instructions */}
            <div className="channel-rack-instructions">
                <span>🖱️ Click steps to toggle</span>
                <span>🎯 Drag to pan</span>
                <span>🎪 Scroll to zoom</span>
                <span>🔄 Shift+click/drag for loops</span>
            </div>
        </div>
    );
};

export default InfiniteChannelRack;