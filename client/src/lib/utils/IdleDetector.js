/**
 * IdleDetector - Detects when user is idle and pauses unnecessary work
 *
 * Monitors:
 * - Mouse movement
 * - Keyboard input
 * - Audio playback state
 *
 * Pauses when idle:
 * - UI update loops (if no critical updates needed)
 * - VU meters (if not playing)
 * - Visualizations
 * - Non-essential timers
 * - AudioContext (suspended to save CPU)
 */

export class IdleDetector {
  constructor(options = {}) {
    this.idleTimeout = options.idleTimeout || 5000; // 5 seconds default
    this.isIdle = false;
    this.lastActivityTime = Date.now();
    this.idleCheckInterval = null;
    this.callbacks = {
      onIdle: [],
      onActive: []
    };

    // ⚡ PLAYBACK STATE: Never go idle while playing
    this.isPlaying = false;

    // Track activity
    this.activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];

    // Throttle activity tracking (don't update on every mousemove)
    this.activityThrottleTime = 500; // ms
    this.lastActivityUpdate = 0;

    this._boundActivityHandler = this._handleActivity.bind(this);
    this._boundCheckIdle = this._checkIdleState.bind(this);

    console.log('⏱️ IdleDetector initialized');
  }

  /**
   * Start idle detection
   */
  start() {
    // Listen for user activity
    this.activityEvents.forEach(event => {
      window.addEventListener(event, this._boundActivityHandler, { passive: true });
    });

    // Check idle state every second
    this.idleCheckInterval = setInterval(this._boundCheckIdle, 1000);

    console.log('⏱️ IdleDetector started');
  }

  /**
   * Stop idle detection
   */
  stop() {
    // Remove event listeners
    this.activityEvents.forEach(event => {
      window.removeEventListener(event, this._boundActivityHandler);
    });

    // Clear interval
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }

    console.log('⏱️ IdleDetector stopped');
  }

  /**
   * Handle user activity (throttled)
   */
  _handleActivity() {
    const now = Date.now();

    // Throttle: only update every 500ms
    if (now - this.lastActivityUpdate < this.activityThrottleTime) {
      return;
    }

    this.lastActivityUpdate = now;
    this.lastActivityTime = now;

    // If was idle, trigger active callbacks
    if (this.isIdle) {
      this.isIdle = false;
      this._triggerCallbacks('onActive');
      console.log('👁️ User active');
    }
  }

  /**
   * Check if user is idle
   */
  _checkIdleState() {
    // ⚡ NEVER go idle while playing audio
    if (this.isPlaying) {
      return;
    }

    const now = Date.now();
    const timeSinceActivity = now - this.lastActivityTime;

    if (!this.isIdle && timeSinceActivity >= this.idleTimeout) {
      this.isIdle = true;
      this._triggerCallbacks('onIdle');
      console.log('😴 User idle');
    }
  }

  /**
   * Trigger callbacks
   */
  _triggerCallbacks(type) {
    console.log(`⏱️ IdleDetector: Triggering ${this.callbacks[type].length} ${type} callbacks`);
    this.callbacks[type].forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error(`⏱️ Error in ${type} callback:`, error);
      }
    });
  }

  /**
   * Register callback for idle state
   */
  onIdle(callback) {
    this.callbacks.onIdle.push(callback);
    return () => {
      const index = this.callbacks.onIdle.indexOf(callback);
      if (index > -1) {
        this.callbacks.onIdle.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for active state
   */
  onActive(callback) {
    this.callbacks.onActive.push(callback);
    return () => {
      const index = this.callbacks.onActive.indexOf(callback);
      if (index > -1) {
        this.callbacks.onActive.splice(index, 1);
      }
    };
  }

  /**
   * Force set idle state (for audio playback integration)
   */
  setPlaying(isPlaying) {
    this.isPlaying = isPlaying;

    if (isPlaying) {
      // Resume from idle if needed
      this.lastActivityTime = Date.now();
      if (this.isIdle) {
        this.isIdle = false;
        this._triggerCallbacks('onActive');
        console.log('🎵 Resumed from idle (playback started)');
      }
    }
    // Note: When stopped, idle detection will resume normally
  }

  /**
   * Get current idle state
   */
  getIdleState() {
    return {
      isIdle: this.isIdle,
      isPlaying: this.isPlaying,
      timeSinceActivity: Date.now() - this.lastActivityTime
    };
  }
}

// Singleton instance
export const idleDetector = new IdleDetector();

// Global access for debugging
if (typeof window !== 'undefined') {
  window.idleDetector = idleDetector;
}

export default idleDetector;
