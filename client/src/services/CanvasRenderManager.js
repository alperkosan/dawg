/**
 * CANVAS RENDER MANAGER v2.0
 *
 * Centralized RAF (RequestAnimationFrame) management system
 * Prevents multiple competing RAF loops, optimizes performance
 *
 * Features:
 * - Priority-based rendering queue
 * - Smart throttling (different fps for different tasks)
 * - Canvas pooling (reuse canvases)
 * - Automatic start/stop
 * - Performance monitoring
 *
 * Problem Solved:
 * Before: Each plugin had its own RAF loop (8 plugins = 8 loops!)
 * After: Single RAF loop, priority queue, shared resources
 *
 * Usage:
 *   const renderManager = CanvasRenderManager.getInstance();
 *   renderManager.register(myRenderer, 1, 16); // priority 1, 60fps
 */

/**
 * RENDERER TASK
 *
 * Individual rendering task in the queue
 */
class RendererTask {
  constructor(id, callback, priority = 0, throttle = 0) {
    this.id = id;
    this.callback = callback;
    this.priority = priority;     // Higher = renders first
    this.throttle = throttle;     // Min ms between renders (0 = every frame)
    this.lastRun = 0;
    this.enabled = true;

    // ✅ DIRTY TRACKING: Skip rendering if nothing changed
    this.isDirty = true;          // Start dirty (needs initial render)
    this.dirtyRegions = [];       // Specific regions to redraw (optional)

    this.stats = {
      renderCount: 0,
      totalTime: 0,
      avgTime: 0,
      maxTime: 0,
      skippedFrames: 0            // ✅ Track skipped frames
    };
  }

  /**
   * Check if this task should run now
   */
  shouldRender(now) {
    if (!this.enabled) return false;

    // ✅ OPTIMIZATION: Skip if not dirty and throttled
    const throttleReady = (now - this.lastRun) >= this.throttle;
    if (!throttleReady) return false;

    // Only render if dirty or throttle allows
    return this.isDirty || throttleReady;
  }

  /**
   * Mark this task as dirty (needs redraw)
   * @param {Object} region - Optional specific region {x, y, width, height}
   */
  markDirty(region = null) {
    this.isDirty = true;
    if (region) {
      this.dirtyRegions.push(region);
    }
  }

  /**
   * Clear dirty flag after successful render
   */
  clearDirty() {
    this.isDirty = false;
    this.dirtyRegions = [];
  }

  /**
   * Execute the render callback
   */
  render(now) {
    const startTime = performance.now();

    try {
      this.callback(now);
      this.lastRun = now;

      // Update stats
      const renderTime = performance.now() - startTime;
      this.stats.renderCount++;
      this.stats.totalTime += renderTime;
      this.stats.avgTime = this.stats.totalTime / this.stats.renderCount;
      this.stats.maxTime = Math.max(this.stats.maxTime, renderTime);

      // ✅ Clear dirty flag after successful render
      this.clearDirty();
    } catch (e) {
      console.error(`Renderer ${this.id} error:`, e);
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      renderCount: 0,
      totalTime: 0,
      avgTime: 0,
      maxTime: 0,
      skippedFrames: 0
    };
  }
}

/**
 * CANVAS POOL
 *
 * Reusable canvas pool to avoid expensive canvas creation
 */
class CanvasPool {
  constructor(maxSize = 10) {
    this.pool = [];
    this.maxSize = maxSize;
    this.created = 0;
    this.reused = 0;
  }

  /**
   * Acquire a canvas from pool
   */
  acquire(width, height) {
    let canvas = this.pool.pop();

    if (!canvas) {
      canvas = document.createElement('canvas');
      this.created++;
    } else {
      this.reused++;
    }

    canvas.width = width;
    canvas.height = height;

    return canvas;
  }

  /**
   * Release canvas back to pool
   */
  release(canvas) {
    if (this.pool.length < this.maxSize) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      this.pool.push(canvas);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      poolSize: this.pool.length,
      maxSize: this.maxSize,
      created: this.created,
      reused: this.reused,
      reuseRate: this.reused / (this.created + this.reused) || 0
    };
  }

  /**
   * Clear pool
   */
  clear() {
    this.pool = [];
  }
}

/**
 * CANVAS RENDER MANAGER
 *
 * Main rendering orchestrator
 */
