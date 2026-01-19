import { logger, NAMESPACES } from '@/lib/utils/debugLogger';

/**
 * ContinuousScheduler - Lookahead-based event scheduler
 * 
 * PHILOSOPHY:
 * - NEVER restart scheduling - always continue forward
 * - Maintain lookahead buffer (100-200ms ahead of playback)
 * - Loop wraps are transparent (just keep scheduling)
 * - Events are scheduled in AudioContext time (sample-accurate)
 * 
 * HOW IT WORKS:
 * 1. On each tick (every ~25ms), check current position
 * 2. Schedule all events from lastScheduledStep to currentStep + lookahead
 * 3. On loop wrap: adjust window, continue scheduling
 * 4. NO cancellation unless explicitly required
 * 
 * @example
 * const scheduler = new ContinuousScheduler(audioContext, transport, clock);
 * scheduler.setPattern(myPattern);
 * scheduler.start(); // Begins lookahead scheduling loop
 */
export class ContinuousScheduler {
    #audioContext;
    #transport; // TransportStateMachine
    #clock; // AudioClock

    #lookaheadTime = 0.2; // 200ms default
    #tickInterval = 25; // Check every 25ms
    #scheduledUntilStep = -1; // Last step we've scheduled

    #pattern = null; // Current pattern to schedule
    #eventQueue = new Map(); // step → [ events ]
    #scheduledAudioNodes = new Set(); // Track scheduled nodes for cleanup

    #tickTimerId = null;
    #isRunning = false;

    constructor(audioContext, transport, clock, options = {}) {
        if (!audioContext) throw new Error('ContinuousScheduler requires AudioContext');
        if (!transport) throw new Error('ContinuousScheduler requires TransportStateMachine');
        if (!clock) throw new Error('ContinuousScheduler requires AudioClock');

        this.#audioContext = audioContext;
        this.#transport = transport;
        this.#clock = clock;

        this.#lookaheadTime = options.lookaheadTime || 0.2;
        this.#tickInterval = options.tickInterval || 25;

        // Listen to transport events
        this.#transport.on('stateChange', this.#handleStateChange.bind(this));
        this.#transport.on('loopWrap', this.#handleLoopWrap.bind(this));

        logger.debug(NAMESPACES.AUDIO, '📅 ContinuousScheduler initialized', {
            lookahead: `${this.#lookaheadTime * 1000}ms`,
            tickInterval: `${this.#tickInterval}ms`
        });
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================

    /**
     * Start the scheduling loop
     */
    start() {
        if (this.#isRunning) {
            logger.warn(NAMESPACES.AUDIO, 'Scheduler already running');
            return;
        }

        this.#isRunning = true;
        this.#scheduledUntilStep = this.#transport.position - 1; // Force schedule from current position
        this.#tickTimerId = setInterval(() => this.#tick(), this.#tickInterval);

        logger.debug(NAMESPACES.AUDIO, '▶️ ContinuousScheduler started');
    }

    /**
     * Stop the scheduling loop
     */
    stop() {
        if (!this.#isRunning) {
            return;
        }

        this.#isRunning = false;
        if (this.#tickTimerId !== null) {
            clearInterval(this.#tickTimerId);
            this.#tickTimerId = null;
        }

        logger.debug(NAMESPACES.AUDIO, '⏹️ ContinuousScheduler stopped');
    }

    /**
     * Set pattern to schedule
     * @param {Object} pattern - { steps: Array<{ position, events: Array<{pitch, velocity, duration}> }> }
     */
    setPattern(pattern) {
        if (!pattern || !pattern.steps) {
            logger.error(NAMESPACES.AUDIO, 'Invalid pattern format');
            return;
        }

        // Convert pattern to event queue
        this.#eventQueue.clear();
        pattern.steps.forEach(step => {
            if (step.events && step.events.length > 0) {
                this.#eventQueue.set(step.position, step.events);
            }
        });

        this.#pattern = pattern;

        // Reset scheduling if playing
        if (this.#transport.isPlaying) {
            this.#scheduledUntilStep = this.#transport.position - 1;
        }

        logger.debug(NAMESPACES.AUDIO, `📝 Pattern set: ${this.#eventQueue.size} steps with events`);
    }

    /**
     * Clear scheduled pattern
     */
    clearPattern() {
        this.#pattern = null;
        this.#eventQueue.clear();
        logger.debug(NAMESPACES.AUDIO, '🧹 Pattern cleared');
    }

    /**
     * Update lookahead time
     */
    setLookahead(timeInSeconds) {
        this.#lookaheadTime = Math.max(0.05, Math.min(0.5, timeInSeconds)); // Clamp 50ms-500ms
        logger.debug(NAMESPACES.AUDIO, `⏱️ Lookahead updated: ${this.#lookaheadTime * 1000}ms`);
    }

    // ============================================================================
    // SCHEDULING CORE - Called every tick
    // ============================================================================

    #tick() {
        if (!this.#transport.isPlaying || !this.#pattern) {
            return;
        }

        const currentStep = this.#clock.currentStep();
        const currentTime = this.#audioContext.currentTime;
        const scheduleUntilTime = currentTime + this.#lookaheadTime;
        const scheduleUntilStep = this.#clock.timeToStep(scheduleUntilTime);

        // Only schedule NEW steps
        if (scheduleUntilStep <= this.#scheduledUntilStep) {
            return; // Nothing new to schedule
        }

        const startStep = this.#scheduledUntilStep + 1;
        let scheduledCount = 0;

        // Schedule all steps in range
        for (let step = startStep; step <= scheduleUntilStep; step++) {
            const wrappedStep = this.#getWrappedStep(step);
            scheduledCount += this.#scheduleEventsAtStep(wrappedStep, step);
        }

        this.#scheduledUntilStep = scheduleUntilStep;

        if (scheduledCount > 0) {
            logger.debug(NAMESPACES.AUDIO,
                `📅 Scheduled ${scheduledCount} events from step ${startStep.toFixed(1)} to ${scheduleUntilStep.toFixed(1)}`
            );
        }
    }

    /**
     * Schedule all events at a specific step
     * @param {number} wrappedStep - Step within loop bounds (for event lookup)
     * @param {number} absoluteStep - Actual timeline step (for time calculation)
     * @returns {number} - Number of events scheduled
     */
    #scheduleEventsAtStep(wrappedStep, absoluteStep) {
        const events = this.#eventQueue.get(wrappedStep);
        if (!events || events.length === 0) {
            return 0;
        }

        const audioTime = this.#clock.stepToTime(absoluteStep);

        // Schedule each event
        events.forEach(event => {
            this.#scheduleNote(event, audioTime);
        });

        return events.length;
    }

