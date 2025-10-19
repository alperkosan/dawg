/**
 * GrainScheduler - Precise grain timing and emission
 *
 * Handles the rhythmic triggering of grains based on density parameter.
 * Uses Web Audio API's precise scheduling for sample-accurate timing.
 *
 * Features:
 * - Variable grain density (grains per second)
 * - Position randomization
 * - Pitch randomization
 * - Continuous or triggered emission
 */

export class GrainScheduler {
    constructor(audioContext, grainPool, sampleBuffer) {
        this.audioContext = audioContext;
        this.grainPool = grainPool;
        this.sampleBuffer = sampleBuffer;

        // Scheduling state
        this.isEmitting = false;
        this.schedulerInterval = null;
        this.nextGrainTime = 0;
        this.scheduleAheadTime = 0.1; // Schedule 100ms ahead
        this.schedulerRate = 25; // Check every 25ms

        // Emission parameters (updated externally)
        this.params = {
            grainSize: 0.05,        // seconds
            grainDensity: 20,       // grains/second
            samplePosition: 0.5,    // 0-1
            positionRandom: 0.1,    // 0-1
            pitch: 0,               // semitones
            pitchRandom: 0,         // semitones
            grainEnvelope: 'hann',
            reverse: 0,             // 0-1 (probability)
            spread: 0.5,            // stereo spread 0-1
            gain: 1.0               // master gain 0-1
        };

        // Statistics
        this.stats = {
            grainsScheduled: 0,
            lastScheduleTime: 0
        };
    }

    /**
     * Update sample buffer
     */
    setSampleBuffer(buffer) {
        this.sampleBuffer = buffer;
    }

    /**
     * Update emission parameters
     */
    updateParams(params) {
        this.params = { ...this.params, ...params };
    }

    /**
     * Start continuous grain emission
     */
    startEmitting() {
        if (this.isEmitting) {
            // Already emitting, ignore
            return;
        }

        if (!this.sampleBuffer) {
            // No sample buffer, ignore
            return;
        }

        // Starting emission (silent)

        this.isEmitting = true;
        this.nextGrainTime = this.audioContext.currentTime;

        // Start scheduling loop
        this.schedulerInterval = setInterval(() => {
            this._scheduleGrains();
        }, this.schedulerRate);

        // Schedule first batch immediately
        this._scheduleGrains();
    }

    /**
     * Stop grain emission
     *
     * @param {number} fadeTime - Fade out duration in seconds
     */
    stopEmitting(fadeTime = 0.05) {
        if (!this.isEmitting) {
            return;
        }

        // Stopping emission (silent)

        this.isEmitting = false;

        // Clear scheduler
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }

