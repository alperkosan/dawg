import { logger, NAMESPACES } from '@/lib/utils/debugLogger';

/**
 * AudioClock - Master timing source for the entire transport system
 * 
 * PHILOSOPHY:
 * - AudioContext.currentTime is the ONLY authoritative time source
 * - All conversions (steps ↔ time) are pure functions
 * - No state mutation - only calculations
 * - Supports tempo changes without drift
 * 
 * RESPONSIBILITIES:
 * - Convert between time domains (steps, seconds, ticks)
 * - Track playback start reference
 * - Provide current position based on AudioContext
 * 
 * @example
 * const clock = new AudioClock(audioContext, transport);
 * const currentStep = clock.currentStep(); // Always accurate
 * const audioTime = clock.stepToTime(64); // When will step 64 occur?
 */
export class AudioClock {
    #audioContext;
    #transport; // Reference to TransportStateMachine

    // Playback reference point (set when play starts)
    #playStartTime = null; // AudioContext.currentTime when play started
    #playStartStep = 0; // Step position when play started

    // For tempo change handling
    #bpmChangeHistory = []; // { time, bpm, step }

    constructor(audioContext, transport) {
        if (!audioContext) {
            throw new Error('AudioClock requires AudioContext');
        }
        if (!transport) {
            throw new Error('AudioClock requires TransportStateMachine');
        }

        this.#audioContext = audioContext;
        this.#transport = transport;

        // Listen for play/stop to update reference points
        this.#transport.on('stateChange', this.#handleStateChange.bind(this));
        this.#transport.on('bpmChange', this.#handleBpmChange.bind(this));

        logger.debug(NAMESPACES.AUDIO, '⏰ AudioClock initialized');
    }

    // ============================================================================
    // TIME DOMAIN CONVERSIONS - Pure functions
    // ============================================================================

    /**
     * Convert steps to seconds duration
     * @param {number} steps - Number of steps
     * @param {number} bpm - BPM (defaults to current transport BPM)
     * @returns {number} - Duration in seconds
     */
    stepsToSeconds(steps, bpm = this.#transport.bpm) {
        const ppq = this.#transport.timeSignature.ppq;
        const beatsPerStep = 1 / (ppq / 4); // Assuming 4/4 time signature
        const beatsPerSecond = bpm / 60;
        return (steps * beatsPerStep) / beatsPerSecond;
    }

    /**
     * Convert seconds duration to steps
     * @param {number} seconds - Duration in seconds
     * @param {number} bpm - BPM (defaults to current transport BPM)
     * @returns {number} - Number of steps
     */
    secondsToSteps(seconds, bpm = this.#transport.bpm) {
        const ppq = this.#transport.timeSignature.ppq;
        const beatsPerStep = 1 / (ppq / 4);
        const beatsPerSecond = bpm / 60;
        return (seconds * beatsPerSecond) / beatsPerStep;
    }

    /**
     * Convert step position to absolute AudioContext time
     * @param {number} step - Step position
     * @returns {number} - AudioContext time when this step occurs
     */
    stepToTime(step) {
        if (this.#playStartTime === null) {
            logger.warn(NAMESPACES.AUDIO, 'stepToTime called before playback started');
            return this.#audioContext.currentTime;
        }

        const relativeStep = step - this.#playStartStep;
        const seconds = this.stepsToSeconds(relativeStep);
        return this.#playStartTime + seconds;
    }

    /**
     * Convert absolute AudioContext time to step position
     * @param {number} time - AudioContext time
     * @returns {number} - Step position at that time
     */
    timeToStep(time) {
        if (this.#playStartTime === null) {
            return 0;
        }

        const elapsed = time - this.#playStartTime;
        const steps = this.secondsToSteps(elapsed);
        return this.#playStartStep + steps;
    }

    // ============================================================================
    // CURRENT POSITION - AudioContext.currentTime based
    // ============================================================================

