import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { usePianoRollEngine } from './usePianoRollEngine';
// import { useNoteInteractionsV2 } from './hooks/useNoteInteractionsV2'; // ✅ V2 DEPRECATED
import { useNoteInteractionsV3 } from './hooks/useNoteInteractionsV3'; // ✅ V3 ACTIVE
import { useLoopRegionSelection } from './hooks/useLoopRegionSelection';
import { drawPianoRollBackground, drawPianoRollForeground, drawPlayhead } from './renderer';
import { uiUpdateManager, UPDATE_PRIORITIES, UPDATE_FREQUENCIES } from '@/lib/core/UIUpdateManager';
import { performanceMonitor } from '@/utils/PerformanceMonitor';
import Toolbar from './components/Toolbar';
import VelocityLane, { VELOCITY_TOOL_TYPES } from './components/VelocityLane';
import CCLanes from './components/CCLanes';
import NotePropertiesPanel from './components/NotePropertiesPanel';
import LoopRegionOverlay from './components/LoopRegionOverlay';
import ShortcutsPanel from './components/ShortcutsPanel';
import ContextMenu from './components/ContextMenu';
// Removed: ScaleSelectorPanel - scale highlighting is now always enabled with default C Major
import { usePanelsStore } from '@/store/usePanelsStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { useArrangementStore } from '@/store/useArrangementStore';
import { AutomationLane } from './types/AutomationLane';
import { getTimelineController } from '@/lib/core/TimelineControllerSingleton';
import { getToolManager } from '@/features/piano_roll_v7/lib/tools';
import { getTransportManagerSync } from '@/lib/core/TransportManagerSingleton';
import { getAutomationManager } from '@/lib/automation/AutomationManager';
import { getScaleSystem } from '@/lib/music/ScaleSystem';
import EventBus from '@/lib/core/EventBus.js';
import { getPreviewManager } from '@/lib/audio/preview';
import { PANEL_IDS } from '@/config/constants';
import { useMidiRecording } from './hooks/useMidiRecording';
import { MIDIRecorder } from '@/lib/midi/MIDIRecorder';
import { CountInOverlay } from '@/components/midi/CountInOverlay';
import { AudioContextService } from '@/lib/services/AudioContextService';
// ✅ REMOVED: Complex cursor manager - using simple CSS cursors now
// ✅ NEW TIMELINE SYSTEM
import { useTimelineStore } from '@/store/TimelineStore';
import TimelineCoordinateSystem from '@/lib/timeline/TimelineCoordinateSystem';
import TimelineRenderer from './renderers/timelineRenderer';
import { STEPS_PER_BEAT } from '@/lib/audio/audioRenderConfig';
import './PianoRoll_v5.css';

const KEYBOARD_WIDTH = 80;
const RULER_HEIGHT = 30;

/**
 * Convert steps to BBT format (Bar:Beat:Tick)
 * @param {number} steps - Position in steps
 * @param {number} stepsPerBeat - Steps per beat (default: STEPS_PER_BEAT)
 * @returns {string} BBT format string (e.g., "1:2:120")
 */
function stepsToBBT(steps, stepsPerBeat = STEPS_PER_BEAT) {
    const beats = steps / stepsPerBeat;
    const bar = Math.floor(beats / 4) + 1; // 4/4 time signature
    const beat = (Math.floor(beats) % 4) + 1;
    const tick = Math.floor((beats % 1) * 480); // 480 ticks per beat (PPQ * 4)
    return `${bar}:${beat}:${tick}`;
}

const resizeCanvasToDisplay = (canvas, ctx) => {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    const scaledWidth = width * dpr;
    const scaledHeight = height * dpr;

    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
};

const clampRectToViewport = (rect, viewportWidth, viewportHeight) => {
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;

    const x = Math.max(0, rect.x);
    const y = Math.max(0, rect.y);
    const right = Math.min(viewportWidth, rect.x + rect.width);
    const bottom = Math.min(viewportHeight, rect.y + rect.height);

    if (right <= x || bottom <= y) return null;

    return {
        x,
        y,
        width: right - x,
        height: bottom - y
    };
};

const expandRect = (rect, padding = 12) => ({
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2
});

const clearCanvasRef = (canvasRef) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
};

const noteToScreenRect = (note, viewport, dimensions) => {
    if (!note || !dimensions?.stepWidth || !dimensions?.keyHeight || !viewport) return null;

    const stepWidth = dimensions.stepWidth;
    const keyHeight = dimensions.keyHeight;
    const scrollX = viewport.scrollX || 0;
    const scrollY = viewport.scrollY || 0;
    const startTime = note.startTime ?? 0;
    const pitch = note.pitch ?? 0;
    const visualLength = note.visualLength ?? note.length ?? 0.25;

    const x = KEYBOARD_WIDTH + (startTime * stepWidth - scrollX);
    const y = RULER_HEIGHT + ((127 - pitch) * keyHeight - scrollY);
    const width = Math.max(1, visualLength * stepWidth);
    const height = Math.max(1, keyHeight);

    return { x, y, width, height };
};

