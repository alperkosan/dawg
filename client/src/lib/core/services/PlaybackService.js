/**
 * PlaybackService - Extracted from PlaybackManager
 * 
 * Handles playback state and control:
 * - Play/Stop/Pause/Resume
 * - Loop configuration
 * - Position tracking
 * - Mode switching (Pattern/Song)
 * 
 * @module lib/core/services/PlaybackService
 */

import { logger, NAMESPACES } from '../../utils/debugLogger.js';
import { idleDetector } from '../../utils/IdleDetector.js';

export class PlaybackService {
    /**
     * @param {NativeAudioEngine} engine - Parent audio engine
     */
    constructor(engine) {
        this.engine = engine;

        // Playback state
        this.isPlaying = false;
        this.isPaused = false;
        // ✅ CRITICAL FIX: Position now reads from Transport (Single Source of Truth)
        this._currentPosition = 0; // Backing field for fallback only
        this.startTime = 0;

        // Mode
        this.playbackMode = 'pattern'; // 'pattern' | 'song'

        // ✅ CRITICAL FIX: Loop settings now read from Transport (Single Source of Truth)
        // Keeping backing fields for fallback only
        this.loopSettings = {
            start: 0,
            end: 64,
            length: 64,
            enabled: true,
            auto: true
        };

        // Active pattern
        this.activePatternId = null;

        // Position update rate
        this.positionUpdateRate = 60; // Hz
        this._positionInterval = null;

        // Event listeners
        this._listeners = new Map();
    }

    // =================== SINGLE SOURCE OF TRUTH GETTERS ===================

    /**
     * Get current playback position in steps
     * @returns {number} Current position (derived from Transport)
     */
    get currentPosition() {
        // Read from Transport (single source of truth)
        return this.transport?.getCurrentStep() || this._currentPosition || 0;
    }

    /**
     * Set current position (updates Transport)
     * @param {number} value - Position in steps
     */
    set currentPosition(value) {
        this._currentPosition = value;
        // Also update Transport if available
        if (this.transport?.setPosition) {
            this.transport.setPosition(value);
        }
    }

    /**
     * Get audio context from parent engine
     */
    get audioContext() {
        return this.engine.audioContext;
    }

    /**
     * Get transport from parent engine
     */
    get transport() {
        return this.engine.transport;
    }

    /**
     * Start playback
     * @param {number} startStep - Step to start from
     * @returns {this}
     */
    play(startStep = 0) {
        if (!this.engine.isInitialized) {
            logger.warn(NAMESPACES.AUDIO, 'Cannot play: engine not initialized');
            return this;
        }

        if (this.isPaused) {
            return this.resume();
        }

        try {
            this.currentPosition = startStep;
            this.startTime = this.audioContext.currentTime;
            this.isPlaying = true;
            this.isPaused = false;

            // ✅ CRITICAL: Prevent idle mode during playback
            idleDetector.setPlaying(true);

            // Start transport
            if (this.transport) {
                this.transport.start(startStep);
            }

            // Start position tracking
            this._startPositionTracking();

            // Emit event
            this._emit('play', { startStep, time: this.startTime });

            logger.info(NAMESPACES.AUDIO, `Playback started at step ${startStep}`);
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, 'Failed to start playback:', error);
        }

