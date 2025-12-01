// lib/core/PlaybackController.js
import { PLAYBACK_STATES } from '@/config/constants';
import { uiUpdateManager, UPDATE_PRIORITIES, UPDATE_FREQUENCIES } from './UIUpdateManager.js';

/**
 * Simple EventEmitter implementation for browser
 */
class SimpleEventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  removeAllListeners() {
    this.events = {};
  }
}

/**
 * ✅ UNIFIED PLAYBACK CONTROLLER
 *
 * Tek kaynak doğruluk ilkesi:
 * - Tüm playback state buradan yönetilir
 * - Motor ile UI arasında tek köprü
 * - Command pattern ile tutarlılık
 * - Event-driven architecture
 */

export class PlaybackController extends SimpleEventEmitter {
  constructor(audioEngine, initialBPM = 140) {
    super();

    // Tek kaynak state
    this.state = {
      // Core playback state
      playbackState: PLAYBACK_STATES.STOPPED,
      isPlaying: false,

      // ✅ INDUSTRY STANDARD: Separate UI and Transport positions
      // UI position: What user sees (persistent, survives stop/play)
      // Transport position: What engine uses (synced on play start)
      currentPosition: 0,  // UI position (persistent)
      transportPosition: 0, // Transport position (synced on play)

      // ✅ NEW: Position lock mechanism (prevents 0 position on play start)
      positionLocked: false,
      positionLockFrames: 0,
      playStartSnapshot: null, // Snapshot of position when play starts

      // Transport settings
      bpm: initialBPM, // ✅ Use initial BPM from parameter
      loopStart: 0,
      loopEnd: 64,
      loopEnabled: true,

      // UI interaction state
      isUserScrubbing: false,
      ghostPosition: null,

      // Internal timing
      lastUpdateTime: 0,
      positionUpdateRate: 60, // FPS for position updates

      // Double-stop detection
      lastStopTime: 0
    };

    this.audioEngine = audioEngine;
    this.rafId = null;
    this.positionLoopSubscription = null;
    this.subscribers = new Set();

    // Motor event bindings
    this._bindMotorEvents();

    // Başlangıç durumu
    this._emitStateChange('initialized');
  }

  // =================== MOTOR INTEGRATION ===================

  _bindMotorEvents() {
    if (!this.audioEngine?.transport) return;

    const transport = this.audioEngine.transport;

    // Motor state changes
    transport.on('start', () => this._handleMotorEvent('started'));
    transport.on('stop', () => this._handleMotorEvent('stopped'));
    transport.on('pause', () => this._handleMotorEvent('paused'));

    // Position updates - SADECE motor çalarken
    transport.on('tick', () => {
      if (this.state.isPlaying && !this.state.isUserScrubbing) {
        this._updatePositionFromMotor();
      }
    });
  }

  _handleMotorEvent(eventType) {

    switch (eventType) {
      case 'started':
        this.state.playbackState = PLAYBACK_STATES.PLAYING;
        this.state.isPlaying = true;
        this._startPositionLoop();
        break;

      case 'paused':
        this.state.playbackState = PLAYBACK_STATES.PAUSED;
        this.state.isPlaying = false;
        this._stopPositionLoop();
        break;

      case 'stopped':
        this.state.playbackState = PLAYBACK_STATES.STOPPED;
        this.state.isPlaying = false;
        this._stopPositionLoop();
        break;
    }

    this._emitStateChange(eventType);
  }

