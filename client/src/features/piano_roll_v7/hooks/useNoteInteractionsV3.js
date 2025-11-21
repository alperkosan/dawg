/**
 * Piano Roll Note Interactions V3 - Evolutionary Design
 *
 * Complete rewrite focused on predictability, performance, and UX excellence.
 *
 * @version 3.0.0
 */

import { useReducer, useCallback, useRef, useEffect, useMemo } from 'react';
import { getCommandStack } from '@/lib/piano-roll-tools/CommandStack';
import { TOOL_TYPES } from '@/lib/piano-roll-tools';
import { useArrangementStore } from '@/store/useArrangementStore';
import { getPreviewManager } from '@/lib/audio/preview';
import EventBus from '@/lib/core/EventBus';

const DEBUG = true;
const VERSION = '3.0.0';

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
    if (DEBUG) {
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

    const addNotesToPattern = useCallback((newNotes) => {
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

    const deleteNotesFromPattern = useCallback((noteIds) => {
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
        
        // ✅ FIX: Use snap-aware threshold - should match grid snap tolerance
        // Use half of snap value or minimum 0.25 for better UX
        const threshold = snapValue > 0 ? Math.max(0.25, snapValue * 0.5) : 0.25;

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

        // Check for resize handle
        const handle = getResizeHandle(coords, note);
        if (handle && state.selection.has(note.id)) {
            startResize(note, handle, coords);
            return;
        }

        // Selection logic
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
            duration: `${lengthInSteps}*16n`, // Convert steps to Tone.js duration

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
            updatePatternNotes(activePatternId, currentInstrument.id, updated);

            // ✅ EVENT BUS: Notify audio engine of modifications
            // Only emit for notes that actually changed
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

        const updated = notes.map(note => {
            if (!noteIds.includes(note.id)) return note;

            const orig = originals.get(note.id);
            if (!orig) return note;

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
            const deltaTime = coords.time - state.drag.start.time;
            const deltaPitch = coords.pitch - state.drag.start.pitch;

            dispatch({
                type: Action.UPDATE_DRAG,
                payload: { delta: { time: deltaTime, pitch: deltaPitch } }
            });
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
    // KEYBOARD
    // ===================================================================

    const handleKeyDown = useCallback((e) => {
        if (keyboardPianoMode) return;

        // Ctrl/Cmd + A - Select all
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            select(notes.map(n => n.id), 'replace');
        }

        // Delete/Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            deleteNotesFromPattern(Array.from(state.selection));
            clearSelection();
        }

        // Escape
        if (e.key === 'Escape') {
            clearSelection();
        }
    }, [keyboardPianoMode, notes, state.selection, select, clearSelection, deleteNotesFromPattern]);

    // ===================================================================
    // STUB METHODS - For compatibility with PianoRoll
    // ===================================================================

    const updateNote = useCallback((noteId, updates) => {
        if (!activePatternId || !currentInstrument) return;
        const updated = notes.map(n =>
            n.id === noteId ? { ...n, ...updates } : n
        );
        updatePatternNotes(activePatternId, currentInstrument.id, updated);
    }, [notes, activePatternId, currentInstrument, updatePatternNotes]);

    const deleteNotes = useCallback((noteIds) => {
        deleteNotesFromPattern(noteIds);
    }, [deleteNotesFromPattern]);

    const cutNotes = useCallback(() => {
        const selectedNotes = notes.filter(n => state.selection.has(n.id));
        dispatch({ type: Action.CLIPBOARD, payload: { data: selectedNotes } });
        deleteNotesFromPattern(Array.from(state.selection));
        clearSelection();
    }, [notes, state.selection, deleteNotesFromPattern, clearSelection]);

    const copyNotes = useCallback(() => {
        const selectedNotes = notes.filter(n => state.selection.has(n.id));
        dispatch({ type: Action.CLIPBOARD, payload: { data: selectedNotes } });
    }, [notes, state.selection]);

    const pasteNotes = useCallback(() => {
        if (!state.clipboard || !state.clipboard.length) return;

        const newNotes = state.clipboard.map(n => ({
            ...n,
            id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            startTime: n.startTime + 4 // Paste 4 beats ahead
        }));

        addNotesToPattern(newNotes);
        select(newNotes.map(n => n.id), 'replace');
    }, [state.clipboard, addNotesToPattern, select]);

    const updateNoteVelocity = useCallback((noteId, velocity) => {
        updateNote(noteId, { velocity: Math.max(1, Math.min(127, Math.round(velocity))) });
    }, [updateNote]);

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

        // Data
        notes,

        // Debug
        __version: VERSION,
        __state: DEBUG ? state : undefined
    };
}

export default useNoteInteractionsV3;
