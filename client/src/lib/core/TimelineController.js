// lib/core/TimelineController.js
/**
 * 🎯 UNIFIED TIMELINE CONTROL SYSTEM
 *
 * Tek merkezi timeline yönetim sistemi - 3 panel için (Channel Rack, Piano Roll, Arrangement)
 *
 * Özellikler:
 * - Optimistic UI updates (instant feedback)
 * - Debounced motor updates (performance)
 * - Ghost position support (hover effects)
 * - Range selection support (shift+drag)
 * - Cross-panel synchronization
 * - Smart caching & throttling
 */

import { uiUpdateManager, UPDATE_PRIORITIES, UPDATE_FREQUENCIES } from './UIUpdateManager.js';

// =================== CONSTANTS ===================

export const INTERACTION_MODES = {
  IDLE: 'idle',
  SEEK: 'seek',           // Direct position change (click)
  SCRUB: 'scrub',         // Continuous position change (drag)
  HOVER: 'hover',         // Ghost position display (mouseover)
  PREVIEW: 'preview',     // Short preview play (hover + modifier)
  SELECT_RANGE: 'range'   // Timeline region selection (shift+drag)
};

export const PLAYBACK_STATES = {
  STOPPED: 'stopped',
  PLAYING: 'playing',
  PAUSED: 'paused'
};

// =================== TIMELINE CONTROLLER ===================

export class TimelineController {
  constructor(audioEngine, initialBPM = 140) {
    // Core state - Single source of truth
    this.state = {
      // Playback state
      playbackState: PLAYBACK_STATES.STOPPED,
      isPlaying: false,

      // Position state (step cinsinden - master clock)
      currentPosition: 0,
      ghostPosition: null,      // Hover position for preview
      selectedRange: null,      // { start, end } for range selection

      // Interaction state
      interactionMode: INTERACTION_MODES.IDLE,
      isScrubbing: false,
      isHovering: false,
      wasPlayingBeforeScrub: false, // ✅ NEW: Track playback state during scrub

      // Loop state
      loopEnabled: true,
      loopStart: 0,
      loopEnd: 64,

      // Settings
      bpm: initialBPM, // ✅ Use initial BPM from parameter (default 140)

      // Metadata
      lastUpdateTime: 0
    };

    this.audioEngine = audioEngine;
    this.subscribers = new Set();

    // Timeline registry - Her panel kendi timeline'ını register eder
    this.timelines = new Map(); // id -> TimelineConfig

    // Performance optimization
    this._motorUpdateQueue = null;
    this._motorUpdateDebounceMs = 16; // ~60fps
    this._scrubThrottleMs = 100; // 10fps for motor during scrub
    this._lastMotorUpdate = 0;

    // UI update subscription
    this.uiUpdateSubscription = null;
    this._setupUIUpdates();

    // Motor event bindings
    this._bindMotorEvents();

    // Cleanup tracking
    this.isDestroyed = false;
  }

  // =================== CORE TRANSPORT COMMANDS ===================

  /**
   * ✅ UNIFIED PLAY
   */
  async play(options = {}) {
    const { from = null, mode = 'pattern' } = options;

    if (this.state.isPlaying) return false;

    try {
      // Set starting position if specified
      if (from !== null) {
        this._setPositionOptimistic(from);
      }

      // Start audio engine
      await this.audioEngine.playbackManager.play(this.state.currentPosition);

      // Update state
      this.state.playbackState = PLAYBACK_STATES.PLAYING;
      this.state.isPlaying = true;
      this.state.lastUpdateTime = Date.now();

      // Start position tracking
      this._startPositionTracking();

      // Emit state change
      this._emitStateChange('play');

      return true;
    } catch (error) {
      console.error('🎯 TimelineController play failed:', error);
      return false;
    }
  }