    /**
     * Get current step position based on AudioContext.currentTime
     * This is the ONLY authoritative position - all others derive from this
     * @returns {number} - Current step position
     */
    currentStep() {
        if (!this.#transport.isPlaying || this.#playStartTime === null) {
            return this.#transport.position;
        }

        const currentTime = this.#audioContext.currentTime;
        return this.timeToStep(currentTime);
    }

    /**
     * Get current time in seconds since playback started
     * @returns {number} - Elapsed seconds
     */
    currentElapsedTime() {
        if (this.#playStartTime === null) {
            return 0;
        }

        return this.#audioContext.currentTime - this.#playStartTime;
    }

    // ============================================================================
    // RAF TICK - Updates transport position
    // ============================================================================

    /**
     * Called on requestAnimationFrame to update transport position
     * This is for UI updates - audio scheduling uses stepToTime directly
     */
    tick() {
        if (!this.#transport.isPlaying) {
            return;
        }

        const currentStep = this.currentStep();

        // Apply loop wrapping if needed (transport will emit loopWrap event)
        const loop = this.#transport.loop;
        if (loop.enabled && currentStep >= loop.end) {
            // Transport will handle the wrap, but we need to update our reference
            const wrappedStep = loop.start + (currentStep - loop.end);
            this.#updatePlayReference(this.#audioContext.currentTime, wrappedStep);
            this.#transport.updatePosition(wrappedStep);
        } else {
            this.#transport.updatePosition(currentStep);
        }
    }

    // ============================================================================
    // PRIVATE METHODS - Reference point management
    // ============================================================================

    #handleStateChange({ state, position }) {
        if (state === 'PLAYING') {
            // Starting playback - set reference point
            this.#updatePlayReference(this.#audioContext.currentTime, position);
            logger.debug(NAMESPACES.AUDIO, `⏰ Clock reference set: time=${this.#playStartTime.toFixed(3)}s, step=${position}`);
        } else if (state === 'STOPPED') {
            // Stopped - clear reference
            this.#playStartTime = null;
            this.#playStartStep = 0;
            logger.debug(NAMESPACES.AUDIO, '⏰ Clock reference cleared');
        } else if (state === 'PAUSED') {
            // Paused - keep reference but note position for resume
            logger.debug(NAMESPACES.AUDIO, `⏰ Clock paused @ step=${position}`);
        }
    }

    #handleBpmChange({ previousBpm, bpm }) {
        if (!this.#transport.isPlaying) {
            return; // BPM changes during stop don't affect clock
        }

        // Record BPM change for future tempo calculations
        const currentTime = this.#audioContext.currentTime;
        const currentStep = this.currentStep();

        this.#bpmChangeHistory.push({
            time: currentTime,
            bpm: previousBpm,
            step: currentStep
        });

        // Update play reference to new BPM basis
        this.#updatePlayReference(currentTime, currentStep);

        logger.debug(NAMESPACES.AUDIO, `⏰ Clock adjusted for BPM change: ${previousBpm} → ${bpm} @ step ${currentStep.toFixed(2)}`);
    }

    #updatePlayReference(time, step) {
        this.#playStartTime = time;
        this.#playStartStep = step;
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================

    /**
     * Get clock diagnostic info
     */
    getDiagnostics() {
        return {
            playStartTime: this.#playStartTime,
            playStartStep: this.#playStartStep,
            currentTime: this.#audioContext.currentTime,
            currentStep: this.currentStep(),
            elapsedTime: this.currentElapsedTime(),
            bpm: this.#transport.bpm,
            bpmChangeCount: this.#bpmChangeHistory.length
        };
    }

    /**
     * Dispose - cleanup listeners
     */
    dispose() {
        this.#transport.off('stateChange', this.#handleStateChange);
        this.#transport.off('bpmChange', this.#handleBpmChange);
        logger.debug(NAMESPACES.AUDIO, '🗑️ AudioClock disposed');
    }
}

export default AudioClock;
