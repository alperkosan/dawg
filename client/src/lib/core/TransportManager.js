// lib/core/TransportManager.js
/**
 * 🎚️ UNIFIED TRANSPORT MANAGEMENT SYSTEM
 *
 * Tek merkezi sistem - maximum korelasyon:
 * - Tüm transport kontrolları (play/pause/stop)
 * - Tüm pozisyon yönetimi (timeline, playhead)
 * - Tüm UI feedback (butonlar, göstergeler)
 * - Tüm keyboard shortcuts
 * - Tüm timeline interactions
 */

import { PLAYBACK_STATES } from '@/config/constants.js';
import ShortcutManager, { SHORTCUT_PRIORITY } from './ShortcutManager';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { uiUpdateManager, UPDATE_PRIORITIES, UPDATE_FREQUENCIES } from './UIUpdateManager.js';

// Precise step calculation to avoid floating point errors
const calculateStep = (clickX, stepWidth, maxStep) => {
  const exactStep = clickX / stepWidth;
  const roundedStep = Math.round(exactStep * 100) / 100; // Round to 2 decimal places first
  const finalStep = Math.round(roundedStep); // Then round to integer
  return Math.max(0, Math.min(maxStep, finalStep));
};

export class TransportManager {
  constructor(audioEngine) {
    // ✅ SINGLE SOURCE OF TRUTH - TÜM TRANSPORT STATE
    this.state = {
      // Core transport
      isPlaying: false,
      playbackState: PLAYBACK_STATES.STOPPED,

      // Position (unified - step cinsinden)
      currentPosition: 0,
      ghostPosition: null,

      // Transport settings
      bpm: 140,
      loopEnabled: true,
      loopStart: 0,
      loopEnd: 64,

      // UI state
      isUserScrubbing: false,

      // Timeline settings
      stepWidth: 16, // pixel per step

      // Metadata
      lastUpdateTime: 0
    };

    this.audioEngine = audioEngine;
    this.subscribers = new Set();
    this.positionTimer = null;
    this.positionTrackingSubscription = null;
    this._needsUIRefresh = false;
    this.uiUpdateUnsubscribe = null;

    // ✅ MEMORY LEAK FIX: Store cleanup functions
    this.keyboardCleanup = null;
    this.isDestroyed = false;

    // ✅ KEYBOARD PIANO MODE: When active, disable global shortcuts
    this.keyboardPianoModeActive = false;

    // ✅ AUTO-SYNC: Musical Typing state
    usePlaybackStore.subscribe((state) => {
      this.keyboardPianoModeActive = state.keyboardPianoMode;
    });

    // UI element references - tüm transport UI'ları buradan yönetilecek
    this.transportButtons = new Map(); // button-id -> element
    this.playheadElements = new Map(); // playhead-id -> element
    this.timelineElements = new Map(); // timeline-id -> element

    this._bindAudioEvents();
    this._setupGlobalKeyboardShortcuts();
    this._setupUIUpdateManager();

  }

  // =================== UI UPDATE MANAGER SETUP ===================

  /**
   * ✅ UNIFIED UI UPDATE MANAGER - Single subscription for all transport UI
   * Consolidates previous 2 separate subscriptions (30fps + 60fps) into one
   */
  _setupUIUpdateManager() {
    // Single unified subscription at 60fps for smooth playhead
    this.uiUpdateUnsubscribe = uiUpdateManager.subscribe(
      'transport-unified',
      this._handleUnifiedUpdate.bind(this),
      UPDATE_PRIORITIES.HIGH,
      UPDATE_FREQUENCIES.HIGH // 60fps - single source of UI updates
    );
  }

  /**
   * ✅ UNIFIED UPDATE HANDLER - Handles all transport UI updates
   * Replaces both _handleUIUpdate and _updatePositionFromAudio
   */
  _handleUnifiedUpdate(currentTime, frameTime) {
    // Skip if not playing and no refresh needed
    const needsUpdate = this.state.isPlaying || this._needsUIRefresh;
    if (!needsUpdate) return;

    // Skip if user is scrubbing
    if (this.state.isUserScrubbing) return;

    // Get position from audio engine
    if (this.audioEngine?.transport) {
      const newPosition = this.audioEngine.transport.ticksToSteps(
        this.audioEngine.transport.currentTick
      );

      // Only update if significant change (avoids jitter)
      if (Math.abs(newPosition - this.state.currentPosition) > 0.05) {
        this.state.currentPosition = newPosition;
        this.state.lastUpdateTime = Date.now();

        // Batched UI updates
        this._updateAllPlayheadsBatched();
        this._updateAllTimelinesBatched();
        this._emitPositionUpdate();
      }
    }

    // Reset UI refresh flag
    this._needsUIRefresh = false;
  }

