// Piano Roll v7 Note Interactions Hook
import { useState, useEffect, useCallback, useRef } from 'react';
import { pitchPreview } from '../utils/pitchPreview';
import { useNoteOperations } from './useNoteOperations';
import { samplePreview } from '../utils/samplePreview';
import { useKeyboardInput } from './useKeyboardInput';
import { AudioContextService } from '../../../lib/services/AudioContextService';

const RULER_HEIGHT = 30;
const KEYBOARD_WIDTH = 80;
const BASE_STEP_WIDTH = 40;
const BASE_KEY_HEIGHT = 20;

// Calculate note length based on snap value (supports triplets)
function calculateNoteLengthFromSnap(snapValue) {
    // Sistem 16'lık notaları (adımları) temel uzunluk birimi olarak kullanır.
    // Bu fonksiyon uzunluğu adım cinsinden döndürmelidir.

    // Triplet note lengths - check for string values with 'T' suffix
    if (typeof snapValue === 'string' && snapValue.endsWith('T')) {
        const numValue = parseFloat(snapValue.replace('T', ''));
        return numValue;
    }

    // Regular note lengths
    if (snapValue >= 16) return 16;      // Bar = 16 adım
    if (snapValue >= 8) return 8;       // Yarım nota = 8 adım
    if (snapValue >= 4) return 4;       // Çeyrek nota (Beat) = 4 adım
    if (snapValue >= 2) return 2;       // Sekizlik nota = 2 adım
    if (snapValue >= 1) return 1;       // Onaltılık nota = 1 adım
    return 0.5;                         // Otuzikilik nota = 0.5 adım
}

