/**
 * DELAY PROCESSOR
 *
 * Simple delay with feedback
 */

class DelayProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'delayTime', defaultValue: 0.3, minValue: 0, maxValue: 2 },
      { name: 'feedback', defaultValue: 0.3, minValue: 0, maxValue: 0.95 },
      { name: 'wet', defaultValue: 0.3, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();

    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'Delay';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Delay buffer (2 seconds max)
    const maxDelay = Math.floor(2 * this.sampleRate);
    this.delayBuffer = [
      new Float32Array(maxDelay),
      new Float32Array(maxDelay)
    ];
    this.writeIndex = [0, 0];


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
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) return true;

    const blockSize = input[0].length;
    const channelCount = Math.min(input.length, output.length);

    const wetParam = this.getParam(parameters.wet, 0);
    const wet = wetParam !== undefined ? wetParam : (this.settings.wet !== undefined ? this.settings.wet : 0.3);

    if (this.bypassed) {
      for (let channel = 0; channel < channelCount; channel++) {
        output[channel].set(input[channel]);
      }
      return true;
    }

    for (let channel = 0; channel < channelCount; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      for (let i = 0; i < blockSize; i++) {
        const drySample = inputChannel[i];
        const wetSample = this.processEffect(drySample, channel, i, parameters);
        outputChannel[i] = drySample * (1 - wet) + wetSample * wet;
      }
    }

    return true;
  }

  processEffect(sample, channel, sampleIndex, parameters) {
    const delayTime = this.getParam(parameters.delayTime, sampleIndex) || this.settings.delayTime || 0.3;
    const feedback = this.getParam(parameters.feedback, sampleIndex) || this.settings.feedback || 0.3;

    const buffer = this.delayBuffer[channel];
    const writeIdx = this.writeIndex[channel];

    // Calculate delay in samples
    const delaySamples = Math.floor(delayTime * this.sampleRate);
    const maxDelay = buffer.length;
    const clampedDelay = Math.min(delaySamples, maxDelay - 1);

    // Read delayed sample
    const readIdx = (writeIdx - clampedDelay + maxDelay) % maxDelay;
    const delayedSample = buffer[readIdx];

    // Write input + feedback
    buffer[writeIdx] = sample + delayedSample * feedback;
    this.writeIndex[channel] = (writeIdx + 1) % maxDelay;

    return delayedSample;
  }

  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  resetState() {
    this.delayBuffer.forEach(buf => buf.fill(0));
    this.writeIndex = [0, 0];
  }
}

registerProcessor('delay-processor', DelayProcessor);
