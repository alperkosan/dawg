/**
 * TransportService - Extracted from NativeAudioEngine
 * 
 * Handles all transport and playback control:
 * - Play/Stop/Pause/Resume
 * - BPM management
 * - Loop points and settings
 * - Position tracking
 * 
 * @module lib/core/services/TransportService
 */

import { logger, NAMESPACES } from '../../utils/debugLogger.js';

export class TransportService {
    /**
     * @param {NativeAudioEngine} engine - Parent audio engine
     */
    constructor(engine) {
        this.engine = engine;
    }

    /**
     * Get transport system from parent engine
     */
    get transport() {
        return this.engine.transport;
    }

    /**
     * Get playback manager from parent engine
     */
    get playbackManager() {
        return this.engine.playbackManager;
    }

    /**
     * Start playback
     * @param {number} startStep - Step to start from
     * @returns {this}
     */
    play(startStep = 0) {
        if (!this.engine.isInitialized) {
            return this;
        }
        return this.playbackManager?.play(startStep);
    }

    /**
     * Stop playback
     * @returns {this}
     */
    stop() {
        if (!this.engine.isInitialized) return this;
        return this.playbackManager?.stop();
    }

    /**
     * Pause playback
     * @returns {this}
     */
    pause() {
        if (!this.engine.isInitialized) return this;
        return this.playbackManager?.pause();
    }

    /**
     * Resume playback
     * @returns {this}
     */
    resume() {
        if (!this.engine.isInitialized) return this;
        return this.playbackManager?.resume();
    }

    /**
     * Set BPM
     * @param {number} bpm 
     * @returns {this}
     */
    setBPM(bpm) {
        if (this.transport) {
            this.transport.setBPM(bpm);
        }
        if (this.playbackManager) {
            this.playbackManager._updateLoopSettings();
        }

        // Update all instruments that support BPM
        this.engine.instrumentService?.updateBPM(bpm);

        return this;
    }

    /**
     * Get current BPM
     * @returns {number}
     */
    getBPM() {
        return this.transport?.getBPM() || 140;
    }

    /**
     * Set playback mode
     * @param {'pattern'|'song'} mode 
     * @returns {this}
     */
    setPlaybackMode(mode) {
        if (this.playbackManager) {
            this.playbackManager.setPlaybackMode(mode);
        }
        return this;
    }

    /**
     * Get current playback mode
     * @returns {'pattern'|'song'}
     */
    getPlaybackMode() {
        return this.playbackManager?.getPlaybackMode() || 'pattern';
    }

    /**
     * Set loop points
     * @param {number} startStep 
     * @param {number} endStep 
     * @returns {this}
     */
    setLoopPoints(startStep, endStep) {
        if (this.playbackManager) {
            this.playbackManager.setLoopPoints(startStep, endStep);
        }
        return this;
    }

    /**
     * Enable auto loop
     * @returns {this}
     */
    enableAutoLoop() {
        if (this.playbackManager) {
            this.playbackManager.enableAutoLoop();
        }
        return this;
    }

    /**
     * Set loop enabled state
     * @param {boolean} enabled 
     * @returns {this}
     */
    setLoopEnabled(enabled) {
        if (this.playbackManager) {
            this.playbackManager.setLoopEnabled(enabled);
        }
        return this;
    }

    /**
     * Jump to a specific step
     * @param {number} step 
     * @returns {this}
     */
    jumpToStep(step) {
        if (this.playbackManager) {
            this.playbackManager.jumpToStep(step);
        }
        return this;
    }

    /**
     * Jump to a specific bar
     * @param {number} bar 
     * @returns {this}
     */
    jumpToBar(bar) {
        if (this.playbackManager) {
            this.playbackManager.jumpToBar(bar);
        }
        return this;
    }

    /**
     * Get current position
     * @returns {number}
     */
    getCurrentPosition() {
        return this.playbackManager?.getCurrentPosition() || 0;
    }

    /**
     * Get loop info
     * @returns {Object}
     */
    getLoopInfo() {
        return this.playbackManager?.getLoopInfo() || {
            start: 0,
            end: 64,
            length: 64,
            enabled: true,
            auto: true
        };
    }

    /**
     * Check if currently playing
     * @returns {boolean}
     */
    get isPlaying() {
        return this.playbackManager?.isPlaying || false;
    }

    /**
     * Set active pattern
     * @param {string} patternId 
     * @returns {this}
     */
    setActivePattern(patternId) {
        this.engine.activePatternId = patternId;

        if (this.playbackManager) {
            this.playbackManager.activePatternId = patternId;
            this.playbackManager._updateLoopSettings();
        }

        // Reschedule if playing
        if (this.playbackManager?.isPlaying) {
            this.engine.schedulePattern();
        }

        return this;
    }

    /**
     * Schedule pattern for playback
     * @param {Object|null} patternData 
     */
    schedulePattern(patternData = null) {
        if (!this.playbackManager) return;
        this.playbackManager._scheduleContent(null, 'pattern-schedule', false);
    }
}