  _updatePositionFromMotor() {
    if (!this.audioEngine?.transport) return;

    // ✅ INDUSTRY STANDARD: Position lock mechanism
    // Prevents transport position (which might be 0) from overriding UI position on play start
    if (this.state.positionLocked) {
      this.state.positionLockFrames--;
      if (this.state.positionLockFrames <= 0) {
        this.state.positionLocked = false;
      }
      // Use locked position (from play start snapshot)
      const lockedPosition = this.state.playStartSnapshot ?? this.state.currentPosition;
      if (Math.abs(lockedPosition - this.state.currentPosition) > 0.01) {
        this.state.currentPosition = lockedPosition;
        const playbackManager = this.audioEngine.playbackManager;
        const currentMode = playbackManager?.getCurrentMode?.() || playbackManager?.currentMode || 'pattern';
        this._emitPositionUpdate(currentMode);
      }
      return; // Skip transport-based update while locked
    }

    // ✅ FIXED: Always update position, but include mode in the event
    // Components can decide whether to use the position based on mode
    const playbackManager = this.audioEngine.playbackManager;
    const currentMode = playbackManager?.getCurrentMode?.() || playbackManager?.currentMode || 'pattern';

    // ✅ INDUSTRY STANDARD: Use PlaybackManager position as source of truth
    // Transport position may reset to 0 when starting, but PlaybackManager maintains correct position
    let newPosition;
    if (playbackManager?.currentPosition !== undefined) {
      // Use PlaybackManager position (more reliable, especially at play start)
      newPosition = playbackManager.currentPosition;
      this.state.transportPosition = newPosition; // Track transport position separately
    } else {
      // Fallback to transport position if manager not available
      newPosition = this.audioEngine.transport.ticksToSteps(
        this.audioEngine.transport.currentTick
      );
      this.state.transportPosition = newPosition;
    }

    // ✅ INDUSTRY STANDARD: Update UI position only if significantly different
    // Prevents jitter and unnecessary updates
    if (Math.abs(newPosition - this.state.currentPosition) > 0.01) {
      this.state.currentPosition = newPosition;
      this._emitPositionUpdate(currentMode); // ✅ Pass mode to listeners
    }
  }

  // =================== PLAYBACK COMMANDS ===================

  /**
   * ✅ UNIFIED PLAY - Tek play fonksiyonu
   */
  async play(startPosition = null) {
    console.log('🎵 PlaybackController.play() called', { startPosition, isPlaying: this.state.isPlaying, playbackState: this.state.playbackState });

    // ✅ CRITICAL FIX: If paused, use resume() instead of play()
    if (this.state.playbackState === PLAYBACK_STATES.PAUSED) {
      console.log('🎵 State is PAUSED, using resume() instead of play()');
      return await this._resume();
    }

    if (this.state.isPlaying) {
      console.log('⚠️ Already playing, returning false');
      return false;
    }

    // ✅ CRITICAL: Check if audio engine is available
    if (!this.audioEngine) {
      console.error('❌ PlaybackController: Audio engine not available');
      return false;
    }

    if (!this.audioEngine.playbackManager) {
      console.error('❌ PlaybackController: PlaybackManager not available');
      return false;
    }

    try {
      // ✅ INDUSTRY STANDARD: Use UI position as source of truth (persistent)
      // This matches FL Studio, Ableton Live, Logic Pro behavior
      // UI position survives stop/play cycles and timeline clicks
      let playPosition = startPosition;
      if (playPosition === null) {
        // Use persistent UI position (set by timeline click or previous play)
        playPosition = this.state.currentPosition;
        
        // Also check PlaybackManager for consistency
        const managerPosition = this.audioEngine.playbackManager?.currentPosition;
        if (managerPosition !== undefined && Math.abs(managerPosition - playPosition) > 0.01) {
          // Manager has different position, sync UI to manager
          playPosition = managerPosition;
          this.state.currentPosition = managerPosition;
        }
      }

      console.log('🎵 PlaybackController: Starting playback at position', playPosition);

      // ✅ INDUSTRY STANDARD: Take position snapshot before play start
      // This prevents transport from overriding position on first frames
      this.state.playStartSnapshot = playPosition;
      this.state.currentPosition = playPosition;
      this.state.transportPosition = playPosition;

      // ✅ INDUSTRY STANDARD: Lock position for first 3 frames
      // Prevents transport position (which might be 0) from overriding UI position
      this.state.positionLocked = true;
      this.state.positionLockFrames = 3;

      // ✅ CRITICAL: Resume AudioContext if suspended (required by browser autoplay policy)
      console.log('🎵 Checking AudioContext state:', this.audioEngine.audioContext?.state);
      if (this.audioEngine.audioContext?.state === 'suspended') {
        try {
          await this.audioEngine.audioContext.resume();
          console.log('🎵 AudioContext resumed for playback');
        } catch (resumeError) {
          console.warn('⚠️ Could not resume AudioContext:', resumeError);
          // Continue anyway - PlaybackManager will also try to resume
        }
      }

      // Position ayarla (ensures both state and manager are in sync)
      console.log('🎵 Setting position via _jumpToPositionInternal:', playPosition);
      if (playPosition !== null) {
        try {
          await this._jumpToPositionInternal(playPosition);
          console.log('✅ Position set successfully');
        } catch (jumpError) {
          console.error('❌ Failed to set position:', jumpError);
          throw jumpError;
        }
      }

      // Motor başlat (use the resolved position)
      console.log('🎵 PlaybackController: Calling PlaybackManager.play()', playPosition);
      try {
        await this.audioEngine.playbackManager.play(playPosition);
        console.log('✅ PlaybackController: PlaybackManager.play() completed');
      } catch (playError) {
        console.error('❌ PlaybackManager.play() failed:', playError);
        throw playError;
      }

      // ✅ Manual state update - motor events disabled
      this.state.playbackState = PLAYBACK_STATES.PLAYING;
      this.state.isPlaying = true;
      
      // ✅ CRITICAL: Emit position update immediately with locked position
      // This ensures UI shows correct position before position loop starts
      const playbackManager = this.audioEngine.playbackManager;
      const currentMode = playbackManager?.getCurrentMode?.() || playbackManager?.currentMode || 'pattern';
      this._emitPositionUpdate(currentMode);
      
      this._startPositionLoop();
      this._emitStateChange('play-command');

      return true;
    } catch (error) {
      console.error('Play failed:', error);
      return false;
    }
  }