class CanvasRenderManager {
  constructor() {
    this.tasks = new Map();
    this.rafId = null;
    this.running = false;
    this.canvasPool = new CanvasPool(10);

    // Performance monitoring
    this.frameCount = 0;
    this.fps = 0;
    this.lastFpsUpdate = performance.now();

    // Global performance stats
    this.stats = {
      totalFrames: 0,
      droppedFrames: 0,
      avgFrameTime: 0,
      maxFrameTime: 0
    };

    // Optimization: Cache sorted tasks
    this.sortedTasksCache = [];
    this.tasksDirty = false;
  }

  /**
   * SINGLETON PATTERN
   */
  static getInstance() {
    if (!CanvasRenderManager.instance) {
      CanvasRenderManager.instance = new CanvasRenderManager();
    }
    return CanvasRenderManager.instance;
  }

  /**
   * TASK MANAGEMENT
   */

  /**
   * Register a renderer
   * @param {string} id - Unique identifier
   * @param {function} callback - Render function
   * @param {number} priority - Higher renders first (0-10)
   * @param {number} throttle - Min ms between renders (0 = every frame, 16 = 60fps, 50 = 20fps)
   */
  register(id, callback, priority = 0, throttle = 0) {
    if (this.tasks.has(id)) {
      console.warn(`Renderer ${id} already registered, replacing...`);
    }

    const task = new RendererTask(id, callback, priority, throttle);
    this.tasks.set(id, task);
    this.tasksDirty = true; // Mark for resorting

    // Start RAF loop if not running
    this.start();

    console.log(`🎨 Registered renderer: ${id} (priority: ${priority}, throttle: ${throttle}ms)`);
    return id;
  }

  /**
   * Unregister a renderer
   */
  unregister(id) {
    const task = this.tasks.get(id);
    if (task) {
      this.tasks.delete(id);
      this.tasksDirty = true; // Mark for resorting
      console.log(`🗑️ Unregistered renderer: ${id}`);

      // Stop RAF if no more tasks
      if (this.tasks.size === 0) {
        this.stop();
      }
    }
  }

  /**
   * Enable/disable a renderer without removing it
   */
  setEnabled(id, enabled) {
    const task = this.tasks.get(id);
    if (task) {
      task.enabled = enabled;
    }
  }

  /**
   * Update renderer priority
   */
  setPriority(id, priority) {
    const task = this.tasks.get(id);
    if (task) {
      task.priority = priority;
      this.tasksDirty = true; // Mark for resorting
    }
  }

  /**
   * Update renderer throttle
   */
  setThrottle(id, throttle) {
    const task = this.tasks.get(id);
    if (task) {
      task.throttle = throttle;
    }
  }

  /**
   * Mark a renderer as dirty (needs redraw)
   * @param {string} id - Renderer ID
   * @param {Object} region - Optional specific region {x, y, width, height}
   */
  markDirty(id, region = null) {
    const task = this.tasks.get(id);
    if (task) {
      task.markDirty(region);
    }
  }

  /**
   * RAF LOOP
   */

  /**
   * Start the RAF loop
   */
  start() {
    if (this.running) return;

    this.running = true;
    this.render();
    console.log('▶️ Canvas Render Manager started');
  }

  /**
   * Stop the RAF loop
   */
  stop() {
    if (!this.running) return;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.running = false;
    console.log('⏸️ Canvas Render Manager stopped');
  }

  /**
   * Main render loop
   */
  render() {
    if (!this.running) return;

    const now = performance.now();
    const frameStart = now;

    // Get tasks sorted by priority (high to low)
    // ✅ OPTIMIZATION: Only resort when tasks change
    if (this.tasksDirty || this.sortedTasksCache.length !== this.tasks.size) {
      this.sortedTasksCache = Array.from(this.tasks.values())
        .sort((a, b) => b.priority - a.priority);
      this.tasksDirty = false;
    }

    // Render each task that's ready
    let rendered = 0;
    let skipped = 0;
    for (const task of this.sortedTasksCache) {
      if (task.shouldRender(now)) {
        task.render(now);
        rendered++;
      } else if (!task.isDirty) {
        // ✅ Track skipped frames (not dirty, no need to render)
        task.stats.skippedFrames++;
        skipped++;
      }
    }

    // Update FPS counter
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    // Update global stats
    const frameTime = performance.now() - frameStart;
    this.stats.totalFrames++;
    this.stats.avgFrameTime = (this.stats.avgFrameTime * (this.stats.totalFrames - 1) + frameTime) / this.stats.totalFrames;
    this.stats.maxFrameTime = Math.max(this.stats.maxFrameTime, frameTime);

    // Detect dropped frames (>16.67ms = missed 60fps)
    if (frameTime > 16.67) {
      this.stats.droppedFrames++;
    }

    // Schedule next frame
    this.rafId = requestAnimationFrame(() => this.render());
  }

