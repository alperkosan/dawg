/**
 * 🎵 AUDIO EXPORT MANAGER
 *
 * Systematic and reusable audio export/manipulation system
 * Supports pattern-to-audio, batch processing, and file management
 */

import { AudioContextService } from '../services/AudioContextService';
import { AudioProcessor } from './AudioProcessor';
import { FileManager } from './FileManager';
import { RenderEngine } from './RenderEngine';

// Export formats and quality presets
export const EXPORT_FORMATS = {
  WAV: 'audio/wav',
  MP3: 'audio/mpeg',
  OGG: 'audio/ogg',
  FLAC: 'audio/flac'
};

export const QUALITY_PRESETS = {
  DEMO: { sampleRate: 22050, bitDepth: 16, quality: 0.7 },
  STANDARD: { sampleRate: 44100, bitDepth: 16, quality: 0.8 },
  HIGH: { sampleRate: 48000, bitDepth: 24, quality: 0.9 },
  STUDIO: { sampleRate: 96000, bitDepth: 32, quality: 1.0 }
};

export const EXPORT_TYPES = {
  PATTERN: 'pattern',           // Single pattern export
  CHANNELS: 'channels',         // Split by channels/instruments
  STEMS: 'stems',              // Grouped stems (drums, bass, etc.)
  ARRANGEMENT: 'arrangement',   // Full arrangement
  SELECTION: 'selection',       // Selected time range
  FREEZE: 'freeze'             // FL Studio-style freeze (replace pattern with audio)
};

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
    this.renderEngine = new RenderEngine();

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

      // Choose export strategy based on type
      switch (settings.type) {
        case EXPORT_TYPES.PATTERN:
          return await this._exportSinglePattern(patternData, settings);

        case EXPORT_TYPES.CHANNELS:
          return await this._exportPatternByChannels(patternData, settings);

        case EXPORT_TYPES.STEMS:
          return await this._exportPatternByStems(patternData, settings);

        case EXPORT_TYPES.FREEZE:
          return await this._freezePattern(patternData, settings);

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

    // Convert to desired format
    const audioBlob = await this._convertToFormat(processedAudio, settings.format, settings.quality);

    // Save file
    const filename = `${patternData.name || 'pattern'}_${Date.now()}.${this._getFileExtension(settings.format)}`;
    const fileInfo = await this.fileManager.saveAudioFile(audioBlob, filename);

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
        ...exportOptions
      };

      const exportResult = await this.exportPattern(patternId, exportSettings);

      // Step 2: Create instrument from exported audio (if requested)
      let instrumentId = null;
      if (createInstrument && exportResult.length > 0) {
        instrumentId = await this._createInstrumentFromExport(exportResult[0], patternId);
      }

      // Step 3: Replace original pattern (if requested)
      if (replaceOriginal && instrumentId && exportResult.length > 0) {
        await this._replacePatternWithAudio(patternId, instrumentId, exportResult[0]);
      }

      // Step 4: Optionally create arrangement clip (without replacing pattern)
      let clipId = null;
      if (!replaceOriginal && createInstrument && instrumentId && exportResult.length > 0) {
        clipId = await this._createArrangementClip(patternId, instrumentId, exportResult[0]);
      }

      return {
        exportFiles: exportResult,
        instrumentId,
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
        await new Promise(resolve => setTimeout(resolve, 100));
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
      normalize: false, // Preserve dynamics for further processing
      fadeOut: false   // No fade for frozen patterns
    });
  }

  /**
   * Create instrument from exported audio file
   */
  async _createInstrumentFromExport(exportedFile, originalPatternId) {
    try {
      // Import the exported file as a new instrument
      const instrumentId = `frozen_${originalPatternId}_${Date.now()}`;

      // Use FileManager to create instrument
      const instrumentData = await this.fileManager.createInstrumentFromFile(
        exportedFile.buffer,
        {
          id: instrumentId,
          name: `Frozen ${originalPatternId}`,
          type: 'sample',
          tags: ['frozen', 'pattern-export'],
          originalPattern: originalPatternId
        }
      );

      console.log(`🎹 Created instrument ${instrumentId} from frozen pattern`);
      return instrumentId;

    } catch (error) {
      console.error('🎹 Failed to create instrument from export:', error);
      throw error;
    }
  }

  /**
   * Replace pattern content with audio clip
   */
  async _replacePatternWithAudio(patternId, instrumentId, exportResult) {
    console.log(`🔄 Replacing pattern ${patternId} with audio instrument ${instrumentId}`);

    try {
      // Import arrangement store dynamically to avoid circular imports
      const { useArrangementStore } = await import('../../store/useArrangementStore');

      if (exportResult && exportResult.audioBuffer) {
        // Create audio clip data
        const audioClipData = {
          patternId,
          instrumentId,
          audioBuffer: exportResult.audioBuffer,
          cpuSavings: { estimatedSavings: '60-80%' },
          startTime: 0,
          trackId: `track-${patternId}`
        };

        // Use arrangement store to replace pattern with audio clip
        useArrangementStore.getState().replacePatternWithAudio(patternId, audioClipData);

        console.log(`🧊 Successfully replaced pattern ${patternId} with frozen audio clip`);
        return true;
      }
    } catch (error) {
      console.error('🔄 Failed to replace pattern with audio:', error);
      return false;
    }
  }

  /**
   * Create arrangement clip from exported pattern audio
   */
  async _createArrangementClip(patternId, instrumentId, exportResult) {
    console.log(`🎵 Creating arrangement clip for pattern ${patternId}`);

    try {
      // Import arrangement store dynamically to avoid circular imports
      const { useArrangementStore } = await import('../../store/useArrangementStore');

      if (exportResult && exportResult.audioBuffer) {
        // Create audio clip data
        const audioClipData = {
          patternId,
          instrumentId,
          audioBuffer: exportResult.audioBuffer,
          startTime: 0, // Place at beginning of arrangement
          trackId: `track-${patternId}`
        };

        // Use arrangement store to add audio clip
        const clipId = useArrangementStore.getState().addAudioClip(audioClipData);

        console.log(`🎵 Created arrangement clip ${clipId} for pattern ${patternId}`);
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
    // Estimate CPU savings based on:
    // - Number of instruments in pattern
    // - Number of effects
    // - Complexity of synthesis

    // Simplified calculation for now
    return {
      estimatedSavings: '60-80%',
      reason: 'Converted MIDI + effects to single audio sample'
    };
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

// Singleton instance
export const audioExportManager = new AudioExportManager();
export default audioExportManager;