const computeDragDirtyRegion = (dragState, viewport, dimensions, notesById, snapValue) => {
    if (!dragState || !dragState.noteIds || dragState.noteIds.length === 0) return null;
    if (!viewport || !dimensions || !notesById) return null;

    const rects = [];
    const { noteIds, originalNotes, currentDelta = {}, resizeHandle } = dragState;
    const deltaTime = currentDelta.deltaTime || 0;
    const deltaPitch = currentDelta.deltaPitch || 0;
    const snap = typeof snapValue === 'number' && snapValue > 0 ? snapValue : null;

    const getBaseNote = (noteId) => {
        const live = notesById.get(noteId);
        const original = originalNotes?.get(noteId);
        if (!live && !original) return null;
        return {
            startTime: original?.startTime ?? live?.startTime ?? 0,
            pitch: original?.pitch ?? live?.pitch ?? 0,
            length: original?.length ?? live?.length ?? 0.25,
            visualLength: original?.visualLength ?? live?.visualLength ?? original?.length ?? live?.length ?? 0.25
        };
    };

    noteIds.forEach(noteId => {
        const base = getBaseNote(noteId);
        if (!base) return;

        rects.push(noteToScreenRect(base, viewport, dimensions));

        const mutated = { ...base };
        if (dragState.type === 'moving') {
            let newStart = base.startTime + deltaTime;
            if (snap) {
                newStart = Math.round(newStart / snap) * snap;
            }
            mutated.startTime = Math.max(0, newStart);
            mutated.pitch = Math.max(0, Math.min(127, base.pitch + deltaPitch));
        } else if (dragState.type === 'resizing') {
            const minLength = snap || 0.25;
            const originalEnd = base.startTime + (base.visualLength || base.length);

            if (resizeHandle === 'left') {
                let newStart = base.startTime + deltaTime;
                if (snap) newStart = Math.round(newStart / snap) * snap;
                newStart = Math.max(0, newStart);
                const newLength = Math.max(minLength, originalEnd - newStart);
                mutated.startTime = newStart;
                mutated.visualLength = newLength;
                mutated.length = newLength;
            } else {
                let newEnd = originalEnd + deltaTime;
                if (snap) newEnd = Math.round(newEnd / snap) * snap;
                const newLength = Math.max(minLength, newEnd - base.startTime);
                mutated.visualLength = newLength;
                mutated.length = newLength;
            }
        }

        rects.push(noteToScreenRect(mutated, viewport, dimensions));
    });

    const filtered = rects.filter(Boolean);
    if (!filtered.length) return null;

    const union = filtered.reduce(
        (acc, rect) => ({
            minX: Math.min(acc.minX, rect.x),
            minY: Math.min(acc.minY, rect.y),
            maxX: Math.max(acc.maxX, rect.x + rect.width),
            maxY: Math.max(acc.maxY, rect.y + rect.height)
        }),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );

    if (!isFinite(union.minX) || !isFinite(union.minY) || !isFinite(union.maxX) || !isFinite(union.maxY)) {
        return null;
    }

    const padded = expandRect({
        x: union.minX,
        y: union.minY,
        width: union.maxX - union.minX,
        height: union.maxY - union.minY
    }, 24);

    return clampRectToViewport(padded, viewport.width, viewport.height);
};

const selectPianoRollVisibility = (state) => {
    const panel = state.panels?.[PANEL_IDS.PIANO_ROLL];
    if (!panel) return true;
    const isOpen = panel.isOpen && !panel.isMinimized;
    if (!isOpen) return false;
    if (state.fullscreenPanel && state.fullscreenPanel !== PANEL_IDS.PIANO_ROLL) {
        return false;
    }
    return true;
};

