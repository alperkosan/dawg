import React, { useRef, useEffect, useState, useMemo } from 'react';
import { usePianoRollEngine } from './usePianoRollEngine';
import { useNoteInteractionsV2 } from './hooks/useNoteInteractionsV2';
import { useLoopRegionSelection } from './hooks/useLoopRegionSelection';
import { drawPianoRollStatic, drawPlayhead } from './renderer';
import { uiUpdateManager, UPDATE_PRIORITIES, UPDATE_FREQUENCIES } from '@/lib/core/UIUpdateManager';
import { performanceMonitor } from '@/utils/PerformanceMonitor';
import Toolbar from './components/Toolbar';
import VelocityLane from './components/VelocityLane';
import LoopRegionOverlay from './components/LoopRegionOverlay';
import ShortcutsPanel from './components/ShortcutsPanel';
import ContextMenu from './components/ContextMenu';
import { usePanelsStore } from '@/store/usePanelsStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { getTimelineController } from '@/lib/core/TimelineControllerSingleton';
import { getToolManager } from '@/lib/piano-roll-tools';
import { getTransportManagerSync } from '@/lib/core/TransportManagerSingleton';
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

    // ✅ LOOP REGION STATE
    const [loopRegion, setLoopRegion] = useState(null); // { start: step, end: step }

    // ✅ SHORTCUTS PANEL STATE
    const [showShortcuts, setShowShortcuts] = useState(false);

    // ✅ KEYBOARD PIANO MODE STATE
    const [keyboardPianoMode, setKeyboardPianoMode] = useState(false);
    const [keyboardPianoSettings, setKeyboardPianoSettings] = useState({
        baseOctave: 4, // C4 = MIDI 60
        scale: 'chromatic' // chromatic, major, minor, etc.
    });

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

    // ✅ NOTIFY TRANSPORT MANAGER and TOOL MANAGER when keyboard piano mode changes
    useEffect(() => {
        const transportManager = getTransportManagerSync();
        if (transportManager) {
            transportManager.setKeyboardPianoMode(keyboardPianoMode);
        }

        const toolManager = getToolManager();
        if (toolManager) {
            toolManager.setKeyboardPianoMode(keyboardPianoMode);
        }
    }, [keyboardPianoMode]);

    // ✅ KEYBOARD SHORTCUTS - Handle Alt + key for tools and ? for shortcuts panel
    useEffect(() => {
        const handleKeyDown = (e) => {
            // ✅ IGNORE ALL SHORTCUTS when keyboard piano mode is active
            if (keyboardPianoMode) {
                return;
            }

            // ? or H key: Toggle shortcuts panel (only if not in input field)
            if ((e.key === '?' || e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const target = e.target;
                if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                    setShowShortcuts(prev => !prev);
                    e.preventDefault();
                    return;
                }
            }

            const toolManager = getToolManager();
            toolManager.handleKeyPress(e);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [keyboardPianoMode]);

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

    // ✅ Setup PreviewManager for all instrument types
    useEffect(() => {
        if (!currentInstrument) return;

        // Use unified PreviewManager for all instrument types
        let cancelled = false;

        const setupPreview = async () => {
            try {
                const [{ getPreviewManager }, { AudioContextService }] = await Promise.all([
                    import('@/lib/audio/preview'),
                    import('@/lib/services/AudioContextService')
                ]);

                if (cancelled) return;

                const audioEngine = AudioContextService.getAudioEngine();
                if (audioEngine?.audioContext) {
                    const previewManager = getPreviewManager(audioEngine.audioContext);
                    await previewManager.setInstrument(currentInstrument); // ✅ AWAIT the async call

                    if (!cancelled) {
                        console.log('✅ Preview ready:', currentInstrument.name, `(${currentInstrument.type})`);
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to setup preview:', err);
                }
            }
        };

        setupPreview();

        return () => {
            cancelled = true;
        };
    }, [currentInstrument]);

    // ✅ LOOP REGION HOOK - Timeline selection
    const loopRegionHook = useLoopRegionSelection(engine, snapValue, loopRegion, setLoopRegion);

    // V2 Hook - Sade ve basit, ArrangementStore merkezli
    const noteInteractions = useNoteInteractionsV2(
        engine,
        activeTool,
        snapValue,
        currentInstrument,
        loopRegion, // ✅ Pass loop region for Ctrl+D sync
        keyboardPianoMode // ✅ Pass keyboard piano mode
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
            activeTool, // ✅ Pass active tool for visual feedback
            loopRegion // ✅ Pass loop region for timeline rendering
        };
        drawPianoRollStatic(ctx, engineWithData);

    }, [engine, snapValue, noteInteractions, qualityLevel, ghostPosition, activeTool, loopRegion]); // Added: loopRegion

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
            UPDATE_PRIORITIES.HIGH, // Important but can defer slightly
            UPDATE_FREQUENCIES.REALTIME // 60fps with frame budget protection
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

    // ✅ CONTEXT MENU OPERATIONS
    const contextMenuOperations = useMemo(() => ({
        onCut: () => {
            noteInteractions.cutNotes();
        },
        onCopy: () => {
            noteInteractions.copyNotes();
        },
        onPaste: () => {
            noteInteractions.pasteNotes();
        },
        onDelete: () => {
            if (noteInteractions.selectedNoteIds.size > 0) {
                noteInteractions.deleteNotes(Array.from(noteInteractions.selectedNoteIds));
            } else if (noteInteractions.contextMenuState?.noteId) {
                noteInteractions.deleteNotes([noteInteractions.contextMenuState.noteId]);
            }
        },
        onDuplicate: () => {
            // Trigger Ctrl+D behavior
            const event = new KeyboardEvent('keydown', {
                key: 'd',
                code: 'KeyD',
                ctrlKey: true,
                bubbles: true
            });
            document.dispatchEvent(event);
        },
        onGlue: () => {
            // TODO: Implement glue/merge notes
            console.log('Glue notes - not yet implemented');
        },
        onSplit: () => {
            // TODO: Implement split note at center
            console.log('Split note - not yet implemented');
        },
        onQuantize: () => {
            // Quantize selected notes to grid
            if (noteInteractions.selectedNoteIds.size === 0) return;

            const notesToQuantize = noteInteractions.notes.filter(n =>
                noteInteractions.selectedNoteIds.has(n.id)
            );

            notesToQuantize.forEach(note => {
                const quantizedTime = Math.round(note.startTime / snapValue) * snapValue;
                noteInteractions.updateNote(note.id, { startTime: quantizedTime });
            });

            console.log(`✨ Quantized ${notesToQuantize.length} notes to grid: ${snapValue}`);
        },
        onHumanize: () => {
            // Add subtle randomization to timing and velocity
            if (noteInteractions.selectedNoteIds.size === 0) return;

            const notesToHumanize = noteInteractions.notes.filter(n =>
                noteInteractions.selectedNoteIds.has(n.id)
            );

            notesToHumanize.forEach(note => {
                // ±5% timing variation
                const timingVariation = (Math.random() - 0.5) * 0.1 * snapValue;
                const newTime = Math.max(0, note.startTime + timingVariation);

                // ±10% velocity variation
                const velocityVariation = (Math.random() - 0.5) * 0.2;
                const newVelocity = Math.max(1, Math.min(127,
                    Math.round(note.velocity + velocityVariation * 127)
                ));

                noteInteractions.updateNote(note.id, {
                    startTime: newTime,
                    velocity: newVelocity
                });
            });

            console.log(`🎲 Humanized ${notesToHumanize.length} notes`);
        },
        onVelocityFadeIn: () => {
            // Linear fade in (0 to 100% velocity)
            if (noteInteractions.selectedNoteIds.size === 0) return;

            const notesToFade = noteInteractions.notes
                .filter(n => noteInteractions.selectedNoteIds.has(n.id))
                .sort((a, b) => a.startTime - b.startTime);

            const count = notesToFade.length;
            notesToFade.forEach((note, index) => {
                const ratio = index / Math.max(1, count - 1);
                const newVelocity = Math.round(20 + ratio * 107); // 20-127 range
                noteInteractions.updateNote(note.id, { velocity: newVelocity });
            });

            console.log(`📈 Applied fade in to ${count} notes`);
        },
        onVelocityFadeOut: () => {
            // Linear fade out (100% to 0 velocity)
            if (noteInteractions.selectedNoteIds.size === 0) return;

            const notesToFade = noteInteractions.notes
                .filter(n => noteInteractions.selectedNoteIds.has(n.id))
                .sort((a, b) => a.startTime - b.startTime);

            const count = notesToFade.length;
            notesToFade.forEach((note, index) => {
                const ratio = 1 - (index / Math.max(1, count - 1));
                const newVelocity = Math.round(20 + ratio * 107); // 127-20 range
                noteInteractions.updateNote(note.id, { velocity: newVelocity });
            });

            console.log(`📉 Applied fade out to ${count} notes`);
        },
        onVelocityNormalize: () => {
            // Normalize all velocities to 80% (100 in MIDI)
            if (noteInteractions.selectedNoteIds.size === 0) return;

            const notesToNormalize = noteInteractions.notes.filter(n =>
                noteInteractions.selectedNoteIds.has(n.id)
            );

            notesToNormalize.forEach(note => {
                noteInteractions.updateNote(note.id, { velocity: 100 });
            });

            console.log(`⚖️ Normalized ${notesToNormalize.length} notes to velocity 100`);
        }
    }), [noteInteractions, snapValue]);

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
                keyboardPianoMode={keyboardPianoMode}
                onKeyboardPianoModeChange={setKeyboardPianoMode}
                keyboardPianoSettings={keyboardPianoSettings}
                onKeyboardPianoSettingsChange={setKeyboardPianoSettings}
            />
            <div
                ref={containerRef}
                className="prv5-canvas-container"
                data-tool={activeTool}
                data-cursor={noteInteractions.cursorState}
                onWheel={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const isInGrid = x > 80 && y > 30;

                    // Check if wheel event should be handled by note interactions
                    if (isInGrid && noteInteractions.handleWheel) {
                        const handled = noteInteractions.handleWheel(e);
                        if (handled) {
                            // Event was handled by note interactions (e.g., velocity change)
                            // Don't pass to viewport scroll
                            return;
                        }
                    }

                    // Default: viewport scroll (only if note interactions didn't handle it)
                    if (engine.eventHandlers?.onWheel) {
                        engine.eventHandlers.onWheel(e);
                    }
                }}
                onMouseDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const isInRuler = y <= 30;
                    const isInGrid = x > 80 && y > 30;

                    if (isInRuler) {
                        // ✅ Try loop region selection first
                        const handled = loopRegionHook.handleRulerMouseDown(e);
                        if (!handled) {
                            engine.eventHandlers.onMouseDown?.(e);
                        }
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
                        // ✅ Handle loop region dragging
                        const handled = loopRegionHook.handleRulerMouseMove(e);
                        if (!handled) {
                            engine.eventHandlers.onMouseMove?.(e);
                        }
                    } else if (isInGrid) {
                        noteInteractions.handleMouseMove(e);
                    }
                    // engine.eventHandlers.onMouseMove?.(e); // Bu satır viewport kaymasına neden oluyor
                }}
                onMouseUp={(e) => {
                    loopRegionHook.handleRulerMouseUp();
                    noteInteractions.handleMouseUp(e);
                    engine.eventHandlers.onMouseUp?.(e);
                }}
                onMouseLeave={(e) => {
                    noteInteractions.handleMouseUp(e);
                    engine.eventHandlers.onMouseLeave?.(e);
                }}
                onKeyDown={(e) => {
                    // Escape: Clear loop region if exists, otherwise deselect notes
                    if (e.key === 'Escape' && loopRegion) {
                        loopRegionHook.clearLoopRegion();
                        e.stopPropagation();
                        return;
                    }
                    noteInteractions.handleKeyDown(e);
                }}
                onKeyUp={noteInteractions.handleKeyUp}
                onContextMenu={(e) => e.preventDefault()}
                tabIndex={0}
            >
                <canvas ref={canvasRef} className="prv5-canvas prv5-canvas-main" />
                <canvas ref={playheadCanvasRef} className="prv5-canvas prv5-canvas-playhead" />

                {/* ✅ LOOP REGION OVERLAY */}
                {loopRegion && (
                    <LoopRegionOverlay
                        loopRegion={loopRegion}
                        dimensions={engine.dimensions}
                        viewport={engine.viewport}
                    />
                )}

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
                onNoteSelect={noteInteractions.selectNote}
                onDeselectAll={noteInteractions.deselectAll}
                dimensions={engine.dimensions}
                viewport={engine.viewport}
                activeTool={activeTool}
            />

            {/* ✅ SHORTCUTS PANEL */}
            <ShortcutsPanel
                isOpen={showShortcuts}
                onClose={() => setShowShortcuts(false)}
            />

            {/* ✅ CONTEXT MENU */}
            {noteInteractions.contextMenuState && (
                <ContextMenu
                    x={noteInteractions.contextMenuState.x}
                    y={noteInteractions.contextMenuState.y}
                    noteId={noteInteractions.contextMenuState.noteId}
                    hasSelection={noteInteractions.selectedNoteIds.size > 0}
                    canUndo={noteInteractions.canUndo}
                    canRedo={noteInteractions.canRedo}
                    onClose={noteInteractions.clearContextMenu}
                    {...contextMenuOperations}
                />
            )}
        </div>
    );
}

export default PianoRoll;
