/**
 * Sample-Accurate Time Utilities
 * 
 * Provides sample-accurate timing for DAW playback scheduling.
 * Converts between AudioContext time (seconds) and sample-accurate time (samples).
 * 
 * Industry Standard: FL Studio, Ableton Live, Logic Pro all use sample-accurate timing
 * Precision: At 44.1kHz, one sample = 0.0227ms (much better than millisecond precision)
 */

export class SampleAccurateTime {
    /**
     * Convert AudioContext time to sample-accurate time
     * 
     * @param {AudioContext} audioContext - Audio context
     * @param {number} timeInSeconds - Time in seconds (from AudioContext.currentTime)
     * @returns {number} Sample-accurate time in seconds
     */
    static toSampleAccurate(audioContext, timeInSeconds) {
        if (!audioContext || !audioContext.sampleRate) {
            return timeInSeconds; // Fallback to original time
        }

        const sampleRate = audioContext.sampleRate;
        const sampleCount = Math.floor(timeInSeconds * sampleRate);
        return sampleCount / sampleRate; // Round to nearest sample
    }

    /**
     * Get current sample-accurate time
     * 
     * @param {AudioContext} audioContext - Audio context
     * @returns {number} Current time in sample-accurate seconds
     */
    static getCurrentSampleAccurateTime(audioContext) {
        if (!audioContext) {
            return 0;
        }

        return this.toSampleAccurate(audioContext, audioContext.currentTime);
    }

    /**
     * Calculate sample-accurate time for a future event
     * 
     * @param {AudioContext} audioContext - Audio context
     * @param {number} offsetInSeconds - Offset from current time
     * @returns {number} Sample-accurate future time
     */
    static getFutureSampleAccurateTime(audioContext, offsetInSeconds) {
        if (!audioContext) {
            return offsetInSeconds;
        }

        const currentTime = this.getCurrentSampleAccurateTime(audioContext);
        const futureTime = currentTime + offsetInSeconds;
        return this.toSampleAccurate(audioContext, futureTime);
    }

    /**
     * Calculate sample-accurate time from beats/ticks
     * 
     * @param {AudioContext} audioContext - Audio context
     * @param {number} beats - Number of beats
     * @param {number} bpm - Beats per minute
     * @param {number} baseTime - Base time in seconds (optional)
     * @returns {number} Sample-accurate time in seconds
     */
    static beatsToSampleAccurateTime(audioContext, beats, bpm, baseTime = 0) {
        if (!audioContext || !bpm || bpm <= 0) {
            return baseTime;
        }

        const secondsPerBeat = 60 / bpm;
        const timeInSeconds = baseTime + (beats * secondsPerBeat);
        return this.toSampleAccurate(audioContext, timeInSeconds);
    }

    /**
     * Calculate sample-accurate time from ticks (PPQ-based)
     * 
     * @param {AudioContext} audioContext - Audio context
     * @param {number} ticks - Number of ticks
     * @param {number} ppq - Pulses per quarter note (default: 96)
     * @param {number} bpm - Beats per minute
     * @param {number} baseTime - Base time in seconds (optional)
     * @returns {number} Sample-accurate time in seconds
     */
    static ticksToSampleAccurateTime(audioContext, ticks, ppq = 96, bpm = 120, baseTime = 0) {
        if (!audioContext || !bpm || bpm <= 0 || !ppq || ppq <= 0) {
            return baseTime;
        }

        const beats = ticks / ppq;
        return this.beatsToSampleAccurateTime(audioContext, beats, bpm, baseTime);
    }

    /**
     * Calculate sample-accurate time from steps (16th notes)
     * 
     * @param {AudioContext} audioContext - Audio context
     * @param {number} steps - Number of steps (16th notes)
     * @param {number} bpm - Beats per minute
     * @param {number} baseTime - Base time in seconds (optional)
     * @returns {number} Sample-accurate time in seconds
     */
    static stepsToSampleAccurateTime(audioContext, steps, bpm = 120, baseTime = 0) {
        if (!audioContext || !bpm || bpm <= 0) {
            return baseTime;
        }

        const beats = steps / 4; // 4 steps per beat (16th notes)
        return this.beatsToSampleAccurateTime(audioContext, beats, bpm, baseTime);
    }

