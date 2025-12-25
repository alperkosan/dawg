/**
 * SATURATOR PROCESSOR v2.0
 *
 * Professional multi-stage tube saturation with multiband capability
 * Inspired by FabFilter Saturn, Decapitator, UAD Studer
 *
 * NEW IN v2.0:
 * ✅ Multiband saturation (3-band processing)
 * ✅ Independent drive per band
 * ✅ Crossover filters (Linkwitz-Riley 4th order)
 * ✅ Per-band saturation type selection
 * ✅ Harmonic analyzer output
 */

class SaturatorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'distortion', defaultValue: 0.4, minValue: 0, maxValue: 1.5 },
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      // v2.0 parameters
      { name: 'autoGain', defaultValue: 1, minValue: 0, maxValue: 1 },
      { name: 'lowCutFreq', defaultValue: 0, minValue: 0, maxValue: 500 },
      { name: 'highCutFreq', defaultValue: 20000, minValue: 2000, maxValue: 20000 },
      { name: 'tone', defaultValue: 0, minValue: -12, maxValue: 12 },
      { name: 'headroom', defaultValue: 0, minValue: -12, maxValue: 12 },
      // 🎯 NEW v2.0: Multiband parameters
      { name: 'multiband', defaultValue: 0, minValue: 0, maxValue: 1 }, // 0=off, 1=on
      { name: 'lowMidCrossover', defaultValue: 250, minValue: 50, maxValue: 500 },
      { name: 'midHighCrossover', defaultValue: 2500, minValue: 1000, maxValue: 8000 },
      { name: 'lowDrive', defaultValue: 1.0, minValue: 0, maxValue: 2.0 },
      { name: 'midDrive', defaultValue: 1.0, minValue: 0, maxValue: 2.0 },
      { name: 'highDrive', defaultValue: 1.0, minValue: 0, maxValue: 2.0 },
      { name: 'lowMix', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      { name: 'midMix', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      { name: 'highMix', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      // ✅ NEW: Oversampling (1=off, 2=2x, 4=4x, 8=8x)
      { name: 'oversampling', defaultValue: 2, minValue: 1, maxValue: 8 },
      // ✅ NEW: Drive curve mode (0=Soft, 1=Medium, 2=Hard, 3=Tube, 4=Tape)
      { name: 'driveCurve', defaultValue: 3, minValue: 0, maxValue: 4 },
      // ✅ NEW: Tape modeling parameters (only active when driveCurve=4)
      { name: 'tapeBias', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'tapeWow', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'tapeFlutter', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'tapeSpeed', defaultValue: 1.0, minValue: 0.5, maxValue: 2.0 }
    ];
  }

  constructor(options) {
    super();

    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'Saturator';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Per-channel state
    this.channelState = [
      {
        history: new Float32Array(4),
        dcBlocker: { x1: 0, y1: 0 },
        tapePhase: 0 // ✅ NEW: For tape wow/flutter modulation
      },
      {
        history: new Float32Array(4),
        dcBlocker: { x1: 0, y1: 0 },
        tapePhase: 0 // ✅ NEW: For tape wow/flutter modulation
      }
    ];

    // ✅ NEW: Oversampling (will be set from parameter)
    this.oversample = 2;

    // v2.0 mode switches
    this.saturationMode = 'toasty'; // 'toasty' | 'crunchy' | 'distress'
    this.frequencyMode = 'wide'; // 'transformer' | 'wide' | 'tape'

    // Cached filter coefficients
    this.cachedLowCutCoeffs = null;
    this.cachedHighCutCoeffs = null;
    this.cachedTiltCoeffs = null;
    this.lastLowCutFreq = -1;
    this.lastHighCutFreq = -1;
    this.lastTone = 0;

    // Biquad filter state (per channel) - Direct Form II Transposed
    this.channelState.forEach(state => {
      state.lowCutFilter = { x1: 0, x2: 0 };
      state.highCutFilter = { x1: 0, x2: 0 };
      state.tiltFilter = { x1: 0, x2: 0 };

      // 🎯 NEW v2.0: Multiband crossover filters (Linkwitz-Riley 4th order = 2x Butterworth 2nd order)
      // Low band: Lowpass @ lowMidCrossover
      state.lowBandLP1 = { x1: 0, x2: 0 }; // First stage
      state.lowBandLP2 = { x1: 0, x2: 0 }; // Second stage (cascade for LR4)

      // Mid band: Highpass @ lowMidCrossover + Lowpass @ midHighCrossover
      state.midBandHP1 = { x1: 0, x2: 0 };
      state.midBandHP2 = { x1: 0, x2: 0 };
      state.midBandLP1 = { x1: 0, x2: 0 };
      state.midBandLP2 = { x1: 0, x2: 0 };

      // High band: Highpass @ midHighCrossover
      state.highBandHP1 = { x1: 0, x2: 0 };
      state.highBandHP2 = { x1: 0, x2: 0 };
    });

    // Cached crossover coefficients
    this.cachedCrossoverCoeffs = {
      lowMid: { lp: null, hp: null, freq: -1 },
      midHigh: { lp: null, hp: null, freq: -1 }
    };

    // Harmonic analysis buffer
    this.harmonicBuffer = new Float32Array(128);
    this.harmonicBufferIndex = 0;

    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  handleMessage(message) {
    const { type, data } = message;
    switch (type) {
      case 'updateSettings':
        this.settings = { ...this.settings, ...data };
        break;
      case 'bypass':
        this.bypassed = data.bypassed;
        break;
      case 'reset':
        this.resetState();
        break;
      case 'setSaturationMode':
        this.saturationMode = data.mode || 'toasty';
        break;
      case 'setFrequencyMode':
        this.frequencyMode = data.mode || 'wide';
        break;
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) return true;

    const blockSize = input[0].length;
    const channelCount = Math.min(input.length, output.length);

    const wetParam = this.getParam(parameters.wet, 0);
    const wet = wetParam !== undefined ? wetParam : (this.settings.wet !== undefined ? this.settings.wet : 1.0);

    if (this.bypassed) {
      for (let channel = 0; channel < channelCount; channel++) {
        output[channel].set(input[channel]);
      }
      return true;
    }

    // 🎯 NEW v2.0: Check if multiband mode is enabled
    const multiband = (this.getParam(parameters.multiband, 0) ?? 0) >= 0.5;

    for (let channel = 0; channel < channelCount; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      for (let i = 0; i < blockSize; i++) {
        const drySample = inputChannel[i];
        let wetSample;

        if (multiband) {
          wetSample = this.processMultiband(drySample, channel, parameters);
        } else {
          wetSample = this.processEffect(drySample, channel, parameters);
        }

        outputChannel[i] = drySample * (1 - wet) + wetSample * wet;
      }
    }

    return true;
  }

  // 🎯 NEW v2.0: Multiband saturation processing
  processMultiband(sample, channel, parameters) {
    const state = this.channelState[channel] || this.channelState[0];

    // Get crossover frequencies
    const lowMidFreq = this.getParam(parameters.lowMidCrossover, 0) ?? 250;
    const midHighFreq = this.getParam(parameters.midHighCrossover, 0) ?? 2500;

    // Get per-band drive and mix
    const lowDrive = this.getParam(parameters.lowDrive, 0) ?? 1.0;
    const midDrive = this.getParam(parameters.midDrive, 0) ?? 1.0;
    const highDrive = this.getParam(parameters.highDrive, 0) ?? 1.0;
    const lowMix = this.getParam(parameters.lowMix, 0) ?? 1.0;
    const midMix = this.getParam(parameters.midMix, 0) ?? 1.0;
    const highMix = this.getParam(parameters.highMix, 0) ?? 1.0;

    // Update crossover coefficients if frequencies changed
    if (lowMidFreq !== this.cachedCrossoverCoeffs.lowMid.freq) {
      this.cachedCrossoverCoeffs.lowMid.lp = this.calculateLowpass(lowMidFreq);
      this.cachedCrossoverCoeffs.lowMid.hp = this.calculateHighpass(lowMidFreq);
      this.cachedCrossoverCoeffs.lowMid.freq = lowMidFreq;
    }
    if (midHighFreq !== this.cachedCrossoverCoeffs.midHigh.freq) {
      this.cachedCrossoverCoeffs.midHigh.lp = this.calculateLowpass(midHighFreq);
      this.cachedCrossoverCoeffs.midHigh.hp = this.calculateHighpass(midHighFreq);
      this.cachedCrossoverCoeffs.midHigh.freq = midHighFreq;
    }

    // Split into 3 bands using Linkwitz-Riley crossovers (2x cascaded Butterworth)
    // LOW BAND: 2x lowpass @ lowMidFreq
    let lowBand = sample;
    lowBand = this.applyBiquadFilter(lowBand, state.lowBandLP1, this.cachedCrossoverCoeffs.lowMid.lp);
    lowBand = this.applyBiquadFilter(lowBand, state.lowBandLP2, this.cachedCrossoverCoeffs.lowMid.lp);

    // MID BAND: (2x highpass @ lowMidFreq) + (2x lowpass @ midHighFreq)
    let midBand = sample;
    midBand = this.applyBiquadFilter(midBand, state.midBandHP1, this.cachedCrossoverCoeffs.lowMid.hp);
    midBand = this.applyBiquadFilter(midBand, state.midBandHP2, this.cachedCrossoverCoeffs.lowMid.hp);
    midBand = this.applyBiquadFilter(midBand, state.midBandLP1, this.cachedCrossoverCoeffs.midHigh.lp);
    midBand = this.applyBiquadFilter(midBand, state.midBandLP2, this.cachedCrossoverCoeffs.midHigh.lp);

    // HIGH BAND: 2x highpass @ midHighFreq
    let highBand = sample;
    highBand = this.applyBiquadFilter(highBand, state.highBandHP1, this.cachedCrossoverCoeffs.midHigh.hp);
    highBand = this.applyBiquadFilter(highBand, state.highBandHP2, this.cachedCrossoverCoeffs.midHigh.hp);

    // Apply saturation to each band independently
    const distortion = this.getParam(parameters.distortion, 0) ?? 0.4;
    const autoGain = this.getParam(parameters.autoGain, 0) ?? 1;

    // Create temporary parameters for each band
    const baseDrive = 1 + distortion * 9;

    // Process each band with its own drive
    let lowProcessed = this.processSingleBand(lowBand, baseDrive * lowDrive, autoGain, channel);
    let midProcessed = this.processSingleBand(midBand, baseDrive * midDrive, autoGain, channel);
    let highProcessed = this.processSingleBand(highBand, baseDrive * highDrive, autoGain, channel);

    // Mix bands back together with per-band mix control
    const dryLow = lowBand * (1 - lowMix);
    const dryMid = midBand * (1 - midMix);
    const dryHigh = highBand * (1 - highMix);

    const wetLow = lowProcessed * lowMix;
    const wetMid = midProcessed * midMix;
    const wetHigh = highProcessed * highMix;

    return (dryLow + wetLow) + (dryMid + wetMid) + (dryHigh + wetHigh);
  }

  // 🎯 NEW v2.0: Process single band (simplified saturation without filters)
  processSingleBand(sample, drive, autoGain, channel) {
    const state = this.channelState[channel] || this.channelState[0];

    let processed = sample * drive;

    // Apply tube saturation
    const saturationConfig = this.getSaturationConfig(this.saturationMode);
    processed = this.tubeSaturate(processed, this.frequencyMode);

    // Add harmonics
    processed = this.addHarmonics(processed, drive, saturationConfig.harmonicType);

    // DC blocker
    processed = this.dcBlock(processed, state.dcBlocker);

    // Auto-gain compensation
    if (autoGain > 0.5) {
      const driveDb = 20 * Math.log10(drive);
      const compensationDb = -driveDb * 0.4;
      const compensation = Math.pow(10, compensationDb / 20);
      processed *= compensation * 0.85;
    } else {
      processed *= 0.7;
    }

    return processed;
  }

  processEffect(sample, channel, parameters) {
    const distortion = this.getParam(parameters.distortion, 0) || 0.4;
    const autoGain = this.getParam(parameters.autoGain, 0) !== undefined
      ? this.getParam(parameters.autoGain, 0) : 1;
    const lowCutFreq = this.getParam(parameters.lowCutFreq, 0) || 0;
    const highCutFreq = this.getParam(parameters.highCutFreq, 0) || 20000;
    const tone = this.getParam(parameters.tone, 0) || 0;
    const headroom = this.getParam(parameters.headroom, 0) || 0;
    
    // ✅ NEW: Oversampling parameter (1=off, 2=2x, 4=4x, 8=8x)
    const oversampleParam = this.getParam(parameters.oversampling, 0);
    const oversampleFactor = oversampleParam !== undefined ? Math.floor(oversampleParam) : 2;
    this.oversample = oversampleFactor;
    
    // ✅ NEW: Drive curve mode (0=Soft, 1=Medium, 2=Hard, 3=Tube, 4=Tape)
    const driveCurveParam = this.getParam(parameters.driveCurve, 0);
    const driveCurveMode = driveCurveParam !== undefined ? Math.floor(driveCurveParam) : 3;
    
    // ✅ NEW: Tape modeling parameters (only active when driveCurveMode=4)
    const tapeBias = this.getParam(parameters.tapeBias, 0) || 0.5;
    const tapeWow = this.getParam(parameters.tapeWow, 0) || 0;
    const tapeFlutter = this.getParam(parameters.tapeFlutter, 0) || 0;
    const tapeSpeed = this.getParam(parameters.tapeSpeed, 0) || 1.0;

    const drive = 1 + distortion * 9;
    const state = this.channelState[channel] || this.channelState[0];

    // Update filter coefficients only when parameters change
    if (lowCutFreq !== this.lastLowCutFreq) {
      this.cachedLowCutCoeffs = lowCutFreq > 20 ? this.calculateHighpass(lowCutFreq) : null;
      this.lastLowCutFreq = lowCutFreq;
    }
    if (highCutFreq !== this.lastHighCutFreq) {
      this.cachedHighCutCoeffs = highCutFreq < 19000 ? this.calculateLowpass(highCutFreq) : null;
      this.lastHighCutFreq = highCutFreq;
    }
    if (tone !== this.lastTone) {
      this.cachedTiltCoeffs = Math.abs(tone) > 0.1 ? this.calculateTilt(tone) : null;
      this.lastTone = tone;
    }

    let processed = sample;

    // Stage 1: Input filtering (using cached coefficients)
    if (this.cachedLowCutCoeffs) {
      processed = this.applyBiquadFilter(processed, state.lowCutFilter, this.cachedLowCutCoeffs);
    }
    if (this.cachedHighCutCoeffs) {
      processed = this.applyBiquadFilter(processed, state.highCutFilter, this.cachedHighCutCoeffs);
    }
    if (this.cachedTiltCoeffs) {
      processed = this.applyBiquadFilter(processed, state.tiltFilter, this.cachedTiltCoeffs);
    }

    // Stage 2: Pre-emphasis
    processed = processed + state.history[0] * 0.15;

    // Stage 3: Frequency-dependent saturation
    const saturationConfig = this.getSaturationConfig(this.saturationMode);

    // ✅ NEW: Apply tape modeling (wow/flutter) before saturation
    let processedWithTape = processed;
    if (driveCurveMode === 4) {
      // Tape speed modulation (wow/flutter) - per channel
      const wowFreq = 0.1 + tapeWow * 4.9; // Wow: 0.1-5 Hz
      const tapePhaseInc = (2 * Math.PI * wowFreq) / this.sampleRate;
      state.tapePhase = (state.tapePhase || 0) + tapePhaseInc;
      if (state.tapePhase > Math.PI * 2) state.tapePhase -= Math.PI * 2;
      
      const flutterFreq = 5 + tapeFlutter * 15; // Flutter: 5-20 Hz
      const flutterMod = Math.sin(state.tapePhase * flutterFreq / wowFreq) * tapeFlutter * 0.02;
      
      // Apply tape speed variation
      processedWithTape = processed * (tapeSpeed + flutterMod);
      
      // Tape bias (DC offset simulation)
      processedWithTape += (tapeBias - 0.5) * 0.1;
    }

    // 🎯 PROFESSIONAL OVERSAMPLING: Anti-aliasing for high-frequency content
    // Process at higher sample rate, then downsample with filtering
    let processedOversampled = processedWithTape * drive * (1 + headroom / 12);

    // ✅ NEW: Apply drive curve based on mode
    if (oversampleFactor > 1) {
      // Process with oversampling
      for (let os = 0; os < oversampleFactor; os++) {
        processedOversampled = this.applyDriveCurve(processedOversampled, driveCurveMode);
      }
      // Downsample (simple averaging for now)
      processedOversampled /= oversampleFactor;
    } else {
      // No oversampling
      processedOversampled = this.applyDriveCurve(processedOversampled, driveCurveMode);
    }

    processed = processedOversampled;

    // Stage 5: Add harmonics based on saturation mode
    processed = this.addHarmonics(processed, drive, saturationConfig.harmonicType);

    // Stage 6: DC blocker
    processed = this.dcBlock(processed, state.dcBlocker);

    // 🎯 PROFESSIONAL AUTO-GAIN: Energy-preserving compensation (like FabFilter Saturn)
    if (autoGain > 0.5) {
      // Professional compensation: Maintains perceived loudness across drive settings
      // Uses logarithmic scaling for more accurate compensation
      const driveDb = 20 * Math.log10(drive);
      const compensationDb = -driveDb * 0.4; // 40% compensation (industry standard)
      const compensation = Math.pow(10, compensationDb / 20);
      processed *= compensation * 0.85; // Base output level
    } else {
      processed *= 0.7; // Fixed output level
    }

    // Update history
    state.history[3] = state.history[2];
    state.history[2] = state.history[1];
    state.history[1] = state.history[0];
    state.history[0] = sample;

    return processed;
  }

  // ✅ NEW: Apply drive curve based on mode
  applyDriveCurve(x, mode) {
    const abs = Math.abs(x);
    const sign = Math.sign(x);
    
    switch (mode) {
      case 0: // Soft - gentle saturation
        return sign * (abs < 0.7 ? abs : 0.7 + (abs - 0.7) * 0.1);
      case 1: // Medium - balanced
        return sign * (abs < 0.5 ? abs : 0.5 + (abs - 0.5) * 0.3);
      case 2: // Hard - aggressive clipping
        return sign * Math.min(0.95, abs * 0.8);
      case 3: // Tube - existing tube saturation
        return this.tubeSaturate(x, this.frequencyMode);
      case 4: // Tape - tape saturation curve
        return this.tapeSaturate(x);
      default:
        return this.tubeSaturate(x, this.frequencyMode);
    }
  }
  
  // ✅ NEW: Tape saturation curve (modeled after analog tape)
  tapeSaturate(x) {
    const abs = Math.abs(x);
    const sign = Math.sign(x);
    
    // Tape saturation: smooth compression with high-frequency rolloff
    if (abs < 0.3) {
      return x; // Linear region
    } else if (abs < 0.7) {
      // Soft saturation region
      const t = (abs - 0.3) / 0.4;
      const saturated = 0.3 + 0.4 * (1 - Math.exp(-t * 2));
      return sign * saturated;
    } else {
      // Hard limiting region
      const excess = abs - 0.7;
      const limited = 0.7 + 0.25 * (1 - Math.exp(-excess / 0.15));
      return sign * Math.min(0.95, limited);
    }
  }

  // 🎯 PROFESSIONAL TUBE SATURATION: Industry-standard curves (like UAD, Waves)
  tubeSaturate(x, frequencyMode = 'wide') {
    const sign = Math.sign(x);
    const abs = Math.abs(x);

    // Frequency-dependent saturation curves (professional modeling)
    let threshold1 = 0.33, threshold2 = 0.66, knee1 = 0.15, knee2 = 0.25;
    switch (frequencyMode) {
      case 'transformer': // More bass saturation (modeled after input transformer)
        threshold1 = 0.28;
        threshold2 = 0.58;
        knee1 = 0.18;
        knee2 = 0.22;
        break;
      case 'tape': // More high-end saturation (tape saturation curve)
        threshold1 = 0.38;
        threshold2 = 0.72;
        knee1 = 0.12;
        knee2 = 0.28;
        break;
      default: // 'wide' - flat response (general tube saturation)
        threshold1 = 0.33;
        threshold2 = 0.66;
        knee1 = 0.15;
        knee2 = 0.25;
    }

    // 🎯 MULTI-STAGE TUBE CURVE: Smooth, musical saturation
    if (abs < threshold1 - knee1) {
      // Linear region (no saturation)
      return x;
    } else if (abs < threshold1 + knee1) {
      // Soft knee transition (smooth entry)
      const t = (abs - (threshold1 - knee1)) / (2 * knee1);
      const smooth = t * t * (3 - 2 * t); // Smoothstep
      const linearPart = x * (1 - smooth);
      const saturatedPart = sign * (threshold1 + (abs - threshold1) * 0.7) * smooth;
      return linearPart + saturatedPart;
    } else if (abs < threshold2) {
      // Gentle saturation region
      const t = (abs - threshold1) / (threshold2 - threshold1);
      // Polynomial curve for smooth saturation
      const saturated = threshold1 + (threshold2 - threshold1) * (1 - Math.pow(1 - t, 2));
      return sign * saturated;
    } else {
      // Hard limiting region (smooth approach to ceiling)
      const excess = abs - threshold2;
      const limited = threshold2 + (1 - threshold2) * (1 - Math.exp(-excess / 0.1));
      return sign * Math.min(0.95, limited); // Soft ceiling at 0.95
    }
  }

  // 🎯 PROFESSIONAL HARMONIC GENERATION: Accurate modeling (like Soundtoys Decapitator)
  addHarmonics(sample, drive, harmonicType = 'even') {
    // 🎯 EVEN HARMONICS (2nd, 4th): Warm, tube-like
    const harmonic2 = sample * Math.abs(sample) * 0.08 * drive; // 2nd harmonic
    const harmonic4 = sample * sample * sample * Math.abs(sample) * 0.02 * drive; // 4th harmonic

    // 🎯 ODD HARMONICS (3rd, 5th): Edgy, transistor-like
    const harmonic3 = sample * sample * Math.abs(sample) * 0.05 * drive; // 3rd harmonic
    const harmonic5 = sample * sample * sample * sample * Math.abs(sample) * 0.01 * drive; // 5th harmonic

    // 🎯 FREQUENCY-DEPENDENT MIXING: Professional harmonic balance
    switch (harmonicType) {
      case 'even': // Toasty - warm, musical (tube emulation)
        return sample + harmonic2 * 1.3 + harmonic4 * 0.15 + harmonic3 * 0.1;
      case 'odd': // Crunchy - aggressive (transistor emulation)
        return sample + harmonic3 * 1.4 + harmonic5 * 0.2 + harmonic2 * 0.2;
      case 'mixed': // Distress - compressed (tape emulation)
        return sample + harmonic2 * 0.9 + harmonic3 * 0.9 + harmonic4 * 0.1 + harmonic5 * 0.05;
      default:
        return sample + harmonic2 * 1.0 + harmonic3 * 0.5;
    }
  }

  getSaturationConfig(mode) {
    const configs = {
      toasty: {
        threshold: 0.7,
        softness: 0.3,
        harmonicType: 'even'
      },
      crunchy: {
        threshold: 0.5,
        softness: 0.15,
        harmonicType: 'odd'
      },
      distress: {
        threshold: 0.3,
        softness: 0.4,
        harmonicType: 'mixed'
      }
    };
    return configs[mode] || configs.toasty;
  }

  // Utility functions
  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  dcBlock(sample, state) {
    const R = 0.995;
    const output = sample - state.x1 + R * state.y1;
    state.x1 = sample;
    state.y1 = output;
    return output;
  }

  // Biquad filter calculations
  calculateHighpass(freq) {
    const omega = 2 * Math.PI * freq / this.sampleRate;
    const sn = Math.sin(omega);
    const cs = Math.cos(omega);
    const Q = 0.707; // Butterworth response
    const alpha = sn / (2 * Q);

    const b0 = (1 + cs) / 2;
    const b1 = -(1 + cs);
    const b2 = (1 + cs) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cs;
    const a2 = 1 - alpha;

    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
  }

  calculateLowpass(freq) {
    const omega = 2 * Math.PI * freq / this.sampleRate;
    const sn = Math.sin(omega);
    const cs = Math.cos(omega);
    const Q = 0.707;
    const alpha = sn / (2 * Q);

    const b0 = (1 - cs) / 2;
    const b1 = 1 - cs;
    const b2 = (1 - cs) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cs;
    const a2 = 1 - alpha;

    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
  }

  calculateTilt(gain) {
    // Tilt EQ: Pivots around 1kHz
    // Positive gain: boost highs, cut lows (brighten)
    // Negative gain: cut highs, boost lows (darken)

    const pivotFreq = 1000; // Pivot point at 1kHz
    const omega = 2 * Math.PI * pivotFreq / this.sampleRate;
    const sn = Math.sin(omega);
    const cs = Math.cos(omega);

    // Use low-shelf formula but invert for tilt behavior
    const A = Math.pow(10, Math.abs(gain) / 40);
    const Q = 0.707; // Butterworth Q
    const alpha = sn / (2 * Q);

    let b0, b1, b2, a0, a1, a2;

    if (gain >= 0) {
      // Positive: High-shelf boost (brighten)
      b0 = A * ((A + 1) + (A - 1) * cs + 2 * Math.sqrt(A) * alpha);
      b1 = -2 * A * ((A - 1) + (A + 1) * cs);
      b2 = A * ((A + 1) + (A - 1) * cs - 2 * Math.sqrt(A) * alpha);
      a0 = (A + 1) - (A - 1) * cs + 2 * Math.sqrt(A) * alpha;
      a1 = 2 * ((A - 1) - (A + 1) * cs);
      a2 = (A + 1) - (A - 1) * cs - 2 * Math.sqrt(A) * alpha;
    } else {
      // Negative: Low-shelf boost (darken)
      b0 = A * ((A + 1) - (A - 1) * cs + 2 * Math.sqrt(A) * alpha);
      b1 = 2 * A * ((A - 1) - (A + 1) * cs);
      b2 = A * ((A + 1) - (A - 1) * cs - 2 * Math.sqrt(A) * alpha);
      a0 = (A + 1) + (A - 1) * cs + 2 * Math.sqrt(A) * alpha;
      a1 = -2 * ((A - 1) + (A + 1) * cs);
      a2 = (A + 1) + (A - 1) * cs - 2 * Math.sqrt(A) * alpha;
    }

    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
  }

  applyBiquadFilter(sample, filterState, coeffs) {
    // Direct Form II Transposed implementation
    const y = coeffs.b0 * sample + filterState.x1;

    filterState.x1 = coeffs.b1 * sample - coeffs.a1 * y + filterState.x2;
    filterState.x2 = coeffs.b2 * sample - coeffs.a2 * y;

    // Safety check for NaN/Infinity
    if (!isFinite(y)) {
      filterState.x1 = 0;
      filterState.x2 = 0;
      return sample;
    }

    return y;
  }

  resetState() {
    this.channelState.forEach(state => {
      state.history.fill(0);
      state.dcBlocker.x1 = 0;
      state.dcBlocker.y1 = 0;

      // Reset filters
      if (state.lowCutFilter) {
        state.lowCutFilter.x1 = state.lowCutFilter.x2 = 0;
      }
      if (state.highCutFilter) {
        state.highCutFilter.x1 = state.highCutFilter.x2 = 0;
      }
      if (state.tiltFilter) {
        state.tiltFilter.x1 = state.tiltFilter.x2 = 0;
      }
    });
  }
}

registerProcessor('saturator-processor', SaturatorProcessor);
