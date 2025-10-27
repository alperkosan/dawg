/**
 * ParameterSchema.js
 *
 * Zod ile parameter validation şemaları.
 * Runtime'da parameter değerlerinin doğruluğunu garantiler.
 */

import { z } from 'zod';

/**
 * Waveform types
 */
export const WaveformSchema = z.enum(['sine', 'sawtooth', 'square', 'triangle']);

/**
 * Filter types
 */
export const FilterTypeSchema = z.enum([
  'lowpass',
  'highpass',
  'bandpass',
  'notch',
  'ladder',      // Moog-style
  'svf',         // State Variable Filter
  'comb',        // Comb filter
  'formant',     // Formant filter
]);

/**
 * Voice modes
 */
export const VoiceModeSchema = z.enum(['mono', 'poly']);

/**
 * LFO waveforms
 */
export const LFOWaveformSchema = z.enum([
  'sine',
  'triangle',
  'sawtooth',
  'square',
  'sample_hold',
  'random',
]);

/**
 * Oscillator configuration schema
 */
export const OscillatorSchema = z.object({
  enabled: z.boolean(),
  waveform: WaveformSchema,
  level: z.number().min(0).max(1),
  detune: z.number().min(-50).max(50),
  octave: z.number().int().min(-2).max(2),
  unison: z.object({
    enabled: z.boolean(),
    voices: z.number().int().min(2).max(8),
    detune: z.number().min(0).max(50),
    pan: z.number().min(0).max(100),
  }).optional(),
});

/**
 * Filter configuration schema
 */
export const FilterSchema = z.object({
  type: FilterTypeSchema,
  cutoff: z.number().min(20).max(20000),
  resonance: z.number().min(0.0001).max(30),
  envelopeAmount: z.number().min(-12000).max(12000),
  drive: z.number().min(1).max(10).optional().default(1),
  keyTracking: z.number().min(0).max(1).optional().default(0),
});

/**
 * Envelope configuration schema (ADSR+)
 */
export const EnvelopeSchema = z.object({
  delay: z.number().min(0).max(2).optional().default(0),
  attack: z.number().min(0.001).max(2),
  hold: z.number().min(0).max(2).optional().default(0),
  decay: z.number().min(0.001).max(4),
  sustain: z.number().min(0).max(1),
  release: z.number().min(0.001).max(4),
  velocity: z.number().min(0).max(1).optional().default(0.5),
});

/**
 * LFO configuration schema
 */
export const LFOSchema = z.object({
  waveform: LFOWaveformSchema,
  rate: z.number().min(0.01).max(20),
  depth: z.number().min(0).max(1),
  phase: z.number().min(0).max(360).optional().default(0),
  sync: z.boolean().optional().default(false),
  fadeIn: z.number().min(0).max(5).optional().default(0),
  monoPoly: z.enum(['mono', 'poly']).optional().default('poly'),
});

/**
 * Modulation slot schema
 */
export const ModulationSlotSchema = z.object({
  id: z.string(),
  source: z.enum([
    'lfo_1', 'lfo_2', 'lfo_3', 'lfo_4',
    'env_1', 'env_2', 'env_3', 'env_4',
    'velocity', 'aftertouch', 'mod_wheel', 'pitch_wheel',
  ]),
  destination: z.string(), // Parameter ID
  amount: z.number().min(-1).max(1),
  curve: z.enum(['linear', 'exponential', 's-curve']).optional().default('linear'),
  enabled: z.boolean().optional().default(true),
});

/**
 * Effect configuration base schema
 */
export const EffectBaseSchema = z.object({
  id: z.string(),
  type: z.string(),
  enabled: z.boolean().optional().default(true),
  bypass: z.boolean().optional().default(false),
  mix: z.number().min(0).max(1).optional().default(0.5),
});

/**
 * VASynth instrument configuration schema
 */
