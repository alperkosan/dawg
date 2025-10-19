/**
 * SampleVoice - Single voice for sample-based instruments
 *
 * Designed for voice pooling with MultiSampleInstrument
 * Uses BufferSource (one-shot playback) with envelope
 *
 * Features:
 * - Pre-allocated gain nodes (reused across triggers)
 * - Fast envelope (attack/release only)
 * - Pitch shifting via playback rate
 * - Voice stealing priority support
 */

import { BaseVoice } from '../base/BaseVoice.js';

export class SampleVoice extends BaseVoice {
    constructor(audioContext) {
        super(audioContext);

        // Audio nodes (persistent - reused across triggers)
        this.gainNode = null;
        this.envelopeGain = null;

        // Current playback state
        this.currentSource = null; // BufferSource (recreated each trigger)
        this.currentBuffer = null;
        this.releaseTime = 0.15; // Default release time

        // Envelope tracking (for voice stealing priority)
        this.currentAmplitude = 0;
        this.envelopePhase = 'idle'; // 'idle' | 'attack' | 'sustain' | 'release'
    }

    /**
     * Initialize voice (create persistent audio nodes)
     * Called once during voice pool creation
     */
    initialize() {
        // Create persistent gain nodes
        this.envelopeGain = this.context.createGain();
        this.envelopeGain.gain.setValueAtTime(0, this.context.currentTime);

        this.gainNode = this.context.createGain();
        this.gainNode.gain.setValueAtTime(1, this.context.currentTime);

        // Connect: envelope -> velocity -> output
        this.envelopeGain.connect(this.gainNode);
        this.output = this.gainNode;
    }

    /**
     * Start playing a note
     *
     * @param {number} midiNote - MIDI note number
     * @param {number} velocity - Note velocity (0-127)
     * @param {number} frequency - Target frequency (for pitch calculation)
     * @param {number} time - AudioContext time
     * @param {Object} sampleData - { buffer, baseNote, pitchShift }
     */
    trigger(midiNote, velocity, frequency, time, sampleData = null) {
        if (!sampleData || !sampleData.buffer) {
            console.warn('SampleVoice: No sample data provided');
            return;
        }

        // Stop current source if playing
        this.stopCurrentSource();

        // Create new buffer source (one-shot)
        this.currentSource = this.context.createBufferSource();
        this.currentSource.buffer = sampleData.buffer;
        this.currentBuffer = sampleData.buffer;

        // Calculate playback rate for pitch shifting
        // Formula: playbackRate = 2^(semitones/12)
        const pitchShift = sampleData.pitchShift || 0;
        const playbackRate = Math.pow(2, pitchShift / 12);
        this.currentSource.playbackRate.setValueAtTime(playbackRate, time);

        // Connect source to envelope
        this.currentSource.connect(this.envelopeGain);

        // Set velocity gain
        const velocityGain = (velocity / 127) * 0.8;
        this.gainNode.gain.setValueAtTime(velocityGain, time);

        // Apply attack envelope
        const attackTime = 0.005; // 5ms quick attack
        this.envelopeGain.gain.cancelScheduledValues(time);
        this.envelopeGain.gain.setValueAtTime(0, time);
        this.envelopeGain.gain.linearRampToValueAtTime(1, time + attackTime);

        // Start playback
        this.currentSource.start(time);

        // Update state
        this.isActive = true;
        this.currentNote = midiNote;
        this.currentVelocity = velocity;
        this.startTime = time;
        this.currentAmplitude = velocityGain;
        this.envelopePhase = 'attack';

        // Track envelope phase changes
        setTimeout(() => {
            if (this.envelopePhase === 'attack') {
                this.envelopePhase = 'sustain';
            }
        }, attackTime * 1000);

        // Auto-cleanup when sample finishes naturally
        this.currentSource.onended = () => {
            if (this.currentSource) {
                this.currentAmplitude = 0;
                this.envelopePhase = 'idle';
                // Don't reset isActive here - let release() or reset() handle it
            }
        };
    }

    /**
     * Release note (start release envelope)
     *
     * @param {number} time - AudioContext time
     * @returns {number} Release duration in seconds
     */
    release(time) {
        if (!this.currentSource || !this.isActive) {
            return 0;
        }

        // Apply release envelope
        this.envelopeGain.gain.cancelScheduledValues(time);
        this.envelopeGain.gain.setValueAtTime(this.envelopeGain.gain.value, time);
        this.envelopeGain.gain.linearRampToValueAtTime(0, time + this.releaseTime);

        // Stop source after release
        try {
            this.currentSource.stop(time + this.releaseTime);
        } catch (e) {
            // Already stopped or scheduled
        }

        // Update state
        this.envelopePhase = 'release';

        // Track amplitude decay
        const startAmp = this.currentAmplitude;
        const decayRate = startAmp / this.releaseTime;
        const updateInterval = 50; // Update every 50ms

        const decayInterval = setInterval(() => {
            this.currentAmplitude = Math.max(0, this.currentAmplitude - (decayRate * updateInterval / 1000));

            if (this.currentAmplitude <= 0) {
                clearInterval(decayInterval);
                this.envelopePhase = 'idle';
            }
        }, updateInterval);

        return this.releaseTime;
    }

    /**
     * Reset voice to initial state
     * Called when voice is returned to pool
     */
    reset() {
        super.reset();

        // Stop current source
        this.stopCurrentSource();

        // Reset envelope
        const now = this.context.currentTime;
        this.envelopeGain.gain.cancelScheduledValues(now);
        this.envelopeGain.gain.setValueAtTime(0, now);

        // Reset state
        this.currentBuffer = null;
        this.currentAmplitude = 0;
        this.envelopePhase = 'idle';
    }

    /**
     * Stop current buffer source (internal helper)
     */
    stopCurrentSource() {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
                this.currentSource.disconnect();
            } catch (e) {
                // Already stopped
            }
            this.currentSource = null;
        }
    }

    /**
     * Get current amplitude (for voice stealing priority)
     *
     * @returns {number} Current amplitude (0-1)
     */
    getAmplitude() {
        // Factor in envelope phase
        if (this.envelopePhase === 'idle') return 0;
        if (this.envelopePhase === 'attack') return this.currentAmplitude * 1.5; // Higher priority
        if (this.envelopePhase === 'sustain') return this.currentAmplitude;
        if (this.envelopePhase === 'release') return this.currentAmplitude * 0.5; // Lower priority

        return this.currentAmplitude;
    }

    /**
     * Dispose voice (cleanup)
     * Called only when destroying voice pool
     */
    dispose() {
        this.stopCurrentSource();

        if (this.envelopeGain) {
            this.envelopeGain.disconnect();
            this.envelopeGain = null;
        }

        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }

        super.dispose();
    }

    /**
     * Update voice priority for stealing algorithm
     *
     * @returns {number} Priority score (higher = less likely to steal)
     */
    updatePriority() {
        let priority = super.updatePriority();

        // Bonus priority based on envelope phase
        if (this.envelopePhase === 'attack') {
            priority += 50; // Don't steal during attack
        } else if (this.envelopePhase === 'sustain') {
            priority += 30; // Prefer not to steal sustain
        } else if (this.envelopePhase === 'release') {
            priority -= 30; // OK to steal during release
        }

        this.priority = priority;
        return priority;
    }
}