  /**
   * ✅ UNIFIED RESUME - Resume from paused position
   */
  async _resume() {
    console.log('🎵 PlaybackController._resume() called');

    if (!this.audioEngine?.playbackManager) {
      console.error('❌ PlaybackController: PlaybackManager not available');
      return false;
    }

    try {
      // ✅ CRITICAL: Resume AudioContext if suspended
      if (this.audioEngine.audioContext?.state === 'suspended') {
        try {
          await this.audioEngine.audioContext.resume();
          console.log('🎵 AudioContext resumed for playback');
        } catch (resumeError) {
          console.warn('⚠️ Could not resume AudioContext:', resumeError);
        }
      }

      // ✅ CRITICAL: Use PlaybackManager.resume() to preserve position
      await this.audioEngine.playbackManager.resume();
      console.log('✅ PlaybackController: PlaybackManager.resume() completed');

      // Update state
      this.state.playbackState = PLAYBACK_STATES.PLAYING;
      this.state.isPlaying = true;
      this.state.lastUpdateTime = Date.now();

      // Start position tracking
      this._startPositionLoop();

      // Emit state change
      this._emitStateChange('play');

      return true;
    } catch (error) {
      console.error('❌ PlaybackController._resume() failed:', error);
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

      // ✅ Manual state update - motor events disabled
      this.state.playbackState = PLAYBACK_STATES.PAUSED;
      this.state.isPlaying = false;
      this._stopPositionLoop();
      this._emitStateChange('pause-command');

      return true;
    } catch (error) {
      console.error('Pause failed:', error);
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

      await this.audioEngine.playbackManager.stop();

      // ✅ Manual state update - motor events disabled
      this.state.playbackState = PLAYBACK_STATES.STOPPED;
      this.state.isPlaying = false;
      this._stopPositionLoop();

      // ✅ INDUSTRY STANDARD: Preserve UI position on stop
      // Position survives stop/play cycles (matches FL Studio, Ableton, Logic Pro behavior)
      // Don't reset position - it should persist for next play
      // User can manually reset by clicking timeline or using jumpToPosition
      
      // ✅ Release position lock if active
      this.state.positionLocked = false;
      this.state.positionLockFrames = 0;
      this.state.playStartSnapshot = null;

      // ✅ Keep current position (don't reset to 0)
      // This ensures playhead stays where user left it
      // Only sync transport position (for consistency)
      const currentUIPosition = this.state.currentPosition;
      this.state.transportPosition = currentUIPosition;

      this.state.lastStopTime = now;

      this._emitStateChange('stop-command');
      this._emitPositionUpdate();
      return true;
    } catch (error) {
      console.error('Stop failed:', error);
      return false;
    }
  }

