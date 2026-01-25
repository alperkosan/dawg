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
import EventBus from '../EventBus.js';
import { PlaybackServiceAdapter } from './PlaybackServiceAdapter.js';
import { initSchedulerDiagnostics } from '../scheduling/SchedulerDiagnostics.js';

export class PlaybackService {
    /**
     * @param {NativeAudioEngine} engine - Parent audio engine
     */
    constructor(engine) {
        this.engine = engine;

        // ✅ UNIFIED TRANSPORT: isPlaying/isPaused now delegated to transport (SAB)
        // Local fields are fallbacks only
        this._fallbackIsPlaying = false;
        this._fallbackIsPaused = false;
        // ✅ CRITICAL FIX: Position now reads from Transport (Single Source of Truth)
        this._currentPosition = 0; // Backing field for fallback only
        this.startTime = 0;

        // ✅ SCHEDULER SERVICE: Backing field (can be set by PlaybackFacade or use engine's lazy getter)
        this._schedulerService = null;

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

        // ✅ PHASE 0 FIX: Tick-based loop restart deduplication
        this._lastHandledLoopTick = -1; // Track last handled loop boundary tick

        // Position update rate
        this.positionUpdateRate = 60; // Hz
        this._positionInterval = null;

        // ✅ PHASE 2.2: Scheduling optimizer for debounced scheduling
        this.schedulingOptimizer = this.engine.schedulingOptimizer;

        // Event listeners
        this._listeners = new Map();

        // ✅ LIVE NOTE SCHEDULING: Bind global events for immediate note scheduling
        this._bindGlobalEvents();

        // ===== NEW: CONTINUOUS SCHEDULER ADAPTER =====
        // Will be initialized by PlaybackFacade after schedulerService is set
        this.schedulerAdapter = null;

        // ===== DIAGNOSTICS =====
        // Will be initialized after schedulerAdapter is set
        this._diagnosticsInitialized = false;
    }

    /**
     * Initialize ContinuousScheduler adapter
     * Called by PlaybackFacade after schedulerService is set
     */
    initializeSchedulerAdapter() {
        if (this.schedulerAdapter) {
            console.warn('⚠️ [PlaybackService] SchedulerAdapter already initialized');
            return;
        }

        this.schedulerAdapter = new PlaybackServiceAdapter(this);
        console.log('✨ [PlaybackService] ContinuousScheduler adapter initialized');

        // Initialize diagnostics after adapter is ready
        if (!this._diagnosticsInitialized) {
            initSchedulerDiagnostics(this);
            this._diagnosticsInitialized = true;
        }
    }

    // ✅ UNIFIED TRANSPORT: SAB-backed getters (delegate to NativeTransportSystem)
    get isPlaying() {
        return this.transport?.isPlaying ?? this._fallbackIsPlaying;
    }

    set isPlaying(value) {
        this._fallbackIsPlaying = value;
    }

    get isPaused() {
        return this.transport?.isPaused ?? this._fallbackIsPaused;
    }

