/**
 * MultiSampleInstrument - Multi-sampled instrument with intelligent sample selection
 *
 * Features:
 * - Automatically selects nearest sample for each note
 * - Minimal pitch shifting (better sound quality)
 * - Voice pooling with intelligent voice stealing
 * - Polyphony limiting for CPU efficiency
 * - Velocity layers support (future)
 * - Round-robin support (future)
 *
 * Example: Piano with samples at C1, C2, C3, C4, C5, C6, C7, C8
 * - Playing C#4 (61) -> Uses C4 sample, pitch shifted +1 semitone
 * - Playing G4 (67) -> Uses C5 sample, pitch shifted -5 semitones
 */

import { BaseInstrument } from '../base/BaseInstrument.js';
import { VoicePool } from '../base/VoicePool.js';
import { SampleVoice } from './SampleVoice.js';

export class MultiSampleInstrument extends BaseInstrument {
    constructor(instrumentData, audioContext, sampleBuffers) {
        super(instrumentData, audioContext);

        // Multi-sample configuration
        this.multiSamples = instrumentData.multiSamples || [];
        this.sampleBuffers = sampleBuffers; // Map<url, AudioBuffer>

        // Sample mapping
        this.sampleMap = null; // midiNote -> { buffer, baseNote, pitchShift }

        // Playback settings
        // ⚡ OPTIMIZED: Reduced from 32 to 16 voices (AudioNode optimization)
        this.maxPolyphony = 16;

        // ✅ NEW: Voice pooling for CPU efficiency and voice stealing
        this.voicePool = null;

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

            // ✅ NEW: Create voice pool with pre-allocated voices
            this.voicePool = new VoicePool(
                this.audioContext,
                SampleVoice,
                this.maxPolyphony
            );

            // Initialize all voices
            this.voicePool.voices.forEach(voice => {
                voice.initialize();
            });

            // Connect all voices to master
            this.voicePool.voices.forEach(voice => {
                voice.output.connect(this.masterGain);
            });

            // Build sample map
            this.sampleMap = this._buildSampleMap();

            this._isInitialized = true;

            console.log(`🎹 MultiSample initialized: ${this.name} (${this.multiSamples.length} samples, ${this.maxPolyphony} voices)`);

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
    noteOn(midiNote, velocity = 100, startTime = null, extendedParams = null) {
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
            // ✅ CUT ITSELF: Check if same note should cut itself
            const cutItself = this.data.cutItself !== undefined ? this.data.cutItself : false;
            const allowPolyphony = !cutItself; // If cutItself=true, don't allow polyphony for same note

            // ✅ NEW: Allocate voice from pool (with voice stealing if needed)
            const voice = this.voicePool.allocate(midiNote, allowPolyphony);

            if (!voice) {
                console.warn(`${this.name}: No voice available for note ${midiNote}`);
                return;
            }

            // Calculate frequency for the note
            const frequency = this.midiToFrequency(midiNote);

            // ✅ PHASE 2: Trigger voice with sample data and extended params
            voice.trigger(midiNote, velocity, frequency, time, mapping, this.data, extendedParams);

            // Track note
            this._trackNoteOn(midiNote, velocity, time);

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

        try {
            if (midiNote !== null) {
                // ✅ NEW: Release specific note via voice pool
                this.voicePool.release(midiNote, time);
                this._trackNoteOff(midiNote);
            } else {
                // ✅ NEW: Release all notes via voice pool
                this.voicePool.releaseAll(time);
                this.activeNotes.clear();
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

        console.log(`🛑 MultiSample stopAll: ${this.name} (${this.voicePool.activeVoices.size} active)`);

        // ✅ NEW: Stop all voices immediately via voice pool
        this.voicePool.stopAll();

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
     * Update parameters in real-time
     * Called when user changes parameters in the editor
     */
    updateParameters(params) {
        console.log(`🎛️ MultiSampleInstrument.updateParameters (${this.name}):`, params);

        // Update internal data
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined) {
                this.data[key] = params[key];
            }
        });

        // Update master gain if volume/gain changed
        if (params.gain !== undefined && this.masterGain) {
            this.masterGain.gain.setValueAtTime(
                params.gain,
                this.audioContext.currentTime
            );
        }

        // ADSR and filter params will be used in next noteOn via trigger()
        // No need to update active voices, they keep their envelope

        console.log(`✅ Parameters updated for ${this.name}`);
    }

    /**
     * Cleanup
     */
    dispose() {
        // ✅ NEW: Dispose voice pool
        if (this.voicePool) {
            this.voicePool.dispose();
            this.voicePool = null;
        }

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
            sampleCount: this.multiSamples.length,
            hasVoiceStealing: true // ✅ NEW: Supports voice stealing
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
            activeVoices: this.voicePool?.activeVoices.size || 0, // ✅ NEW: Voice pool count
            maxVoices: this.maxPolyphony,
            sampleMapSize: this.sampleMap?.size || 0,
            samples: this.multiSamples.map(s => ({
                note: s.note,
                midiNote: s.midiNote,
                url: s.url.split('/').pop()
            }))
        };
    }
}
