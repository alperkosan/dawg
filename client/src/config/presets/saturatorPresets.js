/**
 * SATURATOR MODE PRESETS - REDESIGNED WITH METHODOLOGY
 *
 * 📐 METHODOLOGY:
 * 1. Analog Equipment Reference (Neve, SSL, Tube, Tape)
 * 2. Harmonic Content Analysis (Even/Odd/Mixed harmonics)
 * 3. Frequency-Dependent Saturation (Transformer/Tape/Wide)
 * 4. Genre-Specific Character (Warm/Clean/Aggressive)
 * 5. Usage Scenario (Vocal/Bass/Drum/Master)
 * 6. Parameter Relationships (Drive/Tone/Headroom correlation)
 *
 * 🎯 DESIGN PRINCIPLES:
 * - Harmonic generation: Even harmonics = warmth, Odd = presence
 * - Frequency mode: Transformer (low-end), Tape (mid-range), Wide (full)
 * - Auto-gain: Compensates for harmonic buildup
 * - Headroom: Controls saturation threshold
 * - Tone: Frequency response shaping
 */

export const SATURATOR_MODES = {
  // === VOCAL SATURATION ===
  'vocal-warmth': {
    id: 'vocal-warmth',
    name: 'Vocal Warmth',
    icon: '🎤',
    color: 'amber',
    description: 'Neve-style - Adds warm even harmonics to vocals',
    category: 'musical',
    genre: ['Pop', 'Rock', 'R&B', 'Soul'],
    reference: 'Neve Console',

    baseParams: {
      saturationMode: 'toasty', // Even harmonics for warmth
      frequencyMode: 'wide', // Full spectrum
      lowCutFreq: 80, // Remove rumble
      highCutFreq: 20000,
      tone: 2, // Slight high-end boost
      autoGain: 1, // Compensate for harmonics
      headroom: 0 // Standard headroom
    },

    curves: {
      distortion: { min: 0, max: 0.6, curve: 'linear' },
      tone: { min: 0, max: 4, curve: 'linear' },
      wet: { min: 0, max: 0.8, curve: 'linear' }
    }
  },

  'vocal-presence': {
    id: 'vocal-presence',
    name: 'Vocal Presence',
    icon: '🎤',
    color: 'blue',
    description: 'SSL-style - Adds presence and clarity to vocals',
    category: 'musical',
    genre: ['Pop', 'Electronic', 'Hip-Hop'],
    reference: 'SSL Console',

    baseParams: {
      saturationMode: 'crunchy', // Mixed harmonics for presence
      frequencyMode: 'wide',
      lowCutFreq: 100,
      highCutFreq: 18000,
      tone: 3, // More high-end presence
      autoGain: 1,
      headroom: 2 // More headroom for cleaner sound
    },

    curves: {
      distortion: { min: 0, max: 0.7, curve: 'linear' },
      tone: { min: 1, max: 5, curve: 'linear' },
      wet: { min: 0, max: 0.9, curve: 'linear' }
    }
  },

  // === BASS SATURATION ===
  'bass-power': {
    id: 'bass-power',
    name: 'Bass Power',
    icon: '🔊',
    color: 'red',
    description: 'Transformer-style - Enhances low-end presence and weight',
    category: 'aggressive',
    genre: ['EDM', 'Hip-Hop', 'Rock'],
    reference: 'Transformer Saturation',

    baseParams: {
      saturationMode: 'distress', // Aggressive harmonics
      frequencyMode: 'transformer', // Low-end focus
      lowCutFreq: 0, // Full low-end
      highCutFreq: 8000, // Remove high-end harshness
      tone: -3, // Slight low-end boost
      autoGain: 1,
      headroom: 3 // More headroom for bass power
    },

    curves: {
      distortion: { min: 0, max: 0.9, curve: 'exponential' },
      tone: { min: 0, max: -6, curve: 'linear' },
      wet: { min: 0, max: 1, curve: 'linear' }
    }
  },

  'bass-warmth': {
    id: 'bass-warmth',
    name: 'Bass Warmth',
    icon: '🔥',
    color: 'orange',
    description: 'Tube-style - Warm, musical bass saturation',
    category: 'musical',
    genre: ['Jazz', 'Rock', 'Blues'],
    reference: 'Tube Saturation',

    baseParams: {
      saturationMode: 'toasty', // Even harmonics
      frequencyMode: 'transformer',
      lowCutFreq: 20,
      highCutFreq: 12000,
      tone: -1, // Subtle warmth
      autoGain: 1,
      headroom: 1
    },

    curves: {
      distortion: { min: 0, max: 0.7, curve: 'linear' },
      tone: { min: -2, max: 2, curve: 'linear' },
      wet: { min: 0, max: 0.9, curve: 'linear' }
    }
  },

  // === TAPE SATURATION ===
  'tape-saturation': {
    id: 'tape-saturation',
    name: 'Tape Warmth',
    icon: '📼',
    color: 'orange',
    description: 'Studer A800 style - Classic analog tape saturation',
    category: 'vintage',
    genre: ['All Genres'],
    reference: 'Studer A800',

    baseParams: {
      saturationMode: 'toasty', // Even harmonics (tape characteristic)
      frequencyMode: 'tape', // Mid-range focus
      lowCutFreq: 40, // Tape low-end rolloff
      highCutFreq: 18000, // Tape high-end rolloff
      tone: 1, // Slight warmth
      autoGain: 1,
      headroom: -2 // Less headroom = more saturation
    },

    curves: {
      distortion: { min: 0, max: 0.5, curve: 'linear' },
      tone: { min: 0, max: 3, curve: 'linear' },
      wet: { min: 0, max: 0.7, curve: 'linear' }
    }
  },

  'tape-vintage': {
    id: 'tape-vintage',
    name: 'Vintage Tape',
    icon: '📻',
    color: 'amber',
    description: 'Vintage tape machine character with compression',
    category: 'vintage',
    genre: ['Rock', 'Pop', 'Soul'],
    reference: 'Vintage Tape Machine',

    baseParams: {
      saturationMode: 'toasty',
      frequencyMode: 'tape',
      lowCutFreq: 60, // More low-end rolloff
      highCutFreq: 16000, // More high-end rolloff (vintage)
      tone: 0, // Flat response
      autoGain: 1,
      headroom: -3 // More saturation
    },

    curves: {
      distortion: { min: 0, max: 0.6, curve: 'linear' },
      tone: { min: -1, max: 2, curve: 'linear' },
      wet: { min: 0, max: 0.8, curve: 'linear' }
    }
  },

  // === DRUM SATURATION ===
  'drum-punch': {
    id: 'drum-punch',
    name: 'Drum Punch',
    icon: '🥁',
    color: 'yellow',
    description: 'API-style - Adds punch and presence to drums',
    category: 'aggressive',
    genre: ['EDM', 'Hip-Hop', 'Rock', 'Pop'],
    reference: 'API Console',

    baseParams: {
      saturationMode: 'crunchy', // Mixed harmonics for punch
      frequencyMode: 'wide', // Full spectrum
      lowCutFreq: 50, // Remove sub-bass
      highCutFreq: 16000, // Preserve transients
      tone: 3, // High-end presence
      autoGain: 1,
      headroom: 2 // More headroom for transients
    },

    curves: {
      distortion: { min: 0, max: 0.8, curve: 'linear' },
      tone: { min: 0, max: 6, curve: 'linear' },
      wet: { min: 0, max: 0.9, curve: 'linear' }
    }
  },

  'drum-smasher': {
    id: 'drum-smasher',
    name: 'Drum Smasher',
    icon: '💥',
    color: 'red',
    description: 'Aggressive drum saturation for electronic music',
    category: 'aggressive',
    genre: ['EDM', 'Electronic', 'Hip-Hop'],
    reference: 'Aggressive Saturation',

    baseParams: {
      saturationMode: 'distress', // Aggressive harmonics
      frequencyMode: 'wide',
      lowCutFreq: 80,
      highCutFreq: 18000,
      tone: 4, // Bright, aggressive
      autoGain: 1,
      headroom: 4 // Maximum headroom for aggressive sound
    },

    curves: {
      distortion: { min: 0, max: 1.0, curve: 'exponential' },
      tone: { min: 2, max: 8, curve: 'linear' },
      wet: { min: 0, max: 1, curve: 'linear' }
    }
  },

  // === MASTER SATURATION ===
  'gentle-glue': {
    id: 'gentle-glue',
    name: 'Gentle Glue',
    icon: '✨',
    color: 'cyan',
    description: 'Console-style - Subtle harmonics for mix cohesion',
    category: 'subtle',
    genre: ['All Genres'],
    reference: 'Console Saturation',

    baseParams: {
      saturationMode: 'toasty', // Even harmonics
      frequencyMode: 'wide', // Full spectrum
      lowCutFreq: 30, // Minimal filtering
      highCutFreq: 20000, // Full bandwidth
      tone: 0, // Flat response
      autoGain: 1,
      headroom: -3 // Less headroom = subtle saturation
    },

    curves: {
      distortion: { min: 0, max: 0.3, curve: 'logarithmic' },
      tone: { min: 0, max: 1, curve: 'linear' },
      wet: { min: 0, max: 0.5, curve: 'linear' }
    }
  },

  'master-warmth': {
    id: 'master-warmth',
    name: 'Master Warmth',
    icon: '🔥',
    color: 'amber',
    description: 'Neve-style - Warm mastering saturation',
    category: 'musical',
    genre: ['All Genres'],
    reference: 'Neve Mastering',

    baseParams: {
      saturationMode: 'toasty',
      frequencyMode: 'wide',
      lowCutFreq: 20,
      highCutFreq: 20000,
      tone: 1, // Slight warmth
      autoGain: 1,
      headroom: -2
    },

    curves: {
      distortion: { min: 0, max: 0.4, curve: 'logarithmic' },
      tone: { min: -1, max: 2, curve: 'linear' },
      wet: { min: 0, max: 0.6, curve: 'linear' }
    }
  },

  'aggressive-grit': {
    id: 'aggressive-grit',
    name: 'Aggressive Grit',
    icon: '⚡',
    color: 'red',
    description: 'Heavy distortion and character',
    category: 'aggressive',

    baseParams: {
      saturationMode: 'crunchy',
      frequencyMode: 'wide',
      lowCutFreq: 100,
      highCutFreq: 20000,
      tone: 4,
      autoGain: 1,
      headroom: 4
    },

    curves: {
      distortion: { min: 0, max: 1.2, curve: 'exponential' },
      tone: { min: 0, max: 8, curve: 'linear' },
      wet: { min: 0, max: 1, curve: 'linear' }
    }
  },

  'lo-fi-crush': {
    id: 'lo-fi-crush',
    name: 'Lo-Fi Crush',
    icon: '📻',
    color: 'purple',
    description: 'Vintage lo-fi character',
    category: 'vintage',

    baseParams: {
      saturationMode: 'distress',
      frequencyMode: 'tape',
      lowCutFreq: 200,
      highCutFreq: 6000,
      tone: -2,
      autoGain: 1,
      headroom: 0
    },

    curves: {
      distortion: { min: 0, max: 1.0, curve: 'linear' },
      tone: { min: 0, max: -4, curve: 'linear' },
      wet: { min: 0, max: 0.8, curve: 'linear' }
    }
  },

  'analog-heat': {
    id: 'analog-heat',
    name: 'Analog Heat',
    icon: '🔥',
    color: 'orange',
    description: 'Warm analog console saturation',
    category: 'vintage',

    baseParams: {
      saturationMode: 'toasty',
      frequencyMode: 'transformer',
      lowCutFreq: 20,
      highCutFreq: 20000,
      tone: -1,
      autoGain: 1,
      headroom: 0
    },

    curves: {
      distortion: { min: 0, max: 0.7, curve: 'linear' },
      tone: { min: 0, max: 2, curve: 'linear' },
      wet: { min: 0, max: 0.9, curve: 'linear' }
    }
  },

  'custom': {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    color: 'gray',
    description: 'Manual control',
    category: 'custom',

    baseParams: {
      saturationMode: 'toasty',
      frequencyMode: 'wide',
      lowCutFreq: 20,
      highCutFreq: 20000,
      tone: 0,
      autoGain: 1,
      headroom: 0
    },

    curves: {
      distortion: { min: 0.4, max: 0.4, curve: 'linear' },
      tone: { min: 0, max: 0, curve: 'linear' },
      wet: { min: 1.0, max: 1.0, curve: 'linear' }
    }
  }
};

