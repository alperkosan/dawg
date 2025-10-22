/**
 * Audio Engine Configuration
 *
 * Centralized configuration for all audio engine parameters.
 * Makes it easy to adjust gain staging, performance settings, and audio quality.
 *
 * 🎚️ RAW SIGNAL PATH PHILOSOPHY:
 * Following professional DAW standards, this engine provides a completely clean signal path.
 * NO automatic EQ, compression, or limiting - all processing is user-controlled via optional effects.
 *
 * Signal Flow:
 * Instruments → UnifiedMixer (32 channels) → Master Bus Gain (headroom) → Master Volume → Analyzer → Output
 */

export const AudioEngineConfig = {
  // =================== GAIN STAGING (RAW Signal Path) ===================

  /**
   * Master gain staging configuration - CLEAN routing only
   */
  gain: {
    // Master volume (user-controllable output level)
    masterVolume: {
      default: 1.0,  // ✅ Unity gain (0dB) - let user control volume
      min: 0.0,
      max: 1.5,  // Allow 150% for quiet sources
      description: 'Master output volume (user control - RAW signal)'
    },

    // Master bus gain (internal headroom for mixing)
    masterMixerGain: {
      default: 1.0,  // ✅ Unity gain (0dB) - no automatic reduction
      min: 0.5,
      max: 1.0,
      description: 'Master bus gain for headroom (RAW - no processing)'
    },

    // Per-channel gain
    channel: {
      // Static mode: fixed gain for all channels
      static: {
        default: 1.0,  // ✅ Unity gain (0dB) - professional DAW standard
        min: 0.0,
        max: 2.0,  // Allow +6dB boost
        description: 'Per-channel gain (unity = 0dB, professional standard)'
      },

      // Adaptive mode: auto-calculated based on instrument count
      adaptive: {
        enabled: false,  // Disabled by default (using static unity gain)
        targetPeak: 0.75,  // Target summed peak level
        minGain: 0.1,  // Minimum gain per channel
        maxGain: 1.0,  // Maximum gain per channel (unity)
        description: 'Auto-adjust gain based on instrument count (disabled)'
      }
    },

    // Instrument-specific gain multipliers
    // ✅ DISABLED: Professional DAWs don't auto-reduce based on type
    // User controls all levels with faders - this is RAW signal philosophy
    instrumentTypes: {
      drum: 1.0,     // No auto-reduction
      bass: 1.0,     // No auto-reduction
      synth: 1.0,    // No auto-reduction
      sample: 1.0,   // No auto-reduction
      vasynth: 1.0,  // No auto-reduction
      granular: 1.0, // No auto-reduction
      undefined: 1.0 // No auto-reduction
    }
  },

  // =================== PERFORMANCE ===================

  performance: {
    // UnifiedMixer settings
    unifiedMixer: {
      enabled: true,
      maxChannels: 32,
      description: 'WASM-powered unified mixer (11x faster)'
    },

    // WASM backend
    wasmBackend: {
      enabled: true,
      fallbackToJS: true,
      initTimeout: 10000,  // 10 seconds
      description: 'WASM audio processing (2.23x faster)'
    },

    // Parameter batching
    parameterBatching: {
      enabled: true,
      updateInterval: 15,  // milliseconds
      description: 'Batch parameter updates to reduce overhead'
    },

    // Message pooling
    messagePooling: {
      enabled: true,
      poolSize: 100,
      description: 'Object pooling for zero GC pressure'
    },

    // Performance monitoring
    monitoring: {
      enabled: true,
      updateInterval: 100,  // milliseconds
      description: 'Track CPU usage and performance metrics'
    }
  },

  // =================== AUDIO QUALITY ===================

  quality: {
    // Analyzer settings
    analyzer: {
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      minDecibels: -90,
      maxDecibels: -10
    },

    // Latency hints
    latencyHint: 'interactive',  // 'interactive', 'balanced', 'playback'

    // Sample rate (null = use system default)
    sampleRate: null,

    // Channel configuration
    channels: {
      defaultCount: 2,  // Stereo
      defaultMode: 'explicit',
      defaultInterpretation: 'speakers'
    }
  },

  // =================== DEBUGGING ===================

  debug: {
    // Auto-run debug tools on startup
    autoDebug: {
      enabled: true,
      routing: true,
      gainStack: true,
      performance: true
    },

    // Logging
    logging: {
      enabled: true,
      level: 'info',  // 'debug', 'info', 'warn', 'error'
      categories: {
        routing: true,
        gain: true,
        performance: true,
        wasm: true,
        mixer: true
      }
    }
  },

  // =================== SAFETY LIMITS ===================

  safety: {
    // Peak limiting
    peakLimit: {
      enabled: true,
      threshold: 0.99,  // Prevent clipping
      description: 'Hard limit to prevent clipping'
    },

    // Channel count limits
    maxInstruments: 100,
    maxMixerChannels: 32,

    // Timeout limits
    initTimeout: 10000,      // Initialization timeout
    loadTimeout: 5000,       // Asset load timeout
    connectTimeout: 1000     // Connection timeout
  }
};

/**
 * Get current gain configuration based on mode
 * @param {number} instrumentCount - Number of active instruments
 * @returns {Object} Gain configuration
 */
export function getGainConfig(instrumentCount = 20) {
  const config = AudioEngineConfig.gain;

  // Adaptive mode
  if (config.channel.adaptive.enabled) {
    const targetPeak = config.channel.adaptive.targetPeak;
    const masterMixerGain = config.masterMixerGain.default;
    const masterGain = config.masterVolume.default;

    // Calculate required per-channel gain
    const calculatedGain = targetPeak / (instrumentCount * masterMixerGain * masterGain);

    // Clamp to safe bounds
    const channelGain = Math.max(
      config.channel.adaptive.minGain,
      Math.min(config.channel.adaptive.maxGain, calculatedGain)
    );

    return {
      mode: 'adaptive',
      channelGain,
      masterMixerGain,
      masterGain,
      expectedPeak: channelGain * instrumentCount * masterMixerGain * masterGain
    };
  }

  // Static mode (default)
  return {
    mode: 'static',
    channelGain: config.channel.static.default,
    masterMixerGain: config.masterMixerGain.default,
    masterGain: config.masterVolume.default,
    expectedPeak: config.channel.static.default * instrumentCount * config.masterMixerGain.default * config.masterVolume.default
  };
}

/**
 * Get instrument-specific gain multiplier
 * @param {string} instrumentType - Type of instrument
 * @returns {number} Gain multiplier
 */
export function getInstrumentGainMultiplier(instrumentType) {
  return AudioEngineConfig.gain.instrumentTypes[instrumentType] || 1.0;
}

/**
 * Validate and clamp a gain value
 * @param {number} value - Gain value to validate
 * @param {Object} limits - Min/max limits
 * @returns {number} Clamped gain value
 */
export function clampGain(value, limits) {
  return Math.max(limits.min, Math.min(limits.max, value));
}

/**
 * Calculate expected peak level
 * @param {number} channelGain - Per-channel gain
 * @param {number} instrumentCount - Number of instruments
 * @param {number} masterMixerGain - Master mixer gain
 * @param {number} masterGain - Master output gain
 * @returns {number} Expected peak level
 */
export function calculateExpectedPeak(channelGain, instrumentCount, masterMixerGain, masterGain) {
  return channelGain * instrumentCount * masterMixerGain * masterGain;
}

export default AudioEngineConfig;
