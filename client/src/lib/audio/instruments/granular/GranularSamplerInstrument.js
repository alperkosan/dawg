/**
 * GranularSamplerInstrument - Main granular synthesis instrument
 *
 * A complete granular sampler instrument that extends BaseInstrument.
 * Combines GrainPool, GrainScheduler, and GrainVoice for powerful
 * granular synthesis capabilities.
 *
 * Features:
 * - MIDI-triggered granular playback
 * - Polyphonic (multiple notes can trigger simultaneously)
 * - Real-time parameter control
 * - Sample loading and management
 * - Preset system integration
 *
 * Inspired by Solstice VST and granular synthesis theory
 */

import { BaseInstrument } from '../base/BaseInstrument.js';
import { GrainPool } from './GrainPool.js';
import { GrainScheduler } from './GrainScheduler.js';

export class GranularSamplerInstrument extends BaseInstrument {
    constructor(instrumentData, audioContext, sampleBuffer = null) {
        super(instrumentData, audioContext);

        // Sample data
        this.url = instrumentData.url;
        this.sampleBuffer = sampleBuffer;
        this.baseNote = instrumentData.baseNote || 60; // C4

        // Granular synthesis components
        this.grainPool = null;
        this.grainScheduler = null;

        // Master output chain
        this.masterGain = null;
        this.dryWetMix = null;

        // Active note tracking (for polyphony)
        this.activeNotes = new Map(); // midiNote -> { scheduler, startTime }

        // Granular parameters (user-controllable)
        this.params = instrumentData.params || {
            grainSize: 80,          // ms (will be converted to seconds) - ✅ Increased for better quality
            grainDensity: 12,       // grains/second - ✅ REDUCED from 20 to 12 for performance
            samplePosition: 0.5,    // 0-1
            positionRandom: 0.15,   // 0-1
            pitch: 0,               // semitones
            pitchRandom: 2,         // semitones - ✅ Added variation
            grainEnvelope: 'hann',  // 'hann', 'triangle', 'gaussian'
            reverse: 0.1,           // 0-1 (probability) - ✅ Slight reverse for texture
            spread: 0.7,            // 0-1 (stereo spread) - ✅ Wider stereo
            mix: 1.0,               // 0-1 (dry/wet - for future)
            gain: 0.8               // 0-1 (master gain)
        };

        // Playback mode
        this.continuousMode = true; // If true, grains emit continuously on noteOn (default: true for sustained patterns)
        this.maxPolyphony = 4;      // Max simultaneous notes - ✅ REDUCED from 8 to 4 for performance

        console.log(`🌾 GranularSampler created: ${this.name}`);
    }

    /**
     * Initialize instrument
     */
    async initialize() {
        try {
            // Create master gain
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.setValueAtTime(this.params.gain, this.audioContext.currentTime);

            // Create grain pool (64 voices - optimized from 128)
            // ⚡ OPTIMIZED: Reduced grain count for better performance
            this.grainPool = new GrainPool(
                this.audioContext,
                64,
                this.masterGain
            );

            // Create grain scheduler
            this.grainScheduler = new GrainScheduler(
                this.audioContext,
                this.grainPool,
                this.sampleBuffer
            );

            // Update scheduler with initial params
            this._updateSchedulerParams();

            // Set output
            this.output = this.masterGain;

            this._isInitialized = true;

            console.log(`✅ GranularSampler initialized: ${this.name}`);
            console.log(`   Sample: ${this.sampleBuffer ? 'Loaded' : 'Not loaded'}`);
            console.log(`   Grain Pool: ${this.grainPool.poolSize} voices`);

        } catch (error) {
            console.error(`❌ GranularSampler init failed: ${this.name}:`, error);
            throw error;
        }
    }

    /**
     * Play a note (MIDI trigger)
     *
     * Behavior:
     * - Continuous mode: Start continuous grain emission
     * - One-shot mode: Trigger a burst of grains
     *
     * @param {number} midiNote - MIDI note number (0-127)
     * @param {number} velocity - MIDI velocity (0-127)
     * @param {number} startTime - When to start (AudioContext time)
     */
    noteOn(midiNote, velocity = 100, startTime = null) {
        if (!this._isInitialized || !this.sampleBuffer) {
            console.warn(`GranularSampler not ready: ${this.name}`);
            return;
        }

        const when = startTime !== null ? startTime : this.audioContext.currentTime;

        // Check polyphony limit
        if (this.activeNotes.size >= this.maxPolyphony) {
            console.warn(`GranularSampler: Polyphony limit reached (${this.maxPolyphony})`);
            // Could implement voice stealing here
            return;
        }

        // Debug: console.log(`🎵 noteOn: ${midiNote}, vel: ${velocity}, mode: ${this.continuousMode ? 'continuous' : 'one-shot'}`);

        if (this.continuousMode) {
            // Continuous emission mode - start grain stream
            this._startContinuousNote(midiNote, velocity, when);
        } else {
            // One-shot mode - trigger burst of grains
            this._triggerOneShot(midiNote, velocity, when);
        }

        // ✅ FIX: Update isPlaying flag (must be AFTER _startContinuousNote which adds to activeNotes)
        this._isPlaying = true;
    }

