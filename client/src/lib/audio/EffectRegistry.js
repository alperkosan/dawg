/**
 * EFFECT REGISTRY
 *
 * Central registry for all effect worklet processors
 * Handles dynamic loading and parameter mapping
 */

export class EffectRegistry {
  constructor() {
    this.effects = new Map();
    this.workletPaths = new Map();
    this.loadedWorklets = new Set();

    this.registerEffects();
  }

  /**
   * Register all available effects with their worklet paths and parameter definitions
   */
  registerEffects() {
    // Saturator
    this.register('Saturator', {
      workletPath: '/worklets/effects/saturator-processor.js',
      processorName: 'saturator-processor',
      parameters: [
        { name: 'distortion', defaultValue: 0.4, minValue: 0, maxValue: 1.5 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
      ]
    });

    // Compressor
    this.register('Compressor', {
      workletPath: '/worklets/effects/compressor-processor.js',
      processorName: 'compressor-processor',
      parameters: [
        { name: 'threshold', defaultValue: -24, minValue: -60, maxValue: 0 },
        { name: 'ratio', defaultValue: 4, minValue: 1, maxValue: 20 },
        { name: 'attack', defaultValue: 0.003, minValue: 0.0001, maxValue: 1 },
        { name: 'release', defaultValue: 0.25, minValue: 0.001, maxValue: 3 },
        { name: 'knee', defaultValue: 30, minValue: 0, maxValue: 40 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
      ]
    });

    // Reverb
    this.register('Reverb', {
      workletPath: '/worklets/effects/reverb-processor.js',
      processorName: 'reverb-processor',
      parameters: [
        { name: 'decay', defaultValue: 2.5, minValue: 0.1, maxValue: 15 },
        { name: 'preDelay', defaultValue: 0.01, minValue: 0, maxValue: 0.2 },
        { name: 'wet', defaultValue: 0.3, minValue: 0, maxValue: 1 }
      ]
    });

    // MultiBandEQ V2 - Message-based dynamic bands
    this.register('MultiBandEQ', {
      workletPath: '/worklets/effects/multiband-eq-processor-v2.js',
      processorName: 'multiband-eq-processor-v2',
      parameters: [
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 },
        { name: 'output', defaultValue: 1.0, minValue: 0, maxValue: 2 }
        // Bands array is sent via worklet.port.postMessage()
      ]
    });

    // Delay
    this.register('Delay', {
      workletPath: '/worklets/effects/delay-processor.js',
      processorName: 'delay-processor',
      parameters: [
        { name: 'delayTime', defaultValue: 0.3, minValue: 0, maxValue: 2 },
        { name: 'feedback', defaultValue: 0.3, minValue: 0, maxValue: 0.95 },
        { name: 'wet', defaultValue: 0.3, minValue: 0, maxValue: 1 }
      ]
    });

    // FeedbackDelay
    this.register('FeedbackDelay', {
      workletPath: '/worklets/effects/feedback-delay-processor.js',
      processorName: 'feedback-delay-processor',
      parameters: [
        { name: 'delayTime', defaultValue: 0.3, minValue: 0, maxValue: 2 },
        { name: 'feedback', defaultValue: 0.5, minValue: 0, maxValue: 0.95 },
        { name: 'tone', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'stereoOffset', defaultValue: 0, minValue: -0.5, maxValue: 0.5 },
        { name: 'wet', defaultValue: 0.3, minValue: 0, maxValue: 1 }
      ]
    });

    // TidalFilter
    this.register('TidalFilter', {
      workletPath: '/worklets/effects/tidal-filter-processor.js',
      processorName: 'tidal-filter-processor',
      parameters: [
        { name: 'cutoff', defaultValue: 1000, minValue: 20, maxValue: 20000 },
        { name: 'resonance', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'filterType', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'drive', defaultValue: 1.0, minValue: 1, maxValue: 10 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
      ]
    });

    // StardustChorus
    this.register('StardustChorus', {
      workletPath: '/worklets/effects/stardust-chorus-processor.js',
      processorName: 'stardust-chorus-processor',
      parameters: [
        { name: 'rate', defaultValue: 1.5, minValue: 0.1, maxValue: 10 },
        { name: 'depth', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'voices', defaultValue: 3, minValue: 1, maxValue: 5 },
        { name: 'stereoWidth', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'wet', defaultValue: 0.5, minValue: 0, maxValue: 1 }
      ]
    });

    // VortexPhaser
    this.register('VortexPhaser', {
      workletPath: '/worklets/effects/vortex-phaser-processor.js',
      processorName: 'vortex-phaser-processor',
      parameters: [
        { name: 'rate', defaultValue: 0.5, minValue: 0.01, maxValue: 10 },
        { name: 'depth', defaultValue: 0.7, minValue: 0, maxValue: 1 },
        { name: 'stages', defaultValue: 4, minValue: 2, maxValue: 12 },
        { name: 'feedback', defaultValue: 0.5, minValue: 0, maxValue: 0.95 },
        { name: 'stereoPhase', defaultValue: 90, minValue: 0, maxValue: 180 },
        { name: 'wet', defaultValue: 0.5, minValue: 0, maxValue: 1 }
      ]
    });

    // OrbitPanner
    this.register('OrbitPanner', {
      workletPath: '/worklets/effects/orbit-panner-processor.js',
      processorName: 'orbit-panner-processor',
      parameters: [
        { name: 'rate', defaultValue: 1.0, minValue: 0.01, maxValue: 20 },
        { name: 'depth', defaultValue: 0.8, minValue: 0, maxValue: 1 },
        { name: 'shape', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'stereoWidth', defaultValue: 1.0, minValue: 0, maxValue: 2 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
      ]
    });

    // ArcadeCrusher
    this.register('ArcadeCrusher', {
      workletPath: '/worklets/effects/arcade-crusher-processor.js',
      processorName: 'arcade-crusher-processor',
      parameters: [
        { name: 'bitDepth', defaultValue: 8, minValue: 1, maxValue: 16 },
        { name: 'sampleRateReduction', defaultValue: 1, minValue: 1, maxValue: 50 },
        { name: 'crush', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
      ]
    });

    // PitchShifter
    this.register('PitchShifter', {
      workletPath: '/worklets/effects/pitch-shifter-processor.js',
      processorName: 'pitch-shifter-processor',
      parameters: [
        { name: 'pitch', defaultValue: 0, minValue: -12, maxValue: 12 },
        { name: 'windowSize', defaultValue: 0.1, minValue: 0.01, maxValue: 0.4 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
      ]
    });

    // AtmosMachine
    this.register('AtmosMachine', {
      workletPath: '/worklets/effects/atmos-machine-processor.js',
      processorName: 'atmos-machine-processor',
      parameters: [
        { name: 'size', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'movement', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'character', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'stereoWidth', defaultValue: 0.7, minValue: 0, maxValue: 1 },
        { name: 'wet', defaultValue: 0.5, minValue: 0, maxValue: 1 }
      ]
    });

    // GhostLFO
    this.register('GhostLFO', {
      workletPath: '/worklets/effects/ghost-lfo-processor.js',
      processorName: 'ghost-lfo-processor',
      parameters: [
        { name: 'rate', defaultValue: 0.5, minValue: 0.01, maxValue: 20 },
        { name: 'stretch', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'atmosphere', defaultValue: 0.3, minValue: 0, maxValue: 1 },
        { name: 'glitch', defaultValue: 0.1, minValue: 0, maxValue: 1 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
      ]
    });

    // SampleMorph
    this.register('SampleMorph', {
      workletPath: '/worklets/effects/sample-morph-processor.js',
      processorName: 'sample-morph-processor',
      parameters: [
        { name: 'grainSize', defaultValue: 0.2, minValue: 0.01, maxValue: 1 },
        { name: 'overlap', defaultValue: 0.1, minValue: 0, maxValue: 1 },
        { name: 'randomness', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'retrigger', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
      ]
    });

    // BassEnhancer808
    this.register('BassEnhancer808', {
      workletPath: '/worklets/effects/bass-enhancer-808-processor.js',
      processorName: 'bass-enhancer-808-processor',
      parameters: [
        { name: 'frequency', defaultValue: 60, minValue: 20, maxValue: 200 },
        { name: 'amount', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'harmonics', defaultValue: 0.3, minValue: 0, maxValue: 1 },
        { name: 'tightness', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'wet', defaultValue: 0.5, minValue: 0, maxValue: 1 }
      ]
    });

    // SidechainCompressor
    this.register('SidechainCompressor', {
      workletPath: '/worklets/effects/sidechain-compressor-processor.js',
      processorName: 'sidechain-compressor-processor',
      parameters: [
        { name: 'threshold', defaultValue: -24, minValue: -60, maxValue: 0 },
        { name: 'ratio', defaultValue: 4, minValue: 1, maxValue: 20 },
        { name: 'attack', defaultValue: 0.003, minValue: 0.0001, maxValue: 1 },
        { name: 'release', defaultValue: 0.25, minValue: 0.001, maxValue: 3 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
      ]
    });

    // ModernReverb
    this.register('ModernReverb', {
      workletPath: '/worklets/effects/modern-reverb-processor.js',
      processorName: 'modern-reverb-processor',
      parameters: [
        { name: 'size', defaultValue: 0.7, minValue: 0.0, maxValue: 1.0 },
        { name: 'decay', defaultValue: 2.5, minValue: 0.1, maxValue: 15.0 },
        { name: 'damping', defaultValue: 0.5, minValue: 0.0, maxValue: 1.0 },
        { name: 'width', defaultValue: 1.0, minValue: 0.0, maxValue: 1.0 },
        { name: 'preDelay', defaultValue: 0.02, minValue: 0.0, maxValue: 0.2 },
        { name: 'wet', defaultValue: 0.35, minValue: 0.0, maxValue: 1.0 },
        { name: 'earlyLateMix', defaultValue: 0.5, minValue: 0.0, maxValue: 1.0 },
        { name: 'diffusion', defaultValue: 0.7, minValue: 0.0, maxValue: 1.0 },
        { name: 'modDepth', defaultValue: 0.3, minValue: 0.0, maxValue: 1.0 },
        { name: 'modRate', defaultValue: 0.5, minValue: 0.1, maxValue: 2.0 }
      ]
    });

    // ModernDelay
    this.register('ModernDelay', {
      workletPath: '/worklets/effects/modern-delay-processor.js',
      processorName: 'modern-delay-processor',
      parameters: [
        { name: 'timeLeft', defaultValue: 0.375, minValue: 0.001, maxValue: 4.0 },
        { name: 'timeRight', defaultValue: 0.5, minValue: 0.001, maxValue: 4.0 },
        { name: 'feedbackLeft', defaultValue: 0.4, minValue: 0.0, maxValue: 1.0 },
        { name: 'feedbackRight', defaultValue: 0.4, minValue: 0.0, maxValue: 1.0 },
        { name: 'pingPong', defaultValue: 0.0, minValue: 0.0, maxValue: 1.0 },
        { name: 'wet', defaultValue: 0.35, minValue: 0.0, maxValue: 1.0 },
        { name: 'filterFreq', defaultValue: 8000, minValue: 100, maxValue: 20000 },
        { name: 'filterQ', defaultValue: 1.0, minValue: 0.1, maxValue: 20.0 },
        { name: 'saturation', defaultValue: 0.0, minValue: 0.0, maxValue: 1.0 },
        { name: 'modDepth', defaultValue: 0.0, minValue: 0.0, maxValue: 0.05 },
        { name: 'modRate', defaultValue: 0.5, minValue: 0.1, maxValue: 5.0 },
        { name: 'diffusion', defaultValue: 0.0, minValue: 0.0, maxValue: 1.0 },
        { name: 'width', defaultValue: 1.0, minValue: 0.0, maxValue: 2.0 }
      ]
    });

    console.log(`📚 EffectRegistry: Registered ${this.effects.size} effects`);
  }

  /**
   * Register an effect
   */
  register(effectType, config) {
    this.effects.set(effectType, config);
    this.workletPaths.set(config.processorName, config.workletPath);
  }

  /**
   * Get effect configuration
   */
  getEffect(effectType) {
    return this.effects.get(effectType);
  }

  /**
   * Get all registered effects
   */
  getAllEffects() {
    return Array.from(this.effects.keys());
  }

  /**
   * Load effect worklet
   */
  async loadEffect(effectType, audioContext) {
    const config = this.effects.get(effectType);
    if (!config) {
      throw new Error(`Effect not registered: ${effectType}`);
    }

    if (this.loadedWorklets.has(config.processorName)) {
      return config.processorName;
    }

    try {
      await audioContext.audioWorklet.addModule(config.workletPath);
      this.loadedWorklets.add(config.processorName);
      console.log(`✅ Loaded effect worklet: ${effectType}`);
      return config.processorName;
    } catch (error) {
      console.error(`❌ Failed to load effect worklet: ${effectType}`, error);
      throw error;
    }
  }

  /**
   * Create AudioWorkletNode for effect (specialized or dynamic)
   */
  async createEffectNode(effectType, audioContext, settings = {}) {
    // Check if this is a custom dynamic effect
    if (effectType.startsWith('custom_') || settings.dspChain) {
      return this.createDynamicEffectNode(audioContext, settings);
    }

    const config = this.effects.get(effectType);
    if (!config) {
      throw new Error(`Effect not registered: ${effectType}`);
    }

    // Load worklet if not already loaded
    const processorName = await this.loadEffect(effectType, audioContext);

    // Create parameter descriptors for the node
    const nodeOptions = {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: {
        effectType,
        settings
      }
    };

    const node = new AudioWorkletNode(audioContext, processorName, nodeOptions);

    // Set default parameter values
    if (config.parameters && node.parameters) {
      config.parameters.forEach(param => {
        const audioParam = node.parameters.get(param.name);
        if (audioParam) {
          const value = settings[param.name] !== undefined ? settings[param.name] : param.defaultValue;
          audioParam.setValueAtTime(value, audioContext.currentTime);
        }
      });
    }

    return node;
  }

  /**
   * Create dynamic effect node from DSP chain
   */
  async createDynamicEffectNode(audioContext, settings = {}) {
    const processorName = 'dynamic-effect-processor';

    // Load dynamic effect worklet if not loaded
    if (!this.loadedWorklets.has(processorName)) {
      try {
        await audioContext.audioWorklet.addModule('/worklets/dynamic-effect-processor.js');
        this.loadedWorklets.add(processorName);
        console.log('✅ Loaded dynamic effect processor');
      } catch (error) {
        console.error('❌ Failed to load dynamic effect processor', error);
        throw error;
      }
    }

    const nodeOptions = {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: {
        dspChain: settings.dspChain || [],
        effectName: settings.effectName || 'CustomEffect'
      }
    };

    const node = new AudioWorkletNode(audioContext, processorName, nodeOptions);

    console.log(`🎛️ Created dynamic effect: ${settings.effectName}`, settings.dspChain);

    return node;
  }

  /**
   * Get parameter definitions for an effect
   */
  getParameters(effectType) {
    const config = this.effects.get(effectType);
    return config?.parameters || [];
  }

  /**
   * Get available DSP modules for effect builder
   */
  getDSPModules() {
    return [
      { type: 'filter', name: 'Filter', params: ['type', 'frequency', 'q'] },
      { type: 'saturator', name: 'Saturator', params: ['drive'] },
      { type: 'delay', name: 'Delay', params: ['time', 'feedback'] },
      { type: 'lfo', name: 'LFO', params: ['rate', 'shape'] },
      { type: 'gain', name: 'Gain', params: ['amount'] },
      { type: 'compressor', name: 'Compressor', params: ['threshold', 'ratio', 'attack', 'release'] },
      { type: 'reverb', name: 'Reverb', params: ['decay'] }
    ];
  }
}

// Singleton instance
export const effectRegistry = new EffectRegistry();
