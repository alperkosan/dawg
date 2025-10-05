// src/hooks/usePianoRoll.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { useArrangementStore } from '@/store/useArrangementStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { PatternService } from '@/lib/services/PatternService';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { pianoRollUtils } from '@/lib/utils/pianoRollUtils';
import { commandManager } from '@/lib/commands/CommandManager';
import { AddNoteCommand } from '@/lib/commands/AddNoteCommand';
import { DeleteNoteCommand } from '@/lib/commands/DeleteNoteCommand';

export const usePianoRoll = (instrumentId) => {
  // State
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [gridSnap, setGridSnap] = useState('16n');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewPort, setViewPort] = useState({ scrollX: 0, scrollY: 0 });
  const [dragState, setDragState] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Refs for performance
  const notesRef = useRef([]);
  const previewTimeoutRef = useRef(null);

  // Store data
  const { activePatternId, patterns } = useArrangementStore();
  const { bpm, currentStep, playbackState } = usePlaybackStore();
  const activePattern = patterns[activePatternId];
  const notes = activePattern?.data[instrumentId] || [];

  // Update notes ref when store changes
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // Sync playback state
  useEffect(() => {
    setIsPlaying(playbackState === 'playing');
  }, [playbackState]);

  // =================== NOTE OPERATIONS ===================

  const addNote = useCallback((noteData) => {
    if (!activePatternId) return;

    const newNote = {
      id: pianoRollUtils.generateNoteId(),
      time: pianoRollUtils.quantizeTime(noteData.time, gridSnap, bpm),
      pitch: noteData.pitch,
      velocity: pianoRollUtils.clamp(noteData.velocity || 0.8, 0.1, 1.0),
      duration: noteData.duration || pianoRollUtils.getGridSnapValue(gridSnap, bpm)
    };

    // Use command pattern for undo/redo support
    const command = new AddNoteCommand(instrumentId, newNote.time);
    command.note = newNote; // Override with our custom note
    commandManager.execute(command);

    // Immediate audio preview
    previewNote(newNote.pitch, newNote.velocity);

    return newNote;
  }, [activePatternId, instrumentId, gridSnap, bpm]);

  const deleteNote = useCallback((noteId) => {
    const noteToDelete = notes.find(note => note.id === noteId);
    if (!noteToDelete) return;

    const command = new DeleteNoteCommand(instrumentId, noteToDelete);
    commandManager.execute(command);

    // Remove from selection
    setSelectedNotes(prev => {
      const newSelection = new Set(prev);
      newSelection.delete(noteId);
      return newSelection;
    });
  }, [notes, instrumentId]);

  const updateNote = useCallback((noteId, updates) => {
    const currentNotes = notesRef.current;
    const noteIndex = currentNotes.findIndex(note => note.id === noteId);
    
    if (noteIndex === -1) return;

    const updatedNotes = [...currentNotes];
    updatedNotes[noteIndex] = {
      ...updatedNotes[noteIndex],
      ...updates,
      time: updates.time ? pianoRollUtils.quantizeTime(updates.time, gridSnap, bpm) : updatedNotes[noteIndex].time
    };

    // Update immediately for smooth editing
    PatternService.updateNotesForActivePattern(instrumentId, updatedNotes, false);

    // Preview if pitch or velocity changed
    if (updates.pitch || updates.velocity) {
      const updatedNote = updatedNotes[noteIndex];
      previewNote(updatedNote.pitch, updatedNote.velocity);
    }
  }, [instrumentId, gridSnap, bpm]);

  const selectNotes = useCallback((noteIds) => {
    if (Array.isArray(noteIds)) {
      setSelectedNotes(new Set(noteIds));
    } else {
      setSelectedNotes(new Set([noteIds]));
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNotes(new Set());
  }, []);

  // =================== AUDIO PREVIEW ===================

  const previewNote = useCallback((pitch, velocity = 0.8, duration = 200) => {
    // Clear previous preview
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      AudioContextService.auditionNoteOff(instrumentId, pitch);
    }

    // Play note
    AudioContextService.auditionNoteOn(instrumentId, pitch, velocity);

    // Schedule note off
    previewTimeoutRef.current = setTimeout(() => {
      AudioContextService.auditionNoteOff(instrumentId, pitch);
    }, duration);
  }, [instrumentId]);

  const stopPreview = useCallback(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    // Stop all preview notes for this instrument
    AudioContextService.auditionNoteOff(instrumentId, 'all');
  }, [instrumentId]);

  // =================== RECORDING ===================

  const startRecording = useCallback(() => {
    setIsRecording(true);
    console.log(`🔴 Recording started for instrument: ${instrumentId}`);
  }, [instrumentId]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    console.log(`⏹️ Recording stopped for instrument: ${instrumentId}`);
  }, []);

  // Real-time recording input
  const recordNote = useCallback((pitch, velocity, time) => {
    if (!isRecording) return;

    const recordedNote = {
      time: time || currentStep,
      pitch: typeof pitch === 'number' ? pianoRollUtils.midiToPitch(pitch) : pitch,
      velocity: velocity || 0.8,
      duration: pianoRollUtils.getGridSnapValue(gridSnap, bpm)
    };

    addNote(recordedNote);
  }, [isRecording, currentStep, gridSnap, bpm, addNote]);

  // =================== GRID AND VIEW ===================

  const setGridSize = useCallback((newGridSnap) => {
    setGridSnap(newGridSnap);
    // Update timeline snap via AudioContextService
    AudioContextService.timeline.setGridSnap(true, pianoRollUtils.getGridSnapValue(newGridSnap, bpm));
  }, [bpm]);

  const zoom = useCallback((factor, centerX, centerY) => {
    const newZoomLevel = pianoRollUtils.clamp(zoomLevel * factor, 0.25, 4);
    setZoomLevel(newZoomLevel);
    
    // Adjust viewport to zoom around center point
    const deltaX = (centerX - viewPort.scrollX) * (factor - 1);
    const deltaY = (centerY - viewPort.scrollY) * (factor - 1);
    
    setViewPort(prev => ({
      scrollX: prev.scrollX - deltaX,
      scrollY: prev.scrollY - deltaY
    }));
  }, [zoomLevel, viewPort]);

  const scrollTo = useCallback((x, y) => {
    setViewPort({ scrollX: x, scrollY: y });
  }, []);

  // =================== PLAYHEAD SYNC ===================

  const jumpToStep = useCallback((step) => {
    AudioContextService.timeline.jumpToStep(step);
  }, []);

  const followPlayhead = useCallback(() => {
    if (isPlaying && currentStep) {
      const playheadX = currentStep * 20 * zoomLevel; // 20px per step base
      const viewportWidth = 800; // Adjust to your piano roll width
      
      if (playheadX < viewPort.scrollX || playheadX > viewPort.scrollX + viewportWidth) {
        setViewPort(prev => ({
          ...prev,
          scrollX: playheadX - viewportWidth / 2
        }));
      }
    }
  }, [isPlaying, currentStep, zoomLevel, viewPort.scrollX]);

  useEffect(() => {
    followPlayhead();
  }, [followPlayhead]);

  // =================== SELECTION OPERATIONS ===================

  const deleteSelectedNotes = useCallback(() => {
    selectedNotes.forEach(noteId => {
      deleteNote(noteId);
    });
    clearSelection();
  }, [selectedNotes, deleteNote, clearSelection]);

  const quantizeSelectedNotes = useCallback(() => {
    const currentNotes = notesRef.current;
    const updatedNotes = currentNotes.map(note => {
      if (selectedNotes.has(note.id)) {
        return {
          ...note,
          time: pianoRollUtils.quantizeTime(note.time, gridSnap, bpm)
        };
      }
      return note;
    });

    PatternService.updateNotesForActivePattern(instrumentId, updatedNotes);
  }, [selectedNotes, instrumentId, gridSnap, bpm]);

  const duplicateSelectedNotes = useCallback(() => {
    const currentNotes = notesRef.current;
    const notesToDuplicate = currentNotes.filter(note => selectedNotes.has(note.id));
    
    const duplicatedNotes = notesToDuplicate.map(note => ({
      ...note,
      id: pianoRollUtils.generateNoteId(),
      time: note.time + pianoRollUtils.getGridSnapValue('4n', bpm) // Offset by 1 beat
    }));

    const updatedNotes = [...currentNotes, ...duplicatedNotes];
    PatternService.updateNotesForActivePattern(instrumentId, updatedNotes);

    // Select duplicated notes
    const duplicatedIds = duplicatedNotes.map(note => note.id);
    setSelectedNotes(new Set(duplicatedIds));
  }, [selectedNotes, instrumentId, bpm]);

  // =================== KEYBOARD SHORTCUTS ===================

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return; // Don't trigger on input fields

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          deleteSelectedNotes();
          break;
        case 'q':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            quantizeSelectedNotes();
          }
          break;
        case 'd':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            duplicateSelectedNotes();
          }
          break;
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setSelectedNotes(new Set(notes.map(note => note.id)));
          }
          break;
        case 'Escape':
          clearSelection();
          break;
        case 'r':
          e.preventDefault();
          if (isRecording) {
            stopRecording();
          } else {
            startRecording();
          }
          break;
        case ' ': // Spacebar
          e.preventDefault();
          if (isPlaying) {
            AudioContextService.pause();
          } else {
            AudioContextService.play();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNotes, deleteSelectedNotes, quantizeSelectedNotes, duplicateSelectedNotes, notes, isRecording, isPlaying]);

  // =================== CLEANUP ===================

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [stopPreview]);

  return {
    // Data
    notes,
    selectedNotes,
    isRecording,
    isPlaying,
    
    // Grid & View
    gridSnap,
    zoomLevel,
    viewPort,
    setGridSize,
    zoom,
    scrollTo,
    
    // Note operations
    addNote,
    deleteNote,
    updateNote,
    selectNotes,
    clearSelection,
    
    // Audio
    previewNote,
    stopPreview,
    
    // Recording
    startRecording,
    stopRecording,
    recordNote,
    
    // Playback
    jumpToStep,
    currentStep,
    bpm,
    
    // Batch operations
    deleteSelectedNotes,
    quantizeSelectedNotes,
    duplicateSelectedNotes,
    
    // Utils
    calculateNotePosition: (note) => pianoRollUtils.calculateNotePosition(note, viewPort, 20 * zoomLevel),
    getMidiFromY: (y) => 127 - Math.floor((y + viewPort.scrollY) / 12),
    getTimeFromX: (x) => (x + viewPort.scrollX) / (20 * zoomLevel)
  };
};