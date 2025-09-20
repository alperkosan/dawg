import { NOTES, SCALES } from '../core/constants';

export const getScaleNotes = (root, scaleType) => {
  const rootIndex = NOTES.indexOf(root);
  const intervals = SCALES[scaleType] || SCALES.Minor;
  return new Set(intervals.map(interval => (rootIndex + interval) % 12));
};

export const isNoteInScale = (pitch, root, scaleType) => {
  const noteName = pitch.replace(/[0-9-]/g, '');
  const noteIndex = NOTES.indexOf(noteName);
  const scaleNotes = getScaleNotes(root, scaleType);
  return scaleNotes.has(noteIndex);
};

export const getScaleDegree = (pitch, root, scaleType) => {
  const noteName = pitch.replace(/[0-9-]/g, '');
  const noteIndex = NOTES.indexOf(noteName);
  const rootIndex = NOTES.indexOf(root);
  const intervals = SCALES[scaleType] || SCALES.Minor;
  
  const normalizedIndex = (noteIndex - rootIndex + 12) % 12;
  const degree = intervals.indexOf(normalizedIndex);
  
  return degree !== -1 ? degree + 1 : null; // 1-based degree
};

export const getChordFromScale = (root, scaleType, degree = 1, chordType = 'triad') => {
  const intervals = SCALES[scaleType] || SCALES.Minor;
  const rootIndex = NOTES.indexOf(root);
  
  if (degree < 1 || degree > intervals.length) {
    throw new Error(`Invalid degree ${degree} for scale ${scaleType}`);
  }
  
  const scaleRoot = (rootIndex + intervals[degree - 1]) % 12;
  const chordNotes = [];
  
  if (chordType === 'triad') {
    // Root, 3rd, 5th
    chordNotes.push(scaleRoot);
    chordNotes.push((scaleRoot + intervals[2]) % 12); // 3rd
    chordNotes.push((scaleRoot + intervals[4]) % 12); // 5th
  } else if (chordType === 'seventh') {
    // Root, 3rd, 5th, 7th
    chordNotes.push(scaleRoot);
    chordNotes.push((scaleRoot + intervals[2]) % 12);
    chordNotes.push((scaleRoot + intervals[4]) % 12);
    chordNotes.push((scaleRoot + intervals[6]) % 12); // 7th
  }
  
  return chordNotes.map(noteIndex => NOTES[noteIndex]);
};
