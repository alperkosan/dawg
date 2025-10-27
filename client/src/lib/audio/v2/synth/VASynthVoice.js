/**
 * VASynthVoice.js
 *
 * Virtual Analog Synthesizer Voice with Unison support
 *
 * Features:
 * - 3 oscillators with unison mode
 * - Multi-mode filter
 * - ADSR+ envelopes
 * - Portamento/glide
 */

import { ADSRPlusEnvelope } from './ADSRPlusEnvelope.js';

/**
 * Unison voice - Single oscillator in unison stack
 */
class UnisonVoice {
  constructor(audioContext, waveform, detuneCents, panValue) {
    this.audioContext = audioContext;

    // Oscillator
    this.oscillator = audioContext.createOscillator();
    this.oscillator.type = waveform;
    this.oscillator.detune.value = detuneCents;

    // Gain
    this.gain = audioContext.createGain();

    // Panner (stereo spread)
    this.panner = audioContext.createStereoPanner();
    this.panner.pan.value = panValue;

    // Connect: Osc → Gain → Panner
    this.oscillator.connect(this.gain);
    this.gain.connect(this.panner);

    // Output
    this.output = this.panner;

    // State
    this.isStarted = false;
  }

  /**
   * Start oscillator
   */
  start(time) {
    if (!this.isStarted) {
      this.oscillator.start(time);
      this.isStarted = true;
    }
  }

  /**
   * Stop oscillator
   */
  stop(time) {
    if (this.isStarted) {
      this.oscillator.stop(time);
      this.isStarted = false;
    }
  }

  /**
   * Set frequency
   */
  setFrequency(freq, time) {
    if (time) {
      this.oscillator.frequency.setValueAtTime(freq, time);
    } else {
      this.oscillator.frequency.value = freq;
    }
  }

  /**
   * Dispose
   */
  dispose() {
    if (this.isStarted) {
      this.oscillator.stop();
    }
    this.oscillator.disconnect();
    this.gain.disconnect();
    this.panner.disconnect();
  }
}

/**
 * Oscillator with unison support
 */
class UnisonOscillator {
  constructor(audioContext, config) {
    this.audioContext = audioContext;
    this.config = config;

    // Unison voices
    this.unisonVoices = [];

    // Output gain
    this.output = audioContext.createGain();

    // Frequency (master control)
    this.baseFrequency = 440;

    // Create unison voices
    this._createUnisonVoices();
  }

  /**
   * Create unison voices
   */
  _createUnisonVoices() {
    const {
      waveform = 'sawtooth',
      level = 1.0,
      detune = 0,
      octave = 0,
      unison = { enabled: false, voices: 1, detune: 0, pan: 0 },
    } = this.config;

    // Dispose existing voices
    for (const voice of this.unisonVoices) {
      voice.dispose();
    }
    this.unisonVoices = [];

    // Calculate voice count
    const voiceCount = unison.enabled ? unison.voices : 1;

    // Base detune (oscillator detune)
    const baseDetune = detune + (octave * 1200);

    // Unison detune spread
    const unisonDetuneSpread = unison.enabled ? unison.detune : 0;
    const unisonPanSpread = unison.enabled ? (unison.pan / 100) : 0;

    // Create voices
    for (let i = 0; i < voiceCount; i++) {
      // Calculate detune for this voice
      let voiceDetune = baseDetune;

      if (voiceCount > 1) {
        // Spread voices around center
        const offset = (i / (voiceCount - 1)) - 0.5; // -0.5 to +0.5
        voiceDetune += offset * unisonDetuneSpread * 2;
      }

      // Calculate pan for this voice
      let voicePan = 0;

      if (voiceCount > 1) {
        const offset = (i / (voiceCount - 1)) - 0.5; // -0.5 to +0.5
        voicePan = offset * unisonPanSpread * 2;
      }

      // Create unison voice
      const voice = new UnisonVoice(this.audioContext, waveform, voiceDetune, voicePan);

      // Set gain (distribute level across voices)
      voice.gain.gain.value = level / Math.sqrt(voiceCount);

      // Connect to output
      voice.output.connect(this.output);

      this.unisonVoices.push(voice);
    }
  }

  /**
   * Start all unison voices
   */
  start(time) {
    for (const voice of this.unisonVoices) {
      voice.start(time);
    }
  }

