/**
 * ModulationEngine.js
 *
 * Central modulation routing and processing system.
 * Manages modulation sources, destinations, and connections.
 *
 * Features:
 * - Up to 16 modulation slots
 * - Multiple sources (LFO, Envelope, MIDI)
 * - Any parameter as destination
 * - Bipolar modulation (-1 to +1)
 * - Curve shaping
 */

import { LFO } from './LFO.js';
import { ParameterRegistry } from '../../core/ParameterRegistry.js';

/**
 * Modulation source types
 */
export const ModulationSourceType = {
  LFO_1: 'lfo_1',
  LFO_2: 'lfo_2',
  LFO_3: 'lfo_3',
  LFO_4: 'lfo_4',
  ENV_1: 'env_1',
  ENV_2: 'env_2',
  ENV_3: 'env_3',
  ENV_4: 'env_4',
  VELOCITY: 'velocity',
  AFTERTOUCH: 'aftertouch',
  MOD_WHEEL: 'mod_wheel',
  PITCH_WHEEL: 'pitch_wheel',
};

/**
 * Modulation curve types
 */
export const ModulationCurve = {
  LINEAR: 'linear',
  EXPONENTIAL: 'exponential',
  S_CURVE: 's-curve',
};

/**
 * Modulation slot
 */
export class ModulationSlot {
  constructor(id) {
    this.id = id;
    this.enabled = false;
    this.source = null;           // ModulationSourceType
    this.destination = null;      // Parameter ID
    this.amount = 0;              // -1 to +1 (bipolar)
    this.curve = ModulationCurve.LINEAR;

    // Internal state
    this.sourceValue = 0;         // Current source value
    this.outputValue = 0;         // After amount & curve
  }

  /**
   * Calculate output value from source
   */
  calculate(sourceValue) {
    this.sourceValue = sourceValue;

    if (!this.enabled || this.amount === 0) {
      this.outputValue = 0;
      return 0;
    }

    // Apply amount
    let output = sourceValue * this.amount;

    // Apply curve
    switch (this.curve) {
      case ModulationCurve.EXPONENTIAL:
        // Exponential curve: x^2 (preserve sign)
        output = Math.sign(output) * Math.pow(Math.abs(output), 2);
        break;

      case ModulationCurve.S_CURVE:
        // S-curve (smooth step)
        const t = (output + 1) / 2; // Normalize to 0-1
        const smoothed = t * t * (3 - 2 * t);
        output = smoothed * 2 - 1; // Back to -1 to +1
        break;

      case ModulationCurve.LINEAR:
      default:
        // No transformation
        break;
    }

    this.outputValue = output;
    return output;
  }

  /**
   * Reset slot
   */
  reset() {
    this.enabled = false;
    this.source = null;
    this.destination = null;
    this.amount = 0;
    this.curve = ModulationCurve.LINEAR;
    this.sourceValue = 0;
    this.outputValue = 0;
  }
}

/**
 * Modulation source wrapper
 */
export class ModulationSource {
  constructor(type, audioContext) {
    this.type = type;
    this.audioContext = audioContext;

    // Audio node (for LFO)
    this.node = null;

    // Value (for non-audio sources like velocity, mod wheel)
    this.value = 0;

    // Initialize based on type
    if (type.startsWith('lfo_')) {
      this.node = new LFO(audioContext);
    }
  }

  /**
   * Get current value
   */
  getValue() {
    if (this.node) {
      if (this.node.getRawValue) {
        return this.node.getRawValue();
      }
      if (this.node.getCurrentValue) {
        return this.node.getCurrentValue();
      }
    }

    return this.value;
  }

  /**
   * Set value (for non-LFO sources)
   */
  setValue(value) {
    this.value = Math.max(-1, Math.min(1, value));
  }

  /**
   * Start source (for LFOs)
   */
  start(time = null) {
    if (this.node && this.node.start) {
      this.node.start(time);
    }
  }

  activate(hasActiveSlot = true) {
    if (!hasActiveSlot) return;
    if (this.type.startsWith('lfo_') && this.node) {
      if (this.node.frequency <= 0.0001 && this.node.setFrequency) {
        this.node.setFrequency(1);
      }
      if (!this.node.isRunning && this.node.start) {
        this.node.start();
      }
    }
  }

