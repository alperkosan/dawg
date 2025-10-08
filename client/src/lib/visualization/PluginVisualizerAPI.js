/**
 * PLUGIN VISUALIZER API
 *
 * High-level API for plugin developers to integrate with VisualizationEngine.
 * Provides simple registration, parameter updates, and lifecycle management.
 *
 * Usage:
 *   const viz = PluginVisualizerAPI.register('my-plugin', {
 *     canvas: canvasElement,
 *     visualizer: MyCustomVisualizer,
 *     priority: 'normal',
 *     params: { gain: 0.5, freq: 440 }
 *   });
 */

import { visualizationEngine } from './VisualizationEngine';
import { MeteringService } from '../core/MeteringService';

class PluginVisualizerAPIClass {
  constructor() {
    // Registry of plugin visualizers
    this.visualizers = new Map(); // pluginId → { visualizer, params, meterId }

    // Audio data subscriptions
    this.audioSubscriptions = new Map(); // pluginId → unsubscribe function

    // Grace period cache for React StrictMode compatibility
    // Prevents re-initialization when component unmount→remount during StrictMode
    this.gracePeriodCache = new Map(); // pluginId → { visualizer, timeout }
    this.GRACE_PERIOD_MS = 100; // 100ms window for re-registration
  }

  /**
   * Register a plugin visualizer
   * @param {string} pluginId - Unique plugin ID
   * @param {object} config - Configuration
   * @param {HTMLCanvasElement} config.canvas - Canvas element
   * @param {class} config.visualizer - Visualizer class (extends BasePluginVisualizer)
   * @param {string} config.priority - Priority ('critical', 'normal', 'low')
   * @param {object} config.params - Initial parameters
   * @param {string} config.meterId - Optional meter ID for audio data
   * @param {object} config.meterConfig - Optional meter configuration
   * @returns {object} Visualizer instance
   */
  register(pluginId, config) {
    // Check if already registered
    if (this.visualizers.has(pluginId)) {
      console.warn(`[PluginVisualizerAPI] Plugin ${pluginId} already registered`);
      return this.visualizers.get(pluginId).visualizer;
    }

    // Check grace period cache (React StrictMode compatibility)
    if (this.gracePeriodCache.has(pluginId)) {
      console.log(`[PluginVisualizerAPI] ⚡ Re-using cached visualizer for ${pluginId} (StrictMode)`);
      const cached = this.gracePeriodCache.get(pluginId);
      clearTimeout(cached.timeout);
      this.gracePeriodCache.delete(pluginId);

      // Re-register cached instance with VisualizationEngine
      visualizationEngine.registerVisualizer(
        pluginId,
        cached.visualizer,
        cached.priority
      );

      // Restore to main registry
      this.visualizers.set(pluginId, {
        visualizer: cached.visualizer,
        params: cached.params,
        meterId: cached.meterId
      });

      console.log(`🔄 Plugin visualizer restored from cache: ${pluginId}`);
      return cached.visualizer;
    }

    const {
      canvas,
      visualizer: VisualizerClass,
      priority = 'normal',
      params = {},
      meterId = null,
      meterConfig = {}
    } = config;

    if (!canvas) {
      console.error(`[PluginVisualizerAPI] No canvas provided for ${pluginId}`);
      return null;
    }

    if (!VisualizerClass) {
      console.error(`[PluginVisualizerAPI] No visualizer class provided for ${pluginId}`);
      return null;
    }

    // Create visualizer instance
    const visualizerInstance = new VisualizerClass({
      id: `${pluginId}-viz`,
      pluginId,
      canvas,
      priority
    });

    // Initialize visualizer
    visualizerInstance.init().then(() => {
      console.log(`✅ Plugin visualizer initialized: ${pluginId}`);
    }).catch(err => {
      console.error(`❌ Failed to initialize visualizer for ${pluginId}:`, err);
    });

    // Register with VisualizationEngine
    visualizationEngine.registerVisualizer(
      pluginId,
      visualizerInstance,
      priority
    );

    // Store in registry
    this.visualizers.set(pluginId, {
      visualizer: visualizerInstance,
      params,
      meterId
    });

    // Subscribe to audio data if meterId provided
    if (meterId) {
      this.subscribeToAudioData(pluginId, meterId, meterConfig);
    }

    console.log(`🎨 Plugin visualizer registered: ${pluginId} (priority: ${priority})`);

    return visualizerInstance;
  }

