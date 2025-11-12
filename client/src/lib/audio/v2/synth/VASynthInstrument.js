/**
 * VASynthInstrument.js
 *
 * Virtual Analog Synthesizer Instrument (v2)
 * Main synthesizer engine integrating all components
 *
 * Features:
 * - Voice allocation with advanced stealing
 * - Parameter controller with batching
 * - Unison oscillators
 * - ADSR+ envelopes
 * - Multi-mode filters
 */

import { VASynthVoice } from './VASynthVoice.js';
import { VoiceAllocator, VoiceMode, VoiceStealStrategy } from '../core/VoiceAllocator.js';
import { ParameterController } from '../core/ParameterController.js';
import { ParameterRegistry, ParameterID } from '../core/ParameterRegistry.js';
import { DEFAULT_VASYNTH_CONFIG, ParameterValidator } from '../core/ParameterSchema.js';
import { ModulationEngine, ModulationSourceType, ModulationCurve } from './modulation/ModulationEngine.js';
import { ModulationRouter } from './modulation/ModulationRouter.js';

/**
 * VASynthInstrument - Main synthesizer class
 */
export class VASynthInstrument {
  constructor(audioContext, config = {}) {
    this.audioContext = audioContext;
    this.id = config.id || `vasynth_${Date.now()}`;
    this.name = config.name || 'VASynth';

    // Configuration (merge with defaults)
    this.config = { ...DEFAULT_VASYNTH_CONFIG, ...config };

    // Validate configuration
    const validation = ParameterValidator.validateVASynthConfig(this.config);
    if (!validation.success) {
      console.error('[VASynth] Invalid configuration:', validation.errors);
      this.config = DEFAULT_VASYNTH_CONFIG;
    }

    // Master output
    this.output = audioContext.createGain();
    this.output.gain.value = this.config.masterVolume;

    // Master pan
    this.panner = audioContext.createStereoPanner();
    this.panner.pan.value = this.config.masterPan || 0;

    // Connect: output → panner
    this.output.connect(this.panner);

    // Voice allocator
    this.voiceAllocator = new VoiceAllocator(
      (index) => this._createVoice(index),
      16 // Max voices
    );

    // Set voice mode
    this.voiceAllocator.setVoiceMode(
      this.config.voiceMode === 'mono' ? VoiceMode.MONO :
      this.config.legato ? VoiceMode.LEGATO :
      VoiceMode.POLY
    );

    // Set voice stealing strategy
    this.voiceAllocator.setStealStrategy(VoiceStealStrategy.OLDEST);

    // Parameter controller
    this.parameterController = new ParameterController(audioContext, this);

    // Set up parameter controller callbacks
    this.parameterController.onBatchFlush = (updates) => {
      console.log(`[VASynth] Batch flushed: ${updates.length} parameters`);
    };

    // Modulation engine
    this.modulationEngine = new ModulationEngine(audioContext, 16);
    this.modulationRouter = new ModulationRouter(audioContext);

    // Set up modulation callback
    this.modulationEngine.onModulationUpdate = (modulationMap) => {
      this.modulationRouter.applyModulation(modulationMap);
    };

    // Initialize voices with configuration
    this._initializeVoices();

    // Initialize modulation targets
    this._initializeModulationTargets();

    // Start modulation updates
    this.modulationEngine.startUpdates();

    // State
    this.isDisposed = false;
    this.modulationMatrix = [];
  }

  /**
   * Create a single voice
   */
  _createVoice(index) {
    const voice = new VASynthVoice(this.audioContext, index);

    // Connect voice to master output
    voice.connect(this.output);

    return voice;
  }

  /**
   * Initialize all voices with current configuration
   */
  _initializeVoices() {
    const voices = this.voiceAllocator.getAllVoices();

    for (const voice of voices) {
      // Initialize oscillators
      voice.initOscillators(this.config.oscillators);

      // Set filter parameters
      voice.updateParameters({
        filterSettings: this.config.filter,
        filterEnvelope: this.config.filterEnvelope,
        amplitudeEnvelope: this.config.amplitudeEnvelope,
        portamentoTime: this.config.portamentoTime,
      });
    }
  }

  /**
   * Note on
   */
  noteOn(note, velocity = 100, time = null) {
    if (this.isDisposed) return;

    const voice = this.voiceAllocator.noteOn(note, velocity, time);

    if (!voice) {
      console.warn('[VASynth] Failed to allocate voice');
      return null;
    }

    return voice;
  }

  /**
   * Note off
   */
  noteOff(note, time = null) {
    if (this.isDisposed) return;

    this.voiceAllocator.noteOff(note, time);
  }

