/**
 * MODERN DELAY FACTORY PRESETS
 *
 * Professional delay presets covering common use cases
 * Based on classic hardware and modern digital delay units
 */

export const delayPresets = [
  {
    id: 'slapback',
    name: 'Slapback',
    category: 'Vintage',
    description: 'Classic rockabilly/50s slapback echo (80-120ms)',
    tags: ['vintage', 'mono', 'short'],
    author: 'DAWG',
    settings: {
      timeLeft: 0.095,        // 95ms - classic slapback range
      timeRight: 0.105,       // 105ms - slight stereo width
      feedbackLeft: 0.15,     // Minimal feedback (single repeat)
      feedbackRight: 0.15,
      pingPong: 0,            // No ping-pong (straight)
      wet: 0.35,              // Balanced mix
      filterFreq: 5000,       // Roll off highs (vintage tape)
      saturation: 0.25,       // Light tape warmth
      diffusion: 0,           // No diffusion (tight)
      width: 1.0              // Normal stereo width
    }
  },

  {
    id: 'pingpong',
    name: 'Ping-Pong',
    category: 'Stereo',
    description: 'Wide stereo bouncing delay with rhythmic motion',
    tags: ['stereo', 'rhythmic', 'creative'],
    author: 'DAWG',
    settings: {
      timeLeft: 0.375,        // Dotted 8th at 120 BPM
      timeRight: 0.5,         // Quarter note at 120 BPM
      feedbackLeft: 0.45,     // Multiple repeats
      feedbackRight: 0.45,
      pingPong: 0.85,         // Heavy cross-feedback (bouncing)
      wet: 0.4,
      filterFreq: 8000,       // Bright (clear bounces)
      saturation: 0,          // Clean digital
      diffusion: 0.15,        // Slight diffusion (smoother tail)
      width: 1.0              // Normal stereo width
    }
  },

  {
    id: 'dub',
    name: 'Dub Echo',
    category: 'Creative',
    description: 'Deep reggae-style delay with heavy feedback and filtering',
    tags: ['dub', 'reggae', 'creative', 'long'],
    author: 'DAWG',
    settings: {
      timeLeft: 0.5,          // Half note at 120 BPM
      timeRight: 0.75,        // Dotted half at 120 BPM
      feedbackLeft: 0.65,     // Heavy feedback (long tail)
      feedbackRight: 0.7,
      pingPong: 0.3,          // Moderate cross-feed
      wet: 0.5,               // Heavy effect mix
      filterFreq: 3500,       // Dark (muddy dub vibe)
      saturation: 0.4,        // Tape saturation (warmth)
      diffusion: 0.25,        // Moderate diffusion (smeared)
      width: 1.0              // Normal stereo width
    }
  },

  {
    id: 'ambient',
    name: 'Ambient',
    category: 'Atmospheric',
    description: 'Lush atmospheric delay with heavy diffusion and long tail',
    tags: ['ambient', 'atmospheric', 'long', 'diffuse'],
    author: 'DAWG',
    settings: {
      timeLeft: 0.8,          // Long delay time
      timeRight: 1.0,         // Even longer right
      feedbackLeft: 0.5,      // Sustained feedback
      feedbackRight: 0.55,
      pingPong: 0.2,          // Light cross-feed (subtle movement)
      wet: 0.45,
      filterFreq: 6000,       // Slightly rolled off
      saturation: 0.1,        // Very light warmth
      diffusion: 0.7,         // Heavy diffusion (washy, reverb-like)
      width: 1.0              // Normal stereo width
    }
  },

  {
    id: 'tape',
    name: 'Tape Echo',
    category: 'Vintage',
    description: 'Warm analog tape echo with flutter and saturation',
    tags: ['vintage', 'analog', 'warm', 'tape'],
    author: 'DAWG',
    settings: {
      timeLeft: 0.3,          // Medium delay
      timeRight: 0.35,        // Slight stereo offset
      feedbackLeft: 0.55,     // Multiple repeats (degrading)
      feedbackRight: 0.5,
      pingPong: 0.1,          // Minimal cross-feed
      wet: 0.4,
      filterFreq: 4500,       // Dark (vintage tape)
      saturation: 0.5,        // Heavy tape saturation (warmth + grit)
      diffusion: 0.2,         // Light diffusion (tape smear)
      width: 1.0              // Normal stereo width
    }
  },

  {
    id: 'custom',
    name: 'Custom',
    category: 'Default',
    description: 'Neutral starting point for custom delay settings',
    tags: ['default', 'init'],
    author: 'DAWG',
    settings: {
      timeLeft: 0.375,        // Default values
      timeRight: 0.5,
      feedbackLeft: 0.4,
      feedbackRight: 0.4,
      pingPong: 0,
      wet: 0.35,
      filterFreq: 8000,
      saturation: 0,
      diffusion: 0,
      width: 1.0
    }
  }
];

/**
 * Get preset by ID
 */
export function getDelayPreset(id) {
  return delayPresets.find(p => p.id === id);
}

/**
 * Get all presets for a category
 */
export function getDelayPresetsByCategory(category) {
  return delayPresets.filter(p => p.category === category);
}

/**
 * Get all preset names for UI dropdown
 */
export function getDelayPresetNames() {
  return delayPresets.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category
  }));
}
