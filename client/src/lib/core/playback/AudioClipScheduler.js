/**
 * AudioClipScheduler - Audio Sample Playback Scheduling
 *
 * Responsibilities:
 * - Schedule audio sample/clip playback
 * - Handle audio buffer management
 * - Track active audio sources for proper cleanup
 *
 * Extracted from PlaybackManager for better modularity
 */

import { audioAssetManager } from '../../audio/AudioAssetManager.js';

export class AudioClipScheduler {
    constructor(transport, audioEngine) {
        this.transport = transport;
        this.audioEngine = audioEngine;
        this.activeAudioSources = [];
    }

    /**
     * Schedule an audio clip for playback
     *
     * @param {Object} clip - Audio clip data
     * @param {number} baseTime - Base time for scheduling
     * @returns {boolean} Success status
     */
    scheduleAudioClip(clip, baseTime) {
        // Get audio buffer from various sources
        let audioBuffer = null;

        // Priority 1: Check AudioAssetManager (modern system with assetId)
        if (clip.assetId) {
            const asset = audioAssetManager.getAsset(clip.assetId);
            audioBuffer = asset?.buffer;
        }

        // Priority 2: Direct audioBuffer (legacy)
        if (!audioBuffer && clip.audioBuffer) {
            audioBuffer = clip.audioBuffer;
        }

        // Priority 3: Try to get sample from instruments store (legacy)
        if (!audioBuffer && clip.sampleId) {
            const instrument = this.audioEngine.instruments.get(clip.sampleId);
            if (instrument) {
                audioBuffer = instrument.audioBuffer || instrument.buffer;
            }
        }

        if (!audioBuffer) {
            console.warn(`AudioClipScheduler: Audio clip ${clip.id} has no audio buffer`, {
                assetId: clip.assetId,
                sampleId: clip.sampleId,
                hasDirectBuffer: !!clip.audioBuffer
            });
            return false;
        }

        // Convert clip startTime (in beats) to seconds
        const clipStartBeats = clip.startTime || 0;
        const clipStartSeconds = clipStartBeats * (60 / this.transport.bpm); // beats to seconds
        const absoluteStartTime = baseTime + clipStartSeconds;

        // Calculate duration
        const clipDurationBeats = clip.duration || (audioBuffer.duration * (this.transport.bpm / 60));
        const clipDurationSeconds = clipDurationBeats * (60 / this.transport.bpm); // beats to seconds

        // Get clip offset (where to start playing in the buffer)
        const clipOffset = clip.offset || 0; // in seconds

        // Schedule audio playback
        this.transport.scheduleEvent(
            absoluteStartTime,
            (scheduledTime) => {
                try {
                    const source = this.transport.audioContext.createBufferSource();
                    source.buffer = audioBuffer;

                    // Apply playback rate if specified
                    if (clip.playbackRate) {
                        source.playbackRate.value = clip.playbackRate;
                    }

                    // Connect to destination (mixer channel or master)
                    const destination = this._getClipDestination(clip);
                    source.connect(destination);

                    // Start playback
                    const startOffset = clipOffset;
                    const duration = clipDurationSeconds;

                    source.start(scheduledTime, startOffset, duration);

                    // Store source for cleanup
                    source.clipId = clip.id;
                    this.activeAudioSources.push(source);

                    // Auto-cleanup when finished
                    source.onended = () => {
                        this.activeAudioSources = this.activeAudioSources.filter(s => s !== source);
                    };

                } catch (error) {
                    console.error(`AudioClipScheduler: Error playing audio clip ${clip.id}:`, error);
                }
            },
            { type: 'audioClip', clipId: clip.id }
        );

        return true;
    }

    /**
     * Get destination node for audio clip
     * @private
     */
    _getClipDestination(clip) {
        // Check if clip has assigned mixer channel
        if (clip.channelId) {
            const channel = this.audioEngine.mixerChannels.get(clip.channelId);
            if (channel && channel.input) {
                return channel.input;
            }
        }

        // Default to master output
        return this.audioEngine.masterMixer || this.transport.audioContext.destination;
    }

    /**
     * Clear all scheduled events and active sources for a specific clip
     *
     * @param {string} clipId - Clip ID to clear
     */
    clearClipEvents(clipId) {
        if (!clipId) {
            return;
        }

        // Clear scheduled transport events for this clip
        if (this.transport.clearScheduledEvents) {
            this.transport.clearScheduledEvents(event => event.clipId === clipId);
        }

        // Stop any currently playing audio sources for this clip
        const sourcesToStop = this.activeAudioSources.filter(source => source.clipId === clipId);
        sourcesToStop.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                // Already stopped or not started
            }
        });

        this.activeAudioSources = this.activeAudioSources.filter(source => source.clipId !== clipId);
    }

    /**
     * Stop all active audio sources
     */
    stopAll() {
        this.activeAudioSources.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                // Already stopped
            }
        });

        this.activeAudioSources = [];
    }

    /**
     * Get active audio sources count
     */
    getStats() {
        return {
            activeAudioSources: this.activeAudioSources.length
        };
    }

    /**
     * Get list of active audio sources
     */
    getActiveSources() {
        return [...this.activeAudioSources];
    }
}
