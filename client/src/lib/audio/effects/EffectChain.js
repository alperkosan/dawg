/**
 * EFFECT CHAIN
 *
 * Manages a chain of effects for an instrument or track.
 * Effects are processed in series (effect1 -> effect2 -> effect3 -> output)
 */

export class EffectChain {
  constructor(context, name = 'Effect Chain') {
    this.context = context;
    this.name = name;
    this.effects = [];

    // Create input/output nodes for routing
    this.inputNode = context.createGain();
    this.outputNode = context.createGain();

    // Initially bypass (direct connection)
    this.inputNode.connect(this.outputNode);

    console.log(`🎛️ Created effect chain: ${name}`);
  }

  /**
   * Add effect to end of chain
   */
  addEffect(effect) {
    this.effects.push(effect);
    this._rebuildChain();
    console.log(`➕ Added effect to chain: ${effect.name}`);
    return effect;
  }

  /**
   * Insert effect at specific position
   */
  insertEffect(effect, index) {
    this.effects.splice(index, 0, effect);
    this._rebuildChain();
    console.log(`➕ Inserted effect at position ${index}: ${effect.name}`);
    return effect;
  }

  /**
   * Remove effect from chain
   */
  removeEffect(effectId) {
    const index = this.effects.findIndex(e => e.id === effectId);
    if (index === -1) return false;

    const effect = this.effects[index];
    this.effects.splice(index, 1);
    this._rebuildChain();

    // Cleanup removed effect
    effect.dispose();

    console.log(`➖ Removed effect: ${effect.name}`);
    return true;
  }

  /**
   * Move effect to new position
   */
  moveEffect(effectId, newIndex) {
    const oldIndex = this.effects.findIndex(e => e.id === effectId);
    if (oldIndex === -1) return false;

    const effect = this.effects.splice(oldIndex, 1)[0];
    this.effects.splice(newIndex, 0, effect);
    this._rebuildChain();

    console.log(`🔄 Moved effect ${effect.name} from ${oldIndex} to ${newIndex}`);
    return true;
  }

  /**
   * Get effect by ID
   */
  getEffect(effectId) {
    return this.effects.find(e => e.id === effectId);
  }

  /**
   * Clear all effects
   */
  clearEffects() {
    this.effects.forEach(effect => effect.dispose());
    this.effects = [];
    this._rebuildChain();
    console.log(`🧹 Cleared all effects from chain`);
  }

  /**
   * Rebuild audio routing chain
   */
  _rebuildChain() {
    // Disconnect all
    this.inputNode.disconnect();
    this.effects.forEach(effect => effect.disconnect());

    if (this.effects.length === 0) {
      // No effects - direct connection
      this.inputNode.connect(this.outputNode);
      return;
    }

    // Connect input to first effect
    this.inputNode.connect(this.effects[0].inputNode);

    // Connect effects in series
    for (let i = 0; i < this.effects.length - 1; i++) {
      this.effects[i].outputNode.connect(this.effects[i + 1].inputNode);
    }

    // Connect last effect to output
    this.effects[this.effects.length - 1].outputNode.connect(this.outputNode);

    console.log(`🔗 Rebuilt effect chain with ${this.effects.length} effects`);
  }

  /**
   * Connect chain to destination
   */
  connect(destination) {
    this.outputNode.connect(destination);
  }

  /**
   * Disconnect chain
   */
  disconnect() {
    this.outputNode.disconnect();
  }

  /**
   * Process audio (for worklet-based processing)
   */
  process(inputSamples, outputSamples, sampleRate) {
    if (this.effects.length === 0 || this.effects.every(e => e.bypass)) {
      // Bypass all - copy input to output
      for (let i = 0; i < inputSamples.length; i++) {
        outputSamples[i] = inputSamples[i];
      }
      return;
    }

    // Create temporary buffers for effect chain processing
    let currentInput = inputSamples;
    const tempBuffer = new Float32Array(inputSamples.length);

    // Process each effect in series
    this.effects.forEach((effect, index) => {
      if (effect.bypass) {
        // Skip bypassed effects
        return;
      }

      const currentOutput = (index === this.effects.length - 1) ? outputSamples : tempBuffer;

      effect.process(currentInput, currentOutput, sampleRate);

      // Next effect uses this effect's output as input
      if (index < this.effects.length - 1) {
        currentInput = new Float32Array(currentOutput);
      }
    });
  }

  /**
   * Serialize chain state
   */
  serialize() {
    return {
      name: this.name,
      effects: this.effects.map(effect => effect.serialize())
    };
  }

  /**
   * Cleanup
   */
  dispose() {
    this.clearEffects();
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    console.log(`🗑️ Disposed effect chain: ${this.name}`);
  }
}
