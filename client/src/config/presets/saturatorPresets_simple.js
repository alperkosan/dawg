/**
 * SATURATOR SIMPLE PRESETS
 * Direct worklet parameters - no mode abstraction
 */

export const saturatorPresets = [
  {
    id: 'gentle-warmth',
    name: 'Gentle Warmth',
    category: 'Musical',
    description: 'Subtle analog warmth for vocals and instruments',
    tags: ['vocal', 'warm', 'subtle'],
    author: 'DAWG',
    settings: {
      distortion: 0.25,
      wet: 0.7,
      tone: 1,
      autoGain: 1,
      lowCutFreq: 20,
      highCutFreq: 20000,
      headroom: 0,
      multiband: 0
    }
  },
  {
    id: 'tape-saturation',
    name: 'Tape Saturation',
    category: 'Vintage',
    description: 'Classic tape machine warmth and compression',
    tags: ['tape', 'vintage', 'warm'],
    author: 'DAWG',
    settings: {
      distortion: 0.4,
      wet: 0.85,
      tone: -1,
      autoGain: 1,
      lowCutFreq: 30,
      highCutFreq: 18000,
      headroom: -2,
      multiband: 0
    }
  },
  {
    id: 'tube-drive',
    name: 'Tube Drive',
    category: 'Musical',
    description: 'Warm tube amplifier saturation',
    tags: ['tube', 'warm', 'drive'],
    author: 'DAWG',
    settings: {
      distortion: 0.6,
      wet: 1.0,
      tone: 2,
      autoGain: 1,
      lowCutFreq: 20,
      highCutFreq: 20000,
      headroom: 0,
      multiband: 0
    }
  },
  {
    id: 'aggressive-grit',
    name: 'Aggressive Grit',
    category: 'Aggressive',
    description: 'Heavy distortion for drums and bass',
    tags: ['aggressive', 'drums', 'bass'],
    author: 'DAWG',
    settings: {
      distortion: 1.2,
      wet: 1.0,
      tone: 3,
      autoGain: 1,
      lowCutFreq: 20,
      highCutFreq: 15000,
      headroom: -3,
      multiband: 0
    }
  },
  {
    id: 'bass-power',
    name: 'Bass Power',
    category: 'Musical',
    description: 'Low-end focused saturation for bass',
    tags: ['bass', 'low-end', 'power'],
    author: 'DAWG',
    settings: {
      distortion: 0.5,
      wet: 0.8,
      tone: -2,
      autoGain: 1,
      lowCutFreq: 20,
      highCutFreq: 8000,
      headroom: 0,
      multiband: 0
    }
  },
  {
    id: 'vocal-presence',
    name: 'Vocal Presence',
    category: 'Musical',
    description: 'Adds clarity and presence to vocals',
    tags: ['vocal', 'presence', 'clarity'],
    author: 'DAWG',
    settings: {
      distortion: 0.3,
      wet: 0.6,
      tone: 3,
      autoGain: 1,
      lowCutFreq: 80,
      highCutFreq: 20000,
      headroom: 2,
      multiband: 0
    }
  },
  // === MULTIBAND PRESETS ===
  {
    id: 'multiband-master',
    name: 'Multiband Master',
    category: 'Mastering',
    description: 'Balanced saturation across all bands for mix bus',
    tags: ['mastering', 'multiband', 'balanced'],
    author: 'DAWG',
    settings: {
      multiband: 1,
      lowMidCrossover: 200,
      midHighCrossover: 4000,
      lowDrive: 0.3,
      midDrive: 0.4,
      highDrive: 0.5,
      lowMix: 1.0,
      midMix: 1.0,
      highMix: 0.8,
      autoGain: 1
    }
  },
  {
    id: 'drum-bus-crush',
    name: 'Drum Bus Crush',
    category: 'Drums',
    description: 'Heavy low-end drive with crisp highs',
    tags: ['drums', 'multiband', 'heavy'],
    author: 'DAWG',
    settings: {
      multiband: 1,
      lowMidCrossover: 150,
      midHighCrossover: 2500,
      lowDrive: 1.5,
      midDrive: 0.8,
      highDrive: 1.2,
      lowMix: 1.0,
      midMix: 0.8,
      highMix: 0.6,
      autoGain: 1
    }
  },
  {
    id: 'bass-growl',
    name: 'Bass Growl',
    category: 'Bass',
    description: 'Distorted mids for growl, clean subs',
    tags: ['bass', 'multiband', 'growl'],
    author: 'DAWG',
    settings: {
      multiband: 1,
      lowMidCrossover: 100,
      midHighCrossover: 1000,
      lowDrive: 0.2, // Clean sub
      midDrive: 1.8, // Growling mids
      highDrive: 0.5,
      lowMix: 1.0,
      midMix: 1.0,
      highMix: 0.5,
      autoGain: 1
    }
  },
  {
    id: 'vocal-air-lift',
    name: 'Vocal Air Lift',
    category: 'Vocal',
    description: 'Saturates highs for breathy presence',
    tags: ['vocal', 'multiband', 'air'],
    author: 'DAWG',
    settings: {
      multiband: 1,
      lowMidCrossover: 300,
      midHighCrossover: 5000,
      lowDrive: 0.1,
      midDrive: 0.3,
      highDrive: 1.2, // Saturation on air band
      lowMix: 0.5,
      midMix: 0.8,
      highMix: 1.0,
      autoGain: 1
    }
  }
];
