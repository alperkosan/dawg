/**
 * ModulationEngine - v1 Adaptation
 * 
 * Simplified modulation routing system for VASynth v1
 * Based on v2 ModulationEngine but adapted for v1 architecture
 * 
 * Features:
 * - Up to 16 modulation slots
 * - Multiple sources (LFO, Envelope, MIDI)
 * - Any parameter as destination
 * - Bipolar modulation (-1 to +1)
 */

/**
 * Modulation source types
 */
export const ModulationSourceType = {
  LFO_1: 'lfo_1',
  ENV_1: 'env_1',      // Filter envelope
  ENV_2: 'env_2',      // Amplitude envelope
  VELOCITY: 'velocity',
  AFTERTOUCH: 'aftertouch',
  MOD_WHEEL: 'mod_wheel',
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
    this.destination = null;      // Parameter ID (e.g., 'filter.cutoff')
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
 * ModulationEngine - Central modulation system for v1
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

    // External sources (injected from VASynth)
    this.lfo1 = null;              // LFO instance
    this.filterEnvelope = null;    // Filter envelope instance
    this.amplitudeEnvelope = null; // Amplitude envelope instance
    
    // MIDI sources (set from noteOn)
    this.currentVelocity = 0;      // 0-127
    this.currentAftertouch = 0;    // 0-127
    this.currentModWheel = 0;      // 0-127

    // Update interval
    this.updateInterval = null;
    this.updateRate = 60; // Updates per second

    // Callbacks
    this.onModulationUpdate = null; // Called with Map<destination, modulationValue>
  }

  /**
   * Set LFO source
   */
  setLFO(lfo) {
    this.lfo1 = lfo;
    this._ensureSourceActive(ModulationSourceType.LFO_1);
  }

  /**
   * Set envelope sources
   */
  setEnvelopes(filterEnvelope, amplitudeEnvelope) {
    this.filterEnvelope = filterEnvelope;
    this.amplitudeEnvelope = amplitudeEnvelope;
  }

  /**
   * Set MIDI source values
   */
  setMIDISources(velocity, aftertouch = 0, modWheel = 0) {
    this.currentVelocity = velocity;
    this.currentAftertouch = aftertouch;
    this.currentModWheel = modWheel;
  }

  /**
   * Get source value
   */
  _getSourceValue(sourceType) {
    switch (sourceType) {
      case ModulationSourceType.LFO_1:
        if (this.lfo1) {
          if (this.lfo1.getRawValue) {
            return this.lfo1.getRawValue();
          }
          if (this.lfo1.getCurrentValue) {
            return this.lfo1.getCurrentValue();
          }
        }
        return 0;

      case ModulationSourceType.ENV_1:
        // Filter envelope - get current value (0-1)
        if (this.filterEnvelope) {
          // TODO: Get current envelope value
          // For now, return 0 (envelope tracking not implemented)
          return 0;
        }
        return 0;

      case ModulationSourceType.ENV_2:
        // Amplitude envelope - get current value (0-1)
        if (this.amplitudeEnvelope) {
          // TODO: Get current envelope value
          return 0;
        }
        return 0;

      case ModulationSourceType.VELOCITY:
        // Normalize velocity (0-127) to (-1 to 1)
        return (this.currentVelocity / 127) * 2 - 1;

      case ModulationSourceType.AFTERTOUCH:
        // Normalize aftertouch (0-127) to (-1 to 1)
        return (this.currentAftertouch / 127) * 2 - 1;

      case ModulationSourceType.MOD_WHEEL:
        // Normalize mod wheel (0-127) to (-1 to 1)
        return (this.currentModWheel / 127) * 2 - 1;

      default:
        return 0;
    }
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

    // Configure slot
    slot.enabled = true;
    slot.source = source;
    slot.destination = destination;
    slot.amount = amount;
    slot.curve = curve;

    if (import.meta.env.DEV) {
      console.log(`[ModulationEngine] Added slot: ${source} → ${destination} (amount: ${amount})`);
    }

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
   * Start modulation updates
   */
  startUpdates() {
    if (this.updateInterval) return;

    this.updateInterval = setInterval(() => {
      this.update();
    }, 1000 / this.updateRate);
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
      const sourceValue = this._getSourceValue(slot.source);

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
      if (!slot.enabled || slot.destination !== parameterId) {
        continue;
      }

      const sourceValue = this._getSourceValue(slot.source);
      totalModulation += slot.calculate(sourceValue);
    }

    return totalModulation;
  }

  /**
   * Get all slots
   */
  getSlots() {
    return this.slots;
  }

  /**
   * Get active slots
   */
  getActiveSlots() {
    return this.slots.filter(s => s.enabled);
  }

  /**
   * Clear all slots
   */
  clear() {
    const sources = new Set(this.slots.map(slot => slot.source));
    this.slots.forEach(slot => slot.reset());
    sources.forEach(source => this._deactivateSourceIfUnused(source));
  }

  /**
   * Dispose
   */
  dispose() {
    this.stopUpdates();
    this.clear();
    this.lfo1 = null;
    this.filterEnvelope = null;
    this.amplitudeEnvelope = null;
  }

  _ensureSourceActive(sourceType) {
    if (!sourceType) return;
    const hasActiveSlot = this.slots.some(slot => slot.enabled && slot.source === sourceType);
    if (!hasActiveSlot) return;
    if (sourceType === ModulationSourceType.LFO_1 && this.lfo1) {
      if (this.lfo1.frequency <= 0.0001 && this.lfo1.setFrequency) {
        this.lfo1.setFrequency(1);
      }
      if (!this.lfo1.isRunning && this.lfo1.start) {
        this.lfo1.start();
      }
    }
  }

  _deactivateSourceIfUnused(sourceType) {
    if (!sourceType) return;
    const stillUsed = this.slots.some(slot => slot.enabled && slot.source === sourceType);
    if (stillUsed) return;
    if (sourceType === ModulationSourceType.LFO_1 && this.lfo1 && this.lfo1.isRunning && this.lfo1.stop) {
      this.lfo1.stop();
    }
  }
}

