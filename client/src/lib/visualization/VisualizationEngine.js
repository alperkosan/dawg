/**
 * VISUALIZATION ENGINE - CORE
 *
 * Centralized, high-performance visualization system for audio plugins
 * Features:
 * - Canvas pool management (prevent memory leaks)
 * - Shared AnalyserNode pool (1 per effect)
 * - Priority-based rendering queue
 * - Performance budget system (16.67ms/frame target)
 * - Automatic throttling & quality scaling
 */

class VisualizationEngine {
  constructor() {
    // Core state
    this.initialized = false;
    this.audioContext = null;
    this.isRunning = false;
    this.frameId = null;

    // Canvas pool
    this.canvasPool = new Map(); // effectId → canvas
    this.maxCanvases = 15; // Prevent memory bloat

    // Analyser pool
    this.analyserPool = new Map(); // effectId → AnalyserNode
    this.analyserConfigs = {
      spectrum: { fftSize: 2048, smoothingTimeConstant: 0.8 },
      waveform: { fftSize: 1024, smoothingTimeConstant: 0.3 },
      meter: { fftSize: 512, smoothingTimeConstant: 0.5 }
    };

    // Visualizer registry
    this.visualizers = new Map(); // effectId → visualizer instance

    // Render queue with priority
    this.renderQueue = {
      critical: [], // Focused plugin (60fps)
      normal: [],   // Visible plugins (30fps)
      low: []       // Background plugins (15fps)
    };

    // Performance monitoring
    this.performance = {
      frameTime: 0,
      budget: 16.67, // ms (60fps)
      lastFrame: 0,
      fps: 60,
      skipFrames: 0,
      totalVisualizers: 0
    };

    // Sync manager
    this.sync = {
      audioTime: 0,
      visualTime: 0,
      latency: 0
    };

    // Memory tracking
    this.memory = {
      canvasMemory: 0, // MB
      bufferMemory: 0, // MB
      maxBudget: 50    // MB
    };

    // Bind methods
    this.renderLoop = this.renderLoop.bind(this);

    console.log('🎨 VisualizationEngine initialized');
  }

  /**
   * Initialize engine with AudioContext
   */
  init(audioContext) {
    if (this.initialized) {
      console.warn('VisualizationEngine already initialized');
      return;
    }

    this.audioContext = audioContext;
    this.initialized = true;

    // Sync audio clock
    this.syncAudioClock();

    console.log('✅ VisualizationEngine ready');
  }

  /**
   * Synchronize with audio context clock
   */
  syncAudioClock() {
    if (!this.audioContext) return;

    this.sync.audioTime = this.audioContext.currentTime;
    this.sync.visualTime = performance.now();
    this.sync.latency = this.audioContext.baseLatency || 0;
  }

  /**
   * Get audio time for current visual frame
   */
  getAudioTimeForFrame(frameTime) {
    const delta = (frameTime - this.sync.visualTime) / 1000;
    return this.sync.audioTime + delta - this.sync.latency;
  }

  /**
   * Register visualizer for an effect
   */
  registerVisualizer(effectId, visualizerInstance, priority = 'normal') {
    if (this.visualizers.has(effectId)) {
      console.warn(`Visualizer already registered for ${effectId}`);
      return;
    }

    this.visualizers.set(effectId, {
      instance: visualizerInstance,
      priority,
      lastRender: 0,
      frameInterval: this.getFrameInterval(priority)
    });

    this.addToRenderQueue(effectId, priority);
    this.performance.totalVisualizers++;

    console.log(`📊 Registered visualizer: ${effectId} (${priority})`);

    // Start render loop if not running
    if (!this.isRunning) {
      this.start();
    }
  }

  /**
   * Unregister visualizer
   */
  unregisterVisualizer(effectId) {
    const viz = this.visualizers.get(effectId);
    if (!viz) return;

    // Cleanup
    viz.instance.destroy?.();
    this.visualizers.delete(effectId);
    this.removeFromRenderQueue(effectId);
    this.performance.totalVisualizers--;

    // Release canvas
    this.releaseCanvas(effectId);

    // Release analyser
    this.releaseAnalyser(effectId);

    console.log(`🗑️ Unregistered visualizer: ${effectId}`);

    // Stop if no visualizers
    if (this.visualizers.size === 0) {
      this.stop();
    }
  }

