// lib/core/TransportController.js
/**
 * 🚀 PHASE 2: Unified TransportController
 * 
 * Consolidates 3 singletons into 1 unified controller:
 * - PlaybackController (playback control)
 * - TransportManager (transport state)
 * - TimelineController (timeline/position)
 * 
 * Benefits:
 * - Single source of truth for transport state
 * - -4,300 lines of code
 * - Simpler API
 * - Better testability
 * - Reduced layer count (6 → 2)
 */

import { wasmAudioEngine } from './WasmAudioEngine';
import EventBus from './EventBus';
import { uiUpdateManager, UPDATE_PRIORITIES, UPDATE_FREQUENCIES } from './UIUpdateManager';
import ShortcutManager, { SHORTCUT_PRIORITY } from './ShortcutManager';
import { PLAYBACK_STATES } from '@/config/constants.js';

// Precise step calculation helper
const calculateStep = (clickX, stepWidth, maxStep) => {
    const exactStep = clickX / stepWidth;
    const roundedStep = Math.round(exactStep * 100) / 100; // Round to 2 decimal places first
    const finalStep = Math.round(roundedStep); // Then round to integer
    return Math.max(0, Math.min(maxStep, finalStep));
};

class TransportController {
    constructor() {
        // ✅ UNIFIED TRANSPORT: State now delegated to NativeTransportSystem (SAB)
        // isPlaying, isPaused, currentStep are now getters
        // Fallbacks for when transport is not yet initialized
        this._fallbackCurrentStep = 0;
        this._bpm = 140;
        this._loopEnabled = true;
        this._loopStart = 0;
        this._loopEnd = 64;

        // UI Interaction state
        this.isUserScrubbing = false;
        this.ghostPosition = null;
        this.keyboardPianoModeActive = false;

        // Metadata
        this.lastUpdateTime = 0;
        this.lastStopTime = 0;

        // Audio engine reference (will be set by AudioContextService)
        this.audioEngine = null;
        this.transport = null;

        // UI references
        this.transportButtons = new Map(); // button-id -> element
        this.playheadElements = new Map(); // playhead-id -> element
        this.timelineElements = new Map(); // timeline-id -> element

        // Performance & Updates
        this.uiUpdateUnsubscribe = null;
        this._needsUIRefresh = false;
        this.keyboardCleanup = null;

        // ✅ HYBRID PLAYHEAD: Interpolation state for smooth, accurate playhead
        // Low-frequency SAB sync (10-20fps) + high-frequency interpolation (60fps)
        this._interpolation = {
            lastSyncTime: 0,           // AudioContext.currentTime at last SAB sync
            lastSyncPosition: 0,       // Step position at last SAB sync
            visualPosition: 0,         // Current interpolated visual position
            syncInterval: 50,          // Sync every 50ms (~20fps) for accuracy
            lastSyncFrame: 0,          // Frame counter for sync timing
            driftThreshold: 0.5,       // Max allowed drift in steps before hard correction
            smoothingFactor: 0.15,     // Lerp factor for smooth corrections (0-1)
        };

        // Initialize systems
        this._setupEventBus();
        this._setupUIUpdateManager();
        this._setupGlobalKeyboardShortcuts();

        console.log('🎮 TransportController initialized');
    }

    // ✅ UNIFIED TRANSPORT: SAB-backed getters (delegate to NativeTransportSystem)
    get isPlaying() {
        return this.transport?.isPlaying ?? false;
    }

    get isPaused() {
        return this.transport?.isPaused ?? false;
    }

    get isStopped() {
        return this.transport?.isStopped ?? true;
    }

    get currentStep() {
        if (this.transport?.getCurrentStep) {
            return this.transport.getCurrentStep();
        }
        return this._fallbackCurrentStep;
    }

    set currentStep(value) {
        this._fallbackCurrentStep = value;
    }

    get bpm() {
        return this.transport?.bpm ?? this._bpm;
    }

