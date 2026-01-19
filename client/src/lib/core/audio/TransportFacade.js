/**
 * TransportFacade - Integration layer between old and new transport architecture
 * 
 * PURPOSE:
 * - Allows gradual migration from old NativeTransportSystem to new architecture
 * - Provides backwards-compatible API
 * - Routes state reads/writes to appropriate system
 * 
 * ARCHITECTURE:
 * OLD (Deprecated):
 * - NativeTransportSystem (RAF-based tick calculation)
 * - TransportController (hybrid state)
 * - PlaybackService (async loop handlers)
 * 
 * NEW (Phase 1):
 * - TransportStateMachine (state authority)
 * - AudioClock (timing authority)
 * - ContinuousScheduler (coming in Phase 2)
 * 
 * @example
 * const facade = new TransportFacade(audioContext, oldTransport);
 * facade.play(); // Triggers both old and new systems
 * console.log(facade.isPlaying); // Reads from new StateMachine
 */

import { TransportStateMachine } from './audio/TransportStateMachine';
import { AudioClock } from './audio/AudioClock';
import { logger, NAMESPACES } from '@/lib/utils/debugLogger';

export class TransportFacade {
    // Public fields (accessible from NativeAudioEngine)
    stateMachine;
    clock;
    #legacyTransport; // Reference to old NativeTransportSystem
    #rafHandle = null;

    constructor(audioContext, legacyTransport = null) {
        if (!audioContext) {
            throw new Error('TransportFacade requires AudioContext');
        }

        this.audioContext = audioContext;
        this.#legacyTransport = legacyTransport;

        // Initialize new architecture
        const config = this.#extractLegacyConfig();
        this.stateMachine = new TransportStateMachine(config);
        this.clock = new AudioClock(audioContext, this.stateMachine);

        // Start RAF loop for position updates
        this.#startRAFLoop();

        // Sync state changes to legacy system (if exists)
        if (this.#legacyTransport) {
            this.#syncToLegacy();
        }

        logger.debug(NAMESPACES.AUDIO, '🎭 TransportFacade initialized (Phase 1 Integration)');
    }

    // ============================================================================
    // PUBLIC API - Backwards compatible
    // ============================================================================

    play(fromPosition) {
        const position = fromPosition !== undefined ? fromPosition : this.#stateMachine.position;

        // New system
        const success = this.#stateMachine.play(position);

        // Legacy system (if exists)
        if (this.#legacyTransport && success) {
            this.#legacyTransport.isPlaying = true;
            this.#legacyTransport._playbackStartTime = this.audioContext.currentTime;
            this.#legacyTransport._playbackStartTick = position * this.stateMachine.timeSignature.ppq;
        }

        return success;
    }

    pause() {
        const success = this.stateMachine.pause();

        if (this.#legacyTransport && success) {
            this.#legacyTransport.isPlaying = false;
        }

        return success;
    }

    resume() {
        return this.stateMachine.resume();
    }

    stop() {
        const success = this.stateMachine.stop();

        if (this.#legacyTransport && success) {
            this.#legacyTransport.isPlaying = false;
            this.#legacyTransport.currentTick = 0;
        }

        return success;
    }

    seek(step) {
        this.#stateMachine.jumpToStep(step);

        if (this.#legacyTransport) {
            this.#legacyTransport.currentTick = step * this.#stateMachine.timeSignature.ppq;
        }
    }

    // ============================================================================
    // GETTERS - Read from new StateMachine
    // ============================================================================

    get isPlaying() {
        return this.stateMachine.isPlaying;
    }

    get isPaused() {
        return this.stateMachine.isPaused;
    }

    get isStopped() {
        return this.stateMachine.isStopped;
    }

    get position() {
        return this.stateMachine.position;
    }

    get positionInTicks() {
        return this.stateMachine.position * this.stateMachine.timeSignature.ppq;
    }

    get bpm() {
        return this.stateMachine.bpm;
    }

    get loop() {
        return this.stateMachine.loop;
    }

    get state() {
        return this.stateMachine.state;
    }

    // ============================================================================
    // SETTERS - Write to both systems
    // ============================================================================

    setBpm(newBpm) {
        const success = this.stateMachine.setBpm(newBpm);

        if (this.#legacyTransport && success) {
            this.#legacyTransport.tempo = newBpm;
        }

        return success;
    }

