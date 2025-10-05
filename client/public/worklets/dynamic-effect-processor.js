/**
 * DYNAMIC EFFECT PROCESSOR
 *
 * Generic worklet that executes user-defined DSP chains
 * Allows unlimited effect combinations without creating new worklets
 */

// Import DSP modules (inline for worklet compatibility)
const DSPModules = {
  filter: {
    create(sampleRate) {
      return {
        state: { x1: 0, x2: 0, y1: 0, y2: 0 },
        coeffs: { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 },

        updateCoeffs(type, freq, q) {
          const w0 = 2 * Math.PI * freq / sampleRate;
          const cosw0 = Math.cos(w0);
          const sinw0 = Math.sin(w0);
          const alpha = sinw0 / (2 * q);

          let b0, b1, b2, a0, a1, a2;

          if (type === 'lowpass') {
            b0 = (1 - cosw0) / 2; b1 = 1 - cosw0; b2 = (1 - cosw0) / 2;
            a0 = 1 + alpha; a1 = -2 * cosw0; a2 = 1 - alpha;
          } else if (type === 'highpass') {
            b0 = (1 + cosw0) / 2; b1 = -(1 + cosw0); b2 = (1 + cosw0) / 2;
            a0 = 1 + alpha; a1 = -2 * cosw0; a2 = 1 - alpha;
          } else if (type === 'bandpass') {
            b0 = alpha; b1 = 0; b2 = -alpha;
            a0 = 1 + alpha; a1 = -2 * cosw0; a2 = 1 - alpha;
          } else {
            b0 = 1; b1 = 0; b2 = 0; a0 = 1; a1 = 0; a2 = 0;
          }

          this.coeffs = {
            b0: b0/a0, b1: b1/a0, b2: b2/a0,
            a1: a1/a0, a2: a2/a0
          };
        },

        process(sample) {
          const { b0, b1, b2, a1, a2 } = this.coeffs;
          const s = this.state;
          const y = b0*sample + b1*s.x1 + b2*s.x2 - a1*s.y1 - a2*s.y2;
          s.x2 = s.x1; s.x1 = sample; s.y2 = s.y1; s.y1 = y;
          return y;
        }
      };
    }
  },

  saturator: {
    create() {
      return {
        process(sample, drive = 1.0) {
          const x = sample * drive;
          if (Math.abs(x) < 0.33) return x;
          if (Math.abs(x) < 0.66) return Math.sign(x) * (1 - Math.pow(2 - 3*Math.abs(x), 2)/3);
          return Math.sign(x) * 0.9;
        }
      };
    }
  },

  delay: {
    create(maxDelay, sampleRate) {
      const size = Math.ceil(maxDelay * sampleRate);
      return {
        buffer: new Float32Array(size),
        writeIndex: 0,
        process(sample, delayTime, feedback = 0) {
          const delaySamples = Math.floor(delayTime * sampleRate);
          const readIdx = (this.writeIndex - delaySamples + this.buffer.length) % this.buffer.length;
          const delayed = this.buffer[readIdx];
          this.buffer[this.writeIndex] = sample + delayed * feedback;
          this.writeIndex = (this.writeIndex + 1) % this.buffer.length;
          return delayed;
        }
      };
    }
  },

  lfo: {
    create(sampleRate) {
      return {
        phase: 0,
        process(rate, shape = 'sine') {
          this.phase += (rate / sampleRate) * 2 * Math.PI;
          if (this.phase > 2 * Math.PI) this.phase -= 2 * Math.PI;
          if (shape === 'sine') return Math.sin(this.phase);
          if (shape === 'triangle') return (2/Math.PI) * Math.asin(Math.sin(this.phase));
          if (shape === 'square') return this.phase < Math.PI ? 1 : -1;
          return Math.sin(this.phase);
        }
      };
    }
  },

  gain: {
    create() {
      return { process: (sample, amount = 1.0) => sample * amount };
    }
  },

  compressor: {
    create(sampleRate) {
      return {
        envelope: 0,
        process(sample, threshold = -24, ratio = 4, attack = 0.003, release = 0.25) {
          const inputDb = 20 * Math.log10(Math.max(Math.abs(sample), 0.00001));
          const attackCoeff = Math.exp(-1 / (attack * sampleRate));
          const releaseCoeff = Math.exp(-1 / (release * sampleRate));

          if (inputDb > this.envelope) {
            this.envelope = attackCoeff * this.envelope + (1 - attackCoeff) * inputDb;
          } else {
            this.envelope = releaseCoeff * this.envelope + (1 - releaseCoeff) * inputDb;
          }

          let gr = 0;
          if (this.envelope > threshold) gr = (threshold - this.envelope) * (1 - 1/ratio);
          return sample * Math.pow(10, gr / 20);
        }
      };
    }
  },

  reverb: {
    create(sampleRate) {
      return {
        combs: [1557, 1617, 1491, 1422].map(d => ({ buffer: new Float32Array(d), index: 0 })),
        dampingState: 0,
        process(sample, decay = 0.5) {
          let out = 0;
          const fb = Math.min(0.95, decay / 10);
          this.combs.forEach(c => {
            const delayed = c.buffer[c.index];
            this.dampingState = 0.2 * this.dampingState + 0.8 * delayed;
            c.buffer[c.index] = sample + this.dampingState * fb;
            c.index = (c.index + 1) % c.buffer.length;
            out += delayed;
          });
          return out / this.combs.length;
        }
      };
    }
  }
};

class DynamicEffectProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    // Dynamic parameters based on DSP chain
    const params = [
      { name: 'wet', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];

    // Add up to 10 generic parameters for modulation
    for (let i = 0; i < 10; i++) {
      params.push({
        name: `param${i}`,
        defaultValue: 0.5,
        minValue: 0,
        maxValue: 1
      });
    }

    return params;
  }

  constructor(options) {
    super();

    this.sampleRate = globalThis.sampleRate || 48000;
    this.bypassed = false;

    // DSP Chain definition from options
    this.dspChainConfig = options?.processorOptions?.dspChain || [];
    this.effectName = options?.processorOptions?.effectName || 'CustomEffect';

    // Initialize DSP modules for each channel
    this.channelState = [
      this.createDspChain(),
      this.createDspChain()
    ];

    console.log(`🎛️ DynamicEffect "${this.effectName}" loaded with ${this.dspChainConfig.length} modules`);

    this.port.onmessage = (e) => {
      if (e.data.type === 'bypass') {
        this.bypassed = e.data.value;
      } else if (e.data.type === 'updateChain') {
        this.dspChainConfig = e.data.chain;
        this.channelState = [this.createDspChain(), this.createDspChain()];
      }
    };
  }

  createDspChain() {
    return this.dspChainConfig.map(config => {
      const moduleFactory = DSPModules[config.type];
      if (!moduleFactory) {
        console.warn(`Unknown DSP module: ${config.type}`);
        return null;
      }

      const module = moduleFactory.create(this.sampleRate);
      return {
        type: config.type,
        instance: module,
        params: config.params || {}
      };
    }).filter(m => m !== null);
  }

  getParam(param, index) {
    if (!param) return undefined;
    return param.length > 1 ? param[index] : param[0];
  }

  processChain(sample, channel, parameters) {
    let signal = sample;
    const chain = this.channelState[channel];

    chain.forEach((module, idx) => {
      const { type, instance, params } = module;

      // Get parameter values (can be modulated)
      const resolvedParams = {};
      Object.keys(params).forEach(key => {
        let value = params[key];

        // Check if parameter is mapped to AudioParam
        if (typeof value === 'string' && value.startsWith('param')) {
          const paramIdx = parseInt(value.replace('param', ''));
          value = this.getParam(parameters[value], 0) || 0.5;
        }

        resolvedParams[key] = value;
      });

      // Process signal through module
      switch(type) {
        case 'filter':
          instance.updateCoeffs(
            resolvedParams.type || 'lowpass',
            resolvedParams.frequency || 1000,
            resolvedParams.q || 1.0
          );
          signal = instance.process(signal);
          break;

        case 'saturator':
          signal = instance.process(signal, resolvedParams.drive || 1.0);
          break;

        case 'delay':
          signal = instance.process(
            signal,
            resolvedParams.time || 0.3,
            resolvedParams.feedback || 0.3
          );
          break;

        case 'lfo':
          signal = instance.process(
            resolvedParams.rate || 1.0,
            resolvedParams.shape || 'sine'
          );
          break;

        case 'gain':
          signal = instance.process(signal, resolvedParams.amount || 1.0);
          break;

        case 'compressor':
          signal = instance.process(
            signal,
            resolvedParams.threshold || -24,
            resolvedParams.ratio || 4,
            resolvedParams.attack || 0.003,
            resolvedParams.release || 0.25
          );
          break;

        case 'reverb':
          signal = instance.process(signal, resolvedParams.decay || 2.5);
          break;
      }
    });

    return signal;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length || this.bypassed) {
      if (output && output.length) {
        for (let ch = 0; ch < output.length; ch++) {
          output[ch].set(input?.[ch] || new Float32Array(128));
        }
      }
      return true;
    }

    const wet = this.getParam(parameters.wet, 0) || 1.0;
    const dry = 1 - wet;

    for (let ch = 0; ch < output.length; ch++) {
      const inputChannel = input[ch];
      const outputChannel = output[ch];

      for (let i = 0; i < inputChannel.length; i++) {
        const inputSample = inputChannel[i];
        const processed = this.processChain(inputSample, ch, parameters);
        outputChannel[i] = dry * inputSample + wet * processed;
      }
    }

    return true;
  }
}

registerProcessor('dynamic-effect-processor', DynamicEffectProcessor);
