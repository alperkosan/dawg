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

    // Initialize canvas engine
    useEffect(() => {
        if (!containerRef.current || isInitialized) return;

        const engine = new InfiniteGridEngine({
            cellWidth: 16,       // Step width
            cellHeight: 20,      // Note height
            bufferSize: 100,     // Extended buffer for smooth scrolling
            chunkSize: 1000,     // Notes per chunk
            maxZoom: 8,          // Ultra zoom for precision
            minZoom: 0.1         // Wide overview
        });

        // Override note loading to use our data
        engine.getNotesInRange = (startTime, endTime) => {
            if (!currentInstrumentId || !activePattern) {
                console.log('🔍 getNotesInRange: No instrument or pattern');
                return [];
            }

            const instrumentNotes = activePattern.data[currentInstrumentId] || [];
            const filteredNotes = instrumentNotes.filter(note =>
                note.time >= startTime && note.time < endTime
            ).map(note => ({
                ...note,
                pitch: noteToPitchIndex(note.pitch || 'C4')
            }));

            console.log(`🔍 getNotesInRange(${startTime}-${endTime}): Found ${filteredNotes.length} notes`, filteredNotes);
            return filteredNotes;
        };

        // Set up drag & drop callbacks
        engine.onNoteDrag = (draggedNote, newPosition) => {
            console.log('🎵 Note dragged:', draggedNote.id, 'to:', newPosition);

            // Update note in store
            if (onNoteEdit) {
                const updatedNote = {
                    ...draggedNote,
                    time: newPosition.time,
                    pitch: pitchIndexToNote(newPosition.pitch)
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

    // Sync viewport with canvas engine
    useEffect(() => {
        if (!engineRef.current || !isInitialized) return;

        const updateViewport = () => {
            const engine = engineRef.current;
            if (engine && engine.viewport) {
                setViewportX(engine.viewport.x);
                setViewportZoom(engine.viewport.zoom);
            }
        };

        // Update immediately
        updateViewport();

        // Set up periodic sync (for smooth updates during interaction)
        const interval = setInterval(updateViewport, 100);

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

    // Empty space click handler for note creation
    const handleEmptySpaceClick = useCallback((worldX, worldY) => {
        // Snap to grid
        const time = Math.floor(worldX / 16) * 0.25; // 16th note grid
        const pitchIndex = Math.floor(worldY / 20);
        const pitch = pitchIndexToNote(pitchIndex);

        // Create new note
        const newNote = {
            id: Date.now(),
            time,
            pitch,
            duration: 0.25, // Default quarter note
            velocity: 100
        };

        console.log('📝 Creating note:', newNote, 'onNoteAdd callback:', !!onNoteAdd);

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
    }, [onNoteAdd, currentInstrumentId, activePatternId, notes, updatePatternNotes]);

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
        console.log('📐 Snap mode changed to:', newSnapMode);
    }, []);

    // Note to pitch index conversion (C4 = middle)
    const noteToPitchIndex = (note) => {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteName = note.replace(/\d/, '');
        const octave = parseInt(note.replace(/[^\d]/, '')) || 4;

        const baseIndex = noteNames.indexOf(noteName);
        return (octave * 12) + baseIndex;
    };

    const pitchIndexToNote = (index) => {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(index / 12);
        const noteIndex = index % 12;
        return `${noteNames[noteIndex]}${octave}`;
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!engineRef.current) return;

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    // Toggle playback
                    break;
                case 'Delete':
                case 'Backspace':
                    // Delete selected notes
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

                {/* Controls */}
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

            {/* Timeline */}
            <Timeline
                viewportX={viewportX}
                viewportWidth={containerRef.current?.clientWidth || 1200}
                zoom={viewportZoom}
                snapMode={snapMode}
                onTimeClick={handleTimeClick}
                onSnapChange={handleSnapChange}
                className="piano-roll-timeline"
            />

            {/* Main Content Area */}
            <div className="piano-roll-main" style={{ display: 'flex', height: '600px' }}>
                {/* Piano Keyboard (Left Side) */}
                <div className="piano-roll-keyboard" style={{
                    width: '120px',
                    height: '100%',
                    borderRight: '1px solid #555',
                    overflow: 'auto',
                    backgroundColor: '#2a2a2a'
                }}>
                    <PianoKeyboard
                        onKeyClick={handleKeyClick}
                        onKeyHover={handleKeyHover}
                        activeNotes={activeKeys}
                        highlightedKeys={highlightedKeys}
                        baseKeyHeight={12}
                        baseWhiteKeyWidth={80}
                        baseBlackKeyWidth={50}
                        zoom={viewportZoom}
                        showLabels={true}
                        className="piano-keys"
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