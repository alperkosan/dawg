// src/lib/core/UIUpdateManager.js
// DAWG - Unified UI Update Manager - Single RAF Loop for All UI Updates

/**
 * ✅ SINGLE RAF LOOP MANAGER
 * Consolidates all UI updates into one requestAnimationFrame loop
 * Priority-based updates, throttling, and batch DOM operations
 */

// Update priorities (higher = updated first)
export const UPDATE_PRIORITIES = {
  CRITICAL: 100,    // Transport state, audio-critical UI
  HIGH: 80,         // Playheads, timelines
  NORMAL: 60,       // General UI updates
  LOW: 40,          // Visualizations, non-critical
  BACKGROUND: 20    // Debug info, metrics
};

// Update frequencies
export const UPDATE_FREQUENCIES = {
  REALTIME: 0,      // Every frame (60fps)
  HIGH: 16.67,      // ~60fps (16.67ms)
  MEDIUM: 33.33,    // ~30fps (33.33ms)
  LOW: 100,         // ~10fps (100ms)
  VERY_LOW: 1000    // ~1fps (1000ms)
};

export class UIUpdateManager {
  constructor() {
    this.subscribers = new Map();
    this.isRunning = false;
    this.rafId = null;

    // Performance tracking
    this.metrics = {
      frameCount: 0,
      totalUpdateTime: 0,
      averageFrameTime: 0,
      droppedFrames: 0,
      lastFrameTime: 0
    };

    // Frame throttling
    this.lastUpdateTimes = new Map();
    this.frameSkipCounter = 0;

    // Batch update collections
    this.batchedUpdates = {
      domUpdates: [],
      styleUpdates: [],
      classUpdates: []
    };

    // Bind methods
    this._updateLoop = this._updateLoop.bind(this);

    console.log('🎨 UIUpdateManager initialized');
  }

  // =================== SUBSCRIPTION MANAGEMENT ===================

  /**
   * Subscribe to UI updates
   * @param {string} id - Unique identifier for subscriber
   * @param {function} updateCallback - Function to call on updates
   * @param {number} priority - Update priority (UPDATE_PRIORITIES)
   * @param {number} frequency - Update frequency in ms (UPDATE_FREQUENCIES)
   * @param {object} options - Additional options
   */
  subscribe(id, updateCallback, priority = UPDATE_PRIORITIES.NORMAL, frequency = UPDATE_FREQUENCIES.HIGH, options = {}) {
    if (this.subscribers.has(id)) {
      console.warn(`🎨 UIUpdateManager: Subscriber ${id} already exists, updating...`);
    }

    this.subscribers.set(id, {
      callback: updateCallback,
      priority,
      frequency,
      lastUpdateTime: 0,
      active: true,
      ...options
    });

    console.log(`🎨 Subscribed: ${id} (priority: ${priority}, frequency: ${frequency}ms)`);

    // Start loop if not running
    if (!this.isRunning) {
      this.start();
    }

    return () => this.unsubscribe(id); // Return unsubscribe function
  }

  /**
   * Unsubscribe from updates
   */
  unsubscribe(id) {
    if (this.subscribers.delete(id)) {
      console.log(`🎨 Unsubscribed: ${id}`);
    }

    // Stop loop if no subscribers
    if (this.subscribers.size === 0 && this.isRunning) {
      this.stop();
    }
  }

  /**
   * Pause/resume specific subscriber
   */
  setSubscriberActive(id, active) {
    const subscriber = this.subscribers.get(id);
    if (subscriber) {
      subscriber.active = active;
      console.log(`🎨 Subscriber ${id} ${active ? 'activated' : 'paused'}`);
    }
  }

  // =================== LOOP MANAGEMENT ===================

  /**
   * Start the update loop
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.metrics.frameCount = 0;
    this.metrics.lastFrameTime = performance.now();

    console.log('🎨 UIUpdateManager started');
    this._updateLoop();
  }

  /**
   * Stop the update loop
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    console.log('🎨 UIUpdateManager stopped');
  }

  /**
   * Main update loop
   */
  _updateLoop(currentTime = performance.now()) {
    if (!this.isRunning) return;

    const frameStartTime = performance.now();

    // Calculate frame time
    const frameTime = currentTime - this.metrics.lastFrameTime;
    this.metrics.lastFrameTime = currentTime;
    this.metrics.frameCount++;

    // Frame drop detection (>20ms = dropped frame at 60fps)
    if (frameTime > 20) {
      this.metrics.droppedFrames++;
    }

    try {
      // Get active subscribers sorted by priority
      const activeSubscribers = Array.from(this.subscribers.entries())
        .filter(([id, subscriber]) => subscriber.active)
        .sort(([,a], [,b]) => b.priority - a.priority);

      // Process updates with frequency throttling
      const updatesToProcess = [];

      for (const [id, subscriber] of activeSubscribers) {
        const { frequency, lastUpdateTime } = subscriber;

        // Check if enough time has passed for this subscriber
        if (currentTime - lastUpdateTime >= frequency) {
          updatesToProcess.push([id, subscriber]);
          subscriber.lastUpdateTime = currentTime;
        }
      }

      // Execute updates in priority order
      for (const [id, subscriber] of updatesToProcess) {
        try {
          const updateStartTime = performance.now();

          // Call subscriber update function
          subscriber.callback(currentTime, frameTime);

          const updateDuration = performance.now() - updateStartTime;

          // Warn about slow updates (>5ms)
          if (updateDuration > 5) {
            console.warn(`🎨 Slow update detected: ${id} took ${updateDuration.toFixed(2)}ms`);
          }

        } catch (error) {
          console.error(`🎨 Update error in ${id}:`, error);
          // Don't break the loop for one subscriber's error
        }
      }

      // Process batched DOM updates
      this._processBatchedUpdates();

    } catch (error) {
      console.error('🎨 Critical error in update loop:', error);
    }

    // Update performance metrics
    const frameDuration = performance.now() - frameStartTime;
    this.metrics.totalUpdateTime += frameDuration;
    this.metrics.averageFrameTime = this.metrics.totalUpdateTime / this.metrics.frameCount;

    // Schedule next frame
    this.rafId = requestAnimationFrame(this._updateLoop);
  }

