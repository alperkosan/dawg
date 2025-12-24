/**
 * 🎬 RENDER ENGINE
 *
 * High-performance audio rendering system
 * Supports real-time and offline rendering of patterns and arrangements
 */

import { AudioContextService } from '../services/AudioContextService';
import { AudioEngineGlobal } from '../core/AudioEngineGlobal';
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
import {
  ensureEffectWorkletsLoaded,
  collectEffectTypesFromMixerTracks
} from './effects/workletRegistry';
// ✅ SYNC: Import AutomationManager for automation support in offline rendering
import { getAutomationManager } from '../automation/AutomationManager';
import { UnifiedMixerNode } from '../core/UnifiedMixerNode'; // ✅ NEW: Import for Wasm mixing
import { SampleLoader } from './instruments/loaders/SampleLoader';
import { audioAssetManager } from './AudioAssetManager';
import { MixerInsert } from '../core/MixerInsert';

export class RenderEngine {
  constructor() {
    this.isRendering = false;
    this.renderQueue = [];
    // ✅ SYNC: Auto-sync sample rate with real-time audio engine
    // Try to get sample rate immediately, fallback to default if audio engine not ready
    this.sampleRate = this._getSyncedSampleRate();
    this.maxRenderTime = RENDER_CONFIG.MAX_RENDER_TIME;

    // ✅ SYNC: Auto-update sample rate when audio engine becomes available
    this._setupSampleRateSync();

    // ✅ FIX: Silent initialization - don't log during module load
    // Will be logged when actually used
  }

  /**
   * ✅ SYNC: Get sample rate synced with real-time audio engine
   * @private
   */
  _getSyncedSampleRate() {
    try {
      const syncedRate = getCurrentSampleRate();
      if (syncedRate && syncedRate > 0) {
        return syncedRate;
      }
    } catch (error) {
      // Audio engine not ready yet, use default
    }
    return 44100; // Default fallback
  }

  /**
   * ✅ SYNC: Setup automatic sample rate synchronization
   * @private
   */
  _setupSampleRateSync() {
    // Try to sync immediately
    this.updateSampleRate();

    // Also sync before each render to ensure accuracy
    // This will be called in renderPattern, renderArrangement, etc.
  }

  /**
   * ✅ SYNC: Update sample rate when audio engine becomes available
   * Now ensures sample rate matches real-time audio engine
   */
  updateSampleRate() {
    const newSampleRate = getCurrentSampleRate();
    if (newSampleRate !== this.sampleRate && newSampleRate > 0) {
      const oldRate = this.sampleRate;
      this.sampleRate = newSampleRate;
      console.log(`🎬 RenderEngine: Sample rate synced ${oldRate} → ${newSampleRate} (matches real-time engine)`);
    }
  }

  // =================== PATTERN RENDERING ===================

