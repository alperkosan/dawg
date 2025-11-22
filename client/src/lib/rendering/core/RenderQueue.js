/**
 * RENDER QUEUE
 *
 * Manages concurrent waveform rendering with priority queue
 * - Max concurrent renders (prevent browser freeze)
 * - Priority-based scheduling (visible clips first)
 * - Cancellation support (viewport changes)
 * - Progress tracking
 */

import { createLogger, NAMESPACES } from '@/lib/utils/debugLogger.js';

const log = createLogger(NAMESPACES.PERFORMANCE);

export class RenderQueue {
  constructor(options = {}) {
    this.queue = []; // Pending tasks
    this.active = new Set(); // Currently rendering
    this.completed = new Map(); // clipId -> result
    this.maxConcurrent = options.maxConcurrent || 4; // Max 4 concurrent renders
    this.paused = false;

    // Statistics
    this.stats = {
      totalQueued: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalCancelled: 0
    };

    log.info('RenderQueue initialized', { maxConcurrent: this.maxConcurrent });
  }

  /**
   * Add a render task to the queue
   * @param {Object} options - Task options
   * @param {string} options.clipId - Unique clip identifier
   * @param {Function} options.renderFn - Async render function
   * @param {string} options.priority - 'high' | 'normal' | 'low'
   * @param {Object} options.metadata - Additional task metadata
   * @returns {Promise} - Resolves with render result
   */
  add({ clipId, renderFn, priority = 'normal', metadata = {} }) {
    // Check if already in queue or active
    const existingTask = this.queue.find(t => t.clipId === clipId) ||
                        Array.from(this.active).find(t => t.clipId === clipId);

    if (existingTask) {
      log.debug(`Task already queued: ${clipId}`);
      return existingTask.promise;
    }

    // Check if already completed and cached
    if (this.completed.has(clipId)) {
      log.debug(`Task already completed: ${clipId}`);
      return Promise.resolve(this.completed.get(clipId));
    }

    // Create task
    const task = {
      clipId,
      renderFn,
      priority,
      metadata,
      promise: null,
      resolve: null,
      reject: null,
      cancelled: false,
      startTime: null,
      endTime: null
    };

    // Create promise
    task.promise = new Promise((resolve, reject) => {
      task.resolve = resolve;
      task.reject = reject;
    });

    // Insert based on priority
    const insertIndex = this.findInsertIndex(priority);
    this.queue.splice(insertIndex, 0, task);

    this.stats.totalQueued++;

    log.debug(`Task queued: ${clipId}`, {
      priority,
      queueLength: this.queue.length,
      activeCount: this.active.size
    });

    // Start processing if not paused
    if (!this.paused) {
      this.process();
    }

    return task.promise;
  }

  /**
   * Find insertion index based on priority
   */
  findInsertIndex(priority) {
    if (priority === 'high') {
      return 0; // Insert at front
    }

    if (priority === 'low') {
      return this.queue.length; // Insert at end
    }

    // 'normal' - insert after high priority, before low priority
    let index = 0;
    while (index < this.queue.length && this.queue[index].priority === 'high') {
      index++;
    }
    return index;
  }

  /**
   * Process the queue
   */
  async process() {
    // Process tasks while we have capacity and tasks
    while (this.active.size < this.maxConcurrent &&
           this.queue.length > 0 &&
           !this.paused) {

      const task = this.queue.shift();

      // Check if task was cancelled while in queue
      if (task.cancelled) {
        this.stats.totalCancelled++;
        task.reject(new Error('Task cancelled'));
        continue;
      }

      // Mark as active
      this.active.add(task);
      task.startTime = performance.now();

      log.debug(`Task started: ${task.clipId}`, {
        activeCount: this.active.size,
        queueLength: this.queue.length
      });

      // Execute render function
      this.executeTask(task);
    }
  }

  /**
   * Execute a single task
   */
  async executeTask(task) {
    try {
      const result = await task.renderFn();

      // Check if task was cancelled during execution
      if (task.cancelled) {
        this.stats.totalCancelled++;
        task.reject(new Error('Task cancelled'));
      } else {
        task.endTime = performance.now();
        const duration = task.endTime - task.startTime;

        // Cache result
        this.completed.set(task.clipId, result);
        this.stats.totalCompleted++;

        log.debug(`Task completed: ${task.clipId}`, {
          duration: duration.toFixed(2) + 'ms'
        });

        task.resolve(result);
      }
    } catch (error) {
      task.endTime = performance.now();
      this.stats.totalFailed++;

      log.error(`Task failed: ${task.clipId}`, error);
      task.reject(error);
    } finally {
      // Remove from active set
      this.active.delete(task);

      // Continue processing
      this.process();
    }
  }

  /**
   * Cancel a specific task
   */
  cancel(clipId) {
    // Find in queue
    const queueTask = this.queue.find(t => t.clipId === clipId);
    if (queueTask) {
      queueTask.cancelled = true;
      // Remove from queue
      this.queue = this.queue.filter(t => t.clipId !== clipId);
      this.stats.totalCancelled++;
      log.debug(`Task cancelled (queue): ${clipId}`);
      return true;
    }

    // Find in active set
    const activeTask = Array.from(this.active).find(t => t.clipId === clipId);
    if (activeTask) {
      activeTask.cancelled = true;
      // Task will be cancelled when it completes
      log.debug(`Task cancelled (active): ${clipId}`);
      return true;
    }

    return false;
  }

  /**
   * Cancel all tasks
   */
  cancelAll() {
    // Cancel queued tasks
    for (const task of this.queue) {
      task.cancelled = true;
      this.stats.totalCancelled++;
    }
    this.queue = [];

    // Mark active tasks as cancelled
    for (const task of this.active) {
      task.cancelled = true;
      this.stats.totalCancelled++;
    }

    log.info('All tasks cancelled', {
      cancelledCount: this.stats.totalCancelled
    });
  }

  /**
   * Pause queue processing
   */
  pause() {
    this.paused = true;
    log.info('Queue paused');
  }

  /**
   * Resume queue processing
   */
  resume() {
    this.paused = false;
    log.info('Queue resumed');
    this.process();
  }

  /**
   * Clear completed results cache
   */
  clearCache() {
    const count = this.completed.size;
    this.completed.clear();
    log.debug(`Cleared ${count} cached results`);
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeCount: this.active.size,
      completedCount: this.completed.size,
      paused: this.paused,
      maxConcurrent: this.maxConcurrent
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      ...this.getStatus()
    };
  }

  /**
   * Log statistics
   */
  logStats() {
    const stats = this.getStats();
    log.info('RenderQueue Stats:', stats);
    console.table(stats);
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalQueued: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalCancelled: 0
    };
    log.debug('RenderQueue stats reset');
  }

  /**
   * Dispose
   */
  dispose() {
    this.cancelAll();
    this.clearCache();
    this.resetStats();
    log.info('RenderQueue disposed');
  }
}

// Global debug access
if (typeof window !== 'undefined') {
  window.RenderQueueStats = () => {
    if (window.__renderQueue) {
      window.__renderQueue.logStats();
    } else {
      console.log('No RenderQueue instance found');
    }
  };

  window.RenderQueueReset = () => {
    if (window.__renderQueue) {
      window.__renderQueue.resetStats();
      console.log('RenderQueue stats reset');
    }
  };
}