    /**
     * Release a note
     *
     * @param {number} midiNote - MIDI note number
     * @param {number} releaseTime - When to release
     */
    noteOff(midiNote, releaseTime = null) {
        const when = releaseTime !== null ? releaseTime : this.audioContext.currentTime;

        if (!this.activeNotes.has(midiNote)) {
            // Debug: console.log(`⚠️ noteOff: Note ${midiNote} not active (already released?)`);
            return;
        }

        // Debug: console.log(`🔇 noteOff: ${midiNote} at ${when.toFixed(3)}s (now: ${this.audioContext.currentTime.toFixed(3)}s)`);

        const noteData = this.activeNotes.get(midiNote);

        if (noteData.scheduler) {
            // Stop continuous emission
            noteData.scheduler.stopEmitting(0.05); // 50ms fade
        }

        this.activeNotes.delete(midiNote);

        // ✅ FIX: Update isPlaying flag when all notes are off
        if (this.activeNotes.size === 0) {
            this._isPlaying = false;
        }
    }

    /**
     * Start continuous grain emission for a note
     * @private
     */
    _startContinuousNote(midiNote, velocity, startTime) {
        // Create dedicated scheduler for this note
        const noteScheduler = new GrainScheduler(
            this.audioContext,
            this.grainPool,
            this.sampleBuffer
        );

        // Update params with MIDI note offset
        // ✅ FIX: Convert grainSize from ms to seconds
        const noteParams = {
            ...this.params,
            grainSize: this.params.grainSize / 1000, // ms -> seconds
            pitch: (midiNote - this.baseNote) + this.params.pitch,
            gain: this.params.gain * (velocity / 127)
        };

        // Debug: console.log(`📦 Continuous note params:`, { grainSize: noteParams.grainSize, grainDensity: noteParams.grainDensity, pitch: noteParams.pitch, gain: noteParams.gain });

        noteScheduler.updateParams(noteParams);
        noteScheduler.startEmitting();

        // Track active note
        this.activeNotes.set(midiNote, {
            scheduler: noteScheduler,
            startTime: startTime
        });
    }

    /**
     * Trigger one-shot burst of grains
     * @private
     */
    _triggerOneShot(midiNote, velocity, startTime) {
        // Use main scheduler for one-shot triggering
        const burstCount = Math.ceil(this.params.grainDensity / 20); // Scale burst size
        const spreadTime = this.params.grainSize / 1000 * 2; // Grains spread over 2x grain size

        // Temporarily update pitch for this MIDI note
        const originalPitch = this.params.pitch;
        this.params.pitch = (midiNote - this.baseNote) + originalPitch;
        this.params.gain = this.params.gain * (velocity / 127);

        this._updateSchedulerParams();
        this.grainScheduler.triggerBurst(burstCount, spreadTime);

        // Restore original pitch
        this.params.pitch = originalPitch;
        this._updateSchedulerParams();

        // Track as active (will auto-release after burst)
        this.activeNotes.set(midiNote, {
            scheduler: null,
            startTime: startTime
        });

        // Auto-remove after burst duration
        setTimeout(() => {
            this.activeNotes.delete(midiNote);
        }, spreadTime * 1000 + 100);
    }

    /**
     * Release a specific note
     *
     * @param {string|number} pitch - Note pitch (e.g., 'C4') or MIDI note number
     * @param {number} releaseTime - When to release
     */
    releaseNote(pitch, releaseTime = null) {
        // Convert pitch to MIDI note using BaseInstrument method (handles both string and number)
        const midiNote = this.pitchToMidi(pitch);
        this.noteOff(midiNote, releaseTime);
    }

    /**
     * Stop all active notes
     */
    allNotesOff() {
        console.log(`🔇 GranularSampler: All notes off`);

        // Stop all active note schedulers
        for (const [midiNote, noteData] of this.activeNotes) {
            if (noteData.scheduler) {
                noteData.scheduler.stopEmitting(0.05);
            }
        }

        // Clear all active notes
        this.activeNotes.clear();

        // Stop main scheduler if running
        if (this.grainScheduler) {
            this.grainScheduler.stopEmitting(0.05);
        }

        // ✅ FIX: Update isPlaying flag
        this._isPlaying = false;
    }

