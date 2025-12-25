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
  LFO_2: 'lfo_2',
  LFO_3: 'lfo_3',
  LFO_4: 'lfo_4',
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

    // External sources (injected from VASynth/ZenithSynth)
    this.lfos = [null, null, null, null]; // Array of 4 LFO instances
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
   * Set LFO sources
   */
  setLFOs(lfos) {
    if (Array.isArray(lfos)) {
      this.lfos = lfos;
      lfos.forEach((lfo, i) => {
        if (lfo) this._ensureSourceActive(`lfo_${i + 1}`);
      });
    } else {
      this.lfos[0] = lfos;
      if (lfos) this._ensureSourceActive(ModulationSourceType.LFO_1);
    }
  }

  /**
   * Deprecated: Set LFO 1 only
   */
  setLFO(lfo) {
    this.setLFOs([lfo, null, null, null]);
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
      case ModulationSourceType.LFO_2:
      case ModulationSourceType.LFO_3:
      case ModulationSourceType.LFO_4:
        const index = parseInt(sourceType.split('_')[1]) - 1;
        const lfo = this.lfos[index];
        if (lfo) {
          if (lfo.getRawValue) {
            return lfo.getRawValue();
          }
          if (lfo.getCurrentValue) {
            return lfo.getCurrentValue();
          }
        }
        return 0;

      case ModulationSourceType.ENV_1:
        // Filter envelope - get current value (0-1)
        if (this.filterEnvelope && this.filterEnvelope.getCurrentValue) {
          return this.filterEnvelope.getCurrentValue();
        }
        return 0;

      case ModulationSourceType.ENV_2:
        // Amplitude envelope - get current value (0-1)
        if (this.amplitudeEnvelope && this.amplitudeEnvelope.getCurrentValue) {
          return this.amplitudeEnvelope.getCurrentValue();
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
    this.lfos = [null, null, null, null];
    this.filterEnvelope = null;
    this.amplitudeEnvelope = null;
  }

  _ensureSourceActive(sourceType) {
    if (!sourceType) return;
    const hasActiveSlot = this.slots.some(slot => slot.enabled && slot.source === sourceType);
    if (!hasActiveSlot) return;

    if (sourceType.startsWith('lfo_')) {
      const index = parseInt(sourceType.split('_')[1]) - 1;
      const lfo = this.lfos[index];
      if (lfo) {
        if (lfo.frequency <= 0.0001 && lfo.setFrequency) {
          lfo.setFrequency(1);
        }
        if (!lfo.isRunning && lfo.start) {
          lfo.start();
        }
      }
    }
  }

  _deactivateSourceIfUnused(sourceType) {
    if (!sourceType) return;
    const stillUsed = this.slots.some(slot => slot.enabled && slot.source === sourceType);
    if (stillUsed) return;

    if (sourceType.startsWith('lfo_')) {
      const index = parseInt(sourceType.split('_')[1]) - 1;
      const lfo = this.lfos[index];
      if (lfo && lfo.isRunning && lfo.stop) {
        lfo.stop();
      }
    }
  }
}

