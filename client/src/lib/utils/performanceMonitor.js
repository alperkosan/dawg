// lib/utils/performanceMonitor.js
// Performance monitoring for Piano Roll optimizations

import { getPoolStats } from './objectPool';
import { useState, useEffect } from 'react';

/**
 * Performance Monitor for tracking Piano Roll optimization results
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      renderCycles: 0,
      frameDrops: 0,
      scrollEvents: 0,
      noteUpdates: 0,
      playheadUpdates: 0,
      gcPressure: 0,
      lastFrameTime: 0,
      avgFrameTime: 0,
      worstFrameTime: 0,
      startTime: Date.now()
    };

    this.frameTimes = [];
    this.maxSamples = 100;
    this.isMonitoring = false;
    this.rafId = null;
  }

  /**
   * Start performance monitoring
   */
  start() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.metrics.startTime = Date.now();
    this.metrics.renderCycles = 0;
    this.frameTimes = [];

    console.log('🚀 Piano Roll Performance Monitor started');
    this.monitorFrames();
  }

  /**
   * Stop performance monitoring
   */
  stop() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    console.log('⏹️ Piano Roll Performance Monitor stopped');
    this.generateReport();
  }

  /**
   * Monitor frame timing using requestAnimationFrame
   */
  monitorFrames() {
    if (!this.isMonitoring) return;

    const frameStart = performance.now();

    // Calculate frame delta
    if (this.metrics.lastFrameTime > 0) {
      const frameDelta = frameStart - this.metrics.lastFrameTime;
      this.frameTimes.push(frameDelta);

      // Keep only recent samples
      if (this.frameTimes.length > this.maxSamples) {
        this.frameTimes.shift();
      }

      // Update metrics
      this.metrics.avgFrameTime = this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length;
      this.metrics.worstFrameTime = Math.max(this.metrics.worstFrameTime, frameDelta);

      // Count frame drops (> 16.67ms for 60fps)
      if (frameDelta > 16.67) {
        this.metrics.frameDrops++;
      }
    }

    this.metrics.lastFrameTime = frameStart;
    this.metrics.renderCycles++;

    this.rafId = requestAnimationFrame(() => this.monitorFrames());
  }

  /**
   * Track scroll events
   */
  trackScrollEvent() {
    this.metrics.scrollEvents++;
  }

  /**
   * Track note updates
   */
  trackNoteUpdate() {
    this.metrics.noteUpdates++;
  }

  /**
   * Track playhead updates
   */
  trackPlayheadUpdate() {
    this.metrics.playheadUpdates++;
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport() {
    const runtime = (Date.now() - this.metrics.startTime) / 1000;
    const poolStats = getPoolStats();

    const report = {
      // Timing metrics
      runtime: `${runtime.toFixed(2)}s`,
      avgFPS: (this.metrics.renderCycles / runtime).toFixed(2),
      avgFrameTime: `${this.metrics.avgFrameTime.toFixed(2)}ms`,
      worstFrameTime: `${this.metrics.worstFrameTime.toFixed(2)}ms`,
      frameDrops: this.metrics.frameDrops,
      frameDropRate: `${((this.metrics.frameDrops / this.metrics.renderCycles) * 100).toFixed(2)}%`,

      // Event metrics
      scrollEventsPerSec: (this.metrics.scrollEvents / runtime).toFixed(2),
      noteUpdatesPerSec: (this.metrics.noteUpdates / runtime).toFixed(2),
      playheadUpdatesPerSec: (this.metrics.playheadUpdates / runtime).toFixed(2),

      // Memory metrics
      objectPoolStats: poolStats,
      estimatedMemorySaving: this.calculateMemorySaving(poolStats)
    };

    console.group('📊 Piano Roll Performance Report');
    console.log('⏱️ Timing:', {
      runtime: report.runtime,
      avgFPS: report.avgFPS,
      avgFrameTime: report.avgFrameTime,
      worstFrameTime: report.worstFrameTime,
      frameDrops: `${report.frameDrops} (${report.frameDropRate})`
    });
    console.log('📈 Events:', {
      scrollEventsPerSec: report.scrollEventsPerSec,
      noteUpdatesPerSec: report.noteUpdatesPerSec,
      playheadUpdatesPerSec: report.playheadUpdatesPerSec
    });
    console.log('💾 Memory:', {
      poolStats: report.objectPoolStats,
      estimatedSaving: report.estimatedMemorySaving
    });
    console.groupEnd();

    return report;
  }

  /**
   * Calculate estimated memory savings from object pooling
   */
  calculateMemorySaving(poolStats) {
    const totalObjectsPooled = Object.values(poolStats)
      .reduce((sum, pool) => sum + pool.totalAllocated, 0);

    // Estimate memory saved (rough calculation)
    const avgObjectSize = 100; // bytes (rough estimate)
    const savedBytes = totalObjectsPooled * avgObjectSize;

    return {
      objectsPooled: totalObjectsPooled,
      estimatedBytes: savedBytes,
      estimatedKB: (savedBytes / 1024).toFixed(2),
      estimatedMB: (savedBytes / (1024 * 1024)).toFixed(2)
    };
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Check if performance is acceptable
   */
  isPerformanceGood() {
    return {
      fps: this.metrics.renderCycles / ((Date.now() - this.metrics.startTime) / 1000) >= 55,
      frameDrops: (this.metrics.frameDrops / this.metrics.renderCycles) < 0.05, // Less than 5%
      avgFrameTime: this.metrics.avgFrameTime < 16.67 // 60fps target
    };
  }

  /**
   * Generate performance warnings
   */
  getWarnings() {
    const warnings = [];
    const perf = this.isPerformanceGood();

    if (!perf.fps) {
      warnings.push('🐌 Low FPS detected - consider reducing visual complexity');
    }

    if (!perf.frameDrops) {
      warnings.push('📉 High frame drop rate - check for expensive operations');
    }

    if (!perf.avgFrameTime) {
      warnings.push('⏰ Slow frame times - optimize render path');
    }

    if (this.metrics.scrollEvents / ((Date.now() - this.metrics.startTime) / 1000) > 100) {
      warnings.push('🖱️ High scroll event rate - increase throttling');
    }

    return warnings;
  }
}

// ==========================================================================
// GLOBAL MONITOR INSTANCE
// ==========================================================================

const performanceMonitor = new PerformanceMonitor();

// ==========================================================================
// REACT HOOKS FOR EASY INTEGRATION
// ==========================================================================

/**
 * React hook for performance monitoring
 */
export const usePerformanceMonitor = (autoStart = false) => {
  // Note: React import should be handled by the consuming component
  const [isMonitoring, setIsMonitoring] = useState(performanceMonitor.isMonitoring);
  const [metrics, setMetrics] = useState(performanceMonitor.getMetrics());

  useEffect(() => {
    if (autoStart) {
      performanceMonitor.start();
      setIsMonitoring(true);
    }

    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getMetrics());
      setIsMonitoring(performanceMonitor.isMonitoring);
    }, 1000);

    return () => {
      clearInterval(interval);
      if (autoStart) {
        performanceMonitor.stop();
      }
    };
  }, [autoStart]);

  return {
    isMonitoring,
    metrics,
    start: () => {
      performanceMonitor.start();
      setIsMonitoring(true);
    },
    stop: () => {
      performanceMonitor.stop();
      setIsMonitoring(false);
    },
    generateReport: () => performanceMonitor.generateReport(),
    getWarnings: () => performanceMonitor.getWarnings(),
    isPerformanceGood: () => performanceMonitor.isPerformanceGood()
  };
};

