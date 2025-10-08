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
      { id: 'band-1', type: 'lowshelf', frequency: 100, gain: 0, q: 0.71, active: true },
      { id: 'band-2', type: 'peaking', frequency: 1000, gain: 0, q: 1.5, active: true },
      { id: 'band-3', type: 'highshelf', frequency: 8000, gain: 0, q: 0.71, active: true }
    ];

    // Stereo channel state
    this.channelState = [
      { filters: this.createFilters(this.bands.length) },
      { filters: this.createFilters(this.bands.length) }
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
            }
          } else if (current > requiredFilters) {
            // Remove filters
            this.channelState[ch].filters.length = requiredFilters;
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
      // State variables
      x1: 0, x2: 0, y1: 0, y2: 0
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
   * Process single sample through biquad filter
   */
  processBiquad(sample, filter) {
    const y = filter.b0 * sample +
              filter.b1 * filter.x1 +
              filter.b2 * filter.x2 -
              filter.a1 * filter.y1 -
              filter.a2 * filter.y2;

    filter.x2 = filter.x1;
    filter.x1 = sample;
    filter.y2 = filter.y1;
    filter.y1 = y;

    return y;
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