  deactivate() {
    if (this.type.startsWith('lfo_') && this.node && this.node.isRunning && this.node.stop) {
      this.node.stop();
    }
  }

  /**
   * Stop source
   */
  stop(time = null) {
    if (this.node && this.node.stop) {
      this.node.stop(time);
    }
  }

  /**
   * Dispose
   */
  dispose() {
    if (this.node && this.node.dispose) {
      this.node.dispose();
    }
    this.node = null;
  }
}

/**
 * ModulationEngine - Central modulation system
 */
export class ModulationEngine {
  constructor(audioContext, maxSlots = 16) {
    this.audioContext = audioContext;
    this.maxSlots = maxSlots;

    // Modulation slots
    this.slots = [];
    for (let i = 0; i < maxSlots; i++) {
      this.slots.push(new ModulationSlot(`mod_${i}`));
    }

    // Modulation sources
    this.sources = new Map();
    this._initializeSources();

    // Destination parameter values (cache)
    this.destinationCache = new Map();

    // Update interval
    this.updateInterval = null;
    this.updateRate = 60; // Updates per second

    // Callbacks
    this.onModulationUpdate = null;
  }

  /**
   * Initialize modulation sources
   */
  _initializeSources() {
    // Create LFO sources
    for (let i = 1; i <= 4; i++) {
      const type = `lfo_${i}`;
      this.sources.set(type, new ModulationSource(type, this.audioContext));
    }

    // Create envelope sources (placeholder - will be connected later)
    for (let i = 1; i <= 4; i++) {
      const type = `env_${i}`;
      this.sources.set(type, new ModulationSource(type, this.audioContext));
    }

    // Create MIDI sources
    this.sources.set(ModulationSourceType.VELOCITY, new ModulationSource(ModulationSourceType.VELOCITY, this.audioContext));
    this.sources.set(ModulationSourceType.AFTERTOUCH, new ModulationSource(ModulationSourceType.AFTERTOUCH, this.audioContext));
    this.sources.set(ModulationSourceType.MOD_WHEEL, new ModulationSource(ModulationSourceType.MOD_WHEEL, this.audioContext));
    this.sources.set(ModulationSourceType.PITCH_WHEEL, new ModulationSource(ModulationSourceType.PITCH_WHEEL, this.audioContext));
  }

  /**
   * Add modulation slot
   */
  addSlot(source, destination, amount, curve = ModulationCurve.LINEAR) {
    // Find empty slot
    const slot = this.slots.find(s => !s.enabled);

    if (!slot) {
      console.warn('[ModulationEngine] No empty slots available');
      return null;
    }

    // Validate source
    if (!this.sources.has(source)) {
      console.warn(`[ModulationEngine] Unknown source: ${source}`);
      return null;
    }

    // Validate destination
    const paramDef = ParameterRegistry.get(destination);
    if (!paramDef) {
      console.warn(`[ModulationEngine] Unknown destination: ${destination}`);
      return null;
    }

    // Configure slot
    slot.enabled = true;
    slot.source = source;
    slot.destination = destination;
    slot.amount = amount;
    slot.curve = curve;

    console.log(`[ModulationEngine] Added slot: ${source} → ${destination} (amount: ${amount})`);

    this._ensureSourceActive(source);

    return slot;
  }

  /**
   * Remove modulation slot
   */
  removeSlot(slotId) {
    const slot = this.slots.find(s => s.id === slotId);

    if (slot) {
      const previousSource = slot.source;
      slot.reset();
      if (previousSource) {
        this._deactivateSourceIfUnused(previousSource);
      }
    }
  }

  /**
   * Update slot
   */
  updateSlot(slotId, updates) {
    const slot = this.slots.find(s => s.id === slotId);

    if (!slot) return;

    const previousSource = slot.source;

    if (updates.enabled !== undefined) slot.enabled = updates.enabled;
    if (updates.source !== undefined) slot.source = updates.source;
    if (updates.destination !== undefined) slot.destination = updates.destination;
    if (updates.amount !== undefined) slot.amount = updates.amount;
    if (updates.curve !== undefined) slot.curve = updates.curve;

    if (slot.source) {
      this._ensureSourceActive(slot.source);
    }
    if (previousSource && previousSource !== slot.source) {
      this._deactivateSourceIfUnused(previousSource);
    }
    if (slot.source && slot.enabled === false) {
      this._deactivateSourceIfUnused(slot.source);
    }
  }