    /**
     * Schedule a single note to Web Audio
     * @param {Object} event - { pitch, velocity, duration, instrument }
     * @param {number} audioTime - When to play (AudioContext time)
     */
    #scheduleNote(event, audioTime) {
        // TODO: Integrate with actual instrument system
        // For now, just log
        if (import.meta.env.DEV) {
            logger.debug(NAMESPACES.AUDIO,
                `🎵 Note scheduled: ${event.pitch} @ ${audioTime.toFixed(3)}s (velocity: ${event.velocity}, duration: ${event.duration})`
            );
        }

        // Placeholder for actual instrument scheduling:
        // const instrument = this.getInstrument(event.instrumentId);
        // instrument.scheduleNote(event.pitch, audioTime, event.duration, event.velocity);
    }

    // ============================================================================
    // LOOP WRAPPING
    // ============================================================================

    /**
     * Wrap step to loop bounds
     * @param {number} step - Absolute step
     * @returns {number} - Wrapped step within loop
     */
    #getWrappedStep(step) {
        const loop = this.#transport.loop;
        if (!loop.enabled) {
            return step;
        }

        const { start, end } = loop;
        const loopLength = end - start;

        if (step < start) {
            return step;
        }

        if (step >= end) {
            // Wrap within loop
            const relativeStep = step - start;
            return start + (relativeStep % loopLength);
        }

        return step;
    }

    #handleLoopWrap({ from, to }) {
        logger.debug(NAMESPACES.AUDIO, `🔁 Scheduler: Loop wrap detected ${from.toFixed(2)} → ${to.toFixed(2)}`);

        // Option A: Do nothing - scheduler naturally wraps via #getWrappedStep ✅
        // This is the cleanest approach

        // Option B: Clear events beyond loop end (if needed for very short loops)
        // const loop = this.#transport.loop;
        // if (loop.length < this.#lookaheadSteps) {
        //     this.#clearEventsAfter(to + loop.length);
        // }
    }

    // ============================================================================
    // STATE CHANGE HANDLING
    // ============================================================================

    #handleStateChange({ state, position }) {
        if (state === 'PLAYING') {
            // Reset scheduling window on play
            this.#scheduledUntilStep = position - 1;
            logger.debug(NAMESPACES.AUDIO, `📅 Scheduler: Play detected, reset scheduled window @ step ${position}`);
        } else if (state === 'STOPPED') {
            // Stop scheduling and cleanup
            this.#scheduledUntilStep = -1;
            this.#cleanupScheduledNodes();
            logger.debug(NAMESPACES.AUDIO, '📅 Scheduler: Stop detected, cleanup complete');
        }
    }

    /**
     * Cleanup all scheduled audio nodes (for stop/dispose)
     */
    #cleanupScheduledNodes() {
        // TODO: Stop all scheduled notes
        // For now, just clear the set
        this.#scheduledAudioNodes.clear();
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================

    getStats() {
        return {
            isRunning: this.#isRunning,
            scheduledUntilStep: this.#scheduledUntilStep,
            currentStep: this.#clock.currentStep(),
            lookaheadSteps: this.#clock.secondsToSteps(this.#lookaheadTime),
            eventQueueSize: this.#eventQueue.size,
            scheduledNodesCount: this.#scheduledAudioNodes.size
        };
    }

    dispose() {
        this.stop();
        this.#cleanupScheduledNodes();
        this.#eventQueue.clear();
        this.#transport.off('stateChange', this.#handleStateChange);
        this.#transport.off('loopWrap', this.#handleLoopWrap);
        logger.debug(NAMESPACES.AUDIO, '🗑️ ContinuousScheduler disposed');
    }
}

export default ContinuousScheduler;