function PianoRoll({ isVisible: panelVisibleProp = true }) {
    const containerRef = useRef(null);
    const gridCanvasRef = useRef(null);
    const notesCanvasRef = useRef(null);
    const playheadCanvasRef = useRef(null); // NEW: Separate playhead layer
    const backgroundDirtyRef = useRef(true);
    const notesDirtyRef = useRef(true);
    const notesDirtyRegionRef = useRef(null);

    const markBackgroundDirty = useCallback(() => {
        backgroundDirtyRef.current = true;
    }, []);

    const markNotesDirty = useCallback((clipRegion) => {
        if (!clipRegion) {
            notesDirtyRegionRef.current = null;
        } else if (!notesDirtyRegionRef.current) {
            notesDirtyRegionRef.current = { ...clipRegion };
        } else {
            const current = notesDirtyRegionRef.current;
            const minX = Math.min(current.x, clipRegion.x);
            const minY = Math.min(current.y, clipRegion.y);
            const maxX = Math.max(current.x + current.width, clipRegion.x + clipRegion.width);
            const maxY = Math.max(current.y + current.height, clipRegion.y + clipRegion.height);
            notesDirtyRegionRef.current = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
        }
        notesDirtyRef.current = true;
    }, []);

    // ✅ UNIFIED TRANSPORT SYSTEM - Get playback controls first
    const togglePlayPause = usePlaybackStore(state => state.togglePlayPause);
    const playbackMode = usePlaybackStore(state => state.playbackMode);
    const isPlaying = usePlaybackStore(state => state.isPlaying);
    const playbackState = usePlaybackStore(state => state.playbackState);
    const currentStep = usePlaybackStore(state => state.currentStep);
    const setTransportPosition = usePlaybackStore(state => state.setTransportPosition);
    const followPlayheadMode = usePlaybackStore(state => state.followPlayheadMode);
    const bpm = usePlaybackStore(state => state.bpm);

    // Pass transport position setter to engine for timeline interaction
    const { snapValue, setSnapValue, ...engine } = usePianoRollEngine(containerRef, {
        setTransportPosition
    });

    // ✅ Store engine ref for avoiding stale closure (used by timeline and playhead)
    const engineRef = useRef(engine);
    useEffect(() => {
        engineRef.current = engine;
        markBackgroundDirty();
        markNotesDirty();
    }, [engine, markBackgroundDirty, markNotesDirty]);

    const requestViewportUpdate = useCallback((values) => {
        const engineInstance = engineRef.current;
        if (!engineInstance?.eventHandlers?.updateViewport) return;
        engineInstance.eventHandlers.updateViewport(values);
    }, []);

    // Toolbar state
    // ✅ FIX: Default to paintBrush for better workflow (users typically want to write notes immediately)
    const [activeTool, setActiveTool] = useState('paintBrush');
    const [zoom, setZoom] = useState(1.0);

    // ✅ PHASE 1: Velocity lane tool state
    const [velocityTool, setVelocityTool] = useState(VELOCITY_TOOL_TYPES.SELECT);
    const [velocityBrushSize, setVelocityBrushSize] = useState(2); // Brush size in steps

    // Performance monitoring
    const [fps, setFps] = useState(60);
    const [showPerf, setShowPerf] = useState(false);
    const [qualityLevel, setQualityLevel] = useState('high');

    // ✅ GHOST PLAYHEAD STATE
    const [ghostPosition, setGhostPosition] = useState(null);

    // Get data from persistent stores
    const pianoRollInstrumentId = usePanelsStore(state => state.pianoRollInstrumentId);
    const storeVisibility = usePanelsStore(selectPianoRollVisibility);
    const isPianoRollVisible = panelVisibleProp && storeVisibility;
    const instruments = useInstrumentsStore(state => state.instruments);
    const arrangementStore = useArrangementStore();
    const playbackStore = usePlaybackStore();

    const currentInstrument = pianoRollInstrumentId
        ? instruments.find(inst => inst.id === pianoRollInstrumentId)
        : null;

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

    // ✅ IMPROVED: SCALE HIGHLIGHTING STATE - Always enabled with default C Major
    // Use version to force re-render when singleton changes
    const [scaleVersion, setScaleVersion] = useState(0);
    const [scaleHighlightEnabled, setScaleHighlightEnabled] = useState(true);

    // Get singleton instance
    const scaleSystem = getScaleSystem();

    // ✅ Initialize/Sync scale
    useEffect(() => {
        // Enforce default C Major if no scale is set (as per "Always enabled" policy)
        if (!scaleSystem.getScale()) {
            console.log('🎹 Initializing default scale: C Major');
            scaleSystem.setScale(0, 'major'); // 0 = C
        } else {
            console.log('🎹 Scale already set:', scaleSystem.getScaleInfo()?.name);
        }

        // Force initial render to ensure we have the latest scale state
        setScaleVersion(v => v + 1);
    }, []);

    // ✅ MIDI RECORDING STATE
    // ✅ MIDI RECORDING HOOK
    const { isRecording, isCountingIn, countInBars } = useMidiRecording({
        currentInstrument,
        loopRegion
    });


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

    // ✅ REMOVED: Cursor manager state - using simple CSS cursors now

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

    // ✅ REMOVED: Complex cursor manager - using simple CSS cursors now

    // ✅ TOOL MANAGER - Subscribe to tool changes
    useEffect(() => {
        const toolManager = getToolManager();

        // Set initial tool
        setActiveTool(toolManager.getActiveTool());

        // Subscribe to tool changes
        const unsubscribe = toolManager.subscribe((event, data) => {
            if (event === 'tool-changed') {
                setActiveTool(data.tool);
            }
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

    // ✅ Setup PreviewManager to use AudioEngine's instrument directly
    useEffect(() => {
        if (!currentInstrument) return;

        let cancelled = false;

        const setupPreview = async () => {
            // ... logic refactored to use AudioEngineGlobal if possible
            // For now, restoring context
            try {
                // Dynamic import to avoid circular dep if needed, or just cleaner
                const { getPreviewManager } = await import('@/lib/audio/preview');
                const { AudioEngineGlobal } = await import('@/lib/core/AudioEngineGlobal');

                if (cancelled) return;

                const audioEngine = AudioEngineGlobal.get();
                if (audioEngine?.audioContext) {
                    const previewManager = getPreviewManager(audioEngine.audioContext, audioEngine);
                    await previewManager.setInstrument(currentInstrument);
                }
            } catch (err) {
                if (!cancelled) console.error('Failed to setup preview:', err);
            }
        };

        setupPreview();

        return () => {
            cancelled = true;
        };
    }, [currentInstrument]);



    // ✅ KEYBOARD PREVIEW - Track active keyboard preview note
    const activeKeyboardNoteRef = useRef(null);
    const [activeKeyboardNote, setActiveKeyboardNote] = useState(null);

    // ✅ KEYBOARD PREVIEW - Start note when mouse down on keyboard
    const handleKeyboardMouseDown = useCallback((e) => {
        if (!currentInstrument || !engine.dimensions) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;

        // Check if click is in keyboard area
        const x = e.clientX - rect.left;
        if (x > KEYBOARD_WIDTH || y < RULER_HEIGHT) return;

        // Calculate MIDI note from Y position
        const gridY = y - RULER_HEIGHT;
        const scrollY = engine.viewport?.scrollY || 0;
        const keyHeight = engine.dimensions.keyHeight || 20;
        const keyIndex = Math.floor((gridY + scrollY) / keyHeight);
        const midiNote = 127 - keyIndex;

        // Validate MIDI range
        if (midiNote < 0 || midiNote > 127) return;

        // Stop previous note if any
        if (activeKeyboardNoteRef.current !== null) {
            try {
                getPreviewManager().stopNote(activeKeyboardNoteRef.current);
            } catch (error) {
                console.error('Error stopping previous keyboard note:', error);
            }
        }

        // Start playing the note (sustain indefinitely until mouse up)
        try {
            getPreviewManager().previewNote(midiNote, 100, null); // null = sustain until stopped
            activeKeyboardNoteRef.current = midiNote;
            setActiveKeyboardNote(midiNote); // ✅ Update state for visual feedback
        } catch (error) {
            console.error('Keyboard preview error:', error);
        }
    }, [currentInstrument, engine]);

    // ✅ KEYBOARD PREVIEW - Stop note when mouse up
    const handleKeyboardMouseUp = useCallback(() => {
        if (activeKeyboardNoteRef.current !== null) {
            try {
                getPreviewManager().stopNote(activeKeyboardNoteRef.current);
                activeKeyboardNoteRef.current = null;
                setActiveKeyboardNote(null); // ✅ Clear visual feedback
            } catch (error) {
                console.error('Error stopping keyboard note:', error);
            }
        }
    }, []);

    // ✅ KEYBOARD PREVIEW - Trigger background repaint when active key changes
    useEffect(() => {
        if (backgroundDirtyRef.current !== undefined) {
            backgroundDirtyRef.current = true;
        }
    }, [activeKeyboardNote]);

    // ✅ LOOP REGION HOOK - Timeline selection
    // Pass playhead setter callback for single click behavior
    const jumpToStep = usePlaybackStore(state => state.jumpToStep);
    const handleSetPlayhead = useCallback((step) => {
        jumpToStep(step);
    }, [jumpToStep]);

    const loopRegionHook = useLoopRegionSelection(engine, snapValue, loopRegion, setLoopRegion, handleSetPlayhead);

    // ✅ LOOP REGION → PLAYBACK ENGINE SYNC
    // When loop region changes, update playback engine loop range
    useEffect(() => {
        if (loopRegion && loopRegion.start !== undefined && loopRegion.end !== undefined) {
            const { setLoopRange } = usePlaybackStore.getState();
            setLoopRange(loopRegion.start, loopRegion.end);
        }
    }, [loopRegion]);

    // ✅ V3 Hook - Evolutionary design, zero race conditions
    const noteInteractions = useNoteInteractionsV3({
        engine,
        activeTool,
        snapValue,
        currentInstrument,
        loopRegion,
        setLoopRegion, // ✅ FL STUDIO FEATURE: Ctrl+L support
        keyboardPianoMode,
        // ✅ MIDI Recording
        isRecording,
        onRecordToggle: async () => {
            const recorder = midiRecorderRef.current;
            if (!recorder) return;

            if (isRecording) {
                await recorder.stopRecording();
                setIsRecording(false);
                setIsCountingIn(false);
            } else {
                // Set count-in bars from recorder state
                const bars = recorder.state.countInBars || 1;
                setCountInBars(bars);

                const success = recorder.startRecording({
                    mode: 'replace', // Default mode
                    quantizeStrength: 0,
                    countInBars: bars
                });
                if (success) {
                    // Count-in will be handled by MIDIRecorder
                    // We'll update isCountingIn via event listeners
                    setIsCountingIn(bars > 0);
                    if (bars === 0) {
                        setIsRecording(true);
                    }
                }
            }
        }
    });

    const {
        notes,
        selectedNoteIds,
        hoveredNoteId,
        selectionArea,
        isSelectingArea,
        isSelectingTimeRange,
        timeRangeSelection,
        previewNote,
        slicePreview,
        sliceRange,
        dragState: rawDragState,
        resizeState: rawResizeState
    } = noteInteractions;

    // ✅ FIX: Memoize selectedNoteIds array early to prevent initialization errors
    const selectedNoteIdsArray = useMemo(
        () => Array.from(selectedNoteIds || []),
        [selectedNoteIds]
    );

    // ✅ VELOCITY LANE HANDLER - Define early to prevent initialization errors
    const handleNoteVelocityChange = useCallback((noteId, newVelocity) => {
        // Update note velocity via note interactions
        noteInteractions.updateNoteVelocity?.(noteId, newVelocity);
    }, [noteInteractions]);

    // ✅ BATCH: Update velocity of multiple notes at once (for Alt+wheel in velocity lane)
    const handleNotesVelocityChange = useCallback((noteIds, velocityChange) => {
        // Update notes velocity via note interactions batch function
        if (noteInteractions.updateNotesVelocity) {
            noteInteractions.updateNotesVelocity(noteIds, velocityChange);
        } else {
            // Fallback: update individually
            noteIds.forEach(noteId => {
                const note = noteInteractions.notes.find(n => n.id === noteId);
                if (note) {
                    const currentVelocity = note.velocity || 100;
                    const newVelocity = Math.max(1, Math.min(127, currentVelocity + velocityChange));
                    noteInteractions.updateNoteVelocity?.(noteId, newVelocity);
                }
            });
        }
    }, [noteInteractions]);

    // ✅ KEYBOARD SHORTCUTS - Handle Alt + key for tools and ? for shortcuts panel
    // ✅ FIX: Moved after selectedNoteIds and handleNoteVelocityChange are defined
    useEffect(() => {
        const handleKeyDown = (e) => {
            // ✅ IGNORE ALL SHORTCUTS when keyboard piano mode is active
            if (keyboardPianoMode) {
                return;
            }

            // Don't interfere with text inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // ✅ PHASE 1: Velocity lane keyboard shortcuts
            // Check if velocity lane is focused or if we're in velocity editing context
            const hasSelectedNotes = selectedNoteIds && selectedNoteIds.size > 0;
            const isVelocityContext = velocityTool === VELOCITY_TOOL_TYPES.DRAW ||
                (hasSelectedNotes && !e.ctrlKey && !e.metaKey && !e.altKey);

            if (isVelocityContext) {
                // Convert Set to Array for iteration
                const selectedArray = Array.from(selectedNoteIds || []);

                // Arrow keys: Increase/decrease velocity
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const isIncrease = e.key === 'ArrowUp';
                    const isFine = e.shiftKey; // Shift = fine adjustment
                    const step = isFine ? 1 : 5; // Fine: 1, Normal: 5

                    selectedArray.forEach(noteId => {
                        const note = noteInteractions.notes.find(n => n.id === noteId);
                        if (note) {
                            const currentVelocity = note.velocity || 100;
                            const newVelocity = isIncrease
                                ? Math.min(127, currentVelocity + step)
                                : Math.max(1, currentVelocity - step);
                            handleNoteVelocityChange(noteId, newVelocity);
                        }
                    });
                    return;
                }

                // 0 key: Reset velocity to 1 (MIDI minimum)
                if (e.key === '0') {
                    e.preventDefault();
                    selectedArray.forEach(noteId => {
                        handleNoteVelocityChange(noteId, 1);
                    });
                    return;
                }

                // 1 key: Set velocity to 100
                if (e.key === '1') {
                    e.preventDefault();
                    selectedArray.forEach(noteId => {
                        handleNoteVelocityChange(noteId, 100);
                    });
                    return;
                }
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
    }, [keyboardPianoMode, velocityTool, selectedNoteIds, noteInteractions.notes, handleNoteVelocityChange]);

    const rendererDragState = useMemo(() => {
        if (rawDragState && rawDragState.noteIds) {
            const ds = rawDragState;
            return {
                type: 'moving',
                noteIds: ds.noteIds,
                originalNotes: ds.originals,
                currentDelta: ds.delta ? {
                    deltaTime: ds.delta.time || 0,
                    deltaPitch: ds.delta.pitch || 0
                } : { deltaTime: 0, deltaPitch: 0 }
            };
        }

        if (rawResizeState && (rawResizeState.noteIds || rawResizeState.noteId)) {
            const rs = rawResizeState;
            return {
                type: 'resizing',
                noteIds: rs.noteIds || (rs.noteId ? [rs.noteId] : []),
                originalNotes: rs.originals,
                resizeHandle: rs.handle,
                currentDelta: rs.delta ? { deltaTime: rs.delta } : { deltaTime: 0 }
            };
        }

        return null;
    }, [rawDragState, rawResizeState]);

    const notesById = useMemo(() => {
        const map = new Map();
        notes.forEach(note => map.set(note.id, note));
        return map;
    }, [notes]);

    const viewportData = engine.viewport || { scrollX: 0, scrollY: 0, width: 0, height: 0, zoomX: 1, zoomY: 1 };
    const dimensionsData = engine.dimensions || { stepWidth: 0, keyHeight: 0 };

    const dragDirtyRegion = useMemo(() => computeDragDirtyRegion(
        rendererDragState,
        viewportData,
        dimensionsData,
        notesById,
        snapValue
    ), [
        rendererDragState,
        notesById,
        viewportData.scrollX,
        viewportData.scrollY,
        viewportData.width,
        viewportData.height,
        dimensionsData.stepWidth,
        dimensionsData.keyHeight,
        snapValue
    ]);

    const paintBackgroundLayer = useCallback(() => {
        const canvas = gridCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        resizeCanvasToDisplay(canvas, ctx);

        const payload = {
            ...engineRef.current,
            snapValue,
            qualityLevel,
            scaleHighlight: scaleHighlightEnabled ? getScaleSystem() : null,
            activeKeyboardNote  // ✅ Add for keyboard preview highlight
        };

        drawPianoRollBackground(ctx, payload);
        if (timelineRenderer) {
            timelineRenderer.render(ctx, payload);
        }
    }, [activeKeyboardNote, qualityLevel, scaleVersion, scaleHighlightEnabled, snapValue, timelineRenderer]);

    const paintNotesLayer = useCallback((clipRect) => {
        const canvas = notesCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = resizeCanvasToDisplay(canvas, ctx);
        if (!width || !height) return;

        const payload = {
            ...engineRef.current,
            snapValue,
            notes,
            selectedNoteIds,
            hoveredNoteId,
            selectionArea,
            isSelectingArea,
            isSelectingTimeRange,
            timeRangeSelection,
            previewNote,
            slicePreview,
            sliceRange,
            qualityLevel,
            ghostPosition,
            activeTool,
            loopRegion,
            dragState: rendererDragState,
            scaleHighlight: scaleHighlightEnabled ? scaleSystem : null,
            activeKeyboardNote
        };

        if (clipRect && clipRect.width > 0 && clipRect.height > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(clipRect.x, clipRect.y, clipRect.width, clipRect.height);
            ctx.clip();
            ctx.clearRect(clipRect.x, clipRect.y, clipRect.width, clipRect.height);
            drawPianoRollForeground(ctx, payload);
            ctx.restore();
        } else {
            ctx.clearRect(0, 0, width, height);
            drawPianoRollForeground(ctx, payload);
        }
    }, [
        activeKeyboardNote,
        activeTool,
        ghostPosition,
        isSelectingArea,
        isSelectingTimeRange,
        loopRegion,
        notes,
        previewNote,
        rendererDragState,
        scaleVersion,
        scaleHighlightEnabled,
        selectedNoteIds,
        selectionArea,
        slicePreview,
        sliceRange,
        snapValue,
        timeRangeSelection,
        hoveredNoteId,
        qualityLevel
    ]);

    useEffect(() => {
        if (!isPianoRollVisible) {
            clearCanvasRef(gridCanvasRef);
            clearCanvasRef(notesCanvasRef);
            backgroundDirtyRef.current = true;
            notesDirtyRef.current = true;
            notesDirtyRegionRef.current = null;
            return;
        }
        markBackgroundDirty();
        markNotesDirty();
    }, [isPianoRollVisible, markBackgroundDirty, markNotesDirty]);

    useEffect(() => {
        markBackgroundDirty();
        markNotesDirty(); // ✅ FIX: Ensure notes are redrawn on zoom/scroll/resize
    }, [
        viewportData.scrollX,
        viewportData.scrollY,
        viewportData.width,
        viewportData.height,
        viewportData.zoomX,
        viewportData.zoomY,
        dimensionsData.stepWidth,
        dimensionsData.keyHeight,
        loopRegion,
        loopRegion,
        markBackgroundDirty,
        markNotesDirty // ✅ FIX: Also mark notes dirty on viewport changes (resize clears canvas)
    ]);

    useEffect(() => {
        markNotesDirty();
    }, [
        notes,
        selectedNoteIds,
        hoveredNoteId,
        selectionArea,
        isSelectingArea,
        isSelectingTimeRange,
        timeRangeSelection,
        previewNote,
        slicePreview,
        sliceRange,
        rendererDragState,
        scaleVersion,
        activeTool,
        loopRegion,
        activeKeyboardNote,
        ghostPosition,
        qualityLevel,
        markNotesDirty
    ]);

    useEffect(() => {
        // ✅ FIX: During drag/resize, render entire canvas to show all notes
        // Dirty region optimization causes other notes to disappear
        if (dragDirtyRegion) {
            markNotesDirty(); // Render entire canvas, not just dirty region
        }

    }, [dragDirtyRegion, markNotesDirty]);

    useEffect(() => {
        if (!isPianoRollVisible) return;
        let rafId;
        const loop = () => {
            if (backgroundDirtyRef.current) {
                backgroundDirtyRef.current = false;
                paintBackgroundLayer();
            }
            if (notesDirtyRef.current) {
                notesDirtyRef.current = false;
                const region = notesDirtyRegionRef.current;
                notesDirtyRegionRef.current = null;
                paintNotesLayer(region);
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [isPianoRollVisible, paintBackgroundLayer, paintNotesLayer]);

    // ✅ SIMPLE CURSOR SYSTEM - Map cursor state to CSS cursor
    const currentCursor = useMemo(() => {
        const cursorState = noteInteractions.cursorState;

        // Simple CSS cursor mapping
        const cursorMap = {
            'grab': 'grab',
            'grabbing': 'grabbing',
            'resize-left': 'w-resize',
            'resize-right': 'e-resize',
            'resize-both': 'ew-resize',
            'w-resize': 'w-resize', // ✅ V3: Direct CSS cursor values
            'e-resize': 'e-resize', // ✅ V3: Direct CSS cursor values
            'crosshair': 'crosshair',
            'not-allowed': 'not-allowed',
            'col-resize': 'col-resize',
            'default': 'default', // ✅ V3: Direct CSS cursor value
            'paint-premium': 'crosshair',
            'erase-premium': 'not-allowed',
            'slice-premium': 'col-resize',
            'slide-premium': 'alias'
        };

        return cursorState ? (cursorMap[cursorState] || cursorState) : 'default';
    }, [noteInteractions.cursorState]);

    const gridViewportWidth = Math.max(0, (engine.viewport?.width || 0) - KEYBOARD_WIDTH);
    const gridViewportHeight = Math.max(0, (engine.viewport?.height || 0) - RULER_HEIGHT);
    const contentWidth = Math.max(gridViewportWidth, engine.dimensions?.totalWidth || gridViewportWidth);
    const contentHeight = Math.max(gridViewportHeight, engine.dimensions?.totalHeight || gridViewportHeight);
    const maxScrollX = Math.max(0, contentWidth - gridViewportWidth);
    const maxScrollY = Math.max(0, contentHeight - gridViewportHeight);
    const horizontalScroll = Math.min(maxScrollX, Math.max(0, engine.viewport?.scrollX || 0));
    const verticalScroll = Math.min(maxScrollY, Math.max(0, engine.viewport?.scrollY || 0));

    const handleHorizontalScrollbarScroll = useCallback((nextScrollX) => {
        const clamped = Math.max(0, Math.min(maxScrollX, nextScrollX));
        requestViewportUpdate({ scrollX: clamped, smooth: false });
    }, [maxScrollX, requestViewportUpdate]);

    const handleVerticalScrollbarScroll = useCallback((nextScrollY) => {
        const clamped = Math.max(0, Math.min(maxScrollY, nextScrollY));
        requestViewportUpdate({ scrollY: clamped, smooth: false });
    }, [maxScrollY, requestViewportUpdate]);

    // ✅ REGISTER PIANO ROLL TIMELINE with TimelineController
    // Note: engineRef is defined later in the file and used here via closure
    useEffect(() => {
        if (!containerRef.current || !engine.dimensions.stepWidth) return;

        try {
            const timelineController = getTimelineController();

            // Calculate ruler element bounds (top 30px of container)
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
                    },
                    isRecording: isRecording // ✅ Pass recording state
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

    // ✅ NOTE: handleNoteVelocityChange is now defined earlier (after selectedNoteIdsArray)

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

            // ✅ FIX: Use queueMicrotask to avoid render-phase state updates
            // Sync ccLanes with AutomationManager
            queueMicrotask(() => {
                const managerLanes = automationManager.getLanes(activePatternId, currentInstrument.id);
                setCCLanes(managerLanes);
            });
        });

        return unsubscribe;
    }, [activePatternId, currentInstrument]);

    // ✅ FIX: Legacy handler - CCLanes now uses useAutomationEditor hook internally
    // This handler is only used as fallback, wrap in queueMicrotask to avoid render-phase updates
    const handleCCLanePointAdd = useCallback((ccNumber, time, value) => {
        if (!activePatternId || !currentInstrument) return;

        queueMicrotask(() => {
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
        });
    }, [activePatternId, currentInstrument]);

    // ✅ FIX: Legacy handler - CCLanes now uses useAutomationEditor hook internally
    // This handler is only used as fallback, wrap in queueMicrotask to avoid render-phase updates
    const handleCCLanePointRemove = useCallback((ccNumber, pointIndex) => {
        if (!activePatternId || !currentInstrument) return;

        queueMicrotask(() => {
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
    const handleCCLanesScroll = useCallback((_deltaX, deltaY) => {
        const currentEngine = engineRef.current;
        if (!currentEngine || !currentEngine.eventHandlers?.updateViewport) return;

        // Update viewport scroll (horizontal scroll from vertical wheel)
        const scrollSpeed = 1.0;
        const newScrollX = Math.max(0, currentEngine.viewport.scrollX + (deltaY * scrollSpeed));

        // ✅ FIX: Use updateViewport instead of direct mutation to ensure reactive updates
        // This ensures VelocityLane and CCLanes stay synchronized
        currentEngine.eventHandlers.updateViewport({ scrollX: newScrollX, smooth: false });
    }, []);

    // ✅ PHASE 2: NOTE PROPERTIES HANDLERS
    // ✅ FIX: Calculate selectedNote on every render to ensure it updates when notes change
    // Don't use useMemo here - we want it to recalculate whenever notes array changes
    const selectedNote = (() => {
        if (selectedNoteIds.size === 1) {
            const noteId = Array.from(selectedNoteIds)[0];
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

    // ✅ REMOVED: Cursor manager cleanup - using simple CSS cursors now
    // ✅ NOTE: selectedNoteIdsArray is now defined earlier (after noteInteractions destructuring)

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
            if (selectedNoteIds.size > 0) {
                noteInteractions.deleteNotes(Array.from(selectedNoteIds));
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
            if (selectedNoteIds.size === 0) return;

            const notesToQuantize = noteInteractions.notes.filter(n =>
                selectedNoteIds.has(n.id)
            );

            notesToQuantize.forEach(note => {
                const quantizedTime = Math.round(note.startTime / snapValue) * snapValue;
                noteInteractions.updateNote(note.id, { startTime: quantizedTime });
            });

            console.log(`✨ Quantized ${notesToQuantize.length} notes to grid: ${snapValue}`);
        },
        // ✅ PHASE 1: Velocity quantization
        onVelocityQuantize: (quantizeValue = null) => {
            if (selectedNoteIds.size === 0) return;

            // Default quantization values: 0, 32, 64, 96, 127 (piano, mezzo-piano, mezzo-forte, forte, fortissimo)
            const defaultQuantizeValues = [1, 32, 64, 96, 127];
            const quantizeTo = quantizeValue !== null ? quantizeValue : defaultQuantizeValues;

            const notesToQuantize = noteInteractions.notes.filter(n =>
                selectedNoteIds.has(n.id)
            );

            notesToQuantize.forEach(note => {
                const currentVelocity = note.velocity || 100;
                // Find closest quantization value
                const closest = quantizeTo.reduce((prev, curr) => {
                    return Math.abs(curr - currentVelocity) < Math.abs(prev - currentVelocity) ? curr : prev;
                });
                handleNoteVelocityChange(note.id, closest);
            });

            console.log(`✨ Velocity quantized ${notesToQuantize.length} notes to: ${quantizeTo.join(', ')}`);
        },
        onHumanize: () => {
            // Add subtle randomization to timing and velocity
            if (selectedNoteIds.size === 0) return;

            const notesToHumanize = noteInteractions.notes.filter(n =>
                selectedNoteIds.has(n.id)
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
            if (selectedNoteIds.size === 0) return;

            const notesToFade = noteInteractions.notes
                .filter(n => selectedNoteIds.has(n.id))
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
            if (selectedNoteIds.size === 0) return;

            const notesToFade = noteInteractions.notes
                .filter(n => selectedNoteIds.has(n.id))
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
            if (selectedNoteIds.size === 0) return;

            const notesToNormalize = noteInteractions.notes.filter(n =>
                selectedNoteIds.has(n.id)
            );

            notesToNormalize.forEach(note => {
                noteInteractions.updateNote(note.id, { velocity: 100 });
            });

            console.log(`⚖️ Normalized ${notesToNormalize.length} notes to velocity 100`);
        }
    }), [noteInteractions, snapValue]);

    // ✅ REMOVED: Global keyboard shortcuts now handled by TransportManager
    // No need for component-level spacebar handling

    // ✅ FIX: Handle wheel events with preventDefault using manual event listener
    // React's onWheel is passive by default, so we need to use addEventListener with { passive: false }
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const wheelHandler = (e) => {
            // ✅ UX FIX 3: Don't handle wheel during drag/resize
            if (rawDragState || rawResizeState) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // ✅ UX FIX 4: Don't handle wheel when context menu is open
            if (noteInteractions.contextMenuState) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // ✅ UX FIX 1 & 5: Ctrl + wheel (zoom) has priority over Alt
            // This allows Ctrl + Alt + wheel to work for zoom
            if (e.ctrlKey || e.metaKey) {
                // Let engine handle zoom (don't prevent if Ctrl is pressed)
                if (engine.eventHandlers?.onWheel) {
                    engine.eventHandlers.onWheel(e);
                }
                return;
            }

            // ✅ UX FIX: Alt + wheel: Handle velocity change for selected notes (works everywhere)
            // Prevent scroll when Alt is pressed
            if (e.altKey && selectedNoteIds.size > 0 && noteInteractions.handleWheel) {
                const handled = noteInteractions.handleWheel(e);
                if (handled) {
                    // Event was handled by note interactions (velocity change)
                    // Don't pass to viewport scroll
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }

            // ✅ UX FIX: If Alt is pressed (even without selection), prevent scroll
            // This prevents accidental scrolling while trying to adjust velocity
            if (e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const isInGrid = x > 80 && y > 30;

            // Check if wheel event should be handled by note interactions
            if (isInGrid && noteInteractions.handleWheel) {
                const handled = noteInteractions.handleWheel(e);
                if (handled) {
                    // Event was handled by note interactions (e.g., velocity change)
                    // Don't pass to viewport scroll
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }

            // Default: viewport scroll (only if note interactions didn't handle it and Alt is not pressed)
            if (engine.eventHandlers?.onWheel) {
                engine.eventHandlers.onWheel(e);
            }
        };

        // ✅ UX FIX: Use capture phase to handle Alt+wheel before engine's scroll handler
        container.addEventListener('wheel', wheelHandler, { passive: false, capture: true });

        return () => {
            container.removeEventListener('wheel', wheelHandler, { capture: true });
        };
    }, [selectedNoteIds, noteInteractions, engine]);

    return (
        <div className="prv5-container">
            {/* ✅ Count-in Overlay */}
            <CountInOverlay
                isCountingIn={isCountingIn}
                countInBars={countInBars}
                bpm={bpm}
                onComplete={() => {
                    setIsCountingIn(false);
                }}
            />

            <Toolbar
                snapValue={snapValue}
                onSnapChange={setSnapValue}
                activeTool={activeTool}
                onToolChange={handleToolChange}
                zoom={zoom}
                onZoomChange={handleZoomChange}
                selectedCount={selectedNoteIds.size} // V2 Hook'dan
                keyboardPianoMode={keyboardPianoMode}
                onKeyboardPianoModeChange={setKeyboardPianoMode}
                keyboardPianoSettings={keyboardPianoSettings}
                onKeyboardPianoSettingsChange={setKeyboardPianoSettings}
                // ✅ PHASE 2: CC Lanes & Note Properties
                showCCLanes={showCCLanes}
                onShowCCLanesChange={setShowCCLanes}
                showNoteProperties={showNoteProperties}
                onShowNotePropertiesChange={setShowNoteProperties}
                // ✅ IMPROVED: Scale Highlighting - always enabled, but can be changed
                scaleHighlight={scaleSystem}
                scaleHighlightEnabled={scaleHighlightEnabled}
                onScaleChange={(root, scaleType) => {
                    scaleSystem.setScale(root, scaleType);
                    setScaleVersion(v => v + 1); // Force re-render
                }}
                onScaleHighlightToggle={() => setScaleHighlightEnabled(!scaleHighlightEnabled)}
                // ✅ MIDI Recording
                isRecording={isRecording}
                onRecordToggle={async () => {
                    const recorder = midiRecorderRef.current;
                    if (!recorder) return;

                    if (isRecording) {
                        await recorder.stopRecording();
                        setIsRecording(false);
                    } else {
                        const success = recorder.startRecording({
                            mode: 'replace', // Default mode
                            quantizeStrength: 0,
                            countInBars: 1
                        });
                        if (success) {
                            setIsRecording(true);
                        }
                    }
                }}
            />
            <div
                ref={containerRef}
                className="prv5-canvas-container"
                data-tool={activeTool}
                style={{ cursor: currentCursor }}
                tabIndex={0}
                onMouseDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const isInRuler = y <= 30;
                    const isInKeyboard = x <= 80 && y > 30;
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
                    } else if (isInKeyboard) {
                        // ✅ Keyboard preview - start playing note on mouse down
                        handleKeyboardMouseDown(e);
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
                    // ✅ Stop keyboard preview note if active
                    handleKeyboardMouseUp();
                    loopRegionHook.handleRulerMouseUp();
                    noteInteractions.handleMouseUp(e);
                    engine.eventHandlers.onMouseUp?.(e);
                }}
                onMouseLeave={(e) => {
                    // ✅ Stop keyboard preview note if mouse leaves canvas
                    handleKeyboardMouseUp();
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
                onKeyUp={(e) => {
                    // ✅ RECORDING: Handle keyboard Note Off events
                    if (noteInteractions.handleKeyUp) {
                        noteInteractions.handleKeyUp(e);
                    }
                }}
                onContextMenu={(e) => e.preventDefault()}
            >
                <canvas ref={gridCanvasRef} className="prv5-canvas prv5-canvas-grid" />
                <canvas ref={notesCanvasRef} className="prv5-canvas prv5-canvas-notes" />
                <canvas ref={playheadCanvasRef} className="prv5-canvas prv5-canvas-playhead" />

                <PianoRollScrollbar
                    orientation="horizontal"
                    viewportSize={gridViewportWidth}
                    contentSize={contentWidth}
                    scrollOffset={horizontalScroll}
                    onScroll={handleHorizontalScrollbarScroll}
                    style={{
                        left: KEYBOARD_WIDTH + 12,
                        bottom: 10
                    }}
                />
                <PianoRollScrollbar
                    orientation="vertical"
                    viewportSize={gridViewportHeight}
                    contentSize={contentHeight}
                    scrollOffset={verticalScroll}
                    onScroll={handleVerticalScrollbarScroll}
                    style={{
                        top: RULER_HEIGHT + 12,
                        right: 12
                    }}
                />

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
                selectedNoteIds={selectedNoteIdsArray || []}
                onNoteVelocityChange={handleNoteVelocityChange}
                onNotesVelocityChange={handleNotesVelocityChange}
                onNoteSelect={noteInteractions.selectNote}
                onDeselectAll={noteInteractions.deselectAll}
                dimensions={engine.dimensions}
                viewport={engine.viewport}
                activeTool={activeTool}
                velocityTool={velocityTool}
                brushSize={velocityBrushSize}
                onVelocityToolChange={setVelocityTool}
            />

            {/* ✅ PHASE 2: CC LANES */}
            {showCCLanes && ccLanes.length > 0 && (
                <CCLanes
                    lanes={ccLanes}
                    selectedNoteIds={selectedNoteIdsArray || []}
                    instrumentId={currentInstrument?.id} // ✅ FIX: Pass instrumentId prop
                    onLaneChange={(laneId, lane) => {
                        // Handle lane change if needed
                    }}
                    onPointAdd={handleCCLanePointAdd}
                    onPointRemove={handleCCLanePointRemove}
                    onPointUpdate={handleCCLanePointUpdate}
                    onScroll={handleCCLanesScroll}
                    dimensions={engine.dimensions}
                    viewport={engine.viewport}
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

            {/* Removed: ScaleSelectorPanel - scale highlighting is now always enabled with default C Major */}

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
                    hasSelection={selectedNoteIds.size > 0}
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

const PianoRollScrollbar = ({
    orientation,
    viewportSize,
    contentSize,
    scrollOffset,
    onScroll,
    style
}) => {
    const trackRef = useRef(null);
    const dragHandlersRef = useRef(null);
    const isHorizontal = orientation === 'horizontal';

    const trackLength = Math.max(0, viewportSize);
    const shouldRenderScrollbar = trackLength > 0 && contentSize > viewportSize + 1 && Number.isFinite(contentSize);

    const scrollRange = Math.max(1, contentSize - viewportSize);
    const thumbRatio = viewportSize / contentSize;
    const thumbLength = Math.max(24, trackLength * thumbRatio);
    const maxThumbOffset = Math.max(0, trackLength - thumbLength);
    const clampedScroll = Math.max(0, Math.min(scrollRange, scrollOffset));
    const thumbOffset = maxThumbOffset === 0 ? 0 : (clampedScroll / scrollRange) * maxThumbOffset;

    const emitScroll = useCallback((thumbPos) => {
        const clampedThumb = Math.max(0, Math.min(maxThumbOffset, thumbPos));
        const ratio = maxThumbOffset === 0 ? 0 : clampedThumb / maxThumbOffset;
        const nextScroll = ratio * scrollRange;
        onScroll(nextScroll);
    }, [maxThumbOffset, onScroll, scrollRange]);

    const cleanupDrag = useCallback(() => {
        if (dragHandlersRef.current) {
            window.removeEventListener('pointermove', dragHandlersRef.current.move);
            window.removeEventListener('pointerup', dragHandlersRef.current.up);
            dragHandlersRef.current = null;
        }
    }, []);

    useEffect(() => cleanupDrag, [cleanupDrag]);

    const startDrag = useCallback((initialClientPos, initialThumb) => {
        const handlePointerMove = (moveEvent) => {
            const pointerPos = isHorizontal ? moveEvent.clientX : moveEvent.clientY;
            const delta = pointerPos - initialClientPos;
            emitScroll(initialThumb + delta);
        };

        const handlePointerUp = () => {
            cleanupDrag();
        };

        dragHandlersRef.current = {
            move: handlePointerMove,
            up: handlePointerUp
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    }, [emitScroll, cleanupDrag, isHorizontal]);

    const handleThumbPointerDown = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        const pointerPos = isHorizontal ? event.clientX : event.clientY;
        startDrag(pointerPos, thumbOffset);
    }, [isHorizontal, startDrag, thumbOffset]);

    const handleTrackPointerDown = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        const trackRect = trackRef.current?.getBoundingClientRect();
        if (!trackRect) return;

        const pointerInTrack = isHorizontal
            ? event.clientX - trackRect.left
            : event.clientY - trackRect.top;

        const newThumbStart = Math.max(0, Math.min(pointerInTrack - thumbLength / 2, maxThumbOffset));
        emitScroll(newThumbStart);
        const pointerPos = isHorizontal ? event.clientX : event.clientY;
        startDrag(pointerPos, newThumbStart);
    }, [emitScroll, isHorizontal, maxThumbOffset, startDrag, thumbLength]);

    const containerStyle = {
        ...style,
        width: isHorizontal ? `${viewportSize}px` : (style?.width || '12px'),
        height: isHorizontal ? (style?.height || '12px') : `${viewportSize}px`
    };

    if (!shouldRenderScrollbar) {
        return null;
    }

    return (
        <div
            className={`prv5-scrollbar prv5-scrollbar--${orientation}`}
            style={containerStyle}
        >
            <div
                ref={trackRef}
                className="prv5-scrollbar__track"
                onPointerDown={handleTrackPointerDown}
            >
                <div
                    className="prv5-scrollbar__thumb"
                    onPointerDown={handleThumbPointerDown}
                    style={isHorizontal
                        ? { width: `${thumbLength}px`, left: `${thumbOffset}px`, height: '100%' }
                        : { height: `${thumbLength}px`, top: `${thumbOffset}px`, width: '100%' }
                    }
                />
            </div>
        </div>
    );
};
