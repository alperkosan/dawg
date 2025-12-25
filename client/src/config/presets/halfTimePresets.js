/**
 * HALFTIME PRESETS v2.0
 *
 * Professional time-stretching presets
 * Categories: Clean Stretch, Analog Tape, Granular, Creative
 */

export const halfTimePresets = [
  // ============================================================================
  // CLEAN STRETCH
  // ============================================================================
  {
    id: 'clean-half',
    name: 'Clean Half',
    category: 'Clean Stretch',
    description: 'Pristine algorithmic stretch - transparent time manipulation',
    tags: ['clean', 'transparent', 'algorithmic'],
    author: 'DAWG Factory',
    settings: {
      rate: 0.5,
      smoothing: 80,
      pitchShift: -12,
      pitchLock: 1,
      grainSize: 100,
      grainDensity: 8,
      mix: 1.0,
      reverse: 0
    }
  },
  {
    id: 'quarter-time',
    name: 'Quarter Time',
    category: 'Clean Stretch',
    description: 'Extreme slow-down with pitch lock',
    tags: ['slow', 'extreme', 'quarter'],
    author: 'DAWG Factory',
    settings: {
      rate: 0.25,
      smoothing: 90,
      pitchShift: -24,
      pitchLock: 1,
      grainSize: 150,
      grainDensity: 10,
      mix: 1.0,
      reverse: 0
    }
  },
  {
    id: 'double-time',
    name: 'Double Time',
    category: 'Clean Stretch',
    description: 'Speed up without pitch change',
    tags: ['fast', 'double', 'speed'],
    author: 'DAWG Factory',
    settings: {
      rate: 2.0,
      smoothing: 85,
      pitchShift: 12,
      pitchLock: 1,
      grainSize: 80,
      grainDensity: 12,
      mix: 1.0,
      reverse: 0
    }
  },

  // ============================================================================
  // ANALOG TAPE
  // ============================================================================
  {
    id: 'tape-slow',
    name: 'Tape Slow',
    category: 'Analog Tape',
    description: 'Analog tape slow-down with warmth and flutter',
    tags: ['tape', 'analog', 'warm', 'flutter'],
    author: 'DAWG Factory',
    settings: {
      rate: 0.5,
      smoothing: 30,
      pitchShift: -12,
      pitchLock: 0,
      grainSize: 200,
      grainDensity: 4,
      mix: 1.0,
      reverse: 0
    }
  },
  {
    id: 'vinyl-33',
    name: 'Vinyl 33',
    category: 'Analog Tape',
    description: 'Vinyl record slow-down character',
    tags: ['vinyl', 'vintage', 'analog'],
    author: 'DAWG Factory',
    settings: {
      rate: 0.5,
      smoothing: 40,
      pitchShift: -12,
      pitchLock: 0,
      grainSize: 180,
      grainDensity: 5,
      mix: 1.0,
      reverse: 0
    }
  },
  {
    id: 'cassette-slow',
    name: 'Cassette Slow',
    category: 'Analog Tape',
    description: 'Cassette tape slow-down with wow and flutter',
    tags: ['cassette', 'tape', 'wow', 'flutter'],
    author: 'DAWG Factory',
    settings: {
      rate: 0.5,
      smoothing: 35,
      pitchShift: -12,
      pitchLock: 0,
      grainSize: 220,
      grainDensity: 3,
      mix: 1.0,
      reverse: 0
    }
  },

  // ============================================================================
  // GRANULAR
  // ============================================================================
  {
    id: 'granular-cloud',
    name: 'Granular Cloud',
    category: 'Granular',
    description: 'Dense granular texture - experimental time cloud',
    tags: ['granular', 'dense', 'texture', 'experimental'],
    author: 'DAWG Factory',
    settings: {
      rate: 0.5,
      smoothing: 70,
      pitchShift: -12,
      pitchLock: 1,
      grainSize: 100,
      grainDensity: 12,
      mix: 1.0,
      reverse: 0
    }
  },
  {
    id: 'grainy-stretch',
    name: 'Grainy Stretch',
    category: 'Granular',
    description: 'Coarse granular time stretch',
    tags: ['granular', 'coarse', 'texture'],
    author: 'DAWG Factory',
    settings: {
      rate: 0.5,
      smoothing: 50,
      pitchShift: -12,
      pitchLock: 1,
      grainSize: 50,
      grainDensity: 16,
      mix: 1.0,
      reverse: 0
    }
  },

  // ============================================================================
  // CREATIVE
  // ============================================================================
  {
    id: 'glitch-stretch',
    name: 'Glitch Stretch',
    category: 'Creative',
    description: 'Glitchy time manipulation with artifacts',
    tags: ['glitch', 'artifacts', 'creative'],
    author: 'DAWG Factory',
    settings: {
      rate: 0.5,
      smoothing: 20,
      pitchShift: -12,
      pitchLock: 0,
      grainSize: 80,
      grainDensity: 14,
      mix: 1.0,
      reverse: 0
    }
  },
  {
    id: 'stutter-half',
    name: 'Stutter Half',
    category: 'Creative',
    description: 'Half-time with stutter effect',
    tags: ['stutter', 'half-time', 'creative'],
    author: 'DAWG Factory',
    settings: {
      rate: 0.5,
      smoothing: 10,
      pitchShift: -12,
      pitchLock: 1,
      grainSize: 60,
      grainDensity: 16,
      mix: 1.0,
      reverse: 0
    }
  },
  {
    id: 'reverse-half',
    name: 'Reverse Half',
    category: 'Creative',
    description: 'Backwards playback with half-time stretch',
    tags: ['reverse', 'backwards', 'creative'],
    author: 'DAWG Factory',
    settings: {
      rate: 0.5,
      smoothing: 60,
      pitchShift: -12,
      pitchLock: 1,
      grainSize: 120,
      grainDensity: 8,
      mix: 1.0,
      reverse: 1
    }
  },
  {
    id: 'reverse-glitch',
    name: 'Reverse Glitch',
    category: 'Creative',
    description: 'Backwards glitchy time manipulation',
    tags: ['reverse', 'glitch', 'backwards', 'creative'],
    author: 'DAWG Factory',
    settings: {
      rate: 0.5,
      smoothing: 15,
      pitchShift: -12,
      pitchLock: 0,
      grainSize: 70,
      grainDensity: 14,
      mix: 1.0,
      reverse: 1
    }
  }
];

