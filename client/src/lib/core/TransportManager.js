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

import { PLAYBACK_STATES } from '../../config/constants.js';

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

    // UI element references - tüm transport UI'ları buradan yönetilecek
    this.transportButtons = new Map(); // button-id -> element
    this.playheadElements = new Map(); // playhead-id -> element
    this.timelineElements = new Map(); // timeline-id -> element

    this._bindAudioEvents();
    this._setupGlobalKeyboardShortcuts();

    console.log('🎚️ TransportManager: Unified system initialized');
  }

  // =================== CORE TRANSPORT COMMANDS ===================

  /**
   * ✅ UNIFIED PLAY
   */
  async play(startPosition = null) {
    console.log(`🎚️ TransportManager.play(${startPosition})`);

    if (this.state.isPlaying) {
      console.log('🎚️ Already playing');
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
      await this.audioEngine.playbackManager.play(this.state.currentPosition);

      // Update state
      this.state.isPlaying = true;
      this.state.playbackState = PLAYBACK_STATES.PLAYING;
      this.state.lastUpdateTime = Date.now();

      // Start position tracking
      this._startPositionTracking();

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
    console.log('🎚️ TransportManager.pause()');

    if (!this.state.isPlaying) return false;

    try {
      await this.audioEngine.playbackManager.pause();

      this.state.isPlaying = false;
      this.state.playbackState = PLAYBACK_STATES.PAUSED;
      this.state.lastUpdateTime = Date.now();

      this._stopPositionTracking();
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
    console.log('🎚️ TransportManager.stop()');

    try {
      const now = Date.now();
      const timeSinceLastStop = now - (this.state.lastStopTime || 0);

      await this.audioEngine.playbackManager.stop();

      this.state.isPlaying = false;
      this.state.playbackState = PLAYBACK_STATES.STOPPED;

      // ✅ CONSISTENT STOP BEHAVIOR - Always reset to 0 for predictable behavior
      this.state.currentPosition = 0;
      console.log('🎚️ Stop: Reset to position 0 (consistent behavior)');

      this.state.lastStopTime = now;
      this.state.lastUpdateTime = Date.now();

      // Clear ghost position for clean stop state
      this.clearGhostPosition();

      this._stopPositionTracking();
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
    console.log(`🎚️ TransportManager.togglePlayPause() - current: ${this.state.playbackState}`);

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

    console.log(`🎚️ TransportManager.jumpToPosition(${position}) precision:`, {
      inputPosition: position,
      newPosition: Math.max(0, position),
      beforeState: this.state.currentPosition
    });

    const oldPosition = this.state.currentPosition;
    const newPosition = Math.max(0, position);
    this.state.currentPosition = newPosition;

    console.log(`🎚️ Position updated:`, {
      from: oldPosition,
      to: newPosition,
      changed: oldPosition !== newPosition
    });

    // ✅ SIMPLIFIED: Always immediate jump, no smooth complexity
    if (this.audioEngine?.playbackManager) {
      console.log(`🎚️ Updating audio engine position to: ${newPosition} (immediate)`);
      this.audioEngine.playbackManager.jumpToStep(newPosition); // No await - fire and forget
      console.log(`🎚️ Audio engine position updated`);
    }

    if (updateUI) {
      this._updateAllPlayheads();
      this._updateAllTimelines();
    }

    this._emitPositionUpdate();
  }

  /**
   * ✅ GHOST POSITION (timeline hover)
   */
  setGhostPosition(position) {
    this.state.ghostPosition = position;
    this._updateAllPlayheads(); // Update ghost playheads
    this._emitGhostUpdate();
  }

  clearGhostPosition() {
    this.state.ghostPosition = null;
    this._updateAllPlayheads();
    this._emitGhostUpdate();
  }

  // =================== UI REGISTRATION & MANAGEMENT ===================

  /**
   * ✅ REGISTER TRANSPORT BUTTON
   */
  registerTransportButton(id, element, type) {
    console.log(`🎚️ Registering transport button: ${id} (${type})`);
    this.transportButtons.set(id, { element, type });
    this._updateTransportButton(id);
  }

  /**
   * ✅ REGISTER PLAYHEAD
   */
  registerPlayhead(id, element, stepWidth = 16) {
    console.log(`🎚️ Registering playhead: ${id}`);
    this.playheadElements.set(id, { element, stepWidth });
    this._updatePlayhead(id);
  }

  /**
   * ✅ REGISTER TIMELINE
   */
  registerTimeline(id, element, config = {}) {
    console.log(`🎚️ Registering timeline: ${id}`);
    this.timelineElements.set(id, { element, ...config });
    this._setupTimelineInteraction(id);
  }

  /**
   * ✅ UNREGISTER UI ELEMENTS
   */
  unregisterElement(id) {
    this.transportButtons.delete(id);
    this.playheadElements.delete(id);
    this.timelineElements.delete(id);
  }

  // =================== UI UPDATE METHODS ===================

  /**
   * ✅ UPDATE ALL TRANSPORT UI
   */
  _updateAllTransportUI(action) {
    console.log(`🎚️ Updating all transport UI for: ${action}`);

    // Update all transport buttons
    for (const [id] of this.transportButtons) {
      this._updateTransportButton(id);
    }

    // Update all playheads
    this._updateAllPlayheads();

    // Update all timelines
    this._updateAllTimelines();
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
   * ✅ UPDATE ALL PLAYHEADS
   */
  _updateAllPlayheads() {
    for (const [id] of this.playheadElements) {
      this._updatePlayhead(id);
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
   * ✅ UPDATE ALL TIMELINES
   */
  _updateAllTimelines() {
    for (const [id] of this.timelineElements) {
      this._updateTimeline(id);
    }
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

      console.log(`🎚️ TransportManager timeline precision:`, {
        clickX,
        exactStep,
        targetStep,
        stepWidth,
        audioLoopLength,
        roundingDiff: exactStep - targetStep,
        preciseCalculation: true
      });

      // ✅ UNIFIED: Use jumpToPosition for consistency
      console.log(`🎚️ Timeline click: Using unified jumpToPosition to ${targetStep} (${this.state.playbackState})`);

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
   * ✅ GLOBAL KEYBOARD SHORTCUTS
   */
  _setupGlobalKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't interfere with text inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case ' ': // Spacebar
          e.preventDefault();
          this.togglePlayPause();
          break;
        case 'Numpad0':
        case 'Insert':
          e.preventDefault();
          this.stop();
          break;
      }
    });
  }

  // =================== POSITION TRACKING ===================

  _startPositionTracking() {
    if (this.positionTimer) return;

    // ✅ PERFORMANCE OPTIMIZED - Throttled position updates
    let lastUpdateTime = 0;
    const updateThrottle = 16.67; // ~60fps (instead of RAF which can be 120fps+)
    let frameSkipCounter = 0;

    const update = (currentTime) => {
      if (!this.state.isPlaying || this.state.isUserScrubbing) {
        this._stopPositionTracking();
        return;
      }

      // ✅ THROTTLE: Skip frames for performance
      if (currentTime - lastUpdateTime < updateThrottle) {
        this.positionTimer = requestAnimationFrame(update);
        return;
      }

      // ✅ FRAME SKIP: Update every 2nd frame to reduce CPU load
      frameSkipCounter++;
      if (frameSkipCounter % 2 !== 0) {
        this.positionTimer = requestAnimationFrame(update);
        return;
      }

      lastUpdateTime = currentTime;

      // Get position from audio engine (cached)
      if (this.audioEngine?.transport) {
        const newPosition = this.audioEngine.transport.ticksToSteps(
          this.audioEngine.transport.currentTick
        );

        // ✅ PRECISION: Only update if significant change
        if (Math.abs(newPosition - this.state.currentPosition) > 0.05) {
          this.state.currentPosition = newPosition;
          this._updateAllPlayheads();
          this._emitPositionUpdate();
        }
      }

      this.positionTimer = requestAnimationFrame(update);
    };

    this.positionTimer = requestAnimationFrame(update);
  }

  _stopPositionTracking() {
    if (this.positionTimer) {
      cancelAnimationFrame(this.positionTimer);
      this.positionTimer = null;
    }
  }

  // =================== AUDIO ENGINE INTEGRATION ===================

  _bindAudioEvents() {
    // Note: We use manual state management to avoid conflicts
    console.log('🎚️ Audio engine events bound (manual state management)');
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

    console.log(`🎚️ TransportManager event (${reason}):`, {
      playbackState: this.state.playbackState,
      isPlaying: this.state.isPlaying,
      currentPosition: this.state.currentPosition
    });

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
    this.state.bpm = Math.max(60, Math.min(300, bpm));

    // ✅ FIXED - Use audioEngine.setBPM instead of playbackManager
    if (this.audioEngine?.setBPM) {
      this.audioEngine.setBPM(this.state.bpm);
    } else if (this.audioEngine?.transport?.setBPM) {
      this.audioEngine.transport.setBPM(this.state.bpm);
    }

    this._emitStateChange('bpm-change');
    console.log(`🎚️ BPM set to: ${this.state.bpm}`);
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
    console.log(`🎚️ Loop range set: ${start} - ${end}`);
  }

  setLoopEnabled(enabled) {
    this.state.loopEnabled = enabled;

    // ✅ FIXED - Use proper audio engine methods
    if (this.audioEngine?.transport) {
      this.audioEngine.transport.loop = enabled;
    }

    this._emitStateChange('loop-change');
    console.log(`🎚️ Loop enabled: ${enabled}`);
  }

  /**
   * ✅ CLEANUP
   */
  destroy() {
    this._stopPositionTracking();

    // Cleanup timeline event listeners
    for (const [id, timeline] of this.timelineElements) {
      const { element, handlers } = timeline;
      if (handlers) {
        element.removeEventListener('click', handlers.handleClick);
        element.removeEventListener('mousemove', handlers.handleMouseMove);
        element.removeEventListener('mouseleave', handlers.handleMouseLeave);
      }
    }

    this.transportButtons.clear();
    this.playheadElements.clear();
    this.timelineElements.clear();
    this.subscribers.clear();
    this.audioEngine = null;

    console.log('🎚️ TransportManager destroyed');
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
    console.log('🎚️ TransportManager: Optimistic update', updates);
  }

  /**
   * ✅ CONFIRM OPTIMISTIC UPDATE - Motor confirmed our optimistic state
   */
  _confirmOptimisticUpdate(motorState) {
    // Motor confirmed our optimistic update was correct
    this.previousState = null;
    Object.assign(this.state, motorState);
    this._emitStateChange('motor-confirmed');
    console.log('🎚️ TransportManager: Motor confirmed state', motorState);
  }

  /**
   * ✅ ROLLBACK OPTIMISTIC UPDATE - Motor disagreed, restore previous state
   */
  _rollbackOptimisticUpdate() {
    if (this.previousState) {
      this.state = { ...this.previousState };
      this.previousState = null;
      this._emitStateChange('optimistic-rollback');
      console.log('🎚️ TransportManager: Rolled back optimistic update');
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
    console.log('🎚️ TransportManager: Force synced to motor', motorState);
  }
}