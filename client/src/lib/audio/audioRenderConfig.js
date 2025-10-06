/**
 * 🎛️ AUDIO RENDER CONFIGURATION
 *
 * Centralized configuration for audio rendering, export, and synthesis
 * All static values should be defined here and accessed dynamically
 */

import { AudioContextService } from '../services/AudioContextService';

/**
 * Get current BPM from transport or project settings
 * @returns {number} Current BPM
 */
export function getCurrentBPM() {
  try {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine?.transport?.bpm) {
      return audioEngine.transport.bpm;
    }
  } catch (error) {
    console.warn('🎛️ Could not get BPM from transport, using default');
  }
  return DEFAULT_BPM;
}

/**
 * Get current sample rate from audio context
 * @returns {number} Current sample rate
 */
export function getCurrentSampleRate() {
  try {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine?.audioContext?.sampleRate) {
      return audioEngine.audioContext.sampleRate;
    }
  } catch (error) {
    console.warn('🎛️ Could not get sample rate from context, using default');
  }
  return DEFAULT_SAMPLE_RATE;
}

// =================== DEFAULT VALUES ===================

export const DEFAULT_BPM = 140;
export const DEFAULT_SAMPLE_RATE = 44100;
export const DEFAULT_BIT_DEPTH = 16;
export const DEFAULT_CHANNELS = 2;

// =================== TIMING CONSTANTS ===================

export const STEPS_PER_BAR = 16;
export const BEATS_PER_BAR = 4;
export const STEPS_PER_BEAT = 4;

/**
 * Convert steps to beats
 * @param {number} steps - Steps value
 * @returns {number} Beats value
 */
export function stepsToBeat(steps) {
  return steps / STEPS_PER_BEAT;
}

/**
 * Convert beats to steps
 * @param {number} beats - Beats value
 * @returns {number} Steps value
 */
export function beatsToSteps(beats) {
  return beats * STEPS_PER_BEAT;
}

/**
 * Convert beats to seconds
 * @param {number} beats - Beats value
 * @param {number} bpm - BPM (optional, uses current if not provided)
 * @returns {number} Seconds
 */
export function beatsToSeconds(beats, bpm = null) {
  const currentBpm = bpm || getCurrentBPM();
  return beats * (60 / currentBpm);
}

/**
 * Convert seconds to beats
 * @param {number} seconds - Seconds value
 * @param {number} bpm - BPM (optional, uses current if not provided)
 * @returns {number} Beats
 */
export function secondsToBeats(seconds, bpm = null) {
  const currentBpm = bpm || getCurrentBPM();
  return seconds * (currentBpm / 60);
}

// =================== RENDER SETTINGS ===================

export const RENDER_CONFIG = {
  // Maximum render duration (seconds)
  MAX_RENDER_TIME: 300,

  // Minimum render duration (seconds)
  MIN_RENDER_TIME: 2,

  // Default fade out duration (seconds)
  DEFAULT_FADE_OUT: 0.1,

  // Pattern length calculation padding (beats)
  PATTERN_LENGTH_PADDING: 0.5,

  // Minimum pattern length (bars)
  MIN_PATTERN_LENGTH_BARS: 4,

  // Default pattern length (bars) when no notes
  DEFAULT_PATTERN_LENGTH_BARS: 4
};

// =================== SYNTH RENDERING SETTINGS ===================

export const SYNTH_CONFIG = {
  // Oscillator settings
  oscillator: {
    // Default waveform types
    defaultType: 'sine',
    availableTypes: ['sine', 'square', 'sawtooth', 'triangle'],

    // Detune range (cents)
    detuneRange: { min: -1200, max: 1200 },

    // Default gain/amplitude
    defaultGain: 0.5,
    maxGain: 1.0
  },

  // ADSR Envelope settings
  envelope: {
    // Attack time (seconds)
    attack: { min: 0.001, max: 2.0, default: 0.01 },

    // Decay time (seconds)
    decay: { min: 0.001, max: 2.0, default: 0.1 },

    // Sustain level (0-1)
    sustain: { min: 0, max: 1.0, default: 0.7 },

    // Release time (seconds)
    release: { min: 0.001, max: 5.0, default: 0.3 }
  },

  // Filter settings
  filter: {
    // Filter types
    availableTypes: ['lowpass', 'highpass', 'bandpass', 'notch'],
    defaultType: 'lowpass',

    // Frequency range (Hz)
    frequency: { min: 20, max: 20000, default: 1000 },

    // Q factor (resonance)
    q: { min: 0.0001, max: 100, default: 1 }
  },

  // LFO settings
  lfo: {
    // Rate (Hz)
    rate: { min: 0.1, max: 20, default: 1 },

    // Depth (0-1)
    depth: { min: 0, max: 1, default: 0.5 }
  }
};

// =================== PITCH/FREQUENCY SETTINGS ===================

