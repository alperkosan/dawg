/**
 * PITCH SHIFTER PRESETS v2.0
 *
 * Professional pitch-shifting presets
 * Categories: Intervals, Creative Effects, Subtle Shifts
 */

export const pitchShifterPresets = [
  // ============================================================================
  // INTERVALS
  // ============================================================================
  {
    id: 'octave-up',
    name: 'Octave Up',
    category: 'Intervals',
    description: 'One octave higher - perfect for adding brightness',
    tags: ['octave', 'bright', 'harmony'],
    author: 'DAWG Factory',
    settings: {
      pitch: 12,
      wet: 1.0
      // windowSize: auto-optimized based on pitch amount
    }
  },
  {
    id: 'octave-down',
    name: 'Octave Down',
    category: 'Intervals',
    description: 'One octave lower - adds weight and depth',
    tags: ['octave', 'deep', 'bass'],
    author: 'DAWG Factory',
    settings: {
      pitch: -12,
      wet: 1.0
    }
  },
  {
    id: 'perfect-fifth',
    name: 'Perfect Fifth',
    category: 'Intervals',
    description: '+7 semitones - classic harmony interval',
    tags: ['harmony', 'fifth', 'musical'],
    author: 'DAWG Factory',
    settings: {
      pitch: 7,
      wet: 0.6
    }
  },
  {
    id: 'major-third',
    name: 'Major Third',
    category: 'Intervals',
    description: '+4 semitones - warm harmony',
    tags: ['harmony', 'third', 'warm'],
    author: 'DAWG Factory',
    settings: {
      pitch: 4,
      wet: 0.5
    }
  },
  {
    id: 'minor-third',
    name: 'Minor Third',
    category: 'Intervals',
    description: '+3 semitones - darker harmony',
    tags: ['harmony', 'minor', 'dark'],
    author: 'DAWG Factory',
    settings: {
      pitch: 3,
      wet: 0.5
    }
  },

  // ============================================================================
  // CREATIVE EFFECTS
  // ============================================================================
  {
    id: 'shimmer',
    name: 'Shimmer',
    category: 'Creative Effects',
    description: 'Octave up with subtle blend - ethereal effect',
    tags: ['shimmer', 'ethereal', 'octave', 'ambient'],
    author: 'DAWG Factory',
    settings: {
      pitch: 12,
      wet: 0.3
    }
  },
  {
    id: 'detune',
    name: 'Detune',
    category: 'Creative Effects',
    description: 'Slight detuning for chorus-like effect',
    tags: ['detune', 'chorus', 'width'],
    author: 'DAWG Factory',
    settings: {
      pitch: 0.15,
      wet: 0.4
    }
  },
  {
    id: 'chipmunk',
    name: 'Chipmunk',
    category: 'Creative Effects',
    description: 'Extreme octave up - cartoon voice effect',
    tags: ['chipmunk', 'cartoon', 'extreme', 'fun'],
    author: 'DAWG Factory',
    settings: {
      pitch: 12,
      wet: 1.0
    }
  },
  {
    id: 'deep-voice',
    name: 'Deep Voice',
    category: 'Creative Effects',
    description: 'Extreme octave down - deep voice effect',
    tags: ['deep', 'voice', 'extreme', 'bass'],
    author: 'DAWG Factory',
    settings: {
      pitch: -12,
      wet: 1.0
    }
  },
  {
    id: 'harmonic-stack',
    name: 'Harmonic Stack',
    category: 'Creative Effects',
    description: 'Multiple intervals blended together',
    tags: ['harmonic', 'stack', 'complex', 'rich'],
    author: 'DAWG Factory',
    settings: {
      pitch: 7,
      wet: 0.7
    }
  },

  // ============================================================================
  // SUBTLE SHIFTS
  // ============================================================================
  {
    id: 'subtle-bright',
    name: 'Subtle Bright',
    category: 'Subtle Shifts',
    description: 'Gentle upward shift for subtle brightness',
    tags: ['subtle', 'bright', 'gentle'],
    author: 'DAWG Factory',
    settings: {
      pitch: 2,
      wet: 0.3
    }
  },
  {
    id: 'subtle-warm',
    name: 'Subtle Warm',
    category: 'Subtle Shifts',
    description: 'Gentle downward shift for subtle warmth',
    tags: ['subtle', 'warm', 'gentle'],
    author: 'DAWG Factory',
    settings: {
      pitch: -2,
      wet: 0.3
    }
  }
];