  /**
   * Unregister a plugin visualizer
   * @param {string} pluginId - Plugin ID
   */
  unregister(pluginId) {
    const entry = this.visualizers.get(pluginId);
    if (!entry) {
      console.warn(`[PluginVisualizerAPI] Plugin ${pluginId} not found`);
      return;
    }

    // Remove from main registry
    this.visualizers.delete(pluginId);

    // Unregister from VisualizationEngine
    visualizationEngine.unregisterVisualizer(pluginId);

    // ⚡ GRACE PERIOD: Cache instance for 100ms (React StrictMode compatibility)
    // If re-registered within this window, re-use instead of destroying
    const timeout = setTimeout(() => {
      // Grace period expired - permanently destroy
      console.log(`[PluginVisualizerAPI] Grace period expired for ${pluginId} - destroying`);

      // Unsubscribe from audio data
      const unsubscribe = this.audioSubscriptions.get(pluginId);
      if (unsubscribe) {
        unsubscribe();
        this.audioSubscriptions.delete(pluginId);
      }

      // Cleanup visualizer
      entry.visualizer.destroy();

      // Remove from grace period cache
      this.gracePeriodCache.delete(pluginId);
    }, this.GRACE_PERIOD_MS);

    // Store in grace period cache
    this.gracePeriodCache.set(pluginId, {
      visualizer: entry.visualizer,
      params: entry.params,
      meterId: entry.meterId,
      priority: entry.visualizer.priority,
      timeout
    });

    console.log(`🗑️ Plugin visualizer unregistered: ${pluginId} (grace period: ${this.GRACE_PERIOD_MS}ms)`);
  }

  /**
   * Update plugin parameters
   * @param {string} pluginId - Plugin ID
   * @param {object} params - New parameters
   */
  updateParams(pluginId, params) {
    const entry = this.visualizers.get(pluginId);
    if (!entry) {
      console.warn(`[PluginVisualizerAPI] Plugin ${pluginId} not found`);
      return;
    }

    // Merge with existing params
    entry.params = { ...entry.params, ...params };

    // Request render with new params
    entry.visualizer.lastParams = entry.params;
    entry.visualizer.requestRender();
  }

  /**
   * Set visualizer priority
   * @param {string} pluginId - Plugin ID
   * @param {string} priority - Priority ('critical', 'normal', 'low')
   */
  setPriority(pluginId, priority) {
    if (!this.visualizers.has(pluginId)) {
      console.warn(`[PluginVisualizerAPI] Plugin ${pluginId} not found`);
      return;
    }

    visualizationEngine.setPriority(pluginId, priority);
    console.log(`🎯 Updated priority: ${pluginId} → ${priority}`);
  }

  /**
   * Subscribe to audio data from MeteringService
   * @param {string} pluginId - Plugin ID
   * @param {string} meterId - Meter ID
   * @param {object} config - Meter configuration
   */
  subscribeToAudioData(pluginId, meterId, config = {}) {
    const entry = this.visualizers.get(pluginId);
    if (!entry) return;

    // Unsubscribe from previous subscription
    const oldUnsubscribe = this.audioSubscriptions.get(pluginId);
    if (oldUnsubscribe) {
      oldUnsubscribe();
    }

    // Subscribe to MeteringService
    const unsubscribe = MeteringService.subscribe(
      meterId,
      (audioData) => {
        // Add audio data to params
        entry.params = {
          ...entry.params,
          audioData
        };
      },
      config
    );

    this.audioSubscriptions.set(pluginId, unsubscribe);
    console.log(`🔊 Subscribed to audio data: ${pluginId} → ${meterId}`);
  }

  /**
   * Get visualizer instance
   * @param {string} pluginId - Plugin ID
   * @returns {object} Visualizer instance
   */
  getVisualizer(pluginId) {
    const entry = this.visualizers.get(pluginId);
    return entry ? entry.visualizer : null;
  }

  /**
   * Get all registered plugins
   * @returns {Array<string>} Array of plugin IDs
   */
  getRegisteredPlugins() {
    return Array.from(this.visualizers.keys());
  }

  /**
   * Get visualizer stats
   * @param {string} pluginId - Plugin ID
   * @returns {object} Stats
   */
  getStats(pluginId) {
    const visualizer = this.getVisualizer(pluginId);
    return visualizer ? visualizer.getStats() : null;
  }

  /**
   * Get all stats
   * @returns {Array<object>} Array of stats
   */
  getAllStats() {
    return Array.from(this.visualizers.keys()).map(pluginId => ({
      pluginId,
      ...this.getStats(pluginId)
    }));
  }

  /**
   * Request render for a plugin
   * @param {string} pluginId - Plugin ID
   */
  requestRender(pluginId) {
    const visualizer = this.getVisualizer(pluginId);
    if (visualizer) {
      visualizer.requestRender();
    }
  }

  /**
   * Get VisualizationEngine stats
   * @returns {object} Engine stats
   */
  getEngineStats() {
    return visualizationEngine.getStats();
  }

  /**
   * Cleanup all visualizers
   */
  destroy() {
    this.visualizers.forEach((entry, pluginId) => {
      this.unregister(pluginId);
    });
    console.log('💥 PluginVisualizerAPI destroyed');
  }
}

// Singleton instance
export const PluginVisualizerAPI = new PluginVisualizerAPIClass();