  /**
   * ✅ UNIFIED PAUSE
   */
  async pause() {
    if (!this.state.isPlaying) return false;

    try {
      await this.audioEngine.playbackManager.pause();

      this.state.playbackState = PLAYBACK_STATES.PAUSED;
      this.state.isPlaying = false;
      this.state.lastUpdateTime = Date.now();

      this._stopPositionTracking();
      this._emitStateChange('pause');

      return true;
    } catch (error) {
      console.error('🎯 TimelineController pause failed:', error);
      return false;
    }
  }

  /**
   * ✅ UNIFIED STOP
   */
  async stop() {
    try {
      await this.audioEngine.playbackManager.stop();

      this.state.playbackState = PLAYBACK_STATES.STOPPED;
      this.state.isPlaying = false;

      // Reset to loop start (or 0)
      const resetPosition = this.state.loopEnabled ? this.state.loopStart : 0;
      this._setPositionOptimistic(resetPosition);

      this.state.lastUpdateTime = Date.now();

      this._stopPositionTracking();
      this._emitStateChange('stop');

      return true;
    } catch (error) {
      console.error('🎯 TimelineController stop failed:', error);
      return false;
    }
  }

  /**
   * ✅ SMART TOGGLE
   */
  async togglePlayPause() {
    switch (this.state.playbackState) {
      case PLAYBACK_STATES.PLAYING:
        return await this.pause();
      case PLAYBACK_STATES.PAUSED:
        return await this.play();
      case PLAYBACK_STATES.STOPPED:
      default:
        return await this.play({ from: this.state.currentPosition });
    }
  }

  // =================== POSITION CONTROL ===================

  /**
   * ✅ SEEK TO POSITION
   * Optimistic update: UI updates immediately, motor update queued
   *
   * @param {number} position - Target step position
   * @param {object} options - Configuration options
   * @param {boolean} options.immediate - UI instant update (default: true)
   * @param {boolean} options.smooth - Smooth jump with pause-resume (default: true)
   * @param {boolean} options.updateMotor - Actually update motor (default: true)
   * @param {string} options.timelineId - Timeline ID that triggered the seek (for onSeek callback)
   */
  async seekTo(position, options = {}) {
    const {
      immediate = true,      // UI instant update
      smooth = true,         // ✅ NEW: Smooth jump with pause-resume (default ON)
      updateMotor = true,    // Actually update motor
      timelineId = null      // ✅ NEW: Timeline ID for onSeek callback
    } = options;

    const clampedPosition = Math.max(0, position);

    console.log(`🎯 TimelineController.seekTo(${clampedPosition}, smooth: ${smooth})`);

    // Change interaction mode
    this.state.interactionMode = INTERACTION_MODES.SEEK;

    // 1. IMMEDIATE UI UPDATE (optimistic)
    if (immediate) {
      this._setPositionOptimistic(clampedPosition);
      this._updateAllTimelinesPosition();
    }

    // 2. CALL onSeek CALLBACK (for note preview on timeline click)
    if (timelineId) {
      const timeline = this.timelines.get(timelineId);
      if (timeline?.onSeek) {
        try {
          timeline.onSeek(clampedPosition);
        } catch (error) {
          console.error('🎯 TimelineController: onSeek callback error:', error);
        }
      }
    }

    // 3. SMOOTH MOTOR UPDATE with pause-resume
    if (updateMotor) {
      if (smooth && this.state.isPlaying) {
        // ✅ SMOOTH JUMP: Pause → Jump → Resume
        await this._smoothJumpWithPauseResume(clampedPosition);
      } else {
        // Direct jump (stopped state or smooth disabled)
        this._queueMotorUpdate(() => {
          if (this.audioEngine?.playbackManager) {
            console.log(`🎯 TimelineController → Motor jumpToStep(${clampedPosition})`);
            this.audioEngine.playbackManager.jumpToStep(clampedPosition);
          } else {
            console.warn('⚠️ AudioEngine.playbackManager not available');
          }
        });
      }
    }

    // 4. NOTIFY STORES (for backwards compatibility)
    this._notifyStores(clampedPosition);

    // Reset interaction mode after a frame
    requestAnimationFrame(() => {
      this.state.interactionMode = INTERACTION_MODES.IDLE;
    });
  }

