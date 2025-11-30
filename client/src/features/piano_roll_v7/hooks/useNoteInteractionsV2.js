// Piano Roll v7 Note Interactions Hook V2 - Sıfırdan tasarım
// ArrangementStore merkezli, işlevsellik odaklı
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useArrangementStore } from '@/store/useArrangementStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { getPreviewManager } from '@/lib/audio/preview';
import { getToolManager, TOOL_TYPES } from '@/lib/piano-roll-tools';
import EventBus from '@/lib/core/EventBus.js';
import { premiumNoteRenderer } from '../renderers/noteRenderer';
import { calculatePatternLoopLength } from '@/lib/utils/patternUtils.js';
import {
    getCommandStack,
    AddNoteCommand,
    DeleteNotesCommand,
    UpdateNoteCommand,
    MoveNotesCommand,
    BatchCommand,
    TransposeNotesCommand,
    ToggleMuteCommand
} from '@/lib/piano-roll-tools/CommandStack';
import { midiInputContext } from '../state/MIDIInputContext';
import { ActionType } from '../state/ActionTypes';
import { migrateNoteToExtended } from '../utils/noteMigration';

const RULER_HEIGHT = 30;
const KEYBOARD_WIDTH = 80;

// Debug mode - set to false for production
const DEBUG_MODE = true; // ✅ Temporarily enabled for multi-resize debugging

