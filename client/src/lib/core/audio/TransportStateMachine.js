import { EventEmitter } from 'events';
import { logger, NAMESPACES } from '@/lib/utils/debugLogger';

/**
 * TransportStateMachine - Central authority for transport state
 * 
 * PHILOSOPHY:
 * - Single source of truth for ALL transport state
 * - Synchronous, atomic state transitions
 * - Immutable state (can only change via methods)
 * - Observable via events
 * 
 * STATE MACHINE:
 * STOPPED → play() → PLAYING
 * PLAYING → pause() → PAUSED
 * PAUSED → resume() → PLAYING
 * PLAYING/PAUSED → stop() → STOPPED
 * 
 * @example
 * const transport = new TransportStateMachine();
 * transport.on('stateChange', ({ state, position }) => {
 *   console.log(`Now ${state} at step ${position}`);
 * });
 * transport.play(0); // Emits stateChange
 */
export class TransportStateMachine extends EventEmitter {
    // Private fields - immutable from outside
    #state = 'STOPPED'; // 'STOPPED' | 'PLAYING' | 'PAUSED'
    #position = 0; // Current position in steps
    #bpm = 120;
    #timeSignature = {
        numerator: 4,
        denominator: 4,
        ppq: 24 // Pulses per quarter note
    };
    #loop = {
        enabled: true,
        start: 0,
        end: 64,
        length: 64
    };

    constructor(config = {}) {
        super();

        if (config.bpm) this.#bpm = config.bpm;
        if (config.timeSignature) this.#timeSignature = { ...this.#timeSignature, ...config.timeSignature };
        if (config.loop) this.#loop = { ...this.#loop, ...config.loop };

        logger.debug(NAMESPACES.AUDIO, '🎛️ TransportStateMachine initialized', {
            state: this.#state,
            bpm: this.#bpm,
            loop: this.#loop
        });
    }

    // ============================================================================
    // PUBLIC GETTERS - Read-only access to state
    // ============================================================================

    get state() {
        return this.#state;
    }

    get position() {
        return this.#position;
    }

    get bpm() {
        return this.#bpm;
    }

    get timeSignature() {
        return { ...this.#timeSignature }; // Defensive copy
    }

    get loop() {
        return { ...this.#loop }; // Defensive copy
    }

    get isPlaying() {
        return this.#state === 'PLAYING';
    }

    get isPaused() {
        return this.#state === 'PAUSED';
    }

    get isStopped() {
        return this.#state === 'STOPPED';
    }

    // ============================================================================
    // STATE TRANSITIONS - Only way to mutate state
    // ============================================================================

    /**
     * Start playback from a specific position
     * @param {number} fromPosition - Step to start from (defaults to current position)
     * @returns {boolean} - Whether state transition occurred
     */
    play(fromPosition = this.#position) {
        // Guard: Can only play from STOPPED or PAUSED
        if (this.#state === 'PLAYING') {
            logger.warn(NAMESPACES.AUDIO, '⚠️ Cannot play - already playing');
            return false;
        }

        const previousState = this.#state;
        this.#state = 'PLAYING';
        this.#position = fromPosition;

        logger.debug(NAMESPACES.AUDIO, `▶️ State transition: ${previousState} → PLAYING @ step ${fromPosition}`);

        this.emit('stateChange', {
            previousState,
            state: 'PLAYING',
            position: fromPosition,
            timestamp: performance.now()
        });

        return true;
    }

    /**
     * Pause playback (preserves position)
     * @returns {boolean} - Whether state transition occurred
     */
    pause() {
        // Guard: Can only pause when playing
        if (this.#state !== 'PLAYING') {
            logger.warn(NAMESPACES.AUDIO, '⚠️ Cannot pause - not playing');
            return false;
        }

        const previousState = this.#state;
        this.#state = 'PAUSED';

        logger.debug(NAMESPACES.AUDIO, `⏸️ State transition: ${previousState} → PAUSED @ step ${this.#position}`);

        this.emit('stateChange', {
            previousState,
            state: 'PAUSED',
            position: this.#position,
            timestamp: performance.now()
        });

        return true;
    }

    /**
     * Resume playback from paused state
     * @returns {boolean} - Whether state transition occurred
     */
    resume() {
        // Guard: Can only resume from PAUSED
        if (this.#state !== 'PAUSED') {
            logger.warn(NAMESPACES.AUDIO, '⚠️ Cannot resume - not paused');
            return false;
        }

        const previousState = this.#state;
        this.#state = 'PLAYING';

        logger.debug(NAMESPACES.AUDIO, `▶️ State transition: ${previousState} → PLAYING (resumed) @ step ${this.#position}`);

        this.emit('stateChange', {
            previousState,
            state: 'PLAYING',
            position: this.#position,
            timestamp: performance.now()
        });

        return true;
    }

    /**
     * Stop playback (resets position to 0)
     * @returns {boolean} - Whether state transition occurred
     */
    stop() {
        // Guard: Can only stop when playing or paused
        if (this.#state === 'STOPPED') {
            logger.warn(NAMESPACES.AUDIO, '⚠️ Cannot stop - already stopped');
            return false;
        }

        const previousState = this.#state;
        this.#state = 'STOPPED';
        this.#position = 0;

        logger.debug(NAMESPACES.AUDIO, `⏹️ State transition: ${previousState} → STOPPED`);

        this.emit('stateChange', {
            previousState,
            state: 'STOPPED',
            position: 0,
            timestamp: performance.now()
        });

        return true;
    }

    // ============================================================================
    // POSITION UPDATES - Called by AudioClock
    // ============================================================================

    /**
     * Update current position (called by AudioClock on RAF tick)
     * Handles loop wrap automatically
     * @param {number} newPosition - New position in steps
     */
    updatePosition(newPosition) {
        // Only update if playing
        if (this.#state !== 'PLAYING') {
            return;
        }

        const oldPosition = this.#position;
        this.#position = newPosition;

        // Check for loop wrap
        if (this.#loop.enabled && newPosition >= this.#loop.end) {
            const wrappedPosition = this.#loop.start + (newPosition - this.#loop.end);
            this.#position = wrappedPosition;

            logger.debug(NAMESPACES.AUDIO, `🔁 Loop wrap: step ${oldPosition.toFixed(2)} → ${wrappedPosition.toFixed(2)}`);

            this.emit('loopWrap', {
                from: oldPosition,
                to: wrappedPosition,
                loopEnd: this.#loop.end,
                loopStart: this.#loop.start,
                timestamp: performance.now()
            });
        }

        // Emit position update (throttled in practice by RAF)
        this.emit('positionUpdate', {
            position: this.#position,
            previousPosition: oldPosition
        });
    }

    /**
     * Jump to a specific position (for seek operations)
     * @param {number} step - Target step
     */
    jumpToStep(step) {
        const oldPosition = this.#position;
        this.#position = step;

        logger.debug(NAMESPACES.AUDIO, `⏩ Jump: step ${oldPosition} → ${step}`);

        this.emit('positionJump', {
            from: oldPosition,
            to: step,
            timestamp: performance.now()
        });

        this.emit('positionUpdate', {
            position: this.#position,
            previousPosition: oldPosition
        });
    }

    // ============================================================================
    // CONFIGURATION UPDATES
    // ============================================================================

    /**
     * Update BPM
     * @param {number} newBpm - New BPM value
     */
    setBpm(newBpm) {
        if (newBpm <= 0 || newBpm > 999) {
            logger.error(NAMESPACES.AUDIO, `Invalid BPM: ${newBpm}`);
            return false;
        }

        const oldBpm = this.#bpm;
        this.#bpm = newBpm;

        logger.debug(NAMESPACES.AUDIO, `♩ BPM changed: ${oldBpm} → ${newBpm}`);

        this.emit('bpmChange', {
            previousBpm: oldBpm,
            bpm: newBpm,
            timestamp: performance.now()
        });

        return true;
    }

    /**
     * Update loop settings
     * @param {Object} loopConfig - { enabled, start, end }
     */
    setLoop(loopConfig) {
        const oldLoop = { ...this.#loop };
        this.#loop = { ...this.#loop, ...loopConfig };

        // Recalculate length
        if (loopConfig.start !== undefined || loopConfig.end !== undefined) {
            this.#loop.length = this.#loop.end - this.#loop.start;
        }

        logger.debug(NAMESPACES.AUDIO, `🔁 Loop updated:`, this.#loop);

        this.emit('loopChange', {
            previousLoop: oldLoop,
            loop: { ...this.#loop },
            timestamp: performance.now()
        });

        return true;
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================

    /**
     * Get snapshot of current state (for debugging/persistence)
     */
    getSnapshot() {
        return {
            state: this.#state,
            position: this.#position,
            bpm: this.#bpm,
            timeSignature: { ...this.#timeSignature },
            loop: { ...this.#loop },
            timestamp: performance.now()
        };
    }

    /**
     * Dispose - cleanup listeners
     */
    dispose() {
        this.removeAllListeners();
        logger.debug(NAMESPACES.AUDIO, '🗑️ TransportStateMachine disposed');
    }
}

export default TransportStateMachine;
