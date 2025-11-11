import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { usePianoRollEngine } from './usePianoRollEngine';
import { useNoteInteractionsV2 } from './hooks/useNoteInteractionsV2';
import { useLoopRegionSelection } from './hooks/useLoopRegionSelection';
import { drawPianoRollStatic, drawPlayhead } from './renderer';
import { uiUpdateManager, UPDATE_PRIORITIES, UPDATE_FREQUENCIES } from '@/lib/core/UIUpdateManager';
import { performanceMonitor } from '@/utils/PerformanceMonitor';
import Toolbar from './components/Toolbar';
import VelocityLane from './components/VelocityLane';
import CCLanes from './components/CCLanes';
import NotePropertiesPanel from './components/NotePropertiesPanel';
import LoopRegionOverlay from './components/LoopRegionOverlay';
import ShortcutsPanel from './components/ShortcutsPanel';
import ContextMenu from './components/ContextMenu';
import ScaleSelectorPanel from './components/ScaleSelectorPanel';
import { usePanelsStore } from '@/store/usePanelsStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { useArrangementStore } from '@/store/useArrangementStore';
import { AutomationLane } from './types/AutomationLane';
import { getTimelineController } from '@/lib/core/TimelineControllerSingleton';
import { getToolManager } from '@/lib/piano-roll-tools';
import { getTransportManagerSync } from '@/lib/core/TransportManagerSingleton';
import { getAutomationManager } from '@/lib/automation/AutomationManager';
import EventBus from '@/lib/core/EventBus.js';
// ✅ NEW CURSOR SYSTEMS
import { PianoRollCursorManager, CURSOR_MANAGER_MODES, CURSOR_SOURCES, CURSOR_STATES } from './interaction';
// ✅ NEW TIMELINE SYSTEM
import { useTimelineStore } from '@/stores/TimelineStore';
import TimelineCoordinateSystem from '@/lib/timeline/TimelineCoordinateSystem';
import TimelineRenderer from './renderers/timelineRenderer';
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
    const followPlayheadMode = usePlaybackStore(state => state.followPlayheadMode);

    // Pass transport position setter to engine for timeline interaction
    const { snapValue, setSnapValue, ...engine } = usePianoRollEngine(containerRef, {
        setTransportPosition
    });

    // ✅ Store engine ref for avoiding stale closure (used by timeline and playhead)
    const engineRef = useRef(engine);
    useEffect(() => {
        engineRef.current = engine;
    }, [engine]);

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

    // ✅ PHASE 2: CC LANES STATE
    const [ccLanes, setCCLanes] = useState([]);
    const [showCCLanes, setShowCCLanes] = useState(false);
    
    // ✅ PHASE 2: NOTE PROPERTIES PANEL STATE
    const [showNoteProperties, setShowNoteProperties] = useState(false);
    const [propertiesPanelCollapsed, setPropertiesPanelCollapsed] = useState(false);

    // ✅ PHASE 5: SCALE HIGHLIGHTING STATE
    const [showScaleSelector, setShowScaleSelector] = useState(false);
    const [scaleHighlight, setScaleHighlight] = useState(null);

    // ✅ PHASE 5: Scale change callback
    const handleScaleChange = useCallback((scaleData) => {
        setScaleHighlight(scaleData.scaleSystem);
    }, []);

    // ✅ Listen for double-click events to open Note Properties Panel
    useEffect(() => {
        const handleOpenNoteProperties = () => {
            setShowNoteProperties(true);
            setPropertiesPanelCollapsed(false);
        };
        
        EventBus.on('pianoRoll:openNoteProperties', handleOpenNoteProperties);
        return () => EventBus.off('pianoRoll:openNoteProperties', handleOpenNoteProperties);
    }, []);

    // ✅ KEYBOARD PIANO MODE STATE
    const [keyboardPianoMode, setKeyboardPianoMode] = useState(false);
    const [keyboardPianoSettings, setKeyboardPianoSettings] = useState({
        baseOctave: 4, // C4 = MIDI 60
        scale: 'chromatic' // chromatic, major, minor, etc.
    });

    // ✅ CURSOR MANAGER STATE
    const [cursorManager, setCursorManager] = useState(null);

    // ✅ TIMELINE SYSTEM STATE
    const timelineStore = useTimelineStore();
    const [timelineCoordinateSystem, setTimelineCoordinateSystem] = useState(null);
    const [timelineRenderer, setTimelineRenderer] = useState(null);

    // ✅ TIMELINE SYSTEM - Initialize timeline infrastructure
    useEffect(() => {
        const coordinateSystem = new TimelineCoordinateSystem(useTimelineStore);
        const renderer = new TimelineRenderer(useTimelineStore, coordinateSystem);

        setTimelineCoordinateSystem(coordinateSystem);
        setTimelineRenderer(renderer);

        // Initialize with default time signature and tempo
        // (already set in TimelineStore defaults)

        console.log('🎵 Timeline System initialized');

        return () => {
            // Cleanup if needed
            coordinateSystem.clearCache();
        };
    }, []);

    // ✅ PHASE 1: Follow Playhead Mode - Auto-scroll during playback
    const userInteractionRef = useRef(false);

    useEffect(() => {
        // Early exits
        if (!isPlaying || followPlayheadMode === 'OFF') return;
        if (userInteractionRef.current) return;
        if (!engine.viewport || !engine.dimensions || !engine.eventHandlers?.updateViewport) return;

        const playheadX = currentStep * engine.dimensions.stepWidth;
        const threshold = engine.viewport.width * 0.8;

        if (followPlayheadMode === 'CONTINUOUS') {
            // Keep playhead centered in viewport
            const targetScrollX = playheadX - (engine.viewport.width / 2);
            const diff = Math.abs(engine.viewport.scrollX - targetScrollX);

            // Use instant scroll with higher threshold to reduce jitter
            // Threshold of 100px gives smooth following without constant micro-adjustments
            if (diff > 100) {
                const newScrollX = Math.max(0, targetScrollX);
                engine.eventHandlers.updateViewport({ scrollX: newScrollX, smooth: false });
            }
        } else if (followPlayheadMode === 'PAGE') {
            // Jump to next page when playhead reaches 80% of viewport width
            if (playheadX > engine.viewport.scrollX + threshold) {
                const newScrollX = engine.viewport.scrollX + engine.viewport.width;
                // Page jumps should be instant for clear visual feedback
                engine.eventHandlers.updateViewport({ scrollX: newScrollX, smooth: false });
            }
        }
        // ✅ FIX: Only depend on values that should trigger scroll, not the entire engine objects
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStep, isPlaying, followPlayheadMode]);

    // Track user interaction to pause follow mode temporarily
    useEffect(() => {
        const handleUserScroll = () => {
            userInteractionRef.current = true;
            const timer = setTimeout(() => {
                userInteractionRef.current = false;
            }, 2000);
            return () => clearTimeout(timer);
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener('wheel', handleUserScroll);
            container.addEventListener('mousedown', handleUserScroll);
            return () => {
                container.removeEventListener('wheel', handleUserScroll);
                container.removeEventListener('mousedown', handleUserScroll);
            };
        }
    }, []);

    // ✅ CURSOR MANAGER - Initialize cursor management system
    useEffect(() => {
        const manager = new PianoRollCursorManager({
            mode: CURSOR_MANAGER_MODES.AUTOMATIC,
            preferredSystem: CURSOR_SOURCES.PREMIUM,
            fallbackSystem: CURSOR_SOURCES.CSS,
            pianoRollSelector: '.prv5-canvas-container',
            integration: {
                enabled: true,
                autoDetect: true,
                conflictResolution: true,
                performanceOptimization: true
            },
            cursorMapping: {
                'select': 'select-premium',
                'paintBrush': 'paint-premium',
                'eraser': 'erase-premium',
                'slice': 'slice-premium',
                'slide': 'slide-premium',
                'hover': 'select-premium',
                'active': 'select-premium',
                'resizing': 'resize-both-premium',
                'moving': 'move-premium',
                'grabbing': 'grabbing-premium'
            }
        });

        setCursorManager(manager);

        return () => {
            if (manager) {
                manager.destroy();
            }
        };
    }, []);

    // ✅ TOOL MANAGER - Subscribe to tool changes
    useEffect(() => {
        const toolManager = getToolManager();

        // Set initial tool
        setActiveTool(toolManager.getActiveTool());

        // Subscribe to tool changes
        const unsubscribe = toolManager.subscribe((toolType) => {
            setActiveTool(toolType);
            
            // ✅ Update cursor when tool changes
            if (cursorManager) {
                const cursorMap = {
                    'select': 'select-premium',
                    'paintBrush': 'paint-premium',
                    'eraser': 'erase-premium',
                    'slice': 'slice-premium',
                    'slide': 'slide-premium'
                };
                const premiumCursor = cursorMap[toolType] || 'select-premium';
                cursorManager.setCursor(premiumCursor, { source: CURSOR_SOURCES.SYSTEM });
            }
        });

        return unsubscribe;
    }, [cursorManager]);

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
                    // ✅ FX CHAIN: Pass audioEngine to PreviewManager for mixer routing
                    const previewManager = getPreviewManager(audioEngine.audioContext, audioEngine);
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

    // ✅ CURSOR INTEGRATION - Connect note interactions cursor to cursor manager
    useEffect(() => {
        if (!cursorManager || !noteInteractions.cursorState) {
            return; // Skip if manager not ready or no cursor state
        }
        
        // Map note interactions cursor state to premium cursor
        const cursorMap = {
            'default': 'select-premium',
            'select': 'select-premium',
            'paint': 'paint-premium',
            'paintBrush': 'paint-premium',
            'erase': 'erase-premium',
            'eraser': 'erase-premium',
            'slice': 'slice-premium',
            'slide': 'slide-premium',
            'move': 'multi-move-premium',
            'grab': 'multi-select-premium',
            'grabbing': 'multi-move-premium',
            'resize-left': 'resize-left-premium',
            'resize-right': 'resize-right-premium',
            'resize-both': 'resize-both-premium',
            'ew-resize': 'resize-both-premium',
            'crosshair': 'paint-premium',
            'not-allowed': 'erase-premium'
        };

        const premiumCursor = cursorMap[noteInteractions.cursorState];
        if (premiumCursor) {
            cursorManager.setCursor(premiumCursor, { source: CURSOR_SOURCES.DIRECT });
        }
    }, [cursorManager, noteInteractions.cursorState]);

    // ✅ REGISTER PIANO ROLL TIMELINE with TimelineController
    // Note: engineRef is defined later in the file and used here via closure
    useEffect(() => {
        if (!containerRef.current || !engine.dimensions.stepWidth) return;

        try {
            const timelineController = getTimelineController();

            // Calculate ruler element bounds (top 30px of container)
            const RULER_HEIGHT = 30;
            const KEYBOARD_WIDTH = 80;

            // ✅ Custom position calculation for piano roll (accounts for scroll/zoom)
            // Use engineRef to always get the LATEST engine state (avoid stale closure)
            const calculatePosition = (mouseX, mouseY) => {
                // Only handle clicks in timeline ruler area
                if (mouseY > RULER_HEIGHT) {
                    return null; // Not in ruler
                }

                // Subtract keyboard width
                const canvasX = mouseX - KEYBOARD_WIDTH;
                if (canvasX < 0) {
                    return null; // In keyboard area
                }

                // ✅ CRITICAL FIX: Use engineRef.current to get LATEST engine state
                const currentEngine = engineRef.current;
                const viewport = currentEngine.viewport;
                const dimensions = currentEngine.dimensions;
                if (!viewport || !dimensions) return null;

                // ✅ CRITICAL FIX: Convert canvas coordinates to world coordinates
                // scrollX is already in world pixel space, canvasX is in screen pixel space
                // We need to add scrollX (which is in world space) to canvasX (screen space)
                const worldX = viewport.scrollX + canvasX;

                // ✅ IMPORTANT: dimensions.stepWidth is the RENDERED step width (already includes zoom)
                // It's updated by the engine's render loop based on viewport.zoomX
                // So we DON'T multiply by zoomX again - that would apply zoom twice!
                const stepWidth = dimensions.stepWidth;

                // Convert world pixels to steps
                const step = Math.floor(worldX / stepWidth);

                return Math.max(0, Math.min(dimensions.totalSteps - 1, step));
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
            isSelectingTimeRange: noteInteractions.isSelectingTimeRange, // ✅ Time-based selection state
            timeRangeSelection: noteInteractions.timeRangeSelection, // ✅ Time range selection data
            previewNote: noteInteractions.previewNote,
            slicePreview: noteInteractions.slicePreview,
            sliceRange: noteInteractions.sliceRange,
            qualityLevel, // Pass quality level to renderer
            ghostPosition, // ✅ Pass ghost position for hover preview
            activeTool, // ✅ Pass active tool for visual feedback
            loopRegion, // ✅ Pass loop region for timeline rendering
            dragState: noteInteractions.dragState, // ✅ Pass dragState for visual feedback during drag
            scaleHighlight // ✅ PHASE 5: Pass scale highlighting system
        };
        drawPianoRollStatic(ctx, engineWithData);

        // ✅ NEW: Render timeline system (time signatures, tempo, markers, loop regions)
        if (timelineRenderer) {
            timelineRenderer.render(ctx, engineWithData);
        }

    }, [engine, snapValue, noteInteractions, qualityLevel, ghostPosition, activeTool, loopRegion, noteInteractions.isSelectingTimeRange, noteInteractions.timeRangeSelection, timelineRenderer, scaleHighlight]); // Added: time-based selection + timelineRenderer + scale highlight

    // Playhead canvas - fast rendering via UIUpdateManager (uses engineRef from top of component)
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

    // ✅ PHASE 2: CC LANES HANDLERS
    const activePatternId = useArrangementStore(state => state.activePatternId);
    
    // ✅ PHASE 4: Initialize CC lanes from AutomationManager (per pattern + instrument)
    useEffect(() => {
        if (!activePatternId || !currentInstrument) {
            setCCLanes([]);
            return;
        }

        const automationManager = getAutomationManager();

        // Get lanes from AutomationManager (pattern + instrument specific)
        let lanes = automationManager.getLanes(activePatternId, currentInstrument.id);

        // If no lanes exist, create defaults
        if (lanes.length === 0) {
            const defaultLanes = [
                new AutomationLane(7, 'Volume'),      // CC7 - Essential mixing control
                new AutomationLane(10, 'Pan'),        // CC10 - Essential mixing control
                new AutomationLane(1, 'Mod Wheel'),   // CC1 - Common modulation
                new AutomationLane('pitchBend', 'Pitch Bend'),
                new AutomationLane('aftertouch', 'Aftertouch')
            ];

            // Save to AutomationManager
            automationManager.setLanes(activePatternId, currentInstrument.id, defaultLanes);
            lanes = defaultLanes;
        }

        setCCLanes(lanes);
    }, [activePatternId, currentInstrument]);

    // ✅ PHASE 4: Sync with AutomationManager - Listen for lane changes from Instrument Editor
    useEffect(() => {
        if (!activePatternId || !currentInstrument) return;

        const automationManager = getAutomationManager();

        // Subscribe to automation manager events
        const unsubscribe = automationManager.subscribe((event) => {
            // Only update if this is for the current pattern/instrument
            const currentKey = automationManager.getLaneKey(activePatternId, currentInstrument.id);

            // Check if event is for current pattern/instrument
            const eventPatternId = event.patternId || activePatternId;
            const eventInstrumentId = event.instrumentId || currentInstrument.id;
            const eventKey = automationManager.getLaneKey(eventPatternId, eventInstrumentId);

            if (eventKey !== currentKey) return;

            // Sync ccLanes with AutomationManager
            const managerLanes = automationManager.getLanes(activePatternId, currentInstrument.id);
            setCCLanes(managerLanes);
        });

        return unsubscribe;
    }, [activePatternId, currentInstrument]);

    const handleCCLanePointAdd = useCallback((ccNumber, time, value) => {
        if (!activePatternId || !currentInstrument) return;

        const automationManager = getAutomationManager();

        setCCLanes(prevLanes => {
            const updatedLanes = prevLanes.map(lane => {
                if (lane.ccNumber === ccNumber) {
                    const newLane = lane.clone();
                    newLane.addPoint(time, value);
                    return newLane;
                }
                return lane;
            });

            // ✅ PHASE 4: Save to AutomationManager (pattern + instrument specific)
            automationManager.setLanes(activePatternId, currentInstrument.id, updatedLanes);

            return updatedLanes;
        });
    }, [activePatternId, currentInstrument]);

    const handleCCLanePointRemove = useCallback((ccNumber, pointIndex) => {
        if (!activePatternId || !currentInstrument) return;

        const automationManager = getAutomationManager();

        setCCLanes(prevLanes => {
            const updatedLanes = prevLanes.map(lane => {
                if (lane.ccNumber === ccNumber) {
                    const newLane = lane.clone();
                    newLane.removePoint(pointIndex);
                    return newLane;
                }
                return lane;
            });

            // ✅ PHASE 4: Save to AutomationManager (pattern + instrument specific)
            automationManager.setLanes(activePatternId, currentInstrument.id, updatedLanes);

            return updatedLanes;
        });
    }, [activePatternId, currentInstrument]);

    const handleCCLanePointUpdate = useCallback((ccNumber, pointIndex, updates) => {
        if (!activePatternId || !currentInstrument) return;

        const automationManager = getAutomationManager();

        setCCLanes(prevLanes => {
            const updatedLanes = prevLanes.map(lane => {
                if (lane.ccNumber === ccNumber) {
                    const newLane = lane.clone();
                    newLane.updatePoint(pointIndex, updates);
                    return newLane;
                }
                return lane;
            });

            // ✅ PHASE 4: Save to AutomationManager (pattern + instrument specific)
            automationManager.setLanes(activePatternId, currentInstrument.id, updatedLanes);

            return updatedLanes;
        });
    }, [activePatternId, currentInstrument]);

    // ✅ PHASE 4: Handle scroll from CC Lanes to sync Piano Roll viewport
    const handleCCLanesScroll = useCallback((deltaX, deltaY) => {
        const currentEngine = engineRef.current;
        if (!currentEngine) return;

        // Update viewport scroll (horizontal scroll from vertical wheel)
        const scrollSpeed = 1.0;
        const newScrollX = Math.max(0, currentEngine.viewport.scrollX + (deltaY * scrollSpeed));

        currentEngine.viewport.scrollX = newScrollX;
        currentEngine.viewport.targetScrollX = newScrollX;

        // Force re-render
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx && currentEngine.notes && currentEngine.dimensions) {
                drawPianoRollStatic(ctx, {
                    ...currentEngine,
                    notes: currentEngine.notes
                }, currentEngine.dimensions);
            }
        }
    }, []);

    // ✅ PHASE 2: NOTE PROPERTIES HANDLERS
    // ✅ FIX: Calculate selectedNote on every render to ensure it updates when notes change
    // Don't use useMemo here - we want it to recalculate whenever notes array changes
    const selectedNote = (() => {
        if (noteInteractions.selectedNoteIds.size === 1) {
            const noteId = Array.from(noteInteractions.selectedNoteIds)[0];
            const note = noteInteractions.notes.find(n => n.id === noteId);
            return note || null;
        }
        return null;
    })();

    const handleNotePropertyChange = useCallback((property, value) => {
        if (!selectedNote) return;
        
        // Update via note interactions
        const updates = { [property]: value };
        noteInteractions.updateNote?.(selectedNote.id, updates);
    }, [selectedNote, noteInteractions]);

    // Memoize selectedNoteIds array to prevent VelocityLane re-renders
    const selectedNoteIdsArray = useMemo(
        () => Array.from(noteInteractions.selectedNoteIds),
        [noteInteractions.selectedNoteIds]
    );

    // ✅ CLEANUP - Cleanup cursor manager on unmount
    useEffect(() => {
        return () => {
            if (cursorManager) {
                cursorManager.destroy();
            }
        };
    }, [cursorManager]);

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
                // ✅ PHASE 2: CC Lanes & Note Properties
                showCCLanes={showCCLanes}
                onShowCCLanesChange={setShowCCLanes}
                showNoteProperties={showNoteProperties}
                onShowNotePropertiesChange={setShowNoteProperties}
                // ✅ PHASE 5: Scale Selector
                showScaleSelector={showScaleSelector}
                onShowScaleSelectorChange={setShowScaleSelector}
            />
            <div
                ref={containerRef}
                className="prv5-canvas-container"
                data-tool={activeTool}
                // ✅ data-cursor removed - now handled by cursor manager
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
                        // ✅ Shift+drag: Time-based selection (select all notes in time range)
                        // Normal drag: Loop region selection
                        if (e.shiftKey) {
                            // Time-based selection - handled by noteInteractions
                            noteInteractions.handleRulerMouseDown?.(e);
                        } else {
                            // Loop region selection
                            const handled = loopRegionHook.handleRulerMouseDown(e);
                            if (!handled) {
                                engine.eventHandlers.onMouseDown?.(e);
                            }
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
                        // ✅ Shift+drag: Time-based selection
                        if (e.shiftKey) {
                            noteInteractions.handleRulerMouseMove?.(e);
                        } else {
                            // Loop region dragging
                            const handled = loopRegionHook.handleRulerMouseMove(e);
                            if (!handled) {
                                engine.eventHandlers.onMouseMove?.(e);
                            }
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

            {/* ✅ PHASE 2: CC LANES */}
            {showCCLanes && ccLanes.length > 0 && (
                <CCLanes
                    lanes={ccLanes}
                    selectedNoteIds={selectedNoteIdsArray}
                    onLaneChange={(laneId, lane) => {
                        // Handle lane change if needed
                    }}
                    onPointAdd={handleCCLanePointAdd}
                    onPointRemove={handleCCLanePointRemove}
                    onPointUpdate={handleCCLanePointUpdate}
                    onScroll={handleCCLanesScroll}
                    dimensions={engineRef.current.dimensions}
                    viewport={engineRef.current.viewport}
                    activeTool={activeTool}
                    snapValue={snapValue}
                />
            )}

            {/* ✅ PHASE 2: NOTE PROPERTIES PANEL */}
            {showNoteProperties && (
                <NotePropertiesPanel
                    selectedNote={selectedNote}
                    onPropertyChange={handleNotePropertyChange}
                    collapsed={propertiesPanelCollapsed}
                    onToggleCollapse={() => setPropertiesPanelCollapsed(prev => !prev)}
                    allNotes={noteInteractions.notes} // ✅ FL Studio: Need all notes to find next note for slide target
                />
            )}

            {/* ✅ PHASE 5: SCALE SELECTOR PANEL */}
            {showScaleSelector && (
                <ScaleSelectorPanel
                    onChange={handleScaleChange}
                />
            )}

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
