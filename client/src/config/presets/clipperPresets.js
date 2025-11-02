/**
 * CLIPPER PRESETS v2.0
 *
 * Professional clipping presets with harmonic generation
 * Categories: Hard Clipping, Soft Clipping, Creative, Subtle Enhancement
 */

export const clipperPresets = [
  // ============================================================================
  // HARD CLIPPING
  // ============================================================================
  {
    id: 'hard-clip',
    name: 'Hard Clip',
    category: 'Hard Clipping',
    description: 'Digital brick wall clipping',
    tags: ['hard', 'digital', 'brick-wall'],
    author: 'DAWG Factory',
    settings: {
      ceiling: 0.0,
      hardness: 100,
      harmonics: 30,
      preGain: 0,
      postGain: 0,
      mix: 100,
      mode: 0,
      dcFilter: 1,
      oversample: 2
    }
  },
  {
    id: 'aggressive-clip',
    name: 'Aggressive Clip',
    category: 'Hard Clipping',
    description: 'Maximum clipping with high harmonics',
    tags: ['aggressive', 'hard', 'distortion'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -2.0,
      hardness: 100,
      harmonics: 80,
      preGain: 6,
      postGain: -3,
      mix: 100,
      mode: 0,
      dcFilter: 1,
      oversample: 4
    }
  },

  // ============================================================================
  // SOFT CLIPPING
  // ============================================================================
  {
    id: 'soft-saturation',
    name: 'Soft Saturation',
    category: 'Soft Clipping',
    description: 'Smooth saturation curve',
    tags: ['soft', 'smooth', 'saturation'],
    author: 'DAWG Factory',
    settings: {
      ceiling: 0.0,
      hardness: 50,
      harmonics: 60,
      preGain: 0,
      postGain: 0,
      mix: 100,
      mode: 1,
      dcFilter: 1,
      oversample: 2
    }
  },
  {
    id: 'tube-warmth',
    name: 'Tube Warmth',
    category: 'Soft Clipping',
    description: 'Vacuum tube saturation',
    tags: ['tube', 'warmth', 'analog'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -1.0,
      hardness: 40,
      harmonics: 80,
      preGain: 3,
      postGain: -1,
      mix: 100,
      mode: 2,
      dcFilter: 1,
      oversample: 4
    }
  },
  {
    id: 'diode-clip',
    name: 'Diode Clip',
    category: 'Soft Clipping',
    description: 'Transistor/diode clipping character',
    tags: ['diode', 'transistor', 'warm'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -0.5,
      hardness: 60,
      harmonics: 70,
      preGain: 2,
      postGain: 0,
      mix: 100,
      mode: 3,
      dcFilter: 1,
      oversample: 4
    }
  },

  // ============================================================================
  // CREATIVE
  // ============================================================================
  {
    id: 'foldback-crush',
    name: 'Foldback Crush',
    category: 'Creative',
    description: 'Wave folding distortion',
    tags: ['foldback', 'creative', 'distortion'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -3.0,
      hardness: 100,
      harmonics: 80,
      preGain: 8,
      postGain: -4,
      mix: 100,
      mode: 4,
      dcFilter: 1,
      oversample: 4
    }
  },
  {
    id: 'bitcrush-lo-fi',
    name: 'Bitcrush Lo-Fi',
    category: 'Creative',
    description: 'Digital lo-fi crushing',
    tags: ['bitcrush', 'lo-fi', 'digital'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -1.0,
      hardness: 70,
      harmonics: 60,
      preGain: 4,
      postGain: -2,
      mix: 80,
      mode: 5,
      dcFilter: 1,
      oversample: 2
    }
  },
  {
    id: 'extreme-distortion',
    name: 'Extreme Distortion',
    category: 'Creative',
    description: 'Maximum distortion and harmonics',
    tags: ['extreme', 'distortion', 'aggressive'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -5.0,
      hardness: 100,
      harmonics: 100,
      preGain: 12,
      postGain: -6,
      mix: 100,
      mode: 4,
      dcFilter: 1,
      oversample: 8
    }
  },

  // ============================================================================
  // SUBTLE ENHANCEMENT
  // ============================================================================
  {
    id: 'gentle-harmonics',
    name: 'Gentle Harmonics',
    category: 'Subtle Enhancement',
    description: 'Subtle harmonic enhancement',
    tags: ['subtle', 'gentle', 'enhancement'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -1.0,
      hardness: 30,
      harmonics: 40,
      preGain: 0,
      postGain: 0,
      mix: 50,
      mode: 2,
      dcFilter: 1,
      oversample: 4
    }
  },
  {
    id: 'smooth-punch',
    name: 'Smooth Punch',
    category: 'Subtle Enhancement',
    description: 'Add punch without harshness',
    tags: ['punch', 'smooth', 'gentle'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -0.5,
      hardness: 50,
      harmonics: 50,
      preGain: 2,
      postGain: -1,
      mix: 70,
      mode: 1,
      dcFilter: 1,
      oversample: 4
    }
  }
];

