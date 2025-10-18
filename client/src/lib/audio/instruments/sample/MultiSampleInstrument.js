/**
 * MultiSampleInstrument - Multi-sampled instrument with intelligent sample selection
 *
 * Features:
 * - Automatically selects nearest sample for each note
 * - Minimal pitch shifting (better sound quality)
 * - Velocity layers support (future)
 * - Round-robin support (future)
 *
 * Example: Piano with samples at C1, C2, C3, C4, C5, C6, C7, C8
 * - Playing C#4 (61) -> Uses C4 sample, pitch shifted +1 semitone
 * - Playing G4 (67) -> Uses C5 sample, pitch shifted -5 semitones
 */

import { BaseInstrument } from '../base/BaseInstrument.js';

export class MultiSampleInstrument extends BaseInstrument {
    constructor(instrumentData, audioContext, sampleBuffers) {
        super(instrumentData, audioContext);

        // Multi-sample configuration
        this.multiSamples = instrumentData.multiSamples || [];
        this.sampleBuffers = sampleBuffers; // Map<url, AudioBuffer>

        // Sample mapping
        this.sampleMap = null; // midiNote -> { buffer, baseNote, pitchShift }

        // Playback settings
        this.maxPolyphony = 32;
        this.activeSources = new Map(); // midiNote -> { source, gainNode }

        // Master output
        this.masterGain = null;
    }

    /**
     * Initialize and build sample map
     */
    async initialize() {
        try {
            // Create master gain
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.setValueAtTime(0.8, this.audioContext.currentTime);
            this.output = this.masterGain;

            // Build sample map
            this.sampleMap = this._buildSampleMap();

            this._isInitialized = true;

            console.log(`🎹 MultiSample initialized: ${this.name} (${this.multiSamples.length} samples)`);

        } catch (error) {
            console.error(`❌ MultiSample init failed: ${this.name}:`, error);
            throw error;
        }
    }

    /**
     * Build MIDI note -> sample mapping
     * @private
     */
    _buildSampleMap() {
        const map = new Map();

        // Sort samples by MIDI note
        const sortedSamples = [...this.multiSamples].sort((a, b) => a.midiNote - b.midiNote);

        // For each MIDI note (0-127), find nearest sample
        for (let midiNote = 0; midiNote <= 127; midiNote++) {
            const nearestSample = this._findNearestSample(midiNote, sortedSamples);

            if (nearestSample) {
                const buffer = this.sampleBuffers.get(nearestSample.url);

                if (buffer) {
                    const pitchShift = midiNote - nearestSample.midiNote;

                    map.set(midiNote, {
                        buffer,
                        baseNote: nearestSample.midiNote,
                        baseName: nearestSample.note,
                        pitchShift, // semitones
                        url: nearestSample.url
                    });
                }
            }
        }

        console.log(`  Sample map built: ${map.size} MIDI notes mapped`);

        return map;
    }

    /**
     * Find nearest sample for a MIDI note
     * @private
     */
    _findNearestSample(midiNote, sortedSamples) {
        if (sortedSamples.length === 0) return null;

        // Find sample with minimum distance
        let nearestSample = sortedSamples[0];
        let minDistance = Math.abs(midiNote - sortedSamples[0].midiNote);

        for (const sample of sortedSamples) {
            const distance = Math.abs(midiNote - sample.midiNote);

            if (distance < minDistance) {
                minDistance = distance;
                nearestSample = sample;
            }
        }

        return nearestSample;
    }

    /**
     * Play a note
     */
    noteOn(midiNote, velocity = 100, startTime = null) {
        if (!this._isInitialized) {
            console.warn(`${this.name}: Not initialized`);
            return;
        }

        const time = startTime !== null ? startTime : this.audioContext.currentTime;

        // Get sample mapping for this note
        const mapping = this.sampleMap.get(midiNote);

        if (!mapping) {
            console.warn(`${this.name}: No sample for MIDI note ${midiNote}`);
            return;
        }

        try {
            // Stop existing note if playing
            if (this.activeSources.has(midiNote)) {
                this.noteOff(midiNote, time);
            }

            // Create buffer source
            const source = this.audioContext.createBufferSource();
            source.buffer = mapping.buffer;

            // Calculate playback rate for pitch shifting
            // Formula: playbackRate = 2^(semitones/12)
            const playbackRate = Math.pow(2, mapping.pitchShift / 12);
            source.playbackRate.setValueAtTime(playbackRate, time);

            // Create gain node for velocity
            const gainNode = this.audioContext.createGain();
            const velocityGain = (velocity / 127) * 0.8;
            gainNode.gain.setValueAtTime(0, time);

            // Quick attack envelope
            gainNode.gain.linearRampToValueAtTime(velocityGain, time + 0.005);

            // Connect: source -> gain -> master
            source.connect(gainNode);
            gainNode.connect(this.masterGain);

            // Start playback
            source.start(time);

            // Store active source
            this.activeSources.set(midiNote, { source, gainNode, startTime: time });

            // Track note
            this._trackNoteOn(midiNote, velocity, time);

            // Auto-cleanup when finished
            source.onended = () => {
                if (this.activeSources.get(midiNote)?.source === source) {
                    this.activeSources.delete(midiNote);
                    this._trackNoteOff(midiNote);
                }
                try {
                    gainNode.disconnect();
                } catch (e) {
                    // Already disconnected
                }
            };

        } catch (error) {
            console.error(`❌ MultiSample noteOn failed:`, error);
        }
    }

