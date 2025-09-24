// Infinite Piano Roll - Canvas tabanlı ultra performanslı piano roll
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { InfiniteGridEngine } from '../lib/canvas/InfiniteGridEngine';
import { useInstrumentsStore } from '../store/useInstrumentsStore';
import { useArrangementStore } from '../store/useArrangementStore';
import PianoKeyboard from './PianoKeyboard';
import Timeline from './Timeline';

const InfinitePianoRoll = ({
    instrumentId = null, // Will use first available instrument if not provided
    onNoteAdd,
    onNoteEdit,
    onNoteDelete,
    className = ""
}) => {
    const containerRef = useRef(null);
    const engineRef = useRef(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [performanceStats, setPerformanceStats] = useState({});
    const [mouseMode, setMouseMode] = useState('select'); // select, write, delete, slice

    // Timeline and keyboard states
    const [snapMode, setSnapMode] = useState('1/16');
    const [viewportX, setViewportX] = useState(0);
    const [viewportZoom, setViewportZoom] = useState(1);
    const [activeKeys, setActiveKeys] = useState(new Set());
    const [highlightedKeys, setHighlightedKeys] = useState(new Set());

    // Store connections
    const { instruments } = useInstrumentsStore();
    const { patterns, activePatternId, updatePatternNotes } = useArrangementStore();

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
            // Unified coordinate system: X=time, Y=pitch
            cellWidth: 16,       // 16 pixels = 1/16th note (0.25 beats)
            cellHeight: 20,      // 20 pixels = 1 semitone (MIDI note)
            bufferSize: 100,     // Extended buffer for smooth scrolling
            chunkSize: 1000,     // Notes per chunk
            maxZoom: 8,          // Ultra zoom for precision
            minZoom: 0.1,        // Wide overview
            // Piano coordinate mapping
            totalPitchRange: 88, // 88 piano keys (A0 to C8)
            basePitchOffset: 21  // A0 = MIDI 21, maps to Y coordinate 0
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
                // Convert time to beats (assuming tick values, convert to reasonable beats)
                const timeInBeats = note.time / 16; // More aggressive conversion: /16 instead of /4
                return timeInBeats >= startTime && timeInBeats < endTime;
            }).map(note => {
                // Convert note name to MIDI number, then to grid Y coordinate
                const midiNote = noteNameToMidi(note.pitch || 'C4');
                const gridY = midiNote - 21; // A0 (MIDI 21) maps to Y=0

                // Convert time to beats (assuming tick values)
                const timeInBeats = note.time / 16; // More aggressive conversion: /16 instead of /4

                // Convert duration from string notation to beats
                let durationInBeats = 0.25; // default
                if (note.duration === '16n') durationInBeats = 0.25;  // 16th note
                else if (note.duration === '8n') durationInBeats = 0.5;   // 8th note
                else if (note.duration === '4n') durationInBeats = 1;     // quarter note
                else if (typeof note.duration === 'number') durationInBeats = note.duration;

                const convertedNote = {
                    ...note,
                    // Use direct coordinate mapping: X=time, Y=pitch
                    time: timeInBeats,         // X coordinate (in beats)
                    pitch: gridY,              // Y coordinate (semitones from A0)
                    duration: durationInBeats, // Duration in beats
                    velocity: note.velocity || 100, // Default velocity if missing
                    originalPitch: note.pitch, // Keep original note name
                    midiNote: midiNote         // Store MIDI number for reference
                };

                console.log('🎵 Converting note:', note, '→', convertedNote);
                return convertedNote;
            });

            console.log(`✅ getNotesInRange(${startTime}-${endTime}): Returning ${filteredNotes.length} notes`, filteredNotes);
            return filteredNotes;
        };

        // Set up drag & drop callbacks with unified coordinates
        engine.onNoteDrag = (draggedNote, newPosition) => {
            console.log('🎵 Note dragged:', draggedNote.id, 'to:', newPosition);

            if (onNoteEdit) {
                // Convert grid coordinates back to note format
                const newMidiNote = newPosition.pitch + 21; // Add base offset
                const newNoteName = midiToNoteName(newMidiNote);

                const updatedNote = {
                    ...draggedNote,
                    time: newPosition.time,        // X coordinate = time in beats
                    pitch: newNoteName,            // Convert Y back to note name
                    // Remove internal coordinate data
                    originalPitch: undefined,
                    midiNote: undefined
                };
                onNoteEdit(updatedNote);
            }
        };

        // Set up resize callback
        engine.onNoteResize = (resizedNote, newProperties) => {
            console.log('📏 Note resized:', resizedNote.id, 'new duration:', newProperties.duration);

            if (onNoteEdit) {
                const updatedNote = {
                    ...resizedNote,
                    duration: newProperties.duration,
                    // Remove internal coordinate data
                    originalPitch: undefined,
                    midiNote: undefined
                };
                onNoteEdit(updatedNote);
            }
        };

        // Set up empty space click callback for note creation
        engine.onEmptySpaceClick = (worldX, worldY) => {
            handleEmptySpaceClick(worldX, worldY);
        };

        // Set up delete callback
        engine.onNoteDelete = (note) => {
            console.log('🗑️ Deleting note:', note.id);
            if (onNoteDelete) {
                onNoteDelete(note);
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

    // Update notes when data changes
    useEffect(() => {
        if (!engineRef.current || !isInitialized) return;

        // Force reload all chunks with new data
        engineRef.current.world.chunks.clear();
        engineRef.current.updateVisibleChunks();
        engineRef.current.invalidateAll();
    }, [notes, isInitialized, currentInstrumentId, activePattern]);

    // Update engine mouse mode when state changes
    useEffect(() => {
        if (engineRef.current && isInitialized) {
            engineRef.current.setMouseMode(mouseMode);
        }
    }, [mouseMode, isInitialized]);

    // Optimized viewport sync - only update when changed
    useEffect(() => {
        if (!engineRef.current || !isInitialized) return;

        let lastX = viewportX;
        let lastZoom = viewportZoom;

        const updateViewport = () => {
            const engine = engineRef.current;
            if (engine && engine.viewport) {
                const newX = engine.viewport.x;
                const newZoom = engine.viewport.zoom;

                // Only update state if values actually changed
                if (Math.abs(newX - lastX) > 1 || Math.abs(newZoom - lastZoom) > 0.01) {
                    setViewportX(newX);
                    setViewportZoom(newZoom);
                    lastX = newX;
                    lastZoom = newZoom;
                }
            }
        };

        // Update immediately
        updateViewport();

        // Reduced frequency for performance
        const interval = setInterval(updateViewport, 50);

        return () => clearInterval(interval);
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

    // Empty space click handler with snap-aware coordinates
    const handleEmptySpaceClick = useCallback((worldX, worldY) => {
        if (!engineRef.current) return;

        const { cellHeight } = { cellHeight: 20 };
        const engine = engineRef.current;
        const snapConfig = engine.snapModes[snapMode] || engine.snapModes['1/16'];

        // Snap X to current snap mode
        const snapPixels = snapConfig.pixels;
        const snappedX = Math.round(worldX / snapPixels) * snapPixels;

        // Convert snapped X to time in beats
        const snapFractions = {
            '1/1': 4,      // Whole note = 4 beats
            '1/2': 2,      // Half note = 2 beats
            '1/4': 1,      // Quarter note = 1 beat
            '1/8': 0.5,    // 8th note = 0.5 beats
            '1/16': 0.25,  // 16th note = 0.25 beats
            '1/32': 0.125  // 32nd note = 0.125 beats
        };
        const beatValue = snapFractions[snapMode] || 0.25;
        const time = (snappedX / snapPixels) * beatValue;

        // Snap Y to semitone (always 20px per semitone)
        const gridPitch = Math.round(worldY / cellHeight);
        const midiNote = gridPitch + 21; // A0 = MIDI 21 = grid Y 0
        const noteName = midiToNoteName(midiNote);

        const newNote = {
            id: Date.now(),
            time: Math.max(0, time), // Ensure time >= 0
            pitch: noteName,
            duration: beatValue,     // Duration matches snap mode
            velocity: 100
        };

        console.log('📝 Creating note:', newNote, 'snap:', snapMode, 'at world:', { worldX, worldY }, 'snapped:', { snappedX, time, gridPitch });

        // Try provided callback first, then fallback to direct store update
        if (onNoteAdd) {
            onNoteAdd(newNote);
        } else if (currentInstrumentId && activePatternId) {
            // Direct store update
            const currentNotes = notes || [];
            const updatedNotes = [...currentNotes, newNote];
            updatePatternNotes(activePatternId, currentInstrumentId, updatedNotes);
            console.log('📝 Note added directly to store:', newNote);
        } else {
            console.warn('⚠️ No callback or store connection - note creation failed');
        }
    }, [onNoteAdd, currentInstrumentId, activePatternId, notes, updatePatternNotes, snapMode]);

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

    // Unified coordinate system: MIDI conversion functions
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

            {/* Main Content Area */}
            <div className="piano-roll-main" style={{ display: 'flex', height: '600px', position: 'relative' }}>
                {/* Piano Keyboard (Left Side) - Fixed position, scales only in height */}
                <div className="piano-roll-keyboard" style={{
                    width: '80px', // Fixed width matching baseWhiteKeyWidth
                    height: '100%',
                    borderRight: '1px solid #555',
                    overflow: 'hidden', // No scrolling needed
                    backgroundColor: '#2a2a2a',
                    position: 'relative'
                }}>
                    <PianoKeyboard
                        onKeyClick={handleKeyClick}
                        onKeyHover={handleKeyHover}
                        activeNotes={activeKeys}
                        highlightedKeys={highlightedKeys}
                        // Fixed dimensions, only height scales
                        baseKeyHeight={20}        // Match cellHeight from grid (20px per semitone)
                        baseWhiteKeyWidth={80}    // Fixed width
                        baseBlackKeyWidth={50}    // Fixed width
                        zoom={viewportZoom}
                        showLabels={true}
                        className="piano-keys"
                        // Pass viewport offset to sync with grid scrolling
                        viewportY={engineRef.current?.viewport.y || 0}
                    />
                </div>

                {/* Canvas Container (Right Side) */}
                <div
                    ref={containerRef}
                    className="piano-roll-canvas"
                    style={{
                        position: 'relative',
                        flex: 1,
                        backgroundColor: '#1a1a1a',
                        overflow: 'hidden'
                    }}
                />

                {/* Timeline Overlay - Positioned above the canvas */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '80px', // Start after keyboard
                    right: 0,
                    height: '60px', // Timeline height
                    zIndex: 100,
                    pointerEvents: 'none' // Allow clicks through to canvas
                }}>
                    <Timeline
                        viewportX={viewportX}
                        viewportWidth={(containerRef.current?.clientWidth || 1200) - 80} // Subtract keyboard width
                        zoom={viewportZoom}
                        snapMode={snapMode}
                        onTimeClick={handleTimeClick}
                        onSnapChange={handleSnapChange}
                        className="piano-roll-timeline-overlay"
                        // Unified coordinate system parameters
                        cellWidth={16}         // 16 pixels = 1/16 note (0.25 beats)
                        ticksPerQuarter={480}  // Standard MIDI timing
                        beatsPerBar={4}        // 4/4 time signature
                        // Make timeline clicks work through overlay
                        overlayMode={true}
                    />
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