    /**
     * Get sample precision (time per sample in seconds)
     * 
     * @param {AudioContext} audioContext - Audio context
     * @returns {number} Time per sample in seconds
     */
    static getSamplePrecision(audioContext) {
        if (!audioContext || !audioContext.sampleRate) {
            return 0.0000227; // Default: 44.1kHz precision
        }

        return 1 / audioContext.sampleRate;
    }

    /**
     * Get sample precision in milliseconds
     * 
     * @param {AudioContext} audioContext - Audio context
     * @returns {number} Time per sample in milliseconds
     */
    static getSamplePrecisionMs(audioContext) {
        return this.getSamplePrecision(audioContext) * 1000;
    }

    /**
     * Check if two times are within sample precision (effectively equal)
     * 
     * @param {AudioContext} audioContext - Audio context
     * @param {number} time1 - First time in seconds
     * @param {number} time2 - Second time in seconds
     * @returns {boolean} True if times are within sample precision
     */
    static areTimesEqual(audioContext, time1, time2) {
        const precision = this.getSamplePrecision(audioContext);
        return Math.abs(time1 - time2) < precision;
    }

    /**
     * Round time to nearest sample boundary
     * 
     * @param {AudioContext} audioContext - Audio context
     * @param {number} timeInSeconds - Time to round
     * @returns {number} Rounded time in seconds
     */
    static roundToSample(audioContext, timeInSeconds) {
        return this.toSampleAccurate(audioContext, timeInSeconds);
    }

    /**
     * Calculate minimum safe scheduling offset (to avoid past-time errors)
     * 
     * @param {AudioContext} audioContext - Audio context
     * @param {number} safetyMargin - Additional safety margin in samples (default: 64)
     * @returns {number} Minimum safe offset in seconds
     */
    static getMinimumSafeOffset(audioContext, safetyMargin = 64) {
        if (!audioContext || !audioContext.sampleRate) {
            return 0.01; // Fallback: 10ms
        }

        const samplePrecision = this.getSamplePrecision(audioContext);
        return samplePrecision * safetyMargin; // e.g., 64 samples @ 44.1kHz = ~1.45ms
    }

    /**
     * Ensure time is in the future (add minimum safe offset if needed)
     * 
     * @param {AudioContext} audioContext - Audio context
     * @param {number} scheduledTime - Scheduled time in seconds
     * @param {number} currentTime - Current time in seconds (optional, uses currentTime if not provided)
     * @returns {number} Safe future time in seconds
     */
    static ensureFutureTime(audioContext, scheduledTime, currentTime = null) {
        if (!audioContext) {
            return scheduledTime;
        }

        const now = currentTime !== null ? currentTime : this.getCurrentSampleAccurateTime(audioContext);
        const minOffset = this.getMinimumSafeOffset(audioContext);
        
        if (scheduledTime <= now) {
            // Time is in the past or too close, nudge to safe future
            return this.toSampleAccurate(audioContext, now + minOffset);
        }

        // Time is in the future, but ensure it's sample-accurate
        return this.toSampleAccurate(audioContext, scheduledTime);
    }
}

/**
 * Helper function for easy import
 * 
 * @param {AudioContext} audioContext - Audio context
 * @param {number} timeInSeconds - Time in seconds
 * @returns {number} Sample-accurate time
 */
export function toSampleAccurate(audioContext, timeInSeconds) {
    return SampleAccurateTime.toSampleAccurate(audioContext, timeInSeconds);
}

/**
 * Helper function to get current sample-accurate time
 * 
 * @param {AudioContext} audioContext - Audio context
 * @returns {number} Current sample-accurate time
 */
export function getCurrentSampleAccurateTime(audioContext) {
    return SampleAccurateTime.getCurrentSampleAccurateTime(audioContext);
}