export const PITCH_CONFIG = {
  // MIDI note range
  midiRange: { min: 0, max: 127 },

  // Reference pitch (A4 = 440 Hz, MIDI 69)
  referenceFrequency: 440,
  referenceMidiNote: 69,

  // Pitch bend range (semitones)
  pitchBendRange: 2
};

/**
 * Convert MIDI note number to frequency
 * @param {number} midiNote - MIDI note number (0-127)
 * @returns {number} Frequency in Hz
 */
export function midiToFrequency(midiNote) {
  return PITCH_CONFIG.referenceFrequency * Math.pow(2, (midiNote - PITCH_CONFIG.referenceMidiNote) / 12);
}

/**
 * Convert frequency to MIDI note number
 * @param {number} frequency - Frequency in Hz
 * @returns {number} MIDI note number
 */
export function frequencyToMidi(frequency) {
  return 12 * Math.log2(frequency / PITCH_CONFIG.referenceFrequency) + PITCH_CONFIG.referenceMidiNote;
}

// =================== EXPORT QUALITY PRESETS ===================

export const QUALITY_PRESETS = {
  DEMO: {
    sampleRate: 22050,
    bitDepth: 16,
    quality: 0.7,
    name: 'Demo Quality'
  },
  STANDARD: {
    sampleRate: 44100,
    bitDepth: 16,
    quality: 0.8,
    name: 'Standard (CD Quality)'
  },
  HIGH: {
    sampleRate: 48000,
    bitDepth: 24,
    quality: 0.9,
    name: 'High Quality'
  },
  STUDIO: {
    sampleRate: 96000,
    bitDepth: 32,
    quality: 1.0,
    name: 'Studio Quality'
  }
};

// =================== EXPORT FORMATS ===================

export const EXPORT_FORMATS = {
  WAV: 'audio/wav',
  MP3: 'audio/mpeg',
  OGG: 'audio/ogg',
  FLAC: 'audio/flac'
};

export const EXPORT_TYPES = {
  PATTERN: 'pattern',
  CHANNELS: 'channels',
  STEMS: 'stems',
  ARRANGEMENT: 'arrangement',
  SELECTION: 'selection',
  FREEZE: 'freeze'
};

// =================== CPU OPTIMIZATION ===================

export const CPU_CONFIG = {
  // Estimated CPU savings from freezing
  freezeSavingsPercent: { min: 60, max: 80 },

  // Batch processing delay (ms)
  batchProcessingDelay: 100,

  // Maximum concurrent renders
  maxConcurrentRenders: 2
};

/**
 * Calculate estimated CPU savings from pattern freeze
 * @param {Object} patternData - Pattern data
 * @returns {Object} CPU savings estimate
 */
export function calculateCpuSavings(patternData) {
  // Count complexity factors
  const instrumentCount = Object.keys(patternData?.data || {}).length;
  const noteCount = Object.values(patternData?.data || {})
    .reduce((total, notes) => total + (Array.isArray(notes) ? notes.length : 0), 0);

  // Estimate savings based on complexity
  let savingsPercent = CPU_CONFIG.freezeSavingsPercent.min;

  if (instrumentCount > 5) savingsPercent += 5;
  if (noteCount > 50) savingsPercent += 5;
  if (instrumentCount > 10) savingsPercent += 10;

  savingsPercent = Math.min(savingsPercent, CPU_CONFIG.freezeSavingsPercent.max);

  return {
    estimatedSavings: `${savingsPercent}%`,
    instrumentCount,
    noteCount,
    reason: 'Converted MIDI + synthesis to single audio sample'
  };
}

// =================== DEBUGGING ===================

export const DEBUG_CONFIG = {
  // Enable detailed logging
  verboseLogging: false,

  // Log render timing
  logRenderTiming: true,

  // Log synth parameter changes
  logSynthParams: false
};

/**
 * Log debug message if verbose logging is enabled
 * @param {string} category - Log category
 * @param  {...any} args - Arguments to log
 */
export function debugLog(category, ...args) {
  if (DEBUG_CONFIG.verboseLogging) {
    console.log(`🎛️ [${category}]`, ...args);
  }
}

export default {
  getCurrentBPM,
  getCurrentSampleRate,
  stepsToBeat,
  beatsToSteps,
  beatsToSeconds,
  secondsToBeats,
  midiToFrequency,
  frequencyToMidi,
  calculateCpuSavings,
  debugLog,
  DEFAULT_BPM,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_BIT_DEPTH,
  DEFAULT_CHANNELS,
  STEPS_PER_BAR,
  BEATS_PER_BAR,
  STEPS_PER_BEAT,
  RENDER_CONFIG,
  SYNTH_CONFIG,
  PITCH_CONFIG,
  QUALITY_PRESETS,
  EXPORT_FORMATS,
  EXPORT_TYPES,
  CPU_CONFIG,
  DEBUG_CONFIG
};
