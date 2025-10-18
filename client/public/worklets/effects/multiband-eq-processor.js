/**
 * MultiBandEQ Processor
 * N-band parametric EQ with adjustable frequency, gain, and Q
 */

class MultiBandEQProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      // Band 1 (Low)
      { name: 'freq1', defaultValue: 100, minValue: 20, maxValue: 20000 },
      { name: 'gain1', defaultValue: 0, minValue: -24, maxValue: 24 },
      { name: 'q1', defaultValue: 1.0, minValue: 0.1, maxValue: 10 },

      // Band 2 (Low-Mid)
      { name: 'freq2', defaultValue: 500, minValue: 20, maxValue: 20000 },
      { name: 'gain2', defaultValue: 0, minValue: -24, maxValue: 24 },
      { name: 'q2', defaultValue: 1.0, minValue: 0.1, maxValue: 10 },

      // Band 3 (Mid)
      { name: 'freq3', defaultValue: 2000, minValue: 20, maxValue: 20000 },
      { name: 'gain3', defaultValue: 0, minValue: -24, maxValue: 24 },
      { name: 'q3', defaultValue: 1.0, minValue: 0.1, maxValue: 10 },

      // Band 4 (High-Mid)
      { name: 'freq4', defaultValue: 5000, minValue: 20, maxValue: 20000 },
      { name: 'gain4', defaultValue: 0, minValue: -24, maxValue: 24 },
      { name: 'q4', defaultValue: 1.0, minValue: 0.1, maxValue: 10 },

      // Band 5 (High)
      { name: 'freq5', defaultValue: 10000, minValue: 20, maxValue: 20000 },
      { name: 'gain5', defaultValue: 0, minValue: -24, maxValue: 24 },
      { name: 'q5', defaultValue: 1.0, minValue: 0.1, maxValue: 10 },

      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'MultiBandEQ';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Initialize 5 biquad filters per channel
    this.channelState = [
      { filters: this.createFilters(), history: new Float32Array(10) },
      { filters: this.createFilters(), history: new Float32Array(10) }
    ];

    // ⚡ OPTIMIZATION: Cache parameters to detect changes
    this.cachedParams = {
      freq1: 100, gain1: 0, q1: 1.0,
      freq2: 500, gain2: 0, q2: 1.0,
      freq3: 2000, gain3: 0, q3: 1.0,
      freq4: 5000, gain4: 0, q4: 1.0,
      freq5: 10000, gain5: 0, q5: 1.0
    };

    this.port.onmessage = (e) => {
      if (e.data.type === 'updateSettings') {
        Object.assign(this.settings, e.data.data);
      } else if (e.data.type === 'bypass') {
        this.bypassed = e.data.value;
      }
    };
  }

  createFilters() {
    return [
      { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0 },
      { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0 },
      { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0 },
      { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0 },
      { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0 }
    ];
  }

  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  updateBiquadCoefficients(filter, freq, gain, q) {
    const w0 = 2 * Math.PI * freq / this.sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * q);
    const A = Math.pow(10, gain / 40);

    // Peaking EQ coefficients
    const b0 = 1 + alpha * A;
    const b1 = -2 * cosw0;
    const b2 = 1 - alpha * A;
    const a0 = 1 + alpha / A;
    const a1 = -2 * cosw0;
    const a2 = 1 - alpha / A;

    filter.b0 = b0 / a0;
    filter.b1 = b1 / a0;
    filter.b2 = b2 / a0;
    filter.a1 = a1 / a0;
    filter.a2 = a2 / a0;
  }

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

  processEffect(sample, channel, parameters) {
    const state = this.channelState[channel];

    // ⚡ OPTIMIZATION: Only update coefficients when parameters change
    // Check all 5 bands for parameter changes
    for (let i = 0; i < 5; i++) {
      const bandNum = i + 1;
      const freq = this.getParam(parameters[`freq${bandNum}`], 0) || [100, 500, 2000, 5000, 10000][i];
      const gain = this.getParam(parameters[`gain${bandNum}`], 0) || 0;
      const q = this.getParam(parameters[`q${bandNum}`], 0) || 1.0;

      // Only recalculate if parameters changed
      const freqKey = `freq${bandNum}`;
      const gainKey = `gain${bandNum}`;
      const qKey = `q${bandNum}`;

      if (this.cachedParams[freqKey] !== freq ||
          this.cachedParams[gainKey] !== gain ||
          this.cachedParams[qKey] !== q) {

        this.cachedParams[freqKey] = freq;
        this.cachedParams[gainKey] = gain;
        this.cachedParams[qKey] = q;

        // Recalculate coefficients for this band
        this.updateBiquadCoefficients(state.filters[i], freq, gain, q);
      }
    }

    // Process through all 5 filters in series
    let processed = sample;
    for (let i = 0; i < 5; i++) {
      processed = this.processBiquad(processed, state.filters[i]);
    }

    return processed;
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

registerProcessor('multiband-eq-processor', MultiBandEQProcessor);
