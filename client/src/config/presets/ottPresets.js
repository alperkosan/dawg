/**
 * OTT-STYLE MULTIBAND COMPRESSOR PRESETS
 * Inspired by Xfer OTT
 */

export const OTT_MODES = {
  'ott-drums': {
    id: 'ott-drums',
    name: 'OTT Drums',
    icon: '🥁',
    color: 'red',
    description: 'Massive punch and body for drums',
    category: 'aggressive',

    baseParams: {
      depth: 0.7,
      time: 0.3,
      lowUpRatio: 4,
      lowDownRatio: 3,
      lowGain: 2,
      midUpRatio: 3,
      midDownRatio: 4,
      midGain: 1,
      highUpRatio: 5,
      highDownRatio: 4,
      highGain: 3
    },

    curves: {
      depth: { min: 0.5, max: 1.0, curve: 'linear' },
      lowGain: { min: 0, max: 4, curve: 'linear' },
      highGain: { min: 2, max: 6, curve: 'linear' }
    }
  },

  'ott-bass': {
    id: 'ott-bass',
    name: 'OTT Bass',
    icon: '🔊',
    color: 'purple',
    description: 'Thick, consistent bass',
    category: 'musical',

    baseParams: {
      depth: 0.6,
      time: 0.5,
      lowUpRatio: 6,
      lowDownRatio: 4,
      lowGain: 4,
      midUpRatio: 3,
      midDownRatio: 3,
      midGain: -2,
      highUpRatio: 2,
      highDownRatio: 2,
      highGain: -6
    },

    curves: {
      depth: { min: 0.4, max: 0.8, curve: 'linear' },
      lowGain: { min: 2, max: 6, curve: 'linear' },
      lowUpRatio: { min: 4, max: 8, curve: 'linear' }
    }
  },

  'ott-vocal': {
    id: 'ott-vocal',
    name: 'OTT Vocal',
    icon: '🎤',
    color: 'blue',
    description: 'Present, in-your-face vocals',
    category: 'musical',

    baseParams: {
      depth: 0.4,
      time: 0.4,
      lowUpRatio: 2,
      lowDownRatio: 3,
      lowGain: -3,
      midUpRatio: 4,
      midDownRatio: 4,
      midGain: 3,
      highUpRatio: 3,
      highDownRatio: 3,
      highGain: 2
    },

    curves: {
      depth: { min: 0.2, max: 0.6, curve: 'linear' },
      midGain: { min: 1, max: 5, curve: 'linear' },
      highGain: { min: 0, max: 4, curve: 'linear' }
    }
  },

  'ott-master': {
    id: 'ott-master',
    name: 'OTT Master',
    icon: '✨',
    color: 'amber',
    description: 'Glue and loudness for master bus',
    category: 'musical',

    baseParams: {
      depth: 0.3,
      time: 0.6,
      lowUpRatio: 3,
      lowDownRatio: 3,
      lowGain: 1,
      midUpRatio: 3,
      midDownRatio: 3,
      midGain: 0,
      highUpRatio: 3,
      highDownRatio: 3,
      highGain: 1
    },

    curves: {
      depth: { min: 0.1, max: 0.5, curve: 'linear' },
      lowGain: { min: 0, max: 2, curve: 'linear' },
      highGain: { min: 0, max: 2, curve: 'linear' }
    }
  },

  'ott-aggressive': {
    id: 'ott-aggressive',
    name: 'OTT Aggressive',
    icon: '🔥',
    color: 'red',
    description: 'Over-the-top extreme compression',
    category: 'aggressive',

    baseParams: {
      depth: 1.0,
      time: 0.2,
      lowUpRatio: 8,
      lowDownRatio: 6,
      lowGain: 6,
      midUpRatio: 8,
      midDownRatio: 6,
      midGain: 4,
      highUpRatio: 8,
      highDownRatio: 6,
      highGain: 6
    },

    curves: {
      depth: { min: 0.7, max: 1.0, curve: 'exponential' },
      lowUpRatio: { min: 6, max: 10, curve: 'linear' },
      highUpRatio: { min: 6, max: 10, curve: 'linear' }
    }
  },

  'ott-subtle': {
    id: 'ott-subtle',
    name: 'OTT Subtle',
    icon: '💫',
    color: 'cyan',
    description: 'Gentle multiband enhancement',
    category: 'subtle',

    baseParams: {
      depth: 0.2,
      time: 0.8,
      lowUpRatio: 2,
      lowDownRatio: 2,
      lowGain: 0,
      midUpRatio: 2,
      midDownRatio: 2,
      midGain: 0,
      highUpRatio: 2,
      highDownRatio: 2,
      highGain: 0
    },

    curves: {
      depth: { min: 0.1, max: 0.4, curve: 'linear' },
      time: { min: 0.6, max: 1.0, curve: 'linear' }
    }
  },

  'ott-synth': {
    id: 'ott-synth',
    name: 'OTT Synth',
    icon: '🎹',
    color: 'green',
    description: 'Bright, upfront synth presence',
    category: 'creative',

    baseParams: {
      depth: 0.5,
      time: 0.3,
      lowUpRatio: 3,
      lowDownRatio: 3,
      lowGain: -2,
      midUpRatio: 4,
      midDownRatio: 4,
      midGain: 2,
      highUpRatio: 6,
      highDownRatio: 5,
      highGain: 4
    },

    curves: {
      depth: { min: 0.3, max: 0.7, curve: 'linear' },
      highGain: { min: 2, max: 6, curve: 'linear' },
      highUpRatio: { min: 4, max: 8, curve: 'linear' }
    }
  },

  'ott-pad': {
    id: 'ott-pad',
    name: 'OTT Pad',
    icon: '🌊',
    color: 'indigo',
    description: 'Lush, sustained pad compression',
    category: 'creative',

    baseParams: {
      depth: 0.4,
      time: 0.9,
      lowUpRatio: 4,
      lowDownRatio: 3,
      lowGain: 2,
      midUpRatio: 4,
      midDownRatio: 3,
      midGain: 1,
      highUpRatio: 3,
      highDownRatio: 3,
      highGain: -1
    },

    curves: {
      depth: { min: 0.2, max: 0.6, curve: 'linear' },
      time: { min: 0.7, max: 1.2, curve: 'linear' }
    }
  },

  'custom': {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    color: 'gray',
    description: 'Manual control - preserves current settings',
    category: 'subtle',

    baseParams: {
      depth: 0.5,
      time: 0.5,
      lowUpRatio: 3,
      lowDownRatio: 3,
      lowGain: 0,
      midUpRatio: 3,
      midDownRatio: 3,
      midGain: 0,
      highUpRatio: 3,
      highDownRatio: 3,
      highGain: 0
    },

    curves: {} // No curves, uses baseParams directly
  }
};

/**
 * Calculate parameter value based on amount and curve
 */
export function calculateOTTParamValue(curve, amount) {
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
 * Get all parameters for OTT mode at specific amount
 */
export function getOTTModeParameters(modeId, amount) {
  const mode = OTT_MODES[modeId];
  if (!mode) return null;

  const params = { ...mode.baseParams };

  // Apply curves
  if (mode.curves) {
    Object.entries(mode.curves).forEach(([paramName, curve]) => {
      params[paramName] = calculateOTTParamValue(curve, amount);
    });
  }

  return params;
}

/**
 * Get OTT modes by category
 */
export function getOTTModesByCategory(category) {
  return Object.values(OTT_MODES).filter(
    mode => mode.category === category
  );
}

export const OTT_MODE_CATEGORIES = {
  musical: { name: 'Musical', color: 'blue' },
  aggressive: { name: 'Aggressive', color: 'red' },
  creative: { name: 'Creative', color: 'purple' },
  subtle: { name: 'Subtle', color: 'cyan' }
};