  /**
   * Get modulation slot
   */
  getSlot(slotId) {
    return this.slots.find(s => s.id === slotId);
  }

  /**
   * Get all active slots
   */
  getActiveSlots() {
    return this.slots.filter(s => s.enabled);
  }

  /**
   * Get source
   */
  getSource(sourceType) {
    return this.sources.get(sourceType);
  }

  /**
   * Set source value (for non-LFO sources)
   */
  setSourceValue(sourceType, value) {
    const source = this.sources.get(sourceType);

    if (source) {
      source.setValue(value);
    }
  }

  /**
   * Start all LFOs
   */
  startLFOs(time = null) {
    for (const [type, source] of this.sources) {
      if (type.startsWith('lfo_')) {
        source.start(time);
      }
    }
  }

  /**
   * Stop all LFOs
   */
  stopLFOs(time = null) {
    for (const [type, source] of this.sources) {
      if (type.startsWith('lfo_')) {
        source.stop(time);
      }
    }
  }

  /**
   * Start modulation updates
   */
  startUpdates() {
    if (this.updateInterval) {
      return;
    }

    const updateIntervalMs = 1000 / this.updateRate;

    this.updateInterval = setInterval(() => {
      this.update();
    }, updateIntervalMs);
  }

  /**
   * Stop modulation updates
   */
  stopUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update all modulations (called periodically)
   */
  update() {
    const modulatedParameters = new Map();

    // Process each active slot
    for (const slot of this.slots) {
      if (!slot.enabled || !slot.source || !slot.destination) {
        continue;
      }

      // Get source value
      const source = this.sources.get(slot.source);
      if (!source) continue;

      const sourceValue = source.getValue();

      // Calculate modulation output
      const modValue = slot.calculate(sourceValue);

      // Accumulate modulation for this destination
      if (!modulatedParameters.has(slot.destination)) {
        modulatedParameters.set(slot.destination, 0);
      }

      const currentMod = modulatedParameters.get(slot.destination);
      modulatedParameters.set(slot.destination, currentMod + modValue);
    }

    // Apply modulations via callback
    if (this.onModulationUpdate && modulatedParameters.size > 0) {
      this.onModulationUpdate(modulatedParameters);
    }

    return modulatedParameters;
  }

  /**
   * Get modulation value for a parameter
   */
  getModulationForParameter(parameterId) {
    let totalModulation = 0;

    for (const slot of this.slots) {
      if (slot.enabled && slot.destination === parameterId) {
        const source = this.sources.get(slot.source);
        if (source) {
          const sourceValue = source.getValue();
          totalModulation += slot.calculate(sourceValue);
        }
      }
    }

    return totalModulation;
  }

  /**
   * Clear all slots
   */
  clearAll() {
    const sources = new Set(this.slots.map(slot => slot.source));
    this.slots.forEach(slot => slot.reset());
    sources.forEach(source => this._deactivateSourceIfUnused(source));
  }

  /**
   * Get slot count
   */
  getSlotCount() {
    return this.slots.length;
  }

  /**
   * Get active slot count
   */
  getActiveSlotCount() {
    return this.slots.filter(s => s.enabled).length;
  }

  /**
   * Dispose engine
   */
  dispose() {
    this.stopUpdates();
    this.stopLFOs();

    for (const source of this.sources.values()) {
      source.dispose();
    }

    this.sources.clear();
    this.slots = [];
    this.destinationCache.clear();
  }

  _ensureSourceActive(sourceType) {
    if (!sourceType) return;
    const source = this.sources.get(sourceType);
    if (!source) return;
    const hasActiveSlot = this.slots.some(slot => slot.enabled && slot.source === sourceType);
    if (!hasActiveSlot) return;
    if (source.activate) {
      source.activate(true);
    } else if (source.start) {
      source.start();
    }
  }

  _deactivateSourceIfUnused(sourceType) {
    if (!sourceType) return;
    const source = this.sources.get(sourceType);
    if (!source) return;
    const stillUsed = this.slots.some(slot => slot.enabled && slot.source === sourceType);
    if (stillUsed) return;
    if (source.deactivate) {
      source.deactivate();
    } else if (source.stop) {
      source.stop();
    }
  }
}

export default ModulationEngine;
