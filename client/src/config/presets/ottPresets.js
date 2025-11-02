/**
 * OTT-STYLE MULTIBAND COMPRESSOR PRESETS
 * Inspired by Xfer OTT
 *
 * Categories:
 * - Drums: Punchy, aggressive compression for drums
 * - Bass: Thick, consistent low-end control
 * - Vocal: Present, in-your-face vocal processing
 * - Master: Glue and loudness for master bus
 * - Creative: Synth and pad enhancement
 * - Subtle: Gentle multiband enhancement
 */

export const ottPresets = [
  // === DRUMS ===
  {
    id: 'ott-drums',
    name: 'OTT Drums',
    category: 'Drums',
    description: 'Massive punch and body for drums',
    tags: ['drums', 'punchy', 'aggressive'],
    author: 'DAWG Audio',
    settings: {
      depth: 0.7,
      time: 0.3,
      lowUpRatio: 4,
      lowDownRatio: 3,
      lowGain: 2,
      midUpRatio: 3,
      midDownRatio: 4,
      midGain: 1,
      highUpRatio: 5,
      highDownRatio: 4,
      highGain: 3,
      wet: 1.0
    }
  },
  {
    id: 'ott-aggressive',
    name: 'OTT Aggressive',
    category: 'Drums',
    description: 'Over-the-top extreme compression',
    tags: ['extreme', 'heavy', 'loud'],
    author: 'DAWG Audio',
    settings: {
      depth: 1.0,
      time: 0.2,
      lowUpRatio: 8,
      lowDownRatio: 6,
      lowGain: 6,
      midUpRatio: 8,
      midDownRatio: 6,
      midGain: 4,
      highUpRatio: 8,
      highDownRatio: 6,
      highGain: 6,
      wet: 1.0
    }
  },

  // === BASS ===
  {
    id: 'ott-bass',
    name: 'OTT Bass',
    category: 'Bass',
    description: 'Thick, consistent bass',
    tags: ['bass', '808', 'thick'],
    author: 'DAWG Audio',
    settings: {
      depth: 0.6,
      time: 0.5,
      lowUpRatio: 6,
      lowDownRatio: 4,
      lowGain: 4,
      midUpRatio: 3,
      midDownRatio: 3,
      midGain: -2,
      highUpRatio: 2,
      highDownRatio: 2,
      highGain: -6,
      wet: 1.0
    }
  },

  // === VOCAL ===
  {
    id: 'ott-vocal',
    name: 'OTT Vocal',
    category: 'Vocal',
    description: 'Present, in-your-face vocals',
    tags: ['vocal', 'present', 'upfront'],
    author: 'DAWG Audio',
    settings: {
      depth: 0.4,
      time: 0.4,
      lowUpRatio: 2,
      lowDownRatio: 3,
      lowGain: -3,
      midUpRatio: 4,
      midDownRatio: 4,
      midGain: 3,
      highUpRatio: 3,
      highDownRatio: 3,
      highGain: 2,
      wet: 1.0
    }
  },

  // === MASTER ===
  {
    id: 'ott-master',
    name: 'OTT Master',
    category: 'Master',
    description: 'Glue and loudness for master bus',
    tags: ['master', 'glue', 'bus'],
    author: 'DAWG Audio',
    settings: {
      depth: 0.3,
      time: 0.6,
      lowUpRatio: 3,
      lowDownRatio: 3,
      lowGain: 1,
      midUpRatio: 3,
      midDownRatio: 3,
      midGain: 0,
      highUpRatio: 3,
      highDownRatio: 3,
      highGain: 1,
      wet: 1.0
    }
  },

  // === CREATIVE ===
  {
    id: 'ott-synth',
    name: 'OTT Synth',
    category: 'Creative',
    description: 'Bright, upfront synth presence',
    tags: ['synth', 'bright', 'lead'],
    author: 'DAWG Audio',
    settings: {
      depth: 0.5,
      time: 0.3,
      lowUpRatio: 3,
      lowDownRatio: 3,
      lowGain: -2,
      midUpRatio: 4,
      midDownRatio: 4,
      midGain: 2,
      highUpRatio: 6,
      highDownRatio: 5,
      highGain: 4,
      wet: 1.0
    }
  },
  {
    id: 'ott-pad',
    name: 'OTT Pad',
    category: 'Creative',
    description: 'Lush, sustained pad compression',
    tags: ['pad', 'ambient', 'lush'],
    author: 'DAWG Audio',
    settings: {
      depth: 0.4,
      time: 0.9,
      lowUpRatio: 4,
      lowDownRatio: 3,
      lowGain: 2,
      midUpRatio: 4,
      midDownRatio: 3,
      midGain: 1,
      highUpRatio: 3,
      highDownRatio: 3,
      highGain: -1,
      wet: 1.0
    }
  },

  // === SUBTLE ===
  {
    id: 'ott-subtle',
    name: 'OTT Subtle',
    category: 'Subtle',
    description: 'Gentle multiband enhancement',
    tags: ['gentle', 'transparent', 'subtle'],
    author: 'DAWG Audio',
    settings: {
      depth: 0.2,
      time: 0.8,
      lowUpRatio: 2,
      lowDownRatio: 2,
      lowGain: 0,
      midUpRatio: 2,
      midDownRatio: 2,
      midGain: 0,
      highUpRatio: 2,
      highDownRatio: 2,
      highGain: 0,
      wet: 1.0
    }
  }
];