  /**
   * ✅ FIXED SMOOTH JUMP - Proper async sequence
   * Total latency: ~20-30ms (reliable)
   * Strategy: Await pause → Jump → Settle → Resume
   */
  async _smoothJumpWithPauseResume(targetPosition) {
    console.log(`⚡ Smooth jump to ${targetPosition}`);

    try {
      const wasPlaying = this.state.isPlaying;

      if (!wasPlaying) {
        // Not playing, instant jump
        if (this.audioEngine?.playbackManager) {
          this.audioEngine.playbackManager.jumpToStep(targetPosition);
        }
        return;
      }

      const playbackManager = this.audioEngine?.playbackManager;
      if (!playbackManager) return;

      // ✅ FIXED SEQUENCE - Proper awaits to prevent race conditions

      // 1. ✅ AWAIT pause to complete (prevents schedule conflicts)
      await playbackManager.pause();
      console.log('⏸️ Paused');

      // 2. Jump after pause completes
      playbackManager.jumpToStep(targetPosition);
      console.log(`🎯 Jumped to ${targetPosition}`);

      // 3. Small settle delay for audio context
      await new Promise(resolve => setTimeout(resolve, 10)); // 10ms settle

      // 4. Resume playback
      await playbackManager.play(targetPosition);
      console.log(`▶️ Resumed at ${targetPosition}`);

    } catch (error) {
      console.error('❌ Jump failed:', error);
      // Fallback
      this.audioEngine?.playbackManager?.jumpToStep(targetPosition);
    }
  }

  /**
   * ✅ NOTIFY STORES - Update PlaybackStore for backwards compatibility
   */
  _notifyStores(step) {
    try {
      // Import PlaybackStore dynamically to avoid circular dependencies
      import('@/store/usePlaybackStore').then(({ usePlaybackStore }) => {
        const store = usePlaybackStore.getState();

        // Convert step to bar:beat:tick format
        const beatPosition = step / 4;
        const bar = Math.floor(beatPosition / 4);
        const beat = Math.floor(beatPosition % 4);
        const tick = Math.floor((beatPosition % 1) * 480);
        const transportPos = `${bar + 1}:${beat + 1}:${tick}`;

        console.log(`🎯 TimelineController → Store.setTransportPosition(${transportPos}, ${step})`);

        if (store.setTransportPosition) {
          store.setTransportPosition(transportPos, step);
        }
      }).catch(error => {
        console.warn('Could not notify PlaybackStore:', error);
      });
    } catch (error) {
      console.warn('Failed to notify stores:', error);
    }
  }

  /**
   * ✅ SCRUB START
   * When user starts dragging the playhead
   */
  async scrubStart(position) {
    console.log(`🎵 Scrub start: position ${position}, isPlaying: ${this.state.isPlaying}`);

    this.state.interactionMode = INTERACTION_MODES.SCRUB;
    this.state.isScrubbing = true;

    // Store original playback state
    this.state.wasPlayingBeforeScrub = this.state.isPlaying;

    // If playing, pause for smooth scrubbing
    if (this.state.isPlaying && this.audioEngine?.playbackManager) {
      await this.audioEngine.playbackManager.pause();
      console.log('⏸️ Paused for scrubbing');
    }

    // Immediate UI update
    this._setPositionOptimistic(position);
    this._updateAllTimelinesPosition();

    this._emitStateChange('scrub-start');
  }

