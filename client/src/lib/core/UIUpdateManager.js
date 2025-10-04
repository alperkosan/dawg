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

    // ✅ PERFORMANCE: Pre-allocated arrays to avoid GC pressure
    this._activeSubscribersCache = [];
    this._updatesToProcessCache = [];
    this._sortedSubscribersCache = [];
    this._isDevelopment = process.env.NODE_ENV === 'development';

    // Bind methods
    this._updateLoop = this._updateLoop.bind(this);

    console.log('🎨 UIUpdateManager initialized with performance optimizations');
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
   * ✅ PERFORMANCE OPTIMIZED: Main update loop with reduced allocations
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
      // ✅ PERFORMANCE: Use cached arrays to avoid allocations
      this._activeSubscribersCache.length = 0;
      this._updatesToProcessCache.length = 0;
      this._sortedSubscribersCache.length = 0;

      // ✅ PERFORMANCE: Single pass to collect active subscribers and filter by frequency
      for (const [id, subscriber] of this.subscribers) {
        if (!subscriber.active) continue;

        // Check frequency throttling in same pass
        if (currentTime - subscriber.lastUpdateTime >= subscriber.frequency) {
          this._updatesToProcessCache.push([id, subscriber]);
          subscriber.lastUpdateTime = currentTime;
        }
      }

      // ✅ PERFORMANCE: In-place sort instead of creating new array
      this._updatesToProcessCache.sort(([,a], [,b]) => b.priority - a.priority);

      // Execute updates in priority order
      for (let i = 0; i < this._updatesToProcessCache.length; i++) {
        const [id, subscriber] = this._updatesToProcessCache[i];

        try {
          let updateStartTime;
          if (this._isDevelopment) {
            updateStartTime = performance.now();
          }

          // Call subscriber update function
          subscriber.callback(currentTime, frameTime);

          // ✅ PERFORMANCE: Only measure performance in development
          if (this._isDevelopment) {
            const updateDuration = performance.now() - updateStartTime;
            if (updateDuration > 5) {
              console.warn(`🎨 Slow update detected: ${id} took ${updateDuration.toFixed(2)}ms`);
            }
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

    // ✅ PERFORMANCE: Only calculate detailed metrics in development
    if (this._isDevelopment) {
      const frameDuration = performance.now() - frameStartTime;
      this.metrics.totalUpdateTime += frameDuration;
      this.metrics.averageFrameTime = this.metrics.totalUpdateTime / this.metrics.frameCount;
    }

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
   * ✅ PERFORMANCE OPTIMIZED: Process all batched updates with error boundaries
   */
  _processBatchedUpdates() {
    const { domUpdates, styleUpdates, classUpdates } = this.batchedUpdates;

    // ✅ PERFORMANCE: Use traditional for loops for better performance
    // Process DOM updates
    for (let i = 0; i < domUpdates.length; i++) {
      const { element, property, value } = domUpdates[i];
      try {
        element[property] = value;
      } catch (error) {
        if (this._isDevelopment) {
          console.error('🎨 DOM update error:', error);
        }
      }
    }

    // Process style updates
    for (let i = 0; i < styleUpdates.length; i++) {
      const { element, styles } = styleUpdates[i];
      try {
        Object.assign(element.style, styles);
      } catch (error) {
        if (this._isDevelopment) {
          console.error('🎨 Style update error:', error);
        }
      }
    }

    // Process class updates
    for (let i = 0; i < classUpdates.length; i++) {
      const { element, classesToAdd, classesToRemove } = classUpdates[i];
      try {
        if (classesToRemove.length > 0) {
          element.classList.remove(...classesToRemove);
        }
        if (classesToAdd.length > 0) {
          element.classList.add(...classesToAdd);
        }
      } catch (error) {
        if (this._isDevelopment) {
          console.error('🎨 Class update error:', error);
        }
      }
    }

    // ✅ PERFORMANCE: Fast array clearing by setting length
    domUpdates.length = 0;
    styleUpdates.length = 0;
    classUpdates.length = 0;
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