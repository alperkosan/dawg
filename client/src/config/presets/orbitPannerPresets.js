/**
 * ORBIT PANNER FACTORY PRESETS
 *
 * Professional auto-panning presets for stereo movement
 * Organized by category: Circular, Pattern, Subtle, Creative
 */

export const orbitPannerPresets = [
  // ===================================
  // CIRCULAR
  // ===================================
  {
    id: 'slow-circle',
    name: 'Slow Circle',
    description: 'Gentle circular orbit for ambient textures',
    category: 'Circular',
    tags: ['circle', 'slow', 'ambient'],
    author: 'DAWG',
    settings: {
      rate: 0.5,
      depth: 0.8,
      shape: 0,
      stereoWidth: 1.0,
      wet: 1.0
    }
  },
  {
    id: 'fast-rotation',
    name: 'Fast Rotation',
    description: 'Quick circular movement for rhythmic elements',
    category: 'Circular',
    tags: ['circle', 'fast', 'rhythmic'],
    author: 'DAWG',
    settings: {
      rate: 2.0,
      depth: 0.8,
      shape: 0,
      stereoWidth: 1.0,
      wet: 1.0
    }
  },
  {
    id: 'wide-orbit',
    name: 'Wide Orbit',
    description: 'Expanded stereo field with circular motion',
    category: 'Circular',
    tags: ['circle', 'wide', 'stereo'],
    author: 'DAWG',
    settings: {
      rate: 1.0,
      depth: 0.9,
      shape: 0,
      stereoWidth: 1.5,
      wet: 1.0
    }
  },

  // ===================================
  // PATTERN
  // ===================================
  {
    id: 'figure-8',
    name: 'Figure-8',
    description: 'Complex figure-8 stereo pattern',
    category: 'Pattern',
    tags: ['figure8', 'complex', 'pattern'],
    author: 'DAWG',
    settings: {
      rate: 1.5,
      depth: 0.9,
      shape: 0.33,
      stereoWidth: 1.5,
      wet: 1.0
    }
  },
  {
    id: 'ping-pong',
    name: 'Ping-Pong',
    description: 'Classic hard L-R ping-pong',
    category: 'Pattern',
    tags: ['pingpong', 'lr', 'classic'],
    author: 'DAWG',
    settings: {
      rate: 1.0,
      depth: 1.0,
      shape: 0.5,
      stereoWidth: 1.0,
      wet: 1.0
    }
  },
  {
    id: 'triangle-sweep',
    name: 'Triangle Sweep',
    description: 'Linear triangle wave panning',
    category: 'Pattern',
    tags: ['triangle', 'sweep', 'linear'],
    author: 'DAWG',
    settings: {
      rate: 0.8,
      depth: 0.75,
      shape: 0.5,
      stereoWidth: 1.0,
      wet: 1.0
    }
  },

  // ===================================
  // SUBTLE
  // ===================================
  {
    id: 'gentle-drift',
    name: 'Gentle Drift',
    description: 'Subtle stereo movement for background elements',
    category: 'Subtle',
    tags: ['gentle', 'subtle', 'drift'],
    author: 'DAWG',
    settings: {
      rate: 0.3,
      depth: 0.4,
      shape: 0,
      stereoWidth: 0.8,
      wet: 0.6
    }
  },
  {
    id: 'slight-sway',
    name: 'Slight Sway',
    description: 'Minimal panning for gentle width',
    category: 'Subtle',
    tags: ['slight', 'sway', 'minimal'],
    author: 'DAWG',
    settings: {
      rate: 0.4,
      depth: 0.3,
      shape: 0,
      stereoWidth: 0.7,
      wet: 0.5
    }
  },

  // ===================================
  // CREATIVE
  // ===================================
  {
    id: 'random-walk',
    name: 'Random Walk',
    description: 'Unpredictable stereo movement',
    category: 'Creative',
    tags: ['random', 'unpredictable', 'creative'],
    author: 'DAWG',
    settings: {
      rate: 0.6,
      depth: 0.8,
      shape: 0.8,
      stereoWidth: 1.2,
      wet: 0.9
    }
  },
  {
    id: 'extreme-motion',
    name: 'Extreme Motion',
    description: 'Fast, wide stereo chaos',
    category: 'Creative',
    tags: ['extreme', 'fast', 'chaos'],
    author: 'DAWG',
    settings: {
      rate: 4.0,
      depth: 1.0,
      shape: 0.7,
      stereoWidth: 2.0,
      wet: 1.0
    }
  },
  {
    id: 'lazy-circle',
    name: 'Lazy Circle',
    description: 'Very slow, hypnotic circular motion',
    category: 'Creative',
    tags: ['slow', 'hypnotic', 'circle'],
    author: 'DAWG',
    settings: {
      rate: 0.15,
      depth: 0.95,
      shape: 0,
      stereoWidth: 1.3,
      wet: 1.0
    }
  }
];

export default orbitPannerPresets;
