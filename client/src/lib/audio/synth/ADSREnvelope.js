/**
 * ADSR Envelope - Native Web Audio implementation
 * Attack, Decay, Sustain, Release envelope for synth parameters
 * ✅ ENVELOPE DELAY/HOLD: Extended to DADSRH (Delay, Attack, Decay, Sustain, Release, Hold)
 */
export class ADSREnvelope {
    constructor(audioContext) {
        this.context = audioContext;

        // Default ADSR values (in seconds, except sustain which is 0-1)
        this.delay = 0;       // ✅ DELAY: Delay before envelope starts (0 = no delay)
        this.attack = 0.01;   // 10ms
        this.hold = 0;        // ✅ HOLD: Hold at peak level (0 = no hold)
        this.decay = 0.1;     // 100ms
        this.sustain = 0.7;   // 70%
        this.releaseTime = 0.3;   // 300ms - renamed to avoid conflict with release() method

        // Velocity sensitivity
        this.velocitySensitivity = 0.5; // 0 = no velocity, 1 = full velocity

        // ✅ ANALYTIC TRACKING: For JS modulation matrix polling
        this.triggerTime = null;
        this.releaseStartTime = null;
        this.peakLevel = 1;
        this.sustainLevelValue = 0;
        this.isExponential = false;
        this.isReleased = false;
    }

    /**
     * Apply envelope to an AudioParam (e.g., gain, frequency, filter cutoff)
     * ✅ ENVELOPE DELAY/HOLD: Extended to DADSRH (Delay → Attack → Hold → Decay → Sustain → Release)
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

        // ✅ DELAY: Start from 0 and wait for delay period
        const delayEnd = triggerTime + this.delay;
        param.setValueAtTime(0, triggerTime);

        // If delay > 0, stay at 0 during delay
        if (this.delay > 0.001) {
            param.setValueAtTime(0, delayEnd);
        }

        // ✅ ATTACK: Attack phase (0 → peak)
        const attackStart = delayEnd;
        const attackEnd = attackStart + this.attack;
        param.linearRampToValueAtTime(adjustedPeak, attackEnd);

        // ✅ HOLD: Hold at peak level (if hold > 0)
        let holdEnd = attackEnd;
        if (this.hold > 0.001) {
            holdEnd = attackEnd + this.hold;
            param.setValueAtTime(adjustedPeak, holdEnd);
        }

        // ✅ DECAY: Decay phase (peak → sustain)
        const decayEnd = holdEnd + this.decay;
        const sustainLevel = adjustedPeak * this.sustain;
        param.linearRampToValueAtTime(sustainLevel, decayEnd);

        // Hold at sustain level (will be released later)

        // ✅ ANALYTIC TRACKING
        this.triggerTime = triggerTime;
        this.releaseStartTime = null;
        this.peakLevel = adjustedPeak;
        this.sustainLevelValue = sustainLevel;
        this.isExponential = false;
        this.isReleased = false;

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

        // ✅ ANALYTIC TRACKING
        this.releaseStartTime = releaseStart;
        this.isReleased = true;

        return releaseEnd;
    }

    /**
     * Apply exponential envelope (better for frequency modulation)
     * ✅ ENVELOPE DELAY/HOLD: Extended to DADSRH
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

        // ✅ DELAY: Start from base value and wait for delay period
        const delayEnd = triggerTime + this.delay;
        param.setValueAtTime(minValue, triggerTime);

        // If delay > 0, stay at base value during delay
        if (this.delay > 0.001) {
            param.setValueAtTime(minValue, delayEnd);
        }

        // ✅ ATTACK: Attack phase (base → peak)
        const attackStart = delayEnd;
        const attackEnd = attackStart + this.attack;
        param.exponentialRampToValueAtTime(adjustedPeak, attackEnd);

        // ✅ HOLD: Hold at peak level (if hold > 0)
        let holdEnd = attackEnd;
        if (this.hold > 0.001) {
            holdEnd = attackEnd + this.hold;
            param.setValueAtTime(adjustedPeak, holdEnd);
        }

        // ✅ DECAY: Decay phase (peak → sustain)
        const decayEnd = holdEnd + this.decay;
        const decayTarget = baseValue + (adjustedPeak - baseValue) * this.sustain;
        const sustainLevel = Math.max(minValue, decayTarget);
        param.exponentialRampToValueAtTime(sustainLevel, decayEnd);

        // ✅ ANALYTIC TRACKING
        this.triggerTime = triggerTime;
        this.releaseStartTime = null;
        this.peakLevel = adjustedPeak;
        this.sustainLevelValue = sustainLevel;
        this.isExponential = true;
        this.isReleased = false;

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

        // ✅ ANALYTIC TRACKING
        this.releaseStartTime = releaseStart;
        this.isReleased = true;

        return releaseEnd;
    }

    /**
     * Set ADSR parameters
     * ✅ ENVELOPE DELAY/HOLD: Added delay and hold parameters
     */
    setParams({ delay, attack, hold, decay, sustain, release, velocitySensitivity }) {
        if (delay !== undefined) this.delay = Math.max(0, delay);
        if (attack !== undefined) this.attack = Math.max(0.001, attack);
        if (hold !== undefined) this.hold = Math.max(0, hold);
        if (decay !== undefined) this.decay = Math.max(0.001, decay);
        if (sustain !== undefined) this.sustain = Math.max(0, Math.min(1, sustain));
        if (release !== undefined) this.releaseTime = Math.max(0.001, release);
        if (velocitySensitivity !== undefined) {
            this.velocitySensitivity = Math.max(0, Math.min(1, velocitySensitivity));
        }
    }

