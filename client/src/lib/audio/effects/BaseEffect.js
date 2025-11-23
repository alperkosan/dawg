/**
 * BASE EFFECT CLASS
 *
 * All audio effects inherit from this base class.
 * Provides standard interface for parameter management and processing.
 */

export class BaseEffect {
  constructor(context, type, name) {
    this.context = context;
    this.type = type;
    this.name = name;
    this.id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Effect state
    this.enabled = true;
    this.bypass = false;

    // Parameters (to be defined by subclasses)
    this.parameters = {};

    // Create input/output gain nodes for effect routing
    this.inputNode = context.createGain();
    this.outputNode = context.createGain();

    console.log(`✨ Created effect: ${this.name} (${this.type})`);
  }

  /**
   * Process audio (for worklet-based effects)
   * Override in subclasses
   */
  process(inputSamples, outputSamples, sampleRate) {
    throw new Error('process() must be implemented by subclass');
  }

  /**
   * Get parameter value
   */
  getParameter(name) {
    return this.parameters[name]?.value ?? null;
  }

  /**
   * Set parameter value with validation
   */
  setParameter(name, value) {
    const param = this.parameters[name];
    if (!param) {
      console.warn(`Parameter "${name}" not found in ${this.type}`);
      return false;
    }

    // Clamp value to range
    const clampedValue = Math.max(param.min, Math.min(param.max, value));
    param.value = clampedValue;

    // Call parameter change callback if exists
    if (this.onParameterChange) {
      this.onParameterChange(name, clampedValue);
    }

    return true;
  }

  /**
   * Get all parameters as object
   */
  getParametersState() {
    const state = {};
    Object.keys(this.parameters).forEach(name => {
      state[name] = this.parameters[name].value;
    });
    return state;
  }

  /**
   * Set multiple parameters at once
   */
  setParametersState(state) {
    if (!state || typeof state !== 'object') {
      console.warn(`⚠️ [BaseEffect] setParametersState called with invalid state:`, state);
      return;
    }
    Object.keys(state).forEach(name => {
      this.setParameter(name, state[name]);
    });
  }

  /**
   * Enable/disable effect
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    this.bypass = !enabled;
  }

  /**
   * Connect effect to audio graph (for node-based effects)
   */
  connect(destination) {
    if (this.outputNode) {
      this.outputNode.connect(destination);
    }
  }

  /**
   * Disconnect effect from audio graph
   */
  disconnect() {
    if (this.outputNode) {
      this.outputNode.disconnect();
    }
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.disconnect();
    if (this.inputNode) this.inputNode = null;
    if (this.outputNode) this.outputNode = null;
    console.log(`🗑️ Disposed effect: ${this.name}`);
  }

  /**
   * Serialize effect state for saving
   */
  serialize() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      enabled: this.enabled,
      parameters: this.getParametersState()
    };
  }

  /**
   * Deserialize effect state
   */
  static deserialize(data, context) {
    // To be implemented by effect factory
    throw new Error('deserialize() must be implemented by EffectFactory');
  }
}
