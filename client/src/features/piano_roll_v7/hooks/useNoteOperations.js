// Piano Roll v7 Note Operations with ArrangementStore Integration
import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useArrangementStore } from '@/store/useArrangementStore';
import { useNoteStore } from '../useNoteStore';
import commandManager from '@/lib/commands/CommandManager';
import { PianoRollAddNoteCommand } from '../commands/PianoRollAddNoteCommand';

// Helper function to convert note names to MIDI pitch
function midiPitchFromNoteName(noteName) {
    const noteMap = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
    const match = noteName.match(/([A-G]#?)(\d+)/);
    if (!match) return 60; // Default to C4
    const [, note, octave] = match;
    return (parseInt(octave) + 1) * 12 + noteMap[note];
}

// Helper function to parse duration strings (like "16n", "4n", etc.)
function parseDuration(duration) {
    if (typeof duration === 'number') return duration;
    if (!duration || typeof duration !== 'string') return 1;

    // Convert Tone.js duration notation to steps
    const durationMap = {
        '1n': 16,   // Whole note = 16 steps
        '2n': 8,    // Half note = 8 steps
        '4n': 4,    // Quarter note = 4 steps
        '8n': 2,    // Eighth note = 2 steps
        '16n': 1,   // Sixteenth note = 1 step
        '32n': 0.5  // Thirty-second note = 0.5 step
    };

    return durationMap[duration] || 1;
}

// Note constants for premium visuals
export const NOTE_CONSTANTS = {
    MIN_LENGTH: 0.25, // Minimum note length (1/16)
    DEFAULT_LENGTH: 1.0, // Default note length (1/4)
    DEFAULT_VELOCITY: 100,
    DEFAULT_PITCH: 60, // Middle C
    SNAP_TOLERANCE: 0.1
};

export function useNoteOperations(
    initialPatternNotes = [],
    patternUpdateCallback = null,
    patternId = null,
    instrumentId = null
) {
    // Use pattern integration if provided, otherwise fallback to local store
    const shouldUsePatternIntegration = patternUpdateCallback && patternId && instrumentId;

    const {
        activePatternId: defaultActivePatternId,
        patterns,
        updatePatternNotes: defaultUpdatePatternNotes
    } = useArrangementStore();

    // Use provided pattern update callback or default
    const updatePatternNotes = patternUpdateCallback || defaultUpdatePatternNotes;
    const currentActivePatternId = patternId || defaultActivePatternId;

    const {
        notes: localNotes,
        selectedNoteIds,
        addNote: addNoteToStore,
        updateNote: updateNoteInStore,
        deleteNotes: deleteNotesFromStore,
        selectNote,
        deselectAll
    } = useNoteStore();

    // Unified notes: combine pattern notes with local temporary notes
    const notes = useMemo(() => {
        const unifiedMap = new Map();

        // First, add pattern notes (if using pattern integration)
        if (shouldUsePatternIntegration && initialPatternNotes.length > 0) {
            console.log('🔄 Converting pattern notes:', initialPatternNotes);
            initialPatternNotes.forEach(note => {
                console.log('📝 Converting note:', note);

                // Debug conversion steps
                const timeValue = note.time || note.startTime || 0;
                const pitchValue = typeof note.pitch === 'string' ? midiPitchFromNoteName(note.pitch) : (note.pitch || 60);
                const lengthValue = parseDuration(note.duration) || note.length || 1;

                console.log('🔍 Conversion debug:', {
                    originalTime: note.time,
                    convertedTime: timeValue,
                    originalPitch: note.pitch,
                    convertedPitch: pitchValue,
                    originalDuration: note.duration,
                    convertedLength: lengthValue
                });

                const convertedNote = {
                    id: note.id || `pattern-note-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                    startTime: timeValue,
                    pitch: pitchValue,
                    length: lengthValue,
                    velocity: note.velocity || 100,
                    instrumentId: instrumentId,
                    isFromPattern: true // Mark as pattern note
                };

                console.log('✅ Converted note:', convertedNote);
                unifiedMap.set(convertedNote.id, convertedNote);
            });
        }

        // Then, add/override with local temporary notes
        for (const [id, note] of localNotes) {
            unifiedMap.set(id, { ...note, isFromPattern: false });
        }

        return unifiedMap;
    }, [shouldUsePatternIntegration, initialPatternNotes, instrumentId, localNotes]);


    // Get current pattern's notes for specific instrument
    const getPatternNotes = useCallback((instrumentId) => {
        const pattern = patterns[currentActivePatternId];
        return pattern?.data?.[instrumentId] || [];
    }, [patterns, currentActivePatternId]);

    // Premium note creation using Command pattern (same as Channel Rack)
    const addNote = useCallback((noteData) => {
        const {
            instrumentId,
            startTime,
            pitch,
            length = NOTE_CONSTANTS.DEFAULT_LENGTH,
            velocity = NOTE_CONSTANTS.DEFAULT_VELOCITY
        } = noteData;

        if (!instrumentId || startTime == null || pitch == null) {
            console.warn('Invalid note data:', noteData);
            return null;
        }

        console.log('🎼 Adding note via Command pattern:', noteData);

        // Use Command pattern - same as Channel Rack for consistency
        const command = new PianoRollAddNoteCommand({
            instrumentId,
            startTime,
            pitch,
            length,
            velocity
        });

        // Execute command - this will handle all pattern syncing and EventBus notifications
        const createdNote = commandManager.execute(command);

        // Add to local store for immediate UI feedback
        if (createdNote) {
            addNoteToStore(createdNote);
        }

        return createdNote;
    }, [addNoteToStore]);

    // Update note with premium visual recalculation
    const updateNote = useCallback((noteId, updates) => {
        const note = notes.get(noteId);
        if (!note) return false;

        // Calculate premium visual properties if pitch or velocity changed
        const premiumUpdates = { ...updates };
        if (updates.pitch !== undefined) {
            premiumUpdates.hue = (updates.pitch * 2.8) % 360;
        }
        if (updates.velocity !== undefined) {
            premiumUpdates.saturation = 60 + (updates.velocity / 127) * 40;
            premiumUpdates.brightness = 50 + (updates.velocity / 127) * 30;
        }

        // Update local store
        updateNoteInStore(noteId, premiumUpdates);

        // Sync with arrangement store
        if (updatePatternNotes && currentActivePatternId && note.instrumentId) {
            const currentNotes = getPatternNotes(note.instrumentId);
            const updatedNotes = currentNotes.map(n =>
                n.id === noteId ? { ...n, ...premiumUpdates } : n
            );
            updatePatternNotes(currentActivePatternId, note.instrumentId, updatedNotes);
        }

        return true;
    }, [notes, updateNoteInStore, getPatternNotes, updatePatternNotes, currentActivePatternId]);

    // Delete notes with arrangement store sync
    const deleteNotes = useCallback((noteIds) => {
        if (!Array.isArray(noteIds) || noteIds.length === 0) return false;

        // Get affected instruments
        const affectedInstruments = new Set();
        noteIds.forEach(id => {
            const note = notes.get(id);
            if (note) affectedInstruments.add(note.instrumentId);
        });

        // Delete from local store
        deleteNotesFromStore(noteIds);

        // Sync with arrangement store for each affected instrument
        if (updatePatternNotes && currentActivePatternId) {
            affectedInstruments.forEach(instrumentId => {
                const currentNotes = getPatternNotes(instrumentId);
                const filteredNotes = currentNotes.filter(note => !noteIds.includes(note.id));
                updatePatternNotes(currentActivePatternId, instrumentId, filteredNotes);
            });
        }

        return true;
    }, [notes, deleteNotesFromStore, getPatternNotes, updatePatternNotes, currentActivePatternId]);

    // Smart note snapping - snap to grid based on snapValue (steps per quarter note)
    const snapNoteToGrid = useCallback((time, snapValue) => {
        if (snapValue <= 0) return time;

        // Handle triplet string values
        let snapStep = snapValue;
        if (typeof snapValue === 'string' && snapValue.endsWith('T')) {
            snapStep = parseFloat(snapValue.replace('T', ''));
        }

        // DOĞRU MANTIK: 'time' (adım) değerini 'snapStep'e göre yuvarla
        // Precision safe calculation for triplet decimals
        const snapped = Math.round(time / snapStep) * snapStep;
        return Math.round(snapped * 1000) / 1000; // 3 decimal precision
    }, []);

    // Find notes in area (for selection)
    const getNotesInArea = useCallback((startTime, endTime, startPitch, endPitch, instrumentId) => {
        // Use local notes map for real-time interaction
        const localNotes = Array.from(notes.values()).filter(note => note.instrumentId === instrumentId);
        return localNotes.filter(note => {
            const noteEndTime = note.startTime + note.length;
            const timeOverlap = note.startTime < endTime && noteEndTime > startTime;
            const pitchInRange = note.pitch >= Math.min(startPitch, endPitch) &&
                               note.pitch <= Math.max(startPitch, endPitch);
            return timeOverlap && pitchInRange;
        });
    }, [notes]);

    // Get note at specific position - only check for notes starting at the same position
    const getNoteAtPosition = useCallback((time, pitch, instrumentId) => {
        // Use local notes map for real-time interaction
        const localNotes = Array.from(notes.values()).filter(note => note.instrumentId === instrumentId);
        const foundNote = localNotes.find(note => {
            // Check if there's a note that overlaps with the clicked position
            const noteEndTime = note.startTime + note.length;
            const timeOverlap = time >= note.startTime && time <= noteEndTime;
            const pitchMatch = Math.abs(note.pitch - pitch) < 0.05;
            return timeOverlap && pitchMatch;
        });

        /* console.log("getNoteAtPosition:", { time, pitch, instrumentId, tolerance, localNotes, foundNote }); */
        return foundNote;
    }, [notes]);

    // Premium quantize operation
    const quantizeNotes = useCallback((noteIds, snapValue, quantizeStart = true, quantizeEnd = false) => {
        noteIds.forEach(noteId => {
            const note = notes.get(noteId);
            if (!note) return;

            const updates = {};

            if (quantizeStart) {
                updates.startTime = snapNoteToGrid(note.startTime, snapValue);
            }

            if (quantizeEnd) {
                const noteEnd = note.startTime + note.length;
                const snappedEnd = snapNoteToGrid(noteEnd, snapValue);
                updates.length = Math.max(NOTE_CONSTANTS.MIN_LENGTH, snappedEnd - (updates.startTime || note.startTime));
            }

            if (Object.keys(updates).length > 0) {
                updateNote(noteId, updates);
            }
        });
    }, [notes, snapNoteToGrid, updateNote]);

    // YENİ: Sadece yerel durumu güncelleyen hızlı fonksiyon
    const updateNoteLocally = useCallback((noteId, updates) => {
        const note = notes.get(noteId);
        if (!note) return false;

        const premiumUpdates = { ...updates };
        if (updates.pitch !== undefined) {
            premiumUpdates.hue = (updates.pitch * 2.8) % 360;
        }
        if (updates.velocity !== undefined) {
            premiumUpdates.saturation = 60 + (updates.velocity / 127) * 40;
            premiumUpdates.brightness = 50 + (updates.velocity / 127) * 30;
        }

        // Sadece hızlı olan yerel not defterini güncelle
        updateNoteInStore(noteId, premiumUpdates);

        return true;
    }, [notes, updateNoteInStore]);


    return {
        // Core operations
        addNote,
        updateNote,
        deleteNotes,

        // Selection operations
        selectNote,
        deselectAll,
        selectedNoteIds,

        // Query operations
        getPatternNotes,
        getNotesInArea,
        getNoteAtPosition,

        // Utility operations
        snapNoteToGrid,
        quantizeNotes,

        // Store data
        notes,
        activePatternId: currentActivePatternId,
        updateNoteLocally
    };
}