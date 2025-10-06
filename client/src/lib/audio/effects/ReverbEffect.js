/**
 * REVERB EFFECT (Simple Convolution-based)
 *
 * Uses Web Audio API's ConvolverNode with impulse response generation.
 * Provides room/hall simulation for depth and space.
 */

import { BaseEffect } from './BaseEffect.js';

export class ReverbEffect extends BaseEffect {
  constructor(context) {
    super(context, 'reverb', 'Reverb');

    // Parameters
    this.parameters = {
      roomSize: {
        value: 0.5,
        min: 0.0,
        max: 1.0,
        default: 0.5,
        label: 'Room Size',
        unit: '%'
      },
      damping: {
        value: 0.5,
        min: 0.0,
        max: 1.0,
        default: 0.5,
        label: 'Damping',
        unit: '%'
      },
      mix: {
        value: 0.3,
        min: 0.0,
        max: 1.0,
        default: 0.3,
        label: 'Mix',
        unit: '%'
      },
      preDelay: {
        value: 0.0,
        min: 0.0,
        max: 0.1,
        default: 0.0,
        label: 'Pre-Delay',
        unit: 's'
      }
    };

    // Create audio nodes
    this.inputNode = context.createGain();
    this.outputNode = context.createGain();

    this.convolverNode = context.createConvolver();
    this.dryGain = context.createGain();
    this.wetGain = context.createGain();
    this.preDelayNode = context.createDelay(0.1);

    // Damping filter
    this.dampingFilter = context.createBiquadFilter();
    this.dampingFilter.type = 'lowpass';
    this.dampingFilter.frequency.value = 8000;

    this._setupRouting();
    this._generateImpulseResponse();
  }

  _setupRouting() {
    // Dry path
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);

    // Wet path
    this.inputNode.connect(this.preDelayNode);
    this.preDelayNode.connect(this.convolverNode);
    this.convolverNode.connect(this.dampingFilter);
    this.dampingFilter.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  /**
   * Generate impulse response based on room size and damping
   */
  _generateImpulseResponse() {
    const roomSize = this.getParameter('roomSize');
    const damping = this.getParameter('damping');
    const sampleRate = this.context.sampleRate;

    // Duration based on room size (0.5s to 4s)
    const duration = 0.5 + roomSize * 3.5;
    const length = sampleRate * duration;

    // Create stereo impulse response
    const impulse = this.context.createBuffer(2, length, sampleRate);
    const leftChannel = impulse.getChannelData(0);
    const rightChannel = impulse.getChannelData(1);

    // Generate impulse using exponential decay with random noise
    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-3 * i / length);

      // Add damping (frequency-dependent decay)
      const dampingFactor = 1 - damping * 0.5;
      const dampedDecay = decay * Math.pow(dampingFactor, i / sampleRate);

      // Random noise for diffusion
      const noise = (Math.random() * 2 - 1);

      // Stereo separation
      leftChannel[i] = noise * dampedDecay;
      rightChannel[i] = noise * dampedDecay * 0.9; // Slight difference for stereo width
    }

    this.convolverNode.buffer = impulse;
  }

  _updateParameters() {
    const mix = this.getParameter('mix');
    const preDelay = this.getParameter('preDelay');
    const damping = this.getParameter('damping');

    // Mix
    this.dryGain.gain.value = 1 - mix;
    this.wetGain.gain.value = mix * 0.5; // Reduce wet level to prevent clipping

    // Pre-delay
    this.preDelayNode.delayTime.value = preDelay;

    // Damping filter frequency
    const filterFreq = 2000 + (1 - damping) * 18000; // 2kHz - 20kHz
    this.dampingFilter.frequency.value = filterFreq;
  }

  onParameterChange(name, value) {
    if (name === 'roomSize' || name === 'damping') {
      this._generateImpulseResponse();
    }
    this._updateParameters();
  }

  /**
   * Process audio (for worklet - simplified version)
   * Note: Full reverb requires convolution which is complex in worklet
   * This is a simple feedback-based reverb for worklet mode
   */
  process(inputSamples, outputSamples, sampleRate) {
    const roomSize = this.getParameter('roomSize');
    const damping = this.getParameter('damping');
    const mix = this.getParameter('mix');

    // Initialize reverb buffers if needed
    if (!this.reverbBuffers) {
      // Multiple comb filters for room simulation
      const combTimes = [0.025, 0.027, 0.029, 0.031, 0.033, 0.035, 0.037, 0.039];
      this.reverbBuffers = combTimes.map(time => {
        const size = Math.floor(time * sampleRate * (0.5 + roomSize * 1.5));
        return {
          buffer: new Float32Array(size),
          index: 0,
          size: size
        };
      });
      this.allpassBuffers = [
        { buffer: new Float32Array(Math.floor(0.0051 * sampleRate)), index: 0 },
        { buffer: new Float32Array(Math.floor(0.0037 * sampleRate)), index: 0 }
      ];
    }

    const feedback = 0.5 + roomSize * 0.45; // 0.5 to 0.95
    const dampingCoeff = 1 - damping * 0.5;

    for (let i = 0; i < inputSamples.length; i++) {
      const input = inputSamples[i];
      let reverbSum = 0;

      // Process comb filters
      this.reverbBuffers.forEach(comb => {
        const delayed = comb.buffer[comb.index];
        comb.buffer[comb.index] = input + delayed * feedback * dampingCoeff;
        comb.index = (comb.index + 1) % comb.size;
        reverbSum += delayed;
      });

      // Average comb filter outputs
      let reverbSignal = reverbSum / this.reverbBuffers.length;

      // Process allpass filters (adds diffusion)
      this.allpassBuffers.forEach(allpass => {
        const delayed = allpass.buffer[allpass.index];
        allpass.buffer[allpass.index] = reverbSignal + delayed * 0.5;
        reverbSignal = delayed - reverbSignal * 0.5;
        allpass.index = (allpass.index + 1) % allpass.buffer.length;
      });

      // Mix dry and wet
      outputSamples[i] = input * (1 - mix) + reverbSignal * mix * 0.5;
    }
  }

  /**
   * Preset: Small Room
   */
  static presetSmallRoom() {
    return {
      roomSize: 0.3,
      damping: 0.4,
      mix: 0.25,
      preDelay: 0.01
    };
  }

  /**
   * Preset: Large Hall
   */
  static presetLargeHall() {
    return {
      roomSize: 0.85,
      damping: 0.6,
      mix: 0.4,
      preDelay: 0.03
    };
  }

  /**
   * Preset: Vocal Reverb
   */
  static presetVocal() {
    return {
      roomSize: 0.5,
      damping: 0.7,
      mix: 0.3,
      preDelay: 0.02
    };
  }
}
