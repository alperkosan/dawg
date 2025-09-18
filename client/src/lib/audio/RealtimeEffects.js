import * as Tone from 'tone';

export class RealtimeEffectsEngine {
  constructor(buffer) {
    this.originalBuffer = buffer;
    this.player = new Tone.Player(buffer);
    this.effects = new Map();
    this.isPlaying = false;
    
    // Signal chain
    this.inputGain = new Tone.Gain(1);
    this.outputGain = new Tone.Gain(1);
    
    // Setup initial chain
    this.player.connect(this.inputGain);
    this.inputGain.connect(this.outputGain);
    this.outputGain.toDestination();
    
    // Player callbacks
    this.player.onstop = () => {
      this.isPlaying = false;
      this.onPlaybackStop?.();
    };
  }

  addEffect(name, effectNode, position = -1) {
    this.effects.set(name, {
      node: effectNode,
      bypassed: false,
      position: position === -1 ? this.effects.size : position
    });
    
    this.rebuildEffectChain();
    return this;
  }

  removeEffect(name) {
    const effect = this.effects.get(name);
    if (effect) {
      effect.node.dispose();
      this.effects.delete(name);
      this.rebuildEffectChain();
    }
    return this;
  }

  toggleEffect(name) {
    const effect = this.effects.get(name);
    if (effect) {
      effect.bypassed = !effect.bypassed;
      this.rebuildEffectChain();
    }
    return this;
  }

  updateEffectParam(name, param, value) {
    const effect = this.effects.get(name);
    if (effect && effect.node[param]) {
      if (effect.node[param].rampTo) {
        effect.node[param].rampTo(value, 0.02);
      } else {
        effect.node[param].value = value;
      }
    }
    return this;
  }

  rebuildEffectChain() {
    // Disconnect all
    this.inputGain.disconnect();
    this.effects.forEach(effect => {
      if (effect.node.disconnect) effect.node.disconnect();
    });

    // Get sorted, non-bypassed effects
    const activeEffects = Array.from(this.effects.values())
      .filter(effect => !effect.bypassed)
      .sort((a, b) => a.position - b.position);

    // Rebuild chain
    let currentNode = this.inputGain;
    
    activeEffects.forEach(effect => {
      currentNode.connect(effect.node);
      currentNode = effect.node;
    });

    // Connect to output
    currentNode.connect(this.outputGain);
  }

  play() {
    if (this.isPlaying) {
      this.stop();
      return false;
    }
    
    this.player.start();
    this.isPlaying = true;
    return true;
  }

  stop() {
    if (this.player.state === 'started') {
      this.player.stop();
    }
    this.isPlaying = false;
  }

  dispose() {
    this.stop();
    this.player.dispose();
    this.inputGain.dispose();
    this.outputGain.dispose();
    this.effects.forEach(effect => effect.node.dispose());
    this.effects.clear();
  }

  // Preset effects
  static createReverbEffect(roomSize = 0.7, decay = 1.5, wet = 0.3) {
    const reverb = new Tone.Reverb({
      decay: decay,
      preDelay: 0.01,
      wet: wet
    });
    return reverb;
  }

  static createDelayEffect(delayTime = '8n', feedback = 0.3, wet = 0.25) {
    const delay = new Tone.FeedbackDelay({
      delayTime: delayTime,
      feedback: feedback,
      wet: wet
    });
    return delay;
  }

  static createFilterEffect(frequency = 1000, type = 'lowpass', Q = 1) {
    const filter = new Tone.Filter({
      frequency: frequency,
      type: type,
      Q: Q
    });
    return filter;
  }

  static createDistortionEffect(distortion = 0.4, wet = 1) {
    const dist = new Tone.Distortion({
      distortion: distortion,
      wet: wet
    });
    return dist;
  }

  static createChorusEffect(frequency = 1.5, delayTime = 3.5, depth = 0.7, wet = 0.3) {
    const chorus = new Tone.Chorus({
      frequency: frequency,
      delayTime: delayTime,
      depth: depth,
      wet: wet
    });
    return chorus;
  }
}