    /**
     * Stop all grains immediately
     */
    stopAll() {
        this.allNotesOff();

        // Stop grain pool
        if (this.grainPool) {
            this.grainPool.stopAll();
        }
    }

    /**
     * Update granular parameters
     *
     * @param {Object} params - Parameters to update
     */
    updateParams(params) {
        // ✅ OPTIMIZATION: Auto-scale grain density based on polyphony
        // When playing chords, reduce density to prevent CPU spikes
        if (params.grainDensity !== undefined) {
            const polyphonyScale = Math.max(0.5, 1 - (this.activeNotes.size / this.maxPolyphony) * 0.4);
            const adjustedDensity = params.grainDensity * polyphonyScale;

            this.params = {
                ...this.params,
                ...params,
                grainDensity: adjustedDensity
            };

            // Debug: console.log(`🎚️ Grain density auto-scaled: ${params.grainDensity} → ${adjustedDensity.toFixed(1)} (polyphony: ${this.activeNotes.size}/${this.maxPolyphony})`);
        } else {
            this.params = { ...this.params, ...params };
        }

        this._updateSchedulerParams();

        // Update master gain
        if (params.gain !== undefined && this.masterGain) {
            const now = this.audioContext.currentTime;
            this.masterGain.gain.linearRampToValueAtTime(params.gain, now + 0.05);
        }

        console.log('🎛️ GranularSampler params updated:', this.params);
    }

    /**
     * Update scheduler with current params
     * @private
     */
    _updateSchedulerParams() {
        if (!this.grainScheduler) return;

        // Convert grain size from ms to seconds
        const paramsForScheduler = {
            ...this.params,
            grainSize: this.params.grainSize / 1000 // ms -> seconds
        };

        this.grainScheduler.updateParams(paramsForScheduler);

        // Update active note schedulers
        for (const [midiNote, noteData] of this.activeNotes) {
            if (noteData.scheduler) {
                noteData.scheduler.updateParams(paramsForScheduler);
            }
        }
    }

    /**
     * Load new sample buffer
     *
     * @param {AudioBuffer} buffer - New audio buffer
     */
    loadSample(buffer) {
        if (!buffer) {
            console.warn('GranularSampler: Invalid sample buffer');
            return;
        }

        console.log(`📁 GranularSampler: Loading new sample (${buffer.duration.toFixed(2)}s)`);

        // Stop all active grains
        this.stopAll();

        // Update buffer
        this.sampleBuffer = buffer;

        if (this.grainScheduler) {
            this.grainScheduler.setSampleBuffer(buffer);
        }

        console.log('✅ Sample loaded successfully');
    }

    /**
     * Set continuous emission mode
     *
     * @param {boolean} enabled - Enable continuous mode
     */
    setContinuousMode(enabled) {
        this.continuousMode = enabled;
        console.log(`🔄 Continuous mode: ${enabled ? 'ON' : 'OFF'}`);
    }

    /**
     * Get instrument statistics
     *
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            name: this.name,
            isInitialized: this._isInitialized,
            sampleLoaded: !!this.sampleBuffer,
            sampleDuration: this.sampleBuffer ? this.sampleBuffer.duration.toFixed(2) : 0,
            activeNotes: this.activeNotes.size,
            maxPolyphony: this.maxPolyphony,
            continuousMode: this.continuousMode,
            params: this.params,
            grainPool: this.grainPool ? this.grainPool.getStats() : null,
            scheduler: this.grainScheduler ? this.grainScheduler.getStats() : null
        };
    }


    /**
     * Dispose and cleanup
     */
    dispose() {
        console.log(`🗑️ GranularSampler: Disposing ${this.name}...`);

        // Stop all playback
        this.stopAll();

        // Dispose components
        if (this.grainScheduler) {
            this.grainScheduler.dispose();
        }

        if (this.grainPool) {
            this.grainPool.dispose();
        }

        // Disconnect audio nodes
        if (this.masterGain) {
            try {
                this.masterGain.disconnect();
            } catch (e) {
                // Already disconnected
            }
        }

        // Clear references
        this.sampleBuffer = null;
        this.grainPool = null;
        this.grainScheduler = null;
        this.activeNotes.clear();

        this._isInitialized = false;

        console.log('✅ GranularSampler: Disposed');
    }
}
