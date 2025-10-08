/**
 * BASE PLUGIN VISUALIZER
 *
 * Abstract base class for all plugin visualizers.
 * Integrates with VisualizationEngine for centralized rendering.
 *
 * Features:
 * - Automatic lifecycle management
 * - Parameter change detection
 * - Canvas/WebGL support
 * - Performance tracking
 */

export class BasePluginVisualizer {
  constructor(config) {
    this.id = config.id || `viz-${Date.now()}`;
    this.pluginId = config.pluginId;
    this.canvas = config.canvas;
    this.priority = config.priority || 'normal';
    this.renderMode = config.renderMode || 'canvas'; // 'canvas' or 'webgl'

    // State
    this.initialized = false;
    this.lastParams = {};
    this.needsRender = true;

    // Performance
    this.renderCount = 0;
    this.totalRenderTime = 0;
    this.lastRenderTime = 0;

    // Context
    this.ctx = null;
    this.gl = null;

    console.log(`🎨 BasePluginVisualizer created: ${this.id}`);
  }

  /**
   * Initialize visualizer (called once)
   */
  async init() {
    if (this.initialized) return;

    if (!this.canvas) {
      console.error(`[${this.id}] No canvas provided`);
      return;
    }

    // Setup rendering context
    if (this.renderMode === 'webgl') {
      this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
      if (!this.gl) {
        console.warn(`[${this.id}] WebGL not available, falling back to canvas`);
        this.renderMode = 'canvas';
        this.ctx = this.canvas.getContext('2d');
      }
    } else {
      this.ctx = this.canvas.getContext('2d');
    }

    // Call child init
    await this.onInit();

    this.initialized = true;
    console.log(`✅ Visualizer initialized: ${this.id} (${this.renderMode})`);
  }

  /**
   * Override: Custom initialization
   */
  async onInit() {
    // Override in child class
  }

  /**
   * Main render function (called by VisualizationEngine)
   */
  render(timestamp, params = {}) {
    if (!this.initialized || !this.canvas) return;

    const renderStart = performance.now();

    // Check if parameters changed
    const paramsChanged = this.detectParameterChange(params);
    if (paramsChanged || this.needsRender) {
      this.lastParams = { ...params };

      // Resize canvas if needed
      this.handleCanvasResize();

      // Call appropriate render method
      if (this.renderMode === 'webgl') {
        this.onRenderWebGL(this.gl, timestamp, params);
      } else {
        this.onRenderCanvas(this.ctx, timestamp, params);
      }

      this.needsRender = false;
    }

    // Performance tracking
    const renderTime = performance.now() - renderStart;
    this.totalRenderTime += renderTime;
    this.lastRenderTime = renderTime;
    this.renderCount++;
  }

  /**
   * Override: Canvas rendering
   */
  onRenderCanvas(ctx, timestamp, params) {
    // Override in child class
    console.warn(`[${this.id}] onRenderCanvas not implemented`);
  }

  /**
   * Override: WebGL rendering
   */
  onRenderWebGL(gl, timestamp, params) {
    // Override in child class
    console.warn(`[${this.id}] onRenderWebGL not implemented`);
  }

  /**
   * Handle canvas resize
   */
  handleCanvasResize() {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const width = Math.floor(rect.width * dpr);
    const height = Math.floor(rect.height * dpr);

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;

      if (this.ctx) {
        this.ctx.scale(dpr, dpr);
      }

      this.onResize?.(width, height);
    }
  }

  /**
   * Override: Resize event
   */
  onResize(width, height) {
    // Override in child class if needed
  }

  /**
   * Detect parameter changes
   */
  detectParameterChange(params) {
    const keys = Object.keys(params);

    // Check if any parameter changed
    for (const key of keys) {
      if (params[key] !== this.lastParams[key]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Request re-render on next frame
   */
  requestRender() {
    this.needsRender = true;
  }

  /**
   * Get performance stats
   */
  getStats() {
    return {
      id: this.id,
      renderCount: this.renderCount,
      avgRenderTime: this.renderCount > 0 ? (this.totalRenderTime / this.renderCount).toFixed(2) : 0,
      lastRenderTime: this.lastRenderTime.toFixed(2),
      priority: this.priority,
      renderMode: this.renderMode
    };
  }

  /**
   * Cleanup
   */
  destroy() {
    this.onDestroy?.();

    this.initialized = false;
    this.ctx = null;
    this.gl = null;
    this.canvas = null;

    console.log(`💥 Visualizer destroyed: ${this.id}`);
  }

  /**
   * Override: Custom cleanup
   */
  onDestroy() {
    // Override in child class
  }
}
