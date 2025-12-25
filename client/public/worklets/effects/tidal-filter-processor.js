/**
 * TidalFilter Processor v2.0
 * State-variable filter with smooth filter type morphing
 *
 * Features:
 * - Adjustable cutoff frequency (20Hz - 20kHz)
 * - Resonance control (0-100%)
 * - Morphing filter types (LP → BP → HP → Notch)
 * - Drive with soft saturation
 * - Filter Models (State-Variable, Moog, Korg, Oberheim)
 * - LFO Modulation (rate, depth, shape, tempo sync)
 */

class TidalFilterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
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
      { name: 'lfoShape', defaultValue: 0, minValue: 0, maxValue: 3 }, // 0=sine, 1=triangle, 2=square, 3=sawtooth
      { name: 'lfoTempoSync', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'lfoNoteDivision', defaultValue: 3, minValue: 0, maxValue: 9 }, // Same as ModernDelay
      { name: 'bpm', defaultValue: 120, minValue: 60, maxValue: 200 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'TidalFilter';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Per-channel state-variable filter state
    this.channelState = [
      { low: 0, band: 0, high: 0, notch: 0 },
      { low: 0, band: 0, high: 0, notch: 0 }
    ];

    // ✅ NEW: LFO state
    this.lfoPhase = 0;
    this.lfoPhaseInc = 0;

    // ✅ NEW: Moog ladder filter state (4-stage)
    this.moogState = [
      { stage1: 0, stage2: 0, stage3: 0, stage4: 0 },
      { stage1: 0, stage2: 0, stage3: 0, stage4: 0 }
    ];

    // ✅ NEW: Korg MS-20 filter state (2-stage with feedback)
    this.korgState = [
      { stage1: 0, stage2: 0, feedback: 0 },
      { stage1: 0, stage2: 0, feedback: 0 }
    ];

    // ✅ NEW: Oberheim SEM filter state (2-stage)
    this.oberheimState = [
      { stage1: 0, stage2: 0 },
      { stage1: 0, stage2: 0 }
    ];

    this.port.onmessage = (e) => {
      if (e.data.type === 'updateSettings') {
        Object.assign(this.settings, e.data.data);
      } else if (e.data.type === 'bypass') {
        this.bypassed = e.data.value;
      }
    };
  }

  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  // Soft saturation for drive
  softSaturate(x) {
    if (Math.abs(x) < 1) return x;
    return Math.sign(x) * (1 - Math.exp(-Math.abs(x)));
  }

  // ✅ NEW: Convert note division to seconds (same as ModernDelay)
  noteValueToSeconds(noteDivision, bpm) {
    const noteValues = [
      1/32, 1/16, 1/8, 1/4, 1/2, 1/1,  // 0-5: standard
      1/8 * 1.5, 1/4 * 1.5,              // 6-7: dotted
      1/8 * 2/3, 1/4 * 2/3                // 8-9: triplet
    ];
    const noteValue = noteValues[Math.floor(noteDivision)] || 1/4;
    return (60 / bpm) * noteValue;
  }

  // ✅ NEW: Calculate LFO value based on shape
  getLFOValue(phase, shape) {
    // Normalize phase to 0-1
    const normalizedPhase = phase % (2 * Math.PI) / (2 * Math.PI);
    
    switch (Math.floor(shape)) {
      case 0: // Sine
        return Math.sin(phase);
      case 1: // Triangle
        return normalizedPhase < 0.5 
          ? 4 * normalizedPhase - 1 
          : 3 - 4 * normalizedPhase;
      case 2: // Square
        return normalizedPhase < 0.5 ? 1 : -1;
      case 3: // Sawtooth
        return 2 * normalizedPhase - 1;
      default:
        return Math.sin(phase);
    }
  }

  // ✅ NEW: Calculate LFO rate (Hz or tempo sync)
  calculateLFORate(lfoRate, lfoTempoSync, lfoNoteDivision, bpm) {
    if (lfoTempoSync > 0.5) {
      // Tempo sync: convert note division to Hz
      const noteSeconds = this.noteValueToSeconds(lfoNoteDivision, bpm);
      return 1 / noteSeconds; // Convert to Hz
    } else {
      // Free rate in Hz
      return lfoRate;
    }
  }

  // ✅ NEW: Process Moog Ladder filter
  processMoogLadder(sample, channel, cutoff, resonance) {
    const state = this.moogState[channel];
    const normalizedFreq = Math.min(cutoff, this.sampleRate / 2.2) / this.sampleRate;
    const omega = 2 * Math.PI * normalizedFreq;
    const f = 2 * Math.sin(omega / 2);
    const q = 0.01 + (1 - (resonance * 0.99)) * 0.99;

    // Moog ladder: 4 cascaded one-pole filters with feedback
    const input = sample - 4 * q * state.stage4;
    
    state.stage1 = state.stage1 + f * (input - state.stage1);
    state.stage2 = state.stage2 + f * (state.stage1 - state.stage2);
    state.stage3 = state.stage3 + f * (state.stage2 - state.stage3);
    state.stage4 = state.stage4 + f * (state.stage3 - state.stage4);

    // Stability check
    if (!isFinite(state.stage4) || Math.abs(state.stage4) > 10) {
      state.stage1 = state.stage2 = state.stage3 = state.stage4 = 0;
    }

    return state.stage4;
  }

  // ✅ NEW: Process Korg MS-20 filter (aggressive, self-oscillating)
  processKorgMS20(sample, channel, cutoff, resonance) {
    const state = this.korgState[channel];
    const normalizedFreq = Math.min(cutoff, this.sampleRate / 2.2) / this.sampleRate;
    const omega = 2 * Math.PI * normalizedFreq;
    const f = 2 * Math.sin(omega / 2);
    const q = 0.01 + (1 - (resonance * 0.99)) * 0.99;

    // Korg MS-20: 2-stage with aggressive feedback
    const feedback = 4 * q * state.feedback;
    const input = sample - feedback;
    
    state.stage1 = state.stage1 + f * (input - state.stage1);
    state.stage2 = state.stage2 + f * (state.stage1 - state.stage2);
    state.feedback = state.stage2;

    // Stability check
    if (!isFinite(state.stage2) || Math.abs(state.stage2) > 10) {
      state.stage1 = state.stage2 = state.feedback = 0;
    }

    return state.stage2;
  }

  // ✅ NEW: Process Oberheim SEM filter (smooth, musical)
  processOberheimSEM(sample, channel, cutoff, resonance) {
    const state = this.oberheimState[channel];
    const normalizedFreq = Math.min(cutoff, this.sampleRate / 2.2) / this.sampleRate;
    const omega = 2 * Math.PI * normalizedFreq;
    const f = 2 * Math.sin(omega / 2);
    const q = 0.01 + (1 - (resonance * 0.99)) * 0.99;

    // Oberheim SEM: 2-stage with smooth response
    const input = sample - 2 * q * state.stage2;
    
    state.stage1 = state.stage1 + f * (input - state.stage1);
    state.stage2 = state.stage2 + f * (state.stage1 - state.stage2);

    // Stability check
    if (!isFinite(state.stage2) || Math.abs(state.stage2) > 10) {
      state.stage1 = state.stage2 = 0;
    }

    return state.stage2;
  }

  processEffect(sample, channel, parameters) {
    let cutoff = this.getParam(parameters.cutoff, 0) || 1000;
    const resonance = this.getParam(parameters.resonance, 0) || 0.5;
    const filterType = this.getParam(parameters.filterType, 0) || 0;
    const drive = this.getParam(parameters.drive, 0) || 1.0;
    const filterModel = this.getParam(parameters.filterModel, 0) || 0;
    
    // ✅ NEW: LFO Modulation
    const lfoEnabled = this.getParam(parameters.lfoEnabled, 0) || 0;
    const lfoRate = this.getParam(parameters.lfoRate, 0) || 1.0;
    const lfoDepth = this.getParam(parameters.lfoDepth, 0) || 0.5;
    const lfoShape = this.getParam(parameters.lfoShape, 0) || 0;
    const lfoTempoSync = this.getParam(parameters.lfoTempoSync, 0) || 0;
    const lfoNoteDivision = this.getParam(parameters.lfoNoteDivision, 0) || 3;
    const bpm = this.getParam(parameters.bpm, 0) || 120;

    // ✅ NEW: Apply LFO modulation to cutoff
    if (lfoEnabled > 0.5) {
      const effectiveLFORate = this.calculateLFORate(lfoRate, lfoTempoSync, lfoNoteDivision, bpm);
      this.lfoPhaseInc = (2 * Math.PI * effectiveLFORate) / this.sampleRate;
      this.lfoPhase += this.lfoPhaseInc;
      if (this.lfoPhase > 2 * Math.PI) this.lfoPhase -= 2 * Math.PI;
      
      const lfoValue = this.getLFOValue(this.lfoPhase, lfoShape);
      const lfoModulation = lfoValue * lfoDepth * cutoff * 0.5; // 50% modulation range
      cutoff = Math.max(20, Math.min(20000, cutoff + lfoModulation));
    }

    const state = this.channelState[channel];

    // Apply drive with soft saturation
    let driven = sample * drive;
    if (drive > 1.0) {
      driven = this.softSaturate(driven);
    }

    let output;

    // ✅ NEW: Filter model selection
    switch (Math.floor(filterModel)) {
      case 1: // Moog Ladder
        output = this.processMoogLadder(driven, channel, cutoff, resonance);
        break;
      case 2: // Korg MS-20
        output = this.processKorgMS20(driven, channel, cutoff, resonance);
        break;
      case 3: // Oberheim SEM
        output = this.processOberheimSEM(driven, channel, cutoff, resonance);
        break;
      default: // 0: State-Variable (original)
        // 🎯 PROFESSIONAL FILTER COEFFICIENTS: Stable calculation (like Moog, Prophet)
        const normalizedFreq = Math.min(cutoff, this.sampleRate / 2.2) / this.sampleRate;
        const omega = 2 * Math.PI * normalizedFreq;
        const f = 2 * Math.sin(omega / 2);
        const q = 0.01 + (1 - (resonance * 0.99)) * 0.99;

        // 🎯 PROFESSIONAL STATE-VARIABLE FILTER: Stable implementation
        const oldLow = state.low;
        const oldBand = state.band;
        
        state.low += f * state.band;
        state.high = driven - state.low - q * state.band;
        state.band += f * state.high;
        state.notch = state.high + state.low;
        
        // ✅ STABILITY CHECK
        if (!isFinite(state.low) || Math.abs(state.low) > 10 ||
            !isFinite(state.band) || Math.abs(state.band) > 10) {
          state.low = oldLow;
          state.band = oldBand;
          state.high = driven;
          state.notch = state.high + state.low;
        }

        // Smooth morphing between filter types
        if (filterType <= 0.33) {
          const mix = filterType * 3;
          output = state.low * (1 - mix) + state.band * mix;
        } else if (filterType <= 0.66) {
          const mix = (filterType - 0.33) * 3;
          output = state.band * (1 - mix) + state.high * mix;
        } else {
          const mix = (filterType - 0.66) * 3;
          output = state.high * (1 - mix) + state.notch * mix;
        }
        break;
    }

    // Compensate for resonance boost
    return output * 0.5;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length || this.bypassed) {
      if (output && output.length) {
        for (let channel = 0; channel < output.length; channel++) {
          output[channel].set(input?.[channel] || new Float32Array(128));
        }
      }
      return true;
    }

    const wetParam = this.getParam(parameters.wet, 0);
    const wet = wetParam !== undefined ? wetParam :
                (this.settings.wet !== undefined ? this.settings.wet : 1.0);
    const dry = 1 - wet;

    for (let channel = 0; channel < output.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      for (let i = 0; i < inputChannel.length; i++) {
        const inputSample = inputChannel[i];
        const processedSample = this.processEffect(inputSample, channel, parameters);
        outputChannel[i] = dry * inputSample + wet * processedSample;
      }
    }

    return true;
  }
}

registerProcessor('tidal-filter-processor', TidalFilterProcessor);