  /**
   * ✅ SCRUB UPDATE
   * High-frequency UI updates, throttled motor updates
   */
  scrubUpdate(position) {
    if (!this.state.isScrubbing) return;

    const clampedPosition = Math.max(0, position);

    // UI updates every frame (60fps)
    this._setPositionOptimistic(clampedPosition);
    this._updateAllTimelinesPosition();

    // Motor updates throttled (10fps max)
    const now = Date.now();
    if (now - this._lastMotorUpdate >= this._scrubThrottleMs) {
      this._lastMotorUpdate = now;

      if (this.audioEngine?.playbackManager) {
        this.audioEngine.playbackManager.jumpToStep(clampedPosition);
      }

      // Notify stores (throttled)
      this._notifyStores(clampedPosition);
    }
  }

  /**
   * ✅ SCRUB END - Ultra-fast resume
   * When user releases the playhead drag
   */
  async scrubEnd() {
    if (!this.state.isScrubbing) return;

    console.log(`⚡ Scrub end at ${this.state.currentPosition}`);

    this.state.isScrubbing = false;
    this.state.interactionMode = INTERACTION_MODES.IDLE;

    const playbackManager = this.audioEngine?.playbackManager;
    if (!playbackManager) return;

    // Final motor sync
    playbackManager.jumpToStep(this.state.currentPosition);

    // Ultra-fast resume if it was playing
    if (this.state.wasPlayingBeforeScrub) {
      // Single frame delay for audio settle
      await new Promise(resolve => requestAnimationFrame(resolve));

      await playbackManager.play(this.state.currentPosition);
      console.log('▶️ Resumed');
    }

    this.state.wasPlayingBeforeScrub = false;
    this._emitStateChange('scrub-end');
  }

  // =================== GHOST POSITION (Hover) ===================

  /**
   * ✅ SHOW GHOST POSITION
   * Ghost is SEPARATE from main playhead - only shows on hover
   */
  showGhostPosition(position) {
    this.state.ghostPosition = position;
    this.state.isHovering = true;
    // ✅ Update ONLY ghost, not main playhead
    this._updateAllTimelinesGhostOnly();
    this._emitStateChange('ghost-show');
  }

  /**
   * ✅ HIDE GHOST POSITION
   */
  hideGhostPosition() {
    this.state.ghostPosition = null;
    this.state.isHovering = false;
    // ✅ Update ONLY ghost, not main playhead
    this._updateAllTimelinesGhostOnly();
    this._emitStateChange('ghost-hide');
  }

  // =================== RANGE SELECTION ===================

  /**
   * ✅ SELECT RANGE
   */
  selectRange(start, end) {
    this.state.selectedRange = {
      start: Math.min(start, end),
      end: Math.max(start, end)
    };
    this._emitStateChange('range-select');
  }

  /**
   * ✅ CLEAR SELECTION
   */
  clearSelection() {
    this.state.selectedRange = null;
    this._emitStateChange('range-clear');
  }

  // =================== TIMELINE REGISTRATION ===================

  /**
   * ✅ REGISTER TIMELINE
   * Her panel (Channel Rack, Piano Roll, Arrangement) kendi timeline'ını register eder
   */
  registerTimeline(id, config) {
    const {
      element,
      stepWidth = 16,
      totalSteps = 64,
      onPositionChange = null,
      onGhostPositionChange = null, // ✅ FIX: Add ghost callback parameter
      onSeek = null, // ✅ NEW: Callback when user seeks to a position (for note preview)
      enableGhostPosition = true,
      enableRangeSelection = false,
      calculatePosition = null // ✅ Custom position calculation (for viewport scroll/zoom)
    } = config;

    this.timelines.set(id, {
      element,
      stepWidth,
      totalSteps,
      onPositionChange,
      onGhostPositionChange, // ✅ FIX: Store ghost callback
      onSeek, // ✅ NEW: Store seek callback
      enableGhostPosition,
      enableRangeSelection,
      calculatePosition, // ✅ Store custom calculation
      handlers: null // Will be populated by _setupTimelineInteraction
    });

    // Setup interaction handlers
    this._setupTimelineInteraction(id);

    // Initial position update
    this._updateTimelinePosition(id);
  }

