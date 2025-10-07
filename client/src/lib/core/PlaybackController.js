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

      // Position management (TEK POZISYON)
      currentPosition: 0,  // Her zaman step cinsinden, motor ile senkron

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

    const newPosition = this.audioEngine.transport.ticksToSteps(
      this.audioEngine.transport.currentTick
    );

    // Sadece anlamlı değişiklikte güncelle
    if (Math.abs(newPosition - this.state.currentPosition) > 0.01) {
      this.state.currentPosition = newPosition;
      this._emitPositionUpdate();
    }
  }

  // =================== PLAYBACK COMMANDS ===================

  /**
   * ✅ UNIFIED PLAY - Tek play fonksiyonu
   */
  async play(startPosition = null) {

    if (this.state.isPlaying) return false;

    try {
      // Position ayarla
      if (startPosition !== null) {
        await this._jumpToPositionInternal(startPosition);
      }

      // Motor başlat
      await this.audioEngine.playbackManager.play(startPosition);

      // ✅ Manual state update - motor events disabled
      this.state.playbackState = PLAYBACK_STATES.PLAYING;
      this.state.isPlaying = true;
      this._startPositionLoop();
      this._emitStateChange('play-command');

      return true;
    } catch (error) {
      console.error('Play failed:', error);
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

      // ✅ STOP BEHAVIOR - Reset to zero on every stop
      if (this.state.loopEnabled && this.state.loopStart > 0) {
        this.state.currentPosition = this.state.loopStart;
      } else {
        this.state.currentPosition = 0;
      }

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
    this.state.currentPosition = Math.max(0, position);
    await this.audioEngine.playbackManager.jumpToStep(position);
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
    this.state.bpm = Math.max(60, Math.min(300, bpm));
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


    // Subscribe to UIUpdateManager with NORMAL priority
    this.positionLoopSubscription = uiUpdateManager.subscribe(
      'playback-controller-position-loop',
      (currentTime, frameTime) => {
        if (this.state.isPlaying) {
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

  _emitPositionUpdate() {
    this.emit('position-update', {
      position: this.state.currentPosition,
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