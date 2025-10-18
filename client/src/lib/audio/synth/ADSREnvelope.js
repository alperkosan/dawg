/**
 * ADSR Envelope - Native Web Audio implementation
 * Attack, Decay, Sustain, Release envelope for synth parameters
 */
export class ADSREnvelope {
    constructor(audioContext) {
        this.context = audioContext;

        // Default ADSR values (in seconds, except sustain which is 0-1)
        this.attack = 0.01;   // 10ms
        this.decay = 0.1;     // 100ms
        this.sustain = 0.7;   // 70%
        this.releaseTime = 0.3;   // 300ms - renamed to avoid conflict with release() method

        // Velocity sensitivity
        this.velocitySensitivity = 0.5; // 0 = no velocity, 1 = full velocity
    }

    /**
     * Apply envelope to an AudioParam (e.g., gain, frequency, filter cutoff)
     * @param {AudioParam} param - The parameter to modulate
     * @param {number} startTime - When to start the envelope
     * @param {number} peakValue - Maximum value of the envelope
     * @param {number} velocity - Note velocity (0-127)
     */
    trigger(param, startTime, peakValue = 1, velocity = 100) {
        const now = this.context.currentTime;
        const triggerTime = Math.max(now, startTime);

        // Calculate velocity-adjusted peak
        const velocityFactor = velocity / 127;
        const adjustedPeak = peakValue * (1 - this.velocitySensitivity + this.velocitySensitivity * velocityFactor);

        // Clear any existing automation
        param.cancelScheduledValues(triggerTime);

        // Start from 0
        param.setValueAtTime(0, triggerTime);

        // Attack phase
        const attackEnd = triggerTime + this.attack;
        param.linearRampToValueAtTime(adjustedPeak, attackEnd);

        // Decay phase
        const decayEnd = attackEnd + this.decay;
        const sustainLevel = adjustedPeak * this.sustain;
        param.linearRampToValueAtTime(sustainLevel, decayEnd);

        // Hold at sustain level (will be released later)
        return {
            sustainLevel,
            decayEndTime: decayEnd
        };
    }

    /**
     * Release the envelope (called when note is released)
     * @param {AudioParam} param - The parameter to release
     * @param {number} releaseTime - When to start the release
     * @param {number} currentValue - Current value of the parameter
     */
    release(param, releaseTime, currentValue = null) {
        const now = this.context.currentTime;
        const releaseStart = Math.max(now, releaseTime);

        // Get current value if not provided
        if (currentValue === null) {
            currentValue = param.value;
        }

        // Clear future automation
        param.cancelScheduledValues(releaseStart);

        // Set current value
        param.setValueAtTime(currentValue, releaseStart);

        // Release phase
        const releaseEnd = releaseStart + this.releaseTime;
        param.linearRampToValueAtTime(0, releaseEnd);

        return releaseEnd;
    }

    /**
     * Apply exponential envelope (better for frequency modulation)
     * @param {AudioParam} param
     * @param {number} startTime
     * @param {number} baseValue - Starting value (e.g., base filter cutoff)
     * @param {number} peakValue - Peak value to reach
     * @param {number} velocity
     */
    triggerExponential(param, startTime, baseValue = 100, peakValue = 1000, velocity = 100) {
        const now = this.context.currentTime;
        const triggerTime = Math.max(now, startTime);

        const velocityFactor = velocity / 127;
        let adjustedPeak = peakValue * (1 - this.velocitySensitivity + this.velocitySensitivity * velocityFactor);

        // ✅ Clamp filter frequency to valid range (max Nyquist frequency ~24kHz)
        if (param.constructor.name === 'AudioParam' && param.maxValue) {
            adjustedPeak = Math.min(adjustedPeak, param.maxValue);
        } else {
            // Fallback: clamp to reasonable audio range (24kHz)
            adjustedPeak = Math.min(adjustedPeak, 24000);
        }

        // Ensure we never reach 0 (exponential can't reach 0)
        const minValue = Math.max(0.001, baseValue);

        param.cancelScheduledValues(triggerTime);
        param.setValueAtTime(minValue, triggerTime);

        // Attack
        const attackEnd = triggerTime + this.attack;
        param.exponentialRampToValueAtTime(adjustedPeak, attackEnd);

        // Decay - decay back toward base value
        const decayEnd = attackEnd + this.decay;
        const decayTarget = baseValue + (adjustedPeak - baseValue) * this.sustain;
        const sustainLevel = Math.max(minValue, decayTarget);
        param.exponentialRampToValueAtTime(sustainLevel, decayEnd);

        return {
            sustainLevel,
            decayEndTime: decayEnd
        };
    }

    /**
     * Release with exponential curve
     */
    releaseExponential(param, releaseTime, currentValue = null) {
        const now = this.context.currentTime;
        const releaseStart = Math.max(now, releaseTime);

        if (currentValue === null) {
            currentValue = param.value;
        }

        // Ensure non-zero for exponential
        currentValue = Math.max(0.001, currentValue);

        param.cancelScheduledValues(releaseStart);
        param.setValueAtTime(currentValue, releaseStart);

        const releaseEnd = releaseStart + this.releaseTime;
        param.exponentialRampToValueAtTime(0.001, releaseEnd);

        return releaseEnd;
    }

    /**
     * Set ADSR parameters
     */
    setParams({ attack, decay, sustain, release, velocitySensitivity }) {
        if (attack !== undefined) this.attack = Math.max(0.001, attack);
        if (decay !== undefined) this.decay = Math.max(0.001, decay);
        if (sustain !== undefined) this.sustain = Math.max(0, Math.min(1, sustain));
        if (release !== undefined) this.releaseTime = Math.max(0.001, release);
        if (velocitySensitivity !== undefined) {
            this.velocitySensitivity = Math.max(0, Math.min(1, velocitySensitivity));
        }
    }

    /**
     * Get current ADSR parameters
     */
    getParams() {
        return {
            attack: this.attack,
            decay: this.decay,
            sustain: this.sustain,
            release: this.releaseTime,
            velocitySensitivity: this.velocitySensitivity
        };
    }

    /**
     * Alias for getParams (used by VASynth)
     */
    getSettings() {
        return this.getParams();
    }

    /**
     * Calculate total envelope duration (without release)
     */
    getTotalDuration() {
        return this.attack + this.decay;
    }

    /**
     * Calculate total envelope duration including release
     */
    getTotalDurationWithRelease() {
        return this.attack + this.decay + this.releaseTime;
    }
}