  /**
   * ✅ BATCHED PLAYHEAD UPDATES
   */
  _updateAllPlayheadsBatched() {
    const displayPosition = this.state.ghostPosition ?? this.state.currentPosition;

    for (const [id, playhead] of this.playheadElements) {
      const { element, stepWidth } = playhead;
      const pixelPosition = displayPosition * stepWidth;

      // Queue batched style update instead of direct DOM manipulation
      uiUpdateManager.queueStyleUpdate(element, {
        transform: `translate3d(${pixelPosition}px, 0, 0)`
      });
    }
  }

  /**
   * ✅ BATCHED TIMELINE UPDATES
   */
  _updateAllTimelinesBatched() {
    // Timeline updates are less frequent, can be batched too
    for (const [id, timeline] of this.timelineElements) {
      const { element, updateCallback } = timeline;

      if (updateCallback) {
        // Call timeline's update callback
        updateCallback(this.state.currentPosition, this.state.ghostPosition);
      }
    }
  }

  /**
   * ✅ REQUEST UI REFRESH
   */
  _requestUIRefresh() {
    this._needsUIRefresh = true;
  }

  // =================== CORE TRANSPORT COMMANDS ===================

  /**
   * ✅ UNIFIED PLAY
   */
  async play(startPosition = null) {

    if (this.state.isPlaying) {
      return false;
    }

    try {
      // Clear ghost position for clean playback start
      this.clearGhostPosition();

      // Set position if specified
      if (startPosition !== null) {
        this.state.currentPosition = Math.max(0, startPosition);
      }

      // Start audio engine
      await this.audioEngine.playbackFacade.play(this.state.currentPosition);

      // Update state
      this.state.isPlaying = true;
      this.state.playbackState = PLAYBACK_STATES.PLAYING;
      this.state.lastUpdateTime = Date.now();

      // Start position tracking via UIUpdateManager
      this._startPositionTrackingNew();

      // Update ALL UI elements
      this._updateAllTransportUI('play');
      this._emitStateChange('play');

      return true;
    } catch (error) {
      console.error('🎚️ Play failed:', error);
      return false;
    }
  }

  /**
   * ✅ UNIFIED PAUSE
   */
  async pause() {

    if (!this.state.isPlaying) return false;

    try {
      await this.audioEngine.playbackFacade.pause();

      this.state.isPlaying = false;
      this.state.playbackState = PLAYBACK_STATES.PAUSED;
      this.state.lastUpdateTime = Date.now();

      this._stopPositionTrackingNew();
      this._updateAllTransportUI('pause');
      this._emitStateChange('pause');

      return true;
    } catch (error) {
      console.error('🎚️ Pause failed:', error);
      return false;
    }
  }

  /**
   * ✅ UNIFIED STOP - Smart behavior with double-click reset
   */
  async stop() {

    try {
      const now = Date.now();
      const timeSinceLastStop = now - (this.state.lastStopTime || 0);

      await this.audioEngine.playbackFacade.stop();

      this.state.isPlaying = false;
      this.state.playbackState = PLAYBACK_STATES.STOPPED;

      // ✅ CONSISTENT STOP BEHAVIOR - Always reset to 0 for predictable behavior
      this.state.currentPosition = 0;

      this.state.lastStopTime = now;
      this.state.lastUpdateTime = Date.now();

      // Clear ghost position for clean stop state
      this.clearGhostPosition();

      this._stopPositionTrackingNew();
      this._updateAllTransportUI('stop');
      this._emitStateChange('stop');
      this._emitPositionUpdate();

      return true;
    } catch (error) {
      console.error('🎚️ Stop failed:', error);
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
        return await this.play(this.state.currentPosition);
    }
  }

  // =================== POSITION MANAGEMENT ===================

  /**
   * ✅ UNIFIED POSITION JUMP
   */
  jumpToPosition(position, options = {}) {
    const { updateUI = true } = options; // Removed smooth parameter - always immediate


    const oldPosition = this.state.currentPosition;
    const newPosition = Math.max(0, position);
    this.state.currentPosition = newPosition;


    // ✅ SIMPLIFIED: Always immediate jump, no smooth complexity
    if (this.audioEngine?.playbackFacade) {
      this.audioEngine.playbackFacade.jumpToStep(newPosition); // No await - fire and forget
    }

    if (updateUI) {
      this._updateAllPlayheadsBatched();
      this._updateAllTimelinesBatched();
    }

    this._emitPositionUpdate();
  }