// ==========================================================================
// SPECIFIC TRACKING FUNCTIONS
// ==========================================================================

/**
 * Track scroll performance
 */
export const trackScrollEvent = () => {
  performanceMonitor.trackScrollEvent();
};

/**
 * Track note rendering performance
 */
export const trackNoteUpdate = () => {
  performanceMonitor.trackNoteUpdate();
};

/**
 * Track playhead performance
 */
export const trackPlayheadUpdate = () => {
  performanceMonitor.trackPlayheadUpdate();
};

/**
 * Wrapper function to measure execution time
 */
export const measurePerformance = (name, fn) => {
  const start = performance.now();
  const result = fn();
  const end = performance.now();

  console.log(`⚡ ${name}: ${(end - start).toFixed(2)}ms`);
  return result;
};

/**
 * Async wrapper function to measure execution time
 */
export const measurePerformanceAsync = async (name, fn) => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();

  console.log(`⚡ ${name}: ${(end - start).toFixed(2)}ms`);
  return result;
};

// ==========================================================================
// DEVELOPMENT HELPERS
// ==========================================================================

/**
 * Add performance overlay to Piano Roll (development only)
 */
export const addPerformanceOverlay = (container) => {
  if (process.env.NODE_ENV !== 'development') return null;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: #00ff00;
    padding: 10px;
    font-family: monospace;
    font-size: 12px;
    z-index: 10000;
    border-radius: 4px;
    min-width: 200px;
  `;

  container.appendChild(overlay);

  const updateOverlay = () => {
    const metrics = performanceMonitor.getMetrics();
    const runtime = (Date.now() - metrics.startTime) / 1000;

    overlay.innerHTML = `
      <div>FPS: ${(metrics.renderCycles / runtime).toFixed(1)}</div>
      <div>Frame: ${metrics.avgFrameTime.toFixed(1)}ms</div>
      <div>Drops: ${metrics.frameDrops}</div>
      <div>Scroll: ${metrics.scrollEvents}</div>
      <div>Notes: ${metrics.noteUpdates}</div>
      <div>Playhead: ${metrics.playheadUpdates}</div>
    `;
  };

  const interval = setInterval(updateOverlay, 100);

  return () => {
    clearInterval(interval);
    if (container.contains(overlay)) {
      container.removeChild(overlay);
    }
  };
};

// Export singleton instance and class
export { performanceMonitor, PerformanceMonitor };