  /**
   * Stop all unison voices
   */
  stop(time) {
    for (const voice of this.unisonVoices) {
      voice.stop(time);
    }
  }

  /**
   * Set frequency for all voices
   */
  setFrequency(freq, time) {
    this.baseFrequency = freq;

    for (const voice of this.unisonVoices) {
      voice.setFrequency(freq, time);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };

    // If unison settings changed, recreate voices
    if (config.unison || config.waveform || config.detune || config.octave) {
      this._createUnisonVoices();
    }

    // Update level
    if (config.level !== undefined) {
      const voiceCount = this.unisonVoices.length;
      for (const voice of this.unisonVoices) {
        voice.gain.gain.value = config.level / Math.sqrt(voiceCount);
      }
    }
  }

  /**
   * Dispose
   */
  dispose() {
    for (const voice of this.unisonVoices) {
      voice.dispose();
    }
    this.unisonVoices = [];
    this.output.disconnect();
  }
}

/**
 * VASynthVoice - Complete voice with oscillators, filter, envelopes
 */
export class VASynthVoice {
  constructor(audioContext, voiceIndex = 0) {
    this.audioContext = audioContext;
    this.voiceIndex = voiceIndex;

    // Audio nodes
    this.oscillators = [];
    this.oscMixer = audioContext.createGain();
    this.filter = audioContext.createBiquadFilter();
    this.filterEnvGain = audioContext.createGain();
    this.amplitudeGain = audioContext.createGain();
    this.output = audioContext.createGain();

    // Envelopes
    this.filterEnvelope = new ADSRPlusEnvelope(audioContext);
    this.amplitudeEnvelope = new ADSRPlusEnvelope(audioContext);

    // Voice state
    this.isPlaying = false;
    this.currentNote = -1;
    this.currentVelocity = 0;

    // Portamento
    this.portamentoTime = 0;
    this.targetFrequency = 0;

    // Configuration
    this.config = {
      oscillators: [],
      filter: {},
      filterEnvelope: {},
      amplitudeEnvelope: {},
    };

    // Initialize audio graph
    this._initAudioGraph();
  }

  /**
   * Initialize audio graph
   */
  _initAudioGraph() {
    // Filter setup
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 8000;
    this.filter.Q.value = 1;

    // Filter envelope modulation
    this.filterEnvGain.gain.value = 0; // Envelope amount

    // Connect: OscMixer → Filter → AmpGain → Output
    this.oscMixer.connect(this.filter);
    this.filter.connect(this.amplitudeGain);
    this.amplitudeGain.connect(this.output);

    // Filter envelope modulation (not directly connected, controlled via code)
    // We'll modulate filter.frequency based on filterEnvGain.gain value
  }

  /**
   * Initialize oscillators from config
   */
  initOscillators(oscillatorConfigs) {
    // Dispose existing oscillators
    for (const osc of this.oscillators) {
      osc.dispose();
    }
    this.oscillators = [];

    // Create oscillators
    for (const config of oscillatorConfigs) {
      if (config.enabled) {
        const osc = new UnisonOscillator(this.audioContext, config);
        osc.output.connect(this.oscMixer);
        this.oscillators.push(osc);
      }
    }

    this.config.oscillators = oscillatorConfigs;
  }

  /**
   * Note on
   */
  noteOn(note, velocity = 100, time = null) {
    const startTime = time || this.audioContext.currentTime;
    const normalizedVelocity = velocity / 127;

    this.currentNote = note;
    this.currentVelocity = normalizedVelocity;
    this.isPlaying = true;

    // Calculate frequency
    const frequency = this._midiNoteToFrequency(note);
    this.targetFrequency = frequency;

    // Start oscillators
    for (const osc of this.oscillators) {
      // Apply portamento if enabled
      if (this.portamentoTime > 0 && osc.baseFrequency > 0) {
        osc.setFrequency(osc.baseFrequency, startTime);
        osc.unisonVoices.forEach((voice) => {
          voice.oscillator.frequency.linearRampToValueAtTime(
            frequency,
            startTime + this.portamentoTime
          );
        });
      } else {
        osc.setFrequency(frequency, startTime);
      }

      // Start oscillators if not already started
      osc.start(startTime);
    }

    // Trigger filter envelope
    this.filterEnvelope.trigger(this.filterEnvGain.gain, normalizedVelocity, startTime);

    // Trigger amplitude envelope
    this.amplitudeEnvelope.trigger(this.amplitudeGain.gain, normalizedVelocity, startTime);

    // Apply filter envelope modulation
    this._modulateFilterCutoff(startTime);
  }

