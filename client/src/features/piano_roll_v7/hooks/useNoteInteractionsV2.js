// Piano Roll v7 Note Interactions Hook V2 - Sıfırdan tasarım
// ArrangementStore merkezli, işlevsellik odaklı
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useArrangementStore } from '@/store/useArrangementStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { getPreviewManager } from '@/lib/audio/preview';
import { getToolManager, TOOL_TYPES } from '@/lib/piano-roll-tools';
import EventBus from '@/lib/core/EventBus.js';
import { premiumNoteRenderer } from '../renderers/noteRenderer';
import {
    getCommandStack,
    AddNoteCommand,
    DeleteNotesCommand,
    UpdateNoteCommand,
    MoveNotesCommand,
    BatchCommand
} from '@/lib/piano-roll-tools/CommandStack';

const RULER_HEIGHT = 30;
const KEYBOARD_WIDTH = 80;

// Debug mode - set to false for production
const DEBUG_MODE = true; // ✅ Temporarily enabled for multi-resize debugging

// ✅ KEYBOARD PIANO MAPPING - Computer keyboard keys to MIDI pitches
// 3 octaves starting from C4 (MIDI 60-95)
// Piano-style layout: white keys on letter keys, black keys on number/upper row
const KEYBOARD_TO_PITCH = {
    // ===== OCTAVE 1: C4-B4 (MIDI 60-71) =====
    // Bottom row: ZXCVBNM
    'z': 60,   // C4
    'x': 62,   // D4
    'c': 64,   // E4
    'v': 65,   // F4
    'b': 67,   // G4
    'n': 69,   // A4
    'm': 71,   // B4
    ',': 72,   // C5

    // Black keys for octave 1 (between white keys)
    's': 61,   // C#4 (between Z-X)
    'd': 63,   // D#4 (between X-C)
    'g': 66,   // F#4 (between V-B)
    'h': 68,   // G#4 (between B-N)
    'j': 70,   // A#4 (between N-M)

    // ===== OCTAVE 2: C5-B5 (MIDI 72-83) =====
    // Middle row: ASDFGHJKL
    'a': 72,   // C5
    'f': 77,   // F5
    'k': 84,   // C6
    'l': 86,   // D6
    ';': 88,   // E6

    // Black keys for octave 2
    'w': 73,   // C#5
    'e': 75,   // D#5
    't': 78,   // F#5
    'y': 80,   // G#5
    'u': 82,   // A#5

    // ===== OCTAVE 3: C6-B6 (MIDI 84-95) =====
    // Top row: QWERTYUIOP
    'q': 84,   // C6
    'r': 89,   // F6
    'i': 96,   // C7
    'o': 98,   // D7
    'p': 100,  // E7
    '[': 101,  // F7
    ']': 103,  // G7

    // Black keys for octave 3
    '2': 85,   // C#6
    '3': 87,   // D#6
    '5': 90,   // F#6
    '6': 92,   // G#6
    '7': 94,   // A#6
    '9': 97,   // C#7
    '0': 99,   // D#7
    '=': 102   // F#7
};

// Helper: MIDI pitch to note name
function pitchToString(midiPitch) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiPitch / 12) - 1;
    const noteIndex = midiPitch % 12;
    return noteNames[noteIndex] + octave;
}

// Helper: Note length to duration
function lengthToDuration(length) {
    const durationMap = { 16: '1n', 8: '2n', 4: '4n', 2: '8n', 1: '16n', 0.5: '32n' };
    return durationMap[length] || '16n';
}

// Helper: Duration to note length
function durationToLength(duration) {
    if (typeof duration === 'number') return duration;
    const durationMap = { '1n': 16, '2n': 8, '4n': 4, '8n': 2, '16n': 1, '32n': 0.5 };
    return durationMap[duration] || 1;
}

