/**
 * REVERB PROCESSOR
 *
 * Algorithmic reverb using Schroeder/Moorer design
 * Multiple all-pass + comb filters for realistic reverb
 */

class ReverbProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'decay', defaultValue: 2.5, minValue: 0.1, maxValue: 15 },
      { name: 'preDelay', defaultValue: 0.01, minValue: 0, maxValue: 0.2 },
      { name: 'wet', defaultValue: 0.3, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();

    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'Reverb';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    // Comb filter delays (in samples) - tuned for natural reverb
    const combDelays = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116];
    const allpassDelays = [225, 556, 441, 341];

    // Per-channel reverb state
    this.channelState = [
      this.createReverbState(combDelays, allpassDelays),
      this.createReverbState(combDelays, allpassDelays)
    ];

    // Pre-delay buffer
    const maxPreDelay = Math.floor(0.1 * this.sampleRate);
    this.preDelayBuffer = [
      new Float32Array(maxPreDelay),
      new Float32Array(maxPreDelay)
    ];
    this.preDelayIndex = [0, 0];

    console.log(`🎚️ ${this.effectType} initialized at ${this.sampleRate}Hz`);

    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  createReverbState(combDelays, allpassDelays) {
    return {
      combFilters: combDelays.map(delay => ({
        buffer: new Float32Array(delay),
        index: 0,
        delay: delay
      })),
      allpassFilters: allpassDelays.map(delay => ({
        buffer: new Float32Array(delay),
        index: 0,
        delay: delay
      })),
      damping: 0,
      dampingState: 0
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
    const decay = this.getParam(parameters.decay, sampleIndex) || this.settings.decay || 2.5;
    const preDelay = this.getParam(parameters.preDelay, sampleIndex) || this.settings.preDelay || 0.01;

    const state = this.channelState[channel] || this.channelState[0];
    const preDelayBuf = this.preDelayBuffer[channel];
    const preDelayIdx = this.preDelayIndex[channel];

    // Pre-delay
    const preDelaySamples = Math.floor(preDelay * this.sampleRate);
    const preDelayedSample = preDelayBuf[preDelayIdx];
    preDelayBuf[preDelayIdx] = sample;
    this.preDelayIndex[channel] = (preDelayIdx + 1) % preDelayBuf.length;

    // Comb filters (parallel)
    let combOutput = 0;
    const feedback = Math.min(0.95, decay / 10);
    const damping = 0.2;

    state.combFilters.forEach(comb => {
      const delayed = comb.buffer[comb.index];

      // One-pole lowpass for damping
      state.dampingState = damping * state.dampingState + (1 - damping) * delayed;

      comb.buffer[comb.index] = preDelayedSample + state.dampingState * feedback;
      comb.index = (comb.index + 1) % comb.delay;

      combOutput += delayed;
    });

    combOutput /= state.combFilters.length;

    // All-pass filters (series)
    let apOutput = combOutput;
    const apFeedback = 0.5;

    state.allpassFilters.forEach(ap => {
      const delayed = ap.buffer[ap.index];
      ap.buffer[ap.index] = apOutput + delayed * apFeedback;
      ap.index = (ap.index + 1) % ap.delay;
      apOutput = delayed - apOutput * apFeedback;
    });

    return apOutput * 0.5; // Output gain
  }

  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  resetState() {
    this.channelState.forEach(state => {
      state.combFilters.forEach(c => c.buffer.fill(0));
      state.allpassFilters.forEach(a => a.buffer.fill(0));
      state.dampingState = 0;
    });
    this.preDelayBuffer.forEach(buf => buf.fill(0));
    this.preDelayIndex = [0, 0];
  }
}

registerProcessor('reverb-processor', ReverbProcessor);
