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
  VA_SYNTH: 'vaSynth',
  ZENITH_SYNTH: 'zenithSynth',
  AI_INSTRUMENT: 'aiInstrument'
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
  },
  [INSTRUMENT_CATEGORIES.ZENITH_SYNTH]: {
    name: 'Zenith Synth',
    icon: '⚡',
    description: 'Premium synthesizer with 4 oscillators, advanced filter & modulation',
    engine: 'ZenithSynthInstrument'
  },
  [INSTRUMENT_CATEGORIES.AI_INSTRUMENT]: {
    name: 'AI Instrument',
    icon: '✨',
    description: 'Generate instruments with AI (text-to-audio)',
    engine: 'AIInstrument'
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

// =========================================================================
// ⚡ ZENITH SYNTH PRESETS
// =========================================================================
export const ZENITH_SYNTH_PRESETS = {
  bass: {
    name: 'Bass',
    presets: [
      { id: 'deepsubbass', name: 'Deep Sub Bass', presetName: 'Deep Sub Bass', color: '#1a1a2e' },
      { id: 'reesebass', name: 'Reese Bass', presetName: 'Reese Bass', color: '#16213e' },
      { id: '808sub', name: '808 Sub', presetName: '808 Sub', color: '#0f3460' },
      { id: 'acidbass', name: 'Acid Bass', presetName: 'Acid Bass', color: '#533483' },
      { id: 'wobblebass', name: 'Wobble Bass', presetName: 'Wobble Bass', color: '#e94560' }
    ]
  },
  lead: {
    name: 'Lead',
    presets: [
      { id: 'supersawlead', name: 'Supersaw Lead', presetName: 'Supersaw Lead', color: '#ff6b6b' },
      { id: 'plucklead', name: 'Pluck Lead', presetName: 'Pluck Lead', color: '#ee5a6f' },
      { id: 'synclead', name: 'Sync Lead', presetName: 'Sync Lead', color: '#f06595' },
      { id: 'arplead', name: 'Arp Lead', presetName: 'Arp Lead', color: '#cc5de8' },
      { id: 'brasslead', name: 'Brass Lead', presetName: 'Brass Lead', color: '#845ef7' }
    ]
  },
  pad: {
    name: 'Pad',
    presets: [
      { id: 'warmpad', name: 'Warm Pad', presetName: 'Warm Pad', color: '#5f3dc4' },
      { id: 'dreampad', name: 'Dream Pad', presetName: 'Dream Pad', color: '#7950f2' },
      { id: 'strings', name: 'Strings', presetName: 'Strings', color: '#7048e8' },
      { id: 'ambientpad', name: 'Ambient Pad', presetName: 'Ambient Pad', color: '#6741d9' }
    ]
  },
  fx: {
    name: 'FX',
    presets: [
      { id: 'riser', name: 'Riser', presetName: 'Riser', color: '#4c6ef5' },
      { id: 'impact', name: 'Impact', presetName: 'Impact', color: '#4263eb' },
      { id: 'sweep', name: 'Sweep', presetName: 'Sweep', color: '#3b5bdb' }
    ]
  },
  keys: {
    name: 'Keys',
    presets: [
      { id: 'epiano', name: 'E.Piano', presetName: 'E.Piano', color: '#364fc7' },
      { id: 'organ', name: 'Organ', presetName: 'Organ', color: '#1c7ed6' },
      { id: 'bell', name: 'Bell', presetName: 'Bell', color: '#1971c2' }
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

    case INSTRUMENT_CATEGORIES.ZENITH_SYNTH:
      return {
        ...baseInstrument,
        type: INSTRUMENT_TYPES.ZENITH,
        presetName: preset.presetName
      };

    case INSTRUMENT_CATEGORIES.AI_INSTRUMENT:
      // AI instruments are created via AI Instrument Panel, not from preset
      // This case should not be called, but included for completeness
      throw new Error('AI instruments must be created via AI Instrument Panel');

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
    case INSTRUMENT_CATEGORIES.ZENITH_SYNTH:
      return ZENITH_SYNTH_PRESETS;
    case INSTRUMENT_CATEGORIES.AI_INSTRUMENT:
      // AI instruments don't have presets - they're generated on-demand
      return {};
    default:
      return {};
  }
}

// =========================================================================
// ✨ AI INSTRUMENT PRESETS (Placeholder - actual generation happens in AI Panel)
// =========================================================================
export const AI_INSTRUMENT_PRESETS = {
  // AI instruments are generated on-demand, not from presets
  // This is a placeholder structure for future use
  quickStart: {
    name: 'Quick Start',
    presets: []
  }
};
