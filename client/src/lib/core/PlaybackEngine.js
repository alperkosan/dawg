// lib/core/PlaybackEngine.js
import { PLAYBACK_STATES } from '@/config/constants.js';
import { uiUpdateManager, UPDATE_PRIORITIES, UPDATE_FREQUENCIES } from './UIUpdateManager.js';

/**
 * 🎵 UNIFIED PLAYBACK ENGINE
 *
 * Tek kaynak doğruluk sistemi:
 * - Tek state source
 * - Temiz command interface
 * - Basit event system
 * - Audio engine integration
 */

export class PlaybackEngine {
  constructor(audioEngine) {
    // ✅ SINGLE SOURCE OF TRUTH
    this.state = {
      // Core playback
      isPlaying: false,
      playbackState: PLAYBACK_STATES.STOPPED,

      // Position (unified)
      currentPosition: 0,

      // Transport settings
      bpm: 140,
      loopEnabled: true,
      loopStart: 0,
      loopEnd: 64,

      // UI interaction
      isUserScrubbing: false,
      ghostPosition: null,

      // Metadata
      lastUpdateTime: Date.now(),
      lastStopTime: 0
    };

    this.audioEngine = audioEngine;
    this.subscribers = new Set();
    this.positionTimer = null;
    this.positionTrackingSubscription = null;

    // Initialize
    this._bindAudioEvents();
  }

  // =================== CORE COMMANDS ===================

  /**
   * ✅ PLAY - Single unified play command
   */
  async play(startPosition = null) {

    // Early return if already playing
    if (this.state.isPlaying) {
      return false;
    }

    try {
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

      // Notify subscribers
      this._emitStateChange('play');

      return true;
    } catch (error) {
      console.error('🎵 Play failed:', error);
      return false;
    }
  }

  /**
   * ✅ PAUSE - Unified pause command
   */
  async pause() {

    if (!this.state.isPlaying) {
      return false;
    }

    try {
      // Pause audio engine
      await this.audioEngine.playbackManager.pause();

      // Update state
      this.state.isPlaying = false;
      this.state.playbackState = PLAYBACK_STATES.PAUSED;
      this.state.lastUpdateTime = Date.now();

      // Stop position tracking
      this._stopPositionTracking();

      // Notify subscribers
      this._emitStateChange('pause');

      return true;
    } catch (error) {
      console.error('🎵 Pause failed:', error);
      return false;
    }
  }

  /**
   * ✅ STOP - Smart behavior with double-click reset (matching TransportManager)
   */
  async stop() {

    try {
      const now = Date.now();
      const timeSinceLastStop = now - (this.state.lastStopTime || 0);

      // Stop audio engine
      await this.audioEngine.playbackManager.stop();

      // Update state
      this.state.isPlaying = false;
      this.state.playbackState = PLAYBACK_STATES.STOPPED;

      // Stop position tracking
      this._stopPositionTracking();

      // ✅ STOP BEHAVIOR - Reset to zero on every stop
      if (this.state.loopEnabled && this.state.loopStart > 0) {
        this.state.currentPosition = this.state.loopStart;
      } else {
        this.state.currentPosition = 0;
      }

      this.state.lastStopTime = now;
      this.state.lastUpdateTime = Date.now();

      // Notify subscribers
      this._emitStateChange('stop');
      this._emitPositionUpdate();

      return true;
    } catch (error) {
      console.error('🎵 Stop failed:', error);
      return false;
    }
  }

  /**
   * ✅ TOGGLE - Smart toggle based on current state
   */
  async togglePlayPause() {

    switch (this.state.playbackState) {
      case PLAYBACK_STATES.PLAYING:
        return await this.pause();

      case PLAYBACK_STATES.PAUSED:
        return await this.play(); // Resume from current position

      case PLAYBACK_STATES.STOPPED:
      default:
        return await this.play(this.state.currentPosition);
    }
  }

  // =================== POSITION MANAGEMENT ===================

