/**
 * LIMITER PRESETS v2.0
 *
 * Professional mastering-grade limiter presets
 * Categories: Mastering, Mixing, Creative, Streaming
 */

export const limiterPresets = [
  // ============================================================================
  // MASTERING
  // ============================================================================
  {
    id: 'transparent-master',
    name: 'Transparent Master',
    category: 'Mastering',
    description: 'Pristine transparent limiting for mastering',
    tags: ['mastering', 'transparent', 'pristine'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -0.1,
      release: 500,
      attack: 0.1,
      lookahead: 10,
      knee: 0.3,
      stereoLink: 100,
      autoGain: 0,
      mode: 0,
      truePeak: 1,
      oversample: 4
    }
  },
  {
    id: 'warm-master',
    name: 'Warm Master',
    category: 'Mastering',
    description: 'Musical limiting with soft knee',
    tags: ['mastering', 'warm', 'musical'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -0.2,
      release: 300,
      attack: 0.2,
      lookahead: 8,
      knee: 0.5,
      stereoLink: 100,
      autoGain: 0,
      mode: 4,
      truePeak: 1,
      oversample: 4
    }
  },
  {
    id: 'loud-master',
    name: 'Loud Master',
    category: 'Mastering',
    description: 'Maximum loudness for competitive masters',
    tags: ['mastering', 'loud', 'competitive'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -0.1,
      release: 50,
      attack: 0.01,
      lookahead: 2,
      knee: 0,
      stereoLink: 100,
      autoGain: 1,
      mode: 2,
      truePeak: 1,
      oversample: 4
    }
  },

  // ============================================================================
  // MIXING
  // ============================================================================
  {
    id: 'punchy-drums',
    name: 'Punchy Drums',
    category: 'Mixing',
    description: 'Fast limiting that preserves punch',
    tags: ['mixing', 'drums', 'punch', 'fast'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -0.5,
      release: 100,
      attack: 1.0,
      lookahead: 5,
      knee: 0,
      stereoLink: 100,
      autoGain: 0,
      mode: 1,
      truePeak: 1,
      oversample: 2
    }
  },
  {
    id: 'bass-limit',
    name: 'Bass Limit',
    category: 'Mixing',
    description: 'Controlled bass limiting',
    tags: ['mixing', 'bass', 'control'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -1.0,
      release: 200,
      attack: 0.5,
      lookahead: 8,
      knee: 0.2,
      stereoLink: 100,
      autoGain: 0,
      mode: 0,
      truePeak: 1,
      oversample: 2
    }
  },
  {
    id: 'vocal-safe',
    name: 'Vocal Safe',
    category: 'Mixing',
    description: 'Gentle limiting for vocals',
    tags: ['mixing', 'vocal', 'gentle'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -0.3,
      release: 400,
      attack: 0.3,
      lookahead: 10,
      knee: 0.4,
      stereoLink: 100,
      autoGain: 0,
      mode: 0,
      truePeak: 1,
      oversample: 4
    }
  },

  // ============================================================================
  // CREATIVE
  // ============================================================================
  {
    id: 'aggressive-loud',
    name: 'Aggressive Loud',
    category: 'Creative',
    description: 'Maximum loudness with auto gain',
    tags: ['creative', 'aggressive', 'loud', 'auto'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -0.1,
      release: 50,
      attack: 0.01,
      lookahead: 2,
      knee: 0,
      stereoLink: 100,
      autoGain: 1,
      mode: 2,
      truePeak: 1,
      oversample: 4
    }
  },
  {
    id: 'crush-limit',
    name: 'Crush Limit',
    category: 'Creative',
    description: 'Heavy limiting for creative effect',
    tags: ['creative', 'crush', 'heavy'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -0.5,
      release: 10,
      attack: 0.01,
      lookahead: 0,
      knee: 0,
      stereoLink: 50,
      autoGain: 1,
      mode: 2,
      truePeak: 0,
      oversample: 2
    }
  },

  // ============================================================================
  // STREAMING
  // ============================================================================
  {
    id: 'stream-safe',
    name: 'Stream Safe',
    category: 'Streaming',
    description: 'Optimized for streaming platforms',
    tags: ['streaming', 'safe', 'optimized'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -1.0,
      release: 200,
      attack: 0.1,
      lookahead: 8,
      knee: 0.3,
      stereoLink: 100,
      autoGain: 0,
      mode: 3,
      truePeak: 1,
      oversample: 4
    }
  },
  {
    id: 'spotify-ready',
    name: 'Spotify Ready',
    category: 'Streaming',
    description: 'Target -1.0dBTP for Spotify',
    tags: ['streaming', 'spotify', 'lufs'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -1.0,
      release: 300,
      attack: 0.2,
      lookahead: 10,
      knee: 0.4,
      stereoLink: 100,
      autoGain: 0,
      mode: 3,
      truePeak: 1,
      oversample: 4
    }
  },
  {
    id: 'youtube-ready',
    name: 'YouTube Ready',
    category: 'Streaming',
    description: 'Target -0.5dBTP for YouTube',
    tags: ['streaming', 'youtube', 'lufs'],
    author: 'DAWG Factory',
    settings: {
      ceiling: -0.5,
      release: 250,
      attack: 0.15,
      lookahead: 9,
      knee: 0.35,
      stereoLink: 100,
      autoGain: 0,
      mode: 3,
      truePeak: 1,
      oversample: 4
    }
  }
];

