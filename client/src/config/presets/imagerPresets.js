/**
 * IMAGER PRESETS v2.0
 *
 * Professional multiband stereo imaging presets
 * Categories: Wide Stereo, Narrow, Creative, Subtle Enhancement
 */

export const imagerPresets = [
  // ============================================================================
  // WIDE STEREO
  // ============================================================================
  {
    id: 'wide-stereo',
    name: 'Wide Stereo',
    category: 'Wide Stereo',
    description: 'Maximum stereo width across all bands',
    tags: ['wide', 'stereo', 'maximum'],
    author: 'DAWG Factory',
    settings: {
      band1Freq: 100,
      band2Freq: 600,
      band3Freq: 3000,
      band4Freq: 6000,
      band1Width: 80,
      band2Width: 80,
      band3Width: 80,
      band4Width: 80,
      globalWidth: 1.0,
      stereoize: 0
    }
  },
  {
    id: 'wide-highs',
    name: 'Wide Highs',
    category: 'Wide Stereo',
    description: 'Widen high frequencies only',
    tags: ['wide', 'highs', 'selective'],
    author: 'DAWG Factory',
    settings: {
      band1Freq: 100,
      band2Freq: 600,
      band3Freq: 3000,
      band4Freq: 6000,
      band1Width: 0,
      band2Width: 0,
      band3Width: 60,
      band4Width: 90,
      globalWidth: 1.0,
      stereoize: 0
    }
  },
  {
    id: 'wide-mids',
    name: 'Wide Mids',
    category: 'Wide Stereo',
    description: 'Widen mid frequencies for vocals and instruments',
    tags: ['wide', 'mids', 'vocals'],
    author: 'DAWG Factory',
    settings: {
      band1Freq: 100,
      band2Freq: 600,
      band3Freq: 3000,
      band4Freq: 6000,
      band1Width: 0,
      band2Width: 70,
      band3Width: 80,
      band4Width: 0,
      globalWidth: 1.0,
      stereoize: 0
    }
  },

  // ============================================================================
  // NARROW
  // ============================================================================
  {
    id: 'mono-bass',
    name: 'Mono Bass',
    category: 'Narrow',
    description: 'Narrow low frequencies for punchy mono bass',
    tags: ['mono', 'bass', 'narrow'],
    author: 'DAWG Factory',
    settings: {
      band1Freq: 100,
      band2Freq: 600,
      band3Freq: 3000,
      band4Freq: 6000,
      band1Width: -100,
      band2Width: -50,
      band3Width: 0,
      band4Width: 0,
      globalWidth: 1.0,
      stereoize: 0
    }
  },
  {
    id: 'focused-center',
    name: 'Focused Center',
    category: 'Narrow',
    description: 'Narrow all frequencies for center-focused mix',
    tags: ['narrow', 'center', 'focused'],
    author: 'DAWG Factory',
    settings: {
      band1Freq: 100,
      band2Freq: 600,
      band3Freq: 3000,
      band4Freq: 6000,
      band1Width: -80,
      band2Width: -60,
      band3Width: -40,
      band4Width: -20,
      globalWidth: 0.5,
      stereoize: 0
    }
  },

  // ============================================================================
  // CREATIVE
  // ============================================================================
  {
    id: 'stereoize-mono',
    name: 'Stereoize Mono',
    category: 'Creative',
    description: 'Convert mono to stereo with width',
    tags: ['stereoize', 'mono', 'creative'],
    author: 'DAWG Factory',
    settings: {
      band1Freq: 100,
      band2Freq: 600,
      band3Freq: 3000,
      band4Freq: 6000,
      band1Width: 0,
      band2Width: 50,
      band3Width: 70,
      band4Width: 80,
      globalWidth: 1.0,
      stereoize: 100
    }
  },
  {
    id: 'extreme-width',
    name: 'Extreme Width',
    category: 'Creative',
    description: 'Maximum stereo width for creative effect',
    tags: ['extreme', 'wide', 'creative'],
    author: 'DAWG Factory',
    settings: {
      band1Freq: 100,
      band2Freq: 600,
      band3Freq: 3000,
      band4Freq: 6000,
      band1Width: 100,
      band2Width: 100,
      band3Width: 100,
      band4Width: 100,
      globalWidth: 1.2,
      stereoize: 0
    }
  },

  // ============================================================================
  // SUBTLE ENHANCEMENT
  // ============================================================================
  {
    id: 'subtle-width',
    name: 'Subtle Width',
    category: 'Subtle Enhancement',
    description: 'Gentle stereo enhancement',
    tags: ['subtle', 'gentle', 'enhancement'],
    author: 'DAWG Factory',
    settings: {
      band1Freq: 100,
      band2Freq: 600,
      band3Freq: 3000,
      band4Freq: 6000,
      band1Width: 0,
      band2Width: 20,
      band3Width: 30,
      band4Width: 40,
      globalWidth: 1.0,
      stereoize: 0
    }
  },
  {
    id: 'balanced-image',
    name: 'Balanced Image',
    category: 'Subtle Enhancement',
    description: 'Balanced stereo imaging',
    tags: ['balanced', 'neutral', 'imaging'],
    author: 'DAWG Factory',
    settings: {
      band1Freq: 100,
      band2Freq: 600,
      band3Freq: 3000,
      band4Freq: 6000,
      band1Width: 0,
      band2Width: 0,
      band3Width: 0,
      band4Width: 0,
      globalWidth: 1.0,
      stereoize: 0
    }
  }
];