  /**
   * ✅ SMART TOGGLE - Kullanıcı deneyimi odaklı
   */
  async togglePlayPause() {
    console.log('🎵 PlaybackController.togglePlayPause() called', {
      playbackState: this.state.playbackState,
      isPlaying: this.state.isPlaying,
      hasAudioEngine: !!this.audioEngine,
      hasPlaybackManager: !!this.audioEngine?.playbackManager
    });

    switch (this.state.playbackState) {
      case PLAYBACK_STATES.PLAYING:
        console.log('🎵 State is PLAYING, calling pause()');
        return await this.pause();

      case PLAYBACK_STATES.PAUSED:
        console.log('🎵 State is PAUSED, calling resume()');
        // ✅ FIX: Use PlaybackManager.resume() instead of play() to preserve position
        return await this._resume();

      case PLAYBACK_STATES.STOPPED:
      default:
        console.log('🎵 State is STOPPED, calling play()');
        // ✅ FIX: Use PlaybackManager's current position (set by jumpToStep/timeline click)
        // This ensures we use the position that was actually set, not stale state
        const managerPosition = this.audioEngine?.playbackManager?.currentPosition;
        const playPosition = managerPosition !== undefined ? managerPosition : this.state.currentPosition;
        console.log('🎵 Play position determined:', { managerPosition, currentPosition: this.state.currentPosition, playPosition });
        // Sync state with manager position
        if (managerPosition !== undefined) {
          this.state.currentPosition = managerPosition;
        }
        return await this.play(playPosition);
    }
  }

  // =================== POSITION MANAGEMENT ===================

  /**
   * ✅ UNIFIED JUMP - Tek jump fonksiyonu
   */
  async jumpToPosition(position, options = {}) {
    const {
      smooth = true,
      autoPlay = false
    } = options;


    // User scrubbing başlat
    this.state.isUserScrubbing = true;
    this._emitStateChange('scrub-start');

    try {
      if (smooth && this.state.isPlaying) {
        // Oynarken smooth jump
        await this._smoothJump(position);
      } else {
        // Direct jump
        await this._jumpToPositionInternal(position);
      }

      // Auto-play sadece stop halinde
      if (autoPlay && this.state.playbackState === PLAYBACK_STATES.STOPPED) {
        await this.play(position);
      }

    } finally {
      // User scrubbing bitir
      setTimeout(() => {
        this.state.isUserScrubbing = false;
        this._emitStateChange('scrub-end');
      }, 100);
    }
  }

  async _jumpToPositionInternal(position) {
    // ✅ INDUSTRY STANDARD: Update UI position immediately (persistent)
    // This position survives stop/play cycles (matches FL Studio, Ableton behavior)
    this.state.currentPosition = Math.max(0, position);
    
    // ✅ CRITICAL FIX: Always update PlaybackManager position, even when stopped
    // This ensures that when play is pressed, PlaybackManager has the correct position
    // Otherwise, PlaybackManager.currentPosition will be 0 (from stop) and play will start at 0
    await this.audioEngine.playbackManager.jumpToStep(position);
    
    // ✅ Update transport position only if playing
    // If stopped, transport position will sync on next play
    if (this.state.isPlaying) {
      this.state.transportPosition = this.state.currentPosition;
    }
    
    // ✅ Always emit UI update (even when stopped)
    // This ensures UI playhead moves immediately on timeline click
    this._emitPositionUpdate();
  }

  async _smoothJump(position) {
    // Kısa pause-resume ile smooth jump
    if (this.state.isPlaying) {
      await this.audioEngine.playbackManager.pause();
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms pause
      await this.audioEngine.playbackManager.play(position);
    } else {
      await this._jumpToPositionInternal(position);
    }
  }

  // =================== GHOST PLAYHEAD ===================

  setGhostPosition(position) {
    this.state.ghostPosition = position;
    this.emit('ghost-position-change', position);
  }

