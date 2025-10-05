/**
 * FeedbackDelay Processor
 * Enhanced delay with tone control and cross-feedback
 */

class FeedbackDelayProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'delayTime', defaultValue: 0.3, minValue: 0, maxValue: 2 },
      { name: 'feedback', defaultValue: 0.5, minValue: 0, maxValue: 0.95 },
      { name: 'tone', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'stereoOffset', defaultValue: 0, minValue: -0.5, maxValue: 0.5 },
      { name: 'wet', defaultValue: 0.3, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'FeedbackDelay';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    const maxDelay = 2; // 2 seconds
    const bufferSize = Math.ceil(maxDelay * this.sampleRate);

    this.delayBuffer = [
      new Float32Array(bufferSize),
      new Float32Array(bufferSize)
    ];

    this.writeIndex = [0, 0];

    // Tone control filter state
    this.filterState = [
      { lowpass: 0, highpass: 0 },
      { lowpass: 0, highpass: 0 }
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

  applyToneFilter(sample, filterState, tone) {
    // Tone control: 0 = dark (lowpass), 0.5 = neutral, 1 = bright (highpass)
    const lpfCoeff = 0.3 + (1 - tone) * 0.6;
    const hpfCoeff = 0.05 + tone * 0.15;

    // Lowpass (one-pole)
    filterState.lowpass = filterState.lowpass * lpfCoeff + sample * (1 - lpfCoeff);

    // Highpass (one-pole)
    const highpassed = sample - filterState.highpass;
    filterState.highpass = filterState.highpass * hpfCoeff + sample * (1 - hpfCoeff);

    // Blend between lowpass and highpass based on tone
    if (tone < 0.5) {
      const mix = tone * 2;
      return filterState.lowpass * (1 - mix) + sample * mix;
    } else {
      const mix = (tone - 0.5) * 2;
      return sample * (1 - mix) + highpassed * mix;
    }
  }

  processEffect(sample, channel, sampleIndex, parameters) {
    const delayTime = this.getParam(parameters.delayTime, sampleIndex) || 0.3;
    const feedback = this.getParam(parameters.feedback, sampleIndex) || 0.5;
    const tone = this.getParam(parameters.tone, sampleIndex) || 0.5;
    const stereoOffset = this.getParam(parameters.stereoOffset, sampleIndex) || 0;

    const buffer = this.delayBuffer[channel];
    const otherBuffer = this.delayBuffer[1 - channel]; // For cross-feedback
    const writeIdx = this.writeIndex[channel];
    const filterState = this.filterState[channel];

    // Calculate delay time with stereo offset
    const channelDelayTime = channel === 0 ?
      delayTime :
      delayTime + stereoOffset;

    const delaySamples = Math.floor(Math.max(1, channelDelayTime * this.sampleRate));
    const readIdx = (writeIdx - delaySamples + buffer.length) % buffer.length;

    // Read delayed sample
    const delayedSample = buffer[readIdx];

    // Cross-feedback from other channel (20% mix)
    const otherReadIdx = (this.writeIndex[1 - channel] - delaySamples + otherBuffer.length) % otherBuffer.length;
    const crossFeedback = otherBuffer[otherReadIdx] * 0.2;

    // Apply tone filter to feedback
    const filteredFeedback = this.applyToneFilter(
      delayedSample + crossFeedback,
      filterState,
      tone
    );

    // Write to delay buffer with feedback
    buffer[writeIdx] = sample + filteredFeedback * feedback;
    this.writeIndex[channel] = (writeIdx + 1) % buffer.length;

    return delayedSample;
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
                (this.settings.wet !== undefined ? this.settings.wet : 0.3);
    const dry = 1 - wet;

    for (let channel = 0; channel < output.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      for (let i = 0; i < inputChannel.length; i++) {
        const inputSample = inputChannel[i];
        const processedSample = this.processEffect(inputSample, channel, i, parameters);
        outputChannel[i] = dry * inputSample + wet * processedSample;
      }
    }

    return true;
  }
}

registerProcessor('feedback-delay-processor', FeedbackDelayProcessor);
