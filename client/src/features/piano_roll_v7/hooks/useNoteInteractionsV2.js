// Piano Roll v7 Note Interactions Hook V2 - Sıfırdan tasarım
// ArrangementStore merkezli, işlevsellik odaklı
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useArrangementStore } from '@/store/useArrangementStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { samplePreview } from '../utils/samplePreview';
import { getToolManager, TOOL_TYPES } from '@/lib/piano-roll-tools';

const RULER_HEIGHT = 30;
const KEYBOARD_WIDTH = 80;

// Debug mode - set to false for production
const DEBUG_MODE = false;

// ✅ KEYBOARD PIANO MAPPING - Computer keyboard keys to MIDI pitches
// Uses QWERTY layout as piano keys (2 octaves)
// Bottom row (ZXCVBNM...) = C4 octave
// Middle row (ASDFGHJK...) = C5 octave
// Top row (QWERTYUI...) = C6 octave
const KEYBOARD_TO_PITCH = {
    // Bottom row - C4 octave (60-71)
    'z': 60,  // C4
    's': 61,  // C#4
    'x': 62,  // D4
    'd': 63,  // D#4
    'c': 64,  // E4
    'v': 65,  // F4
    'g': 66,  // F#4
    'b': 67,  // G4
    'h': 68,  // G#4
    'n': 69,  // A4
    'j': 70,  // A#4
    'm': 71,  // B4

    // Middle row - C5 octave (72-83)
    'q': 72,  // C5
    '2': 73,  // C#5
    'w': 74,  // D5
    '3': 75,  // D#5
    'e': 76,  // E5
    'r': 77,  // F5
    '5': 78,  // F#5
    't': 79,  // G5
    '6': 80,  // G#5
    'y': 81,  // A5
    '7': 82,  // A#5
    'u': 83,  // B5

    // Top row - C6 octave (84-95)
    'i': 84,  // C6
    '9': 85,  // C#6
    'o': 86,  // D6
    '0': 87,  // D#6
    'p': 88,  // E6
    '[': 89,  // F6
    '=': 90,  // F#6
    ']': 91   // G6
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

export function useNoteInteractionsV2(
    engine,
    activeTool = 'select',
    snapValue = 1,
    currentInstrument = null,
    loopRegion = null // ✅ Loop region for Ctrl+D sync
) {
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

    // ArrangementStore integration
    const { patterns, activePatternId, updatePatternNotes } = useArrangementStore();

    // Get current pattern notes for instrument
    const getPatternNotes = useCallback(() => {
        if (!activePatternId || !currentInstrument) return [];
        const pattern = patterns[activePatternId];
        return pattern?.data?.[currentInstrument.id] || [];
    }, [patterns, activePatternId, currentInstrument]);

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

        // Convert to piano roll coordinates
        const time = (gridX + engine.viewport.scrollX) / stepWidth;
        const pitch = Math.round(127 - (gridY + engine.viewport.scrollY) / keyHeight);

        return { time, pitch, x: rawX, y: rawY };
    }, [engine]);

    // Find note at position - improved tolerance for easier interaction
    const findNoteAtPosition = useCallback((time, pitch) => {
        const currentNotes = notes();
        return currentNotes.find(note => {
            const noteEndTime = note.startTime + note.length;

            // ✅ TIME TOLERANCE - Slightly relaxed for easier clicking
            // Allow small margin at edges for easier interaction
            const timeMargin = 0.05; // 5% of a step
            const timeOverlap = time >= (note.startTime - timeMargin) && time <= (noteEndTime + timeMargin);

            // ✅ PITCH TOLERANCE - Full note height coverage
            // Changed to 1.0 to cover entire note height plus small margin
            const pitchMatch = Math.abs(note.pitch - pitch) <= 1.0;

            return timeOverlap && pitchMatch;
        });
    }, [notes]);

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

        // ✅ SMART RESIZE ZONES - Adaptive based on note width
        // Ensure resize zones don't overlap and leave space for move area
        const minMoveArea = 10; // Minimum pixels in middle for moving
        const maxZoneWidth = (noteWidth - minMoveArea) / 2; // Max zone width without overlap

        // Calculate optimal zone width based on note size
        let resizeZoneWidth;
        if (noteWidth < 20) {
            // Very small notes: minimal zones (6px each)
            resizeZoneWidth = Math.min(6, maxZoneWidth);
        } else if (noteWidth < 40) {
            // Small notes: 25% of width, max limited by overlap protection
            resizeZoneWidth = Math.min(noteWidth * 0.25, maxZoneWidth);
        } else if (noteWidth < 80) {
            // Medium notes: 30% of width
            resizeZoneWidth = Math.min(noteWidth * 0.30, maxZoneWidth);
        } else {
            // Large notes: 35% of width, generous resize area
            resizeZoneWidth = Math.min(noteWidth * 0.35, maxZoneWidth);
        }

        // Ensure minimum zone width for usability
        resizeZoneWidth = Math.max(5, resizeZoneWidth);

        // Left handle (start time resize) - contained within note start area
        const leftAreaX1 = noteX; // Start exactly at note boundary
        const leftAreaX2 = noteX + resizeZoneWidth; // Cover 35% from start
        const leftAreaY1 = noteY; // Exact note top
        const leftAreaY2 = noteY + noteHeight; // Exact note bottom

        // Right handle (end time/length resize) - contained within note end area
        const rightAreaX1 = noteX + noteWidth - resizeZoneWidth; // Cover 35% from end
        const rightAreaX2 = noteX + noteWidth; // End exactly at note boundary
        const rightAreaY1 = noteY; // Exact note top
        const rightAreaY2 = noteY + noteHeight; // Exact note bottom

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

    // Add new note
    const addNote = useCallback((time, pitch, length = 1, velocity = 100) => {
        if (!currentInstrument) return;

        const snappedTime = snapValue > 0 ? snapToGrid(time, snapValue) : time;

        // Generate unique ID with timestamp + random + counter for same-millisecond safety
        const uniqueId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${performance.now()}`;

        const newNote = {
            id: uniqueId,
            startTime: Math.max(0, snappedTime),
            pitch: Math.max(0, Math.min(127, Math.round(pitch))),
            length: length,
            velocity: velocity,
            instrumentId: currentInstrument.id
        };

        // Update pattern store
        const currentNotes = notes();
        updatePatternStore([...currentNotes, newNote]);

        if (DEBUG_MODE) console.log('➕ Note added:', newNote);
        return newNote;
    }, [currentInstrument, snapValue, notes, updatePatternStore]);

    // Update note
    const updateNote = useCallback((noteId, updates) => {
        const currentNotes = notes();
        const updatedNotes = currentNotes.map(note =>
            note.id === noteId ? { ...note, ...updates } : note
        );
        updatePatternStore(updatedNotes);
        if (DEBUG_MODE) console.log('📝 Note updated:', noteId, updates);
    }, [notes, updatePatternStore]);

    // Delete notes
    const deleteNotes = useCallback((noteIds) => {
        const currentNotes = notes();
        const filteredNotes = currentNotes.filter(note => !noteIds.includes(note.id));
        updatePatternStore(filteredNotes);

        // Clear selection
        setSelectedNoteIds(prev => {
            const newSet = new Set(prev);
            noteIds.forEach(id => newSet.delete(id));
            return newSet;
        });

        if (DEBUG_MODE) console.log('🗑️ Notes deleted:', noteIds);
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

    // Selection operations
    const selectNote = useCallback((noteId, addToSelection = false) => {
        setSelectedNoteIds(prev => {
            const newSet = addToSelection ? new Set(prev) : new Set();
            newSet.add(noteId);
            return newSet;
        });
    }, []);

    const deselectAll = useCallback(() => {
        setSelectedNoteIds(new Set());
    }, []);

    // Mouse down handler
    const handleMouseDown = useCallback((e) => {
        const coords = getCoordinatesFromEvent(e);
        const foundNote = findNoteAtPosition(coords.time, coords.pitch);

        const toolManager = getToolManager();
        const currentTool = toolManager.getActiveTool();

        // ✅ RIGHT CLICK - Delete note immediately and start drag-to-delete
        if (e.button === 2) { // Right mouse button
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
            return; // Don't proceed with other handlers
        }

        // ✅ PAINT BRUSH TOOL - Draw notes by clicking or dragging, resize existing notes
        if (currentTool === TOOL_TYPES.PAINT_BRUSH) {
            if (foundNote) {
                // Check if clicking on resize handle
                const resizeHandle = getResizeHandle(coords.x, coords.y, foundNote);

                if (resizeHandle) {
                    // Start resizing existing note (same as select tool)
                    if (!selectedNoteIds.has(foundNote.id)) {
                        deselectAll();
                        selectNote(foundNote.id, false);
                    }

                    setDragState({
                        type: 'resizing',
                        noteId: foundNote.id,
                        resizeHandle,
                        startCoords: coords,
                        originalNote: { ...foundNote }
                    });

                    if (DEBUG_MODE) console.log('🎨 Paint brush: Resize started', resizeHandle);
                } else {
                    // Clicking on note body - preview sound and remember duration
                    samplePreview.playPitchPreview(
                        foundNote.pitch,
                        foundNote.velocity || 100
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
                    samplePreview.playPitchPreview(
                        newNote.pitch,
                        newNote.velocity || 100
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
                // Check for resize handle first
                const resizeHandle = getResizeHandle(coords.x, coords.y, foundNote);

                if (resizeHandle) {
                    // Start resizing
                    if (!selectedNoteIds.has(foundNote.id)) {
                        deselectAll();
                        selectNote(foundNote.id, false);
                    }

                    if (DEBUG_MODE) {
                        console.log('🎯 Resize started:', {
                            handle: resizeHandle,
                            noteId: foundNote.id,
                            originalNote: foundNote,
                            coords
                        });
                    }

                    setDragState({
                        type: 'resizing',
                        noteId: foundNote.id,
                        resizeHandle,
                        startCoords: coords,
                        originalNote: { ...foundNote }
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
                        // Normal move: select note if needed
                        if (!selectedNoteIds.has(foundNote.id)) {
                            selectNote(foundNote.id, e.ctrlKey || e.metaKey);
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
                    samplePreview.playPitchPreview(
                        foundNote.pitch,
                        foundNote.velocity || 100
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
                // Only add note if we moved to a different pitch or time
                if (coords.pitch !== paintDragState.lastPitch ||
                    Math.abs(coords.time - paintDragState.lastTime) >= snapValue) {

                    const newNote = addNote(coords.time, coords.pitch, lastNoteDuration);
                    if (newNote) {
                        // Update drag state with new position
                        setPaintDragState({
                            ...paintDragState,
                            lastPitch: coords.pitch,
                            lastTime: coords.time
                        });

                        // Audio preview
                        samplePreview.playPitchPreview(
                            newNote.pitch,
                            newNote.velocity || 100
                        );
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

            // Update moving notes in temporary state (no pattern store update)
            const storedNotes = getPatternNotes();
            const baseNotes = convertToPianoRollFormat(storedNotes);

            const updatedNotes = baseNotes.map(note => {
                if (dragState.noteIds.includes(note.id)) {
                    const original = dragState.originalNotes.get(note.id);
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

                        return { ...note, startTime: newTime, pitch: newPitch };
                    }
                }
                return note;
            });

            // Real-time görsel güncelleme için tempNotes kullan
            setTempNotes(updatedNotes);
        } else if (dragState?.type === 'resizing') {
            // Handle note resizing
            const storedNotes = getPatternNotes();
            const baseNotes = convertToPianoRollFormat(storedNotes);
            const note = baseNotes.find(n => n.id === dragState.noteId);

            if (note) {
                const deltaTime = coords.time - dragState.startCoords.time;
                const minLength = 0.25; // Minimum note length

                let updatedNote = { ...note };

                if (dragState.resizeHandle === 'left') {
                    // Resize from start (change startTime and length)
                    // Original note end time (sabit kalmalı)
                    const originalEndTime = dragState.originalNote.startTime + dragState.originalNote.length;

                    let newStartTime = Math.max(0, dragState.originalNote.startTime + deltaTime);

                    // Snap to grid
                    if (snapValue > 0) {
                        newStartTime = snapToGrid(newStartTime, snapValue);
                    }

                    // Length = original end time - new start time
                    let newLength = Math.max(minLength, originalEndTime - newStartTime);

                    updatedNote.startTime = newStartTime;
                    updatedNote.length = newLength;
                } else if (dragState.resizeHandle === 'right') {
                    // Resize from end (change length only)
                    // Start time sabit kalır, sadece end time değişir
                    const originalStartTime = dragState.originalNote.startTime;
                    let newEndTime = originalStartTime + dragState.originalNote.length + deltaTime;

                    // Snap to grid
                    if (snapValue > 0) {
                        newEndTime = snapToGrid(newEndTime, snapValue);
                    }

                    // Length = new end time - original start time
                    let newLength = Math.max(minLength, newEndTime - originalStartTime);

                    updatedNote.length = newLength;
                }

                // Update temp notes for real-time visual feedback
                const updatedNotes = baseNotes.map(n =>
                    n.id === dragState.noteId ? updatedNote : n
                );
                setTempNotes(updatedNotes);
            }
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
        // Finalize drag operations
        else if (dragState?.type === 'moving' && tempNotes.length > 0) {
            // Commit temporary notes to pattern store
            updatePatternStore(tempNotes);
            setTempNotes([]); // Clear temporary notes
        } else if (dragState?.type === 'resizing' && tempNotes.length > 0) {
            // Commit resized note to pattern store
            updatePatternStore(tempNotes);

            // ✅ REMEMBER LAST DURATION - Save resized note's length for next note
            const resizedNote = tempNotes.find(n => n.id === dragState.noteId);
            if (resizedNote && resizedNote.length > 0) {
                setLastNoteDuration(resizedNote.length);
                if (DEBUG_MODE) console.log('💾 Remembered note duration:', resizedNote.length);
            }

            setTempNotes([]); // Clear temporary notes
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
        samplePreview.stopAllPreviews();

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
            e.preventDefault();
            e.stopPropagation();

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
            e.preventDefault();
            e.stopPropagation();

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
        // ✅ KEYBOARD PIANO - Play and optionally record notes with computer keyboard
        const key = e.key.toLowerCase();
        const pitch = KEYBOARD_TO_PITCH[key];

        if (pitch !== undefined && currentInstrument) {
            // Prevent repeat events from key hold
            if (e.repeat) return;

            e.preventDefault();

            // Play audio preview
            samplePreview.playPitchPreview(pitch, 100);

            // Track active keyboard note
            setActiveKeyboardNotes(prev => new Map(prev).set(key, { pitch, startTime: Date.now() }));

            // If Ctrl/Cmd is held, write the note to the pattern
            if (e.ctrlKey || e.metaKey) {
                // Get current playback position or use 0
                const currentTime = usePlaybackStore.getState()?.currentStep || 0;
                addNote(currentTime, pitch, lastNoteDuration);

                if (DEBUG_MODE) console.log('⌨️ Keyboard note written:', key, pitch, 'at time:', currentTime);
            } else {
                if (DEBUG_MODE) console.log('⌨️ Keyboard note played (preview only):', key, pitch);
            }

            return;
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

        if (e.key === 'Delete' || e.key === 'Backspace') {
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
                    // ✅ Default: Calculate offset to next beat (4 steps = 1 beat in standard 16-step bar)
                    // Round maxEndTime to next beat boundary
                    const beatsPerBar = 4; // Standard 4/4 time
                    const stepsPerBeat = 4; // 16 steps / 4 beats
                    const nextBeat = Math.ceil(maxEndTime / stepsPerBeat) * stepsPerBeat;
                    offset = nextBeat - minStartTime;

                    if (DEBUG_MODE) console.log('📋 Ctrl+D: Using beat-based offset:', offset, 'steps');
                }

                const newNoteIds = [];
                selectedNotes.forEach(note => {
                    const uniqueId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${performance.now()}`;
                    const duplicatedNote = {
                        ...note,
                        id: uniqueId,
                        startTime: (typeof note.startTime === 'number' ? note.startTime : 0) + offset
                    };

                    // Add to pattern
                    const newNote = addNote(
                        duplicatedNote.startTime,
                        duplicatedNote.pitch,
                        duplicatedNote.length,
                        duplicatedNote.velocity
                    );

                    if (newNote) {
                        newNoteIds.push(newNote.id);
                    }
                });

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
        const key = e.key.toLowerCase();
        const pitch = KEYBOARD_TO_PITCH[key];

        if (pitch !== undefined) {
            e.preventDefault();

            // Stop audio preview
            samplePreview.stopAllPreviews();

            // Remove from active keyboard notes
            setActiveKeyboardNotes(prev => {
                const newMap = new Map(prev);
                newMap.delete(key);
                return newMap;
            });

            if (DEBUG_MODE) console.log('⌨️ Keyboard note released:', key, pitch);
        }
    }, []);

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

        // Data
        notes: notes(),

        // Operations
        addNote,
        updateNote,
        deleteNotes,
        selectNote,
        deselectAll,
        updateNoteVelocity: (noteId, velocity) => {
            const currentNotes = notes();
            const note = currentNotes.find(n => n.id === noteId);
            if (note) {
                updateNote(noteId, { velocity: Math.max(0.01, Math.min(1.0, velocity)) });
            }
        }
    };
}