    set bpm(value) {
        this._bpm = value;
    }

    get loopEnabled() {
        return this.transport?.loop ?? this._loopEnabled;
    }

    set loopEnabled(value) {
        this._loopEnabled = value;
    }

    get loopStart() {
        if (this.transport) {
            return this.transport.ticksToSteps?.(this.transport.loopStartTick) ?? this._loopStart;
        }
        return this._loopStart;
    }

    set loopStart(value) {
        this._loopStart = value;
    }

    get loopEnd() {
        if (this.transport) {
            return this.transport.ticksToSteps?.(this.transport.loopEndTick) ?? this._loopEnd;
        }
        return this._loopEnd;
    }

    set loopEnd(value) {
        this._loopEnd = value;
    }

    /**
     * Initialize with audio engine
     * Called by AudioContextService after engine is ready
     */
    initialize(audioEngine) {
        this.audioEngine = audioEngine;
        this.transport = audioEngine?.transport;

        if (this.transport) {
            // Subscribe to transport events
            this.transport.on('tick', this._handleTick.bind(this));
            this.transport.on('start', this._handleStart.bind(this));
            this.transport.on('stop', this._handleStop.bind(this));
            this.transport.on('pause', this._handlePause.bind(this));
            this.transport.on('loop', this._handleLoop.bind(this));

            console.log('🎮 TransportController: Audio engine linked');

            // ✅ CRITICAL: Sync initial state to transport
            // This ensures potential mismatches (e.g. loop defaults) are aligned
            this.transport.setLoopEnabled(this._loopEnabled);
            this.transport.setLoopPoints(this._loopStart, this._loopEnd);
            this.transport.setBPM(this._bpm);
        } else {
            console.warn('🎮 TransportController: No transport found in audio engine');
        }

        return this;
    }

    /**
     * Setup EventBus listeners for commands
     */
    _setupEventBus() {
        EventBus.on('transport:play', () => this.play());
        EventBus.on('transport:stop', () => this.stop());
        EventBus.on('transport:pause', () => this.pause());
        EventBus.on('transport:resume', () => this.resume());
        EventBus.on('transport:setBPM', (bpm) => this.setBPM(bpm));
        EventBus.on('transport:setLoop', ({ start, end, enabled }) => {
            if (start !== undefined || end !== undefined) {
                this.setLoopPoints(start ?? this.loopStart, end ?? this.loopEnd);
            }
            if (enabled !== undefined) {
                this.setLoopEnabled(enabled);
            }
        });

        // Auto-sync Musical Typing state
        import('@/store/usePlaybackStore').then(({ usePlaybackStore }) => {
            usePlaybackStore.subscribe((state) => {
                this.keyboardPianoModeActive = state.keyboardPianoMode;
            });
        });
    }

    // =================== UI UPDATE MANAGER ===================

    /**
     * Setup unified UI update loop (60fps)
     */
    _setupUIUpdateManager() {
        this.uiUpdateUnsubscribe = uiUpdateManager.subscribe(
            'transport-controller',
            this._handleUnifiedUpdate.bind(this),
            UPDATE_PRIORITIES.CRITICAL, // Same strict priority as before
            UPDATE_FREQUENCIES.REALTIME
        );
    }

