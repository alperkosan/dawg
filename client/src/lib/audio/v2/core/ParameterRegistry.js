/**
 * ParameterRegistry.js
 *
 * Merkezi parametre kayıt ve yönetim sistemi.
 * Tüm audio parametrelerinin tip-güvenli şekilde tanımlanması ve erişilmesi.
 *
 * Özellikler:
 * - Tip-güvenli parameter ID'ler
 * - Metadata (min, max, default, unit, curve)
 * - Semantic grouping (Tonal, Filter, Dynamics, etc.)
 * - Search & discovery desteği
 */

/**
 * Parameter grupları - Kullanıcı deneyimi için semantik kategoriler
 */
export const ParameterGroup = {
  TONAL: 'tonal',           // Oscillators, Pitch, Tuning
  FILTER: 'filter',         // Cutoff, Resonance, Envelope
  DYNAMICS: 'dynamics',     // ADSR, Velocity, Compression
  SPATIAL: 'spatial',       // Pan, Stereo Width, Reverb
  TIMBRE: 'timbre',         // Waveform, Unison, Harmonics
  TEMPORAL: 'temporal',     // LFO, Delay, Modulation Rate
  GLOBAL: 'global',         // Master Volume, Gain
};

/**
 * Parameter curve types - Değer interpolasyonu için
 */
export const ParameterCurve = {
  LINEAR: 'linear',
  EXPONENTIAL: 'exponential',
  LOGARITHMIC: 'logarithmic',
  S_CURVE: 's-curve',
};

/**
 * Parameter Unit - Görsel feedback için
 */
export const ParameterUnit = {
  NONE: '',
  PERCENT: '%',
  DECIBEL: 'dB',
  HERTZ: 'Hz',
  SECONDS: 's',
  MILLISECONDS: 'ms',
  CENTS: 'cents',
  SEMITONES: 'st',
  OCTAVES: 'oct',
  DEGREES: '°',
};

/**
 * Parameter ID'ler - Tip-güvenli erişim için enum-like yapı
 */
export const ParameterID = {
  // Oscillator 1
  OSC_1_ENABLED: 'osc_1_enabled',
  OSC_1_WAVEFORM: 'osc_1_waveform',
  OSC_1_LEVEL: 'osc_1_level',
  OSC_1_DETUNE: 'osc_1_detune',
  OSC_1_OCTAVE: 'osc_1_octave',
  OSC_1_UNISON_ENABLED: 'osc_1_unison_enabled',
  OSC_1_UNISON_VOICES: 'osc_1_unison_voices',
  OSC_1_UNISON_DETUNE: 'osc_1_unison_detune',
  OSC_1_UNISON_PAN: 'osc_1_unison_pan',

  // Oscillator 2
  OSC_2_ENABLED: 'osc_2_enabled',
  OSC_2_WAVEFORM: 'osc_2_waveform',
  OSC_2_LEVEL: 'osc_2_level',
  OSC_2_DETUNE: 'osc_2_detune',
  OSC_2_OCTAVE: 'osc_2_octave',
  OSC_2_UNISON_ENABLED: 'osc_2_unison_enabled',
  OSC_2_UNISON_VOICES: 'osc_2_unison_voices',
  OSC_2_UNISON_DETUNE: 'osc_2_unison_detune',
  OSC_2_UNISON_PAN: 'osc_2_unison_pan',

  // Oscillator 3
  OSC_3_ENABLED: 'osc_3_enabled',
  OSC_3_WAVEFORM: 'osc_3_waveform',
  OSC_3_LEVEL: 'osc_3_level',
  OSC_3_DETUNE: 'osc_3_detune',
  OSC_3_OCTAVE: 'osc_3_octave',
  OSC_3_UNISON_ENABLED: 'osc_3_unison_enabled',
  OSC_3_UNISON_VOICES: 'osc_3_unison_voices',
  OSC_3_UNISON_DETUNE: 'osc_3_unison_detune',
  OSC_3_UNISON_PAN: 'osc_3_unison_pan',

  // Filter
  FILTER_TYPE: 'filter_type',
  FILTER_CUTOFF: 'filter_cutoff',
  FILTER_RESONANCE: 'filter_resonance',
  FILTER_ENVELOPE_AMOUNT: 'filter_envelope_amount',
  FILTER_DRIVE: 'filter_drive',
  FILTER_KEY_TRACKING: 'filter_key_tracking',

  // Filter Envelope
  FILTER_ENV_DELAY: 'filter_env_delay',
  FILTER_ENV_ATTACK: 'filter_env_attack',
  FILTER_ENV_HOLD: 'filter_env_hold',
  FILTER_ENV_DECAY: 'filter_env_decay',
  FILTER_ENV_SUSTAIN: 'filter_env_sustain',
  FILTER_ENV_RELEASE: 'filter_env_release',
  FILTER_ENV_VELOCITY: 'filter_env_velocity',

  // Amplitude Envelope
  AMP_ENV_DELAY: 'amp_env_delay',
  AMP_ENV_ATTACK: 'amp_env_attack',
  AMP_ENV_HOLD: 'amp_env_hold',
  AMP_ENV_DECAY: 'amp_env_decay',
  AMP_ENV_SUSTAIN: 'amp_env_sustain',
  AMP_ENV_RELEASE: 'amp_env_release',
  AMP_ENV_VELOCITY: 'amp_env_velocity',

  // LFO 1
  LFO_1_WAVEFORM: 'lfo_1_waveform',
  LFO_1_RATE: 'lfo_1_rate',
  LFO_1_DEPTH: 'lfo_1_depth',
  LFO_1_PHASE: 'lfo_1_phase',
  LFO_1_SYNC: 'lfo_1_sync',
  LFO_1_FADE_IN: 'lfo_1_fade_in',
  LFO_1_MONO_POLY: 'lfo_1_mono_poly',

  // LFO 2
  LFO_2_WAVEFORM: 'lfo_2_waveform',
  LFO_2_RATE: 'lfo_2_rate',
  LFO_2_DEPTH: 'lfo_2_depth',
  LFO_2_PHASE: 'lfo_2_phase',
  LFO_2_SYNC: 'lfo_2_sync',
  LFO_2_FADE_IN: 'lfo_2_fade_in',
  LFO_2_MONO_POLY: 'lfo_2_mono_poly',

  // Global
  MASTER_VOLUME: 'master_volume',
  MASTER_PAN: 'master_pan',
  VOICE_MODE: 'voice_mode',
  PORTAMENTO_TIME: 'portamento_time',
  LEGATO: 'legato',
  PITCH_BEND_RANGE: 'pitch_bend_range',
};

