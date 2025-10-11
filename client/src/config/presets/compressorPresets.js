/**
 * COMPRESSOR PRESET MODES
 *
 * Function-focused presets for dynamic range control
 */

export const COMPRESSOR_MODES = {
  'vocal-control': {
    id: 'vocal-control',
    name: 'Vocal Control',
    icon: '🎤',
    color: 'blue',
    description: 'Smooth, transparent vocal compression',
    category: 'musical',

    baseParams: {
      threshold: -18,
      ratio: 3,
      attack: 0.005,
      release: 0.2,
      knee: 15,
      autoMakeup: true
    },

    curves: {
      threshold: { min: -24, max: -12, curve: 'linear' },
      ratio: { min: 2, max: 4, curve: 'linear' },
      wet: { min: 0.7, max: 1.0, curve: 'linear' }
    }
  },

  'drum-punch': {
    id: 'drum-punch',
    name: 'Drum Punch',
    icon: '🥁',
    color: 'red',
    description: 'Fast attack for transient control',
    category: 'aggressive',

    baseParams: {
      threshold: -12,
      ratio: 4,
      attack: 0.001,
      release: 0.15,
      knee: 3,
      autoMakeup: true
    },

    curves: {
      threshold: { min: -18, max: -6, curve: 'linear' },
      ratio: { min: 3, max: 6, curve: 'linear' },
      wet: { min: 0.8, max: 1.0, curve: 'linear' }
    }
  },

  'mix-glue': {
    id: 'mix-glue',
    name: 'Mix Glue',
    icon: '🎚️',
    color: 'purple',
    description: 'Gentle bus compression for cohesion',
    category: 'musical',

    baseParams: {
      threshold: -24,
      ratio: 2,
      attack: 0.03,
      release: 0.4,
      knee: 12,
      autoMakeup: false
    },

    curves: {
      threshold: { min: -30, max: -18, curve: 'linear' },
      ratio: { min: 1.5, max: 3, curve: 'linear' },
      wet: { min: 0.5, max: 0.9, curve: 'linear' }
    }
  },

  'peak-limiter': {
    id: 'peak-limiter',
    name: 'Peak Limiter',
    icon: '🛡️',
    color: 'orange',
    description: 'Brick wall limiting for safety',
    category: 'aggressive',

    baseParams: {
      threshold: -6,
      ratio: 10,
      attack: 0.0001,
      release: 0.05,
      knee: 0,
      autoMakeup: false
    },

    curves: {
      threshold: { min: -12, max: -3, curve: 'linear' },
      ratio: { min: 8, max: 20, curve: 'exponential' },
      wet: { min: 0.9, max: 1.0, curve: 'linear' }
    }
  },

  'parallel-magic': {
    id: 'parallel-magic',
    name: 'Parallel Magic',
    icon: '✨',
    color: 'cyan',
    description: 'Heavy compression with blend',
    category: 'creative',

    baseParams: {
      threshold: -20,
      ratio: 8,
      attack: 0.005,
      release: 0.1,
      knee: 6,
      autoMakeup: true
    },

    curves: {
      threshold: { min: -30, max: -10, curve: 'linear' },
      ratio: { min: 6, max: 12, curve: 'linear' },
      wet: { min: 0.2, max: 0.6, curve: 'linear' } // Parallel blend
    }
  },

  'bass-tightener': {
    id: 'bass-tightener',
    name: 'Bass Tightener',
    icon: '🔊',
    color: 'green',
    description: 'Controlled low-end dynamics',
    category: 'musical',

    baseParams: {
      threshold: -15,
      ratio: 5,
      attack: 0.01,
      release: 0.25,
      knee: 8,
      autoMakeup: true
    },

    curves: {
      threshold: { min: -21, max: -9, curve: 'linear' },
      ratio: { min: 4, max: 7, curve: 'linear' },
      wet: { min: 0.7, max: 1.0, curve: 'linear' }
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
      threshold: -24,
      ratio: 4,
      attack: 0.01,
      release: 0.1,
      knee: 12,
      autoMakeup: true
    },

    curves: {
      threshold: { min: -24, max: -24, curve: 'linear' },
      ratio: { min: 4, max: 4, curve: 'linear' },
      wet: { min: 1.0, max: 1.0, curve: 'linear' }
    }
  }
};

/**
 * Calculate parameter value based on amount and curve
 */
export function calculateCompressorParamValue(curve, amount) {
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
export function getCompressorModeParameters(modeId, amount) {
  const mode = COMPRESSOR_MODES[modeId];
  if (!mode) return null;

  const params = { ...mode.baseParams };

  // Apply curves
  Object.entries(mode.curves).forEach(([paramName, curve]) => {
    params[paramName] = calculateCompressorParamValue(curve, amount);
  });

  return params;
}

/**
 * Get modes by category
 */
export function getCompressorModesByCategory(category) {
  return Object.values(COMPRESSOR_MODES).filter(
    mode => mode.category === category
  );
}

export const COMPRESSOR_MODE_CATEGORIES = {
  musical: { name: 'Musical', color: 'blue' },
  aggressive: { name: 'Aggressive', color: 'red' },
  creative: { name: 'Creative', color: 'purple' }
};
