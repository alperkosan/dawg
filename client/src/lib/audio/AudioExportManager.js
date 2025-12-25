/**
 * 🎵 AUDIO EXPORT MANAGER
 *
 * Systematic and reusable audio export/manipulation system
 * Supports pattern-to-audio, batch processing, and file management
 */

import { AudioContextService } from '../services/AudioContextService';
import { AudioEngineGlobal } from '../core/AudioEngineGlobal';
import { AudioProcessor } from './AudioProcessor';
import { FileManager } from './FileManager';
import { getRenderEngine } from './RenderEngine'; // ✅ SYNC: Use singleton RenderEngine
import { audioAssetManager } from './AudioAssetManager';
import { normalizeEffectSettings } from './effects/parameterMappings.js';
import {
  EXPORT_FORMATS,
  EXPORT_TYPES,
  EXPORT_MODE,
  QUALITY_PRESETS,
  getCurrentBPM,
  secondsToBeats,
  calculateCpuSavings,
  CPU_CONFIG,
  BEATS_PER_BAR
} from './audioRenderConfig';

// Re-export for external use
export { EXPORT_FORMATS, EXPORT_TYPES, EXPORT_MODE, QUALITY_PRESETS };

// FL Studio-style quick export presets
export const FL_PRESETS = {
  FREEZE: {
    format: EXPORT_FORMATS.WAV,
    quality: QUALITY_PRESETS.STANDARD,
    type: EXPORT_TYPES.FREEZE,
    normalize: false,
    fadeOut: false,
    includeEffects: true,
    autoReplace: true
  },
  MIXDOWN: {
    format: EXPORT_FORMATS.WAV,
    quality: QUALITY_PRESETS.HIGH,
    type: EXPORT_TYPES.PATTERN,
    normalize: true,
    fadeOut: true,
    includeEffects: true
  },
  STEMS_EXPORT: {
    format: EXPORT_FORMATS.WAV,
    quality: QUALITY_PRESETS.HIGH,
    type: EXPORT_TYPES.STEMS,
    normalize: true,
    fadeOut: false,
    includeEffects: true
  }
};

export class AudioExportManager {
  constructor() {
    this.audioProcessor = new AudioProcessor();
    this.fileManager = new FileManager();
    // ✅ SYNC: Use singleton RenderEngine for consistency across all export systems
    this.renderEngine = getRenderEngine();

    this.isExporting = false;
    this.exportQueue = [];
    this.activeExports = new Map();

    // Default export settings
    this.defaultSettings = {
      format: EXPORT_FORMATS.WAV,
      quality: QUALITY_PRESETS.STANDARD,
      type: EXPORT_TYPES.PATTERN,
      normalize: true,
      fadeOut: true,
      includeEffects: true,
      splitChannels: false
    };

    console.log('🎵 AudioExportManager initialized');
  }

  // =================== MAIN EXPORT METHODS ===================