  /**
   * Note off (release)
   */
  release(time = null) {
    const releaseTime = time || this.audioContext.currentTime;

    // Release envelopes
    this.filterEnvelope.release(this.filterEnvGain.gain, releaseTime);
    this.amplitudeEnvelope.release(this.amplitudeGain.gain, releaseTime);

    // Schedule stop after release
    const stopTime = releaseTime + this.amplitudeEnvelope.getReleaseTime() + 0.1;

    setTimeout(() => {
      this.stop();
    }, (stopTime - this.audioContext.currentTime) * 1000);
  }

  /**
   * Stop voice immediately
   */
  stop(time = null) {
    const stopTime = time || this.audioContext.currentTime;

    for (const osc of this.oscillators) {
      osc.stop(stopTime);
    }

    this.isPlaying = false;
    this.currentNote = -1;
  }

  /**
   * Set pitch (for legato mode)
   */
  setPitch(note, time = null) {
    const pitchTime = time || this.audioContext.currentTime;
    const frequency = this._midiNoteToFrequency(note);

    this.currentNote = note;
    this.targetFrequency = frequency;

    for (const osc of this.oscillators) {
      if (this.portamentoTime > 0) {
        osc.unisonVoices.forEach((voice) => {
          voice.oscillator.frequency.linearRampToValueAtTime(
            frequency,
            pitchTime + this.portamentoTime
          );
        });
      } else {
        osc.setFrequency(frequency, pitchTime);
      }
    }
  }

  /**
   * Update parameters
   */
  updateParameters(params) {
    // Update oscillators
    if (params.oscillatorSettings) {
      for (let i = 0; i < params.oscillatorSettings.length; i++) {
        if (this.oscillators[i]) {
          this.oscillators[i].updateConfig(params.oscillatorSettings[i]);
        }
      }
    }

    // Update filter
    if (params.filterSettings) {
      const { type, cutoff, resonance, envelopeAmount, drive } = params.filterSettings;

      if (type) this.filter.type = type;
      if (cutoff !== undefined) this.filter.frequency.value = cutoff;
      if (resonance !== undefined) this.filter.Q.value = resonance;
      if (envelopeAmount !== undefined) this.filterEnvGain.gain.value = envelopeAmount;

      this.config.filter = params.filterSettings;
    }

    // Update envelopes
    if (params.filterEnvelope) {
      this.filterEnvelope.setParameters(params.filterEnvelope);
      this.config.filterEnvelope = params.filterEnvelope;
    }

    if (params.amplitudeEnvelope) {
      this.amplitudeEnvelope.setParameters(params.amplitudeEnvelope);
      this.config.amplitudeEnvelope = params.amplitudeEnvelope;
    }

    // Update portamento
    if (params.portamentoTime !== undefined) {
      this.portamentoTime = params.portamentoTime;
    }
  }

  /**
   * Modulate filter cutoff with envelope
   */
  _modulateFilterCutoff(time) {
    // This is a simplified version - proper implementation would use
    // a constant source node + envelope modulation
    // For now, we rely on the filter envelope being applied during note on
  }

  /**
   * MIDI note to frequency
   */
  _midiNoteToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  /**
   * Get current amplitude (for voice stealing)
   */
  getAmplitude() {
    return this.amplitudeGain.gain.value;
  }

  /**
   * Connect to destination
   */
  connect(destination) {
    this.output.connect(destination);
  }

  /**
   * Disconnect
   */
  disconnect() {
    this.output.disconnect();
  }

  /**
   * Dispose voice
   */
  dispose() {
    this.stop();

    for (const osc of this.oscillators) {
      osc.dispose();
    }

    this.oscMixer.disconnect();
    this.filter.disconnect();
    this.filterEnvGain.disconnect();
    this.amplitudeGain.disconnect();
    this.output.disconnect();
  }
}

export default VASynthVoice;
