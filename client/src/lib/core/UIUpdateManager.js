// src/lib/core/UIUpdateManager.js
// DAWG - Unified UI Update Manager - Single RAF Loop for All UI Updates

import { realCPUMonitor } from '../utils/RealCPUMonitor.js';
import { idleDetector } from '../utils/IdleDetector.js';

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

    // ⚡ IDLE OPTIMIZATION: Pause updates when idle
    this.isIdle = false;
    this.idleUnsubscribe = null;

    // ⚡ VISIBILITY OPTIMIZATION: Pause updates when tab hidden
    this.isVisible = !document.hidden;
    this.visibilityUnsubscribe = null;

    // Performance tracking
    this.metrics = {
      frameCount: 0,
      totalUpdateTime: 0,
      averageFrameTime: 0,
      droppedFrames: 0,
      lastFrameTime: 0,
      currentFps: 60
    };

    // ⚡ ADAPTIVE FRAME BUDGET: Only use remaining frame time
    this.frameBudget = {
      target: 14, // Target 14ms per frame (leaves 2.67ms safety buffer for 60fps)
      spent: 0,
      exceeded: 0
    };

    // ⚡ ADAPTIVE PERFORMANCE
    this.adaptiveMode = {
      enabled: true,
      currentQuality: 'high', // 'high', 'medium', 'low'
      fpsHistory: [],
      fpsCheckInterval: 60, // Check every 60 frames (~1 second)
      thresholds: {
        high: 55,   // Above 55 FPS = high quality
        medium: 40, // 40-55 FPS = medium quality
        low: 25     // Below 25 FPS = low quality
      }
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

    // ⚡ IDLE OPTIMIZATION: Setup idle detection
    this._setupIdleDetection();

    // ⚡ VISIBILITY OPTIMIZATION: Setup visibility detection
    this._setupVisibilityDetection();

    console.log('🎨 UIUpdateManager initialized with performance optimizations + idle detection + visibility detection');
  }

  /**
   * ⚡ IDLE OPTIMIZATION: Setup idle state callbacks
   */
  _setupIdleDetection() {
    // Register idle callback - pause RAF loop
    idleDetector.onIdle(() => {
      this.isIdle = true;
      console.log('😴 UIUpdateManager: Pausing RAF loop (idle)');

      // Stop RAF loop to save CPU
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    });

    // Register active callback - resume RAF loop
    idleDetector.onActive(() => {
      this.isIdle = false;
      console.log('👁️ UIUpdateManager: Resuming RAF loop (active)');

      // Resume RAF loop if we have subscribers
      if (this.isRunning && !this.rafId && this.subscribers.size > 0) {
        this.rafId = requestAnimationFrame(this._updateLoop);
      }
    });

    // Start idle detector
    idleDetector.start();
  }

  /**
   * ⚡ VISIBILITY OPTIMIZATION: Setup visibility state callbacks
   */
  _setupVisibilityDetection() {
    const handleVisibilityChange = () => {
      const isNowVisible = !document.hidden;

      if (isNowVisible && !this.isVisible) {
        // Tab became visible
        this.isVisible = true;
        console.log('👁️ UIUpdateManager: Tab visible - resuming RAF loop');

        // Resume RAF loop if running and not idle
        if (this.isRunning && !this.isIdle && !this.rafId && this.subscribers.size > 0) {
          this.rafId = requestAnimationFrame(this._updateLoop);
        }
      } else if (!isNowVisible && this.isVisible) {
        // Tab became hidden
        this.isVisible = false;
        console.log('🙈 UIUpdateManager: Tab hidden - pausing RAF loop');

        // Stop RAF loop to save CPU
        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
      }
    };

    // Listen to visibility change event
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Store unsubscribe function for cleanup
    this.visibilityUnsubscribe = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
    this.subscribers.delete(id);

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

    // ⚡ CLEANUP: Remove visibility listener
    if (this.visibilityUnsubscribe) {
      this.visibilityUnsubscribe();
      this.visibilityUnsubscribe = null;
    }
  }

  /**
   * ✅ PERFORMANCE OPTIMIZED: Main update loop with reduced allocations
   */
  _updateLoop(currentTime = performance.now()) {
    if (!this.isRunning) return;

    // ⚡ VISIBILITY CHECK: Don't run if tab is hidden
    if (!this.isVisible) {
      return; // RAF already cancelled in visibility handler
    }

    const frameStartTime = performance.now();

    // ⚡ CRITICAL: Start real CPU measurement
    const frameMeasurement = realCPUMonitor.startMeasure('UIUpdateManager_frame');

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

      // ⚡ ADAPTIVE FRAME BUDGET: Execute updates with time budget awareness
      this.frameBudget.spent = 0;

      for (let i = 0; i < this._updatesToProcessCache.length; i++) {
        const [id, subscriber] = this._updatesToProcessCache[i];

        // ⚡ CRITICAL: Check frame budget before each update
        const timeRemaining = this.frameBudget.target - this.frameBudget.spent;

        // Skip LOW priority updates if we're running out of time
        if (timeRemaining < 2 && subscriber.priority <= UPDATE_PRIORITIES.LOW) {
          subscriber.lastUpdateTime = currentTime - subscriber.frequency + 5; // Retry in 5ms
          continue;
        }

        try {
          const updateStartTime = performance.now();

          // Call subscriber update function
          subscriber.callback(currentTime, frameTime);

          const updateDuration = performance.now() - updateStartTime;
          this.frameBudget.spent += updateDuration;

          // ✅ PERFORMANCE: Track slow updates
          if (updateDuration > 3 && this._isDevelopment) {
            console.warn(`🎨 Slow update: ${id} took ${updateDuration.toFixed(2)}ms`);
          }

        } catch (error) {
          console.error(`🎨 Update error in ${id}:`, error);
          // Don't break the loop for one subscriber's error
        }

        // ⚡ EMERGENCY BRAKE: Stop if we exceed frame budget
        if (this.frameBudget.spent > this.frameBudget.target) {
          this.frameBudget.exceeded++;
          break;
        }
      }

      // Process batched DOM updates
      this._processBatchedUpdates();

    } catch (error) {
      console.error('🎨 Critical error in update loop:', error);
    }

    // ✅ PERFORMANCE: Calculate FPS and adaptive quality
    const frameDuration = performance.now() - frameStartTime;
    this.metrics.totalUpdateTime += frameDuration;
    this.metrics.averageFrameTime = this.metrics.totalUpdateTime / this.metrics.frameCount;

    // Calculate current FPS
    if (frameTime > 0) {
      this.metrics.currentFps = 1000 / frameTime;
    }

    // ⚡ ADAPTIVE PERFORMANCE: Adjust quality based on FPS
    if (this.adaptiveMode.enabled && this.metrics.frameCount % this.adaptiveMode.fpsCheckInterval === 0) {
      this._adjustQualityLevel();
    }

    // ⚡ CRITICAL: End CPU measurement and calculate usage
    realCPUMonitor.endMeasure(frameMeasurement);
    const cpuUsage = realCPUMonitor.measureFrame(frameStartTime);

    // Log heavy frames and frame budget status
    if (this.metrics.frameCount % 300 === 0) { // Every 5 seconds at 60fps
      console.log(`📊 Frame Budget: ${this.frameBudget.spent.toFixed(2)}/${this.frameBudget.target}ms, Exceeded: ${this.frameBudget.exceeded}, CPU: ${cpuUsage.toFixed(1)}%`);
    }

    if (cpuUsage > 80 && this.metrics.frameCount % 60 === 0) {
      console.warn(`🔥 Heavy UI frame: ${cpuUsage.toFixed(1)}% CPU, ${frameDuration.toFixed(2)}ms, Budget: ${this.frameBudget.spent.toFixed(2)}ms`, realCPUMonitor.getReport());
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

  // =================== ADAPTIVE PERFORMANCE ===================

  /**
   * ⚡ ADAPTIVE PERFORMANCE: Adjust quality level based on FPS
   */
  _adjustQualityLevel() {
    const fps = this.metrics.currentFps;
    const { thresholds } = this.adaptiveMode;
    let newQuality = this.adaptiveMode.currentQuality;

    // Determine quality level based on FPS
    if (fps >= thresholds.high) {
      newQuality = 'high';
    } else if (fps >= thresholds.medium) {
      newQuality = 'medium';
    } else if (fps < thresholds.low) {
      newQuality = 'low';
    }

    // Only update if quality changed
    if (newQuality !== this.adaptiveMode.currentQuality) {
      const oldQuality = this.adaptiveMode.currentQuality;
      this.adaptiveMode.currentQuality = newQuality;

      // Notify subscribers about quality change
      this._notifyQualityChange(newQuality, oldQuality, fps);

      if (this._isDevelopment) {
        console.log(`⚡ Adaptive Performance: ${oldQuality} → ${newQuality} (${fps.toFixed(1)} FPS)`);
      }
    }
  }

  /**
   * Notify subscribers about quality changes via custom event
   */
  _notifyQualityChange(newQuality, oldQuality, fps) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ui-quality-change', {
        detail: { quality: newQuality, oldQuality, fps }
      }));
    }
  }

  /**
   * Get current quality level
   */
  getQualityLevel() {
    return this.adaptiveMode.currentQuality;
  }

  /**
   * Enable/disable adaptive performance
   */
  setAdaptiveMode(enabled) {
    this.adaptiveMode.enabled = enabled;
    if (this._isDevelopment) {
      console.log(`⚡ Adaptive Performance ${enabled ? 'enabled' : 'disabled'}`);
    }
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
      fps: this.metrics.frameCount > 0 ? 1000 / this.metrics.averageFrameTime : 0,
      qualityLevel: this.adaptiveMode.currentQuality
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