// Helper: Note name to MIDI pitch
function stringToPitch(noteName) {
    if (typeof noteName === 'number') return noteName;
    const noteMap = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
    const match = noteName.match(/([A-G]#?)(\d+)/);
    if (!match) return 60; // Default to C4
    const [, note, octave] = match;
    return (parseInt(octave) + 1) * 12 + noteMap[note];
}

// Helper: Snap to grid
function snapToGrid(value, snapValue) {
    if (snapValue <= 0) return value;
    return Math.round(value / snapValue) * snapValue;
}

// Helper: Play preview using PreviewManager
// duration = null means sustain until stopNote is called (for keyboard piano)
// duration = number means auto-stop after that duration (for mouse clicks)
function playPreview(pitch, velocity = 100, duration = null) {
    const previewManager = getPreviewManager();
    if (previewManager) {
        previewManager.previewNote(pitch, velocity, duration);
    }
}

export function useNoteInteractionsV2(
    engine,
    activeTool = 'select',
    snapValue = 1,
    currentInstrument = null,
    loopRegion = null, // ✅ Loop region for Ctrl+D sync
    keyboardPianoMode = false // ✅ Keyboard piano mode toggle
) {
    // ✅ COMMAND STACK - Initialize undo/redo system
    const commandStackRef = useRef(null);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    // Initialize command stack on mount
    useEffect(() => {
        if (!commandStackRef.current) {
            commandStackRef.current = getCommandStack();

            // Subscribe to history changes
            const unsubscribe = commandStackRef.current.subscribe((info) => {
                setCanUndo(info.canUndo);
                setCanRedo(info.canRedo);
            });

            return () => unsubscribe();
        }
    }, []);

    // Local state - sadece UI için
    const [dragState, setDragState] = useState(null);
    const [hoveredNoteId, setHoveredNoteId] = useState(null);
    const [isSelectingArea, setIsSelectingArea] = useState(false);
    const [selectionArea, setSelectionArea] = useState(null);
    const [previewNote, setPreviewNote] = useState(null);
    const [slicePreview, setSlicePreview] = useState(null); // { x: number, noteId: string }
    const [sliceRange, setSliceRange] = useState(null); // { x: number, startY: number, endY: number, time: number, startPitch: number, endPitch: number }
    const [selectedNoteIds, setSelectedNoteIds] = useState(new Set());
    const [tempNotes, setTempNotes] = useState([]); // Real-time drag için geçici notalar
    const [lastDuplicateAction, setLastDuplicateAction] = useState(null); // Track last Ctrl+B action for sequential duplication
    const [lastNoteDuration, setLastNoteDuration] = useState(1); // Remember last note duration for smart note creation
    const [paintDragState, setPaintDragState] = useState(null); // { lastPitch: number, lastTime: number } for continuous painting
    const [rightClickDragState, setRightClickDragState] = useState(null); // { lastPitch: number, lastTime: number, deletedNotes: Set } for continuous deletion
    const [activeKeyboardNotes, setActiveKeyboardNotes] = useState(new Map()); // Track keyboard-triggered notes for preview playback
    const [contextMenuState, setContextMenuState] = useState(null); // { x: number, y: number, noteId: string | null }
    const [lastClickTime, setLastClickTime] = useState(0); // Track double-click timing
    const [lastClickedNoteId, setLastClickedNoteId] = useState(null); // Track last clicked note for double-click
    const [clipboard, setClipboard] = useState(null); // ✅ Clipboard: { notes: [], sourceTime: number }

    // ✅ PERFORMANCE: Use individual selectors instead of object/array selector
    // This prevents "getSnapshot should be cached" warnings and infinite loops
    const activePatternId = useArrangementStore(state => state.activePatternId);
    const patterns = useArrangementStore(state => state.patterns);
    const updatePatternNotes = useArrangementStore(state => state.updatePatternNotes);

    // Derive storedNotes from patterns using useMemo (stable reference)
    const storedNotes = useMemo(() => {
        if (!activePatternId || !currentInstrument) return [];
        const pattern = patterns[activePatternId];
        return pattern?.data?.[currentInstrument.id] || [];
    }, [patterns, activePatternId, currentInstrument]);

    // Get current pattern notes for instrument
    const getPatternNotes = useCallback(() => {
        return storedNotes;
    }, [storedNotes]);

    // Convert stored format to Piano Roll format for display
    const convertToPianoRollFormat = useCallback((storedNotes) => {
        return storedNotes.map(note => ({
            id: note.id,
            startTime: note.time || 0,
            pitch: typeof note.pitch === 'string' ? stringToPitch(note.pitch) : note.pitch,
            length: note.length || (note.duration ? durationToLength(note.duration) : 1),
            velocity: note.velocity || 100,
            instrumentId: currentInstrument?.id
        }));
    }, [currentInstrument]);

    // Memoize converted notes to avoid expensive recalculations on every mouse move
    const convertedNotes = useMemo(() => {
        const storedNotes = getPatternNotes();
        return convertToPianoRollFormat(storedNotes);
    }, [getPatternNotes, convertToPianoRollFormat]);

    // Get notes in Piano Roll format for display
    const notes = useCallback(() => {
        // Drag sırasında geçici notaları kullan
        if (tempNotes.length > 0) {
            return tempNotes;
        }

        return convertedNotes;
    }, [convertedNotes, tempNotes]);

    // Update pattern store with Piano Roll native format
    const updatePatternStore = useCallback((pianoRollNotes) => {
        if (!activePatternId || !currentInstrument) return;

        // Piano Roll format'ı direkt kullan - sadece key isimleri uygun hale getir
        const standardizedNotes = pianoRollNotes.map(note => ({
            id: note.id,
            time: note.startTime,       // Piano Roll: startTime → time
            pitch: note.pitch,          // Piano Roll: pitch (number) → pitch (number)
            velocity: note.velocity || 100,
            length: note.length         // Piano Roll: length → length (duration yerine)
        }));

        // Update pattern store
        updatePatternNotes(activePatternId, currentInstrument.id, standardizedNotes);
    }, [activePatternId, currentInstrument, updatePatternNotes]);

    // Coordinate conversion
    const getCoordinatesFromEvent = useCallback((e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        // Raw mouse coordinates relative to canvas
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;

        // Adjust for grid area (exclude keyboard and ruler)
        const gridX = rawX - KEYBOARD_WIDTH;
        const gridY = rawY - RULER_HEIGHT;

        // Engine'den stepWidth ve keyHeight değerlerini kullan
        const stepWidth = engine.dimensions?.stepWidth || 40;
        const keyHeight = engine.dimensions?.keyHeight || 20;

        // Convert to piano roll coordinates with stable viewport values
        const stableScrollX = engine.viewport?.scrollX || 0;
        const stableScrollY = engine.viewport?.scrollY || 0;
        
        const time = (gridX + stableScrollX) / stepWidth;
        // ✅ FIX: Don't round pitch - keep decimal precision for accurate hit detection
        // This allows clicking anywhere within the note's vertical space
        const pitch = 127 - (gridY + stableScrollY) / keyHeight;

        return { time, pitch, x: rawX, y: rawY };
    }, [engine]);

    // Find note at position - IMPROVED: Zoom-aware adaptive tolerance
    const findNoteAtPosition = useCallback((time, pitch) => {
        const currentNotes = notes();

        // ✅ ZOOM-AWARE TOLERANCE - Adaptive based on viewport zoom
        const zoomFactor = engine.viewport?.zoomX || 1;
        const zoomY = engine.viewport?.zoomY || 1;
        
        // ✅ IMPROVED: Dynamic base margin based on note density and zoom
        const baseTimeMargin = 0.15; // Increased to 15% for better hit detection
        const basePitchMargin = 0.35; // 35% pitch tolerance for easier clicking

        // As you zoom in, decrease tolerance (more precision)
        // As you zoom out, increase tolerance (easier to click)
        const adaptiveTimeMargin = baseTimeMargin / Math.max(1, Math.sqrt(zoomFactor));
        const adaptivePitchMargin = basePitchMargin / Math.max(1, Math.sqrt(zoomY));

        return currentNotes.find(note => {
            const noteEndTime = note.startTime + note.length;

            // ✅ ADAPTIVE TIME TOLERANCE - More generous
            const timeOverlap = time >= (note.startTime - adaptiveTimeMargin) &&
                               time <= (noteEndTime + adaptiveTimeMargin);

            // ✅ FULL NOTE HEIGHT COVERAGE - Click anywhere within note's exact vertical space
            // Note occupies exactly from (pitch - 0.5) to (pitch + 0.5)
            // No tolerance outside the note boundaries
            const notePitchMin = note.pitch - 0.5;
            const notePitchMax = note.pitch + 0.5;
            const pitchMatch = pitch >= notePitchMin && pitch <= notePitchMax;

            return timeOverlap && pitchMatch;
        });
    }, [notes, engine]);

    // Check if mouse is over resize handle
    const getResizeHandle = useCallback((mouseX, mouseY, note) => {
        const { viewport, dimensions } = engine;
        if (!viewport || !dimensions || !note) return null;

        const { stepWidth, keyHeight } = dimensions;

        const canvasX = mouseX - KEYBOARD_WIDTH;
        const canvasY = mouseY - RULER_HEIGHT;

        // World coordinates
        const worldX = viewport.scrollX + canvasX;
        const worldY = viewport.scrollY + canvasY;

        // Note position in renderer coordinates
        const noteX = Math.round(note.startTime * stepWidth);
        const noteY = Math.round((127 - note.pitch) * keyHeight);
        const noteWidth = Math.max(Math.round(stepWidth) - 1, Math.round(note.length * stepWidth) - 1);
        const noteHeight = Math.round(keyHeight) - 1;

        // ✅ PRECISE: Narrow resize zones only at edges for professional control
        const zoomFactor = viewport.zoomX || 1;
        
        // ✅ Generous move area - most of the note is for moving
        const minMoveArea = Math.max(noteWidth * 0.7, 20 / zoomFactor); // 70% minimum for move
        const maxZoneWidth = (noteWidth - minMoveArea) / 2; // Max 15% per side

        // ✅ Narrow, precise resize zones - only at the very edges
        let resizeZoneWidth;
        if (noteWidth < 20) {
            // Tiny notes: Fixed small zones
            resizeZoneWidth = Math.min(5 + (zoomFactor * 1.5), maxZoneWidth);
        } else if (noteWidth < 40) {
            // Small notes: 12-15% of width
            resizeZoneWidth = Math.min(noteWidth * 0.15, maxZoneWidth);
        } else if (noteWidth < 80) {
            // Medium notes: 12% of width
            resizeZoneWidth = Math.min(noteWidth * 0.12, maxZoneWidth);
        } else {
            // Large notes: 10% of width - very narrow and precise
            resizeZoneWidth = Math.min(noteWidth * 0.10, maxZoneWidth);
        }

        // ✅ Minimum zone for usability but keep it narrow
        const minZone = 5 + (zoomFactor * 1);
        resizeZoneWidth = Math.max(minZone, resizeZoneWidth);
        
        // ✅ Cap maximum resize zone to keep it at edges only
        resizeZoneWidth = Math.min(resizeZoneWidth, 15); // Never more than 15px

        // ✅ PRECISE: Resize handles only within note boundaries - no vertical overflow
        // Left handle (start time resize) - narrow edge zone
        const leftAreaX1 = noteX; // Start exactly at note boundary
        const leftAreaX2 = noteX + resizeZoneWidth; // Narrow zone from start
        const leftAreaY1 = noteY; // Exact note top - no overflow
        const leftAreaY2 = noteY + noteHeight; // Exact note bottom - no overflow

        // Right handle (end time/length resize) - narrow edge zone
        const rightAreaX1 = noteX + noteWidth - resizeZoneWidth; // Narrow zone from end
        const rightAreaX2 = noteX + noteWidth; // End exactly at note boundary
        const rightAreaY1 = noteY; // Exact note top - no overflow
        const rightAreaY2 = noteY + noteHeight; // Exact note bottom - no overflow

        // Debug zones (DISABLED - too verbose)
        // if (DEBUG_MODE) {
        //     const moveAreaWidth = noteWidth - (2 * resizeZoneWidth);
        //     console.log('🔧 Resize zones debug:', {
        //         noteGeometry: { x: noteX, y: noteY, width: noteWidth, height: noteHeight },
        //         mouse: { worldX, worldY },
        //         leftZone: { x1: leftAreaX1, x2: leftAreaX2, width: resizeZoneWidth },
        //         rightZone: { x1: rightAreaX1, x2: rightAreaX2, width: resizeZoneWidth },
        //         moveArea: { width: moveAreaWidth, percentage: ((moveAreaWidth / noteWidth) * 100).toFixed(1) + '%' },
        //         overlap: leftAreaX2 > rightAreaX1 ? '⚠️ OVERLAP!' : '✅ OK',
        //         strategy: noteWidth < 20 ? 'TINY' : noteWidth < 40 ? 'SMALL' : noteWidth < 80 ? 'MEDIUM' : 'LARGE'
        //     });
        // }

        // Resize priority: check handles first, then fallback to move
        const leftHit = worldX >= leftAreaX1 && worldX <= leftAreaX2 &&
                       worldY >= leftAreaY1 && worldY <= leftAreaY2;
        const rightHit = worldX >= rightAreaX1 && worldX <= rightAreaX2 &&
                        worldY >= rightAreaY1 && worldY <= rightAreaY2;

        // Left handle öncelikli (sol taraftan resize)
        if (leftHit) {
            return 'left';
        }

        // Right handle (sağ taraftan resize)
        if (rightHit) {
            return 'right';
        }

        return null;
    }, [engine]);

    // ✅ INTERNAL: Add note to store without command (for undo/redo)
    const _addNoteToStore = useCallback((note) => {
        const currentNotes = notes();
        updatePatternStore([...currentNotes, note]);
        premiumNoteRenderer.animateNote(note.id, 'added');

        // ✅ Emit NOTE_ADDED so PlaybackManager can schedule immediately during play
        try {
            EventBus.emit('NOTE_ADDED', {
                patternId: activePatternId,
                instrumentId: currentInstrument?.id,
                note
            });
        } catch (e) {
            // no-op
        }
    }, [notes, updatePatternStore, activePatternId, currentInstrument]);

    // ✅ INTERNAL: Add multiple notes to store without command (for undo/redo)
    const _addNotesToStore = useCallback((notesToAdd) => {
        const currentNotes = notes();
        updatePatternStore([...currentNotes, ...notesToAdd]);
        notesToAdd.forEach(note => premiumNoteRenderer.animateNote(note.id, 'added'));
    }, [notes, updatePatternStore]);

    // ✅ INTERNAL: Delete notes from store without command (for undo/redo)
    const _deleteNotesFromStore = useCallback((noteIds) => {
        const currentNotes = notes();
        const filteredNotes = currentNotes.filter(note => !noteIds.includes(note.id));
        updatePatternStore(filteredNotes);

        // Clear selection
        setSelectedNoteIds(prev => {
            const newSet = new Set(prev);
            noteIds.forEach(id => newSet.delete(id));
            return newSet;
        });
    }, [notes, updatePatternStore]);

    // Add new note WITH UNDO/REDO
    const addNote = useCallback((time, pitch, length = 1, velocity = 100, skipUndo = false) => {
        if (!currentInstrument) return;

        const snappedTime = snapValue > 0 ? snapToGrid(time, snapValue) : time;

        // Generate unique ID with timestamp + random + counter for same-millisecond safety
        const uniqueId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${performance.now()}`;

        const newNote = {
            id: uniqueId,
            startTime: Math.max(0, snappedTime),
            pitch: Math.max(0, Math.min(127, Math.round(pitch))),
            length: length,
            velocity: Math.max(1, Math.min(127, Math.round(velocity))), // ✅ Clamp to MIDI range
            instrumentId: currentInstrument.id
        };

        if (skipUndo) {
            // Bypass undo system (for paint brush continuous drawing)
            _addNoteToStore(newNote);
        } else {
            // ✅ USE COMMAND STACK for undo/redo
            const command = new AddNoteCommand(
                newNote,
                (note) => _addNoteToStore(note),
                (noteIds) => {
                    // ✅ FIXED: Immediate deletion for undo (no animation delay)
                    _deleteNotesFromStore(noteIds);
                }
            );
            commandStackRef.current?.execute(command);
        }

        if (DEBUG_MODE) console.log('➕ Note added:', newNote);
        return newNote;
    }, [currentInstrument, snapValue, notes, updatePatternStore, _addNoteToStore, _deleteNotesFromStore]);

    // ✅ INTERNAL: Update note in store without command (for undo/redo)
    const _updateNoteInStore = useCallback((noteId, updates) => {
        const currentNotes = notes();
        const updatedNotes = currentNotes.map(note =>
            note.id === noteId ? { ...note, ...updates } : note
        );
        updatePatternStore(updatedNotes);
    }, [notes, updatePatternStore]);

    // Update note WITH UNDO/REDO
    const updateNote = useCallback((noteId, updates, skipUndo = false) => {
        const currentNotes = notes();
        const targetNote = currentNotes.find(n => n.id === noteId);

        if (!targetNote) {
            console.warn('Note not found for update:', noteId);
            return;
        }

        // Store old state for undo
        const oldState = { ...targetNote };

        if (skipUndo) {
            // Bypass undo system
            _updateNoteInStore(noteId, updates);
        } else {
            // ✅ USE COMMAND STACK for undo/redo
            const command = new UpdateNoteCommand(
                noteId,
                oldState,
                { ...targetNote, ...updates },
                (id, state) => _updateNoteInStore(id, state)
            );
            commandStackRef.current?.execute(command);
        }

        if (DEBUG_MODE) console.log('📝 Note updated:', noteId, updates);
    }, [notes, _updateNoteInStore]);

    // Delete notes WITH UNDO/REDO
    const deleteNotes = useCallback((noteIds, skipUndo = false, skipAnimation = false) => {
        const currentNotes = notes();
        const notesToDelete = currentNotes.filter(note => noteIds.includes(note.id));

        if (notesToDelete.length === 0) {
            console.warn('No notes found to delete');
            return;
        }

        // ✅ FIXED: Animation only for user-initiated deletions, not undo/redo
        if (!skipAnimation) {
            noteIds.forEach(id => {
                premiumNoteRenderer.animateNote(id, 'deleted');
            });
        }

        const performDeletion = () => {
            if (skipUndo) {
                // Bypass undo system (used by undo/redo internally)
                _deleteNotesFromStore(noteIds);
            } else {
                // ✅ USE COMMAND STACK for undo/redo
                const command = new DeleteNotesCommand(
                    notesToDelete, // Store full note objects for undo
                    (ids) => _deleteNotesFromStore(ids),
                    (notesArray) => _addNotesToStore(notesArray)
                );
                commandStackRef.current?.execute(command);
            }
        };

        if (!skipAnimation) {
            // ✅ FIXED: Delay deletion to match animation duration (180ms - subtle)
            setTimeout(performDeletion, 180);
        } else {
            // Immediate deletion (for undo/redo)
            performDeletion();
        }

        if (DEBUG_MODE) console.log('🗑️ Notes deleted:', noteIds);
    }, [notes, _deleteNotesFromStore, _addNotesToStore]);

    // Slice note - Split note into two at given time position
    const sliceNote = useCallback((note, sliceTime) => {
        if (!note || sliceTime <= note.startTime || sliceTime >= (note.startTime + note.length)) {
            if (DEBUG_MODE) console.warn('🔪 Invalid slice position:', { sliceTime, note });
            return;
        }

        const snappedSliceTime = snapValue > 0 ? snapToGrid(sliceTime, snapValue) : sliceTime;
        const minNoteLength = 0.25; // Minimum note length (1/16th step)

        // Calculate new note lengths
        const firstNoteLength = snappedSliceTime - note.startTime;
        const secondNoteStart = snappedSliceTime;
        const secondNoteLength = (note.startTime + note.length) - snappedSliceTime;

        // ✅ IMPROVED VALIDATION: Check against minimum note length
        if (firstNoteLength < minNoteLength || secondNoteLength < minNoteLength) {
            if (DEBUG_MODE) console.warn('🔪 Slice would create notes too small:', {
                firstLength: firstNoteLength,
                secondLength: secondNoteLength,
                minLength: minNoteLength,
                originalLength: note.length
            });
            return;
        }

        // Create first note (original start to slice point)
        const firstNote = {
            ...note,
            length: firstNoteLength
        };

        // Create second note (slice point to original end)
        const secondNote = {
            ...note,
            id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            startTime: secondNoteStart,
            length: secondNoteLength
        };

        // Update pattern store - replace original with two new notes
        const currentNotes = notes();
        const updatedNotes = currentNotes
            .filter(n => n.id !== note.id) // Remove original
            .concat([firstNote, secondNote]); // Add both pieces

        updatePatternStore(updatedNotes);

        // Select both new notes
        setSelectedNoteIds(new Set([firstNote.id, secondNote.id]));

        if (DEBUG_MODE) console.log('🔪 Note sliced:', {
            original: { id: note.id, startTime: note.startTime, length: note.length },
            sliceTime: snappedSliceTime,
            firstNote: { id: firstNote.id, startTime: firstNote.startTime, length: firstNote.length },
            secondNote: { id: secondNote.id, startTime: secondNote.startTime, length: secondNote.length },
            totalLengthBefore: note.length,
            totalLengthAfter: firstNote.length + secondNote.length,
            conserved: Math.abs(note.length - (firstNote.length + secondNote.length)) < 0.001
        });
    }, [notes, updatePatternStore, snapValue, snapToGrid]);

    // Advanced slice - returns array of new notes without updating store
    const sliceNoteAdvanced = useCallback((note, sliceTime) => {
        if (!note || sliceTime <= note.startTime || sliceTime >= (note.startTime + note.length)) {
            return null;
        }

        const snappedSliceTime = snapValue > 0 ? snapToGrid(sliceTime, snapValue) : sliceTime;
        const minNoteLength = 0.25; // Minimum note length (1/16th step)

        // Calculate new note lengths
        const firstNoteLength = snappedSliceTime - note.startTime;
        const secondNoteStart = snappedSliceTime;
        const secondNoteLength = (note.startTime + note.length) - snappedSliceTime;

        // ✅ IMPROVED VALIDATION: Check against minimum note length
        if (firstNoteLength < minNoteLength || secondNoteLength < minNoteLength) {
            return null;
        }

        // Create first note (original start to slice point)
        const firstNote = {
            ...note,
            length: firstNoteLength
        };

        // Create second note (slice point to original end)
        const secondNote = {
            ...note,
            id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            startTime: secondNoteStart,
            length: secondNoteLength
        };

        return [firstNote, secondNote];
    }, [snapValue, snapToGrid]);

    // ✅ PITCH RANGE SLICE: Slice notes within pitch range at specific time
    const performPitchRangeSlice = useCallback((sliceTime, startPitch, endPitch) => {
        const currentNotes = notes();

        // Find all notes at slice time within pitch range
        const affectedNotes = currentNotes.filter(note => {
            const noteStart = note.startTime;
            const noteEnd = note.startTime + note.length;
            const notePitch = note.pitch;

            // Note must contain the slice time AND be within pitch range
            return (sliceTime > noteStart && sliceTime < noteEnd) &&
                   (notePitch >= Math.min(startPitch, endPitch) &&
                    notePitch <= Math.max(startPitch, endPitch));
        });

        if (affectedNotes.length === 0) {
            if (DEBUG_MODE) console.warn('🔪 No notes found at slice time within pitch range');
            return;
        }

        const snappedSliceTime = snapValue > 0 ? snapToGrid(sliceTime, snapValue) : sliceTime;
        const minNoteLength = 0.25; // Minimum note length

        // Slice each affected note
        const allNewNotes = [];
        const notesToRemove = [];

        affectedNotes.forEach(note => {
            const noteStart = note.startTime;
            const noteEnd = note.startTime + note.length;

            // Validate slice position
            if (snappedSliceTime <= noteStart || snappedSliceTime >= noteEnd) {
                allNewNotes.push(note); // Keep original if slice is outside
                return;
            }

            const firstNoteLength = snappedSliceTime - noteStart;
            const secondNoteLength = noteEnd - snappedSliceTime;

            // Check minimum lengths
            if (firstNoteLength < minNoteLength || secondNoteLength < minNoteLength) {
                if (DEBUG_MODE) console.warn('🔪 Slice would create notes too small for note:', note.id);
                allNewNotes.push(note); // Keep original
                return;
            }

            // Mark for removal and create two new notes
            notesToRemove.push(note.id);

            // First note (start to slice point)
            allNewNotes.push({
                ...note,
                length: firstNoteLength
            });

            // Second note (slice point to end)
            allNewNotes.push({
                ...note,
                id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                startTime: snappedSliceTime,
                length: secondNoteLength
            });
        });

        // Update pattern store
        const remainingNotes = currentNotes.filter(note =>
            !notesToRemove.includes(note.id)
        );

        const finalNotes = [...remainingNotes, ...allNewNotes];
        updatePatternStore(finalNotes);

        // Select all new note pieces
        const newNoteIds = allNewNotes
            .filter(note => !remainingNotes.find(rn => rn.id === note.id)) // Only truly new notes
            .map(note => note.id);

        setSelectedNoteIds(new Set(newNoteIds));

        if (DEBUG_MODE) console.log('🔪 Pitch range slice completed:', {
            sliceTime: snappedSliceTime,
            pitchRange: `${Math.min(startPitch, endPitch)} - ${Math.max(startPitch, endPitch)}`,
            affectedNotes: affectedNotes.length,
            newNotes: allNewNotes.length,
            lengthConservation: affectedNotes.map(note => {
                const newNotesForThis = allNewNotes.filter(n =>
                    n.pitch === note.pitch &&
                    n.startTime >= note.startTime &&
                    n.startTime < note.startTime + note.length
                );
                const totalNewLength = newNotesForThis.reduce((sum, n) => sum + n.length, 0);
                return {
                    originalId: note.id,
                    originalLength: note.length,
                    newPiecesLength: totalNewLength,
                    conserved: Math.abs(note.length - totalNewLength) < 0.001
                };
            })
        });
    }, [notes, updatePatternStore, snapValue, snapToGrid]);

    // ✅ SMART SELECTION OPERATIONS
    const selectNote = useCallback((noteId, addToSelection = false, toggle = false) => {
        setSelectedNoteIds(prev => {
            const newSet = addToSelection ? new Set(prev) : new Set();

            // ✅ TOGGLE MODE: Remove if exists, add if not (Ctrl+Click)
            if (toggle && prev.has(noteId)) {
                newSet.delete(noteId);
                if (DEBUG_MODE) console.log('🔘 Toggled note OFF:', noteId);
            } else {
                newSet.add(noteId);
                if (DEBUG_MODE && toggle) console.log('🔘 Toggled note ON:', noteId);
            }

            return newSet;
        });
    }, []);

    const deselectAll = useCallback(() => {
        setSelectedNoteIds(new Set());
        if (DEBUG_MODE) console.log('🔲 Deselected all notes');
    }, []);

    const selectAll = useCallback(() => {
        const currentNotes = notes();
        const allNoteIds = currentNotes.map(n => n.id);
        setSelectedNoteIds(new Set(allNoteIds));
        if (DEBUG_MODE) console.log('🔳 Selected all notes:', allNoteIds.length);
    }, [notes]);

    const invertSelection = useCallback(() => {
        const currentNotes = notes();
        const allNoteIds = new Set(currentNotes.map(n => n.id));
        const newSelection = new Set();

        allNoteIds.forEach(id => {
            if (!selectedNoteIds.has(id)) {
                newSelection.add(id);
            }
        });

        setSelectedNoteIds(newSelection);
        if (DEBUG_MODE) console.log('🔄 Inverted selection:', newSelection.size, 'notes now selected');
    }, [notes, selectedNoteIds]);

    // ✅ CLIPBOARD OPERATIONS
    const copyNotes = useCallback(() => {
        if (selectedNoteIds.size === 0) {
            if (DEBUG_MODE) console.warn('📋 Nothing to copy');
            return;
        }

        const currentNotes = notes();
        const selectedNotes = currentNotes.filter(n => selectedNoteIds.has(n.id));

        // Find earliest time for relative positioning
        const minTime = Math.min(...selectedNotes.map(n => n.startTime));

        setClipboard({
            notes: selectedNotes.map(note => ({
                ...note,
                // Store relative position from earliest note
                relativeTime: note.startTime - minTime
            })),
            sourceTime: minTime
        });

        if (DEBUG_MODE) console.log('📋 Copied', selectedNotes.length, 'notes');
    }, [notes, selectedNoteIds]);

    const cutNotes = useCallback(() => {
        if (selectedNoteIds.size === 0) {
            if (DEBUG_MODE) console.warn('✂️ Nothing to cut');
            return;
        }

        // Copy first
        copyNotes();

        // Then delete
        deleteNotes(Array.from(selectedNoteIds));

        if (DEBUG_MODE) console.log('✂️ Cut', selectedNoteIds.size, 'notes');
    }, [selectedNoteIds, copyNotes, deleteNotes]);

    const pasteNotes = useCallback(() => {
        if (!clipboard || clipboard.notes.length === 0) {
            if (DEBUG_MODE) console.warn('📋 Clipboard empty');
            return;
        }

        if (!currentInstrument) {
            if (DEBUG_MODE) console.warn('📋 No instrument selected');
            return;
        }

        // Paste at playhead position if available, otherwise at original position
        const playhead = usePlaybackStore.getState().currentStep;
        const pasteTime = playhead || clipboard.sourceTime;

        // Create new notes with new IDs
        const newNotes = clipboard.notes.map(clipNote => ({
            ...clipNote,
            id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${performance.now()}`,
            startTime: pasteTime + clipNote.relativeTime,
            instrumentId: currentInstrument.id
        }));

        // ✅ USE BATCH COMMAND for undo/redo
        import('@/lib/piano-roll-tools/CommandStack').then(({ getCommandStack, BatchCommand, AddNoteCommand }) => {
            const commands = newNotes.map(note =>
                new AddNoteCommand(
                    note,
                    (n) => _addNoteToStore(n),
                    (noteIds) => _deleteNotesFromStore(noteIds)
                )
            );

            const batchCommand = new BatchCommand(commands, `Paste ${newNotes.length} note(s)`);
            getCommandStack().execute(batchCommand);
        });

        // Select pasted notes
        setSelectedNoteIds(new Set(newNotes.map(n => n.id)));

        if (DEBUG_MODE) console.log('📋 Pasted', newNotes.length, 'notes at time', pasteTime);
    }, [clipboard, currentInstrument, _addNoteToStore, _deleteNotesFromStore]);

    // Mouse down handler
    const handleMouseDown = useCallback((e) => {
        const coords = getCoordinatesFromEvent(e);
        const foundNote = findNoteAtPosition(coords.time, coords.pitch);

        const toolManager = getToolManager();
        const currentTool = toolManager.getActiveTool();

        // ✅ RIGHT CLICK - Tool-aware behavior
        if (e.button === 2) { // Right mouse button
            if (currentTool === TOOL_TYPES.SELECT) {
                // SELECT TOOL: Show context menu
                setContextMenuState({
                    x: e.clientX,
                    y: e.clientY,
                    noteId: foundNote?.id || null,
                    coords: coords
                });
                if (DEBUG_MODE) console.log('📋 Context menu triggered:', foundNote?.id);
            } else if (e.shiftKey || currentTool === TOOL_TYPES.ERASER) {
                // SHIFT + RIGHT CLICK or ERASER TOOL: Quick delete with drag support
                const deletedNotes = new Set();
                if (foundNote) {
                    deleteNotes([foundNote.id]);
                    deletedNotes.add(foundNote.id);
                    if (DEBUG_MODE) console.log('🗑️ Right click delete:', foundNote.id);
                }

                // Start drag state for continuous deletion
                setRightClickDragState({
                    lastPitch: coords.pitch,
                    lastTime: coords.time,
                    deletedNotes, // Track already deleted notes to avoid duplicate calls
                    isDragging: true
                });
            }
            return; // Don't proceed with other handlers
        }

        // ✅ PAINT BRUSH TOOL - Draw notes by clicking or dragging, resize existing notes
        if (currentTool === TOOL_TYPES.PAINT_BRUSH) {
            if (foundNote) {
                // Check if clicking on resize handle
                const resizeHandle = getResizeHandle(coords.x, coords.y, foundNote);

                if (resizeHandle) {
                    // ✅ MULTI-NOTE RESIZE: If note is already selected, resize all selected notes
                    if (!selectedNoteIds.has(foundNote.id)) {
                        deselectAll();
                        selectNote(foundNote.id, false);
                    }

                    // Get all selected notes for multi-resize
                    const currentNotes = notes();
                    const selectedNotes = currentNotes.filter(n => selectedNoteIds.has(n.id));
                    
                    // Store original state of all selected notes
                    const originalNotes = new Map();
                    selectedNotes.forEach(note => {
                        originalNotes.set(note.id, {
                            startTime: note.startTime,
                            length: note.length,
                            pitch: note.pitch
                        });
                    });

                    setDragState({
                        type: 'resizing',
                        noteId: foundNote.id, // Primary note being resized
                        noteIds: selectedNotes.map(n => n.id), // All notes to resize
                        resizeHandle,
                        startCoords: coords,
                        originalNote: { ...foundNote },
                        originalNotes // Store all original states
                    });

                    if (DEBUG_MODE) console.log('🎨 Paint brush: Multi-resize started', resizeHandle, selectedNotes.length, 'notes');
                } else {
                    // Clicking on note body - preview sound and remember duration
                    playPreview(
                        foundNote.pitch,
                        foundNote.velocity || 100,
                        0.15 // Short duration for mouse clicks
                    );

                    // ✅ REMEMBER LAST DURATION - Save clicked note's length for next note
                    if (foundNote.length > 0) {
                        setLastNoteDuration(foundNote.length);
                        if (DEBUG_MODE) console.log('💾 Remembered note duration from paint brush click:', foundNote.length);
                    }
                }
            } else {
                // Add new note with last used duration
                const newNote = addNote(coords.time, coords.pitch, lastNoteDuration);
                if (newNote) {
                    // Start paint drag state for continuous drawing
                    setPaintDragState({
                        lastPitch: coords.pitch,
                        lastTime: coords.time,
                        isDragging: true
                    });

                    // Audio preview
                    playPreview(
                        newNote.pitch,
                        newNote.velocity || 100,
                        0.15 // Short duration for mouse clicks
                    );
                }
            }
        }
        // ✅ ERASER TOOL - Delete notes on click and drag
        else if (currentTool === TOOL_TYPES.ERASER) {
            if (foundNote) {
                deleteNotes([foundNote.id]);

                // Start eraser drag state for continuous deletion
                setPaintDragState({
                    lastPitch: coords.pitch,
                    lastTime: coords.time,
                    isDragging: true,
                    mode: 'erase'
                });
            }
        }
        // ✅ SELECT TOOL - Standard selection and manipulation
        else if (currentTool === TOOL_TYPES.SELECT) {
            if (foundNote) {
                // ✅ DOUBLE-CLICK DETECTION - Select all notes with same pitch
                const now = Date.now();
                const timeSinceLastClick = now - lastClickTime;
                const isDoubleClick = timeSinceLastClick < 300 && lastClickedNoteId === foundNote.id;

                if (isDoubleClick) {
                    // DOUBLE-CLICK: Select all notes with same pitch
                    const currentNotes = notes();
                    const samePitchNotes = currentNotes.filter(n => n.pitch === foundNote.pitch);
                    const samePitchIds = samePitchNotes.map(n => n.id);

                    setSelectedNoteIds(new Set(samePitchIds));

                    if (DEBUG_MODE) {
                        console.log('🎯🎯 Double-click: Selected', samePitchIds.length, 'notes at pitch', foundNote.pitch);
                    }

                    // Reset click tracking
                    setLastClickTime(0);
                    setLastClickedNoteId(null);
                    return; // Don't proceed with drag
                }

                // Update click tracking
                setLastClickTime(now);
                setLastClickedNoteId(foundNote.id);

                // Check for resize handle first
                const resizeHandle = getResizeHandle(coords.x, coords.y, foundNote);

                if (resizeHandle) {
                    // Start resizing
                    // ✅ MULTI-NOTE RESIZE: If note is already selected, resize all selected notes
                    if (!selectedNoteIds.has(foundNote.id)) {
                        deselectAll();
                        selectNote(foundNote.id, false);
                    }

                    // Get all selected notes for multi-resize
                    const currentNotes = notes();
                    const selectedNotes = currentNotes.filter(n => selectedNoteIds.has(n.id));
                    
                    // Store original state of all selected notes
                    const originalNotes = new Map();
                    selectedNotes.forEach(note => {
                        originalNotes.set(note.id, {
                            startTime: note.startTime,
                            length: note.length,
                            pitch: note.pitch
                        });
                    });

                    if (DEBUG_MODE) {
                        console.log('🎯 Multi-resize started:', {
                            handle: resizeHandle,
                            primaryNoteId: foundNote.id,
                            totalNotes: selectedNotes.length,
                            coords
                        });
                    }

                    setDragState({
                        type: 'resizing',
                        noteId: foundNote.id, // Primary note being resized
                        noteIds: selectedNotes.map(n => n.id), // All notes to resize
                        resizeHandle,
                        startCoords: coords,
                        originalNote: { ...foundNote },
                        originalNotes // Store all original states
                    });
                } else {
                    // Start moving - reset duplicate memory
                    setLastDuplicateAction(null);

                    // ✅ REMEMBER LAST DURATION - Save clicked note's length for next note
                    if (foundNote.length > 0) {
                        setLastNoteDuration(foundNote.length);
                        if (DEBUG_MODE) console.log('💾 Remembered note duration from selection:', foundNote.length);
                    }

                    // ✅ SHIFT+DRAG TO DUPLICATE - Create copies if Shift is held
                    const isDuplicating = e.shiftKey;
                    const isToggling = e.ctrlKey || e.metaKey;
                    let duplicatedNoteIds = null;

                    // Determine which notes to work with
                    let workingNoteIds;
                    if (isDuplicating) {
                        // ✅ SHIFT+DRAG LOGIC FIX: Only duplicate what you click on
                        if (selectedNoteIds.size > 0 && selectedNoteIds.has(foundNote.id)) {
                            // Clicked note is part of selection - duplicate all selected
                            workingNoteIds = Array.from(selectedNoteIds);
                            if (DEBUG_MODE) console.log('📋 Shift+Drag: Clicked note IS in selection, duplicating all', selectedNoteIds.size, 'notes');
                        } else {
                            // Clicked note is NOT part of selection - duplicate ONLY clicked note
                            // (Ignore other selected notes - user wants to duplicate what they clicked)
                            workingNoteIds = [foundNote.id];
                            if (DEBUG_MODE) console.log('📋 Shift+Drag: Clicked note NOT in selection, duplicating ONLY clicked note');
                        }
                    } else {
                        // ✅ CTRL+CLICK TO TOGGLE - Add/remove from selection
                        if (isToggling) {
                            selectNote(foundNote.id, true, true); // addToSelection=true, toggle=true
                            return; // Don't start drag, just toggle selection
                        }

                        // Normal move: select note if needed
                        if (!selectedNoteIds.has(foundNote.id)) {
                            selectNote(foundNote.id, false); // Replace selection
                        }
                        workingNoteIds = selectedNoteIds.has(foundNote.id)
                            ? Array.from(selectedNoteIds)
                            : [foundNote.id];
                    }

                    let originalNotesForDrag = new Map();

                    if (isDuplicating) {
                        // Create duplicates of working notes
                        const currentNotes = notes();
                        const notesToDuplicate = currentNotes.filter(n => workingNoteIds.includes(n.id));

                        const newNotes = [];
                        duplicatedNoteIds = [];

                        notesToDuplicate.forEach(note => {
                            const uniqueId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${performance.now()}`;
                            const duplicatedNote = {
                                ...note,
                                id: uniqueId
                            };
                            newNotes.push(duplicatedNote);
                            duplicatedNoteIds.push(uniqueId);

                            // ✅ Store original position of duplicated note (same as original for now)
                            originalNotesForDrag.set(uniqueId, { startTime: note.startTime, pitch: note.pitch });
                        });

                        // Add duplicates to pattern
                        updatePatternStore([...currentNotes, ...newNotes]);

                        // Select the duplicated notes
                        setSelectedNoteIds(new Set(duplicatedNoteIds));

                        if (DEBUG_MODE) console.log('📋 Duplicated notes for dragging:', duplicatedNoteIds.length);
                    } else {
                        // Normal move: Store original positions
                        const currentNotes = notes();
                        const noteIds = selectedNoteIds.has(foundNote.id) ? Array.from(selectedNoteIds) : [foundNote.id];
                        noteIds.forEach(id => {
                            const note = currentNotes.find(n => n.id === id);
                            if (note) {
                                originalNotesForDrag.set(id, { startTime: note.startTime, pitch: note.pitch });
                            }
                        });
                    }

                    setDragState({
                        type: 'moving',
                        noteIds: isDuplicating ? duplicatedNoteIds : (selectedNoteIds.has(foundNote.id) ? Array.from(selectedNoteIds) : [foundNote.id]),
                        startCoords: coords,
                        originalNotes: originalNotesForDrag,
                        isDuplicating // Track if this is a duplicate operation
                    });

                    // Audio preview
                    playPreview(
                        foundNote.pitch,
                        foundNote.velocity || 100,
                        0.15 // Short duration for mouse clicks
                    );
                }
            } else {
                // Start area selection
                setIsSelectingArea(true);

                // Convert to pixel coordinates for renderer
                const stepWidth = engine.dimensions?.stepWidth || 40;
                const keyHeight = engine.dimensions?.keyHeight || 20;

                const pixelX = coords.time * stepWidth - engine.viewport.scrollX;
                const pixelY = (127 - coords.pitch) * keyHeight - engine.viewport.scrollY;

                setSelectionArea({
                    startCoords: coords,
                    endCoords: coords,
                    startX: pixelX,
                    startY: pixelY,
                    endX: pixelX,
                    endY: pixelY
                });
            }
        } else if (activeTool === 'eraser') {
            if (foundNote) {
                deleteNotes([foundNote.id]);
            }
        } else if (activeTool === 'slice') {
            if (foundNote) {
                // ✅ VERTICAL SLICE RANGE MODE: Start pitch range selection at time position
                const { stepWidth, keyHeight } = engine.dimensions || {};
                if (stepWidth && keyHeight) {
                    const sliceX = coords.time * stepWidth;
                    const startY = coords.y; // Raw screen Y coordinate

                    setSliceRange({
                        x: sliceX,
                        startY,
                        endY: startY, // Initially same position
                        time: coords.time,
                        startPitch: coords.pitch,
                        endPitch: coords.pitch,
                        isDragging: true
                    });

                    setDragState({
                        type: 'slicing',
                        startCoords: coords,
                        targetNote: foundNote
                    });

                    if (DEBUG_MODE) {
                        console.log('🔪 Vertical slice range started:', {
                            time: coords.time,
                            startPitch: coords.pitch,
                            note: foundNote.id
                        });
                    }
                }
            }
        }
    }, [
        getCoordinatesFromEvent,
        findNoteAtPosition,
        activeTool,
        addNote,
        selectedNoteIds,
        selectNote,
        notes,
        deleteNotes,
        sliceNote,
        sliceNoteAdvanced,
        currentInstrument
    ]);

    // Mouse move handler
    const handleMouseMove = useCallback((e) => {
        const coords = getCoordinatesFromEvent(e);
        const toolManager = getToolManager();
        const currentTool = toolManager.getActiveTool();

        // Update hover with cursor feedback
        const foundNote = findNoteAtPosition(coords.time, coords.pitch);
        setHoveredNoteId(foundNote?.id || null);

        // ✅ PAINT BRUSH PREVIEW & CONTINUOUS DRAWING - Show ghost note and draw while dragging
        if (currentTool === TOOL_TYPES.PAINT_BRUSH) {
            const snappedTime = snapToGrid(coords.time, snapValue);
            const { stepWidth } = engine.dimensions || {};

            // Continuous drawing while mouse is held down
            if (paintDragState && paintDragState.mode !== 'erase' && !foundNote) {
                const snappedCurrentTime = snapToGrid(coords.time, snapValue);
                const snappedLastTime = paintDragState.lastTime;

                // Only add note if we moved to a different grid position (pitch OR time)
                if (coords.pitch !== paintDragState.lastPitch ||
                    Math.abs(snappedCurrentTime - snappedLastTime) >= snapValue * 0.9) {

                    // ✅ DUPLICATE PREVENTION - Check if note already exists at this position
                    const existingNote = notes().find(n =>
                        Math.abs(n.startTime - snappedCurrentTime) < 0.01 &&
                        n.pitch === Math.round(coords.pitch)
                    );

                    if (!existingNote) {
                        // ✅ GAP FILLING - Interpolate between last and current position
                        const timeDelta = Math.abs(snappedCurrentTime - snappedLastTime);
                        const pitchDelta = Math.abs(coords.pitch - paintDragState.lastPitch);

                        // If moved more than 1 grid position, fill gaps
                        if (timeDelta > snapValue || pitchDelta > 1) {
                            const steps = Math.max(
                                Math.ceil(timeDelta / snapValue),
                                Math.ceil(pitchDelta)
                            );

                            for (let i = 0; i <= steps; i++) {
                                const ratio = i / steps;
                                const interpTime = snappedLastTime + (snappedCurrentTime - snappedLastTime) * ratio;
                                const interpPitch = Math.round(paintDragState.lastPitch + (coords.pitch - paintDragState.lastPitch) * ratio);

                                // Check if note exists at interpolated position
                                const interpSnappedTime = snapToGrid(interpTime, snapValue);
                                const existsAtInterp = notes().find(n =>
                                    Math.abs(n.startTime - interpSnappedTime) < 0.01 &&
                                    n.pitch === interpPitch
                                );

                                if (!existsAtInterp) {
                                    addNote(interpTime, interpPitch, lastNoteDuration, 100, true); // skipUndo=true for continuous drawing
                                }
                            }
                        } else {
                            // Single note at current position
                            const newNote = addNote(coords.time, coords.pitch, lastNoteDuration, 100, true); // skipUndo=true
                            if (newNote) {
                                // Audio preview
                                playPreview(
                                    newNote.pitch,
                                    newNote.velocity || 100,
                                    0.15 // Short duration for mouse clicks
                                );
                            }
                        }

                        // Update drag state with new position
                        setPaintDragState({
                            ...paintDragState,
                            lastPitch: coords.pitch,
                            lastTime: snappedCurrentTime
                        });
                    }
                }
            }

            // Show preview note
            if (!foundNote && stepWidth && coords.pitch >= 0 && coords.pitch <= 127) {
                setPreviewNote({
                    pitch: coords.pitch,
                    startTime: snappedTime,
                    length: lastNoteDuration, // Use last duration for preview
                    velocity: 0.8,
                    isPreview: true
                });
            } else {
                setPreviewNote(null);
            }
        } else if (currentTool !== TOOL_TYPES.PAINT_BRUSH) {
            setPreviewNote(null);
        }

        // ✅ RIGHT CLICK DRAG - Continuous deletion while right button held
        if (rightClickDragState && rightClickDragState.isDragging) {
            if (foundNote && !rightClickDragState.deletedNotes.has(foundNote.id)) {
                // Only delete if we haven't already deleted this note
                deleteNotes([foundNote.id]);
                rightClickDragState.deletedNotes.add(foundNote.id);

                // Update drag state with new position
                setRightClickDragState({
                    ...rightClickDragState,
                    lastPitch: coords.pitch,
                    lastTime: coords.time
                });

                if (DEBUG_MODE) console.log('🗑️ Right click drag delete:', foundNote.id);
            }
        }

        // ✅ ERASER HIGHLIGHT & CONTINUOUS DELETION - Highlight and delete while dragging
        if (currentTool === TOOL_TYPES.ERASER) {
            if (foundNote) {
                e.currentTarget.style.cursor = 'not-allowed';

                // Continuous deletion while mouse is held down
                if (paintDragState && paintDragState.mode === 'erase') {
                    // Only delete if we moved to a different note
                    if (coords.pitch !== paintDragState.lastPitch ||
                        Math.abs(coords.time - paintDragState.lastTime) >= snapValue) {

                        deleteNotes([foundNote.id]);

                        // Update drag state with new position
                        setPaintDragState({
                            ...paintDragState,
                            lastPitch: coords.pitch,
                            lastTime: coords.time
                        });
                    }
                }
            }
        }

        // Cursor feedback for better UX
        if (foundNote && currentTool === TOOL_TYPES.SELECT) {
            const resizeHandle = getResizeHandle(coords.x, coords.y, foundNote);
            if (resizeHandle) {
                e.currentTarget.style.cursor = 'ew-resize';
            } else {
                e.currentTarget.style.cursor = 'move';
            }
        } else if (activeTool === 'slice') {
            e.currentTarget.style.cursor = foundNote ? 'col-resize' : 'default';

            // ✅ SLICE PREVIEW: Show slice line when hovering over note
            if (foundNote) {
                const { stepWidth } = engine.dimensions || {};
                if (stepWidth) {
                    const sliceX = coords.time * stepWidth;
                    setSlicePreview({ x: sliceX, noteId: foundNote.id });
                }
            } else {
                setSlicePreview(null);
            }
        } else {
            e.currentTarget.style.cursor = 'default';
            setSlicePreview(null); // Clear slice preview for other tools
        }

        if (dragState?.type === 'slicing') {
            // ✅ VERTICAL SLICE RANGE DRAGGING: Update pitch range while dragging
            if (sliceRange) {
                const endY = coords.y; // Raw screen Y coordinate
                const endPitch = coords.pitch;

                // Calculate pitch range boundaries (always start to end direction)
                const actualStartY = Math.min(sliceRange.startY, endY);
                const actualEndY = Math.max(sliceRange.startY, endY);
                const actualStartPitch = Math.max(sliceRange.startPitch, endPitch); // Higher pitch = lower Y
                const actualEndPitch = Math.min(sliceRange.startPitch, endPitch);   // Lower pitch = higher Y

                setSliceRange({
                    ...sliceRange,
                    endY,
                    endPitch,
                    actualStartY,
                    actualEndY,
                    actualStartPitch,
                    actualEndPitch
                });

                if (DEBUG_MODE) {
                    console.log('🔪 Vertical slice range updated:', {
                        time: sliceRange.time,
                        pitchRange: `${actualEndPitch} - ${actualStartPitch}`,
                        height: actualStartPitch - actualEndPitch
                    });
                }
            }
        } else if (dragState?.type === 'moving') {
            // Calculate deltas
            const deltaTime = coords.time - dragState.startCoords.time;
            const deltaPitch = coords.pitch - dragState.startCoords.pitch;

            // Update dragState with current position for rendering
            // Don't update tempNotes here - only visual feedback via dragState
            setDragState(prev => ({
                ...prev,
                currentDelta: { deltaTime, deltaPitch }
            }));
        } else if (dragState?.type === 'resizing') {
            // Calculate delta for resize
            const deltaTime = coords.time - dragState.startCoords.time;

            // Update dragState with current delta for rendering
            // Don't update tempNotes here - only visual feedback via dragState
            setDragState(prev => ({
                ...prev,
                currentDelta: { deltaTime }
            }));
        } else if (isSelectingArea) {
            // Update selection area with pixel coordinates
            const stepWidth = engine.dimensions?.stepWidth || 40;
            const keyHeight = engine.dimensions?.keyHeight || 20;

            const pixelX = coords.time * stepWidth - engine.viewport.scrollX;
            const pixelY = (127 - coords.pitch) * keyHeight - engine.viewport.scrollY;

            setSelectionArea(prev => ({
                ...prev,
                endCoords: coords,
                endX: pixelX,
                endY: pixelY
            }));
        } else if (activeTool === 'pencil' && !dragState) {
            // Show preview note
            const snappedTime = snapValue > 0 ? snapToGrid(coords.time, snapValue) : coords.time;
            setPreviewNote({
                startTime: Math.max(0, snappedTime),
                pitch: Math.max(0, Math.min(127, Math.round(coords.pitch))),
                length: 1,
                velocity: 100
            });
        }
    }, [
        getCoordinatesFromEvent,
        findNoteAtPosition,
        getResizeHandle,
        dragState,
        isSelectingArea,
        activeTool,
        snapValue,
        notes,
        updatePatternStore,
        engine
    ]);

    // Mouse up handler
    const handleMouseUp = useCallback((e) => {
        // Finalize slice range operation
        if (dragState?.type === 'slicing' && sliceRange) {
            const { actualStartPitch, actualEndPitch, time } = sliceRange;

            // Perform pitch range slice if range was created
            if (actualStartPitch && actualEndPitch && actualStartPitch !== actualEndPitch) {
                performPitchRangeSlice(time, actualStartPitch, actualEndPitch);
            } else {
                // Single point slice if no range was created
                const targetNote = dragState.targetNote;
                if (targetNote) {
                    sliceNote(targetNote, time);
                }
            }

            // Clear slice range
            setSliceRange(null);
        }
        // ✅ MOVE OPERATION WITH UNDO/REDO
        else if (dragState?.type === 'moving' && dragState.currentDelta) {
            // Get original positions from dragState
            const originalPositions = new Map(dragState.originalNotes);
            const noteIds = dragState.noteIds;
            const { deltaTime, deltaPitch } = dragState.currentDelta;

            // Calculate final positions from currentDelta
            const finalPositions = new Map();
            const storedNotes = getPatternNotes();
            const baseNotes = convertToPianoRollFormat(storedNotes);
            
            noteIds.forEach(noteId => {
                const original = originalPositions.get(noteId);
                if (original) {
                    let newTime = original.startTime + deltaTime;
                    let newPitch = original.pitch + deltaPitch;

                    // Snap to grid
                    if (snapValue > 0) {
                        newTime = snapToGrid(newTime, snapValue);
                    }

                    // Constrain values
                    newTime = Math.max(0, newTime);
                    newPitch = Math.max(0, Math.min(127, Math.round(newPitch)));

                    finalPositions.set(noteId, {
                        startTime: newTime,
                        pitch: newPitch
                    });
                }
            });

            // Check if notes actually moved
            let hasMoved = false;
            for (const [noteId, original] of originalPositions.entries()) {
                const final = finalPositions.get(noteId);
                if (final && (Math.abs(final.startTime - original.startTime) > 0.001 || final.pitch !== original.pitch)) {
                    hasMoved = true;
                    break;
                }
            }

            if (hasMoved) {
                // ✅ IMMEDIATE UPDATE - Apply changes instantly
                const currentNotes = notes();
                const updatedNotes = currentNotes.map(note => {
                    const final = finalPositions.get(note.id);
                    if (final) {
                        return { ...note, ...final };
                    }
                    return note;
                });
                
                // Update store immediately for smooth UX
                updatePatternStore(updatedNotes);

                // ✅ CREATE BATCH COMMAND for undo/redo (async is OK here)
                import('@/lib/piano-roll-tools/CommandStack').then(({ getCommandStack, BatchCommand, UpdateNoteCommand }) => {
                    const commands = [];

                    noteIds.forEach(noteId => {
                        const original = originalPositions.get(noteId);
                        const final = finalPositions.get(noteId);

                        if (original && final) {
                            const command = new UpdateNoteCommand(
                                noteId,
                                original, // old state
                                final, // new state
                                (id, state) => {
                                    const current = notes();
                                    const updated = current.map(n => n.id === id ? { ...n, ...state } : n);
                                    updatePatternStore(updated);
                                }
                            );
                            commands.push(command);
                        }
                    });

                    if (commands.length > 0) {
                        const batchCommand = new BatchCommand(commands, `Move ${noteIds.length} note(s)`);
                        getCommandStack().execute(batchCommand);
                    }
                });
            }
        }
        // ✅ MULTI-NOTE RESIZE OPERATION WITH UNDO/REDO
        else if (dragState?.type === 'resizing' && dragState.currentDelta) {
            const { deltaTime } = dragState.currentDelta;
            const minLength = 0.25;
            
            // ✅ Handle multi-note resize if noteIds exist
            const noteIds = dragState.noteIds || [dragState.noteId];
            const originalNotes = dragState.originalNotes || new Map([[dragState.noteId, dragState.originalNote]]);
            
            if (DEBUG_MODE) {
                console.log('🔍 Multi-resize mouseUp:', {
                    noteIds,
                    noteIdsCount: noteIds.length,
                    hasOriginalNotes: originalNotes.size,
                    deltaTime
                });
            }
            
            // Calculate final states for all selected notes
            const finalStates = new Map();
            const currentNotes = notes();
            
            noteIds.forEach(noteId => {
                const original = originalNotes.get(noteId);
                if (!original) {
                    if (DEBUG_MODE) console.warn('⚠️ No original state for note:', noteId);
                    return;
                }
                
                let resizedState = { ...original };

                if (dragState.resizeHandle === 'left') {
                    const originalEndTime = original.startTime + original.length;
                    let newStartTime = Math.max(0, original.startTime + deltaTime);

                    // Snap to grid
                    if (snapValue > 0) {
                        newStartTime = snapToGrid(newStartTime, snapValue);
                    }

                    let newLength = Math.max(minLength, originalEndTime - newStartTime);
                    resizedState.startTime = newStartTime;
                    resizedState.length = newLength;
                } else if (dragState.resizeHandle === 'right') {
                    const originalStartTime = original.startTime;
                    let newEndTime = originalStartTime + original.length + deltaTime;

                    // Snap to grid
                    if (snapValue > 0) {
                        newEndTime = snapToGrid(newEndTime, snapValue);
                    }

                    let newLength = Math.max(minLength, newEndTime - originalStartTime);
                    resizedState.length = newLength;
                }
                
                finalStates.set(noteId, resizedState);
                
                if (DEBUG_MODE) {
                    console.log('📊 Calculated final state for note:', noteId, {
                        original: { startTime: original.startTime, length: original.length },
                        resized: { startTime: resizedState.startTime, length: resizedState.length }
                    });
                }
            });

            // Check if any notes actually changed
            let hasChanged = false;
            for (const [noteId, finalState] of finalStates.entries()) {
                const original = originalNotes.get(noteId);
                if (original && (Math.abs(finalState.startTime - original.startTime) > 0.001 ||
                                Math.abs(finalState.length - original.length) > 0.001)) {
                    hasChanged = true;
                    break;
                }
            }

            if (hasChanged) {
                // ✅ IMMEDIATE UPDATE - Apply all changes instantly
                const currentNotes = notes();
                const updatedNotes = currentNotes.map(n => {
                    const finalState = finalStates.get(n.id);
                    if (finalState) {
                        return {
                            ...n,
                            startTime: finalState.startTime,
                            length: finalState.length
                        };
                    }
                    return n;
                });
                
                if (DEBUG_MODE) {
                    console.log('✅ Updating pattern store with resized notes:', {
                        totalNotes: currentNotes.length,
                        resizedNotes: finalStates.size,
                        updatedCount: updatedNotes.filter(n => finalStates.has(n.id)).length
                    });
                    
                    // Log the actual updated notes
                    updatedNotes.filter(n => finalStates.has(n.id)).forEach(note => {
                        console.log('📝 Updated note in array:', note.id, {
                            startTime: note.startTime,
                            length: note.length
                        });
                    });
                }
                
                // Update store immediately for smooth UX
                updatePatternStore(updatedNotes);

                // ✅ CREATE BATCH UPDATE COMMAND for undo/redo (async is OK here)
                // IMPORTANT: We already applied the changes above (immediate update)
                // So we need to add to history WITHOUT executing again
                import('@/lib/piano-roll-tools/MultiNoteCommand').then(({ BatchUpdateNotesCommand }) => {
                    import('@/lib/piano-roll-tools/CommandStack').then(({ getCommandStack }) => {
                        const noteUpdates = [];
                        
                        noteIds.forEach(noteId => {
                            const original = originalNotes.get(noteId);
                            const finalState = finalStates.get(noteId);
                            
                            if (original && finalState) {
                                noteUpdates.push({
                                    noteId,
                                    oldState: { startTime: original.startTime, length: original.length },
                                    newState: { startTime: finalState.startTime, length: finalState.length }
                                });
                            }
                        });
                        
                        if (noteUpdates.length > 0) {
                            // Create a custom update function that applies all changes at once
                            const updateFn = (updates) => {
                                const current = notes();
                                const updated = current.map(n => {
                                    const state = updates.get(n.id);
                                    return state ? { ...n, ...state } : n;
                                });
                                updatePatternStore(updated);
                            };
                            
                            const command = new BatchUpdateNotesCommand(
                                noteUpdates,
                                updateFn,
                                `Resize ${noteIds.length} note(s)`
                            );
                            
                            if (DEBUG_MODE) {
                                console.log('🔄 Adding to undo/redo history (without re-executing):', {
                                    updateCount: noteUpdates.length,
                                    noteIds: noteIds
                                });
                            }
                            
                            // ✅ Add to history WITHOUT executing (we already updated above)
                            const stack = getCommandStack();
                            stack.undoStack.push(command);
                            stack.redoStack = [];
                            if (stack.undoStack.length > stack.maxHistory) {
                                stack.undoStack.shift();
                            }
                        }
                    });
                });

                // ✅ REMEMBER LAST DURATION - Save primary resized note's length
                const primaryFinalState = finalStates.get(dragState.noteId);
                if (primaryFinalState && primaryFinalState.length > 0) {
                    setLastNoteDuration(primaryFinalState.length);
                    if (DEBUG_MODE) console.log('💾 Remembered note duration:', primaryFinalState.length, `(${noteIds.length} notes resized)`);
                }
            }
        }

        if (isSelectingArea && selectionArea) {
            // Finalize area selection
            const { startCoords, endCoords } = selectionArea;
            const minTime = Math.min(startCoords.time, endCoords.time);
            const maxTime = Math.max(startCoords.time, endCoords.time);
            const minPitch = Math.min(startCoords.pitch, endCoords.pitch);
            const maxPitch = Math.max(startCoords.pitch, endCoords.pitch);

            const currentNotes = notes();
            const notesInArea = currentNotes.filter(note => {
                const noteEndTime = note.startTime + note.length;
                const timeOverlap = note.startTime < maxTime && noteEndTime > minTime;
                const pitchInRange = note.pitch >= minPitch && note.pitch <= maxPitch;
                return timeOverlap && pitchInRange;
            });

            // Select notes in area
            if (e.ctrlKey || e.metaKey) {
                notesInArea.forEach(note => selectNote(note.id, true));
            } else {
                setSelectedNoteIds(new Set(notesInArea.map(note => note.id)));
            }
        }

        // Stop audio preview
        const previewManager = getPreviewManager();
        if (previewManager) {
            previewManager.stopPreview();
        }

        // Clear states
        setDragState(null);
        setIsSelectingArea(false);
        setSelectionArea(null);
        setPreviewNote(null);
        setSlicePreview(null);
        setSliceRange(null); // ✅ Clear slice range
        setTempNotes([]); // Clear temporary notes
        setPaintDragState(null); // ✅ Clear paint/erase drag state
        setRightClickDragState(null); // ✅ Clear right click drag state
    }, [isSelectingArea, selectionArea, notes, selectNote, dragState, tempNotes, updatePatternStore, performPitchRangeSlice, sliceNote, sliceRange]);

    // ✅ WHEEL HANDLER - Velocity and duration control
    const handleWheel = useCallback((e) => {
        const coords = getCoordinatesFromEvent(e);
        const foundNote = findNoteAtPosition(coords.time, coords.pitch);

        // Shift+Wheel: Change duration of hovered or selected notes
        if (e.shiftKey && (foundNote || selectedNoteIds.size > 0)) {
            // Try to prevent default (may fail in passive listeners)
            try {
                e.preventDefault();
                e.stopPropagation();
            } catch (err) {
                // Passive listener - can't prevent default
            }

            const delta = -e.deltaY; // Positive = scroll up = increase
            const step = 0.25; // 1/16th step increment
            const change = delta > 0 ? step : -step;

            if (foundNote && !selectedNoteIds.has(foundNote.id)) {
                // Change hovered note's duration
                const newLength = Math.max(0.25, foundNote.length + change);
                updateNote(foundNote.id, { length: newLength });
                setLastNoteDuration(newLength); // Remember for next note
                if (DEBUG_MODE) console.log('🎚️ Duration changed (hover):', foundNote.id, newLength);
            } else if (selectedNoteIds.size > 0) {
                // Change all selected notes' duration
                const currentNotes = notes();
                const updatedNotes = currentNotes.map(note => {
                    if (selectedNoteIds.has(note.id)) {
                        const newLength = Math.max(0.25, note.length + change);
                        return { ...note, length: newLength };
                    }
                    return note;
                });
                updatePatternStore(updatedNotes);

                // Remember the first selected note's new length
                const firstSelectedNote = updatedNotes.find(n => selectedNoteIds.has(n.id));
                if (firstSelectedNote) {
                    setLastNoteDuration(firstSelectedNote.length);
                }

                if (DEBUG_MODE) console.log('🎚️ Duration changed (selected):', selectedNoteIds.size, 'notes');
            }

            return true; // Event handled
        }

        // Normal Wheel (no modifiers): Change velocity of hovered note
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey && foundNote) {
            // Note: Can't preventDefault in passive listener, but we return true to signal handled

            const delta = -e.deltaY; // Positive = scroll up = increase
            const step = 5; // 5% increment (velocity is 0-100)
            const change = delta > 0 ? step : -step;

            const currentVelocity = foundNote.velocity || 100;
            const newVelocity = Math.max(1, Math.min(127, currentVelocity + change));

            updateNote(foundNote.id, { velocity: newVelocity });

            if (DEBUG_MODE) console.log('🎵 Velocity changed (hover):', foundNote.id, newVelocity);

            return true; // Event handled
        }

        return false; // Event not handled, allow viewport scroll
    }, [getCoordinatesFromEvent, findNoteAtPosition, selectedNoteIds, notes, updateNote, updatePatternStore]);

    // Key down handler
    const handleKeyDown = useCallback((e) => {
        const key = e.key.toLowerCase();

        // ✅ UNDO/REDO - Ctrl+Z / Ctrl+Y
        if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
            e.preventDefault();
            if (commandStackRef.current) {
                commandStackRef.current.undo();
            }
            return;
        }

        if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
            e.preventDefault();
            if (commandStackRef.current) {
                commandStackRef.current.redo();
            }
            return;
        }

        // ✅ SELECT ALL - Ctrl+A
        if ((e.ctrlKey || e.metaKey) && key === 'a') {
            e.preventDefault();
            selectAll();
            return;
        }

        // ✅ INVERT SELECTION - Ctrl+I
        if ((e.ctrlKey || e.metaKey) && key === 'i') {
            e.preventDefault();
            invertSelection();
            return;
        }

        // ✅ CLIPBOARD - Cut/Copy/Paste
        if ((e.ctrlKey || e.metaKey) && key === 'x') {
            e.preventDefault();
            cutNotes();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && key === 'c') {
            e.preventDefault();
            copyNotes();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && key === 'v') {
            e.preventDefault();
            pasteNotes();
            return;
        }

        // ✅ KEYBOARD PIANO MODE - Only active when mode is ON
        // This prevents conflicts with shortcuts
        if (keyboardPianoMode && currentInstrument) {
            const pitch = KEYBOARD_TO_PITCH[key];

            if (pitch !== undefined) {
                // Prevent repeat events from key hold
                if (e.repeat) return;

                e.preventDefault();

                // Play audio preview using PreviewManager
                playPreview(pitch, 100);

                // Track active keyboard note
                setActiveKeyboardNotes(prev => new Map(prev).set(key, { pitch, startTime: Date.now() }));

                if (DEBUG_MODE) console.log('⌨️ Keyboard note played:', key, pitch);

                return; // Don't process any other keys in piano mode
            }
        }

        // ✅ TOOL EXECUTION - Execute active tool on selected notes
        const toolManager = getToolManager();
        const currentTool = toolManager.getActiveTool();

        // Pattern generation tools require selection
        if (selectedNoteIds.size > 0 && e.altKey) {
            const currentNotes = notes();
            const selectedNotes = currentNotes.filter(note => selectedNoteIds.has(note.id));

            // Convert to tool format
            const toolNotes = selectedNotes.map(note => ({
                id: note.id,
                pitch: note.pitch,
                time: note.startTime,
                duration: note.length,
                velocity: note.velocity
            }));

            let result = null;

            // Execute tool based on current tool and key
            if (currentTool === TOOL_TYPES.CHOPPER && (e.key === 'c' || e.key === 'C')) {
                e.preventDefault();
                const tool = toolManager.getTool(TOOL_TYPES.CHOPPER);
                result = tool.chopNotes(toolNotes);
            } else if (currentTool === TOOL_TYPES.STRUMIZER && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                const tool = toolManager.getTool(TOOL_TYPES.STRUMIZER);
                result = tool.strumNotes(toolNotes);
            } else if (currentTool === TOOL_TYPES.ARPEGGIATOR && (e.key === 'a' || e.key === 'A')) {
                e.preventDefault();
                const tool = toolManager.getTool(TOOL_TYPES.ARPEGGIATOR);
                result = tool.arpeggiate(toolNotes);
            } else if (currentTool === TOOL_TYPES.FLAM && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                const tool = toolManager.getTool(TOOL_TYPES.FLAM);
                result = tool.flamNotes(toolNotes);
            } else if (currentTool === TOOL_TYPES.RANDOMIZER && (e.key === 'r' || e.key === 'R')) {
                e.preventDefault();
                const tool = toolManager.getTool(TOOL_TYPES.RANDOMIZER);
                result = tool.randomizeNotes(toolNotes);
            } else if (currentTool === TOOL_TYPES.FLIP && (e.key === 'l' || e.key === 'L')) {
                e.preventDefault();
                const tool = toolManager.getTool(TOOL_TYPES.FLIP);
                result = tool.flipNotes(toolNotes);
            }

            // Apply tool result
            if (result && result.action === 'replace') {
                // Delete original notes
                deleteNotes(Array.from(selectedNoteIds));

                // Add new notes from tool
                const newNoteIds = [];
                result.notes.forEach(toolNote => {
                    const newNote = addNote(
                        toolNote.time,
                        toolNote.pitch,
                        toolNote.duration,
                        toolNote.velocity
                    );
                    if (newNote) {
                        newNoteIds.push(newNote.id);
                    }
                });

                // Select new notes
                if (newNoteIds.length > 0) {
                    setSelectedNoteIds(new Set(newNoteIds));
                }
                return; // Tool executed, don't process other keys
            }
        }

        // ✅ ARROW KEYS - Move selected notes
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            if (selectedNoteIds.size > 0) {
                e.preventDefault();

                const currentNotes = notes();
                const selectedNotes = currentNotes.filter(note => selectedNoteIds.has(note.id));

                let pitchDelta = 0;
                let timeDelta = 0;

                if (e.key === 'ArrowUp') {
                    // Shift + Up/Down: semitone (1 pitch)
                    // Ctrl/Cmd + Up/Down: octave (12 pitches)
                    pitchDelta = (e.ctrlKey || e.metaKey) ? 12 : (e.shiftKey ? 1 : 0);
                } else if (e.key === 'ArrowDown') {
                    pitchDelta = (e.ctrlKey || e.metaKey) ? -12 : (e.shiftKey ? -1 : 0);
                } else if (e.key === 'ArrowRight') {
                    // Shift + Right/Left: step by step (1 step)
                    // Ctrl/Cmd + Right/Left: bar by bar (16 steps)
                    timeDelta = (e.ctrlKey || e.metaKey) ? 16 : (e.shiftKey ? 1 : 0);
                } else if (e.key === 'ArrowLeft') {
                    timeDelta = (e.ctrlKey || e.metaKey) ? -16 : (e.shiftKey ? -1 : 0);
                }

                // Only update if there's a delta
                if (pitchDelta !== 0 || timeDelta !== 0) {
                    const updatedNotes = currentNotes.map(note => {
                        if (selectedNoteIds.has(note.id)) {
                            return {
                                ...note,
                                pitch: Math.max(0, Math.min(127, note.pitch + pitchDelta)),
                                startTime: Math.max(0, note.startTime + timeDelta)
                            };
                        }
                        return note;
                    });

                    updatePatternStore(updatedNotes);

                    // Trigger modified animation for moved notes
                    selectedNotes.forEach(note => {
                        premiumNoteRenderer.animateNote(note.id, 'modified');
                    });

                    if (DEBUG_MODE) console.log('🎹 Notes moved:', { pitchDelta, timeDelta });
                }
            }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedNoteIds.size > 0) {
                deleteNotes(Array.from(selectedNoteIds));
            }
        } else if (e.key === 'Escape') {
            deselectAll();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            const currentNotes = notes();
            setSelectedNoteIds(new Set(currentNotes.map(note => note.id)));
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
            // ✅ Ctrl+D / Cmd+D - Smart duplicate with loop region sync
            e.preventDefault();

            if (selectedNoteIds.size > 0) {
                const currentNotes = notes();
                const selectedNotes = currentNotes.filter(note => selectedNoteIds.has(note.id));

                // Find the rightmost edge of selection
                const maxEndTime = Math.max(...selectedNotes.map(note =>
                    (typeof note.startTime === 'number' ? note.startTime : 0) +
                    (typeof note.length === 'number' ? note.length : 0)
                ));

                // Find the leftmost start of selection
                const minStartTime = Math.min(...selectedNotes.map(note =>
                    typeof note.startTime === 'number' ? note.startTime : 0
                ));

                let offset;

                // ✅ LOOP REGION SYNC: If loop region is active, use its length
                if (loopRegion && loopRegion.start !== undefined && loopRegion.end !== undefined) {
                    // Calculate loop region length
                    const loopLength = loopRegion.end - loopRegion.start;
                    offset = loopLength;

                    if (DEBUG_MODE) console.log('📋 Ctrl+D: Using loop region length:', loopLength, 'steps');
                } else {
                    // ✅ Default: Place after the selection ends (next beat boundary)
                    // Round maxEndTime to next beat boundary, then calculate offset from selection start
                    const stepsPerBeat = 4; // 16 steps / 4 beats = 4 steps per beat
                    const nextBeatStart = Math.ceil(maxEndTime / stepsPerBeat) * stepsPerBeat;

                    // Offset should be: where the copy starts minus where the original starts
                    offset = nextBeatStart - minStartTime;

                    if (DEBUG_MODE) console.log('📋 Ctrl+D: Beat-based offset', {
                        minStartTime,
                        maxEndTime,
                        nextBeatStart,
                        offset
                    });
                }

                const newNoteIds = [];
                const duplicatedNotes = [];

                selectedNotes.forEach(note => {
                    const uniqueId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${performance.now()}`;
                    const newStartTime = (typeof note.startTime === 'number' ? note.startTime : 0) + offset;

                    const duplicatedNote = {
                        ...note,
                        id: uniqueId,
                        startTime: newStartTime
                    };

                    duplicatedNotes.push(duplicatedNote);
                    newNoteIds.push(uniqueId);

                    if (DEBUG_MODE) console.log('📋 Duplicating note:', {
                        original: { id: note.id, startTime: note.startTime, pitch: note.pitch },
                        offset,
                        newStartTime,
                        duplicated: { id: uniqueId, startTime: newStartTime, pitch: note.pitch }
                    });
                });

                // Add all duplicated notes at once without snapping
                updatePatternStore([...currentNotes, ...duplicatedNotes]);

                // Select the duplicated notes
                if (newNoteIds.length > 0) {
                    setSelectedNoteIds(new Set(newNoteIds));
                }

                if (DEBUG_MODE) console.log('📋 Ctrl+D: Duplicated', newNoteIds.length, 'notes');
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            // Ctrl+B / Cmd+B - Sequential duplication with memory
            e.preventDefault();
            if (selectedNoteIds.size > 0) {
                const currentNotes = notes();
                const selectedNotes = currentNotes.filter(note => selectedNoteIds.has(note.id));

                // Check if this is a continuation of previous Ctrl+B
                let patternTemplate = null;
                let baseTime = 0;

                if (lastDuplicateAction &&
                    lastDuplicateAction.newNoteIds.length === selectedNoteIds.size &&
                    lastDuplicateAction.newNoteIds.every(id => selectedNoteIds.has(id))) {
                    // Continuing sequential duplication - use saved pattern template
                    patternTemplate = lastDuplicateAction.patternTemplate;
                    baseTime = lastDuplicateAction.lastEndTime;
                } else {
                    // New duplication sequence - create pattern template from selected notes
                    // Find the note that ends last (startTime + length)
                    const lastEndingNote = selectedNotes.reduce((max, note) => {
                        const noteTime = typeof note.startTime === 'number' ? note.startTime : 0;
                        const noteLength = typeof note.length === 'number' ? note.length : 0;
                        const noteEnd = noteTime + noteLength;

                        const maxTime = typeof max.startTime === 'number' ? max.startTime : 0;
                        const maxLength = typeof max.length === 'number' ? max.length : 0;
                        const maxEnd = maxTime + maxLength;

                        return noteEnd > maxEnd ? note : max;
                    }, selectedNotes[0]);

                    const lastNoteEnd = (typeof lastEndingNote.startTime === 'number' ? lastEndingNote.startTime : 0) +
                                       (typeof lastEndingNote.length === 'number' ? lastEndingNote.length : 0);
                    baseTime = lastNoteEnd;

                    // Create pattern template (pure data, no IDs)
                    const firstNoteTime = typeof selectedNotes[0].startTime === 'number' ? selectedNotes[0].startTime : 0;
                    patternTemplate = selectedNotes.map(note => ({
                        offsetTime: (typeof note.startTime === 'number' ? note.startTime : 0) - firstNoteTime,
                        pitch: typeof note.pitch === 'number' ? note.pitch : stringToPitch(note.pitch),
                        length: typeof note.length === 'number' ? note.length : durationToLength(note.length),
                        velocity: note.velocity || 100
                    }));
                }

                // Place directly after the end of the last note (no grid snapping for tighter placement)
                const targetTime = baseTime;

                const newNoteIds = [];
                let maxEndTime = targetTime;

                patternTemplate.forEach(template => {
                    // Create new note from template with velocity
                    const newNote = addNote(
                        targetTime + template.offsetTime,
                        template.pitch,
                        template.length,
                        template.velocity
                    );

                    if (newNote) {
                        newNoteIds.push(newNote.id);
                        // Track the end time of the last note in this duplication
                        const noteEnd = targetTime + template.offsetTime + template.length;
                        if (noteEnd > maxEndTime) {
                            maxEndTime = noteEnd;
                        }
                    }
                });

                // Save duplication memory with pattern template (no note references)
                setLastDuplicateAction({
                    patternTemplate: patternTemplate,
                    newNoteIds: newNoteIds,
                    lastEndTime: maxEndTime  // Save end time for next sequential duplication
                });

                // Select the newly created notes for next duplication
                if (newNoteIds.length > 0) {
                    setSelectedNoteIds(new Set(newNoteIds));
                }
            }
        }
        // Note: Spacebar handling will be added to PianoRoll.jsx component level
    }, [selectedNoteIds, deleteNotes, deselectAll, notes, snapValue, addNote, lastDuplicateAction, currentInstrument, lastNoteDuration]);

    // ✅ KEY UP HANDLER - Stop keyboard piano preview
    const handleKeyUp = useCallback((e) => {
        // Only process keyboard piano keys if mode is active
        if (!keyboardPianoMode) return;

        const key = e.key.toLowerCase();
        const pitch = KEYBOARD_TO_PITCH[key];

        if (pitch !== undefined) {
            e.preventDefault();

            // ✅ POLYPHONY FIX: Stop only the specific note, not all notes
            const previewManager = getPreviewManager();
            if (previewManager && previewManager.stopNote) {
                previewManager.stopNote(pitch);
            }

            // Remove from active keyboard notes
            setActiveKeyboardNotes(prev => {
                const newMap = new Map(prev);
                newMap.delete(key);
                return newMap;
            });

            if (DEBUG_MODE) console.log('⌨️ Keyboard note released:', key, pitch);
        }
    }, [keyboardPianoMode]);

    // ✅ CURSOR STATE - Calculate cursor based on priority hierarchy
    const getCursorState = useCallback(() => {
        // Priority 1: Right click deletion drag (highest)
        if (rightClickDragState?.isDragging) {
            return 'eraser';
        }

        // Priority 2: Paint brush continuous drawing
        if (paintDragState?.isDragging) {
            return 'paintBrush';
        }

        // Priority 3: Note dragging/moving
        if (dragState?.type === 'dragging') {
            return 'grabbing';
        }

        // Priority 4: Note resizing
        if (dragState?.type === 'resizing') {
            return 'ew-resize';
        }

        // Priority 5: Area selection
        if (isSelectingArea) {
            return 'crosshair';
        }

        // Priority 6: Default tool cursor
        return null; // Let CSS data-tool handle it
    }, [rightClickDragState, paintDragState, dragState, isSelectingArea]);

    return {
        // Event handlers
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleKeyDown,
        handleKeyUp, // ✅ NEW: Key up handler for keyboard piano
        handleWheel, // ✅ NEW: Wheel handler for velocity and duration control

        // State
        hoveredNoteId,
        selectedNoteIds,
        isSelectingArea,
        selectionArea,
        previewNote,
        slicePreview,
        sliceRange,
        rightClickDragState, // ✅ NEW: Right click drag state for deletion cursor
        dragState, // ✅ NEW: Drag state for cursor management
        paintDragState, // ✅ NEW: Paint drag state for cursor management
        cursorState: getCursorState(), // ✅ NEW: Computed cursor state
        contextMenuState, // ✅ NEW: Context menu state

        // Data
        notes: notes(),

        // Operations
        addNote,
        updateNote,
        deleteNotes,
        selectNote,
        deselectAll,
        selectAll, // ✅ NEW: Select all notes (Ctrl+A)
        invertSelection, // ✅ NEW: Invert selection (Ctrl+I)
        copyNotes, // ✅ NEW: Copy to clipboard (Ctrl+C)
        cutNotes, // ✅ NEW: Cut to clipboard (Ctrl+X)
        pasteNotes, // ✅ NEW: Paste from clipboard (Ctrl+V)
        updateNoteVelocity: (noteId, velocity) => {
            const currentNotes = notes();
            const note = currentNotes.find(n => n.id === noteId);
            if (note) {
                // ✅ FIX: Clamp velocity to MIDI range (1-127)
                // Piano roll uses MIDI format, not 0-1 range
                updateNote(noteId, { velocity: Math.max(1, Math.min(127, Math.round(velocity))) });
            }
        },

        // ✅ NEW: Undo/Redo operations
        undo: () => commandStackRef.current?.undo(),
        redo: () => commandStackRef.current?.redo(),
        canUndo,
        canRedo,
        clearContextMenu: () => setContextMenuState(null),
        clipboard // ✅ NEW: Clipboard state (for UI feedback)
    };
}