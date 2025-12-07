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
import {
  ensureEffectWorkletsLoaded,
  collectEffectTypesFromMixerTracks
} from './effects/workletRegistry';
// ✅ SYNC: Import AutomationManager for automation support in offline rendering
import { getAutomationManager } from '../automation/AutomationManager';
import { UnifiedMixerNode } from '../core/UnifiedMixerNode'; // ✅ NEW: Import for Wasm mixing
import { SampleLoader } from './instruments/loaders/SampleLoader';
import { audioAssetManager } from './AudioAssetManager';

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

      // Calculate render length with safety checks
      let renderLength = length || await this._calculatePatternLength(patternData);

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

      // ✅ WASM INTEGRATION: Check if we should use Wasm Mixer
      const audioEngine = AudioContextService.getAudioEngine();
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

      // map to store offline buses
      // Map<busId, { input: AudioNode, output: AudioNode, effects: Array, ... }>
      const offlineBuses = await this._createOfflineBuses(offlineContext, patternData.mixerTracks, masterBus, options);

      // Render each instrument's notes (pass master bus as destination)
      const instrumentBuffers = await this._renderInstrumentNotes(
        patternData.data,
        offlineContext,
        audioEngine,
        {
          includeEffects,
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

    console.log(`🎬 Arrangement rendered successfully: ${renderedBuffer.duration.toFixed(2)}s`);
    return {
      audioBuffer: renderedBuffer,
      duration: renderedBuffer.duration,
      sampleRate: renderedBuffer.sampleRate,
      patterns: patternSequence.length,
      renderTime: Date.now()
    };
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
   * Render individual instrument notes
   */
  async _renderInstrumentNotes(patternData, offlineContext, audioEngine, options) {
    const instrumentBuffers = [];
    const mixerTracks = options.patternData.mixerTracks || {};
    const masterBusNode = options.masterBus || offlineContext.destination;
    const busNodeCache = new Map();

    const getBusChannel = async (busId) => {
      if (!busId) return null;
      if (busNodeCache.has(busId)) {
        return busNodeCache.get(busId);
      }

      const busTrack = mixerTracks[busId];
      if (!busTrack) {
        console.warn(`🎚️ Bus track not found for send target ${busId}`);
        console.warn(`🎚️ Available mixer tracks:`, Object.keys(mixerTracks));
        return null;
      }

      // ✅ DEBUG: Log bus track data before creating channel
      console.log(`🔍 [BUS CHANNEL] Creating bus channel ${busId}:`, {
        busId,
        trackId: busTrack.id,
        trackName: busTrack.name,
        hasInsertEffects: !!busTrack.insertEffects,
        insertEffectsCount: busTrack.insertEffects?.length || 0,
        insertEffects: busTrack.insertEffects?.map(e => `${e.type} (bypass: ${e.bypass})`),
        hasEffects: !!busTrack.effects,
        effectsCount: busTrack.effects?.length || 0,
        fullTrackData: JSON.stringify(busTrack, null, 2)
      });

      const busInput = offlineContext.createGain();
      const busOutput = await this._createOfflineMixerChannel(offlineContext, busInput, busTrack);
      busOutput.connect(masterBusNode);

      const busEntry = { input: busInput, output: busOutput };
      busNodeCache.set(busId, busEntry);
      return busEntry;
    };

    console.log('🎬 DEBUG: patternData received:', patternData);
    console.log('🎬 DEBUG: patternData entries:', Object.entries(patternData));

    // 🎚️ AUTO-GAIN: Calculate headroom based on number of instruments AND their mixer gains
    // This prevents clipping when multiple instruments play simultaneously
    const instrumentCount = Object.keys(patternData).length;

    // Calculate average mixer gain to understand the actual signal level
    let totalMixerGain = 0;
    let mixerGainCount = 0;

    for (const [instrumentId] of Object.entries(patternData)) {
      const instrumentStore = options.patternData.instruments?.[instrumentId];
      const mixerTrackId = instrumentStore?.mixerTrackId;
      const mixerTrack = mixerTrackId ? options.patternData.mixerTracks?.[mixerTrackId] : null;

      if (mixerTrack && mixerTrack.gain !== undefined) {
        totalMixerGain += mixerTrack.gain;
        mixerGainCount++;
      }
    }

    const avgMixerGain = mixerGainCount > 0 ? totalMixerGain / mixerGainCount : 0.8;

    // Auto-gain formula: compensate for number of instruments AND their mixer levels
    // If avgMixerGain is 0.8 and we have 8 instruments:
    // We need headroom for: 8 instruments × 0.8 gain = 6.4 total potential gain
    // Target: Keep total around 0.7-0.8 to prevent clipping
    const targetGain = 0.75; // Target overall gain to leave headroom
    const autoGain = instrumentCount > 0 ? targetGain / (instrumentCount * avgMixerGain) : 1.0;

    console.log(`🎚️ Auto-gain calculation:`, {
      instrumentCount,
      avgMixerGain: avgMixerGain.toFixed(3),
      autoGain: autoGain.toFixed(3),
      estimatedTotal: (instrumentCount * avgMixerGain * autoGain).toFixed(3)
    });

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
          { ...options, autoGain, getBusChannel },
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

    // ✅ NEW: Get mixer track for this instrument
    const mixerTrackId = instrumentStore?.mixerTrackId;
    const mixerTrack = mixerTrackId ? patternData.mixerTracks?.[mixerTrackId] : null;

    console.log(`🎛️ Mixer track lookup for ${instrumentId}:`, {
      mixerTrackId,
      found: !!mixerTrack,
      hasMixerTracks: !!patternData.mixerTracks,
      totalTracks: Object.keys(patternData.mixerTracks || {}).length
    });

    // ✅ WASM ROUTING: If offline mixer is active, use it!
    const offlineMixer = options.offlineMixer;
    const trackToChannelMap = options.trackToChannelMap;
    const useWasmRouting = offlineMixer && trackToChannelMap && mixerTrackId && trackToChannelMap.has(mixerTrackId);

    // ✅ SYNC: Match live playback signal chain order EXACTLY
    // Live playback (MixerInsert._rebuildChain): input → effects → gain → pan → analyzer → output
    // Render should match: effects → gain → pan (analyzer skipped - only for metering)

    // Create instrument output node (represents MixerInsert.input)
    const instrumentOutputNode = offlineContext.createGain();
    instrumentOutputNode.gain.setValueAtTime(1.0, offlineContext.currentTime);

    let instrumentGainNode;

    let sendSourceNode = null;

    if (useWasmRouting) {
      // 🚀 WASM PATH
      // If using Wasm mixer, we SKIP the JS-based Gain/Pan nodes because Wasm handles them.
      // BUT we still need to apply JS-based Insert Effects (WebAudio plugins) BEFORE Wasm.

      let currentNode = instrumentOutputNode;

      // 1. Apply JS Insert Effects (Pre-fader/Pre-Wasm)
      const effects = mixerTrack?.insertEffects || mixerTrack?.effects || [];
      if (effects.length > 0 && options.includeEffects) {
        console.log(`🎛️ Applying ${effects.length} effects to ${instrumentId} (Pre-Wasm)`);
        currentNode = await this._applyEffectChain(effects, currentNode, offlineContext);
      }

      // 2. Connect to Wasm Mixer Channel
      const channelIdx = trackToChannelMap.get(mixerTrackId);
      console.log(`🚀 Connecting ${instrumentId} -> Wasm Channel ${channelIdx}`);

      // connectToChannel expects a source node.
      offlineMixer.connectToChannel(currentNode, channelIdx);

      // Save node for sends
      sendSourceNode = currentNode;

      // In Wasm mode, audio flows to Wasm Mixer -> Master. 
      // But for consistency with legacy code which expects `instrumentGainNode` to be the "destination" 
      // where notes are played into, we use `instrumentOutputNode` (the start of the chain).
      instrumentGainNode = instrumentOutputNode;

    } else {
      // 🐢 LEGACY/JS PATH
      // This runs only if Wasm Routing is disabled.

      let currentNode = instrumentOutputNode;

      // 1. Effects first (matches MixerInsert: input → effects)
      const effects = mixerTrack?.insertEffects || mixerTrack?.effects || [];
      if (effects.length > 0 && options.includeEffects) {
        console.log(`🎛️ Applying ${effects.length} effects to ${instrumentId} (pre-fader, matches MixerInsert)`);
        currentNode = await this._applyEffectChain(effects, currentNode, offlineContext);
      }

      // 2. Gain (matches MixerInsert: effects → gain)
      const gainNode = offlineContext.createGain();
      const gainValue = mixerTrack?.gain !== undefined ? mixerTrack.gain : 0.8;
      gainNode.gain.setValueAtTime(gainValue, offlineContext.currentTime);

      // Apply automation to gain node
      if (options.automationData && options.automationData[instrumentId]) {
        const lanes = options.automationData[instrumentId];
        const patternId = options.patternId;
        const patternLength = patternData.length || 64;
        const bpm = getCurrentBPM();
        const renderDuration = beatsToSeconds(stepsToBeat(patternLength), bpm);

        this._applyAutomationToOfflineNode(
          lanes,
          gainNode.gain,
          offlineContext,
          patternId,
          instrumentId,
          renderDuration
        );
      }

      currentNode.connect(gainNode);
      currentNode = gainNode;

      // 3. Pan (matches MixerInsert: gain → pan)
      if (mixerTrack?.pan !== undefined && mixerTrack.pan !== 0) {
        const panNode = offlineContext.createStereoPanner();
        panNode.pan.setValueAtTime(mixerTrack.pan, offlineContext.currentTime);

        // Apply pan automation
        if (options.automationData && options.automationData[instrumentId]) {
          const lanes = options.automationData[instrumentId];
          const panLane = lanes.find(lane => lane.ccNumber === 10);
          if (panLane) {
            const patternLength = patternData.length || 64;
            const bpm = getCurrentBPM();
            const renderDuration = beatsToSeconds(stepsToBeat(patternLength), bpm);
            this._applyAutomationToOfflineNode(
              [panLane],
              panNode.pan,
              offlineContext,
              options.patternId,
              instrumentId,
              renderDuration
            );
          }
        }

        currentNode.connect(panNode);
        currentNode = panNode;
      }

      const mixerOutputNode = currentNode;

      // Direct connection: mixer → masterBus (matches live playback)
      const finalDestination = options.masterBus || offlineContext.destination;
      mixerOutputNode.connect(finalDestination);

      // Save node for sends
      sendSourceNode = mixerOutputNode;

      instrumentGainNode = instrumentOutputNode;
    }

    // ✅ COMMON: Apply sends (Both Wasm and Legacy paths)
    if (sendSourceNode && Array.isArray(mixerTrack?.sends) && typeof options.getBusChannel === 'function') {
      for (const send of mixerTrack.sends) {
        if (!send?.busId) continue;
        const level = typeof send.level === 'number' ? send.level : 0;
        if (level <= 0) continue;

        try {
          const busEntry = await options.getBusChannel(send.busId);
          if (!busEntry) continue;

          console.log(`🔀 Connecting Send for ${instrumentId} -> ${send.busId} (Level: ${level})`);

          const sendGainNode = offlineContext.createGain();
          sendGainNode.gain.setValueAtTime(level, offlineContext.currentTime);
          sendSourceNode.connect(sendGainNode);
          sendGainNode.connect(busEntry.input);
        } catch (error) {
          console.warn(`⚠️ Failed to route send ${send.busId} for ${instrumentId}:`, error);
        }
      }
    }

    // ✅ VASYNTH RENDERING: VASynth has its own rendering path
    if (instrument.type === 'vasynth') {
      console.log(`🎹 Rendering VASynth instrument: ${instrument.name} with ${notes.length} notes`);

      // Import VASynth classes
      const { VASynth } = await import('./synth/VASynth.js');
      const { getPreset } = await import('./synth/presets.js');

      // Get preset name from instrument data
      const presetName = instrumentStore?.presetName || instrument.data?.presetName;
      if (!presetName) {
        console.warn(`🎹 No preset found for VASynth ${instrument.name}`);
        return instrumentGainNode;
      }

      const preset = getPreset(presetName);
      if (!preset) {
        console.warn(`🎹 Preset not found: ${presetName}`);
        return instrumentGainNode;
      }

      console.log(`🎹 Rendering VASynth with preset: ${presetName}, ${notes.length} notes`);

      // ✅ FIX: Create separate VASynth instance for each note (polyphony)
      // VASynth is monophonic - multiple notes on same instance override each other
      for (const note of notes) {
        try {
          // Create new VASynth instance for this note
          const vaSynth = new VASynth(offlineContext);
          vaSynth.loadPreset(preset);
          vaSynth.masterGain.connect(instrumentGainNode);

          await this._scheduleVASynthNote(
            vaSynth,
            note,
            offlineContext,
            options
          );
        } catch (error) {
          console.warn(`🎬 Failed to schedule VASynth note:`, error);
        }
      }

      console.log(`🎹 Successfully scheduled ${notes.length} VASynth notes (polyphonic)`);
      return instrumentGainNode;
    }
    // ✅ WORKLET-BASED SYNTH RENDERING: For legacy synth instruments
    else if (instrument.type === 'synth') {
      const hasSynthParams = instrumentStore?.synthParams || instrumentStore?.oscillators;

      if (!hasSynthParams) {
        console.warn(`🎬 No synth params found for ${instrument.name}`);
        return instrumentGainNode;
      }
      console.log(`🎬 Using rendering for ${instrument.type}: ${instrument.name}`, { hasSynthParams, hasInstrumentStore: !!instrumentStore });

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

      audioOutput.connect(instrumentGainNode);

      // ✅ CRITICAL: Keep worklet node reference so it doesn't get garbage collected
      offlineContext._activeWorklets = offlineContext._activeWorklets || [];
      offlineContext._activeWorklets.push(workletNode);

      console.log(`🎬 Worklet processor created for ${instrument.name} with ${preparedNotes.length} pre-scheduled notes`);

      return instrumentGainNode;

    }
    // ✅ SAMPLE INSTRUMENTS: Use legacy rendering
    else {
      // ✅ DEBUG OBJECT STRUCTURE
      console.log(`🔍 DEBUG INSTRUMENT ${instrument.name} (${instrument.id}):`, JSON.stringify(instrument, null, 2));

      // ✅ FIX: Resolve audio buffer if missing (critical for offline export)
      if (!instrument.audioBuffer && !instrument.buffer) {
        // robust lookup for asset key
        const assetKey = instrument.url ||
          (instrument.data && instrument.data.url) ||
          instrument.assetId ||
          instrument.id ||
          (instrument.samples && instrument.samples[0] && instrument.samples[0].url);

        console.log(`🔍 DEBUG: Attempting to resolve buffer for ${instrument.name} with key: ${assetKey}`);

        if (assetKey) {
          // Check AudioAssetManager first
          const asset = audioAssetManager.getAsset(assetKey);
          if (asset && asset.buffer) {
            instrument.audioBuffer = asset.buffer;
            console.log(`🎬 Resolved audio buffer for ${instrument.name} from AssetManager`);
          } else if (SampleLoader.isCached(assetKey)) {
            instrument.audioBuffer = SampleLoader.getCached(assetKey);
            console.log(`🎬 Resolved audio buffer for ${instrument.name} from SampleLoader cache`);
          } else {
            console.warn(`⚠️ Could not resolve audio buffer for ${instrument.name} (key: ${assetKey})`);
            // Last ditch effort: check if instrument has 'buffer' property directly
            if (instrument.data && instrument.data.buffer) {
              instrument.audioBuffer = instrument.data.buffer;
              console.log(`🎬 Resolved audio buffer for ${instrument.name} from instrument.data.buffer`);
            }
          }
        } else {
          console.warn(`⚠️ No asset key found for ${instrument.name}`, instrument);
        }
      }

      // Use legacy rendering for samples
      // ✅ NEW: Apply effect chain for sample instruments
      let sampleDestination = instrumentGainNode;
      if (instrumentStore?.effectChain && instrumentStore.effectChain.length > 0) {
        console.log(`🎬 Applying ${instrumentStore.effectChain.length} effects to sample ${instrument.name}`);

        // Create intermediate node for effects
        const effectInput = offlineContext.createGain();
        const effectOutput = await this._applyEffectChain(instrumentStore.effectChain, effectInput, offlineContext);
        effectOutput.connect(instrumentGainNode);
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

      return instrumentGainNode;
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

    // ✅ FIX: Normalize velocity (handle both MIDI 0-127 and normalized 0-1 formats)
    let noteVelocity = note.velocity ?? 100; // Default to MIDI 100 if not specified
    if (noteVelocity > 1) {
      // MIDI format (0-127) - convert to normalized (0-1) with square law curve
      const velocityNormalized = Math.max(0, Math.min(127, noteVelocity)) / 127;
      noteVelocity = velocityNormalized * velocityNormalized; // Square law for natural dynamics
    }
    // else: already normalized 0-1, use as-is

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

    // Debug: Check instrument structure
    console.log(`🎬 DEBUG: Instrument details:`, {
      name: instrument.name,
      type: instrument.type,
      hasAudioBuffer: !!instrument.audioBuffer,
      hasBuffer: !!instrument.buffer,
      hasSamples: !!instrument.samples,
      hasSampleMap: !!instrument.sampleMap,
      hasData: !!instrument.data,
      allKeys: Object.keys(instrument)
    });

    // ✅ MULTI-SAMPLE INSTRUMENTS (Piano, etc.)
    // Multi-sample instruments have sampleMap with different samples per note
    if (instrument.sampleMap && instrument.sampleMap.size > 0) {
      console.log(`🎹 Rendering multi-sample instrument: ${instrument.name} for note ${note.pitch}`);

      // Convert note name to MIDI number if needed
      let midiNote;
      if (typeof note.pitch === 'string') {
        midiNote = this._noteNameToMidi(note.pitch);
        console.log(`  Converted note name "${note.pitch}" to MIDI ${midiNote}`);
      } else if (typeof note.pitch === 'number') {
        midiNote = note.pitch;
      } else {
        console.error(`❌ Invalid pitch format: ${note.pitch} (type: ${typeof note.pitch})`);
        return;
      }

      // Get the sample mapping for this specific MIDI note
      const mapping = instrument.sampleMap.get(midiNote);

      if (!mapping || !mapping.buffer) {
        console.warn(`⚠️ No sample mapping found for MIDI note ${midiNote} (${note.pitch}) in ${instrument.name}`);
        console.warn(`  Available mappings:`, Array.from(instrument.sampleMap.keys()).slice(0, 10));
        return;
      }

      console.log(`  Using sample: baseNote=${mapping.baseNote}, pitchShift=${mapping.pitchShift} semitones`);

      // Create buffer source
      const source = offlineContext.createBufferSource();
      source.buffer = mapping.buffer;

      // Apply pitch shift (playbackRate)
      const playbackRate = Math.pow(2, mapping.pitchShift / 12);
      source.playbackRate.setValueAtTime(playbackRate, startTime);

      // Apply velocity
      const gainNode = offlineContext.createGain();
      gainNode.gain.setValueAtTime(noteVelocity, startTime);
      source.connect(gainNode);
      gainNode.connect(destination);

      // Apply instrument parameters if available
      if (instrument.data) {
        // Additional pitch adjustment from instrument settings
        if (instrument.data.pitch !== undefined && instrument.data.pitch !== 0) {
          const additionalPitchShift = Math.pow(2, instrument.data.pitch / 12);
          source.playbackRate.setValueAtTime(playbackRate * additionalPitchShift, startTime);
        }

        // Pan if available
        if (instrument.data.pan !== undefined && instrument.data.pan !== 0) {
          const panNode = offlineContext.createStereoPanner();
          panNode.pan.setValueAtTime(instrument.data.pan, startTime);
          gainNode.disconnect();
          gainNode.connect(panNode);
          panNode.connect(destination);
        }
      }

      // Schedule playback
      source.start(startTime);

      // Stop after note length (for polyphonic instruments like piano, respect note duration)
      if (noteLength < mapping.buffer.duration) {
        source.stop(startTime + noteLength);
      } else {
        // Let sample play naturally if note is longer than sample
        source.stop(startTime + mapping.buffer.duration);
      }

      console.log(`  ✅ Multi-sample note scheduled: ${startTime.toFixed(3)}s, duration=${noteLength.toFixed(3)}s, velocity=${noteVelocity.toFixed(2)}`);
    }
    // ✅ SINGLE-SAMPLE INSTRUMENTS (Drums, etc.)
    // Single sample instruments use the same buffer for all notes
    else if ((instrument.type === 'sample' || instrumentType === 'sample') && (instrument.audioBuffer || instrument.buffer)) {
      console.log(`🥁 Rendering single-sample instrument: ${instrument.name}`);

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
   * Schedule VASynth note for offline rendering
   */
  async _scheduleVASynthNote(vaSynth, note, offlineContext, options) {
    // Convert note timing from steps to seconds
    const noteTimeSteps = note.startTime ?? note.time ?? 0;
    const noteTimeBeats = stepsToBeat(noteTimeSteps);

    let noteVelocity = note.velocity ?? 1;
    const rawDuration = note.length ?? note.duration ?? 1;

    // ✅ FIX: If duration is a number, it's in STEPS. Convert to beats.
    // If it's a string (e.g. '4n'), parse it using _durationToBeats.
    const noteDurationBeats = typeof rawDuration === 'number'
      ? stepsToBeat(rawDuration)
      : this._durationToBeats(rawDuration);

    const bpm = getCurrentBPM();
    const startTime = beatsToSeconds(noteTimeBeats, bpm);
    const noteLength = beatsToSeconds(noteDurationBeats, bpm);

    // Get MIDI note number
    const pitchValue = note.pitch ?? note.note;
    let midiNote = 60; // Default C4

    if (typeof pitchValue === 'string') {
      midiNote = this._noteNameToMidi(pitchValue);
    } else if (typeof pitchValue === 'number') {
      midiNote = pitchValue;
    }

    // Convert velocity to MIDI velocity (0-127)
    // Handle both normalized (0-1) and MIDI format (0-127)
    let midiVelocity;
    if (noteVelocity <= 1) {
      // Normalized format (0-1)
      midiVelocity = Math.round(noteVelocity * 127);
    } else {
      // Already in MIDI format (0-127)
      midiVelocity = Math.min(127, Math.max(0, Math.round(noteVelocity)));
    }

    const stopTime = startTime + noteLength;

    console.log(`🎹 Scheduling VASynth note: MIDI=${midiNote}, vel=${midiVelocity}, time=${startTime.toFixed(3)}s, duration=${noteLength.toFixed(3)}s, stopTime=${stopTime.toFixed(3)}s`);

    // Schedule note on and note off
    vaSynth.noteOn(midiNote, midiVelocity, startTime);
    // ✅ FIX: noteOff only takes stopTime parameter (not midiNote)
    vaSynth.noteOff(stopTime);
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
  async _calculatePatternLength(patternData) {
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

    for (const [instrumentId, notes] of Object.entries(patternDataObj)) {
      if (!Array.isArray(notes)) continue;

      // Check if this is a synth instrument with release envelope
      const instrumentStore = patternData.instruments?.[instrumentId];
      if (instrumentStore?.type === 'vasynth' && getPreset) {
        // VASynth uses amplitudeEnvelope.release
        const presetName = instrumentStore?.presetName || instrumentStore?.data?.presetName;
        if (presetName) {
          const preset = getPreset(presetName);
          if (preset?.amplitudeEnvelope?.release) {
            maxReleaseTimeSeconds = Math.max(maxReleaseTimeSeconds, preset.amplitudeEnvelope.release);
            console.log(`🎹 Found VASynth "${presetName}" with release: ${preset.amplitudeEnvelope.release}s`);
          }
        }
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
    const totalPadding = RENDER_CONFIG.PATTERN_LENGTH_PADDING + releaseTimeBeats;

    console.log(`🎹 Pattern length calculation:`, {
      maxReleaseTime: maxReleaseTimeSeconds.toFixed(3) + 's',
      releaseTimeBeats: releaseTimeBeats.toFixed(2) + ' beats',
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

    console.log(`🎛️ Creating ${busTracks.length} offline buses for sends...`);

    for (const track of busTracks) {
      try {
        // Create full channel strip for bus:
        // Input (Gain) -> Effects -> Volume (Gain) -> Pan -> Output

        // 1. Input Node (where sends connect to)
        const inputNode = offlineContext.createGain();

        // 2. Effects Chain
        let currentNode = inputNode;
        const effects = track.insertEffects || track.effects || [];

        if (effects.length > 0 && options.includeEffects) {
          currentNode = await this._applyEffectChain(effects, currentNode, offlineContext);
        }

        // 3. Volume/Gain
        const volumeNode = offlineContext.createGain();
        const gainValue = track.gain !== undefined ? track.gain : 0.8;
        volumeNode.gain.setValueAtTime(gainValue, offlineContext.currentTime);

        currentNode.connect(volumeNode);
        currentNode = volumeNode;

        // 4. Pan
        if (track.pan !== undefined && track.pan !== 0) {
          const panNode = offlineContext.createStereoPanner();
          panNode.pan.setValueAtTime(track.pan, offlineContext.currentTime);
          currentNode.connect(panNode);
          currentNode = panNode;
        }

        // 5. Connect to Master
        currentNode.connect(masterBus);

        // Store bus entry
        offlineBuses.set(track.id, {
          input: inputNode,
          output: currentNode,
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