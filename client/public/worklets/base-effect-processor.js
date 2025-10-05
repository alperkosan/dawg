/**
 * BASE EFFECT PROCESSOR
 *
 * Abstract base class for all effect worklet processors
 * Provides common functionality:
 * - Parameter management and mapping
 * - Bypass/wet-dry mixing
 * - Message handling
 * - DSP utility functions
 */

class BaseEffectProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'unknown';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Initialize effect-specific state
    this.initializeEffect(options);

    console.log(`🎚️ ${this.effectType} initialized at ${this.sampleRate}Hz`);

    // Message port handling
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  /**
   * Override this in child classes to initialize effect-specific state
   */
  initializeEffect(options) {
    // Child classes implement this
  }

  /**
   * Message handler
   */
  handleMessage(message) {
    const { type, data } = message;

    switch (type) {
      case 'updateSettings':
        this.settings = { ...this.settings, ...data };
        this.onSettingsUpdate && this.onSettingsUpdate(data);
        break;

      case 'bypass':
        this.bypassed = data.bypassed;
        break;

      case 'reset':
        this.resetState && this.resetState();
        break;

      default:
        this.handleCustomMessage && this.handleCustomMessage(type, data);
    }
  }

  /**
   * Main process loop - DO NOT OVERRIDE
   * Handles bypass and wet/dry mixing
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) return true;

    const blockSize = input[0].length;
    const channelCount = Math.min(input.length, output.length);

    // Get wet parameter (0-1 mix)
    const wet = this.getParameterValue(parameters.wet, 0) || this.settings.wet || 1.0;

    // If bypassed, pass through dry signal
    if (this.bypassed) {
      for (let channel = 0; channel < channelCount; channel++) {
        output[channel].set(input[channel]);
      }
      return true;
    }

    // Process each channel
    for (let channel = 0; channel < channelCount; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      for (let i = 0; i < blockSize; i++) {
        const drySample = inputChannel[i];

        // Process effect (child class implements this)
        const wetSample = this.processEffect(drySample, channel, i, parameters);

        // Wet/dry mix
        outputChannel[i] = drySample * (1 - wet) + wetSample * wet;
      }
    }

    return true;
  }

  /**
   * Override this in child classes to implement effect DSP
   * @param {number} sample - Input sample
   * @param {number} channel - Channel index (0=left, 1=right)
   * @param {number} sampleIndex - Sample index in current block
   * @param {object} parameters - AudioParam values
   * @returns {number} Processed sample
   */
  processEffect(sample, channel, sampleIndex, parameters) {
    // Child classes MUST implement this
    return sample;
  }

  /**
   * Get parameter value (handles both array and single value)
   */
  getParameterValue(param, sampleIndex) {
    if (!param) return undefined;
    return param.length > 1 ? param[sampleIndex] : param[0];
  }

  /**
   * DSP UTILITY FUNCTIONS
   */

  // Soft clipping/limiting
  softClip(sample, threshold = 0.9) {
    if (Math.abs(sample) > threshold) {
      const sign = Math.sign(sample);
      const magnitude = Math.abs(sample);
      return sign * (threshold + (magnitude - threshold) * 0.1);
    }
    return sample;
  }

  // Tanh saturation
  tanhSaturate(sample, drive = 1.0) {
    return Math.tanh(sample * drive);
  }

  // DC blocker (removes DC offset)
  dcBlock(sample, state) {
    const R = 0.995;
    const output = sample - state.x1 + R * state.y1;
    state.x1 = sample;
    state.y1 = output;
    return output;
  }

  // One-pole lowpass filter
  onePoleLP(sample, state, cutoff) {
    const alpha = this.calculateLPAlpha(cutoff);
    state.z1 = state.z1 + alpha * (sample - state.z1);
    return state.z1;
  }

  // One-pole highpass filter
  onePoleHP(sample, state, cutoff) {
    const alpha = this.calculateHPAlpha(cutoff);
    const output = alpha * (state.y1 + sample - state.x1);
    state.x1 = sample;
    state.y1 = output;
    return output;
  }

  // Calculate lowpass alpha
  calculateLPAlpha(cutoffFreq) {
    const rc = 1 / (2 * Math.PI * cutoffFreq);
    const dt = 1 / this.sampleRate;
    return dt / (rc + dt);
  }

  // Calculate highpass alpha
  calculateHPAlpha(cutoffFreq) {
    const rc = 1 / (2 * Math.PI * cutoffFreq);
    const dt = 1 / this.sampleRate;
    return rc / (rc + dt);
  }

  // Linear interpolation
  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Map value from one range to another
  mapRange(value, inMin, inMax, outMin, outMax) {
    return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
  }

  // dB to linear gain
  dbToGain(db) {
    return Math.pow(10, db / 20);
  }

  // Linear gain to dB
  gainToDb(gain) {
    return 20 * Math.log10(Math.max(gain, 0.00001));
  }
}

// Export for use in other worklets
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseEffectProcessor;
}
