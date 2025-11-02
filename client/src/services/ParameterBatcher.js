/**
 * PARAMETER BATCHER v2.0
 *
 * Batches parameter changes to AudioWorklets to reduce postMessage overhead
 *
 * Problem:
 * - Sending individual postMessage() for each parameter change is expensive
 * - Knob dragging generates 60+ messages/second
 * - Main thread → Audio thread communication has overhead
 *
 * Solution:
 * - Batch multiple parameter changes into single postMessage
 * - Use RAF to send once per frame (60fps max)
 * - Immediate flush option for critical changes
 * - Per-effect batching (multiple effects don't interfere)
 *
 * Features:
 * - Automatic batching with RAF
 * - Manual flush for immediate updates
 * - Multiple effect support
 * - Parameter priority system
 * - Fallback for non-worklet nodes
 * - Performance monitoring
 *
 * Usage:
 *   const batcher = ParameterBatcher.getInstance();
 *   batcher.setParameter(effectNode, 'threshold', -20);
 *   batcher.setParameter(effectNode, 'ratio', 4);
 *   // Both sent in single postMessage on next frame
 *
 *   // Or immediate:
 *   batcher.setParameter(effectNode, 'bypass', true, { immediate: true });
 */

/**
 * PARAMETER BATCH ENTRY
 */
class BatchEntry {
  constructor(node, parameters = {}, timestamp = performance.now()) {
    this.node = node;
    this.parameters = parameters;
    this.timestamp = timestamp;
    this.priority = 0; // 0 = normal, 1 = high, 2 = critical
  }

  /**
   * Add parameter to batch
   */
  addParameter(key, value, priority = 0) {
    this.parameters[key] = value;
    this.priority = Math.max(this.priority, priority);
    this.timestamp = performance.now();
  }

  /**
   * Check if batch is empty
   */
  isEmpty() {
    return Object.keys(this.parameters).length === 0;
  }

  /**
   * Get parameter count
   */
  size() {
    return Object.keys(this.parameters).length;
  }

  /**
   * Clear all parameters
   */
  clear() {
    this.parameters = {};
    this.priority = 0;
  }
}

/**
 * PARAMETER BATCHER
 */
export class ParameterBatcher {
  constructor() {
    this.batches = new Map(); // Map<AudioWorkletNode, BatchEntry>
    this.rafId = null;
    this.running = false;

    // Configuration
    this.config = {
      batchInterval: 16,      // 60fps (ms)
      maxBatchSize: 50,       // Max parameters per batch
      maxBatchAge: 100,       // Max age before force flush (ms)
      enableLogging: false,   // Log batch statistics
    };

    // Statistics
    this.stats = {
      totalBatches: 0,
      totalParameters: 0,
      batchesSaved: 0,        // How many individual postMessages avoided
      avgBatchSize: 0,
      maxBatchSize: 0,
    };
  }

  /**
   * SINGLETON PATTERN
   */
  static getInstance() {
    if (!ParameterBatcher.instance) {
      ParameterBatcher.instance = new ParameterBatcher();
    }
    return ParameterBatcher.instance;
  }

  /**
   * PARAMETER MANAGEMENT
   */

  /**
   * Set parameter (batched)
   * @param {AudioWorkletNode|AudioNode} node - Target audio node
   * @param {string} key - Parameter name
   * @param {any} value - Parameter value
   * @param {object} options - { immediate: false, priority: 0 }
   */
  setParameter(node, key, value, options = {}) {
    const { immediate = false, priority = 0 } = options;

    // Validation
    if (!node) {
      console.warn('ParameterBatcher: Invalid node');
      return;
    }

    // Handle non-worklet nodes (AudioParams)
    if (node.parameters && node.parameters.get) {
      const param = node.parameters.get(key);
      if (param) {
        param.value = value;
        return;
      }
    }

    // Handle worklet nodes (postMessage)
    if (!node.port) {
      console.warn('ParameterBatcher: Node has no port (not a worklet?)');
      return;
    }

    // Get or create batch for this node
    let batch = this.batches.get(node);
    if (!batch) {
      batch = new BatchEntry(node);
      this.batches.set(node, batch);
    }

    // Add parameter to batch
    batch.addParameter(key, value, priority);

    // Log
    if (this.config.enableLogging) {
      console.log(`📦 Batched: ${key} = ${value} (batch size: ${batch.size()})`);
    }

    // Immediate flush if requested
    if (immediate) {
      this.flushNode(node);
      return;
    }

    // Check if batch is too large
    if (batch.size() >= this.config.maxBatchSize) {
      this.flushNode(node);
      return;
    }

    // Check if batch is too old
    const age = performance.now() - batch.timestamp;
    if (age >= this.config.maxBatchAge) {
      this.flushNode(node);
      return;
    }

    // Start RAF loop if not running
    this.start();
  }

  /**
   * Set multiple parameters at once
   */
  setParameters(node, parameters, options = {}) {
    for (const [key, value] of Object.entries(parameters)) {
      this.setParameter(node, key, value, { ...options, immediate: false });
    }

    // Flush if immediate requested
    if (options.immediate) {
      this.flushNode(node);
    }
  }

  /**
   * FLUSHING
   */

