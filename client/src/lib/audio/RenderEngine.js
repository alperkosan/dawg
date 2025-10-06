/**
 * 🎬 RENDER ENGINE
 *
 * High-performance audio rendering system
 * Supports real-time and offline rendering of patterns and arrangements
 */

import { AudioContextService } from '../services/AudioContextService';
import {
  getCurrentBPM,
  getCurrentSampleRate,
  stepsToBeat,
  beatsToSeconds,
  midiToFrequency,
  STEPS_PER_BEAT,
  BEATS_PER_BAR,
  RENDER_CONFIG,
  SYNTH_CONFIG,
  DEFAULT_BIT_DEPTH
} from './audioRenderConfig';
import { EffectFactory } from './effects';

export class RenderEngine {
  constructor() {
    this.isRendering = false;
    this.renderQueue = [];
    this.sampleRate = getCurrentSampleRate();
    this.maxRenderTime = RENDER_CONFIG.MAX_RENDER_TIME;

    console.log('🎬 RenderEngine initialized', {
      sampleRate: this.sampleRate,
      maxRenderTime: this.maxRenderTime
    });
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
      const minRenderLength = sampleRate * RENDER_CONFIG.MIN_RENDER_TIME;
      if (renderLength < minRenderLength) {
        console.warn(`🎬 Pattern too short (${renderLength} frames), using minimum length: ${minRenderLength}`);
        renderLength = minRenderLength;
      }

      // FINAL SAFETY: Absolute minimum
      if (renderLength <= 0) {
        console.error(`🎬 CRITICAL: Invalid render length ${renderLength}, forcing to minimum`);
        renderLength = sampleRate * RENDER_CONFIG.MIN_RENDER_TIME * 2; // 2x minimum as fallback
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
        renderLength = sampleRate * RENDER_CONFIG.DEFAULT_PATTERN_LENGTH_BARS; // Default pattern length emergency fallback
      }

      const offlineContext = new OfflineAudioContext(2, renderLength, sampleRate);

      // Get audio engine for instrument data
      const audioEngine = AudioContextService.getAudioEngine();
      if (!audioEngine) {
        throw new Error('Audio engine not available');
      }

      // Render each instrument's notes (pass full patternData for instrument lookup)
      const instrumentBuffers = await this._renderInstrumentNotes(
        patternData.data,
        offlineContext,
        audioEngine,
        { includeEffects, startTime, endTime, patternData }
      );

      // Mix all instrument buffers
      const finalBuffer = await this._mixInstrumentBuffers(
        instrumentBuffers,
        offlineContext
      );

      // Apply post-processing
      if (fadeOut) {
        this._applyFadeOut(finalBuffer, RENDER_CONFIG.DEFAULT_FADE_OUT);
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
          options,
          options.patternData // Pass patternData for instrument lookup
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
  async _renderSingleInstrument(instrumentId, notes, offlineContext, audioEngine, options, patternData) {
    // Get instrument from audio engine
    const instrument = audioEngine.instruments.get(instrumentId);
    if (!instrument) {
      console.warn(`🎬 Instrument ${instrumentId} not found in audio engine`);
      return null;
    }

    // ✅ FIX: Get full instrument params from patternData (passed from AudioExportManager)
    const instrumentStore = patternData.instruments?.[instrumentId];

    console.log(`🎬 Instrument lookup for ${instrumentId}:`, {
      found: !!instrumentStore,
      hasInstrumentsData: !!patternData.instruments,
      totalInstruments: Object.keys(patternData.instruments || {}).length,
      searchingFor: instrumentId,
      instrumentType: instrument.type
    });

    // Create destination for this instrument
    const gainNode = offlineContext.createGain();
    gainNode.connect(offlineContext.destination);

    // ✅ NEW APPROACH: Use AudioWorklet for synth rendering (same as realtime)
    if (instrument.type === 'synth' && instrumentStore?.synthParams) {
      console.log(`🎬 Using AudioWorklet processor for synth: ${instrument.name}`);

      // Load worklet module if not already loaded
      if (!offlineContext._workletLoaded) {
        try {
          await offlineContext.audioWorklet.addModule('/worklets/instrument-processor.js');
          offlineContext._workletLoaded = true;
          console.log(`🎬 Loaded AudioWorklet processor for offline rendering`);
        } catch (error) {
          console.error(`🎬 Failed to load AudioWorklet:`, error);
          // Fallback to old rendering method
          return await this._renderSingleInstrumentLegacy(instrumentId, notes, offlineContext, audioEngine, options, patternData);
        }
      }

      // ✅ IMPROVED: Prepare all notes upfront for processorOptions
      const preparedNotes = notes.map(note => {
        const noteTimeSteps = note.startTime ?? note.time ?? 0;
        const noteTimeBeats = stepsToBeat(noteTimeSteps);
        const rawDuration = note.length ?? note.duration ?? 1;
        const noteDurationBeats = this._durationToBeats(rawDuration);
        const bpm = getCurrentBPM();
        const startTime = beatsToSeconds(noteTimeBeats, bpm);
        const noteLength = beatsToSeconds(noteDurationBeats, bpm);
        const velocity = note.velocity ?? 1;
        const pitch = note.pitch ?? note.note;

        return {
          pitch,
          velocity,
          delay: startTime,
          duration: noteLength,
          noteId: `${instrumentId}_${noteTimeSteps}`
        };
      });

      console.log(`🎬 Prepared ${preparedNotes.length} notes for ${instrument.name}`);

      // Create AudioWorkletNode with synthParams AND notes
      const workletNode = new AudioWorkletNode(offlineContext, 'instrument-processor', {
        processorOptions: {
          instrumentId,
          instrumentName: instrument.name,
          synthParams: instrumentStore.synthParams,
          offlineNotes: preparedNotes, // ✅ Send notes at initialization
          isOfflineRendering: true // ✅ Flag to indicate offline mode
        }
      });

      // ✅ NEW: Apply effect chain if instrument has effects
      let audioOutput = workletNode;
      if (instrumentStore?.effectChain && instrumentStore.effectChain.length > 0) {
        console.log(`🎬 Applying ${instrumentStore.effectChain.length} effects to ${instrument.name}`);
        audioOutput = await this._applyEffectChain(instrumentStore.effectChain, workletNode, offlineContext);
      }

      audioOutput.connect(gainNode);

      // ✅ CRITICAL: Keep worklet node reference so it doesn't get garbage collected
      offlineContext._activeWorklets = offlineContext._activeWorklets || [];
      offlineContext._activeWorklets.push(workletNode);

      console.log(`🎬 Worklet processor created for ${instrument.name} with ${preparedNotes.length} pre-scheduled notes`);

      return gainNode;

    } else {
      // Use legacy rendering for samples
      // ✅ NEW: Apply effect chain for sample instruments
      let sampleDestination = gainNode;
      if (instrumentStore?.effectChain && instrumentStore.effectChain.length > 0) {
        console.log(`🎬 Applying ${instrumentStore.effectChain.length} effects to sample ${instrument.name}`);

        // Create intermediate node for effects
        const effectInput = offlineContext.createGain();
        const effectOutput = await this._applyEffectChain(instrumentStore.effectChain, effectInput, offlineContext);
        effectOutput.connect(gainNode);
        sampleDestination = effectInput;
      }

      for (const note of notes) {
        try {
          await this._scheduleNoteForOfflineRender(
            instrument,
            note,
            offlineContext,
            sampleDestination,
            options
          );
        } catch (error) {
          console.warn(`🎬 Failed to schedule note:`, error);
        }
      }

      return gainNode;
    }
  }

  /**
   * Schedule a note for offline rendering
   */
  async _scheduleNoteForOfflineRender(instrument, note, offlineContext, destination, options) {
    // Support both 'time' and 'startTime', 'duration' and 'length'
    // NOTE: time is in STEPS (16 steps per bar), convert to beats
    const noteTimeSteps = note.startTime ?? note.time ?? 0;
    const noteTimeBeats = stepsToBeat(noteTimeSteps);

    // Velocity is already normalized 0-1 in our system (not MIDI 0-127)
    const noteVelocity = note.velocity ?? 1;

    // Duration can be Tone.js notation ('16n', '4n', etc.) or beats number
    const rawDuration = note.length ?? note.duration ?? 1;
    const noteDurationBeats = this._durationToBeats(rawDuration);

    // Convert beat time to seconds using current BPM
    const bpm = getCurrentBPM();
    const startTime = beatsToSeconds(noteTimeBeats, bpm);
    const noteLength = beatsToSeconds(noteDurationBeats, bpm);

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
    // ✅ FIX: Create multiple oscillators for richer sound (like worklet processor)
    const oscillator1 = offlineContext.createOscillator();
    const oscillator2 = offlineContext.createOscillator(); // For mixing
    const gainNode1 = offlineContext.createGain();
    const gainNode2 = offlineContext.createGain();
    const mixGain = offlineContext.createGain();

    // Convert pitch to MIDI number if it's a string
    let midiNote = 60; // Default to C4
    const pitchValue = note.pitch ?? note.note;

    console.log(`🎬 DEBUG Synth note pitch:`, { pitchValue, noteObj: note });
    console.log(`🎬 DEBUG Instrument params:`, {
      name: instrument.name,
      type: instrument.type,
      waveform: instrument.waveform,
      envelope: instrument.envelope,
      filter: instrument.filter,
      lfo: instrument.lfo,
      allParams: instrument
    });

    if (typeof pitchValue === 'string') {
      // Parse note name like 'C4', 'G#2', 'Bb3'
      midiNote = this._noteNameToMidi(pitchValue);
    } else if (typeof pitchValue === 'number') {
      midiNote = pitchValue;
    }

    // Convert MIDI to frequency using config
    const frequency = midiToFrequency(midiNote);

    console.log(`🎬 DEBUG Synth conversion:`, { pitchValue, midiNote, frequency });

    // Validate values before setting
    if (!isFinite(frequency) || !isFinite(startTime)) {
      console.error('🎬 Invalid frequency or startTime:', { frequency, startTime, midiNote, pitchValue, note });
      return;
    }

    // ✅ FIX: Set frequencies for both oscillators
    oscillator1.frequency.setValueAtTime(frequency, startTime);
    oscillator2.frequency.setValueAtTime(frequency, startTime);

    // ✅ FIX: Set waveforms (mix like worklet: sawtooth 70% + sine 30%)
    const mainWaveform = instrument.waveform || SYNTH_CONFIG.oscillator.defaultType;
    oscillator1.type = mainWaveform;
    oscillator2.type = 'sine'; // Always sine for warmth

    // ✅ FIX: Set mix gains (like worklet processor line 397)
    gainNode1.gain.setValueAtTime(0.7, startTime);  // Main waveform 70%
    gainNode2.gain.setValueAtTime(0.3, startTime);  // Sine 30%

    // ✅ FIX: Add filter if instrument has filter params
    let filterNode = null;
    if (instrument.filter && instrument.filter.frequency) {
      filterNode = offlineContext.createBiquadFilter();
      filterNode.type = instrument.filter.type || 'lowpass';
      filterNode.frequency.setValueAtTime(instrument.filter.frequency, startTime);
      filterNode.Q.setValueAtTime(instrument.filter.Q || 1, startTime);

      console.log(`🎬 Added filter: ${filterNode.type} @ ${instrument.filter.frequency}Hz Q=${instrument.filter.Q || 1}`);
    }

    // ✅ FIX: Connect audio graph with mixed oscillators
    // oscillator1 (main) -> gainNode1 -> mixGain
    // oscillator2 (sine) -> gainNode2 -> mixGain
    // mixGain -> filter (optional) -> destination
    oscillator1.connect(gainNode1);
    oscillator2.connect(gainNode2);
    gainNode1.connect(mixGain);
    gainNode2.connect(mixGain);

    if (filterNode) {
      mixGain.connect(filterNode);
      filterNode.connect(destination);
    } else {
      mixGain.connect(destination);
    }

    // Apply ADSR envelope with config defaults
    const envelope = instrument.envelope || {};

    // Velocity is already normalized 0-1 in our system
    let velocity = note.velocity ?? 1;
    velocity = Math.max(0, Math.min(SYNTH_CONFIG.oscillator.maxGain, velocity));

    // Validate envelope values using config
    const attack = Math.max(SYNTH_CONFIG.envelope.attack.min, envelope.attack || SYNTH_CONFIG.envelope.attack.default);
    const decay = Math.max(SYNTH_CONFIG.envelope.decay.min, envelope.decay || SYNTH_CONFIG.envelope.decay.default);
    const sustain = Math.max(SYNTH_CONFIG.envelope.sustain.min, Math.min(SYNTH_CONFIG.envelope.sustain.max, envelope.sustain ?? SYNTH_CONFIG.envelope.sustain.default));
    const release = Math.max(SYNTH_CONFIG.envelope.release.min, envelope.release || SYNTH_CONFIG.envelope.release.default);

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

    // ✅ FIX: Apply envelope to mixGain (not individual gains)
    // Multiply by 0.3 for voice level (like worklet processor line 406)
    const voiceLevel = 0.3;

    // Attack
    mixGain.gain.setValueAtTime(0, startTime);
    mixGain.gain.linearRampToValueAtTime(velocity * voiceLevel, attackTime);

    // Decay
    mixGain.gain.linearRampToValueAtTime(velocity * sustain * voiceLevel, decayTime);

    // Sustain (hold level)
    if (sustainEndTime > decayTime) {
      mixGain.gain.setValueAtTime(velocity * sustain * voiceLevel, sustainEndTime);
    }

    // Release
    mixGain.gain.linearRampToValueAtTime(0, endTime);

    // ✅ FIX: Schedule both oscillators
    oscillator1.start(startTime);
    oscillator1.stop(endTime);
    oscillator2.start(startTime);
    oscillator2.stop(endTime);

    console.log(`🎬 Synth scheduled: ${instrument.name || 'Synth'} freq=${frequency.toFixed(1)}Hz time=${startTime.toFixed(3)}s dur=${safeDuration.toFixed(3)}s vel=${velocity.toFixed(2)}`);
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
    // Calculate from notes (ALWAYS - ignore pattern.settings.length as it's unreliable)
    let maxTimeBeats = 0;
    const patternDataObj = patternData?.data || {};

    for (const [instrumentId, notes] of Object.entries(patternDataObj)) {
      if (!Array.isArray(notes)) continue;

      for (const note of notes) {
        // Support both 'time' and 'startTime' for backwards compatibility
        // NOTE: time is in STEPS, convert to beats using config
        const noteStartTimeSteps = note.startTime ?? note.time ?? 0;
        const noteStartTimeBeats = stepsToBeat(noteStartTimeSteps);
        const rawDuration = note.length ?? note.duration ?? 1;
        const noteDuration = this._durationToBeats(rawDuration);
        const noteEndTimeBeats = noteStartTimeBeats + noteDuration;
        maxTimeBeats = Math.max(maxTimeBeats, noteEndTimeBeats);
      }
    }

    // Add padding and round to nearest bar using config
    const totalBeats = Math.ceil((maxTimeBeats + RENDER_CONFIG.PATTERN_LENGTH_PADDING) / BEATS_PER_BAR) * BEATS_PER_BAR;

    // If no notes, use default from config
    const finalBeats = Math.max(totalBeats, RENDER_CONFIG.DEFAULT_PATTERN_LENGTH_BARS * BEATS_PER_BAR);

    // Convert beats to samples using current BPM
    const bpm = getCurrentBPM();
    const totalSeconds = beatsToSeconds(finalBeats, bpm);
    const lengthInSamples = Math.ceil(totalSeconds * this.sampleRate);

    console.log(`🎬 Calculated from notes: ${finalBeats} beats (${finalBeats / BEATS_PER_BAR} bars) @ ${bpm} BPM = ${totalSeconds.toFixed(2)}s = ${lengthInSamples} samples`);

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

  /**
   * ✅ NEW: Apply effect chain to audio node
   * Creates effect instances and connects them in series
   * @param {Array} effectChainData - Serialized effect chain from instrument store
   * @param {AudioNode} inputNode - Source audio node
   * @param {AudioContext} context - Audio context (offline or realtime)
   * @returns {AudioNode} Final output node of effect chain
   */
  async _applyEffectChain(effectChainData, inputNode, context) {
    if (!effectChainData || effectChainData.length === 0) {
      return inputNode;
    }

    let currentNode = inputNode;

    for (const effectData of effectChainData) {
      try {
        // Create effect instance from serialized data
        const effect = EffectFactory.deserialize(effectData, context);

        if (!effect) {
          console.warn(`🎬 Failed to create effect: ${effectData.type}`);
          continue;
        }

        // Connect current node to effect input
        currentNode.connect(effect.inputNode);

        // Effect output becomes the new current node
        currentNode = effect.outputNode;

        console.log(`🎬 Applied effect: ${effect.name} (${effect.type})`);
      } catch (error) {
        console.error(`🎬 Error applying effect ${effectData.type}:`, error);
      }
    }

    return currentNode;
  }
}

export default RenderEngine;