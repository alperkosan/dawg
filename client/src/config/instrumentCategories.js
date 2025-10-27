import { INSTRUMENT_TYPES } from './constants';

/**
 * 🎹 INSTRUMENT CATEGORIES
 *
 * Organized structure for instrument selection in Channel Rack
 * Groups instruments by their engine type and provides presets
 */

export const INSTRUMENT_CATEGORIES = {
  SAMPLER: 'sampler',
  MULTI_SAMPLER: 'multiSampler',
  VA_SYNTH: 'vaSynth'
};

export const CATEGORY_INFO = {
  [INSTRUMENT_CATEGORIES.SAMPLER]: {
    name: 'Sampler',
    icon: '🥁',
    description: 'Single sample instruments (drums, one-shots)',
    engine: 'SingleSampleInstrument'
  },
  [INSTRUMENT_CATEGORIES.MULTI_SAMPLER]: {
    name: 'Multi-Sampler',
    icon: '🎹',
    description: 'Multi-sampled instruments (piano, chromatic)',
    engine: 'MultiSampleInstrument'
  },
  [INSTRUMENT_CATEGORIES.VA_SYNTH]: {
    name: 'VA Synthesizer',
    icon: '🎛️',
    description: 'Virtual analog synthesizer with presets',
    engine: 'VASynthInstrument_v2'
  }
};

// =========================================================================
// 🥁 SAMPLER PRESETS
// =========================================================================
export const SAMPLER_PRESETS = {
  drums: {
    name: 'Drums',
    presets: [
      { id: 'kick', name: 'Kick', url: '/audio/samples/drums/kick.wav', color: '#FF6B6B', baseNote: 60 },
      { id: 'snare', name: 'Snare', url: '/audio/samples/drums/snare.wav', color: '#4ECDC4', baseNote: 60 },
      { id: 'hihat', name: 'Hi-Hat', url: '/audio/samples/drums/hihat.wav', color: '#95E1D3', baseNote: 60 },
      { id: 'openhat', name: 'Open Hat', url: '/audio/samples/drums/openhat.wav', color: '#F38181', baseNote: 60 }
    ]
  },
  kxvi: {
    name: 'KXVI Drums',
    presets: [
      { id: 'clap', name: 'Clap', url: '/audio/samples/kxvi/clap.wav', color: '#FFA07A', baseNote: 60 },
      { id: '808', name: '808', url: '/audio/samples/kxvi/808.wav', color: '#8B4789', baseNote: 36 },
      { id: 'rim', name: 'Rim', url: '/audio/samples/kxvi/rim.wav', color: '#CD853F', baseNote: 60 },
      { id: 'perc', name: 'Perc', url: '/audio/samples/kxvi/perc.wav', color: '#DAA520', baseNote: 60 }
    ]
  }
};

// =========================================================================
// 🎹 MULTI-SAMPLER PRESETS
// =========================================================================
export const MULTI_SAMPLER_PRESETS = {
  acoustic: {
    name: 'Acoustic',
    presets: [
      {
        id: 'piano',
        name: 'Piano',
        color: '#FFD93D',
        multiSamples: [
          { url: '/audio/samples/instruments/piano/C1.ogg', note: 'C1', midiNote: 24 },
          { url: '/audio/samples/instruments/piano/C2.ogg', note: 'C2', midiNote: 36 },
          { url: '/audio/samples/instruments/piano/C3.ogg', note: 'C3', midiNote: 48 },
          { url: '/audio/samples/instruments/piano/C4.ogg', note: 'C4', midiNote: 60 },
          { url: '/audio/samples/instruments/piano/C5.ogg', note: 'C5', midiNote: 72 },
          { url: '/audio/samples/instruments/piano/C6.ogg', note: 'C6', midiNote: 84 },
          { url: '/audio/samples/instruments/piano/C7.ogg', note: 'C7', midiNote: 96 },
          { url: '/audio/samples/instruments/piano/C8.ogg', note: 'C8', midiNote: 108 }
        ]
      }
    ]
  }
};