/**
 * Parameter metadata definition
 */
class ParameterDefinition {
  constructor({
    id,
    name,
    group,
    min = 0,
    max = 1,
    defaultValue,
    step = 0.01,
    unit = ParameterUnit.NONE,
    curve = ParameterCurve.LINEAR,
    displayFormatter = null,
    audioFormatter = null,
    locked = false,
    favorite = false,
    searchTags = [],
  }) {
    this.id = id;
    this.name = name;
    this.group = group;
    this.min = min;
    this.max = max;
    this.defaultValue = defaultValue !== undefined ? defaultValue : min;
    this.step = step;
    this.unit = unit;
    this.curve = curve;
    this.displayFormatter = displayFormatter || ((v) => `${v.toFixed(2)}${unit}`);
    this.audioFormatter = audioFormatter || ((v) => v);
    this.locked = locked;
    this.favorite = favorite;
    this.searchTags = [name.toLowerCase(), ...searchTags];
  }

  /**
   * Normalize value (0-1) to actual range
   */
  normalize(value) {
    const clamped = Math.max(this.min, Math.min(this.max, value));

    if (this.curve === ParameterCurve.EXPONENTIAL) {
      // Exponential scaling (e.g., for frequency)
      const minLog = Math.log(this.min || 0.001);
      const maxLog = Math.log(this.max);
      const normalized = (Math.log(clamped) - minLog) / (maxLog - minLog);
      return normalized;
    } else if (this.curve === ParameterCurve.LOGARITHMIC) {
      // Logarithmic scaling
      const normalized = (clamped - this.min) / (this.max - this.min);
      return Math.pow(normalized, 0.5);
    } else if (this.curve === ParameterCurve.S_CURVE) {
      // S-curve (smooth interpolation)
      const normalized = (clamped - this.min) / (this.max - this.min);
      return normalized * normalized * (3 - 2 * normalized);
    }

    // Linear (default)
    return (clamped - this.min) / (this.max - this.min);
  }

