/**
 * SATURATOR MODE PRESETS
 *
 * Mode-based design: Her mode, belirli bir kullanım senaryosu için
 * optimize edilmiş parametre kombinasyonudur.
 */

export const SATURATOR_MODES = {
  'vocal-warmth': {
    id: 'vocal-warmth',
    name: 'Vocal Warmth',
    icon: '🎤',
    color: 'amber',
    description: 'Adds warm harmonics to vocals',
    category: 'musical',

    // Base parameters (at 50% amount)
    baseParams: {
      saturationMode: 'toasty',
      frequencyMode: 'wide',
      lowCutFreq: 80,
      highCutFreq: 20000,
      tone: 2,
      autoGain: 1,
      headroom: 0
    },

    // Parameter curves (how they scale with amount 0-100%)
    curves: {
      distortion: { min: 0, max: 0.6, curve: 'linear' },
      tone: { min: 0, max: 4, curve: 'linear' },
      wet: { min: 0, max: 0.8, curve: 'linear' }
    }
  },

  'bass-power': {
    id: 'bass-power',
    name: 'Bass Power',
    icon: '🔊',
    color: 'red',
    description: 'Enhances low-end presence and weight',
    category: 'aggressive',

    baseParams: {
      saturationMode: 'distress',
      frequencyMode: 'transformer',
      lowCutFreq: 0,
      highCutFreq: 8000,
      tone: -3,
      autoGain: 1,
      headroom: 3
    },

    curves: {
      distortion: { min: 0, max: 0.9, curve: 'exponential' },
      tone: { min: 0, max: -6, curve: 'linear' },
      wet: { min: 0, max: 1, curve: 'linear' }
    }
  },

  'tape-saturation': {
    id: 'tape-saturation',
    name: 'Tape Warmth',
    icon: '📼',
    color: 'orange',
    description: 'Classic analog tape saturation',
    category: 'vintage',

    baseParams: {
      saturationMode: 'toasty',
      frequencyMode: 'tape',
      lowCutFreq: 40,
      highCutFreq: 18000,
      tone: 1,
      autoGain: 1,
      headroom: -2
    },

    curves: {
      distortion: { min: 0, max: 0.5, curve: 'linear' },
      tone: { min: 0, max: 3, curve: 'linear' },
      wet: { min: 0, max: 0.7, curve: 'linear' }
    }
  },

  'drum-punch': {
    id: 'drum-punch',
    name: 'Drum Punch',
    icon: '🥁',
    color: 'yellow',
    description: 'Adds punch and presence to drums',
    category: 'aggressive',

    baseParams: {
      saturationMode: 'crunchy',
      frequencyMode: 'wide',
      lowCutFreq: 50,
      highCutFreq: 16000,
      tone: 3,
      autoGain: 1,
      headroom: 2
    },

    curves: {
      distortion: { min: 0, max: 0.8, curve: 'linear' },
      tone: { min: 0, max: 6, curve: 'linear' },
      wet: { min: 0, max: 0.9, curve: 'linear' }
    }
  },

  'gentle-glue': {
    id: 'gentle-glue',
    name: 'Gentle Glue',
    icon: '✨',
    color: 'cyan',
    description: 'Subtle harmonics for mix cohesion',
    category: 'subtle',

    baseParams: {
      saturationMode: 'toasty',
      frequencyMode: 'wide',
      lowCutFreq: 30,
      highCutFreq: 20000,
      tone: 0,
      autoGain: 1,
      headroom: -3
    },

    curves: {
      distortion: { min: 0, max: 0.3, curve: 'logarithmic' },
      tone: { min: 0, max: 1, curve: 'linear' },
      wet: { min: 0, max: 0.5, curve: 'linear' }
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
