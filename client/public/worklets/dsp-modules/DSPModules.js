/**
 * DSP MODULE LIBRARY
 *
 * Reusable audio processing building blocks for dynamic effect creation
 * Each module is a pure function that processes audio samples
 */

export const DSPModules = {

  /**
   * FILTER MODULE
   * Biquad filter with multiple types
   */
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

          switch(type) {
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

            case 'bandpass':
              b0 = alpha;
              b1 = 0;
              b2 = -alpha;
              a0 = 1 + alpha;
              a1 = -2 * cosw0;
              a2 = 1 - alpha;
              break;

            case 'notch':
              b0 = 1;
              b1 = -2 * cosw0;
              b2 = 1;
              a0 = 1 + alpha;
              a1 = -2 * cosw0;
              a2 = 1 - alpha;
              break;

            default: // bypass
              b0 = 1; b1 = 0; b2 = 0;
              a0 = 1; a1 = 0; a2 = 0;
          }

          this.coeffs.b0 = b0 / a0;
          this.coeffs.b1 = b1 / a0;
          this.coeffs.b2 = b2 / a0;
          this.coeffs.a1 = a1 / a0;
          this.coeffs.a2 = a2 / a0;
        },

        process(sample) {
          const { b0, b1, b2, a1, a2 } = this.coeffs;
          const { state } = this;

          const y = b0 * sample + b1 * state.x1 + b2 * state.x2
                    - a1 * state.y1 - a2 * state.y2;

          state.x2 = state.x1;
          state.x1 = sample;
          state.y2 = state.y1;
          state.y1 = y;

          return y;
        }
      };
    }
  },

  /**
   * SATURATOR MODULE
   * Waveshaping distortion
   */
  saturator: {
    create() {
      return {
        process(sample, drive = 1.0) {
          const driven = sample * drive;

          // Soft clipping
          if (Math.abs(driven) < 0.33) {
            return driven;
          } else if (Math.abs(driven) < 0.66) {
            const sign = Math.sign(driven);
            return sign * (1 - Math.pow(2 - 3 * Math.abs(driven), 2) / 3);
          } else {
            return Math.sign(driven) * 0.9;
          }
        }
      };
    }
  },

  /**
   * DELAY MODULE
   * Delay line with feedback
   */
  delay: {
    create(maxDelaySeconds, sampleRate) {
      const bufferSize = Math.ceil(maxDelaySeconds * sampleRate);
      return {
        buffer: new Float32Array(bufferSize),
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

  /**
   * LFO MODULE
   * Low Frequency Oscillator
   */
  lfo: {
    create(sampleRate) {
      return {
        phase: 0,

        process(rate, shape = 'sine') {
          const increment = (rate / sampleRate) * 2 * Math.PI;
          this.phase += increment;
          if (this.phase > 2 * Math.PI) this.phase -= 2 * Math.PI;

          switch(shape) {
            case 'sine':
              return Math.sin(this.phase);
            case 'triangle':
              return (2 / Math.PI) * Math.asin(Math.sin(this.phase));
            case 'square':
              return this.phase < Math.PI ? 1 : -1;
            case 'saw':
              return (this.phase / Math.PI) - 1;
            default:
              return Math.sin(this.phase);
          }
        }
      };
    }
  },

  /**
   * GAIN MODULE
   * Simple amplifier
   */
  gain: {
    create() {
      return {
        process(sample, gainAmount = 1.0) {
          return sample * gainAmount;
        }
      };
    }
  },

  /**
   * COMPRESSOR MODULE
   * Dynamic range compression
   */
  compressor: {
    create(sampleRate) {
      return {
        envelope: 0,

        gainToDb(gain) {
          return 20 * Math.log10(Math.max(gain, 0.00001));
        },

        dbToGain(db) {
          return Math.pow(10, db / 20);
        },

        process(sample, threshold = -24, ratio = 4, attack = 0.003, release = 0.25) {
          const inputLevel = this.gainToDb(Math.abs(sample));

          const attackCoeff = Math.exp(-1 / (attack * sampleRate));
          const releaseCoeff = Math.exp(-1 / (release * sampleRate));

          if (inputLevel > this.envelope) {
            this.envelope = attackCoeff * this.envelope + (1 - attackCoeff) * inputLevel;
          } else {
            this.envelope = releaseCoeff * this.envelope + (1 - releaseCoeff) * inputLevel;
          }

          let gainReduction = 0;
          if (this.envelope > threshold) {
            gainReduction = (threshold - this.envelope) * (1 - 1/ratio);
          }

          return sample * this.dbToGain(gainReduction);
        }
      };
    }
  },

  /**
   * WAVESHAPER MODULE
   * Custom transfer function
   */
  waveshaper: {
    create() {
      return {
        process(sample, amount = 0.5, curve = 'soft') {
          const x = sample * (1 + amount * 9);

          switch(curve) {
            case 'soft':
              return Math.tanh(x);
            case 'hard':
              return Math.max(-1, Math.min(1, x));
            case 'tube':
              if (Math.abs(x) < 0.5) return x;
              return Math.sign(x) * (0.5 + 0.5 * Math.tanh((Math.abs(x) - 0.5) * 2));
            default:
              return Math.tanh(x);
          }
        }
      };
    }
  },

  /**
   * REVERB MODULE (Simple Schroeder)
   */
  reverb: {
    create(sampleRate) {
      const combDelays = [1557, 1617, 1491, 1422];
      return {
        combFilters: combDelays.map(delay => ({
          buffer: new Float32Array(delay),
          index: 0
        })),
        dampingState: 0,

        process(sample, decay = 0.5) {
          let output = 0;
          const feedback = Math.min(0.95, decay / 10);

          this.combFilters.forEach(comb => {
            const delayed = comb.buffer[comb.index];
            this.dampingState = 0.2 * this.dampingState + 0.8 * delayed;
            comb.buffer[comb.index] = sample + this.dampingState * feedback;
            comb.index = (comb.index + 1) % comb.buffer.length;
            output += delayed;
          });

          return output / this.combFilters.length;
        }
      };
    }
  },

  /**
   * PAN MODULE
   * Stereo panning
   */
  pan: {
    create() {
      return {
        process(sample, panPosition = 0, channel = 0) {
          // panPosition: -1 (left) to 1 (right)
          const panAngle = (panPosition + 1) * Math.PI / 4;
          const leftGain = Math.cos(panAngle);
          const rightGain = Math.sin(panAngle);

          return channel === 0 ? sample * leftGain : sample * rightGain;
        }
      };
    }
  },

  /**
   * BITCRUSHER MODULE
   * Sample rate and bit depth reduction
   */
  bitcrusher: {
    create() {
      return {
        phaseAccum: 0,
        holdSample: 0,

        process(sample, bitDepth = 8, sampleRateReduction = 1) {
          // Sample rate reduction
          this.phaseAccum++;
          if (this.phaseAccum >= sampleRateReduction) {
            this.holdSample = sample;
            this.phaseAccum = 0;
          }

          // Bit depth reduction
          const levels = Math.pow(2, bitDepth);
          const step = 2 / levels;
          return Math.floor(this.holdSample / step) * step;
        }
      };
    }
  }
};