        return this;
    }

    /**
     * Stop playback
     * @returns {this}
     */
    stop() {
        if (!this.isPlaying && !this.isPaused) {
            return this;
        }

        try {
            // Stop transport
            if (this.transport) {
                this.transport.stop();
            }

            // Stop all instrument sounds
            this._stopAllSounds();

            // Reset state
            this.isPlaying = false;
            this.isPaused = false;
            this.currentPosition = 0;

            // ✅ CRITICAL: Re-enable idle detection
            idleDetector.setPlaying(false);

            // Stop position tracking
            this._stopPositionTracking();

            // Emit event
            this._emit('stop', { time: this.audioContext?.currentTime });

            logger.info(NAMESPACES.AUDIO, 'Playback stopped');
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, 'Failed to stop playback:', error);
        }

        return this;
    }

    /**
     * Pause playback
     * @returns {this}
     */
    pause() {
        if (!this.isPlaying) {
            return this;
        }

        try {
            // Pause transport
            if (this.transport) {
                this.transport.pause();
            }

            // Release all notes gracefully
            this._releaseAllNotes();

            this.isPlaying = false;
            this.isPaused = true;

            // Emit event
            this._emit('pause', { position: this.currentPosition });

            logger.info(NAMESPACES.AUDIO, `Playback paused at position ${this.currentPosition}`);
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, 'Failed to pause playback:', error);
        }

        return this;
    }

    /**
     * Resume playback from paused position
     * @returns {this}
     */
    resume() {
        if (!this.isPaused) {
            return this;
        }

        try {
            // ✅ FIX: NativeTransportSystem doesn't have resume(), use start() with current position
            // Resume is just starting from the paused position
            if (this.transport) {
                this.transport.start(this.currentPosition);
            }

            this.isPlaying = true;
            this.isPaused = false;

            // Restart position tracking
            this._startPositionTracking();

            // Emit event
            this._emit('resume', { position: this.currentPosition });

            logger.info(NAMESPACES.AUDIO, `Playback resumed from position ${this.currentPosition}`);
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, 'Failed to resume playback:', error);
        }

        return this;
    }

    /**
     * Set playback mode
     * @param {'pattern'|'song'} mode 
     * @returns {this}
     */
    setPlaybackMode(mode) {
        if (mode !== 'pattern' && mode !== 'song') {
            logger.warn(NAMESPACES.AUDIO, `Invalid playback mode: ${mode}`);
            return this;
        }

        const wasPlaying = this.isPlaying;

        if (wasPlaying) {
            this.stop();
        }

        this.playbackMode = mode;
        this._updateLoopSettings();

        this._emit('modeChange', { mode });

        logger.info(NAMESPACES.AUDIO, `Playback mode set to: ${mode}`);

        return this;
    }

    /**
     * Get current playback mode
     * @returns {'pattern'|'song'}
     */
    getPlaybackMode() {
        return this.playbackMode;
    }

    /**
     * Set loop points
     * @param {number} startStep 
     * @param {number} endStep 
     * @returns {this}
     */
    setLoopPoints(startStep, endStep) {
        this.loopSettings.start = Math.max(0, startStep);
        this.loopSettings.end = Math.max(this.loopSettings.start + 1, endStep);
        this.loopSettings.length = this.loopSettings.end - this.loopSettings.start;
        this.loopSettings.auto = false;

        this._emit('loopChange', { ...this.loopSettings });

        return this;
    }

    /**
     * Set loop enabled state
     * @param {boolean} enabled 
     * @returns {this}
     */
    setLoopEnabled(enabled) {
        this.loopSettings.enabled = enabled;

        if (this.transport) {
            this.transport.setLoop(enabled);
        }

        this._emit('loopChange', { ...this.loopSettings });

        return this;
    }

    /**
     * Enable automatic loop based on content
     * @returns {this}
     */
    enableAutoLoop() {
        this.loopSettings.auto = true;
        this._updateLoopSettings();

        return this;
    }

    /**
     * Jump to a specific step
     * @param {number} step 
     * @returns {this}
     */
    jumpToStep(step) {
        const clampedStep = Math.max(0, step);
        this.currentPosition = clampedStep;

        if (this.transport) {
            this.transport.setPosition(clampedStep);
        }

        this._emit('positionUpdate', { step: clampedStep });

        return this;
    }

    /**
     * Jump to a specific bar
     * @param {number} bar - Bar number (1-indexed)
     * @returns {this}
     */
    jumpToBar(bar) {
        const stepsPerBar = 16; // Assuming 16 steps per bar
        const step = (bar - 1) * stepsPerBar;
        return this.jumpToStep(step);
    }

    /**
     * Get current position
     * @returns {number}
     */
    getCurrentPosition() {
        return this.currentPosition;
    }

    /**
     * Get loop info
     * @returns {Object}
     */
    getLoopInfo() {
        return { ...this.loopSettings };
    }

    /**
     * Get playback status
     * @returns {Object}
     */
    getPlaybackStatus() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentPosition: this.currentPosition,
            playbackMode: this.playbackMode,
            loopSettings: { ...this.loopSettings }
        };
    }

    /**
     * Add event listener
     * @param {string} event 
     * @param {Function} callback 
     */
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);
    }

    /**
     * Remove event listener
     * @param {string} event 
     * @param {Function} callback 
     */
    off(event, callback) {
        if (this._listeners.has(event)) {
            this._listeners.get(event).delete(callback);
        }
    }

    // =================== PRIVATE METHODS ===================

    /**
     * Emit event to listeners
     * @private
     */
    _emit(event, data) {
        if (this._listeners.has(event)) {
            this._listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    logger.error(NAMESPACES.AUDIO, `Listener error for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Update loop settings based on mode
     * @private
     */
    _updateLoopSettings() {
        if (!this.loopSettings.auto) {
            return;
        }

        if (this.playbackMode === 'pattern') {
            // Get pattern length from store or default
            const patternLength = this._getPatternLength();
            this.loopSettings.start = 0;
            this.loopSettings.end = patternLength;
            this.loopSettings.length = patternLength;
        } else {
            // Song mode - use arrangement length
            const songLength = this._getSongLength();
            this.loopSettings.start = 0;
            this.loopSettings.end = songLength;
            this.loopSettings.length = songLength;
        }

        if (this.transport) {
            this.transport.setLoopPoints(this.loopSettings.start, this.loopSettings.end);
        }
    }

    /**
     * Get pattern length
     * @private
     */
    _getPatternLength() {
        // Default pattern length
        return 64;
    }

    /**
     * Get song length
     * @private
     */
    _getSongLength() {
        // Default song length
        return 256;
    }

    /**
     * Start position tracking interval
     * @private
     */
    _startPositionTracking() {
        if (this._positionInterval) {
            return;
        }

        const intervalMs = 1000 / this.positionUpdateRate;

        this._positionInterval = setInterval(() => {
            if (this.transport && this.isPlaying) {
                this.currentPosition = this.transport.getCurrentStep?.() || this.currentPosition;
                this._emit('positionUpdate', {
                    step: this.currentPosition,
                    time: this.audioContext?.currentTime
                });
            }
        }, intervalMs);
    }

    /**
     * Stop position tracking interval
     * @private
     */
    _stopPositionTracking() {
        if (this._positionInterval) {
            clearInterval(this._positionInterval);
            this._positionInterval = null;
        }
    }

    /**
     * Stop all sounds immediately
     * @private
     */
    _stopAllSounds() {
        const instruments = this.engine.instruments || this.engine.instrumentService?.instruments;
        if (instruments) {
            instruments.forEach(instrument => {
                if (typeof instrument.stopAllVoices === 'function') {
                    instrument.stopAllVoices();
                } else if (typeof instrument.allNotesOff === 'function') {
                    instrument.allNotesOff();
                }
            });
        }
    }

    /**
     * Release all notes gracefully
     * @private
     */
    _releaseAllNotes() {
        const instruments = this.engine.instruments || this.engine.instrumentService?.instruments;
        if (instruments) {
            instruments.forEach(instrument => {
                if (typeof instrument.allNotesOff === 'function') {
                    instrument.allNotesOff();
                }
            });
        }
    }

    /**
     * Dispose the service
     */
    dispose() {
        this.stop();
        this._stopPositionTracking();
        this._listeners.clear();
        logger.info(NAMESPACES.AUDIO, 'PlaybackService disposed');
    }
}
