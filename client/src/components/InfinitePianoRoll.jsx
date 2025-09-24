// Infinite Piano Roll - Canvas tabanlı ultra performanslı piano roll
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { InfiniteGridEngine } from '../lib/canvas/InfiniteGridEngine';
import { useInstrumentsStore } from '../store/useInstrumentsStore';
import { useArrangementStore } from '../store/useArrangementStore';
import PianoKeyboard from './PianoKeyboard';
import Timeline from './Timeline';
import HtmlNoteElement from './HtmlNoteElement';

const InfinitePianoRoll = ({
    instrumentId = null, // Will use first available instrument if not provided
    className = ""
}) => {
    const containerRef = useRef(null);
    const engineRef = useRef(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [performanceStats, setPerformanceStats] = useState({});
    const [mouseMode, setMouseMode] = useState('select'); // select, write, delete, slice

    // Hybrid system state
    const [renderMode, setRenderMode] = useState('hybrid'); // 'canvas', 'html', 'hybrid'
    const [selectedNotes, setSelectedNotes] = useState(new Set());
    const [visibleNotes, setVisibleNotes] = useState([]);

    // Timeline and keyboard states
    const [snapMode, setSnapMode] = useState('1/16');
    const [viewportX, setViewportX] = useState(0);
    const [viewportZoom, setViewportZoom] = useState(1);
    const [activeKeys, setActiveKeys] = useState(new Set());
    const [highlightedKeys, setHighlightedKeys] = useState(new Set());

    // Store connections
    const { instruments } = useInstrumentsStore();
    const { patterns, activePatternId, updatePatternNotes } = useArrangementStore();

    // MIDI conversion functions - defined first
    const noteNameToMidi = (noteName) => {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const match = noteName.match(/^([A-G]#?)(\d+)$/);
        if (!match) return 60; // Default to C4

        const [, note, octaveStr] = match;
        const octave = parseInt(octaveStr);
        const noteIndex = noteNames.indexOf(note);

        if (noteIndex === -1) return 60;
        return (octave + 1) * 12 + noteIndex;
    };

    const midiToNoteName = (midiNote) => {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const noteIndex = midiNote % 12;
        return `${noteNames[noteIndex]}${octave}`;
    };

    // Use provided instrumentId or first available instrument
    const currentInstrumentId = instrumentId || (instruments.length > 0 ? instruments[0].id : null);
    const instrument = instruments.find(i => i.id === currentInstrumentId);

    // Convert patterns object to array if needed
    const patternsArray = Array.isArray(patterns) ? patterns : Object.values(patterns);
    const activePattern = patternsArray.find(p => p.id === activePatternId);
    const notes = activePattern?.data[currentInstrumentId] || [];

    // DEBUG: Log data state
    console.log('🔍 Piano Roll Debug:', {
        instruments: instruments.length,
        patterns: patternsArray.length,
        currentInstrumentId,
        activePatternId,
        activePattern: !!activePattern,
        notes: notes.length,
        notesData: notes
    });

    // Initialize canvas engine with unified coordinate system
    useEffect(() => {
        if (!containerRef.current || isInitialized) return;

        const engine = new InfiniteGridEngine({
            // FL Studio inspired coordinate system: X=time, Y=pitch
            cellWidth: 12,       // 12 pixels = 1/16th note (daha sık grid)
            cellHeight: 12,      // 12 pixels = 1 semitone (daha kompakt)
            bufferSize: 200,     // FL Studio tarzı geniş buffer
            chunkSize: 256,      // FL Studio optimal chunk size (64-256)
            maxZoom: 16,         // FL Studio ultra zoom seviyesi
            minZoom: 0.05,       // 562 bar görüntülemek için ultra wide
            // 10 oktav piano mapping (C0 to B9)
            totalPitchRange: 120, // 10 oktav = 120 semitone
            basePitchOffset: 12,  // C0 = MIDI 12, maps to Y coordinate 0
            // Hybrid system optimization
            hybridMode: renderMode === 'hybrid',
            renderNotesToCanvas: renderMode === 'canvas',
            // FL Studio performans optimizasyonları
            useWebGL: true,       // Hardware acceleration
            enableVirtualization: true, // Sadece görünen alanı render et
            maxVisibleBars: 562,  // FL Studio maximum bar limit
            renderBatchSize: 128, // Render batch optimization
            cullOffscreenNotes: renderMode === 'canvas'
        });

        // Override note loading with unified coordinate system
        engine.getNotesInRange = (startTime, endTime) => {
            console.log(`🔍 getNotesInRange called: (${startTime}-${endTime})`);
            console.log('🔍 Current state:', {
                currentInstrumentId,
                activePattern: !!activePattern,
                patternData: activePattern?.data,
                instrumentData: activePattern?.data?.[currentInstrumentId]
            });

            if (!currentInstrumentId || !activePattern) {
                console.log('❌ getNotesInRange: No instrument or pattern');
                return [];
            }

            const instrumentNotes = activePattern.data[currentInstrumentId] || [];
            console.log('🔍 Raw instrument notes:', instrumentNotes);

            if (instrumentNotes.length === 0) {
                console.log('⚠️ No notes found for instrument:', currentInstrumentId);
                // Create test notes if none exist
                const testNotes = [
                    { id: 1, time: 0, pitch: 'C4', duration: 0.25, velocity: 100 },
                    { id: 2, time: 1, pitch: 'D4', duration: 0.5, velocity: 80 },
                    { id: 3, time: 2, pitch: 'E4', duration: 0.25, velocity: 120 }
                ];
                console.log('🧪 Using test notes:', testNotes);
                instrumentNotes.push(...testNotes);
            }

            const filteredNotes = instrumentNotes.filter(note => {
                // CONSISTENT: note.time is already in beats, no conversion needed
                const timeInBeats = typeof note.time === 'number' ? note.time : 0;
                return timeInBeats >= startTime && timeInBeats < endTime;
            }).map(note => {
                // 10 oktav MIDI mapping: C0(12) - B9(131)
                const midiNote = noteNameToMidi(note.pitch || 'C4');
                const gridY = midiNote - 12; // C0 (MIDI 12) maps to Y=0 (10 oktav başlangıcı)

                // CONSISTENT: note.time is already in beats
                const timeInBeats = typeof note.time === 'number' ? note.time : 0;

                // FL Studio duration mapping
                let durationInBeats = note.duration || 0.25; // Use stored duration if numeric
                if (typeof note.duration === 'string') {
                    if (note.duration === '32n') durationInBeats = 0.125;  // 32nd note
                    else if (note.duration === '16n') durationInBeats = 0.25;  // 16th note
                    else if (note.duration === '8n') durationInBeats = 0.5;   // 8th note
                    else if (note.duration === '4n') durationInBeats = 1;     // quarter note
                    else if (note.duration === '2n') durationInBeats = 2;     // half note
                    else if (note.duration === '1n') durationInBeats = 4;     // whole note
                }

                const convertedNote = {
                    ...note,
                    // CONSISTENT coordinate mapping: time in beats, pitch in grid Y
                    time: timeInBeats,         // X coordinate (in beats, no conversion)
                    pitch: gridY,              // Y coordinate (10 oktav: 0-119)
                    duration: durationInBeats, // Duration in beats
                    velocity: note.velocity || 100,
                    originalPitch: note.pitch,
                    midiNote: midiNote,
                    // FL Studio optimization flags
                    isVisible: true,
                    chunkId: Math.floor(timeInBeats / 4)
                };

                console.log('🎵 Loading note:', note, '→ grid:', convertedNote);
                return convertedNote;
            });

            console.log(`✅ getNotesInRange(${startTime}-${endTime}): Returning ${filteredNotes.length} notes`, filteredNotes);
            return filteredNotes;
        };

        // FL Studio tarzı drag & drop with 10 octave support
        engine.onNoteDrag = (draggedNote, newPosition) => {
            console.log('🎵 FL Note dragged:', draggedNote.id, 'to:', newPosition);

            // Direct store update - no callback needed
            if (currentInstrumentId && activePatternId) {
                const newMidiNote = Math.max(12, Math.min(131, newPosition.pitch + 12));
                const newNoteName = midiToNoteName(newMidiNote);

                const updatedNote = {
                    ...draggedNote,
                    time: Math.max(0, newPosition.time),
                    pitch: newNoteName,
                    // Remove internal coordinate data
                    originalPitch: undefined,
                    midiNote: undefined,
                    chunkId: undefined,
                    isVisible: undefined
                };

                // Update in store
                const currentNotes = notes || [];
                const updatedNotes = currentNotes.map(n =>
                    n.id === draggedNote.id ? updatedNote : n
                );
                updatePatternNotes(activePatternId, currentInstrumentId, updatedNotes);

                // Force immediate render after drag
                setTimeout(() => {
                    if (engineRef.current && engineRef.current.forceImmediateRender) {
                        engineRef.current.forceImmediateRender();
                    }
                }, 10); // Small delay to ensure state update
            }
        };

        // Set up resize callback
        engine.onNoteResize = (resizedNote, newProperties) => {
            console.log('📏 Note resized:', resizedNote.id, 'new duration:', newProperties.duration);

            // Direct store update
            if (currentInstrumentId && activePatternId) {
                const updatedNote = {
                    ...resizedNote,
                    duration: newProperties.duration,
                    // Remove internal coordinate data
                    originalPitch: undefined,
                    midiNote: undefined
                };

                const currentNotes = notes || [];
                const updatedNotes = currentNotes.map(n =>
                    n.id === resizedNote.id ? updatedNote : n
                );
                updatePatternNotes(activePatternId, currentInstrumentId, updatedNotes);

                // Force immediate render after resize
                setTimeout(() => {
                    if (engineRef.current && engineRef.current.forceImmediateRender) {
                        engineRef.current.forceImmediateRender();
                    }
                }, 10);
            }
        };

        // Set up empty space click callback for note creation
        engine.onEmptySpaceClick = (worldX, worldY) => {
            handleEmptySpaceClick(worldX, worldY);
        };

        // Set up delete callback
        engine.onNoteDelete = (note) => {
            console.log('🗑️ Deleting note:', note.id);

            // Direct store update
            if (currentInstrumentId && activePatternId) {
                const currentNotes = notes || [];
                const updatedNotes = currentNotes.filter(n => n.id !== note.id);
                updatePatternNotes(activePatternId, currentInstrumentId, updatedNotes);

                // Force immediate render after delete
                setTimeout(() => {
                    if (engineRef.current && engineRef.current.forceImmediateRender) {
                        engineRef.current.forceImmediateRender();
                    }
                }, 10);
            }
        };

        // Set up slice callback
        engine.onNoteSlice = (note, sliceTime) => {
            console.log('✂️ Slicing note:', note.id, 'at time:', sliceTime);
            // Could implement note slicing logic here
        };

        // Set initial mouse mode
        engine.setMouseMode(mouseMode);

        engine.init(containerRef.current);
        engineRef.current = engine;
        setIsInitialized(true);

        console.log('🎹 Infinite Piano Roll initialized with drag & drop');

        return () => {
            engine.destroy();
        };
    }, []);

    // Previous notes tracking için useRef'i component seviyesinde tanımla
    const previousNotesRef = useRef(null);

    // Hybrid system: Calculate visible notes for HTML rendering
    const calculateVisibleNotes = useCallback(() => {
        if (!engineRef.current || renderMode === 'canvas') return [];

        const engine = engineRef.current;
        const { x, y, width, height, zoom } = engine.viewport;
        const { cellWidth, cellHeight } = engine.options;

        // Calculate visible time range
        const pixelsPerBeat = cellWidth * 4;
        const startTime = (x / zoom) / pixelsPerBeat;
        const endTime = ((x + width) / zoom) / pixelsPerBeat;

        // Calculate visible pitch range
        const startPitch = Math.floor((y / zoom) / cellHeight);
        const endPitch = Math.ceil(((y + height) / zoom) / cellHeight);

        // Filter notes within visible range
        return notes.filter(note => {
            const noteTime = typeof note.time === 'number' ? note.time : 0;
            const notePitch = typeof note.pitch === 'string' ?
                noteNameToMidi(note.pitch) - 12 : note.pitch; // Convert to grid coordinates

            return noteTime >= startTime &&
                   noteTime <= endTime &&
                   notePitch >= startPitch &&
                   notePitch <= endPitch;
        });
    }, [notes, renderMode, noteNameToMidi]);

    // Update visible notes when viewport changes
    useEffect(() => {
        if (renderMode !== 'canvas') {
            const visible = calculateVisibleNotes();
            setVisibleNotes(visible);
        }
    }, [viewportX, viewportZoom, notes, renderMode, calculateVisibleNotes]);

    // FL Studio tarzı instant note updates
    useEffect(() => {
        if (!engineRef.current || !isInitialized) return;

        const engine = engineRef.current;

        // Always force update when notes change - immediate feedback is priority
        console.log('🔄 FL Studio: Note data changed, forcing immediate update');

        // Clear ALL chunks to force complete re-render
        if (engine.world && engine.world.chunks) {
            engine.world.chunks.clear();
        }

        // Force immediate chunk reload
        engine.updateVisibleChunks();

        // Force complete re-render for instant feedback
        engine.invalidateAll();

        // Store current state
        previousNotesRef.current = [...notes];

        console.log('✅ FL Studio: Forced render complete, notes:', notes.length);
    }, [notes, isInitialized, currentInstrumentId, activePattern]);

    // Update engine mouse mode when state changes
    useEffect(() => {
        if (engineRef.current && isInitialized) {
            engineRef.current.setMouseMode(mouseMode);
        }
    }, [mouseMode, isInitialized]);

    // FL Studio tarzı ultra-optimized viewport sync
    useEffect(() => {
        if (!engineRef.current || !isInitialized) return;

        let lastX = viewportX;
        let lastZoom = viewportZoom;
        let frameRequest = null;
        let isUpdating = false;

        const updateViewport = () => {
            if (isUpdating) return;

            const engine = engineRef.current;
            if (engine && engine.viewport) {
                const newX = engine.viewport.x;
                const newZoom = engine.viewport.zoom;

                // FL Studio precision: daha hassas threshold
                const xDiff = Math.abs(newX - lastX);
                const zoomDiff = Math.abs(newZoom - lastZoom);

                if (xDiff > 0.5 || zoomDiff > 0.005) {
                    isUpdating = true;

                    // Direct state update (React 18 auto-batches)
                    setViewportX(newX);
                    setViewportZoom(newZoom);

                    lastX = newX;
                    lastZoom = newZoom;

                    // FL Studio: 562 bar desteği için extended range tracking
                    const currentBar = Math.floor(newX / (4 * 12)); // 12px per beat
                    if (currentBar > 562) {
                        console.warn('🚨 FL: Beyond 562 bar limit:', currentBar);
                    }

                    setTimeout(() => { isUpdating = false; }, 16); // 60fps throttle
                }
            }
        };

        // RAF-based updates for smooth 60fps
        const rafUpdate = () => {
            updateViewport();
            frameRequest = requestAnimationFrame(rafUpdate);
        };

        updateViewport(); // Initial update
        frameRequest = requestAnimationFrame(rafUpdate);

        return () => {
            if (frameRequest) {
                cancelAnimationFrame(frameRequest);
            }
        };
    }, [isInitialized]);

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

    // FL Studio tarzı empty space click handler with CONSISTENT positioning
    const handleEmptySpaceClick = useCallback((worldX, worldY) => {
        if (!engineRef.current) return;

        const engine = engineRef.current;
        const { cellHeight, cellWidth } = engine.options;
        const { zoom } = engine.viewport;

        // CONSISTENT: Convert pixel position to beats
        // worldX is in pixels, we need beats
        const pixelsPerBeat = cellWidth * 4 * zoom; // 12px * 4 = 48px per beat at zoom=1
        const timeInBeats = worldX / pixelsPerBeat;

        // Snap to grid based on snap mode
        const snapFractions = {
            '1/1': 4,       // Whole note = 4 beats
            '1/2': 2,       // Half note = 2 beats
            '1/4': 1,       // Quarter note = 1 beat
            '1/8': 0.5,     // 8th note = 0.5 beats
            '1/16': 0.25,   // 16th note = 0.25 beats
            '1/32': 0.125,  // 32nd note = 0.125 beats
            '1/64': 0.0625  // 64th note = 0.0625 beats
        };
        const snapSize = snapFractions[snapMode] || 0.25;

        // Snap time to grid
        const snappedTime = Math.round(timeInBeats / snapSize) * snapSize;

        // CONSISTENT: Convert Y pixel to MIDI note
        const gridPitch = Math.round(worldY / (cellHeight * zoom));
        const midiNote = Math.max(12, Math.min(131, gridPitch + 12)); // C0-B9 range
        const noteName = midiToNoteName(midiNote);

        // Create note with CONSISTENT time value (in beats)
        const newNote = {
            id: Date.now() + Math.random(),
            time: Math.max(0, Math.min(562 * 4, snappedTime)), // Clamp to 562 bars
            pitch: noteName,
            duration: snapSize, // Duration matches snap grid
            velocity: 100
        };

        console.log('📝 FL Creating note:', newNote, 'snap:', snapMode);

        // Direct store update - no callbacks
        if (currentInstrumentId && activePatternId) {
            const currentNotes = notes || [];
            const updatedNotes = [...currentNotes, newNote];
            updatePatternNotes(activePatternId, currentInstrumentId, updatedNotes);
            console.log('📝 FL Note added at time:', newNote.time);

            // Hybrid: Force immediate render only if canvas mode
            if (renderMode === 'canvas' && engineRef.current && engineRef.current.forceImmediateRender) {
                engineRef.current.forceImmediateRender();
            }
        } else {
            console.warn('⚠️ FL Studio: No pattern or instrument selected');
        }
    }, [currentInstrumentId, activePatternId, notes, updatePatternNotes, snapMode, renderMode]);

    // HTML Note Handlers for Hybrid System
    const handleHtmlNoteDragStart = useCallback((note, _event) => {
        console.log('🎵 HTML Note drag start:', note.id);
        setSelectedNotes(new Set([note.id]));
    }, []);

    const handleHtmlNoteDrag = useCallback((note, position) => {
        // Convert pixel position back to beats and pitch
        if (!engineRef.current) return;

        const { cellWidth, cellHeight } = engineRef.current.options;
        const { zoom } = engineRef.current.viewport;
        const pixelsPerBeat = cellWidth * 4;

        const newTime = position.x / (pixelsPerBeat * zoom);
        const newPitch = Math.round(position.y / (cellHeight * zoom));

        // Snap to grid
        const snapFractions = {
            '1/64': 0.0625,
            '1/32': 0.125,
            '1/16': 0.25,
            '1/8': 0.5,
            '1/4': 1,
            '1': 4
        };
        const snapSize = snapFractions[snapMode] || 0.25;
        const snappedTime = Math.round(newTime / snapSize) * snapSize;

        // Update note in real-time (optimistic update)
        const updatedNote = {
            ...note,
            time: Math.max(0, snappedTime),
            pitch: Math.max(0, Math.min(119, newPitch))
        };

        // Visual feedback - update visible notes immediately
        setVisibleNotes(prev =>
            prev.map(n => n.id === note.id ? updatedNote : n)
        );
    }, [snapMode]);

    const handleHtmlNoteDragEnd = useCallback((note, _event) => {
        console.log('🎵 HTML Note drag end:', note.id);

        // Commit changes to store
        if (currentInstrumentId && activePatternId) {
            const currentNotes = notes || [];
            const draggedNote = visibleNotes.find(n => n.id === note.id);

            if (draggedNote) {
                const newMidiNote = Math.max(12, Math.min(131, draggedNote.pitch + 12));
                const newNoteName = midiToNoteName(newMidiNote);

                const updatedNotes = currentNotes.map(n =>
                    n.id === note.id ? {
                        ...n,
                        time: draggedNote.time,
                        pitch: newNoteName
                    } : n
                );

                updatePatternNotes(activePatternId, currentInstrumentId, updatedNotes);
            }
        }
    }, [currentInstrumentId, activePatternId, notes, visibleNotes, midiToNoteName, updatePatternNotes]);

    const handleHtmlNoteDelete = useCallback((note) => {
        console.log('🗑️ HTML Note delete:', note.id);

        if (currentInstrumentId && activePatternId) {
            const currentNotes = notes || [];
            const updatedNotes = currentNotes.filter(n => n.id !== note.id);
            updatePatternNotes(activePatternId, currentInstrumentId, updatedNotes);
        }
    }, [currentInstrumentId, activePatternId, notes, updatePatternNotes]);

    // Piano keyboard handlers
    const handleKeyClick = useCallback((key) => {
        console.log('🎹 Piano key clicked:', key.displayName, 'MIDI:', key.midi);
        // Could play preview sound or highlight key
        setActiveKeys(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key.midi)) {
                newSet.delete(key.midi);
            } else {
                newSet.add(key.midi);
            }
            return newSet;
        });
    }, []);

    const handleKeyHover = useCallback((key) => {
        if (key) {
            setHighlightedKeys(new Set([key.midi]));
        } else {
            setHighlightedKeys(new Set());
        }
    }, []);

    // Timeline handlers
    const handleTimeClick = useCallback((timeInfo) => {
        console.log('🕒 Timeline clicked:', timeInfo);
        // Could set playback position
    }, []);

    const handleSnapChange = useCallback((newSnapMode) => {
        setSnapMode(newSnapMode);
        // Update engine grid rendering
        if (engineRef.current && isInitialized) {
            engineRef.current.setSnapMode(newSnapMode);
        }
        console.log('📐 Snap mode changed to:', newSnapMode);
    }, [isInitialized]);


    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!engineRef.current) return;

            // Don't trigger shortcuts if user is typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    // Toggle playback
                    if (engineRef.current.playhead.isPlaying) {
                        engineRef.current.pause();
                    } else {
                        engineRef.current.play();
                    }
                    break;
                case 'Escape':
                    // Stop playback
                    engineRef.current.stop();
                    break;
                case 'Delete':
                case 'Backspace':
                    // Delete selected notes
                    // TODO: Implement note deletion for selected notes
                    break;
                case '+':
                case '=':
                    // Zoom in
                    engineRef.current.zoomToPoint(
                        engineRef.current.viewport.width / 2,
                        engineRef.current.viewport.height / 2,
                        1.2
                    );
                    break;
                case '-':
                    // Zoom out
                    engineRef.current.zoomToPoint(
                        engineRef.current.viewport.width / 2,
                        engineRef.current.viewport.height / 2,
                        0.8
                    );
                    break;
                case 'Home':
                    // Go to beginning
                    engineRef.current.stop();
                    engineRef.current.viewport.x = 0;
                    engineRef.current.invalidateAll();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className={`infinite-piano-roll ${className}`}>
            {/* Piano Roll Header */}
            <div className="piano-roll-header">
                <div className="instrument-info">
                    <h3>{instrument?.name || 'Piano Roll'}</h3>
                    <span className="note-count">{notes.length} notes</span>
                </div>

                {/* Performance Stats */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="performance-stats">
                        <span>FPS: {performanceStats.fps || 0}</span>
                        <span>Render: {(performanceStats.renderTime || 0).toFixed(1)}ms</span>
                        <span>Chunks: {performanceStats.activeChunks || 0}/{performanceStats.totalChunks || 0}</span>
                        <span>Zoom: {(performanceStats.viewportPosition?.zoom || 1).toFixed(2)}x</span>
                    </div>
                )}

                {/* Mouse Mode Selector */}
                <div className="piano-roll-modes">
                    <div className="mode-group">
                        <span className="mode-label">Tool:</span>
                        <button
                            onClick={() => setMouseMode('select')}
                            className={`mode-button ${mouseMode === 'select' ? 'active' : ''}`}
                            title="Select Mode - Drag notes horizontally & vertically"
                        >
                            🎯
                        </button>
                        <button
                            onClick={() => setMouseMode('write')}
                            className={`mode-button ${mouseMode === 'write' ? 'active' : ''}`}
                            title="Write Mode - Click to create notes"
                        >
                            ✏️
                        </button>
                        <button
                            onClick={() => setMouseMode('delete')}
                            className={`mode-button ${mouseMode === 'delete' ? 'active' : ''}`}
                            title="Delete Mode - Click notes to delete"
                        >
                            🗑️
                        </button>
                        <button
                            onClick={() => setMouseMode('slice')}
                            className={`mode-button ${mouseMode === 'slice' ? 'active' : ''}`}
                            title="Slice Mode - Click notes to split"
                        >
                            ✂️
                        </button>
                    </div>
                </div>

                {/* Playback Controls */}
                <div className="piano-roll-playback">
                    <button
                        onClick={() => engineRef.current?.play()}
                        title="Play (Space)"
                        className="playback-button play"
                    >
                        ▶️
                    </button>
                    <button
                        onClick={() => engineRef.current?.pause()}
                        title="Pause (Space)"
                        className="playback-button pause"
                    >
                        ⏸️
                    </button>
                    <button
                        onClick={() => engineRef.current?.stop()}
                        title="Stop"
                        className="playback-button stop"
                    >
                        ⏹️
                    </button>
                </div>

                {/* View Controls */}
                <div className="piano-roll-controls">
                    <button
                        onClick={() => engineRef.current?.zoomToPoint(
                            engineRef.current.viewport.width / 2,
                            engineRef.current.viewport.height / 2,
                            1.2
                        )}
                        title="Zoom In"
                    >
                        🔍+
                    </button>
                    <button
                        onClick={() => engineRef.current?.zoomToPoint(
                            engineRef.current.viewport.width / 2,
                            engineRef.current.viewport.height / 2,
                            0.8
                        )}
                        title="Zoom Out"
                    >
                        🔍-
                    </button>
                    <button
                        onClick={() => {
                            // Reset view
                            if (engineRef.current) {
                                engineRef.current.viewport.x = 0;
                                engineRef.current.viewport.y = 0;
                                engineRef.current.viewport.zoom = 1;
                                engineRef.current.invalidateAll();
                            }
                        }}
                        title="Reset View"
                    >
                        🏠
                    </button>
                </div>
            </div>

            {/* Main Content Area - FL Studio Layout */}
            <div className="piano-roll-workspace" style={{
                display: 'flex',
                flexDirection: 'column',
                height: '600px',
                position: 'relative',
                border: '1px solid #333'
            }}>
                {/* Timeline Header - Fixed at top */}
                <div className="piano-roll-timeline-container" style={{
                    display: 'flex',
                    height: '40px',
                    borderBottom: '1px solid #444',
                    backgroundColor: '#252525'
                }}>
                    {/* Empty corner space above keyboard */}
                    <div style={{
                        width: '80px',
                        height: '40px',
                        backgroundColor: '#1a1a1a',
                        borderRight: '1px solid #444',
                        borderBottom: '1px solid #444'
                    }} />

                    {/* Timeline */}
                    <div style={{
                        flex: 1,
                        height: '40px',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <Timeline
                            viewportX={viewportX}
                            viewportWidth={(containerRef.current?.clientWidth || 1200) - 80}
                            zoom={viewportZoom}
                            snapMode={snapMode}
                            onTimeClick={handleTimeClick}
                            onSnapChange={handleSnapChange}
                            className="piano-roll-timeline"
                            // FL Studio coordinate system parameters
                            cellWidth={12}         // 12 pixels = 1/16 note (FL compact)
                            ticksPerQuarter={480}  // Standard MIDI timing
                            beatsPerBar={4}        // 4/4 time signature
                            maxBars={562}          // FL Studio 562 bar limit
                            // FL Studio extended snap modes
                            supportedSnaps={['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/64']}
                            // Performance optimizations
                            virtualizeRuler={true} // Only render visible ruler marks
                            overlayMode={false}
                            // 10 octave support
                            totalPitchRange={120}  // 10 octaves = 120 semitones
                        />
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="piano-roll-content" style={{
                    display: 'flex',
                    flex: 1,
                    position: 'relative'
                }}>
                    {/* Piano Keyboard (Left Side) */}
                    <div className="piano-roll-keyboard" style={{
                        width: '80px',
                        height: '100%',
                        borderRight: '1px solid #444',
                        overflow: 'hidden',
                        backgroundColor: '#2a2a2a',
                        position: 'relative'
                    }}>
                        <PianoKeyboard
                            onKeyClick={handleKeyClick}
                            onKeyHover={handleKeyHover}
                            activeNotes={activeKeys}
                            highlightedKeys={highlightedKeys}
                            // FL Studio compact dimensions for 10 octaves
                            baseKeyHeight={12}        // Match FL cellHeight (12px per semitone)
                            baseWhiteKeyWidth={80}    // Fixed width
                            baseBlackKeyWidth={50}    // Fixed width
                            zoom={viewportZoom}
                            showLabels={true}
                            className="piano-keys"
                            // 10 oktav range: C0-B9 (MIDI 12-131)
                            startNote={12}            // C0 = MIDI 12
                            endNote={131}             // B9 = MIDI 131
                            totalOctaves={10}         // 10 full octaves
                            // FL Studio viewport sync
                            viewportY={engineRef.current?.viewport.y || 0}
                            // Performance: only render visible keys
                            virtualizeKeys={true}
                            visibleRange={60}         // 5 octaves visible at once
                        />
                    </div>

                    {/* Hybrid Container (Right Side) */}
                    <div
                        className="piano-roll-hybrid-container"
                        style={{
                            position: 'relative',
                            flex: 1,
                            backgroundColor: '#1a1a1a',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Canvas Layer - Grid only in hybrid mode */}
                        <div
                            ref={containerRef}
                            className="piano-roll-canvas"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                zIndex: 1
                            }}
                        />

                        {/* HTML Notes Layer - Only in hybrid/html mode */}
                        {(renderMode === 'hybrid' || renderMode === 'html') && (
                            <div
                                className="piano-roll-html-notes"
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    zIndex: 10,
                                    pointerEvents: renderMode === 'html' ? 'auto' : 'none', // Canvas handles events in hybrid
                                    transform: `translate(${-viewportX}px, ${-engineRef.current?.viewport.y || 0}px)`
                                }}
                            >
                                {visibleNotes.map(note => (
                                    <HtmlNoteElement
                                        key={note.id}
                                        note={{
                                            ...note,
                                            pitch: typeof note.pitch === 'string' ?
                                                noteNameToMidi(note.pitch) - 12 : note.pitch
                                        }}
                                        isSelected={selectedNotes.has(note.id)}
                                        onDragStart={handleHtmlNoteDragStart}
                                        onDrag={handleHtmlNoteDrag}
                                        onDragEnd={handleHtmlNoteDragEnd}
                                        onDelete={handleHtmlNoteDelete}
                                        cellWidth={12}
                                        cellHeight={12}
                                        zoom={viewportZoom}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Render Mode Toggle (Dev) */}
                        {process.env.NODE_ENV === 'development' && (
                            <div style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                zIndex: 1000,
                                display: 'flex',
                                gap: '4px'
                            }}>
                                {['canvas', 'hybrid', 'html'].map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setRenderMode(mode)}
                                        style={{
                                            padding: '4px 8px',
                                            fontSize: '10px',
                                            backgroundColor: renderMode === mode ? '#4CAF50' : '#333',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '2px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mode Styles */}
            <style>{`
                .piano-roll-modes {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 4px 8px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 6px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .mode-group {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .mode-label {
                    font-size: 11px;
                    color: #888;
                    margin-right: 4px;
                    font-weight: 600;
                }

                .mode-button {
                    padding: 6px 8px;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 32px;
                    height: 32px;
                }

                .mode-button:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.3);
                    transform: translateY(-1px);
                }

                .mode-button.active {
                    background: linear-gradient(135deg, #4CAF50, #45a049);
                    border-color: #4CAF50;
                    box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
                }

                .mode-button.active:hover {
                    background: linear-gradient(135deg, #45a049, #4CAF50);
                }

                /* Playback Controls */
                .piano-roll-playback {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 8px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 6px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .playback-button {
                    padding: 8px 12px;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 36px;
                    height: 36px;
                }

                .playback-button:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.3);
                    transform: translateY(-1px);
                }

                .playback-button.play:hover {
                    background: rgba(76, 175, 80, 0.2);
                    border-color: #4CAF50;
                }

                .playback-button.stop:hover {
                    background: rgba(244, 67, 54, 0.2);
                    border-color: #f44336;
                }
            `}</style>

            {/* Instructions */}
            <div className="piano-roll-instructions">
                {mouseMode === 'select' && (
                    <>
                        <span>🎯 Drag notes horizontally & vertically</span>
                        <span>⌨️ Shift+click for multi-select</span>
                        <span>🎪 Scroll to zoom, drag empty space to pan</span>
                    </>
                )}
                {mouseMode === 'write' && (
                    <>
                        <span>✏️ Click empty space to create notes</span>
                        <span>🎪 Scroll to zoom, drag to pan</span>
                        <span>💡 Notes snap to 16th note grid</span>
                    </>
                )}
                {mouseMode === 'delete' && (
                    <>
                        <span>🗑️ Click notes to delete them</span>
                        <span>🎪 Scroll to zoom, drag to pan</span>
                        <span>⚡ Instant deletion, no confirmation</span>
                    </>
                )}
                {mouseMode === 'slice' && (
                    <>
                        <span>✂️ Click notes to split them at cursor</span>
                        <span>🎪 Scroll to zoom, drag to pan</span>
                        <span>💡 Creates two notes from one</span>
                    </>
                )}
            </div>
        </div>
    );
};

export default InfinitePianoRoll;