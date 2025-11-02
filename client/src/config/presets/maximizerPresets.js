/**
 * MAXIMIZER PRESETS v2.0
 *
 * Professional loudness maximizer presets
 * Categories: Mastering, Streaming, Creative
 */

export const maximizerPresets = [
  // ============================================================================
  // MASTERING
  // ============================================================================
  {
    id: 'gentle-loudness',
    name: 'Gentle Loudness',
    category: 'Mastering',
    description: 'Subtle loudness boost for mastering',
    tags: ['gentle', 'mastering', 'subtle'],
    author: 'DAWG Factory',
    settings: {
      inputGain: 2,
      saturation: 0.2,
      ceiling: -0.3,
      release: 0.2,
      wet: 1.0,
      lookahead: 3,
      truePeak: 1
    }
  },
  {
    id: 'moderate-master',
    name: 'Moderate Master',
    category: 'Mastering',
    description: 'Balanced loudness for modern masters',
    tags: ['moderate', 'balanced', 'mastering'],
    author: 'DAWG Factory',
    settings: {
      inputGain: 3,
      saturation: 0.3,
      ceiling: -0.1,
      release: 0.1,
      wet: 1.0,
      lookahead: 3,
      truePeak: 1
    }
  },
  {
    id: 'transparent-master',
    name: 'Transparent Master',
    category: 'Mastering',
    description: 'Clean mastering maximization',
    tags: ['transparent', 'clean', 'mastering'],
    author: 'DAWG Factory',
    settings: {
      inputGain: 2,
      saturation: 0.1,
      ceiling: -0.5,
      release: 0.2,
      wet: 1.0,
      lookahead: 5,
      truePeak: 1
    }
  },
  {
    id: 'warm-glue',
    name: 'Warm Glue',
    category: 'Mastering',
    description: 'Analog-style saturation and compression',
    tags: ['warm', 'analog', 'glue'],
    author: 'DAWG Factory',
    settings: {
      inputGain: 4,
      saturation: 0.6,
      ceiling: -0.2,
      release: 0.15,
      wet: 1.0,
      lookahead: 3,
      truePeak: 1
    }
  },
  {
    id: 'cd-master',
    name: 'CD Master',
    category: 'Mastering',
    description: 'Traditional CD mastering',
    tags: ['cd', 'traditional', 'mastering'],
    author: 'DAWG Factory',
    settings: {
      inputGain: 5,
      saturation: 0.4,
      ceiling: -0.3,
      release: 0.12,
      wet: 1.0,
      lookahead: 6,
      truePeak: 1
    }
  },

  // ============================================================================
  // STREAMING
  // ============================================================================
  {
    id: 'streaming-optimized',
    name: 'Streaming Optimized',
    category: 'Streaming',
    description: 'Optimized for streaming platforms',
    tags: ['streaming', 'optimized', 'lufs'],
    author: 'DAWG Factory',
    settings: {
      inputGain: 3,
      saturation: 0.2,
      ceiling: -1.0,
      release: 0.18,
      wet: 1.0,
      lookahead: 4,
      truePeak: 1
    }
  },
  {
    id: 'spotify-ready',
    name: 'Spotify Ready',
    category: 'Streaming',
    description: 'Target -14 LUFS for Spotify',
    tags: ['spotify', 'streaming', 'lufs'],
    author: 'DAWG Factory',
    settings: {
      inputGain: 2.5,
      saturation: 0.25,
      ceiling: -1.0,
      release: 0.2,
      wet: 1.0,
      lookahead: 5,
      truePeak: 1
    }
  },
  {
    id: 'youtube-ready',
    name: 'YouTube Ready',
    category: 'Streaming',
    description: 'Target -13 LUFS for YouTube',
    tags: ['youtube', 'streaming', 'lufs'],
    author: 'DAWG Factory',
    settings: {
      inputGain: 2.8,
      saturation: 0.28,
      ceiling: -0.5,
      release: 0.19,
      wet: 1.0,
      lookahead: 4,
      truePeak: 1
    }
  },

  // ============================================================================
  // CREATIVE
  // ============================================================================
  {
    id: 'aggressive-loud',
    name: 'Aggressive Loud',
    category: 'Creative',
    description: 'Maximum loudness for competitive releases',
    tags: ['aggressive', 'loud', 'competitive'],
    author: 'DAWG Factory',
    settings: {
      inputGain: 6,
      saturation: 0.5,
      ceiling: -0.1,
      release: 0.05,
      wet: 1.0,
      lookahead: 3,
      truePeak: 1
    }
  },
  {
    id: 'brick-wall',
    name: 'Brick Wall',
    category: 'Creative',
    description: 'Hard limiting with saturation',
    tags: ['brick-wall', 'hard', 'limiting'],
    author: 'DAWG Factory',
    settings: {
      inputGain: 8,
      saturation: 0.7,
      ceiling: -0.1,
      release: 0.02,
      wet: 1.0,
      lookahead: 2,
      truePeak: 1
    }
  }
];