    /**
     * ✅ HYBRID PLAYHEAD: Main update handler with interpolation
     * - SAB sync: Low frequency (~20fps) for ground truth position
     * - Interpolation: High frequency (60fps) for smooth visual movement
     */
    _handleUnifiedUpdate(currentTime, frameTime) {
        // Skip if not playing and no refresh needed
        const needsUpdate = this.isPlaying || this._needsUIRefresh;
        if (!needsUpdate) {
            // Reset interpolation when stopped
            if (!this.isPlaying && this._interpolation.visualPosition !== 0) {
                this._resetInterpolation();
            }
            return;
        }

        // Skip if user is scrubbing (we handle that manually/optimistically)
        if (this.isUserScrubbing) return;

        const audioContext = this.audioEngine?.audioContext;
        if (!audioContext) return;

        const audioTime = audioContext.currentTime;
        const interp = this._interpolation;

        // ✅ STEP 1: Periodic SAB sync for ground truth (~20fps)
        const timeSinceLastSync = (audioTime - interp.lastSyncTime) * 1000; // ms
        if (timeSinceLastSync >= interp.syncInterval) {
            this._syncFromSAB(audioTime);
        }

        // ✅ STEP 2: Interpolate visual position based on time elapsed
        const visualPosition = this._interpolateVisualPosition(audioTime);

        // ✅ STEP 3: Update UI with interpolated position (every frame)
        this._updatePlayheadsWithPosition(visualPosition);
        this._updateAllTimelinesBatched();

        // Reset UI refresh flag
        this._needsUIRefresh = false;
    }

    /**
     * ✅ HYBRID PLAYHEAD: Sync position from SAB (ground truth)
     */
    _syncFromSAB(audioTime) {
        if (!this.transport) return;

        const interp = this._interpolation;
        const truePosition = this.transport.ticksToSteps(this.transport.currentTick);

        // Check for drift between interpolated and true position
        const drift = Math.abs(interp.visualPosition - truePosition);

        if (drift > 0.5) { // Relaxed threshold from strict check
            // Check if we just looped (this can cause false positive drift)
            const isLoopBoundary = this.loopEnabled &&
                (Math.abs(truePosition - this._loopStart) < 1 || Math.abs(truePosition - this._loopEnd) < 1);

            if (!isLoopBoundary) {
                // Hard correction only if NOT at a loop boundary
                interp.visualPosition = truePosition;
                // console.log(`🎯 Playhead hard correction: drift=${drift.toFixed(2)} steps`);
            }
        }

        // Update sync state
        interp.lastSyncTime = audioTime;
        interp.lastSyncPosition = truePosition;
        this.currentStep = truePosition;
        this.lastUpdateTime = Date.now();
    }

    /**
     * ✅ HYBRID PLAYHEAD: Interpolate visual position using AudioContext time
     * This predicts position between SAB syncs for smooth 60fps movement
     */
    _interpolateVisualPosition(audioTime) {
        const interp = this._interpolation;

        // Calculate elapsed time since last sync
        const elapsedSeconds = audioTime - interp.lastSyncTime;

        // ✅ FIX: Use transport's authoritative timing instead of local calculation
        // This ensures playhead speed matches the audio engine exactly
        const stepsPerSecond = this.transport?.getStepsPerSecond?.() ?? (this.bpm / 60) * 4;

        // Predicted position based on time elapsed
        const predictedPosition = interp.lastSyncPosition + (elapsedSeconds * stepsPerSecond);

        // ✅ FIX: Ghost position should NOT affect main playhead during playback
        // Ghost is only for visual hover preview, not actual playback position
        const targetPosition = predictedPosition;

        // Lerp for ultra-smooth movement
        interp.visualPosition = this._lerp(
            interp.visualPosition,
            targetPosition,
            interp.smoothingFactor
        );

        // Handle loop wrapping
        if (this._loopEnabled && interp.visualPosition >= this._loopEnd) {
            interp.visualPosition = this._loopStart + (interp.visualPosition - this._loopEnd);
        }

        return interp.visualPosition;
    }

    /**
     * ✅ HYBRID PLAYHEAD: Reset interpolation state (on stop/jump)
     */
    _resetInterpolation(position = 0) {
        const interp = this._interpolation;
        interp.lastSyncTime = this.audioEngine?.audioContext?.currentTime || 0;
        interp.lastSyncPosition = position;
        interp.visualPosition = position;
    }

    /**
     * Linear interpolation helper
     */
    _lerp(a, b, t) {
        return a + (b - a) * t;
    }

