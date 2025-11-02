/**
 * TIDAL FILTER FACTORY PRESETS
 *
 * Professional filter presets for creative sound design
 * Organized by category: Classic Sweeps, Resonant, Creative, Subtle
 */

export const tidalFilterPresets = [
  // ===================================
  // CLASSIC SWEEPS
  // ===================================
  {
    id: 'low-sweep',
    name: 'Low Sweep',
    description: 'Classic low-pass sweep for smooth filter movement',
    category: 'Classic Sweeps',
    tags: ['lowpass', 'sweep', 'classic'],
    author: 'DAWG',
    settings: {
      cutoff: 1000,
      resonance: 0.6,
      filterType: 0, // Lowpass
      drive: 1.5,
      wet: 1.0
    }
  },
  {
    id: 'high-rise',
    name: 'High Rise',
    description: 'Soaring high-pass sweep with bright character',
    category: 'Classic Sweeps',
    tags: ['highpass', 'sweep', 'bright'],
    author: 'DAWG',
    settings: {
      cutoff: 2000,
      resonance: 0.5,
      filterType: 0.85, // Highpass
      drive: 1.2,
      wet: 1.0
    }
  },
  {
    id: 'band-wave',
    name: 'Band Wave',
    description: 'Focused band-pass sweep for vocal-like movement',
    category: 'Classic Sweeps',
    tags: ['bandpass', 'sweep', 'vocal'],
    author: 'DAWG',
    settings: {
      cutoff: 1500,
      resonance: 0.8,
      filterType: 0.5, // Bandpass
      drive: 1.8,
      wet: 0.9
    }
  },

  // ===================================
  // RESONANT
  // ===================================
  {
    id: 'resonant-acid',
    name: 'Resonant Acid',
    description: 'High resonance sweep for acid bass lines',
    category: 'Resonant',
    tags: ['acid', 'resonant', 'bass'],
    author: 'DAWG',
    settings: {
      cutoff: 1200,
      resonance: 0.95,
      filterType: 0.2, // LP with high resonance
      drive: 2.0,
      wet: 0.85
    }
  },
  {
    id: 'resonant-scream',
    name: 'Resonant Scream',
    description: 'Extreme resonance for piercing effects',
    category: 'Resonant',
    tags: ['extreme', 'resonant', 'scream'],
    author: 'DAWG',
    settings: {
      cutoff: 800,
      resonance: 0.98,
      filterType: 0.15,
      drive: 3.0,
      wet: 0.9
    }
  },
  {
    id: 'ladder-warmth',
    name: 'Ladder Warmth',
    description: 'Moog-style ladder filter with warm resonance',
    category: 'Resonant',
    tags: ['moog', 'warm', 'analog'],
    author: 'DAWG',
    settings: {
      cutoff: 1500,
      resonance: 0.7,
      filterType: 0.1,
      drive: 1.8,
      wet: 1.0
    }
  },

  // ===================================
  // CREATIVE
  // ===================================
  {
    id: 'notch-cut',
    name: 'Notch Cut',
    description: 'Surgical notch filter for removing frequencies',
    category: 'Creative',
    tags: ['notch', 'surgical', 'creative'],
    author: 'DAWG',
    settings: {
      cutoff: 800,
      resonance: 0.9,
      filterType: 0.95, // Notch
      drive: 1.0,
      wet: 0.8
    }
  },
  {
    id: 'telephone',
    name: 'Telephone',
    description: 'Narrow bandpass for telephone/radio effect',
    category: 'Creative',
    tags: ['telephone', 'lofi', 'bandpass'],
    author: 'DAWG',
    settings: {
      cutoff: 1200,
      resonance: 0.85,
      filterType: 0.5,
      drive: 2.5,
      wet: 1.0
    }
  },
  {
    id: 'vowel-morph',
    name: 'Vowel Morph',
    description: 'Vocal formant-style bandpass sweep',
    category: 'Creative',
    tags: ['vocal', 'formant', 'bandpass'],
    author: 'DAWG',
    settings: {
      cutoff: 2000,
      resonance: 0.75,
      filterType: 0.45,
      drive: 1.5,
      wet: 0.85
    }
  },

  // ===================================
  // SUBTLE
  // ===================================
  {
    id: 'gentle-sweep',
    name: 'Gentle Sweep',
    description: 'Subtle filter movement for gentle enhancement',
    category: 'Subtle',
    tags: ['gentle', 'subtle', 'smooth'],
    author: 'DAWG',
    settings: {
      cutoff: 3000,
      resonance: 0.2,
      filterType: 0.1,
      drive: 1.0,
      wet: 0.5
    }
  },
  {
    id: 'air-filter',
    name: 'Air Filter',
    description: 'High-frequency gentle filtering for air control',
    category: 'Subtle',
    tags: ['air', 'gentle', 'highpass'],
    author: 'DAWG',
    settings: {
      cutoff: 8000,
      resonance: 0.15,
      filterType: 0.8,
      drive: 1.0,
      wet: 0.6
    }
  },
  {
    id: 'warmth-low',
    name: 'Warmth Low',
    description: 'Subtle low-pass for adding warmth',
    category: 'Subtle',
    tags: ['warm', 'lowpass', 'subtle'],
    author: 'DAWG',
    settings: {
      cutoff: 5000,
      resonance: 0.25,
      filterType: 0.05,
      drive: 1.2,
      wet: 0.7
    }
  }
];

export default tidalFilterPresets;