export const VASynthConfigSchema = z.object({
  // Oscillators
  oscillators: z.array(OscillatorSchema).length(3),

  // Filter
  filter: FilterSchema,
  filterEnvelope: EnvelopeSchema,

  // Amplitude
  amplitudeEnvelope: EnvelopeSchema,

  // LFOs
  lfos: z.array(LFOSchema).max(4).optional(),

  // Modulation
  modulation: z.array(ModulationSlotSchema).max(16).optional(),

  // Effects
  effects: z.array(EffectBaseSchema).max(8).optional(),

  // Global settings
  masterVolume: z.number().min(0).max(1),
  masterPan: z.number().min(-1).max(1).optional().default(0),
  voiceMode: VoiceModeSchema,
  portamentoTime: z.number().min(0).max(2),
  legato: z.boolean().optional().default(false),
  pitchBendRange: z.number().int().min(1).max(24).optional().default(2),

  // Metadata
  presetName: z.string().optional(),
  category: z.string().optional(),
});

/**
 * Parameter update schema - Single parameter change
 */
export const ParameterUpdateSchema = z.object({
  parameterId: z.string(),
  value: z.number(),
  ramp: z.enum(['none', 'linear', 'exponential']).optional().default('none'),
  duration: z.number().min(0).max(5).optional().default(0),
  record: z.boolean().optional().default(false), // For automation
});

/**
 * Batch parameter update schema
 */
export const BatchParameterUpdateSchema = z.object({
  updates: z.array(ParameterUpdateSchema),
  timestamp: z.number().optional(),
});

/**
 * Validation helpers
 */
export class ParameterValidator {
  /**
   * Validate VASynth configuration
   */
  static validateVASynthConfig(config) {
    try {
      return {
        success: true,
        data: VASynthConfigSchema.parse(config),
      };
    } catch (error) {
      return {
        success: false,
        errors: error.errors,
      };
    }
  }

  /**
   * Validate parameter update
   */
  static validateParameterUpdate(update) {
    try {
      return {
        success: true,
        data: ParameterUpdateSchema.parse(update),
      };
    } catch (error) {
      return {
        success: false,
        errors: error.errors,
      };
    }
  }

  /**
   * Validate batch update
   */
  static validateBatchUpdate(batch) {
    try {
      return {
        success: true,
        data: BatchParameterUpdateSchema.parse(batch),
      };
    } catch (error) {
      return {
        success: false,
        errors: error.errors,
      };
    }
  }

  /**
   * Safe parameter value getter with validation
   */
  static safeGetValue(value, min, max, defaultValue) {
    if (typeof value !== 'number' || isNaN(value)) {
      return defaultValue;
    }
    return Math.max(min, Math.min(max, value));
  }
}

/**
 * Default VASynth configuration
 */
export const DEFAULT_VASYNTH_CONFIG = {
  oscillators: [
    {
      enabled: true,
      waveform: 'sawtooth',
      level: 0.6,
      detune: 0,
      octave: 0,
      unison: {
        enabled: false,
        voices: 4,
        detune: 10,
        pan: 50,
      },
    },
    {
      enabled: false,
      waveform: 'sawtooth',
      level: 0.5,
      detune: 0,
      octave: 0,
      unison: {
        enabled: false,
        voices: 4,
        detune: 10,
        pan: 50,
      },
    },
    {
      enabled: false,
      waveform: 'sine',
      level: 0.5,
      detune: 0,
      octave: 0,
      unison: {
        enabled: false,
        voices: 4,
        detune: 10,
        pan: 50,
      },
    },
  ],

  filter: {
    type: 'lowpass',
    cutoff: 8000,
    resonance: 1,
    envelopeAmount: 0,
    drive: 1,
    keyTracking: 0,
  },

  filterEnvelope: {
    delay: 0,
    attack: 0.01,
    hold: 0,
    decay: 0.2,
    sustain: 0.5,
    release: 0.3,
    velocity: 0.5,
  },

  amplitudeEnvelope: {
    delay: 0,
    attack: 0.01,
    hold: 0,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3,
    velocity: 0.8,
  },

  lfos: [],

  modulation: [],

  effects: [],

  masterVolume: 0.8,
  masterPan: 0,
  voiceMode: 'poly',
  portamentoTime: 0,
  legato: false,
  pitchBendRange: 2,
};

export default {
  VASynthConfigSchema,
  ParameterUpdateSchema,
  BatchParameterUpdateSchema,
  ParameterValidator,
  DEFAULT_VASYNTH_CONFIG,
};
