import * as Tone from 'tone';
import { NOTES } from './constants';

export const createNote = (noteData) => ({
  id: generateNoteId(),
  time: noteData.time || 0,
  pitch: noteData.pitch || 'C4',
  duration: noteData.duration || '16n',
  velocity: noteData.velocity || 0.8,
  ...noteData
});

export const updateNote = (note, updates) => ({
  ...note,
  ...updates
});

export const deleteNotes = (notes, idsToDelete) => {
  const deleteSet = new Set(idsToDelete);
  return notes.filter(note => !deleteSet.has(note.id));
};

export const generateNoteId = () => {
  return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const pitchToMidi = (pitch) => {
  const noteMap = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const noteName = pitch.replace(/[0-9]/g, '');
  const octave = parseInt(pitch.slice(-1));
  return (octave + 1) * 12 + noteMap[noteName];
};

export const midiToPitch = (midiNumber) => {
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteIndex = midiNumber % 12;
  return `${NOTES[noteIndex]}${octave}`;
};

export const quantizeTime = (time, snapValue) => {
  const snapSteps = Tone.Time(snapValue).toSeconds() / Tone.Time('16n').toSeconds();
  return Math.round(time / snapSteps) * snapSteps;
};

export const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export const getDurationInSteps = (duration) => {
  return Tone.Time(duration).toSeconds() / Tone.Time('16n').toSeconds();
};

export const stepsToNotation = (steps) => {
  return Tone.Time(steps * Tone.Time('16n').toSeconds()).toNotation();
};