  /**
   * All notes off (panic)
   */
  allNotesOff(time = null) {
    this.voiceAllocator.allNotesOff(time);
  }

  /**
   * Sustain pedal on
   */
  sustainOn() {
    this.voiceAllocator.sustainOn();
  }

  /**
   * Sustain pedal off
   */
  sustainOff(time = null) {
    this.voiceAllocator.sustainOff(time);
  }

  /**
   * Update a single parameter (via ParameterController)
   */
  setParameter(parameterId, value, options = {}) {
    return this.parameterController.setParameter(parameterId, value, options);
  }

  /**
   * Update multiple parameters (via ParameterController)
   */
  setParameters(updates, options = {}) {
    this.parameterController.setParameters(updates, options);
  }

  /**
   * Update parameter (called by ParameterController)
   */
  updateParameter(parameterId, value, options = {}) {
    const { ramp, duration, time } = options;

    // Get parameter definition
    const paramDef = ParameterRegistry.get(parameterId);
    if (!paramDef) {
      console.warn(`[VASynth] Unknown parameter: ${parameterId}`);
      return;
    }

    // Route parameter to appropriate handler
    this._routeParameter(parameterId, value, ramp, duration, time);
  }

  /**
   * Route parameter to appropriate audio node/voice
   */
  _routeParameter(parameterId, value, ramp, duration, time) {
    // Master parameters
    if (parameterId === ParameterID.MASTER_VOLUME) {
      this._updateAudioParam(this.output.gain, value, ramp, duration, time);
      return;
    }

    if (parameterId === ParameterID.MASTER_PAN) {
      this._updateAudioParam(this.panner.pan, value, ramp, duration, time);
      return;
    }

    if (parameterId === ParameterID.PORTAMENTO_TIME) {
      this.config.portamentoTime = value;
      this._updateAllVoices({ portamentoTime: value });
      return;
    }

    if (parameterId === ParameterID.VOICE_MODE) {
      const mode = value === 'mono' ? VoiceMode.MONO : VoiceMode.POLY;
      this.voiceAllocator.setVoiceMode(mode);
      return;
    }

    // Oscillator parameters
    if (parameterId.startsWith('osc_')) {
      this._updateOscillatorParameter(parameterId, value);
      return;
    }

    // Filter parameters
    if (parameterId.startsWith('filter_')) {
      this._updateFilterParameter(parameterId, value, ramp, duration, time);
      return;
    }

    // Envelope parameters
    if (parameterId.startsWith('amp_env_') || parameterId.startsWith('filter_env_')) {
      this._updateEnvelopeParameter(parameterId, value);
      return;
    }
  }

  /**
   * Update oscillator parameter
   */
  _updateOscillatorParameter(parameterId, value) {
    // Parse parameter ID (e.g., "osc_1_level" → oscIndex=0, param="level")
    const parts = parameterId.split('_');
    const oscIndex = parseInt(parts[1]) - 1;
    const paramName = parts.slice(2).join('_');

    if (oscIndex < 0 || oscIndex >= 3) return;

    // Update config
    if (!this.config.oscillators[oscIndex]) {
      this.config.oscillators[oscIndex] = {};
    }

    // Handle nested unison parameters
    if (paramName.startsWith('unison_')) {
      const unisonParam = paramName.replace('unison_', '');

      if (!this.config.oscillators[oscIndex].unison) {
        this.config.oscillators[oscIndex].unison = {};
      }

      this.config.oscillators[oscIndex].unison[unisonParam] = value;
    } else {
      this.config.oscillators[oscIndex][paramName] = value;
    }

    // Update all voices
    this._updateAllVoices({
      oscillatorSettings: this.config.oscillators,
    });

    if (oscIndex === 0) {
      if (paramName === 'level') {
        this.modulationRouter.setBaseValue(ParameterID.OSC_1_LEVEL, value);
      } else if (paramName === 'detune') {
        this.modulationRouter.setBaseValue(ParameterID.OSC_1_DETUNE, value);
      }
    }
  }

  /**
   * Update filter parameter
   */
  _updateFilterParameter(parameterId, value, ramp, duration, time) {
    const paramName = parameterId.replace('filter_', '').replace('_', '');

    // Update config
    this.config.filter[paramName] = value;

    // Update all voices
    const voices = this.voiceAllocator.getAllVoices();

    for (const voice of voices) {
      if (parameterId === ParameterID.FILTER_CUTOFF) {
        this._updateAudioParam(voice.filter.frequency, value, ramp, duration, time);
        this.modulationRouter.setBaseValue(ParameterID.FILTER_CUTOFF, value);
      } else if (parameterId === ParameterID.FILTER_RESONANCE) {
        this._updateAudioParam(voice.filter.Q, value, ramp, duration, time);
        this.modulationRouter.setBaseValue(ParameterID.FILTER_RESONANCE, value);
      } else if (parameterId === ParameterID.FILTER_TYPE) {
        voice.filter.type = value;
      } else {
        voice.updateParameters({ filterSettings: this.config.filter });
      }
    }
  }

