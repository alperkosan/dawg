/**
 * ChorusEffect.js
 *
 * Stereo chorus effect with modulated delay.
 * Creates rich, thick sound by layering multiple detuned copies.
 *
 * Features:
 * - Multiple voices (1-4)
 * - LFO modulation
 * - Stereo spread
 */

import { Effect } from './Effect.js';

/**
 * ChorusEffect class
 */
export class ChorusEffect extends Effect {
  constructor(audioContext) {
    super(audioContext, 'chorus');

    // Parameters
    this.rate = 0.5;      // LFO rate (Hz)
    this.depth = 0.002;   // LFO depth (seconds)
    this.delay = 0.02;    // Base delay time (seconds)
    this.voices = 2;      // Number of chorus voices (1-4)

    // Audio nodes
    this.chorusVoices = [];

    // Initialize
    this._initialize();
  }

  /**
   * Initialize effect chain
   */
  _initialize() {
    // Create chorus voices
    this._createChorusVoices();

    // Effect chain is managed by voices
    this.effectChain = null;

    // Connect chain (custom connection for chorus)
    this._connectChorusChain();
  }

  /**
   * Create chorus voices
   */
  _createChorusVoices() {
    // Clear existing voices
    this._destroyChorusVoices();

    // Create new voices
    for (let i = 0; i < this.voices; i++) {
      const voice = this._createChorusVoice(i);
      this.chorusVoices.push(voice);
    }
  }

  /**
   * Create single chorus voice
   */
  _createChorusVoice(index) {
    const voice = {
      delay: this.audioContext.createDelay(0.1),
      lfo: this.audioContext.createOscillator(),
      lfoGain: this.audioContext.createGain(),
      panner: this.audioContext.createStereoPanner(),
      gain: this.audioContext.createGain(),
    };

    // Base delay
    voice.delay.delayTime.value = this.delay;

    // LFO settings
    voice.lfo.type = 'sine';
    voice.lfo.frequency.value = this.rate;

    // LFO depth (varies per voice for richer sound)
    const depthVariation = 1 + (index * 0.1);
    voice.lfoGain.gain.value = this.depth * depthVariation;

    // Panning (spread voices across stereo field)
    if (this.voices > 1) {
      const panPosition = (index / (this.voices - 1)) * 2 - 1; // -1 to +1
      voice.panner.pan.value = panPosition;
    } else {
      voice.panner.pan.value = 0;
    }

    // Gain (distribute volume across voices)
    voice.gain.gain.value = 1 / Math.sqrt(this.voices);

    // Connect voice: LFO → LFO Gain → Delay Time
    voice.lfo.connect(voice.lfoGain);
    voice.lfoGain.connect(voice.delay.delayTime);

    // Start LFO with phase offset
    const phaseOffset = (index / this.voices) * (1 / this.rate);
    voice.lfo.start(this.audioContext.currentTime + phaseOffset);

    return voice;
  }

  /**
   * Connect chorus chain
   */
  _connectChorusChain() {
    // Each voice processes the input signal
    for (const voice of this.chorusVoices) {
      // Input → Delay → Panner → Gain → Wet
      this.input.connect(voice.delay);
      voice.delay.connect(voice.panner);
      voice.panner.connect(voice.gain);
      voice.gain.connect(this.wetGain);
    }

    // Dry signal
    this.input.connect(this.dryGain);

    // Mix to output
    this.wetGain.connect(this.output);
    this.dryGain.connect(this.output);
  }

  /**
   * Destroy chorus voices
   */
  _destroyChorusVoices() {
    for (const voice of this.chorusVoices) {
      if (voice.lfo) {
        voice.lfo.stop();
        voice.lfo.disconnect();
      }
      if (voice.lfoGain) voice.lfoGain.disconnect();
      if (voice.delay) voice.delay.disconnect();
      if (voice.panner) voice.panner.disconnect();
      if (voice.gain) voice.gain.disconnect();
    }

    this.chorusVoices = [];
  }

  /**
   * Set rate (LFO frequency)
   */
  setRate(rate) {
    this.rate = Math.max(0.1, Math.min(10, rate));

    for (const voice of this.chorusVoices) {
      voice.lfo.frequency.setValueAtTime(this.rate, this.audioContext.currentTime);
    }
  }

  /**
   * Set depth (LFO modulation depth)
   */
  setDepth(depth) {
    this.depth = Math.max(0, Math.min(0.01, depth));

    for (let i = 0; i < this.chorusVoices.length; i++) {
      const voice = this.chorusVoices[i];
      const depthVariation = 1 + (i * 0.1);
      voice.lfoGain.gain.setValueAtTime(
        this.depth * depthVariation,
        this.audioContext.currentTime
      );
    }
  }

  /**
   * Set base delay
   */
  setDelay(delay) {
    this.delay = Math.max(0.01, Math.min(0.05, delay));

    for (const voice of this.chorusVoices) {
      voice.delay.delayTime.setValueAtTime(this.delay, this.audioContext.currentTime);
    }
  }

  /**
   * Set number of voices
   */
  setVoices(voices) {
    this.voices = Math.max(1, Math.min(4, Math.round(voices)));

    // Recreate voices
    this._createChorusVoices();
    this._connectChorusChain();
  }

  /**
   * Set parameter
   */
  setParameter(paramName, value) {
    switch (paramName) {
      case 'rate':
        this.setRate(value);
        break;
      case 'depth':
        this.setDepth(value);
        break;
      case 'delay':
        this.setDelay(value);
        break;
      case 'voices':
        this.setVoices(value);
        break;
      default:
        super.setParameter(paramName, value);
    }
  }

  /**
   * Get parameter
   */
  getParameter(paramName) {
    switch (paramName) {
      case 'rate':
        return this.rate;
      case 'depth':
        return this.depth;
      case 'delay':
        return this.delay;
      case 'voices':
        return this.voices;
      default:
        return super.getParameter(paramName);
    }
  }

  /**
   * Get all parameters
   */
  getParameters() {
    return {
      ...super.getParameters(),
      rate: this.rate,
      depth: this.depth,
      delay: this.delay,
      voices: this.voices,
    };
  }

  /**
   * Dispose
   */
  dispose() {
    this._destroyChorusVoices();
    super.dispose();
  }
}

export default ChorusEffect;