    set isPaused(value) {
        this._fallbackIsPaused = value;
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
     * Get scheduler service (from backing field or parent engine)
     * @returns {SchedulerService}
     */
    get schedulerService() {
        // Check backing field first (set by PlaybackFacade)
        if (this._schedulerService) {
            return this._schedulerService;
        }
        // Fallback to engine's lazy getter
        return this.engine.schedulerService;
    }

    /**
     * Set scheduler service (used by PlaybackFacade)
     * @param {SchedulerService} value
     */
    set schedulerService(value) {
        this._schedulerService = value;
    }

    /**
     * Start playback
     * @param {number} startStep - Step to start from (null = use current position)
     * @returns {Promise<this>}
     */
    async play(startStep = null) {
        if (!this.engine.isInitialized) {
            logger.warn(NAMESPACES.AUDIO, 'Cannot play: engine not initialized');
            return this;
        }

        // ✅ FIX: Removed the isPaused check that was causing resume to start from 0
        // TransportController.togglePlayPause() already handles pause/resume detection
        // Having a second check here caused race conditions with SAB state

        try {
            // ✅ PHASE 1.1: Update loop settings before playback
            this._updateLoopSettings();

            // ✅ PHASE 1.3: Improved position management
            let playPosition = this.currentPosition;

            if (startStep !== null) {
                // Explicit position: jump to requested step
                playPosition = startStep;
                this._jumpToStep(startStep);
            } else {
                // Use current position (may have been set by timeline click)
                playPosition = this.currentPosition;
            }

            this.startTime = this.audioContext.currentTime;
            // ✅ UNIFIED: State now comes from SAB via getters
            this._fallbackIsPlaying = true;
            this._fallbackIsPaused = false;

            // ✅ CRITICAL: Prevent idle mode during playback
            idleDetector.setPlaying(true);

            // ✅ PHASE 1.4: Resume AudioContext if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
                logger.debug(NAMESPACES.AUDIO, 'AudioContext resumed for playback');
                await new Promise(resolve => setTimeout(resolve, 5)); // 5ms stability delay
            }

            // ✅ PHASE 1.2: Calculate ADC pre-delay for plugin latency compensation
            const maxLatency = this.engine.latencyCompensator?.getMaxLatencySeconds() || 0;
            const safetyBuffer = this._calculateAdaptiveSafetyBuffer(); // ✅ OPT #1: Adaptive buffer
            const startDelay = Math.max(0.010, maxLatency + safetyBuffer); // Min 10ms
            const adjustedStartTime = this.audioContext.currentTime + startDelay;

            logger.debug(NAMESPACES.AUDIO, 'ADC pre-delay:', {
                latency: maxLatency.toFixed(3),
                preDelay: startDelay.toFixed(3),
                startTime: adjustedStartTime.toFixed(3)
            });

            // Start transport with adjusted time
            if (this.transport) {
                // ✅ FIX #2: Always re-register loop listener (remove singleton pattern)
                // This ensures listener survives AudioContext suspend/resume cycles
                this.transport.off('loop', this._handleLoopRestart); // Clean old listener
                this.transport.on('loop', this._handleLoopRestart.bind(this));
                logger.debug(NAMESPACES.AUDIO, '✅ Loop restart listener registered');

                this.transport.start(adjustedStartTime);

                // ✅ Set position AFTER start() to override any transport reset
                if (this.transport.setPosition) {
                    this.transport.setPosition(playPosition);
                }
            }

            // ✅ CRITICAL FIX: Schedule notes for playback
            // This was missing - PlaybackManager calls _scheduleContent() but facade didn't

            // ✅ CRITICAL: Skip old scheduling if ContinuousScheduler is active
            if (this.schedulerAdapter?.useContinuousScheduler) {
                // ContinuousScheduler handles ALL scheduling
                // Old SchedulerService is only used for event execution (started by adapter)
                logger.info(NAMESPACES.AUDIO, '✅ ContinuousScheduler active - skipping old pattern scheduling');
            } else if (this.schedulerService) {
                // OLD SYSTEM: Only runs if ContinuousScheduler is disabled
                logger.info(NAMESPACES.AUDIO, '🎵 Scheduling notes for playback...');
                try {
                    // ✅ CRITICAL: Start the scheduler tick loop
                    // This processes scheduled events in the lookahead window
                    this.schedulerService.start();

                    // Get active pattern/arrangement from store
                    const { useArrangementStore } = await import('@/store/useArrangementStore');
                    const arrangementStore = useArrangementStore.getState();
                    const currentBPM = this.engine.transport?.bpm || 120;

                    // ✅ PHASE 3: Detect pattern vs song mode
                    const currentMode = this.playbackMode || 'pattern';

                    if (currentMode === 'song') {
                        // ✅ PHASE 3: Song/arrangement mode
                        const arrangementClips = arrangementStore.arrangementClips || [];
                        const arrangementTracks = arrangementStore.arrangementTracks || [];
                        const patterns = arrangementStore.patterns || {};

                        if (arrangementClips.length > 0) {
                            const songData = {
                                clips: arrangementClips,
                                tracks: arrangementTracks,
                                patterns: patterns
                            };

                            await this.schedulerService.scheduleSong(
                                songData,
                                adjustedStartTime,
                                currentBPM
                            );
                            logger.info(NAMESPACES.AUDIO, `✅ Scheduled ${arrangementClips.length} clips for song mode`);
                        } else {
                            logger.warn(NAMESPACES.AUDIO, '⚠️ No clips in arrangement');
                        }
                    } else {
                        // Pattern mode (default)
                        const activePatternId = arrangementStore.activePatternId;
                        const activePattern = arrangementStore.patterns[activePatternId];

                        if (activePattern && activePattern.data) {
                            // ✅ DEBUG: Log the actual playPosition value and its source
                            logger.debug(NAMESPACES.AUDIO, `🔍 DEBUG play() - playPosition analysis:`, {
                                playPosition,
                                currentPosition: this.currentPosition,
                                transportStep: this.transport?.getCurrentStep?.(),
                                expectedStepsAt0_3375beats: 0.3375 * 4, // Should be 1.35
                                expectedStepsAt1_7375beats: 1.7375 * 4  // Should be 6.95
                            });

                            // ✅ FIX: Pass playPosition to skip notes before current position
                            // This ensures resume plays from the correct step, not from step 0
                            this.schedulerService.schedulePattern(
                                activePatternId,
                                activePattern,
                                adjustedStartTime,  // ✅ Use adjusted time for latency compensation
                                currentBPM,
                                playPosition        // ✅ NEW: Pass current step to filter notes
                            );
                            logger.info(NAMESPACES.AUDIO, `✅ Scheduled pattern ${activePatternId} for playback from step ${playPosition}`);
                        } else {
                            logger.warn(NAMESPACES.AUDIO, '⚠️ No active pattern to schedule');
                        }
                    }
                } catch (error) {
                    logger.error(NAMESPACES.AUDIO, 'Failed to schedule notes:', error);
                }
            } // END: Old scheduling system

            // Start position tracking
            this._startPositionTracking();

            // ===== NEW: START CONTINUOUS SCHEDULER =====
            if (this.schedulerAdapter) {
                this.schedulerAdapter.onPlayStart();
            }

            // Emit event
            this._emit('play', { startStep: playPosition, time: this.startTime });

            logger.info(NAMESPACES.AUDIO, `Playback started at step ${playPosition} (mode: ${this.playbackMode || 'pattern'})`);
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
            // ✅ CRITICAL: Stop scheduler FIRST to prevent new notes
            if (this.schedulerService) {
                this.schedulerService.stop();
                logger.debug(NAMESPACES.AUDIO, 'Scheduler stopped on stop()');
            }

            // Stop transport
            if (this.transport) {
                this.transport.stop();

                // ✅ FIX #2: Cleanup loop listener on stop
                this.transport.off('loop', this._handleLoopRestart);
            }

            // Release all notes gracefully
            this._releaseAllNotes();

            // Stop all instrument sounds
            this._stopAllSounds();

            // Reset state
            // ✅ UNIFIED: State now comes from SAB via getters
            this._fallbackIsPlaying = false;
            this._fallbackIsPaused = false;
            this.currentPosition = 0;

            // ✅ CRITICAL: Re-enable idle detection
            idleDetector.setPlaying(false);

            // Stop position tracking
            this._stopPositionTracking();

            // ===== NEW: STOP CONTINUOUS SCHEDULER =====
            if (this.schedulerAdapter) {
                this.schedulerAdapter.onPlayStop();
            }

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

            // Stop scheduler to prevent notes from continuing
            if (this.schedulerService) {
                this.schedulerService.stop();
                logger.debug(NAMESPACES.AUDIO, 'Scheduler stopped on pause');
            }

            // Release all notes gracefully
            this._releaseAllNotes();

            // ✅ UNIFIED: State now comes from SAB via getters
            this._fallbackIsPlaying = false;
            this._fallbackIsPaused = true;

            // ===== NEW: PAUSE CONTINUOUS SCHEDULER =====
            if (this.schedulerAdapter) {
                this.schedulerAdapter.onPlayPause();
            }

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
    async resume() {
        if (!this.isPaused) {
            return this;
        }

        try {
            // ✅ Update loop settings
            await this._updateLoopSettings();

            const resumePosition = this.currentPosition;

            // ✅ Calculate ADC pre-delay for latency compensation
            const maxLatency = this.engine.latencyCompensator?.getMaxLatencySeconds() || 0;
            const safetyBuffer = this._calculateAdaptiveSafetyBuffer(); // ✅ OPT #1: Adaptive buffer
            const startDelay = Math.max(0.010, maxLatency + safetyBuffer);
            const adjustedStartTime = this.audioContext.currentTime + startDelay;

            // Resume transport
            if (this.transport) {
                this.transport.start(adjustedStartTime);
                if (this.transport.setPosition) {
                    this.transport.setPosition(resumePosition);
                }
            }

            // ✅ UNIFIED: State now comes from SAB via getters
            this._fallbackIsPlaying = true;
            this._fallbackIsPaused = false;
            this.startTime = this.audioContext.currentTime;

            // ✅ CRITICAL: Start scheduler and reschedule notes from current position
            if (this.schedulerService) {
                logger.info(NAMESPACES.AUDIO, '🎵 Rescheduling notes after resume...');

                // ✅ FIX: Clear all previously scheduled events before rescheduling
                // Without this, events stack up after each pause/resume cycle
                this.schedulerService.cancelAll();

                this.schedulerService.start();

                const { useArrangementStore } = await import('@/store/useArrangementStore');
                const arrangementStore = useArrangementStore.getState();
                const currentBPM = this.engine.transport?.bpm || 120;
                const currentMode = this.playbackMode || 'pattern';

                if (currentMode === 'song') {
                    // Song mode
                    const arrangementClips = arrangementStore.arrangementClips || [];
                    const arrangementTracks = arrangementStore.arrangementTracks || [];
                    const patterns = arrangementStore.patterns || {};

                    if (arrangementClips.length > 0) {
                        const songData = {
                            clips: arrangementClips,
                            tracks: arrangementTracks,
                            patterns: patterns
                        };

                        await this.schedulerService.scheduleSong(
                            songData,
                            adjustedStartTime,
                            currentBPM
                        );
                        logger.info(NAMESPACES.AUDIO, `✅ Rescheduled song for resume`);
                    }
                } else {
                    // Pattern mode
                    const activePatternId = arrangementStore.activePatternId;
                    const activePattern = arrangementStore.patterns[activePatternId];

                    if (activePattern && activePattern.data) {
                        // ✅ DEBUG: Log the actual resumePosition value and its source
                        logger.debug(NAMESPACES.AUDIO, `🔍 DEBUG resume() - resumePosition analysis:`, {
                            resumePosition,
                            currentPosition: this.currentPosition,
                            transportStep: this.transport?.getCurrentStep?.(),
                            expectedStepsAt0_3375beats: 0.3375 * 4, // Should be 1.35
                            expectedStepsAt1_7375beats: 1.7375 * 4  // Should be 6.95
                        });

                        // ✅ FIX: Pass resumePosition to skip notes before current position
                        this.schedulerService.schedulePattern(
                            activePatternId,
                            activePattern,
                            adjustedStartTime,
                            currentBPM,
                            resumePosition  // ✅ Pass current step to filter already-played notes
                        );
                        logger.info(NAMESPACES.AUDIO, `✅ Rescheduled pattern ${activePatternId} for resume from step ${resumePosition}`);
                    }
                }
            }

            // Restart position tracking
            this._startPositionTracking();

            // ===== NEW: RESUME CONTINUOUS SCHEDULER =====
            if (this.schedulerAdapter) {
                this.schedulerAdapter.onPlayResume();
            }

            // Emit event
            this._emit('resume', { position: resumePosition });

            logger.info(NAMESPACES.AUDIO, `Playback resumed from position ${resumePosition}`);
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
            this.transport.setLoopEnabled(enabled);
        }

        this._emit('loopChange', { ...this.loopSettings });

        return this;
    }

    /**
     * Set BPM (Beats Per Minute)
     * @param {number} bpm - Beats per minute
     * @returns {this}
     */
    setBPM(bpm) {
        logger.info(NAMESPACES.AUDIO, `🎵 PlaybackService.setBPM(${bpm}) called`);

        if (this.transport) {
            this.transport.setBPM(bpm);
        }

        this._emit('bpmChange', { bpm });
        logger.info(NAMESPACES.AUDIO, `BPM set to ${bpm}`);

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
    async jumpToStep(step) {
        const clampedStep = Math.max(0, step);
        this.currentPosition = clampedStep;

        if (this.transport) {
            this.transport.setPosition(clampedStep);
        }

        // ✅ FIX: If playing, reschedule notes from the new position
        // Otherwise audio continues from old position while playhead shows new position
        if (this.isPlaying && this.schedulerService) {
            logger.info(NAMESPACES.AUDIO, `🔄 Rescheduling notes after jump to step ${clampedStep}`);

            // Cancel all current scheduled notes
            this.schedulerService.cancelAll();

            // Calculate adjusted start time for new position
            const maxLatency = this.engine.latencyCompensator?.getMaxLatencySeconds() || 0;
            const safetyBuffer = 0.050;
            const startDelay = Math.max(0.010, maxLatency + safetyBuffer);
            const adjustedStartTime = this.audioContext.currentTime + startDelay;

            const { useArrangementStore } = await import('@/store/useArrangementStore');
            const arrangementStore = useArrangementStore.getState();
            const currentBPM = this.engine.transport?.bpm || 120;
            const currentMode = this.playbackMode || 'pattern';

            if (currentMode === 'song') {
                // Song mode - reschedule song from new position
                const arrangementClips = arrangementStore.arrangementClips || [];
                const arrangementTracks = arrangementStore.arrangementTracks || [];
                const patterns = arrangementStore.patterns || {};

                if (arrangementClips.length > 0) {
                    const songData = {
                        clips: arrangementClips,
                        tracks: arrangementTracks,
                        patterns: patterns
                    };

                    await this.schedulerService.scheduleSong(
                        songData,
                        adjustedStartTime,
                        currentBPM
                    );
                    logger.info(NAMESPACES.AUDIO, `✅ Rescheduled song from step ${clampedStep}`);
                }
            } else {
                // Pattern mode - reschedule pattern from new position
                const activePatternId = arrangementStore.activePatternId;
                const activePattern = arrangementStore.patterns[activePatternId];

                if (activePattern && activePattern.data) {
                    this.schedulerService.schedulePattern(
                        activePatternId,
                        activePattern,
                        adjustedStartTime,
                        currentBPM,
                        clampedStep  // ✅ Pass new position to skip already-played notes
                    );
                    logger.info(NAMESPACES.AUDIO, `✅ Rescheduled pattern ${activePatternId} from step ${clampedStep}`);
                }
            }
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
     * ✅ OPTIMIZATION #1: Calculate adaptive safety buffer based on BPM
     * Higher BPM = tighter timing = smaller buffer
     * @returns {number} Safety buffer in seconds
     * @private
     */
    _calculateAdaptiveSafetyBuffer() {
        const currentBPM = this.engine.transport?.bpm || 120;

        // BPM factor: normalize to 120 BPM baseline
        // 60 BPM → 2.0x buffer
        // 120 BPM → 1.0x buffer  
        // 240 BPM → 0.5x buffer
        const bpmFactor = Math.max(0.5, Math.min(2.0, 120 / currentBPM));

        // Base buffer: 30ms @ 120 BPM
        // Range: 15ms @ 240+ BPM to 60ms @ 60 BPM
        const baseBuffer = 0.030; // 30ms
        const adaptiveBuffer = baseBuffer * bpmFactor;

        logger.debug(NAMESPACES.AUDIO,
            `Adaptive safety buffer: ${(adaptiveBuffer * 1000).toFixed(1)}ms @ ${currentBPM} BPM`
        );

        return adaptiveBuffer;
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
     * Update loop settings from store
     * @private
     */
    async _updateLoopSettings() {
        if (!this.transport) return;

        try {
            const { useArrangementStore } = await import('@/store/useArrangementStore');
            const { loopEnabled, loopStart, loopEnd } = useArrangementStore.getState();

            this.transport.setLoopEnabled(loopEnabled);
            if (loopEnabled) {
                this.transport.setLoopPoints(loopStart, loopEnd);
                logger.debug(NAMESPACES.AUDIO, `Loop settings updated: ${loopStart}-${loopEnd}`);
            }
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, 'Failed to update loop settings:', error);
        }
    }

    /**
     * Handle loop restart event from transport
     * Reschedules the pattern from the loop start position
     * @private
     * @param {Object} event - Loop event data {fromTick, toTick, time, nextLoopStartTime}
     */
    async _handleLoopRestart(event) {
        // ===== NEW: NOTIFY CONTINUOUS SCHEDULER (NATURAL HANDLING) =====
        // With ContinuousScheduler, loop restart is automatic - it detects position jump
        // This hook is informational only, no reschedule needed
        if (this.schedulerAdapter) {
            this.schedulerAdapter.onLoopRestart(event);

            // ✅ CRITICAL: If ContinuousScheduler is enabled, SKIP old reschedule logic
            // ContinuousScheduler handles loop restart naturally via position jump detection
            if (this.schedulerAdapter.useContinuousScheduler) {
                console.log('✅ [PlaybackService] Loop restart handled by ContinuousScheduler (skipping old reschedule)');
                return; // Early exit - don't run old reschedule code
            }
        }

        if (!this.isPlaying || !this.schedulerService) {
            return;
        }

        // ✅ PHASE 0 FIX: Tick-based deduplication instead of timeout-based debounce
        // Loop boundary is identified by tick position, not time
        // Multiple listeners/cascade calls for SAME tick = duplicate, reject immediately
        const currentLoopTick = event?.fromTick ?? this.engine?.transport?.currentTick ?? 0;

        if (this._lastHandledLoopTick === currentLoopTick) {
            // Silent skip - already handled this exact loop boundary
            // No log spam, this is expected behavior when multiple listeners cascade
            return;
        }
        this._lastHandledLoopTick = currentLoopTick;

        const loopStartTimestamp = performance.now();
        console.log(`\n🎬 [LOOP RESTART START] @ ${loopStartTimestamp.toFixed(1)}ms`);

        try {
            logger.debug(NAMESPACES.AUDIO, '🔁 Loop restart detected - rescheduling pattern');

            // ✅ FIX #1: Clear active note tracking BEFORE cancelAll
            // This prevents false-positive overlap detection in next iteration
            // Try multiple paths to find noteScheduler instance
            const noteScheduler =
                this.engine?.noteScheduler ||              // Direct engine reference
                this.engine?.playbackManager?.noteScheduler || // Via PlaybackManager
                this.schedulerService?.noteScheduler;       // Via SchedulerService

            if (noteScheduler && typeof noteScheduler.clearActiveNotes === 'function') {
                noteScheduler.clearActiveNotes();
                logger.debug(NAMESPACES.AUDIO, '🧹 Active note map cleared for loop restart');
            } else {
                logger.warn(NAMESPACES.AUDIO, '⚠️ Could not find noteScheduler to clear active notes');
            }

            // Cancel all currently scheduled events (they're from the previous loop)
            this.schedulerService.cancelAll();

            // Calculate time for new loop iteration
            const maxLatency = this.engine.latencyCompensator?.getMaxLatencySeconds() || 0;
            const adaptiveBuffer = this._calculateAdaptiveSafetyBuffer();

            // ✅ FIX: Loop restart needs minimum 20ms buffer to prevent first note lag
            // Adaptive buffer can be too small (15ms @ 240 BPM) for loop restart reschedule
            const safetyBuffer = Math.max(0.020, adaptiveBuffer); // Min 20ms for loop restart
            const startDelay = Math.max(0.010, maxLatency + safetyBuffer);
            const adjustedStartTime = this.audioContext.currentTime + startDelay;

            console.log(`⏱️ [LOOP TIMING] Buffer: ${(safetyBuffer * 1000).toFixed(1)}ms, Delay: ${(startDelay * 1000).toFixed(1)}ms, StartTime: ${adjustedStartTime.toFixed(3)}s`);

            // Get pattern data
            const { useArrangementStore } = await import('@/store/useArrangementStore');
            const arrangementStore = useArrangementStore.getState();
            const currentBPM = this.engine.transport?.bpm || 120;
            const currentMode = this.playbackMode || 'pattern';

            if (currentMode === 'song') {
                // Song mode
                const arrangementClips = arrangementStore.arrangementClips || [];
                const arrangementTracks = arrangementStore.arrangementTracks || [];
                const patterns = arrangementStore.patterns || {};

                if (arrangementClips.length > 0) {
                    const songData = {
                        clips: arrangementClips,
                        tracks: arrangementTracks,
                        patterns: patterns
                    };

                    await this.schedulerService.scheduleSong(
                        songData,
                        adjustedStartTime,
                        currentBPM
                    );
                    logger.debug(NAMESPACES.AUDIO, '✅ Rescheduled song for loop restart');
                }
            } else {
                // Pattern mode
                const activePatternId = arrangementStore.activePatternId;
                const activePattern = arrangementStore.patterns[activePatternId];

                if (activePattern && activePattern.data) {
                    // Reschedule from loop start (step 0 of the loop)
                    this.schedulerService.schedulePattern(
                        activePatternId,
                        activePattern,
                        adjustedStartTime,
                        currentBPM,
                        0  // Start from beginning of loop
                    );
                    logger.debug(NAMESPACES.AUDIO, `✅ Rescheduled pattern ${activePatternId} for loop restart`);
                }
            }
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, 'Failed to reschedule on loop restart:', error);
            console.error('❌ [LOOP RESTART ERROR]', error);
        } finally {
            // ✅ PHASE 0 FIX: No timeout needed with tick-based deduplication
            const loopEndTimestamp = performance.now();
            const duration = loopEndTimestamp - loopStartTimestamp;
            console.log(`✅ [LOOP RESTART END] Tick ${currentLoopTick.toFixed(1)}, Duration: ${duration.toFixed(1)}ms\n`);
        }
    }

    /**
     * Jump to specific step
     * @param {number} step - Step to jump to
     * @private
     */
    _jumpToStep(step) {
        this.currentPosition = step;
        if (this.transport && this.transport.setPosition) {
            this.transport.setPosition(step);
        }
        this._emit('positionChange', { position: step });
        logger.debug(NAMESPACES.AUDIO, `Jumped to step ${step}`);
    }

    /**
     * Dispose the service
     */
    dispose() {
        this.stop();
        this._stopPositionTracking();
        this._unbindGlobalEvents();

        // ✅ FIX #2: Cleanup loop listener on dispose
        if (this.transport) {
            this.transport.off('loop', this._handleLoopRestart);
        }

        this._listeners.clear();
        logger.info(NAMESPACES.AUDIO, 'PlaybackService disposed');
    }

    // =================== LIVE NOTE SCHEDULING ===================

    /**
     * Bind global EventBus events for live note scheduling
     * @private
     */
    _bindGlobalEvents() {
        // Store bound handlers for cleanup
        this._boundHandlers = {
            noteAdded: this._handleNoteAdded.bind(this),
            notesAdded: this._handleNotesAdded.bind(this), // ✅ FIX: Bind the bulk handler
            noteRemoved: this._handleNoteRemoved.bind(this),
            noteModified: this._handleNoteModified.bind(this),
            bpmChanged: this._handleBpmChange.bind(this) // ✅ NEW: BPM change handler
        };

        EventBus.on('NOTE_ADDED', this._boundHandlers.noteAdded);
        EventBus.on('NOTES_ADDED', this._boundHandlers.notesAdded); // ✅ NEW: Bulk handler
        EventBus.on('NOTE_REMOVED', this._boundHandlers.noteRemoved);
        EventBus.on('NOTE_MODIFIED', this._boundHandlers.noteModified);
        EventBus.on('transport:bpmChanged', this._boundHandlers.bpmChanged); // ✅ NEW: BPM sync

        logger.debug(NAMESPACES.AUDIO, '✅ PlaybackService: Global event handlers bound');
    }

    /**
     * Unbind global EventBus events
     * @private
     */
    _unbindGlobalEvents() {
        if (this._boundHandlers) {
            EventBus.off('NOTE_ADDED', this._boundHandlers.noteAdded);
            EventBus.off('NOTES_ADDED', this._boundHandlers.notesAdded);
            EventBus.off('NOTE_REMOVED', this._boundHandlers.noteRemoved);
            EventBus.off('NOTE_MODIFIED', this._boundHandlers.noteModified);
            EventBus.off('transport:bpmChanged', this._boundHandlers.bpmChanged);
            this._boundHandlers = null;
        }
    }

    /**
     * Handle BPM change during playback
     * Reschedules notes with new tempo timing
     * @param {Object} data - { bpm, oldBpm }
     * @private
     */
    async _handleBpmChange(data) {
        const { bpm, oldBpm } = data;

        // Only reschedule if actively playing
        if (!this.isPlaying || this.isPaused || !this.schedulerService) {
            logger.debug(NAMESPACES.AUDIO, `⏱️ BPM changed ${oldBpm} → ${bpm} (not playing, skip reschedule)`);
            return;
        }

        // Debounce rapid BPM changes
        if (this._isHandlingBpmChange) {
            logger.debug(NAMESPACES.AUDIO, '⚠️ BPM change ignored (already handling)');
            return;
        }
        this._isHandlingBpmChange = true;

        try {
            logger.info(NAMESPACES.AUDIO, `⏱️ BPM changed ${oldBpm} → ${bpm} - rescheduling notes`);

            // Cancel all currently scheduled events (they use old BPM timing)
            this.schedulerService.cancelAll();

            // Calculate adjusted start time
            const maxLatency = this.engine.latencyCompensator?.getMaxLatencySeconds() || 0;
            const safetyBuffer = 0.010; // 10ms buffer
            const startDelay = Math.max(0.010, maxLatency + safetyBuffer);
            const adjustedStartTime = this.audioContext.currentTime + startDelay;

            // Get current position
            const currentStep = this.transport?.getCurrentStep() || this.currentPosition || 0;

            // Get pattern/song data
            const { useArrangementStore } = await import('@/store/useArrangementStore');
            const arrangementStore = useArrangementStore.getState();
            const currentMode = this.playbackMode || 'pattern';

            if (currentMode === 'song') {
                // Song mode
                const arrangementClips = arrangementStore.arrangementClips || [];
                const arrangementTracks = arrangementStore.arrangementTracks || [];
                const patterns = arrangementStore.patterns || {};

                if (arrangementClips.length > 0) {
                    const songData = {
                        clips: arrangementClips,
                        tracks: arrangementTracks,
                        patterns: patterns
                    };

                    await this.schedulerService.scheduleSong(
                        songData,
                        adjustedStartTime,
                        bpm // ✅ Use NEW BPM
                    );
                    logger.debug(NAMESPACES.AUDIO, `✅ Rescheduled song with new BPM ${bpm}`);
                }
            } else {
                // Pattern mode
                const activePatternId = arrangementStore.activePatternId;
                const activePattern = arrangementStore.patterns[activePatternId];

                if (activePattern && activePattern.data) {
                    this.schedulerService.schedulePattern(
                        activePatternId,
                        activePattern,
                        adjustedStartTime,
                        bpm, // ✅ Use NEW BPM
                        currentStep // Continue from current position
                    );
                    logger.debug(NAMESPACES.AUDIO, `✅ Rescheduled pattern ${activePatternId} with new BPM ${bpm} from step ${currentStep}`);
                }
            }
        } catch (error) {
            logger.error(NAMESPACES.AUDIO, 'Failed to reschedule on BPM change:', error);
        } finally {
            // Allow next BPM change event after short delay
            setTimeout(() => {
                this._isHandlingBpmChange = false;
            }, 50);
        }
    }

    /**
     * Handle NOTE_ADDED event - schedule new note immediately during playback
     * @param {Object} data - {patternId, instrumentId, note}
     * @private
     */
    async _handleNoteAdded(data) {
        await this._handleNotesAdded({ ...data, notes: [data.note] });
    }

    /**
     * Handle NOTES_ADDED event - schedule multiple new notes immediately
     * @param {Object} data - {patternId, instrumentId, notes}
     * @private
     */
    async _handleNotesAdded(data) {
        const { patternId, instrumentId, notes } = data;

        // Optimize: Single import for bulk operation
        const { useArrangementStore } = await import('@/store/useArrangementStore');
        const arrangementStore = useArrangementStore.getState();

        if (patternId !== arrangementStore.activePatternId) {
            return;
        }

        // ✅ CRITICAL: Skip old immediate scheduling if ContinuousScheduler is active
        // ContinuousScheduler handles all scheduling via dirty flag system
        if (this.schedulerAdapter?.useContinuousScheduler) {
            // ContinuousScheduler will pick up changes automatically via dirty flag
            // No immediate scheduling needed - adapter already called markDirty()
            console.log(`✅ [PlaybackService] Note added - delegating to ContinuousScheduler`);
            return;
        }

        // ✅ LIVE SCHEDULING: If playing and not paused, schedule immediately (OLD SYSTEM)
        if (this.isPlaying && !this.isPaused && notes && notes.length > 0) {
            console.log(`✅ Playback active - scheduling ${notes.length} notes immediately`);
            notes.forEach(note => {
                this._scheduleNewNoteImmediate(instrumentId, note);
            });
        }
    }

    /**
     * Handle NOTE_REMOVED event - cancel scheduled note during playback
     * @param {Object} data - {patternId, instrumentId, noteId, note}
     * @private
     */
    async _handleNoteRemoved(data) {
        const { patternId, instrumentId, noteId, note } = data;

        // Only handle active pattern
        const { useArrangementStore } = await import('@/store/useArrangementStore');
        const arrangementStore = useArrangementStore.getState();
        if (patternId !== arrangementStore.activePatternId) return;

        console.log('🎵 PlaybackService._handleNoteRemoved:', { instrumentId, noteId });

        // ✅ CRITICAL: Skip old note removal if ContinuousScheduler is active
        // ContinuousScheduler handles all scheduling via dirty flag system
        if (this.schedulerAdapter?.useContinuousScheduler) {
            // ContinuousScheduler will pick up changes automatically via dirty flag
            console.log(`✅ [PlaybackService] Note removed - delegating to ContinuousScheduler`);
            return;
        }

        // ✅ If playing, stop the note if it's currently sounding (OLD SYSTEM)
        if (this.isPlaying && !this.isPaused && note && instrumentId) {
            const instrument = this.engine.instruments?.get(instrumentId);
            if (instrument && note.pitch && typeof instrument.releaseNote === 'function') {
                try {
                    instrument.releaseNote(note.pitch);
                } catch (e) {
                    console.error('Error stopping removed note:', e);
                }
            }

            // Cancel future scheduled events for this note
            if (this.schedulerService && noteId) {
                this.schedulerService.cancelNote(instrumentId, noteId);
            }
        }
    }

    /**
     * Handle NOTE_MODIFIED event - reschedule modified note
     * @param {Object} data - {patternId, instrumentId, note, oldNote}
     * @private
     */
    async _handleNoteModified(data) {
        const { patternId, instrumentId, note, oldNote } = data;

        // Only handle active pattern
        const { useArrangementStore } = await import('@/store/useArrangementStore');
        const arrangementStore = useArrangementStore.getState();
        if (patternId !== arrangementStore.activePatternId) return;

        console.log('🎵 PlaybackService._handleNoteModified:', { instrumentId, note });

        // ✅ If playing, stop old note and schedule new one
        if (this.isPlaying && !this.isPaused) {
            // Stop old note
            if (oldNote && instrumentId) {
                const instrument = this.engine.instruments?.get(instrumentId);
                if (instrument && oldNote.pitch && typeof instrument.releaseNote === 'function') {
                    instrument.releaseNote(oldNote.pitch);
                }
                // Cancel old scheduled events
                if (this.schedulerService && oldNote.id) {
                    this.schedulerService.cancelNote(instrumentId, oldNote.id);
                }
            }
            // Schedule new note
            this._scheduleNewNoteImmediate(instrumentId, note);
        }
    }

    /**
     * Schedule a single note immediately during live playback
     * @param {string} instrumentId - Instrument ID
     * @param {Object} note - Note object
     * @private
     */
    _scheduleNewNoteImmediate(instrumentId, note) {
        if (!this.isPlaying || this.isPaused || !this.schedulerService) {
            console.log('⚠️ Not playing or no scheduler, skipping immediate schedule');
            return;
        }

        const instrument = this.engine.instruments?.get(instrumentId);
        if (!instrument) {
            console.log(`⚠️ Instrument ${instrumentId} not found`);
            return;
        }

        const currentTime = this.audioContext.currentTime;
        const currentStep = this.currentPosition;
        const noteStep = note.startTime ?? note.time ?? 0;

        // Calculate loop boundaries
        const loopStart = this.loopSettings.start;
        const loopEnd = this.loopSettings.end;
        const loopLength = loopEnd - loopStart;

        // Normalize positions within loop
        const normalize = (v, m) => {
            if (!m || m <= 0) return v;
            const r = v % m;
            return r < 0 ? r + m : r;
        };
        const relativeCurrentStep = normalize(currentStep - loopStart, loopLength);
        const relativeNoteStep = normalize(noteStep - loopStart, loopLength);

        // Determine when note should play
        let nextPlayStep;
        if (relativeNoteStep > relativeCurrentStep) {
            // Note is later in current loop
            nextPlayStep = noteStep;
        } else {
            // Note is earlier - schedule for next loop
            nextPlayStep = noteStep + loopLength;
        }

        // Convert step to time
        const secondsPerStep = this.transport?.stepsToSeconds?.(1) || (60 / (this.transport?.bpm || 120) / 4);
        const transportStartTime = currentTime - (currentStep * secondsPerStep);
        let absoluteTime = transportStartTime + (nextPlayStep * secondsPerStep);

        console.log('🎯 Scheduling note immediately:', {
            instrumentId,
            noteStep,
            nextPlayStep,
            currentStep: currentStep.toFixed(2),
            absoluteTime: absoluteTime.toFixed(4),
            timeDelta: (absoluteTime - currentTime).toFixed(4)
        });

        // Handle edge case: note time is in the past or very close
        const timeDelta = absoluteTime - currentTime;
        if (timeDelta <= 0.003) {
            absoluteTime = currentTime + 0.01; // Nudge 10ms into future
        }

        // Schedule via SchedulerService
        if (absoluteTime > currentTime) {
            const duration = (note.gateDuration ?? note.duration ?? 1) * secondsPerStep;
            this.schedulerService.scheduleNote(instrumentId, note, absoluteTime, duration);
            console.log('✅ Note scheduled for immediate playback');
        } else {
            console.log('⚠️ Note time in past, skipping');
        }
    }
}
