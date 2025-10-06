/**
 * DELAY EFFECT
 *
 * Stereo delay with ping-pong, feedback, and filtering.
 * Essential for creating space and rhythm in productions.
 */

import { BaseEffect } from './BaseEffect.js';

export class DelayEffect extends BaseEffect {
  constructor(context) {
    super(context, 'delay', 'Delay');

    // Parameters
    this.parameters = {
      time: {
        value: 0.25,
        min: 0.001,
        max: 2.0,
        default: 0.25,
        label: 'Time',
        unit: 's'
      },
      feedback: {
        value: 0.3,
        min: 0.0,
        max: 0.95,
        default: 0.3,
        label: 'Feedback',
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
      pingPong: {
        value: 0.0,
        min: 0.0,
        max: 1.0,
        default: 0.0,
        label: 'Ping-Pong',
        unit: '%'
      },
      filterFreq: {
        value: 8000,
        min: 200,
        max: 20000,
        default: 8000,
        label: 'Filter Freq',
        unit: 'Hz'
      },
      sync: {
        value: false,
        default: false,
        label: 'Sync to BPM'
      },
      noteValue: {
        value: '1/4',
        options: ['1/32', '1/16', '1/8', '1/4', '1/2', '1/1'],
        default: '1/4',
        label: 'Note Value'
      }
    };

    // Create audio nodes
    this.inputNode = context.createGain();
    this.outputNode = context.createGain();

    // Delay lines (stereo)
    this.delayLeft = context.createDelay(2.0);
    this.delayRight = context.createDelay(2.0);

    // Feedback nodes
    this.feedbackLeft = context.createGain();
    this.feedbackRight = context.createGain();

    // Lowpass filter for feedback (darkens repeats)
    this.filterLeft = context.createBiquadFilter();
    this.filterRight = context.createBiquadFilter();
    this.filterLeft.type = 'lowpass';
    this.filterRight.type = 'lowpass';

    // Dry/wet mix
    this.dryGain = context.createGain();
    this.wetGain = context.createGain();

    // Pan nodes for ping-pong
    this.panLeft = context.createStereoPanner();
    this.panRight = context.createStereoPanner();
    this.panLeft.pan.value = -1;
    this.panRight.pan.value = 1;

    this._setupRouting();
    this._updateParameters();
  }

  _setupRouting() {
    // Dry path
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);

    // Wet path - left channel
    this.inputNode.connect(this.delayLeft);
    this.delayLeft.connect(this.filterLeft);
    this.filterLeft.connect(this.feedbackLeft);
    this.feedbackLeft.connect(this.delayLeft); // Feedback loop
    this.feedbackLeft.connect(this.panLeft);
    this.panLeft.connect(this.wetGain);

    // Wet path - right channel
    this.inputNode.connect(this.delayRight);
    this.delayRight.connect(this.filterRight);
    this.filterRight.connect(this.feedbackRight);
    this.feedbackRight.connect(this.delayRight); // Feedback loop
    this.feedbackRight.connect(this.panRight);
    this.panRight.connect(this.wetGain);

    // Ping-pong cross-feedback
    this.feedbackLeft.connect(this.delayRight);
    this.feedbackRight.connect(this.delayLeft);

    // Output
    this.wetGain.connect(this.outputNode);
  }

  _updateParameters() {
    const time = this.getParameter('time');
    const feedback = this.getParameter('feedback');
    const mix = this.getParameter('mix');
    const pingPong = this.getParameter('pingPong');
    const filterFreq = this.getParameter('filterFreq');

    // Delay time
    this.delayLeft.delayTime.value = time;
    this.delayRight.delayTime.value = time;

    // Feedback (with ping-pong cross-feedback)
    const straightFeedback = feedback * (1 - pingPong);
    const crossFeedback = feedback * pingPong;

    this.feedbackLeft.gain.value = straightFeedback;
    this.feedbackRight.gain.value = straightFeedback;

    // Ping-pong is achieved by cross-feeding (already connected)
    // Adjust pan for stronger ping-pong effect
    this.panLeft.pan.value = -pingPong;
    this.panRight.pan.value = pingPong;

    // Filter
    this.filterLeft.frequency.value = filterFreq;
    this.filterRight.frequency.value = filterFreq;

    // Mix
    this.dryGain.gain.value = 1 - mix;
    this.wetGain.gain.value = mix;
  }

  /**
   * Convert note value to seconds based on BPM
   */
  _noteValueToSeconds(noteValue, bpm = 140) {
    const beatDuration = 60 / bpm; // One quarter note
    const noteValues = {
      '1/32': beatDuration / 8,
      '1/16': beatDuration / 4,
      '1/8': beatDuration / 2,
      '1/4': beatDuration,
      '1/2': beatDuration * 2,
      '1/1': beatDuration * 4
    };
    return noteValues[noteValue] || beatDuration;
  }

  /**
   * Set BPM for sync mode
   */
  setBPM(bpm) {
    if (this.getParameter('sync')) {
      const noteValue = this.getParameter('noteValue');
      const time = this._noteValueToSeconds(noteValue, bpm);
      this.setParameter('time', time);
    }
  }

  onParameterChange(name, value) {
    this._updateParameters();
  }

  /**
   * Process audio (for worklet-based processing)
   */
  process(inputSamples, outputSamples, sampleRate) {
    const time = this.getParameter('time');
    const feedback = this.getParameter('feedback');
    const mix = this.getParameter('mix');
    const filterFreq = this.getParameter('filterFreq');

    // Simple delay buffer (mono for worklet implementation)
    if (!this.delayBuffer) {
      this.delayBuffer = new Float32Array(sampleRate * 2); // 2 seconds max
      this.writeIndex = 0;
    }

    const delaySamples = Math.floor(time * sampleRate);

    for (let i = 0; i < inputSamples.length; i++) {
      const input = inputSamples[i];

      // Read from delay buffer
      const readIndex = (this.writeIndex - delaySamples + this.delayBuffer.length) % this.delayBuffer.length;
      const delayed = this.delayBuffer[Math.floor(readIndex)];

      // Simple lowpass filter (one-pole)
      if (!this.filterState) this.filterState = 0;
      const filterCoeff = Math.exp(-2 * Math.PI * filterFreq / sampleRate);
      this.filterState = delayed + filterCoeff * (this.filterState - delayed);
      const filtered = this.filterState;

      // Write to delay buffer with feedback
      this.delayBuffer[this.writeIndex] = input + filtered * feedback;
      this.writeIndex = (this.writeIndex + 1) % this.delayBuffer.length;

      // Mix dry and wet
      outputSamples[i] = input * (1 - mix) + delayed * mix;
    }
  }

  /**
   * Preset: Short Slap Delay
   */
  static presetSlapback() {
    return {
      time: 0.08,
      feedback: 0.15,
      mix: 0.25,
      pingPong: 0.0,
      filterFreq: 12000,
      sync: false
    };
  }

  /**
   * Preset: Rhythmic Delay (1/8 note)
   */
  static presetRhythmic() {
    return {
      time: 0.214, // ~140 BPM 1/8 note
      feedback: 0.5,
      mix: 0.4,
      pingPong: 0.7,
      filterFreq: 6000,
      sync: true,
      noteValue: '1/8'
    };
  }

  /**
   * Preset: Huge Janito Drop style
   */
  static presetJanitoDrop() {
    return {
      time: 0.107, // ~140 BPM 1/16 note
      feedback: 0.7,
      mix: 0.6,
      pingPong: 0.9,
      filterFreq: 4000,
      sync: true,
      noteValue: '1/16'
    };
  }
}