    /**
     * Stop a note
     */
    noteOff(midiNote = null, stopTime = null) {
        if (!this._isInitialized) {
            return;
        }

        const time = stopTime !== null ? stopTime : this.audioContext.currentTime;
        const releaseTime = 0.15; // Quick release

        try {
            if (midiNote !== null) {
                // Stop specific note
                const active = this.activeSources.get(midiNote);

                if (active) {
                    const { source, gainNode } = active;

                    // Apply release envelope
                    gainNode.gain.cancelScheduledValues(time);
                    gainNode.gain.setValueAtTime(gainNode.gain.value, time);
                    gainNode.gain.linearRampToValueAtTime(0, time + releaseTime);

                    // Stop source after release
                    source.stop(time + releaseTime);
                }
            } else {
                // Stop all notes
                this.activeSources.forEach(({ source, gainNode }, note) => {
                    try {
                        gainNode.gain.cancelScheduledValues(time);
                        gainNode.gain.setValueAtTime(gainNode.gain.value, time);
                        gainNode.gain.linearRampToValueAtTime(0, time + releaseTime);
                        source.stop(time + releaseTime);
                    } catch (e) {
                        // Source may already be stopped
                    }
                });

                // Clear all active sources after release
                setTimeout(() => {
                    this.activeSources.clear();
                    this.activeNotes.clear();
                }, (releaseTime + 0.1) * 1000);
            }

        } catch (error) {
            console.error(`❌ MultiSample noteOff failed:`, error);
        }
    }

    /**
     * ✅ PANIC: Immediately stop all notes (for emergency stop)
     */
    stopAll() {
        if (!this._isInitialized) return;

        console.log(`🛑 MultiSample stopAll: ${this.name} (${this.activeSources.size} active)`);

        // Immediately stop all sources without release
        this.activeSources.forEach(({ source, gainNode }) => {
            try {
                source.stop();
                gainNode.disconnect();
            } catch (e) {
                // Already stopped/disconnected
            }
        });

        this.activeSources.clear();
        this.activeNotes.clear();
        this._isPlaying = false;
    }

    /**
     * Set master volume
     */
    setVolume(volume) {
        if (!this.masterGain) return;

        const clampedVolume = Math.max(0, Math.min(1, volume));
        this.masterGain.gain.setValueAtTime(
            clampedVolume,
            this.audioContext.currentTime
        );
    }

    /**
     * Cleanup
     */
    dispose() {
        // Stop all active sources
        this.activeSources.forEach(({ source }) => {
            try {
                source.stop();
            } catch (e) {
                // Already stopped
            }
        });

        this.activeSources.clear();

        // Disconnect master gain
        if (this.masterGain) {
            try {
                this.masterGain.disconnect();
            } catch (e) {
                // Already disconnected
            }
        }

        super.dispose();

        console.log(`🗑️ MultiSample disposed: ${this.name}`);
    }

    /**
     * Get capabilities
     */
    get capabilities() {
        return {
            supportsPolyphony: true,
            supportsPitchBend: true,
            supportsVelocity: true,
            supportsAftertouch: false,
            maxVoices: this.maxPolyphony,
            multiSampled: true,
            sampleCount: this.multiSamples.length
        };
    }

    /**
     * Get sample info for a MIDI note
     */
    getSampleInfo(midiNote) {
        const mapping = this.sampleMap?.get(midiNote);

        if (!mapping) {
            return null;
        }

        return {
            midiNote,
            noteName: this.midiToNoteName(midiNote),
            baseNote: mapping.baseNote,
            baseName: mapping.baseName,
            pitchShift: mapping.pitchShift,
            url: mapping.url,
            buffer: {
                duration: mapping.buffer.duration,
                channels: mapping.buffer.numberOfChannels,
                sampleRate: mapping.buffer.sampleRate
            }
        };
    }

    /**
     * Get debug info
     */
    getState() {
        return {
            ...this.getDebugInfo(),
            multiSamples: this.multiSamples.length,
            activeSources: this.activeSources.size,
            sampleMapSize: this.sampleMap?.size || 0,
            samples: this.multiSamples.map(s => ({
                note: s.note,
                midiNote: s.midiNote,
                url: s.url.split('/').pop()
            }))
        };
    }
}
