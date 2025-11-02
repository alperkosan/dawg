/**
 * RHYTHM FX PRESETS v2.0
 *
 * Professional rhythmic effects presets
 * Categories: Gate Patterns, Stutter, Glitch, Creative, Tape Effects
 */

export const rhythmFXPresets = [
  // ============================================================================
  // GATE PATTERNS
  // ============================================================================
  {
    id: 'gate-pattern',
    name: 'Gate Pattern',
    category: 'Gate Patterns',
    description: 'Classic rhythmic gating pattern',
    tags: ['gate', 'rhythmic', 'pattern'],
    author: 'DAWG Factory',
    settings: {
      division: 16,
      chance: 100,
      intensity: 100,
      swing: 50,
      bufferSize: 500,
      fadeTime: 10,
      glitchAmount: 50,
      tapeSpeed: 100,
      mode: 0,
      bpm: 128
    }
  },
  {
    id: 'euclidean-dream',
    name: 'Euclidean Dream',
    category: 'Gate Patterns',
    description: 'Euclidean rhythm pattern',
    tags: ['euclidean', 'rhythm', 'pattern'],
    author: 'DAWG Factory',
    settings: {
      division: 16,
      chance: 100,
      intensity: 100,
      swing: 50,
      bufferSize: 500,
      fadeTime: 5,
      glitchAmount: 0,
      tapeSpeed: 100,
      mode: 0,
      bpm: 128
    }
  },
  {
    id: 'trap-hihat',
    name: 'Trap Hi-Hat',
    category: 'Gate Patterns',
    description: 'Trap-style hi-hat gating',
    tags: ['trap', 'hihat', 'gate'],
    author: 'DAWG Factory',
    settings: {
      division: 32,
      chance: 100,
      intensity: 100,
      bufferSize: 50,
      fadeTime: 10,
      swing: 60,
      glitchAmount: 0,
      tapeSpeed: 100,
      mode: 1,
      bpm: 140
    }
  },

  // ============================================================================
  // STUTTER
  // ============================================================================
  {
    id: 'stutter-roll',
    name: 'Stutter Roll',
    category: 'Stutter',
    description: 'Fast stutter repeats',
    tags: ['stutter', 'repeat', 'fast'],
    author: 'DAWG Factory',
    settings: {
      division: 32,
      chance: 100,
      intensity: 100,
      bufferSize: 100,
      fadeTime: 5,
      swing: 50,
      glitchAmount: 0,
      tapeSpeed: 100,
      mode: 1,
      bpm: 128
    }
  },
  {
    id: 'gross-beat-style',
    name: 'Gross Beat Style',
    category: 'Stutter',
    description: 'Gross Beat-inspired stutter',
    tags: ['stutter', 'gross-beat', 'groove'],
    author: 'DAWG Factory',
    settings: {
      division: 16,
      chance: 100,
      intensity: 85,
      bufferSize: 200,
      fadeTime: 8,
      swing: 55,
      glitchAmount: 0,
      tapeSpeed: 100,
      mode: 1,
      bpm: 128
    }
  },

  // ============================================================================
  // GLITCH
  // ============================================================================
  {
    id: 'glitch-mayhem',
    name: 'Glitch Mayhem',
    category: 'Glitch',
    description: 'Intense glitch effects',
    tags: ['glitch', 'chaos', 'intense'],
    author: 'DAWG Factory',
    settings: {
      division: 32,
      chance: 75,
      intensity: 100,
      glitchAmount: 80,
      bufferSize: 300,
      fadeTime: 10,
      swing: 50,
      tapeSpeed: 100,
      mode: 4,
      bpm: 128
    }
  },
  {
    id: 'subtle-glitch',
    name: 'Subtle Glitch',
    category: 'Glitch',
    description: 'Gentle glitch texture',
    tags: ['glitch', 'subtle', 'texture'],
    author: 'DAWG Factory',
    settings: {
      division: 16,
      chance: 60,
      intensity: 50,
      glitchAmount: 40,
      bufferSize: 400,
      fadeTime: 15,
      swing: 50,
      tapeSpeed: 100,
      mode: 4,
      bpm: 128
    }
  },

  // ============================================================================
  // CREATIVE
  // ============================================================================
  {
    id: 'repeat-loop',
    name: 'Repeat Loop',
    category: 'Creative',
    description: 'Looping with feedback',
    tags: ['repeat', 'loop', 'feedback'],
    author: 'DAWG Factory',
    settings: {
      division: 8,
      chance: 100,
      intensity: 80,
      bufferSize: 1000,
      fadeTime: 15,
      swing: 50,
      glitchAmount: 0,
      tapeSpeed: 100,
      mode: 2,
      bpm: 128
    }
  },
  {
    id: 'reverse-build',
    name: 'Reverse Build',
    category: 'Creative',
    description: 'Backwards playback effect',
    tags: ['reverse', 'backwards', 'build'],
    author: 'DAWG Factory',
    settings: {
      division: 16,
      chance: 100,
      intensity: 100,
      bufferSize: 500,
      fadeTime: 20,
      swing: 50,
      glitchAmount: 0,
      tapeSpeed: 100,
      mode: 3,
      bpm: 128
    }
  },

  // ============================================================================
  // TAPE EFFECTS
  // ============================================================================
  {
    id: 'tape-stop',
    name: 'Tape Stop',
    category: 'Tape Effects',
    description: 'Vinyl/tape slowdown',
    tags: ['tape', 'slowdown', 'vinyl'],
    author: 'DAWG Factory',
    settings: {
      division: 8,
      chance: 100,
      intensity: 100,
      tapeSpeed: 50,
      bufferSize: 500,
      fadeTime: 10,
      swing: 50,
      glitchAmount: 0,
      mode: 5,
      bpm: 128
    }
  },
  {
    id: 'vinyl-brake',
    name: 'Vinyl Brake',
    category: 'Tape Effects',
    description: 'DJ-style vinyl brake',
    tags: ['vinyl', 'brake', 'dj'],
    author: 'DAWG Factory',
    settings: {
      division: 4,
      chance: 100,
      intensity: 100,
      tapeSpeed: 20,
      bufferSize: 1000,
      fadeTime: 5,
      swing: 50,
      glitchAmount: 0,
      mode: 5,
      bpm: 128
    }
  }
];