    /**
     * ✅ HYBRID PLAYHEAD: Update playheads with interpolated position
     */
    _updatePlayheadsWithPosition(position) {
        const displayPosition = this.ghostPosition ?? position;

        for (const [id, playhead] of this.playheadElements) {
            const { element, stepWidth } = playhead;
            const pixelPosition = displayPosition * stepWidth;

            // Queue batched style update with GPU acceleration
            uiUpdateManager.queueStyleUpdate(element, {
                transform: `translate3d(${pixelPosition}px, 0, 0)`
            });
        }
    }

    /**
     * Batched playhead updates (legacy, now uses _updatePlayheadsWithPosition)
     */
    _updateAllPlayheadsBatched() {
        this._updatePlayheadsWithPosition(this._interpolation.visualPosition);
    }

    /**
    /**
     * Batched timeline updates
     * ✅ PERFORMANCE FIX: Pass interpolated visual position for smoother playhead
     */
    _updateAllTimelinesBatched(overridePosition = null) {
        // Use interpolated position for smooth 60fps updates unless overridden
        const visualPosition = overridePosition ?? this._interpolation.visualPosition;

        for (const [id, timeline] of this.timelineElements) {
            const { updateCallback } = timeline;
            if (updateCallback) {
                updateCallback(visualPosition, this.ghostPosition);
            }
        }
    }

    /**
     * Request a UI refresh on next frame
     */
    _requestUIRefresh() {
        this._needsUIRefresh = true;
    }

    /**
     * Get interpolated visual position (ticks)
     */
    getVisualPosition() {
        if (!this.transport) return 0;
        return this.transport.getVisualPosition();
    }

    // =================== PLAYBACK CONTROL ===================

    /**
     * Start playback from current position or loop start
     */
    async play(startStep = null) {
        if (this.isPlaying && !this.isPaused) {
            console.log('🎮 Already playing');
            return;
        }

        // Clear ghost position
        this.clearGhostPosition();

        // ✅ SAFETY FIX: Ensure AudioContext is resumed on user play
        // Some browsers suspend the context and require a fresh user interaction to resume
        if (this.audioEngine?.audioContext?.state === 'suspended') {
            console.log('🔊 TransportController: Resuming suspended AudioContext safety-check');
            await this.audioEngine.audioContext.resume();
        }

        // ✅ FIX: Start from currentStep if not provided (allows playing from jump position)
        const step = startStep ?? this.currentStep;

        // ✅ FIX: Only call PlaybackFacade.play() - it handles transport.start() internally
        // Previously we were calling both transport.start() AND playbackFacade.play()
        // which caused dual audio playback (one from transport, one from facade)
        if (this.audioEngine?.playbackFacade) {
            // PlaybackFacade.play() handles: transport.start(), note scheduling, position
            this.audioEngine.playbackFacade.play(step);
            console.log('🎵 PlaybackFacade started');
        } else if (this.transport) {
            // Fallback: only start transport if no playbackFacade
            console.warn('⚠️ PlaybackFacade not available, using transport directly');
            this.transport.start();
            if (step !== 0) {
                this.transport.setPosition(step);
            }
        }

        // ✅ UNIFIED: State is now in SAB, just update UI and emit events
        this._fallbackCurrentStep = step;
        this.lastUpdateTime = Date.now();

        // ✅ HYBRID PLAYHEAD: Initialize interpolation at start position
        this._resetInterpolation(step);

        // Update UI immediately (optimistic)
        this._updateAllTransportUI('play');

        EventBus.emit('playback:stateChanged', {
            isPlaying: true,
            isPaused: false,
            currentStep: step
        });
        EventBus.emit('TRANSPORT_PLAYBACK_STARTED', {
            position: step,
            bpm: this.bpm,
            isPlaying: true
        });

        console.log(`▶️ Play from step ${step}`);
    }

