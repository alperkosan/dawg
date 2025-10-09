/**
 * MODERN DELAY PROCESSOR
 *
 * Multi-tap stereo delay with:
 * - Independent L/R delay lines
 * - Ping-pong cross-feedback
 * - Multi-mode filtering
 * - Tape-style saturation
 * - Diffusion (allpass)
 */

class ModernDelayProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'timeLeft', defaultValue: 0.375, minValue: 0.001, maxValue: 4 },
      { name: 'timeRight', defaultValue: 0.5, minValue: 0.001, maxValue: 4 },
      { name: 'feedbackLeft', defaultValue: 0.4, minValue: 0, maxValue: 1 },
      { name: 'feedbackRight', defaultValue: 0.4, minValue: 0, maxValue: 1 },
      { name: 'pingPong', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'wet', defaultValue: 0.35, minValue: 0, maxValue: 1 },
      { name: 'filterFreq', defaultValue: 8000, minValue: 100, maxValue: 20000 },
      { name: 'saturation', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'diffusion', defaultValue: 0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();

    this.sampleRate = globalThis.sampleRate || 48000;
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Delay buffers (4 seconds max)
    const maxDelay = this.sampleRate * 4;
    this.delayBufferLeft = new Float32Array(maxDelay);
    this.delayBufferRight = new Float32Array(maxDelay);
    this.writeIndex = 0;

    // Filter states (one-pole lowpass)
    this.filterStateLeft = 0;
    this.filterStateRight = 0;

    // Diffusion (allpass filters)
    const allpassSizes = [
      Math.floor(0.0073 * this.sampleRate),
      Math.floor(0.0113 * this.sampleRate),
      Math.floor(0.0079 * this.sampleRate),
      Math.floor(0.0119 * this.sampleRate)
    ];

    this.allpassFilters = allpassSizes.map(size => ({
      buffer: new Float32Array(size),
      index: 0,
      size: size
    }));

    this.port.onmessage = (event) => {
      const { type, data } = event.data;
      if (type === 'updateSettings') {
        this.settings = { ...this.settings, ...data };
      } else if (type === 'bypass') {
        this.bypassed = data.bypassed;
      } else if (type === 'reset' || type === 'flush') {
        // Clear all delay buffers for clean stop
        this.delayBufferLeft.fill(0);
        this.delayBufferRight.fill(0);
        this.filterStateLeft = 0;
        this.filterStateRight = 0;
        this.allpassFilters.forEach(ap => ap.buffer.fill(0));
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input?.[0] || !output?.[0]) return true;

    const blockSize = input[0].length;

    // Get parameters
    const timeLeft = this.getParam(parameters.timeLeft, 0) ?? this.settings.timeLeft ?? 0.375;
    const timeRight = this.getParam(parameters.timeRight, 0) ?? this.settings.timeRight ?? 0.5;
    const feedbackLeft = this.getParam(parameters.feedbackLeft, 0) ?? this.settings.feedbackLeft ?? 0.4;
    const feedbackRight = this.getParam(parameters.feedbackRight, 0) ?? this.settings.feedbackRight ?? 0.4;
    const pingPong = this.getParam(parameters.pingPong, 0) ?? this.settings.pingPong ?? 0;
    const wet = this.getParam(parameters.wet, 0) ?? this.settings.wet ?? 0.35;
    const filterFreq = this.getParam(parameters.filterFreq, 0) ?? this.settings.filterFreq ?? 8000;
    const saturation = this.getParam(parameters.saturation, 0) ?? this.settings.saturation ?? 0;
    const diffusion = this.getParam(parameters.diffusion, 0) ?? this.settings.diffusion ?? 0;

    if (this.bypassed) {
      output[0].set(input[0]);
      if (output[1] && input[1]) output[1].set(input[1]);
      return true;
    }

    // Calculate delay samples
    const delaySamplesLeft = Math.floor(timeLeft * this.sampleRate);
    const delaySamplesRight = Math.floor(timeRight * this.sampleRate);

    // Filter coefficient
    const filterCoeff = Math.exp(-2 * Math.PI * filterFreq / this.sampleRate);

    // Feedback routing
    const straightFB = 1 - pingPong;
    const crossFB = pingPong * 0.8;

    for (let i = 0; i < blockSize; i++) {
      const inputLeft = input[0][i];
      const inputRight = input[1]?.[i] ?? inputLeft;

      // Read from delay buffers
      const readIdxLeft = (this.writeIndex - delaySamplesLeft + this.delayBufferLeft.length) % this.delayBufferLeft.length;
      const readIdxRight = (this.writeIndex - delaySamplesRight + this.delayBufferRight.length) % this.delayBufferRight.length;

      let delayedLeft = this.delayBufferLeft[readIdxLeft];
      let delayedRight = this.delayBufferRight[readIdxRight];

      // Apply diffusion (allpass) if enabled
      if (diffusion > 0) {
        const diffusionAmount = diffusion * 0.7;

        // Process left through first 2 allpass
        delayedLeft = this.processAllpass(delayedLeft, this.allpassFilters[0], diffusionAmount);
        delayedLeft = this.processAllpass(delayedLeft, this.allpassFilters[1], diffusionAmount);

        // Process right through last 2 allpass
        delayedRight = this.processAllpass(delayedRight, this.allpassFilters[2], diffusionAmount);
        delayedRight = this.processAllpass(delayedRight, this.allpassFilters[3], diffusionAmount);
      }

      // One-pole lowpass filter
      this.filterStateLeft = delayedLeft + filterCoeff * (this.filterStateLeft - delayedLeft);
      this.filterStateRight = delayedRight + filterCoeff * (this.filterStateRight - delayedRight);

      let filteredLeft = this.filterStateLeft;
      let filteredRight = this.filterStateRight;

      // Saturation
      if (saturation > 0) {
        const drive = 1 + saturation * 50;
        filteredLeft = Math.tanh(filteredLeft * drive) / Math.tanh(drive);
        filteredRight = Math.tanh(filteredRight * drive) / Math.tanh(drive);
      }

      // Write to delay buffers with feedback
      this.delayBufferLeft[this.writeIndex] =
        inputLeft + filteredLeft * feedbackLeft * straightFB + filteredRight * feedbackRight * crossFB;

      this.delayBufferRight[this.writeIndex] =
        inputRight + filteredRight * feedbackRight * straightFB + filteredLeft * feedbackLeft * crossFB;

      this.writeIndex = (this.writeIndex + 1) % this.delayBufferLeft.length;

      // Mix dry and wet
      output[0][i] = inputLeft * (1 - wet) + delayedLeft * wet;
      if (output[1]) {
        output[1][i] = inputRight * (1 - wet) + delayedRight * wet;
      }
    }

    return true;
  }

  processAllpass(input, allpass, feedback) {
    const delayed = allpass.buffer[allpass.index];
    allpass.buffer[allpass.index] = input + delayed * feedback;
    const output = delayed - input * feedback;
    allpass.index = (allpass.index + 1) % allpass.size;
    return output;
  }

  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }
}

registerProcessor('modern-delay-processor', ModernDelayProcessor);
