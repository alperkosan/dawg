/**
 * StardustChorus Processor
 * Lush chorus effect with multiple modulated delay lines
 */

class StardustChorusProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 1.5, minValue: 0.1, maxValue: 10 },
      { name: 'depth', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'voices', defaultValue: 3, minValue: 1, maxValue: 5 },
      { name: 'stereoWidth', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'wet', defaultValue: 0.5, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = globalThis.sampleRate || 48000;
    this.effectType = options?.processorOptions?.effectType || 'StardustChorus';
    this.settings = options?.processorOptions?.settings || {};
    this.bypassed = false;

    const maxDelayMs = 50;
    const bufferSize = Math.ceil((maxDelayMs / 1000) * this.sampleRate);

    this.channelState = [
      {
        buffer: new Float32Array(bufferSize),
        writeIndex: 0,
        lfoPhases: [0, 0.2, 0.4, 0.6, 0.8] // Offset phases for 5 voices
      },
      {
        buffer: new Float32Array(bufferSize),
        writeIndex: 0,
        lfoPhases: [0.1, 0.3, 0.5, 0.7, 0.9] // Different offsets for stereo width
      }
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

  processEffect(sample, channel, parameters) {
    const rate = this.getParam(parameters.rate, 0) || 1.5;
    const depth = this.getParam(parameters.depth, 0) || 0.5;
    const voices = Math.floor(this.getParam(parameters.voices, 0) || 3);
    const stereoWidth = this.getParam(parameters.stereoWidth, 0) || 0.5;

    const state = this.channelState[channel];
    const buffer = state.buffer;
    const bufferLength = buffer.length;

    // Write input to delay buffer
    buffer[state.writeIndex] = sample;
    state.writeIndex = (state.writeIndex + 1) % bufferLength;

    // Sum multiple chorus voices
    let chorusSum = 0;
    const baseDelayMs = 20; // Base delay time
    const modulationMs = 15; // Max modulation depth

    // 🎯 PROFESSIONAL CHORUS: Multiple voices with phase offset (like Dimension D)
    // Voice spacing and phase relationships for natural stereo width
    const voiceSpacing = 1.0 / Math.max(voices, 1); // Equal spacing
    
    for (let v = 0; v < voices; v++) {
      // 🎯 SMOOTH LFO: Per-voice phase with stereo offset
      const lfoIncrement = (rate / this.sampleRate) * 2 * Math.PI;
      state.lfoPhases[v] += lfoIncrement;
      if (state.lfoPhases[v] > 2 * Math.PI) {
        state.lfoPhases[v] -= 2 * Math.PI;
      }

      // 🎯 PROFESSIONAL MODULATION: Triangle wave for smoother chorusing (less artifacts)
      // Mix sine and triangle for musical character
      const sineLFO = Math.sin(state.lfoPhases[v]);
      const triangleLFO = (2 / Math.PI) * Math.asin(sineLFO); // Convert sine to triangle
      const lfoValue = sineLFO * 0.7 + triangleLFO * 0.3; // Blend for natural sound
      
      // Voice offset for spacing (prevents phase cancellation)
      const voiceOffset = v * voiceSpacing * modulationMs * 0.2;
      const delayMs = baseDelayMs + voiceOffset + (lfoValue * modulationMs * depth);
      const delaySamples = (delayMs / 1000) * this.sampleRate;

      // 🎯 PROFESSIONAL CHORUS: Cubic interpolation for smooth modulation (like Eventide)
      // Read from delay buffer with high-quality interpolation
      const readPos = state.writeIndex - delaySamples;
      const readIndex1 = Math.floor(readPos);
      const frac = readPos - readIndex1;

      // Cubic interpolation for smoother LFO modulation
      const idx0 = (readIndex1 - 1 + bufferLength) % bufferLength;
      const idx1 = (readIndex1 + bufferLength) % bufferLength;
      const idx2 = (readIndex1 + 1 + bufferLength) % bufferLength;
      const idx3 = (readIndex1 + 2 + bufferLength) % bufferLength;

      const y0 = buffer[idx0];
      const y1 = buffer[idx1];
      const y2 = buffer[idx2];
      const y3 = buffer[idx3];

      // Catmull-Rom spline for smooth modulation
      const c0 = y1;
      const c1 = 0.5 * (y2 - y0);
      const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
      const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
      const delayedSample = c0 + c1 * frac + c2 * frac * frac + c3 * frac * frac * frac;

      // 🎯 PROFESSIONAL STEREO PANNING: Equal-power law for natural width
      const pan = (v / Math.max(voices - 1, 1)) - 0.5; // -0.5 to 0.5
      
      // Equal-power panning (preserves energy across stereo field)
      const panAngle = (pan * stereoWidth + 1) * Math.PI / 4; // 0 to PI/2
      const leftGain = Math.cos(panAngle);
      const rightGain = Math.sin(panAngle);
      
      const channelGain = channel === 0 ? leftGain : rightGain;

      // 🎯 VOICE LEVELING: Prevent volume buildup with multiple voices
      const voiceGain = 1.0 / Math.sqrt(voices); // Energy-preserving normalization
      chorusSum += delayedSample * channelGain * voiceGain;
    }

    return chorusSum;
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
                (this.settings.wet !== undefined ? this.settings.wet : 0.5);
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

registerProcessor('stardust-chorus-processor', StardustChorusProcessor);