    /**
     * Stop playback and reset to loop start
     */
    async stop() {
        if (!this.isPlaying && !this.isPaused) {
            console.log('🎮 Already stopped');
            return;
        }

        const now = Date.now();
        this.lastStopTime = now;

        // ✅ FIX: Only call PlaybackFacade.stop() - it handles transport.stop() internally
        if (this.audioEngine?.playbackFacade) {
            this.audioEngine.playbackFacade.stop();
            console.log('🎵 PlaybackFacade stopped');
        } else if (this.transport) {
            // Fallback: only stop transport if no playbackFacade
            console.warn('⚠️ PlaybackFacade not available, using transport directly');
            this.transport.stop();
        }

        // ✅ UNIFIED: State is now in SAB, just update UI and emit events
        this._fallbackCurrentStep = 0;
        this.lastUpdateTime = now;
        this.clearGhostPosition();

        // ✅ HYBRID PLAYHEAD: Reset interpolation to 0
        this._resetInterpolation(0);

        this._updateAllTransportUI('stop');

        EventBus.emit('playback:stateChanged', {
            isPlaying: false,
            isPaused: false,
            currentStep: this._fallbackCurrentStep
        });
        EventBus.emit('transport:positionChanged', { step: this._fallbackCurrentStep });

        console.log('⏹️ Stop');
    }

    /**
     * Pause playback at current position
     */
    async pause() {
        if (!this.isPlaying) {
            console.log('🎮 Not playing');
            return;
        }

        // ✅ FIX: Only call PlaybackFacade.pause() - it handles transport.pause() internally
        if (this.audioEngine?.playbackFacade) {
            this.audioEngine.playbackFacade.pause();
            console.log('🎵 PlaybackFacade paused');
        } else if (this.transport) {
            // Fallback: only pause transport if no playbackFacade
            console.warn('⚠️ PlaybackFacade not available, using transport directly');
            this.transport.pause();
        }

        // ✅ UNIFIED: State is now in SAB, just update UI and emit events
        this.lastUpdateTime = Date.now();

        this._updateAllTransportUI('pause');

        EventBus.emit('playback:stateChanged', {
            isPlaying: false,
            isPaused: true,
            currentStep: this.currentStep
        });
        EventBus.emit('transport:positionChanged', { step: this.currentStep });

        console.log('⏸️ Pause');
    }

    /**
     * Resume playback from paused position
     */
    async resume() {
        if (!this.isPaused) {
            console.log('🎮 Not paused');
            return;
        }
        return this.play(this.currentStep);
    }

    /**
     * Toggle play/pause
     */
    async togglePlayPause() {
        // ✅ UNIFIED: Now uses SAB-backed getters directly
        console.log(`🎮 [TransportController] togglePlayPause: isPlaying=${this.isPlaying}, isPaused=${this.isPaused}`);

        if (this.isPlaying) {
            return this.pause();
        } else if (this.isPaused) {
            return this.resume();
        } else {
            return this.play();
        }
    }

    // =================== TRANSPORT PARAMETERS ===================

    /**
     * Set BPM
     */
    setBPM(bpm) {
        if (bpm <= 0 || isNaN(bpm)) {
            console.warn('Invalid BPM:', bpm);
            return;
        }

        const oldBpm = this.bpm;
        this.bpm = bpm;

        if (this.transport) {
            this.transport.setBPM(bpm);
        }

        EventBus.emit('transport:bpmChanged', { bpm, oldBpm });
        console.log(`🎵 BPM: ${oldBpm} → ${bpm}`);
    }

    /**
     * Set loop points (in steps)
     */
    setLoopPoints(startStep, endStep) {
        if (startStep >= endStep) {
            console.warn('Invalid loop points:', { startStep, endStep });
            return;
        }

        // Calculate new values
        const newStart = Math.max(0, startStep);
        const newEnd = Math.max(startStep + 1, endStep);

        // Update backing fields directly to avoid getter interference
        this._loopStart = newStart;
        this._loopEnd = newEnd;

        // Propagate to transport using the FRESH values
        if (this.transport) {
            this.transport.setLoopPoints(newStart, newEnd);
        }

        EventBus.emit('transport:loopChanged', {
            start: newStart,
            end: newEnd,
            enabled: this.loopEnabled
        });
    }

