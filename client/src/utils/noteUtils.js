/**
 * NOTE UTILITIES
 */

/**
 * Generate unique note ID
 */
export function generateNoteId() {
  return `note-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Convert MIDI note number to frequency
 */
export function midiToFrequency(midiNote) {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * Convert frequency to MIDI note number
 */
export function frequencyToMidi(frequency) {
  return Math.round(69 + 12 * Math.log2(frequency / 440));
}

/**
 * Get note name from MIDI number
 */
export function midiToNoteName(midiNote) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = noteNames[midiNote % 12];
  return `${noteName}${octave}`;
}

/**
 * Parse note name to MIDI number
 */
export function noteNameToMidi(noteName) {
  const noteMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const match = noteName.match(/^([A-G])(#|b)?(-?\d+)$/);

  if (!match) return 60; // Default to C4

  const [, note, accidental, octave] = match;
  let midiNote = noteMap[note] + (parseInt(octave) + 1) * 12;

  if (accidental === '#') midiNote += 1;
  if (accidental === 'b') midiNote -= 1;

  return midiNote;
}
