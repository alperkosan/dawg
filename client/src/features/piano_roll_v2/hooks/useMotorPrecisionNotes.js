// hooks/useMotorPrecisionNotes.js
// Motor hassasiyetli nota interaction sistemi

import { useCallback, useState, useRef, useMemo } from 'react';
import { PrecisionGrid } from '../utils/precisionGrid';
import { useMicroAdjustment } from './useMicroAdjustment';
import { usePlaybackStore } from '../../../store/usePlaybackStore';

export const useMotorPrecisionNotes = (instrumentId, engine, notes = []) => {
  const { bpm } = usePlaybackStore();
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState(null);

  // Precision grid engine
  const precisionGrid = useMemo(() => {
    return new PrecisionGrid(bpm);
  }, [bpm]);

  // Update precision grid when BPM changes
  useMemo(() => {
    precisionGrid.updateBPM(bpm);
  }, [bpm, precisionGrid]);

  // Dragging state
  const dragStateRef = useRef({
    startX: 0,
    startY: 0,
    startTicks: [],
    mode: 'move', // 'move', 'resize-start', 'resize-end', 'create'
    notes: []
  });

  // ========================= NOTE CREATION =========================

  /**
   * Creates a new note at precise tick position
   * @param {number} pixelX - X position in pixels
   * @param {number} pitch - Note pitch
   * @param {Object} options - Creation options
   */
  const createNoteAtPosition = useCallback((pixelX, pitch, options = {}) => {
    const {
      velocity = 1,
      duration = null,
      snapMode = 'ui',
      force = false
    } = options;

    // Convert pixel position to motor ticks
    const stepWidth = engine.dimensions?.stepWidth || engine.stepWidth || 40;
    const rawTicks = precisionGrid.pixelsToTicks(pixelX, stepWidth);

    // Apply appropriate snapping
    const snappedTicks = precisionGrid.smartSnap(rawTicks, { mode: snapMode, force });

    // Calculate duration in ticks
    const durationTicks = duration
      ? precisionGrid.stepsToTicks(duration)
      : precisionGrid.getUISnapResolution(); // Default to 1/32 note

    // Create precise note
    const note = precisionGrid.createPreciseNote(snappedTicks, pitch, velocity, durationTicks);

    console.log(`🎵 Created note at ${precisionGrid.formatTicksAsMusicalTime(snappedTicks)} (${snappedTicks} ticks)`);

    return note;
  }, [precisionGrid, engine.dimensions?.stepWidth, engine.stepWidth]);

  // ========================= NOTE SELECTION =========================

  /**
   * Selects notes based on area or single click
   * @param {Object} selection - Selection area or single note
   */
  const selectNotes = useCallback((selection) => {
    if (selection.type === 'single') {
      const note = selection.note;
      if (selection.additive) {
        setSelectedNotes(prev => {
          const isSelected = prev.some(n => n.id === note.id);
          return isSelected
            ? prev.filter(n => n.id !== note.id)
            : [...prev, note];
        });
      } else {
        setSelectedNotes([note]);
      }
    } else if (selection.type === 'area') {
      const { startTick, endTick, startPitch, endPitch } = selection;
      const selectedInArea = notes.filter(note => {
        const noteTicks = note._motorTicks || precisionGrid.noteToTicks(note);
        const noteDurationTicks = note._durationTicks || precisionGrid.stepsToTicks(note.duration || 1);
        const noteEndTicks = noteTicks + noteDurationTicks;

        // Check time overlap
        const timeOverlap = noteEndTicks >= startTick && noteTicks <= endTick;

        // Check pitch range
        const pitchMatch = note.pitch >= startPitch && note.pitch <= endPitch;

        return timeOverlap && pitchMatch;
      });

      if (selection.additive) {
        setSelectedNotes(prev => {
          const newSelection = [...prev];
          selectedInArea.forEach(note => {
            if (!newSelection.some(n => n.id === note.id)) {
              newSelection.push(note);
            }
          });
          return newSelection;
        });
      } else {
        setSelectedNotes(selectedInArea);
      }
    }
  }, [notes, precisionGrid]);

  // ========================= NOTE DRAGGING =========================

  /**
   * Starts note dragging operation
   * @param {Object} event - Mouse event
   * @param {Array} targetNotes - Notes to drag
   * @param {string} mode - Drag mode ('move', 'resize-start', 'resize-end')
   */
  const startNoteDrag = useCallback((event, targetNotes, mode = 'move') => {
    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;

    // Store initial tick positions for all notes
    const startTicks = targetNotes.map(note =>
      note._motorTicks || precisionGrid.noteToTicks(note)
    );

    dragStateRef.current = {
      startX,
      startY,
      startTicks,
      mode,
      notes: targetNotes
    };

    setIsDragging(true);
    setDragState({
      mode,
      notes: targetNotes,
      startX,
      startY
    });

    console.log(`🎵 Started ${mode} drag for ${targetNotes.length} notes`);
  }, [precisionGrid]);

  /**
   * Updates note positions during drag
   * @param {Object} event - Mouse event
   */
  const updateNoteDrag = useCallback((event) => {
    if (!isDragging || !dragStateRef.current) return;

    const { startX, startTicks, mode, notes: dragNotes } = dragStateRef.current;
    const deltaX = event.clientX - startX;

    // Convert pixel delta to tick delta
    const stepWidth = engine.dimensions?.stepWidth || engine.stepWidth || 40;
    const tickDelta = precisionGrid.pixelsToTicks(deltaX, stepWidth);

    const updatedNotes = dragNotes.map((note, index) => {
      const originalTicks = startTicks[index];
      let newTicks;

      switch (mode) {
        case 'move':
          newTicks = originalTicks + tickDelta;
          break;
        case 'resize-end':
          // Resize the note duration
          const currentTicks = note._motorTicks || precisionGrid.noteToTicks(note);
          const newDurationTicks = Math.max(
            precisionGrid.getUISnapResolution(), // Minimum 1/32 note
            (note._durationTicks || precisionGrid.stepsToTicks(note.duration || 1)) + tickDelta
          );
          return {
            ...note,
            duration: precisionGrid.ticksToSteps(newDurationTicks),
            _durationTicks: newDurationTicks
          };
        case 'resize-start':
          // Move start position and adjust duration
          newTicks = originalTicks + tickDelta;
          const oldDuration = note._durationTicks || precisionGrid.stepsToTicks(note.duration || 1);
          const newDurationTicksStart = Math.max(
            precisionGrid.getUISnapResolution(),
            oldDuration - tickDelta
          );
          return {
            ...precisionGrid.updateNoteTiming(note, newTicks),
            duration: precisionGrid.ticksToSteps(newDurationTicksStart),
            _durationTicks: newDurationTicksStart
          };
        default:
          newTicks = originalTicks;
      }

      // Ensure notes don't go negative
      newTicks = Math.max(0, newTicks);

      // Apply UI snap during drag for visual feedback
      const snappedTicks = precisionGrid.snapToUIGrid(newTicks);

      return precisionGrid.updateNoteTiming(note, snappedTicks);
    });

    // Update drag state for visual feedback
    setDragState(prev => ({
      ...prev,
      currentX: event.clientX,
      currentY: event.clientY,
      updatedNotes
    }));

    return updatedNotes;
  }, [isDragging, precisionGrid, engine.dimensions?.stepWidth, engine.stepWidth]);

  /**
   * Finishes note dragging operation
   * @param {Object} event - Mouse event
   * @param {Function} onNotesUpdate - Callback to update notes
   */
  const finishNoteDrag = useCallback((event, onNotesUpdate) => {
    if (!isDragging) return;

    const updatedNotes = updateNoteDrag(event);

    if (updatedNotes && onNotesUpdate) {
      onNotesUpdate(updatedNotes);
      console.log(`🎵 Finished drag, updated ${updatedNotes.length} notes`);
    }

    // Reset drag state
    setIsDragging(false);
    setDragState(null);
    dragStateRef.current = null;
  }, [isDragging, updateNoteDrag]);

  // ========================= NOTE UTILITIES =========================

  /**
   * Gets visual position for a note
   * @param {Object} note
   * @returns {Object} Position and dimensions
   */
  const getNotePosition = useCallback((note) => {
    const noteTicks = note._motorTicks || precisionGrid.noteToTicks(note);
    const durationTicks = note._durationTicks || precisionGrid.stepsToTicks(note.duration || 1);

    const stepWidth = engine.dimensions?.stepWidth || engine.stepWidth || 40;
    const x = precisionGrid.ticksToPixels(noteTicks, stepWidth);
    const width = precisionGrid.ticksToPixels(durationTicks, stepWidth);

    return {
      x,
      width,
      ticks: noteTicks,
      durationTicks,
      musicalTime: precisionGrid.formatTicksAsMusicalTime(noteTicks)
    };
  }, [precisionGrid, engine.dimensions?.stepWidth, engine.stepWidth]);

  /**
   * Checks if a note is at a specific tick position
   * @param {Object} note
   * @param {number} targetTicks
   * @param {number} tolerance
   * @returns {boolean}
   */
  const isNoteAtTicks = useCallback((note, targetTicks, tolerance = 1) => {
    const noteTicks = note._motorTicks || precisionGrid.noteToTicks(note);
    return Math.abs(noteTicks - targetTicks) <= tolerance;
  }, [precisionGrid]);

  // Micro-adjustment integration
  const onNotesUpdate = useCallback((updatedNotes) => {
    // This would be connected to the parent component's note update function
    console.log(`🎵 Updating ${updatedNotes.length} notes with motor precision`);
  }, []);

  const microAdjustment = useMicroAdjustment(selectedNotes, onNotesUpdate, precisionGrid);

  // ========================= RETURN API =========================

  return {
    // State
    selectedNotes,
    isDragging,
    dragState,
    precisionGrid,

    // Note creation
    createNoteAtPosition,

    // Selection
    selectNotes,
    setSelectedNotes,

    // Dragging
    startNoteDrag,
    updateNoteDrag,
    finishNoteDrag,

    // Utilities
    getNotePosition,
    isNoteAtTicks,

    // Micro-adjustment
    ...microAdjustment,

    // Debug info
    getDebugInfo: () => ({
      selectedCount: selectedNotes.length,
      isDragging,
      dragMode: dragState?.mode,
      precisionInfo: precisionGrid.getDebugInfo()
    })
  };
};