        // Fade out active grains
        if (fadeTime > 0) {
            this.grainPool.fadeOut(fadeTime);
        } else {
            this.grainPool.stopAll();
        }
    }

    /**
     * Trigger a single burst of grains
     *
     * @param {number} count - Number of grains to trigger
     * @param {number} spreadTime - Time spread in seconds
     */
    triggerBurst(count = 5, spreadTime = 0.05) {
        if (!this.sampleBuffer) {
            console.warn('GrainScheduler: No sample buffer');
            return;
        }

        const now = this.audioContext.currentTime;
        const timeStep = spreadTime / count;

        for (let i = 0; i < count; i++) {
            const grainTime = now + (i * timeStep);
            this._scheduleGrain(grainTime);
        }
    }

    /**
     * Schedule grains within the look-ahead window
     * @private
     */
    _scheduleGrains() {
        if (!this.isEmitting || !this.sampleBuffer) {
            return;
        }

        const currentTime = this.audioContext.currentTime;
        const scheduleUntil = currentTime + this.scheduleAheadTime;

        // Calculate next grain time based on density
        const intervalBetweenGrains = 1.0 / this.params.grainDensity;

        // ✅ PERFORMANCE FIX: Limit grains scheduled per call
        const MAX_GRAINS_PER_SCHEDULE = 10;
        let grainsScheduled = 0;

        // Schedule all grains that should play in the next window
        while (this.nextGrainTime < scheduleUntil && grainsScheduled < MAX_GRAINS_PER_SCHEDULE) {
            this._scheduleGrain(this.nextGrainTime);
            this.nextGrainTime += intervalBetweenGrains;
            grainsScheduled++;
        }
    }

    /**
     * Schedule a single grain
     * @private
     */
    _scheduleGrain(time) {
        // Calculate randomized position
        const positionBase = this.params.samplePosition;
        const positionOffset = (Math.random() - 0.5) * 2 * this.params.positionRandom;
        const position = Math.max(0, Math.min(1, positionBase + positionOffset));

        // Calculate randomized pitch
        const pitchBase = this.params.pitch;
        const pitchOffset = (Math.random() - 0.5) * 2 * this.params.pitchRandom;
        const pitch = pitchBase + pitchOffset;

        // Calculate randomized pan (stereo spread)
        const pan = (Math.random() - 0.5) * 2 * this.params.spread;

        // Determine reverse playback
        const reverse = Math.random() < this.params.reverse;

        // Grain parameters
        const grainParams = {
            position: position,
            grainSize: this.params.grainSize,
            pitch: pitch,
            pan: pan,
            gain: this.params.gain,
            envelope: this.params.grainEnvelope,
            reverse: reverse
        };

        // Trigger grain from pool
        this.grainPool.triggerGrain(this.sampleBuffer, grainParams, time);

        // Update stats
        this.stats.grainsScheduled++;
        this.stats.lastScheduleTime = time;
    }

    /**
     * Trigger grain from MIDI note
     *
     * Used when instrument receives noteOn
     * Pitch is determined by MIDI note + base pitch
     *
     * @param {number} midiNote - MIDI note number (0-127)
     * @param {number} velocity - MIDI velocity (0-127)
     * @param {number} startTime - When to trigger
     */
    triggerMidiNote(midiNote, velocity, startTime = null) {
        if (!this.sampleBuffer) {
            console.warn('GrainScheduler: No sample buffer');
            return;
        }

        const when = startTime !== null ? startTime : this.audioContext.currentTime;

        // Convert MIDI note to pitch offset from C4 (60)
        const baseMidiNote = 60; // C4
        const pitchOffset = midiNote - baseMidiNote;

        // Calculate position with randomization
        const positionBase = this.params.samplePosition;
        const positionOffset = (Math.random() - 0.5) * 2 * this.params.positionRandom;
        const position = Math.max(0, Math.min(1, positionBase + positionOffset));

        // Pitch = MIDI offset + user pitch + randomization
        const pitchRandom = (Math.random() - 0.5) * 2 * this.params.pitchRandom;
        const pitch = pitchOffset + this.params.pitch + pitchRandom;

        // Velocity affects gain
        const velocityGain = velocity / 127;
        const gain = this.params.gain * velocityGain;

        // Random pan
        const pan = (Math.random() - 0.5) * 2 * this.params.spread;

        // Reverse probability
        const reverse = Math.random() < this.params.reverse;

        // Grain parameters
        const grainParams = {
            position: position,
            grainSize: this.params.grainSize,
            pitch: pitch,
            pan: pan,
            gain: gain,
            envelope: this.params.grainEnvelope,
            reverse: reverse
        };

        // Trigger grain
        this.grainPool.triggerGrain(this.sampleBuffer, grainParams, when);

        this.stats.grainsScheduled++;
    }

    /**
     * Get scheduler statistics
     */
    getStats() {
        return {
            isEmitting: this.isEmitting,
            grainsScheduled: this.stats.grainsScheduled,
            lastScheduleTime: this.stats.lastScheduleTime,
            grainPoolStats: this.grainPool.getStats()
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            grainsScheduled: 0,
            lastScheduleTime: 0
        };
        this.grainPool.resetStats();
    }

    /**
     * Cleanup and dispose
     */
    dispose() {
        console.log('🗑️ GrainScheduler: Disposing...');

        this.stopEmitting(0);

        this.sampleBuffer = null;

        console.log('✅ GrainScheduler: Disposed');
    }
}
