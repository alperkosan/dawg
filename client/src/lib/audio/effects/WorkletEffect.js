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

  disconnect() {
    if (this.workletNode) {
      this.workletNode.disconnect();
    }
    super.disconnect();
  }
}
