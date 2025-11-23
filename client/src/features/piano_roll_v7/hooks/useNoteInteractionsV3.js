/**
 * Piano Roll Note Interactions V3 - Evolutionary Design
 *
 * Complete rewrite focused on predictability, performance, and UX excellence.
 *
 * @version 3.0.0
 */

import { useReducer, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
    getCommandStack,
    AddNoteCommand,
    DeleteNotesCommand,
    UpdateNoteCommand,
    MoveNotesCommand,
    TransposeNotesCommand,
    BatchCommand
} from '@/lib/piano-roll-tools/CommandStack';
import { TOOL_TYPES } from '@/lib/piano-roll-tools';
import { useArrangementStore } from '@/store/useArrangementStore';
import { getPreviewManager } from '@/lib/audio/preview';
import EventBus from '@/lib/core/EventBus';

const DEBUG = true;
const VERSION = '3.0.0';

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

/**
 * Convert steps to Tone.js duration string
 * 1 step = 1/16 note = "16n"
 * 2 steps = 1/8 note = "8n"
 * 4 steps = 1/4 note = "4n"
 * 8 steps = 1/2 note = "2n"
 * 16 steps = 1 whole note = "1n"
 */
function stepsToDurationString(steps) {
    if (typeof steps !== 'number' || steps <= 0) return '16n';
    
    // Round to nearest valid duration
    if (steps <= 0.5) return '32n';
    if (steps <= 1) return '16n';
    if (steps <= 2) return '8n';
    if (steps <= 4) return '4n';
    if (steps <= 8) return '2n';
    if (steps <= 16) return '1n';
    
    // For longer durations, use multiples of whole notes
    // But keep it simple - just use "1n" for anything longer
    // (The actual length is stored in the `length` property)
    return '1n';
}

// ===================================================================
// STATE MACHINE
// ===================================================================

const Mode = {
    IDLE: 'idle',
    DRAG: 'drag',
    RESIZE: 'resize',
    PAINT: 'paint',
    ERASE: 'erase',
    AREA_SELECT: 'area_select'
};

// ===================================================================
// INITIAL STATE
// ===================================================================

const createInitialState = () => ({
    mode: Mode.IDLE,
    selection: new Set(),
    drag: null,      // { noteIds, start, originals, delta, isDuplicate }
    resize: null,    // { noteIds, handle, start, originals }
    areaSelect: null, // { type, start, end, path }
    hover: null,
    cursor: 'default',
    clipboard: null,
    undo: { canUndo: false, canRedo: false }
});

// ===================================================================
// ACTIONS
// ===================================================================

const Action = {
    SELECT: 'select',
    CLEAR_SELECTION: 'clear_selection',
    START_DRAG: 'start_drag',
    UPDATE_DRAG: 'update_drag',
    END_DRAG: 'end_drag',
    START_RESIZE: 'start_resize',
    UPDATE_RESIZE: 'update_resize',
    END_RESIZE: 'end_resize',
    START_AREA: 'start_area',
    UPDATE_AREA: 'update_area',
    END_AREA: 'end_area',
    SET_HOVER: 'set_hover',
    SET_CURSOR: 'set_cursor',
    SET_MODE: 'set_mode',
    CLIPBOARD: 'clipboard'
};

// ===================================================================
// REDUCER
// ===================================================================

function reducer(state, action) {
    if (DEBUG && action.type !== "set_hover") {
        console.log(`🔄 [V3.${action.type}]`, action.payload);
    }

    switch (action.type) {
        case Action.SELECT: {
            const { noteIds, mode } = action.payload;
            const newSelection = new Set(state.selection);

            if (mode === 'toggle') {
                noteIds.forEach(id => {
                    if (newSelection.has(id)) newSelection.delete(id);
                    else newSelection.add(id);
                });
            } else if (mode === 'add') {
                noteIds.forEach(id => newSelection.add(id));
            } else {
                newSelection.clear();
                noteIds.forEach(id => newSelection.add(id));
            }

            return { ...state, selection: newSelection };
        }

        case Action.CLEAR_SELECTION:
            return { ...state, selection: new Set() };

        case Action.START_DRAG:
            return {
                ...state,
                mode: Mode.DRAG,
                drag: {
                    noteIds: action.payload.noteIds,
                    start: action.payload.start,
                    originals: action.payload.originals,
                    delta: { time: 0, pitch: 0 },
                    isDuplicate: action.payload.isDuplicate || false
                },
                cursor: 'grabbing'
            };

        case Action.UPDATE_DRAG:
            if (!state.drag) return state;
            return {
                ...state,
                drag: { ...state.drag, delta: action.payload.delta }
            };

        case Action.END_DRAG:
            return {
                ...state,
                mode: Mode.IDLE,
                drag: null,
                cursor: 'default'
            };

        case Action.START_RESIZE:
            return {
                ...state,
                mode: Mode.RESIZE,
                resize: {
                    noteIds: action.payload.noteIds,
                    handle: action.payload.handle,
                    start: action.payload.start,
                    originals: action.payload.originals
                },
                cursor: action.payload.handle === 'left' ? 'w-resize' : 'e-resize'
            };

        case Action.UPDATE_RESIZE:
            if (!state.resize) return state;
            return {
                ...state,
                resize: { ...state.resize, delta: action.payload.delta }
            };

        case Action.END_RESIZE:
            return {
                ...state,
                mode: Mode.IDLE,
                resize: null,
                cursor: 'default'
            };

        case Action.START_AREA:
            return {
                ...state,
                mode: Mode.AREA_SELECT,
                areaSelect: {
                    type: action.payload.type,
                    start: action.payload.start,
                    end: action.payload.start,
                    path: action.payload.type === 'lasso' ? [action.payload.start] : null
                }
            };

        case Action.UPDATE_AREA:
            if (!state.areaSelect) return state;
            const updated = {
                ...state.areaSelect,
                end: action.payload.end
            };
            if (updated.type === 'lasso' && updated.path) {
                updated.path = [...updated.path, action.payload.end];
            }
            return { ...state, areaSelect: updated };

        case Action.END_AREA:
            return {
                ...state,
                mode: Mode.IDLE,
                areaSelect: null
            };

        case Action.SET_HOVER:
            return { ...state, hover: action.payload.noteId };

        case Action.SET_CURSOR:
            return { ...state, cursor: action.payload.cursor };

        case Action.SET_MODE:
            return { ...state, mode: action.payload.mode };

        case Action.CLIPBOARD:
            return { ...state, clipboard: action.payload.data };

        default:
            return state;
    }
}

// ===================================================================
// HOOK
// ===================================================================

