/**
 * Plugin Template AudioWorkletProcessor
 *
 * This is a template for creating new audio effect worklet processors.
 * Replace all instances of "TemplateProcessor" with your processor name.
 *
 * Key Concepts:
 * - process() runs on the audio thread at ~128 samples per block
 * - Avoid memory allocations in process() for best performance
 * - Use message passing for parameter updates from main thread
 * - Return true to keep processor alive
 *
 * @example
 * // 1. Copy this file and rename it to your-processor.js
 * // 2. Update the class name and registerProcessor call
 * // 3. Implement your DSP algorithm in process()
 * // 4. Add parameter handling in the message port listener
 */

class TemplateProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Plugin parameters (controlled from UI)
    this.param1 = 0.5;
    this.param2 = 0.5;
    this.param3 = 0.5;
    this.mix = 1.0;

    // Internal state variables
    this.sampleRate = sampleRate;

    // Buffers for processing (pre-allocate to avoid GC in process())
    this.leftBuffer = new Float32Array(128);
    this.rightBuffer = new Float32Array(128);

    // State for DSP algorithms
    // Example: Filter coefficients, delay lines, oscillator phase, etc.
    this.filterState = {
      x1: 0,
      x2: 0,
      y1: 0,
      y2: 0
    };

    // Message port for communication with UI
    this.port.onmessage = (event) => {
      const { type, data } = event.data;

      switch (type) {
        case 'setParameters':
          this.param1 = data.param1 ?? this.param1;
          this.param2 = data.param2 ?? this.param2;
          this.param3 = data.param3 ?? this.param3;
          this.mix = data.mix ?? this.mix;
          break;

        case 'setParam1':
          this.param1 = data.value;
          break;

        case 'setParam2':
          this.param2 = data.value;
          break;

        case 'setParam3':
          this.param3 = data.value;
          break;

        case 'setMix':
          this.mix = data.value;
          break;

        case 'reset':
          this.reset();
          break;

        default:
          console.warn('TemplateProcessor: Unknown message type:', type);
      }
    };
  }

  /**
   * Reset internal state
   * Call this when parameters change dramatically or on transport stop
   */
  reset() {
    this.filterState = {
      x1: 0,
      x2: 0,
      y1: 0,
      y2: 0
    };
  }

  /**
   * Example DSP function: Simple low-pass filter
   * Replace this with your actual DSP algorithm
   */
  processLowPass(input, cutoff) {
    // Simple one-pole low-pass filter
    // y[n] = (1 - α) * y[n-1] + α * x[n]
    const alpha = Math.min(1.0, cutoff);
    const output = (1 - alpha) * this.filterState.y1 + alpha * input;
    this.filterState.y1 = output;
    return output;
  }

  /**
   * Example DSP function: Waveshaping/saturation
   * Replace this with your actual DSP algorithm
   */
  processSaturation(input, amount) {
    // Soft clipping with tanh
    const gain = 1 + amount * 9; // 1x to 10x gain
    return Math.tanh(input * gain) / Math.tanh(gain);
  }

  /**
   * Main audio processing loop
   * This is called for each audio block (~128 samples)
   *
   * @param {Float32Array[][]} inputs - Input audio channels
   * @param {Float32Array[][]} outputs - Output audio channels
   * @param {Object} parameters - AudioParam values (if using AudioParams)
   * @returns {boolean} - true to keep processor alive
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    // No input? Pass through silence
    if (!input || input.length === 0) {
      return true;
    }

    const inputLeft = input[0];
    const inputRight = input[1] || input[0]; // Mono fallback

    const outputLeft = output[0];
    const outputRight = output[1] || output[0];

    const blockSize = inputLeft.length;

    // Process each sample
    for (let i = 0; i < blockSize; i++) {
      const inL = inputLeft[i];
      const inR = inputRight[i];

      // === YOUR DSP ALGORITHM GOES HERE ===
      //
      // Example: Chain of effects
      // 1. Apply low-pass filter (controlled by param1)
      let processedL = this.processLowPass(inL, this.param1);
      let processedR = this.processLowPass(inR, this.param1);

      // 2. Apply saturation (controlled by param2)
      processedL = this.processSaturation(processedL, this.param2);
      processedR = this.processSaturation(processedR, this.param2);

      // 3. Apply gain (controlled by param3)
      processedL *= (1 + this.param3);
      processedR *= (1 + this.param3);

      // === END OF DSP ALGORITHM ===

      // Apply dry/wet mix
      const wetL = processedL;
      const wetR = processedR;
      const dryL = inL;
      const dryR = inR;

      outputLeft[i] = dryL * (1 - this.mix) + wetL * this.mix;
      outputRight[i] = dryR * (1 - this.mix) + wetR * this.mix;
    }

    // Optional: Send metering data back to UI
    // (Only send occasionally to avoid overwhelming the message queue)
    if (currentFrame % 512 === 0) {
      this.sendMetering(outputLeft, outputRight);
    }

    return true; // Keep processor alive
  }

  /**
   * Send metering data to UI
   * Optional - remove if not needed
   */
  sendMetering(left, right) {
    // Calculate RMS
    let sumL = 0;
    let sumR = 0;
    for (let i = 0; i < left.length; i++) {
      sumL += left[i] * left[i];
      sumR += right[i] * right[i];
    }
    const rmsL = Math.sqrt(sumL / left.length);
    const rmsR = Math.sqrt(sumR / right.length);

    // Send to UI
    this.port.postMessage({
      type: 'metering',
      data: {
        rmsL,
        rmsR,
        peakL: Math.max(...left.map(Math.abs)),
        peakR: Math.max(...right.map(Math.abs))
      }
    });
  }
}

// Register the processor
// IMPORTANT: Change 'template-processor' to your unique processor name
registerProcessor('template-processor', TemplateProcessor);