  /**
   * Render a pattern to audio buffer
   * @param {object} patternData - Pattern data with notes
   * @param {object} options - Render options
   * @returns {Promise<object>} Render result with audio buffer
   */
  async renderPattern(patternData, options = {}) {
    // ✅ SYNC: Ensure sample rate is synced before rendering
    this.updateSampleRate();

    const {
      sampleRate = this.sampleRate, // Use synced sample rate
      bitDepth = 16,
      includeEffects = true,
      fadeOut = true,
      length = null, // Auto-calculate if null
      startTime = 0,
      endTime = null
    } = options;

    // ✅ SYNC: Warn if sample rate doesn't match real-time engine
    const realTimeSampleRate = getCurrentSampleRate();
    if (sampleRate !== realTimeSampleRate && realTimeSampleRate > 0) {
      console.warn(`⚠️ RenderEngine: Sample rate mismatch! Render: ${sampleRate}Hz, Real-time: ${realTimeSampleRate}Hz`);
      console.warn(`   Using render sample rate: ${sampleRate}Hz (export may differ from live playback)`);
    }

    console.log(`🎬 Rendering pattern: ${patternData.name || patternData.id}`, {
      ...options,
      sampleRate: `${sampleRate}Hz (real-time: ${realTimeSampleRate}Hz)`,
      bitDepth,
      qualityPreset: options.quality ? 'Custom/Object' : 'Unknown'
    });

    try {
      this.isRendering = true;

      // 🕒 ADC PRE-CALCULATION: Determine latency before buffer creation
      const sampleRateToUse = sampleRate;
      let globalMaxLatencySamples = 0;
      const mixerTracks = patternData.mixerTracks || {};

      if (patternData.data) {
        for (const [instrumentId] of Object.entries(patternData.data)) {
          const instrumentStore = patternData.instruments?.[instrumentId];
          const mixerTrackId = instrumentStore?.mixerTrackId || 'master';
          const mixerTrack = mixerTracks[mixerTrackId];

          if (mixerTrack) {
            let totalLatency = 0;
            const effects = mixerTrack.insertEffects || mixerTrack.effects || [];
            for (const fx of effects) {
              if (!fx.bypass) {
                totalLatency += EffectFactory.getLatencySamples(fx.type, fx.settings || fx.parameters, sampleRateToUse);
              }
            }
            globalMaxLatencySamples = Math.max(globalMaxLatencySamples, totalLatency);
          }
        }
      }

      const adcOffsetSeconds = globalMaxLatencySamples / sampleRateToUse;

      // Calculate render length with safety checks (passing ADC info)
      let renderLength = length || await this._calculatePatternLength(patternData, {
        globalMaxLatency: adcOffsetSeconds,
        globalMaxLatencySamples: globalMaxLatencySamples
      });

      console.log(`🎬 DEBUG: Calculated pattern length (with ADC): ${renderLength} frames`);
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

      // ✅ WASM INTEGRATION: Check if we should use Wasm Mixer
      const audioEngine = AudioEngineGlobal.get();
      if (!audioEngine) {
        throw new Error('Audio engine not available');
      }
      const useWasmMixer = audioEngine.useWasmMixer;

      console.log(`🎬 Rendering with length: ${renderLength} frames (${renderDuration.toFixed(2)}s)`);
      if (useWasmMixer) {
        console.log('🚀 Using UnifiedMixerNode (Wasm) for offline rendering');
      }

      if (renderDuration > this.maxRenderTime) {
        throw new Error(`Render time too long: ${renderDuration}s (max: ${this.maxRenderTime}s)`);
      }

      // Create offline audio context for rendering with final validation
      console.log(`🎬 DEBUG: About to create OfflineAudioContext with: channels=2, length=${renderLength}, sampleRate=${sampleRate}`);

      // ULTIMATE SAFETY CHECK
      if (!renderLength || renderLength <= 0 || !Number.isFinite(renderLength)) {
        console.error(`🎬 FATAL: Invalid renderLength: ${renderLength}, using emergency fallback`);
        renderLength = sampleRate * RENDER_CONFIG.DEFAULT_PATTERN_LENGTH_BARS; // Default pattern length emergency fallback
      }

      const offlineContext = new OfflineAudioContext(2, renderLength, sampleRate);

      // ✅ LOAD WORKLETS: Ensure all effect processors are loaded
      await this._loadEffectWorklets(
        offlineContext,
        collectEffectTypesFromMixerTracks(patternData.mixerTracks)
      );

      // Get audio engine for instrument data
      if (!audioEngine) {
        throw new Error('Audio engine not available');
      }

      // Create master bus (instruments will connect here instead of destination)
      const masterBus = offlineContext.createGain();
      masterBus.gain.setValueAtTime(1.0, offlineContext.currentTime);

      // ✅ WASM: Initialize offline mixer if needed
      let offlineMixer = null;
      let trackToChannelMap = new Map();

      if (useWasmMixer) {
        try {
          offlineMixer = await this._createOfflineUnifiedMixer(offlineContext, patternData.mixerTracks);
          console.log('✅ Offline UnifiedMixer initialized');

          // Connect mixer to master bus
          offlineMixer.connect(masterBus);

          // Create mapping for tracks
          this._mapTracksToOfflineChannels(offlineMixer, patternData.mixerTracks, trackToChannelMap);
        } catch (err) {
          console.error('❌ Failed to create offline Wasm mixer, falling back to legacy:', err);
          // Fallback happens automatically as 'offlineMixer' remains null
        }
      }

      // 🎚️ MIXER SETUP: Create offline buses and channels (Ghost Mixer)
      // Map<busId, { input: AudioNode, output: AudioNode, effects: Array, ... }>
      const offlineBuses = await this._createOfflineBuses(offlineContext, patternData.mixerTracks, masterBus, options);

      // Render each instrument's notes (pass master bus as destination)
      const instrumentBuffers = await this._renderInstrumentNotes(
        patternData.data,
        offlineContext,
        audioEngine,
        {
          includeEffects,
          automationData: options.automationData, // Pass automation data
          patternId: patternData.id,
          startTime,
          endTime,
          patternData,
          masterBus,
          offlineMixer,
          trackToChannelMap,
          // ✅ FIX: Provide function to get bus channel for sends
          getBusChannel: (busId) => offlineBuses.get(busId)
        }
      );

      // Apply master channel effects
      // mixerTracks can be either ARRAY or OBJECT - handle both
      const masterChannel = Array.isArray(patternData.mixerTracks)
        ? patternData.mixerTracks.find(track => track.id === 'master')
        : patternData.mixerTracks?.['master'];

      console.log('🎛️ Master channel check:', {
        hasMixerTracks: !!patternData.mixerTracks,
        isArray: Array.isArray(patternData.mixerTracks),
        trackCount: Array.isArray(patternData.mixerTracks)
          ? patternData.mixerTracks.length
          : Object.keys(patternData.mixerTracks || {}).length,
        hasMaster: !!masterChannel,
        masterHasEffects: !!masterChannel?.insertEffects?.length,
        masterEffectCount: masterChannel?.insertEffects?.length || 0,
        allTrackIds: Array.isArray(patternData.mixerTracks)
          ? patternData.mixerTracks.map(t => t.id)
          : Object.keys(patternData.mixerTracks || {})
      });

      let finalOutput = masterBus;

      if (masterChannel) {
        console.log('🎛️ Applying master channel processing...');
        finalOutput = await this._createOfflineMixerChannel(offlineContext, masterBus, masterChannel);
      } else {
        console.warn('⚠️ No master channel found - skipping master effects');
      }

      // ✅ FIX: Apply master volume (matches live playback)
      // Live playback: masterGain.gain.value = 0.8 (default)
      const masterVolume = audioEngine.masterGain?.gain?.value ?? 0.8;
      if (masterVolume !== 1.0) {
        console.log(`🎚️ Applying master volume: ${masterVolume.toFixed(2)}`);
        const masterVolumeNode = offlineContext.createGain();
        masterVolumeNode.gain.setValueAtTime(masterVolume, offlineContext.currentTime);
        finalOutput.connect(masterVolumeNode);
        finalOutput = masterVolumeNode;
      }

      // Connect to destination
      finalOutput.connect(offlineContext.destination);

      // Apply post-processing (fade out on final output)
      if (fadeOut) {
        this._applyFadeOut(finalOutput, RENDER_CONFIG.DEFAULT_FADE_OUT);
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
   * Create and setup an offline UnifiedMixerNode
   * @private
   */
  async _createOfflineUnifiedMixer(offlineContext, mixerTracks) {
    const mixer = new UnifiedMixerNode(offlineContext, 32);

    // Initialize (loads Wasm)
    await mixer.initialize();

    // Map mixer tracks to channels and set params
    // We allocate channels sequentially 0..N
    let channelIdx = 0;

    // Helper to process a single track
    const configureTrack = (track) => {
      if (!track) return -1;
      if (channelIdx >= 32) return -1;

      const currentIdx = channelIdx++;

      // Apply parameters
      mixer.setChannelParams(currentIdx, {
        gain: track.volume ?? track.gain ?? 1.0,
        pan: track.pan ?? 0.0,
        mute: track.mute ?? false,
        solo: track.solo ?? false,
        eqActive: false,
        compActive: false
      });

      return currentIdx;
    };

    // If mixerTracks is array
    if (Array.isArray(mixerTracks)) {
      mixerTracks.forEach(track => {
        if (track.id !== 'master') configureTrack(track);
      });
    } else if (mixerTracks) {
      // If object
      Object.values(mixerTracks).forEach(track => {
        if (track.id !== 'master') configureTrack(track);
      });
    }

    return mixer;
  }

  /**
   * Map track IDs to allocated offline channels
   * @private
   */
  _mapTracksToOfflineChannels(offlineMixer, mixerTracks, map) {
    let channelIdx = 0;

    const mapTrack = (track) => {
      if (!track || track.id === 'master') return;
      if (channelIdx >= 32) return;
      map.set(track.id, channelIdx);
      channelIdx++;
    };

    if (Array.isArray(mixerTracks)) {
      mixerTracks.forEach(track => mapTrack(track));
    } else if (mixerTracks) {
      Object.values(mixerTracks).forEach(track => mapTrack(track));
    }
  }

  /**
   * 🚀 STREAMING RENDER: Render arrangement in a single pass
   * Replaces legacy pattern stitching with continuous signal path rendering
   */
  async renderArrangement(patternSequence, options = {}) {
    console.log(`🎬 Rendering arrangement with ${patternSequence.length} pattern occurrences (Streaming Mode)`);

    if (!patternSequence || patternSequence.length === 0) {
      throw new Error('Arrangement is empty');
    }

    // 1. Pre-sync sample rate
    this.updateSampleRate();
    const sampleRate = options.sampleRate || this.sampleRate;
    const bpm = getCurrentBPM();

    try {
      this.isRendering = true;

      // 2. TIMELINE ANALYSIS: Find max duration and collect all required tracks/instruments
      let maxArrangementDuration = 0;
      const allEffectTypes = new Set();
      const allMixerTracks = new Map(); // id -> trackData
      const allInstruments = new Map(); // id -> instrumentData

      for (const { patternData, startTime, duration } of patternSequence) {
        // ✅ TIMING FIX: Convert beats/steps to seconds if they aren't already
        // In the arrangement, startTime is usually beats.
        const startTimeSeconds = beatsToSeconds(startTime, bpm);
        const durationSeconds = duration ? beatsToSeconds(duration, bpm) : 0;

        const endTimeSeconds = startTimeSeconds + durationSeconds;
        maxArrangementDuration = Math.max(maxArrangementDuration, endTimeSeconds);

        // Collect effect types for worklet pre-loading
        if (patternData.mixerTracks) {
          collectEffectTypesFromMixerTracks(patternData.mixerTracks).forEach(t => allEffectTypes.add(t));
          Object.entries(patternData.mixerTracks).forEach(([id, track]) => {
            if (!allMixerTracks.has(id)) allMixerTracks.set(id, track);
          });
        }

        if (patternData.instruments) {
          Object.entries(patternData.instruments).forEach(([id, inst]) => {
            if (!allInstruments.has(id)) allInstruments.set(id, inst);
          });
        }
      }

      // Add padding for tails (5 seconds default or based on max release)
      const renderDurationSeconds = maxArrangementDuration + 5.0;
      const renderLength = Math.ceil(renderDurationSeconds * sampleRate);

      console.log(`🎬 Arrangement Timeline: ${maxArrangementDuration.toFixed(2)}s. Rendering ${renderDurationSeconds.toFixed(2)}s with tails.`);

      // 3. CREATE OFFLINE CONTEXT
      const offlineContext = new OfflineAudioContext(2, renderLength, sampleRate);

      // 4. LOAD WORKLETS
      await this._loadEffectWorklets(offlineContext, Array.from(allEffectTypes));

      // 5. SETUP MIXER (GHOSTS)
      const masterBus = offlineContext.createGain();
      masterBus.connect(offlineContext.destination);

      const ghostMixer = new Map(); // trackId -> MixerInsert
      for (const [trackId, trackData] of allMixerTracks) {
        const insert = new MixerInsert(offlineContext, trackId, trackData.name);
        await insert.loadState(trackData, EffectFactory);
        insert.output.connect(masterBus);
        ghostMixer.set(trackId, insert);
      }

      // 6. SETUP INSTRUMENTS (GHOSTS)
      const ghostInstruments = new Map(); // instrumentId -> { instrument, outputNode }
      // This will be populated lazily or upfront. For streaming, upfront is better for resource planning.

      // 7. MULTI-PASS SCHEDULING: Iterate sequence and schedule notes
      const audioEngine = AudioEngineGlobal.get();

      for (const { patternData, startTime: patternStartTimeBeats, duration } of patternSequence) {
        const patternStartTimeSeconds = beatsToSeconds(patternStartTimeBeats, bpm);
        const innerPatternData = patternData.data || {};

        for (const [instrumentId, notes] of Object.entries(innerPatternData)) {
          if (!notes || notes.length === 0) continue;

          const instrumentStore = allInstruments.get(instrumentId);
          const mixerTrackId = instrumentStore?.mixerTrackId || 'master';
          const ghostInsert = ghostMixer.get(mixerTrackId);
          const destination = ghostInsert ? ghostInsert.input : masterBus;

          // Lazy initialize instrument if not exists
          if (!ghostInstruments.has(instrumentId)) {
            const instrumentConfig = instrumentStore || { type: 'sample' };
            const instrument = await this._createGhostInstrument(offlineContext, instrumentConfig);
            if (instrument) {
              instrument.output.connect(destination);
              ghostInstruments.set(instrumentId, instrument);
            }
          }

          const instrument = ghostInstruments.get(instrumentId);
          if (!instrument) continue;

          // Schedule each note with timeline offset
          for (const note of notes) {
            // ✅ FIX: Use unified scheduling that combines pattern offset + note local time
            const noteWithOffset = { ...note, startTimeSecondsOverride: patternStartTimeSeconds };
            await this._scheduleInstrumentNoteOnTimeline(instrument, noteWithOffset, offlineContext, options);
          }
        }
      }

      // 8. RENDER
      const renderedBuffer = await offlineContext.startRendering();
      this.isRendering = false;

      console.log(`🎬 Arrangement rendered successfully: ${renderedBuffer.duration.toFixed(2)}s`);
      return {
        audioBuffer: renderedBuffer,
        duration: renderedBuffer.duration,
        sampleRate: renderedBuffer.sampleRate,
        patterns: patternSequence.length,
        renderTime: Date.now()
      };

    } catch (error) {
      this.isRendering = false;
      console.error('🎬 Arrangement render failed:', error);
      throw error;
    }
  }

  /**
   * 🏗️ GHOST INSTRUMENT: Create a non-disposable instrument for streaming render
   * @private
   */
  async _createGhostInstrument(context, config) {
    const type = config.type || (config.audioBuffer || config.buffer ? 'sample' : 'unknown');

    try {
      if (type === 'vasynth') {
        const { VASynth } = await import('./synth/VASynth.js');
        const instrument = new VASynth(context);

        // ✅ FIX: Prioritize live settings from export snapshot
        if (config.settings) {
          // Apply live settings (includes all user modifications)
          console.log(`🎹 Loading VASynth with live settings:`, Object.keys(config.settings));
          if (typeof instrument.loadSettings === 'function') {
            instrument.loadSettings(config.settings);
          } else {
            // Fallback: apply settings manually
            Object.assign(instrument, config.settings);
          }
        } else if (config.preset) {
          // Fallback to preset if no live settings
          console.log(`🎹 Loading VASynth with preset:`, config.preset.name || 'Custom');
          instrument.loadPreset(config.preset);
        } else {
          // Last resort: use config as preset
          instrument.loadPreset(config);
        }

        return { instrument, type: 'vasynth', output: instrument.masterGain };
      }

      if (type === 'zenith') {
        const { ZenithSynth } = await import('./synth/ZenithSynth.js');
        const bpm = getCurrentBPM();
        const instrument = new ZenithSynth(context, bpm);

        // ✅ FIX: Prioritize live settings from export snapshot
        if (config.settings) {
          console.log(`🎹 Loading Zenith with live settings:`, Object.keys(config.settings));
          if (typeof instrument.loadSettings === 'function') {
            instrument.loadSettings(config.settings);
          } else {
            Object.assign(instrument, config.settings);
          }
        } else if (config.preset) {
          console.log(`🎹 Loading Zenith with preset:`, config.preset.name || 'Custom');
          instrument.loadPreset(config.preset);
        } else {
          instrument.loadPreset(config);
        }

        return { instrument, type: 'zenith', output: instrument.masterGain };
      }

      if (type === 'sample' || type === 'sampler') {
        const { InstrumentFactory } = await import('./instruments/InstrumentFactory.js');

        // ✅ ROBUST BUFFER LOOKUP: Ensure we find the sample even if deeply nested
        let buffer = config.audioBuffer || config.buffer;

        if (!buffer) {
          const assetKey = config.url ||
            (config.data && config.data.url) ||
            config.assetId ||
            (config.samples && config.samples[0] && config.samples[0].url);

          if (assetKey) {
            console.log(`🏗️ Ghost Instrument: Resolving buffer for key: ${assetKey.substring(0, 100)}...`);

            // ✅ FIX: Handle base64 data URLs (AI-generated instruments)
            if (assetKey.startsWith('data:')) {
              console.log(`🏗️ Decoding base64 data URL for AI instrument...`);
              try {
                // Convert data URL to ArrayBuffer
                const response = await fetch(assetKey);
                const arrayBuffer = await response.arrayBuffer();

                // Decode audio data
                buffer = await context.decodeAudioData(arrayBuffer);
                console.log(`✅ Successfully decoded AI instrument buffer: ${buffer.duration.toFixed(2)}s`);
              } catch (error) {
                console.error(`❌ Failed to decode base64 audio data:`, error);
              }
            } else {
              // Try ID lookup first (for frozen patterns)
              buffer = audioAssetManager.getAsset(assetKey)?.buffer;

              // Try URL lookup
              if (!buffer) {
                buffer = audioAssetManager.getAssetByUrl(assetKey)?.buffer;
              }

              // Try SampleLoader cache
              if (!buffer) {
                buffer = SampleLoader.getCached(assetKey);
              }

              if (!buffer) {
                // Last attempt: fetch via AssetManager (might trigger async load)
                console.log(`🏗️ Ghost Instrument: Asset not in cache, attempting async load: ${assetKey}`);
                buffer = await audioAssetManager.loadAsset(assetKey);
              }
            }
          }
        }

        if (!buffer) {
          console.warn(`⚠️ Ghost Instrument: Could not resolve audio buffer for ${config.name || 'unknown sample'}`);
        }

        const instrument = await InstrumentFactory.createPlaybackInstrument(
          config,
          context,
          { existingBuffer: buffer }
        );

        // SingleSampleInstrument usually has an output node (gain or filter)
        // MultiSampleInstrument has an output gain node
        const output = instrument.output || instrument.masterGain || instrument.gainNode;

        return { instrument, type: 'sample', output };
      }

      console.warn(`🏗️ Ghost instrument for ${type} not fully implemented yet`);
    } catch (err) {
      console.error(`❌ Failed to create ghost instrument ${type}:`, err);
    }

    return null;
  }

  /**
   * 🎹 TIMELINE SCHEDULING: Schedule note on absolute timeline
   * Unified for all instrument types
   * @private
   */
  async _scheduleInstrumentNoteOnTimeline(ghostEntry, note, context, options) {
    const { instrument } = ghostEntry;
    const bpm = getCurrentBPM();

    // ✅ FIX: Calculate absolute start time (Timeline Offset + Note Local Offset)
    const timelineOffsetSeconds = note.startTimeSecondsOverride ?? 0;
    const noteLocalSteps = note.startTime ?? note.time ?? 0;
    const noteLocalSeconds = beatsToSeconds(stepsToBeat(noteLocalSteps), bpm);

    let timelineStartSeconds = timelineOffsetSeconds + noteLocalSeconds;

    // Apply ADC delay relative to the global render
    timelineStartSeconds += options.adcDelay || 0;

    // Duration
    const rawDuration = note.length ?? note.duration ?? 1;
    const noteDurationBeats = typeof rawDuration === 'number'
      ? stepsToBeat(rawDuration)
      : this._durationToBeats(rawDuration);
    const noteLength = beatsToSeconds(noteDurationBeats, bpm);

    // Pitch
    const pitchValue = note.pitch ?? note.note;
    let midiNote = 60;
    if (typeof pitchValue === 'string') {
      midiNote = this._noteNameToMidi(pitchValue);
    } else if (typeof pitchValue === 'number') {
      midiNote = pitchValue;
    }

    // Velocity
    const velocity = note.velocity ?? 1;
    const midiVelocity = Math.round(velocity * 127);

    const stopTime = timelineStartSeconds + noteLength;

    // Unified MIDI Interface (Standardized in Phase 1)
    if (instrument.noteOn) {
      instrument.noteOn(midiNote, midiVelocity, timelineStartSeconds);
    }

    if (instrument.noteOff) {
      // Some instruments handle duration inside noteOn, but we provide noteOff for safety
      instrument.noteOff(stopTime);
    }
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

      // ✅ LOAD WORKLETS: Ensure all effect processors are loaded
      const inlineEffects =
        Array.isArray(effects) ? effects.map(effect => effect?.type || effect?.workletName) : [];
      await this._loadEffectWorklets(offlineContext, inlineEffects);

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
      if (effects && effects.length > 0) {
        currentNode = await this._applyEffectChain(effects, gainNode, offlineContext);
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

      // ✅ LOAD WORKLETS: Ensure all effect processors are loaded
      await this._loadEffectWorklets(offlineContext);

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
            // Use existing renderPattern logic to get a buffer
            // This ensures we use the full engine capabilities (VASynth, Worklets, etc.)
            const result = await this.renderPattern(pattern, {
              sampleRate: this.sampleRate,
              includeEffects: includeEffects,
              length: (clip.duration * 60 / bpm) * this.sampleRate // Limit to clip duration
            });

            if (result && result.audioBuffer) {
              const source = offlineContext.createBufferSource();
              source.buffer = result.audioBuffer;
              source.connect(offlineContext.destination);
              source.start(clipStartSeconds);
            }
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

  // =================== INSTRUMENT RENDERING ===================

  /**
   * Render individual instrument notes using Ghost Instruments (Optimized)
   */
  async _renderInstrumentNotes(patternData, offlineContext, audioEngine, options) {
    const instrumentBuffers = [];
    const mixerTracks = options.patternData?.mixerTracks || {};
    const masterBusNode = options.masterBus || offlineContext.destination;

    // 🕒 ADC: Calculate track latencies and global max latency
    const sampleRate = offlineContext.sampleRate;
    const trackLatencies = new Map(); // trackId -> latencySamples
    let globalMaxLatencySamples = 0;

    for (const [instrumentId] of Object.entries(patternData)) {
      const instrumentStore = options.patternData.instruments?.[instrumentId];
      const mixerTrackId = instrumentStore?.mixerTrackId || 'master';
      const mixerTrack = mixerTracks[mixerTrackId];

      if (mixerTrack) {
        let totalLatency = 0;
        const effects = mixerTrack.insertEffects || mixerTrack.effects || [];
        for (const fx of effects) {
          if (!fx.bypass) {
            totalLatency += EffectFactory.getLatencySamples(fx.type, fx.settings || fx.parameters, sampleRate);
          }
        }
        trackLatencies.set(mixerTrackId, totalLatency);
        globalMaxLatencySamples = Math.max(globalMaxLatencySamples, totalLatency);
      }
    }

    const adcOffsetSeconds = globalMaxLatencySamples / sampleRate;
    console.log(`🕒 ADC: Global Max Latency is ${globalMaxLatencySamples} samples (${(adcOffsetSeconds * 1000).toFixed(2)}ms)`);

    const ghostInstruments = new Map(); // instrumentId -> { instrument, output }

    for (const [instrumentId, notes] of Object.entries(patternData)) {
      if (!notes || notes.length === 0) continue;

      const instrumentStore = options.patternData.instruments?.[instrumentId];
      if (!instrumentStore) {
        console.warn(`🎬 Instrument ${instrumentId} data not found in patternData`);
        continue;
      }

      const mixerTrackId = instrumentStore?.mixerTrackId || 'master';

      // ✅ FIX: Check if instrument or mixer track is muted (check all property variants)
      const mixerTrack = mixerTracks[mixerTrackId];
      const isInstrumentMuted = instrumentStore?.muted || instrumentStore?.mute || instrumentStore?.isMuted;
      const isMixerTrackMuted = mixerTrack?.muted || mixerTrack?.mute;

      if (isInstrumentMuted || isMixerTrackMuted) {
        console.log(`🔇 Skipping muted instrument ${instrumentId} (instrument muted: ${isInstrumentMuted}, track muted: ${isMixerTrackMuted})`);
        continue;
      }

      const instrumentLatency = trackLatencies.get(mixerTrackId) || 0;
      const instrumentAdcDelay = (globalMaxLatencySamples - instrumentLatency) / sampleRate;

      const optionsWithAdc = {
        ...options,
        adcDelay: instrumentAdcDelay,
        globalMaxLatency: adcOffsetSeconds
      };

      try {
        // 🏗️ GHOST INSTRUMENT: Reuse or create instrument once per pattern
        if (!ghostInstruments.has(instrumentId)) {
          const ghost = await this._createGhostInstrument(offlineContext, instrumentStore);
          if (ghost) {
            // Connect to correct mixer channel or bus
            const ghostInsert = options.getBusChannel ? options.getBusChannel(mixerTrackId) : null;
            const destination = ghostInsert ? ghostInsert.input : masterBusNode;
            ghost.output.connect(destination);
            ghostInstruments.set(instrumentId, ghost);
          }
        }

        const ghost = ghostInstruments.get(instrumentId);
        if (!ghost) {
          console.error(`🎬 Failed to create ghost for ${instrumentId}`);
          continue;
        }

        // Schedule notes
        for (const note of notes) {
          // ✅ FIX: For renderPattern, the timeline offset is 0. 
          // The scheduler will add the note's local time correctly.
          const noteWithOffset = { ...note, startTimeSecondsOverride: 0 };
          await this._scheduleInstrumentNoteOnTimeline(ghost, noteWithOffset, offlineContext, optionsWithAdc);
        }

        console.log(`🎬 Successfully scheduled instrument ${instrumentId} with ${notes.length} notes`);
      } catch (error) {
        console.warn(`🎬 Failed to render instrument ${instrumentId}:`, error);
      }
    }

    return Array.from(ghostInstruments.values());
  }

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

    // Apply effects if needed (though audio clips usually don't have per-clip effects in this model,
    // but if they did, we'd apply them here)

    gainNode.connect(offlineContext.destination);

    // Play with offset
    const sampleOffsetBeats = clip.sampleOffset || 0;
    const sampleOffsetSeconds = (sampleOffsetBeats * 60) / bpm;

    source.start(startTime, sampleOffsetSeconds, clipDurationSeconds / playbackRate);
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
  async _calculatePatternLength(patternData, options) {
    // Calculate from notes (ALWAYS - ignore pattern.settings.length as it's unreliable)
    let maxTimeBeats = 0;
    const patternDataObj = patternData?.data || {};

    // 🎹 SYNTH RELEASE: Track maximum release time from synth instruments
    let maxReleaseTimeSeconds = 0;

    // Import preset library once
    let getPreset = null;
    try {
      const presets = await import('./synth/presets.js');
      getPreset = presets.getPreset;
    } catch (e) {
      console.warn('Could not load presets for release time calculation');
    }

    // Get global max latency and ADC offset from options
    const globalMaxLatencySamples = options.globalMaxLatencySamples || 0;
    const adcOffsetSeconds = options.globalMaxLatency || 0; // This is globalMaxLatencySamples / sampleRate

    for (const [instrumentId, notes] of Object.entries(patternDataObj)) {
      if (!Array.isArray(notes)) continue;

      // Check if this is a synth instrument with release envelope
      const instrumentStore = patternData.instruments?.[instrumentId];
      if ((instrumentStore?.type === 'vasynth' || instrumentStore?.type === 'zenith') && getPreset) {
        // ✅ FIX: Check both instrument settings (user overrides) AND preset library
        let releaseTime = 0.3; // Engine default floor (from ADSREnvelope.js)

        // 1. Try to get release from current instrument settings (highest priority)
        const settings = instrumentStore.settings || instrumentStore.data?.settings;
        const ampEnv = settings?.amplitudeEnvelope || settings?.ampEnvelope;

        if (ampEnv?.release !== undefined) {
          releaseTime = Math.max(releaseTime, parseFloat(ampEnv.release));
        } else {
          // 2. Fallback to preset library if no override exists
          const presetName = instrumentStore?.presetName || instrumentStore?.data?.presetName;
          if (presetName) {
            const preset = getPreset(presetName);
            const presetRelease = preset?.amplitudeEnvelope?.release ?? preset?.ampEnvelope?.release;
            if (presetRelease !== undefined) {
              releaseTime = Math.max(releaseTime, parseFloat(presetRelease));
            }
          }
        }

        maxReleaseTimeSeconds = Math.max(maxReleaseTimeSeconds, releaseTime);
        console.log(`🎹 Detected ${instrumentStore.type} "${instrumentId}" release: ${releaseTime.toFixed(3)}s`);
      } else if (instrumentStore?.type === 'synth') {
        // Legacy synth
        const releaseTime = instrumentStore?.synthParams?.envelope?.release || 0.3;
        maxReleaseTimeSeconds = Math.max(maxReleaseTimeSeconds, releaseTime);
      }

      for (const note of notes) {
        // Support both 'time' and 'startTime' for backwards compatibility
        // NOTE: time is in STEPS, convert to beats using config
        const noteStartTimeSteps = note.startTime ?? note.time ?? 0;
        const noteStartTimeBeats = stepsToBeat(noteStartTimeSteps);
        const rawDuration = note.length ?? note.duration ?? 1;

        // ✅ FIX: Handle numeric duration as steps
        const noteDuration = typeof rawDuration === 'number'
          ? stepsToBeat(rawDuration)
          : this._durationToBeats(rawDuration);

        const noteEndTimeBeats = noteStartTimeBeats + noteDuration;
        maxTimeBeats = Math.max(maxTimeBeats, noteEndTimeBeats);
      }
    }

    // 🎹 SYNTH RELEASE: Convert max release time to beats and add to padding
    const bpm = getCurrentBPM();
    // Convert seconds to beats: seconds * (BPM / 60) = beats
    const releaseTimeBeats = maxReleaseTimeSeconds * (bpm / 60);

    // 🕒 ADC PADDING: Add latency offset to padding (convert seconds to beats)
    const adcPaddingBeats = adcOffsetSeconds * (bpm / 60);

    const totalPadding = RENDER_CONFIG.PATTERN_LENGTH_PADDING + releaseTimeBeats + adcPaddingBeats;

    console.log(`🎹 Pattern length calculation:`, {
      maxReleaseTime: maxReleaseTimeSeconds.toFixed(3) + 's',
      releaseTimeBeats: releaseTimeBeats.toFixed(2) + ' beats',
      adcPaddingBeats: adcPaddingBeats.toFixed(2) + ' beats',
      totalPadding: totalPadding.toFixed(2) + ' beats'
    });

    // Add padding and round to nearest bar using config
    const totalBeats = Math.ceil((maxTimeBeats + totalPadding) / BEATS_PER_BAR) * BEATS_PER_BAR;

    // ✅ FIX: Respect calculated length if notes exist, otherwise use default
    // This prevents forcing 2-bar patterns to be 4 bars
    const finalBeats = totalBeats > 0
      ? totalBeats
      : RENDER_CONFIG.DEFAULT_PATTERN_LENGTH_BARS * BEATS_PER_BAR;

    // Convert beats to samples using current BPM (bpm already declared above)
    const totalSeconds = beatsToSeconds(finalBeats, bpm);
    const lengthInSamples = Math.ceil(totalSeconds * this.sampleRate);

    console.log(`🎬 Calculated from notes: ${finalBeats} beats (${finalBeats / BEATS_PER_BAR} bars) @ ${bpm} BPM = ${totalSeconds.toFixed(2)}s = ${lengthInSamples} samples`);

    return Math.max(lengthInSamples, 1);
  }

  /**
   * Convert Tone.js duration notation to beats (e.g., '16n' -> 0.25, '4n' -> 1, '2n' -> 2)
   * Also supports multiplication format like '4*16n' (4 times 16th note = 1 beat)
   */
  _durationToBeats(duration) {
    if (typeof duration === 'number') return duration;
    if (!duration || typeof duration !== 'string') return 1;

    // ✅ FIX: Support multiplication format like '4*16n' (4 times 16th note)
    const multiplicationMatch = duration.match(/^(\d+)\*(\d+)n$/);
    if (multiplicationMatch) {
      const [, multiplier, noteValue] = multiplicationMatch;
      const singleNoteBeats = 4 / parseInt(noteValue);
      return singleNoteBeats * parseInt(multiplier);
    }

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
        // Skip bypassed effects
        if (effectData.bypass) {
          console.log(`🎬 Skipping bypassed effect: ${effectData.type}`);
          continue;
        }

        // ✅ FIX: Normalize effect type names to match EffectFactory
        // EffectFactory uses kebab-case: 'modern-delay', 'modern-reverb'
        // But mixer stores may use PascalCase: 'ModernDelay', 'ModernReverb'
        let normalizedType = effectData.type;
        const typeMap = {
          'ModernDelay': 'modern-delay',
          'ModernReverb': 'modern-reverb',
          'Delay': 'delay',
          'Reverb': 'reverb',
          'MultiBandEQ': 'multiband-eq',
          'Clipper': 'clipper',
          'Limiter': 'limiter'
        };

        if (typeMap[normalizedType]) {
          normalizedType = typeMap[normalizedType];
          console.log(`🎬 Normalized effect type: ${effectData.type} → ${normalizedType}`);
        }

        // ✅ FIX: Ensure effect data has parameters field (from settings if needed)
        // Mixer store uses 'settings', but EffectFactory expects 'parameters'
        const normalizedEffectData = {
          ...effectData,
          type: normalizedType,
          // ✅ CRITICAL: Map 'settings' to 'parameters' for EffectFactory compatibility
          parameters: effectData.parameters || effectData.settings || {}
        };

        // Create effect instance from serialized data
        const effect = EffectFactory.deserialize(normalizedEffectData, context);

        if (!effect) {
          console.warn(`🎬 Failed to create effect: ${effectData.type} (normalized: ${normalizedType})`);
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

  /**
   * Create offline mixer channel with full processing
   * Applies: Gain, Pan, 3-band EQ, and Mixer Insert Effects
   *
   * @param {AudioContext} offlineContext - Offline audio context
   * @param {AudioNode} sourceNode - Input audio node
   * @param {Object} mixerTrack - Mixer track settings from store
   * @returns {Promise<AudioNode>} - Output node after mixer processing
   */
  async _createOfflineMixerChannel(offlineContext, sourceNode, mixerTrack) {
    if (!mixerTrack) {
      console.warn('🎛️ No mixer track provided, bypassing mixer processing');
      return sourceNode;
    }

    console.log(`🎛️ Creating offline mixer channel:`, {
      trackId: mixerTrack.id,
      trackName: mixerTrack.name,
      gain: mixerTrack.gain,
      pan: mixerTrack.pan,
      hasEffects: !!mixerTrack.effects,
      effectCount: mixerTrack.effects?.length || 0,
      effectTypes: mixerTrack.effects?.map(e => e.type),
      fullTrackData: JSON.stringify(mixerTrack, null, 2)
    });

    let currentNode = sourceNode;

    // 1. MIXER INSERT EFFECTS (match live chain: effects run pre-fader)
    const effects = mixerTrack.insertEffects || mixerTrack.effects || [];

    if (effects.length > 0) {
      console.log(`  🎛️ Applying ${effects.length} mixer insert effects (pre-fader)...`);
      console.log(`  🎛️ Effects:`, effects.map(e => `${e.type} (bypass: ${e.bypass})`));

      try {
        const effectOutput = await this._applyEffectChain(effects, currentNode, offlineContext);
        currentNode = effectOutput;
        console.log(`  ✅ Mixer effects applied`);
      } catch (error) {
        console.error(`  ❌ Failed to apply mixer effects:`, error);
      }
    } else {
      console.log(`  ℹ️ No mixer insert effects on this track`);
    }

    // 2. GAIN (Volume) – matches MixerInsert chain (effects → gain → pan)
    const gainNode = offlineContext.createGain();
    const gainValue = mixerTrack.gain !== undefined ? mixerTrack.gain : 1.0;
    gainNode.gain.setValueAtTime(gainValue, offlineContext.currentTime);
    currentNode.connect(gainNode);
    currentNode = gainNode;
    console.log(`  ✅ Gain: ${gainValue.toFixed(2)} (${mixerTrack.gain !== undefined ? 'from insert' : 'default unity'})`);

    // 3. PAN (Stereo positioning)
    if (mixerTrack.pan !== undefined && mixerTrack.pan !== 0) {
      const panNode = offlineContext.createStereoPanner();
      panNode.pan.setValueAtTime(mixerTrack.pan, offlineContext.currentTime);
      currentNode.connect(panNode);
      currentNode = panNode;
      console.log(`  ✅ Pan: ${mixerTrack.pan.toFixed(2)}`);
    }

    // 4. 3-BAND EQ (Low/Mid/High)
    const hasEQ = (mixerTrack.lowGain && mixerTrack.lowGain !== 0) ||
      (mixerTrack.midGain && mixerTrack.midGain !== 0) ||
      (mixerTrack.highGain && mixerTrack.highGain !== 0);

    if (hasEQ) {
      // Low shelf (bass)
      if (mixerTrack.lowGain !== undefined && mixerTrack.lowGain !== 0) {
        const lowShelf = offlineContext.createBiquadFilter();
        lowShelf.type = 'lowshelf';
        lowShelf.frequency.setValueAtTime(200, offlineContext.currentTime);
        lowShelf.gain.setValueAtTime(mixerTrack.lowGain, offlineContext.currentTime);
        currentNode.connect(lowShelf);
        currentNode = lowShelf;
        console.log(`  ✅ Low EQ: ${mixerTrack.lowGain.toFixed(1)} dB`);
      }

      // Peaking (mids)
      if (mixerTrack.midGain !== undefined && mixerTrack.midGain !== 0) {
        const midPeak = offlineContext.createBiquadFilter();
        midPeak.type = 'peaking';
        midPeak.frequency.setValueAtTime(1000, offlineContext.currentTime);
        midPeak.Q.setValueAtTime(1, offlineContext.currentTime);
        midPeak.gain.setValueAtTime(mixerTrack.midGain, offlineContext.currentTime);
        currentNode.connect(midPeak);
        currentNode = midPeak;
        console.log(`  ✅ Mid EQ: ${mixerTrack.midGain.toFixed(1)} dB`);
      }

      // High shelf (treble)
      if (mixerTrack.highGain !== undefined && mixerTrack.highGain !== 0) {
        const highShelf = offlineContext.createBiquadFilter();
        highShelf.type = 'highshelf';
        highShelf.frequency.setValueAtTime(5000, offlineContext.currentTime);
        highShelf.gain.setValueAtTime(mixerTrack.highGain, offlineContext.currentTime);
        currentNode.connect(highShelf);
        currentNode = highShelf;
        console.log(`  ✅ High EQ: ${mixerTrack.highGain.toFixed(1)} dB`);
      }
    }

    console.log(`🎛️ Offline mixer channel created for ${mixerTrack.name}`);
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

  /**
   * Load all effect worklet modules into the offline context
   */
  async _loadEffectWorklets(audioContext, effectSources = []) {
    if (!audioContext) return;

    let effectTypes = [];

    if (Array.isArray(effectSources)) {
      effectTypes = effectSources.filter(Boolean);
    } else if (effectSources) {
      effectTypes = collectEffectTypesFromMixerTracks(effectSources);
    }

    await ensureEffectWorkletsLoaded(audioContext, effectTypes);
  }

  /**
   * ✅ SYNC: Apply automation to offline audio node (sample-accurate)
   * @param {Array} lanes - Automation lanes with data points
   * @param {AudioParam} audioParam - Audio parameter to automate (e.g., gain.gain)
   * @param {OfflineAudioContext} offlineContext - Offline audio context
   * @param {string} patternId - Pattern ID
   * @param {string} instrumentId - Instrument ID
   * @param {number} renderDuration - Render duration in seconds
   * @private
   */
  _applyAutomationToOfflineNode(lanes, audioParam, offlineContext, patternId, instrumentId, renderDuration) {
    const bpm = getCurrentBPM();

    // Default values for when automation ends
    const defaults = {
      7: 127,   // Volume - default to full (127 = 100%)
      10: 64,   // Pan - default to center
      11: 127,  // Expression - default to full
    };

    lanes.forEach(lane => {
      const points = lane.getPoints();
      if (!points || points.length === 0) return;

      // Get automation curve - convert step times to seconds
      const keyframes = [];

      points.forEach(point => {
        const stepTime = beatsToSeconds(stepsToBeat(point.time), bpm);
        keyframes.push({ time: stepTime, value: point.value });
      });

      // Sort by time
      keyframes.sort((a, b) => a.time - b.time);

      // Apply automation based on CC number
      switch (lane.ccNumber) {
        case 7: // Volume
          // Volume automation: normalize 0-127 to 0-1 gain
          this._applyKeyframeAutomation(
            audioParam,
            keyframes,
            renderDuration,
            (value) => value / 127, // Normalize
            defaults[7] / 127 // Default normalized
          );
          break;
        case 10: // Pan
          // Pan automation: normalize 0-127 to -1 to 1
          this._applyKeyframeAutomation(
            audioParam,
            keyframes,
            renderDuration,
            (value) => (value - 64) / 64, // Normalize to -1 to 1
            (defaults[10] - 64) / 64 // Default center
          );
          break;
        // Other automation types can be added here
      }
    });
  }

  /**
   * ✅ SYNC: Apply keyframe-based automation to audio parameter
   * @param {AudioParam} audioParam - Audio parameter to automate
   * @param {Array} keyframes - Array of {time, value} keyframes
   * @param {number} duration - Total duration in seconds
   * @param {Function} valueTransform - Transform function for values
   * @param {number} defaultValue - Default value when automation ends
   * @private
   */
  _applyKeyframeAutomation(audioParam, keyframes, duration, valueTransform, defaultValue) {
    if (keyframes.length === 0) return;

    // Set initial value
    const initialValue = valueTransform(keyframes[0].value);
    audioParam.setValueAtTime(initialValue, 0);

    // Apply linear interpolation between keyframes
    for (let i = 0; i < keyframes.length - 1; i++) {
      const current = keyframes[i];
      const next = keyframes[i + 1];

      const currentTime = current.time;
      const nextTime = next.time;
      const currentValue = valueTransform(current.value);
      const nextValue = valueTransform(next.value);

      // Linear ramp between keyframes
      audioParam.linearRampToValueAtTime(nextValue, nextTime);
    }

    // Set default value after last keyframe
    if (keyframes.length > 0) {
      const lastTime = keyframes[keyframes.length - 1].time;
      if (lastTime < duration) {
        audioParam.linearRampToValueAtTime(defaultValue, duration);
      }
    }
  }

  /**
 * Create offline bus channels for sends
 * @private
 */
  async _createOfflineBuses(offlineContext, mixerTracks, masterBus, options) {
    const offlineBuses = new Map();

    if (!mixerTracks) return offlineBuses;

    // Normalize mixerTracks to array
    const tracksArray = Array.isArray(mixerTracks)
      ? mixerTracks
      : Object.values(mixerTracks);

    // Identify busses (non-master tracks)
    const busTracks = tracksArray.filter(t => t.id !== 'master');

    console.log(`🎛️ Creating ${busTracks.length} offline buses for sends (Ghost Mixer)...`);

    for (const track of busTracks) {
      try {
        console.log(`🔍 [BUS] Creating ghost bus ${track.id} (${track.name})`);

        const ghostBus = new MixerInsert(offlineContext, track.id, track.name);
        await ghostBus.loadState(track, EffectFactory);

        // Connect to Master (or whatever the next destination is)
        // Note: In a more complex routing scenario, we would check track.outputId
        ghostBus.output.connect(masterBus);

        // Store bus entry
        offlineBuses.set(track.id, {
          input: ghostBus.input,
          output: ghostBus.output,
          ghost: ghostBus,
          track: track
        });

      } catch (error) {
        console.warn(`⚠️ Failed to create offline bus for ${track.id}:`, error);
      }
    }

    return offlineBuses;
  }
}

// ✅ SYNC: Singleton pattern for RenderEngine
// All export systems should use the same RenderEngine instance for consistency
let _renderEngineInstance = null;

/**
 * Get singleton RenderEngine instance
 * Ensures all export systems use the same RenderEngine with synchronized settings
 * @returns {RenderEngine} Singleton RenderEngine instance
 */
export function getRenderEngine() {
  if (!_renderEngineInstance) {
    _renderEngineInstance = new RenderEngine();
    console.log('🎬 RenderEngine: Created singleton instance');
  }
  return _renderEngineInstance;
}

export default RenderEngine;