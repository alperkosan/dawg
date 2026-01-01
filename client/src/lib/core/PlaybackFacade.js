/**
 * PlaybackFacade - Thin Orchestrator for Playback Operations
 * 
 * This facade delegates playback operations to specialized services,
 * replacing the monolithic Play BackManager (3,282 lines → ~150 lines facade + services).
 * 
 * Architecture:
 * ┌────────────────────────────────────────────────────────┐
 * │                  PlaybackFacade                         │
 * │              (Thin Orchestrator - ~150 lines)           │
 * │  ┌──────────────────┬──────────────────────────────┐   │
 * │  │  PlaybackService │    SchedulerService          │   │
 * │  │  (503 lines)     │    (387 lines)               │   │
 * │  │  - play/stop     │    - note scheduling         │   │
 * │  │  - pause/resume  │    - pattern scheduling      │   │
 * │  │  - BPM control   │    - loop handling           │   │
 * │  └──────────────────┴──────────────────────────────┘   │
 * └────────────────────────────────────────────────────────┘
 * 
 * Benefits:
 * - Reduced complexity (3,282 → 890 lines total)
 * - Better testability (isolated services)
 * - Easier maintenance (single responsibility)
 * 
 * @module lib/core/PlaybackFacade
 */

// ✅ FIX: Correct import paths - services are in ./services/ (same directory as NativeAudioEngineFacade)
import { PlaybackService } from './services/PlaybackService.js';
import { SchedulerService } from './services/SchedulerService.js';
import { logger, NAMESPACES } from '../utils/debugLogger.js';

export class PlaybackFacade {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;

        // Initialize services
        this._playbackService = new PlaybackService(audioEngine);
        this._schedulerService = new SchedulerService(audioEngine);

        // Link services together
        this._playbackService.schedulerService = this._schedulerService;
        this._schedulerService.playbackService = this._playbackService;

        logger.debug(NAMESPACES.AUDIO, 'PlaybackFacade created');
    }

    // =================== PLAYBACK CONTROL (Delegated to PlaybackService) ===================

    /**
     * Start playback
     * @param {number} startStep - Starting step position (null = use current position)
     * @returns {Promise<void>}
     */
    async play(startStep = null) {
        return this._playbackService.play(startStep);
    }

    /**
     * Stop playback
     * @returns {Promise<void>}
     */
    async stop() {
        return this._playbackService.stop();
    }

    /**
     * Pause playback
     * @returns {Promise<void>}
     */
    async pause() {
        return this._playbackService.pause();
    }

    /**
     * Resume playback
     * @returns {Promise<void>}
     */
    async resume() {
        return this._playbackService.resume();
    }

    /**
     * Set BPM
     * @param {number} bpm - Beats per minute
     */
    setBPM(bpm) {
        this._playbackService.setBPM(bpm);
    }

    /**
     * Set playback mode (pattern/song)
     * @param {string} mode - 'pattern' or 'song'
     */
    setPlaybackMode(mode) {
        this._playbackService.setPlaybackMode(mode);
    }

    /**
     * Get current playback mode
     * @returns {string}
     */
    getPlaybackMode() {
        return this._playbackService.getPlaybackMode();
    }

    // =================== POSITION CONTROL ===================

    /**
     * Jump to specific step
     * @param {number} step - Target step position
     */
    jumpToStep(step) {
        this._playbackService.jumpToStep(step);
    }

    /**
     * Jump to specific bar
     * @param {number} bar - Target bar number
     */
    jumpToBar(bar) {
        this._playbackService.jumpToBar(bar);
    }

    /**
     * Get current playback position
     * @returns {number}
     */
    getCurrentPosition() {
        return this._playbackService.getCurrentPosition();
    }

    // =================== LOOP CONTROL ===================

    /**
     * Set loop points
     * @param {number} startStep - Loop start step
     * @param {number} endStep - Loop end step
     */
    setLoopPoints(startStep, endStep) {
        this._playbackService.setLoopPoints(startStep, endStep);
    }

    /**
     * Enable/disable looping
     * @param {boolean} enabled - Loop enabled state
     */
    setLoopEnabled(enabled) {
        this._playbackService.setLoopEnabled(enabled);
    }

    /**
     * Enable auto-loop (calculate loop points from content)
     */
    enableAutoLoop() {
        this._playbackService.enableAutoLoop();
    }

    /**
     * Get loop information
     * @returns {Object} Loop configuration
     */
    getLoopInfo() {
        return this._playbackService.getLoopInfo();
    }

    // =================== SCHEDULING (Delegated to SchedulerService) ===================

    /**
     * Schedule a pattern for playback
     * @param {Object} patternData - Pattern data to schedule
     */
    schedulePattern(patternData) {
        return this._schedulerService.schedulePattern(patternData);
    }

    /**
     * Reschedule content (e.g., after pattern change)
     * @param {string} reason - Reason for rescheduling (for debugging)
     */
    reschedule(reason = 'manual') {
        return this._schedulerService.reschedule(reason);
    }

    /**
     * Clear all scheduled notes
     */
    clearSchedule() {
        return this._schedulerService.clearSchedule();
    }

    // =================== EVENT HANDLING ===================

    /**
     * Register event listener
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     */
    on(event, callback) {
        this._playbackService.on(event, callback);
    }

    /**
     * Unregister event listener
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     */
    off(event, callback) {
        this._playbackService.off(event, callback);
    }

    // =================== SERVICE ACCESS (for advanced use) ===================

    /**
     * Get the underlying PlaybackService
     * @returns {PlaybackService}
     */
    getPlaybackService() {
        return this._playbackService;
    }

    /**
     * Get the underlying SchedulerService
     * @returns {SchedulerService}
     */
    getSchedulerService() {
        return this._schedulerService;
    }

    // =================== LEGACY COMPATIBILITY ===================

    /**
     * Check if currently playing
     * @returns {boolean}
     */
    get isPlaying() {
        return this._playbackService.isPlaying;
    }

    /**
     * Get current playback state
     * @returns {string}
     */
    get playbackState() {
        return this._playbackService.playbackState;
    }

    /**
     * Get active pattern ID (for backward compatibility)
     * @returns {string|null}
     */
    get activePatternId() {
        return this._playbackService.activePatternId;
    }

    /**
     * Set active pattern ID (for backward compatibility)
     * @param {string} patternId - Pattern ID
     */
    set activePatternId(patternId) {
        this._playbackService.activePatternId = patternId;
    }

    // =================== CLEANUP ===================

    /**
     * Dispose of facade and all services
     */
    dispose() {
        logger.info(NAMESPACES.AUDIO, '🧹 Disposing PlaybackFacade...');

        this._playbackService.dispose?.();
        this._schedulerService.dispose?.();

        this._playbackService = null;
        this._schedulerService = null;

        logger.info(NAMESPACES.AUDIO, '✅ PlaybackFacade disposed');
    }
}

/**
 * Factory function for creating PlaybackFacade
 * @param {Object} audioEngine - Audio engine instance
 * @returns {PlaybackFacade}
 */
export function createPlaybackFacade(audioEngine) {
    return new PlaybackFacade(audioEngine);
}
