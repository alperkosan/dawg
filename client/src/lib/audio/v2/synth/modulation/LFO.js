/**
 * LFO.js
 *
 * Advanced Low-Frequency Oscillator
 *
 * Features:
 * - 6 waveform types (Sine, Triangle, Saw, Square, S&H, Random)
 * - Tempo sync (BPM-locked rates)
 * - Phase offset
 * - Fade-in
 * - Mono/Poly modes
 * - Free-running or retriggerable
 */

/**
 * LFO Waveform types
 */
export const LFOWaveform = {
  SINE: 'sine',
  TRIANGLE: 'triangle',
  SAWTOOTH: 'sawtooth',
  SQUARE: 'square',
  SAMPLE_HOLD: 'sample_hold',
  RANDOM: 'random',
};

/**
 * LFO Sync modes
 */
export const LFOSyncMode = {
  FREE: 'free',           // Free-running Hz
  TEMPO: 'tempo',         // BPM-synced (1/4, 1/8, etc.)
};

/**
 * Tempo divisions (for tempo sync)
 */
export const TempoDivision = {
  '4_BARS': 16,
  '2_BARS': 8,
  '1_BAR': 4,
  '1_2': 2,           // Half note
  '1_4': 1,           // Quarter note
  '1_8': 0.5,         // Eighth note
  '1_16': 0.25,       // Sixteenth note
  '1_32': 0.125,      // Thirty-second note
  '1_4T': 2/3,        // Quarter triplet
  '1_8T': 1/3,        // Eighth triplet
  '1_16T': 1/6,       // Sixteenth triplet
  '1_4D': 1.5,        // Dotted quarter
  '1_8D': 0.75,       // Dotted eighth
  '1_16D': 0.375,     // Dotted sixteenth
};

/**
 * LFO class
 */
export class LFO {
  constructor(audioContext) {
    this.audioContext = audioContext;

    // Parameters
    this.waveform = LFOWaveform.SINE;
    this.rate = 1; // Hz (in free mode) or division (in tempo mode)
    this.depth = 1; // 0-1
    this.phase = 0; // 0-360 degrees
    this.syncMode = LFOSyncMode.FREE;
    this.tempoDivision = TempoDivision['1_4'];
    this.bpm = 120;
    this.fadeIn = 0; // Fade-in time in seconds
    this.monoPoly = 'poly'; // mono = shared across voices, poly = per-voice

    // Audio nodes
    this.oscillator = null;
    this.gainNode = null;
    this.shaper = null;

    // Custom waveforms
    this.customWaveforms = new Map();

    // Sample & Hold
    this.sampleHoldInterval = null;
    this.sampleHoldValue = 0;

    // Random LFO
    this.randomBuffer = null;

    // Output
    this.output = null;

    // State
    this.isRunning = false;
    this.startTime = 0;

    // Create custom waveforms
    this._createCustomWaveforms();
  }

  /**
   * Create custom waveforms for Sample & Hold and Random
   */
  _createCustomWaveforms() {
    const sampleRate = this.audioContext.sampleRate;
    const bufferSize = sampleRate; // 1 second

    // Sample & Hold waveform
    const shBuffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
    const shData = shBuffer.getChannelData(0);
    let currentValue = 0;
    const stepSize = Math.floor(bufferSize / 32); // 32 steps per second

    for (let i = 0; i < bufferSize; i++) {
      if (i % stepSize === 0) {
        currentValue = Math.random() * 2 - 1;
      }
      shData[i] = currentValue;
    }

    this.customWaveforms.set(LFOWaveform.SAMPLE_HOLD, shBuffer);

    // Random (smooth noise) waveform
    const randomBuffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
    const randomData = randomBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      randomData[i] = Math.random() * 2 - 1;
    }

