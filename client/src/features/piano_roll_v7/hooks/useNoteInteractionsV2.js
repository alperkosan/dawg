// Piano Roll v7 Note Interactions Hook V2 - Sıfırdan tasarım
// ArrangementStore merkezli, işlevsellik odaklı
import { useState, useEffect, useCallback, useRef } from 'react';
import { useArrangementStore } from '../../../store/useArrangementStore';
import { samplePreview } from '../utils/samplePreview';

const RULER_HEIGHT = 30;
const KEYBOARD_WIDTH = 80;

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
    currentInstrument = null
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

    // Get notes in Piano Roll format for display
    const notes = useCallback(() => {
        const storedNotes = getPatternNotes();
        const baseNotes = convertToPianoRollFormat(storedNotes);

        // Drag sırasında geçici notaları kullan
        if (tempNotes.length > 0) {
            return tempNotes;
        }

        return baseNotes;
    }, [getPatternNotes, convertToPianoRollFormat, tempNotes]);

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

            // ✅ CONTAINED TIME TOLERANCE - Only within note boundaries
            const timeOverlap = time >= note.startTime && time <= noteEndTime;

            // ✅ CONTAINED PITCH TOLERANCE - Only within note height
            const pitchMatch = Math.abs(note.pitch - pitch) < 0.6; // Contained within note area

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

        const handleSize = 15;
        const handleWidth = 8;
        const handleOffset = 5;

        // ✅ CONTAINED INTERACTION AREA - Only within note bounds, but efficient coverage
        const handleToleranceY = 0; // No Y tolerance - stay within note height

        // ✅ EFFICIENT RESIZE ZONES - Cover more of note area but stay contained
        const resizeZoneWidth = Math.max(8, noteWidth * 0.35); // 35% of note width, min 8px

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

        // Debug zones
        console.log('🔧 Resize zones debug:', {
            noteGeometry: { x: noteX, y: noteY, width: noteWidth, height: noteHeight },
            mouse: { worldX, worldY },
            leftZone: { x1: leftAreaX1, x2: leftAreaX2, width: leftAreaX2 - leftAreaX1 },
            rightZone: { x1: rightAreaX1, x2: rightAreaX2, width: rightAreaX2 - rightAreaX1 },
            overlap: leftAreaX2 > rightAreaX1 ? 'OVERLAP!' : 'OK',
            resizeZoneWidth,
            containment: 'WITHIN_NOTE_BOUNDS'
        });

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
    const addNote = useCallback((time, pitch, length = 1) => {
        if (!currentInstrument) return;

        const snappedTime = snapValue > 0 ? snapToGrid(time, snapValue) : time;
        const newNote = {
            id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            startTime: Math.max(0, snappedTime),
            pitch: Math.max(0, Math.min(127, Math.round(pitch))),
            length: length,
            velocity: 100,
            instrumentId: currentInstrument.id
        };

        // Update pattern store
        const currentNotes = notes();
        updatePatternStore([...currentNotes, newNote]);

        console.log('➕ Note added:', newNote);
        return newNote;
    }, [currentInstrument, snapValue, notes, updatePatternStore]);

    // Update note
    const updateNote = useCallback((noteId, updates) => {
        const currentNotes = notes();
        const updatedNotes = currentNotes.map(note =>
            note.id === noteId ? { ...note, ...updates } : note
        );
        updatePatternStore(updatedNotes);
        console.log('📝 Note updated:', noteId, updates);
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

        console.log('🗑️ Notes deleted:', noteIds);
    }, [notes, updatePatternStore]);

    // Slice note - Split note into two at given time position
    const sliceNote = useCallback((note, sliceTime) => {
        if (!note || sliceTime <= note.startTime || sliceTime >= (note.startTime + note.length)) {
            console.warn('🔪 Invalid slice position:', { sliceTime, note });
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
            console.warn('🔪 Slice would create notes too small:', {
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

        console.log('🔪 Note sliced:', {
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
            console.warn('🔪 No notes found at slice time within pitch range');
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
                console.warn('🔪 Slice would create notes too small for note:', note.id);
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

        console.log('🔪 Pitch range slice completed:', {
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


        if (activeTool === 'pencil') {
            if (!foundNote) {
                // Add new note
                const newNote = addNote(coords.time, coords.pitch);
                if (newNote) {
                    // Audio preview
                    samplePreview.playPitchPreview(
                        newNote.pitch,
                        newNote.velocity || 100
                    );
                }
            }
        } else if (activeTool === 'select') {
            if (foundNote) {
                // Check for resize handle first
                const resizeHandle = getResizeHandle(coords.x, coords.y, foundNote);

                if (resizeHandle) {
                    // Start resizing
                    if (!selectedNoteIds.has(foundNote.id)) {
                        deselectAll();
                        selectNote(foundNote.id, false);
                    }

                    console.log('🎯 Resize started:', {
                        handle: resizeHandle,
                        noteId: foundNote.id,
                        originalNote: foundNote,
                        coords
                    });

                    setDragState({
                        type: 'resizing',
                        noteId: foundNote.id,
                        resizeHandle,
                        startCoords: coords,
                        originalNote: { ...foundNote }
                    });
                } else {
                    // Start moving
                    if (!selectedNoteIds.has(foundNote.id)) {
                        selectNote(foundNote.id, e.ctrlKey || e.metaKey);
                    }

                setDragState({
                    type: 'moving',
                    noteIds: selectedNoteIds.has(foundNote.id) ? Array.from(selectedNoteIds) : [foundNote.id],
                    startCoords: coords,
                    originalNotes: new Map()
                });

                // Store original positions
                const currentNotes = notes();
                const originalNotes = new Map();
                const noteIds = selectedNoteIds.has(foundNote.id) ? Array.from(selectedNoteIds) : [foundNote.id];
                noteIds.forEach(id => {
                    const note = currentNotes.find(n => n.id === id);
                    if (note) {
                        originalNotes.set(id, { startTime: note.startTime, pitch: note.pitch });
                    }
                });
                setDragState(prev => ({ ...prev, originalNotes }));

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

                    console.log('🔪 Vertical slice range started:', {
                        time: coords.time,
                        startPitch: coords.pitch,
                        note: foundNote.id
                    });
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

        // Update hover with cursor feedback
        const foundNote = findNoteAtPosition(coords.time, coords.pitch);
        setHoveredNoteId(foundNote?.id || null);

        // Cursor feedback for better UX
        if (foundNote && activeTool === 'select') {
            const resizeHandle = getResizeHandle(coords.x, coords.y, foundNote);
            if (resizeHandle) {
                e.currentTarget.style.cursor = 'ew-resize';
            } else {
                e.currentTarget.style.cursor = 'move';
            }
        } else if (activeTool === 'pencil') {
            e.currentTarget.style.cursor = 'crosshair';
        } else if (activeTool === 'eraser') {
            e.currentTarget.style.cursor = 'not-allowed';
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

                console.log('🔪 Vertical slice range updated:', {
                    time: sliceRange.time,
                    pitchRange: `${actualEndPitch} - ${actualStartPitch}`,
                    height: actualStartPitch - actualEndPitch
                });
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
    }, [isSelectingArea, selectionArea, notes, selectNote, dragState, tempNotes, updatePatternStore, performPitchRangeSlice, sliceNote, sliceRange]);

    // Key down handler
    const handleKeyDown = useCallback((e) => {
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
        }
        // Note: Spacebar handling will be added to PianoRoll.jsx component level
    }, [selectedNoteIds, deleteNotes, deselectAll, notes]);

    return {
        // Event handlers
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleKeyDown,

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