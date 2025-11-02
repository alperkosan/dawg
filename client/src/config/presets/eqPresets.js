/**
 * MULTIBAND EQ FACTORY PRESETS
 *
 * Professional EQ presets for common scenarios
 * Organized by category: Vocal, Drums, Bass, Mix Bus, Mastering, Creative
 */

export const EQ_FACTORY_PRESETS = [
  // ===================================
  // VOCAL PRESETS
  // ===================================
  {
    id: 'vocal-clarity',
    name: 'Vocal Clarity',
    description: 'Clean, present vocals with air and clarity',
    category: 'Vocal',
    tags: ['vocal', 'clarity', 'bright'],
    settings: {
      bands: [
        { id: 'band-1', type: 'highpass', frequency: 80, gain: 0, q: 0.71, active: true },
        { id: 'band-2', type: 'peaking', frequency: 200, gain: -2, q: 1.2, active: true },
        { id: 'band-3', type: 'peaking', frequency: 3000, gain: 2.5, q: 1.8, active: true },
        { id: 'band-4', type: 'highshelf', frequency: 8000, gain: 3, q: 0.71, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },
  {
    id: 'vocal-air',
    name: 'Vocal Air',
    description: 'Add shimmer and brightness to vocals',
    category: 'Vocal',
    tags: ['vocal', 'bright', 'airy'],
    settings: {
      bands: [
        { id: 'band-1', type: 'highpass', frequency: 100, gain: 0, q: 0.71, active: true },
        { id: 'band-2', type: 'highshelf', frequency: 10000, gain: 2.5, q: 0.71, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },
  {
    id: 'vocal-warmth',
    name: 'Vocal Warmth',
    description: 'Add body and warmth to thin vocals',
    category: 'Vocal',
    tags: ['vocal', 'warm', 'body'],
    settings: {
      bands: [
        { id: 'band-1', type: 'highpass', frequency: 80, gain: 0, q: 0.71, active: true },
        { id: 'band-2', type: 'lowshelf', frequency: 200, gain: 2, q: 0.71, active: true },
        { id: 'band-3', type: 'peaking', frequency: 500, gain: -1.5, q: 1.0, active: true },
        { id: 'band-4', type: 'peaking', frequency: 3500, gain: 1.5, q: 1.5, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },
  {
    id: 'vocal-radio',
    name: 'Vocal Radio',
    description: 'Classic radio/telephone vocal effect',
    category: 'Vocal',
    tags: ['vocal', 'lo-fi', 'radio', 'creative'],
    settings: {
      bands: [
        { id: 'band-1', type: 'highpass', frequency: 300, gain: 0, q: 1.0, active: true },
        { id: 'band-2', type: 'lowpass', frequency: 3000, gain: 0, q: 1.0, active: true },
        { id: 'band-3', type: 'peaking', frequency: 1200, gain: 4, q: 2.0, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },

  // ===================================
  // DRUM PRESETS
  // ===================================
  {
    id: 'kick-punch',
    name: 'Kick Punch',
    description: 'Tight, punchy kick drum with sub boost',
    category: 'Drums',
    tags: ['kick', 'punch', 'tight'],
    settings: {
      bands: [
        { id: 'band-1', type: 'lowshelf', frequency: 60, gain: 4, q: 0.71, active: true },
        { id: 'band-2', type: 'peaking', frequency: 120, gain: -3, q: 1.5, active: true },
        { id: 'band-3', type: 'peaking', frequency: 2500, gain: 3, q: 2.0, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },
  {
    id: 'snare-crack',
    name: 'Snare Crack',
    description: 'Sharp, crisp snare with presence',
    category: 'Drums',
    tags: ['snare', 'crisp', 'crack'],
    settings: {
      bands: [
        { id: 'band-1', type: 'highpass', frequency: 80, gain: 0, q: 0.71, active: true },
        { id: 'band-2', type: 'peaking', frequency: 200, gain: 2, q: 1.0, active: true },
        { id: 'band-3', type: 'peaking', frequency: 3000, gain: 3, q: 1.5, active: true },
        { id: 'band-4', type: 'highshelf', frequency: 8000, gain: 2, q: 0.71, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },
  {
    id: 'hihat-sparkle',
    name: 'Hi-Hat Sparkle',
    description: 'Bright, shimmering hi-hats',
    category: 'Drums',
    tags: ['hihat', 'bright', 'sparkle'],
    settings: {
      bands: [
        { id: 'band-1', type: 'highpass', frequency: 500, gain: 0, q: 0.71, active: true },
        { id: 'band-2', type: 'highshelf', frequency: 10000, gain: 4, q: 0.71, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },
  {
    id: 'drum-bus-glue',
    name: 'Drum Bus Glue',
    description: 'Cohesive full drum mix with punch',
    category: 'Drums',
    tags: ['drums', 'bus', 'glue'],
    settings: {
      bands: [
        { id: 'band-1', type: 'highpass', frequency: 30, gain: 0, q: 0.71, active: true },
        { id: 'band-2', type: 'lowshelf', frequency: 80, gain: 1.5, q: 0.71, active: true },
        { id: 'band-3', type: 'peaking', frequency: 200, gain: -1, q: 1.0, active: true },
        { id: 'band-4', type: 'peaking', frequency: 3000, gain: 2, q: 1.5, active: true },
        { id: 'band-5', type: 'highshelf', frequency: 10000, gain: 2, q: 0.71, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },

  // ===================================
  // BASS PRESETS
  // ===================================
  {
    id: 'bass-tight',
    name: 'Bass Tight',
    description: 'Controlled, tight bass with clarity',
    category: 'Bass',
    tags: ['bass', 'tight', 'clean'],
    settings: {
      bands: [
        { id: 'band-1', type: 'highpass', frequency: 30, gain: 0, q: 0.71, active: true },
        { id: 'band-2', type: 'lowshelf', frequency: 80, gain: 2, q: 0.71, active: true },
        { id: 'band-3', type: 'peaking', frequency: 250, gain: -2, q: 1.2, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },
  {
    id: 'bass-sub-boost',
    name: 'Bass Sub Boost',
    description: 'Deep sub bass enhancement',
    category: 'Bass',
    tags: ['bass', 'sub', 'deep'],
    settings: {
      bands: [
        { id: 'band-1', type: 'highpass', frequency: 25, gain: 0, q: 0.71, active: true },
        { id: 'band-2', type: 'lowshelf', frequency: 50, gain: 5, q: 0.71, active: true },
        { id: 'band-3', type: 'peaking', frequency: 200, gain: -3, q: 1.5, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },
  {
    id: 'bass-presence',
    name: 'Bass Presence',
    description: 'Add mid-range presence to bass',
    category: 'Bass',
    tags: ['bass', 'presence', 'cut-through'],
    settings: {
      bands: [
        { id: 'band-1', type: 'highpass', frequency: 30, gain: 0, q: 0.71, active: true },
        { id: 'band-2', type: 'peaking', frequency: 800, gain: 3, q: 1.5, active: true },
        { id: 'band-3', type: 'peaking', frequency: 2000, gain: 2, q: 2.0, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },

  // ===================================
  // MIX BUS PRESETS
  // ===================================
  {
    id: 'master-glue',
    name: 'Master Glue',
    description: 'Cohesive full-range master bus EQ',
    category: 'Mix Bus',
    tags: ['master', 'glue', 'balanced'],
    settings: {
      bands: [
        { id: 'band-1', type: 'lowshelf', frequency: 100, gain: 1, q: 0.71, active: true },
        { id: 'band-2', type: 'peaking', frequency: 800, gain: -0.5, q: 1.0, active: true },
        { id: 'band-3', type: 'peaking', frequency: 3000, gain: 1, q: 1.5, active: true },
        { id: 'band-4', type: 'highshelf', frequency: 10000, gain: 1.5, q: 0.71, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },
  {
    id: 'de-mud',
    name: 'De-Mud',
    description: 'Remove boxiness and mud from mix',
    category: 'Mix Bus',
    tags: ['cleanup', 'mud', 'clarity'],
    settings: {
      bands: [
        { id: 'band-1', type: 'peaking', frequency: 250, gain: -3, q: 2.0, active: true },
        { id: 'band-2', type: 'peaking', frequency: 500, gain: -2, q: 1.5, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },
  {
    id: 'air-sparkle',
    name: 'Air & Sparkle',
    description: 'Add top-end air and sparkle',
    category: 'Mix Bus',
    tags: ['air', 'bright', 'sparkle'],
    settings: {
      bands: [
        { id: 'band-1', type: 'peaking', frequency: 8000, gain: 1.5, q: 1.2, active: true },
        { id: 'band-2', type: 'highshelf', frequency: 12000, gain: 2, q: 0.71, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },
  {
    id: 'modern-pop',
    name: 'Modern Pop',
    description: 'Bright, punchy modern pop sound',
    category: 'Mix Bus',
    tags: ['pop', 'modern', 'bright'],
    settings: {
      bands: [
        { id: 'band-1', type: 'highpass', frequency: 25, gain: 0, q: 0.71, active: true },
        { id: 'band-2', type: 'lowshelf', frequency: 80, gain: 1, q: 0.71, active: true },
        { id: 'band-3', type: 'peaking', frequency: 200, gain: -1, q: 1.0, active: true },
        { id: 'band-4', type: 'peaking', frequency: 3000, gain: 2, q: 1.5, active: true },
        { id: 'band-5', type: 'highshelf', frequency: 10000, gain: 3, q: 0.71, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },
  {
    id: 'warm-analog',
    name: 'Warm Analog',
    description: 'Vintage analog warmth and smoothness',
    category: 'Mix Bus',
    tags: ['warm', 'analog', 'vintage'],
    settings: {
      bands: [
        { id: 'band-1', type: 'lowshelf', frequency: 120, gain: 2, q: 0.71, active: true },
        { id: 'band-2', type: 'peaking', frequency: 3000, gain: -1, q: 1.0, active: true },
        { id: 'band-3', type: 'highshelf', frequency: 12000, gain: -0.5, q: 0.71, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },

  // ===================================
  // CREATIVE / SPECIAL
  // ===================================
  {
    id: 'telephone',
    name: 'Telephone',
    description: 'Classic telephone/lo-fi effect',
    category: 'Creative',
    tags: ['lofi', 'telephone', 'creative', 'effect'],
    settings: {
      bands: [
        { id: 'band-1', type: 'highpass', frequency: 300, gain: 0, q: 1.0, active: true },
        { id: 'band-2', type: 'lowpass', frequency: 3000, gain: 0, q: 1.0, active: true },
        { id: 'band-3', type: 'peaking', frequency: 1200, gain: 6, q: 2.5, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },
  {
    id: 'am-radio',
    name: 'AM Radio',
    description: 'Vintage AM radio effect',
    category: 'Creative',
    tags: ['lofi', 'radio', 'vintage', 'creative'],
    settings: {
      bands: [
        { id: 'band-1', type: 'highpass', frequency: 400, gain: 0, q: 1.5, active: true },
        { id: 'band-2', type: 'lowpass', frequency: 2500, gain: 0, q: 1.5, active: true },
        { id: 'band-3', type: 'peaking', frequency: 800, gain: 4, q: 2.0, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },
  {
    id: 'mega-bass',
    name: 'Mega Bass',
    description: 'Extreme bass boost',
    category: 'Creative',
    tags: ['bass', 'extreme', 'creative'],
    settings: {
      bands: [
        { id: 'band-1', type: 'lowshelf', frequency: 80, gain: 10, q: 0.71, active: true },
        { id: 'band-2', type: 'peaking', frequency: 50, gain: 6, q: 1.0, active: true }
      ],
      wet: 1.0,
      output: 0.7 // Reduced output to prevent clipping
    }
  },
  {
    id: 'mega-treble',
    name: 'Mega Treble',
    description: 'Extreme treble boost',
    category: 'Creative',
    tags: ['treble', 'extreme', 'creative'],
    settings: {
      bands: [
        { id: 'band-1', type: 'highshelf', frequency: 8000, gain: 10, q: 0.71, active: true },
        { id: 'band-2', type: 'peaking', frequency: 12000, gain: 6, q: 1.0, active: true }
      ],
      wet: 1.0,
      output: 0.7 // Reduced output to prevent clipping
    }
  },
  {
    id: 'hollow',
    name: 'Hollow',
    description: 'Scooped mids for hollow effect',
    category: 'Creative',
    tags: ['hollow', 'scooped', 'creative'],
    settings: {
      bands: [
        { id: 'band-1', type: 'lowshelf', frequency: 200, gain: 3, q: 0.71, active: true },
        { id: 'band-2', type: 'peaking', frequency: 800, gain: -12, q: 1.5, active: true },
        { id: 'band-3', type: 'peaking', frequency: 2000, gain: -8, q: 1.0, active: true },
        { id: 'band-4', type: 'highshelf', frequency: 8000, gain: 3, q: 0.71, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  },

  // ===================================
  // UTILITY
  // ===================================
  {
    id: 'flat',
    name: 'Flat / Bypass',
    description: 'All bands at 0dB (reference)',
    category: 'Utility',
    tags: ['flat', 'bypass', 'reference'],
    settings: {
      bands: [
        { id: 'band-1', type: 'peaking', frequency: 1000, gain: 0, q: 1.0, active: false }
      ],
      wet: 1.0,
      output: 1.0
    }
  },
  {
    id: 'rumble-filter',
    name: 'Rumble Filter',
    description: 'Remove low-end rumble and noise',
    category: 'Utility',
    tags: ['cleanup', 'rumble', 'highpass'],
    settings: {
      bands: [
        { id: 'band-1', type: 'highpass', frequency: 80, gain: 0, q: 0.71, active: true }
      ],
      wet: 1.0,
      output: 1.0
    }
  }
];

export default EQ_FACTORY_PRESETS;
