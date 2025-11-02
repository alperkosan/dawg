/**
 * COMPRESSOR SIMPLE PRESETS
 * Direct worklet parameters - no mode abstraction
 */

export const compressorPresets = [
  {
    id: 'vocal-control',
    name: 'Vocal Control',
    category: 'Musical',
    description: 'Smooth, transparent vocal compression',
    tags: ['vocal', 'smooth', 'transparent'],
    author: 'DAWG',
    settings: {
      threshold: -18,
      ratio: 3,
      attack: 0.003,
      release: 0.06,
      knee: 12,
      wet: 1.0,
      lookahead: 2,
      stereoLink: 100,
      autoMakeup: 1
    }
  },
  {
    id: 'drum-glue',
    name: 'Drum Glue',
    category: 'Musical',
    description: 'Bus compression for drum groups',
    tags: ['drums', 'bus', 'glue'],
    author: 'DAWG',
    settings: {
      threshold: -12,
      ratio: 4,
      attack: 0.01,
      release: 0.1,
      knee: 6,
      wet: 1.0,
      lookahead: 0,
      stereoLink: 100,
      autoMakeup: 1
    }
  },
  {
    id: 'bass-control',
    name: 'Bass Control',
    category: 'Musical',
    description: 'Even, musical bass compression',
    tags: ['bass', 'smooth', 'control'],
    author: 'DAWG',
    settings: {
      threshold: -15,
      ratio: 5,
      attack: 0.005,
      release: 0.08,
      knee: 8,
      wet: 1.0,
      lookahead: 3,
      stereoLink: 100,
      autoMakeup: 1
    }
  },
  {
    id: 'aggressive-1176',
    name: 'Aggressive 1176',
    category: 'Aggressive',
    description: 'Fast, punchy compression',
    tags: ['aggressive', 'fast', 'punchy'],
    author: 'DAWG',
    settings: {
      threshold: -20,
      ratio: 8,
      attack: 0.0005,
      release: 0.05,
      knee: 0,
      wet: 1.0,
      lookahead: 0,
      stereoLink: 100,
      autoMakeup: 1
    }
  },
  {
    id: 'master-glue',
    name: 'Master Glue',
    category: 'Mastering',
    description: 'Gentle bus compression for master',
    tags: ['master', 'bus', 'gentle'],
    author: 'DAWG',
    settings: {
      threshold: -6,
      ratio: 2,
      attack: 0.03,
      release: 0.3,
      knee: 15,
      wet: 1.0,
      lookahead: 5,
      stereoLink: 100,
      autoMakeup: 0
    }
  },
  {
    id: 'parallel-punch',
    name: 'Parallel Punch',
    category: 'Creative',
    description: 'Heavy compression for parallel processing',
    tags: ['parallel', 'punch', 'heavy'],
    author: 'DAWG',
    settings: {
      threshold: -30,
      ratio: 10,
      attack: 0.001,
      release: 0.04,
      knee: 0,
      wet: 0.3,
      lookahead: 0,
      stereoLink: 100,
      autoMakeup: 1
    }
  }
];
