/**
 * BassEnhancer808 Processor V3.0
 * 
 * Professional sub-bass enhancement with TASTE & TEXTURE controls
 * 
 * TASTE: Reverb, delay, chorus, modulation (tad verici efektler)
 * TEXTURE: Saturation, harmonics, drive, warmth (dokusal özellikler)
 * 
 * Inspired by: Waves MaxxBass, RBass, Sub Bass Synthesizer
 */

class BassEnhancer808Processor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'subBoost', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'saturation', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'punch', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'taste', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'texture', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'BassEnhancer808';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Channel state
    this.channelState = [
      {
        lpf: { x1: 0, x2: 0, y1: 0, y2: 0 },
        hpf: { x1: 0, x2: 0, y1: 0, y2: 0 },
        envelope: 0,
        // TASTE: Reverb/Delay state
        reverbDelay: new Float32Array(8192), // Small delay line for reverb
        reverbPos: 0,
        reverbFeedback: 0,
        delayLine: new Float32Array(4096),
        delayPos: 0,
        chorusPhase: [0, 0],
        // TEXTURE: Saturation state
        saturationState: 0,
        driveState: 0
      },
      {
        lpf: { x1: 0, x2: 0, y1: 0, y2: 0 },
        hpf: { x1: 0, x2: 0, y1: 0, y2: 0 },
        envelope: 0,
        reverbDelay: new Float32Array(8192),
        reverbPos: 0,
        reverbFeedback: 0,
        delayLine: new Float32Array(4096),
        delayPos: 0,
        chorusPhase: [0, 0],
        saturationState: 0,
        driveState: 0
      }
    ];

    // Shared LFO for chorus modulation
    this.lfoPhase = 0;
    this.lfoRate = 0.3; // Hz

    this.port.onmessage = (e) => {
      if (e.data.type === 'updateSettings') {
        Object.assign(this.settings, e.data.data);
      } else if (e.data.type === 'bypass') {
        this.bypassed = e.data.value;
      } else if (e.data.type === 'setParameters') {
        Object.assign(this.settings, e.data.data);
      }
    };
  }

  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  // Biquad filters
  processBiquadLowpass(sample, filter, freq, q) {
    const w0 = 2 * Math.PI * freq / this.sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * q);

    const b0 = (1 - cosw0) / 2;
    const b1 = 1 - cosw0;
    const b2 = (1 - cosw0) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw0;
    const a2 = 1 - alpha;

    const y = (b0 / a0) * sample +
              (b1 / a0) * filter.x1 +
              (b2 / a0) * filter.x2 -
              (a1 / a0) * filter.y1 -
              (a2 / a0) * filter.y2;

    filter.x2 = filter.x1;
    filter.x1 = sample;
    filter.y2 = filter.y1;
    filter.y1 = y;

    return y;
  }

  processBiquadHighpass(sample, filter, freq, q) {
    const w0 = 2 * Math.PI * freq / this.sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * q);

    const b0 = (1 + cosw0) / 2;
    const b1 = -(1 + cosw0);
    const b2 = (1 + cosw0) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw0;
    const a2 = 1 - alpha;

    const y = (b0 / a0) * sample +
              (b1 / a0) * filter.x1 +
              (b2 / a0) * filter.x2 -
              (a1 / a0) * filter.y1 -
              (a2 / a0) * filter.y2;

    filter.x2 = filter.x1;
    filter.x1 = sample;
    filter.y2 = filter.y1;
    filter.y1 = y;

    return y;
  }

  /**
   * 🎯 TASTE: Reverb processing (small room reverb for bass)
   */
  processTasteReverb(sample, state, taste) {
    if (taste < 0.1) return 0;

    const reverbAmount = taste * 0.15; // Subtle reverb
    const delayTime = Math.floor(this.sampleRate * 0.015); // 15ms delay
    
    const pos = state.reverbPos;
    const delayed = state.reverbDelay[(pos - delayTime + state.reverbDelay.length) % state.reverbDelay.length];
    
    const reverbOut = delayed * reverbAmount;
    state.reverbDelay[pos] = sample + reverbOut * 0.3;
    state.reverbPos = (pos + 1) % state.reverbDelay.length;
    
    return reverbOut;
  }

  /**
   * 🎯 TASTE: Chorus modulation (subtle pitch modulation)
   */
  processTasteChorus(sample, state, taste, channel) {
    if (taste < 0.1) return sample;

    const chorusAmount = taste * 0.08;
    const chorusRate = 0.4; // Hz
    
    state.chorusPhase[channel] += (2 * Math.PI * chorusRate) / this.sampleRate;
    if (state.chorusPhase[channel] > 2 * Math.PI) {
      state.chorusPhase[channel] -= 2 * Math.PI;
    }
    
    const modulation = Math.sin(state.chorusPhase[channel]) * chorusAmount;
    return sample * (1 + modulation);
  }

  /**
   * 🎯 TEXTURE: Multi-stage saturation with harmonics
   */
  processTextureSaturation(sample, state, texture) {
    if (texture < 0.01) return sample;

    // Drive amount based on texture
    const drive = 1.0 + texture * 2.0;
    const driven = sample * drive;

    // Multi-stage tube saturation curve
    let saturated = driven;
    
    // First stage: Soft clipping
    if (Math.abs(saturated) > 0.33) {
      saturated = Math.sign(saturated) * (0.33 + (Math.abs(saturated) - 0.33) * 0.5);
    }
    
    // Second stage: Harder saturation
    if (Math.abs(saturated) > 0.66) {
      saturated = Math.sign(saturated) * (0.66 + (Math.abs(saturated) - 0.66) * 0.25);
    }
    
    // Third stage: Hard limit
    saturated = Math.max(-1, Math.min(1, saturated));

    // Harmonic generation based on texture
    const rectified = Math.abs(driven);
    const harmonics = texture * 0.3;
    
    // 2nd harmonic (even - warmth)
    const secondHarm = driven * rectified * harmonics * 0.25;
    
    // 3rd harmonic (odd - presence)
    const thirdHarm = driven * driven * Math.sign(driven) * harmonics * 0.15;

    // Combine with original
    const enriched = saturated * 0.7 + secondHarm + thirdHarm;

    // Auto-gain compensation
    const compensation = 1.0 / (1 + texture * 0.4);
    return enriched * compensation;
  }

  processEffect(sample, channel, parameters) {
    const subBoost = this.getParam(parameters.subBoost, 0) || 0.5;
    const saturation = this.getParam(parameters.saturation, 0) || 0.5;
    const punch = this.getParam(parameters.punch, 0) || 0.5;
    const taste = this.getParam(parameters.taste, 0) || 0.5;
    const texture = this.getParam(parameters.texture, 0) || 0.5;

    const state = this.channelState[channel];

    // 🎯 STEP 1: Bass isolation
    const bassSignal = this.processBiquadLowpass(sample, state.lpf, 150, 0.707);
    const filteredBass = this.processBiquadHighpass(bassSignal, state.hpf, 30, 0.707);

    // 🎯 STEP 2: Envelope follower for dynamic processing
    const rectified = Math.abs(filteredBass);
    const attackCoeff = Math.exp(-1 / (0.01 * this.sampleRate)); // 10ms attack
    const releaseTime = 0.1 + punch * 0.4; // 100-500ms release
    const releaseCoeff = Math.exp(-1 / (releaseTime * this.sampleRate));

    if (rectified > state.envelope) {
      state.envelope = attackCoeff * state.envelope + (1 - attackCoeff) * rectified;
    } else {
      state.envelope = releaseCoeff * state.envelope + (1 - releaseCoeff) * rectified;
    }

    // 🎯 STEP 3: Sub-harmonic synthesis (octave down)
    const subHarmonic = Math.sign(filteredBass) * Math.sqrt(Math.abs(filteredBass)) * state.envelope * 0.8;
    const subEnhanced = filteredBass + subHarmonic * subBoost * 1.2;

    // 🎯 STEP 4: TEXTURE - Saturation and harmonics
    let textured = this.processTextureSaturation(subEnhanced, state, texture);
    
    // Additional saturation based on saturation param
    if (saturation > 0.01) {
      const satDrive = 1.0 + saturation * 1.5;
      const satDriven = textured * satDrive;
      textured = Math.tanh(satDriven * 0.8) * (1.0 / (1 + saturation * 0.3));
    }

    // 🎯 STEP 5: TASTE - Reverb and modulation
    let tasted = textured;
    
    // Reverb
    const reverbOut = this.processTasteReverb(textured, state, taste);
    tasted += reverbOut;
    
    // Chorus
    tasted = this.processTasteChorus(tasted, state, taste, channel);

    // 🎯 STEP 6: Punch enhancement (transient shaping)
    const punchAmount = punch * 0.4;
    const punchBoost = 1.0 + punchAmount * state.envelope * 2.0;
    tasted *= punchBoost;

    // 🎯 STEP 7: Auto-gain compensation
    const totalBoost = 1.0 + subBoost * 0.6 + saturation * 0.4 + texture * 0.3 + taste * 0.2;
    const compensation = 1.0 / (1 + totalBoost * 0.25);

    return tasted * compensation;
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
    const wet = wetParam !== undefined ? wetParam : (this.settings.wet !== undefined ? this.settings.wet : 1.0);
    const dry = 1 - wet;

    // Update LFO phase
    this.lfoPhase += (2 * Math.PI * this.lfoRate) / this.sampleRate * 128;
    if (this.lfoPhase > 2 * Math.PI) this.lfoPhase -= 2 * Math.PI;

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

registerProcessor('bass-enhancer-808-processor', BassEnhancer808Processor);

