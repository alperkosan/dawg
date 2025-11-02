/**
 * SATURATOR SIMPLE PRESETS
 * Direct worklet parameters - no mode abstraction
 */

export const saturatorPresets = [
  {
    id: 'gentle-warmth',
    name: 'Gentle Warmth',
    category: 'Musical',
    description: 'Subtle analog warmth for vocals and instruments',
    tags: ['vocal', 'warm', 'subtle'],
    author: 'DAWG',
    settings: {
      distortion: 0.25,
      wet: 0.7,
      tone: 1,
      autoGain: 1,
      lowCutFreq: 20,
      highCutFreq: 20000,
      headroom: 0
    }
  },
  {
    id: 'tape-saturation',
    name: 'Tape Saturation',
    category: 'Vintage',
    description: 'Classic tape machine warmth and compression',
    tags: ['tape', 'vintage', 'warm'],
    author: 'DAWG',
    settings: {
      distortion: 0.4,
      wet: 0.85,
      tone: -1,
      autoGain: 1,
      lowCutFreq: 30,
      highCutFreq: 18000,
      headroom: -2
    }
  },
  {
    id: 'tube-drive',
    name: 'Tube Drive',
    category: 'Musical',
    description: 'Warm tube amplifier saturation',
    tags: ['tube', 'warm', 'drive'],
    author: 'DAWG',
    settings: {
      distortion: 0.6,
      wet: 1.0,
      tone: 2,
      autoGain: 1,
      lowCutFreq: 20,
      highCutFreq: 20000,
      headroom: 0
    }
  },
  {
    id: 'aggressive-grit',
    name: 'Aggressive Grit',
    category: 'Aggressive',
    description: 'Heavy distortion for drums and bass',
    tags: ['aggressive', 'drums', 'bass'],
    author: 'DAWG',
    settings: {
      distortion: 1.2,
      wet: 1.0,
      tone: 3,
      autoGain: 1,
      lowCutFreq: 20,
      highCutFreq: 15000,
      headroom: -3
    }
  },
  {
    id: 'bass-power',
    name: 'Bass Power',
    category: 'Musical',
    description: 'Low-end focused saturation for bass',
    tags: ['bass', 'low-end', 'power'],
    author: 'DAWG',
    settings: {
      distortion: 0.5,
      wet: 0.8,
      tone: -2,
      autoGain: 1,
      lowCutFreq: 20,
      highCutFreq: 8000,
      headroom: 0
    }
  },
  {
    id: 'vocal-presence',
    name: 'Vocal Presence',
    category: 'Musical',
    description: 'Adds clarity and presence to vocals',
    tags: ['vocal', 'presence', 'clarity'],
    author: 'DAWG',
    settings: {
      distortion: 0.3,
      wet: 0.6,
      tone: 3,
      autoGain: 1,
      lowCutFreq: 80,
      highCutFreq: 20000,
      headroom: 2
    }
  }
];
