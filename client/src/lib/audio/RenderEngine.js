/**
 * 🎬 RENDER ENGINE
 *
 * High-performance audio rendering system
 * Supports real-time and offline rendering of patterns and arrangements
 */

import { AudioContextService } from '../services/AudioContextService';

export class RenderEngine {
  constructor() {
    this.isRendering = false;
    this.renderQueue = [];
    this.sampleRate = 44100;
    this.maxRenderTime = 300; // 5 minutes max render time

    console.log('🎬 RenderEngine initialized');
  }

  // =================== PATTERN RENDERING ===================

  /**
   * Render a pattern to audio buffer
   * @param {object} patternData - Pattern data with notes
   * @param {object} options - Render options
   * @returns {Promise<object>} Render result with audio buffer
   */
  async renderPattern(patternData, options = {}) {
    const {
      sampleRate = this.sampleRate,
      bitDepth = 16,
      includeEffects = true,
      fadeOut = true,
      length = null, // Auto-calculate if null
      startTime = 0,
      endTime = null
    } = options;

    console.log(`🎬 Rendering pattern: ${patternData.name || patternData.id}`, options);

    try {
      this.isRendering = true;

      // Calculate render length with safety checks
      let renderLength = length || this._calculatePatternLength(patternData);

      console.log(`🎬 DEBUG: Calculated pattern length: ${renderLength} frames`);
      console.log(`🎬 DEBUG: Pattern data:`, patternData);

      // SAFETY: Ensure minimum render length
      const minRenderLength = sampleRate * 2; // Minimum 2 seconds
      if (renderLength < minRenderLength) {
        console.warn(`🎬 Pattern too short (${renderLength} frames), using minimum length: ${minRenderLength}`);
        renderLength = minRenderLength;
      }

      // FINAL SAFETY: Absolute minimum
      if (renderLength <= 0) {
        console.error(`🎬 CRITICAL: Invalid render length ${renderLength}, forcing to minimum`);
        renderLength = sampleRate * 4; // 4 seconds fallback
      }

      const renderDuration = renderLength / sampleRate;

      if (renderDuration > this.maxRenderTime) {
        throw new Error(`Render time too long: ${renderDuration}s (max: ${this.maxRenderTime}s)`);
      }

      console.log(`🎬 Rendering with length: ${renderLength} frames (${renderDuration.toFixed(2)}s)`);

      // Create offline audio context for rendering with final validation
      console.log(`🎬 DEBUG: About to create OfflineAudioContext with: channels=2, length=${renderLength}, sampleRate=${sampleRate}`);

      // ULTIMATE SAFETY CHECK
      if (!renderLength || renderLength <= 0 || !Number.isFinite(renderLength)) {
        console.error(`🎬 FATAL: Invalid renderLength: ${renderLength}, using emergency fallback`);
        renderLength = sampleRate * 4; // 4 seconds emergency fallback
      }

      const offlineContext = new OfflineAudioContext(2, renderLength, sampleRate);

      // Get audio engine for instrument data
      const audioEngine = AudioContextService.getAudioEngine();
      if (!audioEngine) {
        throw new Error('Audio engine not available');
      }

      // Render each instrument's notes
      const instrumentBuffers = await this._renderInstrumentNotes(
        patternData.data,
        offlineContext,
        audioEngine,
        { includeEffects, startTime, endTime }
      );

      // Mix all instrument buffers
      const finalBuffer = await this._mixInstrumentBuffers(
        instrumentBuffers,
        offlineContext
      );

      // Apply post-processing
      if (fadeOut) {
        this._applyFadeOut(finalBuffer, 0.1); // 100ms fade out
      }

      // Render offline context
      const renderedBuffer = await offlineContext.startRendering();

      const result = {
        audioBuffer: renderedBuffer,
        duration: renderedBuffer.duration,
        sampleRate: renderedBuffer.sampleRate,
        channels: renderedBuffer.numberOfChannels,
        patternId: patternData.id,
        patternName: patternData.name,
        renderTime: Date.now(),
        options: options
      };

      console.log(`🎬 Pattern rendered successfully: ${result.duration.toFixed(2)}s`);
      return result;

    } catch (error) {
      console.error('🎬 Pattern render failed:', error);
      throw error;
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Render multiple patterns in sequence
   */
  async renderArrangement(patternSequence, options = {}) {
    console.log(`🎬 Rendering arrangement with ${patternSequence.length} patterns`);

    const patternBuffers = [];
    let totalDuration = 0;

    // Render each pattern
    for (const { patternData, startTime, duration } of patternSequence) {
      const renderResult = await this.renderPattern(patternData, {
        ...options,
        length: duration * options.sampleRate || this.sampleRate
      });

      patternBuffers.push({
        buffer: renderResult.audioBuffer,
        startTime: startTime,
        duration: renderResult.duration
      });

      totalDuration = Math.max(totalDuration, startTime + renderResult.duration);
    }

    // Create arrangement buffer
    const arrangementLength = Math.ceil(totalDuration * (options.sampleRate || this.sampleRate));
    const offlineContext = new OfflineAudioContext(2, arrangementLength, options.sampleRate || this.sampleRate);

    // Mix patterns at their scheduled times
    for (const { buffer, startTime } of patternBuffers) {
      const source = offlineContext.createBufferSource();
      source.buffer = buffer;
      source.connect(offlineContext.destination);
      source.start(startTime);
    }

    const renderedBuffer = await offlineContext.startRendering();

    return {
      audioBuffer: renderedBuffer,
      duration: renderedBuffer.duration,
      sampleRate: renderedBuffer.sampleRate,
      patterns: patternSequence.length,
      renderTime: Date.now()
    };
  }

  // =================== INSTRUMENT RENDERING ===================

  /**
   * Render individual instrument notes
   */
  async _renderInstrumentNotes(patternData, offlineContext, audioEngine, options) {
    const instrumentBuffers = [];

    for (const [instrumentId, notes] of Object.entries(patternData)) {
      if (!notes || notes.length === 0) continue;

      try {
        const instrumentBuffer = await this._renderSingleInstrument(
          instrumentId,
          notes,
          offlineContext,
          audioEngine,
          options
        );

        if (instrumentBuffer) {
          instrumentBuffers.push({
            instrumentId,
            buffer: instrumentBuffer,
            notes: notes.length
          });
        }
      } catch (error) {
        console.warn(`🎬 Failed to render instrument ${instrumentId}:`, error);
      }
    }

    return instrumentBuffers;
  }

  /**
   * Render single instrument's notes
   */
  async _renderSingleInstrument(instrumentId, notes, offlineContext, audioEngine, options) {
    // Get instrument from audio engine
    const instrument = audioEngine.instruments.get(instrumentId);
    if (!instrument) {
      console.warn(`🎬 Instrument ${instrumentId} not found in audio engine`);
      return null;
    }

    // Create instrument buffer for offline rendering
    const gainNode = offlineContext.createGain();
    gainNode.connect(offlineContext.destination);

    // Schedule all notes
    for (const note of notes) {
      try {
        await this._scheduleNoteForOfflineRender(
          instrument,
          note,
          offlineContext,
          gainNode,
          options
        );
      } catch (error) {
        console.warn(`🎬 Failed to schedule note:`, error);
      }
    }

    return gainNode;
  }

  /**
   * Schedule a note for offline rendering
   */
  async _scheduleNoteForOfflineRender(instrument, note, offlineContext, destination, options) {
    const { time, velocity = 1.0, duration = 1.0 } = note;

    // Convert step time to seconds (assuming 16 steps per beat, 140 BPM)
    const bpm = 140; // TODO: Get from project/pattern settings
    const stepsPerBeat = 16;
    const secondsPerBeat = 60 / bpm;
    const secondsPerStep = secondsPerBeat / stepsPerBeat;
    const startTime = time * secondsPerStep;
    const noteLength = duration * secondsPerStep;

    if (instrument.type === 'sample' && instrument.audioBuffer) {
      // Handle sample instruments
      const source = offlineContext.createBufferSource();
      source.buffer = instrument.audioBuffer;

      // Apply velocity
      const gainNode = offlineContext.createGain();
      gainNode.gain.setValueAtTime(velocity, startTime);
      source.connect(gainNode);
      gainNode.connect(destination);

      // Schedule playback
      source.start(startTime);

      // Stop after note duration (for pitched samples)
      if (noteLength < instrument.audioBuffer.duration) {
        source.stop(startTime + noteLength);
      }

    } else if (instrument.type === 'synth') {
      // Handle synthesizer instruments
      await this._renderSynthNote(instrument, note, offlineContext, destination, startTime, noteLength);
    }
  }

  /**
   * Render synthesizer note
   */
  async _renderSynthNote(instrument, note, offlineContext, destination, startTime, duration) {
    // Basic oscillator synthesis for offline rendering
    const oscillator = offlineContext.createOscillator();
    const gainNode = offlineContext.createGain();

    // Set frequency (C4 = 261.63 Hz as base, adjust by pitch)
    const baseFreq = 261.63;
    const frequency = baseFreq * Math.pow(2, (note.pitch || 0) / 12);
    oscillator.frequency.setValueAtTime(frequency, startTime);

    // Set waveform
    oscillator.type = instrument.waveform || 'sine';

    // Connect audio graph
    oscillator.connect(gainNode);
    gainNode.connect(destination);

    // Apply ADSR envelope
    const envelope = instrument.envelope || { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 };
    const velocity = note.velocity || 1.0;

    // Attack
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(velocity, startTime + envelope.attack);

    // Decay
    gainNode.gain.linearRampToValueAtTime(
      velocity * envelope.sustain,
      startTime + envelope.attack + envelope.decay
    );

    // Sustain (hold level)
    const sustainEndTime = startTime + duration - envelope.release;
    gainNode.gain.setValueAtTime(velocity * envelope.sustain, sustainEndTime);

    // Release
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    // Schedule oscillator
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  // =================== MIXING & POST-PROCESSING ===================

  /**
   * Mix multiple instrument buffers
   */
  async _mixInstrumentBuffers(instrumentBuffers, offlineContext) {
    // All instruments are already connected to destination
    // This is handled by the individual instrument rendering
    return offlineContext.destination;
  }

  /**
   * Apply fade out to buffer
   */
  _applyFadeOut(audioNode, fadeTime) {
    if (audioNode && audioNode.gain) {
      const currentTime = audioNode.context.currentTime;
      const duration = audioNode.context.length / audioNode.context.sampleRate;
      const fadeStartTime = duration - fadeTime;

      if (fadeStartTime > 0) {
        audioNode.gain.setValueAtTime(1.0, fadeStartTime);
        audioNode.gain.linearRampToValueAtTime(0.0, duration);
      }
    }
  }

  // =================== UTILITY METHODS ===================

  /**
   * Calculate pattern length in samples
   */
  _calculatePatternLength(patternData) {
    console.log(`🎬 DEBUG: _calculatePatternLength called with:`, patternData);

    let maxTime = 0;

    // Find the latest note time across all instruments
    const patternDataObj = patternData?.data || {};
    console.log(`🎬 DEBUG: Pattern data object:`, patternDataObj);

    for (const [instrumentId, notes] of Object.entries(patternDataObj)) {
      console.log(`🎬 DEBUG: Checking instrument ${instrumentId}, notes:`, notes);

      if (!Array.isArray(notes)) continue;

      for (const note of notes) {
        const noteEndTime = note.time + (note.duration || 1);
        maxTime = Math.max(maxTime, noteEndTime);
      }
    }

    console.log(`🎬 DEBUG: Max time found: ${maxTime} steps`);

    // Convert steps to samples (add some padding)
    const bpm = 140; // TODO: Get from project settings
    const stepsPerBeat = 16;
    const secondsPerBeat = 60 / bpm;
    const secondsPerStep = secondsPerBeat / stepsPerBeat;

    // If no notes found, use minimum pattern length (1 bar = 16 steps)
    const minPatternSteps = 16;
    const paddingSteps = 4;
    const totalSteps = Math.max(maxTime + paddingSteps, minPatternSteps);

    console.log(`🎬 DEBUG: Total steps: ${totalSteps}, seconds per step: ${secondsPerStep}`);

    const totalSeconds = totalSteps * secondsPerStep;
    const lengthInSamples = Math.ceil(totalSeconds * this.sampleRate);

    console.log(`🎬 DEBUG: Total seconds: ${totalSeconds}, length in samples: ${lengthInSamples}`);

    // Ensure minimum of 1 frame for OfflineAudioContext
    const finalLength = Math.max(lengthInSamples, 1);
    console.log(`🎬 DEBUG: Final length: ${finalLength}`);

    return finalLength;
  }

  /**
   * Get render progress (for UI)
   */
  getRenderProgress() {
    return {
      isRendering: this.isRendering,
      queueLength: this.renderQueue.length
    };
  }

  /**
   * Cancel current render
   */
  cancelRender() {
    this.isRendering = false;
    this.renderQueue.length = 0;
    console.log('🎬 Render cancelled');
  }

  // =================== EXPORT HELPERS ===================

  /**
   * Create quick pattern preview (low quality, fast render)
   */
  async renderPatternPreview(patternData, durationSeconds = 10) {
    return await this.renderPattern(patternData, {
      sampleRate: 22050, // Lower sample rate for speed
      bitDepth: 16,
      includeEffects: false,
      length: durationSeconds * 22050
    });
  }

  /**
   * Render pattern at high quality
   */
  async renderPatternHQ(patternData) {
    return await this.renderPattern(patternData, {
      sampleRate: 48000,
      bitDepth: 24,
      includeEffects: true,
      fadeOut: true
    });
  }

  /**
   * Render pattern for mastering
   */
  async renderPatternMaster(patternData) {
    return await this.renderPattern(patternData, {
      sampleRate: 96000,
      bitDepth: 32,
      includeEffects: true,
      fadeOut: false // No fade for mastering
    });
  }
}

export default RenderEngine;