  /**
   * Update envelope parameter
   */
  _updateEnvelopeParameter(parameterId, value) {
    const isFilterEnv = parameterId.startsWith('filter_env_');
    const paramName = parameterId.replace(isFilterEnv ? 'filter_env_' : 'amp_env_', '');

    // Update config
    if (isFilterEnv) {
      this.config.filterEnvelope[paramName] = value;
    } else {
      this.config.amplitudeEnvelope[paramName] = value;
    }

    // Update all voices
    this._updateAllVoices({
      filterEnvelope: this.config.filterEnvelope,
      amplitudeEnvelope: this.config.amplitudeEnvelope,
    });
  }

  /**
   * Update all voices with parameters
   */
  _updateAllVoices(params) {
    const voices = this.voiceAllocator.getAllVoices();

    for (const voice of voices) {
      voice.updateParameters(params);
    }
  }

  /**
   * Update AudioParam with scheduling
   */
  _updateAudioParam(audioParam, value, ramp, duration, time) {
    const currentTime = time || this.audioContext.currentTime;

    audioParam.cancelScheduledValues(currentTime);
    audioParam.setValueAtTime(audioParam.value, currentTime);

    if (ramp === 'linear' && duration > 0) {
      audioParam.linearRampToValueAtTime(value, currentTime + duration);
    } else if (ramp === 'exponential' && duration > 0) {
      const safeValue = Math.max(0.0001, value);
      audioParam.exponentialRampToValueAtTime(safeValue, currentTime + duration);
    } else {
      audioParam.setValueAtTime(value, currentTime);
    }
  }

  /**
   * Load preset
   */
  loadPreset(preset) {
    // Validate preset
    const validation = ParameterValidator.validateVASynthConfig(preset);
    if (!validation.success) {
      console.error('[VASynth] Invalid preset:', validation.errors);
      return false;
    }

    // Update config
    this.config = { ...this.config, ...preset };

    // Reinitialize voices
    this._initializeVoices();

    // Update master parameters
    this.output.gain.value = this.config.masterVolume;
    this.panner.pan.value = this.config.masterPan || 0;

    return true;
  }

  /**
   * Update parameters (external API)
   */
  updateParameters(params = {}) {
    if (params.modulationMatrix) {
      this._updateModulationMatrix(params.modulationMatrix);
    }

    return true;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Connect to destination
   */
  connect(destination) {
    this.panner.connect(destination);
  }

  /**
   * Disconnect
   */
  disconnect() {
    this.panner.disconnect();
  }

  /**
   * Initialize modulation targets
   */
  _initializeModulationTargets() {
    // Register filter cutoff as modulation target
    // Use custom setter to update all voices
    this.modulationRouter.registerTarget(
      ParameterID.FILTER_CUTOFF,
      null,
      (value) => {
        this.config.filter.cutoff = value;
        const voices = this.voiceAllocator.getAllVoices();
        for (const voice of voices) {
          if (voice.filter && voice.filter.frequency) {
            voice.filter.frequency.setValueAtTime(value, this.audioContext.currentTime);
          }
        }
      }
    );

    // Register filter resonance
    this.modulationRouter.registerTarget(
      ParameterID.FILTER_RESONANCE,
      null,
      (value) => {
        this.config.filter.resonance = value;
        const voices = this.voiceAllocator.getAllVoices();
        for (const voice of voices) {
          if (voice.filter && voice.filter.Q) {
            voice.filter.Q.setValueAtTime(value, this.audioContext.currentTime);
          }
        }
      }
    );

    // Oscillator 1 level
    this.modulationRouter.registerTarget(
      ParameterID.OSC_1_LEVEL,
      null,
      (value) => {
        this.config.oscillators[0].level = value;
        const voices = this.voiceAllocator.getAllVoices();
        for (const voice of voices) {
          voice.updateParameters({
            oscillatorSettings: this.config.oscillators,
          });
        }
      }
    );

    // Oscillator 1 detune (used for pitch modulation)
    this.modulationRouter.registerTarget(
      ParameterID.OSC_1_DETUNE,
      null,
      (value) => {
        this.config.oscillators[0].detune = value;
        const voices = this.voiceAllocator.getAllVoices();
        for (const voice of voices) {
          voice.updateParameters({
            oscillatorSettings: this.config.oscillators,
          });
        }
      }
    );

    // Set initial base values
    this.modulationRouter.setBaseValue(ParameterID.FILTER_CUTOFF, this.config.filter.cutoff);
    this.modulationRouter.setBaseValue(ParameterID.FILTER_RESONANCE, this.config.filter.resonance);
    this.modulationRouter.setBaseValue(ParameterID.OSC_1_LEVEL, this.config.oscillators[0].level);
    this.modulationRouter.setBaseValue(ParameterID.OSC_1_DETUNE, this.config.oscillators[0].detune);

    if (this.modulationMatrix.length > 0) {
      this._updateModulationMatrix(this.modulationMatrix);
    }
  }

  /**
   * Get modulation engine
   */
  getModulationEngine() {
    return this.modulationEngine;
  }

  /**
   * Get modulation router
   */
  getModulationRouter() {
    return this.modulationRouter;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      activeVoices: this.voiceAllocator.getActiveVoiceCount(),
      totalVoices: this.voiceAllocator.getVoiceCount(),
      parameterController: this.parameterController.getMetrics(),
      modulation: {
        activeSlots: this.modulationEngine.getActiveSlotCount(),
        totalSlots: this.modulationEngine.getSlotCount(),
      },
    };
  }

