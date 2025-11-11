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
import { useArrangementStore } from '../../../store/useArrangementStore.js';

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

        // ✅ FIX: Get clip offset (where to start playing in the buffer)
        // Support both 'offset' and 'sampleOffset' properties (sampleOffset is used for split clips)
        const clipOffset = clip.sampleOffset || clip.offset || 0; // in seconds

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
                    console.log(`🔍 Getting destination for clip ${clip.id}:`, {
                        clipChannelId: clip.channelId,
                        clipTrackId: clip.trackId,
                        clipType: clip.type
                    });

                    const destination = this._getClipDestination(clip);

                    console.log(`🔍 Destination node:`, {
                        destination,
                        isAudioNode: destination instanceof AudioNode,
                        nodeType: destination?.constructor?.name
                    });

                    if (!destination || !(destination instanceof AudioNode)) {
                        throw new Error(`Invalid destination node for clip ${clip.id}`);
                    }

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
        // ✅ FIX: Support both clip.mixerChannelId (arrangement clips) and clip.channelId (legacy)
        const mixerChannelId = clip.mixerChannelId || clip.channelId;
        
        // 🎛️ DYNAMIC MIXER: Check if clip has assigned mixer insert first
        if (mixerChannelId) {
            // Try mixer insert first (new system)
            const insert = this.audioEngine.mixerInserts?.get(mixerChannelId);
            if (insert && insert.input) {
                console.log(`🎵 Audio clip "${clip.name || clip.id}" routed to mixer insert: ${mixerChannelId}`);
                return insert.input;
            }

            // Fallback to old mixer channels (backward compatibility)
            const channel = this.audioEngine.mixerChannels?.get(mixerChannelId);
            if (channel && channel.input) {
                console.log(`🎵 Audio clip "${clip.name || clip.id}" routed to legacy mixer channel: ${mixerChannelId}`);
                return channel.input;
            }
        }
        
        // ✅ FIX: If clip doesn't have mixerChannelId, try to route through track's mixer channel
        // This is for arrangement clips where mixerChannelId is null (inherit from track)
        if (clip.trackId) {
            try {
                const arrangementStore = useArrangementStore.getState();
                const track = arrangementStore.arrangementTracks?.find(t => t.id === clip.trackId);
                
                if (track) {
                    // Get track's mixer insert ID from _trackChannelMap
                    const trackChannelMap = arrangementStore._trackChannelMap;
                    const trackMixerInsertId = trackChannelMap?.get(track.id);
                    
                    if (trackMixerInsertId) {
                        const trackInsert = this.audioEngine.mixerInserts?.get(trackMixerInsertId);
                        if (trackInsert && trackInsert.input) {
                            console.log(`🎵 Audio clip "${clip.name || clip.id}" routed to track's mixer insert: ${trackMixerInsertId} (inherited from track "${track.name}")`);
                            return trackInsert.input;
                        }
                    }
                }
                
                // Fallback: try to construct mixer insert ID from track ID (standard naming convention)
                const trackMixerInsertId = `arr-${clip.trackId}`;
                const trackInsert = this.audioEngine.mixerInserts?.get(trackMixerInsertId);
                if (trackInsert && trackInsert.input) {
                    console.log(`🎵 Audio clip "${clip.name || clip.id}" routed to track's mixer insert: ${trackMixerInsertId} (fallback from track ID)`);
                    return trackInsert.input;
                }
            } catch (error) {
                console.warn(`⚠️ Could not get track mixer channel for clip ${clip.id}:`, error);
            }
        }

        // Try master mixer insert
        if (this.audioEngine.masterInsert?.input) {
            console.log(`🎵 Audio clip routed to master mixer insert`);
            return this.audioEngine.masterInsert.input;
        }

        // Try legacy master mixer
        if (this.audioEngine.masterMixer?.input) {
            console.log(`🎵 Audio clip routed to legacy master mixer`);
            return this.audioEngine.masterMixer.input;
        }

        // Fallback to master gain node
        if (this.audioEngine.masterGain) {
            console.log(`🎵 Audio clip routed to master gain (fallback)`);
            return this.audioEngine.masterGain;
        }

        // Last resort - audio context destination
        const audioContext = this.transport?.audioContext || this.audioEngine?.audioContext;
        if (audioContext && audioContext.destination) {
            console.log(`⚠️ Audio clip routed to audio context destination (no mixer routing)`);
            return audioContext.destination;
        }

        // Error - no valid destination
        console.error(`❌ No valid destination found for audio clip ${clip.id}`);
        throw new Error('No valid audio destination available');
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