// =========================================================================
// 🎛️ VA SYNTH PRESETS
// =========================================================================
export const VA_SYNTH_PRESETS = {
  keys: {
    name: 'Keys',
    presets: [
      { id: 'piano', name: 'Piano', presetName: 'Piano', color: '#A8E6CF' },
      { id: 'epiano', name: 'E.Piano', presetName: 'E. Piano', color: '#FFB6C1' },
      { id: 'organ', name: 'Organ', presetName: 'Organ', color: '#FFDAB9' }
    ]
  },
  bass: {
    name: 'Bass',
    presets: [
      { id: 'bass', name: 'Bass', presetName: 'Bass', color: '#87CEEB' },
      { id: '808bass', name: '808 Bass', presetName: '808 Bass', color: '#9370DB' },
      { id: 'subbass', name: 'Sub Bass', presetName: 'Sub Bass', color: '#4B0082' },
      { id: 'reesebass', name: 'Reese Bass', presetName: 'Reese Bass', color: '#8B008B' }
    ]
  },
  lead: {
    name: 'Lead',
    presets: [
      { id: 'classiclead', name: 'Classic Lead', presetName: 'Classic Lead', color: '#F08080' },
      { id: 'pluck', name: 'Pluck', presetName: 'Pluck', color: '#DDA0DD' },
      { id: 'supersawlead', name: 'Supersaw Lead', presetName: 'Supersaw Lead', color: '#FF1493' },
      { id: 'acidlead', name: 'Acid Lead', presetName: 'Acid Lead', color: '#FF6347' }
    ]
  },
  pad: {
    name: 'Pad',
    presets: [
      { id: 'warmpad', name: 'Warm Pad', presetName: 'Warm Pad', color: '#D8BFD8' },
      { id: 'strings', name: 'Strings', presetName: 'Strings', color: '#E6E6FA' },
      { id: 'lushpad', name: 'Lush Pad', presetName: 'Lush Pad', color: '#DDA0DD' },
      { id: 'analogpad', name: 'Analog Pad', presetName: 'Analog Pad', color: '#BA55D3' }
    ]
  },
  other: {
    name: 'Other',
    presets: [
      { id: 'bellsynth', name: 'Bell Synth', presetName: 'Bell Synth', color: '#B0E0E6' }
    ]
  }
};

/**
 * Helper to create instrument from preset
 */
export function createInstrumentFromPreset(category, preset, options = {}) {
  const { mixerTrackId = null, customName = null } = options;

  const baseInstrument = {
    id: preset.id || `${category}_${Date.now()}`,
    name: customName || preset.name,
    color: preset.color || '#888888'
  };

  // Only add mixerTrackId if explicitly provided
  // Otherwise, let the instrument store auto-assign it
  if (mixerTrackId) {
    baseInstrument.mixerTrackId = mixerTrackId;
  }

  switch (category) {
    case INSTRUMENT_CATEGORIES.SAMPLER:
      return {
        ...baseInstrument,
        type: INSTRUMENT_TYPES.SAMPLE,
        url: preset.url,
        baseNote: preset.baseNote || 60
      };

    case INSTRUMENT_CATEGORIES.MULTI_SAMPLER:
      return {
        ...baseInstrument,
        type: INSTRUMENT_TYPES.SAMPLE,
        multiSamples: preset.multiSamples
      };

    case INSTRUMENT_CATEGORIES.VA_SYNTH:
      return {
        ...baseInstrument,
        type: INSTRUMENT_TYPES.VASYNTH,
        presetName: preset.presetName
      };

    default:
      throw new Error(`Unknown category: ${category}`);
  }
}

/**
 * Get all presets for a category
 */
export function getPresetsForCategory(category) {
  switch (category) {
    case INSTRUMENT_CATEGORIES.SAMPLER:
      return SAMPLER_PRESETS;
    case INSTRUMENT_CATEGORIES.MULTI_SAMPLER:
      return MULTI_SAMPLER_PRESETS;
    case INSTRUMENT_CATEGORIES.VA_SYNTH:
      return VA_SYNTH_PRESETS;
    default:
      return {};
  }
}