    /**
     * Get current ADSR parameters
     * ✅ ENVELOPE DELAY/HOLD: Added delay and hold to return value
     */
    getParams() {
        return {
            delay: this.delay,
            attack: this.attack,
            hold: this.hold,
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
     * ✅ ENVELOPE DELAY/HOLD: Include delay and hold in duration calculation
     */
    getTotalDuration() {
        return this.delay + this.attack + this.hold + this.decay;
    }

    /**
     * Calculate total envelope duration including release
     * ✅ ENVELOPE DELAY/HOLD: Include delay and hold in duration calculation
     */
    getTotalDurationWithRelease() {
        return this.delay + this.attack + this.hold + this.decay + this.releaseTime;
    }

    /**
     * ✅ ANALYTIC TRACKING: Get current envelope value (0-1) for JS modulation
     */
    getCurrentValue() {
        if (!this.triggerTime) return 0;

        const now = this.context.currentTime;
        let time = now - this.triggerTime;

        if (time < 0) return 0;

        // Handle Released state
        if (this.isReleased && this.releaseStartTime) {
            const releaseElapsed = now - this.releaseStartTime;
            if (releaseElapsed < 0) return this.sustainLevelValue; // Not reached release yet

            const releaseProgress = releaseElapsed / this.releaseTime;
            if (releaseProgress >= 1) return 0;

            // In release phase
            if (this.isExponential) {
                // Exponential release (approximated)
                return this.sustainLevelValue * Math.exp(-releaseProgress * 5);
            } else {
                return this.sustainLevelValue * (1 - releaseProgress);
            }
        }

        // Delay phase
        if (time < this.delay) return 0;
        time -= this.delay;

        // Attack phase
        if (time < this.attack) {
            const progress = time / this.attack;
            return progress * this.peakLevel;
        }
        time -= this.attack;

        // Hold phase
        if (time < this.hold) {
            return this.peakLevel;
        }
        time -= this.hold;

        // Decay phase
        if (time < this.decay) {
            const progress = time / this.decay;
            if (this.isExponential) {
                // Approximate exponential decay
                return this.sustainLevelValue + (this.peakLevel - this.sustainLevelValue) * Math.pow(0.1, progress);
            } else {
                return this.peakLevel - (this.peakLevel - this.sustainLevelValue) * progress;
            }
        }

        // Sustain phase
        return this.sustainLevelValue;
    }
}