  /**
   * CANVAS POOL ACCESS
   */

  /**
   * Get canvas from pool
   */
  acquireCanvas(width, height) {
    return this.canvasPool.acquire(width, height);
  }

  /**
   * Return canvas to pool
   */
  releaseCanvas(canvas) {
    this.canvasPool.release(canvas);
  }

  /**
   * STATISTICS & DEBUGGING
   */

  /**
   * Get renderer statistics
   */
  getRendererStats(id) {
    const task = this.tasks.get(id);
    return task ? { ...task.stats } : null;
  }

  /**
   * Get all statistics
   */
  getAllStats() {
    const renderers = {};
    for (const [id, task] of this.tasks) {
      renderers[id] = {
        ...task.stats,
        priority: task.priority,
        throttle: task.throttle,
        enabled: task.enabled
      };
    }

    return {
      running: this.running,
      fps: this.fps,
      taskCount: this.tasks.size,
      globalStats: { ...this.stats },
      canvasPool: this.canvasPool.getStats(),
      renderers
    };
  }

  /**
   * Reset all statistics
   */
  resetStats() {
    this.stats = {
      totalFrames: 0,
      droppedFrames: 0,
      avgFrameTime: 0,
      maxFrameTime: 0
    };

    for (const task of this.tasks.values()) {
      task.resetStats();
    }
  }

  /**
   * Log performance report
   */
  logPerformanceReport() {
    const stats = this.getAllStats();

    console.group('🎨 Canvas Render Manager - Performance Report');
    console.log(`FPS: ${stats.fps}`);
    console.log(`Tasks: ${stats.taskCount}`);
    console.log(`Total Frames: ${stats.globalStats.totalFrames}`);
    console.log(`Dropped Frames: ${stats.globalStats.droppedFrames}`);
    console.log(`Avg Frame Time: ${stats.globalStats.avgFrameTime.toFixed(2)}ms`);
    console.log(`Max Frame Time: ${stats.globalStats.maxFrameTime.toFixed(2)}ms`);

    console.group('Canvas Pool');
    console.log(`Size: ${stats.canvasPool.poolSize}/${stats.canvasPool.maxSize}`);
    console.log(`Created: ${stats.canvasPool.created}`);
    console.log(`Reused: ${stats.canvasPool.reused}`);
    console.log(`Reuse Rate: ${(stats.canvasPool.reuseRate * 100).toFixed(1)}%`);
    console.groupEnd();

    console.group('Renderers');
    for (const [id, renderer] of Object.entries(stats.renderers)) {
      console.log(`${id}: ${renderer.renderCount} renders, avg ${renderer.avgTime.toFixed(2)}ms, max ${renderer.maxTime.toFixed(2)}ms`);
    }
    console.groupEnd();

    console.groupEnd();
  }

  /**
   * CLEANUP
   */

  /**
   * Unregister all renderers and stop
   */
  cleanup() {
    this.stop();
    this.tasks.clear();
    this.sortedTasksCache = [];
    this.tasksDirty = false;
    this.canvasPool.clear();
    this.resetStats();
    console.log('🧹 Canvas Render Manager cleaned up');
  }
}

/**
 * GLOBAL INSTANCE
 */
export const renderManager = CanvasRenderManager.getInstance();

/**
 * CONVENIENCE HOOKS FOR REACT
 */

/**
 * React hook for registering a renderer
 */
import { useEffect, useRef } from 'react';

export const useRenderer = (callback, priority = 0, throttle = 16, deps = []) => {
  const idRef = useRef(null);
  const callbackRef = useRef(callback);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    // Generate unique ID
    const id = `renderer_${Math.random().toString(36).substr(2, 9)}`;
    idRef.current = id;

    // Register renderer with stable callback wrapper
    renderManager.register(id, (now) => {
      if (callbackRef.current) {
        callbackRef.current(now);
      }
    }, priority, throttle);

    // Cleanup on unmount
    return () => {
      renderManager.unregister(id);
    };
  }, [priority, throttle, ...deps]);

  return idRef.current;
};

/**
 * React hook for canvas pooling
 */
export const useCanvasPool = (width, height) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    // Acquire canvas
    canvasRef.current = renderManager.acquireCanvas(width, height);

    // Release on unmount
    return () => {
      if (canvasRef.current) {
        renderManager.releaseCanvas(canvasRef.current);
      }
    };
  }, [width, height]);

  return canvasRef.current;
};

export default CanvasRenderManager;