/**
 * Calculate parameter value based on amount and curve
 */
export function calculateParamValue(curve, amount) {
  // amount: 0-100
  const normalized = amount / 100;

  switch (curve.curve) {
    case 'linear':
      return curve.min + (curve.max - curve.min) * normalized;

    case 'exponential':
      return curve.min + (curve.max - curve.min) * Math.pow(normalized, 2);

    case 'logarithmic':
      return curve.min + (curve.max - curve.min) * Math.sqrt(normalized);

    default:
      return curve.min + (curve.max - curve.min) * normalized;
  }
}

/**
 * Get all parameters for a mode at specific amount
 */
export function getModeParameters(modeId, amount) {
  const mode = SATURATOR_MODES[modeId];
  if (!mode) return null;

  const params = { ...mode.baseParams };

  // Apply curves
  Object.entries(mode.curves).forEach(([paramName, curve]) => {
    params[paramName] = calculateParamValue(curve, amount);
  });

  return params;
}

/**
 * Get modes by category
 */
export function getModesByCategory(category) {
  return Object.values(SATURATOR_MODES).filter(
    mode => mode.category === category
  );
}

export const MODE_CATEGORIES = {
  musical: { name: 'Musical', color: 'amber' },
  aggressive: { name: 'Aggressive', color: 'red' },
  vintage: { name: 'Vintage', color: 'orange' },
  subtle: { name: 'Subtle', color: 'cyan' }
};

/**
 * Export presets as array for PresetManager (PluginContainerV2)
 */
export const saturatorPresets = Object.values(SATURATOR_MODES).map(mode => ({
  id: mode.id,
  name: mode.name,
  category: MODE_CATEGORIES[mode.category]?.name || mode.category,
  description: mode.description,
  tags: mode.genre || [],
  author: 'DAWG',
  settings: mode.baseParams
}));
