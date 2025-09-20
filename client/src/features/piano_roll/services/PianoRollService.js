import { AudioContextService } from '../../../lib/services/AudioContextService';
import { quantizeNotes, humanizeNotes } from '../utils/helpers/quantizeUtils';
import { copyNotesToClipboard, pasteNotesFromClipboard } from '../utils/helpers/clipboardUtils';

export class PianoRollService {
  constructor() {
    this.clipboard = null;
    this.history = {
      past: [],
      present: null,
      future: []
    };
  }
  
  // Note operations
  createNote(noteData) {
    return {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      time: noteData.time || 0,
      pitch: noteData.pitch || 'C4',
      duration: noteData.duration || '16n',
      velocity: noteData.velocity || 0.8,
      ...noteData
    };
  }
  
  duplicateNotes(notes, offset = 4) {
    return notes.map(note => ({
      ...note,
      id: `note_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      time: note.time + offset
    }));
  }
  
  transposeNotes(notes, semitones) {
    return notes.map(note => {
      const currentIndex = this.pitchToIndex(note.pitch);
      const newIndex = Math.max(0, Math.min(127, currentIndex + semitones));
      return {
        ...note,
        pitch: this.indexToPitch(newIndex)
      };
    });
  }
  
  // Audio operations
  async auditionNote(instrumentId, pitch, velocity = 0.8) {
    try {
      if (velocity > 0) {
        await AudioContextService.auditionNoteOn(instrumentId, pitch, velocity);
      } else {
        await AudioContextService.auditionNoteOff(instrumentId, pitch);
      }
    } catch (error) {
      console.warn('Audio audition failed:', error);
    }
  }
  
  // Utility methods
  pitchToIndex(pitch) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteName = pitch.replace(/[0-9-]/g, '');
    const octave = parseInt(pitch.replace(/[^0-9-]/g, ''), 10) || 0;
    const noteIndex = notes.indexOf(noteName);
    return noteIndex === -1 ? 0 : octave * 12 + noteIndex;
  }
  
  indexToPitch(index) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteIndex = index % 12;
    const octave = Math.floor(index / 12);
    return `${notes[noteIndex]}${octave}`;
  }
  
  // History management
  pushToHistory(state) {
    this.history.past.push(this.history.present);
    this.history.present = state;
    this.history.future = [];
    
    // Limit history size
    if (this.history.past.length > 50) {
      this.history.past.shift();
    }
  }
  
  undo() {
    if (this.history.past.length === 0) return null;
    
    const previous = this.history.past.pop();
    this.history.future.unshift(this.history.present);
    this.history.present = previous;
    
    return previous;
  }
  
  redo() {
    if (this.history.future.length === 0) return null;
    
    const next = this.history.future.shift();
    this.history.past.push(this.history.present);
    this.history.present = next;
    
    return next;
  }
  
  canUndo() {
    return this.history.past.length > 0;
  }
  
  canRedo() {
    return this.history.future.length > 0;
  }
  
  // Processing operations
  quantize(notes, snapValue = '16n') {
    return quantizeNotes(notes, snapValue);
  }
  
  humanize(notes, options = {}) {
    return humanizeNotes(notes, options);
  }