export function useNoteInteractions(
    engine,
    activeTool = 'select',
    snapValue = 1,
    currentInstrument = null,
    persistenceActions = null,
    patternNotes = [],
    updatePatternNotes = null,
    activePatternId = null
) {
    const [dragState, setDragState] = useState(null);
    const [hoveredNoteId, setHoveredNoteId] = useState(null);
    const [isSelectingArea, setIsSelectingArea] = useState(false);
    const [selectionArea, setSelectionArea] = useState(null);
    const [isRightClickErasing, setIsRightClickErasing] = useState(false);
    const [previewNote, setPreviewNote] = useState(null); // Preview note during pencil mode
    const erasedNotesRef = useRef(new Set()); // Track erased notes during right-click drag

    const dragStartRef = useRef({ x: 0, y: 0, time: 0, pitch: 0 });
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const hoverTimeoutRef = useRef(null);
    const hoverStartTimeRef = useRef(0);
    const lastStablePositionRef = useRef({ x: 0, y: 0 });
    const stablePositionTimeRef = useRef(0);
    const [disableSnap, setDisableSnap] = useState(false);

    // Enable keyboard input for piano roll
    const keyboardInput = useKeyboardInput(true, 0); // octave offset = 0

    // Update sample preview when instrument changes
    useEffect(() => {
        const setupInstrumentPreview = async () => {
            if (!currentInstrument) {
                console.log('🎹 No current instrument - using synth preview');
                return;
            }

            console.log('🎹 Current instrument changed:', currentInstrument.name, 'Type:', currentInstrument.type);

            if (currentInstrument.type === 'sample') {
                try {
                    // Request the instrument's audio buffer from the audio engine
                    const buffer = await AudioContextService.requestInstrumentBuffer(currentInstrument.id);

                    if (buffer) {
                        console.log('🎵 Sample buffer loaded for preview:', currentInstrument.name);
                        samplePreview.setInstrument(currentInstrument, buffer);
                    } else {
                        console.warn('⚠️ Could not load sample buffer for:', currentInstrument.name);
                    }
                } catch (error) {
                    console.error('❌ Error loading sample buffer:', error);
                }
            } else if (currentInstrument.type === 'synth') {
                console.log('🎹 Synth instrument - using built-in synth preview');
                // For synth instruments, we'll use the pitchPreview (basic synth)
                // In the future, this could be enhanced to use the actual synth engine
            }
        };

        setupInstrumentPreview();
    }, [currentInstrument]);

    // Cleanup timer and audio on unmount
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
            // Clean up audio previews on unmount
            samplePreview.stopAllPreviews();
            pitchPreview.stopPreview();
        };
    }, []);

    const {
        addNote,
        notes,
        updateNote,
        updateNoteLocally,
        deleteNotes,
        selectNote,
        deselectAll,
        selectedNoteIds,
        getNotesInArea,
        getNoteAtPosition,
        snapNoteToGrid,
        getPatternNotes
    } = useNoteOperations(patternNotes, updatePatternNotes, activePatternId, currentInstrument?.id);

    // Clear selections when tool changes (except when switching to select tool)
    useEffect(() => {
        if (activeTool !== 'select' && selectedNoteIds.size > 0) {
            deselectAll();
        }
    }, [activeTool, selectedNoteIds.size, deselectAll]);

    // Check if mouse is over resize handle
    const getResizeHandle = useCallback((mouseX, mouseY, note) => {
        const { viewport, dimensions } = engine;
        if (!viewport || !dimensions || !note) return null;

        const { stepWidth, keyHeight } = dimensions;

        const canvasX = mouseX - KEYBOARD_WIDTH;
        const canvasY = mouseY - RULER_HEIGHT;

        // Use same coordinate system as renderer
        // World coordinates without zoom division - renderer uses stepWidth/keyHeight directly
        const worldX = viewport.scrollX + canvasX;
        const worldY = viewport.scrollY + canvasY;

        // Note position in renderer coordinates (stepWidth already includes zoom)
        const noteX = Math.round(note.startTime * stepWidth);
        const noteY = Math.round((127 - note.pitch) * keyHeight);
        const noteWidth = Math.max(Math.round(stepWidth) - 1, Math.round(note.length * stepWidth) - 1);
        const noteHeight = Math.round(keyHeight) - 1;

        console.log("getResizeHandle debug:", {
            note: { id: note.id, startTime: note.startTime, pitch: note.pitch, length: note.length },
            mouse: { mouseX, mouseY, canvasX, canvasY, worldX, worldY },
            dimensions: { stepWidth, keyHeight },
            viewport: { scrollX: viewport.scrollX, scrollY: viewport.scrollY, zoomX: viewport.zoomX, zoomY: viewport.zoomY },
            noteGeometry: { noteX, noteY, noteWidth, noteHeight }
        });

        const handleSize = 10; // Match renderer
        const handleWidth = 5; // Match renderer
        const handleOffset = 3; // Match renderer offset

        // Dynamic interaction area - better scaling for small notes
        const handleToleranceX = Math.max(10, Math.min(20, noteWidth * 0.1)); // 10% of note width, min 15px, max 30px
        const handleToleranceY = keyHeight * 0.6; // Vertical tolerance (60% of note height)

        // Left handle (start time resize) - expanded interaction area
        const leftHandleX = noteX - handleOffset;
        const leftHandleY = noteY + (noteHeight - handleSize) / 2;

        // Expanded left handle area - extends further left and covers more vertical space
        const leftAreaX1 = leftHandleX - handleToleranceX;
        const leftAreaX2 = leftHandleX + handleWidth + handleToleranceX;
        const leftAreaY1 = noteY - handleToleranceY;
        const leftAreaY2 = noteY + noteHeight + handleToleranceY;

        if (worldX >= leftAreaX1 && worldX <= leftAreaX2 &&
            worldY >= leftAreaY1 && worldY <= leftAreaY2) {
            return 'left';
        }

        // Right handle (end time/length resize) - expanded interaction area
        const rightHandleX = noteX + noteWidth - handleWidth + 1;
        const rightHandleY = noteY + (noteHeight - handleSize) / 2;

        // Expanded right handle area - extends further right and covers more vertical space
        const rightAreaX1 = rightHandleX - handleToleranceX;
        const rightAreaX2 = rightHandleX + handleWidth + handleToleranceX;
        const rightAreaY1 = noteY - handleToleranceY;
        const rightAreaY2 = noteY + noteHeight + handleToleranceY;

        console.log("Handle areas:", {
            left: { x1: leftAreaX1, x2: leftAreaX2, y1: leftAreaY1, y2: leftAreaY2, width: leftAreaX2 - leftAreaX1 },
            right: { x1: rightAreaX1, x2: rightAreaX2, y1: rightAreaY1, y2: rightAreaY2, width: rightAreaX2 - rightAreaX1 },
            leftHandlePos: { x: leftHandleX, y: leftHandleY },
            rightHandlePos: { x: rightHandleX, y: rightHandleY },
            tolerances: { x: handleToleranceX, y: handleToleranceY },
            noteWidth: noteWidth,
            tolerancePercentage: ((handleToleranceX / noteWidth) * 100).toFixed(1) + "%"
        });

        const leftHit = worldX >= leftAreaX1 && worldX <= leftAreaX2 && worldY >= leftAreaY1 && worldY <= leftAreaY2;
        const rightHit = worldX >= rightAreaX1 && worldX <= rightAreaX2 && worldY >= rightAreaY1 && worldY <= rightAreaY2;

        console.log("Hit test results:", { leftHit, rightHit, worldX, worldY });

        if (leftHit) {
            return 'left';
        }

        if (rightHit) {
            return 'right';
        }

        return null;
    }, [engine]);

    // Convert mouse position to piano roll coordinates
    const mouseToCoordinates = useCallback((mouseX, mouseY, shouldSnap = false) => {
        const { viewport, dimensions } = engine;
        if (!viewport || !dimensions) return null;

        const canvasX = mouseX - KEYBOARD_WIDTH;
        const canvasY = mouseY - RULER_HEIGHT;

        if (canvasX < 0 || canvasY < 0) return null;

        // Engine ile tutarlı koordinat hesaplaması
        const worldX = (viewport.scrollX + canvasX) / viewport.zoomX;
        const worldY = (viewport.scrollY + canvasY) / viewport.zoomY;

        let time = worldX / BASE_STEP_WIDTH;

        // Snap time to grid if requested (supports triplets and regular grids)
        if (shouldSnap && snapValue) {
            let snapStep = snapValue;

            // Convert triplet string to numeric value
            if (typeof snapValue === 'string' && snapValue.endsWith('T')) {
                snapStep = parseFloat(snapValue.replace('T', ''));
            }

            if (snapStep > 0) {
                // 'time' değişkeni step biriminde, snapStep da step biriminde
                // %90-%10 snap threshold: Grid hücresinin %90'ında mevcut sütuna snap
                const timeInSnapUnits = time / snapStep;
                const floorValue = Math.floor(timeInSnapUnits);
                const fractionalPart = timeInSnapUnits - floorValue;

                // %90'dan fazlaysa bir sonraki grid pozisyonuna, değilse mevcut pozisyona snap et
                const snappedUnit = fractionalPart > 0.9 ? floorValue + 1 : floorValue;

                // Precision safe multiplication - round to avoid floating point errors
                time = Math.round((snappedUnit * snapStep) * 1000) / 1000;
            }
        }

        // Calculate key index exactly the same way as renderer - snap to grid lines
        const keyIndex = Math.floor(worldY / BASE_KEY_HEIGHT);
        const pitch = 127 - keyIndex;



        return {
            time: Math.max(0, time),
            pitch: Math.max(0, Math.min(127, pitch)),
            canvasX,
            canvasY
        };
    }, [engine]);

    // Handle mouse down for note operations
    const handleMouseDown = useCallback((e) => {
        console.log(0);

        // Handle both left (0) and right (2) click in grid area
        if (e.button !== 0 && e.button !== 2) return;

        console.log(1);

        // Get coordinates relative to the container
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Double check we're in the grid area (should already be guaranteed by parent)
        const isInGrid = mouseX > KEYBOARD_WIDTH && mouseY > RULER_HEIGHT;
        if (!isInGrid) {
            console.log("Not in grid area:", { mouseX, mouseY });
            return;
        }

        // Use snapped coordinates for pencil tool, regular for others
        const shouldSnap = activeTool === 'pencil';
        const coords = mouseToCoordinates(mouseX, mouseY, shouldSnap);
        if (!coords) return;

        // Store initial position
        dragStartRef.current = {
            x: mouseX,
            y: mouseY,
            time: coords.time,
            pitch: coords.pitch
        };
        lastMousePosRef.current = { x: mouseX, y: mouseY };

        // Check if clicking on existing note
        console.log("Coords:", coords);
        console.log("Available notes:", notes);
        console.log("Notes Map:", notes instanceof Map ? Array.from(notes.values()) : notes);

        // İşlem yapmadan önce enstrümanın seçili olduğundan emin olun
        if (!currentInstrument) return;
        const instrumentId = currentInstrument.id;

        let clickedNote;
        if (activeTool === 'pencil') {
            // For pencil tool: only detect notes at their exact start position
            const localNotes = Array.from(notes.values()).filter(note => note.instrumentId === instrumentId); // <- DÜZELTME
            clickedNote = localNotes.find(note => {
                const timeMatch = Math.abs(note.startTime - coords.time) <= 0.5; // Stricter time tolerance
                const pitchMatch = Math.abs(note.pitch - coords.pitch) < 0.5;
                return timeMatch && pitchMatch;
            });
            console.log("Pencil tool - clickedNote (strict):", clickedNote);
        } else {
            clickedNote = getNoteAtPosition(coords.time, coords.pitch, instrumentId);
            console.log("Other tools - clickedNote (overlap):", clickedNote);
        }

        // Handle right-click for erasing
        if (e.button === 2) {
            console.log("Right click detected - starting erase mode");
            setIsRightClickErasing(true);
            erasedNotesRef.current.clear();

            // If there's a note at this position, erase it immediately
            if (clickedNote) {
                deleteNotes([clickedNote.id]);
                erasedNotesRef.current.add(clickedNote.id);
                console.log("Erased note on right click:", clickedNote.id);
            }
            e.preventDefault();
            return;
        }

        // Check for resize handle interaction first (for any note, selected or not)
        if (clickedNote && activeTool === 'select') {
            const resizeHandle = getResizeHandle(mouseX, mouseY, clickedNote);
            console.log("Resize handle check:", { clickedNote: clickedNote.id, resizeHandle, mouseX, mouseY });

            if (resizeHandle) {
                console.log("Starting resize operation:", resizeHandle, "on note:", clickedNote.id);

                // If note is not selected, select it first
                if (!selectedNoteIds.has(clickedNote.id)) {
                    deselectAll();
                    selectNote(clickedNote.id, false);
                }

                setDragState({
                    type: 'resizing',
                    noteId: clickedNote.id,
                    resizeHandle,
                    startTime: coords.time,
                    originalNote: { ...clickedNote }
                });
                e.preventDefault();
                return;
            }
        }

        if (clickedNote && activeTool === 'select') {
            // Clicking on existing note (SELECT mode)
            let willBeSelected = false;
            let finalSelectedNotes = new Set(selectedNoteIds);

            if (e.ctrlKey || e.metaKey) {
                // Ctrl+click: Toggle selection
                if (selectedNoteIds.has(clickedNote.id)) {
                    // Deselect if already selected
                    selectNote(clickedNote.id, false);
                    finalSelectedNotes.delete(clickedNote.id);
                    willBeSelected = false;
                } else {
                    // Add to selection
                    selectNote(clickedNote.id, true);
                    finalSelectedNotes.add(clickedNote.id);
                    willBeSelected = true;
                }
            } else if (e.shiftKey && selectedNoteIds.size > 0) {
                // Shift+click: Select range (to be implemented)
                selectNote(clickedNote.id, true);
                finalSelectedNotes.add(clickedNote.id);
                willBeSelected = true;
            } else {
                // Regular click: select only this note
                if (!selectedNoteIds.has(clickedNote.id)) {
                    deselectAll();
                    selectNote(clickedNote.id, false);
                    finalSelectedNotes = new Set([clickedNote.id]);
                } else {
                    finalSelectedNotes = new Set(selectedNoteIds);
                }
                willBeSelected = true;
            }

            // Set drag state only if the note will be selected after this click
            if (willBeSelected) {
                const notesToMove = finalSelectedNotes.has(clickedNote.id)
                    ? Array.from(finalSelectedNotes)
                    : [clickedNote.id];


                setDragState({
                    type: e.altKey ? 'duplicating' : 'moving',
                    noteIds: notesToMove,
                    startTime: coords.time,
                    startPitch: coords.pitch,
                    originalPositions: null, // Will be set on first move
                    originalNotes: e.altKey ? notesToMove.map(id => {
                        const note = Array.from(notes.values()).find(n => n.id === id);
                        return note ? { ...note } : null;
                    }).filter(Boolean) : null
                });
            }
        } else if (clickedNote && activeTool === 'eraser') {
            // Clicking on existing note (ERASER mode)
            deleteNotes([clickedNote.id]);
        } else if (!clickedNote && activeTool === 'pencil') {
            // Clicking on empty space (PENCIL mode) - Start preview mode
            // coords.time is already snapped from mouseToCoordinates
            const snappedTime = coords.time;

            // Calculate note length based on snap value
            const noteLength = calculateNoteLengthFromSnap(snapValue);

            const preview = {
                startTime: snappedTime,
                pitch: coords.pitch,
                length: noteLength,
                velocity: 100,
                instrumentId: instrumentId // SABİT DEĞER DİNAMİK OLARAK DEĞİŞTİRİLDİ
            };

            console.log("🎼 Mouse down - starting preview:", preview);
            setPreviewNote(preview);

            // Start preview audio based on instrument type
            if (currentInstrument?.type === 'sample') {
                samplePreview.playPitchPreview(preview.pitch, preview.velocity);
            } else {
                // Use synth preview for synth instruments or when no instrument
                pitchPreview.playPitch(preview.pitch, preview.velocity);
            }
        } else if (!clickedNote && activeTool === 'select') {
            // Clicking on empty space (SELECT mode) - Start area selection
            const shouldKeepSelection = e.shiftKey || e.ctrlKey;
            if (!shouldKeepSelection) {
                deselectAll();
            }

            setIsSelectingArea(true);
            setSelectionArea({
                startX: coords.canvasX,
                startY: coords.canvasY,
                endX: coords.canvasX,
                endY: coords.canvasY,
                additive: shouldKeepSelection // Remember if we should add to selection
            });
        }

        // Only prevent default if we actually handled the event
        e.preventDefault();
    }, [activeTool, mouseToCoordinates, getNoteAtPosition, selectedNoteIds, selectNote, deselectAll, deleteNotes, addNote, snapNoteToGrid, snapValue, getResizeHandle]);

    // Handle mouse move for drag operations
    const handleMouseMove = useCallback((e) => {
        // Get coordinates relative to the container
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Only handle if in grid area
        const isInGrid = mouseX > KEYBOARD_WIDTH && mouseY > RULER_HEIGHT;
        if (!isInGrid) {
            // Reset cursor and hover state when outside grid
            setHoveredNoteId(null);
            if (previewNote) {
                console.log("🧹 Mouse outside grid - clearing preview");
                setPreviewNote(null);
                samplePreview.stopAllPreviews();
                pitchPreview.stopPreview();
            }
            e.currentTarget.style.cursor = 'default';
            return;
        }

        const coords = mouseToCoordinates(mouseX, mouseY);
        if (!coords) return;

        // Update hovered note and cursor
        const hoveredNote = getNoteAtPosition(coords.time, coords.pitch, currentInstrument?.id); // SABİT DEĞER DİNAMİK OLARAK DEĞİŞTİRİLDİ
        setHoveredNoteId(hoveredNote?.id || null);

        /* Debug state
        console.log("Move state debug:", {
            isRightClickErasing,
            isSelectingArea,
            dragState: dragState?.type || null,
            coords: { time: coords.time, pitch: coords.pitch }
        });*/

        // Update cursor based on hover state and tool
        if (isRightClickErasing) {
            // Right-click erasing mode - show eraser cursor
            e.currentTarget.style.cursor = 'not-allowed';
        } else if (hoveredNote && activeTool === 'select') {
            // Check resize handles first (priority) - only for selected notes or the hovered note
            const shouldCheckResize = selectedNoteIds.has(hoveredNote.id) || selectedNoteIds.size === 0;
            const resizeHandle = shouldCheckResize ? getResizeHandle(mouseX, mouseY, hoveredNote) : null;

            if (resizeHandle) {
                e.currentTarget.style.cursor = 'ew-resize';
            } else if (selectedNoteIds.has(hoveredNote.id)) {
                // Selected note - show move cursor
                e.currentTarget.style.cursor = 'move';
            } else {
                // Unselected note - show pointer
                e.currentTarget.style.cursor = 'pointer';
            }
        } else if (activeTool === 'pencil') {
            e.currentTarget.style.cursor = 'crosshair';
        } else if (activeTool === 'eraser') {
            e.currentTarget.style.cursor = 'not-allowed';
        } else {
            e.currentTarget.style.cursor = 'default';
        }

        // Preview is now handled by mouse down/up events, not hover

        if (isRightClickErasing) {
            // Right-click drag erasing - erase any note we touch
            console.log("Right-click erase mode active during move");
            const noteAtPosition = getNoteAtPosition(coords.time, coords.pitch, 'default-instrument');
            if (noteAtPosition && !erasedNotesRef.current.has(noteAtPosition.id)) {
                deleteNotes([noteAtPosition.id]);
                erasedNotesRef.current.add(noteAtPosition.id);
                console.log("Erased note during drag:", noteAtPosition.id);
            }
        } else if (isSelectingArea) {
            // Update selection area
            setSelectionArea(prev => ({
                ...prev,
                endX: coords.canvasX,
                endY: coords.canvasY
            }));
        } else if (dragState?.type === 'moving') {
            // Move selected notes - follow mouse and snap to grid
            const deltaTime = coords.time - dragStartRef.current.time;
            const deltaPitch = coords.pitch - dragStartRef.current.pitch;

            // Improved hover detection with stable position tracking
            const currentTime = Date.now();
            const positionTolerance = 3; // pixels

            const deltaX = Math.abs(mouseX - lastStablePositionRef.current.x);
            const deltaY = Math.abs(mouseY - lastStablePositionRef.current.y);
            const mouseMoved = deltaX > positionTolerance || deltaY > positionTolerance;

            if (mouseMoved) {
                // Position changed significantly - reset stable position timer
                lastStablePositionRef.current = { x: mouseX, y: mouseY };
                stablePositionTimeRef.current = currentTime;
                setDisableSnap(false);

                console.log("Position changed, resetting timer:", {
                    deltaX, deltaY,
                    newPos: { x: mouseX, y: mouseY },
                    resetTime: currentTime
                });
            } else {
                // Position is stable - check how long we've been here
                const stableTime = currentTime - stablePositionTimeRef.current;

                console.log("Stable position timing:", {
                    currentPos: { x: mouseX, y: mouseY },
                    stablePos: lastStablePositionRef.current,
                    stableTime: stableTime + "ms",
                    threshold: "800ms",
                    disableSnap,
                    willDisable: stableTime >= 800 && !disableSnap
                });

                // Disable snap if we've been stable for 800ms+
                if (stableTime >= 800 && !disableSnap) {
                    setDisableSnap(true);
                    console.log("🎯 SNAP DISABLED after", stableTime + "ms stable hover");
                }
            }

            // Store original positions on first move if not already stored
            if (!dragState.originalPositions) {
                const originalPositions = new Map();
                dragState.noteIds.forEach(noteId => {
                    const note = Array.from(notes.values()).find(n => n.id === noteId);
                    if (note) {
                        originalPositions.set(noteId, {
                            startTime: note.startTime,
                            pitch: note.pitch
                        });
                    }
                });
                dragState.originalPositions = originalPositions;
            }

            // Update notes relative to their original positions - always follow mouse
            dragState.noteIds.forEach(noteId => {
                const original = dragState.originalPositions.get(noteId);
                if (original) {
                    // Calculate new position relative to original
                    let newTime = original.startTime + deltaTime;
                    let newPitch = original.pitch + deltaPitch;

                    // Apply snap to time if snapValue is set and snap is not disabled
                    if (snapValue > 0 && !disableSnap) {
                        newTime = snapNoteToGrid(newTime, snapValue);
                    }

                    // Constrain values
                    newTime = Math.max(0, newTime);
                    newPitch = Math.max(0, Math.min(127, Math.round(newPitch)));

                    updateNoteLocally(noteId, {
                        startTime: newTime,
                        pitch: newPitch
                    });
                }
            });
        } else if (dragState?.type === 'duplicating') {
            // Duplicate and move notes - follow mouse and snap
            const deltaTime = coords.time - dragStartRef.current.time;
            const deltaPitch = coords.pitch - dragStartRef.current.pitch;

            // Only create duplicates on first move
            if (!dragState.duplicateIds) {
                const duplicateIds = [];
                dragState.originalNotes.forEach(originalNote => {
                    let newTime = originalNote.startTime + deltaTime;
                    let newPitch = originalNote.pitch + deltaPitch;

                    // Apply snap to duplicated notes (unless disabled by hover)
                    if (snapValue > 0 && !disableSnap) {
                        newTime = snapNoteToGrid(newTime, snapValue);
                    }

                    // Constrain values
                    newTime = Math.max(0, newTime);
                    newPitch = Math.max(0, Math.min(127, Math.round(newPitch)));

                    const duplicate = addNote({
                        instrumentId: originalNote.instrumentId,
                        startTime: newTime,
                        pitch: newPitch,
                        length: originalNote.length,
                        velocity: originalNote.velocity
                    });
                    if (duplicate) {
                        duplicateIds.push(duplicate.id);
                    }
                });

                // Update drag state with duplicate IDs
                setDragState(prev => ({ ...prev, duplicateIds }));
            } else {
                // Move existing duplicates - follow mouse position
                dragState.duplicateIds.forEach((noteId, index) => {
                    const originalNote = dragState.originalNotes[index];
                    if (originalNote) {
                        let newTime = originalNote.startTime + deltaTime;
                        let newPitch = originalNote.pitch + deltaPitch;

                        // Apply snap to time (unless disabled by hover)
                        if (snapValue > 0 && !disableSnap) {
                            newTime = snapNoteToGrid(newTime, snapValue);
                        }

                        // Constrain values
                        newTime = Math.max(0, newTime);
                        newPitch = Math.max(0, Math.min(127, Math.round(newPitch)));

                        updateNoteLocally(noteId, {
                            startTime: newTime,
                            pitch: newPitch
                        });
                    }
                });
            }
        } else if (dragState?.type === 'resizing') {
            // Handle note resizing
            const note = Array.from(notes.values()).find(n => n.id === dragState.noteId);
            if (note) {
                const deltaTime = coords.time - dragStartRef.current.time;
                const minLength = 0.5; // Minimum note length (increased for better grabbing)

                if (dragState.resizeHandle === 'left') {
                    // Resize from start (change startTime and length)
                    const newStartTime = Math.max(0, dragState.originalNote.startTime + deltaTime);
                    const newLength = Math.max(minLength, dragState.originalNote.length - deltaTime);

                    updateNoteLocally(dragState.noteId, {
                        startTime: newStartTime,
                        length: newLength
                    });
                } else if (dragState.resizeHandle === 'right') {
                    // Resize from end (change length only)
                    const newLength = Math.max(minLength, dragState.originalNote.length + deltaTime);

                    updateNoteLocally(dragState.noteId, {
                        length: newLength
                    });
                }
            }
        }

        lastMousePosRef.current = { x: mouseX, y: mouseY };
    }, [mouseToCoordinates, getNoteAtPosition, isSelectingArea, dragState, updateNote, addNote, notes, activeTool, selectedNoteIds, getResizeHandle]);

    // Handle mouse up to complete operations
    const handleMouseUp = useCallback((e) => {
        console.log("Mouse up event:", { button: e.button, isRightClickErasing });

        // Handle preview note completion for pencil tool
        if (previewNote && activeTool === 'pencil' && e.button === 0) {
            console.log("🎼 Mouse up - converting preview to real note:", previewNote);

            // Create real note from preview
            addNote({
                instrumentId: previewNote.instrumentId,
                startTime: previewNote.startTime,
                pitch: previewNote.pitch,
                length: previewNote.length,
                velocity: previewNote.velocity
            });

            // Stop preview audio
            samplePreview.stopAllPreviews();
            pitchPreview.stopPreview();

            // Clear preview
            setPreviewNote(null);
            return;
        }

        // Handle right-click erase completion FIRST (for any button release)
        if (isRightClickErasing) {
            console.log("Right-click erase completed. Total erased:", erasedNotesRef.current.size);
            setIsRightClickErasing(false);
            erasedNotesRef.current.clear();
            return;
        }

        // Always cleanup drag states, regardless of position
        const hasActiveOperations = isSelectingArea || dragState;

        if (!hasActiveOperations) {
            // No active operations, just cleanup
            setDragState(null);
            setIsSelectingArea(false);
            setSelectionArea(null);
            return;
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const coords = mouseToCoordinates(mouseX, mouseY);
        if (!coords) {
            // Cleanup even if coords are invalid
            setDragState(null);
            setIsSelectingArea(false);
            setSelectionArea(null);
            return;
        }

        if (isSelectingArea && selectionArea) {
            // Complete area selection
            const startTime = Math.min(
                dragStartRef.current.time,
                coords.time
            );
            const endTime = Math.max(
                dragStartRef.current.time,
                coords.time
            );
            const startPitch = Math.min(
                dragStartRef.current.pitch,
                coords.pitch
            );
            const endPitch = Math.max(
                dragStartRef.current.pitch,
                coords.pitch
            );

            const notesInArea = getNotesInArea(startTime, endTime, startPitch, endPitch, currentInstrument?.id); // SABİT DEĞER DİNAMİK OLARAK DEĞİŞTİRİLDİ

            if (selectionArea.additive) {
                // Additive selection: add to existing selection
                notesInArea.forEach(note => {
                    selectNote(note.id, true);
                });
            } else {
                // Regular selection: replace current selection
                deselectAll();
                notesInArea.forEach(note => {
                    selectNote(note.id, true);
                });
            }

            setIsSelectingArea(false);
            setSelectionArea(null);
        } else if (dragState?.type === 'moving') {
            // YENİ: Taşıma bittiğinde, her notanın son halini direkt pattern store'a kaydet
            if (updatePatternNotes && activePatternId && currentInstrument) {
                const currentNotes = getPatternNotes(currentInstrument.id);

                // Piano Roll formatından Channel Rack formatına dönüştürme helper'ları
                const pitchToString = (midiPitch) => {
                    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                    const octave = Math.floor(midiPitch / 12) - 1;
                    const noteIndex = midiPitch % 12;
                    return noteNames[noteIndex] + octave;
                };

                const lengthToDuration = (length) => {
                    const durationMap = { 16: '1n', 8: '2n', 4: '4n', 2: '8n', 1: '16n', 0.5: '32n' };
                    return durationMap[length] || '16n';
                };

                // Taşınan notaları güncelle
                const updatedNotes = currentNotes.map(note => {
                    const finalNote = Array.from(notes.values()).find(n => n.id === note.id);
                    if (finalNote && dragState.noteIds.includes(note.id)) {
                        // Convert to Channel Rack format
                        return {
                            id: finalNote.id,
                            time: finalNote.startTime,
                            pitch: pitchToString(finalNote.pitch),
                            velocity: finalNote.velocity || 100,
                            duration: lengthToDuration(finalNote.length)
                        };
                    }
                    return note;
                });

                // Direkt pattern store'u güncelle
                updatePatternNotes(activePatternId, currentInstrument.id, updatedNotes);

                console.log('✅ Move finalized in pattern store for notes:', dragState.noteIds);
            }
        } else if (dragState?.type === 'duplicating') {
            // Select the duplicated notes (already snapped in real-time)
            if (dragState.duplicateIds) {
                deselectAll();
                dragState.duplicateIds.forEach(noteId => {
                    selectNote(noteId, true);
                });
            }
        } else if (dragState?.type === 'resizing') {
            // Finalize resize - Piano Roll native format ile direkt pattern store'u güncelle
            const note = Array.from(notes.values()).find(n => n.id === dragState.noteId);
            if (note && updatePatternNotes && activePatternId && currentInstrument) {
                console.log('📐 Finalizing resize for note:', note.id, note);

                // Current pattern notes'ları al
                const currentNotes = getPatternNotes(currentInstrument.id);

                // Piano Roll formatından Channel Rack formatına dönüştür (sadece persistence için)
                const pitchToString = (midiPitch) => {
                    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                    const octave = Math.floor(midiPitch / 12) - 1;
                    const noteIndex = midiPitch % 12;
                    return noteNames[noteIndex] + octave;
                };

                const lengthToDuration = (length) => {
                    const durationMap = { 16: '1n', 8: '2n', 4: '4n', 2: '8n', 1: '16n', 0.5: '32n' };
                    return durationMap[length] || '16n';
                };

                // Updated note'u Channel Rack formatında hazırla
                const updatedChannelRackNote = {
                    id: note.id,
                    time: note.startTime,
                    pitch: pitchToString(note.pitch),
                    velocity: note.velocity || 100,
                    duration: lengthToDuration(note.length)
                };

                // Pattern'daki diğer notalar ile birleştir
                const updatedNotes = currentNotes.map(n =>
                    n.id === note.id ? updatedChannelRackNote : n
                );

                // Direkt pattern store'u güncelle (conversion loop'u önlemek için)
                updatePatternNotes(activePatternId, currentInstrument.id, updatedNotes);

                console.log('✅ Resize finalized in pattern store:', updatedChannelRackNote);
            }
        }

        // Reset drag state and timers
        setDragState(null);
        setIsSelectingArea(false);
        setSelectionArea(null);
        setDisableSnap(false);

        // Clear any remaining preview (safety cleanup)
        if (previewNote) {
            console.log("🧹 Mouse up cleanup - clearing remaining preview");
            setPreviewNote(null);
            samplePreview.stopAllPreviews();
            pitchPreview.stopPreview();
        }

        // Clear hover timer
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
    }, [mouseToCoordinates, isSelectingArea, selectionArea, dragState, snapValue, getNotesInArea, selectNote, deselectAll, snapNoteToGrid, updateNote, addNote, notes, isRightClickErasing, previewNote, activeTool]);

    // Handle double click for note editing
    const handleDoubleClick = useCallback((e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const coords = mouseToCoordinates(mouseX, mouseY);
        if (!coords) return;

        const clickedNote = getNoteAtPosition(coords.time, coords.pitch, currentInstrument?.id); // SABİT DEĞER DİNAMİK OLARAK DEĞİŞTİRİLDİ
        if (clickedNote) {
            // Open note properties editor (to be implemented)
            console.log('Edit note:', clickedNote);
        }
    }, [mouseToCoordinates, getNoteAtPosition]);

    // Handle key press for note operations
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedNoteIds.size > 0) {
                deleteNotes(Array.from(selectedNoteIds));
            }
        } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
            // Select all notes in current pattern
            e.preventDefault();
            if (!currentInstrument) return; // Enstrüman seçili değilse işlem yapma
            const allNotes = Array.from(notes.values()).filter(note =>
                note.instrumentId === currentInstrument.id // SABİT DEĞER DİNAMİK OLARAK DEĞİŞTİRİLDİ
            );
            deselectAll();
            allNotes.forEach(note => selectNote(note.id, true));
        } else if (e.key === 'Escape') {
            deselectAll();
        }
    }, [selectedNoteIds, deleteNotes, deselectAll, notes, selectNote]);

    // Handle mouse leave to clean up states
    const handleMouseLeave = useCallback(() => {
        console.log("Mouse left piano roll - cleaning up states");
        setIsRightClickErasing(false);
        setHoveredNoteId(null);
        setPreviewNote(null); // Clear preview note when mouse leaves
        samplePreview.stopAllPreviews(); // Stop sample preview
        pitchPreview.stopPreview(); // Stop synth preview
        erasedNotesRef.current.clear();
    }, []);

    return {
        // Event handlers
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave,
        handleDoubleClick,
        handleKeyDown,

        // State
        notes,
        hoveredNoteId,
        selectedNoteIds,
        isSelectingArea,
        selectionArea,
        dragState,
        previewNote,

        // Utilities
        mouseToCoordinates,
        keyboardInput
    };
}