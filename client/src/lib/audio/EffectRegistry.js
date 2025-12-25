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
    // Saturator v2.0
    // Saturator v2.0 - Professional multiband tube saturation
    this.register('Saturator', {
      workletPath: '/worklets/effects/saturator-processor.js',
      processorName: 'saturator-processor',
      parameters: [
        { name: 'distortion', defaultValue: 0.4, minValue: 0, maxValue: 1.5 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 },
        // v2.0 parameters
        { name: 'autoGain', defaultValue: 1, minValue: 0, maxValue: 1 },
        { name: 'lowCutFreq', defaultValue: 0, minValue: 0, maxValue: 500 },
        { name: 'highCutFreq', defaultValue: 20000, minValue: 2000, maxValue: 20000 },
        { name: 'tone', defaultValue: 0, minValue: -12, maxValue: 12 },
        { name: 'headroom', defaultValue: 0, minValue: -12, maxValue: 12 },
        // 🎯 NEW v2.0: Multiband saturation
        { name: 'multiband', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'lowMidCrossover', defaultValue: 250, minValue: 50, maxValue: 500 },
        { name: 'midHighCrossover', defaultValue: 2500, minValue: 1000, maxValue: 8000 },
        { name: 'lowDrive', defaultValue: 1.0, minValue: 0, maxValue: 2.0 },
        { name: 'midDrive', defaultValue: 1.0, minValue: 0, maxValue: 2.0 },
        { name: 'highDrive', defaultValue: 1.0, minValue: 0, maxValue: 2.0 },
        { name: 'lowMix', defaultValue: 1.0, minValue: 0, maxValue: 1 },
        { name: 'midMix', defaultValue: 1.0, minValue: 0, maxValue: 1 },
        { name: 'highMix', defaultValue: 1.0, minValue: 0, maxValue: 1 },
        // ✅ NEW: Oversampling, Drive Curve, and Tape Modeling
        { name: 'oversampling', defaultValue: 2, minValue: 1, maxValue: 8 },
        { name: 'driveCurve', defaultValue: 3, minValue: 0, maxValue: 4 },
        { name: 'tapeBias', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'tapeWow', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'tapeFlutter', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'tapeSpeed', defaultValue: 1.0, minValue: 0.5, maxValue: 2.0 }
      ]
    });

    // Compressor v2.0 - Professional dynamic range compression
    this.register('Compressor', {
      workletPath: '/worklets/effects/compressor-processor.js',
      processorName: 'compressor-processor',
      parameters: [
        { name: 'threshold', defaultValue: -24, minValue: -60, maxValue: 0 },
        { name: 'ratio', defaultValue: 4, minValue: 1, maxValue: 20 },
        { name: 'attack', defaultValue: 0.003, minValue: 0.0001, maxValue: 1 },
        { name: 'release', defaultValue: 0.25, minValue: 0.001, maxValue: 3 },
        { name: 'knee', defaultValue: 30, minValue: 0, maxValue: 40 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 },
        { name: 'upwardRatio', defaultValue: 2, minValue: 1, maxValue: 20 },
        { name: 'upwardDepth', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'autoMakeup', defaultValue: 0, minValue: 0, maxValue: 1 },
        // Advanced parameters
        { name: 'lookahead', defaultValue: 3, minValue: 0, maxValue: 10 },
        { name: 'stereoLink', defaultValue: 100, minValue: 0, maxValue: 100 },
        // 🎯 NEW v2.0: Detection mode
        { name: 'detectionMode', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'rmsWindow', defaultValue: 10, minValue: 1, maxValue: 50 },
        // 🎯 NEW: Compressor model (0=Clean/VCA, 1=Opto, 2=FET)
        { name: 'compressorModel', defaultValue: 0, minValue: 0, maxValue: 2 },
        // 🎯 NEW: Mix/Blend control for parallel compression (0-100% wet)
        { name: 'mix', defaultValue: 100, minValue: 0, maxValue: 100 },
        // Sidechain
        { name: 'scEnable', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'scGain', defaultValue: 0, minValue: -24, maxValue: 24 },
        { name: 'scFilterType', defaultValue: 1, minValue: 0, maxValue: 2 },
        { name: 'scFreq', defaultValue: 150, minValue: 20, maxValue: 2000 },
        { name: 'scListen', defaultValue: 0, minValue: 0, maxValue: 1 }
      ]
    });

    // OTT - Over The Top Multiband Compressor
    this.register('OTT', {
      workletPath: '/worklets/effects/multiband-compressor-processor.js',
      processorName: 'multiband-compressor-processor',
      parameters: [
        { name: 'depth', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'time', defaultValue: 0.5, minValue: 0, maxValue: 10 },
        { name: 'lowUpRatio', defaultValue: 3, minValue: 1, maxValue: 20 },
        { name: 'lowDownRatio', defaultValue: 3, minValue: 1, maxValue: 20 },
        { name: 'lowGain', defaultValue: 0, minValue: -24, maxValue: 24 },
        { name: 'midUpRatio', defaultValue: 3, minValue: 1, maxValue: 20 },
        { name: 'midDownRatio', defaultValue: 3, minValue: 1, maxValue: 20 },
        { name: 'midGain', defaultValue: 0, minValue: -24, maxValue: 24 },
        { name: 'highUpRatio', defaultValue: 3, minValue: 1, maxValue: 20 },
        { name: 'highDownRatio', defaultValue: 3, minValue: 1, maxValue: 20 },
        { name: 'highGain', defaultValue: 0, minValue: -24, maxValue: 24 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
      ]
    });

    // Transient Designer
    this.register('TransientDesigner', {
      workletPath: '/worklets/effects/transient-designer-processor.js',
      processorName: 'transient-designer-processor',
      parameters: [
        { name: 'attack', defaultValue: 0, minValue: -12, maxValue: 12 },
        { name: 'sustain', defaultValue: 0, minValue: -12, maxValue: 12 },
        { name: 'mix', defaultValue: 1.0, minValue: 0, maxValue: 1 },
        // ✅ NEW: Frequency Targeting
        { name: 'frequencyTargeting', defaultValue: 0, minValue: 0, maxValue: 3 }, // 0=Full, 1=Low, 2=Mid, 3=High
        { name: 'lowAttack', defaultValue: 0, minValue: -12, maxValue: 12 },
        { name: 'lowSustain', defaultValue: 0, minValue: -12, maxValue: 12 },
        { name: 'midAttack', defaultValue: 0, minValue: -12, maxValue: 12 },
        { name: 'midSustain', defaultValue: 0, minValue: -12, maxValue: 12 },
        { name: 'highAttack', defaultValue: 0, minValue: -12, maxValue: 12 },
        { name: 'highSustain', defaultValue: 0, minValue: -12, maxValue: 12 },
        { name: 'lowCrossover', defaultValue: 200, minValue: 50, maxValue: 1000 },
        { name: 'highCrossover', defaultValue: 5000, minValue: 2000, maxValue: 15000 }
      ]
    });

    // ❌ REMOVED: Old Reverb (replaced by ModernReverb)

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

    // ❌ REMOVED: Old Delay (replaced by ModernDelay)
    // ❌ REMOVED: FeedbackDelay (replaced by ModernDelay)

    // TidalFilter
    this.register('TidalFilter', {
      workletPath: '/worklets/effects/tidal-filter-processor.js',
      processorName: 'tidal-filter-processor',
      parameters: [
        { name: 'cutoff', defaultValue: 1000, minValue: 20, maxValue: 20000 },
        { name: 'resonance', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'filterType', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'drive', defaultValue: 1.0, minValue: 1, maxValue: 10 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 },
        // ✅ NEW: Filter model (0=State-Variable, 1=Moog, 2=Korg, 3=Oberheim)
        { name: 'filterModel', defaultValue: 0, minValue: 0, maxValue: 3 },
        // ✅ NEW: LFO Modulation
        { name: 'lfoEnabled', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'lfoRate', defaultValue: 1.0, minValue: 0.1, maxValue: 20 },
        { name: 'lfoDepth', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'lfoShape', defaultValue: 0, minValue: 0, maxValue: 3 },
        { name: 'lfoTempoSync', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'lfoNoteDivision', defaultValue: 3, minValue: 0, maxValue: 9 },
        { name: 'bpm', defaultValue: 120, minValue: 60, maxValue: 200 }
      ]
    });

    // StardustChorus
    this.register('StardustChorus', {
      workletPath: '/worklets/effects/stardust-chorus-processor.js',
      processorName: 'stardust-chorus-processor',
      parameters: [
        { name: 'rate', defaultValue: 1.5, minValue: 0.1, maxValue: 10 },
        { name: 'delayTime', defaultValue: 3.5, minValue: 1, maxValue: 20 },
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
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 },
        // ✅ NEW: Tempo sync
        { name: 'tempoSync', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'noteDivision', defaultValue: 3, minValue: 0, maxValue: 9 },
        { name: 'bpm', defaultValue: 120, minValue: 60, maxValue: 200 }
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
        { name: 'pitch', defaultValue: 0, minValue: -24, maxValue: 24 },
        { name: 'fineTune', defaultValue: 0, minValue: -100, maxValue: 100 },
        { name: 'formantShift', defaultValue: 0, minValue: -24, maxValue: 24 },
        { name: 'quality', defaultValue: 1, minValue: 0, maxValue: 2 },
        // ✅ NEW: Pitch Algorithm (0=PSOLA, 1=Phase Vocoder, 2=Elastique-like)
        { name: 'pitchAlgorithm', defaultValue: 1, minValue: 0, maxValue: 2 },
        // ✅ NEW: Formant Preservation (0=off, 1=on)
        { name: 'formantPreservation', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'inputGain', defaultValue: 0, minValue: -24, maxValue: 24 },
        { name: 'outputGain', defaultValue: 0, minValue: -24, maxValue: 24 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
      ]
    });

    // ❌ REMOVED: AtmosMachine (overlaps with ModernReverb)
    // ❌ REMOVED: GhostLFO (unclear purpose, no use case)
    // ❌ REMOVED: SampleMorph (advanced granular, too complex)

    // BassEnhancer808 V3.0 - With TASTE & TEXTURE
    this.register('BassEnhancer808', {
      workletPath: '/worklets/effects/bass-enhancer-808-processor.js',
      processorName: 'bass-enhancer-808-processor',
      parameters: [
        { name: 'subBoost', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'saturation', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'punch', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'taste', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'texture', defaultValue: 0.5, minValue: 0, maxValue: 1 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
      ]
    });

    // ❌ REMOVED: SidechainCompressor (will be integrated into main Compressor)

    // ModernReverb v2.0 - With modulation and stereo width
    this.register('ModernReverb', {
      workletPath: '/worklets/effects/modern-reverb-processor.js',
      processorName: 'modern-reverb-processor',
      parameters: [
        { name: 'size', defaultValue: 0.7, minValue: 0.0, maxValue: 1.0 },
        { name: 'decay', defaultValue: 2.5, minValue: 0.1, maxValue: 15.0 },
        { name: 'damping', defaultValue: 0.5, minValue: 0.0, maxValue: 1.0 },
        { name: 'width', defaultValue: 1.0, minValue: 0.0, maxValue: 2.0 },      // Updated: 0=mono, 1=normal, 2=ultra-wide
        { name: 'preDelay', defaultValue: 0.02, minValue: 0.0, maxValue: 0.2 },
        { name: 'wet', defaultValue: 0.35, minValue: 0.0, maxValue: 1.0 },
        { name: 'earlyLateMix', defaultValue: 0.5, minValue: 0.0, maxValue: 1.0 },
        { name: 'diffusion', defaultValue: 0.7, minValue: 0.0, maxValue: 1.0 },
        { name: 'modDepth', defaultValue: 0.3, minValue: 0.0, maxValue: 1.0 },   // Chorus modulation depth
        { name: 'modRate', defaultValue: 0.5, minValue: 0.1, maxValue: 2.0 },    // LFO rate in Hz
        { name: 'lowCut', defaultValue: 100, minValue: 20, maxValue: 1000 },     // 🎯 NEW: High-pass filter
        { name: 'highCut', defaultValue: 20000, minValue: 2000, maxValue: 20000 }, // ✅ NEW: Low-pass filter
        { name: 'shimmer', defaultValue: 0.0, minValue: 0.0, maxValue: 1.0 },     // 🎯 NEW: Pitch shift amount
        { name: 'reverbAlgorithm', defaultValue: 0, minValue: 0, maxValue: 4 }     // ✅ NEW: Reverb algorithm (0=Room, 1=Hall, 2=Plate, 3=Spring, 4=Chamber)
      ]
    });

    // ModernDelay
    this.register('ModernDelay', {
      workletPath: '/worklets/effects/modern-delay-processor.js',
      processorName: 'modern-delay-processor',
      parameters: [
        { name: 'timeLeft', defaultValue: 0.375, minValue: 0.001, maxValue: 4 },
        { name: 'timeRight', defaultValue: 0.5, minValue: 0.001, maxValue: 4 },
        { name: 'feedbackLeft', defaultValue: 0.4, minValue: 0, maxValue: 1 },
        { name: 'feedbackRight', defaultValue: 0.4, minValue: 0, maxValue: 1 },
        { name: 'pingPong', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'wet', defaultValue: 0.35, minValue: 0, maxValue: 1 },
        { name: 'filterFreq', defaultValue: 8000, minValue: 100, maxValue: 20000 },
        { name: 'filterQ', defaultValue: 1.0, minValue: 0.1, maxValue: 20.0 },
        { name: 'saturation', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'diffusion', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'wobble', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'flutter', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'modDepth', defaultValue: 0.0, minValue: 0.0, maxValue: 0.05 },
        { name: 'modRate', defaultValue: 0.5, minValue: 0.1, maxValue: 5.0 },
        { name: 'width', defaultValue: 1.0, minValue: 0.0, maxValue: 2.0 },
        // ✅ NEW: Delay model, tempo sync, and note division
        { name: 'delayModel', defaultValue: 0, minValue: 0, maxValue: 3 },
        { name: 'tempoSync', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'noteDivision', defaultValue: 3, minValue: 0, maxValue: 9 },
        { name: 'bpm', defaultValue: 120, minValue: 60, maxValue: 200 }
      ]
    });

    // HalfTime - Time Stretcher
    this.register('HalfTime', {
      workletPath: '/worklets/effects/halftime-processor.js',
      processorName: 'halftime-processor',
      parameters: [
        { name: 'rate', defaultValue: 0.5, minValue: 0.25, maxValue: 2.0 },
        { name: 'smoothing', defaultValue: 50, minValue: 0, maxValue: 100 },
        { name: 'pitchShift', defaultValue: -12, minValue: -24, maxValue: 24 },
        { name: 'grainSize', defaultValue: 100, minValue: 50, maxValue: 500 },
        { name: 'grainDensity', defaultValue: 8, minValue: 1, maxValue: 16 },
        { name: 'pitchLock', defaultValue: 1, minValue: 0, maxValue: 1 },
        { name: 'mix', defaultValue: 100, minValue: 0, maxValue: 100 },
        { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 5 },
        { name: 'analogWarmth', defaultValue: 0, minValue: 0, maxValue: 100 },
        { name: 'glitchAmount', defaultValue: 0, minValue: 0, maxValue: 100 },
        { name: 'reverse', defaultValue: 0, minValue: 0, maxValue: 1 }
      ]
    });

    // Limiter - Professional Mastering
    // Limiter v2.0 - Professional mastering-grade brick wall limiter
    this.register('Limiter', {
      workletPath: '/worklets/effects/limiter-processor.js',
      processorName: 'limiter-processor',
      parameters: [
        { name: 'ceiling', defaultValue: -0.1, minValue: -10, maxValue: 0 },
        { name: 'release', defaultValue: 100, minValue: 10, maxValue: 1000 },
        { name: 'attack', defaultValue: 0.1, minValue: 0.01, maxValue: 10 },
        { name: 'lookahead', defaultValue: 5, minValue: 0, maxValue: 10 },
        { name: 'knee', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'stereoLink', defaultValue: 100, minValue: 0, maxValue: 100 },
        { name: 'autoGain', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 4 },
        { name: 'truePeak', defaultValue: 1, minValue: 0, maxValue: 1 },
        { name: 'oversample', defaultValue: 4, minValue: 1, maxValue: 8 },
        // 🎯 NEW v2.0: Advanced mastering controls
        { name: 'dither', defaultValue: 0, minValue: 0, maxValue: 2 },
        { name: 'outputTrim', defaultValue: 0, minValue: -12, maxValue: 12 },
        { name: 'transientPreserve', defaultValue: 0, minValue: 0, maxValue: 1 }
      ]
    });

    // Clipper - The Hard Edge
    this.register('Clipper', {
      workletPath: '/worklets/effects/clipper-processor.js',
      processorName: 'clipper-processor',
      parameters: [
        { name: 'ceiling', defaultValue: 0.0, minValue: -10, maxValue: 3 },
        { name: 'hardness', defaultValue: 100, minValue: 0, maxValue: 100 },
        { name: 'harmonics', defaultValue: 50, minValue: 0, maxValue: 100 },
        { name: 'preGain', defaultValue: 0, minValue: -12, maxValue: 12 },
        { name: 'postGain', defaultValue: 0, minValue: -12, maxValue: 12 },
        { name: 'mix', defaultValue: 100, minValue: 0, maxValue: 100 },
        { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 5 },
        { name: 'dcFilter', defaultValue: 1, minValue: 0, maxValue: 1 },
        { name: 'oversample', defaultValue: 2, minValue: 1, maxValue: 8 }
      ]
    });

    // Rhythm FX - The Groove Sculptor
    this.register('RhythmFX', {
      workletPath: '/worklets/effects/rhythm-fx-processor.js',
      processorName: 'rhythm-fx-processor',
      parameters: [
        { name: 'division', defaultValue: 16, minValue: 1, maxValue: 64 },
        { name: 'chance', defaultValue: 100, minValue: 0, maxValue: 100 },
        { name: 'intensity', defaultValue: 100, minValue: 0, maxValue: 100 },
        { name: 'swing', defaultValue: 50, minValue: 0, maxValue: 100 },
        { name: 'bufferSize', defaultValue: 500, minValue: 10, maxValue: 2000 },
        { name: 'fadeTime', defaultValue: 10, minValue: 1, maxValue: 50 },
        { name: 'glitchAmount', defaultValue: 50, minValue: 0, maxValue: 100 },
        { name: 'tapeSpeed', defaultValue: 100, minValue: -200, maxValue: 200 },
        { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 5 },
        { name: 'bpm', defaultValue: 128, minValue: 60, maxValue: 200 },
        { name: 'tempoSync', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'noteDivision', defaultValue: 0.25, minValue: 0.01, maxValue: 4 }
      ]
    });

    // Maximizer - Loudness Maximizer (Master Chain)
    this.register('Maximizer', {
      workletPath: '/worklets/effects/maximizer-processor.js',
      processorName: 'maximizer-processor',
      parameters: [
        { name: 'inputGain', defaultValue: 0, minValue: -12, maxValue: 12 },
        { name: 'saturation', defaultValue: 0.3, minValue: 0, maxValue: 1 },
        { name: 'ceiling', defaultValue: -0.1, minValue: -6, maxValue: 0 },
        { name: 'release', defaultValue: 0.1, minValue: 0.01, maxValue: 1 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 },
        // New true-peak limiting controls
        { name: 'lookahead', defaultValue: 3, minValue: 0, maxValue: 10 },
        { name: 'truePeak', defaultValue: 1, minValue: 0, maxValue: 1 }
      ]
    });

    // Imager V3.0 - Multiband Stereo Imaging (Master Chain)
    this.register('Imager', {
      workletPath: '/worklets/effects/imager-processor.js',
      processorName: 'imager-processor',
      parameters: [
        // Band frequencies (crossover points)
        { name: 'band1Freq', defaultValue: 100, minValue: 20, maxValue: 200 },
        { name: 'band2Freq', defaultValue: 600, minValue: 200, maxValue: 1000 },
        { name: 'band3Freq', defaultValue: 3000, minValue: 1000, maxValue: 6000 },
        { name: 'band4Freq', defaultValue: 6000, minValue: 3000, maxValue: 20000 },

        // Band widths (-100 to +100)
        { name: 'band1Width', defaultValue: 0, minValue: -100, maxValue: 100 },
        { name: 'band2Width', defaultValue: 0, minValue: -100, maxValue: 100 },
        { name: 'band3Width', defaultValue: 0, minValue: -100, maxValue: 100 },
        { name: 'band4Width', defaultValue: 0, minValue: -100, maxValue: 100 },

        // Band mutes
        { name: 'band1Mute', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'band2Mute', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'band3Mute', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'band4Mute', defaultValue: 0, minValue: 0, maxValue: 1 },

        // Band solos
        { name: 'band1Solo', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'band2Solo', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'band3Solo', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'band4Solo', defaultValue: 0, minValue: 0, maxValue: 1 },

        // Global controls
        { name: 'stereoize', defaultValue: 0, minValue: 0, maxValue: 1 },
        { name: 'globalWidth', defaultValue: 1.0, minValue: 0, maxValue: 2 },
        { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
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
      // WASM polyfill loading removed as ModernReverb and ModernDelay are now pure JS

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

    // 🎛️ SIDECHAIN: Compressor needs 2 inputs (main + sidechain)
    const needsSidechain = effectType === 'Compressor';
    const numberOfInputs = needsSidechain ? 2 : 1;

    // Create parameter descriptors for the node
    const nodeOptions = {
      numberOfInputs,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      // 🔧 FIX: Force stereo processing for all effects
      channelCount: 2,              // Always process 2 channels (L/R)
      channelCountMode: 'explicit', // Don't auto-change based on input
      channelInterpretation: 'speakers', // L/R speaker layout
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
      // 🔧 FIX: Force stereo processing
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
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
   * Get v2.0 metadata for an effect (category, version, features)
   */
  getMetadata(effectType) {
    // v2.0 metadata mapping
    const metadata = {
      // Dynamics Forge
      'Compressor': {
        category: 'dynamics-forge',
        version: '2.0',
        features: ['RMS/Peak Detection', 'Sidechain', 'Lookahead', 'Auto-Makeup'],
        complexity: 'advanced',
        cpuUsage: 'medium'
      },
      'Limiter': {
        category: 'dynamics-forge',
        version: '2.0',
        features: ['TPDF Dither', 'Transient Preserve', 'True-Peak', 'Oversampling'],
        complexity: 'advanced',
        cpuUsage: 'high'
      },
      'OTT': {
        category: 'dynamics-forge',
        version: '1.0',
        features: ['Multiband', 'Upward/Downward', '3-Band'],
        complexity: 'advanced',
        cpuUsage: 'high'
      },
      'TransientDesigner': {
        category: 'dynamics-forge',
        version: '1.0',
        features: ['Attack/Sustain', 'Envelope Shaping'],
        complexity: 'simple',
        cpuUsage: 'low'
      },
      'Maximizer': {
        category: 'dynamics-forge',
        version: '1.0',
        features: ['True-Peak', 'Lookahead', 'Saturation'],
        complexity: 'intermediate',
        cpuUsage: 'medium'
      },
      'Clipper': {
        category: 'dynamics-forge',
        version: '1.0',
        features: ['Hard/Soft Clipping', 'Harmonic Control', 'Oversampling'],
        complexity: 'intermediate',
        cpuUsage: 'medium'
      },

      // Spacetime Chamber
      'ModernReverb': {
        category: 'spacetime-chamber',
        version: '2.0',
        features: ['Modulation', 'Stereo Width', 'Early/Late Mix', 'Diffusion'],
        complexity: 'advanced',
        cpuUsage: 'high'
      },
      'ModernDelay': {
        category: 'spacetime-chamber',
        version: '1.0',
        features: ['Ping-Pong', 'Filter', 'Saturation', 'Modulation', 'Stereo'],
        complexity: 'advanced',
        cpuUsage: 'medium'
      },

      // Spectral Weave
      'MultiBandEQ': {
        category: 'spectral-weave',
        version: '2.0',
        features: ['Dynamic Bands', 'Multiple Filter Types', 'Visual Curve'],
        complexity: 'advanced',
        cpuUsage: 'medium'
      },
      'TidalFilter': {
        category: 'spectral-weave',
        version: '1.0',
        features: ['Resonance', 'Drive', 'LP/HP Modes'],
        complexity: 'simple',
        cpuUsage: 'low'
      },

      // Texture Lab
      'Saturator': {
        category: 'texture-lab',
        version: '2.0',
        features: ['Multiband Saturation', 'Linkwitz-Riley Crossovers', '3-Band Processing'],
        complexity: 'advanced',
        cpuUsage: 'medium'
      },
      'ArcadeCrusher': {
        category: 'texture-lab',
        version: '1.0',
        features: ['Bit Depth Reduction', 'Sample Rate Reduction'],
        complexity: 'simple',
        cpuUsage: 'low'
      },
      'BassEnhancer808': {
        category: 'texture-lab',
        version: '3.0',
        features: ['Sub Boost', 'Saturation', 'Punch', 'Taste', 'Texture'],
        complexity: 'intermediate',
        cpuUsage: 'medium'
      },

      // Modulation Matrix
      'StardustChorus': {
        category: 'modulation-matrix',
        version: '1.0',
        features: ['Multi-Voice', 'Stereo Width', 'Rate/Depth'],
        complexity: 'intermediate',
        cpuUsage: 'medium'
      },
      'VortexPhaser': {
        category: 'modulation-matrix',
        version: '1.0',
        features: ['Multi-Stage', 'Feedback', 'Stereo Phase'],
        complexity: 'intermediate',
        cpuUsage: 'medium'
      },
      'OrbitPanner': {
        category: 'modulation-matrix',
        version: '1.0',
        features: ['LFO Shapes', 'Stereo Width', 'Rate/Depth'],
        complexity: 'simple',
        cpuUsage: 'low'
      },

      // Utility Station
      'Imager': {
        category: 'utility-station',
        version: '3.0',
        features: ['Multiband', '4-Band', 'M/S Processing', 'Solo/Mute'],
        complexity: 'advanced',
        cpuUsage: 'medium'
      },

      // Creative Workshop
      'PitchShifter': {
        category: 'creative-workshop',
        version: '1.0',
        features: ['Pitch Shifting', 'Window Size Control'],
        complexity: 'intermediate',
        cpuUsage: 'high'
      },
      'HalfTime': {
        category: 'creative-workshop',
        version: '1.0',
        features: ['Time Stretching', 'Pitch Lock', 'Granular', 'Glitch'],
        complexity: 'advanced',
        cpuUsage: 'very-high'
      },
      'RhythmFX': {
        category: 'creative-workshop',
        version: '1.0',
        features: ['Rhythmic Gating', 'Swing', 'Glitch', 'Tape Speed'],
        complexity: 'advanced',
        cpuUsage: 'medium'
      }
    };

    return metadata[effectType] || {
      category: 'utility-station',
      version: '1.0',
      features: [],
      complexity: 'simple',
      cpuUsage: 'low'
    };
  }

  /**
   * Get all effects in a category
   */
  getEffectsByCategory(category) {
    const effects = [];
    for (const [effectType, config] of this.effects) {
      const metadata = this.getMetadata(effectType);
      if (metadata.category === category) {
        effects.push({
          type: effectType,
          config,
          metadata
        });
      }
    }
    return effects;
  }

  /**
   * Get all categories with their effects
   */
  getCategories() {
    const categories = {
      'dynamics-forge': [],
      'spacetime-chamber': [],
      'spectral-weave': [],
      'texture-lab': [],
      'modulation-matrix': [],
      'utility-station': [],
      'creative-workshop': []
    };

    for (const effectType of this.effects.keys()) {
      const metadata = this.getMetadata(effectType);
      categories[metadata.category].push({
        type: effectType,
        metadata
      });
    }

    return categories;
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