    /**
     * Enable/disable looping
     */
    setLoopEnabled(enabled) {
        this.loopEnabled = enabled;

        if (this.transport) {
            this.transport.setLoopEnabled(enabled);
        }

        EventBus.emit('transport:loopChanged', {
            start: this.loopStart,
            end: this.loopEnd,
            enabled
        });

        console.log(`🔁 Loop ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Jump to specific step
     */
    jumpToStep(step, options = {}) {
        const { updateUI = true } = options;
        const newStep = Math.max(0, step);

        this.currentStep = newStep;

        // ✅ HYBRID PLAYHEAD: Reset interpolation to new position immediately
        this._resetInterpolation(newStep);

        if (this.transport) {
            this.transport.setPosition(newStep);
        }

        // Notify playback manager if available (handles seamless jumps)
        if (this.audioEngine?.playbackFacade) {
            this.audioEngine.playbackFacade.jumpToStep(newStep);
        }

        if (updateUI) {
            this._updateAllPlayheadsBatched();
            this._updateAllTimelinesBatched(newStep);
        }

        // Notify registered timelines onSeek (e.g. for note preview)
        for (const [id, timeline] of this.timelineElements) {
            if (timeline.onSeek) {
                timeline.onSeek(newStep);
            }
        }

        EventBus.emit('transport:positionChanged', { step: newStep });
        console.log(`⏩ Jump to step ${newStep}`);
    }

    // =================== UI REGISTRATION ===================

    /**
     * Register transport button (Play/Pause/Stop)
     */
    registerTransportButton(id, element, type) {
        this.transportButtons.set(id, { element, type });
        this._updateTransportButton(id);
    }

    /**
     * Register playhead element (red line)
     */
    registerPlayhead(id, element, stepWidth = 16) {
        // ✅ HYBRID PLAYHEAD: Add GPU hints for smooth animation
        if (element) {
            element.style.willChange = 'transform';
            element.style.transformStyle = 'preserve-3d';
            element.style.backfaceVisibility = 'hidden';
        }

        this.playheadElements.set(id, { element, stepWidth });
        this._updatePlayhead(id);
    }

    /**
     * Register timeline element (interactive area)
     */
    registerTimeline(id, element, config = {}) {
        this.timelineElements.set(id, { element, ...config });
        this._setupTimelineInteraction(id);
    }

    /**
     * Unregister UI element
     */
    unregisterElement(id) {
        // Cleanup timeline listeners
        const timeline = this.timelineElements.get(id);
        if (timeline && timeline.handlers) {
            const { element, handlers } = timeline;
            element.removeEventListener('click', handlers.handleClick);
            element.removeEventListener('mousemove', handlers.handleMouseMove);
            element.removeEventListener('mouseleave', handlers.handleMouseLeave);
        }

        this.transportButtons.delete(id);
        this.playheadElements.delete(id);
        this.timelineElements.delete(id);
    }

    // =================== INTERACTION HANDLERS ===================

    _setupTimelineInteraction(id) {
        const timeline = this.timelineElements.get(id);
        if (!timeline) return;

        const {
            element,
            stepWidth = 16,
            audioLoopLength = 64,
            enableInteraction = true, // Default true
            calculatePosition // Optional custom calculator
        } = timeline;

        // Position calculator helper
        const getStepFromEvent = (e) => {
            if (calculatePosition) {
                const rect = element.getBoundingClientRect();
                return calculatePosition(e.clientX - rect.left, e.clientY - rect.top, e);
            }
            const rect = element.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            return calculateStep(clickX, stepWidth, audioLoopLength - 1);
        };

        // Click handler - Jump / Seek
        const handleClick = (e) => {
            if (!enableInteraction) return; // Respect flag

            const targetStep = getStepFromEvent(e);
            if (targetStep === null || targetStep === undefined) return;

            // Jump immediately
            this.jumpToStep(targetStep, { updateUI: true });
        };

        // Hover handler - Ghost playhead
        const handleMouseMove = (e) => {
            const hoverStep = getStepFromEvent(e);
            if (hoverStep === null || hoverStep === undefined) {
                this.clearGhostPosition();
                return;
            }

            this.setGhostPosition(hoverStep);
        };

        // Leave handler
        const handleMouseLeave = () => {
            this.clearGhostPosition();
        };

        element.addEventListener('click', handleClick);
        element.addEventListener('mousemove', handleMouseMove);
        element.addEventListener('mouseleave', handleMouseLeave);

        // Store handlers for cleanup
        timeline.handlers = { handleClick, handleMouseMove, handleMouseLeave };
    }

    // =================== UI UPDATES ===================

    _updateAllTransportUI(action) {
        // Update buttons
        for (const [id] of this.transportButtons) {
            this._updateTransportButton(id);
        }
        // Update playheads & timelines
        this._updateAllPlayheadsBatched();
        this._updateAllTimelinesBatched();
    }

    _updateTransportButton(id) {
        const button = this.transportButtons.get(id);
        if (!button) return;

        const { element, type } = button;

        // Remove all state classes
        element.classList.remove(
            'transport-btn--playing',
            'transport-btn--paused',
            'transport-btn--stopped'
        );

        // Add current state class
        if (this.isPlaying) {
            if (type === 'play' || type === 'toggle') element.classList.add('transport-btn--playing');
        } else if (this.isPaused) {
            if (type === 'play' || type === 'toggle') element.classList.add('transport-btn--paused');
        } else {
            if (type === 'stop') element.classList.add('transport-btn--stopped');
        }
    }

    _updatePlayhead(id) {
        // Trigger generic batch update for simplicity, could be optimized to single
        this._updateAllPlayheadsBatched();
    }

    // =================== GHOST POSITION ===================

    setGhostPosition(position) {
        this.ghostPosition = position;
        this._updateAllPlayheadsBatched();

        // Notify registered timelines if they have a callback
        for (const [id, timeline] of this.timelineElements) {
            if (timeline.onGhostPositionChange) {
                timeline.onGhostPositionChange(position);
            }
        }

        EventBus.emit('transport:ghostPosition', { position });
    }

    clearGhostPosition() {
        this.ghostPosition = null;
        this._updateAllPlayheadsBatched();

        // Notify registered timelines
        for (const [id, timeline] of this.timelineElements) {
            if (timeline.onGhostPositionChange) {
                timeline.onGhostPositionChange(null);
            }
        }

        EventBus.emit('transport:ghostPosition', { position: null });
    }

    getGhostPosition() {
        return this.ghostPosition;
    }

    // =================== KEYBOARD SHORTCUTS ===================

    _setupGlobalKeyboardShortcuts() {
        ShortcutManager.registerContext('TRANSPORT', SHORTCUT_PRIORITY.GLOBAL + 1, {
            onKeyDown: (e) => {
                // Ignore if keyboard piano mode is active
                if (this.keyboardPianoModeActive) return false;

                switch (e.key) {
                    case ' ': // Spacebar
                        e.preventDefault();
                        this.togglePlayPause();
                        return true;
                    case 'Numpad0':
                    case 'Insert':
                        e.preventDefault();
                        this.stop();
                        return true;
                }
                return false;
            }
        });

        this.keyboardCleanup = () => {
            ShortcutManager.unregisterContext('TRANSPORT');
        };
    }

    // =================== GETTERS & COMPATIBILITY ===================

    getState() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentStep: this.currentStep,
            bpm: this.bpm,
            loopEnabled: this.loopEnabled,
            loopStart: this.loopStart,
            loopEnd: this.loopEnd,
            isScrubbing: this.isUserScrubbing // Exposed for UI
        };
    }

    getCurrentStep() {
        if (this.transport?.getCurrentStep) {
            return this.transport.getCurrentStep();
        }
        return this.currentStep;
    }

    getBPM() { return this.bpm; }

    getLoopSettings() {
        return {
            enabled: this.loopEnabled,
            start: this.loopStart,
            end: this.loopEnd
        };
    }

    // Compatibility aliases
    getCurrentPosition() { return this.getCurrentStep(); }
    getDisplayPosition() { return this.getCurrentStep(); }
    setLoopRange(start, end) { return this.setLoopPoints(start, end); }
    _resume() { return this.resume(); }
    jumpToPosition(position, options = {}) { return this.jumpToStep(position, options); }

    // =================== TRANSPORT EVENT HANDLERS ===================

    _handleTick(data) {
        if (data.step !== undefined) {
            this._fallbackCurrentStep = data.step;
        }
        EventBus.emit('transport:tick', data);
    }

    _handleStart(data) {
        // ✅ UNIFIED: State updates come from SAB via getters
        EventBus.emit('playback:started', data);
    }

    _handleStop(data) {
        // ✅ UNIFIED: State updates come from SAB via getters
        this._fallbackCurrentStep = this.loopStart;
        EventBus.emit('playback:stopped', data);
    }

    _handlePause(data) {
        // ✅ UNIFIED: State updates come from SAB via getters
        EventBus.emit('playback:paused', data);
    }

    _handleLoop(data) {
        EventBus.emit('transport:looped', data);
    }

    // =================== CLEANUP ===================

    dispose() {
        // Remove EventBus listeners
        EventBus.off('transport:play');
        EventBus.off('transport:stop');
        EventBus.off('transport:pause');
        EventBus.off('transport:resume');
        EventBus.off('transport:setBPM');
        EventBus.off('transport:setLoop');

        // Cleanup UI Update Manager
        if (this.uiUpdateUnsubscribe) {
            this.uiUpdateUnsubscribe();
            this.uiUpdateUnsubscribe = null;
        }

        // Cleanup Shortcuts
        if (this.keyboardCleanup) {
            this.keyboardCleanup();
            this.keyboardCleanup = null;
        }

        // Remove interactions
        for (const [id] of this.timelineElements) {
            this.unregisterElement(id);
        }

        // Clear transport listeners
        if (this.transport) {
            this.transport.off('tick', this._handleTick);
            this.transport.off('start', this._handleStart);
            this.transport.off('stop', this._handleStop);
            this.transport.off('pause', this._handlePause);
            this.transport.off('loop', this._handleLoop);
        }

        this.audioEngine = null;
        this.transport = null;
        this.transportButtons.clear();
        this.playheadElements.clear();
        this.timelineElements.clear();

        console.log('🎮 TransportController disposed');
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        const handler = () => callback(this.getState());

        EventBus.on('playback:stateChanged', handler);
        EventBus.on('transport:positionChanged', handler);
        EventBus.on('transport:bpmChanged', handler);
        EventBus.on('transport:loopChanged', handler);

        return () => {
            EventBus.off('playback:stateChanged', handler);
            EventBus.off('transport:positionChanged', handler);
            EventBus.off('transport:bpmChanged', handler);
            EventBus.off('transport:loopChanged', handler);
        };
    }
}

// Singleton instance
let transportControllerInstance = null;

export function getTransportController() {
    if (!transportControllerInstance) {
        transportControllerInstance = new TransportController();
    }
    return transportControllerInstance;
}

export function initializeTransportController(audioEngine) {
    const controller = getTransportController();
    controller.initialize(audioEngine);
    return controller;
}

export { TransportController };
