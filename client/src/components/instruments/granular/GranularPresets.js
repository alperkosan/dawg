/**
 * GranularPresets - Factory presets for Granular Sampler
 *
 * Inspired by Solstice VST and granular synthesis best practices
 */

export const GRANULAR_PRESETS = [
  {
    id: 'default',
    name: 'Default',
    category: 'Init',
    description: 'Balanced starting point for granular synthesis',
    params: {
      grainSize: 80,
      grainDensity: 25,
      samplePosition: 0.5,
      positionRandom: 0.15,
      pitch: 0,
      pitchRandom: 2,
      grainEnvelope: 'hann',
      reverse: 0.1,
      spread: 0.7,
      mix: 1.0,
      gain: 0.8
    }
  },

  {
    id: 'ambient-clouds',
    name: 'Ambient Clouds',
    category: 'Atmospheric',
    description: 'Lush, slowly evolving atmospheric textures',
    params: {
      grainSize: 120,
      grainDensity: 15,
      samplePosition: 0.3,
      positionRandom: 0.25,
      pitch: 0,
      pitchRandom: 3,
      grainEnvelope: 'hann',
      reverse: 0.2,
      spread: 0.9,
      mix: 1.0,
      gain: 0.75
    }
  },

  {
    id: 'glitch-stutter',
    name: 'Glitch Stutter',
    category: 'Creative',
    description: 'Chaotic, rhythmic glitch textures',
    params: {
      grainSize: 20,
      grainDensity: 60,
      samplePosition: 0.5,
      positionRandom: 0.4,
      pitch: 0,
      pitchRandom: 12,
      grainEnvelope: 'triangle',
      reverse: 0.5,
      spread: 0.5,
      mix: 1.0,
      gain: 0.7
    }
  },

  {
    id: 'freeze',
    name: 'Freeze',
    category: 'Utility',
    description: 'Frozen moment - sustain a single point in time',
    params: {
      grainSize: 100,
      grainDensity: 30,
      samplePosition: 0.5,
      positionRandom: 0.05,
      pitch: 0,
      pitchRandom: 0,
      grainEnvelope: 'hann',
      reverse: 0,
      spread: 0.3,
      mix: 1.0,
      gain: 0.85
    }
  },

  {
    id: 'reverse-shimmer',
    name: 'Reverse Shimmer',
    category: 'Creative',
    description: 'Shimmering reversed textures with pitch variation',
    params: {
      grainSize: 80,
      grainDensity: 25,
      samplePosition: 0.7,
      positionRandom: 0.3,
      pitch: 12,
      pitchRandom: 7,
      grainEnvelope: 'gaussian',
      reverse: 0.9,
      spread: 1.0,
      mix: 0.8,
      gain: 0.75
    }
  },

  {
    id: 'dense-pad',
    name: 'Dense Pad',
    category: 'Atmospheric',
    description: 'Thick, lush pad texture with high grain density',
    params: {
      grainSize: 60,
      grainDensity: 45,
      samplePosition: 0.4,
      positionRandom: 0.2,
      pitch: 0,
      pitchRandom: 1,
      grainEnvelope: 'hann',
      reverse: 0.15,
      spread: 0.8,
      mix: 1.0,
      gain: 0.7
    }
  },

  {
    id: 'micro-rhythm',
    name: 'Micro Rhythm',
    category: 'Rhythmic',
    description: 'Percussive micro-rhythmic patterns',
    params: {
      grainSize: 15,
      grainDensity: 35,
      samplePosition: 0.6,
      positionRandom: 0.1,
      pitch: 0,
      pitchRandom: 0,
      grainEnvelope: 'triangle',
      reverse: 0,
      spread: 0.4,
      mix: 1.0,
      gain: 0.85
    }
  },

  {
    id: 'drift',
    name: 'Drift',
    category: 'Atmospheric',
    description: 'Slowly drifting, evolving soundscape',
    params: {
      grainSize: 150,
      grainDensity: 12,
      samplePosition: 0.35,
      positionRandom: 0.35,
      pitch: -7,
      pitchRandom: 5,
      grainEnvelope: 'gaussian',
      reverse: 0.25,
      spread: 0.95,
      mix: 1.0,
      gain: 0.75
    }
  },

  {
    id: 'granular-delay',
    name: 'Granular Delay',
    category: 'Creative',
    description: 'Echo-like granular effect with moderate density',
    params: {
      grainSize: 90,
      grainDensity: 18,
      samplePosition: 0.5,
      positionRandom: 0.08,
      pitch: 0,
      pitchRandom: 0.5,
      grainEnvelope: 'hann',
      reverse: 0.05,
      spread: 0.6,
      mix: 0.7,
      gain: 0.8
    }
  },

  {
    id: 'pitch-shimmer',
    name: 'Pitch Shimmer',
    category: 'Creative',
    description: 'High-pitched shimmering harmonics',
    params: {
      grainSize: 70,
      grainDensity: 28,
      samplePosition: 0.2,
      positionRandom: 0.15,
      pitch: 19,
      pitchRandom: 8,
      grainEnvelope: 'gaussian',
      reverse: 0.3,
      spread: 0.85,
      mix: 1.0,
      gain: 0.65
    }
  },

  {
    id: 'bass-rumble',
    name: 'Bass Rumble',
    category: 'Creative',
    description: 'Deep, rumbling low-frequency texture',
    params: {
      grainSize: 180,
      grainDensity: 22,
      samplePosition: 0.6,
      positionRandom: 0.25,
      pitch: -12,
      pitchRandom: 3,
      grainEnvelope: 'hann',
      reverse: 0.1,
      spread: 0.5,
      mix: 1.0,
      gain: 0.9
    }
  },

  {
    id: 'scanner',
    name: 'Scanner',
    category: 'Creative',
    description: 'Scanning through the sample with movement',
    params: {
      grainSize: 45,
      grainDensity: 40,
      samplePosition: 0.5,
      positionRandom: 0.45,
      pitch: 0,
      pitchRandom: 4,
      grainEnvelope: 'triangle',
      reverse: 0.2,
      spread: 0.7,
      mix: 1.0,
      gain: 0.75
    }
  }
];

/**
 * Get preset by ID
 */
export const getPreset = (presetId) => {
  return GRANULAR_PRESETS.find(p => p.id === presetId) || GRANULAR_PRESETS[0];
};

/**
 * Get presets by category
 */
export const getPresetsByCategory = (category) => {
  return GRANULAR_PRESETS.filter(p => p.category === category);
};

/**
 * Get all categories
 */
export const getCategories = () => {
  return [...new Set(GRANULAR_PRESETS.map(p => p.category))];
};