  /**
   * Denormalize (0-1) to actual value
   */
  denormalize(normalized) {
    const clamped = Math.max(0, Math.min(1, normalized));

    if (this.curve === ParameterCurve.EXPONENTIAL) {
      const minLog = Math.log(this.min || 0.001);
      const maxLog = Math.log(this.max);
      return Math.exp(minLog + clamped * (maxLog - minLog));
    } else if (this.curve === ParameterCurve.LOGARITHMIC) {
      const linear = Math.pow(clamped, 2);
      return this.min + linear * (this.max - this.min);
    } else if (this.curve === ParameterCurve.S_CURVE) {
      const t = clamped;
      const smoothed = t * t * (3 - 2 * t);
      return this.min + smoothed * (this.max - this.min);
    }

    // Linear
    return this.min + clamped * (this.max - this.min);
  }

  /**
   * Clamp value to range
   */
  clamp(value) {
    return Math.max(this.min, Math.min(this.max, value));
  }

  /**
   * Format for display (UI)
   */
  formatDisplay(value) {
    return this.displayFormatter(value);
  }

  /**
   * Format for audio engine
   */
  formatAudio(value) {
    return this.audioFormatter(value);
  }
}

/**
 * ParameterRegistry - Merkezi kayıt sistemi
 */
class ParameterRegistryClass {
  constructor() {
    this.parameters = new Map();
    this.groupedParameters = new Map();
    this._initializeParameters();
  }