  /**
   * Apply modulation matrix data to modulation engine
   */
  _updateModulationMatrix(matrix = []) {
    this.modulationMatrix = Array.isArray(matrix) ? matrix : [];

    // Reset existing slots
    this.modulationEngine.slots.forEach((slot) => slot.reset());

    // Refresh base values
    this.modulationRouter.setBaseValue(ParameterID.FILTER_CUTOFF, this.config.filter.cutoff);
    this.modulationRouter.setBaseValue(ParameterID.FILTER_RESONANCE, this.config.filter.resonance);
    this.modulationRouter.setBaseValue(ParameterID.OSC_1_LEVEL, this.config.oscillators[0].level);
    this.modulationRouter.setBaseValue(ParameterID.OSC_1_DETUNE, this.config.oscillators[0].detune);

    for (const slotConfig of this.modulationMatrix) {
      if (!slotConfig || slotConfig.enabled === false) continue;

      const sourceId = this._mapModulationSource(slotConfig.source);
      const destinationId = this._mapModulationDestination(slotConfig.target);

      if (!sourceId || !destinationId) {
        if (import.meta.env.DEV) {
          console.warn('[VASynth] Unsupported modulation route:', slotConfig);
        }
        continue;
      }

      const amount = Math.max(-1, Math.min(1, slotConfig.amount ?? 0));
      const curve = this._mapModulationCurve(slotConfig.curve);

      const slot = this.modulationEngine.addSlot(sourceId, destinationId, amount, curve);
      if (slot && slotConfig.id) {
        slot.id = slotConfig.id;
      }
    }

    if (!this.modulationEngine.updateInterval) {
      this.modulationEngine.startUpdates();
    }
  }

  _mapModulationSource(sourceId) {
    switch (sourceId) {
      case 'lfo_1':
      case 'lfo_2':
      case 'lfo_3':
      case 'lfo_4':
        return sourceId;
      case 'env_1':
      case 'env_2':
      case 'env_3':
      case 'env_4':
        return sourceId;
      case 'velocity':
        return ModulationSourceType.VELOCITY;
      case 'aftertouch':
        return ModulationSourceType.AFTERTOUCH;
      case 'modwheel':
      case 'mod_wheel':
        return ModulationSourceType.MOD_WHEEL;
      default:
        return null;
    }
  }

  _mapModulationDestination(targetId) {
    switch (targetId) {
      case 'filter.cutoff':
        return ParameterID.FILTER_CUTOFF;
      case 'filter.resonance':
        return ParameterID.FILTER_RESONANCE;
      case 'osc.level':
        return ParameterID.OSC_1_LEVEL;
      case 'osc.detune':
      case 'osc.pitch':
        return ParameterID.OSC_1_DETUNE;
      default:
        return null;
    }
  }

  _mapModulationCurve(curve) {
    if (!curve) return ModulationCurve.LINEAR;
    const normalized = curve.toLowerCase();
    if (normalized === 'exponential') return ModulationCurve.EXPONENTIAL;
    if (normalized === 's_curve' || normalized === 's-curve') return ModulationCurve.S_CURVE;
    return ModulationCurve.LINEAR;
  }

  /**
   * Dispose instrument
   */
  dispose() {
    if (this.isDisposed) return;

    this.allNotesOff();
    this.voiceAllocator.dispose();
    this.parameterController.dispose();
    this.modulationEngine.dispose();
    this.modulationRouter.dispose();

    this.output.disconnect();
    this.panner.disconnect();

    this.isDisposed = true;
  }
}

export default VASynthInstrument;
