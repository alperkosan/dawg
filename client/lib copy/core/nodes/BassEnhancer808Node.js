// === 5. TONE.JS NODE IMPLEMENTATION ===
// client/src/lib/core/nodes/BassEnhancer808Node.js

import * as Tone from 'tone';

export class BassEnhancer808Node {
  constructor(settings = {}) {
    // Input/Output
    this.input = new Tone.Gain(1);
    this.output = new Tone.Gain(1);
    
    // Manual Wet/Dry implementation (Tone.WetDry deprecated)
    this.wetGain = new Tone.Gain(settings.wet || 1.0);
    this.dryGain = new Tone.Gain(1 - (settings.wet || 1.0));
    this.wetDryMixer = new Tone.Gain(1);
    
    // === MULTIBAND PROCESSING ===
    this.lowSplit = new Tone.Filter({ type: 'lowpass', frequency: 150, Q: 0.7 });
    this.midSplit = new Tone.Filter({ type: 'highpass', frequency: 150, Q: 0.7 });
    
    // === LOW BAND (808 PROCESSING) ===
    this.lowCompressor = new Tone.Compressor({
      threshold: -15,
      ratio: 6,
      attack: 0.001,
      release: 0.08,
      knee: 3
    });
    
    this.subBoost = new Tone.Filter({
      type: 'lowshelf',
      frequency: 80,
      Q: 0.8,
      gain: 0
    });
    
    // Advanced saturator with multiple stages
    this.lowSaturator = new Tone.WaveShaper((value) => {
      const drive = this._lowDrive || 1.5;
      const warmth = this._warmth || 0.3;
      
      // Stage 1: Tube-style soft saturation
      let processed = value * drive;
      processed = Math.tanh(processed * 0.8) * 1.2;
      
      // Stage 2: Harmonic enhancement
      const fundamental = Math.sin(processed * Math.PI * 2) * 0.05 * warmth;
      const secondHarmonic = Math.sin(processed * Math.PI * 4) * 0.03 * warmth;
      
      // Stage 3: Punch enhancement
      const punch = Math.sign(processed) * Math.pow(Math.abs(processed), 0.8) * this._punch * 0.2;
      
      return Math.tanh(processed + fundamental + secondHarmonic + punch) * 0.9;
    }, 2048);
    
    // === MID BAND (CLARITY) ===
    this.midCompressor = new Tone.Compressor({
      threshold: -18,
      ratio: 3,
      attack: 0.005,
      release: 0.15,
      knee: 2
    });
    
    this.midSaturator = new Tone.WaveShaper((value) => {
      const drive = this._midDrive || 1.2;
      return Math.tanh(value * drive) * 0.95;
    }, 1024);
    
    // === PUNCH ENHANCEMENT ===
    this.punchFilter = new Tone.Filter({
      type: 'peaking',
      frequency: 200,
      Q: 3.0,
      gain: 0
    });
    
    // === WARMTH PROCESSING ===
    this.warmthFilter = new Tone.Filter({
      type: 'lowshelf',
      frequency: 300,
      Q: 0.6,
      gain: 0
    });
    
    this.warmthSaturator = new Tone.WaveShaper((value) => {
      const warmth = this._warmth || 0.3;
      const evenHarmonic = Math.sin(value * Math.PI) * 0.08 * warmth;
      return Math.tanh(value + evenHarmonic) * 0.95;
    }, 512);
    
    // === FINAL LIMITING ===
    this.finalLimiter = new Tone.Compressor({
      threshold: -1,
      ratio: 20,
      attack: 0.001,
      release: 0.01,
      knee: 0
    });
    
    // === PARALLEL MIXER ===
    this.lowMixer = new Tone.Gain(1);
    this.midMixer = new Tone.Gain(1);
    this.finalMixer = new Tone.Gain(1);
    
    // === SIGNAL ROUTING ===
    // Low path
    this.input.connect(this.lowSplit);
    this.lowSplit.chain(
      this.lowCompressor,
      this.subBoost,
      this.lowSaturator,
      this.punchFilter,
      this.lowMixer
    );
    
    // Mid path  
    this.input.connect(this.midSplit);
    this.midSplit.chain(
      this.midCompressor,
      this.midSaturator,
      this.midMixer
    );
    
    // Final mix
    this.lowMixer.connect(this.finalMixer);
    this.midMixer.connect(this.finalMixer);
    
    // Processed signal path
    this.finalMixer.chain(
      this.warmthFilter,
      this.warmthSaturator,
      this.finalLimiter,
      this.wetGain
    );
    
    // Dry signal path
    this.input.connect(this.dryGain);
    
    // Mix wet and dry
    this.wetGain.connect(this.wetDryMixer);
    this.dryGain.connect(this.wetDryMixer);
    this.wetDryMixer.connect(this.output);
    
    // Internal parameters
    this._lowDrive = 1.5;
    this._midDrive = 1.2;
    this._warmth = 0.3;
    this._punch = 0.5;
    
    // Apply initial settings
    this.updateParams(settings);
  }
  
