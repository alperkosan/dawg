/**
 * ARCADECRUSHER PRESETS v2.0
 *
 * Professional bit-crushing presets
 * Categories: Retro Arcade, Lo-Fi Vibes, Creative Destruction, Subtle Texture
 */

export const arcadeCrusherPresets = [
  // ============================================================================
  // RETRO ARCADE
  // ============================================================================
  {
    id: '4bit-classic',
    name: '4-Bit Classic',
    category: 'Retro Arcade',
    description: 'Classic 8-bit console sound with maximum character',
    tags: ['retro', 'arcade', '8-bit', 'gaming'],
    author: 'DAWG Factory',
    settings: {
      bitDepth: 4,
      sampleRateReduction: 4, // ~12kHz
      crush: 0.3,
      wet: 1.0
    }
  },
  {
    id: '8bit-arcade',
    name: '8-Bit Arcade',
    category: 'Retro Arcade',
    description: 'Retro arcade crunch with balanced character',
    tags: ['retro', 'arcade', 'gaming'],
    author: 'DAWG Factory',
    settings: {
      bitDepth: 8,
      sampleRateReduction: 2, // ~24kHz
      crush: 0.2,
      wet: 1.0
    }
  },
  {
    id: '12bit-warmth',
    name: '12-Bit Warmth',
    category: 'Retro Arcade',
    description: 'Early digital warmth with subtle crunch',
    tags: ['retro', 'warm', 'digital'],
    author: 'DAWG Factory',
    settings: {
      bitDepth: 12,
      sampleRateReduction: 1, // Full rate
      crush: 0.1,
      wet: 0.8
    }
  },
  {
    id: '16bit-crisp',
    name: '16-Bit Crisp',
    category: 'Retro Arcade',
    description: 'SNES-style crisp digital sound',
    tags: ['retro', 'crisp', 'gaming'],
    author: 'DAWG Factory',
    settings: {
      bitDepth: 16,
      sampleRateReduction: 1,
      crush: 0.0,
      wet: 0.6
    }
  },

  // ============================================================================
  // LO-FI VIBES
  // ============================================================================
  {
    id: 'lo-fi-hiphop',
    name: 'Lo-Fi Hip Hop',
    category: 'Lo-Fi Vibes',
    description: 'Warm vintage degradation perfect for beats',
    tags: ['lo-fi', 'hip-hop', 'vintage', 'warm'],
    author: 'DAWG Factory',
    settings: {
      bitDepth: 4,
      sampleRateReduction: 6, // ~8kHz
      crush: 0.2,
      wet: 0.7
    }
  },
  {
    id: 'vintage-tape',
    name: 'Vintage Tape',
    category: 'Lo-Fi Vibes',
    description: 'Tape-style degradation with bit crushing',
    tags: ['lo-fi', 'tape', 'vintage', 'analog'],
    author: 'DAWG Factory',
    settings: {
      bitDepth: 6,
      sampleRateReduction: 4,
      crush: 0.15,
      wet: 0.75
    }
  },
  {
    id: 'cassette-vibe',
    name: 'Cassette Vibe',
    category: 'Lo-Fi Vibes',
    description: '90s cassette player aesthetic',
    tags: ['lo-fi', 'cassette', '90s', 'nostalgic'],
    author: 'DAWG Factory',
    settings: {
      bitDepth: 8,
      sampleRateReduction: 3, // ~16kHz
      crush: 0.25,
      wet: 0.8
    }
  },

  // ============================================================================
  // CREATIVE DESTRUCTION
  // ============================================================================
  {
    id: 'telephone',
    name: 'Telephone',
    category: 'Creative Destruction',
    description: 'Bandlimited phone quality with maximum character',
    tags: ['telephone', 'lo-fi', 'creative', 'bandlimited'],
    author: 'DAWG Factory',
    settings: {
      bitDepth: 8,
      sampleRateReduction: 6, // ~8kHz
      crush: 0.4,
      wet: 1.0
    }
  },
  {
    id: 'radio-static',
    name: 'Radio Static',
    category: 'Creative Destruction',
    description: 'AM radio with heavy bit crushing',
    tags: ['radio', 'static', 'creative', 'extreme'],
    author: 'DAWG Factory',
    settings: {
      bitDepth: 4,
      sampleRateReduction: 8, // ~6kHz
      crush: 0.5,
      wet: 1.0
    }
  },
  {
    id: 'glitch-madness',
    name: 'Glitch Madness',
    category: 'Creative Destruction',
    description: 'Extreme bit crushing for glitch effects',
    tags: ['glitch', 'extreme', 'creative', 'destruction'],
    author: 'DAWG Factory',
    settings: {
      bitDepth: 2,
      sampleRateReduction: 10, // ~4.8kHz
      crush: 0.7,
      wet: 1.0
    }
  },

  // ============================================================================
  // SUBTLE TEXTURE
  // ============================================================================
  {
    id: 'subtle-warmth',
    name: 'Subtle Warmth',
    category: 'Subtle Texture',
    description: 'Gentle bit reduction for subtle character',
    tags: ['subtle', 'warm', 'gentle', 'texture'],
    author: 'DAWG Factory',
    settings: {
      bitDepth: 14,
      sampleRateReduction: 1,
      crush: 0.05,
      wet: 0.4
    }
  },
  {
    id: 'slight-crunch',
    name: 'Slight Crunch',
    category: 'Subtle Texture',
    description: 'Light bit crushing for added texture',
    tags: ['subtle', 'texture', 'light', 'crunch'],
    author: 'DAWG Factory',
    settings: {
      bitDepth: 10,
      sampleRateReduction: 2,
      crush: 0.1,
      wet: 0.5
    }
  }
];

