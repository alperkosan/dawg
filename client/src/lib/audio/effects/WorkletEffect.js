/**
 * WORKLET EFFECT WRAPPER
 *
 * Generic wrapper for AudioWorklet-based effects
 */

import { BaseEffect } from './BaseEffect.js';

export class WorkletEffect extends BaseEffect {
  constructor(context, workletName, displayName, parameterDefinitions = {}) {
    super(context, displayName);

    this.workletName = workletName;
    this.workletNode = null;
    this.parameterDefinitions = parameterDefinitions;
    this.isReady = false;

    // Initialize worklet synchronously
    try {
      // Create AudioWorkletNode
      this.workletNode = new AudioWorkletNode(this.context, this.workletName);

      // Connect to our input/output
      this.inputNode.connect(this.workletNode);
      this.workletNode.connect(this.outputNode);

      this.isReady = true;
      console.log(`🎛️ WorkletEffect initialized: ${this.name}`);
    } catch (error) {
      console.error(`Failed to initialize worklet ${this.workletName}:`, error);
      // Fallback: direct connection
      this.inputNode.connect(this.outputNode);
    }
  }

  getParametersState() {
    if (!this.workletNode?.parameters) return this.parameterDefinitions;

    const state = {};

    // Get current values from worklet parameters
    for (const [name, def] of Object.entries(this.parameterDefinitions)) {
      const param = this.workletNode.parameters.get(name);
      state[name] = {
        ...def,
        value: param ? param.value : def.defaultValue
      };
    }

    return state;
  }

  setParametersState(params) {
    if (!this.workletNode?.parameters) return;

    for (const [name, value] of Object.entries(params)) {
      const param = this.workletNode.parameters.get(name);
      if (param) {
        const actualValue = typeof value === 'object' ? value.value : value;
        param.setValueAtTime(actualValue, this.context.currentTime);
      }
    }
  }

  /**
   * Update a single parameter (interface for AudioContextService)
   * @param {string} name - Parameter name
   * @param {number} value - Parameter value
   */
  updateParameter(name, value) {
    if (!this.workletNode) {
      console.warn(`[WorkletEffect] No worklet node available for ${this.name}`);
      return false;
    }

    // Try AudioParam first (standard way)
    if (this.workletNode.parameters) {
      const param = this.workletNode.parameters.get(name);
      if (param) {
        const actualValue = typeof value === 'object' ? value.value : value;
        console.log(`🔧 [${this.name}] AudioParam ${name}:`, actualValue);
        // Use setTargetAtTime for smooth parameter changes (20ms ramp)
        param.setTargetAtTime(actualValue, this.context.currentTime, 0.02);
        return true;
      }
    }

    // Fallback: Try message-based update (for processors without AudioParams)
    if (this.workletNode.port) {
      try {
        const updateData = {
          type: 'updateParams',
          [name]: typeof value === 'object' ? value.value : value
        };
        console.log(`📨 [${this.name}] Message:`, updateData);
        this.workletNode.port.postMessage(updateData);
        return true;
      } catch (error) {
        console.warn(`[WorkletEffect] Failed to send message to ${this.name}:`, error);
      }
    }

    console.warn(`[WorkletEffect] Parameter "${name}" not found in ${this.name}`);
    return false;
  }

  disconnect() {
    if (this.workletNode) {
      this.workletNode.disconnect();
    }
    super.disconnect();
  }
}