  /**
   * ✅ JUMP - Unified position jumping
   */
  async jumpToPosition(position, options = {}) {
    const { smooth = true } = options;


    // Clamp position
    const newPosition = Math.max(0, position);

    // Update position immediately
    this.state.currentPosition = newPosition;

    // If playing, update audio engine
    if (this.state.isPlaying && this.audioEngine?.playbackManager) {
      if (smooth) {
        // Smooth jump with brief pause-resume
        await this.audioEngine.playbackManager.pause();
        await new Promise(resolve => setTimeout(resolve, 50));
        await this.audioEngine.playbackManager.play(newPosition);
      } else {
        // Direct jump
        await this.audioEngine.playbackManager.jumpToStep(newPosition);
      }
    }

    this._emitPositionUpdate();
  }

  /**
   * ✅ GHOST PLAYHEAD - UI interaction
   */
  setGhostPosition(position) {
    this.state.ghostPosition = position;
    this._emitGhostUpdate();
  }

  clearGhostPosition() {
    this.state.ghostPosition = null;
    this._emitGhostUpdate();
  }

  // =================== SETTINGS ===================

  setBPM(bpm) {
    // ✅ FIX: Remove BPM restrictions - only ensure positive value
    if (bpm <= 0 || isNaN(bpm)) {
      console.warn('Invalid BPM value:', bpm);
      return;
    }
    this.state.bpm = bpm;
    this.audioEngine.playbackManager?.setBPM(bpm);
    this._emitStateChange('bpm-change');
  }

  setLoopRange(start, end) {
    this.state.loopStart = Math.max(0, start);
    this.state.loopEnd = Math.max(start + 1, end);
    this.audioEngine.playbackManager?.setLoopPoints(this.state.loopStart, this.state.loopEnd);
    this._emitStateChange('loop-change');
  }

  setLoopEnabled(enabled) {
    this.state.loopEnabled = enabled;
    this.audioEngine.playbackManager?.setLoopEnabled(enabled);
    this._emitStateChange('loop-change');
  }

  // =================== POSITION TRACKING ===================

  _startPositionTracking() {
    if (this.positionTrackingSubscription) return;


    // Subscribe to UIUpdateManager with NORMAL priority (lower than TransportManager)
    this.positionTrackingSubscription = uiUpdateManager.subscribe(
      'playback-engine-position-tracking',
      (currentTime, frameTime) => {
        this._updatePositionFromAudio();
      },
      UPDATE_PRIORITIES.NORMAL,
      UPDATE_FREQUENCIES.HIGH
    );
  }

  _stopPositionTracking() {
    if (this.positionTrackingSubscription) {
      this.positionTrackingSubscription(); // Call unsubscribe function
      this.positionTrackingSubscription = null;
    }
  }

  /**
   * ✅ UPDATE POSITION FROM AUDIO ENGINE
   * Called by UIUpdateManager subscription
   */
  _updatePositionFromAudio() {
    if (!this.state.isPlaying || this.state.isUserScrubbing) return;

    // Get position from audio engine
    if (this.audioEngine?.transport) {
      const newPosition = this.audioEngine.transport.ticksToSteps(
        this.audioEngine.transport.currentTick
      );

      if (Math.abs(newPosition - this.state.currentPosition) > 0.01) {
        this.state.currentPosition = newPosition;
        this.state.lastUpdateTime = Date.now();
        this._emitPositionUpdate();
      }
    }
  }

  // =================== AUDIO ENGINE INTEGRATION ===================

  _bindAudioEvents() {
    if (!this.audioEngine?.transport) return;

    // Note: Motor events are now managed internally by manual state updates
    // This prevents conflicts between manual state and motor events
  }

  // =================== EVENT SYSTEM ===================

  /**
   * Subscribe to all state changes
   */
  subscribe(callback) {
    this.subscribers.add(callback);

    // Send initial state
    callback({
      type: 'state-change',
      state: { ...this.state },
      timestamp: Date.now()
    });

    // Return unsubscribe function
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
        console.error('🎵 Subscriber error:', error);
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
        console.error('🎵 Position subscriber error:', error);
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
        console.error('🎵 Ghost subscriber error:', error);
      }
    });
  }

  // =================== PUBLIC API ===================

  /**
   * Get current state snapshot
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Check if ready
   */
  isReady() {
    return !!this.audioEngine;
  }

  /**
   * Cleanup
   */
  destroy() {
    this._stopPositionTracking();
    this.subscribers.clear();
    this.audioEngine = null;
  }
}