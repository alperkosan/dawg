/**
 * ModulationRouter.js
 *
 * Routes modulation values to AudioParams and other targets.
 * Handles parameter range mapping and modulation application.
 */

import { ParameterRegistry } from '../../core/ParameterRegistry.js';

/**
 * Modulation target - Wraps an AudioParam or custom parameter
 */
export class ModulationTarget {
  constructor(parameterId, audioParam = null, customSetter = null) {
    this.parameterId = parameterId;
    this.audioParam = audioParam;         // Web Audio AudioParam
    this.customSetter = customSetter;     // Custom setter function

    // Get parameter definition
    this.paramDef = ParameterRegistry.get(parameterId);

    // Base value (without modulation)
    this.baseValue = this.paramDef ? this.paramDef.defaultValue : 0;

    // Current modulation value
    this.modulationValue = 0;

    // Final output value
    this.outputValue = this.baseValue;
  }

  /**
   * Set base value (the value set by the user/preset)
   */
  setBaseValue(value) {
    if (this.paramDef) {
      this.baseValue = this.paramDef.clamp(value);
    } else {
      this.baseValue = value;
    }

    this._updateOutput();
  }

  /**
   * Set modulation value (-1 to +1, will be scaled to parameter range)
   */
  setModulationValue(modValue) {
    this.modulationValue = modValue;
    this._updateOutput();
  }

  /**
   * Update output value and apply to target
   */
  _updateOutput() {
    if (!this.paramDef) {
      this.outputValue = this.baseValue;
      return;
    }

    // Calculate modulation offset
    const range = this.paramDef.max - this.paramDef.min;
    const modulationOffset = this.modulationValue * (range / 2);

    // Apply modulation to base value
    let newValue = this.baseValue + modulationOffset;

    // Clamp to parameter range
    newValue = this.paramDef.clamp(newValue);

    this.outputValue = newValue;

    // Apply to target
    this._applyToTarget(this.outputValue);
  }

  /**
   * Apply value to AudioParam or custom setter
   */
  _applyToTarget(value) {
    if (this.audioParam) {
      // Apply to AudioParam
      const audioContext = this.audioParam.context;
      const currentTime = audioContext.currentTime;

      // Cancel scheduled values and set immediately
      this.audioParam.cancelScheduledValues(currentTime);
      this.audioParam.setValueAtTime(value, currentTime);
    } else if (this.customSetter) {
      // Apply via custom setter
      this.customSetter(value);
    }
  }

  /**
   * Get current output value
   */
  getValue() {
    return this.outputValue;
  }

  /**
   * Reset modulation
   */
  resetModulation() {
    this.modulationValue = 0;
    this._updateOutput();
  }
}

/**
 * ModulationRouter - Manages modulation targets and routing
 */
export class ModulationRouter {
  constructor(audioContext) {
    this.audioContext = audioContext;

    // Map of parameterId → ModulationTarget
    this.targets = new Map();
  }

  /**
   * Register a modulation target
   */
  registerTarget(parameterId, audioParam = null, customSetter = null) {
    if (this.targets.has(parameterId)) {
      console.warn(`[ModulationRouter] Target already registered: ${parameterId}`);
      return this.targets.get(parameterId);
    }

    const target = new ModulationTarget(parameterId, audioParam, customSetter);
    this.targets.set(parameterId, target);

    return target;
  }

  /**
   * Unregister a modulation target
   */
  unregisterTarget(parameterId) {
    if (this.targets.has(parameterId)) {
      const target = this.targets.get(parameterId);
      target.resetModulation();
      this.targets.delete(parameterId);
    }
  }

  /**
   * Get modulation target
   */
  getTarget(parameterId) {
    return this.targets.get(parameterId);
  }

  /**
   * Set base value for a parameter
   */
  setBaseValue(parameterId, value) {
    const target = this.targets.get(parameterId);

    if (target) {
      target.setBaseValue(value);
    }
  }

  /**
   * Apply modulation values (called by ModulationEngine)
   */
  applyModulation(modulationMap) {
    // modulationMap: Map<parameterId, modulationValue>

    // Reset all targets first (clear previous modulation)
    for (const target of this.targets.values()) {
      target.setModulationValue(0);
    }

    // Apply new modulation values
    for (const [parameterId, modValue] of modulationMap) {
      const target = this.targets.get(parameterId);

      if (target) {
        target.setModulationValue(modValue);
      }
    }
  }

  /**
   * Apply single modulation
   */
  applySingleModulation(parameterId, modValue) {
    const target = this.targets.get(parameterId);

    if (target) {
      target.setModulationValue(modValue);
    }
  }

  /**
   * Reset all modulation
   */
  resetAll() {
    for (const target of this.targets.values()) {
      target.resetModulation();
    }
  }

  /**
   * Get all targets
   */
  getAllTargets() {
    return Array.from(this.targets.values());
  }

  /**
   * Clear all targets
   */
  clear() {
    this.targets.clear();
  }

  /**
   * Dispose router
   */
  dispose() {
    this.resetAll();
    this.targets.clear();
  }
}

/**
 * Helper: Create modulation connection
 */
export function createModulationConnection(
  modulationEngine,
  modulationRouter,
  sourceType,
  parameterId,
  amount,
  audioParam = null,
  customSetter = null
) {
  // Register target
  modulationRouter.registerTarget(parameterId, audioParam, customSetter);

  // Add modulation slot
  const slot = modulationEngine.addSlot(sourceType, parameterId, amount);

  return slot;
}

export default ModulationRouter;
