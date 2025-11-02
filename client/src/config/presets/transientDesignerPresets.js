/**
 * TRANSIENT DESIGNER PRESETS v2.0
 *
 * Professional transient shaping presets
 * Categories: Drum Punch, Bass Control, Percussion, Subtle Enhancement
 */

export const transientDesignerPresets = [
  // ============================================================================
  // DRUM PUNCH
  // ============================================================================
  {
    id: 'punchy-kick',
    name: 'Punchy Kick',
    category: 'Drum Punch',
    description: 'Enhance kick attack for maximum punch',
    tags: ['kick', 'punch', 'attack', 'drums'],
    author: 'DAWG Factory',
    settings: {
      attack: 6,
      sustain: -3,
      mix: 1.0
    }
  },
  {
    id: 'snap-snare',
    name: 'Snap Snare',
    category: 'Drum Punch',
    description: 'Sharp snare attack with reduced body',
    tags: ['snare', 'snap', 'sharp', 'drums'],
    author: 'DAWG Factory',
    settings: {
      attack: 8,
      sustain: -6,
      mix: 1.0
    }
  },
  {
    id: 'crisp-drums',
    name: 'Crisp Drums',
    category: 'Drum Punch',
    description: 'Enhanced attack for crispy drum sound',
    tags: ['drums', 'crisp', 'attack', 'enhance'],
    author: 'DAWG Factory',
    settings: {
      attack: 9,
      sustain: -4,
      mix: 1.0
    }
  },

  // ============================================================================
  // BASS CONTROL
  // ============================================================================
  {
    id: 'tight-bass',
    name: 'Tight Bass',
    category: 'Bass Control',
    description: 'Reduce bass sustain for tightness',
    tags: ['bass', 'tight', 'control', 'sustain'],
    author: 'DAWG Factory',
    settings: {
      attack: -3,
      sustain: 2,
      mix: 1.0
    }
  },
  {
    id: 'punchy-808',
    name: 'Punchy 808',
    category: 'Bass Control',
    description: 'Add attack to 808 for more punch',
    tags: ['808', 'bass', 'punch', 'attack'],
    author: 'DAWG Factory',
    settings: {
      attack: 4,
      sustain: -2,
      mix: 0.8
    }
  },

  // ============================================================================
  // PERCUSSION
  // ============================================================================
  {
    id: 'sharp-hihats',
    name: 'Sharp Hi-Hats',
    category: 'Percussion',
    description: 'Enhance hi-hat attack and clarity',
    tags: ['hihats', 'sharp', 'attack', 'percussion'],
    author: 'DAWG Factory',
    settings: {
      attack: 7,
      sustain: -2,
      mix: 1.0
    }
  },
  {
    id: 'smooth-strings',
    name: 'Smooth Strings',
    category: 'Percussion',
    description: 'Smooth out string attacks',
    tags: ['strings', 'smooth', 'gentle', 'reduce'],
    author: 'DAWG Factory',
    settings: {
      attack: -2,
      sustain: 3,
      mix: 0.7
    }
  },

  // ============================================================================
  // SUBTLE ENHANCEMENT
  // ============================================================================
  {
    id: 'gentle-punch',
    name: 'Gentle Punch',
    category: 'Subtle Enhancement',
    description: 'Subtle attack enhancement',
    tags: ['subtle', 'gentle', 'enhance', 'light'],
    author: 'DAWG Factory',
    settings: {
      attack: 3,
      sustain: -1,
      mix: 0.6
    }
  },
  {
    id: 'balanced',
    name: 'Balanced',
    category: 'Subtle Enhancement',
    description: 'Neutral settings for fine-tuning',
    tags: ['balanced', 'neutral', 'custom'],
    author: 'DAWG Factory',
    settings: {
      attack: 0,
      sustain: 0,
      mix: 1.0
    }
  },
  {
    id: 'body-enhance',
    name: 'Body Enhance',
    category: 'Subtle Enhancement',
    description: 'Add warmth and body to sustain',
    tags: ['body', 'warmth', 'sustain', 'enhance'],
    author: 'DAWG Factory',
    settings: {
      attack: -1,
      sustain: 4,
      mix: 0.8
    }
  }
];