  clearGhostPosition() {
    this.state.ghostPosition = null;
    this.emit('ghost-position-change', null);
  }

  // =================== SETTINGS ===================

  setBPM(bpm) {
    // ✅ FIX: Remove BPM restrictions - only ensure positive value
    if (bpm <= 0 || isNaN(bpm)) {
      console.warn('Invalid BPM value:', bpm);
      return;
    }
    this.state.bpm = bpm;
    this.audioEngine.playbackManager.setBPM(this.state.bpm);
    this._emitStateChange('bpm-change');
  }

  setLoopRange(start, end) {
    this.state.loopStart = Math.max(0, start);
    this.state.loopEnd = Math.max(start + 1, end);
    this.audioEngine.playbackManager.setLoopPoints(this.state.loopStart, this.state.loopEnd);
    this._emitStateChange('loop-change');
  }

  setLoopEnabled(enabled) {
    this.state.loopEnabled = enabled;
    this.audioEngine.playbackManager.setLoopEnabled(enabled);
    this._emitStateChange('loop-change');
  }

  // =================== POSITION UPDATES ===================

  _startPositionLoop() {
    if (this.positionLoopSubscription) return;

    // ✅ INDUSTRY STANDARD: Position lock is already set in play() function
    // No need to initialize here - position lock mechanism handles it
    // The locked position (playStartSnapshot) will be used for first few frames

    // Subscribe to UIUpdateManager with NORMAL priority
    this.positionLoopSubscription = uiUpdateManager.subscribe(
      'playback-controller-position-loop',
      (currentTime, frameTime) => {
        if (this.state.isPlaying) {
          // ✅ Position lock mechanism is handled in _updatePositionFromMotor
          // It will use playStartSnapshot for first 3 frames
          this._updatePositionFromMotor();
        }
      },
      UPDATE_PRIORITIES.NORMAL,
      UPDATE_FREQUENCIES.HIGH
    );
  }

  _stopPositionLoop() {
    if (this.positionLoopSubscription) {
      this.positionLoopSubscription(); // Call unsubscribe function
      this.positionLoopSubscription = null;
    }
  }

  // =================== EVENT SYSTEM ===================

  _emitStateChange(reason) {
    const stateSnapshot = { ...this.state };
    const eventData = {
      state: stateSnapshot,
      reason,
      timestamp: Date.now()
    };


    // ✅ Emit to event listeners (EventEmitter)
    this.emit('state-change', eventData);

    // ✅ Notify direct subscribers (for stores)
    this.subscribers.forEach(callback => {
      try {
        callback(eventData);
      } catch (error) {
        console.error('Error in subscriber callback:', error);
      }
    });
  }

  _emitPositionUpdate(mode = null) {
    // ✅ Include playback mode in position updates
    // This allows components to filter updates based on their needs:
    // - Arrangement panel: only uses 'song' mode updates
    // - Channel Rack: only uses 'pattern' mode updates
    // - Piano Roll: only uses 'pattern' mode updates
    const playbackManager = this.audioEngine?.playbackManager;
    const currentMode = mode || playbackManager?.getCurrentMode?.() || playbackManager?.currentMode || 'pattern';

    this.emit('position-update', {
      position: this.state.currentPosition,
      mode: currentMode,
      timestamp: Date.now()
    });
  }

  // =================== PUBLIC API ===================

  /**
   * Component'ler için state accessor
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Position getter - UI bileşenleri için
   */
  getCurrentPosition() {
    return this.state.currentPosition;
  }

  /**
   * Display position - Always returns actual position (not ghost)
   */
  getDisplayPosition() {
    return this.state.currentPosition;
  }

  /**
   * Subscribe to all changes
   */
  subscribe(callback) {
    this.subscribers.add(callback);

    // İlk state'i gönder
    callback({
      state: this.getState(),
      reason: 'subscription',
      timestamp: Date.now()
    });

    return () => this.subscribers.delete(callback);
  }

  /**
   * Cleanup
   */
  destroy() {
    this._stopPositionLoop();
    this.audioEngine = null;
    this.removeAllListeners();
    this.subscribers.clear();
  }
}