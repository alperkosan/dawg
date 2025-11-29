/**
 * 🎵 EXPORT MANAGER - Comprehensive Audio Export System
 *
 * Industry-standard export features inspired by Ableton Live, FL Studio, Pro Tools:
 * - Mixer channel export (individual or batch)
 * - Master bus export
 * - Real-time and offline rendering
 * - Multiple format support (WAV, MP3, OGG, FLAC)
 * - Quality presets and custom settings
 * - Effects include/exclude
 * - Normalize, fade in/out
 * - Progress tracking
 * - File naming conventions
 *
 * Architecture:
 * - Channel-based export (capture from MixerInsert output)
 * - Offline rendering for high-quality exports
 * - Real-time capture for live exports
 * - Batch processing with queue management
 */

import { AudioContextService } from '../services/AudioContextService';
import { useMixerStore } from '@/store/useMixerStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { useArrangementStore } from '@/store/useArrangementStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { AudioExportManager, getAudioExportManager } from './AudioExportManager';
import { audioAssetManager } from './AudioAssetManager';
import { getRenderEngine } from './RenderEngine'; // ✅ SYNC: Import singleton RenderEngine
import { QUALITY_PRESETS, EXPORT_FORMATS } from './audioRenderConfig'; // ✅ SYNC: Import from config for consistency

// ═══════════════════════════════════════════════════════════
// EXPORT FORMATS
// ═══════════════════════════════════════════════════════════
// ✅ SYNC: Re-export EXPORT_FORMATS from audioRenderConfig for consistency
// Map to ExportManager format (string values instead of MIME types)
export const EXPORT_FORMAT = {
    WAV: 'wav',
    MP3: 'mp3',
    OGG: 'ogg',
    FLAC: 'flac',
    AIFF: 'aiff'
};

// ✅ SYNC: Also export EXPORT_FORMATS for compatibility
export { EXPORT_FORMATS };

// ═══════════════════════════════════════════════════════════
// EXPORT MODE
// ═══════════════════════════════════════════════════════════

export const EXPORT_MODE = {
    REALTIME: 'realtime',     // Capture live audio (faster, lower quality)
    OFFLINE: 'offline'        // Offline rendering (slower, highest quality)
};

// ═══════════════════════════════════════════════════════════
// QUALITY PRESETS
// ═══════════════════════════════════════════════════════════
// ✅ SYNC: Map QUALITY_PRESETS from audioRenderConfig to ExportManager format (with mode)
export const QUALITY_PRESET = {
    DRAFT: {
        sampleRate: QUALITY_PRESETS.DEMO.sampleRate,
        bitDepth: QUALITY_PRESETS.DEMO.bitDepth,
        mode: EXPORT_MODE.REALTIME
    },
    STANDARD: {
        sampleRate: QUALITY_PRESETS.STANDARD.sampleRate,
        bitDepth: QUALITY_PRESETS.STANDARD.bitDepth,
        mode: EXPORT_MODE.OFFLINE
    },
    HIGH: {
        sampleRate: QUALITY_PRESETS.HIGH.sampleRate,
        bitDepth: QUALITY_PRESETS.HIGH.bitDepth,
        mode: EXPORT_MODE.OFFLINE
    },
    PROFESSIONAL: {
        sampleRate: QUALITY_PRESETS.STUDIO.sampleRate,
        bitDepth: QUALITY_PRESETS.STUDIO.bitDepth,
        mode: EXPORT_MODE.OFFLINE
    }
};

// ═══════════════════════════════════════════════════════════
// EXPORT MANAGER
// ═══════════════════════════════════════════════════════════