  /**
   * Export a pattern to audio file(s)
   * @param {string} patternId - Pattern to export
   * @param {object} options - Export options
   * @returns {Promise<Array>} Array of exported file info
   */
  async exportPattern(patternId, options = {}) {
    const settings = { ...this.defaultSettings, ...options };

    console.log(`🎵 Exporting pattern ${patternId}`, settings);

    try {
      this.isExporting = true;

      // Get pattern data
      const patternData = await this._getPatternData(patternId);
      if (!patternData) {
        throw new Error(`Pattern ${patternId} not found`);
      }

      const { patternData: renderPatternData } = await this._preparePatternSnapshot(patternData, {
        includeMasterChannel: true
      });

      // Choose export strategy based on type
      switch (settings.type) {
        case EXPORT_TYPES.PATTERN:
          return await this._exportSinglePattern(renderPatternData, settings);

        case EXPORT_TYPES.CHANNELS:
          return await this._exportPatternByChannels(renderPatternData, settings);

        case EXPORT_TYPES.STEMS:
          return await this._exportPatternByStems(renderPatternData, settings);

        case EXPORT_TYPES.FREEZE:
          return await this._freezePattern(renderPatternData, settings);

        default:
          throw new Error(`Export type ${settings.type} not supported`);
      }

    } catch (error) {
      console.error('🎵 Export failed:', error);
      throw error;
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Batch export multiple patterns
   * @param {Array<string>} patternIds - Patterns to export
   * @param {object} options - Export options
   * @returns {Promise<Array>} Array of export results
   */
  async batchExportPatterns(patternIds, options = {}) {
    console.log(`🎵 Batch exporting ${patternIds.length} patterns`);

    const results = [];
    for (const patternId of patternIds) {
      try {
        const result = await this.exportPattern(patternId, options);
        results.push({ patternId, success: true, files: result });
      } catch (error) {
        results.push({ patternId, success: false, error: error.message });
      }
    }

    return results;
  }

  // =================== EXPORT STRATEGIES ===================

  /**
   * Export pattern as single audio file
   */
  async _exportSinglePattern(patternData, settings) {
    const renderResult = await this.renderEngine.renderPattern(patternData, {
      sampleRate: settings.quality.sampleRate,
      bitDepth: settings.quality.bitDepth,
      includeEffects: settings.includeEffects
    });

    // Process audio (normalize, fade, etc.)
    const processedAudio = await this.audioProcessor.processAudio(renderResult.audioBuffer, {
      normalize: settings.normalize,
      fadeOut: settings.fadeOut
    });

    // For freeze operations, skip file download and just return buffer
    if (settings.type === EXPORT_TYPES.FREEZE) {
      const fileInfo = {
        filename: `${patternData.name || 'pattern'}_frozen.wav`,
        buffer: processedAudio,
        duration: processedAudio.duration,
        sampleRate: processedAudio.sampleRate,
        type: 'audio/wav'
      };
      console.log(`🧊 Freeze: Skipping download, buffer ready for instrument creation`);
      return [fileInfo];
    }

    // For other export types, convert and download
    const audioBlob = await this._convertToFormat(processedAudio, settings.format, settings.quality);

    // Save file
    const filename = `${patternData.name || 'pattern'}_${Date.now()}.${this._getFileExtension(settings.format)}`;
    const fileInfo = await this.fileManager.saveAudioFile(audioBlob, filename);

    // Add buffer to fileInfo for freeze/instrument creation
    fileInfo.buffer = processedAudio;

    return [fileInfo];
  }

  /**
   * Export pattern split by channels/instruments
   */
  async _exportPatternByChannels(patternData, settings) {
    const channelExports = [];

    // Render each instrument separately
    for (const [instrumentId, notes] of Object.entries(patternData.data)) {
      if (!notes || notes.length === 0) continue;

      const instrumentData = {
        ...patternData,
        data: { [instrumentId]: notes }
      };

      const renderResult = await this.renderEngine.renderPattern(instrumentData, {
        sampleRate: settings.quality.sampleRate,
        bitDepth: settings.quality.bitDepth,
        includeEffects: settings.includeEffects
      });

      // Process audio
      const processedAudio = await this.audioProcessor.processAudio(renderResult.audioBuffer, {
        normalize: settings.normalize,
        fadeOut: settings.fadeOut
      });

      // Convert to format
      const audioBlob = await this._convertToFormat(processedAudio, settings.format, settings.quality);

      // Save with instrument name
      const instrumentName = await this._getInstrumentName(instrumentId);
      const filename = `${patternData.name || 'pattern'}_${instrumentName}_${Date.now()}.${this._getFileExtension(settings.format)}`;
      const fileInfo = await this.fileManager.saveAudioFile(audioBlob, filename);

      channelExports.push(fileInfo);
    }

    return channelExports;
  }

  /**
   * Export pattern grouped by stems (drums, bass, melody, etc.)
   */
  async _exportPatternByStems(patternData, settings) {
    // Group instruments by type
    const stemGroups = await this._groupInstrumentsByStems(patternData.data);
    const stemExports = [];

    for (const [stemType, instrumentIds] of Object.entries(stemGroups)) {
      if (instrumentIds.length === 0) continue;

      // Create pattern data for this stem
      const stemData = {
        ...patternData,
        data: {}
      };

      // Include only instruments in this stem
      for (const instrumentId of instrumentIds) {
        if (patternData.data[instrumentId]) {
          stemData.data[instrumentId] = patternData.data[instrumentId];
        }
      }

      // Render stem
      const renderResult = await this.renderEngine.renderPattern(stemData, {
        sampleRate: settings.quality.sampleRate,
        bitDepth: settings.quality.bitDepth,
        includeEffects: settings.includeEffects
      });

      // Process audio
      const processedAudio = await this.audioProcessor.processAudio(renderResult.audioBuffer, {
        normalize: settings.normalize,
        fadeOut: settings.fadeOut
      });

      // Convert to format
      const audioBlob = await this._convertToFormat(processedAudio, settings.format, settings.quality);

      // Save with stem name
      const filename = `${patternData.name || 'pattern'}_${stemType}_${Date.now()}.${this._getFileExtension(settings.format)}`;
      const fileInfo = await this.fileManager.saveAudioFile(audioBlob, filename);

      stemExports.push(fileInfo);
    }

    return stemExports;
  }

  // =================== FL STUDIO-STYLE METHODS ===================

  /**
   * Quick freeze pattern - FL Studio style
   * Exports pattern to audio and optionally replaces original with audio clip
   */
  async freezePattern(patternId, options = {}) {
    console.log(`🧊 Freezing pattern ${patternId} (FL Studio style)`);

    const settings = { ...FL_PRESETS.FREEZE, ...options };
    return await this.exportPattern(patternId, settings);
  }

  /**
   * Quick mixdown - High quality pattern export for final use
   */
  async quickMixdown(patternId, options = {}) {
    console.log(`🎯 Quick mixdown for pattern ${patternId}`);

    const settings = { ...FL_PRESETS.MIXDOWN, ...options };
    return await this.exportPattern(patternId, settings);
  }

  /**
   * Export stems for mixing - Split pattern into grouped stems
   */
  async exportStems(patternId, options = {}) {
    console.log(`🥁 Exporting stems for pattern ${patternId}`);

    const settings = { ...FL_PRESETS.STEMS_EXPORT, ...options };
    return await this.exportPattern(patternId, settings);
  }

  /**
   * Pattern to audio workflow - Complete FL Studio-style workflow
   * 1. Export pattern as high-quality audio
   * 2. Create audio instrument from export
   * 3. Optionally replace pattern with audio clip
   */
  async patternToAudioWorkflow(patternId, options = {}) {
    const {
      replaceOriginal = false,
      createInstrument = true,
      exportQuality = 'HIGH',
      ...exportOptions
    } = options;

    console.log(`🔄 Pattern-to-audio workflow for ${patternId}`, {
      replaceOriginal,
      createInstrument,
      exportQuality
    });

    try {
      // Step 1: Export pattern as audio
      const exportSettings = {
        ...FL_PRESETS.FREEZE,
        quality: QUALITY_PRESETS[exportQuality],
        onProgress: exportOptions.onProgress,
        ...exportOptions
      };

      if (exportOptions.onProgress) {
        exportOptions.onProgress({ message: 'Rendering pattern audio...', percent: 10 });
      }

      const exportResult = await this.exportPattern(patternId, exportSettings);

      // Calculate pattern duration in beats for metadata
      const patternData = await this._getPatternData(patternId);
      const patternBarLength = await this._getPatternBarLength(patternData);
      const durationBeats = patternBarLength * 4; // bars to beats

      console.log(`🎵 Pattern export duration calculation:`);
      console.log(`   - Pattern length: ${patternData?.length} steps`);
      console.log(`   - Bar length: ${patternBarLength} bars`);
      console.log(`   - Duration in beats: ${durationBeats} beats`);

      // Step 2: Create audio asset from exported audio (if requested)
      let assetId = null;
      if (createInstrument && exportResult.length > 0) {
        if (exportOptions.onProgress) {
          exportOptions.onProgress({ message: 'Creating audio asset...', percent: 60 });
        }
        assetId = await this._createInstrumentFromExport(exportResult[0], patternId, durationBeats);
      }

      // Step 3: Replace original pattern (if requested)
      if (replaceOriginal && assetId && exportResult.length > 0) {
        await this._replacePatternWithAudio(patternId, assetId, exportResult[0]);
      }

      // Step 4: Optionally create arrangement clip (without replacing pattern)
      let clipId = null;
      if (!replaceOriginal && createInstrument && assetId && exportResult.length > 0) {
        if (exportOptions.onProgress) {
          exportOptions.onProgress({ message: 'Adding to arrangement...', percent: 90 });
        }
        clipId = await this._createArrangementClip(patternId, assetId, exportResult[0]);
      }

      return {
        exportFiles: exportResult,
        assetId,
        clipId,
        originalPatternId: patternId,
        workflow: 'pattern-to-audio',
        cpuSavings: await this._calculateCpuSavings(patternId)
      };

    } catch (error) {
      console.error('🔄 Pattern-to-audio workflow failed:', error);
      throw error;
    }
  }

  /**
   * Batch freeze multiple patterns - Great for CPU optimization
   */
  async batchFreezePatterns(patternIds, options = {}) {
    console.log(`🧊 Batch freezing ${patternIds.length} patterns`);

    const results = [];
    for (const patternId of patternIds) {
      try {
        const result = await this.patternToAudioWorkflow(patternId, {
          replaceOriginal: true,
          createInstrument: true,
          ...options
        });
        results.push({ patternId, success: true, result });

        // Add small delay to prevent overwhelming system
        await new Promise(resolve => setTimeout(resolve, CPU_CONFIG.batchProcessingDelay));
      } catch (error) {
        results.push({ patternId, success: false, error: error.message });
      }
    }

    const successful = results.filter(r => r.success).length;
    console.log(`🧊 Batch freeze completed: ${successful}/${patternIds.length} successful`);

    return results;
  }

  // =================== INTERNAL FL WORKFLOW METHODS ===================

  /**
   * Freeze pattern implementation (internal)
   */
  async _freezePattern(patternData, settings) {
    // Same as single pattern export but with freeze-specific optimizations
    return await this._exportSinglePattern(patternData, {
      ...settings,
      // Freeze-specific optimizations
      includeEffects: true,
      normalize: true,  // ✅ FIX: Enable normalization to prevent excessive gain
      fadeOut: false   // No fade for frozen patterns
    });
  }

  /**
   * Create audio asset from exported audio file
   */
  async _createInstrumentFromExport(exportedFile, originalPatternId, durationBeats) {
    try {
      // Create asset ID
      const assetId = `asset-frozen-${originalPatternId}-${Date.now()}`;
      const name = `Frozen ${originalPatternId}`;

      // Add to AudioAssetManager (no download, just add to project)
      await audioAssetManager.addAsset({
        id: assetId,
        name: name,
        buffer: exportedFile.buffer,
        url: null, // No URL, it's a generated buffer
        type: 'audio',
        metadata: {
          frozen: true,
          originalPattern: originalPatternId,
          durationBeats: durationBeats, // ✅ Store beat-based duration
          sampleRate: exportedFile.buffer.sampleRate,
          duration: exportedFile.buffer.duration,
          numberOfChannels: exportedFile.buffer.numberOfChannels
        }
      });

      console.log(`🎹 Created audio asset ${assetId} from frozen pattern (${durationBeats} beats)`);

      // ✅ Add frozen sample to Project Audio Store (for Audio tab in arrangement)
      try {
        const { useProjectAudioStore } = await import('../../store/useProjectAudioStore');
        const projectAudioStore = useProjectAudioStore.getState();

        projectAudioStore.addSample({
          id: assetId,
          name: name,
          assetId: assetId,
          durationBeats: durationBeats,
          durationSeconds: exportedFile.buffer.duration,
          type: 'frozen',
          originalPattern: originalPatternId,
          metadata: {
            sampleRate: exportedFile.buffer.sampleRate,
            numberOfChannels: exportedFile.buffer.numberOfChannels
          }
        });

        console.log(`📦 Added frozen sample to Project Audio Store: ${name}`);
      } catch (error) {
        console.error('⚠️ Failed to add frozen sample to Project Audio Store:', error);
        // Non-critical error, don't throw
      }

      return assetId;

    } catch (error) {
      console.error('🎹 Failed to create asset from export:', error);
      throw error;
    }
  }

  /**
   * Replace pattern content with audio clip
   */
  async _replacePatternWithAudio(patternId, assetId, exportResult) {
    console.log(`🔄 Replacing pattern ${patternId} with audio asset ${assetId}`);
    console.log('🔄 exportResult:', exportResult);

    try {
      // Import arrangement workspace store (used by playback)
      const { useArrangementWorkspaceStore } = await import('../../store/useArrangementWorkspaceStore');
      const workspaceStore = useArrangementWorkspaceStore.getState();
      const arrangement = workspaceStore.getActiveArrangement();

      if (!arrangement) {
        console.error('🔄 No active arrangement');
        return false;
      }

      if (!exportResult || !exportResult.buffer) {
        console.error('🔄 No buffer in exportResult:', exportResult);
        return false;
      }

      // Get pattern data to determine actual bar length
      const patternData = await this._getPatternData(patternId);
      const patternBarLength = patternData?.settings?.barLength || 4; // Default 4 bars if not set

      // Calculate duration from pattern bar length (not from audio buffer duration)
      const durationBeats = patternBarLength * BEATS_PER_BAR;

      console.log(`🔄 Pattern bar length: ${patternBarLength} bars = ${durationBeats} beats`);
      console.log(`🔄 Audio buffer duration: ${exportResult.buffer.duration}s (ignored for clip length)`);

      // Find track ID and startTime from existing pattern clips
      const existingPatternClip = arrangement.clips.find(c => c.patternId === patternId);
      const trackId = existingPatternClip?.trackId || (arrangement.tracks[0]?.id || 'track-1');
      const originalStartTime = existingPatternClip?.startTime || 0;

      console.log(`🔄 Original pattern clip startTime: ${originalStartTime} beats`);

      // Remove all pattern-based clips for this pattern
      const patternClipsToDelete = arrangement.clips.filter(clip =>
        clip.type === 'pattern' && clip.patternId === patternId
      );

      patternClipsToDelete.forEach(clip => {
        workspaceStore.deleteClip(clip.id);
      });

      // Get arrangement track to find its mixer channel
      const arrangementTrack = arrangement.tracks.find(t => t.id === trackId);
      const mixerChannelId = arrangementTrack?.channelId || null;

      console.log(`🎛️ Audio clip routing:`, {
        trackId,
        mixerChannelId,
        arrangementTrack,
        hasArrangementTrack: !!arrangementTrack
      });

      // Create and add new frozen audio clip (preserve original startTime!)
      const audioClipData = {
        type: 'audio',
        patternId,
        assetId: assetId,
        trackId: trackId,
        channelId: mixerChannelId, // ✅ Add mixer channel for audio routing
        startTime: originalStartTime,
        duration: durationBeats,
        originalPattern: patternId,
        isFromExport: true,
        isFrozen: true,
        color: '#4a90e2',
        name: `Frozen ${patternId}`,
        metadata: {
          frozenAt: Date.now(),
          cpuSavings: { estimatedSavings: '60-80%' }
        }
      };

      const newClip = workspaceStore.addClip(audioClipData);

      console.log(`🧊 Successfully replaced pattern ${patternId} with frozen audio clip:`, {
        clipId: newClip?.id || 'unknown',
        channelId: audioClipData.channelId,
        trackId: audioClipData.trackId
      });
      return true;
    } catch (error) {
      console.error('🔄 Failed to replace pattern with audio:', error);
      return false;
    }
  }

  /**
   * Create arrangement clip from exported pattern audio
   */
  async _createArrangementClip(patternId, assetId, exportResult) {
    console.log(`🎵 Creating arrangement clip for pattern ${patternId} with asset ${assetId}`);

    try {
      // Import arrangement workspace store dynamically to avoid circular imports
      const { useArrangementWorkspaceStore } = await import('../../store/useArrangementWorkspaceStore');

      if (exportResult && exportResult.buffer) {
        // Get pattern data to determine actual bar length
        const patternData = await this._getPatternData(patternId);
        const patternBarLength = patternData?.settings?.barLength || 4; // Default 4 bars if not set

        // Calculate duration from pattern bar length (not from audio buffer duration)
        const durationBeats = patternBarLength * BEATS_PER_BAR;

        console.log(`🎵 Pattern bar length: ${patternBarLength} bars = ${durationBeats} beats`);
        console.log(`🎵 Audio buffer duration: ${exportResult.buffer.duration}s (ignored for clip length)`);

        // Get store and arrangement
        const store = useArrangementWorkspaceStore.getState();
        const arrangement = store.getActiveArrangement();

        if (!arrangement) {
          console.warn('🎵 No active arrangement');
          return null;
        }

        // Find a good placement position
        // Look for last clip end time, or start at 0
        let startTime = 0;
        let trackId = null;

        if (arrangement.clips.length > 0) {
          // Find the last ending clip
          const lastClip = arrangement.clips.reduce((latest, clip) => {
            const clipEnd = clip.startTime + clip.duration;
            const latestEnd = latest.startTime + latest.duration;
            return clipEnd > latestEnd ? clip : latest;
          });

          // Place new clip right after the last one on the same track
          startTime = lastClip.startTime + lastClip.duration;
          trackId = lastClip.trackId;
        } else {
          // No clips, use first track or create one
          trackId = arrangement.tracks.length > 0 ? arrangement.tracks[0].id : null;
          if (!trackId) {
            trackId = store.addTrack();
          }
        }

        // Get arrangement track to find its mixer channel
        const arrangementTrack = arrangement.tracks.find(t => t.id === trackId);
        const mixerChannelId = arrangementTrack?.channelId || null;

        console.log(`🎛️ Audio clip routing: trackId=${trackId}, mixerChannelId=${mixerChannelId}`);

        // Create audio clip data with assetId
        const audioClipData = {
          type: 'audio',
          assetId: assetId,
          trackId: trackId,
          channelId: mixerChannelId, // ✅ Add mixer channel for audio routing
          name: `${patternData?.name || patternId}`,
          startTime: startTime,
          duration: durationBeats,
          color: '#f59e0b'
        };

        // Add clip to arrangement
        const clipId = store.addClip(audioClipData);

        console.log(`🎵 Created arrangement clip ${clipId} at ${startTime} beats on track ${trackId}`);
        return clipId;
      }
    } catch (error) {
      console.error('🎵 Failed to create arrangement clip:', error);
      return null;
    }
  }

  /**
   * Calculate CPU savings from freezing pattern
   */
  async _calculateCpuSavings(patternId) {
    try {
      const patternData = await this._getPatternData(patternId);
      return calculateCpuSavings(patternData);
    } catch (error) {
      console.warn('🎵 Could not calculate CPU savings:', error);
      return {
        estimatedSavings: `${CPU_CONFIG.freezeSavingsPercent.min}-${CPU_CONFIG.freezeSavingsPercent.max}%`,
        reason: 'Converted MIDI + synthesis to single audio sample'
      };
    }
  }

  // =================== UTILITY METHODS ===================

  /**
   * Get pattern data from store
   */
  async _getPatternData(patternId) {
    // Import stores dynamically to avoid circular dependencies
    const { useArrangementStore } = await import('../../store/useArrangementStore');
    const { patterns } = useArrangementStore.getState();
    return patterns[patternId];
  }

  /**
   * Prepare a renderable snapshot of pattern data with instrument & mixer metadata.
   * @param {object} patternData
   * @param {object} options
   * @param {Array<string>} options.instrumentIds - restrict to these instruments
   * @param {boolean} options.includeMasterChannel - include master insert metadata (default true)
   * @returns {Promise<{ patternData: object, instrumentIds: string[] }>}
   */
  async _preparePatternSnapshot(patternData, options = {}) {
    const {
      instrumentIds = null,
      includeMasterChannel = true
    } = options;

    if (!patternData) {
      throw new Error('Pattern data is required for snapshot');
    }

    const sourceData = patternData.data || {};
    const targetInstrumentIds = instrumentIds
      ? instrumentIds.filter(Boolean)
      : Object.keys(sourceData);

    const snapshot = {
      ...patternData,
      data: {}
    };

    targetInstrumentIds.forEach(id => {
      if (sourceData[id]) {
        snapshot.data[id] = sourceData[id];
      }
    });

    const { useInstrumentsStore } = await import('../../store/useInstrumentsStore');
    const { useMixerStore } = await import('../../store/useMixerStore');
    const { instruments } = useInstrumentsStore.getState();
    const mixerState = useMixerStore.getState();
    const mixerTracks = mixerState.mixerTracks || [];
    const mixerTrackMetaMap = new Map(mixerTracks.map(track => [track.id, track]));

    const instrumentMap = {};
    const mixerTrackMap = {};
    const requiredBusIds = new Set();

    const audioEngine = AudioEngineGlobal.get();
    if (!audioEngine) {
      throw new Error('Audio engine not available');
    }

    targetInstrumentIds.forEach(instrumentId => {
      const inst = instruments.find(i => i.id === instrumentId);
      if (!inst) return;

      // ✅ FIX: Capture live instrument state from audio engine
      const liveInstrument = audioEngine.instruments?.get(instrumentId);
      const liveState = {};

      if (liveInstrument) {
        console.log(`🎹 Capturing live state for instrument: ${instrumentId} (${inst.type})`);

        // For VASynth/Zenith: capture current settings and preset
        if (inst.type === 'vasynth' || inst.type === 'zenith') {
          // ✅ FIX: Use getPreset() instead of getSettings() for synths
          if (typeof liveInstrument.getPreset === 'function') {
            liveState.preset = liveInstrument.getPreset();
            console.log(`  ✅ Captured live preset from getPreset():`, Object.keys(liveState.preset || {}));
          } else if (liveInstrument.preset) {
            // Fallback: use stored preset
            liveState.preset = liveInstrument.preset;
            console.log(`  ✅ Captured stored preset:`, liveInstrument.preset.name || 'Custom');
          }

          // ✅ FIX: Explicitly capture masterVolume (critical for gain staging)
          if (liveInstrument.masterVolume !== undefined) {
            if (!liveState.preset) liveState.preset = {};
            liveState.preset.masterVolume = liveInstrument.masterVolume;
            console.log(`  ✅ Captured masterVolume: ${liveInstrument.masterVolume}`);
          } else if (liveInstrument.masterGain?.gain?.value !== undefined) {
            // Fallback: read from masterGain node
            if (!liveState.preset) liveState.preset = {};
            liveState.preset.masterVolume = liveInstrument.masterGain.gain.value;
            console.log(`  ✅ Captured masterVolume from masterGain: ${liveInstrument.masterGain.gain.value}`);
          }

          // Capture preset name for fallback
          if (liveInstrument.presetName) {
            liveState.presetName = liveInstrument.presetName;
          }
        }

        // For samplers: capture playback settings
        if (inst.type === 'sample' || inst.type === 'sampler') {
          if (liveInstrument.sampleStart !== undefined) {
            liveState.sampleStart = liveInstrument.sampleStart;
          }
          if (liveInstrument.sampleEnd !== undefined) {
            liveState.sampleEnd = liveInstrument.sampleEnd;
          }
          if (liveInstrument.reverse !== undefined) {
            liveState.reverse = liveInstrument.reverse;
          }
          if (liveInstrument.pitch !== undefined) {
            liveState.pitch = liveInstrument.pitch;
          }
          if (liveInstrument.playbackRate !== undefined) {
            liveState.playbackRate = liveInstrument.playbackRate;
          }
          console.log(`  ✅ Captured sampler settings:`, {
            sampleStart: liveState.sampleStart,
            sampleEnd: liveState.sampleEnd,
            reverse: liveState.reverse,
            pitch: liveState.pitch
          });
        }
      }

      // ✅ FIX: Capture mute state from instrument store (check all variants)
      if (inst.isMuted !== undefined) {
        liveState.muted = inst.isMuted;  // Store uses 'isMuted', export uses 'muted'
      } else if (inst.muted !== undefined) {
        liveState.muted = inst.muted;
      } else if (inst.mute !== undefined) {
        liveState.muted = inst.mute;
      }

      // Merge live state with static metadata (live state takes priority)
      instrumentMap[instrumentId] = {
        ...inst,
        ...liveState
      };

      // Serialize mixer track for this instrument
      const mixerTrackId = inst.mixerTrackId;
      if (
        mixerTrackId &&
        audioEngine.mixerInserts &&
        !mixerTrackMap[mixerTrackId]
      ) {
        const insert = audioEngine.mixerInserts.get(mixerTrackId);
        if (insert) {
          const trackMeta = mixerTrackMetaMap.get(mixerTrackId);
          const serialized = this._serializeInsert(insert, mixerTrackId, { trackMeta });
          mixerTrackMap[mixerTrackId] = serialized;

          if (Array.isArray(serialized.sends)) {
            serialized.sends.forEach(send => send?.busId && requiredBusIds.add(send.busId));
          }
        }
      }
    });

    if (includeMasterChannel) {
      const masterInsert = audioEngine.mixerInserts?.get('master');
      if (masterInsert) {
        mixerTrackMap['master'] = this._serializeInsert(masterInsert, 'master', {
          trackMeta: mixerTrackMetaMap.get('master'),
          forceType: 'master'
        });
      }
    }

    // ✅ FIX: Ensure bus inserts referenced by sends are included
    // Bus channel'ların efektleri de dahil edilmeli
    for (const busId of requiredBusIds) {
      if (mixerTrackMap[busId]) {
        // Bus channel zaten eklenmiş, efektlerinin doğru şekilde serialize edildiğinden emin ol
        console.log(`🔍 [BUS] Bus channel ${busId} already in mixerTrackMap, checking effects...`);
        const existingBus = mixerTrackMap[busId];
        console.log(`🔍 [BUS] Existing bus data:`, {
          busId,
          hasInsertEffects: !!existingBus.insertEffects,
          insertEffectsCount: existingBus.insertEffects?.length || 0,
          insertEffects: existingBus.insertEffects
        });

        if (!existingBus.insertEffects || existingBus.insertEffects.length === 0) {
          // Bus channel'ın efektleri eksik, yeniden serialize et
          const busInsert = audioEngine.mixerInserts?.get(busId);
          if (busInsert) {
            const trackMeta = mixerTrackMetaMap.get(busId);
            console.log(`🔄 [BUS] Re-serializing bus channel ${busId} to include effects...`);
            console.log(`🔍 [BUS] Bus insert data:`, {
              hasEffectsMap: !!busInsert.effects,
              effectsSize: busInsert.effects?.size || 0,
              effectsEntries: busInsert.effects ? Array.from(busInsert.effects.entries()).map(([id, e]) => ({
                id,
                type: e.type,
                bypass: e.bypass
              })) : [],
              trackMeta: trackMeta ? {
                id: trackMeta.id,
                name: trackMeta.name,
                hasEffects: !!trackMeta.insertEffects,
                effectsCount: trackMeta.insertEffects?.length || 0
              } : null
            });

            mixerTrackMap[busId] = this._serializeInsert(busInsert, busId, {
              trackMeta,
              forceType: trackMeta?.type || (busId?.startsWith('bus-') ? 'bus' : undefined)
            });
            console.log(`✅ [BUS] Bus channel ${busId} re-serialized with ${mixerTrackMap[busId].insertEffects?.length || 0} effects`);
          } else {
            console.warn(`⚠️ [BUS] Bus insert ${busId} not found in audio engine for re-serialization`);
          }
        }
        continue;
      }

      const busInsert = audioEngine.mixerInserts?.get(busId);
      if (!busInsert) {
        console.warn(`⚠️ [BUS] Bus insert ${busId} not found in audio engine`);
        continue;
      }

      const trackMeta = mixerTrackMetaMap.get(busId);
      console.log(`🔍 [BUS] Serializing new bus channel ${busId}:`, {
        hasInsert: !!busInsert,
        hasEffectsMap: !!busInsert.effects,
        effectsSize: busInsert.effects?.size || 0,
        hasTrackMeta: !!trackMeta,
        trackMetaEffects: trackMeta?.insertEffects?.length || 0
      });

      const serializedBus = this._serializeInsert(busInsert, busId, {
        trackMeta,
        forceType: trackMeta?.type || (busId?.startsWith('bus-') ? 'bus' : undefined)
      });
      mixerTrackMap[busId] = serializedBus;
      console.log(`✅ [BUS] Added bus channel ${busId} with ${serializedBus.insertEffects?.length || 0} effects`);
    }

    snapshot.instruments = instrumentMap;
    snapshot.mixerTracks = mixerTrackMap;

    return {
      patternData: snapshot,
      instrumentIds: targetInstrumentIds
    };
  }

  _serializeInsert(insert, mixerTrackId, { trackMeta = null, forceType, sends: overrideSends } = {}) {
    // ✅ DEBUG: Log effect serialization for bus channels
    const isBusChannel = mixerTrackId?.startsWith('bus-');
    const effectsMap = insert.effects;
    const effectsSize = effectsMap?.size || 0;

    if (isBusChannel) {
      console.log(`🔍 [SERIALIZE] Bus channel ${mixerTrackId}:`, {
        hasEffectsMap: !!effectsMap,
        effectsSize,
        effectsEntries: effectsMap ? Array.from(effectsMap.entries()).map(([id, e]) => ({
          id,
          type: e.type,
          bypass: e.bypass
        })) : [],
        insertType: insert.constructor?.name,
        insertKeys: Object.keys(insert || {})
      });
    }

    const insertEffects = effectsMap && effectsSize > 0
      ? Array.from(effectsMap.entries()).map(([effectId, effect]) => {
        const serialized = {
          id: effectId,
          type: effect.type,
          bypass: effect.bypass || false,
          settings: normalizeEffectSettings(effect.type, effect.settings || {})
        };

        if (isBusChannel) {
          console.log(`  ✅ Serialized bus effect: ${effectId} (${effect.type})`);
        }

        return serialized;
      })
      : [];

    if (isBusChannel && insertEffects.length === 0) {
      console.warn(`⚠️ [SERIALIZE] Bus channel ${mixerTrackId} has NO effects!`, {
        hasEffectsMap: !!effectsMap,
        effectsSize,
        insertType: insert.constructor?.name
      });
    }

    const serialized = {
      id: mixerTrackId,
      name: insert.label || mixerTrackId,
      gain: insert.gainNode?.gain?.value ?? 1,
      pan: insert.panNode?.pan?.value ?? 0,
      mute: trackMeta?.mute || trackMeta?.muted || false,  // ✅ FIX: Capture mute state
      lowGain: trackMeta?.eq?.low ?? 0,
      midGain: trackMeta?.eq?.mid ?? 0,
      highGain: trackMeta?.eq?.high ?? 0,
      type: forceType || trackMeta?.type || (isBusChannel ? 'bus' : 'track'),
      insertEffects
    };

    const sends = overrideSends ?? this._serializeSends(insert, trackMeta);
    if (sends.length > 0) {
      serialized.sends = sends;
    }

    return serialized;
  }

  _serializeSends(insert, trackMeta) {
    const sends = [];
    const storeSends = Array.isArray(trackMeta?.sends) ? trackMeta.sends : [];
    const storeSendMap = new Map(storeSends.map(send => [send.busId, send]));

    if (insert?.sends?.size > 0) {
      insert.sends.forEach((sendData, busId) => {
        sends.push({
          busId,
          level: sendData?.gain?.gain?.value ?? 0,
          preFader: !!storeSendMap.get(busId)?.preFader
        });
      });
    } else if (storeSends.length > 0) {
      storeSends.forEach(send => {
        sends.push({
          busId: send.busId,
          level: typeof send.level === 'number' ? send.level : 0,
          preFader: !!send.preFader
        });
      });
    }

    return sends;
  }

  /**
   * Get pattern bar length from pattern data
   * Pattern length is stored in steps (16th notes), convert to bars
   */
  async _getPatternBarLength(patternData) {
    if (!patternData) {
      console.warn('⚠️ Pattern data is null/undefined, using default 1 bar');
      return 1;
    }

    // Pattern length can be in settings.length or directly in length field
    const stepLength = patternData.settings?.length || patternData.length || 16;

    // Convert steps to bars (16 steps = 1 bar, 4/4 time signature)
    const barLength = stepLength / 16;

    console.log(`📏 Pattern bar length: ${barLength} bars (${stepLength} steps) - Pattern:`, patternData.name || 'Unknown');
    return barLength;
  }

  /**
   * Get instrument name by ID
   */
  async _getInstrumentName(instrumentId) {
    const { useInstrumentsStore } = await import('../../store/useInstrumentsStore');
    const { instruments } = useInstrumentsStore.getState();
    const instrument = instruments.find(inst => inst.id === instrumentId);
    return instrument?.name || 'unknown';
  }

  /**
   * Group instruments by stem types
   */
  async _groupInstrumentsByStems(patternData) {
    const { useInstrumentsStore } = await import('../../store/useInstrumentsStore');
    const { instruments } = useInstrumentsStore.getState();

    const stemGroups = {
      drums: [],
      bass: [],
      melody: [],
      fx: [],
      other: []
    };

    for (const instrumentId of Object.keys(patternData)) {
      const instrument = instruments.find(inst => inst.id === instrumentId);
      if (!instrument) continue;

      // Classify instrument by name patterns
      const name = instrument.name.toLowerCase();

      if (name.includes('kick') || name.includes('snare') || name.includes('hat') || name.includes('drum')) {
        stemGroups.drums.push(instrumentId);
      } else if (name.includes('bass') || name.includes('808') || name.includes('sub')) {
        stemGroups.bass.push(instrumentId);
      } else if (name.includes('lead') || name.includes('melody') || name.includes('synth')) {
        stemGroups.melody.push(instrumentId);
      } else if (name.includes('fx') || name.includes('effect') || name.includes('reverb')) {
        stemGroups.fx.push(instrumentId);
      } else {
        stemGroups.other.push(instrumentId);
      }
    }

    return stemGroups;
  }

  /**
   * Convert audio buffer to specified format
   */
  async _convertToFormat(audioBuffer, format, quality) {
    // For now, return WAV format
    // TODO: Implement MP3, OGG, FLAC encoding
    const wavBlob = await this.audioProcessor.audioBufferToWav(audioBuffer, quality.bitDepth);
    return wavBlob;
  }

  /**
   * ✅ NEW: Convert AudioBuffer to Blob for frozen samples
   */
  async _bufferToBlob(audioBuffer) {
    // Use standard quality for frozen samples
    return await this.audioProcessor.audioBufferToWav(audioBuffer, 16);
  }

  /**
   * Get file extension for format
   */
  _getFileExtension(format) {
    const extensions = {
      [EXPORT_FORMATS.WAV]: 'wav',
      [EXPORT_FORMATS.MP3]: 'mp3',
      [EXPORT_FORMATS.OGG]: 'ogg',
      [EXPORT_FORMATS.FLAC]: 'flac'
    };
    return extensions[format] || 'wav';
  }

  // =================== PUBLIC API ===================

  /**
   * Quick export pattern as WAV
   */
  async quickExportPattern(patternId) {
    return await this.exportPattern(patternId, {
      format: EXPORT_FORMATS.WAV,
      quality: QUALITY_PRESETS.STANDARD,
      type: EXPORT_TYPES.PATTERN
    });
  }

  /**
   * Export pattern split by channels
   */
  async exportPatternChannels(patternId) {
    return await this.exportPattern(patternId, {
      type: EXPORT_TYPES.CHANNELS
    });
  }

  /**
   * Export pattern as stems
   */
  async exportPatternStems(patternId) {
    return await this.exportPattern(patternId, {
      type: EXPORT_TYPES.STEMS
    });
  }


  // =================== EXTENDED EXPORT METHODS (Merged from ExportManager) ===================

  /**
   * Export selected mixer channels to audio files
   * @param {Array<string>} channelIds - Channel IDs to export
   * @param {object} options - Export options
   * @param {Function} onProgress - Progress callback (channelId, progress, status)
   */
  async exportChannels(channelIds, options = {}, onProgress = null) {
    if (this.isExporting) {
      throw new Error('Export already in progress');
    }

    if (!channelIds || channelIds.length === 0) {
      throw new Error('No channels selected for export');
    }

    const settings = { ...this.defaultSettings, ...options };
    this.isExporting = true;

    console.log(`🎵 Exporting ${channelIds.length} channels:`, channelIds, settings);

    try {
      const results = [];

      for (let i = 0; i < channelIds.length; i++) {
        const channelId = channelIds[i];

        if (onProgress) {
          onProgress(channelId, (i / channelIds.length) * 100, 'starting');
        }

        try {
          const result = await this._exportChannel(channelId, settings, (progress) => {
            if (onProgress) {
              const overallProgress = (i / channelIds.length) * 100 + (progress / channelIds.length);
              onProgress(channelId, overallProgress, 'exporting');
            }
          });

          results.push({
            channelId,
            success: true,
            file: result
          });

          if (onProgress) {
            onProgress(channelId, ((i + 1) / channelIds.length) * 100, 'completed');
          }
        } catch (error) {
          console.error(`❌ Failed to export channel ${channelId}:`, error);
          results.push({
            channelId,
            success: false,
            error: error.message
          });

          if (onProgress) {
            onProgress(channelId, ((i + 1) / channelIds.length) * 100, 'error');
          }
        }
      }

      return results;
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Export master bus
   */
  async exportMaster(options = {}, onProgress = null) {
    const audioEngine = AudioEngineGlobal.get();
    if (!audioEngine) {
      throw new Error('Audio engine not available');
    }

    return await this._exportChannel('master', { ...this.defaultSettings, ...options }, onProgress);
  }

  /**
   * Export arrangement
   */
  async exportArrangement(arrangementId = null, options = {}, onProgress = null) {
    if (this.isExporting) {
      throw new Error('Export already in progress');
    }

    const settings = { ...this.defaultSettings, ...options };
    this.isExporting = true;

    try {
      const { useArrangementStore } = await import('../../store/useArrangementStore');
      const arrangementStore = useArrangementStore.getState();
      const clips = arrangementStore.arrangementClips || [];

      // Get arrangement metadata
      let arrangementName = 'Arrangement';
      let arrangementTempo = null;
      try {
        const { useArrangementWorkspaceStore } = await import('@/store/useArrangementWorkspaceStore');
        const workspaceStore = useArrangementWorkspaceStore.getState();
        const arrangement = arrangementId
          ? workspaceStore.arrangements[arrangementId]
          : workspaceStore.getActiveArrangement();

        if (arrangement) {
          arrangementName = arrangement.name || 'Arrangement';
          arrangementTempo = arrangement.tempo;
        }
      } catch (err) { }

      if (!clips || clips.length === 0) {
        throw new Error('Arrangement has no clips');
      }

      console.log(`🎵 Exporting arrangement: ${arrangementName} (${clips.length} clips)`);

      if (onProgress) onProgress(0, 'preparing');

      // Convert clips to pattern sequence
      const patterns = arrangementStore.patterns;
      const patternSequence = [];
      const { usePlaybackStore } = await import('../../store/usePlaybackStore');
      const bpm = arrangementTempo || usePlaybackStore.getState().bpm || 140;

      for (const clip of clips) {
        if (clip.type === 'pattern' && clip.patternId) {
          const pattern = patterns[clip.patternId];
          if (pattern && pattern.data) {
            const { patternData } = await this._preparePatternSnapshot(
              pattern,
              { includeAutomation: true }
            );

            const durationBeats = clip.duration || (pattern.settings?.length || 64) / 4;

            patternSequence.push({
              patternData,
              startTime: clip.startTime || 0,
              duration: durationBeats
            });
          }
        }
      }

      if (patternSequence.length === 0) throw new Error('No pattern clips found to export');

      if (onProgress) onProgress(20, 'rendering');

      // Render
      const renderResult = await this.renderEngine.renderArrangement(patternSequence, {
        sampleRate: settings.quality.sampleRate || 44100,
        includeEffects: settings.includeEffects,
        bpm
      });

      if (onProgress) onProgress(60, 'processing');

      // Process
      const processedBuffer = await this.audioProcessor.processAudio(renderResult.audioBuffer, {
        normalize: settings.normalize,
        fadeIn: settings.fadeIn,
        fadeOut: settings.fadeOut,
        fadeInDuration: settings.fadeInDuration,
        fadeOutDuration: settings.fadeOutDuration
      });

      if (onProgress) onProgress(80, 'converting');

      // Convert
      const blob = await this._convertToFormat(processedBuffer, settings.format, settings.quality);

      // Filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filenameTemplate = settings.fileNameTemplate || '{arrangementName}_{timestamp}';
      const filename = filenameTemplate
        .replace('{arrangementName}', arrangementName || 'arrangement')
        .replace('{timestamp}', timestamp)
        .replace('{format}', settings.format) || `arrangement_${Date.now()}.${this._getFileExtension(settings.format)}`;

      if (onProgress) onProgress(90, 'finalizing');

      // Download
      if (settings.download !== false) {
        await this.fileManager.saveAudioFile(blob, filename);
      }

      // Add to Project
      let assetId = null;
      if (settings.addToProject) {
        const durationBeats = (processedBuffer.duration / 60) * bpm;
        assetId = await this._createInstrumentFromExport({ buffer: processedBuffer }, arrangementName, durationBeats);
      }

      if (onProgress) onProgress(100, 'completed');

      return {
        arrangementId,
        filename,
        size: blob.size,
        format: settings.format,
        duration: processedBuffer.duration,
        sampleRate: processedBuffer.sampleRate,
        assetId,
        audioBuffer: processedBuffer,
        file: blob,
        blob
      };

    } catch (error) {
      console.error('Arrange export failed', error);
      throw error;
    } finally {
      this.isExporting = false;
    }
  }

  // --- Helpers for Extended Export ---

  async _exportChannel(channelId, settings, onProgress) {
    if (settings.mode === 'realtime') {
      return await this._exportChannelRealtime(channelId, settings);
    }

    const { useArrangementStore } = await import('../../store/useArrangementStore');
    const { useInstrumentsStore } = await import('../../store/useInstrumentsStore');

    const arrangementStore = useArrangementStore.getState();
    const activePatternId = arrangementStore.activePatternId;
    if (!activePatternId) throw new Error('No active pattern');

    const pattern = arrangementStore.patterns[activePatternId];
    if (!pattern?.data) throw new Error('Pattern has no data');

    // Identify instruments
    const allInstruments = useInstrumentsStore.getState().instruments;
    let targetInstruments = [];

    if (channelId === 'master') {
      targetInstruments = allInstruments; // Master gets everything
    } else {
      targetInstruments = allInstruments.filter(i => i.mixerTrackId === channelId);
    }

    const targetInstrumentIds = targetInstruments.map(i => i.id);

    // Filter Pattern Data
    const filteredData = { ...pattern, data: {} };

    if (channelId === 'master') {
      filteredData.data = pattern.data;
    } else {
      targetInstrumentIds.forEach(id => {
        if (pattern.data[id]) filteredData.data[id] = pattern.data[id];
      });
    }

    if (onProgress) onProgress(20);

    const { patternData: fullPatternData } = await this._preparePatternSnapshot(filteredData, {
      instrumentIds: channelId === 'master' ? Object.keys(filteredData.data) : targetInstrumentIds,
      includeMasterChannel: channelId === 'master'
    });

    if (onProgress) onProgress(40);

    const renderResult = await this.renderEngine.renderPattern(fullPatternData, {
      sampleRate: settings.quality.sampleRate || 44100,
      bitDepth: settings.quality.bitDepth || 16,
      includeEffects: settings.includeEffects,
      startTime: settings.startTime ?? 0,
      endTime: settings.endTime ?? null
    });

    if (onProgress) onProgress(70);

    const processedBuffer = await this.audioProcessor.processAudio(renderResult.audioBuffer, {
      normalize: settings.normalize,
      fadeOut: settings.fadeOut,
      fadeIn: settings.fadeIn
    });

    if (onProgress) onProgress(90);

    const blob = await this._convertToFormat(processedBuffer, settings.format, settings.quality);
    const filename = `${(settings.fileNameTemplate || '{channelName}').replace('{channelName}', channelId)}.${this._getFileExtension(settings.format)}`;

    let assetId = null;
    if (settings.addToProject) {
      const { usePlaybackStore } = await import('../../store/usePlaybackStore');
      const bpm = usePlaybackStore.getState().bpm;
      const durationBeats = (processedBuffer.duration / 60) * bpm;
      assetId = await this._createInstrumentFromExport({ buffer: processedBuffer }, channelId, durationBeats);
    }

    if (settings.download !== false) {
      await this.fileManager.saveAudioFile(blob, filename);
    }

    return {
      channelId,
      filename,
      audioBuffer: processedBuffer,
      file: blob,
      assetId: assetId
    };
  }

  async _exportChannelRealtime(channelId, settings) {
    throw new Error('Realtime export moved to offline rendering for higher quality.');
  }

  /**
   * Get export progress for UI
   */
  getExportProgress() {
    return {
      isExporting: this.isExporting,
      queueLength: this.exportQueue.length,
      activeExports: Array.from(this.activeExports.keys())
    };
  }

  /**
   * Cancel all exports
   */
  cancelAllExports() {
    this.exportQueue.length = 0;
    this.activeExports.clear();
    this.isExporting = false;
    console.log('🎵 All exports cancelled');
  }
}

// ✅ FIX: Lazy singleton - only create when needed (after audio engine is ready)
let _audioExportManagerInstance = null;

export function getAudioExportManager() {
  if (!_audioExportManagerInstance) {
    _audioExportManagerInstance = new AudioExportManager();
    // Update sample rate when audio engine becomes available
    if (window.audioEngine) {
      _audioExportManagerInstance.renderEngine.updateSampleRate();
    }
  }
  return _audioExportManagerInstance;
}

// For backward compatibility - lazy proxy
export const audioExportManager = new Proxy({}, {
  get(target, prop) {
    // Only create instance when actually accessed
    const instance = getAudioExportManager();
    return instance[prop];
  }
});

// ✅ Alias for backward compatibility (used by RenderPage, ProjectsPage)
export const exportManager = audioExportManager;

// ✅ FIX: Don't create instance on module load
// Use getAudioExportManager() when you need the instance
export default audioExportManager;