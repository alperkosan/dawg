/**
 * 🎬 AUDIO RENDERER
 *
 * Renders samples, patterns, and arrangement tracks to new audio buffers
 * Includes all effects, automation, and processing
 * Rendered audio can be re-imported as new instruments
 */

import { AudioContextService } from '../services/AudioContextService.js';

export class AudioRenderer {
  constructor() {
    this.sampleRate = 48000; // High quality render
    this.isRendering = false;
    // console.log('🎬 AudioRenderer initialized'); // Removed: causes unnecessary console spam
  }

  /**
   * Render an audio sample with effects to a new audio buffer
   * @param {AudioBuffer} sourceBuffer - Original audio buffer
   * @param {Object} options - Render options with effects, fade, gain, playback rate
   * @returns {Promise<AudioBuffer>} Rendered audio buffer
   */
  async renderSampleWithEffects(sourceBuffer, options = {}) {
    const {
      fadeIn = 0,           // in seconds
      fadeOut = 0,          // in seconds
      gain = 0,             // in dB
      playbackRate = 1.0,   // time stretch
      sampleOffset = 0,     // start offset in seconds
      duration = null,      // render duration (null = full length)
      effects = []          // array of effect processors
    } = options;

    console.log('🎬 Rendering sample with effects:', options);

    try {
      this.isRendering = true;

      // Calculate render length
      const sourceDuration = sourceBuffer.duration;
      const actualDuration = duration || (sourceDuration - sampleOffset);
      const renderDuration = actualDuration / playbackRate; // Adjust for playback rate
      const renderLength = Math.ceil(renderDuration * this.sampleRate);

      // Create offline context
      const offlineContext = new OfflineAudioContext(
        sourceBuffer.numberOfChannels,
        renderLength,
        this.sampleRate
      );

      // Create source
      const source = offlineContext.createBufferSource();
      source.buffer = sourceBuffer;
      source.playbackRate.value = playbackRate;

      // Create gain node
      const gainNode = offlineContext.createGain();
      const gainLinear = Math.pow(10, gain / 20);
      gainNode.gain.value = gainLinear;

      // Apply fade in
      if (fadeIn > 0) {
        gainNode.gain.setValueAtTime(0, 0);
        gainNode.gain.linearRampToValueAtTime(gainLinear, fadeIn);
      }

      // Apply fade out
      if (fadeOut > 0) {
        const fadeOutStart = renderDuration - fadeOut;
        if (fadeOutStart > 0) {
          gainNode.gain.setValueAtTime(gainLinear, fadeOutStart);
          gainNode.gain.linearRampToValueAtTime(0, renderDuration);
        }
      }

      // Connect audio graph
      source.connect(gainNode);

      // Apply effects chain
      let currentNode = gainNode;
      for (const effect of effects) {
        const effectNode = this._createEffectNode(offlineContext, effect);
        if (effectNode) {
          currentNode.connect(effectNode);
          currentNode = effectNode;
        }
      }

      // Connect to destination
      currentNode.connect(offlineContext.destination);

      // Start playback with offset
      source.start(0, sampleOffset, actualDuration);

      // Render
      const renderedBuffer = await offlineContext.startRendering();

      console.log(`🎬 Sample rendered: ${renderedBuffer.duration.toFixed(2)}s`);
      return renderedBuffer;

    } catch (error) {
      console.error('🎬 Sample render failed:', error);
      throw error;
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Render a pattern with all instruments and effects to audio buffer
   * @param {Object} pattern - Pattern data
   * @param {Map} instruments - Instruments map
   * @param {Object} options - Render options
   * @returns {Promise<AudioBuffer>} Rendered audio buffer
   */
  async renderPatternToAudio(pattern, instruments, options = {}) {
    const {
      bpm = 140,
      duration = null, // in beats, null = auto-calculate
      includeEffects = true,
      normalize = false
    } = options;

    console.log(`🎬 Rendering pattern: ${pattern.name || pattern.id}`, options);

    try {
      this.isRendering = true;

      // Calculate pattern duration
      const patternDurationBeats = duration || this._calculatePatternDuration(pattern);
      const patternDurationSeconds = (patternDurationBeats * 60) / bpm;
      const renderLength = Math.ceil(patternDurationSeconds * this.sampleRate);

      // Create offline context
      const offlineContext = new OfflineAudioContext(2, renderLength, this.sampleRate);

      // Get pattern notes
      const notes = pattern.notes || [];

      // Group notes by instrument
      const notesByInstrument = new Map();
      for (const note of notes) {
        const instrumentId = note.instrumentId;
        if (!notesByInstrument.has(instrumentId)) {
          notesByInstrument.set(instrumentId, []);
        }
        notesByInstrument.get(instrumentId).push(note);
      }

      // Render each instrument's notes
      for (const [instrumentId, instrumentNotes] of notesByInstrument) {
        const instrument = instruments.get(instrumentId);
        if (!instrument) {
          console.warn(`🎬 Instrument ${instrumentId} not found`);
          continue;
        }

        await this._renderInstrumentNotes(
          instrument,
          instrumentNotes,
          offlineContext,
          bpm,
          includeEffects
        );
      }

      // Render offline context
      let renderedBuffer = await offlineContext.startRendering();

      // Normalize if requested
      if (normalize) {
        renderedBuffer = this._normalizeBuffer(renderedBuffer);
      }

      console.log(`🎬 Pattern rendered: ${renderedBuffer.duration.toFixed(2)}s`);
      return renderedBuffer;

    } catch (error) {
      console.error('🎬 Pattern render failed:', error);
      throw error;
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Render an arrangement track (clip sequence) to audio buffer
   * @param {Array} clips - Array of clips on the track
   * @param {Map} instruments - Instruments map
   * @param {Object} patterns - Patterns object
   * @param {Object} options - Render options
   * @returns {Promise<AudioBuffer>} Rendered audio buffer
   */
  async renderTrackToAudio(clips, instruments, patterns, options = {}) {
    const {
      bpm = 140,
      startTime = 0,     // in beats
      endTime = null,    // in beats, null = auto-calculate
      includeEffects = true,
      normalize = false
    } = options;

    console.log(`🎬 Rendering track with ${clips.length} clips`, options);

    try {
      this.isRendering = true;

      // Calculate render duration
      let trackEndTime = endTime;
      if (!trackEndTime) {
        trackEndTime = Math.max(...clips.map(c => c.startTime + c.duration));
      }

      const renderDurationBeats = trackEndTime - startTime;
      const renderDurationSeconds = (renderDurationBeats * 60) / bpm;
      const renderLength = Math.ceil(renderDurationSeconds * this.sampleRate);

      // Create offline context
      const offlineContext = new OfflineAudioContext(2, renderLength, this.sampleRate);

      // Render each clip
      for (const clip of clips) {
        // Skip clips outside render range
        if (clip.startTime + clip.duration < startTime) continue;
        if (clip.startTime > trackEndTime) continue;

        const clipStartSeconds = ((clip.startTime - startTime) * 60) / bpm;

        if (clip.type === 'audio') {
          // Render audio clip
          await this._renderAudioClipToContext(
            clip,
            instruments,
            offlineContext,
            clipStartSeconds,
            bpm,
            includeEffects
          );
        } else if (clip.type === 'pattern') {
          // Render pattern clip
          const pattern = patterns[clip.patternId];
          if (pattern) {
            await this._renderPatternClipToContext(
              clip,
              pattern,
              instruments,
              offlineContext,
              clipStartSeconds,
              bpm,
              includeEffects
            );
          }
        }
      }

      // Render offline context
      let renderedBuffer = await offlineContext.startRendering();

      // Normalize if requested
      if (normalize) {
        renderedBuffer = this._normalizeBuffer(renderedBuffer);
      }

      console.log(`🎬 Track rendered: ${renderedBuffer.duration.toFixed(2)}s`);
      return renderedBuffer;

    } catch (error) {
      console.error('🎬 Track render failed:', error);
      throw error;
    } finally {
      this.isRendering = false;
    }
  }

  // =================== PRIVATE HELPER METHODS ===================

  /**
   * Render instrument notes to offline context
   */
  async _renderInstrumentNotes(instrument, notes, offlineContext, bpm, includeEffects) {
    const secondsPerBeat = 60 / bpm;

    for (const note of notes) {
      const startTime = note.time * secondsPerBeat;
      const duration = (note.duration || 1) * secondsPerBeat;
      const velocity = note.velocity || 1.0;

      if (instrument.audioBuffer) {
        // Sample-based instrument
        const source = offlineContext.createBufferSource();
        source.buffer = instrument.audioBuffer;

        // Apply pitch shift if needed
        if (note.pitch !== undefined) {
          source.playbackRate.value = Math.pow(2, note.pitch / 12);
        }

        // Create gain for velocity
        const gainNode = offlineContext.createGain();
        gainNode.gain.value = velocity;

        source.connect(gainNode);

        // Apply instrument effects if enabled
        let outputNode = gainNode;
        if (includeEffects && instrument.effects) {
          outputNode = this._applyInstrumentEffects(gainNode, offlineContext, instrument.effects);
        }

        outputNode.connect(offlineContext.destination);

        // Schedule note
        source.start(startTime);
        source.stop(startTime + Math.min(duration, instrument.audioBuffer.duration));
      }
    }
  }

  /**
   * Render audio clip to offline context
   */
  async _renderAudioClipToContext(clip, instruments, offlineContext, startTime, bpm, includeEffects) {
    const instrument = instruments.get(clip.sampleId);
    if (!instrument || !instrument.audioBuffer) {
      console.warn(`🎬 Audio clip ${clip.id} has no audio buffer`);
      return;
    }

    const source = offlineContext.createBufferSource();
    source.buffer = instrument.audioBuffer;

    // Apply clip properties
    const playbackRate = clip.playbackRate || 1.0;
    source.playbackRate.value = playbackRate;

    // Create gain node
    const gainNode = offlineContext.createGain();
    const gainDb = clip.gain || 0;
    const gainLinear = Math.pow(10, gainDb / 20);
    gainNode.gain.value = gainLinear;

    // Apply fade in/out
    const fadeIn = clip.fadeIn || 0; // in beats
    const fadeOut = clip.fadeOut || 0;
    const fadeInSeconds = (fadeIn * 60) / bpm;
    const fadeOutSeconds = (fadeOut * 60) / bpm;
    const clipDurationSeconds = (clip.duration * 60) / bpm;

    if (fadeInSeconds > 0) {
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gainLinear, startTime + fadeInSeconds);
    }

    if (fadeOutSeconds > 0) {
      const fadeOutStart = startTime + clipDurationSeconds - fadeOutSeconds;
      gainNode.gain.setValueAtTime(gainLinear, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, startTime + clipDurationSeconds);
    }

    // Connect
    source.connect(gainNode);
    gainNode.connect(offlineContext.destination);

    // Play with offset
    const sampleOffsetBeats = clip.sampleOffset || 0;
    const sampleOffsetSeconds = (sampleOffsetBeats * 60) / bpm;

    source.start(startTime, sampleOffsetSeconds, clipDurationSeconds / playbackRate);
  }

  /**
   * Render pattern clip to offline context
   */
  async _renderPatternClipToContext(clip, pattern, instruments, offlineContext, startTime, bpm, includeEffects) {
    const notes = pattern.notes || [];
    const secondsPerBeat = 60 / bpm;

    for (const note of notes) {
      const noteStartTime = startTime + (note.time * secondsPerBeat);
      const noteDuration = (note.duration || 1) * secondsPerBeat;

      // Only render notes within clip duration
      if (note.time >= clip.duration) continue;

      const instrument = instruments.get(note.instrumentId);
      if (!instrument || !instrument.audioBuffer) continue;

      const source = offlineContext.createBufferSource();
      source.buffer = instrument.audioBuffer;

      if (note.pitch !== undefined) {
        source.playbackRate.value = Math.pow(2, note.pitch / 12);
      }

      const gainNode = offlineContext.createGain();
      gainNode.gain.value = note.velocity || 1.0;

      source.connect(gainNode);
      gainNode.connect(offlineContext.destination);

      source.start(noteStartTime);
      source.stop(noteStartTime + Math.min(noteDuration, instrument.audioBuffer.duration));
    }
  }

  /**
   * Calculate pattern duration in beats
   */
  _calculatePatternDuration(pattern) {
    const notes = pattern.notes || [];
    if (notes.length === 0) return 4; // Default 1 bar

    let maxTime = 0;
    for (const note of notes) {
      const noteEnd = note.time + (note.duration || 1);
      maxTime = Math.max(maxTime, noteEnd);
    }

    // Round up to nearest bar
    return Math.ceil(maxTime / 4) * 4;
  }

  /**
   * Create effect node for offline context
   */
  _createEffectNode(context, effect) {
    switch (effect.type) {
      case 'reverb':
        // Simple convolver reverb
        const reverb = context.createConvolver();
        // Would need impulse response buffer
        return reverb;

      case 'delay':
        const delay = context.createDelay(effect.time || 0.5);
        delay.delayTime.value = effect.time || 0.5;
        return delay;

      case 'filter':
        const filter = context.createBiquadFilter();
        filter.type = effect.filterType || 'lowpass';
        filter.frequency.value = effect.frequency || 1000;
        filter.Q.value = effect.q || 1;
        return filter;

      default:
        console.warn(`🎬 Unknown effect type: ${effect.type}`);
        return null;
    }
  }

  /**
   * Apply instrument effects chain
   */
  _applyInstrumentEffects(inputNode, context, effects) {
    let currentNode = inputNode;

    for (const effect of effects) {
      const effectNode = this._createEffectNode(context, effect);
      if (effectNode) {
        currentNode.connect(effectNode);
        currentNode = effectNode;
      }
    }

    return currentNode;
  }

  /**
   * Normalize audio buffer
   */
  _normalizeBuffer(buffer) {
    const numberOfChannels = buffer.numberOfChannels;
    let maxAmplitude = 0;

    // Find max amplitude across all channels
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(data[i]));
      }
    }

    // Normalize if needed
    if (maxAmplitude > 0 && maxAmplitude < 1.0) {
      const scale = 0.95 / maxAmplitude; // Leave some headroom
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < data.length; i++) {
          data[i] *= scale;
        }
      }
    }

    return buffer;
  }

  /**
   * Convert AudioBuffer to WAV Blob for download/storage
   */
  audioBufferToWav(buffer) {
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;

    const data = [];
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = buffer.getChannelData(channel)[i];
        const intSample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
        data.push(intSample < 0 ? intSample + 0x10000 : intSample);
      }
    }

    const dataLength = data.length * bytesPerSample;
    const arrayBuffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    // Write audio data
    let offset = 44;
    for (let i = 0; i < data.length; i++) {
      view.setInt16(offset, data[i], true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}

export default AudioRenderer;
