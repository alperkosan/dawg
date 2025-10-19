/**
 * GrainPool - Voice allocation and management
 *
 * Pre-allocates a pool of GrainVoice instances for efficient playback.
 * Manages voice allocation, voice stealing, and cleanup.
 *
 * Similar to VoicePool but optimized for rapid grain triggering.
 */

import { GrainVoice } from './GrainVoice.js';

export class GrainPool {
    constructor(audioContext, poolSize = 128, output = null) {
        this.audioContext = audioContext;
        this.poolSize = poolSize;
        this.output = output || audioContext.destination;

        // Voice pools
        this.freeVoices = [];
        this.activeVoices = [];
        this.allVoices = [];

        // Statistics
        this.stats = {
            totalAllocations: 0,
            voiceSteals: 0,
            peakUsage: 0
        };

        // Pre-allocate all voices
        this._initializePool();

        console.log(`🎲 GrainPool initialized: ${poolSize} voices`);
    }

    /**
     * Pre-allocate all grain voices
     * @private
     */
    _initializePool() {
        for (let i = 0; i < this.poolSize; i++) {
            const voice = new GrainVoice(this.audioContext);
            voice.output.connect(this.output);

            this.freeVoices.push(voice);
            this.allVoices.push(voice);
        }
    }

    /**
     * Allocate a grain voice from the pool
     *
     * @returns {GrainVoice|null} Available voice or null if pool exhausted
     */
    allocate() {
        this.stats.totalAllocations++;

        // Try to get a free voice
        if (this.freeVoices.length > 0) {
            const voice = this.freeVoices.pop();
            this.activeVoices.push(voice);

            // Update peak usage
            if (this.activeVoices.length > this.stats.peakUsage) {
                this.stats.peakUsage = this.activeVoices.length;
            }

            return voice;
        }

        // No free voices - steal the oldest one
        return this._stealOldestVoice();
    }

    /**
     * Steal the oldest active voice
     * @private
     */
    _stealOldestVoice() {
        if (this.activeVoices.length === 0) {
            console.warn('GrainPool: No voices available (pool exhausted)');
            return null;
        }

        // Find voice that will finish soonest
        let oldestVoice = this.activeVoices[0];
        let shortestRemaining = oldestVoice.getRemainingTime();

        for (let i = 1; i < this.activeVoices.length; i++) {
            const voice = this.activeVoices[i];
            const remaining = voice.getRemainingTime();

            if (remaining < shortestRemaining) {
                shortestRemaining = remaining;
                oldestVoice = voice;
            }
        }

        // Stop and reuse the voice
        oldestVoice.stop();
        this.stats.voiceSteals++;

        return oldestVoice;
    }

    /**
     * Release a grain voice back to the pool
     *
     * @param {GrainVoice} voice - Voice to release
     */
    release(voice) {
        const index = this.activeVoices.indexOf(voice);

        if (index !== -1) {
            this.activeVoices.splice(index, 1);
            this.freeVoices.push(voice);
        }
    }

    /**
     * Trigger a grain with parameters
     *
     * @param {AudioBuffer} sampleBuffer - Audio sample
     * @param {Object} params - Grain parameters
     * @param {number} startTime - When to trigger
     * @returns {GrainVoice|null} The triggered voice
     */
    triggerGrain(sampleBuffer, params, startTime) {
        const voice = this.allocate();

        if (!voice) {
            return null;
        }

        // Trigger the grain
        voice.trigger(sampleBuffer, params, startTime);

        // Auto-release when grain finishes
        const releaseTime = startTime + params.grainSize;
        const delay = Math.max(0, (releaseTime - this.audioContext.currentTime) * 1000);

        setTimeout(() => {
            if (!voice.isPlaying()) {
                this.release(voice);
            }
        }, delay);

        return voice;
    }

    /**
     * Stop all active grains
     */
    stopAll() {
        const count = this.activeVoices.length;

        for (const voice of this.activeVoices) {
            voice.stop();
        }

        // Move all active voices back to free pool
        this.freeVoices.push(...this.activeVoices);
        this.activeVoices = [];

        if (count > 0) {
            console.log(`🔇 GrainPool: Stopped ${count} active grains`);
        }
    }

    /**
     * Stop all grains with fade-out
     *
     * @param {number} fadeTime - Fade duration in seconds
     */
    fadeOut(fadeTime = 0.05) {
        const now = this.audioContext.currentTime;
        const stopTime = now + fadeTime;

        for (const voice of this.activeVoices) {
            // Fade out envelope
            voice.envelope.gain.cancelScheduledValues(now);
            voice.envelope.gain.setValueAtTime(voice.envelope.gain.value, now);
            voice.envelope.gain.linearRampToValueAtTime(0, stopTime);

            // Stop voice after fade
            voice.stop(stopTime);
        }

        // Schedule cleanup
        setTimeout(() => {
            this.freeVoices.push(...this.activeVoices);
            this.activeVoices = [];
        }, fadeTime * 1000 + 10);
    }

    /**
     * Cleanup inactive voices (maintenance)
     */
    cleanup() {
        const now = this.audioContext.currentTime;
        const stillActive = [];

        for (const voice of this.activeVoices) {
            if (voice.isPlaying()) {
                stillActive.push(voice);
            } else {
                this.freeVoices.push(voice);
            }
        }

        const cleaned = this.activeVoices.length - stillActive.length;
        this.activeVoices = stillActive;

        if (cleaned > 0) {
            console.log(`🧹 GrainPool: Cleaned ${cleaned} finished voices`);
        }
    }

    /**
     * Connect pool output to destination
     *
     * @param {AudioNode} destination - Where to route audio
     */
    connect(destination) {
        this.output = destination;

        for (const voice of this.allVoices) {
            try {
                voice.output.disconnect();
                voice.output.connect(destination);
            } catch (e) {
                // Voice might not be connected yet
            }
        }
    }

    /**
     * Get pool statistics
     *
     * @returns {Object} Pool stats
     */
    getStats() {
        return {
            poolSize: this.poolSize,
            freeVoices: this.freeVoices.length,
            activeVoices: this.activeVoices.length,
            utilization: (this.activeVoices.length / this.poolSize * 100).toFixed(1) + '%',
            totalAllocations: this.stats.totalAllocations,
            voiceSteals: this.stats.voiceSteals,
            peakUsage: this.stats.peakUsage,
            stealRate: (this.stats.voiceSteals / Math.max(1, this.stats.totalAllocations) * 100).toFixed(1) + '%'
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalAllocations: 0,
            voiceSteals: 0,
            peakUsage: 0
        };
    }

    /**
     * Dispose of all voices and cleanup
     */
    dispose() {
        console.log('🗑️ GrainPool: Disposing...');

        // Stop all voices
        this.stopAll();

        // Dispose individual voices
        for (const voice of this.allVoices) {
            voice.dispose();
        }

        // Clear arrays
        this.freeVoices = [];
        this.activeVoices = [];
        this.allVoices = [];

        console.log('✅ GrainPool: Disposed');
    }
}