  /**
   * Flush a specific node's batch
   */
  flushNode(node) {
    const batch = this.batches.get(node);
    if (!batch || batch.isEmpty()) return;

    // Send batched message
    try {
      node.port.postMessage({
        type: 'parameters',
        parameters: batch.parameters
      });

      // Update stats
      const batchSize = batch.size();
      this.stats.totalBatches++;
      this.stats.totalParameters += batchSize;
      this.stats.batchesSaved += (batchSize - 1); // Saved (n-1) postMessages
      this.stats.maxBatchSize = Math.max(this.stats.maxBatchSize, batchSize);
      this.stats.avgBatchSize = this.stats.totalParameters / this.stats.totalBatches;

      if (this.config.enableLogging) {
        console.log(`📤 Flushed batch: ${batchSize} parameters to worklet`);
      }

      // Clear batch
      batch.clear();
    } catch (e) {
      console.error('ParameterBatcher: Flush failed', e);
    }
  }

  /**
   * Flush all batches
   */
  flushAll() {
    let flushedCount = 0;

    for (const [node, batch] of this.batches) {
      if (!batch.isEmpty()) {
        this.flushNode(node);
        flushedCount++;
      }
    }

    if (this.config.enableLogging && flushedCount > 0) {
      console.log(`📤 Flushed ${flushedCount} batches`);
    }

    return flushedCount;
  }

  /**
   * RAF LOOP
   */

  /**
   * Start RAF loop
   */
  start() {
    if (this.running) return;

    this.running = true;
    this._scheduleFlush();
  }

  /**
   * Stop RAF loop
   */
  stop() {
    if (!this.running) return;

    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Schedule next flush
   */
  _scheduleFlush() {
    if (!this.running) return;

    this.rafId = requestAnimationFrame(() => {
      // Flush all pending batches
      this.flushAll();

      // Stop if no more batches
      if (this.batches.size === 0) {
        this.stop();
      } else {
        this._scheduleFlush();
      }
    });
  }

  /**
   * NODE MANAGEMENT
   */

  /**
   * Remove node from batching system
   */
  removeNode(node) {
    // Flush before removing
    this.flushNode(node);
    this.batches.delete(node);

    // Stop RAF if no more batches
    if (this.batches.size === 0) {
      this.stop();
    }
  }

  /**
   * Remove all nodes
   */
  clear() {
    this.flushAll();
    this.batches.clear();
    this.stop();
  }

  /**
   * STATISTICS
   */

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeBatches: this.batches.size,
      running: this.running,
      efficiency: this.stats.totalParameters > 0
        ? (this.stats.batchesSaved / this.stats.totalParameters * 100).toFixed(1) + '%'
        : '0%'
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalBatches: 0,
      totalParameters: 0,
      batchesSaved: 0,
      avgBatchSize: 0,
      maxBatchSize: 0,
    };
  }

  /**
   * Log statistics
   */
  logStats() {
    const stats = this.getStats();

    console.group('📦 Parameter Batcher - Statistics');
    console.log(`Total Batches: ${stats.totalBatches}`);
    console.log(`Total Parameters: ${stats.totalParameters}`);
    console.log(`Messages Saved: ${stats.batchesSaved}`);
    console.log(`Avg Batch Size: ${stats.avgBatchSize.toFixed(2)}`);
    console.log(`Max Batch Size: ${stats.maxBatchSize}`);
    console.log(`Efficiency: ${stats.efficiency}`);
    console.log(`Active Batches: ${stats.activeBatches}`);
    console.log(`Running: ${stats.running}`);
    console.groupEnd();
  }

  /**
   * CONFIGURATION
   */

  /**
   * Set configuration
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * CLEANUP
   */

  /**
   * Dispose of batcher
   */
  dispose() {
    this.clear();
    this.resetStats();
    console.log('🧹 Parameter Batcher disposed');
  }
}

/**
 * GLOBAL INSTANCE
 */
export const parameterBatcher = ParameterBatcher.getInstance();

/**
 * CONVENIENCE FUNCTIONS
 */

/**
 * Set parameter (convenience function)
 */
export const setParameter = (node, key, value, options) => {
  parameterBatcher.setParameter(node, key, value, options);
};

/**
 * Set multiple parameters (convenience function)
 */
export const setParameters = (node, parameters, options) => {
  parameterBatcher.setParameters(node, parameters, options);
};

/**
 * Flush node (convenience function)
 */
export const flushParameters = (node) => {
  if (node) {
    parameterBatcher.flushNode(node);
  } else {
    parameterBatcher.flushAll();
  }
};

/**
 * REACT HOOK
 */
import { useEffect, useRef, useCallback } from 'react';

/**
 * React hook for parameter batching
 */
export const useParameterBatcher = (node) => {
  const nodeRef = useRef(node);

  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

  // Set single parameter
  const setParam = useCallback((key, value, options) => {
    if (nodeRef.current) {
      parameterBatcher.setParameter(nodeRef.current, key, value, options);
    }
  }, []);

  // Set multiple parameters
  const setParams = useCallback((parameters, options) => {
    if (nodeRef.current) {
      parameterBatcher.setParameters(nodeRef.current, parameters, options);
    }
  }, []);

  // Flush
  const flush = useCallback(() => {
    if (nodeRef.current) {
      parameterBatcher.flushNode(nodeRef.current);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (nodeRef.current) {
        parameterBatcher.removeNode(nodeRef.current);
      }
    };
  }, []);

  return { setParam, setParams, flush };
};

export default ParameterBatcher;
