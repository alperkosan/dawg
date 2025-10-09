import React, { useRef, useEffect, useState, useMemo } from 'react';
import { usePianoRollEngine } from './usePianoRollEngine';
import { useNoteInteractionsV2 } from './hooks/useNoteInteractionsV2';
import { drawPianoRollStatic, drawPlayhead } from './renderer';
import { uiUpdateManager, UPDATE_PRIORITIES, UPDATE_FREQUENCIES } from '@/lib/core/UIUpdateManager';
import { performanceMonitor } from '@/utils/PerformanceMonitor';
import Toolbar from './components/Toolbar';
import VelocityLane from './components/VelocityLane';
import { usePanelsStore } from '@/store/usePanelsStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { usePlaybackStore } from '@/store/usePlaybackStoreV2';
import { getTimelineController } from '@/lib/core/TimelineControllerSingleton';
import { getToolManager } from '@/lib/piano-roll-tools';
import './PianoRoll_v5.css';

function PianoRoll() {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const playheadCanvasRef = useRef(null); // NEW: Separate playhead layer

    // ✅ UNIFIED TRANSPORT SYSTEM - Get playback controls first
    const togglePlayPause = usePlaybackStore(state => state.togglePlayPause);
    const playbackMode = usePlaybackStore(state => state.playbackMode);
    const isPlaying = usePlaybackStore(state => state.isPlaying);
    const playbackState = usePlaybackStore(state => state.playbackState);
    const currentStep = usePlaybackStore(state => state.currentStep);
    const setTransportPosition = usePlaybackStore(state => state.setTransportPosition);

    // Pass transport position setter to engine for timeline interaction
    const { snapValue, setSnapValue, ...engine } = usePianoRollEngine(containerRef, {
        setTransportPosition
    });

    // Toolbar state
    const [activeTool, setActiveTool] = useState('select');
    const [zoom, setZoom] = useState(1.0);

    // Performance monitoring
    const [fps, setFps] = useState(60);
    const [showPerf, setShowPerf] = useState(false);
    const [qualityLevel, setQualityLevel] = useState('high');

    // ✅ GHOST PLAYHEAD STATE
    const [ghostPosition, setGhostPosition] = useState(null);

    // ✅ TOOL MANAGER - Subscribe to tool changes
    useEffect(() => {
        const toolManager = getToolManager();

        // Set initial tool
        setActiveTool(toolManager.getActiveTool());

        // Subscribe to tool changes
        const unsubscribe = toolManager.subscribe((toolType) => {
            setActiveTool(toolType);
        });

        return unsubscribe;
    }, []);

    // ✅ KEYBOARD SHORTCUTS - Handle Alt + key for tools
    useEffect(() => {
        const handleKeyDown = (e) => {
            const toolManager = getToolManager();
            toolManager.handleKeyPress(e);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            const metrics = performanceMonitor.getMetrics();
            setFps(metrics.currentFps);
        }, 100); // Update FPS display 10 times per second

        return () => clearInterval(interval);
    }, []);

    // ⚡ ADAPTIVE PERFORMANCE: Listen for quality changes
    useEffect(() => {
        const handleQualityChange = (event) => {
            const { quality } = event.detail;
            setQualityLevel(quality);
        };

        window.addEventListener('ui-quality-change', handleQualityChange);
        return () => window.removeEventListener('ui-quality-change', handleQualityChange);
    }, []);

    // Memoize position calculation to prevent re-renders
    const position = useMemo(
        () => playbackMode === 'pattern' ? currentStep : 0,
        [playbackMode, currentStep]
    );

    // Get data from persistent stores
    const pianoRollInstrumentId = usePanelsStore(state => state.pianoRollInstrumentId);
    const instruments = useInstrumentsStore(state => state.instruments);

    const currentInstrument = pianoRollInstrumentId
        ? instruments.find(inst => inst.id === pianoRollInstrumentId)
        : null;

    // V2 Hook - Sade ve basit, ArrangementStore merkezli
    const noteInteractions = useNoteInteractionsV2(
        engine,
        activeTool,
        snapValue,
        currentInstrument
    );

    // ✅ REGISTER PIANO ROLL TIMELINE with TimelineController
    useEffect(() => {
        if (!containerRef.current || !engine.dimensions.stepWidth) return;

        try {
            const timelineController = getTimelineController();

            // Calculate ruler element bounds (top 30px of container)
            const RULER_HEIGHT = 30;
            const KEYBOARD_WIDTH = 80;

            // ✅ Custom position calculation for piano roll (accounts for scroll/zoom)
            // Use latest engine state by accessing it from component scope (not closure)
            const calculatePosition = (mouseX, mouseY) => {
                // Only handle clicks in timeline ruler area
                if (mouseY > RULER_HEIGHT) {
                    return null; // Not in ruler
                }

                // Subtract keyboard width
                const timelineX = mouseX - KEYBOARD_WIDTH;
                if (timelineX < 0) {
                    return null; // In keyboard area
                }

                // ✅ Get latest viewport and dimensions (engine is in component scope, always fresh)
                const viewport = engine.viewport;
                const stepWidth = engine.dimensions?.stepWidth;
                if (!viewport || !stepWidth) return null;

                // Account for scroll (already in screen pixels)
                const worldX = viewport.scrollX + timelineX;

                // Convert pixels to steps using current stepWidth (includes zoom)
                const step = Math.floor(worldX / stepWidth);

                return Math.max(0, Math.min(engine.dimensions.totalSteps - 1, step));
            };

            // Register piano roll timeline for ghost playhead
            timelineController.registerTimeline('piano-roll-timeline', {
                element: containerRef.current,
                stepWidth: engine.dimensions.stepWidth,
                totalSteps: engine.dimensions.totalSteps,
                onPositionChange: null, // Position updates handled by playback store
                onGhostPositionChange: (pos) => {
                    setGhostPosition(pos);
                },
                enableGhostPosition: true,
                enableRangeSelection: false,
                calculatePosition // ✅ Custom calculation for viewport scroll/zoom
            });

            console.log('✅ Piano Roll timeline registered');

            return () => {
                timelineController.unregisterTimeline('piano-roll-timeline');
                console.log('🧹 Piano Roll timeline cleanup');
            };
        } catch (error) {
            console.warn('Failed to register Piano Roll timeline:', error);
        }
        // ✅ FIX: Empty deps - only register once, calculatePosition uses latest engine from scope
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only register once on mount

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !engine.viewport.width) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
        }

        // Static data (everything except playhead)
        const engineWithData = {
            ...engine,
            snapValue,
            notes: noteInteractions.notes,
            selectedNoteIds: noteInteractions.selectedNoteIds,
            hoveredNoteId: noteInteractions.hoveredNoteId,
            selectionArea: noteInteractions.selectionArea,
            isSelectingArea: noteInteractions.isSelectingArea,
            previewNote: noteInteractions.previewNote,
            slicePreview: noteInteractions.slicePreview,
            sliceRange: noteInteractions.sliceRange,
            qualityLevel, // Pass quality level to renderer
            ghostPosition, // ✅ Pass ghost position for hover preview
            activeTool // ✅ Pass active tool for visual feedback
        };
        drawPianoRollStatic(ctx, engineWithData);

    }, [engine, snapValue, noteInteractions, qualityLevel, ghostPosition, activeTool]); // Added: activeTool

    // ✅ Store engine ref for playhead rendering (avoid stale closure)
    const engineRef = useRef(engine);
    useEffect(() => {
        engineRef.current = engine;
    }, [engine]);

    // Playhead canvas - fast rendering via UIUpdateManager
    useEffect(() => {
        if (!isPlaying) {
            const canvas = playheadCanvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (ctx) {
                const rect = canvas.getBoundingClientRect();
                ctx.clearRect(0, 0, rect.width, rect.height);
            }
            return;
        }

        const unsubscribe = uiUpdateManager.subscribe(
            'piano-roll-playhead',
            () => {
                const canvas = playheadCanvasRef.current;
                const ctx = canvas?.getContext('2d');
                const currentEngine = engineRef.current; // ✅ Use ref to get latest engine
                if (!ctx || !currentEngine.viewport.width) return;

                const dpr = window.devicePixelRatio || 1;
                const rect = canvas.getBoundingClientRect();

                if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
                    canvas.width = rect.width * dpr;
                    canvas.height = rect.height * dpr;
                    ctx.scale(dpr, dpr);
                }

                ctx.clearRect(0, 0, rect.width, rect.height);

                // ✅ Get position from store directly to avoid stale closure
                const currentPosition = usePlaybackStore.getState().currentStep;
                const currentPlaybackState = usePlaybackStore.getState().playbackState;

                drawPlayhead(ctx, {
                    viewport: currentEngine.viewport, // ✅ Use latest viewport
                    dimensions: currentEngine.dimensions, // ✅ Use latest dimensions
                    playhead: {
                        position: currentPosition,
                        isPlaying: currentPlaybackState === 'playing',
                        playbackState: currentPlaybackState
                    }
                });
            },
            UPDATE_PRIORITIES.HIGH,
            UPDATE_FREQUENCIES.REALTIME
        );

        return unsubscribe;
    }, [isPlaying]); // ✅ OPTIMIZED: Only re-subscribe when play/stop state changes

    // Toolbar handlers
    const handleToolChange = (tool) => {
        setActiveTool(tool);
    };

    const handleZoomChange = (newZoom) => {
        setZoom(newZoom);
    };

    // ✅ VELOCITY LANE HANDLER
    const handleNoteVelocityChange = (noteId, newVelocity) => {
        // Update note velocity via note interactions
        noteInteractions.updateNoteVelocity?.(noteId, newVelocity);
    };

    // Memoize selectedNoteIds array to prevent VelocityLane re-renders
    const selectedNoteIdsArray = useMemo(
        () => Array.from(noteInteractions.selectedNoteIds),
        [noteInteractions.selectedNoteIds]
    );

    // ✅ REMOVED: Global keyboard shortcuts now handled by TransportManager
    // No need for component-level spacebar handling

    return (
        <div className="prv5-container">
            <Toolbar
                snapValue={snapValue}
                onSnapChange={setSnapValue}
                activeTool={activeTool}
                onToolChange={handleToolChange}
                zoom={zoom}
                onZoomChange={handleZoomChange}
                selectedCount={noteInteractions.selectedNoteIds.size} // V2 Hook'dan
            />
            <div
                ref={containerRef}
                className="prv5-canvas-container"
                data-tool={activeTool}
                onWheel={engine.eventHandlers.onWheel}
                onMouseDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const isInRuler = y <= 30;
                    const isInGrid = x > 80 && y > 30;

                    if (isInRuler) {
                        engine.eventHandlers.onMouseDown?.(e);
                    } else if (isInGrid) {
                        noteInteractions.handleMouseDown(e);
                    }
                }}
                onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const isInRuler = y <= 30;
                    const isInGrid = x > 80 && y > 30;

                    if (isInRuler) {
                        engine.eventHandlers.onMouseMove?.(e);
                    } else if (isInGrid) {
                        noteInteractions.handleMouseMove(e);
                    }
                    // engine.eventHandlers.onMouseMove?.(e); // Bu satır viewport kaymasına neden oluyor
                }}
                onMouseUp={(e) => {
                    noteInteractions.handleMouseUp(e);
                    engine.eventHandlers.onMouseUp?.(e);
                }}
                onMouseLeave={(e) => {
                    noteInteractions.handleMouseUp(e);
                    engine.eventHandlers.onMouseLeave?.(e);
                }}
                onKeyDown={noteInteractions.handleKeyDown}
                onContextMenu={(e) => e.preventDefault()}
                tabIndex={0}
            >
                <canvas ref={canvasRef} className="prv5-canvas prv5-canvas-main" />
                <canvas ref={playheadCanvasRef} className="prv5-canvas prv5-canvas-playhead" />
                <div className="prv5-debug-overlay">
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: fps >= 55 ? '#00ff88' : fps >= 40 ? '#ffaa00' : '#ff4444'
                    }}>
                        FPS: {fps}
                    </div>
                    <div>Scroll: {Math.round(engine.viewport.scrollX)}, {Math.round(engine.viewport.scrollY)}</div>
                    <div>Zoom: {engine.viewport.zoomX.toFixed(2)}x, {engine.viewport.zoomY.toFixed(2)}y</div>
                    <div>LOD: {engine.lod} | Quality: <span style={{
                        color: qualityLevel === 'high' ? '#00ff88' : qualityLevel === 'medium' ? '#ffaa00' : '#ff4444',
                        fontWeight: 'bold'
                    }}>{qualityLevel.toUpperCase()}</span></div>
                    <div>Instrument: {currentInstrument ? `${currentInstrument.name} (${currentInstrument.type})` : 'None'}</div>
                    <div>Pattern: V2 ({noteInteractions.notes.length} notes)</div>
                    <div>Tool: {activeTool}</div>
                    {showPerf && (
                        <div style={{ marginTop: '8px', borderTop: '1px solid #444', paddingTop: '4px' }}>
                            <div>Min: {Math.round(performanceMonitor.metrics.minFps)} | Max: {Math.round(performanceMonitor.metrics.maxFps)}</div>
                            <div>Dropped: {performanceMonitor.metrics.droppedFrames}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* ✅ VELOCITY LANE */}
            <VelocityLane
                notes={noteInteractions.notes}
                selectedNoteIds={selectedNoteIdsArray}
                onNoteVelocityChange={handleNoteVelocityChange}
                dimensions={engine.dimensions}
                viewport={engine.viewport}
                activeTool={activeTool}
            />
        </div>
    );
}

export default PianoRoll;
