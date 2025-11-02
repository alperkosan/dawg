/**
 * VORTEX PHASER FACTORY PRESETS
 *
 * Professional phaser presets for sweeping modulation effects
 * Organized by category: Vintage, Modern, Extreme, Subtle
 */

export const vortexPhaserPresets = [
  // ===================================
  // VINTAGE
  // ===================================
  {
    id: 'vintage-70s',
    name: 'Vintage 70s',
    description: 'Classic 70s phaser sound for guitar and keys',
    category: 'Vintage',
    tags: ['vintage', '70s', 'classic'],
    author: 'DAWG',
    settings: {
      rate: 0.5,
      depth: 0.6,
      stages: 4,
      feedback: 0.3,
      stereoPhase: 90,
      wet: 0.7
    }
  },
  {
    id: 'small-stone',
    name: 'Small Stone',
    description: 'EHX Small Stone-style warm phaser',
    category: 'Vintage',
    tags: ['ehx', 'stone', 'warm'],
    author: 'DAWG',
    settings: {
      rate: 0.4,
      depth: 0.65,
      stages: 4,
      feedback: 0.35,
      stereoPhase: 90,
      wet: 0.75
    }
  },
  {
    id: 'phase-90',
    name: 'Phase 90',
    description: 'MXR Phase 90 classic sweep',
    category: 'Vintage',
    tags: ['mxr', 'phase90', 'sweep'],
    author: 'DAWG',
    settings: {
      rate: 0.6,
      depth: 0.7,
      stages: 4,
      feedback: 0.25,
      stereoPhase: 90,
      wet: 0.8
    }
  },

  // ===================================
  // MODERN
  // ===================================
  {
    id: 'modern-clean',
    name: 'Modern Clean',
    description: 'Clean and precise modern phaser',
    category: 'Modern',
    tags: ['modern', 'clean', 'precise'],
    author: 'DAWG',
    settings: {
      rate: 1.5,
      depth: 0.8,
      stages: 6,
      feedback: 0.2,
      stereoPhase: 90,
      wet: 0.6
    }
  },
  {
    id: 'studio-polish',
    name: 'Studio Polish',
    description: 'Subtle modern enhancement for studio use',
    category: 'Modern',
    tags: ['studio', 'polish', 'subtle'],
    author: 'DAWG',
    settings: {
      rate: 1.0,
      depth: 0.5,
      stages: 6,
      feedback: 0.15,
      stereoPhase: 90,
      wet: 0.4
    }
  },
  {
    id: 'stereo-wide',
    name: 'Stereo Wide',
    description: 'Wide stereo imaging with phase separation',
    category: 'Modern',
    tags: ['stereo', 'wide', 'imaging'],
    author: 'DAWG',
    settings: {
      rate: 0.8,
      depth: 0.7,
      stages: 6,
      feedback: 0.4,
      stereoPhase: 180,
      wet: 0.75
    }
  },

  // ===================================
  // EXTREME
  // ===================================
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    description: 'Slow, deep underwater-like modulation',
    category: 'Extreme',
    tags: ['deep', 'slow', 'underwater'],
    author: 'DAWG',
    settings: {
      rate: 0.2,
      depth: 0.9,
      stages: 8,
      feedback: 0.5,
      stereoPhase: 90,
      wet: 0.8
    }
  },
  {
    id: 'resonant-scream',
    name: 'Resonant Scream',
    description: 'High feedback for intense resonant sweeps',
    category: 'Extreme',
    tags: ['resonant', 'intense', 'feedback'],
    author: 'DAWG',
    settings: {
      rate: 1.0,
      depth: 0.75,
      stages: 8,
      feedback: 0.75,
      stereoPhase: 90,
      wet: 0.65
    }
  },
  {
    id: 'jet-flanger',
    name: 'Jet Flanger',
    description: 'Fast, flanging-like extreme phaser',
    category: 'Extreme',
    tags: ['flanger', 'jet', 'fast'],
    author: 'DAWG',
    settings: {
      rate: 3.0,
      depth: 0.95,
      stages: 12,
      feedback: 0.8,
      stereoPhase: 90,
      wet: 0.9
    }
  },
  {
    id: 'vortex-spin',
    name: 'Vortex Spin',
    description: 'Swirling, disorienting phase modulation',
    category: 'Extreme',
    tags: ['vortex', 'spin', 'swirl'],
    author: 'DAWG',
    settings: {
      rate: 2.5,
      depth: 0.85,
      stages: 10,
      feedback: 0.7,
      stereoPhase: 180,
      wet: 0.85
    }
  },

  // ===================================
  // SUBTLE
  // ===================================
  {
    id: 'gentle-shimmer',
    name: 'Gentle Shimmer',
    description: 'Subtle movement for gentle enhancement',
    category: 'Subtle',
    tags: ['gentle', 'shimmer', 'subtle'],
    author: 'DAWG',
    settings: {
      rate: 0.3,
      depth: 0.3,
      stages: 4,
      feedback: 0.1,
      stereoPhase: 90,
      wet: 0.4
    }
  },
  {
    id: 'soft-sweep',
    name: 'Soft Sweep',
    description: 'Smooth, unobtrusive phasing',
    category: 'Subtle',
    tags: ['soft', 'smooth', 'unobtrusive'],
    author: 'DAWG',
    settings: {
      rate: 0.4,
      depth: 0.4,
      stages: 4,
      feedback: 0.2,
      stereoPhase: 90,
      wet: 0.5
    }
  },
  {
    id: 'analog-warmth',
    name: 'Analog Warmth',
    description: 'Warm analog character without excessive modulation',
    category: 'Subtle',
    tags: ['analog', 'warm', 'character'],
    author: 'DAWG',
    settings: {
      rate: 0.35,
      depth: 0.45,
      stages: 6,
      feedback: 0.25,
      stereoPhase: 90,
      wet: 0.55
    }
  }
];

export default vortexPhaserPresets;