  /**
   * ✅ UNREGISTER TIMELINE
   */
  unregisterTimeline(id) {
    const timeline = this.timelines.get(id);
    if (!timeline) return;

    // Cleanup event listeners
    if (timeline.handlers) {
      const { element, handlers } = timeline;
      element.removeEventListener('click', handlers.handleClick);
      element.removeEventListener('mousedown', handlers.handleMouseDown);
      element.removeEventListener('mousemove', handlers.handleMouseMove);
      element.removeEventListener('mouseleave', handlers.handleMouseLeave);
    }

    this.timelines.delete(id);
  }

  // =================== TIMELINE INTERACTION SETUP ===================

  /**
   * ✅ SETUP TIMELINE INTERACTION
   * Mouse events for click, drag, hover
   */
  _setupTimelineInteraction(id) {
    const timeline = this.timelines.get(id);
    if (!timeline) return;

    const { element, stepWidth, totalSteps, enableGhostPosition, enableRangeSelection, calculatePosition } = timeline;

    let isDragging = false;
    let dragStartPosition = null;

    // ✅ Helper to calculate position (use custom if provided)
    const getPositionFromMouse = (e) => {
      const rect = element.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (calculatePosition) {
        // Use custom calculation (for viewport scroll/zoom)
        return calculatePosition(mouseX, mouseY);
      } else {
        // Default calculation
        return this._calculateStep(mouseX, stepWidth, totalSteps);
      }
    };

    // Click handler - Seek to position
    const handleClick = (e) => {
      // Only handle if not dragging
      if (isDragging) return;

      const targetStep = getPositionFromMouse(e);
      if (targetStep !== null && targetStep !== undefined) {
        this.seekTo(targetStep, { timelineId: id }); // ✅ Pass timeline ID for onSeek callback
      }
    };

    // Mouse down - Start drag
    const handleMouseDown = (e) => {
      if (e.button !== 0) return; // Only left click

      const targetStep = getPositionFromMouse(e);
      if (targetStep === null || targetStep === undefined) return;

      isDragging = true;
      dragStartPosition = targetStep;

      if (enableRangeSelection && e.shiftKey) {
        // Range selection mode
        this.state.interactionMode = INTERACTION_MODES.SELECT_RANGE;
      } else {
        // Scrub mode
        this.scrubStart(targetStep);
      }

      e.preventDefault();
    };

    // Mouse move - Drag update or hover
    const handleMouseMove = (e) => {
      const targetStep = getPositionFromMouse(e);

      // ✅ If targetStep is null and not dragging, hide ghost (mouse moved to invalid area)
      if (targetStep === null || targetStep === undefined) {
        if (!isDragging && enableGhostPosition) {
          this.hideGhostPosition();
        }
        return;
      }

      if (isDragging) {
        // Dragging
        if (this.state.interactionMode === INTERACTION_MODES.SELECT_RANGE) {
          // Update range selection
          this.selectRange(dragStartPosition, targetStep);
        } else {
          // Update scrub position
          this.scrubUpdate(targetStep);
        }
      } else if (enableGhostPosition) {
        // Hover - show ghost position
        this.showGhostPosition(targetStep);
      }
    };

    // Mouse leave - Clear hover
    const handleMouseLeave = () => {
      if (enableGhostPosition) {
        this.hideGhostPosition();
      }
    };

    // Global mouse up - End drag
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        if (this.state.interactionMode === INTERACTION_MODES.SCRUB) {
          this.scrubEnd();
        }

        isDragging = false;
        dragStartPosition = null;
        this.state.interactionMode = INTERACTION_MODES.IDLE;
      }
    };

    // Attach event listeners
    element.addEventListener('click', handleClick);
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    // Store handlers for cleanup
    timeline.handlers = {
      handleClick,
      handleMouseDown,
      handleMouseMove,
      handleMouseLeave,
      handleGlobalMouseUp
    };
  }

  /**
   * ✅ CALCULATE STEP FROM PIXEL
   */
  _calculateStep(pixelX, stepWidth, maxSteps) {
    const exactStep = pixelX / stepWidth;
    const roundedStep = Math.round(exactStep * 100) / 100; // Round to 2 decimal places
    const finalStep = Math.round(roundedStep); // Then round to integer
    return Math.max(0, Math.min(maxSteps - 1, finalStep));
  }

  // =================== UI UPDATES ===================

  /**
   * ✅ UPDATE ALL TIMELINES POSITION (main playhead only)
   */
  _updateAllTimelinesPosition() {
    for (const [id] of this.timelines) {
      this._updateTimelinePosition(id);
    }
    this._emitStateChange('position-update');
  }

  /**
   * ✅ UPDATE ALL TIMELINES GHOST ONLY (don't touch main playhead)
   */
  _updateAllTimelinesGhostOnly() {
    for (const [id] of this.timelines) {
      this._updateTimelineGhostOnly(id);
    }
  }

  /**
   * ✅ UPDATE SINGLE TIMELINE POSITION (main playhead only)
   */
  _updateTimelinePosition(id) {
    const timeline = this.timelines.get(id);
    if (!timeline) return;

    const { onPositionChange } = timeline;

    // ✅ Update ONLY main playhead position, NOT ghost
    if (onPositionChange) {
      onPositionChange(this.state.currentPosition);
    }
  }

  /**
   * ✅ UPDATE SINGLE TIMELINE GHOST ONLY (separate callback)
   */
  _updateTimelineGhostOnly(id) {
    const timeline = this.timelines.get(id);
    if (!timeline || !timeline.enableGhostPosition) return;

    const { onGhostPositionChange } = timeline;

    // ✅ Separate callback for ghost updates
    if (onGhostPositionChange) {
      onGhostPositionChange(this.state.ghostPosition);
    }
  }

  // =================== MOTOR INTEGRATION ===================

  /**
   * ✅ QUEUE MOTOR UPDATE
   * Debounced motor updates to prevent overwhelming the audio engine
   */
  _queueMotorUpdate(callback) {
    // Clear pending update
    if (this._motorUpdateQueue) {
      clearTimeout(this._motorUpdateQueue);
    }

    // Queue new update
    this._motorUpdateQueue = setTimeout(() => {
      callback();
      this._motorUpdateQueue = null;
    }, this._motorUpdateDebounceMs);
  }

  /**
   * ✅ BIND MOTOR EVENTS
   */
  _bindMotorEvents() {
    // Motor position updates while playing
    // We'll sync motor position back to UI during playback
  }

  /**
   * ✅ SETUP UI UPDATES
   */
  _setupUIUpdates() {
    this.uiUpdateSubscription = uiUpdateManager.subscribe(
      'timeline-controller-position-tracking',
      (currentTime, frameTime) => {
        if (this.state.isPlaying && !this.state.isScrubbing) {
          this._updatePositionFromMotor();
        }
      },
      UPDATE_PRIORITIES.HIGH,
      UPDATE_FREQUENCIES.HIGH
    );
  }

  /**
   * ✅ UPDATE POSITION FROM MOTOR
   * ✅ INDUSTRY STANDARD: Use PlaybackManager position as source of truth
   * This ensures consistency with PlaybackController's position persistence system
   */
  _updatePositionFromMotor() {
    if (!this.audioEngine?.transport) return;

    // ✅ INDUSTRY STANDARD: Use PlaybackManager position (same as PlaybackController)
    // This ensures TimelineController stays in sync with PlaybackController
    // PlaybackManager maintains correct position even when transport resets
    const playbackManager = this.audioEngine.playbackManager;
    let newPosition;
    
    if (playbackManager?.currentPosition !== undefined) {
      // Use PlaybackManager position (more reliable, especially at play start)
      newPosition = playbackManager.currentPosition;
    } else {
      // Fallback to transport position if manager not available
      newPosition = this.audioEngine.transport.ticksToSteps(
        this.audioEngine.transport.currentTick
      );
    }

    // Only update if significant change
    if (Math.abs(newPosition - this.state.currentPosition) > 0.05) {
      this._setPositionOptimistic(newPosition);
      this._updateAllTimelinesPosition();
    }
  }

  /**
   * ✅ START POSITION TRACKING
   */
  _startPositionTracking() {
    // Position tracking is handled by UI update subscription
  }

  /**
   * ✅ STOP POSITION TRACKING
   */
  _stopPositionTracking() {
    // Position tracking is handled by UI update subscription
  }

  // =================== INTERNAL STATE MANAGEMENT ===================

  /**
   * ✅ SET POSITION (Optimistic)
   */
  _setPositionOptimistic(position) {
    this.state.currentPosition = Math.max(0, position);
    this.state.lastUpdateTime = Date.now();
  }

  // =================== EVENT SYSTEM ===================

  /**
   * ✅ SUBSCRIBE TO STATE CHANGES
   */
  subscribe(callback) {
    this.subscribers.add(callback);

    // Send initial state
    callback({
      type: 'init',
      state: this.getState(),
      timestamp: Date.now()
    });

    return () => this.subscribers.delete(callback);
  }

  /**
   * ✅ EMIT STATE CHANGE
   */
  _emitStateChange(reason) {
    const event = {
      type: 'state-change',
      state: this.getState(),
      reason,
      timestamp: Date.now()
    };

    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('🎯 TimelineController subscriber error:', error);
      }
    });
  }

  // =================== PUBLIC API ===================

  /**
   * ✅ GET STATE
   */
  getState() {
    return { ...this.state };
  }

  /**
   * ✅ GET CURRENT POSITION
   */
  getCurrentPosition() {
    return this.state.currentPosition;
  }

  /**
   * ✅ GET GHOST POSITION
   */
  getGhostPosition() {
    return this.state.ghostPosition;
  }

  /**
   * ✅ SETTINGS
   */
  setBPM(bpm) {
    // ✅ FIX: Remove BPM restrictions - only ensure positive value
    if (bpm <= 0 || isNaN(bpm)) {
      console.warn('Invalid BPM value:', bpm);
      return;
    }
    this.state.bpm = bpm;
    if (this.audioEngine?.setBPM) {
      this.audioEngine.setBPM(this.state.bpm);
    }
    this._emitStateChange('bpm-change');
  }

  setLoopRange(start, end) {
    this.state.loopStart = Math.max(0, start);
    this.state.loopEnd = Math.max(start + 1, end);
    if (this.audioEngine?.transport) {
      this.audioEngine.transport.loopStart = start;
      this.audioEngine.transport.loopEnd = end;
    }
    this._emitStateChange('loop-change');
  }

  setLoopEnabled(enabled) {
    this.state.loopEnabled = enabled;
    if (this.audioEngine?.transport) {
      this.audioEngine.transport.loop = enabled;
    }
    this._emitStateChange('loop-change');
  }

  // =================== CLEANUP ===================

  /**
   * ✅ DESTROY
   */
  destroy() {
    this.isDestroyed = true;

    // Cleanup UI updates
    if (this.uiUpdateSubscription) {
      this.uiUpdateSubscription();
      this.uiUpdateSubscription = null;
    }

    // Cleanup motor update queue
    if (this._motorUpdateQueue) {
      clearTimeout(this._motorUpdateQueue);
      this._motorUpdateQueue = null;
    }

    // Unregister all timelines
    for (const [id] of this.timelines) {
      this.unregisterTimeline(id);
    }

    // Clear references
    this.timelines.clear();
    this.subscribers.clear();
    this.audioEngine = null;
  }
}
