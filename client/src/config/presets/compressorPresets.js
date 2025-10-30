/**
 * COMPRESSOR PRESET MODES - REDESIGNED WITH METHODOLOGY
 *
 * 📐 METHODOLOGY:
 * 1. Analog Equipment Reference (1176, LA-2A, Distressor)
 * 2. Industry Standards (FabFilter, UAD, Waves)
 * 3. Genre-Based (EDM, Hip-Hop, Rock, Jazz)
 * 4. Instrument-Specific (Vocal, Drums, Bass, Guitar)
 * 5. Usage Scenario (Mixing, Mastering, Parallel)
 * 6. Parameter Relationships (mathematical correlations)
 *
 * 🎯 DESIGN PRINCIPLES:
 * - Threshold/Ratio correlation: Higher ratio needs lower threshold
 * - Attack/Release correlation: Fast attack pairs with medium release
 * - Knee/AutoMakeup: Soft knee needs makeup gain
 * - Genre-appropriate settings: EDM = fast, Jazz = slow
 */

export const COMPRESSOR_MODES = {
  // === VOCAL COMPRESSION ===
  'vocal-control': {
    id: 'vocal-control',
    name: 'Vocal Control',
    icon: '🎤',
    color: 'blue',
    description: 'Universal Audio LA-2A style - Smooth, musical vocal compression',
    category: 'musical',
    genre: ['Pop', 'Rock', 'R&B', 'Soul'],
    reference: 'Universal Audio LA-2A',

    baseParams: {
      threshold: -18,
      ratio: 3,
      attack: 0.003, // LA-2A: 3ms (photocell)
      release: 0.06, // LA-2A: 60ms (musical)
      knee: 12, // Soft knee for transparency
      autoMakeup: true,
      lookahead: 2, // Subtle look-ahead
      stereoLink: 100,
      programDependentRelease: 1 // Musical release
    },

    // 🎯 PARAMETER RELATIONSHIPS: Amount-based scaling
    curves: {
      threshold: { min: -24, max: -12, curve: 'linear' },
      ratio: { min: 2, max: 4, curve: 'linear' },
      attack: { min: 0.001, max: 0.005, curve: 'linear' }, // Faster attack at higher amounts
      release: { min: 0.04, max: 0.12, curve: 'logarithmic' }, // Musical release curve
      knee: { min: 6, max: 18, curve: 'linear' },
      wet: { min: 0.7, max: 1.0, curve: 'linear' }
    }
  },

  'vocal-1176': {
    id: 'vocal-1176',
    name: 'Vocal 1176',
    icon: '⚡',
    color: 'red',
    description: 'Universal Audio 1176 style - Fast, aggressive vocal compression',
    category: 'aggressive',
    genre: ['Rock', 'Metal', 'Hip-Hop'],
    reference: 'Universal Audio 1176',

    baseParams: {
      threshold: -12,
      ratio: 4,
      attack: 0.0008, // 1176: 0.8ms (ultra-fast)
      release: 0.05, // 1176: 50ms (fast)
      knee: 3, // Hard knee for punch
      autoMakeup: true,
      lookahead: 3,
      stereoLink: 100,
      programDependentRelease: 1
    },

    curves: {
      threshold: { min: -18, max: -6, curve: 'linear' },
      ratio: { min: 3, max: 6, curve: 'exponential' }, // Higher ratios at extreme amounts
      attack: { min: 0.0005, max: 0.001, curve: 'linear' },
      release: { min: 0.03, max: 0.08, curve: 'linear' },
      wet: { min: 0.8, max: 1.0, curve: 'linear' }
    }
  },

  // === DRUM COMPRESSION ===
  'drum-punch': {
    id: 'drum-punch',
    name: 'Drum Punch',
    icon: '🥁',
    color: 'red',
    description: 'API 2500 style - Fast attack for transient control and punch',
    category: 'aggressive',
    genre: ['EDM', 'Hip-Hop', 'Rock', 'Pop'],
    reference: 'API 2500',

    baseParams: {
      threshold: -12,
      ratio: 4,
      attack: 0.001, // Ultra-fast for transient preservation
      release: 0.08, // Fast release for groove (8:1 ratio = punchy)
      knee: 3, // Hard knee for aggressive sound
      autoMakeup: true,
      lookahead: 2,
      stereoLink: 100,
      programDependentRelease: 1
    },

    curves: {
      threshold: { min: -18, max: -6, curve: 'linear' },
      ratio: { min: 3, max: 8, curve: 'exponential' }, // Higher ratios for extreme punch
      attack: { min: 0.0005, max: 0.002, curve: 'linear' },
      release: { min: 0.05, max: 0.15, curve: 'linear' }, // Groove-preserving release
      wet: { min: 0.8, max: 1.0, curve: 'linear' }
    }
  },

  'drum-parallel': {
    id: 'drum-parallel',
    name: 'Drum Parallel',
    icon: '🥁',
    color: 'orange',
    description: 'Parallel compression - Heavy compression blended with dry signal',
    category: 'creative',
    genre: ['EDM', 'Hip-Hop', 'Pop'],
    reference: 'Parallel Compression Technique',

    baseParams: {
      threshold: -20,
      ratio: 8, // High ratio for parallel blend
      attack: 0.002,
      release: 0.1,
      knee: 6,
      autoMakeup: true,
      lookahead: 3,
      stereoLink: 100,
      programDependentRelease: 1
    },

    curves: {
      threshold: { min: -30, max: -10, curve: 'linear' },
      ratio: { min: 6, max: 12, curve: 'linear' },
      wet: { min: 0.2, max: 0.6, curve: 'linear' } // Parallel blend (20-60% wet)
    }
  },

  'drum-bus': {
    id: 'drum-bus',
    name: 'Drum Bus',
    icon: '🎚️',
    color: 'purple',
    description: 'SSL Bus Compressor style - Glue compression for drum bus',
    category: 'musical',
    genre: ['Rock', 'Pop', 'Jazz'],
    reference: 'SSL Bus Compressor',

    baseParams: {
      threshold: -24,
      ratio: 2.5, // Moderate ratio for bus compression
      attack: 0.01, // Slightly slower for natural feel
      release: 0.3, // Musical release
      knee: 10,
      autoMakeup: false, // Manual control for bus
      lookahead: 5,
      stereoLink: 100,
      programDependentRelease: 1
    },

    curves: {
      threshold: { min: -30, max: -18, curve: 'linear' },
      ratio: { min: 2, max: 4, curve: 'linear' },
      release: { min: 0.2, max: 0.5, curve: 'logarithmic' },
      wet: { min: 0.5, max: 0.9, curve: 'linear' }
    }
  },

  // === MIX COMPRESSION ===
  'mix-glue': {
    id: 'mix-glue',
    name: 'Mix Glue',
    icon: '🎚️',
    color: 'purple',
    description: 'SSL Bus Compressor style - Gentle bus compression for mix cohesion',
    category: 'musical',
    genre: ['All Genres'],
    reference: 'SSL Bus Compressor',

    baseParams: {
      threshold: -24,
      ratio: 2, // Low ratio for transparency
      attack: 0.03, // Slow attack to preserve transients
      release: 0.4, // Musical release (auto)
      knee: 12, // Soft knee for smoothness
      autoMakeup: false, // Manual control
      lookahead: 5, // Professional look-ahead
      stereoLink: 100,
      programDependentRelease: 1
    },

    curves: {
      threshold: { min: -30, max: -18, curve: 'linear' },
      ratio: { min: 1.5, max: 3, curve: 'linear' },
      attack: { min: 0.02, max: 0.05, curve: 'linear' },
      release: { min: 0.3, max: 0.6, curve: 'logarithmic' },
      wet: { min: 0.5, max: 0.9, curve: 'linear' }
    }
  },

  'master-bus': {
    id: 'master-bus',
    name: 'Master Bus',
    icon: '✨',
    color: 'amber',
    description: 'Neve 33609 style - Mastering-grade bus compression',
    category: 'musical',
    genre: ['All Genres'],
    reference: 'Neve 33609',

    baseParams: {
      threshold: -20,
      ratio: 3,
      attack: 0.02, // Moderate attack
      release: 0.25, // Professional release
      knee: 8,
      autoMakeup: false,
      lookahead: 8, // Mastering-grade look-ahead
      stereoLink: 100,
      programDependentRelease: 1
    },

    curves: {
      threshold: { min: -28, max: -12, curve: 'linear' },
      ratio: { min: 2, max: 4, curve: 'linear' },
      attack: { min: 0.01, max: 0.04, curve: 'linear' },
      release: { min: 0.2, max: 0.4, curve: 'logarithmic' },
      knee: { min: 6, max: 12, curve: 'linear' },
      wet: { min: 0.7, max: 1.0, curve: 'linear' }
    }
  },

  // === LIMITING ===
  'peak-limiter': {
    id: 'peak-limiter',
    name: 'Peak Limiter',
    icon: '🛡️',
    color: 'orange',
    description: 'Brick wall limiting - Fast, transparent peak protection',
    category: 'aggressive',
    genre: ['All Genres'],
    reference: 'Brick Wall Limiting',

    baseParams: {
      threshold: -6,
      ratio: 10, // High ratio for limiting
      attack: 0.0001, // Ultra-fast attack
      release: 0.05, // Fast release
      knee: 0, // Hard knee
      autoMakeup: false,
      lookahead: 10, // Maximum look-ahead for transparency
      stereoLink: 100,
      programDependentRelease: 0 // Linear release for limiting
    },

    curves: {
      threshold: { min: -12, max: -3, curve: 'linear' },
      ratio: { min: 8, max: 20, curve: 'exponential' },
      attack: { min: 0.00005, max: 0.0002, curve: 'linear' },
      release: { min: 0.03, max: 0.08, curve: 'linear' },
      wet: { min: 0.9, max: 1.0, curve: 'linear' }
    }
  },

  // === SPECIALIZED ===
  'bass-tightener': {
    id: 'bass-tightener',
    name: 'Bass Tightener',
    icon: '🔊',
    color: 'green',
    description: 'dbx 160 style - Controlled low-end dynamics for bass',
    category: 'musical',
    genre: ['EDM', 'Hip-Hop', 'Rock'],
    reference: 'dbx 160',

    baseParams: {
      threshold: -15,
      ratio: 5,
      attack: 0.01, // Moderate attack for bass
      release: 0.25, // Musical release
      knee: 8, // Medium knee
      autoMakeup: true,
      lookahead: 3,
      stereoLink: 100,
      programDependentRelease: 1
    },

    curves: {
      threshold: { min: -21, max: -9, curve: 'linear' },
      ratio: { min: 4, max: 7, curve: 'linear' },
      attack: { min: 0.008, max: 0.015, curve: 'linear' },
      release: { min: 0.2, max: 0.35, curve: 'logarithmic' },
      wet: { min: 0.7, max: 1.0, curve: 'linear' }
    }
  },

  'guitar-smooth': {
    id: 'guitar-smooth',
    name: 'Guitar Smooth',
    icon: '🎸',
    color: 'amber',
    description: 'Tube-style compression for smooth guitar',
    category: 'musical',
    genre: ['Rock', 'Jazz', 'Blues'],
    reference: 'Tube Compressor',

    baseParams: {
      threshold: -16,
      ratio: 3.5,
      attack: 0.005,
      release: 0.15,
      knee: 10,
      autoMakeup: true,
      lookahead: 2,
      stereoLink: 100,
      programDependentRelease: 1
    },

    curves: {
      threshold: { min: -22, max: -10, curve: 'linear' },
      ratio: { min: 2.5, max: 5, curve: 'linear' },
      attack: { min: 0.003, max: 0.008, curve: 'linear' },
      release: { min: 0.1, max: 0.25, curve: 'logarithmic' },
      wet: { min: 0.6, max: 1.0, curve: 'linear' }
    }
  },

  'edm-pumping': {
    id: 'edm-pumping',
    name: 'EDM Pumping',
    icon: '⚡',
    color: 'cyan',
    description: 'Sidechain-style compression for EDM pumping effect',
    category: 'creative',
    genre: ['EDM', 'House', 'Techno'],
    reference: 'Sidechain Compression',

    baseParams: {
      threshold: -18,
      ratio: 6,
      attack: 0.001, // Fast attack
      release: 0.1, // Medium release for pumping
      knee: 4,
      autoMakeup: true,
      lookahead: 2,
      stereoLink: 100,
      programDependentRelease: 0 // Linear for rhythmic pumping
    },

    curves: {
      threshold: { min: -24, max: -12, curve: 'linear' },
      ratio: { min: 4, max: 10, curve: 'exponential' },
      attack: { min: 0.0005, max: 0.002, curve: 'linear' },
      release: { min: 0.06, max: 0.2, curve: 'linear' }, // Tempo-based
      wet: { min: 0.5, max: 1.0, curve: 'linear' }
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