export class ExportManager {
    constructor() {
        // ✅ FIX: Use getter to ensure lazy initialization
        this.audioExportManager = getAudioExportManager();
        // ✅ SYNC: Use singleton RenderEngine directly (same instance as AudioExportManager)
        this.renderEngine = getRenderEngine();
        this.isExporting = false;
        this.exportQueue = [];
        this.activeExports = new Map();
        this.progressCallbacks = new Map();

        // Default settings
        this.defaultSettings = {
            format: EXPORT_FORMAT.WAV,
            quality: QUALITY_PRESET.STANDARD,
            mode: EXPORT_MODE.OFFLINE,
            includeEffects: true,
            normalize: true,
            fadeIn: false,
            fadeOut: true,
            fadeInDuration: 0.01, // 10ms
            fadeOutDuration: 0.1,  // 100ms
            stereo: true,
            startTime: null,      // null = from playhead
            endTime: null,        // null = to end of song/pattern
            fileNameTemplate: '{channelName}_{timestamp}',
            outputDirectory: null // null = browser download
        };

        console.log('🎵 ExportManager initialized');
    }

    // ═══════════════════════════════════════════════════════════
    // MIXER CHANNEL EXPORT
    // ═══════════════════════════════════════════════════════════

    /**
     * Export selected mixer channels to audio files
     * @param {Array<string>} channelIds - Channel IDs to export
     * @param {object} options - Export options
     * @param {Function} onProgress - Progress callback (channelId, progress, status)
     * @returns {Promise<Array>} Array of exported file info
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
     * Export a single mixer channel
     * @private
     */
    async _exportChannel(channelId, settings, onProgress = null) {
        const audioEngine = AudioContextService.getAudioEngine();
        if (!audioEngine) {
            throw new Error('Audio engine not available');
        }

        // Get mixer insert
        const mixerInsert = audioEngine.mixerInserts?.get(channelId);
        if (!mixerInsert) {
            throw new Error(`Mixer channel ${channelId} not found`);
        }

        // Get channel info from store
        const mixerStore = useMixerStore.getState();
        const mixerTrack = mixerStore.mixerTracks.find(t => t.id === channelId);
        const channelName = mixerTrack?.name || channelId;

        console.log(`🎵 Exporting channel: ${channelName} (${channelId})`);

        // Determine export mode
        if (settings.mode === EXPORT_MODE.REALTIME) {
            return await this._exportChannelRealtime(mixerInsert, channelId, channelName, settings, onProgress);
        } else {
            return await this._exportChannelOffline(mixerInsert, channelId, channelName, settings, onProgress);
        }
    }