export function useNoteInteractionsV3({
    engine,
    activeTool,
    snapValue,
    currentInstrument,
    loopRegion,
    keyboardPianoMode
}) {
    const [state, dispatch] = useReducer(reducer, null, createInitialState);
    const commandStackRef = useRef(null);

    // ✅ Store selectors - use individual selectors to prevent re-render loops
    const activePatternId = useArrangementStore(state => state.activePatternId);
    const patterns = useArrangementStore(state => state.patterns);
    const updatePatternNotes = useArrangementStore(state => state.updatePatternNotes);

    // Initialize command stack
    useEffect(() => {
        commandStackRef.current = getCommandStack();
    }, []);

    // ===================================================================
    // NOTES
    // ===================================================================

    const notes = useMemo(() => {
        if (!activePatternId || !currentInstrument) return [];
        const pattern = patterns[activePatternId];
        const rawNotes = pattern?.data?.[currentInstrument.id] || [];

        // ✅ V3: Normalize notes - convert old format to new format
        const normalizedNotes = rawNotes.map(note => {
            if (!note || typeof note !== 'object') {
                return null;
            }

            // Convert old format to new format
            let normalized = { ...note };

            // Convert `time` to `startTime`
            if (normalized.time !== undefined && normalized.startTime === undefined) {
                normalized.startTime = normalized.time;
            }

            // Convert `duration` to `length` (Tone.js duration string to beats)
            if (normalized.duration !== undefined && normalized.length === undefined) {
                // Simple duration conversion (Tone.js notation to beats)
                const durationMap = {
                    '1n': 4,    // whole note = 4 beats
                    '2n': 2,    // half note = 2 beats
                    '4n': 1,    // quarter note = 1 beat
                    '8n': 0.5,  // eighth note = 0.5 beats
                    '16n': 0.25 // sixteenth note = 0.25 beats
                };
                normalized.length = durationMap[normalized.duration] || 1;
                normalized.visualLength = normalized.length;
            }

            // Convert pitch string to MIDI number (e.g., 'C4' -> 60)
            if (typeof normalized.pitch === 'string') {
                const noteMap = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
                const match = normalized.pitch.match(/^([A-G])#?(\d+)$/);
                if (match) {
                    const [, noteName, octave] = match;
                    const isSharp = normalized.pitch.includes('#');
                    normalized.pitch = (parseInt(octave) + 1) * 12 + noteMap[noteName] + (isSharp ? 1 : 0);
                } else {
                    console.warn('⚠️ Could not parse pitch:', normalized.pitch);
                    return null;
                }
            }

            return normalized;
        }).filter(Boolean);

        // Filter out invalid notes
        const validNotes = normalizedNotes.filter(note => {
            if (note.startTime === undefined || typeof note.startTime !== 'number') {
                console.warn('⚠️ Invalid note (bad startTime):', note);
                return false;
            }
            if (note.pitch === undefined || typeof note.pitch !== 'number') {
                console.warn('⚠️ Invalid note (bad pitch):', note);
                return false;
            }
            if (note.length === undefined || typeof note.length !== 'number') {
                console.warn('⚠️ Invalid note (bad length):', note);
                return false;
            }
            return true;
        });

        if (validNotes.length !== rawNotes.length) {
            console.warn(`⚠️ Normalized ${rawNotes.length} notes -> ${validNotes.length} valid notes`);
        }

        return validNotes;
    }, [patterns, activePatternId, currentInstrument, state.mode]); // Re-fetch when mode changes

    // ===================================================================
    // HELPERS - Coordinate conversion
    // ===================================================================

    const KEYBOARD_WIDTH = 80;
    const RULER_HEIGHT = 30;

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



    // ===================================================================
    // HELPERS - Store operations
    // ===================================================================

    // ✅ INTERNAL: Add notes without command (for undo/redo)
    const _addNotesToPattern = useCallback((newNotes) => {
        if (!activePatternId || !currentInstrument) return;

        const updatedNotes = [...notes, ...newNotes];
        updatePatternNotes(activePatternId, currentInstrument.id, updatedNotes);

        // ✅ EVENT BUS: Notify audio engine immediately
        newNotes.forEach(note => {
            EventBus.emit('NOTE_ADDED', {
                patternId: activePatternId,
                instrumentId: currentInstrument.id,
                note
            });
        });
    }, [notes, activePatternId, currentInstrument, updatePatternNotes]);

    // ✅ PUBLIC: Add notes with CommandStack (for undo/redo)
    const addNotesToPattern = useCallback((newNotes, skipUndo = false) => {
        if (!activePatternId || !currentInstrument) return;

        if (skipUndo) {
            // Direct add (for undo/redo)
            _addNotesToPattern(newNotes);
            return;
        }

        // ✅ COMMAND STACK: Create AddNoteCommand for each note
        const stack = commandStackRef.current;
        if (stack && newNotes.length > 0) {
            if (newNotes.length === 1) {
                // Single note - simple command
                const command = new AddNoteCommand(
                    newNotes[0],
                    (note) => _addNotesToPattern([note]),
                    (noteIds) => {
                        const notesToDelete = notes.filter(n => noteIds.includes(n.id));
                        _deleteNotesFromPattern(noteIds);
                    }
                );
                stack.execute(command);
            } else {
                // Multiple notes - batch command
                const commands = newNotes.map(note => 
                    new AddNoteCommand(
                        note,
                        (note) => _addNotesToPattern([note]),
                        (noteIds) => {
                            const notesToDelete = notes.filter(n => noteIds.includes(n.id));
                            _deleteNotesFromPattern(noteIds);
                        }
                    )
                );
                const batchCommand = new BatchCommand(commands, `Add ${newNotes.length} note(s)`);
                stack.execute(batchCommand);
            }
        } else {
            // Fallback if CommandStack not available
            _addNotesToPattern(newNotes);
        }
    }, [notes, activePatternId, currentInstrument, _addNotesToPattern]);

    // ✅ INTERNAL: Delete notes without command (for undo/redo)
    const _deleteNotesFromPattern = useCallback((noteIds) => {
        if (!activePatternId || !currentInstrument) return;

        // Get notes to be deleted for event emission
        const notesToDelete = notes.filter(n => noteIds.includes(n.id));

        const updatedNotes = notes.filter(n => !noteIds.includes(n.id));
        updatePatternNotes(activePatternId, currentInstrument.id, updatedNotes);

        // ✅ EVENT BUS: Notify audio engine immediately
        notesToDelete.forEach(note => {
            EventBus.emit('NOTE_REMOVED', {
                patternId: activePatternId,
                instrumentId: currentInstrument.id,
                noteId: note.id,
                note // Pass full note object for context if needed
            });
        });
    }, [notes, activePatternId, currentInstrument, updatePatternNotes]);

    // ✅ PUBLIC: Delete notes with CommandStack (for undo/redo)
    const deleteNotesFromPattern = useCallback((noteIds, skipUndo = false) => {
        if (!activePatternId || !currentInstrument) return;
        if (!noteIds || noteIds.length === 0) return;

        if (skipUndo) {
            // Direct delete (for undo/redo)
            _deleteNotesFromPattern(noteIds);
            return;
        }

        // ✅ COMMAND STACK: Create DeleteNotesCommand
        const stack = commandStackRef.current;
        const notesToDelete = notes.filter(n => noteIds.includes(n.id));
        
        if (stack && notesToDelete.length > 0) {
            const command = new DeleteNotesCommand(
                notesToDelete,
                (ids) => _deleteNotesFromPattern(ids),
                (notesArray) => _addNotesToPattern(notesArray)
            );
            stack.execute(command);
        } else {
            // Fallback if CommandStack not available
            _deleteNotesFromPattern(noteIds);
        }
    }, [notes, activePatternId, currentInstrument, _deleteNotesFromPattern, _addNotesToPattern]);



    // ===================================================================
    // HELPERS - Note queries
    // ===================================================================

    const findNoteAtPosition = useCallback((coords) => {
        const { keyHeight } = engine.dimensions || { keyHeight: 20 };

        // ✅ FIX: Calculate exact note boundaries matching renderer
        // Renderer: y = (127 - pitch) * keyHeight, height = keyHeight - 1
        // This means note is TOP-ALIGNED (not centered) at pitch
        // 
        // Pitch to Y conversion: pitch = 127 - y / keyHeight
        // Note at pitch 60, keyHeight 20:
        // - Top Y: (127 - 60) * 20 = 1340 → pitch = 60.0
        // - Bottom Y: 1340 + 19 = 1359 → pitch = 127 - 1359/20 = 59.05
        // - Range: [59.05, 60.0] (inclusive)
        //
        // Formula: bottomPitch = pitch - (keyHeight - 1) / keyHeight
        const actualNoteHeight = keyHeight - 1;
        const pitchRange = actualNoteHeight / keyHeight; // 19/20 = 0.95 for keyHeight=20

        // ✅ WYSIWYG PRINCIPLE: Use exact visible area, no padding
        // What you see is what you get - click only on visible note area
        const candidates = notes.filter(n => {
            // ✅ FL STUDIO STYLE: Use visualLength for hit detection (oval notes support)
            const displayLength = n.visualLength !== undefined ? n.visualLength : n.length;
            const noteEndTime = n.startTime + displayLength;

            // ✅ EXACT TIME BOUNDARIES - No tolerance, only visible area
            // Use inclusive boundaries to match visual rendering exactly
            // >= start and <= end (both inclusive) matches what user sees
            const timeMatch = coords.time >= n.startTime && coords.time <= noteEndTime;

            // ✅ EXACT PITCH BOUNDARIES - Match renderer exactly (TOP-ALIGNED, not centered)
            // Note is TOP-ALIGNED at note.pitch, so it spans:
            // - Top edge: pitch (exactly)
            // - Bottom edge: pitch - pitchRange
            // Example: pitch=60, keyHeight=20, pitchRange=0.95
            // - Top: 60.0
            // - Bottom: 60 - 0.95 = 59.05
            // - Range: [59.05, 60.0] (inclusive) ✓ Matches renderer!
            const notePitchMin = n.pitch - pitchRange;
            const notePitchMax = n.pitch;
            const pitchMatch = coords.pitch >= notePitchMin && coords.pitch <= notePitchMax;

            return timeMatch && pitchMatch;
        });

        // ✅ FIX: If multiple notes overlap, prefer:
        // 1. Selected notes (if any are selected)
        // 2. Notes with highest pitch (topmost)
        // 3. Notes with shortest visualLength (most visible)
        if (candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];

        // Check if any candidate is selected
        const selectedCandidates = candidates.filter(n => state.selection.has(n.id));
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
    }, [notes, engine, state.selection]);

    const getResizeHandle = useCallback((coords, note) => {
        if (!note) return null;
        const noteEnd = note.startTime + (note.visualLength || note.length);
        
        // ✅ FIX: Smaller, more precise resize handle detection
        // Use a smaller threshold for better precision (0.15-0.2 range)
        // This makes resize handles more precise and less likely to trigger accidentally
        const threshold = snapValue > 0 
            ? Math.min(0.2, Math.max(0.1, snapValue * 0.15))  // 15% of snap value, clamped between 0.1-0.2
            : 0.15;  // Default 0.15 when no snap

        if (Math.abs(coords.time - note.startTime) < threshold) return 'left';
        if (Math.abs(coords.time - noteEnd) < threshold) return 'right';
        return null;
    }, [snapValue]);

    const snapToGrid = useCallback((value) => {
        if (snapValue <= 0) return value;
        // ✅ FIX: Snap to grid based on grid center (note interaction için)
        // Grid'in ilk %80'ine (0-0.8) bastığında -> o grid'e yaz (Math.floor)
        // Grid'in son %20'sine (0.8-1.0) bastığında -> sonraki grid'e yaz (Math.ceil)
        // Example: snapValue=1, value=0.0 -> gridPos=0.0 < 0.8 -> floor(0.0/1)*1 = 0 ✓
        //          snapValue=1, value=0.7 -> gridPos=0.7 < 0.8 -> floor(0.7/1)*1 = 0 ✓
        //          snapValue=1, value=0.9 -> gridPos=0.9 >= 0.8 -> ceil(0.9/1)*1 = 1 ✓
        //          snapValue=1, value=1.7 -> gridPos=0.7 < 0.8 -> floor(1.7/1)*1 = 1 ✓
        //          snapValue=1, value=1.9 -> gridPos=0.9 >= 0.8 -> ceil(1.9/1)*1 = 2 ✓
        const gridCenter = snapValue * 0.8; // 80% threshold
        const gridPosition = (value % snapValue + snapValue) % snapValue; // Handle negative values
        
        if (gridPosition < gridCenter) {
            // Grid'in ilk %80'i -> o grid'e yaz
            return Math.floor(value / snapValue) * snapValue;
        } else {
            // Grid'in son %20'si -> sonraki grid'e yaz
            return Math.ceil(value / snapValue) * snapValue;
        }
    }, [snapValue]);

    // ===================================================================
    // SELECTION
    // ===================================================================

    const select = useCallback((noteIds, mode = 'replace') => {
        dispatch({
            type: Action.SELECT,
            payload: { noteIds: Array.isArray(noteIds) ? noteIds : [noteIds], mode }
        });
    }, []);

    const clearSelection = useCallback(() => {
        dispatch({ type: Action.CLEAR_SELECTION });
    }, []);

    // ===================================================================
    // DRAG & RESIZE - Must be defined before tool handlers
    // ===================================================================

    const startDrag = useCallback((noteIds, coords, isDuplicate) => {
        const originals = new Map();
        noteIds.forEach(id => {
            const note = notes.find(n => n.id === id);
            if (note) {
                originals.set(id, {
                    startTime: note.startTime,
                    pitch: note.pitch,
                    length: note.length,
                    visualLength: note.visualLength
                });
            }
        });

        if (isDuplicate) {
            // Create duplicates
            const duplicates = noteIds.map(id => {
                const note = notes.find(n => n.id === id);
                if (!note) return null;
                return {
                    ...note,
                    id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                };
            }).filter(Boolean);

            addNotesToPattern(duplicates);

            // Update noteIds to duplicates
            noteIds = duplicates.map(d => d.id);

            // Update originals
            originals.clear();
            duplicates.forEach(d => {
                originals.set(d.id, {
                    startTime: d.startTime,
                    pitch: d.pitch,
                    length: d.length,
                    visualLength: d.visualLength
                });
            });

            // Select duplicates
            select(noteIds, 'replace');
        }

        dispatch({
            type: Action.START_DRAG,
            payload: { noteIds, start: coords, originals, isDuplicate }
        });

        if (DEBUG) {
            console.log('🎯 [V3] Drag started:', noteIds.length, 'notes');
        }
    }, [notes, addNotesToPattern, select]);

    const startResize = useCallback((note, handle, coords) => {
        const noteIds = state.selection.has(note.id)
            ? Array.from(state.selection)
            : [note.id];

        const originals = new Map();
        noteIds.forEach(id => {
            const n = notes.find(n => n.id === id);
            if (n) {
                originals.set(id, {
                    startTime: n.startTime,
                    length: n.length,
                    visualLength: n.visualLength
                });
            }
        });

        dispatch({
            type: Action.START_RESIZE,
            payload: { noteIds, handle, start: coords, originals }
        });
    }, [state.selection, notes]);

    // ===================================================================
    // TOOL HANDLERS
    // ===================================================================

    const handleSelectTool = useCallback((e, coords, note) => {
        if (DEBUG) {
            console.log('🔍 [V3] Select tool:', {
                hasNote: !!note,
                altKey: e.altKey,
                coords
            });
        }

        if (!note) {
            // Empty area - start area selection
            const type = e.altKey ? 'lasso' : 'rect';

            if (DEBUG) {
                console.log('📦 [V3] Starting area selection:', type);
            }

            dispatch({
                type: Action.START_AREA,
                payload: { type, start: coords }
            });
            return;
        }

        const isCtrl = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;

        // ✅ FIX: Check for resize handle FIRST - if handle detected, always start resize
        // This works for both selected and unselected notes
        // If cursor is on resize handle, user clearly wants to resize, not move
        const handle = getResizeHandle(coords, note);
        if (handle) {
            // ✅ FIX: If note is not selected, select it first (for multi-resize if needed)
            if (!state.selection.has(note.id)) {
                select(note.id, 'replace');
            }
            startResize(note, handle, coords);
            return;
        }

        // Selection logic (only if not on resize handle)
        if (isCtrl) {
            // Toggle selection
            select(note.id, 'toggle');
            return; // Don't start drag on toggle
        }

        // Determine working notes
        let workingIds;
        if (state.selection.has(note.id)) {
            // Clicking selected note - keep selection
            workingIds = Array.from(state.selection);
        } else {
            // Clicking unselected note - replace selection
            select(note.id, 'replace');
            workingIds = [note.id];
        }

        // Start drag
        startDrag(workingIds, coords, isShift);

    }, [state.selection, getResizeHandle, select, startResize, startDrag]);

    const handlePaintTool = useCallback((e, coords, note) => {
        // ✅ FIX: First check if there's a note at raw coordinates (for immediate feedback)
        // This uses hit detection to give instant feedback
        if (note) return; // Can't paint on existing note

        // ✅ FIX: Snap coordinates FIRST, then check if snapped position is empty
        // This ensures paint tool uses same tolerance as hit detection
        // snapToGrid snaps based on grid center: first half -> current grid, second half -> next grid
        const snappedTime = snapToGrid(coords.time);
        
        // ✅ FIX: Pitch rounding with grid center sensitivity (note interaction için)
        // Grid'in ilk %80'ine (0-0.8) bastığında -> o pitch'e yaz (Math.floor)
        // Grid'in son %20'sine (0.8-1.0) bastığında -> sonraki pitch'e yaz (Math.ceil)
        // Bu, pitch için daha hassas kontrol sağlar
        // Example: pitch=60.0 -> pitchPos=0.0 < 0.8 -> floor(60.0) = 60 ✓
        //          pitch=60.7 -> pitchPos=0.7 < 0.8 -> floor(60.7) = 60 ✓
        //          pitch=60.9 -> pitchPos=0.9 >= 0.8 -> ceil(60.9) = 61 ✓
        const pitchGridCenter = 0.8; // 80% threshold
        const pitchPosition = (coords.pitch % 1 + 1) % 1; // Handle negative values, get fractional part
        
        let finalPitch;
        if (pitchPosition < pitchGridCenter) {
            // Grid'in ilk %80'i -> o pitch'e yaz
            finalPitch = Math.floor(coords.pitch);
        } else {
            // Grid'in son %20'si -> sonraki pitch'e yaz
            finalPitch = Math.ceil(coords.pitch);
        }
        
        // Clamp to valid MIDI range
        finalPitch = Math.max(0, Math.min(127, finalPitch));
        
        // snappedTime is already at grid position, no need to round again
        const finalTime = snappedTime;
        
        const lengthInSteps = snapValue || 1;

        // ✅ FIX: Check if snapped position already has a note
        // For paint tool, we need STRICTER check than hit detection for time
        // Hit detection uses inclusive boundaries, but paint tool should allow writing
        // notes at the exact end of another note (for continuous note writing)
        // So we use EXCLUSIVE end boundary for paint tool duplicate check
        const { keyHeight } = engine.dimensions || { keyHeight: 20 };
        const actualNoteHeight = keyHeight - 1;
        const pitchRange = actualNoteHeight / keyHeight;
        
        const existingNote = notes.find(n => {
            const displayLength = n.visualLength !== undefined ? n.visualLength : n.length;
            const noteEndTime = n.startTime + displayLength;
            
            // ✅ FIX: Time overlap check with EXCLUSIVE end boundary for paint tool
            // This allows writing notes at the exact end of another note
            // >= start and < end (end is exclusive) allows writing at noteEndTime
            // Example: note at [0, 1], finalTime=1.0 -> 1.0 >= 0 && 1.0 < 1 = false ✓ (can write)
            //          note at [0, 1], finalTime=0.5 -> 0.5 >= 0 && 0.5 < 1 = true ✗ (duplicate)
            const timeOverlap = finalTime >= n.startTime && finalTime < noteEndTime;
            
            // Pitch overlap check (same as hit detection - TOP-ALIGNED)
            const notePitchMin = n.pitch - pitchRange;
            const notePitchMax = n.pitch;
            const pitchOverlap = finalPitch >= notePitchMin && finalPitch <= notePitchMax;
            
            return timeOverlap && pitchOverlap;
        });
        
        if (existingNote) {
            // Position already occupied, don't create duplicate
            if (DEBUG) {
                console.log('⚠️ [V3] Paint blocked - note exists at snapped position:', {
                    snapped: { time: finalTime, pitch: finalPitch },
                    existing: { 
                        time: existingNote.startTime, 
                        end: existingNote.startTime + (existingNote.visualLength || existingNote.length), 
                        pitch: existingNote.pitch 
                    }
                });
            }
            return;
        }

        // ✅ COMPATIBILITY: Create note in both formats for backward compatibility
        // Piano Roll uses: startTime, pitch (MIDI number), length (steps), velocity (0-127)
        // Channel Rack uses: time, pitch (string), duration (Tone.js), velocity (0-1), length (steps)
        const newNote = {
            id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,

            // ✅ Piano Roll format (for rendering)
            startTime: finalTime, // Rounded to grid center, then to grid
            pitch: finalPitch, // MIDI number (0-127) - rounded to grid center
            length: lengthInSteps,
            visualLength: lengthInSteps,

            // ✅ Channel Rack format (for playback - legacy compatibility)
            time: finalTime,
            duration: stepsToDurationString(lengthInSteps), // Convert steps to Tone.js duration

            // ✅ Velocity: Use 0-127 format (more standard)
            velocity: 100,

            muted: false
        };

        addNotesToPattern([newNote]);

        // ✅ PREVIEW: Play note sound with short duration (200ms)
        // This gives immediate feedback when painting notes
        getPreviewManager().previewNote(finalPitch, 100, 0.2);

    }, [snapToGrid, snapValue, addNotesToPattern, findNoteAtPosition]);

    const handleEraserTool = useCallback((e, coords, note) => {
        if (!note) return;
        deleteNotesFromPattern([note.id]);
    }, [deleteNotesFromPattern]);

    // ===================================================================
    // MOUSE DOWN - Main entry point for mouse interactions
    // ===================================================================

    const handleMouseDown = useCallback((e) => {
        if (keyboardPianoMode) return;

        const coords = getCoordinatesFromEvent(e);
        const foundNote = findNoteAtPosition(coords);

        if (DEBUG) {
            console.log('🎯 [V3] Mouse down:', {
                activeTool,
                foundNote: foundNote ? foundNote.id : null,
                coords: { time: coords.time.toFixed(2), pitch: Math.round(coords.pitch) }
            });
        }

        // Tool-specific behavior
        if (activeTool === TOOL_TYPES.SELECT) {
            if (foundNote && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                // ✅ PREVIEW: Play note when clicking/selecting with short duration (300ms)
                getPreviewManager().previewNote(foundNote.pitch, foundNote.velocity || 100, 0.3);
            }
            handleSelectTool(e, coords, foundNote);
        } else if (activeTool === TOOL_TYPES.PAINT_BRUSH) {
            handlePaintTool(e, coords, foundNote);
        } else if (activeTool === TOOL_TYPES.ERASER) {
            handleEraserTool(e, coords, foundNote);
        }
    }, [activeTool, keyboardPianoMode, getCoordinatesFromEvent, findNoteAtPosition, handleSelectTool, handlePaintTool, handleEraserTool]);

    // ===================================================================
    // FINALIZE & CURSOR - Must be defined before mouse handlers
    // ===================================================================

    const finalizeDrag = useCallback(() => {
        if (!state.drag || !state.drag.delta) return;

        const { noteIds, originals, delta } = state.drag;

        // Check if moved
        if (Math.abs(delta.time) < 0.001 && delta.pitch === 0) {
            dispatch({ type: Action.END_DRAG });
            return;
        }

        // ✅ CONSTRAINT SYSTEM: If any note hits a boundary, all notes stop together
        // This preserves relative positioning and prevents notes from separating

        // 1. Find the most restrictive constraint for all notes
        let constrainedDeltaTime = delta.time;
        let constrainedDeltaPitch = delta.pitch;

        noteIds.forEach(id => {
            const orig = originals.get(id);
            if (!orig) return;

            // Time constraint (can't go below 0)
            const minTimeAllowed = -orig.startTime;
            if (delta.time < minTimeAllowed) {
                constrainedDeltaTime = Math.max(constrainedDeltaTime, minTimeAllowed);
            }

            // Pitch constraint (0-127 range)
            const newPitch = orig.pitch + delta.pitch;
            if (newPitch < 0) {
                // How much can we move down before hitting 0?
                const maxDownMovement = -orig.pitch;
                constrainedDeltaPitch = Math.max(constrainedDeltaPitch, maxDownMovement);
            } else if (newPitch > 127) {
                // How much can we move up before hitting 127?
                const maxUpMovement = 127 - orig.pitch;
                constrainedDeltaPitch = Math.min(constrainedDeltaPitch, maxUpMovement);
            }
        });

        // 2. Apply constrained delta to all notes
        const updated = notes.map(note => {
            if (!noteIds.includes(note.id)) return note;

            const orig = originals.get(note.id);
            if (!orig) return note;

            let newTime = orig.startTime + constrainedDeltaTime;
            let newPitch = orig.pitch + constrainedDeltaPitch;

            // Snap time to grid
            newTime = snapToGrid(Math.max(0, newTime));

            // Round pitch (should already be in range due to constraints)
            newPitch = Math.max(0, Math.min(127, Math.round(newPitch)));

            return { ...note, startTime: newTime, pitch: newPitch };
        });

        if (activePatternId && currentInstrument) {
            // ✅ COMMAND STACK: Create MoveNotesCommand
            const stack = commandStackRef.current;
            if (stack) {
                // Build original and new states maps
                const originalStates = new Map();
                const newStates = new Map();
                
                noteIds.forEach(id => {
                    const orig = originals.get(id);
                    const updatedNote = updated.find(n => n.id === id);
                    if (orig && updatedNote) {
                        originalStates.set(id, { startTime: orig.startTime, pitch: orig.pitch });
                        newStates.set(id, { startTime: updatedNote.startTime, pitch: updatedNote.pitch });
                    }
                });

                const updatePatternStoreFn = (statesMap) => {
                    const finalNotes = notes.map(note => {
                        if (noteIds.includes(note.id)) {
                            const state = statesMap.get(note.id);
                            if (state) {
                                return { ...note, startTime: state.startTime, pitch: state.pitch };
                            }
                        }
                        return note;
                    });
                    updatePatternNotes(activePatternId, currentInstrument.id, finalNotes);
                    
                    // EventBus notifications
                    finalNotes.forEach(note => {
                        if (noteIds.includes(note.id)) {
                            EventBus.emit('NOTE_MODIFIED', {
                                patternId: activePatternId,
                                instrumentId: currentInstrument.id,
                                note
                            });
                        }
                    });
                };

                const command = new MoveNotesCommand(
                    noteIds,
                    originalStates,
                    newStates,
                    updatePatternStoreFn
                );
                stack.execute(command);
            } else {
                // Fallback if CommandStack not available
                updatePatternNotes(activePatternId, currentInstrument.id, updated);

                // ✅ EVENT BUS: Notify audio engine of modifications
                updated.forEach(note => {
                    if (noteIds.includes(note.id)) {
                        EventBus.emit('NOTE_MODIFIED', {
                            patternId: activePatternId,
                            instrumentId: currentInstrument.id,
                            note
                        });
                    }
                });
            }
        }

        if (DEBUG) {
            console.log('✅ [V3] Moved', noteIds.length, 'notes by', {
                original: delta,
                constrained: { time: constrainedDeltaTime, pitch: constrainedDeltaPitch }
            });
        }

        // ✅ PREVIEW: Play the first moved note to confirm new pitch with short duration (200ms)
        if (updated.length > 0) {
            const primaryNote = updated.find(n => noteIds.includes(n.id));
            if (primaryNote) {
                getPreviewManager().previewNote(primaryNote.pitch, primaryNote.velocity || 100, 0.2);
            }
        }

        dispatch({ type: Action.END_DRAG });
    }, [state.drag, notes, snapToGrid, activePatternId, currentInstrument, updatePatternNotes]);

    const finalizeResize = useCallback(() => {
        if (!state.resize) return;

        const { noteIds, handle, originals, delta } = state.resize;

        // ✅ CONSTRAINT SYSTEM: If any note hits a boundary, all notes stop together
        let constrainedDelta = delta;

        if (handle === 'left') {
            // Left handle: can't move start time below 0
            noteIds.forEach(id => {
                const orig = originals.get(id);
                if (!orig) return;

                const minTimeAllowed = -orig.startTime;
                if (delta < minTimeAllowed) {
                    constrainedDelta = Math.max(constrainedDelta, minTimeAllowed);
                }
            });
        }
        // Right handle: no constraint needed (can grow infinitely)

        // ✅ FIX: Get fresh notes from store to avoid closure issues
        const getCurrentNotes = () => {
            if (!activePatternId || !currentInstrument) return notes;
            const currentPattern = useArrangementStore.getState().patterns[activePatternId];
            return currentPattern?.data?.[currentInstrument.id] || notes;
        };

        const currentNotes = getCurrentNotes();
        const updated = currentNotes.map(note => {
            if (!noteIds.includes(note.id)) return note;

            const orig = originals.get(note.id);
            if (!orig) {
                console.warn(`⚠️ Resize: Original note not found in originals map: ${note.id}`, {
                    noteId: note.id,
                    noteIds: Array.from(noteIds),
                    originalsKeys: Array.from(originals.keys())
                });
                return note; // Return unchanged note if original not found
            }

            let newTime = orig.startTime;
            let newVisualLength = orig.visualLength || orig.length;

            // ✅ Minimum length: Use snap value as minimum (or 0.25 if no snap)
            const minLength = snapValue > 0 ? snapValue : 0.25;

            if (handle === 'left') {
                // ✅ Left handle: Snap start time, calculate new length, then snap length
                const originalEndTime = orig.startTime + (orig.visualLength || orig.length);
                const snappedNewTime = snapToGrid(Math.max(0, orig.startTime + constrainedDelta));
                newTime = snappedNewTime;

                // Calculate new length based on snapped start time
                let calculatedLength = Math.max(minLength, originalEndTime - snappedNewTime);

                // ✅ Snap the resulting length to grid
                newVisualLength = snapValue > 0
                    ? Math.max(minLength, snapToGrid(calculatedLength))
                    : calculatedLength;
            } else {
                // ✅ Right handle: Snap end time, then calculate new length
                const originalEndTime = orig.startTime + (orig.visualLength || orig.length);
                let newEndTime = originalEndTime + constrainedDelta;

                // Snap the end time
                const snappedEndTime = snapValue > 0
                    ? snapToGrid(Math.max(0, newEndTime))
                    : Math.max(0, newEndTime);

                // Calculate new length from snapped end time
                newVisualLength = Math.max(minLength, snappedEndTime - orig.startTime);
            }

            // ✅ RESIZE BEHAVIOR: When user manually resizes a note, it should no longer be oval
            // The resize action means "I want to control the exact duration"
            // So we sync length with visualLength, making it a normal (non-oval) note
            return {
                ...note,
                startTime: newTime,
                visualLength: newVisualLength,
                length: newVisualLength // ✅ Sync length with visualLength (exit oval mode)
            };
        });

        if (activePatternId && currentInstrument) {
            // ✅ COMMAND STACK: Create UpdateNoteCommand for each resized note
            const stack = commandStackRef.current;
            if (stack && noteIds.length > 0) {
                if (noteIds.length === 1) {
                    // Single note - simple command
                    const noteId = noteIds[0];
                    const orig = originals.get(noteId);
                    const updatedNote = updated.find(n => n.id === noteId);
                    if (orig && updatedNote) {
                        const oldState = {
                            startTime: orig.startTime,
                            length: orig.length,
                            visualLength: orig.visualLength
                        };
                        const newState = {
                            startTime: updatedNote.startTime,
                            length: updatedNote.length,
                            visualLength: updatedNote.visualLength
                        };

                        const updateNoteFn = (id, state) => {
                            // ✅ FIX: Get fresh notes from store to avoid closure issues
                            const freshNotes = getCurrentNotes();
                            const finalNotes = freshNotes.map(n =>
                                n.id === id ? { ...n, ...state } : n
                            );
                            updatePatternNotes(activePatternId, currentInstrument.id, finalNotes);
                            
                            // EventBus notification
                            const modifiedNote = finalNotes.find(n => n.id === id);
                            if (modifiedNote) {
                                EventBus.emit('NOTE_MODIFIED', {
                                    patternId: activePatternId,
                                    instrumentId: currentInstrument.id,
                                    note: modifiedNote
                                });
                            }
                        };

                        const command = new UpdateNoteCommand(noteId, oldState, newState, updateNoteFn);
                        stack.execute(command);
                    }
                } else {
                    // Multiple notes - batch command
                    // ✅ FIX: Create a shared update function that updates all notes at once
                    // This prevents each command from overwriting previous updates
                    const allOldStates = new Map();
                    const allNewStates = new Map();
                    
                    noteIds.forEach(noteId => {
                        const orig = originals.get(noteId);
                        const updatedNote = updated.find(n => n.id === noteId);
                        if (orig && updatedNote) {
                            allOldStates.set(noteId, {
                                startTime: orig.startTime,
                                length: orig.length,
                                visualLength: orig.visualLength
                            });
                            allNewStates.set(noteId, {
                                startTime: updatedNote.startTime,
                                length: updatedNote.length,
                                visualLength: updatedNote.visualLength
                            });
                        }
                    });

                    // ✅ FIX: Single update function that updates all notes at once
                    // This function will be called once for the entire batch
                    // ✅ FIX: Get fresh notes from store each time to avoid closure issues
                    const updateAllNotesFn = (statesToApply) => {
                        // ✅ FIX: Get fresh notes from store each time (not from closure)
                        const freshNotes = getCurrentNotes();
                        
                        // Apply all updates at once
                        const finalNotes = freshNotes.map(n => {
                            const state = statesToApply.get(n.id);
                            if (state) {
                                return { ...n, ...state };
                            }
                            return n;
                        });
                        
                        // ✅ FIX: Ensure all notes are preserved (not just updated ones)
                        // This prevents notes from disappearing if they're not in statesToApply
                        const finalNotesMap = new Map(finalNotes.map(n => [n.id, n]));
                        freshNotes.forEach(note => {
                            if (!finalNotesMap.has(note.id)) {
                                finalNotesMap.set(note.id, note);
                            }
                        });
                        const allNotes = Array.from(finalNotesMap.values());
                        
                        // Update pattern notes with all changes at once
                        updatePatternNotes(activePatternId, currentInstrument.id, allNotes);
                        
                        // ✅ EVENT BUS: Notify audio engine of all modifications
                        finalNotes.forEach(note => {
                            if (noteIds.includes(note.id)) {
                                EventBus.emit('NOTE_MODIFIED', {
                                    patternId: activePatternId,
                                    instrumentId: currentInstrument.id,
                                    note
                                });
                            }
                        });
                    };

                    // Create commands with shared update function
                    const commands = Array.from(allOldStates.keys()).map(noteId => {
                        const oldState = allOldStates.get(noteId);
                        const newState = allNewStates.get(noteId);
                        
                        // Each command stores its state, but uses shared update function
                        // ✅ FIX: Use a flag to track whether we're executing or undoing
                        let isExecuting = true;
                        
                        const updateNoteFn = (id, state) => {
                            // Create a map with all states for this operation
                            const statesMap = new Map();
                            
                            // Determine which states to apply based on the state passed
                            // If state matches newState structure, we're executing
                            // If state matches oldState structure, we're undoing
                            const isNewState = state.startTime === newState.startTime && 
                                            state.length === newState.length &&
                                            state.visualLength === newState.visualLength;
                            
                            if (isNewState) {
                                // Execute: apply all new states
                                allNewStates.forEach((s, nid) => statesMap.set(nid, s));
                            } else {
                                // Undo: apply all old states
                                allOldStates.forEach((s, nid) => statesMap.set(nid, s));
                            }
                            
                            // Update all notes at once
                            updateAllNotesFn(statesMap);
                        };

                        return new UpdateNoteCommand(noteId, oldState, newState, updateNoteFn);
                    }).filter(Boolean);

                    if (commands.length > 0) {
                        // ✅ FIX: Create custom batch command that updates all notes at once
                        const batchCommand = new BatchCommand(commands, `Resize ${commands.length} note(s)`);
                        
                        // Override execute to call updateAllNotesFn once with all new states
                        const originalExecute = batchCommand.execute.bind(batchCommand);
                        batchCommand.execute = function() {
                            // Update all notes at once with new states
                            updateAllNotesFn(allNewStates);
                            // Mark commands as executed for undo/redo tracking
                            this.commands.forEach(cmd => {
                                if (cmd.executed !== undefined) {
                                    cmd.executed = true;
                                }
                            });
                        };
                        
                        // Override undo to call updateAllNotesFn once with all old states
                        const originalUndo = batchCommand.undo.bind(batchCommand);
                        batchCommand.undo = function() {
                            // Update all notes at once with old states
                            updateAllNotesFn(allOldStates);
                            // Mark commands as not executed
                            this.commands.forEach(cmd => {
                                if (cmd.executed !== undefined) {
                                    cmd.executed = false;
                                }
                            });
                        };
                        
                        stack.execute(batchCommand);
                    }
                }
            } else {
                // Fallback if CommandStack not available
                updatePatternNotes(activePatternId, currentInstrument.id, updated);

                // ✅ EVENT BUS: Notify audio engine of modifications
                updated.forEach(note => {
                    if (noteIds.includes(note.id)) {
                        EventBus.emit('NOTE_MODIFIED', {
                            patternId: activePatternId,
                            instrumentId: currentInstrument.id,
                            note
                        });
                    }
                });
            }

            // ✅ PREVIEW: Play note after resize with short duration (200ms)
            if (updated.length > 0) {
                const primaryNote = updated.find(n => noteIds.includes(n.id));
                if (primaryNote) {
                    getPreviewManager().previewNote(primaryNote.pitch, primaryNote.velocity || 100, 0.2);
                }
            }
        }
        dispatch({ type: Action.END_RESIZE });
    }, [state.resize, notes, snapToGrid, snapValue, activePatternId, currentInstrument, updatePatternNotes]);

    const finalizeAreaSelection = useCallback(() => {
        if (!state.areaSelect) return;

        const { type, start, end } = state.areaSelect;
        let selected = [];

        if (type === 'rect') {
            const minTime = Math.min(start.time, end.time);
            const maxTime = Math.max(start.time, end.time);
            const minPitch = Math.min(start.pitch, end.pitch);
            const maxPitch = Math.max(start.pitch, end.pitch);

            selected = notes.filter(n => {
                const noteEnd = n.startTime + n.length;
                return n.startTime < maxTime && noteEnd > minTime &&
                    n.pitch >= minPitch && n.pitch <= maxPitch;
            }).map(n => n.id);
        }

        select(selected, 'replace');
        dispatch({ type: Action.END_AREA });

    }, [state.areaSelect, notes, select]);

    const updateCursor = useCallback((note, coords) => {
        let cursor = 'default';

        if (state.mode === Mode.DRAG) {
            cursor = 'grabbing';
        } else if (state.mode === Mode.RESIZE) {
            cursor = state.resize?.handle === 'left' ? 'w-resize' : 'e-resize';
        } else if (activeTool === TOOL_TYPES.SELECT && note) {
            const handle = getResizeHandle(coords, note);
            if (handle) {
                cursor = handle === 'left' ? 'w-resize' : 'e-resize';
            } else {
                cursor = 'grab';
            }
        } else if (activeTool === TOOL_TYPES.PAINT_BRUSH) {
            // ✅ FIX: Paint brush always shows crosshair, even on notes (just won't paint there)
            cursor = 'crosshair';
        } else if (activeTool === TOOL_TYPES.ERASER) {
            cursor = 'not-allowed';
        }

        if (cursor !== state.cursor) {
            dispatch({ type: Action.SET_CURSOR, payload: { cursor } });
        }
    }, [state.mode, state.cursor, state.resize, activeTool, getResizeHandle]);

    // ===================================================================
    // MOUSE MOVE
    // ===================================================================

    const handleMouseMove = useCallback((e) => {
        const coords = getCoordinatesFromEvent(e);
        const foundNote = findNoteAtPosition(coords);

        // Update hover
        dispatch({
            type: Action.SET_HOVER,
            payload: { noteId: foundNote?.id || null }
        });

        // Handle drag
        if (state.mode === Mode.DRAG && state.drag) {
            const rawDeltaTime = coords.time - state.drag.start.time;
            const rawDeltaPitch = coords.pitch - state.drag.start.pitch;

            // ✅ IMPROVEMENT: Apply snap to grid during drag for real-time feedback
            // Calculate final positions for the first note (reference point)
            const firstNoteId = state.drag.noteIds[0];
            const firstNoteOriginal = state.drag.originals.get(firstNoteId);
            
            if (firstNoteOriginal) {
                // Calculate final position
                let finalTime = firstNoteOriginal.startTime + rawDeltaTime;
                let finalPitch = firstNoteOriginal.pitch + rawDeltaPitch;

                // Apply constraints first
                finalTime = Math.max(0, finalTime);
                finalPitch = Math.max(0, Math.min(127, finalPitch));

                // Snap to grid (time only, pitch stays continuous for smooth movement)
                const snappedTime = snapToGrid(finalTime);
                
                // Calculate snapped delta (relative to original position)
                const snappedDeltaTime = snappedTime - firstNoteOriginal.startTime;
                const snappedDeltaPitch = Math.round(finalPitch) - firstNoteOriginal.pitch;

                dispatch({
                    type: Action.UPDATE_DRAG,
                    payload: { delta: { time: snappedDeltaTime, pitch: snappedDeltaPitch } }
                });
            } else {
                // Fallback to raw delta if original not found
                dispatch({
                    type: Action.UPDATE_DRAG,
                    payload: { delta: { time: rawDeltaTime, pitch: rawDeltaPitch } }
                });
            }
        }

        // Handle resize
        if (state.mode === Mode.RESIZE && state.resize) {
            const deltaTime = coords.time - state.resize.start.time;

            dispatch({
                type: Action.UPDATE_RESIZE,
                payload: { delta: deltaTime }
            });
        }

        // Handle area selection
        if (state.mode === Mode.AREA_SELECT && state.areaSelect) {
            dispatch({
                type: Action.UPDATE_AREA,
                payload: { end: coords }
            });
        }

        // Update cursor
        updateCursor(foundNote, coords);

    }, [state.mode, state.drag, state.resize, state.areaSelect, getCoordinatesFromEvent, findNoteAtPosition, updateCursor]);

    // ===================================================================
    // MOUSE UP
    // ===================================================================

    const handleMouseUp = useCallback((e) => {
        if (state.mode === Mode.DRAG && state.drag) {
            finalizeDrag();
        } else if (state.mode === Mode.RESIZE && state.resize) {
            finalizeResize();
        } else if (state.mode === Mode.AREA_SELECT && state.areaSelect) {
            finalizeAreaSelection();
        }
    }, [state.mode, state.drag, state.resize, state.areaSelect, finalizeDrag, finalizeResize, finalizeAreaSelection]);

    // ===================================================================
    // CLIPBOARD OPERATIONS - Must be defined before handleKeyDown
    // ===================================================================

    const copyNotes = useCallback(() => {
        const selectedNotes = notes.filter(n => state.selection.has(n.id));
        dispatch({ type: Action.CLIPBOARD, payload: { data: selectedNotes } });
    }, [notes, state.selection]);

    const cutNotes = useCallback(() => {
        const selectedNotes = notes.filter(n => state.selection.has(n.id));
        dispatch({ type: Action.CLIPBOARD, payload: { data: selectedNotes } });
        deleteNotesFromPattern(Array.from(state.selection));
        clearSelection();
    }, [notes, state.selection, deleteNotesFromPattern, clearSelection]);

    const pasteNotes = useCallback(() => {
        if (!state.clipboard || !state.clipboard.length) return;

        const newNotes = state.clipboard.map((n, index) => ({
            ...n,
            id: `note_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
            startTime: n.startTime + 4 // Paste 4 beats ahead
        }));

        // ✅ COMMAND STACK: addNotesToPattern already uses CommandStack
        addNotesToPattern(newNotes);
        select(newNotes.map(n => n.id), 'replace');
    }, [state.clipboard, addNotesToPattern, select]);

    // ===================================================================
    // KEYBOARD
    // ===================================================================

    const handleKeyDown = useCallback((e) => {
        if (keyboardPianoMode) return;

        // ✅ UNDO/REDO - Ctrl/Cmd + Z, Ctrl/Cmd + Shift + Z, Ctrl/Cmd + Y
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            const stack = commandStackRef.current;
            if (stack?.canUndo()) {
                stack.undo();
            }
            return;
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            const stack = commandStackRef.current;
            if (stack?.canRedo()) {
                stack.redo();
            }
            return;
        }

        // ✅ COPY/CUT/PASTE - Ctrl/Cmd + C, Ctrl/Cmd + X, Ctrl/Cmd + V
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            e.preventDefault();
            copyNotes();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
            e.preventDefault();
            cutNotes();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            e.preventDefault();
            pasteNotes();
            return;
        }

        // ✅ DUPLICATE - Ctrl/Cmd + D
        // If loop region is set: duplicate all notes in loop region
        // Otherwise: duplicate selected notes
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            
            let notesToDuplicate = [];
            let offset = 4; // Default: 4 beats ahead

            // ✅ LOOP REGION PRIORITY: If loop region is set, duplicate all notes in region
            if (loopRegion && loopRegion.start !== undefined && loopRegion.end !== undefined) {
                // Get all notes within loop region (notes that overlap with region)
                notesToDuplicate = notes.filter(note => {
                    const noteEnd = note.startTime + (note.visualLength !== undefined ? note.visualLength : note.length);
                    // Note overlaps with loop region if:
                    // - Note starts before region ends AND
                    // - Note ends after region starts
                    return note.startTime < loopRegion.end && noteEnd > loopRegion.start;
                });
                
                // Use loop region length as offset
                offset = loopRegion.end - loopRegion.start;
            } else {
                // No loop region: use selected notes
                if (state.selection.size === 0) return;
                notesToDuplicate = notes.filter(n => state.selection.has(n.id));
                if (notesToDuplicate.length === 0) return;
            }

            if (notesToDuplicate.length === 0) {
                console.warn('⚠️ No notes to duplicate');
                return;
            }

            // Create duplicated notes
            const duplicatedNotes = notesToDuplicate.map(note => ({
                ...note,
                id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                startTime: note.startTime + offset
            }));

            // ✅ COMMAND STACK: Use AddNoteCommand for undo/redo
            const stack = commandStackRef.current;
            if (stack && activePatternId && currentInstrument) {
                const command = new AddNoteCommand(
                    duplicatedNotes,
                    (newNotes) => {
                        const updated = [...notes, ...newNotes];
                        updatePatternNotes(activePatternId, currentInstrument.id, updated);
                        
                        // EventBus notifications
                        newNotes.forEach(note => {
                            EventBus.emit('NOTE_ADDED', {
                                patternId: activePatternId,
                                instrumentId: currentInstrument.id,
                                note
                            });
                        });
                    }
                );
                stack.execute(command);
            } else {
                // Fallback if command stack not available
                addNotesToPattern(duplicatedNotes);
            }
            
            // Select the duplicated notes
            select(duplicatedNotes.map(n => n.id), 'replace');
            return;
        }

        // ✅ SEQUENTIAL DUPLICATE (LOOP REGION) - Ctrl/Cmd + B
        // Duplicates notes within loop region, filling the entire region
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            
            // Require loop region
            if (!loopRegion || loopRegion.start === undefined || loopRegion.end === undefined) {
                console.warn('⚠️ Cmd+B requires a loop region to be set');
                return;
            }

            // Get notes within loop region (notes that overlap with region)
            const notesInRegion = notes.filter(note => {
                const noteEnd = note.startTime + (note.visualLength !== undefined ? note.visualLength : note.length);
                // Note overlaps with loop region if:
                // - Note starts before region ends AND
                // - Note ends after region starts
                return note.startTime < loopRegion.end && noteEnd > loopRegion.start;
            });

            if (notesInRegion.length === 0) {
                console.warn('⚠️ No notes found within loop region');
                return;
            }

            // ✅ FIX: Calculate pattern boundaries relative to loop region start
            // Normalize notes to start from loop region start (0-based)
            const normalizedNotes = notesInRegion.map(note => ({
                ...note,
                relativeStart: note.startTime - loopRegion.start
            }));

            const minRelativeStart = Math.min(...normalizedNotes.map(n => n.relativeStart));
            const maxRelativeEnd = Math.max(...normalizedNotes.map(n => {
                const noteLength = n.visualLength !== undefined ? n.visualLength : n.length;
                return n.relativeStart + noteLength;
            }));
            const patternLength = maxRelativeEnd - minRelativeStart;
            const loopLength = loopRegion.end - loopRegion.start;

            if (patternLength <= 0) {
                console.warn('⚠️ Invalid pattern length');
                return;
            }

            // Calculate how many copies we need to fill the loop region
            // Start from the first copy (i=1) and continue until we fill the region
            const allDuplicatedNotes = [];
            let copyIndex = 1;
            
            while (true) {
                const copyOffset = patternLength * copyIndex;
                const copyStartInRegion = minRelativeStart + copyOffset;
                
                // Stop if this copy would start beyond the loop region
                if (copyStartInRegion >= loopLength) {
                    break;
                }

                // Create copies of all notes in this iteration
                normalizedNotes.forEach(note => {
                    const newRelativeStart = note.relativeStart + copyOffset;
                    const newStartTime = loopRegion.start + newRelativeStart;
                    const noteLength = note.visualLength !== undefined ? note.visualLength : note.length;
                    const newEndTime = newStartTime + noteLength;

                    // Only add if the note fits within the loop region
                    if (newStartTime >= loopRegion.start && newEndTime <= loopRegion.end) {
                        allDuplicatedNotes.push({
                            ...note,
                            id: `note_${Date.now()}_${copyIndex}_${Math.random().toString(36).substr(2, 9)}`,
                            startTime: newStartTime
                        });
                    }
                });

                copyIndex++;
            }

            if (allDuplicatedNotes.length > 0) {
                // ✅ COMMAND STACK: Use BatchCommand for undo/redo
                const stack = commandStackRef.current;
                if (stack && activePatternId && currentInstrument) {
                    const command = new AddNoteCommand(
                        allDuplicatedNotes,
                        (newNotes) => {
                            const updated = [...notes, ...newNotes];
                            updatePatternNotes(activePatternId, currentInstrument.id, updated);
                            
                            // EventBus notifications
                            newNotes.forEach(note => {
                                EventBus.emit('NOTE_ADDED', {
                                    patternId: activePatternId,
                                    instrumentId: currentInstrument.id,
                                    note
                                });
                            });
                        }
                    );
                    stack.execute(command);
                } else {
                    // Fallback if command stack not available
                    addNotesToPattern(allDuplicatedNotes);
                }
            }
            return;
        }

        // ✅ INVERT SELECTION - Ctrl/Cmd + I
        if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
            e.preventDefault();
            const allNoteIds = notes.map(n => n.id);
            const invertedIds = allNoteIds.filter(id => !state.selection.has(id));
            select(invertedIds, 'replace');
            return;
        }

        // Ctrl/Cmd + A - Select all (or all in loop region if loop region is set)
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            
            // ✅ LOOP REGION AWARE: If loop region is set, select only notes within it
            if (loopRegion && loopRegion.start !== undefined && loopRegion.end !== undefined) {
                const notesInRegion = notes.filter(note => {
                    const noteEnd = note.startTime + (note.visualLength !== undefined ? note.visualLength : note.length);
                    // Note overlaps with loop region if:
                    // - Note starts before region ends AND
                    // - Note ends after region starts
                    return note.startTime < loopRegion.end && noteEnd > loopRegion.start;
                });
                select(notesInRegion.map(n => n.id), 'replace');
            } else {
                // No loop region: select all notes
                select(notes.map(n => n.id), 'replace');
            }
            return;
        }

        // Delete/Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            if (state.selection.size === 0) return;
            deleteNotesFromPattern(Array.from(state.selection));
            clearSelection();
            return;
        }

        // ✅ ARROW KEYS - Move selected notes
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            if (state.selection.size > 0) {
                e.preventDefault();

                const selectedNotes = notes.filter(n => state.selection.has(n.id));
                if (selectedNotes.length === 0) return;

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
                    // ✅ COMMAND STACK: Use MoveNotesCommand for arrow key movement
                    const stack = commandStackRef.current;
                    if (stack && activePatternId && currentInstrument) {
                        const originalStates = new Map();
                        const newStates = new Map();

                        selectedNotes.forEach(note => {
                            const newTime = Math.max(0, note.startTime + timeDelta);
                            const newPitch = Math.max(0, Math.min(127, note.pitch + pitchDelta));

                            originalStates.set(note.id, { startTime: note.startTime, pitch: note.pitch });
                            newStates.set(note.id, { startTime: newTime, pitch: newPitch });
                        });

                        const updatePatternStoreFn = (statesMap) => {
                            const finalNotes = notes.map(note => {
                                if (state.selection.has(note.id)) {
                                    const state = statesMap.get(note.id);
                                    if (state) {
                                        return { ...note, startTime: state.startTime, pitch: state.pitch };
                                    }
                                }
                                return note;
                            });
                            updatePatternNotes(activePatternId, currentInstrument.id, finalNotes);
                            
                            // EventBus notifications
                            finalNotes.forEach(note => {
                                if (state.selection.has(note.id)) {
                                    EventBus.emit('NOTE_MODIFIED', {
                                        patternId: activePatternId,
                                        instrumentId: currentInstrument.id,
                                        note
                                    });
                                }
                            });
                        };

                        const command = new MoveNotesCommand(
                            Array.from(state.selection),
                            originalStates,
                            newStates,
                            updatePatternStoreFn
                        );
                        stack.execute(command);
                    } else {
                        // Fallback if CommandStack not available
                        const updated = notes.map(note => {
                            if (state.selection.has(note.id)) {
                                return {
                                    ...note,
                                    pitch: Math.max(0, Math.min(127, note.pitch + pitchDelta)),
                                    startTime: Math.max(0, note.startTime + timeDelta)
                                };
                            }
                            return note;
                        });
                        if (activePatternId && currentInstrument) {
                            updatePatternNotes(activePatternId, currentInstrument.id, updated);
                        }
                    }
                }
            }
            return;
        }

        // ✅ TRANSPOSE - Ctrl/Cmd + Up/Down (1 semitone), Ctrl/Cmd + Alt + Up/Down (1 octave)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            if (state.selection.size === 0) return;
            e.preventDefault();

            const selectedNotes = notes.filter(n => state.selection.has(n.id));
            if (selectedNotes.length === 0) return;

            const direction = e.key === 'ArrowUp' ? 1 : -1;
            const semitones = e.altKey ? direction * 12 : direction; // Alt = octave, otherwise semitone

            // ✅ COMMAND STACK: Use TransposeNotesCommand
            const stack = commandStackRef.current;
            if (stack && activePatternId && currentInstrument) {
                const updatePatternStoreFn = (transposedNotes) => {
                    const finalNotes = notes.map(note => {
                        const transposed = transposedNotes.find(t => t.id === note.id);
                        return transposed || note;
                    });
                    updatePatternNotes(activePatternId, currentInstrument.id, finalNotes);
                    
                    // EventBus notifications
                    transposedNotes.forEach(note => {
                        EventBus.emit('NOTE_MODIFIED', {
                            patternId: activePatternId,
                            instrumentId: currentInstrument.id,
                            note
                        });
                    });
                };

                const command = new TransposeNotesCommand(
                    selectedNotes,
                    semitones,
                    updatePatternStoreFn
                );
                stack.execute(command);
            }
            return;
        }

        // Escape
        if (e.key === 'Escape') {
            clearSelection();
            return;
        }
    }, [keyboardPianoMode, notes, state.selection, select, clearSelection, deleteNotesFromPattern, copyNotes, cutNotes, pasteNotes, addNotesToPattern, loopRegion, activePatternId, currentInstrument, updatePatternNotes]);

    // ===================================================================
    // STUB METHODS - For compatibility with PianoRoll
    // ===================================================================

    // ✅ INTERNAL: Update note without command (for undo/redo)
    const _updateNote = useCallback((noteId, updates) => {
        if (!activePatternId || !currentInstrument) return;
        const updated = notes.map(n =>
            n.id === noteId ? { ...n, ...updates } : n
        );
        updatePatternNotes(activePatternId, currentInstrument.id, updated);
        
        // EventBus notification
        const modifiedNote = updated.find(n => n.id === noteId);
        if (modifiedNote) {
            EventBus.emit('NOTE_MODIFIED', {
                patternId: activePatternId,
                instrumentId: currentInstrument.id,
                note: modifiedNote
            });
        }
    }, [notes, activePatternId, currentInstrument, updatePatternNotes]);

    // ✅ PUBLIC: Update note with CommandStack (for undo/redo)
    const updateNote = useCallback((noteId, updates, skipUndo = false) => {
        if (!activePatternId || !currentInstrument) return;
        
        const targetNote = notes.find(n => n.id === noteId);
        if (!targetNote) return;

        if (skipUndo) {
            // Direct update (for undo/redo)
            _updateNote(noteId, updates);
            return;
        }

        // ✅ COMMAND STACK: Create UpdateNoteCommand
        const stack = commandStackRef.current;
        if (stack) {
            const oldState = { ...targetNote };
            const newState = { ...targetNote, ...updates };
            
            const command = new UpdateNoteCommand(
                noteId,
                oldState,
                newState,
                (id, state) => _updateNote(id, state)
            );
            stack.execute(command);
        } else {
            // Fallback if CommandStack not available
            _updateNote(noteId, updates);
        }
    }, [notes, activePatternId, currentInstrument, _updateNote]);

    const deleteNotes = useCallback((noteIds) => {
        deleteNotesFromPattern(noteIds);
    }, [deleteNotesFromPattern]);


    const updateNoteVelocity = useCallback((noteId, velocity) => {
        updateNote(noteId, { velocity: Math.max(1, Math.min(127, Math.round(velocity))) });
    }, [updateNote]);

    // ✅ QUANTIZE - Snap selected notes to grid
    const quantizeNotes = useCallback((noteIds = null, quantizeStart = true, quantizeEnd = false) => {
        if (!activePatternId || !currentInstrument) return;
        
        const notesToQuantize = noteIds 
            ? notes.filter(n => noteIds.includes(n.id))
            : notes.filter(n => state.selection.has(n.id));
        
        if (notesToQuantize.length === 0) return;

        // ✅ COMMAND STACK: Create BatchCommand for quantize
        const stack = commandStackRef.current;
        if (stack) {
            const commands = notesToQuantize.map(note => {
                const oldState = { ...note };
                const updates = {};
                
                if (quantizeStart) {
                    updates.startTime = snapToGrid(note.startTime);
                }
                
                if (quantizeEnd) {
                    const noteEnd = note.startTime + (note.visualLength || note.length);
                    const snappedEnd = snapToGrid(noteEnd);
                    updates.length = Math.max(snapValue || 0.25, snappedEnd - (updates.startTime || note.startTime));
                    updates.visualLength = updates.length;
                }

                if (Object.keys(updates).length === 0) return null;

                const newState = { ...note, ...updates };
                return new UpdateNoteCommand(
                    note.id,
                    oldState,
                    newState,
                    (id, state) => _updateNote(id, state)
                );
            }).filter(Boolean);

            if (commands.length > 0) {
                const batchCommand = new BatchCommand(commands, `Quantize ${commands.length} note(s)`);
                stack.execute(batchCommand);
            }
        } else {
            // Fallback if CommandStack not available
            notesToQuantize.forEach(note => {
                const updates = {};
                if (quantizeStart) {
                    updates.startTime = snapToGrid(note.startTime);
                }
                if (quantizeEnd) {
                    const noteEnd = note.startTime + (note.visualLength || note.length);
                    const snappedEnd = snapToGrid(noteEnd);
                    updates.length = Math.max(snapValue || 0.25, snappedEnd - (updates.startTime || note.startTime));
                    updates.visualLength = updates.length;
                }
                if (Object.keys(updates).length > 0) {
                    _updateNote(note.id, updates);
                }
            });
        }
    }, [notes, state.selection, snapToGrid, snapValue, activePatternId, currentInstrument, _updateNote]);

    // ===================================================================
    // RETURN API
    // ===================================================================

    return {
        // State
        selectedNoteIds: state.selection,
        hoveredNoteId: state.hover,
        cursorState: state.cursor,
        dragState: state.drag,
        resizeState: state.resize,
        areaSelection: state.areaSelect,

        // Stub - compatibility
        selectionArea: state.areaSelect,
        isSelectingArea: state.mode === Mode.AREA_SELECT,
        isSelectingTimeRange: false, // Not implemented yet
        timeRangeSelection: null,
        previewNote: null,
        slicePreview: null,
        sliceRange: null,
        contextMenuState: null,

        // Handlers
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleKeyDown,
        handleWheel: () => { }, // Stub

        // Selection
        selectNote: select,
        deselectAll: clearSelection,

        // Operations
        updateNote,
        deleteNotes,
        cutNotes,
        copyNotes,
        pasteNotes,
        updateNoteVelocity,
        quantizeNotes,

        // Data
        notes,

        // Debug
        __version: VERSION,
        __state: DEBUG ? state : undefined
    };
}

export default useNoteInteractionsV3;
