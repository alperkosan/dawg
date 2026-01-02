/**
 * MultiBandEQ Processor V2 - Dynamic Bands
 * Supports N-band parametric EQ with real-time parameter updates
 *
 * Architecture:
 * - Message-based band updates (not AudioParam)
 * - Dynamic band count (1-8 bands)
 * - Per-band type support (peaking, lowshelf, highshelf, notch, lowpass, highpass)
 * - Cached coefficient calculation
 */

class MultiBandEQProcessorV2 extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      { name: 'output', defaultValue: 1.0, minValue: 0, maxValue: 2 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;

    // Default bands (3-band EQ)
    this.bands = [
      { id: 'band-1', type: 'lowshelf', frequency: 100, gain: 0, q: 0.71, active: true, dynamicEnabled: false, threshold: -12, ratio: 2, attack: 10, release: 100 },
      { id: 'band-2', type: 'peaking', frequency: 1000, gain: 0, q: 1.5, active: true, dynamicEnabled: false, threshold: -12, ratio: 2, attack: 10, release: 100 },
      { id: 'band-3', type: 'highshelf', frequency: 8000, gain: 0, q: 0.71, active: true, dynamicEnabled: false, threshold: -12, ratio: 2, attack: 10, release: 100 }
    ];

    // Stereo channel state
    this.channelState = [
      {
        filters: this.createFilters(this.bands.length),
        // ✅ NEW: Dynamic EQ state per band (envelope followers)
        dynamicState: this.bands.map(() => ({ envelope: 0, gainReduction: 1.0 }))
      },
      {
        filters: this.createFilters(this.bands.length),
        dynamicState: this.bands.map(() => ({ envelope: 0, gainReduction: 1.0 }))
      }
    ];

    // Coefficient cache (dirty flag pattern)
    this.coeffsDirty = true;

    // Message handler for band updates
    this.port.onmessage = (e) => {
      if (e.data.type === 'updateBands') {
        this.bands = e.data.bands || this.bands;
        this.coeffsDirty = true;

        // Resize filters if band count changed
        const requiredFilters = this.bands.length;
        for (let ch = 0; ch < this.channelState.length; ch++) {
          const current = this.channelState[ch].filters.length;
          if (current < requiredFilters) {
            // Add filters
            for (let i = current; i < requiredFilters; i++) {
              this.channelState[ch].filters.push(this.createFilter());
              // ✅ NEW: Add dynamic EQ state for new band
              this.channelState[ch].dynamicState.push({ envelope: 0, gainReduction: 1.0 });
            }
          } else if (current > requiredFilters) {
            // Remove filters
            this.channelState[ch].filters.length = requiredFilters;
            // ✅ NEW: Remove dynamic EQ state for removed band
            this.channelState[ch].dynamicState.length = requiredFilters;
          }
        }
      } else if (e.data.type === 'bypass') {
        this.bypassed = e.data.value;
      }
    };

    this.bypassed = false;