  /**
   * Tüm parametreleri kaydet
   */
  _initializeParameters() {
    // Oscillator 1 parameters
    this.register(new ParameterDefinition({
      id: ParameterID.OSC_1_ENABLED,
      name: 'Osc 1 Enabled',
      group: ParameterGroup.TONAL,
      min: 0,
      max: 1,
      defaultValue: 1,
      step: 1,
      displayFormatter: (v) => v ? 'On' : 'Off',
      searchTags: ['oscillator', 'osc1', 'enable'],
    }));

    this.register(new ParameterDefinition({
      id: ParameterID.OSC_1_WAVEFORM,
      name: 'Osc 1 Waveform',
      group: ParameterGroup.TONAL,
      min: 0,
      max: 3,
      defaultValue: 0,
      step: 1,
      displayFormatter: (v) => ['Sine', 'Sawtooth', 'Square', 'Triangle'][Math.floor(v)],
      searchTags: ['oscillator', 'osc1', 'wave', 'shape'],
    }));

    this.register(new ParameterDefinition({
      id: ParameterID.OSC_1_LEVEL,
      name: 'Osc 1 Level',
      group: ParameterGroup.TONAL,
      min: 0,
      max: 1,
      defaultValue: 0.6,
      unit: ParameterUnit.PERCENT,
      displayFormatter: (v) => `${Math.round(v * 100)}%`,
      searchTags: ['oscillator', 'osc1', 'volume', 'level', 'mix'],
    }));

    this.register(new ParameterDefinition({
      id: ParameterID.OSC_1_DETUNE,
      name: 'Osc 1 Detune',
      group: ParameterGroup.TONAL,
      min: -50,
      max: 50,
      defaultValue: 0,
      unit: ParameterUnit.CENTS,
      displayFormatter: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} cents`,
      searchTags: ['oscillator', 'osc1', 'detune', 'pitch', 'tuning'],
    }));

    this.register(new ParameterDefinition({
      id: ParameterID.OSC_1_OCTAVE,
      name: 'Osc 1 Octave',
      group: ParameterGroup.TONAL,
      min: -2,
      max: 2,
      defaultValue: 0,
      step: 1,
      unit: ParameterUnit.OCTAVES,
      displayFormatter: (v) => `${v >= 0 ? '+' : ''}${v} oct`,
      searchTags: ['oscillator', 'osc1', 'octave', 'pitch'],
    }));

    // Unison parameters for Osc 1
    this.register(new ParameterDefinition({
      id: ParameterID.OSC_1_UNISON_ENABLED,
      name: 'Osc 1 Unison',
      group: ParameterGroup.TIMBRE,
      min: 0,
      max: 1,
      defaultValue: 0,
      step: 1,
      displayFormatter: (v) => v ? 'On' : 'Off',
      searchTags: ['oscillator', 'osc1', 'unison', 'supersaw'],
    }));

    this.register(new ParameterDefinition({
      id: ParameterID.OSC_1_UNISON_VOICES,
      name: 'Osc 1 Unison Voices',
      group: ParameterGroup.TIMBRE,
      min: 2,
      max: 8,
      defaultValue: 4,
      step: 1,
      displayFormatter: (v) => `${Math.floor(v)} voices`,
      searchTags: ['oscillator', 'osc1', 'unison', 'voices'],
    }));

    this.register(new ParameterDefinition({
      id: ParameterID.OSC_1_UNISON_DETUNE,
      name: 'Osc 1 Unison Detune',
      group: ParameterGroup.TIMBRE,
      min: 0,
      max: 50,
      defaultValue: 10,
      unit: ParameterUnit.CENTS,
      displayFormatter: (v) => `${v.toFixed(1)} cents`,
      searchTags: ['oscillator', 'osc1', 'unison', 'detune', 'spread'],
    }));

    this.register(new ParameterDefinition({
      id: ParameterID.OSC_1_UNISON_PAN,
      name: 'Osc 1 Unison Pan',
      group: ParameterGroup.SPATIAL,
      min: 0,
      max: 100,
      defaultValue: 50,
      unit: ParameterUnit.PERCENT,
      displayFormatter: (v) => `${Math.round(v)}%`,
      searchTags: ['oscillator', 'osc1', 'unison', 'pan', 'stereo', 'width'],
    }));

    // Filter parameters
    this.register(new ParameterDefinition({
      id: ParameterID.FILTER_CUTOFF,
      name: 'Filter Cutoff',
      group: ParameterGroup.FILTER,
      min: 20,
      max: 20000,
      defaultValue: 8000,
      curve: ParameterCurve.EXPONENTIAL,
      unit: ParameterUnit.HERTZ,
      displayFormatter: (v) => v >= 1000 ? `${(v / 1000).toFixed(2)} kHz` : `${Math.round(v)} Hz`,
      searchTags: ['filter', 'cutoff', 'frequency', 'brightness'],
    }));

    this.register(new ParameterDefinition({
      id: ParameterID.FILTER_RESONANCE,
      name: 'Filter Resonance',
      group: ParameterGroup.FILTER,
      min: 0.0001,
      max: 30,
      defaultValue: 1,
      curve: ParameterCurve.LOGARITHMIC,
      displayFormatter: (v) => v.toFixed(2),
      searchTags: ['filter', 'resonance', 'q', 'peak'],
    }));

    this.register(new ParameterDefinition({
      id: ParameterID.FILTER_ENVELOPE_AMOUNT,
      name: 'Filter Env Amount',
      group: ParameterGroup.FILTER,
      min: -12000,
      max: 12000,
      defaultValue: 0,
      unit: ParameterUnit.HERTZ,
      displayFormatter: (v) => {
        const abs = Math.abs(v);
        const sign = v >= 0 ? '+' : '-';
        return abs >= 1000 ? `${sign}${(abs / 1000).toFixed(2)} kHz` : `${sign}${Math.round(abs)} Hz`;
      },
      searchTags: ['filter', 'envelope', 'modulation', 'amount'],
    }));

    this.register(new ParameterDefinition({
      id: ParameterID.FILTER_DRIVE,
      name: 'Filter Drive',
      group: ParameterGroup.TIMBRE,
      min: 1,
      max: 10,
      defaultValue: 1,
      curve: ParameterCurve.LOGARITHMIC,
      displayFormatter: (v) => `${v.toFixed(2)}x`,
      searchTags: ['filter', 'drive', 'saturation', 'distortion'],
    }));

    // Filter Envelope
    const filterEnvDefaults = {
      delay: { min: 0, max: 2, default: 0, unit: ParameterUnit.SECONDS },
      attack: { min: 0.001, max: 2, default: 0.01, unit: ParameterUnit.SECONDS },
      hold: { min: 0, max: 2, default: 0, unit: ParameterUnit.SECONDS },
      decay: { min: 0.001, max: 4, default: 0.2, unit: ParameterUnit.SECONDS },
      sustain: { min: 0, max: 1, default: 0.5, unit: ParameterUnit.PERCENT },
      release: { min: 0.001, max: 4, default: 0.3, unit: ParameterUnit.SECONDS },
    };

    ['delay', 'attack', 'hold', 'decay', 'sustain', 'release'].forEach((stage) => {
      const config = filterEnvDefaults[stage];
      this.register(new ParameterDefinition({
        id: `filter_env_${stage}`,
        name: `Filter Env ${stage.charAt(0).toUpperCase() + stage.slice(1)}`,
        group: ParameterGroup.FILTER,
        min: config.min,
        max: config.max,
        defaultValue: config.default,
        unit: config.unit,
        curve: stage === 'sustain' ? ParameterCurve.LINEAR : ParameterCurve.LOGARITHMIC,
        displayFormatter: (v) => {
          if (stage === 'sustain') return `${Math.round(v * 100)}%`;
          return v >= 1 ? `${v.toFixed(2)} s` : `${Math.round(v * 1000)} ms`;
        },
        searchTags: ['filter', 'envelope', 'adsr', stage],
      }));
    });

    // Amplitude Envelope
    ['delay', 'attack', 'hold', 'decay', 'sustain', 'release'].forEach((stage) => {
      const config = filterEnvDefaults[stage];
      this.register(new ParameterDefinition({
        id: `amp_env_${stage}`,
        name: `Amp Env ${stage.charAt(0).toUpperCase() + stage.slice(1)}`,
        group: ParameterGroup.DYNAMICS,
        min: config.min,
        max: config.max,
        defaultValue: config.default,
        unit: config.unit,
        curve: stage === 'sustain' ? ParameterCurve.LINEAR : ParameterCurve.LOGARITHMIC,
        displayFormatter: (v) => {
          if (stage === 'sustain') return `${Math.round(v * 100)}%`;
          return v >= 1 ? `${v.toFixed(2)} s` : `${Math.round(v * 1000)} ms`;
        },
        searchTags: ['amplitude', 'envelope', 'adsr', stage],
      }));
    });

    // Master parameters
    this.register(new ParameterDefinition({
      id: ParameterID.MASTER_VOLUME,
      name: 'Master Volume',
      group: ParameterGroup.GLOBAL,
      min: 0,
      max: 1,
      defaultValue: 0.8,
      curve: ParameterCurve.LOGARITHMIC,
      unit: ParameterUnit.PERCENT,
      displayFormatter: (v) => `${Math.round(v * 100)}%`,
      searchTags: ['master', 'volume', 'gain', 'level'],
    }));

    this.register(new ParameterDefinition({
      id: ParameterID.MASTER_PAN,
      name: 'Master Pan',
      group: ParameterGroup.SPATIAL,
      min: -1,
      max: 1,
      defaultValue: 0,
      displayFormatter: (v) => {
        if (v === 0) return 'Center';
        if (v < 0) return `${Math.round(Math.abs(v) * 100)}% L`;
        return `${Math.round(v * 100)}% R`;
      },
      searchTags: ['master', 'pan', 'stereo', 'balance'],
    }));

    this.register(new ParameterDefinition({
      id: ParameterID.PORTAMENTO_TIME,
      name: 'Portamento',
      group: ParameterGroup.TEMPORAL,
      min: 0,
      max: 2,
      defaultValue: 0,
      curve: ParameterCurve.LOGARITHMIC,
      unit: ParameterUnit.SECONDS,
      displayFormatter: (v) => v === 0 ? 'Off' : (v >= 1 ? `${v.toFixed(2)} s` : `${Math.round(v * 1000)} ms`),
      searchTags: ['portamento', 'glide', 'slide'],
    }));

    // Group parameters by category
    this._buildGroupIndex();
  }

  /**
   * Register a parameter
   */
  register(paramDef) {
    this.parameters.set(paramDef.id, paramDef);
  }

  /**
   * Get parameter definition by ID
   */
  get(id) {
    return this.parameters.get(id);
  }

  /**
   * Get all parameters
   */
  getAll() {
    return Array.from(this.parameters.values());
  }

  /**
   * Get parameters by group
   */
  getByGroup(group) {
    return this.groupedParameters.get(group) || [];
  }

  /**
   * Search parameters by name or tags
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter((param) =>
      param.searchTags.some((tag) => tag.includes(lowerQuery))
    );
  }

  /**
   * Build grouped parameter index
   */
  _buildGroupIndex() {
    this.groupedParameters.clear();

    for (const param of this.parameters.values()) {
      if (!this.groupedParameters.has(param.group)) {
        this.groupedParameters.set(param.group, []);
      }
      this.groupedParameters.get(param.group).push(param);
    }
  }

  /**
   * Get all groups
   */
  getGroups() {
    return Array.from(this.groupedParameters.keys());
  }
}

// Singleton instance
export const ParameterRegistry = new ParameterRegistryClass();