  /**
   * ✅ GHOST POSITION (timeline hover)
   */
  setGhostPosition(position) {
    this.state.ghostPosition = position;
    this._updateAllPlayheadsBatched(); // Update ghost playheads
    this._emitGhostUpdate();
  }

  clearGhostPosition() {
    this.state.ghostPosition = null;
    this._updateAllPlayheadsBatched();
    this._emitGhostUpdate();
  }

  // =================== UI REGISTRATION & MANAGEMENT ===================

  /**
   * ✅ REGISTER TRANSPORT BUTTON
   */
  registerTransportButton(id, element, type) {
    this.transportButtons.set(id, { element, type });
    this._updateTransportButton(id);
  }

  /**
   * ✅ REGISTER PLAYHEAD
   */
  registerPlayhead(id, element, stepWidth = 16) {
    this.playheadElements.set(id, { element, stepWidth });
    this._updatePlayhead(id);
  }

  /**
   * ✅ REGISTER TIMELINE
   */
  registerTimeline(id, element, config = {}) {
    this.timelineElements.set(id, { element, ...config });
    this._setupTimelineInteraction(id);
  }

  /**
   * ✅ UNREGISTER UI ELEMENTS - MEMORY LEAK FIXED
   */
  unregisterElement(id) {
    // ✅ MEMORY LEAK FIX: Clean up timeline event listeners
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

  // =================== UI UPDATE METHODS ===================

  /**
   * ✅ UPDATE ALL TRANSPORT UI
   */
  _updateAllTransportUI(action) {

    // Update all transport buttons
    for (const [id] of this.transportButtons) {
      this._updateTransportButton(id);
    }

    // Update all playheads
    this._updateAllPlayheadsBatched();

    // Update all timelines
    this._updateAllTimelinesBatched();
  }

  /**
   * ✅ UPDATE TRANSPORT BUTTON
   */
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
    switch (this.state.playbackState) {
      case PLAYBACK_STATES.PLAYING:
        if (type === 'play' || type === 'toggle') {
          element.classList.add('transport-btn--playing');
        }
        break;
      case PLAYBACK_STATES.PAUSED:
        if (type === 'play' || type === 'toggle') {
          element.classList.add('transport-btn--paused');
        }
        break;
      case PLAYBACK_STATES.STOPPED:
        if (type === 'stop') {
          element.classList.add('transport-btn--stopped');
        }
        break;
    }
  }


  /**
   * ✅ UPDATE SINGLE PLAYHEAD
   */
  _updatePlayhead(id) {
    const playhead = this.playheadElements.get(id);
    if (!playhead) return;

    const { element, stepWidth } = playhead;

    // Use ghost position if available, otherwise current position
    const displayPosition = this.state.ghostPosition ?? this.state.currentPosition;
    const pixelPosition = displayPosition * stepWidth;

    element.style.transform = `translate3d(${pixelPosition}px, 0, 0)`;

    // Update playhead state classes
    element.classList.toggle('playhead--playing', this.state.isPlaying);
    element.classList.toggle('playhead--stopped', this.state.playbackState === PLAYBACK_STATES.STOPPED);
  }


  /**
   * ✅ UPDATE SINGLE TIMELINE
   */
  _updateTimeline(id) {
    const timeline = this.timelineElements.get(id);
    if (!timeline) return;

    // Timeline update logic (position indicators, etc.)
    // This can be expanded based on timeline needs
  }

  // =================== TIMELINE INTERACTION ===================

  /**
   * ✅ SETUP TIMELINE INTERACTION
   */
  _setupTimelineInteraction(id) {
    const timeline = this.timelineElements.get(id);
    if (!timeline) return;

    const { element, stepWidth = 16, audioLoopLength = 64 } = timeline;

    // Click handler - Only allow position changes when stopped or paused
    const handleClick = async (e) => {
      const rect = element.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const exactStep = clickX / stepWidth;
      const targetStep = calculateStep(clickX, stepWidth, audioLoopLength - 1);


      // ✅ UNIFIED: Use jumpToPosition for consistency

      // Use the unified jumpToPosition method (no await for fire-and-forget)
      this.jumpToPosition(targetStep, { updateUI: true });
    };

    // Hover handler
    const handleMouseMove = async (e) => {
      const rect = element.getBoundingClientRect();
      const hoverX = e.clientX - rect.left;
      const hoverStep = calculateStep(hoverX, stepWidth, audioLoopLength - 1);

      this.setGhostPosition(hoverStep);
    };

    // Mouse leave handler
    const handleMouseLeave = () => {
      this.clearGhostPosition();
    };

    element.addEventListener('click', handleClick);
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);