    console.log('[MultiBandEQV2] Initialized with', this.bands.length, 'bands');
  }

  createFilter() {
    return {
      // Coefficients (pre-normalized)
      b0: 1, b1: 0, b2: 0, a1: 0, a2: 0,
      // 🎯 EQ-1: Transposed Direct Form II state (more stable than DF-I)
      s1: 0, s2: 0
    };
  }

  createFilters(count) {
    const filters = [];
    for (let i = 0; i < count; i++) {
      filters.push(this.createFilter());
    }
    return filters;
  }

  /**
   * Calculate biquad coefficients for different filter types
   */
  calculateCoefficients(band) {
    const freq = Math.max(20, Math.min(20000, band.frequency));
    const gain = Math.max(-24, Math.min(24, band.gain));
    const q = Math.max(0.1, Math.min(18, band.q));

    const w0 = 2 * Math.PI * freq / this.sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * q);
    const A = Math.pow(10, gain / 40); // dB to linear

    let b0, b1, b2, a0, a1, a2;

    switch (band.type) {
      case 'peaking':
        b0 = 1 + alpha * A;
        b1 = -2 * cosw0;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cosw0;
        a2 = 1 - alpha / A;
        break;

      case 'lowshelf':
        const sqrtA = Math.sqrt(A);
        b0 = A * ((A + 1) - (A - 1) * cosw0 + 2 * sqrtA * alpha);
        b1 = 2 * A * ((A - 1) - (A + 1) * cosw0);
        b2 = A * ((A + 1) - (A - 1) * cosw0 - 2 * sqrtA * alpha);
        a0 = (A + 1) + (A - 1) * cosw0 + 2 * sqrtA * alpha;
        a1 = -2 * ((A - 1) + (A + 1) * cosw0);
        a2 = (A + 1) + (A - 1) * cosw0 - 2 * sqrtA * alpha;
        break;

      case 'highshelf':
        const sqrtA2 = Math.sqrt(A);
        b0 = A * ((A + 1) + (A - 1) * cosw0 + 2 * sqrtA2 * alpha);
        b1 = -2 * A * ((A - 1) + (A + 1) * cosw0);
        b2 = A * ((A + 1) + (A - 1) * cosw0 - 2 * sqrtA2 * alpha);
        a0 = (A + 1) - (A - 1) * cosw0 + 2 * sqrtA2 * alpha;
        a1 = 2 * ((A - 1) - (A + 1) * cosw0);
        a2 = (A + 1) - (A - 1) * cosw0 - 2 * sqrtA2 * alpha;
        break;

      case 'notch':
        b0 = 1;
        b1 = -2 * cosw0;
        b2 = 1;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
        break;

      case 'lowpass':
        b0 = (1 - cosw0) / 2;
        b1 = 1 - cosw0;
        b2 = (1 - cosw0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
        break;

      case 'highpass':
        b0 = (1 + cosw0) / 2;
        b1 = -(1 + cosw0);
        b2 = (1 + cosw0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
        break;

      default:
        // Passthrough
        return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 };
    }

    // Pre-normalize (divide by a0)
    return {
      b0: b0 / a0,
      b1: b1 / a0,
      b2: b2 / a0,
      a1: a1 / a0,
      a2: a2 / a0
    };
  }

  /**
   * Update all filter coefficients (only when dirty)
   */
  updateCoefficients() {
    if (!this.coeffsDirty) return;

    for (let ch = 0; ch < this.channelState.length; ch++) {
      for (let i = 0; i < this.bands.length; i++) {
        const band = this.bands[i];
        if (!band.active) {
          // Bypass filter - passthrough coefficients
          const filter = this.channelState[ch].filters[i];
          filter.b0 = 1;
          filter.b1 = 0;
          filter.b2 = 0;
          filter.a1 = 0;
          filter.a2 = 0;
        } else {
          const coeffs = this.calculateCoefficients(band);
          const filter = this.channelState[ch].filters[i];
          filter.b0 = coeffs.b0;
          filter.b1 = coeffs.b1;
          filter.b2 = coeffs.b2;
          filter.a1 = coeffs.a1;
          filter.a2 = coeffs.a2;
        }
      }
    }

    this.coeffsDirty = false;
  }

  /**
   * 🎯 EQ-1: Process single sample through biquad filter
   * Transposed Direct Form II (TDF-II) for better numerical stability
   * with high-Q filters near Nyquist frequency (industry standard)
   */
  processBiquad(sample, filter) {
    // TDF-II: y = b0*x + s1
    const y = filter.b0 * sample + filter.s1;

    // Update state registers
    filter.s1 = filter.b1 * sample - filter.a1 * y + filter.s2;
    filter.s2 = filter.b2 * sample - filter.a2 * y;

    // Safety check for numerical stability
    if (!isFinite(y)) {
      filter.s1 = filter.s2 = 0;
      return sample;
    }

    return y;
  }

  /**
   * ✅ NEW: Process Dynamic EQ (compression per band)
   * Measures band output level and applies gain reduction when threshold is exceeded
   */
  processDynamicEQ(sample, bandIndex, channel, state) {
    const band = this.bands[bandIndex];
    const dynamicState = state.dynamicState[bandIndex];

    // Convert sample to dB
    const absSample = Math.abs(sample);
    const sampleDb = absSample > 0.0001 ? 20 * Math.log10(absSample) : -80;

    // Envelope follower (RMS-style, with attack/release)
    const targetEnvelope = Math.abs(sample);
    const currentEnvelope = dynamicState.envelope;

    // Attack/release coefficients
    const attackTime = Math.max(0.001, band.attack / 1000); // ms to seconds
    const releaseTime = Math.max(0.001, band.release / 1000);
    const attackCoeff = Math.exp(-1 / (attackTime * this.sampleRate));
    const releaseCoeff = Math.exp(-1 / (releaseTime * this.sampleRate));

    // Update envelope
    if (targetEnvelope > currentEnvelope) {
      dynamicState.envelope = targetEnvelope + (currentEnvelope - targetEnvelope) * attackCoeff;
    } else {
      dynamicState.envelope = targetEnvelope + (currentEnvelope - targetEnvelope) * releaseCoeff;
    }

    // Convert envelope to dB
    const envelopeDb = dynamicState.envelope > 0.0001 ? 20 * Math.log10(dynamicState.envelope) : -80;

    // Calculate gain reduction if threshold is exceeded
    if (envelopeDb > band.threshold) {
      const overThreshold = envelopeDb - band.threshold;
      const gainReductionDb = overThreshold - (overThreshold / band.ratio);
      const gainReductionLinear = Math.pow(10, gainReductionDb / 20);
      dynamicState.gainReduction = gainReductionLinear;
    } else {
      // Release gain reduction smoothly
      dynamicState.gainReduction = 1.0 + (dynamicState.gainReduction - 1.0) * releaseCoeff;
    }

    // Apply gain reduction
    return sample * dynamicState.gainReduction;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    // Bypass or no input
    if (!input || !input.length || this.bypassed) {
      if (output && output.length) {
        for (let channel = 0; channel < output.length; channel++) {
          output[channel].set(input?.[channel] || new Float32Array(128));
        }
      }
      return true;
    }

    // Update coefficients if needed (once per block)
    this.updateCoefficients();

    // Get wet/dry mix and output gain
    const wet = parameters.wet[0] !== undefined ? parameters.wet[0] : 1.0;
    const dry = 1 - wet;
    const outputGain = parameters.output[0] !== undefined ? parameters.output[0] : 1.0;

    // Process each channel
    for (let channel = 0; channel < Math.min(input.length, output.length); channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];
      const state = this.channelState[channel];

      for (let i = 0; i < inputChannel.length; i++) {
        const inputSample = inputChannel[i];

        // Process through all active bands in series
        let processed = inputSample;
        for (let b = 0; b < this.bands.length; b++) {
          if (this.bands[b].active) {
            processed = this.processBiquad(processed, state.filters[b]);

            // ✅ NEW: Apply Dynamic EQ if enabled
            if (this.bands[b].dynamicEnabled) {
              processed = this.processDynamicEQ(processed, b, channel, state);
            }
          }
        }

        // Mix dry/wet and apply output gain
        outputChannel[i] = (dry * inputSample + wet * processed) * outputGain;
      }
    }

    return true;
  }
}

registerProcessor('multiband-eq-processor-v2', MultiBandEQProcessorV2);
