/**
 * STARDUST CHORUS FACTORY PRESETS
 *
 * Professional chorus presets for rich spatial effects
 * Organized by category: Subtle, Lush, Wide, Vintage, Creative
 */

export const stardustChorusPresets = [
  // ===================================
  // SUBTLE
  // ===================================
  {
    id: 'subtle-thickener',
    name: 'Subtle Thickener',
    description: 'Gentle chorus for adding thickness without obvious modulation',
    category: 'Subtle',
    tags: ['subtle', 'thick', 'natural'],
    author: 'DAWG',
    settings: {
      rate: 0.8,
      delayTime: 4.5,
      depth: 0.3,
      wet: 0.4
    }
  },
  {
    id: 'slight-detune',
    name: 'Slight Detune',
    description: 'Minimal detuning effect for slight width',
    category: 'Subtle',
    tags: ['detune', 'width', 'gentle'],
    author: 'DAWG',
    settings: {
      rate: 0.5,
      delayTime: 3.0,
      depth: 0.25,
      wet: 0.3
    }
  },

  // ===================================
  // LUSH
  // ===================================
  {
    id: 'liquid-guitar',
    name: 'Liquid Guitar',
    description: 'Rich, flowing chorus perfect for guitar and keys',
    category: 'Lush',
    tags: ['guitar', 'lush', 'flowing'],
    author: 'DAWG',
    settings: {
      rate: 2.2,
      delayTime: 2.8,
      depth: 0.8,
      wet: 0.6
    }
  },
  {
    id: '80s-ensemble',
    name: '80s Ensemble',
    description: 'Classic 80s synth ensemble chorus',
    category: 'Lush',
    tags: ['80s', 'synth', 'ensemble'],
    author: 'DAWG',
    settings: {
      rate: 1.5,
      delayTime: 3.5,
      depth: 0.7,
      wet: 0.5
    }
  },
  {
    id: 'dream-shimmer',
    name: 'Dream Shimmer',
    description: 'Ethereal shimmering chorus for pads and vocals',
    category: 'Lush',
    tags: ['dreamy', 'shimmer', 'ethereal'],
    author: 'DAWG',
    settings: {
      rate: 1.8,
      delayTime: 5.0,
      depth: 0.85,
      wet: 0.65
    }
  },

  // ===================================
  // WIDE
  // ===================================
  {
    id: 'wide-stereo',
    name: 'Wide Stereo',
    description: 'Maximum stereo width with rich modulation',
    category: 'Wide',
    tags: ['wide', 'stereo', 'spacious'],
    author: 'DAWG',
    settings: {
      rate: 1.2,
      delayTime: 6.0,
      depth: 0.9,
      wet: 0.7
    }
  },
  {
    id: 'dimension-d',
    name: 'Dimension D',
    description: 'Roland Dimension D-style spatial enhancement',
    category: 'Wide',
    tags: ['dimension', 'roland', 'width'],
    author: 'DAWG',
    settings: {
      rate: 0.9,
      delayTime: 4.0,
      depth: 0.75,
      wet: 0.8
    }
  },

  // ===================================
  // VINTAGE
  // ===================================
  {
    id: 'juno-chorus',
    name: 'Juno Chorus',
    description: 'Classic Roland Juno-60 chorus character',
    category: 'Vintage',
    tags: ['juno', 'vintage', 'analog'],
    author: 'DAWG',
    settings: {
      rate: 1.5,
      delayTime: 3.5,
      depth: 0.7,
      wet: 1.0
    }
  },
  {
    id: 'analog-warmth',
    name: 'Analog Warmth',
    description: 'Warm vintage analog chorus',
    category: 'Vintage',
    tags: ['analog', 'warm', 'vintage'],
    author: 'DAWG',
    settings: {
      rate: 1.0,
      delayTime: 5.5,
      depth: 0.6,
      wet: 0.55
    }
  },
  {
    id: 'tape-chorus',
    name: 'Tape Chorus',
    description: 'Vintage tape-style chorus with wow and flutter',
    category: 'Vintage',
    tags: ['tape', 'vintage', 'lofi'],
    author: 'DAWG',
    settings: {
      rate: 0.7,
      delayTime: 8.0,
      depth: 0.5,
      wet: 0.6
    }
  },

  // ===================================
  // CREATIVE
  // ===================================
  {
    id: 'detuned-dream',
    name: 'Detuned Dream',
    description: 'Heavy detuning for surreal atmospheric effects',
    category: 'Creative',
    tags: ['detune', 'dreamy', 'atmospheric'],
    author: 'DAWG',
    settings: {
      rate: 3.5,
      delayTime: 10.0,
      depth: 0.95,
      wet: 0.8
    }
  },
  {
    id: 'vibrato-intense',
    name: 'Vibrato Intense',
    description: 'Fast, deep vibrato effect',
    category: 'Creative',
    tags: ['vibrato', 'intense', 'fast'],
    author: 'DAWG',
    settings: {
      rate: 6.0,
      delayTime: 2.0,
      depth: 0.9,
      wet: 1.0
    }
  },
  {
    id: 'space-modulation',
    name: 'Space Modulation',
    description: 'Cosmic, otherworldly chorus movement',
    category: 'Creative',
    tags: ['space', 'cosmic', 'movement'],
    author: 'DAWG',
    settings: {
      rate: 0.3,
      delayTime: 12.0,
      depth: 0.85,
      wet: 0.75
    }
  }
];

export default stardustChorusPresets;