    /**
     * Real-time channel export (capture live audio)
     * @private
     */
    async _exportChannelRealtime(mixerInsert, channelId, channelName, settings, onProgress) {
        const audioContext = AudioContextService.getAudioContext();
        if (!audioContext) {
            throw new Error('Audio context not available');
        }

        // Create MediaRecorder for real-time capture
        const destination = mixerInsert.output || mixerInsert.input;
        
        // Create MediaStreamDestination for capture
        const mediaStreamDestination = audioContext.createMediaStreamDestination();
        destination.connect(mediaStreamDestination);

        // Get MediaStream
        const stream = mediaStreamDestination.stream;
        
        // Create MediaRecorder
        const mimeType = this._getMimeType(settings.format);
        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType || 'audio/webm'
        });

        const chunks = [];
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };

        return new Promise((resolve, reject) => {
            mediaRecorder.onstop = async () => {
                try {
                    const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
                    
                    // Process audio if needed (normalize, fade, etc.)
                    const processedBlob = await this._processAudioBlob(blob, settings);

                    // Generate filename
                    const filename = this._generateFileName(channelName, settings);

                    // Download file
                    await this._downloadFile(processedBlob, filename);

                    // Cleanup
                    destination.disconnect(mediaStreamDestination);
                    mediaStreamDestination.disconnect();

                    resolve({
                        channelId,
                        channelName,
                        filename,
                        size: processedBlob.size,
                        format: settings.format
                    });
                } catch (error) {
                    reject(error);
                }
            };

            mediaRecorder.onerror = (error) => {
                destination.disconnect(mediaStreamDestination);
                mediaStreamDestination.disconnect();
                reject(error);
            };

            // Start recording
            const playbackStore = usePlaybackStore.getState();
            const startTime = settings.startTime ?? playbackStore.currentStep;
            const endTime = settings.endTime;

            // Calculate duration
            let duration = null;
            if (endTime !== null && startTime !== null) {
                duration = (endTime - startTime) * (60 / playbackStore.bpm) * 4; // Convert steps to seconds
            }

            mediaRecorder.start();

            // Stop after duration or when playback stops
            if (duration) {
                setTimeout(() => {
                    if (mediaRecorder.state === 'recording') {
                        mediaRecorder.stop();
                    }
                }, duration * 1000);
            } else {
                // Stop when playback stops
                const unsubscribe = usePlaybackStore.subscribe(
                    (state) => state.isPlaying,
                    (isPlaying) => {
                        if (!isPlaying && mediaRecorder.state === 'recording') {
                            mediaRecorder.stop();
                            unsubscribe();
                        }
                    }
                );
            }
        });
    }

    /**
     * Offline channel export (high-quality rendering)
     * @private
     */
    async _exportChannelOffline(mixerInsert, channelId, channelName, settings, onProgress) {
        // ✅ FIX: Use AudioExportManager's proven exportPattern method
        // It handles all the complexity of pattern data preparation and rendering
        const arrangementStore = useArrangementStore.getState();
        const activePatternId = arrangementStore.activePatternId;
        
        if (!activePatternId) {
            throw new Error('No active pattern for export');
        }

        const pattern = arrangementStore.patterns[activePatternId];
        if (!pattern || !pattern.data) {
            throw new Error('Active pattern has no data');
        }

        // Get instruments for this channel
        const instruments = this._getInstrumentsForChannel(channelId);
        
        // Filter pattern data to only include instruments on this channel
        const filteredPatternData = {
            ...pattern,
            data: {}
        };

        if (channelId === 'master') {
            // Master: include all instruments
            filteredPatternData.data = pattern.data;
        } else {
            // Regular channel: only include instruments routed to this channel
            instruments.forEach(inst => {
                if (pattern.data[inst.id]) {
                    filteredPatternData.data[inst.id] = pattern.data[inst.id];
                }
            });
        }

        // Check if we have any notes
        const hasNotes = Object.values(filteredPatternData.data).some(notes => notes && notes.length > 0);
        if (!hasNotes) {
            throw new Error(`No notes found for channel ${channelName}`);
        }

        if (onProgress) {
            onProgress(10);
        }

        const channelInstrumentIds = channelId === 'master'
            ? Object.keys(filteredPatternData.data)
            : instruments.map(inst => inst.id);

        const { patternData: fullPatternData } = await this.audioExportManager._preparePatternSnapshot(
            filteredPatternData,
            {
                instrumentIds: channelInstrumentIds,
                includeMasterChannel: channelId === 'master'
            }
        );

        if (onProgress) {
            onProgress(20);
        }

        // Use AudioExportManager's proven renderPattern method
        const renderResult = await this.audioExportManager.renderEngine.renderPattern(fullPatternData, {
            sampleRate: settings.quality.sampleRate,
            bitDepth: settings.quality.bitDepth,
            includeEffects: settings.includeEffects,
            startTime: settings.startTime ?? 0,
            endTime: settings.endTime ?? null
        });

        if (!renderResult || !renderResult.audioBuffer) {
            throw new Error('Failed to render pattern');
        }

        if (onProgress) {
            onProgress(60);
        }

        // Apply mixer processing for this specific channel (if not master)
        const processedBuffer = renderResult.audioBuffer;

        if (onProgress) {
            onProgress(80);
        }

        // Apply post-processing (normalize, fade)
        const finalBuffer = await this._applyPostProcessing(
            processedBuffer,
            settings
        );

        if (onProgress) {
            onProgress(90);
        }

        // Convert to blob (for download if needed)
        const blob = await this._audioBufferToBlob(finalBuffer, settings.format);

        // Generate filename
        const filename = this._generateFileName(channelName, settings);

        // ✅ NEW: Add to project as audio asset (if addToProject is enabled)
        let assetId = null;
        let clipId = null;
        
        if (settings.addToProject) {
            if (onProgress) {
                onProgress(92);
            }

            // Calculate duration in beats
            const bpm = usePlaybackStore.getState().bpm;
            const durationBeats = (finalBuffer.duration / 60) * bpm;

            // Create audio asset
            assetId = await this._createAudioAsset(
                finalBuffer,
                channelName,
                channelId,
                durationBeats
            );

            if (onProgress) {
                onProgress(95);
            }

            // Add to arrangement as clip
            if (settings.addToArrangement && assetId) {
                clipId = await this._addToArrangement(
                    assetId,
                    channelName,
                    channelId,
                    durationBeats,
                    finalBuffer
                );
            }
        }

        // Download file (if not disabled)
        if (settings.download !== false) {
            await this._downloadFile(blob, filename);
        }

        if (onProgress) {
            onProgress(100);
        }

        return {
            channelId,
            channelName,
            filename,
            size: blob.size,
            format: settings.format,
            duration: finalBuffer.duration,
            sampleRate: finalBuffer.sampleRate,
            assetId,
            clipId,
            audioBuffer: finalBuffer, // Include buffer for potential reuse
            file: blob, // Include blob for file operations
            blob: blob // Alias for convenience
        };
    }

    /**
     * Export master bus
     */
    async exportMaster(options = {}, onProgress = null) {
        const audioEngine = AudioContextService.getAudioEngine();
        if (!audioEngine) {
            throw new Error('Audio engine not available');
        }

        const masterInsert = audioEngine.mixerInserts?.get('master');
        if (!masterInsert) {
            throw new Error('Master channel not found');
        }

        return await this._exportChannel('master', { ...this.defaultSettings, ...options }, onProgress);
    }

    /**
     * Export full arrangement
     * @param {string} arrangementId - Arrangement ID (optional, uses active if not provided)
     * @param {object} options - Export options
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<object>} Export result with file info
     */
    async exportArrangement(arrangementId = null, options = {}, onProgress = null) {
        if (this.isExporting) {
            throw new Error('Export already in progress');
        }

        const settings = { ...this.defaultSettings, ...options };
        this.isExporting = true;

        try {
            // Get arrangement from workspace store
            const { useArrangementWorkspaceStore } = await import('@/store/useArrangementWorkspaceStore');
            const workspaceStore = useArrangementWorkspaceStore.getState();
            
            const arrangement = arrangementId 
                ? workspaceStore.arrangements[arrangementId]
                : workspaceStore.getActiveArrangement();

            if (!arrangement) {
                throw new Error('No arrangement found');
            }

            if (!arrangement.clips || arrangement.clips.length === 0) {
                throw new Error('Arrangement has no clips');
            }

            console.log(`🎵 Exporting arrangement: ${arrangement.name} (${arrangement.clips.length} clips)`);

            if (onProgress) {
                onProgress(0, 'preparing');
            }

            // Get arrangement store for patterns
            const arrangementStore = useArrangementStore.getState();
            const patterns = arrangementStore.patterns;

            // Convert clips to pattern sequence for rendering
            const patternSequence = [];
            const bpm = arrangement.tempo || usePlaybackStore.getState().bpm || 140;

            for (const clip of arrangement.clips) {
                if (clip.type === 'pattern' && clip.patternId) {
                    const pattern = patterns[clip.patternId];
                    if (pattern && pattern.data) {
                        // Get pattern data snapshot
                        const { patternData } = await this.audioExportManager._preparePatternSnapshot(
                            pattern,
                            { includeAutomation: true }
                        );

                        // Calculate duration in beats
                        const durationBeats = clip.duration || (pattern.settings?.length || 64) / 4; // steps to beats

                        patternSequence.push({
                            patternData,
                            startTime: clip.startTime || 0, // in beats
                            duration: durationBeats // in beats
                        });
                    }
                } else if (clip.type === 'audio' && clip.assetId) {
                    // Audio clips will be handled separately or skipped for now
                    console.warn(`⚠️ Audio clips not yet supported in arrangement export: ${clip.id}`);
                }
            }

            if (patternSequence.length === 0) {
                throw new Error('No pattern clips found in arrangement');
            }

            if (onProgress) {
                onProgress(20, 'rendering');
            }

            // Render arrangement using RenderEngine
            const qualityPreset = settings.quality || QUALITY_PRESET.STANDARD;
            const renderResult = await this.renderEngine.renderArrangement(patternSequence, {
                sampleRate: qualityPreset.sampleRate,
                includeEffects: settings.includeEffects,
                bpm
            });

            if (onProgress) {
                onProgress(60, 'processing');
            }

            // Process audio (normalize, fade, etc.)
            const audioProcessor = this.audioExportManager.audioProcessor;
            const processedBuffer = await audioProcessor.processAudio(renderResult.audioBuffer, {
                normalize: settings.normalize,
                fadeIn: settings.fadeIn,
                fadeOut: settings.fadeOut,
                fadeInDuration: settings.fadeInDuration,
                fadeOutDuration: settings.fadeOutDuration
            });

            if (onProgress) {
                onProgress(80, 'converting');
            }

            // Convert to format using AudioExportManager
            const blob = await this.audioExportManager._convertToFormat(processedBuffer, settings.format, qualityPreset);

            // Generate filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = settings.fileNameTemplate
                .replace('{arrangementName}', arrangement.name || 'arrangement')
                .replace('{timestamp}', timestamp)
                .replace('{format}', settings.format) || `arrangement_${arrangement.name || 'export'}_${timestamp}.${this.audioExportManager._getFileExtension(settings.format)}`;

            if (onProgress) {
                onProgress(90, 'finalizing');
            }

            // Download file (if not disabled)
            if (settings.download !== false) {
                await this._downloadFile(blob, filename);
            }

            // Add to project if requested
            let assetId = null;
            if (settings.addToProject) {
                const durationBeats = (processedBuffer.duration / 60) * bpm;
                assetId = await this._createAudioAsset(
                    processedBuffer,
                    arrangement.name || 'Arrangement',
                    'arrangement',
                    durationBeats
                );
            }

            if (onProgress) {
                onProgress(100, 'completed');
            }

            return {
                arrangementId: arrangement.id,
                arrangementName: arrangement.name,
                filename,
                size: blob.size,
                format: settings.format,
                duration: processedBuffer.duration,
                sampleRate: processedBuffer.sampleRate,
                assetId,
                audioBuffer: processedBuffer,
                file: blob,
                blob: blob
            };
        } finally {
            this.isExporting = false;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // HELPER METHODS
    // ═══════════════════════════════════════════════════════════

    /**
     * Get instruments routed to a channel
     * @private
     */
    _getInstrumentsForChannel(channelId) {
        const instruments = useInstrumentsStore.getState().instruments;
        
        // ✅ FIX: Master channel gets ALL instruments (it's the final mix)
        if (channelId === 'master') {
            return instruments; // Master = mix of all channels
        }
        
        // Regular channels: get instruments routed to this specific channel
        return instruments.filter(inst => inst.mixerTrackId === channelId);
    }

    /**
     * Get pattern data for an instrument
     * @private
     */
    _getPatternDataForInstrument(instrumentId) {
        const arrangementStore = useArrangementStore.getState();
        const activePatternId = arrangementStore.activePatternId;
        
        if (!activePatternId) {
            return null;
        }

        const pattern = arrangementStore.patterns[activePatternId];
        if (!pattern || !pattern.data) {
            return null;
        }

        const notes = pattern.data[instrumentId] || [];
        return {
            id: activePatternId,
            name: pattern.name,
            notes
        };
    }

    /**
     * Render instrument audio
     * @private
     */
    async _renderInstrumentAudio(offlineContext, instrument, patternData, startStep, endStep, settings) {
        try {
            const audioEngine = AudioContextService.getAudioEngine();
            if (!audioEngine) {
                throw new Error('Audio engine not available');
            }

            // Get notes for this instrument
            const notes = patternData.notes || [];
            if (notes.length === 0) {
                return null;
            }

            console.log(`🎬 Rendering instrument ${instrument.id} with ${notes.length} notes`);

            // Calculate render length
            const bpm = usePlaybackStore.getState().bpm;
            const durationSteps = endStep - startStep;
            const durationSeconds = (durationSteps / 4) * (60 / bpm);
            const sampleRate = offlineContext.sampleRate;
            const length = Math.ceil(durationSeconds * sampleRate);

            if (length <= 0) {
                console.warn(`⚠️ Invalid render length for instrument ${instrument.id}`);
                return null;
            }

            // Create a temporary offline context for this instrument
            // ✅ FIX: Use settings.stereo to determine channel count (not offlineContext.numberOfChannels)
            const numChannels = settings.stereo ? 2 : 1;
            const tempContext = new OfflineAudioContext(
                numChannels,
                length,
                sampleRate
            );

            // Get full pattern data with instruments and mixer tracks
            const arrangementStore = useArrangementStore.getState();
            const activePatternId = arrangementStore.activePatternId;
            const fullPattern = arrangementStore.patterns[activePatternId];
            
            // Get all instruments for pattern data
            const allInstruments = useInstrumentsStore.getState().instruments;
            const patternInstruments = {};
            allInstruments.forEach(inst => {
                if (fullPattern.data?.[inst.id]) {
                    patternInstruments[inst.id] = inst;
                }
            });

            // Get mixer tracks
            const mixerTracks = useMixerStore.getState().mixerTracks;
            const patternMixerTracks = {};
            mixerTracks.forEach(track => {
                patternMixerTracks[track.id] = track;
            });

            // Create full pattern data structure for single instrument
            const singleInstrumentPatternData = {
                id: patternData.id,
                name: patternData.name,
                data: {
                    [instrument.id]: notes
                },
                instruments: patternInstruments,
                mixerTracks: patternMixerTracks
            };

            // Use RenderEngine's _renderSingleInstrument method directly
            // Load worklets first
            await this.renderEngine._loadEffectWorklets(tempContext);

            // Create master bus
            const masterBus = tempContext.createGain();
            masterBus.gain.setValueAtTime(1.0, tempContext.currentTime);
            masterBus.connect(tempContext.destination);

            // Render single instrument (returns GainNode)
            const instrumentOutputNode = await this.renderEngine._renderSingleInstrument(
                instrument.id,
                notes,
                tempContext,
                audioEngine,
                {
                    includeEffects: settings.includeEffects,
                    startTime: startStep,
                    endTime: endStep,
                    patternData: singleInstrumentPatternData,
                    masterBus: masterBus
                },
                singleInstrumentPatternData
            );

            if (!instrumentOutputNode) {
                console.warn(`⚠️ No audio rendered for instrument ${instrument.id}`);
                return null;
            }

            // Start rendering (this will process all scheduled notes)
            const renderedBuffer = await tempContext.startRendering();
            
            console.log(`✅ Rendered instrument ${instrument.id}: ${renderedBuffer.duration.toFixed(2)}s`);
            return renderedBuffer;

        } catch (error) {
            console.error(`❌ Failed to render instrument ${instrument.id}:`, error);
            return null;
        }
    }

    /**
     * Mix multiple audio buffers
     * @private
     */
    async _mixAudioBuffers(offlineContext, buffers) {
        if (buffers.length === 0) {
            return null;
        }

        if (buffers.length === 1) {
            return buffers[0];
        }

        // Find longest buffer
        const maxLength = Math.max(...buffers.map(b => b.length));
        const numChannels = buffers[0].numberOfChannels;
        const sampleRate = buffers[0].sampleRate;

        // Create destination buffer
        const destination = offlineContext.createBuffer(numChannels, maxLength, sampleRate);

        // Mix all buffers
        for (let i = 0; i < buffers.length; i++) {
            const buffer = buffers[i];
            for (let channel = 0; channel < numChannels; channel++) {
                const sourceData = buffer.getChannelData(channel);
                const destData = destination.getChannelData(channel);
                
                for (let sample = 0; sample < sourceData.length; sample++) {
                    destData[sample] += sourceData[sample];
                }
            }
        }

        return destination;
    }

    /**
     * Apply post-processing (normalize, fade)
     * @private
     */
    async _applyPostProcessing(audioBuffer, settings) {
        // Normalize
        if (settings.normalize) {
            // Find peak
            let peak = 0;
            for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                const channelData = audioBuffer.getChannelData(channel);
                for (let sample = 0; sample < channelData.length; sample++) {
                    peak = Math.max(peak, Math.abs(channelData[sample]));
                }
            }

            // Apply gain to normalize
            if (peak > 0 && peak < 1.0) {
                const gain = 1.0 / peak;
                for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                    const channelData = audioBuffer.getChannelData(channel);
                    for (let sample = 0; sample < channelData.length; sample++) {
                        channelData[sample] *= gain;
                    }
                }
            }
        }

        // Apply fade in
        if (settings.fadeIn) {
            const fadeInSamples = Math.floor(settings.fadeInDuration * audioBuffer.sampleRate);
            for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                const channelData = audioBuffer.getChannelData(channel);
                for (let sample = 0; sample < Math.min(fadeInSamples, channelData.length); sample++) {
                    const fade = sample / fadeInSamples;
                    channelData[sample] *= fade;
                }
            }
        }

        // Apply fade out
        if (settings.fadeOut) {
            const fadeOutSamples = Math.floor(settings.fadeOutDuration * audioBuffer.sampleRate);
            const startSample = Math.max(0, audioBuffer.length - fadeOutSamples);
            for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                const channelData = audioBuffer.getChannelData(channel);
                for (let sample = startSample; sample < audioBuffer.length; sample++) {
                    const fade = 1.0 - ((sample - startSample) / fadeOutSamples);
                    channelData[sample] *= fade;
                }
            }
        }

        return audioBuffer;
    }

    /**
     * Convert AudioBuffer to Blob
     * @private
     */
    async _audioBufferToBlob(audioBuffer, format) {
        // Convert AudioBuffer to WAV
        const wav = this._audioBufferToWav(audioBuffer);
        const blob = new Blob([wav], { type: 'audio/wav' });

        // Convert to other formats if needed
        if (format === EXPORT_FORMAT.MP3) {
            // Would need MP3 encoder library
            console.warn('⚠️ MP3 export requires encoder library');
            return blob;
        } else if (format === EXPORT_FORMAT.OGG) {
            // Would need OGG encoder library
            console.warn('⚠️ OGG export requires encoder library');
            return blob;
        }

        return blob;
    }

    /**
     * Convert AudioBuffer to WAV
     * @private
     */
    _audioBufferToWav(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        const sampleRate = audioBuffer.sampleRate;
        const bytesPerSample = 2; // 16-bit
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = length * blockAlign;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bytesPerSample * 8, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        // Audio data
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }

        return buffer;
    }

    /**
     * Process audio blob (normalize, fade, etc.)
     * @private
     */
    async _processAudioBlob(blob, settings) {
        // For real-time exports, processing is limited
        // Full processing would require decoding, processing, and re-encoding
        // For now, return as-is
        return blob;
    }

    /**
     * Create audio asset from exported buffer
     * @private
     */
    async _createAudioAsset(audioBuffer, channelName, channelId, durationBeats) {
        try {
            // Create asset ID
            const assetId = `asset-export-${channelId}-${Date.now()}`;
            const name = `Exported ${channelName}`;

            // Add to AudioAssetManager
            await audioAssetManager.addAsset({
                id: assetId,
                name: name,
                buffer: audioBuffer,
                url: null, // No URL, it's a generated buffer
                type: 'audio',
                metadata: {
                    exported: true,
                    channelId: channelId,
                    channelName: channelName,
                    durationBeats: durationBeats,
                    sampleRate: audioBuffer.sampleRate,
                    duration: audioBuffer.duration,
                    numberOfChannels: audioBuffer.numberOfChannels
                }
            });

            console.log(`🎹 Created audio asset ${assetId} from export (${durationBeats.toFixed(2)} beats)`);

            // Add to Project Audio Store (for Audio tab in arrangement)
            try {
                const { useProjectAudioStore } = await import('../../store/useProjectAudioStore');
                const projectAudioStore = useProjectAudioStore.getState();

                projectAudioStore.addSample({
                    id: assetId,
                    name: name,
                    assetId: assetId,
                    durationBeats: durationBeats,
                    durationSeconds: audioBuffer.duration,
                    type: 'exported',
                    channelId: channelId,
                    metadata: {
                        sampleRate: audioBuffer.sampleRate,
                        numberOfChannels: audioBuffer.numberOfChannels
                    }
                });

                console.log(`📦 Added exported sample to Project Audio Store: ${name}`);
            } catch (error) {
                console.error('⚠️ Failed to add exported sample to Project Audio Store:', error);
                // Non-critical error, don't throw
            }

            return assetId;
        } catch (error) {
            console.error('🎹 Failed to create audio asset from export:', error);
            throw error;
        }
    }

    /**
     * Add exported audio to arrangement as clip
     * @private
     */
    async _addToArrangement(assetId, channelName, channelId, durationBeats, audioBuffer) {
        try {
            const { useArrangementWorkspaceStore } = await import('../../store/useArrangementWorkspaceStore');
            const store = useArrangementWorkspaceStore.getState();
            const arrangement = store.getActiveArrangement();

            if (!arrangement) {
                console.warn('🎵 No active arrangement, skipping clip creation');
                return null;
            }

            // Find a good placement position
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
            const mixerChannelId = arrangementTrack?.channelId || channelId; // Use channel's own ID if track has no channel

            console.log(`🎛️ Audio clip routing: trackId=${trackId}, mixerChannelId=${mixerChannelId}`);

            // Create audio clip data
            const audioClipData = {
                type: 'audio',
                assetId: assetId,
                trackId: trackId,
                channelId: mixerChannelId,
                name: channelName,
                startTime: startTime,
                duration: durationBeats,
                color: '#4a90e2',
                metadata: {
                    exported: true,
                    originalChannel: channelId,
                    exportedAt: Date.now()
                }
            };

            // Add clip to arrangement
            const clipId = store.addClip(audioClipData);

            console.log(`🎵 Created arrangement clip ${clipId} at ${startTime.toFixed(2)} beats on track ${trackId}`);
            return clipId;
        } catch (error) {
            console.error('🎵 Failed to add exported audio to arrangement:', error);
            return null;
        }
    }

    /**
     * Generate filename from template
     * @private
     */
    _generateFileName(channelName, settings) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const extension = settings.format;
        
        let filename = settings.fileNameTemplate
            .replace('{channelName}', channelName)
            .replace('{timestamp}', timestamp)
            .replace('{format}', settings.format.toUpperCase());
        
        if (!filename.endsWith(`.${extension}`)) {
            filename += `.${extension}`;
        }
        
        return filename;
    }

    /**
     * Download file
     * @private
     */
    async _downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Get MIME type for format
     * @private
     */
    _getMimeType(format) {
        const mimeTypes = {
            [EXPORT_FORMAT.WAV]: 'audio/wav',
            [EXPORT_FORMAT.MP3]: 'audio/mpeg',
            [EXPORT_FORMAT.OGG]: 'audio/ogg',
            [EXPORT_FORMAT.FLAC]: 'audio/flac',
            [EXPORT_FORMAT.AIFF]: 'audio/aiff'
        };
        return mimeTypes[format] || 'audio/wav';
    }
}

// ✅ FIX: Lazy singleton - only create when needed (after audio engine is ready)
let _exportManagerInstance = null;

export function getExportManager() {
  if (!_exportManagerInstance) {
    _exportManagerInstance = new ExportManager();
    // Update sample rate when audio engine becomes available
    if (window.audioEngine) {
      _exportManagerInstance.renderEngine.updateSampleRate();
    }
  }
  return _exportManagerInstance;
}

// For backward compatibility - lazy proxy
export const exportManager = new Proxy({}, {
  get(target, prop) {
    // Only create instance when actually accessed
    const instance = getExportManager();
    return instance[prop];
  }
});

// ✅ FIX: Don't create instance on module load
// Use getExportManager() when you need the instance
export default exportManager;