    // Store handlers for cleanup
    timeline.handlers = { handleClick, handleMouseMove, handleMouseLeave };
  }

  // =================== KEYBOARD SHORTCUTS ===================

  /**
   * ✅ GLOBAL KEYBOARD SHORTCUTS - MIGRATED TO SHORTCUTMANAGER
   */
  _setupGlobalKeyboardShortcuts() {
    ShortcutManager.registerContext('TRANSPORT', SHORTCUT_PRIORITY.GLOBAL + 1, {
      onKeyDown: (e) => {
        // ✅ IGNORE SHORTCUTS when keyboard piano mode is active
        if (this.keyboardPianoModeActive) {
          return false;
        }

        switch (e.key) {
          case ' ': // Spacebar
            e.preventDefault();
            // Toggle via store for consistency
            import('@/store/usePlaybackStore').then(({ usePlaybackStore }) => {
              usePlaybackStore.getState().togglePlayPause();
            });
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

    // Cleanup function
    this.keyboardCleanup = () => {
      ShortcutManager.unregisterContext('TRANSPORT');
    };
  }

  // =================== POSITION TRACKING ===================
  // ✅ OPTIMIZATION: Position tracking now handled by unified _handleUnifiedUpdate
  // These methods are kept for backward compatibility but are no-ops

  _startPositionTrackingNew() {
    // No-op: Position updates now handled by unified UIUpdateManager subscription
    // The 'transport-unified' subscription runs at 60fps and handles all updates
  }

  _stopPositionTrackingNew() {
    // No-op: Unified subscription handles lifecycle
  }

  // =================== AUDIO ENGINE INTEGRATION ===================

  _bindAudioEvents() {
    // Note: We use manual state management to avoid conflicts
  }

  // =================== EVENT SYSTEM ===================

  /**
   * ✅ SUBSCRIBE TO ALL CHANGES
   */
  subscribe(callback) {
    this.subscribers.add(callback);

    // Send initial state
    callback({
      type: 'state-change',
      state: { ...this.state },
      timestamp: Date.now()
    });

    return () => this.subscribers.delete(callback);
  }

  _emitStateChange(reason) {
    const event = {
      type: 'state-change',
      state: { ...this.state },
      reason,
      timestamp: Date.now()
    };


    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('🎚️ Subscriber error:', error);
      }
    });
  }

  _emitPositionUpdate() {
    const event = {
      type: 'position-update',
      position: this.state.currentPosition,
      timestamp: Date.now()
    };

    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('🎚️ Position subscriber error:', error);
      }
    });
  }

  _emitGhostUpdate() {
    const event = {
      type: 'ghost-position-change',
      ghostPosition: this.state.ghostPosition,
      timestamp: Date.now()
    };

    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('🎚️ Ghost subscriber error:', error);
      }
    });
  }

  // =================== PUBLIC API ===================

  /**
   * ✅ GET CURRENT STATE
   */
  getState() {
    return { ...this.state };
  }

  /**
   * ✅ GET CURRENT POSITION
   * Always returns the actual current position (not ghost)
   */
  getCurrentPosition() {
    return this.state.currentPosition;
  }

  /**
   * ✅ GET CURRENT STEP (alias for getCurrentPosition)
   * For API compatibility with AutomationScheduler and other systems
   */
  getCurrentStep() {
    return this.state.currentPosition;
  }

  /**
   * ✅ GET PLAYING STATE
   * For API compatibility - allows direct access to isPlaying
   */
  get isPlaying() {
    return this.state.isPlaying;
  }

  /**
   * ✅ GET GHOST POSITION
   * Returns ghost position for UI hover effects
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

    // ✅ FIXED - Use audioEngine.setBPM instead of playbackManager
    if (this.audioEngine?.setBPM) {
      this.audioEngine.setBPM(this.state.bpm);
    } else if (this.audioEngine?.transport?.setBPM) {
      this.audioEngine.transport.setBPM(this.state.bpm);
    }

    this._emitStateChange('bpm-change');
  }

  setLoopRange(start, end) {
    this.state.loopStart = Math.max(0, start);
    this.state.loopEnd = Math.max(start + 1, end);

    // ✅ FIXED - Use proper audio engine methods
    if (this.audioEngine?.transport) {
      this.audioEngine.transport.loopStart = start;
      this.audioEngine.transport.loopEnd = end;
    }

    this._emitStateChange('loop-change');
  }

  setLoopEnabled(enabled) {
    this.state.loopEnabled = enabled;

    // ✅ FIXED - Use proper audio engine methods
    if (this.audioEngine?.transport) {
      this.audioEngine.transport.loop = enabled;
    }

    this._emitStateChange('loop-change');
  }

  /**
   * ✅ KEYBOARD PIANO MODE CONTROL
   * When keyboard piano mode is active, global shortcuts are disabled
   */
  setKeyboardPianoMode(active) {
    this.keyboardPianoModeActive = active;
  }

  getKeyboardPianoMode() {
    return this.keyboardPianoModeActive;
  }

  /**
   * ✅ CLEANUP - COMPREHENSIVE MEMORY LEAK FIXES
   */
  destroy() {
    // ✅ MEMORY LEAK FIX: Mark as destroyed to prevent further operations
    this.isDestroyed = true;

    // ✅ MEMORY LEAK FIX: Stop all tracking subscriptions
    this._stopPositionTrackingNew();

    // ✅ MEMORY LEAK FIX: Cleanup UIUpdateManager subscription
    if (this.uiUpdateUnsubscribe) {
      this.uiUpdateUnsubscribe();
      this.uiUpdateUnsubscribe = null;
    }

    // ✅ MEMORY LEAK FIX: Cleanup keyboard shortcuts
    if (this.keyboardCleanup) {
      this.keyboardCleanup();
      this.keyboardCleanup = null;
    }

    // Cleanup timeline event listeners
    for (const [id, timeline] of this.timelineElements) {
      const { element, handlers } = timeline;
      if (handlers) {
        element.removeEventListener('click', handlers.handleClick);
        element.removeEventListener('mousemove', handlers.handleMouseMove);
        element.removeEventListener('mouseleave', handlers.handleMouseLeave);
      }
    }

    // ✅ MEMORY LEAK FIX: Clear all references
    this.transportButtons.clear();
    this.playheadElements.clear();
    this.timelineElements.clear();
    this.subscribers.clear();
    this.audioEngine = null;

  }

  // =================== OPTIMISTIC UPDATES FOR ZERO-LATENCY UI ===================

  /**
   * ✅ OPTIMISTIC STATE UPDATE - UI responds instantly
   * Motor will confirm/correct later via events
   */
  _updateStateOptimistic(updates) {
    this.previousState = { ...this.state };
    Object.assign(this.state, updates);
    this._emitStateChange('optimistic-update');
  }

  /**
   * ✅ CONFIRM OPTIMISTIC UPDATE - Motor confirmed our optimistic state
   */
  _confirmOptimisticUpdate(motorState) {
    // Motor confirmed our optimistic update was correct
    this.previousState = null;
    Object.assign(this.state, motorState);
    this._emitStateChange('motor-confirmed');
  }

  /**
   * ✅ ROLLBACK OPTIMISTIC UPDATE - Motor disagreed, restore previous state
   */
  _rollbackOptimisticUpdate() {
    if (this.previousState) {
      this.state = { ...this.previousState };
      this.previousState = null;
      this._emitStateChange('optimistic-rollback');
    }
  }

  /**
   * ✅ MOTOR POSITION SYNC - Motor is master clock
   */
  _syncPosition(motorPosition) {
    if (Math.abs(motorPosition - this.state.currentPosition) > 0.01) {
      this.state.currentPosition = motorPosition;
      this._emitPositionUpdate();
    }
  }

  /**
   * ✅ MOTOR BPM SYNC
   */
  _syncBpm(motorBpm) {
    if (Math.abs(motorBpm - this.state.bpm) > 0.1) {
      this.state.bpm = motorBpm;
      this._emitStateChange('motor-bpm-sync');
    }
  }

  /**
   * ✅ FORCE SYNC TO MOTOR - Emergency sync
   */
  _forceSyncState(motorState) {
    this.state = { ...this.state, ...motorState };
    this.previousState = null;
    this._emitStateChange('force-sync');
  }
}