    setLoop(loopConfig) {
        const success = this.#stateMachine.setLoop(loopConfig);

        if (this.#legacyTransport && success) {
            const ppq = this.#stateMachine.timeSignature.ppq;
            if (loopConfig.enabled !== undefined) {
                this.#legacyTransport.loop = loopConfig.enabled;
            }
            if (loopConfig.start !== undefined) {
                this.#legacyTransport.loopStartTick = loopConfig.start * ppq;
            }
            if (loopConfig.end !== undefined) {
                this.#legacyTransport.loopEndTick = loopConfig.end * ppq;
            }
        }

        return success;
    }

    // ============================================================================
    // TIMING UTILITIES - Delegated to AudioClock
    // ============================================================================

    stepToTime(step) {
        return this.clock.stepToTime(step);
    }

    timeToStep(time) {
        return this.clock.timeToStep(time);
    }

    currentStep() {
        return this.clock.currentStep();
    }

    currentTime() {
        return this.audioContext.currentTime;
    }

    // ============================================================================
    // EVENT FORWARDING - Subscribe to StateMachine events
    // ============================================================================

    on(event, callback) {
        this.stateMachine.on(event, callback);
    }

    off(event, callback) {
        this.stateMachine.off(event, callback);
    }

    once(event, callback) {
        this.stateMachine.once(event, callback);
    }

    // ============================================================================
    // PRIVATE METHODS
    // ============================================================================

    #extractLegacyConfig() {
        if (!this.#legacyTransport) {
            return {}; // Use defaults
        }

        return {
            bpm: this.#legacyTransport.tempo || 120,
            timeSignature: this.#legacyTransport.timeSignature || {
                numerator: 4,
                denominator: 4,
                ppq: 24
            },
            loop: {
                enabled: this.#legacyTransport.loop || false,
                start: this.#legacyTransport.loopStartTick
                    ? this.#legacyTransport.loopStartTick / (this.#legacyTransport.timeSignature?.ppq || 24)
                    : 0,
                end: this.#legacyTransport.loopEndTick
                    ? this.#legacyTransport.loopEndTick / (this.#legacyTransport.timeSignature?.ppq || 24)
                    : 64,
                length: 64
            }
        };
    }

    #syncToLegacy() {
        // Listen to new system events and update legacy
        this.stateMachine.on('positionUpdate', ({ position }) => {
            if (this.#legacyTransport) {
                this.#legacyTransport.currentTick = position * this.stateMachine.timeSignature.ppq;
            }
        });

        this.stateMachine.on('loopWrap', ({ to }) => {
            if (this.#legacyTransport) {
                logger.debug(NAMESPACES.AUDIO, `🔁 Facade: Loop wrap synced to legacy @ step ${to}`);
            }
        });
    }

    #startRAFLoop() {
        const loop = () => {
            if (this.stateMachine.isPlaying) {
                // Update position based on AudioClock
                this.clock.tick();
            }

            this.#rafHandle = requestAnimationFrame(loop);
        };

        this.#rafHandle = requestAnimationFrame(loop);
    }

    #stopRAFLoop() {
        if (this.#rafHandle !== null) {
            cancelAnimationFrame(this.#rafHandle);
            this.#rafHandle = null;
        }
    }

    // ============================================================================
    // DIAGNOSTICS
    // ============================================================================

    getDiagnostics() {
        return {
            facade: {
                isPlaying: this.isPlaying,
                position: this.position,
                bpm: this.bpm
            },
            stateMachine: this.stateMachine.getSnapshot(),
            clock: this.clock.getDiagnostics(),
            legacy: this.#legacyTransport ? {
                isPlaying: this.#legacyTransport.isPlaying,
                currentTick: this.#legacyTransport.currentTick,
                tempo: this.#legacyTransport.tempo
            } : null
        };
    }

    // ============================================================================
    // CLEANUP
    // ============================================================================

    dispose() {
        this.#stopRAFLoop();
        this.clock.dispose();
        this.stateMachine.dispose();
        logger.debug(NAMESPACES.AUDIO, '🗑️ TransportFacade disposed');
    }
}

export default TransportFacade;