  // =================== BATCHED UPDATES ===================

  /**
   * Queue DOM update for batching
   */
  queueDOMUpdate(element, property, value) {
    this.batchedUpdates.domUpdates.push({ element, property, value });
  }

  /**
   * Queue style update for batching
   */
  queueStyleUpdate(element, styles) {
    this.batchedUpdates.styleUpdates.push({ element, styles });
  }

  /**
   * Queue class update for batching
   */
  queueClassUpdate(element, classesToAdd = [], classesToRemove = []) {
    this.batchedUpdates.classUpdates.push({ element, classesToAdd, classesToRemove });
  }

  /**
   * Process all batched updates
   */
  _processBatchedUpdates() {
    // Process DOM updates
    for (const { element, property, value } of this.batchedUpdates.domUpdates) {
      try {
        element[property] = value;
      } catch (error) {
        console.error('🎨 DOM update error:', error);
      }
    }

    // Process style updates
    for (const { element, styles } of this.batchedUpdates.styleUpdates) {
      try {
        Object.assign(element.style, styles);
      } catch (error) {
        console.error('🎨 Style update error:', error);
      }
    }

    // Process class updates
    for (const { element, classesToAdd, classesToRemove } of this.batchedUpdates.classUpdates) {
      try {
        if (classesToRemove.length > 0) {
          element.classList.remove(...classesToRemove);
        }
        if (classesToAdd.length > 0) {
          element.classList.add(...classesToAdd);
        }
      } catch (error) {
        console.error('🎨 Class update error:', error);
      }
    }

    // Clear batches
    this.batchedUpdates.domUpdates.length = 0;
    this.batchedUpdates.styleUpdates.length = 0;
    this.batchedUpdates.classUpdates.length = 0;
  }

  // =================== PERFORMANCE MONITORING ===================

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      isRunning: this.isRunning,
      subscriberCount: this.subscribers.size,
      activeSubscribers: Array.from(this.subscribers.values()).filter(s => s.active).length,
      fps: this.metrics.frameCount > 0 ? 1000 / this.metrics.averageFrameTime : 0
    };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics() {
    this.metrics = {
      frameCount: 0,
      totalUpdateTime: 0,
      averageFrameTime: 0,
      droppedFrames: 0,
      lastFrameTime: performance.now()
    };
  }

  /**
   * Log performance summary
   */
  logPerformance() {
    const metrics = this.getMetrics();
    console.log('🎨 UIUpdateManager Performance:', {
      fps: `${metrics.fps.toFixed(1)} fps`,
      avgFrameTime: `${metrics.averageFrameTime.toFixed(2)}ms`,
      droppedFrames: metrics.droppedFrames,
      subscribers: `${metrics.activeSubscribers}/${metrics.subscriberCount}`,
      isRunning: metrics.isRunning
    });
  }

  /**
   * Debug: Log all active subscribers
   */
  logActiveSubscribers() {
    const activeSubscribers = Array.from(this.subscribers.entries())
      .filter(([id, subscriber]) => subscriber.active)
      .map(([id, subscriber]) => ({
        id,
        priority: subscriber.priority,
        frequency: subscriber.frequency
      }));

    console.log('🎨 UIUpdateManager Active Subscribers:', activeSubscribers);
    return activeSubscribers;
  }
}

// =================== SINGLETON INSTANCE ===================

// Create singleton instance
export const uiUpdateManager = new UIUpdateManager();

// Global access for debugging
if (typeof window !== 'undefined') {
  window.UIUpdateManager = uiUpdateManager;
  window.logUISubscribers = () => uiUpdateManager.logActiveSubscribers();
  window.logUIPerformance = () => uiUpdateManager.logPerformance();
}

export default uiUpdateManager;