  /**
   * Get frame interval based on priority
   */
  getFrameInterval(priority) {
    switch(priority) {
      case 'critical': return 16.67; // 60fps
      case 'normal': return 33.33;   // 30fps
      case 'low': return 66.67;      // 15fps
      default: return 33.33;
    }
  }

  /**
   * Add to render queue
   */
  addToRenderQueue(effectId, priority) {
    this.removeFromRenderQueue(effectId); // Remove from old queue first

    if (!this.renderQueue[priority]) {
      priority = 'normal';
    }

    this.renderQueue[priority].push(effectId);
  }

  /**
   * Remove from render queue
   */
  removeFromRenderQueue(effectId) {
    Object.keys(this.renderQueue).forEach(priority => {
      this.renderQueue[priority] = this.renderQueue[priority].filter(id => id !== effectId);
    });
  }

  /**
   * Update visualizer priority (e.g., when plugin gets focus)
   */
  setPriority(effectId, priority) {
    const viz = this.visualizers.get(effectId);
    if (!viz) return;

    viz.priority = priority;
    viz.frameInterval = this.getFrameInterval(priority);
    this.addToRenderQueue(effectId, priority);

    console.log(`🎯 Updated priority: ${effectId} → ${priority}`);
  }

  /**
   * Get or create canvas for effect
   */
  getCanvas(effectId, width, height) {
    if (this.canvasPool.has(effectId)) {
      return this.canvasPool.get(effectId);
    }

    // Check pool limit
    if (this.canvasPool.size >= this.maxCanvases) {
      console.warn('Canvas pool limit reached, reusing oldest');
      const oldestId = this.canvasPool.keys().next().value;
      this.releaseCanvas(oldestId);
    }

    // Create new canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    // Track memory
    const memoryMB = (width * height * 4) / (1024 * 1024);
    this.memory.canvasMemory += memoryMB;

    this.canvasPool.set(effectId, canvas);

    console.log(`🖼️ Created canvas: ${effectId} (${width}x${height}, ${memoryMB.toFixed(2)}MB)`);

    return canvas;
  }

  /**
   * Release canvas
   */
  releaseCanvas(effectId) {
    const canvas = this.canvasPool.get(effectId);
    if (!canvas) return;

    const memoryMB = (canvas.width * canvas.height * 4) / (1024 * 1024);
    this.memory.canvasMemory -= memoryMB;

    this.canvasPool.delete(effectId);
    console.log(`🗑️ Released canvas: ${effectId}`);
  }

  /**
   * Get or create AnalyserNode for effect
   */
  getAnalyser(effectId, audioNode, type = 'spectrum') {
    if (this.analyserPool.has(effectId)) {
      return this.analyserPool.get(effectId);
    }

    if (!this.audioContext) {
      console.error('AudioContext not initialized');
      return null;
    }

    const config = this.analyserConfigs[type] || this.analyserConfigs.spectrum;
    const analyser = this.audioContext.createAnalyser();

    analyser.fftSize = config.fftSize;
    analyser.smoothingTimeConstant = config.smoothingTimeConstant;

    // Connect: audioNode → analyser (tap, doesn't affect signal)
    if (audioNode) {
      audioNode.connect(analyser);
    }

    this.analyserPool.set(effectId, analyser);

    // Track memory
    const bufferSize = analyser.frequencyBinCount;
    const memoryMB = (bufferSize * 4) / (1024 * 1024);
    this.memory.bufferMemory += memoryMB;

    console.log(`🔊 Created analyser: ${effectId} (FFT: ${config.fftSize}, ${memoryMB.toFixed(2)}MB)`);

    return analyser;
  }

  /**
   * Release AnalyserNode
   */
  releaseAnalyser(effectId) {
    const analyser = this.analyserPool.get(effectId);
    if (!analyser) return;

    analyser.disconnect();

    const bufferSize = analyser.frequencyBinCount;
    const memoryMB = (bufferSize * 4) / (1024 * 1024);
    this.memory.bufferMemory -= memoryMB;

    this.analyserPool.delete(effectId);
    console.log(`🗑️ Released analyser: ${effectId}`);
  }

