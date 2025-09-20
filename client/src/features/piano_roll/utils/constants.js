export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// YENİ: Piyano klavyesi için temel sabitler eklendi
export const TOTAL_OCTAVES = 8; // C0'dan B7'ye kadar
export const TOTAL_KEYS = TOTAL_OCTAVES * 12; // Toplam 96 tuş

export const SCALES = {
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Minor': [0, 2, 3, 5, 7, 8, 10],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Phrygian': [0, 1, 3, 5, 7, 8, 10],
  'Lydian': [0, 2, 4, 6, 7, 9, 11],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Locrian': [0, 1, 3, 5, 7, 8, 10],
  'Pentatonic Major': [0, 2, 4, 7, 9],
  'Pentatonic Minor': [0, 3, 5, 7, 10],
  'Blues': [0, 3, 5, 6, 7, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  'Melodic Minor': [0, 2, 3, 5, 7, 9, 11]
};

export const NOTE_COLORS = {
  default: 'bg-blue-500',
  selected: 'bg-cyan-500',
  preview: 'bg-cyan-400/30'
};

export const VELOCITY_OPACITY_RANGE = [0.4, 1.0];

export const PIANO_KEY_COLORS = {
  white: 'bg-gray-700',
  black: 'bg-gray-900',
  whiteInScale: 'bg-indigo-900/50',
  blackInScale: 'bg-indigo-800/50'
};

export const GRID_COLORS = {
  bar: 'rgba(255, 255, 255, 0.15)',
  beat: 'rgba(255, 255, 255, 0.1)',
  subdivision: 'rgba(255, 255, 255, 0.05)',
  scaleHighlight: 'rgba(255, 255, 255, 0.03)'
};