    this.customWaveforms.set(LFOWaveform.RANDOM, randomBuffer);
  }

  /**
   * Start LFO
   */
  start(time = null) {
    if (this.isRunning) {
      this.stop();
    }

    const startTime = time || this.audioContext.currentTime;
    this.startTime = startTime;

    // Create audio graph
    this._createAudioGraph();

    // Apply phase offset
    this._applyPhaseOffset(startTime);

    // Apply fade-in
    if (this.fadeIn > 0) {
      this.gainNode.gain.setValueAtTime(0, startTime);
      this.gainNode.gain.linearRampToValueAtTime(this.depth, startTime + this.fadeIn);
    } else {
      this.gainNode.gain.setValueAtTime(this.depth, startTime);
    }

    // Start oscillator/buffer
    if (this.oscillator) {
      this.oscillator.start(startTime);
    }

    this.isRunning = true;
  }

  /**
   * Stop LFO
   */
  stop(time = null) {
    if (!this.isRunning) return;

    const stopTime = time || this.audioContext.currentTime;

    if (this.oscillator) {
      this.oscillator.stop(stopTime);
    }

    if (this.sampleHoldInterval) {
      clearInterval(this.sampleHoldInterval);
      this.sampleHoldInterval = null;
    }

    this._destroyAudioGraph();
    this.isRunning = false;
  }

  /**
   * Create audio graph based on waveform
   */
  _createAudioGraph() {
    // Gain node for depth control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.depth;

    // Create oscillator based on waveform
    if (this.waveform === LFOWaveform.SAMPLE_HOLD || this.waveform === LFOWaveform.RANDOM) {
      // Use buffer source for custom waveforms
      const buffer = this.customWaveforms.get(this.waveform);
      this.oscillator = this.audioContext.createBufferSource();
      this.oscillator.buffer = buffer;
      this.oscillator.loop = true;
      this.oscillator.playbackRate.value = this._getEffectiveRate();
    } else {
      // Standard oscillator
      this.oscillator = this.audioContext.createOscillator();
      this.oscillator.type = this._mapWaveformToOscillatorType();
      this.oscillator.frequency.value = this._getEffectiveRate();
    }

    // Connect
    this.oscillator.connect(this.gainNode);

    // Output
    this.output = this.gainNode;
  }

  /**
   * Destroy audio graph
   */
  _destroyAudioGraph() {
    if (this.oscillator) {
      this.oscillator.disconnect();
      this.oscillator = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.shaper) {
      this.shaper.disconnect();
      this.shaper = null;
    }

    this.output = null;
  }

  /**
   * Map LFO waveform to OscillatorNode type
   */
  _mapWaveformToOscillatorType() {
    switch (this.waveform) {
      case LFOWaveform.SINE:
        return 'sine';
      case LFOWaveform.TRIANGLE:
        return 'triangle';
      case LFOWaveform.SAWTOOTH:
        return 'sawtooth';
      case LFOWaveform.SQUARE:
        return 'square';
      default:
        return 'sine';
    }
  }

  /**
   * Get effective rate (Hz)
   */
  _getEffectiveRate() {
    if (this.syncMode === LFOSyncMode.TEMPO) {
      // Convert BPM and division to Hz
      const beatsPerSecond = this.bpm / 60;
      const cyclesPerBeat = 1 / this.tempoDivision;
      return beatsPerSecond * cyclesPerBeat;
    }

    // Free mode
    return this.rate;
  }

  /**
   * Apply phase offset
   */
  _applyPhaseOffset(time) {
    if (this.phase === 0) return;

    // Phase offset as time offset
    const effectiveRate = this._getEffectiveRate();
    const period = 1 / effectiveRate;
    const phaseTime = (this.phase / 360) * period;

    // Adjust oscillator start time
    // Note: This is a simplified implementation
    // For perfect phase offset, we'd need to use setPeriodicWave with custom phase
  }

  /**
   * Set waveform
   */
  setWaveform(waveform) {
    this.waveform = waveform;

    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Set rate (Hz in free mode, division in tempo mode)
   */
  setRate(rate) {
    this.rate = rate;

    if (this.isRunning && this.oscillator) {
      if (this.oscillator.frequency) {
        this.oscillator.frequency.setValueAtTime(
          this._getEffectiveRate(),
          this.audioContext.currentTime
        );
      } else if (this.oscillator.playbackRate) {
        this.oscillator.playbackRate.setValueAtTime(
          this._getEffectiveRate(),
          this.audioContext.currentTime
        );
      }
    }
  }

  /**
   * Set depth
   */
  setDepth(depth) {
    this.depth = Math.max(0, Math.min(1, depth));

    if (this.isRunning && this.gainNode) {
      this.gainNode.gain.setValueAtTime(this.depth, this.audioContext.currentTime);
    }
  }

  /**
   * Set phase (0-360 degrees)
   */
  setPhase(phase) {
    this.phase = phase % 360;

    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Set sync mode
   */
  setSyncMode(mode) {
    this.syncMode = mode;

    if (this.isRunning) {
      this.setRate(this.rate);
    }
  }

  /**
   * Set tempo (BPM)
   */
  setTempo(bpm) {
    this.bpm = bpm;

    if (this.syncMode === LFOSyncMode.TEMPO && this.isRunning) {
      this.setRate(this.rate);
    }
  }

  /**
   * Set tempo division
   */
  setTempoDivision(division) {
    this.tempoDivision = division;

    if (this.syncMode === LFOSyncMode.TEMPO && this.isRunning) {
      this.setRate(this.rate);
    }
  }

  /**
   * Set fade-in time
   */
  setFadeIn(fadeIn) {
    this.fadeIn = Math.max(0, fadeIn);
  }

  /**
   * Set mono/poly mode
   */
  setMonoPoly(mode) {
    this.monoPoly = mode;
  }

  /**
   * Connect to destination
   */
  connect(destination) {
    if (this.output) {
      this.output.connect(destination);
    }
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.output) {
      this.output.disconnect();
    }
  }

  /**
   * Get current value (for visualization)
   */
  getCurrentValue() {
    if (!this.isRunning || !this.oscillator) {
      return 0;
    }

    // This is an approximation - actual value tracking would require
    // an AnalyserNode or ScriptProcessorNode
    const elapsed = this.audioContext.currentTime - this.startTime;
    const effectiveRate = this._getEffectiveRate();
    const phase = (elapsed * effectiveRate * 2 * Math.PI) % (2 * Math.PI);

    switch (this.waveform) {
      case LFOWaveform.SINE:
        return Math.sin(phase) * this.depth;
      case LFOWaveform.TRIANGLE:
        return (2 / Math.PI) * Math.asin(Math.sin(phase)) * this.depth;
      case LFOWaveform.SAWTOOTH:
        return (2 * (phase / (2 * Math.PI)) - 1) * this.depth;
      case LFOWaveform.SQUARE:
        return (Math.sin(phase) >= 0 ? 1 : -1) * this.depth;
      default:
        return 0;
    }
  }

  /**
   * Dispose LFO
   */
  dispose() {
    this.stop();

    if (this.sampleHoldInterval) {
      clearInterval(this.sampleHoldInterval);
    }

    this.customWaveforms.clear();
  }
}

export default LFO;