  /**
   * Main render loop
   */
  renderLoop(timestamp) {
    if (!this.isRunning) return;

    const frameStart = performance.now();
    const deltaTime = timestamp - this.performance.lastFrame;

    // Calculate FPS
    this.performance.fps = 1000 / deltaTime;
    this.performance.lastFrame = timestamp;

    // Sync audio clock periodically
    if (timestamp % 1000 < 16.67) {
      this.syncAudioClock();
    }

    let budgetUsed = 0;
    const budgetPerPriority = {
      critical: 10, // 10ms for focused plugin
      normal: 5,    // 5ms for visible plugins
      low: 1.67     // 1.67ms for background
    };

    // Render by priority
    ['critical', 'normal', 'low'].forEach(priority => {
      if (budgetUsed >= this.performance.budget) {
        this.performance.skipFrames++;
        return;
      }

      this.renderQueue[priority].forEach(effectId => {
        const viz = this.visualizers.get(effectId);
        if (!viz) return;

        // Check frame interval
        if (timestamp - viz.lastRender < viz.frameInterval) {
          return;
        }

        const renderStart = performance.now();

        // Get params from visualizer instance
        const params = viz.instance.lastParams || {};

        // Render visualizer with params
        try {
          viz.instance.render?.(timestamp, params);
          viz.lastRender = timestamp;
        } catch (error) {
          console.error(`Render error for ${effectId}:`, error);
        }

        const renderTime = performance.now() - renderStart;
        budgetUsed += renderTime;

        // Check budget for this priority
        if (budgetUsed > budgetPerPriority[priority]) {
          return; // Skip remaining in this priority
        }
      });
    });

    this.performance.frameTime = performance.now() - frameStart;

    // Auto-throttle if over budget
    if (this.performance.frameTime > this.performance.budget) {
      this.autoThrottle();
    }

    // Continue loop
    this.frameId = requestAnimationFrame(this.renderLoop);
  }

  /**
   * Auto-throttle when over budget
   */
  autoThrottle() {
    // Downgrade normal to low priority
    if (this.renderQueue.normal.length > 0) {
      const downgradeId = this.renderQueue.normal[0];
      this.setPriority(downgradeId, 'low');
      console.warn(`⚠️ Auto-throttled: ${downgradeId} → low priority`);
    }
  }

  /**
   * Start render loop
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.performance.lastFrame = performance.now();
    this.frameId = requestAnimationFrame(this.renderLoop);

    console.log('▶️ VisualizationEngine started');
  }

  /**
   * Stop render loop
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    console.log('⏸️ VisualizationEngine stopped');
  }

  /**
   * Get performance stats
   */
  getStats() {
    return {
      fps: Math.round(this.performance.fps),
      frameTime: this.performance.frameTime.toFixed(2),
      budget: this.performance.budget,
      utilization: ((this.performance.frameTime / this.performance.budget) * 100).toFixed(1),
      visualizers: this.performance.totalVisualizers,
      canvasMemory: this.memory.canvasMemory.toFixed(2),
      bufferMemory: this.memory.bufferMemory.toFixed(2),
      totalMemory: (this.memory.canvasMemory + this.memory.bufferMemory).toFixed(2),
      skipFrames: this.performance.skipFrames,
      queues: {
        critical: this.renderQueue.critical.length,
        normal: this.renderQueue.normal.length,
        low: this.renderQueue.low.length
      }
    };
  }

  /**
   * Cleanup all resources
   */
  destroy() {
    this.stop();

    // Clear all visualizers
    this.visualizers.forEach((viz, effectId) => {
      this.unregisterVisualizer(effectId);
    });

    // Clear pools
    this.canvasPool.clear();
    this.analyserPool.clear();

    this.initialized = false;
    console.log('💥 VisualizationEngine destroyed');
  }
}

// Singleton instance
export const visualizationEngine = new VisualizationEngine();