  updateParams(settings) {
    const {
      saturation = 0.3,
      compression = 0.4,
      subBoost = 0.6,
      punch = 0.5,
      warmth = 0.3,
      wet = 1.0
    } = settings;
    
    // === COMPRESSION PARAMETERS ===
    const lowThreshold = -20 + (compression * 15); // -20dB to -5dB
    const lowRatio = 2 + (compression * 6); // 2:1 to 8:1
    const lowAttack = 0.0005 + (compression * 0.005); // 0.5ms to 5.5ms
    const lowRelease = 0.03 + (compression * 0.15); // 30ms to 180ms
    
    this.lowCompressor.threshold.rampTo(lowThreshold, 0.01);
    this.lowCompressor.ratio.value = lowRatio;
    this.lowCompressor.attack.value = lowAttack;
    this.lowCompressor.release.value = lowRelease;
    
    const midThreshold = -25 + (compression * 10);
    const midRatio = 1.5 + (compression * 3);
    
    this.midCompressor.threshold.rampTo(midThreshold, 0.01);
    this.midCompressor.ratio.value = midRatio;
    
    // === SATURATION PARAMETERS ===
    this._lowDrive = 1 + (saturation * 4); // 1x to 5x
    this._midDrive = 1 + (saturation * 2); // 1x to 3x
    
    // === SUB BOOST ===
    const subGain = subBoost * 15; // 0dB to +15dB
    this.subBoost.gain.rampTo(subGain, 0.02);
    
    // === PUNCH ENHANCEMENT ===
    const punchGain = punch * 8; // 0dB to +8dB
    this.punchFilter.gain.rampTo(punchGain, 0.02);
    
    // Punch frequency modulation based on intensity
    const punchFreq = 180 + (punch * 80); // 180Hz to 260Hz
    this.punchFilter.frequency.rampTo(punchFreq, 0.02);
    
    // === WARMTH ===
    this._warmth = warmth;
    const warmthGain = warmth * 4; // 0dB to +4dB
    this.warmthFilter.gain.rampTo(warmthGain, 0.02);
    
    // === MIX LEVELS ===
    // Parallel processing balance
    const lowLevel = 0.7 + (subBoost * 0.3);
    const midLevel = 0.8 - (subBoost * 0.2);
    
    this.lowMixer.gain.rampTo(lowLevel, 0.01);
    this.midMixer.gain.rampTo(midLevel, 0.01);
    
    // === WET/DRY ===
    this.wetGain.gain.rampTo(wet, 0.01);
    this.dryGain.gain.rampTo(1 - wet, 0.01);
    
    // === INTERNAL STATE ===
    this._punch = punch;
  }
  
  // Gain reduction için
  get reduction() {
    return Math.min(this.lowCompressor.reduction, this.midCompressor.reduction);
  }
  
  dispose() {
    [
      this.input, this.output, this.wetGain, this.dryGain, this.wetDryMixer,
      this.lowSplit, this.midSplit,
      this.lowCompressor, this.midCompressor,
      this.subBoost, this.lowSaturator, this.midSaturator,
      this.punchFilter, this.warmthFilter, this.warmthSaturator,
      this.finalLimiter, this.lowMixer, this.midMixer, this.finalMixer
    ].forEach(node => node?.dispose());
  }
}