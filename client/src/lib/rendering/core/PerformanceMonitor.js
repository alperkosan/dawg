/**
 * PERFORMANCE MONITOR
 *
 * Tracks rendering performance and suggests quality adjustments
 * - Real-time FPS tracking
 * - Frame time analysis
 * - Auto-quality adjustment suggestions
 * - Performance analytics
 */

import { createLogger, NAMESPACES } from '@/lib/utils/debugLogger.js';

const log = createLogger(NAMESPACES.PERFORMANCE);

export class PerformanceMonitor {
  constructor(options = {}) {
    this.frameTimes = [];
    this.renderTimes = new Map(); // clipId -> [times]
    this.maxSamples = options.maxSamples || 60; // 1 second at 60fps
    this.targetFPS = options.targetFPS || 60;
    this.targetFrameTime = 1000 / this.targetFPS; // 16.67ms at 60fps

    // Performance thresholds
    this.thresholds = {
      critical: this.targetFrameTime * 2,    // 33ms = <30fps
      warning: this.targetFrameTime * 1.5,   // 25ms = <40fps
      good: this.targetFrameTime,            // 16.67ms = 60fps
      excellent: this.targetFrameTime * 0.5  // 8ms = plenty of headroom
    };

    // Auto-adjustment state
    this.lastAdjustment = Date.now();
    this.adjustmentCooldown = 1000; // 1 second between adjustments

    log.info('PerformanceMonitor initialized', {
      targetFPS: this.targetFPS,
      targetFrameTime: this.targetFrameTime
    });
  }

  /**
   * Record a frame render time
   */
  recordFrame(frameTime) {
    this.frameTimes.push(frameTime);

    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
  }

  /**
   * Record a specific clip render time
   */
  recordClipRender(clipId, renderTime) {
    if (!this.renderTimes.has(clipId)) {
      this.renderTimes.set(clipId, []);
    }

    const times = this.renderTimes.get(clipId);
    times.push(renderTime);

    // Keep only recent samples
    if (times.length > 30) {
      times.shift();
    }
  }

  /**
   * Get average frame time
   */
  getAverageFrameTime() {
    if (this.frameTimes.length === 0) return 0;
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    return sum / this.frameTimes.length;
  }

  /**
   * Get current FPS
   */
  getCurrentFPS() {
    const avgFrameTime = this.getAverageFrameTime();
    return avgFrameTime > 0 ? 1000 / avgFrameTime : 0;
  }

  /**
   * Get performance status
   */
  getStatus() {
    const avgFrameTime = this.getAverageFrameTime();

    if (avgFrameTime > this.thresholds.critical) return 'critical';
    if (avgFrameTime > this.thresholds.warning) return 'warning';
    if (avgFrameTime < this.thresholds.excellent) return 'excellent';
    return 'good';
  }

  /**
   * Check if quality should be reduced
   */
  shouldReduceQuality() {
    const now = Date.now();
    if (now - this.lastAdjustment < this.adjustmentCooldown) {
      return false; // Too soon, don't thrash
    }

    const avgFrameTime = this.getAverageFrameTime();
    return avgFrameTime > this.thresholds.warning;
  }

  /**
   * Check if quality can be increased
   */
  shouldIncreaseQuality() {
    const now = Date.now();
    if (now - this.lastAdjustment < this.adjustmentCooldown) {
      return false; // Too soon, don't thrash
    }

    const avgFrameTime = this.getAverageFrameTime();
    return avgFrameTime < this.thresholds.excellent;
  }

  /**
   * Suggest LOD level based on current performance
   */
  suggestLODLevel() {
    const avgFrameTime = this.getAverageFrameTime();

    if (avgFrameTime > this.thresholds.critical) {
      return 'minimal'; // Emergency mode
    }

    if (avgFrameTime > this.thresholds.warning) {
      return 'simple'; // Reduce quality
    }

    return 'full'; // Good performance, full quality
  }

  /**
   * Mark that an adjustment was made
   */
  markAdjustment() {
    this.lastAdjustment = Date.now();
  }

  /**
   * Get average render time for a specific clip
   */
  getClipAverageRenderTime(clipId) {
    const times = this.renderTimes.get(clipId);
    if (!times || times.length === 0) return 0;

    const sum = times.reduce((a, b) => a + b, 0);
    return sum / times.length;
  }

  /**
   * Get slowest clips
   */
  getSlowestClips(count = 5) {
    const clipStats = Array.from(this.renderTimes.entries()).map(([clipId, times]) => {
      const sum = times.reduce((a, b) => a + b, 0);
      const avg = sum / times.length;
      return { clipId, avgRenderTime: avg, sampleCount: times.length };
    });

    // Sort by average render time descending
    clipStats.sort((a, b) => b.avgRenderTime - a.avgRenderTime);

    return clipStats.slice(0, count);
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const avgFrameTime = this.getAverageFrameTime();
    const fps = this.getCurrentFPS();
    const status = this.getStatus();
    const slowestClips = this.getSlowestClips(3);

    return {
      avgFrameTime: avgFrameTime.toFixed(2) + 'ms',
      fps: fps.toFixed(1),
      status,
      targetFPS: this.targetFPS,
      sampleCount: this.frameTimes.length,
      slowestClips: slowestClips.map(c => ({
        clipId: c.clipId,
        avgRenderTime: c.avgRenderTime.toFixed(2) + 'ms'
      }))
    };
  }

  /**
   * Log statistics
   */
  logStats() {
    const stats = this.getStats();
    log.info('Performance Stats:', stats);
    console.table({
      'Avg Frame Time': stats.avgFrameTime,
      'Current FPS': stats.fps,
      'Status': stats.status,
      'Target FPS': stats.targetFPS,
      'Sample Count': stats.sampleCount
    });

    if (stats.slowestClips.length > 0) {
      console.log('Slowest Clips:');
      console.table(stats.slowestClips);
    }
  }

  /**
   * Reset statistics
   */
  reset() {
    this.frameTimes = [];
    this.renderTimes.clear();
    log.debug('Performance stats reset');
  }

  /**
   * Dispose
   */
  dispose() {
    this.reset();
    log.info('PerformanceMonitor disposed');
  }
}

// Global debug access
if (typeof window !== 'undefined') {
  window.PerformanceMonitorStats = () => {
    if (window.__performanceMonitor) {
      window.__performanceMonitor.logStats();
    } else {
      console.log('No PerformanceMonitor instance found');
    }
  };

  window.PerformanceMonitorReset = () => {
    if (window.__performanceMonitor) {
      window.__performanceMonitor.reset();
      console.log('Performance stats reset');
    }
  };
}
