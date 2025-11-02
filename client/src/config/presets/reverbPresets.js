/**
 * MODERN REVERB PRESETS
 * Professional algorithmic reverb presets inspired by real acoustic spaces
 *
 * Categories:
 * - Classic Spaces: Room, Hall, Cathedral, Chamber
 * - Vintage Hardware: Plate, Spring
 * - Creative: Vocal, Ambient, Shimmer
 * - Specialized: Drum Room, Vocal Booth, Stadium
 */

export const reverbPresets = [
  // === CLASSIC SPACES ===
  {
    id: 'room',
    name: 'Room',
    category: 'Classic Spaces',
    description: 'Small intimate space - Studio room',
    tags: ['natural', 'tight', 'recording'],
    author: 'DAWG Audio',
    settings: {
      size: 0.35,
      decay: 0.8,
      damping: 0.4,
      wet: 0.25,
      earlyLateMix: 0.4,
      preDelay: 0.015,
      diffusion: 0.6,
      width: 1.0,
      modDepth: 0.3,
      modRate: 0.5
    }
  },
  {
    id: 'hall',
    name: 'Hall',
    category: 'Classic Spaces',
    description: 'Concert hall - Large acoustic space',
    tags: ['natural', 'spacious', 'classical'],
    author: 'DAWG Audio',
    settings: {
      size: 0.65,
      decay: 2.5,
      damping: 0.5,
      wet: 0.35,
      earlyLateMix: 0.5,
      preDelay: 0.02,
      diffusion: 0.7,
      width: 1.0,
      modDepth: 0.3,
      modRate: 0.5
    }
  },
  {
    id: 'cathedral',
    name: 'Cathedral',
    category: 'Classic Spaces',
    description: 'Vast sacred space - Long decay',
    tags: ['epic', 'long', 'ambient'],
    author: 'DAWG Audio',
    settings: {
      size: 0.9,
      decay: 6.0,
      damping: 0.7,
      wet: 0.45,
      earlyLateMix: 0.7,
      preDelay: 0.03,
      diffusion: 0.8,
      width: 1.0,
      modDepth: 0.3,
      modRate: 0.5
    }
  },
  {
    id: 'chamber',
    name: 'Chamber',
    category: 'Classic Spaces',
    description: 'Recording chamber - Medium decay',
    tags: ['vintage', 'recording', 'smooth'],
    author: 'DAWG Audio',
    settings: {
      size: 0.55,
      decay: 1.2,
      damping: 0.5,
      wet: 0.32,
      earlyLateMix: 0.5,
      preDelay: 0.018,
      diffusion: 0.7,
      width: 1.0,
      modDepth: 0.3,
      modRate: 0.5
    }
  },

  // === VINTAGE HARDWARE ===
  {
    id: 'plate',
    name: 'Plate',
    category: 'Vintage Hardware',
    description: 'Lexicon-style plate reverb',
    tags: ['vintage', 'bright', 'plate'],
    author: 'DAWG Audio',
    reference: 'Lexicon Plate',
    settings: {
      size: 0.5,
      decay: 1.8,
      damping: 0.2,
      wet: 0.4,
      earlyLateMix: 0.3,
      preDelay: 0.01,
      diffusion: 0.9,
      width: 1.0,
      modDepth: 0.3,
      modRate: 0.5
    }
  },
  {
    id: 'spring',
    name: 'Spring',
    category: 'Vintage Hardware',
    description: 'Vintage spring reverb - Surf rock',
    tags: ['vintage', 'spring', 'surf'],
    author: 'DAWG Audio',
    reference: 'Fender Spring Tank',
    settings: {
      size: 0.3,
      decay: 0.6,
      damping: 0.3,
      wet: 0.35,
      earlyLateMix: 0.2,
      preDelay: 0.005,
      diffusion: 0.4,
      width: 1.0,
      modDepth: 0.5,
      modRate: 1.5
    }
  },

  // === CREATIVE ===
  {
    id: 'vocal',
    name: 'Vocal',
    category: 'Creative',
    description: 'Vocal plate - Warm and smooth',
    tags: ['vocal', 'warm', 'musical'],
    author: 'DAWG Audio',
    settings: {
      size: 0.45,
      decay: 1.5,
      damping: 0.6,
      wet: 0.3,
      earlyLateMix: 0.45,
      preDelay: 0.015,
      diffusion: 0.75,
      width: 1.0,
      modDepth: 0.3,
      modRate: 0.5
    }
  },
  {
    id: 'ambient',
    name: 'Ambient',
    category: 'Creative',
    description: 'Infinite soundscape - Long tail',
    tags: ['ambient', 'infinite', 'cinematic'],
    author: 'DAWG Audio',
    settings: {
      size: 0.95,
      decay: 10.0,
      damping: 0.8,
      wet: 0.6,
      earlyLateMix: 0.8,
      preDelay: 0.04,
      diffusion: 0.9,
      width: 1.0,
      modDepth: 0.3,
      modRate: 0.5
    }
  },
  {
    id: 'shimmer',
    name: 'Shimmer',
    category: 'Creative',
    description: 'Pitch-shifted ambient reverb',
    tags: ['shimmer', 'ethereal', 'cinematic'],
    author: 'DAWG Audio',
    settings: {
      size: 0.92,
      decay: 8.0,
      damping: 0.75,
      wet: 0.55,
      earlyLateMix: 0.85,
      preDelay: 0.035,
      diffusion: 0.95,
      width: 1.0,
      modDepth: 0.6,
      modRate: 0.3
    }
  },

  // === SPECIALIZED ===
  {
    id: 'drum-room',
    name: 'Drum Room',
    category: 'Specialized',
    description: 'Small tight drum space',
    tags: ['drums', 'tight', 'punchy'],
    author: 'DAWG Audio',
    settings: {
      size: 0.25,
      decay: 0.5,
      damping: 0.4,
      wet: 0.2,
      earlyLateMix: 0.6,
      preDelay: 0.008,
      diffusion: 0.5,
      width: 1.0,
      modDepth: 0.3,
      modRate: 0.5
    }
  },
  {
    id: 'vocal-booth',
    name: 'Vocal Booth',
    category: 'Specialized',
    description: 'Intimate vocal treatment',
    tags: ['vocal', 'intimate', 'close'],
    author: 'DAWG Audio',
    settings: {
      size: 0.35,
      decay: 0.9,
      damping: 0.55,
      wet: 0.28,
      earlyLateMix: 0.5,
      preDelay: 0.012,
      diffusion: 0.65,
      width: 1.0,
      modDepth: 0.3,
      modRate: 0.5
    }
  },
  {
    id: 'stadium',
    name: 'Stadium',
    category: 'Specialized',
    description: 'Large venue simulation',
    tags: ['arena', 'epic', 'huge'],
    author: 'DAWG Audio',
    settings: {
      size: 0.85,
      decay: 4.5,
      damping: 0.6,
      wet: 0.5,
      earlyLateMix: 0.65,
      preDelay: 0.05,
      diffusion: 0.85,
      width: 1.0,
      modDepth: 0.3,
      modRate: 0.5
    }
  }
];
