/**
 * MultiSampleInstrument - Multi-sampled instrument with intelligent sample selection
 *
 * Features:
 * - Automatically selects nearest sample for each note
 * - Minimal pitch shifting (better sound quality)
 * - Voice pooling with intelligent voice stealing
 * - Polyphony limiting for CPU efficiency
 * - ✅ Velocity layers support (implemented)
 * - ✅ Round-robin support (implemented)
 *
 * Example: Piano with samples at C1, C2, C3, C4, C5, C6, C7, C8
 * - Playing C#4 (61) -> Uses C4 sample, pitch shifted +1 semitone
 * - Playing G4 (67) -> Uses C5 sample, pitch shifted -5 semitones
 */

import { BaseInstrument } from '../base/BaseInstrument.js';
import { VoicePool } from '../base/VoicePool.js';
import { SampleVoice } from './SampleVoice.js';
import { TimeStretcher } from '../../dsp/TimeStretcher.js';

export class MultiSampleInstrument extends BaseInstrument {
    constructor(instrumentData, audioContext, sampleBuffers) {
        super(instrumentData, audioContext);

        // Multi-sample configuration
        this.multiSamples = instrumentData.multiSamples || [];
        this.sampleBuffers = sampleBuffers; // Map<url, AudioBuffer>

        // Sample mapping
        this.sampleMap = null; // midiNote -> { buffer, baseNote, pitchShift }

        // ✅ ROUND ROBIN: Track round-robin counters for each note
        // midiNote -> current round-robin index
        this.roundRobinCounters = new Map();

        // Playback settings
        // ⚡ OPTIMIZED: Reduced from 32 to 16 voices (AudioNode optimization)
        this.maxPolyphony = 16;

        // ✅ NEW: Voice pooling for CPU efficiency and voice stealing
        this.voicePool = null;

        // ✅ TIME STRETCH: Time stretcher for pitch-shifted buffers
        this.timeStretcher = null;
        this.timeStretchEnabled = instrumentData.timeStretchEnabled !== undefined 
            ? instrumentData.timeStretchEnabled 
            : false; // Default: disabled (use playbackRate)

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

            // ✅ TIME STRETCH: Initialize time stretcher if enabled
            if (this.timeStretchEnabled) {
                this.timeStretcher = new TimeStretcher(this.audioContext);
                console.log(`🎚️ Time stretching enabled for ${this.name}`);
            }

            // ✅ NEW: Create voice pool with pre-allocated voices
            this.voicePool = new VoicePool(
                this.audioContext,
                SampleVoice,
                this.maxPolyphony
            );

            // Initialize all voices (pass timeStretcher if enabled)
            this.voicePool.voices.forEach(voice => {
                voice.initialize();
                // ✅ TIME STRETCH: Inject time stretcher into voice
                if (this.timeStretchEnabled && this.timeStretcher) {
                    voice.timeStretcher = this.timeStretcher;
                    voice.timeStretchEnabled = true;
                }
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
     * ✅ VELOCITY LAYERS: Now supports velocity-aware sample selection
     * @private
     */
    _buildSampleMap() {
        const map = new Map();

        // Sort samples by MIDI note
        const sortedSamples = [...this.multiSamples].sort((a, b) => a.midiNote - b.midiNote);

        // ✅ VELOCITY LAYERS: Check if any sample has velocityRange
        const hasVelocityLayers = sortedSamples.some(s => s.velocityRange);
        // ✅ ROUND ROBIN: Check if any sample has roundRobinIndex
        const hasRoundRobin = sortedSamples.some(s => s.roundRobinIndex !== undefined);

        if (hasVelocityLayers) {
            // ✅ VELOCITY LAYERS: Build map with velocity layers
            // Map structure: midiNote -> Map<velocity, sampleMapping>
            // This allows multiple samples per MIDI note based on velocity
            // Note: Round-robin is handled dynamically in noteOn(), not pre-built in map
            for (let midiNote = 0; midiNote <= 127; midiNote++) {
                const velocityMap = new Map();

                // Find all samples for this MIDI note (considering velocity layers)
                // Round-robin will be applied at playback time, not during map building
                for (let velocity = 0; velocity <= 127; velocity++) {
                    const sample = this._findSampleForNoteAndVelocity(midiNote, velocity, sortedSamples, false);

                    if (sample) {
                        const buffer = this.sampleBuffers.get(sample.url);

                        if (buffer) {
                            const pitchShift = midiNote - sample.midiNote;

                            velocityMap.set(velocity, {
                                buffer,
                                baseNote: sample.midiNote,
                                baseName: sample.note,
                                pitchShift, // semitones
                                url: sample.url,
                                velocityRange: sample.velocityRange,
                                roundRobinIndex: sample.roundRobinIndex // Store for round-robin
                            });
                        }
                    }
                }

                if (velocityMap.size > 0) {
                    map.set(midiNote, velocityMap);
                }
            }

            console.log(`  ✅ Sample map built with velocity layers${hasRoundRobin ? ' and round-robin support' : ''}: ${map.size} MIDI notes mapped`);
        } else {
            // ✅ BACKWARD COMPATIBLE: No velocity layers - use old method
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
        }

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
     * ✅ VELOCITY LAYERS: Find sample for a MIDI note and velocity
     * ✅ ROUND ROBIN: Also considers round-robin index for variation selection
     * First filters by velocity range, then finds nearest by MIDI note, then applies round-robin
     * @private
     */
    _findSampleForNoteAndVelocity(midiNote, velocity, sortedSamples, useRoundRobin = true) {
        if (sortedSamples.length === 0) return null;

        // Step 1: Filter samples that match this velocity
        const velocityMatchedSamples = sortedSamples.filter(sample => {
            if (!sample.velocityRange) {
                // No velocity range = matches all velocities (fallback)
                return true;
            }

            const { min = 0, max = 127 } = sample.velocityRange;
            return velocity >= min && velocity <= max;
        });

        // Step 2: If no velocity-matched samples, use all samples (fallback)
        let candidates = velocityMatchedSamples.length > 0 
            ? velocityMatchedSamples 
            : sortedSamples;

        // Step 3: Filter by MIDI note (find samples for this exact note or nearest)
        const noteMatchedSamples = candidates.filter(sample => {
            return sample.midiNote === midiNote;
        });

        // If we have exact note matches, use them; otherwise use nearest
        if (noteMatchedSamples.length > 0) {
            candidates = noteMatchedSamples;
        } else {
            // Find nearest by MIDI note
            let nearestDistance = Infinity;
            let nearestMidiNote = null;

            for (const sample of candidates) {
                const distance = Math.abs(midiNote - sample.midiNote);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestMidiNote = sample.midiNote;
                }
            }

            if (nearestMidiNote !== null) {
                candidates = candidates.filter(s => s.midiNote === nearestMidiNote);
            }
        }

        // Step 4: ✅ ROUND ROBIN: If multiple candidates with same note, apply round-robin
        if (useRoundRobin && candidates.length > 1) {
            // Check if any candidate has roundRobinIndex
            const hasRoundRobin = candidates.some(s => s.roundRobinIndex !== undefined);

            if (hasRoundRobin) {
                // Group by roundRobinIndex
                const roundRobinGroups = new Map();
                candidates.forEach(sample => {
                    const index = sample.roundRobinIndex !== undefined ? sample.roundRobinIndex : 0;
                    if (!roundRobinGroups.has(index)) {
                        roundRobinGroups.set(index, []);
                    }
                    roundRobinGroups.get(index).push(sample);
                });

                // Get current round-robin counter for this note
                const currentIndex = this.roundRobinCounters.get(midiNote) || 0;
                const roundRobinIndices = Array.from(roundRobinGroups.keys()).sort((a, b) => a - b);
                const nextIndex = roundRobinIndices[currentIndex % roundRobinIndices.length];

                // Update counter for next time
                this.roundRobinCounters.set(midiNote, (currentIndex + 1) % roundRobinIndices.length);

                // Return first sample from selected round-robin group
                const selectedGroup = roundRobinGroups.get(nextIndex);
                if (selectedGroup && selectedGroup.length > 0) {
                    return selectedGroup[0];
                }
            }
        }

        // Step 5: If no round-robin or single candidate, return first
        return candidates.length > 0 ? candidates[0] : null;
    }

    /**
     * Play a note
     * ✅ VELOCITY LAYERS: Now selects sample based on velocity
     */
    noteOn(midiNote, velocity = 100, startTime = null, extendedParams = null) {
        if (!this._isInitialized) {
            console.warn(`${this.name}: Not initialized`);
            return;
        }

        const time = startTime !== null ? startTime : this.audioContext.currentTime;

        // ✅ VELOCITY LAYERS: Get sample mapping for this note and velocity
        const mapping = this._getSampleMapping(midiNote, velocity);

        if (!mapping) {
            console.warn(`${this.name}: No sample for MIDI note ${midiNote} at velocity ${velocity}`);
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
     * ✅ VELOCITY LAYERS: Get sample mapping for a MIDI note and velocity
     * ✅ ROUND ROBIN: Also applies round-robin selection for variations
     * Handles both velocity-layered and non-layered sample maps
     * @private
     */
    _getSampleMapping(midiNote, velocity) {
        const mapEntry = this.sampleMap.get(midiNote);

        if (!mapEntry) {
            return null;
        }

        // Check if this is a velocity-layered map (Map<velocity, mapping>)
        if (mapEntry instanceof Map) {
            // ✅ VELOCITY LAYERS: Get sample for this velocity
            // Try exact velocity first, then find closest
            let selectedMapping = null;

            if (mapEntry.has(velocity)) {
                selectedMapping = mapEntry.get(velocity);
            } else {
                // Find closest velocity
                let closestVelocity = null;
                let minDistance = Infinity;

                for (const [mapVelocity, mapping] of mapEntry.entries()) {
                    const distance = Math.abs(velocity - mapVelocity);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestVelocity = mapVelocity;
                    }
                }

                if (closestVelocity !== null) {
                    selectedMapping = mapEntry.get(closestVelocity);
                }
            }

            // ✅ ROUND ROBIN: If multiple samples with same velocity/note, apply round-robin
            if (selectedMapping && selectedMapping.roundRobinIndex !== undefined) {
                // Check if there are other samples with same note and velocity range
                const sameNoteSamples = [];
                for (const [mapVelocity, mapping] of mapEntry.entries()) {
                    if (mapping.roundRobinIndex !== undefined && 
                        mapping.baseNote === selectedMapping.baseNote) {
                        sameNoteSamples.push({ velocity: mapVelocity, mapping });
                    }
                }

                if (sameNoteSamples.length > 1) {
                    // Group by roundRobinIndex
                    const roundRobinGroups = new Map();
                    sameNoteSamples.forEach(({ mapping }) => {
                        const index = mapping.roundRobinIndex || 0;
                        if (!roundRobinGroups.has(index)) {
                            roundRobinGroups.set(index, []);
                        }
                        roundRobinGroups.get(index).push(mapping);
                    });

                    // Get current round-robin counter for this note
                    const currentIndex = this.roundRobinCounters.get(midiNote) || 0;
                    const roundRobinIndices = Array.from(roundRobinGroups.keys()).sort((a, b) => a - b);
                    const nextIndex = roundRobinIndices[currentIndex % roundRobinIndices.length];

                    // Update counter for next time
                    this.roundRobinCounters.set(midiNote, (currentIndex + 1) % roundRobinIndices.length);

                    // Return first sample from selected round-robin group
                    const selectedGroup = roundRobinGroups.get(nextIndex);
                    if (selectedGroup && selectedGroup.length > 0) {
                        return selectedGroup[0];
                    }
                }
            }

            return selectedMapping;
        } else {
            // ✅ BACKWARD COMPATIBLE: Non-layered map (direct mapping)
            // ✅ ROUND ROBIN: Still check for round-robin in non-layered maps
            if (mapEntry.roundRobinIndex !== undefined) {
                // Check if there are other samples with same note in multiSamples
                const sameNoteSamples = this.multiSamples.filter(s => 
                    s.midiNote === mapEntry.baseNote && 
                    s.roundRobinIndex !== undefined
                );

                if (sameNoteSamples.length > 1) {
                    // Group by roundRobinIndex
                    const roundRobinGroups = new Map();
                    sameNoteSamples.forEach(sample => {
                        const index = sample.roundRobinIndex || 0;
                        if (!roundRobinGroups.has(index)) {
                            roundRobinGroups.set(index, []);
                        }
                        roundRobinGroups.get(index).push(sample);
                    });

                    // Get current round-robin counter for this note
                    const currentIndex = this.roundRobinCounters.get(midiNote) || 0;
                    const roundRobinIndices = Array.from(roundRobinGroups.keys()).sort((a, b) => a - b);
                    const nextIndex = roundRobinIndices[currentIndex % roundRobinIndices.length];

                    // Update counter for next time
                    this.roundRobinCounters.set(midiNote, (currentIndex + 1) % roundRobinIndices.length);

                    // Get sample from selected round-robin group
                    const selectedGroup = roundRobinGroups.get(nextIndex);
                    if (selectedGroup && selectedGroup.length > 0) {
                        const selectedSample = selectedGroup[0];
                        const buffer = this.sampleBuffers.get(selectedSample.url);
                        if (buffer) {
                            const pitchShift = midiNote - selectedSample.midiNote;
                            return {
                                buffer,
                                baseNote: selectedSample.midiNote,
                                baseName: selectedSample.note,
                                pitchShift,
                                url: selectedSample.url,
                                roundRobinIndex: selectedSample.roundRobinIndex
                            };
                        }
                    }
                }
            }

            return mapEntry;
        }
    }

    /**
     * Stop a note
     * @param {number|null} midiNote - MIDI note to stop (null = stop all)
     * @param {number|null} stopTime - When to stop (AudioContext time)
     * @param {number|null} releaseVelocity - Note-off velocity (0-127, null = default)
     */
    noteOff(midiNote = null, stopTime = null, releaseVelocity = null) {
        if (!this._isInitialized) {
            return;
        }

        const time = stopTime !== null ? stopTime : this.audioContext.currentTime;

        try {
            if (midiNote !== null) {
                // ✅ RELEASE VELOCITY: Release specific note via voice pool with release velocity
                this.voicePool.release(midiNote, time, releaseVelocity);
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

        // ✅ SAMPLE START MODULATION: Update sampleStart and sampleStartModulation
        if (params.sampleStart !== undefined) {
            this.data.sampleStart = params.sampleStart;
            console.log(`🎚️ Sample start updated: ${params.sampleStart}`);
        }
        
        if (params.sampleStartModulation !== undefined) {
            this.data.sampleStartModulation = params.sampleStartModulation;
            console.log(`🎚️ Sample start modulation updated:`, params.sampleStartModulation);
        }

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