// ✅ KEYBOARD PIANO MAPPING - Standard DAW Layout (FL Studio / Ableton Live style)
// 4 octaves: C4-C7 (MIDI 60-107) - Full range coverage
// Piano-style layout: white keys on letter keys, black keys between white keys
// Each key maps to exactly one MIDI note (no conflicts)
const KEYBOARD_TO_PITCH = {
    // ===== OCTAVE 1: C4-B4 (MIDI 60-71) =====
    // Bottom row: ZXCVBNM (white keys)
    'z': 60,   // C4
    'x': 62,   // D4
    'c': 64,   // E4
    'v': 65,   // F4
    'b': 67,   // G4
    'n': 69,   // A4
    'm': 71,   // B4

    // Black keys for octave 1 (between white keys)
    's': 61,   // C#4 (between Z-X)
    'd': 63,   // D#4 (between X-C)
    'g': 66,   // F#4 (between V-B)
    'h': 68,   // G#4 (between B-N)
    'j': 70,   // A#4 (between N-M)

    // ===== OCTAVE 2: C5-B5 (MIDI 72-83) =====
    // Middle row: ASDFGHJKL (white keys)
    'a': 72,   // C5
    'f': 74,   // D5
    'k': 76,   // E5
    'l': 77,   // F5
    ';': 79,   // G5
    "'": 81,   // A5
    '\\': 83,  // B5

    // Black keys for octave 2
    'w': 73,   // C#5
    'e': 75,   // D#5
    't': 78,   // F#5
    'y': 80,   // G#5
    'u': 82,   // A#5

    // ===== OCTAVE 3: C6-B6 (MIDI 84-95) =====
    // Top row: QWERTYUIOP[] (white keys)
    'q': 84,   // C6
    'r': 86,   // D6
    'i': 88,   // E6
    'o': 89,   // F6
    'p': 91,   // G6
    '[': 93,   // A6
    ']': 95,   // B6

    // Black keys for octave 3
    '2': 85,   // C#6
    '3': 87,   // D#6
    '5': 90,   // F#6
    '6': 92,   // G#6
    '7': 94,   // A#6

    // ===== OCTAVE 4: C7-B7 (MIDI 96-107) =====
    // Number row: 1234567890-= (white keys)
    '1': 96,   // C7
    '4': 98,   // D7
    '8': 100,  // E7
    '9': 101,  // F7
    '0': 103,  // G7
    '-': 105,  // A7
    '=': 107,  // B7

    // Black keys for octave 4 (using available keys)
    '`': 97,   // C#7
    '~': 99,   // D#7
    '!': 102,  // F#7
    '@': 104,  // G#7
    '#': 106,  // A#7
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
// ✅ Point-in-polygon algorithm (ray casting)
// Check if a point is inside a polygon
function isPointInPolygon(x, y, polygon) {
    if (!polygon || polygon.length < 3) return false;
    
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        
        // Ray casting algorithm: Check if ray from point crosses edge
        const intersect = ((yi > y) !== (yj > y)) && 
                         (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

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
    
    // ✅ ID Generation Counter - Prevent ID collisions
    const noteIdCounterRef = useRef(0);
    const generateUniqueNoteId = useCallback(() => {
        noteIdCounterRef.current += 1;
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 11);
        const counter = noteIdCounterRef.current;
        const perf = performance.now();
        return `note_${timestamp}_${random}_${counter}_${perf}`;
    }, []);

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

    // ✅ RESET cursor state when tool changes to prevent stuck cursors
    useEffect(() => {
        setCursorState('default');
    }, [activeTool]);

    // Local state - sadece UI için
    const [dragState, setDragState] = useState(null);
    const [hoveredNoteId, setHoveredNoteId] = useState(null);
    const [isSelectingArea, setIsSelectingArea] = useState(false);
    const [selectionArea, setSelectionArea] = useState(null); // { mode: 'rect' | 'lasso', startCoords, endCoords, startX, startY, endX, endY, path?: Array<{x, y}> }
    const [isSelectingTimeRange, setIsSelectingTimeRange] = useState(false); // ✅ Time-based selection from timeline
    const [timeRangeSelection, setTimeRangeSelection] = useState(null); // { startTime: number, endTime: number }
    const [previewNote, setPreviewNote] = useState(null);
    const [slicePreview, setSlicePreview] = useState(null); // { x: number, noteId: string }
    const [sliceRange, setSliceRange] = useState(null); // { x: number, startY: number, endY: number, time: number, startPitch: number, endPitch: number }
    const [selectedNoteIds, setSelectedNoteIds] = useState(new Set());
    const [tempNotes, setTempNotes] = useState([]); // Real-time drag için geçici notalar
    const [lastDuplicateAction, setLastDuplicateAction] = useState(null); // Track last Ctrl+B action for sequential duplication
    // ✅ NOTE: lastNoteDuration removed - now using MIDIInputContext for smart duration prediction
    const [paintDragState, setPaintDragState] = useState(null); // { lastPitch: number, lastTime: number } for continuous painting
    const [rightClickDragState, setRightClickDragState] = useState(null); // { lastPitch: number, lastTime: number, deletedNotes: Set } for continuous deletion
    const [activeKeyboardNotes, setActiveKeyboardNotes] = useState(new Map()); // Track keyboard-triggered notes for preview playback
    const [contextMenuState, setContextMenuState] = useState(null); // { x: number, y: number, noteId: string | null }
    const [lastClickTime, setLastClickTime] = useState(0); // Track double-click timing
    const [lastClickedNoteId, setLastClickedNoteId] = useState(null); // Track last clicked note for double-click
    const [clipboard, setClipboard] = useState(null); // ✅ Clipboard: { notes: [], sourceTime: number }
    const [slideSourceNoteId, setSlideSourceNoteId] = useState(null); // ✅ PHASE 3: Track source note for slide connection
    const [cursorState, setCursorState] = useState('default'); // ✅ REDESIGNED: Cursor state for enhanced feedback

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

    // ✅ Sync pattern length with MIDIInputContext
    useEffect(() => {
        if (activePatternId) {
            const pattern = patterns[activePatternId];
            const patternLength = calculatePatternLoopLength(pattern) || 64;
            midiInputContext.setPatternLength(patternLength);
        }
    }, [activePatternId, patterns]);

    // Get current pattern notes for instrument
    const getPatternNotes = useCallback(() => {
        return storedNotes;
    }, [storedNotes]);

    // Convert stored format to Piano Roll format for display
    // ✅ PHASE 1: Use migration utility for extended note support
    const convertToPianoRollFormat = useCallback((storedNotes) => {
        return storedNotes.map(note => {
            // Migrate to extended format first
            const migrated = migrateNoteToExtended(note);
            
            // Convert to Piano Roll display format
            return {
                id: migrated.id,
                startTime: migrated.time || migrated.startTime || 0,
                pitch: typeof migrated.pitch === 'string' ? stringToPitch(migrated.pitch) : migrated.pitch,
                length: migrated.length || (migrated.duration ? durationToLength(migrated.duration) : 1),
                visualLength: migrated.visualLength, // ✅ FL STUDIO STYLE: Preserve visualLength
                velocity: migrated.velocity || 100,
                isMuted: migrated.isMuted || false, // ✅ GHOST NOTES: Preserve mute state
                instrumentId: currentInstrument?.id,
                // ✅ PHASE 1: Extended properties
                pitchBend: migrated.pitchBend,
                modWheel: migrated.modWheel,
                aftertouch: migrated.aftertouch,
                pan: migrated.pan,
                releaseVelocity: migrated.releaseVelocity,
                slideTo: migrated.slideTo,
                slideDuration: migrated.slideDuration
            };
        });
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
        // ✅ PHASE 1: Include extended properties in storage
        const standardizedNotes = pianoRollNotes.map(note => ({
            id: note.id,
            time: note.startTime,       // Piano Roll: startTime → time
            pitch: note.pitch,          // Piano Roll: pitch (number) → pitch (number)
            velocity: note.velocity || 100,
            length: note.length,         // Piano Roll: length → length (duration yerine)
            visualLength: note.visualLength, // ✅ FL STUDIO STYLE: Preserve visualLength
            isMuted: note.isMuted || false,  // ✅ GHOST NOTES: Preserve mute state
            // ✅ PHASE 1: Extended properties (only if present to avoid bloating old notes)
            ...(note.pitchBend !== undefined && { pitchBend: note.pitchBend }),
            ...(note.modWheel !== undefined && note.modWheel !== null && { modWheel: note.modWheel }),
            ...(note.aftertouch !== undefined && note.aftertouch !== null && { aftertouch: note.aftertouch }),
            ...(note.pan !== undefined && note.pan !== 0 && { pan: note.pan }),
            ...(note.releaseVelocity !== undefined && note.releaseVelocity !== null && { releaseVelocity: note.releaseVelocity }),
            ...(note.slideTo !== undefined && note.slideTo !== null && { slideTo: note.slideTo }),
            ...(note.slideDuration !== undefined && note.slideDuration !== null && { slideDuration: note.slideDuration })
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

    // Find note at position - WYSIWYG: Exact visible area only (no padding)
    const findNoteAtPosition = useCallback((time, pitch) => {
        const currentNotes = notes();
        const { keyHeight } = engine.dimensions || { keyHeight: 20 };

        // ✅ FIX: Calculate actual note height (notes are drawn with keyHeight - 1)
        // This matches the visual rendering exactly
        const actualNoteHeight = keyHeight - 1;
        const pitchRange = actualNoteHeight / keyHeight; // Convert pixel height to pitch range

        // ✅ WYSIWYG PRINCIPLE: Use exact visible area, no adaptive margins
        // What you see is what you get - click only on visible note area
        const candidates = currentNotes.filter(note => {
            // ✅ FL STUDIO STYLE: Use visualLength for hit detection (oval notes)
            const displayLength = note.visualLength !== undefined ? note.visualLength : note.length;
            const noteEndTime = note.startTime + displayLength;

            // ✅ EXACT TIME BOUNDARIES - No tolerance, only visible area
            const timeOverlap = time >= note.startTime && time <= noteEndTime;

            // ✅ FIX: EXACT PITCH BOUNDARIES - Match visual note height (keyHeight - 1)
            // Note is centered at note.pitch, so it spans from (pitch - pitchRange/2) to (pitch + pitchRange/2)
            const notePitchMin = note.pitch - (pitchRange / 2);
            const notePitchMax = note.pitch + (pitchRange / 2);
            const pitchMatch = pitch >= notePitchMin && pitch <= notePitchMax;

            return timeOverlap && pitchMatch;
        });

        // ✅ FIX: If multiple notes overlap, prefer:
        // 1. Selected notes (if any are selected)
        // 2. Notes with highest pitch (topmost)
        // 3. Notes with shortest visualLength (most visible)
        if (candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];

        // Check if any candidate is selected
        const selectedCandidates = candidates.filter(n => selectedNoteIds.has(n.id));
        if (selectedCandidates.length > 0) {
            // Prefer selected notes, then highest pitch
            return selectedCandidates.sort((a, b) => b.pitch - a.pitch)[0];
        }

        // Prefer highest pitch (topmost), then shortest visualLength
        return candidates.sort((a, b) => {
            if (Math.abs(b.pitch - a.pitch) > 0.1) {
                return b.pitch - a.pitch; // Higher pitch first
            }
            // If same pitch, prefer shorter visualLength (more visible)
            const aVisual = a.visualLength !== undefined ? a.visualLength : a.length;
            const bVisual = b.visualLength !== undefined ? b.visualLength : b.length;
            return aVisual - bVisual;
        })[0];
    }, [notes, engine, selectedNoteIds]);

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
        // ✅ FL STUDIO STYLE: Use visualLength for resize handle detection (for oval notes)
        const displayLength = note.visualLength !== undefined ? note.visualLength : note.length;
        const noteX = Math.round(note.startTime * stepWidth);
        const noteY = Math.round((127 - note.pitch) * keyHeight);
        const noteWidth = Math.max(Math.round(stepWidth) - 1, Math.round(displayLength * stepWidth) - 1);
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

        // ✅ SMART DURATION PREDICTION using MIDIInputContext
        const durationConfig = midiInputContext.getNextNoteDuration({
            pitch,
            time: snappedTime,
            velocity
        });

        const finalLength = durationConfig.audioLength;
        const visualLength = durationConfig.visualLength;

        if (DEBUG_MODE) {
            console.log('🧠 Smart Duration Prediction:', {
                reason: durationConfig.reason,
                visualLength,
                audioLength: finalLength,
                shouldBeOval: durationConfig.shouldBeOval
            });
        }

        // ✅ Generate unique ID using centralized function (prevents collisions)
        const uniqueId = generateUniqueNoteId();

        const newNote = {
            id: uniqueId,
            startTime: Math.max(0, snappedTime),
            pitch: Math.max(0, Math.min(127, Math.round(pitch))),
            length: finalLength, // Audio length (for playback)
            visualLength: visualLength, // Smart predicted visual length
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

        // ✅ Record action and update duration memory
        midiInputContext.recordAction(ActionType.NOTE_CREATED_CLICK, {
            pitch,
            time: snappedTime,
            velocity,
            length: finalLength,
            visualLength
        });
        midiInputContext.updateDurationMemory({
            length: finalLength,
            visualLength,
            wasResized: false,
            wasWheeled: false
        });

        if (DEBUG_MODE) console.log('➕ Note added:', newNote);
        return newNote;
    }, [currentInstrument, snapValue, activePatternId, notes, updatePatternStore, _addNoteToStore, _deleteNotesFromStore]);

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

    // ✅ TRANSPOSE NOTES - Shift pitch by semitones
    const transposeNotes = useCallback((noteIds, semitones) => {
        if (!noteIds || noteIds.length === 0) {
            console.warn('No notes to transpose');
            return;
        }

        const currentNotes = notes();
        const notesToTranspose = currentNotes.filter(note => noteIds.includes(note.id));

        if (notesToTranspose.length === 0) {
            console.warn('No notes found for transpose');
            return;
        }

        // Check if any notes would go out of bounds
        const anyOutOfBounds = notesToTranspose.some(note => {
            const newPitch = note.pitch + semitones;
            return newPitch < 0 || newPitch > 127;
        });

        if (anyOutOfBounds) {
            console.warn('⚠️ Transpose would exceed MIDI pitch range (0-127)');
            // Still proceed but clamp values
        }

        // Create transpose command
        const command = new TransposeNotesCommand(
            notesToTranspose,
            semitones,
            (transposedNotes) => {
                // Update store with transposed notes
                const updatedNotes = currentNotes.map(note => {
                    const transposed = transposedNotes.find(t => t.id === note.id);
                    return transposed || note;
                });
                updatePatternStore(updatedNotes);
            }
        );

        commandStackRef.current?.execute(command);

        // Record action for MIDIInputContext
        midiInputContext.recordAction(ActionType.NOTE_TRANSPOSED, {
            noteIds,
            semitones,
            count: notesToTranspose.length
        });

        if (DEBUG_MODE) {
            const direction = semitones > 0 ? 'up' : 'down';
            console.log(`🎹 Transposed ${notesToTranspose.length} note(s) ${direction} by ${Math.abs(semitones)} semitone(s)`);
        }
    }, [notes, updatePatternStore]);

    // ✅ TOGGLE MUTE - Ghost notes feature
    const toggleMute = useCallback((noteIds) => {
        if (!noteIds || noteIds.length === 0) {
            console.warn('No notes to toggle mute');
            return;
        }

        const currentNotes = notes();
        const notesToToggle = currentNotes.filter(note => noteIds.includes(note.id));

        if (notesToToggle.length === 0) {
            console.warn('No notes found for mute toggle');
            return;
        }

        // Create toggle mute command
        const command = new ToggleMuteCommand(
            notesToToggle,
            (toggledNotes) => {
                // Update store with toggled notes
                const updatedNotes = currentNotes.map(note => {
                    const toggled = toggledNotes.find(t => t.id === note.id);
                    return toggled || note;
                });
                updatePatternStore(updatedNotes);
            }
        );

        commandStackRef.current?.execute(command);

        // Count muted vs unmuted for feedback
        const nowMuted = notesToToggle.filter(n => !n.isMuted).length;
        const nowUnmuted = notesToToggle.length - nowMuted;

        // Record action for MIDIInputContext
        midiInputContext.recordAction(ActionType.NOTE_TOGGLED_MUTE, {
            noteIds,
            count: notesToToggle.length,
            muted: nowMuted,
            unmuted: nowUnmuted
        });

        if (DEBUG_MODE) {
            console.log(`👻 Toggled mute: ${nowMuted} muted, ${nowUnmuted} unmuted`);
        }
    }, [notes, updatePatternStore]);

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

        // ✅ PHASE 3: SLIDE TOOL - Create slide connections between notes
        if (currentTool === TOOL_TYPES.SLIDE) {
            if (!foundNote) {
                // Clicked on empty space - clear source note
                setSlideSourceNoteId(null);
                return;
            }

            if (!slideSourceNoteId) {
                // First click - select source note
                setSlideSourceNoteId(foundNote.id);
                selectNote(foundNote.id, false); // Select only this note
                if (DEBUG_MODE) console.log('🔗 Slide tool: Source note selected:', foundNote.id);
            } else {
                // Second click - create slide connection
                if (slideSourceNoteId === foundNote.id) {
                    // Clicked same note - clear selection
                    setSlideSourceNoteId(null);
                    deselectAll();
                    return;
                }

                // Create slide connection: source note -> target note
                const sourceNote = notes().find(n => n.id === slideSourceNoteId);
                if (!sourceNote) {
                    setSlideSourceNoteId(null);
                    return;
                }

                // Calculate default slide duration (distance between notes in steps)
                const timeDistance = Math.abs(foundNote.startTime - (sourceNote.startTime + (sourceNote.length || 1)));
                const defaultSlideDuration = Math.max(0.25, Math.min(32, timeDistance)); // Clamp between 0.25 and 32 steps

                // Update source note with slideTo connection
                const updatedNote = {
                    ...sourceNote,
                    slideTo: foundNote.id,
                    slideDuration: defaultSlideDuration
                };

                updateNote(slideSourceNoteId, updatedNote);
                if (DEBUG_MODE) console.log('🔗 Slide connection created:', {
                    source: slideSourceNoteId,
                    target: foundNote.id,
                    duration: defaultSlideDuration
                });

                // Reset for next connection
                setSlideSourceNoteId(null);
                selectNote(foundNote.id, false); // Select target note as feedback
            }
            return;
        }

        // ✅ PAINT BRUSH TOOL - Draw notes by clicking or dragging, resize existing notes
        if (currentTool === TOOL_TYPES.PAINT_BRUSH) {
            if (foundNote) {
                // Check if clicking on resize handle
                const resizeHandle = getResizeHandle(coords.x, coords.y, foundNote);

                if (resizeHandle) {
                    // ✅ FIX: If Ctrl/Shift is NOT pressed, clear selection and select only the clicked note
                    // This prevents resizing the wrong note when another note is selected
                    const isMultiSelect = e.ctrlKey || e.metaKey || e.shiftKey;
                    
                    // ✅ CRITICAL FIX: Determine which notes to resize BEFORE state updates
                    // State updates are async, so we need to calculate based on current state and intent
                    const currentNotes = notes();
                    let notesToResize;
                    
                    if (!isMultiSelect) {
                        // ✅ SINGLE RESIZE MODE: Always resize only the clicked note
                        // Clear all selections and select only the note being resized
                        if (!selectedNoteIds.has(foundNote.id) || selectedNoteIds.size > 1) {
                            deselectAll();
                            selectNote(foundNote.id, false);
                        }
                        
                        // ✅ CRITICAL: Use foundNote directly, ignore selectedNoteIds (state not updated yet)
                        notesToResize = [foundNote];
                    } else {
                        // ✅ MULTI-SELECT MODE: Resize all selected notes (including clicked one)
                        // If note is not selected, add it to selection
                        if (!selectedNoteIds.has(foundNote.id)) {
                            selectNote(foundNote.id, true); // Add to selection
                        }
                        
                        // ✅ CRITICAL: Use selectedNoteIds + foundNote (in case state not updated)
                        const selectedNotes = currentNotes.filter(n => selectedNoteIds.has(n.id));
                        // Include foundNote if not already in selectedNotes
                        if (!selectedNotes.find(n => n.id === foundNote.id)) {
                            notesToResize = [...selectedNotes, foundNote];
                        } else {
                            notesToResize = selectedNotes.length > 0 ? selectedNotes : [foundNote];
                        }
                    }
                    
                    // ✅ FL STUDIO STYLE: When resize starts, convert oval notes to normal notes
                    // Store CONVERTED state (for resize calculations) and original state (for undo)
                    const originalNotesForUndo = new Map(); // For undo/redo (keep original pattern-length)
                    const originalNotesForResize = new Map(); // For resize calculations (use converted length)
                    const convertedNotes = notesToResize.map(note => {
                        // If note is oval (visualLength < length), convert it to normal
                        if (note.visualLength !== undefined && note.visualLength < note.length) {
                            // Use visualLength as the new length (oval -> normal)
                            // ✅ PRESERVE ALL FIELDS: Spread note first to keep isMuted, velocity, etc.
                            const convertedNote = {
                                ...note, // ✅ Keep all fields including isMuted
                                length: note.visualLength,
                                visualLength: note.visualLength // No longer oval
                            };
                            
                            // Store original state BEFORE conversion (for undo)
                            originalNotesForUndo.set(note.id, {
                                startTime: note.startTime,
                                length: note.length, // Original pattern-length
                                visualLength: note.visualLength, // Original visual length
                                pitch: note.pitch
                            });
                            
                            // Store CONVERTED state for resize calculations
                            originalNotesForResize.set(note.id, {
                                startTime: convertedNote.startTime,
                                length: convertedNote.length, // ✅ CONVERTED length (visualLength)
                                visualLength: convertedNote.visualLength,
                                pitch: convertedNote.pitch
                            });
                            
                            return convertedNote;
                        } else {
                            // Normal note, store as is
                            originalNotesForUndo.set(note.id, {
                                startTime: note.startTime,
                                length: note.length,
                                visualLength: note.visualLength,
                                pitch: note.pitch
                            });
                            
                            originalNotesForResize.set(note.id, {
                                startTime: note.startTime,
                                length: note.length,
                                visualLength: note.visualLength,
                                pitch: note.pitch
                            });
                            
                            return note;
                        }
                    });
                    
                    // ✅ FIX BUG 1: Don't update store immediately - only convert in memory for resize
                    // Conversion will be applied when resize completes successfully
                    // This prevents notes from disappearing if resize is cancelled
                    if (convertedNotes.some((n, i) => n.length !== notesToResize[i].length || n.visualLength !== notesToResize[i].visualLength)) {
                        // ✅ CRITICAL: Only update tempNotes (visual), not store (persistent)
                        // Store will be updated when resize completes in handleMouseUp
                        setTempNotes(convertedNotes);
                    }
                    
                    // ✅ Get converted note for primary note (might be converted from oval)
                    const convertedPrimaryNote = convertedNotes.find(n => n.id === foundNote.id) || foundNote;

                    if (DEBUG_MODE) {
                        console.log('🎯 Multi-resize started:', {
                            resizeHandle,
                            totalNotes: convertedNotes.length,
                            notesToResize: notesToResize.length,
                            selectedNotes: selectedNotes.length,
                            convertedNotes: convertedNotes.map(n => n.id),
                            noteIds: convertedNotes.map(n => n.id),
                            foundNoteId: foundNote.id
                        });
                    }

                    setDragState({
                        type: 'resizing',
                        noteId: foundNote.id, // Primary note being resized
                        noteIds: convertedNotes.map(n => n.id), // All notes to resize (converted)
                        resizeHandle,
                        startCoords: coords,
                        originalNote: { ...convertedPrimaryNote }, // Use converted note
                        originalNotes: originalNotesForResize, // ✅ Use CONVERTED notes for resize calculations
                        originalNotesForUndo // Store original for undo/redo
                    });
                } else {
                    // Clicking on note body - preview sound and update duration memory
                    playPreview(
                        foundNote.pitch,
                        foundNote.velocity || 100,
                        0.15 // Short duration for mouse clicks
                    );

                    // ✅ Record action and update duration memory
                    midiInputContext.recordAction(ActionType.NOTE_CREATED_PAINT, {
                        pitch: foundNote.pitch,
                        time: foundNote.startTime,
                        velocity: foundNote.velocity,
                        length: foundNote.length,
                        visualLength: foundNote.visualLength
                    });
                    midiInputContext.updateDurationMemory({
                        length: foundNote.length,
                        visualLength: foundNote.visualLength || 1,
                        wasResized: false,
                        wasWheeled: false
                    });
                    if (DEBUG_MODE) console.log('💾 Paint brush click - updated duration memory:', foundNote.length);
                }
            } else {
                // Add new note with smart duration prediction
                const newNote = addNote(coords.time, coords.pitch);
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
                    // ✅ DOUBLE-CLICK: Open Note Properties Panel (FL Studio style)
                    // Select only this note (not all same pitch notes)
                    setSelectedNoteIds(new Set([foundNote.id]));

                    if (DEBUG_MODE) {
                        console.log('🎯🎯 Double-click: Opening Note Properties for note', foundNote.id);
                    }

                    // Reset click tracking
                    setLastClickTime(0);
                    setLastClickedNoteId(null);
                    
                    // ✅ Emit event to open Note Properties Panel
                    EventBus.emit('pianoRoll:openNoteProperties', { noteId: foundNote.id });
                    
                    return; // Don't proceed with drag
                }

                // Update click tracking
                setLastClickTime(now);
                setLastClickedNoteId(foundNote.id);

                // Check for resize handle first
                const resizeHandle = getResizeHandle(coords.x, coords.y, foundNote);

                if (resizeHandle) {
                    // Start resizing
                    // ✅ FIX: If Ctrl/Shift is NOT pressed, clear selection and select only the clicked note
                    // This prevents resizing the wrong note when another note is selected
                    const isMultiSelect = e.ctrlKey || e.metaKey || e.shiftKey;
                    
                    // ✅ CRITICAL FIX: Determine which notes to resize BEFORE state updates
                    // State updates are async, so we need to calculate based on current state and intent
                    const currentNotes = notes();
                    let notesToResize;
                    
                    if (!isMultiSelect) {
                        // ✅ SINGLE RESIZE MODE: Always resize only the clicked note
                        // Clear all selections and select only the note being resized
                        if (!selectedNoteIds.has(foundNote.id) || selectedNoteIds.size > 1) {
                            deselectAll();
                            selectNote(foundNote.id, false);
                        }
                        
                        // ✅ CRITICAL: Use foundNote directly, ignore selectedNoteIds (state not updated yet)
                        notesToResize = [foundNote];
                    } else {
                        // ✅ MULTI-SELECT MODE: Resize all selected notes (including clicked one)
                        // If note is not selected, add it to selection
                        if (!selectedNoteIds.has(foundNote.id)) {
                            selectNote(foundNote.id, true); // Add to selection
                        }
                        
                        // ✅ CRITICAL: Use selectedNoteIds + foundNote (in case state not updated)
                        const selectedNotes = currentNotes.filter(n => selectedNoteIds.has(n.id));
                        // Include foundNote if not already in selectedNotes
                        if (!selectedNotes.find(n => n.id === foundNote.id)) {
                            notesToResize = [...selectedNotes, foundNote];
                        } else {
                            notesToResize = selectedNotes.length > 0 ? selectedNotes : [foundNote];
                        }
                    }
                    
                    if (DEBUG_MODE) {
                        console.log('🔍 Resize debug:', {
                            isMultiSelect,
                            selectedNoteIdsSize: selectedNoteIds.size,
                            notesToResizeCount: notesToResize.length,
                            foundNoteId: foundNote?.id,
                            notesToResizeIds: notesToResize.map(n => n.id)
                        });
                    }
                    
                    // ✅ FL STUDIO STYLE: When resize starts, convert oval notes to normal notes
                    // Store CONVERTED state (for resize calculations) and original state (for undo)
                    const originalNotesForUndo = new Map(); // For undo/redo (keep original pattern-length)
                    const originalNotesForResize = new Map(); // For resize calculations (use converted length)
                    const convertedNotes = notesToResize.map(note => {
                        // If note is oval (visualLength < length), convert it to normal
                        if (note.visualLength !== undefined && note.visualLength < note.length) {
                            // Use visualLength as the new length (oval -> normal)
                            // ✅ PRESERVE ALL FIELDS: Spread note first to keep isMuted, velocity, etc.
                            const convertedNote = {
                                ...note, // ✅ Keep all fields including isMuted
                                length: note.visualLength,
                                visualLength: note.visualLength // No longer oval
                            };
                            
                            // Store original state BEFORE conversion (for undo)
                            originalNotesForUndo.set(note.id, {
                                startTime: note.startTime,
                                length: note.length, // Original pattern-length
                                visualLength: note.visualLength, // Original visual length
                                pitch: note.pitch
                            });
                            
                            // Store CONVERTED state for resize calculations
                            originalNotesForResize.set(note.id, {
                                startTime: convertedNote.startTime,
                                length: convertedNote.length, // ✅ CONVERTED length (visualLength)
                                visualLength: convertedNote.visualLength,
                                pitch: convertedNote.pitch
                            });
                            
                            return convertedNote;
                        } else {
                            // Normal note, store as is
                            originalNotesForUndo.set(note.id, {
                                startTime: note.startTime,
                                length: note.length,
                                visualLength: note.visualLength,
                                pitch: note.pitch
                            });
                            
                            originalNotesForResize.set(note.id, {
                                startTime: note.startTime,
                                length: note.length,
                                visualLength: note.visualLength,
                                pitch: note.pitch
                            });
                            
                            return note;
                        }
                    });
                    
                    // ✅ FIX BUG 1: Don't update store immediately - only convert in memory for resize
                    // Conversion will be applied when resize completes successfully
                    // This prevents notes from disappearing if resize is cancelled
                    if (convertedNotes.some((n, i) => n.length !== notesToResize[i].length || n.visualLength !== notesToResize[i].visualLength)) {
                        // ✅ CRITICAL: Only update tempNotes (visual), not store (persistent)
                        // Store will be updated when resize completes in handleMouseUp
                        setTempNotes(convertedNotes);
                    }
                    
                    // ✅ Get converted note for primary note (might be converted from oval)
                    const convertedPrimaryNote = convertedNotes.find(n => n.id === foundNote.id) || foundNote;

                    if (DEBUG_MODE) {
                        console.log('🎯 Multi-resize started:', {
                            handle: resizeHandle,
                            primaryNoteId: foundNote.id,
                            totalNotes: convertedNotes.length,
                            coords,
                            converted: convertedNotes.filter(n => n.length !== notesToResize.find(s => s.id === n.id)?.length).length,
                            originalLengths: Array.from(originalNotesForResize.values()).map(n => n.length),
                            convertedLengths: convertedNotes.map(n => n.length)
                        });
                    }

                    setDragState({
                        type: 'resizing',
                        noteId: foundNote.id, // Primary note being resized
                        noteIds: convertedNotes.map(n => n.id), // All notes to resize (converted)
                        resizeHandle,
                        startCoords: coords,
                        originalNote: { ...convertedPrimaryNote }, // Use converted note
                        originalNotes: originalNotesForResize, // ✅ Use CONVERTED notes for resize calculations
                        originalNotesForUndo // Store original for undo/redo
                    });
                } else {
                    // Start moving - reset duplicate memory
                    setLastDuplicateAction(null);

                    // ✅ FIX: Multi-note selection handling
                    // If multiple notes are selected and clicked note is in selection, move all selected
                    // If clicked note is not in selection, clear selection and select only clicked note
                    const isMultiSelect = e.ctrlKey || e.metaKey || e.shiftKey;

                    // ✅ CRITICAL FIX: Determine which notes to work with BEFORE updating selection
                    // Because React state updates are asynchronous, we need to compute this first
                    let effectiveSelectedNotes = new Set(selectedNoteIds);

                    if (DEBUG_MODE) {
                        console.log('🖱️ Mouse down on note - Selection logic:', {
                            clickedNoteId: foundNote.id,
                            currentSelectionSize: selectedNoteIds.size,
                            isClickedNoteSelected: selectedNoteIds.has(foundNote.id),
                            isMultiSelect,
                            isShift: e.shiftKey,
                            isCtrl: e.ctrlKey || e.metaKey
                        });
                    }

                    if (!isMultiSelect) {
                        // ✅ FIX: Only clear selection if clicked note is NOT in current selection
                        // If clicked note IS in selection and multiple notes are selected, keep all selected for multi-move
                        if (!selectedNoteIds.has(foundNote.id)) {
                            // Clicked note is NOT selected - clear selection and select only this note
                            deselectAll();
                            selectNote(foundNote.id, false);
                            effectiveSelectedNotes = new Set([foundNote.id]); // ✅ Update local tracking
                            if (DEBUG_MODE) console.log('🔄 Cleared selection, selected clicked note only');
                        } else {
                            if (DEBUG_MODE) console.log('✅ Clicked note IS selected - keeping all', selectedNoteIds.size, 'notes selected');
                        }
                        // ✅ If clicked note IS selected and multiple notes are selected, keep all selected
                        // This allows multi-note move when clicking on a selected note
                    } else if (e.shiftKey) {
                        // Shift = duplicate, don't change selection
                        if (DEBUG_MODE) console.log('📋 Shift held - will duplicate');
                    } else {
                        // Ctrl/Cmd = toggle selection
                        const isToggling = e.ctrlKey || e.metaKey;
                        if (isToggling) {
                            selectNote(foundNote.id, true, true); // addToSelection=true, toggle=true
                            if (DEBUG_MODE) console.log('🔘 Ctrl/Cmd - toggling selection, NOT starting drag');
                            return; // Don't start drag, just toggle selection
                        }
                    }

                    // ✅ Update duration memory when clicking a note
                    if (foundNote.length > 0) {
                        midiInputContext.updateDurationMemory({
                            length: foundNote.length,
                            visualLength: foundNote.visualLength || 1,
                            wasResized: false,
                            wasWheeled: false
                        });
                        if (DEBUG_MODE) console.log('💾 Updated duration memory from selection:', foundNote.length);
                    }

                    // ✅ SHIFT+DRAG TO DUPLICATE - Create copies if Shift is held
                    const isDuplicating = e.shiftKey;
                    let duplicatedNoteIds = null;

                    // Determine which notes to work with (using effectiveSelectedNotes for correct state)
                    let workingNoteIds;
                    if (isDuplicating) {
                        // ✅ SHIFT+DRAG LOGIC FIX: Only duplicate what you click on
                        if (effectiveSelectedNotes.size > 0 && effectiveSelectedNotes.has(foundNote.id)) {
                            // Clicked note is part of selection - duplicate all selected
                            workingNoteIds = Array.from(effectiveSelectedNotes);
                            if (DEBUG_MODE) console.log('📋 Shift+Drag: Clicked note IS in selection, duplicating all', effectiveSelectedNotes.size, 'notes');
                        } else {
                            // Clicked note is NOT part of selection - duplicate ONLY clicked note
                            // (Ignore other selected notes - user wants to duplicate what they clicked)
                            workingNoteIds = [foundNote.id];
                            if (DEBUG_MODE) console.log('📋 Shift+Drag: Clicked note NOT in selection, duplicating ONLY clicked note');
                        }
                    } else {
                        // ✅ CRITICAL FIX: Use effectiveSelectedNotes instead of stale selectedNoteIds
                        // Normal move: use effective selection (accounts for immediate updates)
                        workingNoteIds = effectiveSelectedNotes.has(foundNote.id)
                            ? Array.from(effectiveSelectedNotes)
                            : [foundNote.id];
                    }

                    let originalNotesForDrag = new Map();
                    let finalNoteIds = [];

                    if (isDuplicating) {
                        // Create duplicates of working notes
                        const currentNotes = notes();
                        const notesToDuplicate = currentNotes.filter(n => workingNoteIds.includes(n.id));

                        const newNotes = [];
                        duplicatedNoteIds = [];

                        notesToDuplicate.forEach(note => {
                            const uniqueId = generateUniqueNoteId();
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

                        // ✅ FIX: Use duplicatedNoteIds for dragState
                        finalNoteIds = duplicatedNoteIds;

                        if (DEBUG_MODE) console.log('📋 Duplicated notes for dragging:', duplicatedNoteIds.length, 'IDs:', duplicatedNoteIds);
                    } else {
                        // ✅ CRITICAL FIX: Normal move - use effectiveSelectedNotes instead of stale selectedNoteIds
                        const currentNotes = notes();
                        finalNoteIds = effectiveSelectedNotes.has(foundNote.id)
                            ? Array.from(effectiveSelectedNotes)
                            : [foundNote.id];

                        // ✅ FIX: Ensure all selected notes have original positions stored
                        finalNoteIds.forEach(id => {
                            const note = currentNotes.find(n => n.id === id);
                            if (note) {
                                originalNotesForDrag.set(id, {
                                    startTime: note.startTime,
                                    pitch: note.pitch
                                });
                            } else {
                                console.warn('⚠️ Note not found for drag:', id, 'Available notes:', currentNotes.map(n => n.id));
                            }
                        });
                        
                        // ✅ FIX: Debug log for multi-note move setup
                        if (DEBUG_MODE && finalNoteIds.length > 1) {
                            console.log('📦 Multi-note move setup:', {
                                clickedNote: foundNote.id,
                                effectiveSelectedCount: effectiveSelectedNotes.size,
                                finalNoteIds: finalNoteIds.length,
                                originalNotesCount: originalNotesForDrag.size,
                                noteIds: finalNoteIds
                            });
                        }
                    }

                    // ✅ FIX: Ensure noteIds is always an array, never null
                    if (!finalNoteIds || finalNoteIds.length === 0) {
                        finalNoteIds = [foundNote.id];
                        if (!originalNotesForDrag.has(foundNote.id)) {
                            const currentNotes = notes();
                            const note = currentNotes.find(n => n.id === foundNote.id);
                            if (note) {
                                originalNotesForDrag.set(foundNote.id, { startTime: note.startTime, pitch: note.pitch });
                            }
                        }
                    }
                    
                    // ✅ FIX: Validate that all noteIds have original positions
                    const missingOriginals = finalNoteIds.filter(id => !originalNotesForDrag.has(id));
                    if (missingOriginals.length > 0) {
                        console.warn('⚠️ Missing original positions for notes:', missingOriginals);
                        // Try to fill missing originals
                        const currentNotes = notes();
                        missingOriginals.forEach(id => {
                            const note = currentNotes.find(n => n.id === id);
                            if (note) {
                                originalNotesForDrag.set(id, { startTime: note.startTime, pitch: note.pitch });
                            }
                        });
                    }

                    // ✅ CRITICAL DEBUG: Log drag state creation
                    if (DEBUG_MODE) {
                        console.log('🎯 Creating drag state:', {
                            type: 'moving',
                            noteIdsCount: finalNoteIds.length,
                            noteIds: finalNoteIds,
                            originalNotesCount: originalNotesForDrag.size,
                            isDuplicating,
                            effectiveSelectedNotesSize: effectiveSelectedNotes.size,
                            actualSelectedNoteIdsSize: selectedNoteIds.size
                        });
                    }

                    setDragState({
                        type: 'moving',
                        noteIds: finalNoteIds, // ✅ FIX: Always use finalNoteIds array
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
                // ✅ Start area selection (rectangular or lasso)
                setIsSelectingArea(true);
                
                // ✅ Lasso mode: Alt+drag for freehand selection
                const isLassoMode = e.altKey;

                // Convert to pixel coordinates for renderer
                const stepWidth = engine.dimensions?.stepWidth || 40;
                const keyHeight = engine.dimensions?.keyHeight || 20;

                const pixelX = coords.time * stepWidth - engine.viewport.scrollX;
                const pixelY = (127 - coords.pitch) * keyHeight - engine.viewport.scrollY;

                setSelectionArea({
                    mode: isLassoMode ? 'lasso' : 'rect',
                    startCoords: coords,
                    endCoords: coords,
                    startX: pixelX,
                    startY: pixelY,
                    endX: pixelX,
                    endY: pixelY,
                    path: isLassoMode ? [{ x: pixelX, y: pixelY }] : undefined // ✅ Lasso path tracking
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
                                    addNote(interpTime, interpPitch, 1, 100, true); // skipUndo=true for continuous drawing
                                }
                            }
                        } else {
                            // Single note at current position
                            const newNote = addNote(coords.time, coords.pitch, 1, 100, true); // skipUndo=true
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

            // ✅ FIX: Show preview note with smart duration prediction
            // Always show preview when hovering (even on first open) if instrument is ready
            if (!foundNote && stepWidth && coords.pitch >= 0 && coords.pitch <= 127 && currentInstrument) {
                const previewDuration = midiInputContext.getNextNoteDuration({
                    pitch: coords.pitch,
                    time: snappedTime,
                    velocity: 100
                });
                setPreviewNote({
                    pitch: coords.pitch,
                    startTime: snappedTime,
                    length: previewDuration.audioLength,
                    visualLength: previewDuration.visualLength,
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

        // ✅ REDESIGNED: Enhanced cursor feedback system
        // This provides immediate visual feedback based on context
        // ✅ FIX: Initialize with tool-specific cursor (not 'default')
        let cursorState = null;

        if (dragState?.type === 'moving') {
            cursorState = 'grabbing';
        } else if (dragState?.type === 'resizing') {
            cursorState = dragState.resizeHandle === 'left' ? 'resize-left' :
                         dragState.resizeHandle === 'right' ? 'resize-right' : 'resize-both';
        } else if (foundNote && currentTool === TOOL_TYPES.SELECT) {
            const resizeHandle = getResizeHandle(coords.x, coords.y, foundNote);
            if (resizeHandle) {
                cursorState = resizeHandle === 'left' ? 'resize-left' :
                            resizeHandle === 'right' ? 'resize-right' : 'resize-both';
            } else {
                cursorState = 'grab';
            }
        } else if (currentTool === TOOL_TYPES.SLIDE) {
            // ✅ PHASE 3: Slide tool cursor - show different cursor if source note is selected
            if (slideSourceNoteId) {
                cursorState = foundNote ? 'crosshair' : 'not-allowed';
            } else {
                cursorState = foundNote ? 'crosshair' : 'slide-premium';
            }
        } else if (currentTool === TOOL_TYPES.ERASER) {
            cursorState = foundNote ? 'not-allowed' : 'erase-premium';
        } else if (currentTool === TOOL_TYPES.PAINT_BRUSH) {
            cursorState = foundNote ? 'not-allowed' : 'paint-premium';
        } else if (currentTool === TOOL_TYPES.SLICE) {
            cursorState = foundNote ? 'col-resize' : 'slice-premium';
            
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
            setSlicePreview(null); // Clear slice preview for other tools
        }

        // ✅ Update cursor state for cursor manager integration
        // Only update if we have a specific cursor (null means use tool default)
        if (cursorState !== null) {
            setCursorState(cursorState);
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
            // ✅ FIX BUG 2: Calculate delta for resize based on visual representation
            // For oval notes, resize handle position is based on visualLength, not length
            // So deltaTime should account for this
            const deltaTime = coords.time - dragState.startCoords.time;

            // ✅ FIX BUG 2: Account for visual length vs actual length mismatch
            // The issue: resize handle position is based on visualLength (from originalNote before conversion)
            // but resize calculation uses converted length (visualLength = length after conversion)
            // We need to adjust delta based on the TRUE original note's visual length
            const trueOriginalNotes = dragState.originalNotesForUndo;
            const primaryNote = dragState.originalNote; // This is converted note
            
            let adjustedDeltaTime = deltaTime;
            
            if (trueOriginalNotes && primaryNote && dragState.resizeHandle === 'right') {
                // Check if TRUE original was oval (before conversion)
                const trueOriginal = trueOriginalNotes.get(dragState.noteId);
                if (trueOriginal && trueOriginal.visualLength !== undefined && 
                    trueOriginal.visualLength < trueOriginal.length) {
                    // TRUE original was oval - handle position was at visualLength
                    // But converted note has visualLength = length
                    // So we need to account for the difference
                    const trueVisualEndTime = trueOriginal.startTime + trueOriginal.visualLength;
                    const convertedEndTime = primaryNote.startTime + primaryNote.length;
                    const visualOffset = convertedEndTime - trueVisualEndTime;
                    // Adjust delta: if we moved right by X, we actually moved right by X - offset
                    adjustedDeltaTime = deltaTime - visualOffset;
                }
            } else if (trueOriginalNotes && primaryNote && dragState.resizeHandle === 'left') {
                // For left resize, startTime is the same, but we need to account for visual offset
                const trueOriginal = trueOriginalNotes.get(dragState.noteId);
                if (trueOriginal && trueOriginal.visualLength !== undefined && 
                    trueOriginal.visualLength < trueOriginal.length) {
                    // Start time is same, but length calculation will be affected
                    // Actually, for left resize, visualLength doesn't affect delta calculation
                    // because we're moving from startTime, not endTime
                    adjustedDeltaTime = deltaTime;
                }
            }
            
            setDragState(prev => ({
                ...prev,
                currentDelta: { deltaTime: adjustedDeltaTime }
            }));
        } else if (isSelectingArea) {
            // Update selection area with pixel coordinates
            const stepWidth = engine.dimensions?.stepWidth || 40;
            const keyHeight = engine.dimensions?.keyHeight || 20;

            const pixelX = coords.time * stepWidth - engine.viewport.scrollX;
            const pixelY = (127 - coords.pitch) * keyHeight - engine.viewport.scrollY;

            setSelectionArea(prev => {
                if (!prev) return prev;
                
                // ✅ Lasso mode: Add point to path (with distance threshold to avoid too many points)
                if (prev.mode === 'lasso' && prev.path) {
                    const lastPoint = prev.path[prev.path.length - 1];
                    const distance = Math.sqrt(
                        Math.pow(pixelX - lastPoint.x, 2) + 
                        Math.pow(pixelY - lastPoint.y, 2)
                    );
                    
                    // Only add point if moved at least 3 pixels (performance optimization)
                    if (distance > 3) {
                        return {
                            ...prev,
                            endCoords: coords,
                            endX: pixelX,
                            endY: pixelY,
                            path: [...prev.path, { x: pixelX, y: pixelY }]
                        };
                    }
                }
                
                // Rectangular mode: Just update end coordinates
                return {
                    ...prev,
                    endCoords: coords,
                    endX: pixelX,
                    endY: pixelY
                };
            });
        } else if (activeTool === 'pencil' && !dragState) {
            // Show preview note
            const snappedTime = snapValue > 0 ? snapToGrid(coords.time, snapValue) : coords.time;
            setPreviewNote({
                startTime: Math.max(0, snappedTime),
                pitch: Math.max(0, Math.min(127, Math.round(coords.pitch))),
                length: 1, // Audio length (will be extended to pattern length when note is created)
                visualLength: 1, // ✅ FL STUDIO STYLE: Preview always shows as 1 step
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

    // ✅ Time-based selection: Handle ruler mouse events
    const handleRulerMouseDown = useCallback((e) => {
        // Only handle if Shift key is pressed (time-based selection)
        if (!e.shiftKey) return false;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const RULER_HEIGHT = 30;
        const KEYBOARD_WIDTH = 80;
        
        // Only handle if in ruler area
        if (mouseY > RULER_HEIGHT || mouseX < KEYBOARD_WIDTH) {
            return false;
        }
        
        // ✅ FIX: Calculate step position matching renderer algorithm
        // Renderer uses: ctx.translate(-scrollX), then draws at x = step * stepWidth
        // scrollX is in screen coordinates, but after translate(-scrollX), screen and world are 1:1
        // After translate(-scrollX), screen x=0 corresponds to world x=scrollX
        // Screen mouse position → World position: worldX = scrollX + canvasX (after translate, 1:1 mapping)
        // World position → Time: time = worldX / stepWidth
        const { stepWidth } = engine.dimensions;
        const { scrollX } = engine.viewport;
        const canvasX = mouseX - KEYBOARD_WIDTH;
        // scrollX is in screen coordinates, but after translate(-scrollX), it maps to world coordinates
        // After translate, screen coordinate canvasX maps to world coordinate scrollX + canvasX
        const worldX = scrollX + canvasX; // After translate, screen and world are 1:1
        const clickedTime = worldX / stepWidth;
        
        // Start time-based selection
        setIsSelectingTimeRange(true);
        setTimeRangeSelection({ startTime: clickedTime, endTime: clickedTime });
        
        return true;
    }, [engine]);
    
    const handleRulerMouseMove = useCallback((e) => {
        if (!isSelectingTimeRange) return false;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        const KEYBOARD_WIDTH = 80;
        // ✅ FIX: Calculate step position matching renderer algorithm
        // Renderer uses: ctx.translate(-scrollX), then draws at x = step * stepWidth
        // So scrollX is in world coordinates (already includes zoomX)
        // Screen mouse position → World position: worldX = scrollX + canvasX
        // World position → Time: time = worldX / stepWidth
        const { stepWidth } = engine.dimensions;
        const { scrollX } = engine.viewport;
        const canvasX = mouseX - KEYBOARD_WIDTH;
        const worldX = scrollX + canvasX;
        const currentTime = worldX / stepWidth;
        
        // Update time range selection (keep original startTime, update endTime)
        setTimeRangeSelection(prev => {
            if (!prev) return prev;
            return {
                startTime: prev.startTime, // Keep original start
                endTime: currentTime // Update end
            };
        });
        
        return true;
    }, [isSelectingTimeRange, engine]);
    
    // Mouse up handler
    const handleMouseUp = useCallback((e) => {
        // ✅ Finalize time-based selection
        if (isSelectingTimeRange && timeRangeSelection) {
            const { startTime, endTime } = timeRangeSelection;
            const minTime = Math.min(startTime, endTime);
            const maxTime = Math.max(startTime, endTime);
            
            // Select all notes in time range
            const currentNotes = notes();
            const notesInTimeRange = currentNotes.filter(note => {
                const noteEndTime = note.startTime + (note.visualLength || note.length);
                // Note overlaps with time range if it starts before range ends and ends after range starts
                return note.startTime < maxTime && noteEndTime > minTime;
            });
            
            // Select notes (multi-select if Ctrl/Cmd is pressed)
            if (e.ctrlKey || e.metaKey) {
                notesInTimeRange.forEach(note => selectNote(note.id, true));
            } else {
                setSelectedNoteIds(new Set(notesInTimeRange.map(note => note.id)));
            }
            
            if (DEBUG_MODE) {
                console.log('⏱️ Time-based selection:', {
                    timeRange: { start: minTime, end: maxTime },
                    notesFound: notesInTimeRange.length
                });
            }
            
            // Clear time range selection
            setIsSelectingTimeRange(false);
            setTimeRangeSelection(null);
        }
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

            // ✅ FIX: Validate noteIds array
            if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
                console.warn('⚠️ Move operation: Invalid noteIds', noteIds);
                setDragState(null);
                return;
            }

            // Calculate final positions from currentDelta
            const finalPositions = new Map();
            
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
                } else {
                    console.warn('⚠️ Move operation: Original position not found for note', noteId);
                }
            });

            // ✅ FIX: Check if we have valid final positions
            if (finalPositions.size === 0) {
                console.warn('⚠️ Move operation: No valid final positions calculated');
                setDragState(null);
                return;
            }

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
                // ✅ FIX: Get current notes from store directly (bypass tempNotes)
                // Use getPatternNotes() to get actual stored notes, not render state
                const storedNotes = getPatternNotes();
                const baseNotes = convertToPianoRollFormat(storedNotes);
                
                // ✅ FIX: Validate that all noteIds exist in baseNotes
                const missingNotes = noteIds.filter(id => !baseNotes.find(n => n.id === id));
                if (missingNotes.length > 0) {
                    console.warn('⚠️ Move operation: Some notes not found in stored notes', missingNotes);
                }
                
                // ✅ FIX: Apply final positions to base notes
                const updatedNotes = baseNotes.map(note => {
                    const final = finalPositions.get(note.id);
                    if (final) {
                        return { ...note, ...final };
                    }
                    return note;
                });
                
                // ✅ FIX: Debug log for multi-note move
                if (DEBUG_MODE) {
                    console.log('📦 Multi-note move:', {
                        noteIds: noteIds.length,
                        originalPositions: originalPositions.size,
                        finalPositions: finalPositions.size,
                        baseNotesCount: baseNotes.length,
                        updatedNotesCount: updatedNotes.length,
                        deltaTime,
                        deltaPitch,
                        updatedNoteIds: Array.from(finalPositions.keys())
                    });
                }
                
                // ✅ FIX: Clear tempNotes BEFORE updating store to prevent stale data
                setTempNotes([]);
                
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
            // ✅ FIX: Minimum length should be at least one grid unit (snapValue)
            // If snapValue is 1, minLength should be 1; if 0.5, minLength should be 0.5, etc.
            const minLength = snapValue > 0 ? Math.max(0.25, snapValue) : 0.25;
            
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
            
            // ✅ DEBUG: Log original notes to see what we're working with
            if (DEBUG_MODE) {
                console.log('🔍 Resize mouseUp - originalNotes:', {
                    size: originalNotes.size,
                    entries: Array.from(originalNotes.entries()).map(([id, note]) => ({
                        id,
                        startTime: note.startTime,
                        length: note.length,
                        visualLength: note.visualLength
                    })),
                    noteIds: noteIds,
                    currentNotesLengths: currentNotes.filter(n => noteIds.includes(n.id)).map(n => ({
                        id: n.id,
                        length: n.length,
                        visualLength: n.visualLength
                    }))
                });
            }
            
            noteIds.forEach(noteId => {
                const original = originalNotes.get(noteId);
                if (!original) {
                    if (DEBUG_MODE) {
                        console.warn('⚠️ No original state for note:', noteId, {
                            availableIds: Array.from(originalNotes.keys()),
                            noteIds: noteIds
                        });
                    }
                    return;
                }
                
                // ✅ DEBUG: Log what we're using for resize calculation
                if (DEBUG_MODE) {
                    console.log('📏 Resizing note:', noteId, {
                        original: {
                            startTime: original.startTime,
                            length: original.length,
                            visualLength: original.visualLength
                        },
                        deltaTime,
                        resizeHandle: dragState.resizeHandle
                    });
                }
                
                let resizedState = { ...original };

                if (dragState.resizeHandle === 'left') {
                    // ✅ FIX: original is already converted (oval -> normal), so use original.length directly
                    const originalEndTime = original.startTime + original.length;
                    let newStartTime = Math.max(0, original.startTime + deltaTime);

                    // Snap to grid
                    if (snapValue > 0) {
                        newStartTime = snapToGrid(newStartTime, snapValue);
                    }

                    let newLength = Math.max(minLength, originalEndTime - newStartTime);
                    
                    // ✅ FIX: Snap length to grid as well
                    if (snapValue > 0) {
                        newLength = snapToGrid(newLength, snapValue);
                        // Ensure minimum length after snapping
                        newLength = Math.max(minLength, newLength);
                    }
                    
                    resizedState.startTime = newStartTime;
                    resizedState.length = newLength;
                    // ✅ FL STUDIO STYLE: When resized, visualLength matches length (no longer oval)
                    resizedState.visualLength = newLength;
                } else if (dragState.resizeHandle === 'right') {
                    // ✅ FIX: Right resize should NOT change startTime, only length
                    // ✅ FIX: original is already converted (oval -> normal), so use original.length directly
                    const originalStartTime = original.startTime;
                    const originalEndTime = originalStartTime + original.length;
                    let newEndTime = originalEndTime + deltaTime;

                    // Snap to grid
                    if (snapValue > 0) {
                        newEndTime = snapToGrid(newEndTime, snapValue);
                    }

                    let newLength = Math.max(minLength, newEndTime - originalStartTime);
                    
                    // ✅ FIX: Snap length to grid as well
                    if (snapValue > 0) {
                        newLength = snapToGrid(newLength, snapValue);
                        // Ensure minimum length after snapping
                        newLength = Math.max(minLength, newLength);
                    }
                    
                    // ✅ FIX: Ensure startTime stays the same for right resize
                    resizedState.startTime = originalStartTime; // ✅ CRITICAL: Don't change startTime
                    resizedState.length = newLength;
                    // ✅ FL STUDIO STYLE: When resized, visualLength matches length (no longer oval)
                    resizedState.visualLength = newLength;
                }
                
                finalStates.set(noteId, resizedState);
                
                if (DEBUG_MODE) {
                    console.log('📊 Calculated final state for note:', noteId, {
                        original: { startTime: original.startTime, length: original.length },
                        resized: { startTime: resizedState.startTime, length: resizedState.length }
                    });
                }
            });

            // ✅ FIX BUG 1: Check if any notes actually changed
            // Use originalNotesForUndo (true original) for comparison, not converted originalNotes
            let hasChanged = false;
            const undoOriginalNotes = dragState.originalNotesForUndo || originalNotes;
            for (const [noteId, finalState] of finalStates.entries()) {
                const trueOriginal = undoOriginalNotes.get(noteId); // ✅ Use TRUE original (before conversion)
                if (trueOriginal && (Math.abs(finalState.startTime - trueOriginal.startTime) > 0.001 ||
                                Math.abs(finalState.length - trueOriginal.length) > 0.001 ||
                                Math.abs((finalState.visualLength || finalState.length) - (trueOriginal.visualLength || trueOriginal.length)) > 0.001)) {
                    hasChanged = true;
                    break;
                }
            }
            
            // ✅ FIX BUG 1: Ensure all notes in noteIds have finalStates (even if resize cancelled)
            // If resize was cancelled, restore to TRUE original state (before conversion)
            if (!hasChanged) {
                // Resize was cancelled or too small - restore to TRUE original (before conversion)
                const undoOriginalNotes = dragState.originalNotesForUndo || originalNotes;
                const currentNotes = notes();
                const allNoteIds = new Set([...noteIds, ...currentNotes.map(n => n.id)]);
                
                // ✅ CRITICAL FIX: Use storedNotes (from store) as base, not tempNotes
                // This ensures we don't lose notes that were in store but not in tempNotes
                const storedNotes = getPatternNotes();
                const baseNotes = convertedNotes || convertToPianoRollFormat(storedNotes);
                
                const restoredNotes = baseNotes.map(n => {
                    if (noteIds.includes(n.id)) {
                        // Restore to TRUE original (before conversion)
                        const trueOriginal = undoOriginalNotes.get(n.id);
                        if (trueOriginal) {
                            return {
                                ...n,
                                startTime: trueOriginal.startTime,
                                length: trueOriginal.length,
                                visualLength: trueOriginal.visualLength
                            };
                        }
                        // Fallback to converted if true original not found
                        const converted = originalNotes.get(n.id);
                        if (converted) {
                            return {
                                ...n,
                                startTime: converted.startTime,
                                length: converted.length,
                                visualLength: converted.visualLength
                            };
                        }
                    }
                    return n;
                });
                
                // ✅ CRITICAL: Ensure all noteIds are present (don't lose notes)
                noteIds.forEach(noteId => {
                    if (!restoredNotes.find(n => n.id === noteId)) {
                        const trueOriginal = undoOriginalNotes.get(noteId);
                        if (trueOriginal) {
                            restoredNotes.push({
                                id: noteId,
                                startTime: trueOriginal.startTime,
                                pitch: trueOriginal.pitch || 60,
                                length: trueOriginal.length,
                                visualLength: trueOriginal.visualLength,
                                velocity: 100,
                                isMuted: false
                            });
                        }
                    }
                });
                
                updatePatternStore(restoredNotes);
                setTempNotes([]); // Clear tempNotes to use store
            }

            if (hasChanged) {
                // ✅ IMMEDIATE UPDATE - Apply all changes instantly
                // ✅ CRITICAL FIX: Use storedNotes as base, not tempNotes
                // tempNotes might be empty or stale after resize
                const storedNotes = getPatternNotes();
                const baseNotes = convertToPianoRollFormat(storedNotes);
                
                // ✅ FIX: Create a Map for faster lookup and ensure all resized notes are included
                const updatedNotesMap = new Map();
                
                // First, add all base notes (non-resized notes stay as-is)
                baseNotes.forEach(n => {
                    updatedNotesMap.set(n.id, n);
                });
                
                // ✅ FIX: Then update all resized notes from finalStates
                // This ensures ALL resized notes are updated, even if they weren't in baseNotes
                noteIds.forEach(noteId => {
                    const finalState = finalStates.get(noteId);
                    if (finalState) {
                        const existingNote = updatedNotesMap.get(noteId);
                        const original = originalNotes.get(noteId);
                        
                        if (existingNote) {
                            // Update existing note
                            updatedNotesMap.set(noteId, {
                                ...existingNote,
                                startTime: finalState.startTime,
                                length: finalState.length,
                                visualLength: finalState.visualLength // ✅ FL STUDIO STYLE: Update visualLength too
                            });
                        } else {
                            // Add missing note (shouldn't happen, but safety check)
                            updatedNotesMap.set(noteId, {
                                id: noteId,
                                startTime: finalState.startTime,
                                pitch: original?.pitch || 60,
                                length: finalState.length,
                                visualLength: finalState.visualLength,
                                velocity: original?.velocity || 100,
                                isMuted: original?.isMuted || false
                            });
                        }
                    }
                });
                
                // Convert Map back to array
                const updatedNotes = Array.from(updatedNotesMap.values());
                
                if (DEBUG_MODE) {
                    console.log('✅ Updating pattern store with resized notes:', {
                        baseNotesCount: baseNotes.length,
                        resizedNotes: finalStates.size,
                        updatedCount: updatedNotes.filter(n => finalStates.has(n.id)).length,
                        finalNotesCount: updatedNotes.length
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
                
                // ✅ CRITICAL FIX: Clear tempNotes after resize to ensure store is used
                setTempNotes([]);

                // ✅ CREATE BATCH UPDATE COMMAND for undo/redo (async is OK here)
                // IMPORTANT: We already applied the changes above (immediate update)
                // So we need to add to history WITHOUT executing again
                import('@/lib/piano-roll-tools/MultiNoteCommand').then(({ BatchUpdateNotesCommand }) => {
                    import('@/lib/piano-roll-tools/CommandStack').then(({ getCommandStack }) => {
                        const noteUpdates = [];
                        
                        // ✅ Use originalNotesForUndo if available (for proper undo), otherwise fallback to originalNotes
                        const undoOriginalNotes = dragState.originalNotesForUndo || originalNotes;
                        
                        noteIds.forEach(noteId => {
                            const original = undoOriginalNotes.get(noteId);
                            const finalState = finalStates.get(noteId);
                            
                            if (original && finalState) {
                                noteUpdates.push({
                                    noteId,
                                    oldState: { 
                                        startTime: original.startTime, 
                                        length: original.length,
                                        visualLength: original.visualLength // ✅ FL STUDIO STYLE: Include visualLength in undo/redo
                                    },
                                    newState: { 
                                        startTime: finalState.startTime, 
                                        length: finalState.length,
                                        visualLength: finalState.visualLength // ✅ FL STUDIO STYLE: Include visualLength in undo/redo
                                    }
                                });
                            }
                        });
                        
                        if (noteUpdates.length > 0) {
                            // Create a custom update function that applies all changes at once
                            const updateFn = (updates) => {
                                const current = notes();
                                const updated = current.map(n => {
                                    const state = updates.get(n.id);
                                    if (state) {
                                        return { 
                                            ...n, 
                                            startTime: state.startTime,
                                            length: state.length,
                                            visualLength: state.visualLength // ✅ FL STUDIO STYLE: Update visualLength too
                                        };
                                    }
                                    return n;
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

                // ✅ Record resize action and update duration memory
                const primaryFinalState = finalStates.get(dragState.noteId);
                if (primaryFinalState && primaryFinalState.length > 0) {
                    // ✅ FIX: Get oldLength from originalNote or originalNotesForUndo
                    const originalNote = dragState.originalNote;
                    const originalNotesForUndo = dragState.originalNotesForUndo;
                    const trueOriginal = originalNotesForUndo?.get(dragState.noteId);
                    const oldLength = trueOriginal?.length || originalNote?.length || dragState.originalLength;
                    
                    midiInputContext.recordAction(ActionType.NOTE_RESIZED, {
                        noteId: dragState.noteId,
                        oldLength: oldLength,
                        newLength: primaryFinalState.length,
                        visualLength: primaryFinalState.visualLength,
                        multiNoteCount: noteIds.length
                    });
                    midiInputContext.updateDurationMemory({
                        length: primaryFinalState.length,
                        visualLength: primaryFinalState.visualLength || primaryFinalState.length,
                        wasResized: true,
                        wasWheeled: false
                    });
                    if (DEBUG_MODE) console.log('💾 Resize complete - updated duration memory:', primaryFinalState.length, `(${noteIds.length} notes resized)`);
                }
            }
        }

        if (isSelectingArea && selectionArea) {
            // ✅ Finalize area selection (rectangular or lasso)
            const currentNotes = notes();
            let notesInArea = [];
            
            if (selectionArea.mode === 'lasso' && selectionArea.path && selectionArea.path.length > 2) {
                // ✅ Lasso selection: Use point-in-polygon algorithm
                const path = selectionArea.path;
                
                // Close the path by connecting last point to first
                const closedPath = [...path, path[0]];
                
                // Convert notes to pixel coordinates and check if they're inside polygon
                const stepWidth = engine.dimensions?.stepWidth || 40;
                const keyHeight = engine.dimensions?.keyHeight || 20;
                
                notesInArea = currentNotes.filter(note => {
                    // ✅ Get note position in pixel coordinates (same coordinate space as lasso path)
                    // Lasso path points are in screen pixel coordinates (after translate and scroll)
                    // We need to calculate note positions in the same coordinate space

                    // Calculate note bounds in pixel coordinates (world coordinates)
                    const noteWorldStartX = note.startTime * stepWidth;
                    const noteWorldEndX = (note.startTime + (note.visualLength || note.length)) * stepWidth;
                    const noteWorldTopY = (127 - (note.pitch + 0.5)) * keyHeight;
                    const noteWorldBottomY = (127 - (note.pitch - 0.5)) * keyHeight;

                    // Convert to screen coordinates (matching lasso path)
                    const noteStartX = noteWorldStartX - engine.viewport.scrollX;
                    const noteEndX = noteWorldEndX - engine.viewport.scrollX;
                    const noteTopY = noteWorldTopY - engine.viewport.scrollY;
                    const noteBottomY = noteWorldBottomY - engine.viewport.scrollY;
                    
                    // ✅ Check multiple points of the note (center + corners) to see if note overlaps with polygon
                    // This ensures we catch notes that are partially inside the lasso
                    const noteCenterX = (noteStartX + noteEndX) / 2;
                    const noteCenterY = (noteTopY + noteBottomY) / 2;
                    
                    // Check center point
                    if (isPointInPolygon(noteCenterX, noteCenterY, closedPath)) {
                        return true;
                    }
                    
                    // Check corner points
                    const corners = [
                        { x: noteStartX, y: noteTopY },      // Top-left
                        { x: noteEndX, y: noteTopY },        // Top-right
                        { x: noteStartX, y: noteBottomY },   // Bottom-left
                        { x: noteEndX, y: noteBottomY }      // Bottom-right
                    ];
                    
                    // If any corner is inside, select the note
                    for (const corner of corners) {
                        if (isPointInPolygon(corner.x, corner.y, closedPath)) {
                            return true;
                        }
                    }
                    
                    // ✅ Also check if note rectangle intersects with polygon (for edge cases)
                    // Simplified: Check if polygon has points inside note bounds
                    const noteBounds = {
                        minX: Math.min(noteStartX, noteEndX),
                        maxX: Math.max(noteStartX, noteEndX),
                        minY: Math.min(noteTopY, noteBottomY),
                        maxY: Math.max(noteTopY, noteBottomY)
                    };
                    
                    // Check if any polygon vertex is inside note bounds
                    for (const point of closedPath) {
                        if (point.x >= noteBounds.minX && point.x <= noteBounds.maxX &&
                            point.y >= noteBounds.minY && point.y <= noteBounds.maxY) {
                            return true;
                        }
                    }
                    
                    return false;
                });
                
                if (DEBUG_MODE) {
                    console.log('🎯 Lasso selection:', {
                        pathPoints: closedPath.length,
                        notesFound: notesInArea.length,
                        notes: notesInArea.map(n => ({ id: n.id.substring(0, 12), pitch: n.pitch, time: n.startTime }))
                    });
                }
            } else {
                // ✅ Rectangular selection: Original logic
                const { startCoords, endCoords } = selectionArea;
                const minTime = Math.min(startCoords.time, endCoords.time);
                const maxTime = Math.max(startCoords.time, endCoords.time);
                const minPitch = Math.min(startCoords.pitch, endCoords.pitch);
                const maxPitch = Math.max(startCoords.pitch, endCoords.pitch);

                notesInArea = currentNotes.filter(note => {
                    const noteEndTime = note.startTime + note.length;
                    const timeOverlap = note.startTime < maxTime && noteEndTime > minTime;
                    const pitchInRange = note.pitch >= minPitch && note.pitch <= maxPitch;
                    return timeOverlap && pitchInRange;
                });
            }

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
        setIsSelectingTimeRange(false); // ✅ Clear time range selection
        setTimeRangeSelection(null);
        setPreviewNote(null);
        setSlicePreview(null);
        setSliceRange(null); // ✅ Clear slice range
        setTempNotes([]); // Clear temporary notes
        setPaintDragState(null); // ✅ Clear paint/erase drag state
        setRightClickDragState(null); // ✅ Clear right click drag state
    }, [isSelectingArea, selectionArea, isSelectingTimeRange, timeRangeSelection, notes, selectNote, dragState, tempNotes, updatePatternStore, performPitchRangeSlice, sliceNote, sliceRange]);

    // ✅ WHEEL HANDLER - Velocity and duration control
    const handleWheel = useCallback((e) => {
        const coords = getCoordinatesFromEvent(e);
        const foundNote = findNoteAtPosition(coords.time, coords.pitch);

        // Shift+Wheel: Change duration of hovered or selected notes
        if (e.shiftKey && (foundNote || selectedNoteIds.size > 0)) {
            // Note: preventDefault doesn't work with passive listeners
            // This is expected behavior - wheel will still scroll if not over a note

            const delta = -e.deltaY; // Positive = scroll up = increase
            const step = 0.25; // 1/16th step increment
            const change = delta > 0 ? step : -step;

            if (foundNote && !selectedNoteIds.has(foundNote.id)) {
                // Change hovered note's duration (only audio length, NOT visual length)
                const newLength = Math.max(0.25, foundNote.length + change);
                updateNote(foundNote.id, { length: newLength });

                // ✅ Record wheel action - DON'T update duration memory
                // Wheel adjusts audio length only, doesn't affect next note creation
                if (DEBUG_MODE) console.log('🎚️ Duration changed (hover):', foundNote.id, newLength);
            } else if (selectedNoteIds.size > 0) {
                // Change all selected notes' duration (only audio length, NOT visual length)
                const currentNotes = notes();
                const updatedNotes = currentNotes.map(note => {
                    if (selectedNoteIds.has(note.id)) {
                        const newLength = Math.max(0.25, note.length + change);
                        return { ...note, length: newLength };
                    }
                    return note;
                });
                updatePatternStore(updatedNotes);

                // ✅ Record wheel action - DON'T update duration memory
                // Wheel adjusts audio length only, doesn't affect next note creation
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

        // ✅ TRANSPOSE - Cmd+Up/Down (1 semitone), Cmd+Alt+Up/Down (1 octave)
        // Note: Cmd+Shift+Arrow is often captured by OS for text selection
        if ((e.ctrlKey || e.metaKey) && (key === 'arrowup' || key === 'arrowdown')) {
            e.preventDefault();

            if (selectedNoteIds.size === 0) {
                console.log('⚠️ No notes selected for transpose');
                return;
            }

            const semitones = e.altKey ? 12 : 1; // Alt for octave, plain for semitone
            const direction = key === 'arrowup' ? 1 : -1;
            const transpose = semitones * direction;

            if (DEBUG_MODE) {
                console.log('🎹 Transpose shortcut:', {
                    key,
                    altKey: e.altKey,
                    shiftKey: e.shiftKey,
                    semitones,
                    direction,
                    transpose
                });
            }

            transposeNotes(Array.from(selectedNoteIds), transpose);
            return;
        }

        // ✅ TOGGLE MUTE - M key (Ghost Notes)
        if (key === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();

            if (selectedNoteIds.size === 0) {
                console.log('⚠️ No notes selected for mute toggle');
                return;
            }

            toggleMute(Array.from(selectedNoteIds));
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
                    const uniqueId = generateUniqueNoteId();
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
    }, [selectedNoteIds, deleteNotes, deselectAll, notes, snapValue, addNote, lastDuplicateAction, currentInstrument]);

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
        handleRulerMouseDown, // ✅ NEW: Time-based selection from timeline
        handleRulerMouseMove, // ✅ NEW: Time-based selection from timeline
        handleKeyDown,
        handleKeyUp, // ✅ NEW: Key up handler for keyboard piano
        handleWheel, // ✅ NEW: Wheel handler for velocity and duration control

        // State
        hoveredNoteId,
        selectedNoteIds,
        isSelectingArea,
        selectionArea,
        isSelectingTimeRange, // ✅ NEW: Time-based selection state
        timeRangeSelection, // ✅ NEW: Time range selection data
        previewNote,
        slicePreview,
        sliceRange,
        rightClickDragState, // ✅ NEW: Right click drag state for deletion cursor
        dragState, // ✅ NEW: Drag state for cursor management
        paintDragState, // ✅ NEW: Paint drag state for cursor management
        cursorState, // ✅ REDESIGNED: Real-time cursor state from mouse interactions
        contextMenuState, // ✅ NEW: Context menu state

        // Data
        notes: notes(),

        // Operations
        addNote,
        updateNote,
        deleteNotes,
        transposeNotes, // ✅ NEW: Transpose selected notes (Cmd+Up/Down)
        toggleMute, // ✅ NEW: Toggle mute for ghost notes (M key)
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