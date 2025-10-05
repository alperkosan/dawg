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

    console.log('🎬 DEBUG: patternData received:', patternData);
    console.log('🎬 DEBUG: patternData entries:', Object.entries(patternData));

    for (const [instrumentId, notes] of Object.entries(patternData)) {
      console.log(`🎬 DEBUG: Processing instrument ${instrumentId}, notes:`, notes);
      if (!notes || notes.length === 0) {
        console.log(`🎬 DEBUG: Skipping instrument ${instrumentId} - no notes`);
        continue;
      }

      try {
        const instrumentBuffer = await this._renderSingleInstrument(
          instrumentId,
          notes,
          offlineContext,
          audioEngine,
          options
        );

        if (instrumentBuffer) {
          console.log(`🎬 Successfully rendered instrument ${instrumentId} with ${notes.length} notes`);
          instrumentBuffers.push({
            instrumentId,
            buffer: instrumentBuffer,
            notes: notes.length
          });
        } else {
          console.warn(`🎬 Instrument ${instrumentId} returned null buffer`);
        }
      } catch (error) {
        console.warn(`🎬 Failed to render instrument ${instrumentId}:`, error);
      }
    }

    console.log(`🎬 DEBUG: Total instrument buffers created: ${instrumentBuffers.length}`);
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
    // Support both 'time' and 'startTime', 'duration' and 'length'
    const noteTime = note.startTime ?? note.time ?? 0;

    // Velocity is already normalized 0-1 in our system (not MIDI 0-127)
    const noteVelocity = note.velocity ?? 1;

    // Duration can be Tone.js notation ('16n', '4n', etc.) or beats number
    const rawDuration = note.length ?? note.duration ?? 1;
    const noteDurationBeats = this._durationToBeats(rawDuration);

    // Convert beat time to seconds (assuming 140 BPM)
    const bpm = 140; // TODO: Get from project/pattern settings
    const secondsPerBeat = 60 / bpm;
    const startTime = noteTime * secondsPerBeat;
    const noteLength = noteDurationBeats * secondsPerBeat;

    // Get instrument type (handle both synth and sampler)
    const instrumentType = instrument.type || (instrument.audioBuffer || instrument.buffer ? 'sample' : 'unknown');

    console.log(`🎬 Scheduling note: type=${instrumentType}, time=${startTime.toFixed(3)}s, duration=${noteLength.toFixed(3)}s (${noteDurationBeats} beats), velocity=${noteVelocity.toFixed(2)}`);

    if ((instrument.type === 'sample' || instrumentType === 'sample') && (instrument.audioBuffer || instrument.buffer)) {
      // Handle sample instruments
      const source = offlineContext.createBufferSource();
      source.buffer = instrument.audioBuffer || instrument.buffer;

      // Apply velocity
      const gainNode = offlineContext.createGain();
      gainNode.gain.setValueAtTime(noteVelocity, startTime);
      source.connect(gainNode);
      gainNode.connect(destination);

      // Schedule playback
      source.start(startTime);

      // For drum samples, let them play naturally
      // For pitched samples or if duration is specified, stop after noteLength
      const buffer = instrument.audioBuffer || instrument.buffer;
      if (noteLength < buffer.duration) {
        source.stop(startTime + noteLength);
      }

    } else if (instrument.type === 'synth' || instrumentType === 'synth') {
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

    // Convert pitch to MIDI number if it's a string
    let midiNote = 60; // Default to C4
    const pitchValue = note.pitch ?? note.note;

    if (typeof pitchValue === 'string') {
      // Parse note name like 'C4', 'G#2', 'Bb3'
      midiNote = this._noteNameToMidi(pitchValue);
    } else if (typeof pitchValue === 'number') {
      midiNote = pitchValue;
    }

    // Convert MIDI to frequency (A4 = 440 Hz = MIDI 69)
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    // Validate values before setting
    if (!isFinite(frequency) || !isFinite(startTime)) {
      console.error('🎬 Invalid frequency or startTime:', { frequency, startTime, midiNote, pitchValue, note });
      return;
    }

    oscillator.frequency.setValueAtTime(frequency, startTime);

    // Set waveform
    oscillator.type = instrument.waveform || 'sine';

    // Connect audio graph
    oscillator.connect(gainNode);
    gainNode.connect(destination);

    // Apply ADSR envelope with validation
    const envelope = instrument.envelope || { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 };

    // Normalize velocity (MIDI 0-127 → 0-1)
    let velocity = (note.velocity ?? 100) / 127;
    velocity = Math.max(0, Math.min(1, velocity)); // Clamp 0-1

    // Validate envelope values
    const attack = Math.max(0, envelope.attack || 0.01);
    const decay = Math.max(0, envelope.decay || 0.1);
    const sustain = Math.max(0, Math.min(1, envelope.sustain || 0.7));
    const release = Math.max(0, envelope.release || 0.2);

    // Validate duration
    const safeDuration = Math.max(0.01, duration || 0.1);

    // Validate all time values
    const attackTime = startTime + attack;
    const decayTime = attackTime + decay;
    const sustainEndTime = startTime + safeDuration - release;
    const endTime = startTime + safeDuration;

    if (!isFinite(velocity) || !isFinite(attackTime) || !isFinite(decayTime) || !isFinite(sustainEndTime) || !isFinite(endTime)) {
      console.error('🎬 Invalid envelope values:', { velocity, attack, decay, sustain, release, duration: safeDuration, startTime });
      return;
    }

    // Attack
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(velocity, attackTime);

    // Decay
    gainNode.gain.linearRampToValueAtTime(velocity * sustain, decayTime);

    // Sustain (hold level)
    if (sustainEndTime > decayTime) {
      gainNode.gain.setValueAtTime(velocity * sustain, sustainEndTime);
    }

    // Release
    gainNode.gain.linearRampToValueAtTime(0, endTime);

    // Schedule oscillator
    oscillator.start(startTime);
    oscillator.stop(endTime);
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
    // Use pattern settings length if available (in beats)
    const patternLengthBeats = patternData?.settings?.length;

    if (patternLengthBeats && patternLengthBeats > 0) {
      const bpm = 140; // TODO: Get from project settings
      const secondsPerBeat = 60 / bpm;
      const totalSeconds = patternLengthBeats * secondsPerBeat;
      const lengthInSamples = Math.ceil(totalSeconds * this.sampleRate);
      console.log(`🎬 Using pattern settings length: ${patternLengthBeats} beats = ${totalSeconds}s = ${lengthInSamples} samples`);
      return Math.max(lengthInSamples, 1);
    }

    // Fallback: calculate from notes
    let maxTime = 0;
    const patternDataObj = patternData?.data || {};

    for (const [instrumentId, notes] of Object.entries(patternDataObj)) {
      if (!Array.isArray(notes)) continue;

      for (const note of notes) {
        // Support both 'time' and 'startTime' for backwards compatibility
        const noteStartTime = note.startTime ?? note.time ?? 0;
        const noteDuration = note.length ?? note.duration ?? 1;
        const noteEndTime = noteStartTime + noteDuration;
        maxTime = Math.max(maxTime, noteEndTime);
      }
    }

    // Convert steps to samples (add some padding)
    const bpm = 140;
    const stepsPerBeat = 16;
    const secondsPerBeat = 60 / bpm;
    const secondsPerStep = secondsPerBeat / stepsPerBeat;

    // If no notes found, use minimum pattern length (1 bar = 16 steps)
    const minPatternSteps = 16;
    const paddingSteps = 4;
    const totalSteps = Math.max(maxTime + paddingSteps, minPatternSteps);

    const totalSeconds = totalSteps * secondsPerStep;
    const lengthInSamples = Math.ceil(totalSeconds * this.sampleRate);

    console.log(`🎬 Calculated from notes: ${totalSteps} steps = ${totalSeconds}s = ${lengthInSamples} samples`);

    return Math.max(lengthInSamples, 1);
  }

  /**
   * Convert Tone.js duration notation to beats (e.g., '16n' -> 0.25, '4n' -> 1, '2n' -> 2)
   */
  _durationToBeats(duration) {
    if (typeof duration === 'number') return duration;
    if (!duration || typeof duration !== 'string') return 1;

    // Tone.js notation: '1n' = whole note = 4 beats, '2n' = half = 2 beats, '4n' = quarter = 1 beat, '8n' = eighth = 0.5, '16n' = sixteenth = 0.25
    const match = duration.match(/^(\d+)n$/);
    if (!match) {
      console.warn(`🎬 Invalid duration notation: ${duration}, defaulting to 1 beat`);
      return 1;
    }

    const division = parseInt(match[1]);
    // whole note = 4 beats in 4/4 time
    return 4 / division;
  }

  /**
   * Convert note name to MIDI number (e.g., 'C4' -> 60, 'A4' -> 69)
   */
  _noteNameToMidi(noteName) {
    const noteMap = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };

    // Parse note name like 'C4', 'G#2', 'Bb3'
    const match = noteName.match(/^([A-G][#b]?)(-?\d+)$/);
    if (!match) {
      console.warn(`🎬 Invalid note name: ${noteName}, defaulting to C4`);
      return 60;
    }

    const note = match[1];
    const octave = parseInt(match[2]);

    const noteOffset = noteMap[note];
    if (noteOffset === undefined) {
      console.warn(`🎬 Unknown note: ${note}, defaulting to C4`);
      return 60;
    }

    // MIDI: C4 = 60, so C0 = 12, C(-1) = 0
    return (octave + 1) * 12 + noteOffset;
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